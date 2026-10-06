-- ============================================================
-- Fix: los boosts pagados nunca se registraban
-- ============================================================
-- 20260806161426_fix_bar_boosts_payment_integrity obligó al cliente a
-- insertar con status='pending', pero el CHECK de la tabla solo admitía
-- ('active','expired','cancelled'). Resultado: todo insert del cliente
-- fallaba y, como el webhook tampoco gestionaba NON_RENEWING_PURCHASE
-- (el evento de los pagos únicos), ningún boost pagado se activaba.
--
-- Además se endurecen las policies:
--   - INSERT: el user_id tiene que ser el del propio usuario.
--   - UPDATE: el cliente ya no actualiza filas (lo hace el webhook con
--     service_role), así que se elimina la policy.
-- ============================================================

ALTER TABLE public.bar_boosts DROP CONSTRAINT IF EXISTS bar_boosts_status_check;
ALTER TABLE public.bar_boosts
  ADD CONSTRAINT bar_boosts_status_check
  CHECK (status IN ('pending', 'active', 'expired', 'cancelled'));

DROP POLICY IF EXISTS "Bar owners can create pending boosts for their bars" ON public.bar_boosts;
CREATE POLICY "Bar owners can create pending boosts for their bars"
ON public.bar_boosts
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bars
    WHERE bars.id = bar_boosts.bar_id
      AND bars.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Bar owners can update their pending bar boosts" ON public.bar_boosts;

COMMENT ON POLICY "Bar owners can create pending boosts for their bars" ON public.bar_boosts IS
'El dueño solo crea boosts pending (enlace transacción ↔ bar). La activación la hace el webhook de RevenueCat (service_role) tras confirmar el pago.';
