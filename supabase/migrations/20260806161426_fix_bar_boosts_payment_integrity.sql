-- ============================================================
-- Fix: integridad de pago en bar_boosts
-- ============================================================
-- Las policies de INSERT/UPDATE para dueños de bar solo validaban
-- la propiedad del bar, no el estado del pago. Combinado con el
-- insert directo desde el cliente (components/revenuecat/Paywall.tsx),
-- cualquier dueño de bar autenticado podía llamar a la REST API de
-- Supabase e insertar/actualizar un boost con status='active' sin
-- haber pagado nunca.
--
-- Fix: el cliente solo puede escribir status='pending'. Solo el
-- service_role (usado por supabase/functions/revenuecat-webhook, que
-- bypassa RLS) puede marcar un boost como 'active' o 'expired' tras
-- confirmar el pago con RevenueCat.
-- ============================================================

DROP POLICY IF EXISTS "Bar owners can create boosts for their bars" ON bar_boosts;
DROP POLICY IF EXISTS "Bar owners can update their bar boosts" ON bar_boosts;

CREATE POLICY "Bar owners can create pending boosts for their bars"
ON bar_boosts
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND EXISTS (
    SELECT 1 FROM bars
    WHERE bars.id = bar_boosts.bar_id
      AND bars.owner_id = auth.uid()
  )
);

CREATE POLICY "Bar owners can update their pending bar boosts"
ON bar_boosts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM bars
    WHERE bars.id = bar_boosts.bar_id
      AND bars.owner_id = auth.uid()
  )
)
WITH CHECK (
  status = 'pending'
  AND EXISTS (
    SELECT 1 FROM bars
    WHERE bars.id = bar_boosts.bar_id
      AND bars.owner_id = auth.uid()
  )
);

COMMENT ON POLICY "Bar owners can create pending boosts for their bars" ON bar_boosts IS
'El dueño del bar solo puede crear boosts en estado pending. La activación (status=active) la hace exclusivamente el webhook de RevenueCat (service_role) tras confirmar el pago.';

COMMENT ON POLICY "Bar owners can update their pending bar boosts" ON bar_boosts IS
'El dueño del bar no puede auto-activar ni auto-expirar un boost; solo puede seguir escribiendo en estado pending. La transición a active/expired la hace el webhook (service_role, bypassa RLS).';
