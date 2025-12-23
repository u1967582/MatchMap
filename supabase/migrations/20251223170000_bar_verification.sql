-- ============================================
-- MIGRACIÓN: Verificación de bares (pending/approved/rejected)
-- Fecha: 2025-12-23
-- Objetivo:
--  - Un bar nuevo queda en 'pending' y NO es visible para usuarios normales
--  - El owner SI puede ver su bar aunque esté pending/rejected
--  - Un superusuario/admin puede ver todo y aprobar/rechazar
-- ============================================

-- 1) Columnas + constraint
alter table public.bars
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verified_at timestamptz null,
  add column if not exists verified_by uuid null,
  add column if not exists verification_notes text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bars_verification_status_check'
  ) then
    alter table public.bars
      add constraint bars_verification_status_check
      check (verification_status in ('pending','approved','rejected'));
  end if;
end $$;

-- FK para verified_by (public.users si existe; fallback auth.users)
do $$
begin
  if to_regclass('public.users') is not null then
    if not exists (
      select 1 from pg_constraint where conname = 'bars_verified_by_fkey'
    ) then
      alter table public.bars
        add constraint bars_verified_by_fkey
        foreign key (verified_by) references public.users(id) on delete set null;
    end if;
  else
    if not exists (
      select 1 from pg_constraint where conname = 'bars_verified_by_fkey'
    ) then
      alter table public.bars
        add constraint bars_verified_by_fkey
        foreign key (verified_by) references auth.users(id) on delete set null;
    end if;
  end if;
end $$;

-- 2) Helper: admin/super user
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.is_super_user
     from public.users u
     where u.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

-- 3) RLS en bars + policies
alter table public.bars enable row level security;

-- Eliminar policies previas (incluida la política permisiva del boost)
drop policy if exists "Allow all authenticated users to view bars" on public.bars;
drop policy if exists "Enable read access for authenticated users" on public.bars;

-- SELECT:
--  - Admin: todo
--  - Owner: su bar (aunque pending/rejected)
--  - Usuario normal: solo approved
create policy "bars_select_owner_admin_or_approved"
on public.bars
for select
to authenticated
using (
  public.is_super_admin()
  or owner_id = auth.uid()
  or verification_status = 'approved'
);

-- INSERT:
--  - Solo owner (authenticated)
--  - owner_id = auth.uid()
--  - verification_status = pending (forzado por trigger)
drop policy if exists "bars_insert_owner_pending" on public.bars;
create policy "bars_insert_owner_pending"
on public.bars
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and verification_status = 'pending'
);

-- UPDATE:
--  - Owner puede actualizar PERO NO cambiar verification_status
--  - Admin puede actualizar todo
drop policy if exists "bars_update_owner_no_status_change" on public.bars;
create policy "bars_update_owner_no_status_change"
on public.bars
for update
to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and verification_status = (
    select b.verification_status from public.bars b where b.id = public.bars.id
  )
);

drop policy if exists "bars_update_admin_all" on public.bars;
create policy "bars_update_admin_all"
on public.bars
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- DELETE (opcional): solo admin
drop policy if exists "bars_delete_admin" on public.bars;
create policy "bars_delete_admin"
on public.bars
for delete
to authenticated
using (public.is_super_admin());

-- 4) Trigger recomendado: forzar pending en INSERT + owner_id
create or replace function public.trg_bars_force_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- owner_id siempre el usuario autenticado
  new.owner_id := auth.uid();

  -- estado siempre pending al crear
  new.verification_status := 'pending';
  new.verified_at := null;
  new.verified_by := null;
  new.verification_notes := null;

  return new;
end;
$$;

drop trigger if exists bars_force_pending_before_insert on public.bars;
create trigger bars_force_pending_before_insert
before insert on public.bars
for each row
execute function public.trg_bars_force_pending();

-- 5) Índices
create index if not exists idx_bars_verification_status_created_at
  on public.bars (verification_status, created_at desc);

create index if not exists idx_bars_owner_id
  on public.bars (owner_id);

-- 6) Ajustes mínimos recomendados en tablas relacionadas (si existen)
-- 6.1) reviews: evitar leer/crear reviews de bares no approved (salvo owner/admin)
do $$
begin
  if to_regclass('public.reviews') is not null then
    -- SELECT
    execute 'drop policy if exists "Users can read all reviews" on public.reviews';
    execute $pol$
      create policy "reviews_select_only_when_bar_visible"
      on public.reviews
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.bars b
          where b.id = reviews.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid() or b.verification_status = 'approved')
        )
      )
    $pol$;

    -- INSERT
    execute 'drop policy if exists "Users can insert their own reviews" on public.reviews';
    execute $pol$
      create policy "reviews_insert_only_for_approved_bars"
      on public.reviews
      for insert
      to authenticated
      with check (
        auth.uid() = user_id
        and exists (
          select 1 from public.bars b
          where b.id = reviews.bar_id
            and b.verification_status = 'approved'
        )
      )
    $pol$;

    -- UPDATE
    execute 'drop policy if exists "Users can update their own reviews" on public.reviews';
    execute $pol$
      create policy "reviews_update_own_only_when_bar_visible"
      on public.reviews
      for update
      to authenticated
      using (
        auth.uid() = user_id
        and exists (
          select 1
          from public.bars b
          where b.id = reviews.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid() or b.verification_status = 'approved')
        )
      )
      with check (auth.uid() = user_id)
    $pol$;

    -- DELETE
    execute 'drop policy if exists "Users can delete their own reviews" on public.reviews';
    execute $pol$
      create policy "reviews_delete_own_only_when_bar_visible"
      on public.reviews
      for delete
      to authenticated
      using (
        auth.uid() = user_id
        and exists (
          select 1
          from public.bars b
          where b.id = reviews.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid() or b.verification_status = 'approved')
        )
      )
    $pol$;
  end if;
