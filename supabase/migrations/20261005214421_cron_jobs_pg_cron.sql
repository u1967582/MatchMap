-- Crons de sync-football y send-match-notifications con pg_cron + pg_net,
-- sustituyendo a GitHub Actions (que retrasaba el cron de */15 hasta ~3 h).
--
-- El secreto se genera dentro de la base de datos y vive solo en Vault: las
-- edge functions lo leen con get_cron_secret() (solo service_role) y pg_cron
-- lo envía en la cabecera x-cron-secret. Ambas funciones se despliegan con
-- verify_jwt = false (ver supabase/config.toml): x-cron-secret es su única
-- autorización.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cron_secret',
      'Secreto compartido entre pg_cron y las edge functions de cron'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO service_role;

CREATE OR REPLACE FUNCTION public.invoke_cron_function(p_slug text, p_timeout_ms integer DEFAULT 5000)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT net.http_post(
    url := 'https://hmtfxpihkoisncglllmq.supabase.co/functions/v1/' || p_slug,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public.get_cron_secret()
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := p_timeout_ms
  );
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_cron_function(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_cron_function(text, integer) TO service_role;

-- cron.schedule con nombre hace upsert del job
SELECT cron.schedule('sync-football-daily', '0 6 * * *',
  $$SELECT public.invoke_cron_function('sync-football', 150000)$$);

SELECT cron.schedule('send-match-notifications', '*/15 * * * *',
  $$SELECT public.invoke_cron_function('send-match-notifications', 60000)$$);
