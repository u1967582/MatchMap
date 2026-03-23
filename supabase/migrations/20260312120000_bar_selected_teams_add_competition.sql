-- Migration: Afegir competition_id a bar_selected_teams
--
-- Motivació: Les seleccions d'equip han d'estar lligades a una competició
-- concreta. Celta de Vigo seleccionat a Europa League → només genera events
-- d'Europa League, no de La Liga.
--
-- Canvis:
--   1. Afegir columna competition_id a bar_selected_teams
--   2. Actualitzar la clau primària a (bar_id, team_id, competition_id)
--   3. Actualitzar fn_sync_bar_preferences per acceptar parells equip+competició
--   4. Actualitzar fn_sync_bar_preferences_admin igual
--   5. Eliminar funcions antigues

-- ============================================================
-- 1. Netejar dades existents (incompatibles amb el nou esquema)
--    Les seleccions anteriors s'hauran de tornar a guardar
-- ============================================================
DELETE FROM public.bar_selected_teams;
DELETE FROM public.bar_selected_competitions;
DELETE FROM public.events WHERE is_auto = true;
-- Marcar com auto els events que tenien is_auto = false per error de l'antiga funció
-- (detectables: tenen match_id i estan en el futur)
UPDATE public.events
SET is_auto = true
WHERE start_time > now()
  AND match_id IS NOT NULL;

-- ============================================================
-- 2. Afegir columna competition_id
-- ============================================================
ALTER TABLE public.bar_selected_teams
  ADD COLUMN IF NOT EXISTS competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE;

-- ============================================================
-- 3. Actualitzar clau primària
-- ============================================================
ALTER TABLE public.bar_selected_teams
  DROP CONSTRAINT IF EXISTS bar_selected_teams_pkey;

ALTER TABLE public.bar_selected_teams
  ADD CONSTRAINT bar_selected_teams_pkey PRIMARY KEY (bar_id, team_id, competition_id);

-- ============================================================
-- 4. Eliminar totes les versions antigues de fn_sync_bar_preferences
-- ============================================================
DROP FUNCTION IF EXISTS public.fn_sync_bar_preferences(uuid, uuid[], uuid[]);
DROP FUNCTION IF EXISTS public.fn_sync_bar_preferences(text, text[], text[]);

-- ============================================================
-- 5. Nova fn_sync_bar_preferences amb parells equip+competició
--    Paràmetres:
--      _competition_ids      → competicions senceres seleccionades (checkbox de competició)
--      _team_ids             → equips seleccionats (array paral·lel a _team_competition_ids)
--      _team_competition_ids → competició de cada equip (array paral·lel a _team_ids)
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
  -- Guardar preferencias de competicions senceres
  -- --------------------------------------------------------
  DELETE FROM public.bar_selected_competitions WHERE bar_id = _bar_uuid;
  IF _competition_ids IS NOT NULL AND array_length(_competition_ids, 1) > 0 THEN
    INSERT INTO public.bar_selected_competitions (bar_id, competition_id)
    SELECT _bar_uuid, unnest(_competition_ids)::uuid
    ON CONFLICT DO NOTHING;
  END IF;

  -- --------------------------------------------------------
  -- Guardar preferencias d'equips amb la seva competició
  -- --------------------------------------------------------
  DELETE FROM public.bar_selected_teams WHERE bar_id = _bar_uuid;
  IF _team_ids IS NOT NULL AND array_length(_team_ids, 1) > 0
     AND _team_competition_ids IS NOT NULL AND array_length(_team_competition_ids, 1) > 0 THEN
    INSERT INTO public.bar_selected_teams (bar_id, team_id, competition_id)
    SELECT
      _bar_uuid,
      _team_ids[i]::uuid,
      _team_competition_ids[i]::uuid
    FROM generate_subscripts(_team_ids, 1) AS i
    ON CONFLICT DO NOTHING;
  END IF;

  -- --------------------------------------------------------
  -- Eliminar events auto-generats futurs
  -- --------------------------------------------------------
  DELETE FROM public.events
  WHERE bar_id   = _bar_uuid
    AND is_auto  = true
    AND start_time > now();

  -- --------------------------------------------------------
  -- Generar nous events automàtics:
  --   - Si la competició del partit és a bar_selected_competitions (competició sencera)
  --   - O si l'equip local/visitant és a bar_selected_teams EN AQUELLA COMPETICIÓ
  -- --------------------------------------------------------
  INSERT INTO public.events (bar_id, match_id, start_time, is_auto)
  SELECT
    _bar_uuid,
    m.id,
    (m.date::text || ' ' || coalesce(m.time::text, '00:00'))::timestamptz,
    true
  FROM public.matches m
  WHERE m.status = 'scheduled'
    AND m.date >= current_date
    AND (
      -- Competició sencera seleccionada
      EXISTS (
        SELECT 1 FROM public.bar_selected_competitions bsc
        WHERE bsc.bar_id = _bar_uuid
          AND bsc.competition_id = m.competition_id
      )
      OR
      -- Equip seleccionat específicament en aquesta competició
      EXISTS (
        SELECT 1 FROM public.bar_selected_teams bst
        WHERE bst.bar_id        = _bar_uuid
          AND bst.competition_id = m.competition_id
          AND (bst.team_id = m.home_team_id OR bst.team_id = m.away_team_id)
      )
    )
    -- No duplicar events afegits manualment
    AND NOT EXISTS (
      SELECT 1 FROM public.events e_existing
      WHERE e_existing.bar_id   = _bar_uuid
        AND e_existing.match_id = m.id
        AND e_existing.is_auto  = false
    )
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_sync_bar_preferences(text, text[], text[], text[]) TO authenticated;

-- ============================================================
-- 6. Actualitzar fn_sync_bar_preferences_admin igual
-- ============================================================
DROP FUNCTION IF EXISTS public.fn_sync_bar_preferences_admin(text, text[], text[]);

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
    SELECT
      _bar_uuid,
      _team_ids[i]::uuid,
      _team_competition_ids[i]::uuid
    FROM generate_subscripts(_team_ids, 1) AS i
    ON CONFLICT DO NOTHING;
  END IF;

  DELETE FROM public.events
  WHERE bar_id   = _bar_uuid
    AND is_auto  = true
    AND start_time > now();

  INSERT INTO public.events (bar_id, match_id, start_time, is_auto)
  SELECT
    _bar_uuid,
    m.id,
    (m.date::text || ' ' || coalesce(m.time::text, '00:00'))::timestamptz,
    true
  FROM public.matches m
  WHERE m.status = 'scheduled'
    AND m.date >= current_date
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
    AND NOT EXISTS (
      SELECT 1 FROM public.events e_existing
      WHERE e_existing.bar_id   = _bar_uuid
        AND e_existing.match_id = m.id
        AND e_existing.is_auto  = false
    )
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_sync_bar_preferences_admin(text, text[], text[], text[]) TO authenticated;
