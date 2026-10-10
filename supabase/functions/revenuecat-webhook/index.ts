// supabase/functions/revenuecat-webhook/index.ts
//
// Fuente de verdad de la activación de boosts. El cliente solo puede insertar
// filas 'pending' (RLS); aquí, con service_role, se pasan a 'active' tras
// confirmar el pago con RevenueCat. Es idempotente: RevenueCat reintenta los
// webhooks y además puede llegar antes o después del insert del cliente.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  computeBoostWindow,
  getActionForEvent,
  getBoostBarIdAttribute,
  getPlanFromProductId,
  getTransactionId,
  isSupabaseUserId,
  type RevenueCatEvent,
} from './logic.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function resolveBar(
  supabase: SupabaseClient,
  event: RevenueCatEvent,
  existingBarId: string | null,
): Promise<{ id: string; owner_id: string } | null> {
  const barId = existingBarId ?? getBoostBarIdAttribute(event);

  if (barId) {
    const { data, error } = await supabase
      .from('bars')
      .select('id, owner_id')
      .eq('id', barId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  // Último recurso (clientes antiguos sin el atributo): primer bar del dueño.
  if (!isSupabaseUserId(event.app_user_id)) return null;
  const { data, error } = await supabase
    .from('bars')
    .select('id, owner_id')
    .eq('owner_id', event.app_user_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function activateBoost(supabase: SupabaseClient, event: RevenueCatEvent, transactionId: string) {
  const plan = getPlanFromProductId(event.product_id);
  if (!plan) {
    console.warn(`[revenuecat-webhook] product_id desconocido="${event.product_id}", tx=${transactionId}`);
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from('bar_boosts')
    .select('id, bar_id, status')
    .eq('revenuecat_transaction_id', transactionId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.status === 'active') {
    // Reintento de RevenueCat: ya procesado, no volver a extender el boost.
    return;
  }

  const bar = await resolveBar(supabase, event, existing?.bar_id ?? null);
  if (!bar) {
    console.warn(
      `[revenuecat-webhook] Sin bar para app_user_id=${event.app_user_id}, tx=${transactionId}`,
    );
    return;
  }

  if (isSupabaseUserId(event.app_user_id) && bar.owner_id !== event.app_user_id) {
    console.warn(
      `[revenuecat-webhook] app_user_id=${event.app_user_id} no es dueño del bar=${bar.id}; se activa igualmente (pago confirmado), tx=${transactionId}`,
    );
  }

  const now = new Date();
  const { data: current, error: currentError } = await supabase
    .from('bar_boosts')
    .select('end_at')
    .eq('bar_id', bar.id)
    .eq('status', 'active')
    .gt('end_at', now.toISOString())
    .order('end_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentError) throw currentError;

  const { startAt, endAt } = computeBoostWindow(plan, now, current?.end_at);

  const { error: upsertError } = await supabase
    .from('bar_boosts')
    .upsert(
      {
        bar_id: bar.id,
        user_id: bar.owner_id,
        plan,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        status: 'active',
        amount_cents: Math.round((event.price ?? 0) * 100),
        currency: (event.currency ?? 'eur').toLowerCase(),
        revenuecat_transaction_id: transactionId,
      },
      { onConflict: 'revenuecat_transaction_id' },
    );
  if (upsertError) throw upsertError;

  console.log(`[revenuecat-webhook] Boost ${plan} activo para bar=${bar.id} hasta ${endAt.toISOString()}, tx=${transactionId}`);
}

async function setStatus(
  supabase: SupabaseClient,
  transactionId: string,
  status: 'expired' | 'cancelled',
  eventType: string,
) {
  const { data, error } = await supabase
    .from('bar_boosts')
    .update({ status })
    .eq('revenuecat_transaction_id', transactionId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    console.warn(`[revenuecat-webhook] ${eventType}: ninguna fila para tx=${transactionId}`);
  }
}

serve(async (req) => {
  const secret = req.headers.get('Authorization');
  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!expectedSecret || secret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let event: RevenueCatEvent;
  try {
    const payload = await req.json();
    event = payload?.event;
    if (!event?.type) throw new Error('payload sin event.type');
  } catch (error: any) {
    // Payload inválido: reintentar no lo arreglará.
    return json({ error: error.message }, 400);
  }

  const action = getActionForEvent(event.type);
  if (action === 'ignore') {
    return json({ success: true, ignored: event.type });
  }

  const transactionId = getTransactionId(event);
  if (!transactionId) {
    console.warn(`[revenuecat-webhook] ${event.type} sin transaction_id`);
    return json({ success: true, ignored: 'no_transaction_id' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    if (action === 'activate') {
      await activateBoost(supabase, event, transactionId);
    } else if (action === 'expire') {
      await setStatus(supabase, transactionId, 'expired', event.type);
    } else {
      await setStatus(supabase, transactionId, 'cancelled', event.type);
    }
    return json({ success: true });
  } catch (error: any) {
    // Error de BD: 500 para que RevenueCat reintente.
    console.error(`[revenuecat-webhook] Error procesando ${event.type} tx=${transactionId}:`, error?.message ?? error);
    return json({ error: 'internal_error' }, 500);
  }
});
