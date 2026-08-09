-- ============================================================
-- Fix: escalado de privilegios en public.users
-- ============================================================
-- Las policies de UPDATE en public.users solo comprobaban
-- auth.uid() = id, sin restringir columnas, y el GRANT UPDATE a
-- `authenticated` es sobre la tabla completa. Cualquier usuario
-- autenticado podía hacer:
--   PATCH /rest/v1/users?id=eq.<su-uuid>  { "is_super_user": true }
-- y pasar la RLS sin problema, convirtiéndose en super admin (acceso a
-- fn_admin_gift_boost, approve_bar_claim, moderación de bar_reports,
-- fn_sync_bar_preferences_admin...). También podía cambiar su bar_id a
-- cualquier bar existente para que el trigger set_is_bar_owner_on_users
-- le marcara is_bar_owner = true sin pasar por approve_bar_claim.
--
-- Fix: trigger BEFORE UPDATE que revierte is_super_user/bar_id/
-- is_bar_owner a su valor anterior salvo que quien actualice ya sea
-- super admin o sea el service_role. Mismo patrón que
-- trg_bars_force_pending usa para bars.owner_id.
-- ============================================================

create or replace function public.trg_users_protect_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_super_admin() then
    return new;
  end if;

  if new.is_super_user is distinct from old.is_super_user then
    new.is_super_user := old.is_super_user;
  end if;

  if new.bar_id is distinct from old.bar_id then
    new.bar_id := old.bar_id;
  end if;

  if new.is_bar_owner is distinct from old.is_bar_owner then
    new.is_bar_owner := old.is_bar_owner;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_protect_privileged_columns on public.users;
create trigger trg_users_protect_privileged_columns
  before update on public.users
  for each row
  execute function public.trg_users_protect_privileged_columns();

comment on function public.trg_users_protect_privileged_columns() is
'Bloquea que un usuario normal se auto-otorgue is_super_user/bar_id/is_bar_owner vía UPDATE directo. Solo super admins (is_super_admin()) o el service_role pueden cambiar estas columnas.';
