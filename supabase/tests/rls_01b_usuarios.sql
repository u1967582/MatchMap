-- ============================================================================
-- Pruebas de public.users · Auditoría 01b (privacidad y escalado de privilegios)
-- ============================================================================
-- Se detiene con "AUDIT01B FAIL: …"; si llega al final muestra 'AUDIT01B RLS OK'.
-- TODO va en BEGIN … ROLLBACK, con ids ficticios: puede ejecutarse en prod sin
-- dejar nada escrito (💻 local, con aprobación, como `postgres`).
-- ============================================================================
BEGIN;

INSERT INTO auth.users (id, aud, role, email, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('0a0a0a0a-0000-4000-8000-0000000e0001', 'authenticated', 'authenticated', 'audit01b-a@example.invalid',   false, '{}', '{}', now(), now()),
  ('0a0a0a0a-0000-4000-8000-0000000e0002', 'authenticated', 'authenticated', 'audit01b-b@example.invalid',   false, '{}', '{}', now(), now()),
  ('0a0a0a0a-0000-4000-8000-0000000e0004', 'authenticated', 'authenticated', 'audit01b-adm@example.invalid', false, '{}', '{}', now(), now()),
  ('0a0a0a0a-0000-4000-8000-0000000e0005', 'authenticated', 'authenticated', NULL,                          true,  '{}', '{}', now(), now());

INSERT INTO public.users (id, email, username)
VALUES
  ('0a0a0a0a-0000-4000-8000-0000000e0001', 'audit01b-a@example.invalid', 'audit01b_a'),
  ('0a0a0a0a-0000-4000-8000-0000000e0002', 'audit01b-b@example.invalid', 'audit01b_b'),
  ('0a0a0a0a-0000-4000-8000-0000000e0004', 'audit01b-adm@example.invalid', 'audit01b_adm')
ON CONFLICT (id) DO NOTHING;
-- trg_users_protect_privileged_columns revierte este UPDATE sin service_role.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.users SET is_super_user = true WHERE id = '0a0a0a0a-0000-4000-8000-0000000e0004';

-- Ejecuta sql como un rol y unas claims. Devuelve true si el intento funcionó.
CREATE FUNCTION pg_temp.audit01b_try(p_role text, p_claims text, p_sql text) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', p_claims, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    n := 0;
  END;
  RESET ROLE;
  RETURN n > 0;
END $$;

CREATE FUNCTION pg_temp.audit01b_count(p_role text, p_claims text, p_sql text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', p_claims, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  EXECUTE p_sql INTO n;
  RESET ROLE;
  RETURN n;
END $$;

DO $$
DECLARE
  guest text := '{"sub":"0a0a0a0a-0000-4000-8000-0000000e0005","role":"authenticated","is_anonymous":true}';
  a     text := '{"sub":"0a0a0a0a-0000-4000-8000-0000000e0001","role":"authenticated"}';
  adm   text := '{"sub":"0a0a0a0a-0000-4000-8000-0000000e0004","role":"authenticated"}';
  noone text := '{"role":"anon"}';
  ajenos text := $q$SELECT count(*) FROM public.users WHERE email LIKE 'audit01b-%'$q$;
BEGIN
  -- Lectura de datos personales
  IF pg_temp.audit01b_count('authenticated', guest, ajenos) <> 0 THEN
    RAISE EXCEPTION 'AUDIT01B FAIL: un invitado lee emails de otros usuarios';
  END IF;
  IF pg_temp.audit01b_count('authenticated', a, ajenos) <> 1 THEN
    RAISE EXCEPTION 'AUDIT01B FAIL: un usuario debe ver solo su propia fila';
  END IF;
  IF pg_temp.audit01b_count('anon', noone, ajenos) <> 0 THEN
    RAISE EXCEPTION 'AUDIT01B FAIL: anon lee public.users';
  END IF;
  IF pg_temp.audit01b_count('authenticated', adm, ajenos) <> 3 THEN
    RAISE EXCEPTION 'AUDIT01B FAIL: el admin debe seguir viendo todos los usuarios';
  END IF;

  -- Escalado: la sesión sin JWT crea la fila del invitado como super admin
  IF pg_temp.audit01b_try('anon', noone, $q$INSERT INTO public.users (id, email, username, is_super_user)
       VALUES ('0a0a0a0a-0000-4000-8000-0000000e0005', 'x@example.invalid', 'x', true)$q$) THEN
    RAISE EXCEPTION 'AUDIT01B FAIL: anon crea una fila de super admin';
  END IF;

  -- Escalado: un usuario borra su fila y la recrea como super admin
  IF pg_temp.audit01b_try('authenticated', a, $q$DELETE FROM public.users WHERE id = '0a0a0a0a-0000-4000-8000-0000000e0001'$q$) THEN
    RAISE EXCEPTION 'AUDIT01B FAIL: un usuario borra su fila de public.users';
  END IF;
  IF pg_temp.audit01b_try('authenticated', a, $q$INSERT INTO public.users (id, email, username, is_super_user)
       VALUES ('0a0a0a0a-0000-4000-8000-0000000e0002', 'y@example.invalid', 'y', true)
       ON CONFLICT (id) DO UPDATE SET username = 'y'$q$) THEN
    RAISE EXCEPTION 'AUDIT01B FAIL: authenticated inserta en public.users';
  END IF;

  -- Lo que la app sí necesita
  IF NOT pg_temp.audit01b_try('authenticated', a, $q$UPDATE public.users SET full_name = 'Nombre' WHERE id = '0a0a0a0a-0000-4000-8000-0000000e0001'$q$) THEN
    RAISE EXCEPTION 'AUDIT01B FAIL: el usuario debe poder editar su perfil';
  END IF;
END $$;

SELECT 'AUDIT01B RLS OK' AS resultado;
ROLLBACK;
