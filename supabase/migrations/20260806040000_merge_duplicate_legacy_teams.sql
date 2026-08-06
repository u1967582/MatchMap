-- ============================================
-- MIGRACIÓN: Fusión de equipos duplicados (legacy vs sync automático)
-- Fecha: 2026-08-06
-- Objetivo:
--  - Al activarse la sincronización automática con API-Football
--    (sync-football, primer run 2026-03-05), el upsert por
--    api_football_id no reconoció los equipos ya sembrados a mano
--    (api_football_id NULL) y creó filas nuevas duplicadas. Las filas
--    viejas se quedaron "congeladas" con solo los partidos previos a
--    la automatización, mientras todos los partidos nuevos van a la
--    fila nueva. Resultado: 29 equipos duplicados (15 en Primera
--    División, 14 en Segunda División) que aparecían repetidos en el
--    selector de equipo favorito, y 2 bares con el auto-broadcast roto
--    porque tenían seleccionada la fila vieja (sin partidos futuros).
--  - Granada es un caso aparte: no está duplicado por este bug, pero 5
--    partidos de Segunda División quedaron mal enlazados al equipo
--    femenino "Granada" en vez de al masculino "Granada CF".
--  - Esta migración repunta partidos y selecciones de bar a la fila
--    correcta, borra las 29 filas obsoletas y corrige a Granada.
-- ============================================

create temporary table team_merge_map (legacy_id uuid primary key, canonical_id uuid not null) on commit drop;

insert into team_merge_map (legacy_id, canonical_id) values
  -- Primera División
  ('df10e896-f59e-4020-80de-a9413d725d4f', '64b4214d-8664-4aba-8477-8bea18d604e5'), -- Atlético de Madrid -> Atletico Madrid
  ('5467dc74-060a-4aac-8bdf-8b9f17875217', 'f7af6aae-fdd1-4cd3-b391-70c772b5ab7b'), -- CA Osasuna -> Osasuna
  ('239b999a-6af0-4eec-a524-e703a61880dc', '00231d79-4090-4154-8300-60cc83e33402'), -- Celta de Vigo -> Celta Vigo
  ('23eef5a7-5dc6-47e9-a2bc-66b9a19de2b1', 'edf7025f-d64d-46bf-ace8-d63486acf6a4'), -- Deportivo Alavés -> Alaves
  ('a3341110-c418-4a81-8804-b74c3522e3f4', 'a2178b84-bf44-4b51-b39c-2aaee4cb9847'), -- Elche CF -> Elche
  ('b3668417-5437-4994-aea3-b5f76a6296a2', '5f80b5a0-3931-4a89-aeb1-6ae0c258a116'), -- FC Barcelona -> Barcelona
  ('c09c6f31-abf7-4883-8cee-ce702b108a9a', '508f07b8-aa06-4839-a619-e44ac89e09f5'), -- Getafe CF -> Getafe
  ('e203e8c0-0c43-408b-b93e-637562f5cb7d', '56dd5875-9eab-4eab-9b44-a32cb4d7e211'), -- Girona FC -> Girona
  ('84eb3861-df00-4ef3-965e-62c3cd8df46a', '09c2f8f3-df2b-47cf-a1b6-fc431ac2fa6e'), -- Levante UD -> Levante
  ('df934b11-def8-490d-858a-853d5b7390ed', '9c517c95-f354-457c-9c84-e2d115fb3b00'), -- RCD Espanyol -> Espanyol
  ('663b3c4b-a352-4ba0-9257-300ff80bb059', '4fd37448-6c8b-4440-a63b-98f495e01ae7'), -- RCD Mallorca -> Mallorca
  ('fb3994bf-b32b-45b9-807c-29e2509e2711', '4ab5894a-ccc9-4a1f-acb2-bcd89c0e6a36'), -- Real Oviedo -> Oviedo
  ('35da55cc-c7cc-438f-b5fd-a5c1e471f458', '82efc105-57a7-4106-8e16-a7e7914ce678'), -- Sevilla FC -> Sevilla
  ('bdba0571-3f49-4680-844d-db953fb90470', '3b09036b-ff25-4b9a-b4f7-04a5306b96e1'), -- Valencia CF -> Valencia
  ('081abde0-168d-459e-83cd-88e47b2f0a1d', '018c01ba-1967-45e3-98d7-a7aeb0c31a74'), -- Villarreal CF -> Villarreal
  -- Segunda División
  ('c438f0b3-2e1d-4f9d-9085-29cfebe53cd9', '93a88749-88f5-4e22-b1c5-e6111f5bd552'), -- Almería -> Almeria
  ('27b43071-df34-4277-8df7-a196912d84d2', 'f3e210b8-82bc-44eb-9611-18a81c7cb4b2'), -- Cádiz -> Cadiz
  ('1c847650-967a-4105-8ef0-9773698ae2fd', 'f69d145f-a354-4191-a23b-44a208b62f8e'), -- CD Castellón -> Castellón
  ('de0bd589-aeac-461a-83b3-d14671f84f83', 'dc8abc4f-35d6-48c3-b41c-14fc57af194a'), -- Córdoba CF -> Cordoba
  ('d7b27be6-2ffe-488b-b62d-63056931006a', 'cc793651-11a6-4e62-a0dd-0ba9db6aea16'), -- Leganés -> Leganes
  ('bf6ab3d7-9326-4964-b502-b5b5db442397', '640f4c8b-543d-465a-8c66-f84e970bbc93'), -- Málaga -> Malaga
  ('e2ba40d9-bd85-4932-896f-953880bdd582', '7c88618a-db6c-4871-a62a-664fa9bd868a'), -- Mirandés -> Mirandes
  ('218bd396-a44f-4d81-a70f-bf05f7b8abb2', '3e914433-fb53-43b3-b446-5eaa0a644e21'), -- Racing -> Racing Santander
  ('dc069291-d474-46c8-a2ce-50792c21b2a8', '66f973a5-0542-4d50-94da-5ec2de2a53c9'), -- RC Deportivo -> Deportivo La Coruna
  ('22fadad0-d4d2-4351-9b97-2c2c0dd6a315', '71f7cfca-7bc4-4bfc-9c43-54630492761a'), -- Real Sociedad B -> Real Sociedad II
  ('f16616d1-283f-401d-8f83-e2c9bb4bed5a', '45102906-b48d-4ef4-bfcf-099eb230b940'), -- Real Sporting -> Sporting Gijon
  ('5861abee-c403-43d1-8303-2f4ff07013ed', '5ecd7049-6de0-4518-8e18-36debfd38556'), -- Real Valladolid -> Valladolid
  ('6a0a7838-e22a-4a50-878a-a097bf5b05be', '32cec9f5-2609-4644-b86b-db8a8cfe7701'), -- Real Zaragoza -> Zaragoza
  ('6b5fdb87-97e0-4036-974d-1b03b59f9215', '8c86f938-d2b1-45a2-b06e-52ef3f4c9888'), -- UD Las Palmas -> Las Palmas
  -- Caso aparte: Granada femenino (se conserva) con 5 partidos de Segunda mal enlazados
  ('476f45b3-1748-421f-a056-b72bafd38a09', '3ce024f6-aadc-461d-b62a-ca48ccb117ee');  -- Granada (mal enlazados) -> Granada CF

