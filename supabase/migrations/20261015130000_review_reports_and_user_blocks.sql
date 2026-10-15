-- ============================================
-- MIGRACIÓN: Reportar reseñas y bloquear usuarios (App Store 1.2)
-- Fecha: 2026-10-15 · Auditoría área 03 (flujos de usuario)
--
-- Apple 1.2 (contenido generado por usuarios) exige poder reportar contenido
-- ofensivo y bloquear a usuarios abusivos. Hasta ahora solo existía reportar
-- un bar (bar_reports).
--
--  - review_reports: un usuario registrado reporta una reseña. Solo los
--    super admin pueden leerlos y gestionarlos (mismo patrón que bar_reports).
--  - user_blocks: un usuario oculta las reseñas de otro. Cada usuario solo ve
--    y gestiona sus propios bloqueos.
--
-- Solo crea tablas y políticas nuevas: no modifica políticas existentes.
-- Las FKs con ON DELETE CASCADE / SET NULL hacen que delete_user_data
-- (borrado de cuenta) no necesite cambios.
-- ============================================

-- 1) Reportes de reseñas
create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
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

drop policy if exists "review_reports_insert_own" on public.review_reports;
create policy "review_reports_insert_own"
on public.review_reports
for insert
to authenticated
with check (
  reporter_id = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and admin_notes is null
);

drop policy if exists "review_reports_select_admin" on public.review_reports;
create policy "review_reports_select_admin"
on public.review_reports
for select
to authenticated
using (public.is_super_admin());

drop policy if exists "review_reports_update_admin" on public.review_reports;
create policy "review_reports_update_admin"
on public.review_reports
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create index if not exists idx_review_reports_status_created
  on public.review_reports (status, created_at desc);

create index if not exists idx_review_reports_reporter
  on public.review_reports (reporter_id);

create index if not exists idx_review_reports_reviewed_by
  on public.review_reports (reviewed_by);

-- 2) Bloqueos entre usuarios
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

-- Sin acceso para anon (defensa en profundidad)
revoke all on public.review_reports from anon;
revoke all on public.user_blocks from anon;
