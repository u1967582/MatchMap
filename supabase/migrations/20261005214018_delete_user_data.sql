-- Borrado de datos de un usuario en una única transacción, usado por la edge
-- function delete-user-account antes de eliminar el usuario de auth.
--
-- Resuelve las FKs con ON DELETE NO ACTION que hacían fallar el borrado de
-- cuenta (bar_claims, bar_reports, support_tickets, bar_boosts, ...) y los
-- bares convertidos desde bars_scraped / auto_pre_register_bars.
--
-- Devuelve los ids de los bares eliminados para que la edge function limpie
-- sus imágenes del storage.

CREATE OR REPLACE FUNCTION public.delete_user_data(p_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bar_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO v_bar_ids
  FROM public.bars
  WHERE owner_id = p_user_id;

  -- 1) Bares del usuario
  IF array_length(v_bar_ids, 1) > 0 THEN
    UPDATE public.bars_scraped SET converted_bar_id = NULL WHERE converted_bar_id = ANY (v_bar_ids);
    UPDATE public.auto_pre_register_bars SET converted_bar_id = NULL WHERE converted_bar_id = ANY (v_bar_ids);
    DELETE FROM public.bar_images WHERE bar_id = ANY (v_bar_ids);
    -- El resto de tablas hijas de bars tienen ON DELETE CASCADE
    DELETE FROM public.bars WHERE id = ANY (v_bar_ids);
  END IF;

  -- 2) Contenido propio del usuario
  DELETE FROM public.reviews WHERE user_id = p_user_id;
  DELETE FROM public.bar_claims WHERE claimant_id = p_user_id;
  DELETE FROM public.bar_reports WHERE reporter_id = p_user_id;
  DELETE FROM public.support_tickets WHERE user_id = p_user_id;

  -- 3) Referencias en registros que deben conservarse (pagos, moderación)
  UPDATE public.bar_boosts SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.boost_payments SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.bar_claims SET reviewed_by = NULL WHERE reviewed_by = p_user_id;
  UPDATE public.bar_reports SET reviewed_by = NULL WHERE reviewed_by = p_user_id;
  UPDATE public.bar_requests SET reviewed_by = NULL WHERE reviewed_by = p_user_id;
  UPDATE public.bars_scraped SET reviewed_by = NULL WHERE reviewed_by = p_user_id;
  UPDATE public.auto_pre_register_bars SET created_by_user_id = NULL WHERE created_by_user_id = p_user_id;

  -- 4) Perfil (favorites, review_likes, push_tokens, ... caen en cascada)
  DELETE FROM public.users WHERE id = p_user_id;

  RETURN v_bar_ids;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(uuid) TO service_role;
