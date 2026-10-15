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
| | | | | | |