end $$;

-- 6.2) bar_images: evitar exponer imágenes de bares no approved (salvo owner/admin)
do $$
begin
  if to_regclass('public.bar_images') is not null then
    execute 'alter table public.bar_images enable row level security';

    execute 'drop policy if exists "bar_images_select_visible_bar" on public.bar_images';
    execute $pol$
      create policy "bar_images_select_visible_bar"
      on public.bar_images
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.bars b
          where b.id = bar_images.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid() or b.verification_status = 'approved')
        )
      )
    $pol$;

    execute 'drop policy if exists "bar_images_insert_owner" on public.bar_images';
    execute $pol$
      create policy "bar_images_insert_owner"
      on public.bar_images
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.bars b
          where b.id = bar_images.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid())
        )
      )
    $pol$;

    execute 'drop policy if exists "bar_images_update_owner" on public.bar_images';
    execute $pol$
      create policy "bar_images_update_owner"
      on public.bar_images
      for update
      to authenticated
      using (
        exists (
          select 1 from public.bars b
          where b.id = bar_images.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid())
        )
      )
      with check (
        exists (
          select 1 from public.bars b
          where b.id = bar_images.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid())
        )
      )
    $pol$;

    execute 'drop policy if exists "bar_images_delete_owner" on public.bar_images';
    execute $pol$
      create policy "bar_images_delete_owner"
      on public.bar_images
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.bars b
          where b.id = bar_images.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid())
        )
      )
    $pol$;
  end if;
end $$;

-- 6.3) bar_menus: mismas reglas que bar_images (si existe la tabla)
do $$
begin
  if to_regclass('public.bar_menus') is not null then
    execute 'alter table public.bar_menus enable row level security';

    execute 'drop policy if exists "bar_menus_select_visible_bar" on public.bar_menus';
    execute $pol$
      create policy "bar_menus_select_visible_bar"
      on public.bar_menus
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.bars b
          where b.id = bar_menus.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid() or b.verification_status = 'approved')
        )
      )
    $pol$;

    execute 'drop policy if exists "bar_menus_insert_owner" on public.bar_menus';
    execute $pol$
      create policy "bar_menus_insert_owner"
      on public.bar_menus
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.bars b
          where b.id = bar_menus.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid())
        )
      )
    $pol$;

    execute 'drop policy if exists "bar_menus_update_owner" on public.bar_menus';
    execute $pol$
      create policy "bar_menus_update_owner"
      on public.bar_menus
      for update
      to authenticated
      using (
        exists (
          select 1 from public.bars b
          where b.id = bar_menus.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid())
        )
      )
      with check (
        exists (
          select 1 from public.bars b
          where b.id = bar_menus.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid())
        )
      )
    $pol$;

    execute 'drop policy if exists "bar_menus_delete_owner" on public.bar_menus';
    execute $pol$
      create policy "bar_menus_delete_owner"
      on public.bar_menus
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.bars b
          where b.id = bar_menus.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid())
        )
      )
    $pol$;
  end if;
end $$;

-- 6.4) favorites: evitar favoritos sobre bares no approved (si existe la tabla)
do $$
begin
  if to_regclass('public.favorites') is not null then
    execute 'alter table public.favorites enable row level security';

    execute 'drop policy if exists "favorites_select_own_only_when_bar_visible" on public.favorites';
    execute $pol$
      create policy "favorites_select_own_only_when_bar_visible"
      on public.favorites
      for select
      to authenticated
      using (
        user_id = auth.uid()
        and exists (
          select 1
          from public.bars b
          where b.id = favorites.bar_id
            and (public.is_super_admin() or b.owner_id = auth.uid() or b.verification_status = 'approved')
        )
      )
    $pol$;

    execute 'drop policy if exists "favorites_insert_only_for_approved_bars" on public.favorites';
    execute $pol$
      create policy "favorites_insert_only_for_approved_bars"
      on public.favorites
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and exists (
          select 1 from public.bars b
          where b.id = favorites.bar_id
            and b.verification_status = 'approved'
        )
      )
    $pol$;

    execute 'drop policy if exists "favorites_delete_own" on public.favorites';
    execute $pol$
      create policy "favorites_delete_own"
      on public.favorites
      for delete
      to authenticated
      using (user_id = auth.uid())
    $pol$;
  end if;
end $$;


