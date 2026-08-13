-- Actualiza la temporada de sincronización de API-Football a 2026/2027.
-- La temporada 2025/2026 ya terminó (todas las competiciones anuales tenían
-- api_football_season = 2025, con max_date de partidos <= hoy). El Mundial 2026
-- (scope = 'world') no se toca: ya apunta correctamente a la temporada 2026.
UPDATE public.competitions
SET api_football_season = 2026
WHERE scope IN ('national', 'european')
  AND api_football_season = 2025;
