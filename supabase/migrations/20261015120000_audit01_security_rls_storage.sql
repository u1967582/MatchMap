-- ============================================================================
-- MIGRACIÓN: Auditoría 01 · Seguridad Supabase (RLS, Storage, invitados)
-- Fecha: 2026-10-15
-- Resuelve: HALLAZGOS_2026-10-10 #1, #2, #3, #4, #11, #13 y 01-H1..01-H6
--           (docs/audit/areas/01-seguridad-supabase.md).
--
-- Idempotente: se puede ejecutar varias veces. Todas las políticas se crean
-- con DROP POLICY IF EXISTS antes, y los bloques dinámicos comprueban que la
-- tabla/columna/función exista.
--
-- Qué hace:
--   1. Storage: borra TODAS las políticas de storage.objects que no estén en
--      la lista de abajo (incluidas las genéricas "Allow read", "Allow upload",
--      etc.) y crea políticas por bucket:
--        - avatars:              escritura/lectura API solo en la carpeta auth.uid()
--        - bar-images:           escritura/lectura API solo si la carpeta es un bar
--                                propio (owner_id = auth.uid()) o super admin
--        - bar-claim-documents:  solo el autor (carpeta auth.uid()) y admins
--      Las imágenes públicas se siguen sirviendo por /object/public/... (eso no
--      pasa por RLS), así que no hace falta SELECT abierto (que además permitía
--      listar todos los ficheros del bucket).
--      Añade políticas RESTRICTIVE que impiden a sesiones anónimas subir,
--      modificar o borrar ficheros, y límites de tamaño/MIME en los buckets.
--   2. bars: borra las políticas legacy "Bar owner: …" y añade un trigger que
--      impide a un usuario normal cambiar columnas privilegiadas
--      (verification_status, verified_*, rating, review_count, owner_id,
--      is_test, is_active, flags de fotos y desmarcar is_betting_venue).
--   3. Políticas legacy de reviews, favorites y tablas hijas de bars: se borran
--      y se recrean las canónicas.
--   4. Invitados: políticas RESTRICTIVE "No anonymous" en bar_reports,
--      bar_claims, bar_requests, support_tickets y review_likes.
--      fn_claim_scarf deja de ser invocable por anon/authenticated.
--   5. SECURITY DEFINER: REVOKE EXECUTE FROM anon en las funciones que no se
--      usan dentro de políticas, y de authenticated en las funciones trigger.
--
-- Pruebas: supabase/tests/rls_01_seguridad.sql (BEGIN … ROLLBACK, no deja datos).
--
-- Rollback (si algo falla en prod tras aplicarla):
--   - Subidas rotas: el bloqueo está en las políticas de storage.objects;
--     se pueden recrear temporalmente las genéricas, p. ej.
--       CREATE POLICY "Allow upload" ON storage.objects FOR INSERT TO public WITH CHECK (true);
--     (vuelve a abrir el hallazgo #1, solo como medida de emergencia).
--   - Edición de bar rota: DROP TRIGGER trg_bars_protect_privileged_columns ON public.bars;
--   - Una RPC deja de funcionar para invitados/usuarios:
--       GRANT EXECUTE ON FUNCTION public.<funcion>(<args>) TO authenticated;
--   - Límites de buckets: UPDATE storage.buckets SET file_size_limit = NULL,
--       allowed_mime_types = NULL WHERE id IN ('avatars', 'bar-images');
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. STORAGE
-- ----------------------------------------------------------------------------

-- 1.1 Borrar cualquier política de storage.objects que no sea de las nuestras.
--     Incluye las genéricas detectadas en prod (Allow read, Allow read access to
--     objects, Allow insert for authenticated users, Allow upload, Users can
--     update bar images, Users can delete bar images) y cualquier otra creada a
--     mano desde el panel que no esté auditada.
DO $$
DECLARE
  pol record;
  keep text[] := ARRAY[
    'avatars_select_own',
    'avatars_insert_own',
    'avatars_update_own',
    'avatars_delete_own',
    'bar_images_storage_select_owner_admin',
    'bar_images_storage_insert_owner_admin',
    'bar_images_storage_update_owner_admin',
    'bar_images_storage_delete_owner_admin',
    'bar_claim_documents_insert_own',
    'bar_claim_documents_select_own_or_admin',
    'bar_claim_documents_delete_own_or_admin',
    'storage_no_anonymous_insert',
    'storage_no_anonymous_update',
    'storage_no_anonymous_delete'
  ];
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    IF NOT (pol.policyname = ANY (keep)) THEN
      RAISE NOTICE 'audit01: drop policy "%" on storage.objects', pol.policyname;
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END IF;
  END LOOP;
END $$;

-- 1.2 avatars: cada usuario solo gestiona su carpeta <auth.uid()>/…
--     (ruta usada por screens/EditProfileScreen.tsx → utils/storagePaths.avatarPath)
DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;
CREATE POLICY "avatars_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- 1.3 bar-images: la primera carpeta de la ruta es el id del bar.
--     Rutas usadas (utils/storagePaths.ts):
--       <barId>/bar/…, <barId>/menu/…   registro, edición de bar
--       <barId>/posts/…                 crear/editar post
--       <autoPreBarId>/bar|menu/…       registro en frío (solo super admin)
--     El SELECT (no público) es necesario para upsert: true.
--     OJO: dentro del EXISTS hay que escribir objects.name. public.bars también
--     tiene una columna "name" y, sin calificar, la subconsulta compararía el
--     id del bar con su propio nombre (nunca coincide → ningún dueño podría
--     subir fotos).
DROP POLICY IF EXISTS "bar_images_storage_select_owner_admin" ON storage.objects;
CREATE POLICY "bar_images_storage_select_owner_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bar-images'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.bars b
      WHERE b.id::text = (storage.foldername(objects.name))[1]
        AND b.owner_id = (SELECT auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "bar_images_storage_insert_owner_admin" ON storage.objects;
CREATE POLICY "bar_images_storage_insert_owner_admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bar-images'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.bars b
      WHERE b.id::text = (storage.foldername(objects.name))[1]
        AND b.owner_id = (SELECT auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "bar_images_storage_update_owner_admin" ON storage.objects;
CREATE POLICY "bar_images_storage_update_owner_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'bar-images'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.bars b
      WHERE b.id::text = (storage.foldername(objects.name))[1]
        AND b.owner_id = (SELECT auth.uid())
    )
  )
)
WITH CHECK (
  bucket_id = 'bar-images'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.bars b
      WHERE b.id::text = (storage.foldername(objects.name))[1]
        AND b.owner_id = (SELECT auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "bar_images_storage_delete_owner_admin" ON storage.objects;
CREATE POLICY "bar_images_storage_delete_owner_admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bar-images'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.bars b
      WHERE b.id::text = (storage.foldername(objects.name))[1]
        AND b.owner_id = (SELECT auth.uid())
    )
  )
);

