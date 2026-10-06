-- Elimina las políticas RLS SELECT antiguas y demasiado permisivas (qual=true)
-- en bar_images y bar_menus. Al ser políticas PERMISSIVE, Postgres las combina
-- con OR junto a la política restrictiva ya existente
-- (bar_images_select_visible_bar / bar_menus_select_visible_bar, que exige
-- admin, dueño o bar aprobado), así que la antigua anulaba en la práctica la
-- protección de la nueva y exponía fotos/cartas de bares no aprobados o
-- archivados vía la API pública. La tabla `bars` ya exige rol authenticated
-- para SELECT, así que ningún flujo legítimo depende de estas políticas.

drop policy if exists "Read all bar images" on public.bar_images;
drop policy if exists "Allow authenticated users to read bar menus" on public.bar_menus;
drop policy if exists "Everyone: read bar menus" on public.bar_menus;
