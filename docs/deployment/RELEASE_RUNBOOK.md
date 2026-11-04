# Runbook de release — MatchMap (Expo + EAS)

Esta es la **única** referencia para compilar, enviar y publicar MatchMap en App Store y Google Play. Los documentos antiguos de TestFlight están en [`archive/`](archive/) solo como histórico.

> Última revisión: 2026-10-15 · Expo SDK 54 · eas-cli 24.14 · versión de app `1.0.16`

---

## 1. Mapa del pipeline

| Pieza | Valor | Dónde vive |
|---|---|---|
| Cuenta / proyecto EAS | owner `koala.gost`, slug `matchmap`, projectId `b00dc031-795d-48e3-b948-828096e7382c` | `app.json` → `extra.eas` |
| iOS | bundle `com.tuorg.matchmap` · Team `K2C9W5KCNL` · App Store Connect app `6758625895` | `app.json`, `eas.json` → `submit` |
| Android | package `com.tuorg.matchmap` (**ya publicado en Play: no se puede cambiar**) | `app.json` |
| Versión de marketing | `expo.version` en `app.json` (y `version` en `package.json`, que se mantiene igual) | repo |
| Número de build | **remoto** (`cli.appVersionSource: "remote"`). EAS lo guarda y lo incrementa. `ios.buildNumber` y `android.versionCode` de `app.json` **se ignoran**. | EAS |
| Variables `EXPO_PUBLIC_*` | EAS Environment Variables en `production`, `preview` y `development` | expo.dev → proyecto → Environment variables |
| Certificado y perfil iOS, clave APNs | gestionados por EAS | `eas credentials -p ios` |
| Keystore de subida de Android | gestionado por EAS | `eas credentials -p android` |
| Clave de API de App Store Connect (submit) | EAS (no en el repo) | `eas credentials -p ios` → App Store Connect API Key |
| Cuenta de servicio de Google Play (submit) | EAS (no en el repo) | `eas credentials -p android` → Google Service Account |
| Ficheros nativos `ios/` y `android/` | **ignorados por git** (CNG): EAS hace `prebuild` en cada build a partir de `app.json` | `.gitignore` |

### Variables de entorno (EAS)
Todas son públicas por diseño (van dentro del bundle), así que su visibilidad es *plaintext*. Las mismas 6 están en los tres entornos:

