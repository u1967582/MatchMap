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
