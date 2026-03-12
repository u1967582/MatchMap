-- Migration: Corregir la lògica de neteja de fn_sync_bar_preferences
--
-- Problemes anteriors:
--   1. La funció eliminava is_auto=true però no tocava is_auto=false
--      → els events antics de la funció trencada (is_auto=false) quedaven com a
--        "manuals" i el NOT EXISTS els protegia → events de competicions incorrectes
--   2. Events antics de competicions no seleccionades (La Liga + Celta) sobrevivien
--
-- Solució:
--   Quan s'actualitzen les preferències, esborrar TOTS els events futurs
--   amb match_id d'aquest bar (is_auto=true i is_auto=false) i regenerar
--   els correctes amb is_auto=true.
--   Raó: si un bar usa automatització, tots els seus events de partits
--   estan gestionats per ella. No hi ha distinció entre "auto" i "manual"
--   un cop s'activa l'automatització.

-- ============================================================
-- Actualitzar fn_sync_bar_preferences
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_bar_preferences(
  _bar_id               text,
  _competition_ids      text[],
  _team_ids             text[],
  _team_competition_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bar_uuid uuid := _bar_id::uuid;
BEGIN
  -- Verificar que el usuario autenticado es el propietario del bar o super admin
  IF NOT (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.bars b
      WHERE b.id = _bar_uuid AND b.owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Solo el propietario del bar puede modificar sus preferencias';
  END IF;

  -- --------------------------------------------------------
  -- Guardar preferències de competicions senceres
  -- --------------------------------------------------------
  DELETE FROM public.bar_selected_competitions WHERE bar_id = _bar_uuid;
  IF _competition_ids IS NOT NULL AND array_length(_competition_ids, 1) > 0 THEN
    INSERT INTO public.bar_selected_competitions (bar_id, competition_id)
    SELECT _bar_uuid, unnest(_competition_ids)::uuid
    ON CONFLICT DO NOTHING;
  END IF;

  -- --------------------------------------------------------
  -- Guardar preferències d'equips amb la seva competició
  -- --------------------------------------------------------
  DELETE FROM public.bar_selected_teams WHERE bar_id = _bar_uuid;
  IF _team_ids IS NOT NULL AND array_length(_team_ids, 1) > 0
     AND _team_competition_ids IS NOT NULL AND array_length(_team_competition_ids, 1) > 0 THEN
    INSERT INTO public.bar_selected_teams (bar_id, team_id, competition_id)
    SELECT _bar_uuid, _team_ids[i]::uuid, _team_competition_ids[i]::uuid
    FROM generate_subscripts(_team_ids, 1) AS i
    ON CONFLICT DO NOTHING;
  END IF;

  -- --------------------------------------------------------
  -- Esborrar TOTS els events futurs del bar que tinguin match_id
  -- (tant is_auto=true com is_auto=false)
  -- Quan s'usa automatització tots els events de partits queden gestionats per ella
  -- --------------------------------------------------------
  DELETE FROM public.events
  WHERE bar_id    = _bar_uuid
    AND start_time > now()
    AND match_id  IS NOT NULL;

  -- --------------------------------------------------------
  -- Generar nous events amb is_auto=true:
  --   - Si la competició del partit és a bar_selected_competitions (competició sencera)
  --   - O si l'equip (local/visitant) és a bar_selected_teams EN AQUELLA COMPETICIÓ
  -- --------------------------------------------------------
  INSERT INTO public.events (bar_id, match_id, start_time, is_auto)
  SELECT
    _bar_uuid,
    m.id,
    (m.date::text || ' ' || coalesce(m.time::text, '00:00'))::timestamptz,
    true
  FROM public.matches m
  WHERE m.status   = 'scheduled'
    AND m.date     >= current_date
    AND (
      -- Competició sencera seleccionada
      EXISTS (
        SELECT 1 FROM public.bar_selected_competitions bsc
        WHERE bsc.bar_id        = _bar_uuid
          AND bsc.competition_id = m.competition_id
      )
      OR
      -- Equip seleccionat en aquesta competició concreta
      EXISTS (
        SELECT 1 FROM public.bar_selected_teams bst
        WHERE bst.bar_id        = _bar_uuid
          AND bst.competition_id = m.competition_id
          AND (bst.team_id = m.home_team_id OR bst.team_id = m.away_team_id)
      )
    )
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_sync_bar_preferences(text, text[], text[], text[]) TO authenticated;

-- ============================================================
-- Actualitzar fn_sync_bar_preferences_admin igual
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_bar_preferences_admin(
  _bar_id               text,
  _competition_ids      text[],
  _team_ids             text[],
  _team_competition_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bar_uuid uuid := _bar_id::uuid;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can use this function';
  END IF;

  DELETE FROM public.bar_selected_competitions WHERE bar_id = _bar_uuid;
  IF _competition_ids IS NOT NULL AND array_length(_competition_ids, 1) > 0 THEN
    INSERT INTO public.bar_selected_competitions (bar_id, competition_id)
    SELECT _bar_uuid, unnest(_competition_ids)::uuid
    ON CONFLICT DO NOTHING;
  END IF;

  DELETE FROM public.bar_selected_teams WHERE bar_id = _bar_uuid;
  IF _team_ids IS NOT NULL AND array_length(_team_ids, 1) > 0
     AND _team_competition_ids IS NOT NULL AND array_length(_team_competition_ids, 1) > 0 THEN
    INSERT INTO public.bar_selected_teams (bar_id, team_id, competition_id)
    SELECT _bar_uuid, _team_ids[i]::uuid, _team_competition_ids[i]::uuid
    FROM generate_subscripts(_team_ids, 1) AS i
    ON CONFLICT DO NOTHING;
  END IF;

  -- Esborrar tots els events futurs amb match_id
  DELETE FROM public.events
  WHERE bar_id    = _bar_uuid
    AND start_time > now()
    AND match_id  IS NOT NULL;

  INSERT INTO public.events (bar_id, match_id, start_time, is_auto)
  SELECT
    _bar_uuid,
    m.id,
    (m.date::text || ' ' || coalesce(m.time::text, '00:00'))::timestamptz,
    true
  FROM public.matches m
  WHERE m.status   = 'scheduled'
    AND m.date     >= current_date
    AND (
      EXISTS (
        SELECT 1 FROM public.bar_selected_competitions bsc
        WHERE bsc.bar_id = _bar_uuid AND bsc.competition_id = m.competition_id
      )
      OR
      EXISTS (
        SELECT 1 FROM public.bar_selected_teams bst
        WHERE bst.bar_id        = _bar_uuid
          AND bst.competition_id = m.competition_id
          AND (bst.team_id = m.home_team_id OR bst.team_id = m.away_team_id)
      )
    )
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_sync_bar_preferences_admin(text, text[], text[], text[]) TO authenticated;

-- ============================================================
-- Neteja retroactiva: esborrar events antics incorrectes
-- (tots els events futurs amb match_id del bar de proves)
-- ============================================================
DELETE FROM public.events
WHERE start_time > now()
  AND match_id IS NOT NULL;
