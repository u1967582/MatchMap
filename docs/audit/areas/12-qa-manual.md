# 12 · QA manual en dispositivos

**Prioridad:** 🔴 · **Ejecución:** 👤 en dispositivos físicos + 💻 simulador/emulador · Sin rama (los fallos se abren como hallazgos y se arreglan en el área que toque)

## Objetivo
Probar la app como lo hará un usuario real, con el build de producción, antes de enviarla a revisión.

## Dispositivos mínimos
| Dispositivo | SO | Motivo |
|---|---|---|
| iPhone reciente | iOS 26 | Usuario principal iOS |
| iPhone pequeño o simulador iPhone SE/16e | iOS 18+ | Pantalla pequeña |
| Android gama media | Android 13–15 | Rendimiento y permisos de notificaciones |
| Android con tablet o pantalla grande (emulador) | Android 15+ | Edge-to-edge y layouts |

## Matriz de smoke test (rellenar ✅/❌ por dispositivo)
| # | Flujo | iOS | iOS peq. | Android | Android tablet |
|---|---|---|---|---|---|
| 1 | Instalación limpia → bienvenida → entrar como invitado | | | | |
| 2 | Registro email, verificación, login, logout | | | | |
| 3 | Login Google / Apple | | | | |
| 4 | Recuperar contraseña desde el email | | | | |
| 5 | Permiso de ubicación aceptado y denegado | | | | |
| 6 | Mapa: mover, filtrar, abrir bar, navegar | | | | |
| 7 | Partidos de hoy y otro día; equipo favorito | | | | |
| 8 | Buscar bar y partido | | | | |
| 9 | Favorito: añadir, quitar, ver lista | | | | |
| 10 | Reseña: escribir, editar, borrar, like, reportar | | | | |
| 11 | Reportar bar y contactar soporte | | | | |
| 12 | Editar perfil y avatar | | | | |
| 13 | Registrar bar (4 pasos con fotos) | | | | |
| 14 | Reclamar bar con documento | | | | |
| 15 | Propietario: editar bar, menú, post, emisiones, estadísticas | | | | |
| 16 | Comprar Boost (sandbox) y verlo activo | | | | |
| 17 | Notificación de partido recibida y abierta | | | | |
| 18 | Anuncios: consentimiento y que no tapen nada | | | | |
| 19 | Deep link a un bar con la app cerrada | | | | |
| 20 | Modo avión en mapa, ficha y favoritos | | | | |
| 21 | Modo oscuro y tamaño de letra grande | | | | |
| 22 | Borrar cuenta | | | | |
| 23 | Admin: aprobar bar y atender reporte (cuenta admin) | | | | |
| 24 | Usuario normal intentando abrir ruta de admin | | | | |

## Rondas
- **Ronda 1 (día 6–7):** matriz completa con el primer build de producción. Cada ❌ → fila en *Hallazgos* con dispositivo, pasos y captura.
- **Ronda 2 (día 10):** regresión completa con el release candidate. Go/No-Go con los criterios del README.

## Hallazgos
| ID | Severidad | Dispositivo | Pasos para reproducir | Área | Estado |
|---|---|---|---|---|---|
| 12-H1 | 🔴 | Todos | Iniciar sesión con la cuenta A (con equipo favorito y avisos), cerrar sesión, entrar con la cuenta B en el mismo móvil → siguen llegando los avisos del equipo de A. | 06 (06-H2) | ✅ arreglado con test |
| 12-H2 | 🟠 | Todos | Mapa → filtro por partido → elegir partido sin red: decía «Ningún bar emite este partido todavía» en vez de un error. | 03 | ✅ `components/Map.tsx` muestra el error con «Reintentar» (sin test de pantalla: Map depende de Mapbox) |
| 12-H3 | 🟠 | Todos | Selector de partidos → cambiar de día sin red: se quedaban los partidos del día anterior bajo la fecha nueva (y se podía filtrar por un partido equivocado), o «No hay partidos programados». | 03 | ✅ `MatchPickerModal` con estado de error y reintento; test en `components/ui/__tests__/MatchPickerModal.test.tsx` |
| 12-H4 | 🟠 | Todos | Buscar → tocar el corazón de un bar como invitado o sin red: el invitado podía guardar favoritos (que se pierden), y un fallo se revertía sin avisar. En la ficha y en la tarjeta del mapa sí se avisaba. | 03 | ✅ `app/search.tsx` pide registro al invitado y muestra toast de error (sin test de pantalla) |
| 12-H5 | 🟠 | Todos | Bienvenida → Google/Apple/Invitado con un error: el Alert mostraba textos en inglés (`Failed to establish session`, `Unexpected result: …`, `Anonymous sign-ins are disabled`, mensajes de Supabase/Apple). | 02 | ✅ `formatAuthErrorAlert` en `utils/auth.ts` (con tests) usado en `app/index.tsx` |
| 12-H6 | 🟡 | Todos | Registrar bar (paso 4) con un error de Supabase: el Alert enseña `error.message` en inglés (p. ej. de RLS). Igual en las pantallas de admin (`bar-reports-admin`, `bar-claims-admin`, `bar-verification-admin`). | 04 | Anotado |
| 12-H7 | 🟡 | Todos | Si falla el join de catálogos, el mapa y «Editar bar» muestran la etiqueta `Unknown` (`components/Map.tsx`, `app/edit-bar-info/[barId].tsx`). | 03/04 | Anotado |
| 12-H8 | 🟡 | Todos | Toque en notificación con la app cerrada puede abrir el mapa sin filtrar (carrera de navegación). | 06 (06-H5) | ⏳ probar en fila 17 |

Revisión de código (☁️, 2026-11-04) de los flujos 1–12, 20 y 22: invitado, registro/login, mapa y filtros, ficha, partidos, favoritos, reseñas, reportes y bloqueos, perfil, borrado de cuenta y sin red. Todas las RPC que llama la app existen en `supabase/migrations` o en el esquema base de prod (`fn_bar_ids_with_team_events` solo aparece en `fix_function_search_path`, así que existe en prod). Ficha, favoritos, reseñas, likes, bloqueo, editar perfil y borrado ya tienen estados de error y toasts (áreas 02/03). Las migraciones de 01 y 03 (`review_reports`, `user_blocks`) **deben estar aplicadas en prod** antes de la ronda 1, o reportar/bloquear reseñas fallará.
