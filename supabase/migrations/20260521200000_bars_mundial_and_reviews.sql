-- ── Tabla principal de bares (pipeline de datos) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.bars_mundial (
    id              UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    place_id        TEXT            UNIQUE NOT NULL,
    name            TEXT            NOT NULL,
    address         TEXT,
    city            TEXT,
    postal_code     TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    phone           TEXT,
    email           TEXT,
    website         TEXT,
    google_maps_url TEXT,
    instagram       TEXT,
    facebook        TEXT,
    twitter         TEXT,
    tiktok          TEXT,
    rating          DECIMAL(3, 1),
    image_urls      TEXT[]          DEFAULT '{}',
    carta_urls      TEXT[]          DEFAULT '{}',
    description     TEXT,
    confidence      TEXT            CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
    created_at      TIMESTAMPTZ     DEFAULT now(),
    updated_at      TIMESTAMPTZ     DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bars_mundial_city       ON public.bars_mundial (city);
CREATE INDEX IF NOT EXISTS bars_mundial_geo        ON public.bars_mundial (latitude, longitude);
CREATE INDEX IF NOT EXISTS bars_mundial_confidence ON public.bars_mundial (confidence);

ALTER TABLE public.bars_mundial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bars_mundial_public_read"
    ON public.bars_mundial FOR SELECT
    USING (true);

CREATE POLICY "bars_mundial_service_write"
    ON public.bars_mundial FOR ALL
    USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER bars_mundial_updated_at
    BEFORE UPDATE ON public.bars_mundial
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Tabla de reseñas destacadas ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bar_reviews (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    place_id     TEXT        NOT NULL REFERENCES public.bars_mundial(place_id) ON DELETE CASCADE,
    review_id    TEXT        UNIQUE,
    author_name  TEXT,
    rating       INTEGER     CHECK (rating BETWEEN 1 AND 5),
    review_text  TEXT,
    review_date  TIMESTAMPTZ,
    owner_answer TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bar_reviews_place_id ON public.bar_reviews (place_id);

ALTER TABLE public.bar_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bar_reviews_public_read"
    ON public.bar_reviews FOR SELECT
    USING (true);

CREATE POLICY "bar_reviews_service_write"
    ON public.bar_reviews FOR ALL
    USING (auth.role() = 'service_role');
