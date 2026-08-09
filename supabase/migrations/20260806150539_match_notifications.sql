-- ============================================
-- MIGRACIÓN: Notificaciones push "tu equipo juega en 2h"
-- Fecha: 2026-08-06
-- Objetivo:
--  - Registrar Expo Push Tokens por usuario/dispositivo.
--  - Controlar qué (usuario, partido) ya fue notificado, para que el cron
--    de cada 15 min no duplique envíos dentro de la ventana de 2h.
--  - Permitir opt-out desde el perfil (users.match_notifications_enabled).
--  - RPC fn_get_pending_match_notifications(): usado por la Edge Function
--    (service_role) para obtener en una sola query todo lo que hay que
--    enviar en cada corrida del cron.
-- ============================================

-- 1) Preferencia de opt-out
alter table public.users
  add column if not exists match_notifications_enabled boolean not null default true;

comment on column public.users.match_notifications_enabled is
  'Si es false, el usuario desactivó desde su perfil el aviso de "tu equipo juega en 2h".';

-- 2) Índice para la query del cron (rango de fecha + status)
create index if not exists idx_matches_datetime_status
  on public.matches (datetime_utc, status);

-- 3) Tabla de push tokens (un usuario puede tener varios dispositivos)
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  expo_push_token text not null,
  platform text check (platform in ('ios', 'android')),
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (expo_push_token)
);

create index if not exists idx_push_tokens_user_id on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- El usuario puede ver sus propios tokens (útil para un futuro "mis dispositivos"),
-- pero NO puede insertar/actualizar/borrar directamente: todas las escrituras
-- pasan por las RPCs security definer de abajo, para evitar el caso de un
-- mismo dispositivo reasignando un token de un usuario a otro (logout/login).
drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own"
on public.push_tokens
for select
to authenticated
using (auth.uid() = user_id);

-- 4) Tabla de control de envíos (evita duplicados en la ventana de 2h)
create table if not exists public.match_notifications_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists idx_match_notifications_sent_match_id
  on public.match_notifications_sent (match_id);

alter table public.match_notifications_sent enable row level security;
-- Sin policies: solo el service_role (Edge Function) lee/escribe esta tabla.

-- 5) RPC: registrar/actualizar el push token del dispositivo actual
create or replace function public.fn_register_push_token(
  p_token text,
  p_platform text default null,
  p_device_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  insert into public.push_tokens (user_id, expo_push_token, platform, device_id, updated_at, last_used_at)
  values (auth.uid(), p_token, p_platform, p_device_id, now(), now())
  on conflict (expo_push_token)
  do update set
    user_id      = excluded.user_id,   -- reasigna el token si cambió de cuenta en el mismo dispositivo
    platform     = excluded.platform,
    device_id    = excluded.device_id,
    updated_at   = now(),
    last_used_at = now();
end;
$$;

revoke all on function public.fn_register_push_token(text, text, text) from public;
grant execute on function public.fn_register_push_token(text, text, text) to authenticated;

-- 6) RPC: desregistrar el token del dispositivo actual (logout)
create or replace function public.fn_unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_tokens
  where expo_push_token = p_token
    and user_id = auth.uid();
end;
$$;

revoke all on function public.fn_unregister_push_token(text) from public;
grant execute on function public.fn_unregister_push_token(text) to authenticated;

-- 7) RPC: usuarios pendientes de notificar (solo service_role)
--    Ventana de 30 min centrada en T-2h (105 a 135 min desde ahora) para
--    garantizar que, corriendo cada 15 min, cada partido caiga dentro de
--    al menos una (normalmente dos) corridas. El dedupe real lo da el
--    unique(user_id, match_id) de match_notifications_sent.
create or replace function public.fn_get_pending_match_notifications()
returns table (
  user_id uuid,
  match_id uuid,
  push_token_id uuid,
  expo_push_token text,
  favorite_team_id uuid,
  favorite_team_name text,
  opponent_name text,
  is_home boolean,
  datetime_utc timestamptz,
  competition_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    m.id as match_id,
    pt.id as push_token_id,
    pt.expo_push_token,
    u.favorite_team_id,
    ft.name as favorite_team_name,
    case when m.home_team_id = u.favorite_team_id then away.name else home.name end as opponent_name,
    (m.home_team_id = u.favorite_team_id) as is_home,
    m.datetime_utc,
    c.name as competition_name
  from public.matches m
  join public.teams home on home.id = m.home_team_id
  join public.teams away on away.id = m.away_team_id
  join public.competitions c on c.id = m.competition_id
  join public.users u
    on u.favorite_team_id in (m.home_team_id, m.away_team_id)
   and u.match_notifications_enabled = true
  join public.teams ft on ft.id = u.favorite_team_id
  join public.push_tokens pt on pt.user_id = u.id
  where m.status = 'scheduled'
    and m.datetime_utc between (now() + interval '105 minutes') and (now() + interval '135 minutes')
    and not exists (
      select 1 from public.match_notifications_sent mns
      where mns.user_id = u.id and mns.match_id = m.id
    );
$$;

revoke all on function public.fn_get_pending_match_notifications() from public;
grant execute on function public.fn_get_pending_match_notifications() to service_role;
