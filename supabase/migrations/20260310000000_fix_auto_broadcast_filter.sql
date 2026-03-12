-- Migration: Corregir filtro de automatización de partidos
-- Problema: fn_sync_bar_preferences generaba eventos para TODOS los partidos de un equipo,
--           ignorando el filtro de bar_selected_competitions.
-- Solución: Los eventos auto-generados requieren que se cumplan LAS DOS condiciones:
--   1. La competición del partido está en bar_selected_competitions del bar
--   2. El equipo local o visitante está en bar_selected_teams del bar

-- ============================================================
-- 1. Añadir columna is_auto a events para distinguir eventos
--    auto-generados de los añadidos manualmente por el bar
-- ============================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_auto boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. Crear/reemplazar fn_sync_bar_preferences para usuarios normales
--    (bar owners) con la lógica de filtrado corregida
-- ============================================================
create or replace function public.fn_sync_bar_preferences(
  _bar_id  text,
  _competition_ids text[],
  _team_ids        text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _bar_uuid uuid := _bar_id::uuid;
begin
  -- Verificar que el usuario autenticado es el propietario del bar o super admin
  if not (
    is_super_admin()
    or exists (
      select 1
      from public.bars b
      where b.id = _bar_uuid
        and b.owner_id = auth.uid()
    )
  ) then
    raise exception 'Solo el propietario del bar puede modificar sus preferencias';
  end if;

  -- --------------------------------------------------------
  -- Guardar preferencias de competiciones
  -- --------------------------------------------------------
  delete from public.bar_selected_competitions where bar_id = _bar_uuid;

  if _competition_ids is not null and array_length(_competition_ids, 1) > 0 then
    insert into public.bar_selected_competitions (bar_id, competition_id)
    select _bar_uuid, unnest(_competition_ids)::uuid
    on conflict do nothing;
  end if;

  -- --------------------------------------------------------
  -- Guardar preferencias de equipos
  -- --------------------------------------------------------
  delete from public.bar_selected_teams where bar_id = _bar_uuid;

  if _team_ids is not null and array_length(_team_ids, 1) > 0 then
    insert into public.bar_selected_teams (bar_id, team_id)
    select _bar_uuid, unnest(_team_ids)::uuid
    on conflict do nothing;
  end if;

  -- --------------------------------------------------------
  -- Eliminar eventos auto-generados anteriores (futuros)
  -- Los eventos añadidos manualmente (is_auto = false) se conservan
  -- --------------------------------------------------------
  delete from public.events
  where bar_id = _bar_uuid
    and is_auto = true
    and start_time > now();

  -- --------------------------------------------------------
  -- Generar nuevos eventos automáticos aplicando LOS DOS filtros:
  --   1. La competición del partido está en bar_selected_competitions
  --   2. El equipo local o visitante está en bar_selected_teams
  --
  -- Solo se ejecuta si hay tanto competiciones como equipos seleccionados
  -- --------------------------------------------------------
  if (
    _competition_ids is not null and array_length(_competition_ids, 1) > 0
    and _team_ids is not null and array_length(_team_ids, 1) > 0
  ) then
    insert into public.events (bar_id, match_id, start_time, is_auto)
    select
      _bar_uuid,
      m.id,
      -- Combinar fecha y hora en timestamptz
      (m.date::text || ' ' || coalesce(m.time::text, '00:00'))::timestamptz,
      true
    from public.matches m
    where m.status = 'scheduled'
      and m.date >= current_date
      -- FILTRO 1: la competición del partido está en bar_selected_competitions
      and exists (
        select 1
        from public.bar_selected_competitions bsc
        where bsc.bar_id = _bar_uuid
          and bsc.competition_id = m.competition_id
      )
      -- FILTRO 2: el equipo local o visitante está en bar_selected_teams
      and (
        exists (
          select 1
          from public.bar_selected_teams bst
          where bst.bar_id = _bar_uuid
            and bst.team_id = m.home_team_id
        )
        or exists (
          select 1
          from public.bar_selected_teams bst
          where bst.bar_id = _bar_uuid
            and bst.team_id = m.away_team_id
        )
      )
      -- Evitar duplicar eventos ya añadidos manualmente
      and not exists (
        select 1
        from public.events e_existing
        where e_existing.bar_id = _bar_uuid
          and e_existing.match_id = m.id
          and e_existing.is_auto = false
      )
    on conflict do nothing;
  end if;
end;
$$;

-- Grant execute a usuarios autenticados
grant execute on function public.fn_sync_bar_preferences(text, text[], text[]) to authenticated;

-- ============================================================
-- 3. Actualizar fn_sync_bar_preferences_admin con la misma
--    lógica corregida (para que admins también generen eventos
--    con el filtro correcto)
-- ============================================================
create or replace function public.fn_sync_bar_preferences_admin(
  _bar_id  text,
  _competition_ids text[],
  _team_ids        text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _bar_uuid uuid := _bar_id::uuid;
begin
  -- Solo super admins pueden usar esta función
  if not is_super_admin() then
    raise exception 'Only super admins can use this function';
  end if;

  -- Guardar preferencias de competiciones
  delete from public.bar_selected_competitions where bar_id = _bar_uuid;

  if _competition_ids is not null and array_length(_competition_ids, 1) > 0 then
    insert into public.bar_selected_competitions (bar_id, competition_id)
    select _bar_uuid, unnest(_competition_ids)::uuid
    on conflict do nothing;
  end if;

  -- Guardar preferencias de equipos
  delete from public.bar_selected_teams where bar_id = _bar_uuid;

  if _team_ids is not null and array_length(_team_ids, 1) > 0 then
    insert into public.bar_selected_teams (bar_id, team_id)
    select _bar_uuid, unnest(_team_ids)::uuid
    on conflict do nothing;
  end if;

  -- Eliminar eventos auto-generados anteriores (futuros)
  delete from public.events
  where bar_id = _bar_uuid
    and is_auto = true
    and start_time > now();

  -- Generar nuevos eventos automáticos con los DOS filtros
  if (
    _competition_ids is not null and array_length(_competition_ids, 1) > 0
    and _team_ids is not null and array_length(_team_ids, 1) > 0
  ) then
    insert into public.events (bar_id, match_id, start_time, is_auto)
    select
      _bar_uuid,
      m.id,
      (m.date::text || ' ' || coalesce(m.time::text, '00:00'))::timestamptz,
      true
    from public.matches m
    where m.status = 'scheduled'
      and m.date >= current_date
      and exists (
        select 1
        from public.bar_selected_competitions bsc
        where bsc.bar_id = _bar_uuid
          and bsc.competition_id = m.competition_id
      )
      and (
        exists (
          select 1
          from public.bar_selected_teams bst
          where bst.bar_id = _bar_uuid
            and bst.team_id = m.home_team_id
        )
        or exists (
          select 1
          from public.bar_selected_teams bst
          where bst.bar_id = _bar_uuid
            and bst.team_id = m.away_team_id
        )
      )
      -- Evitar duplicar eventos ya añadidos manualmente
      and not exists (
        select 1
        from public.events e_existing
        where e_existing.bar_id = _bar_uuid
          and e_existing.match_id = m.id
          and e_existing.is_auto = false
      )
    on conflict do nothing;
  end if;
end;
$$;

-- Grant execute a usuarios autenticados
grant execute on function public.fn_sync_bar_preferences_admin(text, text[], text[]) to authenticated;
