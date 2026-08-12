-- Supabase otorga EXECUTE a anon/authenticated por defecto en funciones nuevas
-- (ALTER DEFAULT PRIVILEGES), independientemente del REVOKE FROM PUBLIC.
-- Cerramos explícitamente el acceso de anon; la función ya valida is_super_admin()
-- internamente, pero no debe ser invocable siquiera por peticiones sin sesión.
revoke execute on function public.approve_bar_claim(uuid) from anon;
revoke execute on function public.approve_bar_claim(uuid) from public;
grant execute on function public.approve_bar_claim(uuid) to authenticated;
