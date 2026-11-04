-- ============================================================================
-- Pruebas de RLS · Auditoría 03 (reportar reseñas y bloquear usuarios)
-- ============================================================================
-- Qué prueba: tras aplicar 20261015130000_review_reports_and_user_blocks.sql,
--   - un invitado (sesión anónima) no puede reportar ni bloquear;
--   - un usuario solo reporta/bloquea en su nombre y solo ve lo suyo;
--   - no puede falsear el estado ni el contexto del reporte (lo pone el trigger);
--   - solo un super admin resuelve reportes (admin_resolve_review_report) y
--     al eliminar la reseña los reportes quedan como histórico.
--
-- Cómo ejecutarlo (💻 sesión local, con aprobación):
--   - En el SQL editor de Supabase o con psql como `postgres`.
--   - TODO va dentro de BEGIN … ROLLBACK con ids ficticios (…-4000-8000-0000003…):
--     no toca datos reales ni deja nada escrito.
--   - Si algo falla se detiene con "AUDIT03 FAIL: …". Si llega al final
--     muestra 'AUDIT03 MODERACION OK'.
--
-- Nota: los INSERT de fixtures usan solo columnas conocidas. Si prod exige
-- otra columna NOT NULL en public.users, public.bars o public.reviews,
-- añádela aquí.
-- ============================================================================

BEGIN;

-- Ids de prueba
--   A     reportante           0c0c0c0c-0000-4000-8000-000000030001
--   B     autor de la reseña   0c0c0c0c-0000-4000-8000-000000030002
--   ADM   super admin          0c0c0c0c-0000-4000-8000-000000030003
--   GUEST invitado anónimo     0c0c0c0c-0000-4000-8000-000000030004
--   bar aprobado               0d0d0d0d-0000-4000-8000-000000030001
--   reseña 1 / reseña 2        0e0e0e0e-0000-4000-8000-000000030001 / …02

-- ---------------------------------------------------------------- fixtures --
INSERT INTO auth.users (id, aud, role, email, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('0c0c0c0c-0000-4000-8000-000000030001', 'authenticated', 'authenticated', 'audit03-a@example.invalid',   false, '{}', '{}', now(), now()),
  ('0c0c0c0c-0000-4000-8000-000000030002', 'authenticated', 'authenticated', 'audit03-b@example.invalid',   false, '{}', '{}', now(), now()),
  ('0c0c0c0c-0000-4000-8000-000000030003', 'authenticated', 'authenticated', 'audit03-adm@example.invalid', false, '{}', '{}', now(), now()),
  ('0c0c0c0c-0000-4000-8000-000000030004', 'authenticated', 'authenticated', NULL,                          true,  '{}', '{}', now(), now());

-- handle_new_user ya crea estas filas al insertar en auth.users; esto es por si
-- el trigger no existe. El invitado anónimo no tiene fila en public.users (en prod
-- email y username son NOT NULL y el trigger la omite), igual que en la app.
INSERT INTO public.users (id, email, username)
VALUES
  ('0c0c0c0c-0000-4000-8000-000000030001', 'audit03-a@example.invalid', 'audit03_a'),
  ('0c0c0c0c-0000-4000-8000-000000030002', 'audit03-b@example.invalid', 'audit03_b'),
  ('0c0c0c0c-0000-4000-8000-000000030003', 'audit03-adm@example.invalid', 'audit03_adm')
ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET is_super_user = true WHERE id = '0c0c0c0c-0000-4000-8000-000000030003';

-- El trigger force_pending pone owner_id := auth.uid(): se crea "como" B.
SELECT set_config('request.jwt.claims', '{"sub":"0c0c0c0c-0000-4000-8000-000000030002","role":"authenticated"}', true);
INSERT INTO public.bars (id, name, address, city, latitude, longitude)
VALUES ('0d0d0d0d-0000-4000-8000-000000030001', 'AUDIT03 bar', 'c/ Prueba 3', 'Test', 0, 0);
SELECT set_config('request.jwt.claims', '', true);
UPDATE public.bars SET verification_status = 'approved' WHERE id = '0d0d0d0d-0000-4000-8000-000000030001';

INSERT INTO public.reviews (id, bar_id, user_id, rating, comment)
VALUES
  ('0e0e0e0e-0000-4000-8000-000000030001', '0d0d0d0d-0000-4000-8000-000000030001', '0c0c0c0c-0000-4000-8000-000000030002', 1, 'AUDIT03 texto ofensivo'),
  ('0e0e0e0e-0000-4000-8000-000000030002', '0d0d0d0d-0000-4000-8000-000000030001', '0c0c0c0c-0000-4000-8000-000000030002', 2, 'AUDIT03 otra reseña');

-- ------------------------------------------------------------- invitado ----
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"0c0c0c0c-0000-4000-8000-000000030004","role":"authenticated","is_anonymous":true}', true);

DO $$ BEGIN
  INSERT INTO public.review_reports (review_id, reporter_id, reason)
  VALUES ('0e0e0e0e-0000-4000-8000-000000030001', '0c0c0c0c-0000-4000-8000-000000030004', 'spam');
  RAISE EXCEPTION 'AUDIT03 FAIL: un invitado ha podido reportar';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

