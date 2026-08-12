-- La migración bars_scraped_review_v2 (20260807140555) cambió la firma de
-- convert_scraped_bar añadiendo p_feature_ids/p_tv_feature_ids/p_food_type_ids.
-- Al ser una firma distinta, CREATE OR REPLACE creó un overload nuevo en vez
-- de sustituir la función original de 14 argumentos, que quedó huérfana
-- (ningún caller la invoca ya, siempre se llama con los 3 parámetros nuevos).
DROP FUNCTION IF EXISTS public.convert_scraped_bar(
  uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, text, text[], text[]
);
