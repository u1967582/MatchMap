-- ============================================
-- MIGRACIÓN: corrige un error de tipos en fn_get_bar_stats_daily.
-- Fecha: 2026-08-14
--
-- sum(bigint) en Postgres devuelve numeric, no bigint. Las columnas
-- acumuladas favorites_total/reviews_total sumaban un count(*) (bigint)
-- con un sum(...) over (window) (numeric), y Postgres rechazaba la
-- función entera con "structure of query does not match function result
-- type" en cuanto se ejecutaba con datos reales — esto es lo que rompía
-- el gráfico y las estadísticas para cualquier rango, no solo "desde
-- inicio". Se castea el resultado final de cada columna acumulada a
-- bigint para que coincida con el shape declarado en RETURNS TABLE.
-- ============================================

create or replace function public.fn_get_bar_stats_daily(
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
    ((select c from fav_before) + coalesce(sum(coalesce(fd.c, 0)) over (order by d.day), 0))::bigint,
    ((select c from rev_before) + coalesce(sum(coalesce(rd.c, 0)) over (order by d.day), 0))::bigint
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
