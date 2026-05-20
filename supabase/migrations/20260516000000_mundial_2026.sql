-- Ampliar CHECK constraint scope para incluir 'world'
ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_scope_check;
ALTER TABLE competitions ADD CONSTRAINT competitions_scope_check
  CHECK (scope IN ('national', 'european', 'world'));

-- Añadir columna api_football_season por competición
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS api_football_season integer;

-- Poblar season en competiciones existentes (temporada 2025)
UPDATE competitions SET api_football_season = 2025
  WHERE api_football_id IS NOT NULL;

-- Insertar Mundial 2026
INSERT INTO competitions (name, gender, scope, country, api_football_id, api_football_season)
VALUES ('Mundial 2026', 'male', 'world', 'World', 1, 2026)
ON CONFLICT (name) DO UPDATE SET
  api_football_id = EXCLUDED.api_football_id,
  api_football_season = EXCLUDED.api_football_season,
  scope = EXCLUDED.scope;
