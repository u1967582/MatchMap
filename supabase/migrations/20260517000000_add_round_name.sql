-- Añadir columnas de fase para el hub del Mundial 2026
-- round_name: nombre completo del round de API-Football (ej: "Group Stage - 1", "Round of 16")
-- group_name: grupo de la fase de grupos (ej: "Group A", "Group B")
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_name text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_name text;
