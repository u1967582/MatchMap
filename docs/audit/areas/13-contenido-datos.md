# 13 · Contenido y datos

**Prioridad:** 🟠 · **Ejecución:** 👤 decisiones y aprobaciones · 💻 consultas en prod

## Objetivo
Que un usuario nuevo en las zonas de lanzamiento encuentre bares y partidos el primer día.

## Estado de partida (2026-10-10)
182 bares: **47 aprobados**, 135 pendientes. 1220 partidos futuros cargados. 76 usuarios anónimos.

## Checklist
- [ ] **D5:** definir ciudades/zonas de lanzamiento y mínimo de bares aprobados por zona.
- [ ] Revisar la cola de verificación (pestaña «Sin dueño» con aprobación por lotes): fotos, dirección, coordenadas correctas en el mapa, horarios.
- [ ] Bares duplicados o cerrados: detectar por nombre y coordenadas cercanas; fusionar o desactivar.
- [ ] Bares de test (`is_test = true`) ocultos para usuarios normales; ningún dato de prueba visible.
- [ ] Partidos: ligas que importan al público objetivo cubiertas; horarios correctos (el arreglo de fechas desplazadas ya está en prod).
- [ ] Emisiones: los bares aprobados tienen partidos asignados (automático o manual) para que el mapa no salga vacío.
- [ ] Limpieza: usuarios anónimos antiguos sin actividad (definir política de retención, enlaza con 11).
- [ ] Textos de ejemplo/lorem ipsum o imágenes de prueba en la base de datos.

## Criterios de aceptación
- Cada zona de lanzamiento cumple el mínimo de D5 con datos revisados.

## Consultas útiles (💻)
```sql
-- Bares por estado
select verification_status, count(*) from bars group by 1;
-- Pendientes con coordenadas vacías o sin imágenes
select id, name from bars b
where verification_status = 'pending'
  and (latitude is null or not exists (select 1 from bar_images i where i.bar_id = b.id));
```

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| | | | |
