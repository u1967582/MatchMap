# 03 · Flujos de usuario

**Prioridad:** 🟠 · **Ejecución:** ☁️ · **Rama:** `audit/03-flujos-usuario`

## Objetivo
Que todo lo que hace un aficionado funcione, tenga estados de carga, vacío y error, y no muestre funciones a medio hacer.

## Alcance
Mapa (`app/(protected)/map.tsx`, `components/Map.tsx`, marcadores), búsqueda (`app/search.tsx`), filtros, partidos (`services/matches.ts`), ficha de bar (`app/bar-profile/[barId].tsx`), favoritos (`app/my-favorites.tsx`, `stores/favoritesStore.ts`), reseñas (`app/write-review`, `hooks/useReviews.ts`, `stores/likesStore.ts`), reportar bar (`app/report-bar/[barId].tsx`), soporte (`app/support.tsx`, `app/contact-support.tsx`), perfil, anuncios (`utils/ads.ts`, `contexts/AdsContext.tsx`), cómo llegar (`hooks/useMapboxDirections.ts`).

## Checklist
- [ ] **Permiso de ubicación denegado:** el mapa funciona con una ubicación por defecto y explica cómo activarla. Sin crash.
- [ ] **Sin conexión / Supabase caído:** cada pantalla muestra error y botón de reintentar; nada se queda cargando para siempre.
- [ ] **Estados vacíos:** sin partidos hoy, sin bares en la zona, sin favoritos, sin reseñas, búsqueda sin resultados.
- [ ] **Partidos:** fecha y hora en la zona horaria del dispositivo; cambio de día; partidos en directo; filtro por equipo favorito.
- [ ] **Filtros del mapa:** combinaciones (TV, comida, idioma, apuestas) devuelven resultados correctos; los bares de test (`is_test`) y no aprobados no aparecen a usuarios normales.
- [ ] **Ficha de bar:** fotos, menú, horarios, partidos que emite, reseñas, compartir, llamar, abrir en Maps.
- [ ] **Botón «Navegar» (HALLAZGOS #16):** `components/Map.tsx` `handleNavigateToBar` es un TODO vacío → implementar (abrir Apple/Google Maps) o borrar la prop.
- [ ] **Reseñas:** crear, editar, borrar, dar like; una por usuario y bar; el rating del bar se recalcula.
- [ ] **Contenido generado por usuarios (Apple 1.2):** se puede **reportar** una reseña/post ofensivo y **bloquear** a un usuario, y hay forma de contactar. Hoy solo existe reportar bar → comprobar y, si falta, implementar reporte de reseña como mínimo.
- [ ] **Anuncios:** no tapan botones, no aparecen en flujos de pago ni a usuarios con Boost si así se decidió; consentimiento UMP/ATT antes del primer anuncio (ver 11).
- [ ] **Deep links:** `matchmap://bar/<id>` (o el que exista) abre la ficha correcta con la app cerrada y abierta.
- [ ] **Textos:** todo en español, sin claves de traducción ni textos en inglés sueltos; sin `TODO` ni datos de prueba visibles.

## Criterios de aceptación
- Ningún botón visible sin acción.
- Tests de las pantallas y hooks modificados.
- Lista de flujos verificados que alimenta la matriz del área 12.

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| | | | |

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=03, nombre=flujos-usuario]
Específico del área: recorre cada pantalla del alcance leyendo el código y comprueba los estados de
carga, vacío y error de cada consulta a Supabase. Arregla los que falten usando los componentes del
design system (constants/ y components/ui). Implementa el botón Navegar abriendo la app de mapas nativa.
Si falta reportar reseñas (Apple 1.2), impleméntalo reutilizando el patrón de app/report-bar y deja la
migración necesaria como fichero.
```
