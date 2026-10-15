# 10 · Builds y configuración de tiendas

**Prioridad:** 🔴 · **Ejecución:** ☁️ `app.json`/`eas.json` · 💻 builds EAS · 👤 decisiones y paneles · **Rama:** `audit/10-builds-config`

## Objetivo
Generar builds de producción firmados, reproducibles y con la configuración correcta para App Store y Google Play.

## Alcance
`app.json`, `eas.json`, `ios/`, `android/`, credenciales de EAS, variables de entorno.

## Checklist
- [ ] **Identificadores (HALLAZGOS #5, D1):** decidir el package de Android antes del primer envío a Play; el bundle ID de iOS se mantiene. → ⏳ **D1 sin responder**: no se ha tocado `com.tuorg.matchmap` (10-H14).
- [x] **Versiones:** `version` 1.0.16; `buildNumber` / `versionCode` autoincrementales (`"autoIncrement": true` en el perfil de producción o `appVersionSource: remote`). → `appVersionSource: remote` + `autoIncrement: true` en `production` para ambas plataformas (10-H4).
- [x] **`eas.json` (HALLAZGOS #19):** dejar `development`, `preview` y `production`; mover variables a *EAS Environment Variables*; borrar `preview2/3/4`, `preview-aab` si no se usan. → hecho (10-H2); **las variables hay que crearlas en EAS antes del próximo build** (10-H5, tabla más abajo).
- [x] **Mapbox:** el token de descarga de SDK (`MAPBOX_DOWNLOADS_TOKEN`) debe ser `sk.` en EAS Secrets, no un `pk.` en el repo; el token público de runtime restringido por bundle/package en Mapbox. → el token de descarga ya no hace falta y se ha quitado (10-H3). ⏳ 👤 restringir el `pk.` de runtime en el panel de Mapbox y **revocar el `sk.` del historial** (10-H1).
- [x] **Secretos fuera del repo:** buscar claves en `app.json`, `eas.json`, `.env*` versionados, `google-services.json`, `GoogleService-Info.plist`. → sin secretos en `HEAD`; no hay `.env*`, `google-services.json` ni `GoogleService-Info.plist` versionados (ni en el historial). En el **historial** hay un token secreto de Mapbox (10-H1). Claves públicas de cliente como *fallback* en código (10-H6).
- [x] **Permisos iOS:** textos en español solo para los permisos que se usan (ubicación, fotos, cámara si aplica, tracking ATT si hay anuncios personalizados). → `Info.plist` generado con `expo prebuild`: ubicación *when in use*, cámara, fotos y `NSUserTrackingUsageDescription`; sin micrófono, Face ID ni ubicación en segundo plano.
- [x] **Permisos Android:** quitar los que no se usan (p. ej. `RECORD_AUDIO`, ubicación en segundo plano); revisar el `AndroidManifest` final del build, no solo `app.json`. → bloqueado `SYSTEM_ALERT_WINDOW` (10-H8). Lista final más abajo.
- [x] **Target SDK de Android** cumple el mínimo actual exigido por Play. → `targetSdk 36`, `compileSdk 36`, `minSdk 24` (valores por defecto de RN 0.81 / Expo 54).
- [ ] **AdMob:** IDs de app y de bloques de **producción** (no los de test) solo en builds de producción; `app-ads.txt` publicado en el dominio de desarrollador. → App IDs de producción en `app.json` ✅; los builds `preview` también sirven anuncios reales (10-H11, área 11); ⏳ 👤 `app-ads.txt`.
- [x] **Deep links (HALLAZGOS #20):** esquema `matchmap://`; quitar `autoVerify` o configurar App Links/Universal Links con dominio. → quitado el `intentFilter` con `autoVerify` (10-H7).
- [ ] **Iconos y splash:** iOS sin transparencia; icono adaptativo de Android; splash en modo claro y oscuro. → icono iOS sin canal alfa ✅; splash solo claro (la app fuerza `userInterfaceStyle: light`) ✅; icono adaptativo y de notificación por rehacer (10-H9, 10-H10).
- [ ] 💻 **Builds:** `eas build --profile production --platform all` sin warnings bloqueantes; subir a TestFlight y a la pista de prueba interna/cerrada de Play. → pendiente (no se lanzan builds desde esta sesión).

## Criterios de aceptación
- Build de producción de ambas plataformas instalada desde TestFlight y Play (prueba interna) y abre sin errores.

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| 10-H1 | 🔴 | **Token secreto de Mapbox (`sk.`) en el historial de git** de `app.json` (opción `RNMapboxMapsDownloadToken` del plugin `@rnmapbox/maps`, commits de jul-2025 a feb-2026). El repo es **público**, así que hay que darlo por filtrado. No está en `HEAD` y no se copia aquí. | ⏳ 👤 revocarlo en Mapbox (Account › Tokens). Reescribir el historial no basta: el token ya es público |
| 10-H2 | 🟠 | `eas.json` con 9 perfiles y las mismas variables copiadas en cada uno (HALLAZGOS #19). | ✅ quedan `development`, `development-ios-simulator`, `preview` y `production` |
| 10-H3 | 🟠 | `MAPBOX_DOWNLOADS_TOKEN` en `production` y `preview-aab` con un token `pk.`. Ningún paso lo lee (Gradle lee la *propiedad* `MAPBOX_DOWNLOADS_TOKEN` o la variable `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`) y Mapbox ya no exige token para descargar el SDK (`@rnmapbox/maps` 10.3.7). | ✅ eliminado |
| 10-H4 | 🟠 | El autoincremento de iOS solo estaba en `production-ios`; `production` solo incrementaba Android. | ✅ `autoIncrement: true` en `production` (ambas plataformas) |
| 10-H5 | 🟠 | **No hay variables en EAS Environment Variables** (`eas config --profile production` → “No environment variables … found for the production environment”). Al sacarlas de `eas.json`, si no se crean, la app usa los *fallback* de código para Supabase, RevenueCat y el mapa, pero los logos de equipos (`EXPO_PUBLIC_SUPABASE_URL`) y la búsqueda de direcciones (`EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` en `components/AddressSearch.tsx`) se rompen. | ⏳ 👤 crear las variables (tabla siguiente) **antes del próximo build** |
| 10-H6 | 🟡 | Claves públicas de cliente versionadas como *fallback* en `utils/supabase.ts` (anon key), `utils/revenuecat.ts` (claves SDK públicas), `components/Map.tsx` y `hooks/useMapboxDirections.ts` (token `pk.`). No son secretos (van en el bundle) y no requieren rotación, pero conviene quitar los *fallback* cuando existan las variables de EAS. Fuera del alcance de esta área (código de app). | Anotado |
| 10-H7 | 🟡 | `intentFilters` con `autoVerify: true` sobre el esquema `matchmap` (HALLAZGOS #20): no tiene efecto y duplicaba el filtro que ya genera `scheme`. | ✅ eliminado; `matchmap://` sigue registrado (comprobado en el manifest generado) |
| 10-H8 | 🟡 | `SYSTEM_ALERT_WINDOW` (“mostrar sobre otras apps”) en el manifest final sin uso. | ✅ añadido a `blockedPermissions` |
| 10-H9 | 🟡 | Icono de notificación de Android = `assets/icon.png` a color: Android lo pinta como un cuadrado sólido. Hace falta un PNG blanco monocromo con transparencia (96×96). | ⏳ 👤 diseño (relacionado con el área 06) |
| 10-H10 | 🟡 | `adaptiveIcon.foregroundImage` usa `assets/icon.png` (fondo opaco y un cuadrado redondeado dibujado); el dibujo sale de la zona segura (66 %) y los launchers lo recortan. `assets/adaptive-icon.png` es el placeholder de Expo y no se usa. El icono de iOS no tiene alfa ✅, pero lleva un cuadrado redondeado dibujado (doble borde en la pantalla de inicio). | ⏳ 👤 diseño |
| 10-H11 | 🟡 | `constants/ads.ts` sirve anuncios **reales** en cualquier build sin `__DEV__`, incluido `preview` (testers internos). Riesgo de clics inválidos en AdMob. Los App IDs de AdMob de `app.json` son de producción ✅. | Anotado para el área 11 (no se toca código de anuncios) |
| 10-H12 | 🟡 | Con `appVersionSource: remote`, `ios.buildNumber` (12) y `android.versionCode` (17) de `app.json` se ignoran en EAS; el valor real está en EAS. Varios documentos antiguos (`docs/deployment/*`) citan el perfil `production-ios`, que ya no existe. | ⏳ 👤 `eas build:version:get` antes del build; docs antiguos → HALLAZGOS #23 |
| 10-H13 | 🟡 | `submit.production.ios.appleId` (email personal) en un repo público. Se puede quitar y usar una *App Store Connect API Key* (`eas credentials`) para `eas submit`. | Anotado |
| 10-H14 | 🟠 | Package de Android `com.tuorg.matchmap` (placeholder, HALLAZGOS #5). | ⏳ pendiente de D1 (no se toca) |
| 10-H15 | 🟡 | `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` en el manifest final. Se **mantienen**: `expo-image-picker` los pide en Android ≤ 12 (`requestMediaLibraryPermissionsAsync`); bloquearlos rompería la selección de fotos en esos móviles. Mejora posible: limitarlos con `maxSdkVersion="32"` mediante un config plugin. | Anotado |

### Perfiles de `eas.json`

| Perfil | Uso | `environment` |
|---|---|---|
| `development` | Dev client en dispositivo, distribución interna | `development` |
| `development-ios-simulator` | Igual que `development` pero build de simulador iOS (`extends: development`) | `development` |
| `preview` | Build interno para testers (APK en Android, ad hoc en iOS) | `preview` |
| `production` | App Store / Play (AAB), `autoIncrement` | `production` |

Perfiles **borrados**: `preview-ios` (iOS store → usar `production`), `preview2` (APK con `assembleRelease` → usar `preview`), `preview3` (dev client → usar `development`), `preview4` (interno → usar `preview`), `preview-aab` (AAB → usar `production`), `production-ios` (fusionado en `production`) y el perfil de submit `preview-ios`. Se sube `cli.version` a `>= 16.0.0` (soporte del campo `environment`).

### Variables a crear en EAS Environment Variables

Solo nombres (los valores son los que había en el antiguo `eas.json` —siguen en el historial de git— o los de cada panel). Todas las `EXPO_PUBLIC_*` se incrustan en el bundle, así que su visibilidad es **Plain text** (no pueden ser *Secret*).

| Variable | development | preview | production | Nota |
|---|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ | Clave anon/publishable, nunca la `service_role` |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | ✅ | ✅ | ✅ | Token `pk.` restringido por bundle ID / package |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | ✅ | ✅ | ✅ | Clave pública SDK `appl_…` |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | ✅ | ✅ | ✅ | Clave pública SDK `goog_…` |
| `EXPO_PUBLIC_FUNCTIONS_URL` | opcional | opcional | opcional | Estaba en `eas.json`, pero ningún código la lee |
| `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` | — | — | solo si hace falta | **Secret**, token `sk.` **nuevo** con scope `DOWNLOADS:READ`. Solo si el build de Android falla con 401 en el Maven de Mapbox |

Ejemplo: `eas env:create --name EXPO_PUBLIC_SUPABASE_URL --environment production --environment preview --environment development --visibility plaintext` y comprobar con `eas env:list --environment production`.

### Permisos finales de Android

Manifest generado con `npx expo prebuild --platform android --no-install` en una carpeta temporal (no versionado) más los manifests de las librerías nativas:

`ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` (mapa), `CAMERA` (fotos de perfil, bar y publicaciones), `READ_EXTERNAL_STORAGE` y `WRITE_EXTERNAL_STORAGE` (selector de fotos en Android ≤ 12), `POST_NOTIFICATIONS` y `RECEIVE_BOOT_COMPLETED` (push), `AD_ID`, `WAKE_LOCK` y `ACCESS_NETWORK_STATE` (AdMob), `INTERNET`, `VIBRATE` (háptica). Bloqueados: `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`. Sin ubicación en segundo plano.

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=10, nombre=builds-config]
Específico del área: no cambies el package de Android si D1 no está respondida en el README. Limpia
eas.json dejando development/preview/production y documenta en este fichero qué variables hay que
crear en EAS Environment Variables (nombres, no valores). Revisa el AndroidManifest generado
(npx expo prebuild --platform android --no-install en una carpeta temporal) para listar permisos reales.
```

## Registro

### 2026-10-15 · Área 10 · Limpieza de `eas.json`, permisos y deep links de Android
- **Tipo:** código
- **Qué:** `eas.json` pasa de 9 perfiles con variables copiadas a `development`, `development-ios-simulator`, `preview` y `production`, que leen las variables de *EAS Environment Variables* (campo `environment`); `production` con `autoIncrement` en ambas plataformas; fuera `MAPBOX_DOWNLOADS_TOKEN`. En `app.json` se quita el `intentFilter` con `autoVerify` y se bloquea `SYSTEM_ALERT_WINDOW`. Auditoría completa de la checklist (15 hallazgos, ver tabla).
- **Por qué:** HALLAZGOS #19 y #20; 10-H2, 10-H3, 10-H4, 10-H7, 10-H8.
- **Dónde:** rama `audit/10-builds-config`, PR contra `main` (depende de la PR #34).
- **Verificación:** `npx expo prebuild` (Android e iOS) en carpeta temporal y revisión del `AndroidManifest.xml` / `Info.plist` generados; `npx expo-doctor` 18/18; `npm run typecheck` OK; `npm run lint` 0 errores de ESLint (el `prettier -c` sigue fallando en 145 ficheros preexistentes, `app.json` y `eas.json` ya pasan); `npm test` 501/501 (5 suites dieron *timeout* en una primera pasada por carga de la máquina y pasan en `--runInBand`); `npm run test:functions` 39/39.
- **Rollback:** revertir el commit `audit(10)` (vuelven los perfiles con `env` en línea).
- **Quién:** ☁️ nube.

### 2026-10-15 · Área 10 · Pendientes para el usuario (EAS y paneles)
- **Tipo:** panel
- **Qué:** (1) revocar en Mapbox el token `sk.` del historial (10-H1) y restringir el `pk.` de runtime; (2) crear las variables de la tabla en EAS para `development`, `preview` y `production` **antes del próximo build** (10-H5); (3) `eas build:version:get` para confirmar los números de build remotos (10-H12); (4) responder D1 (10-H14); (5) publicar `app-ads.txt`; (6) iconos adaptativo y de notificación (10-H9, 10-H10); (7) build de producción y subida a TestFlight / prueba interna de Play.
- **Por qué:** 10-H1, 10-H5, 10-H9, 10-H10, 10-H12, 10-H14.
- **Dónde:** Mapbox, expo.dev (EAS), App Store Connect, Play Console.
- **Verificación:** `eas env:list --environment production`; build de producción instalada desde TestFlight y Play.
- **Rollback:** n/a.
- **Quién:** 👤 usuario / 💻 local.
