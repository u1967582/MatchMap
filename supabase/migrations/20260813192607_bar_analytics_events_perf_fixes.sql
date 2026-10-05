-- Índices que faltaban para las FKs de user_id (evita seq scans en el
-- ON DELETE CASCADE de auth.users y en futuras queries por usuario).
create index if not exists idx_bar_analytics_events_user_id
  on public.bar_analytics_events (user_id);

create index if not exists idx_bar_proximity_visits_user_id
  on public.bar_proximity_visits (user_id);

-- Evita reevaluar auth.uid()/is_super_admin() por fila: envolver en
-- (select ...) para que el planner lo trate como InitPlan (se evalúa
-- una sola vez por consulta, no por fila).
drop policy if exists "bar_analytics_events_select_owner_or_admin" on public.bar_analytics_events;
create policy "bar_analytics_events_select_owner_or_admin"
on public.bar_analytics_events
for select
to authenticated
using (
  (select public.is_super_admin())
  or exists (
    select 1 from public.bars b
    where b.id = bar_analytics_events.bar_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "bar_proximity_visits_select_owner_or_admin" on public.bar_proximity_visits;
create policy "bar_proximity_visits_select_owner_or_admin"
on public.bar_proximity_visits
for select
to authenticated
using (
  (select public.is_super_admin())
  or exists (
    select 1 from public.bars b
    where b.id = bar_proximity_visits.bar_id
      and b.owner_id = (select auth.uid())
  )
);
