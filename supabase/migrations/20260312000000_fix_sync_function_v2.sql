-- Migration: Fix fn_sync_bar_preferences - eliminar versió antiga (uuid[]) i corregir typo
--
-- Problemes detectats:
--   1. Existien DUES versions de la funció amb signatures diferents:
--      - fn_sync_bar_preferences(uuid, uuid[], uuid[]) → versió antiga sense filtre de competició
--      - fn_sync_bar_preferences(text, text[], text[]) → versió nova amb filtres PERÒ amb typo 'start_tme'
--   2. PostgreSQL escollía la versió uuid[] perquè els UUIDs s'infereixen com uuid[].
--   3. El typo 'start_tme' feia crash la versió nova → rollback de tot.
--
-- Solució:
--   - Eliminar la versió antiga (uuid[])
--   - Recrear la versió text[] sense typos
--   - Netejar events incorrectes existents i marcar els correctes com is_auto = true

-- ============================================================
-- 1. Eliminar la versió antiga i trencada (uuid[], uuid[], uuid[])
-- ============================================================
DROP FUNCTION IF EXISTS public.fn_sync_bar_preferences(uuid, uuid[], uuid[]);

-- ============================================================
-- 2. Recrear la funció correcta (text[]) sense typos
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_bar_preferences(
  _bar_id          text,
  _competition_ids text[],
  _team_ids        text[]
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

  -- Guardar preferencias de competiciones
  DELETE FROM public.bar_selected_competitions WHERE bar_id = _bar_uuid;
  IF _competition_ids IS NOT NULL AND array_length(_competition_ids, 1) > 0 THEN
    INSERT INTO public.bar_selected_competitions (bar_id, competition_id)
    SELECT _bar_uuid, unnest(_competition_ids)::uuid
    ON CONFLICT DO NOTHING;
  END IF;

  -- Guardar preferencias de equipos
  DELETE FROM public.bar_selected_teams WHERE bar_id = _bar_uuid;
  IF _team_ids IS NOT NULL AND array_length(_team_ids, 1) > 0 THEN
    INSERT INTO public.bar_selected_teams (bar_id, team_id)
    SELECT _bar_uuid, unnest(_team_ids)::uuid
    ON CONFLICT DO NOTHING;
  END IF;

  -- Eliminar events auto-generats futurs (is_auto = true)
  DELETE FROM public.events
  WHERE bar_id  = _bar_uuid
    AND is_auto = true
    AND start_time > now();

  -- Generar nous events automàtics aplicant ELS DOS filtres:
  --   1. La competició del partit és a bar_selected_competitions
  --   2. L'equip local o visitant és a bar_selected_teams
  IF (
    _competition_ids IS NOT NULL AND array_length(_competition_ids, 1) > 0
    AND _team_ids    IS NOT NULL AND array_length(_team_ids, 1) > 0
  ) THEN
    INSERT INTO public.events (bar_id, match_id, start_time, is_auto)
    SELECT
      _bar_uuid,
      m.id,
      (m.date::text || ' ' || coalesce(m.time::text, '00:00'))::timestamptz,
      true
    FROM public.matches m
    WHERE m.status = 'scheduled'
      AND m.date >= current_date
      -- FILTRE 1: competició del partit a bar_selected_competitions
      AND EXISTS (
        SELECT 1 FROM public.bar_selected_competitions bsc
        WHERE bsc.bar_id = _bar_uuid
          AND bsc.competition_id = m.competition_id
      )
      -- FILTRE 2: equip local o visitant a bar_selected_teams
      AND (
        EXISTS (SELECT 1 FROM public.bar_selected_teams bst WHERE bst.bar_id = _bar_uuid AND bst.team_id = m.home_team_id)
        OR
        EXISTS (SELECT 1 FROM public.bar_selected_teams bst WHERE bst.bar_id = _bar_uuid AND bst.team_id = m.away_team_id)
      )
      -- Evitar duplicar events afegits manualment
      AND NOT EXISTS (
        SELECT 1 FROM public.events e_existing
        WHERE e_existing.bar_id  = _bar_uuid
          AND e_existing.match_id = m.id
          AND e_existing.is_auto  = false
      )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_sync_bar_preferences(text, text[], text[]) TO authenticated;

-- ============================================================
-- 3. Netejar events incorrectes existents
--    Eliminar events futurs on la competició del partit NO és
--    a les preferències del bar (events generats per la funció vella)
-- ============================================================
DELETE FROM public.events e
WHERE e.start_time  > now()
  AND e.match_id    IS NOT NULL
  AND e.is_auto     = false
  -- El bar té preferències de competicions configurades
  AND EXISTS (
    SELECT 1 FROM public.bar_selected_competitions bsc
    WHERE bsc.bar_id = e.bar_id
  )
  -- Però la competició d'aquest event NO és a les preferències
  AND NOT EXISTS (
    SELECT 1
    FROM public.bar_selected_competitions bsc
    JOIN public.matches m ON m.id = e.match_id
    WHERE bsc.bar_id = e.bar_id
      AND bsc.competition_id = m.competition_id
  );

-- ============================================================
-- 4. Marcar com is_auto = true els events correctes existents
--    (creats per la funció vella sense el flag)
-- ============================================================
UPDATE public.events e
SET is_auto = true
WHERE e.is_auto    = false
  AND e.start_time > now()
  AND e.match_id   IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.bar_selected_competitions bsc
    JOIN public.matches m ON m.id = e.match_id
    WHERE bsc.bar_id = e.bar_id
      AND bsc.competition_id = m.competition_id
  );
