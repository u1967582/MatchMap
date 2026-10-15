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
| | | | |
