-- ============================================
-- MIGRACIÓN: Reportar reseñas y bloquear usuarios (App Store 1.2)
-- Fecha: 2026-10-15 · Auditoría área 03 (flujos de usuario)
--
-- Apple 1.2 (contenido generado por usuarios) exige poder reportar contenido
-- ofensivo, bloquear a usuarios abusivos y que el equipo actúe sobre los
-- reportes. Hasta ahora solo existía reportar un bar (bar_reports).
--
--  - review_reports: un usuario registrado (no invitado) reporta una reseña.
--    Un trigger guarda una copia del texto, el autor y el bar para que el
--    reporte siga teniendo contexto aunque la reseña se borre. El reportante
--    solo ve sus propios reportes (para ocultarle la reseña); los super admin
--    ven y gestionan todos.
--  - admin_resolve_review_report(): el super admin elimina la reseña
--    reportada o descarta el reporte desde la app.
--  - user_blocks: un usuario oculta las reseñas de otro. Cada usuario solo ve
--    y gestiona sus propios bloqueos.
--
-- Idempotente (IF NOT EXISTS / DROP ... IF EXISTS / CREATE OR REPLACE).
-- Solo crea objetos nuevos: no modifica ni depende de políticas existentes
-- (las legacy que borra el área 01 no se usan aquí). Usa public.is_super_admin()
-- (20251223170000_bar_verification.sql).
-- Las FKs con ON DELETE CASCADE / SET NULL hacen que delete_user_data
-- (borrado de cuenta) no necesite cambios.
-- ============================================

-- 1) Reportes de reseñas
create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  -- SET NULL: si se elimina la reseña, el reporte queda como histórico
  review_id uuid references public.reviews(id) on delete set null,
  reporter_id uuid not null references public.users(id) on delete cascade,
  -- Copia de contexto (la rellena el trigger, el cliente no puede falsearla)
  review_author_id uuid references public.users(id) on delete set null,
  bar_id uuid references public.bars(id) on delete set null,
  review_comment text,
  reason text not null,
  message text,
  status text not null default 'pending',
  admin_notes text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint review_reports_reason_check check (reason in (
    'ofensivo',
    'acoso',
    'spam',
    'falso',
    'datos_personales',
    'otro'
  )),
  constraint review_reports_status_check check (status in ('pending', 'reviewed', 'dismissed')),
  constraint review_reports_message_length check (message is null or char_length(message) <= 500),
  constraint review_reports_unique_reporter unique (review_id, reporter_id)
);

alter table public.review_reports enable row level security;

-- Trigger: rellena el contexto desde la reseña y fuerza el estado inicial
create or replace function public.trg_review_reports_fill_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select r.user_id, r.bar_id, r.comment
    into new.review_author_id, new.bar_id, new.review_comment
  from public.reviews r
  where r.id = new.review_id;

  if not found then
    raise exception 'review not found' using errcode = 'P0002';
  end if;

  new.status := 'pending';
  new.admin_notes := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.trg_review_reports_fill_context() from public, anon, authenticated;

drop trigger if exists review_reports_fill_context on public.review_reports;
create trigger review_reports_fill_context
before insert on public.review_reports
for each row execute function public.trg_review_reports_fill_context();

drop policy if exists "review_reports_insert_own" on public.review_reports;
create policy "review_reports_insert_own"
on public.review_reports
for insert
to authenticated
with check (
  reporter_id = (select auth.uid())
  and review_id is not null
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "review_reports_select_own_or_admin" on public.review_reports;
-- Nombre antiguo del WIP, por si se llegó a aplicar en algún entorno
drop policy if exists "review_reports_select_admin" on public.review_reports;
create policy "review_reports_select_own_or_admin"
on public.review_reports
for select
to authenticated
using (
  reporter_id = (select auth.uid())
  or (select public.is_super_admin())
);

drop policy if exists "review_reports_update_admin" on public.review_reports;
create policy "review_reports_update_admin"
on public.review_reports
for update
to authenticated
using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

create index if not exists idx_review_reports_status_created
  on public.review_reports (status, created_at desc);

create index if not exists idx_review_reports_reporter
  on public.review_reports (reporter_id);

create index if not exists idx_review_reports_reviewed_by
  on public.review_reports (reviewed_by);

create index if not exists idx_review_reports_review_author
  on public.review_reports (review_author_id);

create index if not exists idx_review_reports_bar
  on public.review_reports (bar_id);

-- 2) Resolver un reporte (solo super admin)
--    p_action = 'remove_review': borra la reseña y marca como revisados todos
--                                los reportes pendientes de esa reseña.
--    p_action = 'dismiss':       descarta este reporte (la reseña se queda).
create or replace function public.admin_resolve_review_report(
  p_report_id uuid,
  p_action text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_action not in ('remove_review', 'dismiss') then
    raise exception 'invalid action %', p_action using errcode = '22023';
  end if;

  select review_id into v_review_id
  from public.review_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if p_action = 'dismiss' then
    update public.review_reports
       set status = 'dismissed',
           admin_notes = p_notes,
           reviewed_by = auth.uid(),
           reviewed_at = now()
     where id = p_report_id;
    return;
  end if;

  -- remove_review
  update public.review_reports
     set status = 'reviewed',
         admin_notes = coalesce(p_notes, admin_notes),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_report_id
      or (v_review_id is not null and review_id = v_review_id and status = 'pending');

  if v_review_id is not null then
    -- review_likes caen en cascada; el rating del bar lo recalcula el trigger de reviews
    delete from public.reviews where id = v_review_id;
  end if;
end;
$$;

revoke all on function public.admin_resolve_review_report(uuid, text, text) from public, anon;
grant execute on function public.admin_resolve_review_report(uuid, text, text) to authenticated;

-- 3) Bloqueos entre usuarios
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks_select_own" on public.user_blocks;
create policy "user_blocks_select_own"
on public.user_blocks
for select
to authenticated
using (blocker_id = (select auth.uid()));

drop policy if exists "user_blocks_insert_own" on public.user_blocks;
create policy "user_blocks_insert_own"
on public.user_blocks
for insert
to authenticated
with check (
  blocker_id = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists "user_blocks_delete_own" on public.user_blocks;
create policy "user_blocks_delete_own"
on public.user_blocks
for delete
to authenticated
using (blocker_id = (select auth.uid()));

create index if not exists idx_user_blocks_blocked
  on public.user_blocks (blocked_id);

-- 4) Privilegios: anon sin acceso; authenticated solo lo que usan las políticas
revoke all on public.review_reports from anon;
revoke all on public.user_blocks from anon;
revoke all on public.review_reports from authenticated;
revoke all on public.user_blocks from authenticated;
grant select, insert, update on public.review_reports to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
