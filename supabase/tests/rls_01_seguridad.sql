-- ============================================================================
-- Pruebas de RLS y Storage · Auditoría 01 (seguridad Supabase)
-- ============================================================================
-- Qué prueba: que un invitado (sesión anónima), un usuario normal, un
-- propietario y un super admin solo pueden leer/escribir lo que les toca tras
-- aplicar 20261015120000_audit01_security_rls_storage.sql.
--
-- Cómo ejecutarlo (💻 sesión local, con aprobación):
--   - En el SQL editor de Supabase o con psql como `postgres`.
--   - TODO va dentro de BEGIN … ROLLBACK: crea usuarios/bares/ficheros de
--     prueba con ids ficticios (…-4000-8000-0000000a01…) y los descarta al
--     final. No toca datos reales ni deja nada escrito.
--   - Si alguna comprobación falla, el script se detiene con
--     "AUDIT01 FAIL: …". Si llega al final, muestra 'AUDIT01 RLS OK'.
--   - Las consultas de diagnóstico del final (solo lectura) listan tablas sin
--     RLS, políticas de Storage y funciones SECURITY DEFINER ejecutables por
--     anon, para revisarlas a mano.
--
-- Nota: los INSERT de fixtures usan solo columnas conocidas. Si prod exige
-- otra columna NOT NULL en public.users o public.bars, añádela aquí.
-- ============================================================================

BEGIN;

-- Ids de prueba
--   A     usuario normal       0a0a0a0a-0000-4000-8000-0000000a0001
--   B     usuario normal       0a0a0a0a-0000-4000-8000-0000000a0002
--   OWN   propietario          0a0a0a0a-0000-4000-8000-0000000a0003
--   ADM   super admin          0a0a0a0a-0000-4000-8000-0000000a0004
--   GUEST invitado anónimo     0a0a0a0a-0000-4000-8000-0000000a0005
--   bar pendiente de OWN       0b0b0b0b-0000-4000-8000-0000000b0001
--   bar aprobado de OWN        0b0b0b0b-0000-4000-8000-0000000b0002
--   bar aprobado sin dueño     0b0b0b0b-0000-4000-8000-0000000b0003

