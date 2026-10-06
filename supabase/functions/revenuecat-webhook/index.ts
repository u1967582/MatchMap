// supabase/functions/revenuecat-webhook/index.ts
//
// Activa los Boost (pagos únicos, consumibles) cuando RevenueCat confirma
// el pago. Es el único que puede poner un boost en 'active' (service_role,
// bypassa RLS); el cliente solo crea filas 'pending'.
//
// Eventos:
//   NON_RENEWING_PURCHASE  → compra de pago único (el caso normal)
//   INITIAL_PURCHASE       → por si algún producto se configurase como suscripción
//   CANCELLATION           → en pagos únicos significa reembolso → 'cancelled'
//   TEST                   → botón "Send test event" del dashboard
//
// Respuestas: 200 si el evento está procesado o no aplica (RevenueCat no
// reintenta), 500 si falla la base de datos (RevenueCat reintenta).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type BoostPlan = '7d' | '1m' | '1y';

const BOOST_BAR_ATTRIBUTE = 'boost_bar_id';

// Copia de utils/boostPlans.ts (la función no puede importar código de la app).
function getPlanFromProductId(productId: string | null | undefined): BoostPlan | null {
  if (!productId) return null;
  if (productId.includes('boost_7d')) return '7d';
  if (productId.includes('boost_1m')) return '1m';
  if (productId.includes('boost_1y')) return '1y';
  return null;
}

function getBoostEndAt(plan: BoostPlan, start: Date): Date {
  const end = new Date(start.getTime());
  if (plan === '7d') end.setDate(end.getDate() + 7);
  else if (plan === '1m') end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return end;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Todos los ids de usuario de Supabase que RevenueCat asocia a la compra. */
function candidateUserIds(event: any): string[] {
  const ids = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id)))];
}

