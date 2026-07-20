-- ============================================
-- MIGRACIÓN: Eliminar sistema de Bufandas Coleccionables
-- Fecha: 2026-05-18
-- Objetivo: revertir 20260412000000_scarves_collectibles.sql y
--           20260413000000_ticket_claims_people_count.sql — la
--           feature se ha eliminado del frontend (scarves.tsx,
--           claim-scarf/[barId].tsx, useScarves.ts, useWorldCupData.ts).
-- ============================================

DROP VIEW IF EXISTS public.bar_scarf_stats;

DROP FUNCTION IF EXISTS public.fn_claim_scarf(
  text, text, text, text, boolean, double precision, double precision, boolean, boolean, integer
);
DROP FUNCTION IF EXISTS public.fn_claim_scarf(
  text, text, text, text, boolean, double precision, double precision, boolean, boolean
);

DROP TABLE IF EXISTS public.ticket_claims;
DROP TABLE IF EXISTS public.user_scarves;
