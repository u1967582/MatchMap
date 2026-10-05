-- ============================================
-- MIGRACIÓN: RPCs de agregación para el dashboard de estadísticas del
-- propietario de bar.
-- Fecha: 2026-08-13
--
-- Ambas funciones son SECURITY DEFINER porque necesitan leer filas de
-- `favorites` de otros usuarios (la RLS de favorites solo deja ver las
-- propias) para poder contar cuánta gente tiene el bar en favoritos. Por
-- eso comprueban ellas mismas la autorización (owner del bar o admin) en
-- vez de depender de RLS.
-- ============================================

-- Resumen agregado de los últimos p_days días (por defecto 30).
create or replace function public.fn_get_bar_stats_summary(
  p_bar_id uuid,
  p_days int default 30
)
returns table (
  profile_views bigint,
  menu_views bigint,
  contact_clicks_phone bigint,
  contact_clicks_address bigint,
  contact_clicks_website bigint,
  unique_visitors bigint,
  favorites_count bigint,
  favorites_added_period bigint,
  reviews_count bigint,
  avg_rating numeric,
  period_days int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
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

  v_since := (timezone('utc', now()))::date - p_days;

  return query
  select
    coalesce(count(*) filter (where e.event_type = 'profile_view'), 0),
    coalesce(count(*) filter (where e.event_type = 'menu_view'), 0),
    coalesce(count(*) filter (where e.event_type = 'contact_click_phone'), 0),
    coalesce(count(*) filter (where e.event_type = 'contact_click_address'), 0),
    coalesce(count(*) filter (where e.event_type = 'contact_click_website'), 0),
    coalesce(count(distinct e.user_id), 0),
    (select count(*) from public.favorites f where f.bar_id = p_bar_id),
    (select count(*) from public.favorites f where f.bar_id = p_bar_id and f.created_at >= v_since),
    (select count(*) from public.reviews r where r.bar_id = p_bar_id),
    (select coalesce(round(avg(r.rating)::numeric, 2), 0) from public.reviews r where r.bar_id = p_bar_id),
    p_days
  from public.bar_analytics_events e
  where e.bar_id = p_bar_id and e.event_date >= v_since;
end;
$$;

revoke all on function public.fn_get_bar_stats_summary(uuid, int) from public;
grant execute on function public.fn_get_bar_stats_summary(uuid, int) to authenticated;
revoke execute on function public.fn_get_bar_stats_summary(uuid, int) from anon;

-- Serie diaria (con relleno a 0 en días sin eventos) de los últimos
-- p_days días, para el gráfico simple del dashboard.
create or replace function public.fn_get_bar_stats_daily(
  p_bar_id uuid,
  p_days int default 30
)
returns table (
  day date,
  profile_views bigint,
  menu_views bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
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

  return query
  select
    gs.day::date,
    coalesce(count(e.id) filter (where e.event_type = 'profile_view'), 0),
    coalesce(count(e.id) filter (where e.event_type = 'menu_view'), 0)
  from generate_series(
    (timezone('utc', now()))::date - (p_days - 1),
    (timezone('utc', now()))::date,
    interval '1 day'
  ) as gs(day)
  left join public.bar_analytics_events e
    on e.bar_id = p_bar_id and e.event_date = gs.day::date
  group by gs.day
  order by gs.day;
end;
$$;

revoke all on function public.fn_get_bar_stats_daily(uuid, int) from public;
grant execute on function public.fn_get_bar_stats_daily(uuid, int) to authenticated;
revoke execute on function public.fn_get_bar_stats_daily(uuid, int) from anon;
