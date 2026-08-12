-- ============================================
-- MIGRACIÓN: Flags para revisión de fotos de bares
-- Fecha: 2026-05-21
-- Objetivo:
--  - Marcar si un bar necesita mejorar sus fotos del establecimiento
--  - Marcar si un bar necesita mejorar sus fotos de carta/menú
--  - Solo admins pueden activar/desactivar los flags
--  - El owner y usuarios ven el estado del flag de su bar
-- ============================================

ALTER TABLE public.bars
  ADD COLUMN IF NOT EXISTS flag_bar_photos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_menu_photos boolean NOT NULL DEFAULT false;

-- Índices parciales: útiles para filtrar bares con flags activos en el futuro
CREATE INDEX IF NOT EXISTS idx_bars_flag_bar_photos
  ON public.bars (flag_bar_photos)
  WHERE flag_bar_photos = true;

CREATE INDEX IF NOT EXISTS idx_bars_flag_menu_photos
  ON public.bars (flag_menu_photos)
  WHERE flag_menu_photos = true;

-- ============================================
-- Las RLS policies existentes ya cubren estas columnas:
--   SELECT: bars_select_owner_admin_or_approved
--   UPDATE admin: bars_update_admin_all (is_super_admin())
--   UPDATE owner: bars_update_owner_no_status_change
--     → el owner NO puede cambiar estos flags porque solo admin puede
--       (las policies de update del owner solo aplican si owner_id = auth.uid(),
--        pero bars_update_admin_all tiene precedencia para admins)
-- No se necesitan policies adicionales.
-- ============================================
