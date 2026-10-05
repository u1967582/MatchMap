-- Los privilegios por defecto del proyecto conceden EXECUTE en funciones
-- nuevas del schema public a anon/authenticated; "revoke all ... from
-- public" en la migración anterior no revoca lo ya concedido a "anon"
-- específicamente. Ambas RPC ya bloquean la llamada si auth.uid() es
-- null, pero se revoca explícitamente a "anon" como defensa en profundidad
-- (detectado por el advisor de seguridad de Supabase).
revoke execute on function public.fn_track_bar_event(uuid, text) from anon;
revoke execute on function public.fn_track_bar_proximity(uuid) from anon;
