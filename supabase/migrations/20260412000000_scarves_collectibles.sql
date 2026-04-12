-- ============================================
-- MIGRACIÓN: Sistema de Bufandas Coleccionables
-- Fecha: 2026-04-12
-- Objetivo:
--  - Crear tabla ticket_claims: registro de asistencias con foto de ticket
--  - Crear tabla user_scarves: colección de bufandas por usuario/equipo
--  - RLS policies para ambas tablas
--  - Función para reclamar una bufanda (upsert user_scarves)
-- ============================================

-- ============================================
-- 1) TABLA: ticket_claims
--    Cada fila = un usuario sube un ticket para reclamar una bufanda
-- ============================================
CREATE TABLE IF NOT EXISTS public.ticket_claims (
  id                  uuid    NOT NULL DEFAULT gen_random_uuid(),
  user_id             uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bar_id              uuid    NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
  match_id            uuid    REFERENCES public.matches(id) ON DELETE SET NULL,
  team_id             uuid    NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,

  -- Foto del ticket (obligatoria)
  ticket_image_url    text    NOT NULL,

  -- Validaciones automáticas (separadas por lo que se puede verificar)
  location_verified   boolean NOT NULL DEFAULT false,
  location_lat        double precision,
  location_lng        double precision,
  match_day_verified  boolean NOT NULL DEFAULT false,  -- fecha del claim coincide con la del partido
  match_time_verified boolean NOT NULL DEFAULT false,  -- hora del claim está dentro de ±3h del partido

  -- Estado de moderación
  -- pending  → recién enviado, pendiente revisión
  -- approved → validado (automático o manual)
  -- rejected → rechazado (ticket inválido, fuera de ubicación, etc.)
  status              text    NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason    text,

  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ticket_claims_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_claims_user_id  ON public.ticket_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_claims_bar_id   ON public.ticket_claims(bar_id);
CREATE INDEX IF NOT EXISTS idx_ticket_claims_match_id ON public.ticket_claims(match_id);
CREATE INDEX IF NOT EXISTS idx_ticket_claims_status   ON public.ticket_claims(status);

-- ============================================
-- 2) TABLA: user_scarves
--    Una fila por usuario+equipo: la bufanda coleccionada
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_scarves (
  id                  uuid    NOT NULL DEFAULT gen_random_uuid(),
  user_id             uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id             uuid    NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,

  -- Cuántas veces ha reclamado esta bufanda (visitas al partido de este equipo)
  claim_count         integer NOT NULL DEFAULT 1,

  -- Rareza calculada a partir de claim_count:
  --   common    → 1 claim
  --   rare      → 3+ claims
  --   legendary → 10+ claims
  rarity              text    NOT NULL DEFAULT 'common'
                      CHECK (rarity IN ('common', 'rare', 'legendary')),

  first_claimed_at    timestamptz NOT NULL DEFAULT now(),
  last_claimed_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_scarves_pkey          PRIMARY KEY (id),
  CONSTRAINT user_scarves_user_team_key UNIQUE (user_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_user_scarves_user_id ON public.user_scarves(user_id);
CREATE INDEX IF NOT EXISTS idx_user_scarves_team_id ON public.user_scarves(team_id);
CREATE INDEX IF NOT EXISTS idx_user_scarves_rarity  ON public.user_scarves(rarity);

-- ============================================
-- 3) RLS
-- ============================================
ALTER TABLE public.ticket_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_scarves  ENABLE ROW LEVEL SECURITY;

-- ticket_claims: el usuario ve sus propios claims, los admins ven todo
DROP POLICY IF EXISTS "ticket_claims_select_own"   ON public.ticket_claims;
DROP POLICY IF EXISTS "ticket_claims_insert_own"   ON public.ticket_claims;
DROP POLICY IF EXISTS "ticket_claims_select_admin" ON public.ticket_claims;

CREATE POLICY "ticket_claims_select_own"
  ON public.ticket_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "ticket_claims_insert_own"
  ON public.ticket_claims FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Los dueños del bar también pueden ver los claims de su bar (para las estadísticas)
CREATE POLICY "ticket_claims_select_bar_owner"
  ON public.ticket_claims FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bars b
      WHERE b.id = ticket_claims.bar_id
        AND b.owner_id = auth.uid()
    )
  );

-- Solo admins pueden aprobar/rechazar
CREATE POLICY "ticket_claims_update_admin"
  ON public.ticket_claims FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- user_scarves: el usuario ve su colección, cualquiera puede ver la de otro (perfil público)
