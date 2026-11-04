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
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| 06-H1 | 🔴 | 0 filas en `push_tokens` en prod (2026-11-04). Causa probable: el binario publicado es anterior al código de push (2026-08-06) y no hay OTA. | ⏳ confirmar con un build nuevo |
| 06-H2 | 🔴 | El token se desregistraba tras perder la sesión: la RPC no borraba la fila y el móvil seguía recibiendo avisos de la cuenta anterior. | ✅ se borra antes de `signOut` (test) |
| 06-H3 | 🟠 | Los fallos al obtener el token solo salían por consola. | ✅ `reportError` |
| 06-H4 | 🟠 | Android sin FCM: token `null` en silencio. | ⏳ 👤 Firebase + EAS |
| 06-H5 | 🟠 | Al tocar la notificación con la app cerrada, la redirección de `app/index.tsx` puede pisar el `matchId`. | ⏳ probar en dispositivo |
| 06-H6 | 🟡 | Con el permiso denegado, el interruptor de Perfil sale activado. | Anotado |
| 06-H7 | 🟡 | Canal de Android llamado `default`. | ✅ «Avisos de partidos» |
