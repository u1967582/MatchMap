-- Fija search_path en funciones señaladas por el lint function_search_path_mutable.
-- Todas referencian otros esquemas con prefijo (auth.uid(), ...), así que
-- public es suficiente.
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
        'update_updated_at', 'fn_bar_ids_with_team_events', 'is_support_admin',
        'support_tickets_before_ins_upd', 'upsert_match_from_sync',
        'update_updated_at_column', 'handle_updated_at', 'fn_review_likes_inc',
        'fn_review_likes_dec', 'update_bar_rating_and_count', 'reorder_bar_images',
        'auto_create_events_for_new_match', 'handle_new_user_registration'
      )
      AND (p.proconfig IS NULL
           OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn);
  END LOOP;
END $$;
