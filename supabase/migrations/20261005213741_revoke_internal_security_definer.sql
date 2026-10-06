-- Cierra funciones SECURITY DEFINER internas que eran ejecutables vía
-- /rest/v1/rpc por anon y authenticated sin ninguna comprobación de permisos.
--
-- Ninguna de ellas se llama desde la app: solo las usan edge functions con
-- service_role o triggers/funciones SECURITY DEFINER (que se ejecutan como su
-- owner), así que revocar el EXECUTE de los roles públicos no rompe nada.
--
--   fn_get_pending_match_notifications → devolvía push tokens de todos los usuarios
--   handle_new_user_registration       → permitía sobrescribir el perfil de cualquier usuario
--   promote_pre_registered_bar         → permitía asignarse cualquier bar pre-registrado
--   upsert_match_from_sync             → permitía crear/modificar partidos
--   fn_backfill_events_for_range       → permitía generar eventos masivamente
--   fn_autocreate_events_for_match     → ídem para un partido
--   refresh_bar_rating                 → recalculo de rating, solo lo usa un trigger

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fn_get_pending_match_notifications',
        'handle_new_user_registration',
        'promote_pre_registered_bar',
        'upsert_match_from_sync',
        'fn_backfill_events_for_range',
        'fn_autocreate_events_for_match',
        'refresh_bar_rating'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- Vista sobrante del módulo de bufandas: que respete el RLS de quien consulta
-- en lugar del de su creador (lint security_definer_view).
DO $$
BEGIN
  IF to_regclass('public.bar_scarf_stats') IS NOT NULL THEN
    ALTER VIEW public.bar_scarf_stats SET (security_invoker = true);
  END IF;
END $$;
