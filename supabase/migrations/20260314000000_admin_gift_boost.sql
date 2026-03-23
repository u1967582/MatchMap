-- ============================================
-- MIGRACIÓN: Función admin para regalar boost a un bar
-- ============================================

-- Función que permite a super admins regalar un boost a cualquier bar
CREATE OR REPLACE FUNCTION public.fn_admin_gift_boost(
  _bar_id uuid,
  _plan text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _end_at timestamptz;
BEGIN
  -- Solo super admins
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta acción';
  END IF;

  -- Validar plan
  IF _plan NOT IN ('7d', '1m', '1y') THEN
    RAISE EXCEPTION 'Plan inválido. Debe ser 7d, 1m o 1y';
  END IF;

  -- Calcular end_at según el plan
  _end_at := CASE _plan
    WHEN '7d' THEN now() + interval '7 days'
    WHEN '1m' THEN now() + interval '30 days'
    WHEN '1y' THEN now() + interval '365 days'
  END;

  -- Cancelar boosts activos existentes para este bar
  UPDATE public.bar_boosts
  SET status = 'cancelled'
  WHERE bar_id = _bar_id
    AND status = 'active'
    AND end_at > now();

  -- Insertar nuevo boost (amount_cents = 0 indica que es un regalo)
  INSERT INTO public.bar_boosts (
    bar_id,
    user_id,
    plan,
    start_at,
    end_at,
    status,
    amount_cents,
    currency
  ) VALUES (
    _bar_id,
    auth.uid(),
    _plan,
    now(),
    _end_at,
    'active',
    0,
    'eur'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_admin_gift_boost(uuid, text) TO authenticated;
