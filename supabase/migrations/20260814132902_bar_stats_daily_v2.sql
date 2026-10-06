-- ============================================
-- MIGRACIÓN: extiende la serie diaria del dashboard de estadísticas para
-- cubrir las 6 métricas mostradas en la pantalla (no solo profile/menu
-- views), y añade una RPC para resolver el rango "desde inicio".
-- Fecha: 2026-08-14
-- ============================================

-- Reemplaza fn_get_bar_stats_daily: cambia el shape de retorno, así que
-- hace falta DROP antes de CREATE (Postgres no permite CREATE OR REPLACE
-- cuando cambian las columnas de salida de una función que retorna table).
drop function if exists public.fn_get_bar_stats_daily(uuid, int);

create function public.fn_get_bar_stats_daily(
  p_bar_id uuid,
  p_days int default 30
)
returns table (
  day date,
  profile_views bigint,
  menu_views bigint,
  contact_clicks bigint,
  unique_visitors bigint,
  favorites_total bigint,
  reviews_total bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_until date;
  v_since date;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select owner_id into v_owner_id from public.bars where id = p_bar_id;
  if v_owner_id is null then
    raise exception 'Bar no encontrado o sin propietario';
  end if;

  if v_owner_id <> auth.uid() and not public.is_super_admin() then
    raise exception 'No autorizado';
  end if;

  v_until := (timezone('utc', now()))::date;
  v_since := v_until - (greatest(p_days, 1) - 1);

  return query
  with days as (
    select gs.day::date as day
    from generate_series(v_since, v_until, interval '1 day') as gs(day)
  ),
  events_daily as (
    select
      e.event_date as day,
      count(*) filter (where e.event_type = 'profile_view') as profile_views,
      count(*) filter (where e.event_type = 'menu_view') as menu_views,
      count(*) filter (
        where e.event_type in ('contact_click_phone', 'contact_click_address', 'contact_click_website')
      ) as contact_clicks,
      count(distinct e.user_id) as unique_visitors
    from public.bar_analytics_events e
    where e.bar_id = p_bar_id and e.event_date between v_since and v_until
    group by e.event_date
  ),
  fav_before as (
    select count(*) as c
    from public.favorites f
    where f.bar_id = p_bar_id and (f.created_at at time zone 'utc')::date < v_since
  ),
  fav_daily as (
    select (f.created_at at time zone 'utc')::date as day, count(*) as c
    from public.favorites f
    where f.bar_id = p_bar_id and (f.created_at at time zone 'utc')::date between v_since and v_until
    group by (f.created_at at time zone 'utc')::date
  ),
  rev_before as (
    select count(*) as c
    from public.reviews r
    where r.bar_id = p_bar_id and (r.created_at at time zone 'utc')::date < v_since
  ),
  rev_daily as (
    select (r.created_at at time zone 'utc')::date as day, count(*) as c
    from public.reviews r
    where r.bar_id = p_bar_id and (r.created_at at time zone 'utc')::date between v_since and v_until
    group by (r.created_at at time zone 'utc')::date
  )
  select
    d.day,
    coalesce(ed.profile_views, 0),
    coalesce(ed.menu_views, 0),
    coalesce(ed.contact_clicks, 0),
    coalesce(ed.unique_visitors, 0),
    (select c from fav_before) + coalesce(sum(coalesce(fd.c, 0)) over (order by d.day), 0),
    (select c from rev_before) + coalesce(sum(coalesce(rd.c, 0)) over (order by d.day), 0)
  from days d
  left join events_daily ed on ed.day = d.day
  left join fav_daily fd on fd.day = d.day
  left join rev_daily rd on rd.day = d.day
  order by d.day;
end;
$$;

revoke all on function public.fn_get_bar_stats_daily(uuid, int) from public;
grant execute on function public.fn_get_bar_stats_daily(uuid, int) to authenticated;
revoke execute on function public.fn_get_bar_stats_daily(uuid, int) from anon;

-- Resuelve el rango "desde inicio" del gráfico: la fecha del primer dato
-- que tenemos del bar, mirando las 3 fuentes que alimentan las métricas
-- (eventos de comportamiento, favoritos y reseñas) y quedándonos con la
-- más antigua. Usar solo bar_analytics_events se queda corto: un bar
-- puede tener reseñas o favoritos de mucho antes de que empezáramos a
-- trackear eventos (p.ej. bares importados/reclamados tarde), y "desde
-- inicio" recortaría ese histórico sin avisar. Tampoco usamos
-- bars.created_at porque puede ser muy anterior al primer dato real y
-- dejaría un rango con un tramo inicial vacío.
create or replace function public.fn_get_bar_stats_range_start(
  p_bar_id uuid
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_first_event date;
  v_first_favorite date;
  v_first_review date;
  v_first date;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select owner_id into v_owner_id from public.bars where id = p_bar_id;
  if v_owner_id is null then
    raise exception 'Bar no encontrado o sin propietario';
  end if;

  if v_owner_id <> auth.uid() and not public.is_super_admin() then
    raise exception 'No autorizado';
  end if;

  select min(e.event_date) into v_first_event
  from public.bar_analytics_events e
  where e.bar_id = p_bar_id;

  select min((f.created_at at time zone 'utc')::date) into v_first_favorite
  from public.favorites f
  where f.bar_id = p_bar_id;

  select min((r.created_at at time zone 'utc')::date) into v_first_review
  from public.reviews r
  where r.bar_id = p_bar_id;

  v_first := least(v_first_event, v_first_favorite, v_first_review);

  if v_first is null then
    return (timezone('utc', now()))::date - 30;
  end if;

  return v_first;
end;
$$;

revoke all on function public.fn_get_bar_stats_range_start(uuid) from public;
grant execute on function public.fn_get_bar_stats_range_start(uuid) to authenticated;
revoke execute on function public.fn_get_bar_stats_range_start(uuid) from anon;

-- Acelera el filtro bar_id + event_date usado por ambas RPCs de arriba y
-- por fn_get_bar_stats_summary; la unique constraint existente incluye
-- user_id/event_type primero y no cubre bien este patrón de consulta.
create index if not exists idx_bar_analytics_events_bar_date
  on public.bar_analytics_events (bar_id, event_date);