-- ---------------------------------------------------------------- fixtures --
INSERT INTO auth.users (id, aud, role, email, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('0a0a0a0a-0000-4000-8000-0000000a0001', 'authenticated', 'authenticated', 'audit01-a@example.invalid',     false, '{}', '{}', now(), now()),
  ('0a0a0a0a-0000-4000-8000-0000000a0002', 'authenticated', 'authenticated', 'audit01-b@example.invalid',     false, '{}', '{}', now(), now()),
  ('0a0a0a0a-0000-4000-8000-0000000a0003', 'authenticated', 'authenticated', 'audit01-own@example.invalid',   false, '{}', '{}', now(), now()),
  ('0a0a0a0a-0000-4000-8000-0000000a0004', 'authenticated', 'authenticated', 'audit01-adm@example.invalid',   false, '{}', '{}', now(), now()),
  ('0a0a0a0a-0000-4000-8000-0000000a0005', 'authenticated', 'authenticated', NULL,                            true,  '{}', '{}', now(), now());

-- public.users puede haberse rellenado ya por el trigger de alta.
INSERT INTO public.users (id, email)
VALUES
  ('0a0a0a0a-0000-4000-8000-0000000a0001', 'audit01-a@example.invalid'),
  ('0a0a0a0a-0000-4000-8000-0000000a0002', 'audit01-b@example.invalid'),
  ('0a0a0a0a-0000-4000-8000-0000000a0003', 'audit01-own@example.invalid'),
  ('0a0a0a0a-0000-4000-8000-0000000a0004', 'audit01-adm@example.invalid'),
  ('0a0a0a0a-0000-4000-8000-0000000a0005', NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET is_super_user = true WHERE id = '0a0a0a0a-0000-4000-8000-0000000a0004';

-- Bares: trg_bars_force_pending pone owner_id := auth.uid(), así que se crean
-- "como" el propietario (claims) pero con el rol postgres.
SELECT set_config('request.jwt.claims', '{"sub":"0a0a0a0a-0000-4000-8000-0000000a0003","role":"authenticated"}', true);
INSERT INTO public.bars (id, name, address, city, latitude, longitude)
VALUES
  ('0b0b0b0b-0000-4000-8000-0000000b0001', 'AUDIT01 pendiente', 'c/ Prueba 1', 'Test', 0, 0),
  ('0b0b0b0b-0000-4000-8000-0000000b0002', 'AUDIT01 aprobado',  'c/ Prueba 2', 'Test', 0, 0),
  ('0b0b0b0b-0000-4000-8000-0000000b0003', 'AUDIT01 sin dueño', 'c/ Prueba 3', 'Test', 0, 0);
SELECT set_config('request.jwt.claims', '', true);

-- Como postgres (fuera de 'authenticated') el trigger de protección no aplica.
UPDATE public.bars SET verification_status = 'approved'
WHERE id IN ('0b0b0b0b-0000-4000-8000-0000000b0002', '0b0b0b0b-0000-4000-8000-0000000b0003');
UPDATE public.bars SET owner_id = NULL WHERE id = '0b0b0b0b-0000-4000-8000-0000000b0003';

-- Documento de reclamación de A (insertado como postgres, sin pasar por RLS).
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('bar-claim-documents', '0a0a0a0a-0000-4000-8000-0000000a0001/0b0b0b0b-0000-4000-8000-0000000b0003-1.jpg',
        '0a0a0a0a-0000-4000-8000-0000000a0001');

-- ------------------------------------------------------------- invitado --
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"0a0a0a0a-0000-4000-8000-0000000a0005","role":"authenticated","is_anonymous":true}', true);

DO $$
DECLARE n int;
BEGIN
  -- Storage: no puede subir ni a su propia carpeta de avatars
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', '0a0a0a0a-0000-4000-8000-0000000a0005/avatar_1.jpg');
    RAISE EXCEPTION 'AUDIT01 FAIL: invitado subió a avatars';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('bar-images', '0b0b0b0b-0000-4000-8000-0000000b0002/bar/bar_1.jpg');
    RAISE EXCEPTION 'AUDIT01 FAIL: invitado subió a bar-images';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Storage: no ve documentos de reclamación
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'bar-claim-documents';
  IF n <> 0 THEN RAISE EXCEPTION 'AUDIT01 FAIL: invitado ve % documentos de reclamación', n; END IF;

  -- Tablas: no puede reportar, reclamar ni solicitar bares
  BEGIN
    INSERT INTO public.bar_reports (bar_id, reporter_id, reason)
    VALUES ('0b0b0b0b-0000-4000-8000-0000000b0003', '0a0a0a0a-0000-4000-8000-0000000a0005', 'otro');
    RAISE EXCEPTION 'AUDIT01 FAIL: invitado creó bar_report';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.bar_claims (bar_id, claimant_id, contact_name, contact_phone, message)
    VALUES ('0b0b0b0b-0000-4000-8000-0000000b0003', '0a0a0a0a-0000-4000-8000-0000000a0005', 'x', '600000000', 'x');
    RAISE EXCEPTION 'AUDIT01 FAIL: invitado creó bar_claim';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.bar_requests (user_id, bar_name, city)
    VALUES ('0a0a0a0a-0000-4000-8000-0000000a0005', 'x', 'x');
    RAISE EXCEPTION 'AUDIT01 FAIL: invitado creó bar_request';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Favoritos (ya existía "No anonymous", se comprueba que sigue)
  BEGIN
    INSERT INTO public.favorites (user_id, bar_id)
    VALUES ('0a0a0a0a-0000-4000-8000-0000000a0005', '0b0b0b0b-0000-4000-8000-0000000b0002');
    RAISE EXCEPTION 'AUDIT01 FAIL: invitado creó favorito';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- support_tickets y review_likes: comprobación de que existe la política
-- (sus columnas obligatorias no están versionadas en el repo).
RESET ROLE;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bar_reports','bar_claims','bar_requests','support_tickets','review_likes'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = 'No anonymous insert' AND permissive = 'RESTRICTIVE'
    ) THEN
      RAISE EXCEPTION 'AUDIT01 FAIL: falta "No anonymous insert" en %', t;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------- propietario --
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"0a0a0a0a-0000-4000-8000-0000000a0003","role":"authenticated","is_anonymous":false}', true);

