// supabase/functions/revenuecat-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const payload = await req.json();
    const event = payload.event;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        // Activar o renovar boost
        await supabase
          .from('bar_boosts')
          .update({ status: 'active' })
          .eq('revenuecat_transaction_id', event.original_transaction_id);
        break;

      case 'CANCELLATION':
      case 'EXPIRATION':
        // Desactivar boost
        await supabase
          .from('bar_boosts')
          .update({ status: 'expired' })
          .eq('revenuecat_transaction_id', event.original_transaction_id);
        break;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