function transactionIds(event: any): string[] {
  const ids = [event.transaction_id, event.original_transaction_id];
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

async function handlePurchase(supabase: SupabaseClient, event: any): Promise<Response> {
  const plan = getPlanFromProductId(event.product_id);
  if (!plan) {
    console.warn(`[revenuecat-webhook] product_id ajeno a boost="${event.product_id}", se ignora`);
    return json({ ignored: 'unknown_product' });
  }

  const txIds = transactionIds(event);
  if (txIds.length === 0) {
    console.error('[revenuecat-webhook] Evento sin transaction_id', event.id);
    return json({ ignored: 'no_transaction' });
  }
  const primaryTxId = txIds[0];
  const userIds = candidateUserIds(event);

  // 1. Fila previa creada por el cliente (pending) o por un envío anterior.
  const { data: existingRows, error: existingError } = await supabase
    .from('bar_boosts')
    .select('id, bar_id, status')
    .in('revenuecat_transaction_id', txIds)
    .limit(1);
  if (existingError) throw existingError;
  const existing = existingRows?.[0];

  if (existing?.status === 'active') {
    return json({ ok: true, idempotent: true });
  }

  // 2. Bar: el de la fila previa o el atributo boost_bar_id puesto antes de comprar.
  const attributeBarId: string | undefined = event.subscriber_attributes?.[BOOST_BAR_ATTRIBUTE]?.value;
  let barId: string | undefined = existing?.bar_id ?? attributeBarId;

  // Último recurso (versiones antiguas de la app): si el usuario tiene un solo bar.
  if (!barId && userIds.length > 0) {
    const { data: ownedBars, error } = await supabase.from('bars').select('id').in('owner_id', userIds).limit(2);
    if (error) throw error;
    if (ownedBars?.length === 1) barId = ownedBars[0].id;
  }

  if (!barId) {
    console.error(`[revenuecat-webhook] No se puede asignar la compra a un bar. users=${userIds} tx=${primaryTxId}`);
    return json({ ignored: 'no_bar' });
  }

  // 3. Nunca confiar en el bar que viene del cliente: tiene que ser del comprador.
  const { data: bar, error: barError } = await supabase
    .from('bars')
    .select('id, owner_id')
    .eq('id', barId)
    .maybeSingle();
  if (barError) throw barError;
  if (!bar || !userIds.includes(bar.owner_id)) {
    console.error(`[revenuecat-webhook] El bar ${barId} no es del comprador (users=${userIds}) tx=${primaryTxId}`);
    return json({ ignored: 'bar_not_owned' });
  }

  // 4. Fechas calculadas en servidor. Si el bar ya tiene un boost activo, el
  //    nuevo empieza cuando acaba ese (se suman, no se pisan).
  const purchasedAt = new Date(event.purchased_at_ms ?? event.event_timestamp_ms ?? Date.now());
  const { data: current, error: currentError } = await supabase
    .from('bar_boosts')
    .select('end_at')
    .eq('bar_id', bar.id)
    .eq('status', 'active')
    .gt('end_at', purchasedAt.toISOString())
    .order('end_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentError) throw currentError;

  const startAt = current?.end_at ? new Date(current.end_at) : purchasedAt;
  const endAt = getBoostEndAt(plan, startAt);

  const priceInCurrency = event.price_in_purchased_currency ?? event.price ?? 0;
  const row = {
    bar_id: bar.id,
    user_id: bar.owner_id,
    plan,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    status: 'active',
    amount_cents: Math.round(Number(priceInCurrency) * 100),
    currency: String(event.currency ?? 'eur').toLowerCase(),
  };

  if (existing) {
    const { error } = await supabase.from('bar_boosts').update(row).eq('id', existing.id);
    if (error) throw error;
  } else {
    // upsert por si el insert 'pending' del cliente entra justo entre medias
    const { error } = await supabase
      .from('bar_boosts')
      .upsert({ ...row, revenuecat_transaction_id: primaryTxId }, { onConflict: 'revenuecat_transaction_id' });
    if (error) throw error;
  }

  console.log(
    `[revenuecat-webhook] ${event.type} ok bar=${bar.id} plan=${plan} hasta=${row.end_at} env=${event.environment} tx=${primaryTxId}`,
  );
  return json({ ok: true });
}

async function handleRefund(supabase: SupabaseClient, event: any): Promise<Response> {
  const txIds = transactionIds(event);
  if (txIds.length === 0) return json({ ignored: 'no_transaction' });

  // En una suscripción, CANCELLATION solo es "renovación desactivada": no se revoca.
  const isOneTime = !event.expiration_at_ms;
  if (!isOneTime && event.cancel_reason !== 'CUSTOMER_SUPPORT') {
    return json({ ignored: 'subscription_cancellation' });
  }

  const { data, error } = await supabase
    .from('bar_boosts')
    .update({ status: 'cancelled' })
    .in('revenuecat_transaction_id', txIds)
    .select('id');
  if (error) throw error;

  if (!data?.length) {
    console.warn(`[revenuecat-webhook] CANCELLATION sin fila para tx=${txIds}`);
  }
  return json({ ok: true });
}

serve(async (req) => {
  const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const secret = req.headers.get('Authorization');
  if (!expectedSecret || secret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let event: any;
  try {
    event = (await req.json())?.event;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!event?.type) return json({ error: 'Missing event' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    switch (event.type) {
      case 'NON_RENEWING_PURCHASE':
      case 'INITIAL_PURCHASE':
        return await handlePurchase(supabase, event);
      case 'CANCELLATION':
        return await handleRefund(supabase, event);
      case 'TEST':
        console.log('[revenuecat-webhook] TEST event recibido');
        return json({ ok: true, test: true });
      default:
        return json({ ignored: event.type });
    }
  } catch (error: any) {
    console.error(`[revenuecat-webhook] Error procesando ${event.type}:`, error?.message ?? error);
    return json({ error: 'Internal error' }, 500);
  }
});
