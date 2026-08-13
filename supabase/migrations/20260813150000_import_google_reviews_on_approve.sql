-- Añade un flag de origen a `reviews` para distinguir reseñas nativas de
-- reseñas de Google importadas desde `bar_reviews`, y copia esas reseñas a
-- `reviews` al aprobar un bar scraped (antes solo quedaban en `bar_reviews`,
-- ligadas por place_id, y nunca llegaban al perfil público del bar).

alter table public.reviews
  add column if not exists is_google_review boolean not null default false,
  add column if not exists google_author_name text,
  add column if not exists google_review_id text unique;

create or replace function public.convert_scraped_bar(
  p_scraped_id uuid,
  p_name text, p_description text, p_phone text, p_email text, p_website text,
  p_address text, p_city text, p_postal_code text,
  p_latitude double precision, p_longitude double precision,
  p_place_id text, p_image_urls text[], p_menu_urls text[],
  p_feature_ids integer[] default '{}',
  p_tv_feature_ids integer[] default '{}',
  p_food_type_ids integer[] default '{}'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_bar_id uuid; i int;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT id INTO v_bar_id FROM bars WHERE place_id = p_place_id;

  IF v_bar_id IS NOT NULL THEN
    UPDATE bars SET
      name = p_name, description = p_description, phone = p_phone, email = p_email,
      website = p_website, address = p_address, city = p_city, postal_code = p_postal_code,
      latitude = p_latitude, longitude = p_longitude,
      verification_status = 'approved', is_active = true,
      verified_at = now(), verified_by = auth.uid()
    WHERE id = v_bar_id;

    DELETE FROM bar_images WHERE bar_id = v_bar_id;
    DELETE FROM bar_menus WHERE bar_id = v_bar_id;
  ELSE
    INSERT INTO bars (name, description, phone, email, website, address, city, postal_code,
      latitude, longitude, place_id, verification_status, is_active, verified_at, verified_by, owner_id)
    VALUES (p_name, p_description, p_phone, p_email, p_website, p_address, p_city, p_postal_code,
      p_latitude, p_longitude, p_place_id, 'approved', true, now(), auth.uid(), NULL)
    RETURNING id INTO v_bar_id;
  END IF;

  IF p_image_urls IS NOT NULL THEN
    FOR i IN 1..COALESCE(array_length(p_image_urls, 1), 0) LOOP
      INSERT INTO bar_images (bar_id, image_url, image_order) VALUES (v_bar_id, p_image_urls[i], i);
    END LOOP;
  END IF;

  IF p_menu_urls IS NOT NULL THEN
    FOR i IN 1..COALESCE(array_length(p_menu_urls, 1), 0) LOOP
      INSERT INTO bar_menus (bar_id, image_url, image_order) VALUES (v_bar_id, p_menu_urls[i], i);
    END LOOP;
  END IF;

  DELETE FROM bar_selected_features WHERE bar_id = v_bar_id;
  DELETE FROM bar_selected_tv_features WHERE bar_id = v_bar_id;
  DELETE FROM bar_food_types WHERE bar_id = v_bar_id;

  IF p_feature_ids IS NOT NULL AND array_length(p_feature_ids, 1) > 0 THEN
    INSERT INTO bar_selected_features (bar_id, feature_id)
      SELECT v_bar_id, unnest(p_feature_ids);
  END IF;

  IF p_tv_feature_ids IS NOT NULL AND array_length(p_tv_feature_ids, 1) > 0 THEN
    INSERT INTO bar_selected_tv_features (bar_id, tv_feature_id)
      SELECT v_bar_id, unnest(p_tv_feature_ids);
  END IF;

  IF p_food_type_ids IS NOT NULL AND array_length(p_food_type_ids, 1) > 0 THEN
    INSERT INTO bar_food_types (bar_id, food_type_id)
      SELECT v_bar_id, unnest(p_food_type_ids);
  END IF;

  -- Copiar las reseñas de Google del candidato a `reviews`, marcadas con
  -- is_google_review para que el perfil público las distinga de las
  -- nativas. Se descartan las que no traen rating (reviews.rating es
  -- NOT NULL) y se usa ON CONFLICT sobre google_review_id para que
  -- re-aprobar el mismo place_id no las duplique.
  INSERT INTO reviews (bar_id, user_id, rating, comment, created_at, likes, is_google_review, google_author_name, google_review_id)
  SELECT v_bar_id, NULL, br.rating, br.review_text, COALESCE(br.review_date, br.created_at), 0, true, br.author_name, br.review_id
  FROM bar_reviews br
  WHERE br.place_id = p_place_id
    AND br.rating IS NOT NULL
  ON CONFLICT (google_review_id) DO NOTHING;

  UPDATE bars_scraped
  SET status = 'converted', converted_bar_id = v_bar_id, reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_scraped_id;

  RETURN v_bar_id;
END;
$$;