DO $$
DECLARE n int;
BEGIN
  -- No puede auto-aprobarse ni tocar columnas privilegiadas
  BEGIN
    UPDATE public.bars SET verification_status = 'approved' WHERE id = '0b0b0b0b-0000-4000-8000-0000000b0001';
    RAISE EXCEPTION 'AUDIT01 FAIL: propietario se auto-aprobó';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.bars SET owner_id = '0a0a0a0a-0000-4000-8000-0000000a0001' WHERE id = '0b0b0b0b-0000-4000-8000-0000000b0002';
    RAISE EXCEPTION 'AUDIT01 FAIL: propietario cambió owner_id';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.bars SET is_test = true WHERE id = '0b0b0b0b-0000-4000-8000-0000000b0002';
    RAISE EXCEPTION 'AUDIT01 FAIL: propietario cambió is_test';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Sí puede editar campos normales y marcar su local como de apuestas
  UPDATE public.bars SET name = 'AUDIT01 editado', is_betting_venue = true
  WHERE id = '0b0b0b0b-0000-4000-8000-0000000b0002';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'AUDIT01 FAIL: propietario no pudo editar su bar'; END IF;

  -- …pero no desmarcarlo
  BEGIN
    UPDATE public.bars SET is_betting_venue = false WHERE id = '0b0b0b0b-0000-4000-8000-0000000b0002';
    RAISE EXCEPTION 'AUDIT01 FAIL: propietario desmarcó is_betting_venue';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Storage: sube a la carpeta de su bar (también pendiente) y de posts
  INSERT INTO storage.objects (bucket_id, name) VALUES ('bar-images', '0b0b0b0b-0000-4000-8000-0000000b0001/bar/bar_1_1.jpg');
  INSERT INTO storage.objects (bucket_id, name) VALUES ('bar-images', '0b0b0b0b-0000-4000-8000-0000000b0002/posts/post_x_1.jpg');

  -- …pero no a la de otro bar ni a una ruta plana (formato antiguo)
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('bar-images', '0b0b0b0b-0000-4000-8000-0000000b0003/bar/bar_1.jpg');
    RAISE EXCEPTION 'AUDIT01 FAIL: propietario subió a la carpeta de otro bar';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('bar-images', 'bar-0b0b0b0b-0000-4000-8000-0000000b0002-bar-1.jpg');
    RAISE EXCEPTION 'AUDIT01 FAIL: propietario subió a una ruta sin carpeta de bar';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ----------------------------------------------------- usuario normal A --
SELECT set_config('request.jwt.claims', '{"sub":"0a0a0a0a-0000-4000-8000-0000000a0001","role":"authenticated","is_anonymous":false}', true);

