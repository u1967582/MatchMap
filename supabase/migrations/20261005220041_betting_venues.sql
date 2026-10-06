-- ============================================
-- MIGRACIÓN: Locales de apuestas deportivas
-- Fecha: 2026-08-16
-- Objetivo:
--  - Permitir marcar un bar como "en realidad es un local de apuestas
--    deportivas" (bars.is_betting_venue), para no mezclarlo con los bares
--    normales del mapa/búsqueda.
--  - Estos locales están ocultos por defecto para todo el mundo.
--  - Cada usuario (no anónimo) decide, de forma permanente hasta que él
--    mismo la cambie, si quiere verlos (public.users.show_betting_bars).
--  - La primera vez que inicia sesión se le pregunta si es mayor de 18
--    años y si quiere verlos; betting_bars_prompted_at se marca al
--    mostrarse el popup, elija lo que elija, para no volver a preguntar.
-- ============================================

-- 1) Columna nueva en public.bars
alter table public.bars
  add column if not exists is_betting_venue boolean not null default false;

comment on column public.bars.is_betting_venue is
  'true si el local es en realidad un establecimiento de apuestas deportivas, no un bar al uso. Oculto por defecto salvo que el usuario haya optado por verlos.';

-- 2) Columnas nuevas en public.users
alter table public.users
  add column if not exists is_adult_confirmed boolean not null default false,
  add column if not exists show_betting_bars boolean not null default false,
  add column if not exists betting_bars_prompted_at timestamptz;

comment on column public.users.is_adult_confirmed is
  'Autodeclaración del usuario de ser mayor de 18 años. Reconfirmable en cualquier momento desde el perfil.';
comment on column public.users.show_betting_bars is
  'Preferencia del usuario de incluir locales de apuestas deportivas en el mapa y la búsqueda.';
comment on column public.users.betting_bars_prompted_at is
  'Momento en que se mostró el popup de edad/preferencia de apuestas deportivas por primera vez. NULL = aún no se ha mostrado.';

-- Nota: no se toca RLS de public.bars ni public.users. Las policies
-- existentes son a nivel de fila, no de columna, y ya cubren estas
-- columnas nuevas (mismo razonamiento que en 20260806134335_favorite_team.sql).
