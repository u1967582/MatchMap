-- Corrige un error de la migración anterior: el repunte de Granada
-- (fila femenina "Granada" 476f45b3 -> "Granada CF" masculino 3ce024f6)
-- no filtró por competición y movió también los 31 partidos legítimos
-- de Primera División Femenina. Se revierten solo esos, dejando en
-- Granada CF (masculino) únicamente los partidos de Segunda División.

update public.matches m
set home_team_id = '476f45b3-1748-421f-a056-b72bafd38a09'
where m.home_team_id = '3ce024f6-aadc-461d-b62a-ca48ccb117ee'
  and m.competition_id = '62dca7d1-02db-467f-b422-fcfc1d3da902';

update public.matches m
set away_team_id = '476f45b3-1748-421f-a056-b72bafd38a09'
where m.away_team_id = '3ce024f6-aadc-461d-b62a-ca48ccb117ee'
  and m.competition_id = '62dca7d1-02db-467f-b422-fcfc1d3da902';
