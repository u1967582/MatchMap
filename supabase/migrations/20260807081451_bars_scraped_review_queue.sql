-- Convierte bars_mundial en una cola de revisión de admin (bars_scraped):
-- añade estado de revisión, deja de ser pública, y añade la función que
-- copia un candidato aprobado a la tabla real `bars`.

ALTER TABLE bars_mundial RENAME TO bars_scraped;

ALTER TABLE bars_scraped
  ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rejected', 'converted')),
  ADD COLUMN verification_notes text,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid REFERENCES public.users(id),
  ADD COLUMN converted_bar_id uuid REFERENCES public.bars(id);

-- Backfill: candidatos cuyo place_id ya coincide con un bar real existente
-- se marcan como ya convertidos para que no aparezcan en la cola nueva.
UPDATE bars_scraped bs
SET status = 'converted', converted_bar_id = b.id
FROM bars b
WHERE b.place_id = bs.place_id;

DROP POLICY IF EXISTS bars_mundial_public_read ON bars_scraped;

CREATE POLICY bars_scraped_select_admin ON bars_scraped
  FOR SELECT TO authenticated
  USING (is_super_admin());

CREATE POLICY bars_scraped_update_admin ON bars_scraped
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY bars_scraped_delete_admin ON bars_scraped
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- Copia atómica de un candidato scraped aprobado a la tabla `bars`.
CREATE OR REPLACE FUNCTION public.convert_scraped_bar(
  p_scraped_id uuid,
  p_name text,
  p_description text,
  p_phone text,
  p_email text,
  p_website text,
  p_address text,
  p_city text,
  p_postal_code text,
  p_latitude double precision,
  p_longitude double precision,
  p_place_id text,
  p_image_urls text[],
  p_menu_urls text[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bar_id uuid;
  i int;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO bars (
    name, description, phone, email, website, address, city, postal_code,
    latitude, longitude, place_id, verification_status, is_active,
    verified_at, verified_by, owner_id
  )
  VALUES (
    p_name, p_description, p_phone, p_email, p_website, p_address, p_city, p_postal_code,
    p_latitude, p_longitude, p_place_id, 'approved', true,
    now(), auth.uid(), NULL
  )
  RETURNING id INTO v_bar_id;

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

  UPDATE bars_scraped
  SET status = 'converted', converted_bar_id = v_bar_id, reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_scraped_id;

  RETURN v_bar_id;
END;
$$;