-- 1.4 bar-claim-documents (privado): ruta <auth.uid()>/<barId>-<ts>.jpg
--     (app/claim-bar/[barId].tsx). Se recrean las de 20260809171957.
DROP POLICY IF EXISTS "bar_claim_documents_insert_own" ON storage.objects;
CREATE POLICY "bar_claim_documents_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bar-claim-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "bar_claim_documents_select_own_or_admin" ON storage.objects;
CREATE POLICY "bar_claim_documents_select_own_or_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bar-claim-documents'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR public.is_super_admin()
  )
);

DROP POLICY IF EXISTS "bar_claim_documents_delete_own_or_admin" ON storage.objects;
CREATE POLICY "bar_claim_documents_delete_own_or_admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bar-claim-documents'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR public.is_super_admin()
  )
);

-- 1.5 Ninguna sesión anónima (modo invitado) puede escribir en Storage.
DROP POLICY IF EXISTS "storage_no_anonymous_insert" ON storage.objects;
CREATE POLICY "storage_no_anonymous_insert"
ON storage.objects AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND NOT COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::boolean, false)
);

DROP POLICY IF EXISTS "storage_no_anonymous_update" ON storage.objects;
CREATE POLICY "storage_no_anonymous_update"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO public
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND NOT COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::boolean, false)
);

