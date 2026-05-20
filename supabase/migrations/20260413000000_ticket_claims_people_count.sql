-- ============================================
-- MIGRACIÓN: Añadir campo people_count a ticket_claims
-- Fecha: 2026-04-13
-- Objetivo: Registrar cuántas personas asistieron juntas al partido
-- ============================================

ALTER TABLE public.ticket_claims
  ADD COLUMN IF NOT EXISTS people_count integer NOT NULL DEFAULT 1
  CHECK (people_count >= 1 AND people_count <= 20);

-- Actualizar fn_claim_scarf para aceptar people_count
CREATE OR REPLACE FUNCTION public.fn_claim_scarf(
  _bar_id              text,
  _match_id            text,
  _team_id             text,
  _ticket_image_url    text,
  _location_verified   boolean,
  _location_lat        double precision,
  _location_lng        double precision,
  _match_day_verified  boolean,
  _match_time_verified boolean,
  _people_count        integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id     uuid := auth.uid();
  _claim_id    uuid;
  _new_count   integer;
  _new_rarity  text;
  _scarf_id    uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  INSERT INTO public.ticket_claims (
    user_id, bar_id, match_id, team_id,
    ticket_image_url,
    location_verified, location_lat, location_lng,
    match_day_verified, match_time_verified,
    people_count,
    status
  ) VALUES (
    _user_id,
    _bar_id::uuid,
    CASE WHEN _match_id IS NOT NULL AND _match_id <> '' THEN _match_id::uuid ELSE NULL END,
    _team_id::uuid,
    _ticket_image_url,
    _location_verified, _location_lat, _location_lng,
    _match_day_verified, _match_time_verified,
    GREATEST(1, LEAST(20, COALESCE(_people_count, 1))),
    CASE WHEN _location_verified AND _match_day_verified THEN 'approved' ELSE 'pending' END
  )
  RETURNING id INTO _claim_id;

  INSERT INTO public.user_scarves (user_id, team_id, claim_count, rarity, first_claimed_at, last_claimed_at)
  VALUES (_user_id, _team_id::uuid, 1, 'common', now(), now())
  ON CONFLICT (user_id, team_id) DO UPDATE
    SET claim_count    = user_scarves.claim_count + 1,
        last_claimed_at = now()
  RETURNING id, claim_count INTO _scarf_id, _new_count;

  _new_rarity := CASE
    WHEN _new_count >= 10 THEN 'legendary'
    WHEN _new_count >= 3  THEN 'rare'
    ELSE 'common'
  END;

  UPDATE public.user_scarves
  SET rarity = _new_rarity
  WHERE id = _scarf_id;

  RETURN jsonb_build_object(
    'claim_id',      _claim_id,
    'scarf_id',      _scarf_id,
    'claim_count',   _new_count,
    'rarity',        _new_rarity,
    'auto_approved', (_location_verified AND _match_day_verified)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_claim_scarf(text, text, text, text, boolean, double precision, double precision, boolean, boolean, integer) TO authenticated;
