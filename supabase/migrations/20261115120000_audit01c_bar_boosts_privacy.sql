-- Auditoría 01c (G2) · bar_boosts sin datos de pago a la vista
--
-- La política «Allow all authenticated users to view active boosts» tenía
-- USING (true): cualquier sesión, también la de un invitado anónimo, leía
-- TODAS las filas con user_id, amount_cents, currency y
-- revenuecat_transaction_id, es decir, quién ha pagado, cuánto y cuándo.
--
-- Ahora:
--   · el resto de usuarios solo ve boosts con status = 'active';
--   · el dueño del bar sigue viendo los suyos (owner_can_select_bar_boosts);
--   · nadie lee user_id, amount_cents ni currency desde el cliente (el webhook
--     de RevenueCat usa service_role y no le afecta);
--   · anon no tiene ningún permiso (los invitados usan el rol authenticated).
--
-- revenuecat_transaction_id sigue legible porque es la columna del
-- ON CONFLICT del upsert de useBoostOfferings; sin user_id no identifica a nadie.
-- Idempotente.

DROP POLICY IF EXISTS "Allow all authenticated users to view active boosts" ON public.bar_boosts;
DROP POLICY IF EXISTS bar_boosts_select_active ON public.bar_boosts;
CREATE POLICY bar_boosts_select_active ON public.bar_boosts
  FOR SELECT TO authenticated
  USING (status = 'active');

REVOKE ALL ON public.bar_boosts FROM anon;
REVOKE SELECT ON public.bar_boosts FROM authenticated;
GRANT SELECT (id, bar_id, plan, start_at, end_at, status, created_at, revenuecat_transaction_id)
  ON public.bar_boosts TO authenticated;
