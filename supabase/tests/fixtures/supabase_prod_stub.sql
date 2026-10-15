-- ============================================================================
-- Réplica MÍNIMA de Supabase prod antes de la auditoría 01, para tests locales
-- ============================================================================
-- Lo usa supabase/tests/rls_01_seguridad.test.ts (Deno + PGlite, sin Docker
-- ni acceso a prod). No es el esquema real: solo lo necesario para que la
-- migración 20261015120000_audit01_security_rls_storage.sql y el script
-- rls_01_seguridad.sql se ejecuten igual que en prod:
--   - roles anon / authenticated / service_role y auth.uid(), auth.jwt(), auth.role()
--   - storage.buckets, storage.objects y storage.foldername()
--   - public.users, public.bars (+ trigger force_pending), reviews (+ recálculo
--     de rating SECURITY DEFINER), favorites, tablas hijas de bars y las
--     tablas de invitados
--   - las políticas peligrosas que había en prod el 2026-10-10
--     (HALLAZGOS_2026-10-10.md #1–#4, #11) para comprobar que se eliminan.
-- ============================================================================
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated, service_role;

CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() ->> 'role'
$$;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY, aud text, role text, email text, is_anonymous boolean DEFAULT false,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz
);

CREATE TABLE storage.buckets (
  id text PRIMARY KEY, name text, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true), ('bar-images', 'bar-images', true),
  ('bar-claim-documents', 'bar-claim-documents', false), ('ticket-claims', 'ticket-claims', true);

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text, owner uuid, created_at timestamptz DEFAULT now(),
  UNIQUE (bucket_id, name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects TO anon, authenticated, service_role;
GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;

CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[1 : array_length(_parts, 1) - 1];
END $$;

-- Políticas genéricas de prod (HALLAZGOS #1)
CREATE POLICY "Allow read" ON storage.objects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to objects" ON storage.objects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON storage.objects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow upload" ON storage.objects FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Users can update bar images" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'bar-images');
CREATE POLICY "Users can delete bar images" ON storage.objects FOR DELETE TO public USING (bucket_id = 'bar-images');

-- public
CREATE TABLE public.users (
  id uuid PRIMARY KEY, email text, is_super_user boolean DEFAULT false, bar_id uuid, is_bar_owner boolean
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
GRANT ALL ON public.users TO authenticated;

CREATE FUNCTION public.is_super_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT u.is_super_user FROM public.users u WHERE u.id = auth.uid()), false)
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

CREATE TABLE public.bars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text, phone text, website text, category_id int,
  address text, city text, latitude double precision, longitude double precision,
  owner_id uuid, verification_status text DEFAULT 'pending',
  verified_at timestamptz, verified_by uuid, verification_notes text,
  rating numeric DEFAULT 0, review_count int DEFAULT 0,
  is_test boolean DEFAULT false, is_active boolean DEFAULT true,
  is_betting_venue boolean DEFAULT false,
  flag_bar_photos boolean DEFAULT false, flag_menu_photos boolean DEFAULT false,
  updated_at timestamptz
);
ALTER TABLE public.bars ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.bars TO anon, authenticated;

CREATE FUNCTION public.trg_bars_force_pending() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN NEW.owner_id := auth.uid(); END IF;
  NEW.verification_status := 'pending';
  RETURN NEW;
END $$;
CREATE TRIGGER bars_force_pending_before_insert BEFORE INSERT ON public.bars
  FOR EACH ROW EXECUTE FUNCTION public.trg_bars_force_pending();

CREATE POLICY bars_select_visible ON public.bars FOR SELECT TO authenticated
  USING (public.is_super_admin() OR owner_id = auth.uid() OR verification_status = 'approved');
CREATE POLICY bars_insert_owner_pending ON public.bars FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND verification_status = 'pending');
CREATE POLICY bars_update_owner_no_status_change ON public.bars FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND verification_status = (SELECT b.verification_status FROM public.bars b WHERE b.id = bars.id));
CREATE POLICY bars_update_admin_all ON public.bars FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY bars_delete_admin ON public.bars FOR DELETE TO authenticated USING (public.is_super_admin());
-- legacy (HALLAZGOS #2, #3)
CREATE POLICY "Bar owner: update own bar" ON public.bars FOR UPDATE TO public USING (owner_id = auth.uid());
CREATE POLICY "Bar owner: delete own bar" ON public.bars FOR DELETE TO public USING (owner_id = auth.uid());
CREATE POLICY "Bar owner: insert own bar" ON public.bars FOR INSERT TO public WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "No anonymous bars insert" ON public.bars AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));

-- Recalculo de rating (SECURITY DEFINER, como refresh_bar_rating en prod)
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, bar_id uuid REFERENCES public.bars(id),
  rating int, comment text
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.reviews TO authenticated;
CREATE FUNCTION public.refresh_bar_rating() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.bars b SET rating = (SELECT avg(rating) FROM public.reviews r WHERE r.bar_id = NEW.bar_id),
                           review_count = (SELECT count(*) FROM public.reviews r WHERE r.bar_id = NEW.bar_id)
  WHERE b.id = NEW.bar_id;
  RETURN NEW;
END $$;
CREATE TRIGGER reviews_refresh_rating AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.refresh_bar_rating();
CREATE POLICY reviews_select_only_when_bar_visible ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY reviews_insert_only_for_approved_bars ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.bars b WHERE b.id = reviews.bar_id AND b.verification_status = 'approved'));
CREATE POLICY "Reviews: Insert by authenticated users" ON public.reviews FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Reviews: Update own" ON public.reviews FOR UPDATE TO public USING (auth.uid() = user_id);
CREATE POLICY "Reviews: Delete own" ON public.reviews FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "No anonymous reviews" ON public.reviews AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));

CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, bar_id uuid REFERENCES public.bars(id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.favorites TO authenticated;
CREATE POLICY "Favorites: Self insert" ON public.favorites FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Favorites: Self read" ON public.favorites FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Favorites: Self delete" ON public.favorites FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY favorites_insert_only_for_approved_bars ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.bars b WHERE b.id = favorites.bar_id AND b.verification_status = 'approved'));
CREATE POLICY "No anonymous favorites" ON public.favorites AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));

-- Tablas hijas con pares legacy
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bar_images','bar_menus','bar_food_types','bar_languages','bar_selected_features'] LOOP
    EXECUTE format('CREATE TABLE public.%I (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bar_id uuid REFERENCES public.bars(id) ON DELETE CASCADE, url text)', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO public USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', 'Bar owner: manage ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', 'Enable insert for authenticated users', t);
  END LOOP;
END $$;

-- Tablas de invitados (HALLAZGOS #4)
CREATE TABLE public.bar_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bar_id uuid, reporter_id uuid, reason text);
CREATE TABLE public.bar_claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bar_id uuid, claimant_id uuid, contact_name text, contact_phone text, message text);
CREATE TABLE public.bar_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, bar_name text, city text);
CREATE TABLE public.support_tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, email text, subject text, message text);
CREATE TABLE public.review_likes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, review_id uuid);
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bar_reports','bar_claims','bar_requests','support_tickets','review_likes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_select', t);
  END LOOP;
END $$;

-- Funciones SECURITY DEFINER (HALLAZGOS #11)
CREATE FUNCTION public.fn_claim_scarf(p uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN END $$;
CREATE FUNCTION public.fn_admin_gift_boost(p uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN END $$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.get_favorite_team_options() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.get_favorite_team_options() FROM public;
GRANT EXECUTE ON FUNCTION public.get_favorite_team_options() TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_favorite_team_options() FROM anon;
