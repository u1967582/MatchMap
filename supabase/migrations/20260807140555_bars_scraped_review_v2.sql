-- Segunda iteración de la cola de revisión de bars_scraped:
-- - rank numérico de confidence + índice para ordenar/paginar rápido
-- - columnas para preseleccionar características antes de aprobar
-- - convert_scraped_bar hace upsert por place_id (evita duplicar bares al
--   re-aprobar un candidato que ya se había convertido antes) y traslada
--   las características elegidas
-- - RPC para que un admin pueda borrar una reseña de Google incorrecta
-- - reset de todos los candidatos a 'pending' para volver a empezar la cola

-- 1) Rank de confidence + índice de performance para la cola de revisión
alter table public.bars_scraped
  add column confidence_rank smallint generated always as (
    case upper(coalesce(confidence, ''))
      when 'HIGH' then 3
      when 'MEDIUM' then 2
      when 'LOW' then 1
      else 0
    end
  ) stored;

create index if not exists idx_bars_scraped_status_confidence_created
  on public.bars_scraped (status, confidence_rank desc, created_at desc);

-- 2) Características preseleccionadas por el admin antes de aprobar
alter table public.bars_scraped
  add column selected_feature_ids integer[] not null default '{}',
  add column selected_tv_feature_ids integer[] not null default '{}',
  add column selected_food_type_ids integer[] not null default '{}';

-- 3) convert_scraped_bar: upsert por place_id + traslado de características
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
    FOR i IN 1..array_length(p_image_urls, 1) LOOP
      INSERT INTO bar_images (bar_id, image_url, image_order) VALUES (v_bar_id, p_image_urls[i], i);
    END LOOP;
  END IF;

  IF p_menu_urls IS NOT NULL THEN
    FOR i IN 1..array_length(p_menu_urls, 1) LOOP
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

  UPDATE bars_scraped
  SET status = 'converted', converted_bar_id = v_bar_id, reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_scraped_id;

  RETURN v_bar_id;
END;
$$;

-- 4) RPC para que un admin borre una reseña de Google incorrecta
create index if not exists idx_bar_reviews_place_id on public.bar_reviews (place_id);

create or replace function public.admin_delete_bar_review(p_review_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.bar_reviews where id = p_review_id;
end;
$$;

-- 5) Reset: todos los candidatos vuelven a la cola de revisión.
-- Los bares reales ya creados a partir de candidatos 'converted' NO se tocan
-- ni se borran; convert_scraped_bar ya hace upsert por place_id así que si
-- se vuelven a aprobar, se actualiza el bar existente en vez de duplicarlo.
update public.bars_scraped
set status = 'pending',
    verification_notes = null,
    reviewed_at = null,
    reviewed_by = null,
    converted_bar_id = null;