| Nombre | Uso |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase prod (`hmtfxpihkoisncglllmq`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clave anon (la seguridad depende de RLS) |
| `EXPO_PUBLIC_FUNCTIONS_URL` | URL de las edge functions |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | token público `pk.` de Mapbox (restringirlo por bundle/package en el panel de Mapbox) |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | clave pública `appl_` de RevenueCat |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | clave pública `goog_` de RevenueCat |

Comandos:
```bash
eas env:list --environment production
eas env:set --name NOMBRE --value valor --visibility plaintext \
  --environment production --environment preview --environment development --non-interactive
eas env:pull --environment development   # genera .env.local para desarrollo local (no se commitea)
```
⚠️ Mientras `eas.json` siga teniendo bloques `env`, **esos valores tienen prioridad** sobre los de EAS. Si cambias una variable, cámbiala en los dos sitios hasta que se limpie `eas.json` (área 10, R1).

### Perfiles de `eas.json`
| Perfil | Para qué | Estado |
|---|---|---|
| `production` | Tiendas (AAB de Android + IPA de iOS) | ⚠️ Hasta que se aplique R2 del área 10, **solo para Android**: no incrementa el build de iOS. |
| `production-ios` | IPA de iOS para la App Store (incrementa el build) | Usar para iOS hasta que se unifique en `production` |
| `preview` | APK interno de Android | OK |
| `development-ios-simulator`, `preview3` | Dev client | Se unificarán en `development` |
| `preview2`, `preview4`, `preview-aab`, `preview-ios` | Legado | Se borrarán (área 10, R6) |

Perfiles esperados cuando se cierre el área 10: `development`, `preview` y `production`, cada uno con `"environment"`. Cuando se cierre, actualizar esta tabla.

---

## 2. Requisitos previos (una vez por máquina)
```bash
npm i -g eas-cli@latest        # comprobar con: eas --version
eas login                      # cuenta koala.gost
eas whoami
```
- Xcode solo hace falta para builds locales o el simulador; los builds de tienda se hacen en EAS.
- En Xcode 26 `npx expo run:ios` falla con un error de firma: ver [§8](#8-resolución-de-problemas).

---

## 3. Release paso a paso

### 3.1 Antes del build (puertas)
- [ ] `main` actualizado: `git fetch && git switch main && git pull`.
- [ ] `npm ci && npm run typecheck && npm run lint && npm test` en verde.
- [ ] `npx expo-doctor` → 0 problemas.
- [ ] Si se han cambiado dependencias nativas desde el último build: comprobar `npx expo install --check`.
- [ ] Subir la versión de marketing si es una release nueva para el usuario: `expo.version` en `app.json` + `version` en `package.json` (semver; el número de build lo pone EAS).
- [ ] Criterios Go/No-Go de la auditoría (`docs/audit/README.md`, G1–G10) para la **primera** salida a producción.

### 3.2 Build
```bash
# Android (AAB, versionCode autoincremental)
eas build -p android --profile production

# iOS (IPA, buildNumber autoincremental) — production-ios hasta que se aplique R2
eas build -p ios --profile production-ios

# Ambas a la vez, cuando production tenga autoIncrement para iOS
eas build -p all --profile production
```
Comprobar en el log del build:
- en *Environment variables*: aparecen las 6 `EXPO_PUBLIC_*`;
- el número de build es mayor que el último enviado (`eas build:version:get -p all -e production`);
- los warnings de `prebuild` y de Gradle/Xcode no son bloqueantes.

### 3.3 Revisar el binario de Android
```bash
# descargar el .aab desde expo.dev o con: eas build:view <id>
bundletool dump manifest --bundle app.aab | grep -E "uses-permission|targetSdkVersion|package="
```
- `targetSdkVersion` ≥ el mínimo vigente de Play (35 desde ago-2025; SDK 54 genera 36).
- Permisos: solo ubicación, cámara/fotos, notificaciones, `AD_ID` e internet. Sin `RECORD_AUDIO` y sin ubicación en segundo plano.

### 3.4 Envío (submit)
```bash
eas submit -p ios --latest       # → App Store Connect / TestFlight
eas submit -p android --latest   # → Play Console, pista definida en eas.json (internal)
```
- iOS: con la clave de API de App Store Connect configurada en EAS, no pide 2FA. Sin ella, pide el login del Apple ID `submit.production.ios.appleId`.
- Android: necesita la cuenta de servicio de Google Play en EAS (ver §6). La **primera** subida de una app a Play tiene que ser manual; MatchMap ya está en Play, así que no aplica.
- Tras el submit: iOS tarda unos 5–30 min en procesar. En TestFlight hay que contestar la pregunta de cifrado; ya está resuelta con `ITSAppUsesNonExemptEncryption: false`.

### 3.5 Pruebas antes de publicar
1. Instalar desde TestFlight (iOS) y desde la prueba interna de Play (Android) en dispositivos **físicos**.
2. Smoke test: arranque, login (email, Apple, Google), mapa con bares, ficha de bar, favoritos, reseña, push de prueba, paywall de Boost (compra sandbox) y borrar cuenta.
3. La matriz completa es la del área 12 de la auditoría.

### 3.6 Enviar a revisión y publicar
- **App Store Connect:** versión → seleccionar build → notas de la versión → cuenta demo para revisión (D6) → *Enviar a revisión*. Recomendado: *publicación manual* y *publicación por fases* (7 días).
- **Play Console:** promocionar el release de *internal* a *production* → notas de la versión → **lanzamiento escalonado** 20 % → 50 % → 100 % mientras se vigilan los crashes.
- Después: etiquetar el commit: `git tag v1.0.16 && git push origin v1.0.16`.

---

## 4. Hotfix
Sin `expo-updates` (pendiente de decisión, área 10 R8) **no hay OTA**: todo arreglo exige build y revisión.
1. Rama `fix/...` desde el tag publicado → arreglo + test → merge a `main`.
2. Subir la versión patch (`1.0.17`).
3. §3.2–3.6. En App Store Connect se puede pedir *revisión acelerada* si es un crash crítico.

Si se añade `expo-updates`, los hotfixes de JS se publican con `eas update --channel production` sin pasar por revisión. Los cambios nativos siguen necesitando build. Actualizar esta sección al añadirlo.

## 5. Rollback
- **iOS:** no se puede volver a un binario anterior. Hay dos opciones: pausar la publicación por fases (*Pause Phased Release*) o retirar la app de la venta mientras se envía el hotfix.
- **Android:** detener el lanzamiento escalonado (*Halt rollout*) y publicar el hotfix con un versionCode mayor. Play no permite bajar el versionCode.
- **Backend:** los rollbacks de migraciones y edge functions se registran en `docs/audit/REGISTRO.md`.

---

## 6. Credenciales: verificación y renovación
| Credencial | Comprobar | Caduca / renovar |
|---|---|---|
| Certificado de distribución iOS | `eas credentials -p ios` → production | 1 año. EAS ofrece regenerarlo. |
| Perfil de aprovisionamiento | idem | Se regenera con el certificado |
| Clave APNs (push) | idem → *Push Notifications* | No caduca. Necesaria para las push en iOS (área 06). |
| Clave de API de App Store Connect | idem → *App Store Connect API Key* | No caduca. Se crea en ASC → Users and Access → Integrations → App Store Connect API, rol *App Manager*, y el `.p8` se sube a EAS. **Nunca al repo.** |
| Keystore de subida de Android | `eas credentials -p android` → production → Keystore | No caduca. **Su SHA-1 debe coincidir con la *clave de subida* de Play Console** (Configuración → Integridad de la app). Si se pierde, hay que pedir a Google un reset de la clave de subida. |
| Cuenta de servicio de Google Play | idem → *Google Service Account Key* | Se crea en Google Cloud (IAM → Service accounts → clave JSON) y se invita en Play Console → Usuarios y permisos con permiso de *Publicar en pistas de prueba/producción*. El JSON se sube a EAS. **Nunca al repo.** |
| `google-services.json` (FCM Android) | lo lleva el área 06 | Ignorado por git. Recomendado: subirlo como variable de EAS de tipo *file* y referenciarlo en `android.googleServicesFile`; lo decide el área 06 |

Estado verificado de cada credencial: ver §9.

---

## 7. Cuentas y paneles
| Servicio | Para qué |
|---|---|
| expo.dev (`koala.gost/matchmap`) | Builds, variables, credenciales, submits |
| App Store Connect | Ficha, TestFlight, revisión, etiqueta de privacidad |
| Google Play Console | Ficha, pistas, *Data safety*, lanzamiento escalonado |
| RevenueCat | Productos de Boost, webhook → `/functions/v1/revenuecat-webhook` |
| Supabase (`hmtfxpihkoisncglllmq`) | Backend; redirect URLs `matchmap://auth/*` |
| AdMob | IDs de app en `app.json`; bloques de producción en `constants/ads.ts` (en `__DEV__` se usan `TestIds`) |
| Mapbox | Token público de runtime |

---

## 8. Resolución de problemas
| Síntoma | Causa | Solución |
|---|---|---|
| `npx expo run:ios` → `No code signing certificates are available` en el simulador (Xcode 26) | Incompatibilidad de `@expo/cli` con el JSON de `devicectl` | Compilar con `xcodebuild -workspace ios/MatchMap.xcworkspace -scheme MatchMap -configuration Debug -destination "platform=iOS Simulator,id=<UDID>" -derivedDataPath ios/build build`, luego `xcrun simctl install <UDID> ios/build/Build/Products/Debug-iphonesimulator/MatchMap.app` y `xcrun simctl launch <UDID> com.tuorg.matchmap` |
| Crash `SIGABRT` en `WorkletsModule installTurboModule` al abrir | Binario nativo más antiguo que `node_modules` (Reanimated, Worklets, Mapbox…) | Rebuild nativo completo, no solo `expo start` |
| App Store Connect rechaza la subida por *bundle version already used* | El perfil no tiene `autoIncrement` para iOS | Usar `production-ios`, o `eas build:version:set -p ios` y volver a compilar |
| Play rechaza por *versionCode already used* | Lo mismo en Android | `eas build:version:get -p android` / `eas build:version:set` |
| La app abre con pantalla en blanco o con Supabase sin URL | Falta una variable `EXPO_PUBLIC_*` en el entorno del perfil | `eas env:list --environment production`; revisar la sección *Environment variables* del log del build |
| Las compras de Boost no activan el boost | Webhook de RevenueCat con 401 (el secreto no coincide) | Logs de la edge function `revenuecat-webhook`; `docs/payments/` |
| Push no llegan en Android | Falta `google-services.json` / FCM | Área 06 |
| Build de EAS muy lento o en cola | Plan gratuito con prioridad baja | Esperar, o compilar en local con `eas build --local` |

---

## 9. Estado actual (actualizar en cada release)
| Fecha | Elemento | Estado |
|---|---|---|
| 2026-10-15 | eas-cli local | ✅ 24.14.0 |
| 2026-10-15 | EAS Environment Variables (6 × production, preview y development) | ✅ creadas |
| 2026-10-15 | `expo-doctor` | ✅ 18/18 |
| 2026-10-15 | Versión remota | iOS build **11** · Android versionCode **31** |
| 2026-10-15 | Último build iOS de tienda | build 11 (abril 2026): **antiguo**, anterior a SDK 54 y al arreglo de pagos |
| 2026-10-15 | Último build Android de tienda | versionCode 31 (16-ago-2026) |
| 2026-10-15 | Limpieza de `eas.json`/`app.json` (R1–R9) | ⏳ en cola del área 10 (`docs/audit/areas/10-builds-config.md`) |
| 2026-10-15 | Credenciales iOS/Android (caducidad, APNs, SHA-1 del keystore) | ⏳ pendiente de verificar con `eas credentials` |
| 2026-10-15 | Clave de API de ASC y cuenta de servicio de Play en EAS | ⏳ pendiente (hacen falta los ficheros) |
| 2026-10-15 | Build de producción de `main` + TestFlight + prueba interna de Play | ⏳ pendiente |
