-- ============================================
-- MIGRACIÓN: Arreglar triggers "fantasma" de bars que no estaban versionados
-- Fecha: 2026-08-13
-- Contexto:
--   Se detectaron 2 triggers en public.bars creados directamente en la BD
--   (fuera de supabase/migrations/), que pisaban el owner_id/bar_id que
--   convert_scraped_bar() y trg_bars_force_pending() dejan correctamente
--   en NULL para bares sin propietario:
--     - trg_set_owner_on_bars (set_owner_on_bars()): si owner_id venía NULL
--       lo forzaba a auth.uid(), incluso cuando el admin lo dejaba NULL
--       a propósito al aprobar un bar scraped. Es redundante con
--       trg_bars_force_pending, que ya asigna owner_id := auth.uid() para
--       usuarios normales y respeta NULL para superadmins.
--     - assign_bar_to_user_trigger (assign_bar_to_user()): tras cada INSERT
--       en bars, sobreescribía users.bar_id de quien insertó con el bar
--       recién creado, sin comprobar que ese bar fuera realmente suyo. Un
--       admin aprobando bares de terceros veía su propio bar_id contaminado.
-- ============================================

-- 1) Eliminar el trigger/función redundante y dañina
drop trigger if exists trg_set_owner_on_bars on public.bars;
drop function if exists public.set_owner_on_bars();

-- 2) Arreglar assign_bar_to_user: solo vincular el bar al usuario si el
--    bar insertado le pertenece realmente (owner_id = quien insertó).
create or replace function public.assign_bar_to_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.owner_id is not null and new.owner_id = auth.uid() then
    update public.users
    set bar_id = new.id
    where id = auth.uid();
  end if;

  return new;
end;
$function$;
