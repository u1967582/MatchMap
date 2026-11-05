-- Réplica de public.users en prod a 2026-11-05 (políticas y grants), para
-- reproducir los agujeros que cierra 20261105212402_audit01b_users_privacy.sql.
ALTER TABLE public.users ADD COLUMN full_name text, ADD COLUMN profile_image_url text;

DROP POLICY users_self ON public.users;
CREATE POLICY "Allow insert during registration" ON public.users FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "No anonymous user creation" ON public.users AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');
CREATE POLICY "Users can delete their own profile" ON public.users FOR DELETE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can read own record" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own record" ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can view profiles" ON public.users FOR SELECT TO authenticated USING (true);
GRANT ALL ON public.users TO anon, authenticated;

CREATE FUNCTION public.trg_users_protect_privileged_columns() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_super_admin() THEN RETURN NEW; END IF;
  NEW.is_super_user := OLD.is_super_user;
  NEW.bar_id := OLD.bar_id;
  NEW.is_bar_owner := OLD.is_bar_owner;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_users_protect_privileged_columns BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.trg_users_protect_privileged_columns();