DO $$ BEGIN
  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES ('0c0c0c0c-0000-4000-8000-000000030004', '0c0c0c0c-0000-4000-8000-000000030002');
  RAISE EXCEPTION 'AUDIT03 FAIL: un invitado ha podido bloquear';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- ---------------------------------------------------------- usuario A -----
SELECT set_config('request.jwt.claims', '{"sub":"0c0c0c0c-0000-4000-8000-000000030001","role":"authenticated","is_anonymous":false}', true);

DO $$ BEGIN
  INSERT INTO public.review_reports (review_id, reporter_id, reason)
  VALUES ('0e0e0e0e-0000-4000-8000-000000030001', '0c0c0c0c-0000-4000-8000-000000030002', 'spam');
  RAISE EXCEPTION 'AUDIT03 FAIL: A ha reportado en nombre de otro';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- Intenta falsear estado y contexto: el trigger los sobrescribe
INSERT INTO public.review_reports (review_id, reporter_id, reason, status, admin_notes, review_comment)
VALUES ('0e0e0e0e-0000-4000-8000-000000030001', '0c0c0c0c-0000-4000-8000-000000030001', 'ofensivo', 'dismissed', 'x', 'falso');

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.review_reports
    WHERE reporter_id = '0c0c0c0c-0000-4000-8000-000000030001'
      AND status = 'pending' AND admin_notes IS NULL
      AND review_comment = 'AUDIT03 texto ofensivo'
      AND review_author_id = '0c0c0c0c-0000-4000-8000-000000030002'
  ) THEN
    RAISE EXCEPTION 'AUDIT03 FAIL: el trigger no fuerza estado/contexto del reporte';
  END IF;
END $$;

DO $$ BEGIN
  INSERT INTO public.review_reports (review_id, reporter_id, reason)
  VALUES ('0e0e0e0e-0000-4000-8000-000000030001', '0c0c0c0c-0000-4000-8000-000000030001', 'spam');
  RAISE EXCEPTION 'AUDIT03 FAIL: se admite reportar dos veces la misma reseña';
EXCEPTION WHEN unique_violation THEN NULL; END $$;

DO $$ BEGIN
  UPDATE public.review_reports SET status = 'dismissed';
  IF EXISTS (SELECT 1 FROM public.review_reports WHERE status = 'dismissed'
             AND reporter_id = '0c0c0c0c-0000-4000-8000-000000030001') THEN
    RAISE EXCEPTION 'AUDIT03 FAIL: un usuario normal ha cambiado el estado de un reporte';
  END IF;
END $$;

DO $$ BEGIN
  PERFORM public.admin_resolve_review_report(
    (SELECT id FROM public.review_reports WHERE reporter_id = '0c0c0c0c-0000-4000-8000-000000030001'),
    'remove_review');
  RAISE EXCEPTION 'AUDIT03 FAIL: un usuario normal ha resuelto un reporte';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('0c0c0c0c-0000-4000-8000-000000030001', '0c0c0c0c-0000-4000-8000-000000030002');

DO $$ BEGIN
  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES ('0c0c0c0c-0000-4000-8000-000000030002', '0c0c0c0c-0000-4000-8000-000000030001');
  RAISE EXCEPTION 'AUDIT03 FAIL: A ha creado un bloqueo en nombre de otro';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- ---------------------------------------------------------- usuario B -----
SELECT set_config('request.jwt.claims', '{"sub":"0c0c0c0c-0000-4000-8000-000000030002","role":"authenticated","is_anonymous":false}', true);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.review_reports WHERE review_comment LIKE 'AUDIT03%') THEN
    RAISE EXCEPTION 'AUDIT03 FAIL: el autor ve quién reporta su reseña';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_blocks WHERE blocked_id = '0c0c0c0c-0000-4000-8000-000000030002') THEN
    RAISE EXCEPTION 'AUDIT03 FAIL: el bloqueado ve quién le bloquea';
  END IF;
END $$;

-- ------------------------------------------------------------ super admin --
SELECT set_config('request.jwt.claims', '{"sub":"0c0c0c0c-0000-4000-8000-000000030003","role":"authenticated","is_anonymous":false}', true);

SELECT public.admin_resolve_review_report(
  (SELECT id FROM public.review_reports WHERE reporter_id = '0c0c0c0c-0000-4000-8000-000000030001'),
  'remove_review',
  'AUDIT03');

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.reviews WHERE id = '0e0e0e0e-0000-4000-8000-000000030001') THEN
    RAISE EXCEPTION 'AUDIT03 FAIL: la reseña reportada no se ha borrado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reviews WHERE id = '0e0e0e0e-0000-4000-8000-000000030002') THEN
    RAISE EXCEPTION 'AUDIT03 FAIL: se ha borrado una reseña no reportada';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.review_reports
    WHERE reporter_id = '0c0c0c0c-0000-4000-8000-000000030001'
      AND review_id IS NULL AND status = 'reviewed'
      AND reviewed_by = '0c0c0c0c-0000-4000-8000-000000030003'
  ) THEN
    RAISE EXCEPTION 'AUDIT03 FAIL: el reporte no queda como histórico revisado';
  END IF;
END $$;

RESET ROLE;
SELECT 'AUDIT03 MODERACION OK' AS resultado;

ROLLBACK;
