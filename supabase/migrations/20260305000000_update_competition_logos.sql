-- ============================================
-- MIGRACIÓN: Actualizar logos de competiciones
-- Fecha: 2026-03-05
-- Objetivo: Corregir URLs de logos para
--   Champions League Femenina, Copa del Rey,
--   Europa League y Primera División Femenina
-- ============================================

UPDATE public.competitions
SET logo_url = 'https://hmtfxpihkoisncglllmq.supabase.co/storage/v1/object/public/logo-teams/champions_femen.png'
WHERE name ILIKE '%champions%' AND (gender = 'female' OR name ILIKE '%femen%');

UPDATE public.competitions
SET logo_url = 'https://hmtfxpihkoisncglllmq.supabase.co/storage/v1/object/public/logo-teams/copa-del-rey.png'
WHERE name ILIKE '%copa del rey%';

UPDATE public.competitions
SET logo_url = 'https://hmtfxpihkoisncglllmq.supabase.co/storage/v1/object/public/logo-teams/europa-league.png'
WHERE name ILIKE '%europa league%';

UPDATE public.competitions
SET logo_url = 'https://hmtfxpihkoisncglllmq.supabase.co/storage/v1/object/public/logo-teams/ligaf.png'
WHERE name ILIKE '%primera%' AND (gender = 'female' OR name ILIKE '%femen%');

-- Verificar resultados
SELECT id, name, gender, logo_url
FROM public.competitions
WHERE name ILIKE '%champions%'
   OR name ILIKE '%copa del rey%'
   OR name ILIKE '%europa%'
   OR (name ILIKE '%primera%' AND (gender = 'female' OR name ILIKE '%femen%'));

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
