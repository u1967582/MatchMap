-- ============================================
-- MIGRACIÓN: Analítica de comportamiento sobre bares
-- Fecha: 2026-08-13
-- Objetivo:
--  - bar_analytics_events: vistas de perfil, vistas de carta y clics de
--    contacto, deduplicados a 1 fila por (bar, usuario, tipo, día UTC).
--  - bar_proximity_visits: presencia física deduplicada por día, sin
--    coordenadas ni distancia (privacy-friendly).
--  - Escritura SOLO vía RPC security definer (fn_track_bar_event /
--    fn_track_bar_proximity): el cliente nunca hace INSERT directo, así
--    no puede falsear user_id ni inflar/desinflar métricas de un bar.
-- ============================================

-- 1) Tabla de eventos genéricos
create table if not exists public.bar_analytics_events (
  id uuid primary key default gen_random_uuid(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'profile_view',
    'menu_view',
    'contact_click_phone',
    'contact_click_address',
    'contact_click_website'
  )),
  event_date date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  unique (bar_id, user_id, event_type, event_date)
);

comment on table public.bar_analytics_events is
  'Eventos de comportamiento de usuarios sobre un bar. Deduplicado a 1 fila por (bar, usuario, tipo de evento, día UTC) para limitar spam/gaming. Escritura solo vía fn_track_bar_event.';

create index if not exists idx_bar_analytics_events_bar_created
  on public.bar_analytics_events (bar_id, created_at desc);

create index if not exists idx_bar_analytics_events_bar_type_date
  on public.bar_analytics_events (bar_id, event_type, event_date desc);

create index if not exists idx_bar_analytics_events_user_id
  on public.bar_analytics_events (user_id);

-- 2) Tabla de presencia por proximidad (sin coordenadas, sin distancia)
create table if not exists public.bar_proximity_visits (
  id uuid primary key default gen_random_uuid(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_date date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  unique (bar_id, user_id, visit_date)
);

comment on table public.bar_proximity_visits is
  'Presencia física deduplicada por día ("usuario X estuvo cerca del bar Y el día D"). No almacena lat/lng ni distancia. Escritura solo vía fn_track_bar_proximity.';

create index if not exists idx_bar_proximity_visits_bar_date
  on public.bar_proximity_visits (bar_id, visit_date desc);

create index if not exists idx_bar_proximity_visits_user_id
  on public.bar_proximity_visits (user_id);

-- 3) RLS: habilitar en ambas tablas
alter table public.bar_analytics_events enable row level security;
alter table public.bar_proximity_visits enable row level security;

-- 3.1) SELECT: owner del bar o admin. Sin policies de INSERT/UPDATE/DELETE
--      para "authenticated": toda escritura pasa por las RPCs de abajo,
--      que corren como security definer (dueño de la función = dueño de
--      la tabla, por tanto no están sujetas a estas policies de RLS).
--      auth.uid()/is_super_admin() se envuelven en (select ...) para que
--      el planner los evalúe una sola vez por consulta, no por fila.
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

-- 4) RPC: trackear evento genérico (profile_view, menu_view, clics de contacto)
create or replace function public.fn_track_bar_event(
  p_bar_id uuid,
  p_event_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_verification_status text;
  v_is_active boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_event_type not in (
    'profile_view', 'menu_view',
    'contact_click_phone', 'contact_click_address', 'contact_click_website'
  ) then
    raise exception 'event_type inválido: %', p_event_type;
  end if;

  select owner_id, verification_status, is_active
    into v_owner_id, v_verification_status, v_is_active
  from public.bars
  where id = p_bar_id;

  -- Bar inexistente: no-op silencioso (evita romper el flujo del cliente)
  if not found then
    return;
  end if;

  -- Solo se trackean bares visibles públicamente
  if v_verification_status is distinct from 'approved' or v_is_active is not true then
    return;
  end if;

  -- El propio owner nunca infla sus estadísticas (defensa en profundidad;
  -- redundante con el filtro isOwner ya aplicado en el cliente)
  if v_owner_id is not null and v_owner_id = auth.uid() then
    return;
  end if;

  insert into public.bar_analytics_events (bar_id, user_id, event_type)
  values (p_bar_id, auth.uid(), p_event_type)
  on conflict (bar_id, user_id, event_type, event_date) do nothing;
end;
$$;

revoke all on function public.fn_track_bar_event(uuid, text) from public;
grant execute on function public.fn_track_bar_event(uuid, text) to authenticated;

-- 5) RPC: trackear proximidad (solo recibe bar_id, nunca lat/lng)
create or replace function public.fn_track_bar_proximity(
  p_bar_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_verification_status text;
  v_is_active boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select owner_id, verification_status, is_active
    into v_owner_id, v_verification_status, v_is_active
  from public.bars
  where id = p_bar_id;

  if not found then
    return;
  end if;

  if v_verification_status is distinct from 'approved' or v_is_active is not true then
    return;
  end if;

  if v_owner_id is not null and v_owner_id = auth.uid() then
    return;
  end if;

  insert into public.bar_proximity_visits (bar_id, user_id)
  values (p_bar_id, auth.uid())
  on conflict (bar_id, user_id, visit_date) do nothing;
end;
$$;

revoke all on function public.fn_track_bar_proximity(uuid) from public;
grant execute on function public.fn_track_bar_proximity(uuid) to authenticated;

-- 6) Defensa en profundidad: los privilegios por defecto del proyecto
--    conceden EXECUTE en funciones nuevas del schema public a anon/
--    authenticated; "revoke all ... from public" no revoca lo ya
--    concedido a "anon" específicamente. Ambas RPC ya bloquean la llamada
--    si auth.uid() es null, pero se revoca explícitamente el privilegio
--    para que ni siquiera se pueda intentar sin sesión.
revoke execute on function public.fn_track_bar_event(uuid, text) from anon;
revoke execute on function public.fn_track_bar_proximity(uuid) from anon;