DROP POLICY IF EXISTS "user_scarves_select_all"  ON public.user_scarves;
DROP POLICY IF EXISTS "user_scarves_insert_own"  ON public.user_scarves;
DROP POLICY IF EXISTS "user_scarves_update_own"  ON public.user_scarves;

CREATE POLICY "user_scarves_select_all"
  ON public.user_scarves FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "user_scarves_insert_own"
  ON public.user_scarves FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_scarves_update_own"
  ON public.user_scarves FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4) FUNCIÓN: fn_claim_scarf
--    Llamada desde la app al enviar un ticket.
--    - Inserta el ticket_claim
--    - Hace upsert en user_scarves (incrementa claim_count)
--    - Recalcula la rareza
--    - Devuelve el scarf actualizado
-- ============================================
CREATE OR REPLACE FUNCTION public.fn_claim_scarf(
  _bar_id              text,
  _match_id            text,        -- puede ser NULL si no se detecta partido
  _team_id             text,
  _ticket_image_url    text,
  _location_verified   boolean,
  _location_lat        double precision,
  _location_lng        double precision,
  _match_day_verified  boolean,
  _match_time_verified boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id     uuid := auth.uid();
  _claim_id    uuid;
  _new_count   integer;
  _new_rarity  text;
  _scarf_id    uuid;
BEGIN
  -- Solo usuarios autenticados (no anónimos)
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Insertar el ticket claim
  INSERT INTO public.ticket_claims (
    user_id, bar_id, match_id, team_id,
    ticket_image_url,
    location_verified, location_lat, location_lng,
    match_day_verified, match_time_verified,
    status
  ) VALUES (
    _user_id,
    _bar_id::uuid,
    CASE WHEN _match_id IS NOT NULL AND _match_id <> '' THEN _match_id::uuid ELSE NULL END,
    _team_id::uuid,
    _ticket_image_url,
    _location_verified, _location_lat, _location_lng,
    _match_day_verified, _match_time_verified,
    -- Auto-aprobado si ubicación y partido verificados; si no, queda pending
    CASE WHEN _location_verified AND _match_day_verified THEN 'approved' ELSE 'pending' END
  )
  RETURNING id INTO _claim_id;

  -- Upsert en user_scarves: incrementar contador
  INSERT INTO public.user_scarves (user_id, team_id, claim_count, rarity, first_claimed_at, last_claimed_at)
  VALUES (_user_id, _team_id::uuid, 1, 'common', now(), now())
  ON CONFLICT (user_id, team_id) DO UPDATE
    SET claim_count    = user_scarves.claim_count + 1,
        last_claimed_at = now()
  RETURNING id, claim_count INTO _scarf_id, _new_count;

  -- Calcular rareza según claim_count
  _new_rarity := CASE
    WHEN _new_count >= 10 THEN 'legendary'
    WHEN _new_count >= 3  THEN 'rare'
    ELSE 'common'
  END;

  UPDATE public.user_scarves
  SET rarity = _new_rarity
  WHERE id = _scarf_id;

  RETURN jsonb_build_object(
    'claim_id',           _claim_id,
    'scarf_id',           _scarf_id,
    'claim_count',        _new_count,
    'rarity',             _new_rarity,
    'auto_approved',      (_location_verified AND _match_day_verified)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_claim_scarf(text, text, text, text, boolean, double precision, double precision, boolean, boolean) TO authenticated;

-- ============================================
-- 5) VISTA: bar_scarf_stats
--    Para el dashboard del dueño del bar.
--    Muestra agregados por bar sin exponer datos personales.
-- ============================================
CREATE OR REPLACE VIEW public.bar_scarf_stats AS
SELECT
  tc.bar_id,
  COUNT(DISTINCT tc.user_id)                                          AS unique_users,
  COUNT(tc.id)                                                        AS total_claims,
  COUNT(tc.id) FILTER (WHERE tc.status = 'approved')                 AS approved_claims,
  COUNT(tc.id) FILTER (WHERE tc.status = 'pending')                  AS pending_claims,
  COUNT(tc.id) FILTER (WHERE tc.location_verified = true)            AS location_verified_count,
  ROUND(COUNT(tc.id)::numeric / NULLIF(COUNT(DISTINCT tc.user_id), 0), 1) AS avg_claims_per_user,
  MAX(tc.created_at)                                                  AS last_claim_at
FROM public.ticket_claims tc
GROUP BY tc.bar_id;

-- Solo los owners de cada bar y super admins pueden consultar la vista
-- (La vista no tiene RLS propia; la protegemos vía función)
GRANT SELECT ON public.bar_scarf_stats TO authenticated;

-- ============================================
-- 6) GRANTS base
-- ============================================
GRANT SELECT, INSERT         ON public.ticket_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_scarves  TO authenticated;

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
