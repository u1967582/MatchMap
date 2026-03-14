// supabase/functions/revenuecat-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // 1. Verificar secret
    const secret = req.headers.get('Authorization');
    const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (!secret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const event = payload.event;
    const transactionId: string = event.original_transaction_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL': {
        const { data: updated, error: updateError } = await supabase
          .from('bar_boosts')
          .update({ status: 'active' })
          .eq('revenuecat_transaction_id', transactionId)
          .select('id');

        if (updateError) {
          console.error(`[revenuecat-webhook] Error UPDATE ${event.type}:`, updateError.message);
          break;
        }

        if (updated.length === 0) {
          if (event.type === 'RENEWAL') {
            console.warn(`[revenuecat-webhook] RENEWAL: cap fila trobada per revenuecat_transaction_id=${transactionId}`);
            break;
          }

          // INITIAL_PURCHASE: el Paywall pot haver fallat — intentem INSERT de rescat
          const userId: string = event.app_user_id;
          const { data: bar } = await supabase
            .from('bars')
            .select('id')
            .eq('owner_id', userId)
            .limit(1)
            .single();

          if (!bar) {
            console.warn(`[revenuecat-webhook] INITIAL_PURCHASE: no s'ha trobat bar per user=${userId}, transaction=${transactionId}`);
            break;
          }

          const productId: string = event.product_id ?? '';
          const plan = productId.includes('boost_7d') ? '7d'
            : productId.includes('boost_1m') ? '1m'
            : productId.includes('boost_1y') ? '1y'
            : null;

          if (!plan) {
            console.warn(`[revenuecat-webhook] INITIAL_PURCHASE: product_id desconegut="${productId}", transaction=${transactionId}`);
            break;
          }

          const endAt = event.expiration_at_ms
            ? new Date(event.expiration_at_ms).toISOString()
            : null;

          const { error: insertError } = await supabase
            .from('bar_boosts')
            .insert({
              bar_id: bar.id,
              user_id: userId,
              plan,
              start_at: new Date().toISOString(),
              end_at: endAt,
              status: 'active',
              amount_cents: Math.round((event.price ?? 0) * 100),
              currency: (event.currency ?? 'eur').toLowerCase(),
              revenuecat_transaction_id: transactionId,
            });

          if (insertError) {
            console.error(`[revenuecat-webhook] INITIAL_PURCHASE INSERT error:`, insertError.message);
          } else {
            console.log(`[revenuecat-webhook] INITIAL_PURCHASE INSERT de rescat ok per bar=${bar.id}, transaction=${transactionId}`);
          }
        }
        break;
      }

      case 'CANCELLATION':
      case 'EXPIRATION': {
        const { data: updated, error: updateError } = await supabase
          .from('bar_boosts')
          .update({ status: 'expired' })
          .eq('revenuecat_transaction_id', transactionId)
          .select('id');

        if (updateError) {
          console.error(`[revenuecat-webhook] Error UPDATE ${event.type}:`, updateError.message);
          break;
        }

        if (updated.length === 0) {
          console.warn(`[revenuecat-webhook] ${event.type}: cap fila trobada per revenuecat_transaction_id=${transactionId}`);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[revenuecat-webhook] Error inesperat:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
