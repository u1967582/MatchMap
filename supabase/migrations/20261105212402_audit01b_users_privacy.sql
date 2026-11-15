-- ============================================================================
-- Auditoría 01b · Privacidad de public.users y escalado de privilegios por INSERT
-- ============================================================================
-- Agujeros en prod (verificados el 2026-11-05):
--
--  1. "Users can view profiles" era SELECT USING (true) para `authenticated`, y
--     un invitado (sesión anónima) tiene ese rol: cualquiera con la clave pública
--     podía leer email, full_name e is_super_user de todos los usuarios.
--
--  2. "Allow insert during registration" era INSERT WITH CHECK (true) para
--     `public`. trg_users_protect_privileged_columns solo cubre UPDATE, así que:
--       - con el rol `anon` (la restrictiva "No anonymous user creation" solo
--         aplica a `authenticated`) se podía crear la fila de un invitado con
--         is_super_user = true, y ese invitado pasaba a ser super admin;
--       - un usuario normal podía borrar su fila y recrearla como super admin;
--       - un email falso disparaba match_pre_registered_bar y promovía un bar
--         pre-registrado a favor del atacante.
--
-- Arreglo:
--  - Cada usuario lee solo su fila; el super admin lee todas.
--  - El cliente no puede insertar ni borrar en public.users. Las altas las hacen
--    los triggers SECURITY DEFINER sobre auth.users y las bajas delete_user_data
--    y delete-user-account (service_role). La app no usa INSERT/DELETE aquí.
--  - public_profiles expone username y avatar de quien ha publicado reseñas, que
--    es lo único que la app muestra de otros usuarios.
--
-- Se conserva el GRANT SELECT a `anon`: RLS devuelve vacío. Sin el grant, el
-- embed user:users de los binarios ya publicados fallaría con 42501 en vez de
-- mostrar el autor como anónimo.
--
-- Compatibilidad: los binarios publicados dejan de ver el autor de las reseñas
-- (la app ya lo trata y muestra un nombre genérico) hasta que usen public_profiles.
-- Rollback: recrear las 3 políticas y los grants borrados. Reabre los agujeros.
-- ============================================================================

DROP POLICY IF EXISTS "Users can view profiles" ON public.users;
DROP POLICY IF EXISTS "Allow insert during registration" ON public.users;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.users;

DROP POLICY IF EXISTS users_select_admin ON public.users;
CREATE POLICY users_select_admin ON public.users
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.users FROM anon;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.users FROM authenticated;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false, security_barrier = true) AS
  SELECT u.id, u.username, u.profile_image_url
  FROM public.users u
  WHERE EXISTS (SELECT 1 FROM public.reviews r WHERE r.user_id = u.id);

COMMENT ON VIEW public.public_profiles IS
'Datos públicos de quien ha publicado reseñas. Se salta la RLS de public.users a propósito: no añadir columnas personales.';

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
