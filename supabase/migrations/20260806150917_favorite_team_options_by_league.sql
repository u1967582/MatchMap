-- ============================================
-- MIGRACIÓN: Equipo favorito - opciones agrupadas por liga
-- Fecha: 2026-08-06
-- Objetivo:
--  - Ampliar get_favorite_team_options() para devolver también la
--    competición (id y nombre) de cada equipo, de modo que el popup de
--    selección pueda mostrar chips de liga (Primera, Segunda, Femenina)
--    con la estética de los filtros de partido.
-- ============================================

drop function if exists public.get_favorite_team_options();

create or replace function public.get_favorite_team_options()
returns table (
  id uuid,
  name text,
  short_name text,
  logo_url text,
  match_count bigint,
  competition_id uuid,
  competition_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.id,
    t.name,
    t.short_name,
    t.logo_url,
    count(m.id) as match_count,
    c.id as competition_id,
    c.name as competition_name
  from public.teams t
  join public.competitions c
    on c.name in ('Primera División', 'Segunda División', 'Primera División Femenina')
   and c.country = 'España'
  left join public.matches m
    on m.competition_id = c.id
   and (m.home_team_id = t.id or m.away_team_id = t.id)
  where exists (
    select 1
    from public.matches m2
    where m2.competition_id = c.id
      and (m2.home_team_id = t.id or m2.away_team_id = t.id)
  )
  group by t.id, t.name, t.short_name, t.logo_url, c.id, c.name
  order by
    case c.name
      when 'Primera División' then 1
      when 'Segunda División' then 2
      when 'Primera División Femenina' then 3
      else 4
    end,
    match_count desc,
    t.name asc;
$$;

revoke all on function public.get_favorite_team_options() from public;
grant execute on function public.get_favorite_team_options() to authenticated;
revoke execute on function public.get_favorite_team_options() from anon;