DROP POLICY IF EXISTS "storage_no_anonymous_delete" ON storage.objects;
CREATE POLICY "storage_no_anonymous_delete"
ON storage.objects AS RESTRICTIVE FOR DELETE TO public
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND NOT COALESCE(((SELECT auth.jwt()) ->> 'is_anonymous')::boolean, false)
);

-- 1.6 Límites de tamaño y tipo (HALLAZGOS #13). La app sube siempre JPEG
--     redimensionado (utils/imageResize.ts), muy por debajo de 5 MB.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('avatars', 'bar-images');

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'bar-claim-documents';


-- ----------------------------------------------------------------------------
-- 2. BARS: políticas legacy + columnas privilegiadas
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Bar owner: update own bar" ON public.bars;
DROP POLICY IF EXISTS "Bar owner: delete own bar" ON public.bars;
DROP POLICY IF EXISTS "Bar owner: insert own bar" ON public.bars;

-- UPDATE del propietario: solo filas propias. Qué columnas puede tocar lo
-- decide el trigger de abajo (la subconsulta antigua sobre verification_status
-- se sustituye por el trigger, que cubre más columnas).
DROP POLICY IF EXISTS "bars_update_owner_no_status_change" ON public.bars;
CREATE POLICY "bars_update_owner_no_status_change"
ON public.bars FOR UPDATE TO authenticated
USING (owner_id = (SELECT auth.uid()))
WITH CHECK (owner_id = (SELECT auth.uid()));

-- DELETE del propietario: el botón "Eliminar Bar" de app/bar-profile lo usa.
-- Sustituye a la legacy "Bar owner: delete own bar" (rol public).
DROP POLICY IF EXISTS "bars_delete_owner" ON public.bars;
CREATE POLICY "bars_delete_owner"
ON public.bars FOR DELETE TO authenticated
USING (owner_id = (SELECT auth.uid()));

-- Trigger SECURITY INVOKER a propósito: current_user es 'authenticated' en una
-- petición REST y el propietario de la función (postgres) cuando el UPDATE
-- viene de una función SECURITY DEFINER (approve_bar_claim, convert_scraped_bar,
-- recálculo de rating por trigger de reviews, delete_user_data…), que se
-- permiten.
CREATE OR REPLACE FUNCTION public.trg_bars_protect_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_col text;
  v_protected text[] := ARRAY[
    'verification_status', 'verified_at', 'verified_by', 'verification_notes',
    'rating', 'review_count', 'owner_id', 'is_test', 'is_active',
    'flag_bar_photos', 'flag_menu_photos'
  ];
BEGIN
  IF current_user NOT IN ('authenticated', 'anon')
     OR auth.role() = 'service_role'
     OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_col IN ARRAY v_protected LOOP
    IF v_old ? v_col AND (v_new -> v_col) IS DISTINCT FROM (v_old -> v_col) THEN
      RAISE EXCEPTION 'No tienes permiso para modificar bars.%', v_col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  -- El propietario puede declarar su local como de apuestas, pero no
  -- desmarcarlo (lo decide moderación).
  IF v_old ? 'is_betting_venue'
     AND (v_old ->> 'is_betting_venue')::boolean IS TRUE
     AND (v_new ->> 'is_betting_venue')::boolean IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'No tienes permiso para desmarcar bars.is_betting_venue'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_bars_protect_privileged_columns() IS
'Auditoría 01: impide que un usuario normal (propietario) cambie columnas privilegiadas de bars vía REST. Super admin, service_role y funciones SECURITY DEFINER pasan.';

REVOKE ALL ON FUNCTION public.trg_bars_protect_privileged_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bars_protect_privileged_columns ON public.bars;
CREATE TRIGGER trg_bars_protect_privileged_columns
  BEFORE UPDATE ON public.bars
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bars_protect_privileged_columns();


-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS LEGACY (reviews, favorites, tablas hijas de bars)
-- ----------------------------------------------------------------------------

-- 3.1 reviews: borrar legacy y recrear las canónicas de 20251223170000.
DROP POLICY IF EXISTS "Reviews: Insert by authenticated users" ON public.reviews;
DROP POLICY IF EXISTS "Reviews: Update own" ON public.reviews;
DROP POLICY IF EXISTS "Reviews: Delete own" ON public.reviews;

DROP POLICY IF EXISTS "reviews_insert_only_for_approved_bars" ON public.reviews;
CREATE POLICY "reviews_insert_only_for_approved_bars"
ON public.reviews FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.bars b
    WHERE b.id = reviews.bar_id AND b.verification_status = 'approved'
  )
);