-- 1) Repuntar partidos a la fila correcta
update public.matches m
set home_team_id = tm.canonical_id
from team_merge_map tm
where m.home_team_id = tm.legacy_id;

update public.matches m
set away_team_id = tm.canonical_id
from team_merge_map tm
where m.away_team_id = tm.legacy_id;

-- 2) Repuntar selecciones de auto-broadcast de bares, evitando choque con la PK
--    (bar_id, team_id, competition_id) si el bar ya tenía seleccionada la fila nueva
update public.bar_selected_teams bst
set team_id = tm.canonical_id
from team_merge_map tm
where bst.team_id = tm.legacy_id
  and not exists (
    select 1 from public.bar_selected_teams bst2
    where bst2.bar_id = bst.bar_id
      and bst2.competition_id = bst.competition_id
      and bst2.team_id = tm.canonical_id
  );

-- Si algún bar ya tenía ambas filas seleccionadas, la referencia a la vieja
-- sobra (la nueva ya cubre esa selección): se elimina para poder borrar el equipo.
delete from public.bar_selected_teams bst
using team_merge_map tm
where bst.team_id = tm.legacy_id;

-- 3) Borrar las filas de equipo obsoletas (excepto Granada, que se conserva:
--    su api_football_id no es NULL, es el equipo femenino real con 31 partidos
--    legítimos en Primera División Femenina)
delete from public.teams
where id in (
  select legacy_id from team_merge_map
  where legacy_id <> '476f45b3-1748-421f-a056-b72bafd38a09'
);
