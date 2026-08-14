-- Añade dos nuevos motivos de reporte relacionados con la televisión del bar:
-- "sin_television" (no tienen TV) y "no_dan_partido" (no emiten el partido)
alter table public.bar_reports
  drop constraint if exists bar_reports_reason_check;

alter table public.bar_reports
  add constraint bar_reports_reason_check
  check (reason in (
    'info_incorrecta',
    'cerrado',
    'ubicacion_incorrecta',
    'fotos_incorrectas',
    'sin_television',
    'no_dan_partido',
    'otro'
  ));