DROP POLICY IF EXISTS "reviews_update_own_only_when_bar_visible" ON public.reviews;
CREATE POLICY "reviews_update_own_only_when_bar_visible"
ON public.reviews FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.bars b
    WHERE b.id = reviews.bar_id
      AND (public.is_super_admin() OR b.owner_id = (SELECT auth.uid()) OR b.verification_status = 'approved')
  )
)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "reviews_delete_own_only_when_bar_visible" ON public.reviews;
CREATE POLICY "reviews_delete_own_only_when_bar_visible"
ON public.reviews FOR DELETE TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.bars b
    WHERE b.id = reviews.bar_id
      AND (public.is_super_admin() OR b.owner_id = (SELECT auth.uid()) OR b.verification_status = 'approved')
  )
);

-- 3.2 favorites: borrar legacy y recrear las canónicas.
DROP POLICY IF EXISTS "Favorites: Self insert" ON public.favorites;
DROP POLICY IF EXISTS "Favorites: Self read" ON public.favorites;
DROP POLICY IF EXISTS "Favorites: Self delete" ON public.favorites;

DROP POLICY IF EXISTS "favorites_select_own_only_when_bar_visible" ON public.favorites;
CREATE POLICY "favorites_select_own_only_when_bar_visible"
ON public.favorites FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.bars b
    WHERE b.id = favorites.bar_id
      AND (public.is_super_admin() OR b.owner_id = (SELECT auth.uid()) OR b.verification_status = 'approved')
  )
);

DROP POLICY IF EXISTS "favorites_insert_only_for_approved_bars" ON public.favorites;
CREATE POLICY "favorites_insert_only_for_approved_bars"
ON public.favorites FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.bars b
    WHERE b.id = favorites.bar_id AND b.verification_status = 'approved'
  )
);

