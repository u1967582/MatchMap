-- ============================================
-- MIGRACIÓN: Reportes de información incorrecta + reclamos de propiedad de bares
-- Fecha: 2026-08-06
-- Objetivo:
--  - Los bares sin owner_id (entrados por el equipo) son reportables por
--    cualquier usuario y reclamables por su propietario real.
--  - Arreglar el trigger de insert de `bars` para que un superusuario pueda
--    dejar owner_id en NULL (hasta ahora se forzaba siempre a auth.uid()).
-- ============================================

-- 1) Fix: permitir que un superusuario cree bares sin owner_id
create or replace function public.trg_bars_force_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() then
    -- Superusuario: respeta el owner_id que venga (NULL = bar sin propietario,
    -- entrado por el equipo). Solo garantizamos un verification_status válido.
    if new.verification_status is null then
      new.verification_status := 'pending';
    end if;
  else
    -- Usuario normal: sigue igual que antes, siempre owner de su propio bar.
    new.owner_id := auth.uid();
    new.verification_status := 'pending';
    new.verified_at := null;
    new.verified_by := null;
    new.verification_notes := null;
  end if;

  return new;
end;
$$;

drop policy if exists "bars_insert_owner_pending" on public.bars;
create policy "bars_insert_owner_pending"
on public.bars
for insert
to authenticated
with check (
  public.is_super_admin()
  or (owner_id = auth.uid() and verification_status = 'pending')
);

-- 2) Tabla bar_reports: reportar información incorrecta de un bar sin propietario
create table if not exists public.bar_reports (
  id uuid primary key default gen_random_uuid(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  reporter_id uuid not null references public.users(id),
  reason text not null check (reason in ('info_incorrecta','cerrado','ubicacion_incorrecta','fotos_incorrectas','otro')),
  message text,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  admin_notes text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.bar_reports enable row level security;

drop policy if exists "bar_reports_insert_own" on public.bar_reports;
create policy "bar_reports_insert_own"
on public.bar_reports
for insert
to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists "bar_reports_select_admin" on public.bar_reports;
create policy "bar_reports_select_admin"
on public.bar_reports
for select
to authenticated
using (public.is_super_admin());

drop policy if exists "bar_reports_update_admin" on public.bar_reports;
create policy "bar_reports_update_admin"
on public.bar_reports
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create index if not exists idx_bar_reports_status_created
  on public.bar_reports (status, created_at desc);

-- 3) Tabla bar_claims: reclamar propiedad de un bar sin owner_id
create table if not exists public.bar_claims (
  id uuid primary key default gen_random_uuid(),
  bar_id uuid not null references public.bars(id) on delete cascade,
  claimant_id uuid not null references public.users(id),
  contact_name text not null,
  contact_phone text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bar_id, claimant_id)
);

alter table public.bar_claims enable row level security;

drop policy if exists "bar_claims_insert_own" on public.bar_claims;
create policy "bar_claims_insert_own"
on public.bar_claims
for insert
to authenticated
with check (
  auth.uid() = claimant_id
  and exists (select 1 from public.bars b where b.id = bar_id and b.owner_id is null)
);

drop policy if exists "bar_claims_select_admin" on public.bar_claims;
create policy "bar_claims_select_admin"
on public.bar_claims
for select
to authenticated
using (public.is_super_admin());

drop policy if exists "bar_claims_update_admin" on public.bar_claims;
create policy "bar_claims_update_admin"
on public.bar_claims
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create index if not exists idx_bar_claims_status_created
  on public.bar_claims (status, created_at desc);

-- 4) RPC approve_bar_claim: aprueba un reclamo y sincroniza bars.owner_id + users.bar_id
create or replace function public.approve_bar_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.bar_claims;
begin
  if not public.is_super_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_claim from public.bar_claims where id = p_claim_id and status = 'pending';
  if not found then
    raise exception 'claim not found or already reviewed';
  end if;

  update public.bars
    set owner_id = v_claim.claimant_id
    where id = v_claim.bar_id and owner_id is null;

  update public.bar_claims
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_claim_id;

  update public.users
    set bar_id = v_claim.bar_id, is_bar_owner = true
    where id = v_claim.claimant_id;
end;
$$;

revoke all on function public.approve_bar_claim(uuid) from public;
grant execute on function public.approve_bar_claim(uuid) to authenticated;

-- Supabase otorga EXECUTE a anon/authenticated por defecto en funciones nuevas
-- (ALTER DEFAULT PRIVILEGES), independientemente del REVOKE FROM PUBLIC de arriba.
-- Cerramos explícitamente el acceso de anon: la función ya valida is_super_admin()
-- internamente, pero no debe ser invocable siquiera por peticiones sin sesión.
revoke execute on function public.approve_bar_claim(uuid) from anon;
