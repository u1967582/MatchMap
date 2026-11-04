# 06 · Notificaciones push

**Prioridad:** 🔴 · **Ejecución:** 👤 Firebase/Apple · 💻 EAS y Supabase · ☁️ código si hace falta · **Rama:** `audit/06-push`

## Objetivo
Que los avisos de partidos lleguen en iOS y Android, con el permiso pedido en el momento adecuado.

## Alcance
`services/notifications.ts`, plugin `expo-notifications` en `app.json`, edge function `send-match-notifications` (cron `*/15`), tabla de tokens push.

## Checklist
- [ ] 👤 **FCM (HALLAZGOS #6):** crear proyecto Firebase con el package de Android **definitivo** (depende de D1), descargar `google-services.json`, subir la clave de servidor FCM v1 a EAS (`eas credentials`).
- [ ] ☁️ Añadir `android.googleServicesFile` en `app.json` (el fichero no se versiona si contiene datos sensibles → EAS file secret).
- [ ] 💻 **APNs:** comprobar en `eas credentials` que hay clave de push para `com.tuorg.matchmap` en producción.
- [ ] **Momento del permiso:** se pide tras una acción con sentido (marcar equipo favorito / favorito), no al abrir la app; Android 13+ pide `POST_NOTIFICATIONS`.
- [ ] **Registro del token:** se guarda al conceder, se actualiza si cambia, se borra al cerrar sesión o borrar la cuenta.
- [ ] **Envío:** `send-match-notifications` respeta preferencias, no duplica avisos y limpia tokens inválidos (`DeviceNotRegistered`).
- [ ] **Tocar la notificación** abre la pantalla correcta (partido o bar), con la app cerrada y en segundo plano.
- [ ] Canal de notificación en Android con nombre en español.

## Criterios de aceptación
- Notificación real recibida y abierta en un iPhone y un Android con el build de producción.

## Hallazgos
Revisión de código del 2026-11-04 (☁️, rama `audit/06-12-flujos`). Contexto: en prod hay 122 usuarios, **0 filas en `push_tokens`** y 0 avisos enviados.

| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| 06-H1 | 🔴 | **Causa más probable de los 0 tokens: el binario publicado no lleva el código de push.** `1.0.16` / build 12 se subió el 2026-04-06 (`bb69fac`), y el registro de tokens (`services/notifications.ts`, `fn_register_push_token`) llegó el 2026-08-06 (`cfd3b2d`). No hay `expo-updates` (10-R8), así que ese JS no puede llegar por OTA: los usuarios solo lo tendrán con un build nuevo en tienda. La RPC y el cliente no tienen ningún fallo que explique por sí solos 0 filas en iOS. | ⏳ 👤 confirmar fecha del build en tienda (ASC / Play Console) · 💻 comprobar en prod que existe `fn_register_push_token` |
| 06-H2 | 🔴 | **El token no se borraba al cerrar sesión.** `unregisterCurrentPushToken()` se llamaba en el evento `SIGNED_OUT` de `app/_layout.tsx`, cuando ya no hay sesión: `fn_unregister_push_token` filtra por `auth.uid()` (null), no borraba nada, y además se borraba el token de AsyncStorage. El dispositivo seguía recibiendo los avisos del equipo de la cuenta anterior (fuga de privacidad entre cuentas del mismo móvil). | ✅ `utils/auth.signOut` desregistra **antes** de `supabase.auth.signOut()`; Perfil usa esa función. Test de orden en `utils/__tests__/auth.test.ts` |
| 06-H3 | 🟠 | Los fallos al obtener o registrar el token (sin FCM en Android, sin `aps-environment`, RPC que no existe…) solo iban a `console.error`, que se elimina en producción: imposible diagnosticar por qué no hay tokens. | ✅ ahora pasan por `reportError` (llegarán a la herramienta de D4 cuando esté) |
| 06-H4 | 🟠 | **Android sin FCM** (HALLAZGOS #6): `getExpoPushTokenAsync` lanza y se devuelve `null` en silencio. Sigue siendo necesario `google-services.json` + clave FCM v1 en EAS. | ⏳ 👤 Firebase + 💻 EAS |
| 06-H5 | 🟠 | **Toque con la app cerrada:** `app/_layout.tsx` hace `router.push('/(protected)/map?matchId=…')` desde `getLastNotificationResponseAsync`, en paralelo con `app/index.tsx`, que hace `router.replace('/(protected)/map')` sin parámetros al restaurar la sesión. Según quién gane, el `matchId` se pierde y se abre el mapa sin filtrar. En frío además pueden dispararse el listener y `getLastNotificationResponseAsync` para la misma respuesta (doble push). No reproducible sin dispositivo. | ⏳ probar en dispositivo (matriz 12, fila 17); si falla, guardar el `matchId` pendiente y consumirlo en `map.tsx` |
| 06-H6 | 🟡 | El permiso solo se pide a quien elige equipo favorito (correcto para Apple), pero el interruptor de avisos de Perfil no vuelve a pedir permiso ni registra token: si el usuario denegó, el interruptor aparece activado y no llega nada. Falta un aviso «actívalas en Ajustes». | ✅ `syncMatchNotificationsToggle`: al activar pide permiso si el sistema aún deja, registra el token y, si está denegado, ofrece «Abrir ajustes». Tests en `services/__tests__/notifications.test.ts` |
| 06-H7 | 🟡 | Canal de Android se llamaba `default` en los ajustes del sistema. | ✅ «Avisos de partidos» |
| 06-H8 | 🟡 | Tocar una notificación sin red: `fetchMatchById` falla y solo se escribe en consola; se abre el mapa sin filtro ni aviso. | Anotado |

Revisado sin hallazgos: permiso pedido tras elegir equipo (no al abrir), canal creado antes de pedir permiso (Android 13+), RPC `security definer` con `on conflict` que reasigna el token, envío con dedupe en `match_notifications_sent` y limpieza de `DeviceNotRegistered`, tokens borrados en cascada al borrar la cuenta.