DO $$
DECLARE n int;
BEGIN
  -- No puede editar un bar ajeno (RLS → 0 filas)
  UPDATE public.bars SET name = 'hack' WHERE id = '0b0b0b0b-0000-4000-8000-0000000b0002';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'AUDIT01 FAIL: usuario editó un bar ajeno'; END IF;

  -- Favoritos: solo de bares aprobados
  BEGIN
    INSERT INTO public.favorites (user_id, bar_id)
    VALUES ('0a0a0a0a-0000-4000-8000-0000000a0001', '0b0b0b0b-0000-4000-8000-0000000b0001');
    RAISE EXCEPTION 'AUDIT01 FAIL: favorito de bar no aprobado';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO public.favorites (user_id, bar_id)
  VALUES ('0a0a0a0a-0000-4000-8000-0000000a0001', '0b0b0b0b-0000-4000-8000-0000000b0002');

  -- Reseñas: no en bares no aprobados
  BEGIN
    INSERT INTO public.reviews (user_id, bar_id, rating)
    VALUES ('0a0a0a0a-0000-4000-8000-0000000a0001', '0b0b0b0b-0000-4000-8000-0000000b0001', 5);
    RAISE EXCEPTION 'AUDIT01 FAIL: reseña en bar no aprobado';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Storage avatars: su carpeta sí, la de B no
  INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', '0a0a0a0a-0000-4000-8000-0000000a0001/avatar_1.jpg');
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars', '0a0a0a0a-0000-4000-8000-0000000a0002/avatar_1.jpg');
    RAISE EXCEPTION 'AUDIT01 FAIL: usuario subió avatar en carpeta ajena';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Storage bar-images: no es dueño de ningún bar
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('bar-images', '0b0b0b0b-0000-4000-8000-0000000b0002/bar/bar_9.jpg');
    RAISE EXCEPTION 'AUDIT01 FAIL: usuario subió fotos a un bar ajeno';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Documento de reclamación: el suyo lo ve
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'bar-claim-documents';
  IF n <> 1 THEN RAISE EXCEPTION 'AUDIT01 FAIL: el autor no ve su documento (%)', n; END IF;
END $$;

-- ----------------------------------------------------- usuario normal B --
SELECT set_config('request.jwt.claims', '{"sub":"0a0a0a0a-0000-4000-8000-0000000a0002","role":"authenticated","is_anonymous":false}', true);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'bar-claim-documents';
  IF n <> 0 THEN RAISE EXCEPTION 'AUDIT01 FAIL: B ve documentos de reclamación de A'; END IF;
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'avatars';
  IF n <> 0 THEN RAISE EXCEPTION 'AUDIT01 FAIL: B lista avatares ajenos'; END IF;
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'bar-images';
  IF n <> 0 THEN RAISE EXCEPTION 'AUDIT01 FAIL: B lista ficheros de bar-images'; END IF;
END $$;

-- ---------------------------------------------------------- super admin --
SELECT set_config('request.jwt.claims', '{"sub":"0a0a0a0a-0000-4000-8000-0000000a0004","role":"authenticated","is_anonymous":false}', true);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM storage.objects
  WHERE bucket_id = 'bar-claim-documents' AND name LIKE '0a0a0a0a-0000-4000-8000-0000000a0001/%';
  IF n <> 1 THEN RAISE EXCEPTION 'AUDIT01 FAIL: admin no ve el documento de reclamación'; END IF;

  UPDATE public.bars SET verification_status = 'approved' WHERE id = '0b0b0b0b-0000-4000-8000-0000000b0001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'AUDIT01 FAIL: admin no pudo aprobar el bar'; END IF;

  UPDATE public.bars SET is_betting_venue = false WHERE id = '0b0b0b0b-0000-4000-8000-0000000b0002';

  INSERT INTO storage.objects (bucket_id, name) VALUES ('bar-images', '0b0b0b0b-0000-4000-8000-0000000b0003/bar/bar_1.jpg');
END $$;

RESET ROLE;
SELECT 'AUDIT01 RLS OK' AS resultado;

-- ------------------------------------------------- diagnóstico (lectura) --
-- Tablas de public sin RLS
SELECT c.relname AS tabla_sin_rls
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY 1;

-- Tablas de public con RLS pero sin ninguna política (nadie salvo service_role accede)
SELECT c.relname AS tabla_rls_sin_politicas
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname)
ORDER BY 1;

-- Políticas permisivas con rol public/anon o con USING/CHECK = true
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND permissive = 'PERMISSIVE'
  AND (qual = 'true' OR with_check = 'true' OR roles && ARRAY['anon']::name[])
ORDER BY 1, 2;

-- Políticas de storage.objects (deben ser solo las de la migración)
SELECT policyname, permissive, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY 1;

-- Funciones SECURITY DEFINER de public que anon aún puede ejecutar
SELECT p.oid::regprocedure AS funcion_definer_ejecutable_por_anon
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY 1;

ROLLBACK;
