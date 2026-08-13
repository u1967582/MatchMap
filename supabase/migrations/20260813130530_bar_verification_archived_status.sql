-- Añade el estado 'archived' para poder posponer bares a los que les falta
-- algo, sin mezclarlos con el resto de pendientes ni rechazarlos definitivamente.

alter table public.bars
  drop constraint if exists bars_verification_status_check;
alter table public.bars
  add constraint bars_verification_status_check
  check (verification_status in ('pending','approved','rejected','archived'));

alter table public.bars_scraped
  drop constraint if exists bars_scraped_status_check;
alter table public.bars_scraped
  add constraint bars_scraped_status_check
  check (status in ('pending','rejected','converted','archived'));
