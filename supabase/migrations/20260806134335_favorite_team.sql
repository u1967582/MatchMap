-- ============================================
-- MIGRACIÓN: Equipo favorito del usuario
-- Fecha: 2026-08-06
-- Objetivo:
--  - Permitir que cada usuario (no anónimo) elija un equipo favorito de
--    entre los clubes españoles (Primera División, Segunda División y
--    Primera División Femenina).
--  - El popup de selección se muestra una única vez en la vida del usuario;
--    favorite_team_prompted_at se marca al mostrarse, elija o no equipo.
-- ============================================

-- 1) Columnas nuevas en public.users
alter table public.users
  add column if not exists favorite_team_id uuid references public.teams(id) on delete set null,
  add column if not exists favorite_team_prompted_at timestamptz;

create index if not exists idx_users_favorite_team_id
  on public.users (favorite_team_id);

comment on column public.users.favorite_team_id is
  'Equipo favorito elegido por el usuario (solo clubes españoles: Primera, Segunda, Primera Femenina). NULL = no elegido.';
comment on column public.users.favorite_team_prompted_at is
  'Momento en que se mostró el popup de "elige tu equipo favorito" por primera (y única) vez. NULL = aún no se ha mostrado.';

-- Nota: no se toca RLS de public.users. Las policies existentes
-- "Users can update own record" / "Users can read own record" (auth.uid() = id)
-- son a nivel de fila, no de columna, y ya cubren estas columnas nuevas.

-- 2) RPC: opciones de equipo elegibles (clubes españoles, ordenados por relevancia)
create or replace function public.get_favorite_team_options()
returns table (
  id uuid,
  name text,
  short_name text,
  logo_url text,
  match_count bigint
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
    count(m.id) as match_count
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
  group by t.id, t.name, t.short_name, t.logo_url
  order by match_count desc, t.name asc;
$$;

revoke all on function public.get_favorite_team_options() from public;
grant execute on function public.get_favorite_team_options() to authenticated;
revoke execute on function public.get_favorite_team_options() from anon;
