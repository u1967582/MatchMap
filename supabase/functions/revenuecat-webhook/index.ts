// supabase/functions/revenuecat-webhook/index.ts
// Ver handler.ts para la lógica (separada para poder testearla).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHandler } from './handler.ts';

serve(
  createHandler({
    secret: Deno.env.get('REVENUECAT_WEBHOOK_SECRET'),
    getClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
  })
);
