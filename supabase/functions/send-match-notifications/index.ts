// supabase/functions/send-match-notifications/index.ts
// Ver handler.ts para la lógica (separada para poder testearla).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHandler } from './handler.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(createHandler({ supabase, fetch }))
