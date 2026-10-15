# 10 · Builds y configuración de tiendas

**Prioridad:** 🔴 · **Ejecución:** ☁️ `app.json`/`eas.json` · 💻 builds EAS · 👤 decisiones y paneles · **Rama:** `audit/10-builds-config`

## Objetivo
Generar builds de producción firmados, reproducibles y con la configuración correcta para App Store y Google Play.

## Alcance
`app.json`, `eas.json`, `ios/`, `android/`, credenciales de EAS, variables de entorno.

## Checklist
- [ ] **Identificadores (HALLAZGOS #5, D1):** decidir el package de Android antes del primer envío a Play; el bundle ID de iOS se mantiene.
- [ ] **Versiones:** `version` 1.0.16; `buildNumber` / `versionCode` autoincrementales (`"autoIncrement": true` en el perfil de producción o `appVersionSource: remote`).
- [ ] **`eas.json` (HALLAZGOS #19):** dejar `development`, `preview` y `production`; mover variables a *EAS Environment Variables*; borrar `preview2/3/4`, `preview-aab` si no se usan.
- [ ] **Mapbox:** el token de descarga de SDK (`MAPBOX_DOWNLOADS_TOKEN`) debe ser `sk.` en EAS Secrets, no un `pk.` en el repo; el token público de runtime restringido por bundle/package en Mapbox.
- [ ] **Secretos fuera del repo:** buscar claves en `app.json`, `eas.json`, `.env*` versionados, `google-services.json`, `GoogleService-Info.plist`.
- [ ] **Permisos iOS:** textos en español solo para los permisos que se usan (ubicación, fotos, cámara si aplica, tracking ATT si hay anuncios personalizados).
- [ ] **Permisos Android:** quitar los que no se usan (p. ej. `RECORD_AUDIO`, ubicación en segundo plano); revisar el `AndroidManifest` final del build, no solo `app.json`.
- [ ] **Target SDK de Android** cumple el mínimo actual exigido por Play.
- [ ] **AdMob:** IDs de app y de bloques de **producción** (no los de test) solo en builds de producción; `app-ads.txt` publicado en el dominio de desarrollador.
- [ ] **Deep links (HALLAZGOS #20):** esquema `matchmap://`; quitar `autoVerify` o configurar App Links/Universal Links con dominio.
- [ ] **Iconos y splash:** iOS sin transparencia; icono adaptativo de Android; splash en modo claro y oscuro.
- [ ] 💻 **Builds:** `eas build --profile production --platform all` sin warnings bloqueantes; subir a TestFlight y a la pista de prueba interna/cerrada de Play.

## Cola desde la sesión local de release (2026-10-15)
La sesión local 💻 `eas-build-submit-pipeline` se encarga de variables de EAS, credenciales, builds reales y submit, y del runbook `docs/deployment/RELEASE_RUNBOOK.md` (rama `docs/release-runbook`). Lo que sigue son cambios de **ficheros** que pertenecen a esta área:

| ID | Sev. | Cambio pedido | Motivo |
|---|---|---|---|
| R2 | 🔴 | En el perfil `production` poner `"autoIncrement": true` a nivel de perfil (iOS y Android), no solo en `android`. Unificar `production-ios` en `production`. | Con `appVersionSource: remote` (iOS 11 · Android 31 a 2026-10-15), un build iOS con `production` repite el número de build y App Store Connect lo rechaza. |
| R3 | 🟡 | Quitar `ios.buildNumber` y `android.versionCode` de `app.json`. | Se ignoran con versión remota (EAS lo avisa) y confunden. |
| R1 | 🟠 | Quitar todos los bloques `env` de `eas.json` y añadir `"environment": "production"/"preview"/"development"` a cada perfil. | Las 6 variables `EXPO_PUBLIC_*` ya están creadas en EAS Environment Variables (production, preview y development) por la sesión local. |
| R4 | 🟠 | Bloque `submit.production`: `ios.ascAppId` 6758625895 + `ios.appleTeamId` K2C9W5KCNL (sin `appleId` si hay API key) y `android.track: "internal"`, `android.releaseStatus: "draft"`. Sin rutas a ficheros de claves: las credenciales viven en EAS. | Submit sin 2FA y Android sin configurar. |
| R5 | 🟡 | Eliminar `MAPBOX_DOWNLOADS_TOKEN` (es un `pk.`). | Los builds de Android compilan sin necesitar un token de descarga secreto. |
| R7 | 🟡 | `cli.version` a `">= 16.0.0"`. | La CLI local ya se actualiza a la última. |
| R8 | 🟠 | **Decisión del usuario:** añadir `expo-updates` (`runtimeVersion: { policy: "appVersion" }`, `channel` por perfil) antes del primer build de lanzamiento. | Sin OTA no hay hotfix rápido tras el lanzamiento; añadirlo después exige otra versión en tienda. |
| R9 | 🟡 | `android.adaptiveIcon.foregroundImage` → `./assets/adaptive-icon.png` (comprobar la zona segura de 66 %). | Ahora usa `icon.png` y el logo puede recortarse en lanzadores con máscara circular. |

Perfiles mínimos esperados: `development` (developmentClient, internal, + `ios.simulator` en una variante si se necesita), `preview` (internal, apk), `production` (store, app-bundle, autoIncrement). Avisar a la sesión local cuando la PR esté mergeada: los builds de producción se lanzan después.

## Criterios de aceptación
- Build de producción de ambas plataformas instalada desde TestFlight y Play (prueba interna) y abre sin errores.

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| | | | |

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=10, nombre=builds-config]
Específico del área: no cambies el package de Android si D1 no está respondida en el README. Limpia
eas.json dejando development/preview/production y documenta en este fichero qué variables hay que
crear en EAS Environment Variables (nombres, no valores). Revisa el AndroidManifest generado
(npx expo prebuild --platform android --no-install en una carpeta temporal) para listar permisos reales.
```
