-- ============================================
-- MIGRACIÓN: Permitir mensaje vacío en reclamos de bares
-- Fecha: 2026-08-13
-- Objetivo:
--  - La pantalla de reclamo (app/claim-bar/[barId].tsx) trata el campo
--    "Contexto adicional" como opcional y envía NULL cuando está vacío,
--    pero bar_claims.message seguía siendo NOT NULL, por lo que el insert
--    fallaba siempre que el usuario no rellenaba ese campo.
-- ============================================

alter table public.bar_claims alter column message drop not null;