DROP POLICY IF EXISTS "favorites_delete_own" ON public.favorites;
CREATE POLICY "favorites_delete_own"
ON public.favorites FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- 3.3 Tablas hijas de bars: políticas canónicas <tabla>_{select_visible_bar,
--     insert_owner,update_owner,delete_owner} y borrado de las legacy
--     "Bar owner: …" de escritura (o FOR ALL).
DO $$
DECLARE
  t text;
  pol record;
  owner_expr text := 'EXISTS (SELECT 1 FROM public.bars b WHERE b.id = %I.bar_id AND (public.is_super_admin() OR b.owner_id = (SELECT auth.uid())))';
  visible_expr text := 'EXISTS (SELECT 1 FROM public.bars b WHERE b.id = %I.bar_id AND (public.is_super_admin() OR b.owner_id = (SELECT auth.uid()) OR b.verification_status = ''approved''))';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bar_images', 'bar_menus', 'bar_food_types', 'bar_languages',
    'bar_selected_features', 'bar_selected_tv_features'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'audit01: tabla public.% no existe, se omite', t;
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'bar_id'
    ) THEN
      RAISE NOTICE 'audit01: public.% no tiene bar_id, se omite', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_visible_bar', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (' || visible_expr || ')',
      t || '_select_visible_bar', t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_owner', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (' || owner_expr || ')',
      t || '_insert_owner', t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_owner', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (' || owner_expr || ') WITH CHECK (' || owner_expr || ')',
      t || '_update_owner', t, t, t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_owner', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (' || owner_expr || ')',
      t || '_delete_owner', t, t);

    -- Cualquier otra política PERMISSIVE de escritura (legacy "Bar owner: …",
    -- "Enable insert for authenticated users", FOR ALL…) se suma por OR a las
    -- canónicas y las anula, así que se borra. Las de lectura (SELECT) no se
    -- tocan. Las RESTRICTIVE tampoco (solo pueden restringir más).
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND permissive = 'PERMISSIVE'
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
        AND policyname NOT IN (t || '_insert_owner', t || '_update_owner', t || '_delete_owner')
    LOOP
      RAISE NOTICE 'audit01: drop policy "%" on public.%', pol.policyname, t;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- 4. INVITADOS (sesiones anónimas)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bar_reports', 'bar_claims', 'bar_requests', 'support_tickets', 'review_likes',
    -- reviews y favorites ya tienen su "No anonymous …" en prod; se añade la
    -- nuestra también para no depender de una política no versionada.
    'reviews', 'favorites'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'audit01: tabla public.% no existe, se omite', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'No anonymous insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO public '
      'WITH CHECK ((SELECT auth.uid()) IS NOT NULL '
      'AND NOT COALESCE(((SELECT auth.jwt()) ->> ''is_anonymous'')::boolean, false))',
      'No anonymous insert', t);
  END LOOP;
END $$;

-- fn_claim_scarf (bufandas, sin uso en la app; D3 pendiente): nadie salvo
-- service_role puede invocarla. Si se decide borrar, lo hará la migración de D3.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fn_claim_scarf'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- 5. SECURITY DEFINER: defensa en profundidad (HALLAZGOS #11)
-- ----------------------------------------------------------------------------
-- - Funciones trigger: nadie necesita EXECUTE para que el trigger se dispare,
--   así que se revoca de PUBLIC, anon y authenticated.
-- - Resto de funciones SECURITY DEFINER de public: se revoca de PUBLIC y anon
--   (las sesiones de invitado son 'authenticated', no 'anon'), salvo las que
--   aparecen dentro de una política RLS, porque evaluar esa política como anon
--   fallaría con "permission denied for function".
--   Si 'authenticated' o 'service_role' tenían EXECUTE (directo o heredado de
--   PUBLIC), se les vuelve a conceder explícitamente para no romper nada.
DO $$
DECLARE
  r record;
  v_auth boolean;
  v_service boolean;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn,
           p.proname,
           (p.prorettype = 'trigger'::regtype) AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    v_service := has_function_privilege('service_role', r.fn, 'EXECUTE');
    IF r.is_trigger THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
      IF v_service THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fn);
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_policies pp
      WHERE COALESCE(pp.qual, '') ~ ('\m' || r.proname || '\M')
         OR COALESCE(pp.with_check, '') ~ ('\m' || r.proname || '\M')
    ) THEN
      v_auth := has_function_privilege('authenticated', r.fn, 'EXECUTE');
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.fn);
      IF v_auth THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.fn);
      END IF;
      IF v_service THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fn);
      END IF;
    ELSE
      RAISE NOTICE 'audit01: % se usa en políticas RLS, se mantiene EXECUTE para anon', r.proname;
    END IF;
  END LOOP;
END $$;
