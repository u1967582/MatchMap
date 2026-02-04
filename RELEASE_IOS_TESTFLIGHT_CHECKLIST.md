# 🚀 CHECKLIST FINAL - RELEASE iOS TestFlight

**Fecha**: 4 de Febrero de 2026  
**App**: MatchMap  
**Bundle ID**: `com.tuorg.matchmap`  
**Versión**: `1.0.1` (Build: `1`)

---

## 📊 ESTADO GENERAL

```
┌─────────────────────────────────────────────────────────────┐
│  PREPARACIÓN TESTFLIGHT - MatchMap iOS                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ✅ COMPLETADO AUTOMÁTICAMENTE:                             │
│    • Código preparado y sin errores                         │
│    • app.json configurado (iOS + permisos)                  │
│    • eas.json con perfil production-ios                     │
│    • Dependencias actualizadas (Expo SDK 53)                │
│    • Fix imagen upload aplicado                             │
│    • Documentación creada (4 archivos)                      │
│                                                              │
│  ⚠️ PENDIENTE (TAREAS MANUALES):                            │
│    • Obtener API key RevenueCat iOS                         │
│    • Crear app en App Store Connect                         │
│    • Configurar productos (4)                               │
│    • Publicar política de privacidad                        │
│    • Ejecutar build de iOS                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ PASO 1: REVISAR CÓDIGO Y CONFIGURACIÓN

### 1.1 Archivos de Configuración ✅
- [x] **app.json**:
  - [x] `ios.bundleIdentifier`: `com.tuorg.matchmap`
  - [x] `ios.buildNumber`: `"1"`
  - [x] `ios.infoPlist`: 4 permisos declarados
  - [x] `version`: `"1.0.1"`

- [x] **eas.json**:
  - [x] Perfil `production-ios` existe
  - [x] `distribution`: `"store"`
  - [x] `ios.autoIncrement`: `true`
  - [x] Env vars configuradas (⚠️ falta API key iOS)

- [x] **package.json**:
  - [x] Dependencias actualizadas (Expo SDK 53)
  - [x] Sin vulnerabilidades críticas

### 1.2 Código RevenueCat ✅
- [x] `utils/revenuecat.ts`: Configurado para iOS + Android
- [x] `contexts/RevenueCatContext.tsx`: Provider funcional
- [x] Entitlement `boost_active` definido
- [x] Platform.select para keys de iOS/Android

### 1.3 Validaciones ✅
```bash
# Ejecutar validaciones:
cd /Users/roger.gost/Documents/repos/MatchMap

# ✅ expo-doctor: 15/17 checks passed (warnings no críticos)
npx expo-doctor

# ✅ Linter: Sin errores
# (ya verificado)

# ✅ Configuración pública:
npx expo config --type public | grep -A 20 "ios:"
```

---

## ⚠️ PASO 2: CONFIGURAR REVENUECAT

### 2.1 Obtener API Key de iOS
1. **Ve a**: https://app.revenuecat.com/login
2. **Login** con tu cuenta
3. **Selecciona** proyecto "MatchMap"
4. **Click en** "API Keys" (sidebar)
5. **Copia** la key de **iOS** (formato: `appl_XXXXXX`)

### 2.2 Añadir Key en eas.json
**Opción A: Hardcodear** (rápido, menos seguro):
```bash
nano /Users/roger.gost/Documents/repos/MatchMap/eas.json

# Buscar línea 72 y 85:
# Reemplazar: "appl_YOUR_IOS_API_KEY_HERE"
# Por: "appl_TU_KEY_REAL_AQUI"

# Guardar: Ctrl+O, Enter, Ctrl+X
```

**Opción B: Usar EAS Secrets** (recomendado):
```bash
# Configurar secret
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_TU_KEY_AQUI --type string

# En eas.json, dejar el placeholder (EAS lo reemplazará automáticamente)
```

**Verificar**:
```bash
# Buscar la key en eas.json:
grep "REVENUECAT_IOS_API_KEY" eas.json

# Debería mostrar la key real o el placeholder (si usas secrets)
```

### 2.3 Actualizar IDs de Productos en el Código
**Editar** `/utils/revenuecat.ts`:
```bash
nano /Users/roger.gost/Documents/repos/MatchMap/utils/revenuecat.ts

# Buscar: export const PRODUCT_IDS
# Actualizar a:
export const PRODUCT_IDS = {
  LIFETIME: 'lifetime',
  BOOST_7D: 'boost_7d',      // ← AÑADIR
  BOOST_1M: 'boost_1m',      // ← AÑADIR
  BOOST_1Y: 'boost_1y',      // ← AÑADIR
} as const;

# Guardar
```

**Documentación**: Ver `REVENUECAT_IOS_SETUP.md` para config completa

---

## ⚠️ PASO 3: CREAR APP EN APP STORE CONNECT

### 3.1 Verificar Bundle ID existe
1. **Ve a**: https://developer.apple.com/account/resources/identifiers/list
2. **Busca**: `com.tuorg.matchmap`
3. **Si NO existe**: Créalo (ver `APP_STORE_CONNECT_SETUP.md` Paso 1.2)

### 3.2 Crear App
1. **Ve a**: https://appstoreconnect.apple.com/
2. **My Apps** → **"+"** → **"Nueva app"**
3. **Rellena**:
   - Plataforma: **iOS**
   - Nombre: **MatchMap**
   - Idioma: **Español**
   - Bundle ID: **com.tuorg.matchmap** (seleccionar de lista)
   - SKU: **matchmap**
4. **Click** en "Crear"

### 3.3 Configuración Básica
1. **Categoría**: Comida y bebida (o Viajes)
2. **Precio**: Gratis
3. **Disponibilidad**: España (o los países que quieras)
4. **TestFlight Info**: Rellena qué testear

**Documentación completa**: Ver `APP_STORE_CONNECT_SETUP.md`

---

## ⚠️ PASO 4: CONFIGURAR PRODUCTOS IAP

### 4.1 Crear 4 Productos en App Store Connect
**En App Store Connect** → MatchMap → Funciones → Compras integradas:

| Product ID | Tipo | Precio | Nombre |
|------------|------|--------|--------|
| `lifetime` | No-Consumible | €49.99 | MatchMap Lifetime |
| `boost_7d` | Consumible | €4.99 | Boost 7 Días |
| `boost_1m` | Consumible | €14.99 | Boost 1 Mes |
| `boost_1y` | Consumible | €99.99 | Boost 1 Año |

⚠️ **CRÍTICO**: Los IDs deben coincidir EXACTAMENTE con el código

### 4.2 Configurar RevenueCat
1. **Conectar App Store Connect** con RevenueCat (API key)
2. **Añadir productos** en RevenueCat
3. **Crear entitlement**: `boost_active`
4. **Asociar productos** al entitlement (boost_7d, boost_1m, boost_1y)
5. **Crear offering**: `default`
6. **Añadir packages** al offering (4 packages)
7. **Marcar offering** como "Current"

**Guía completa**: Ver `REVENUECAT_IOS_SETUP.md`

---

## ⚠️ PASO 5: PUBLICAR POLÍTICA DE PRIVACIDAD

### 5.1 Seleccionar Método
**Opción A: GitHub Pages** (recomendado):
- URL final: `https://TU-USUARIO.github.io/matchmap-privacy/`
- Ver `PRIVACY_POLICY_PUBLISH.md` Opción 1

**Opción B: Netlify** (más rápido):
- URL final: `https://matchmap-privacy.netlify.app/`
- Ver `PRIVACY_POLICY_PUBLISH.md` Opción 2

### 5.2 Publicar
```bash
# Archivo ya creado en: /privacy/privacy-policy.html

# Seguir instrucciones según método elegido en:
# PRIVACY_POLICY_PUBLISH.md
```

### 5.3 Verificar URL
```bash
# En navegador, abrir la URL y verificar que funciona:
# https://TU-URL-AQUI/

# Debe mostrar la política de privacidad formateada
```

### 5.4 Añadir URL en App Store Connect
1. **App Store Connect** → MatchMap → Información de la app
2. **URL de política de privacidad**: Pegar tu URL pública
3. **Guardar**

---

## 🚀 PASO 6: EJECUTAR BUILD DE IOS

### 6.1 Pre-build Checklist
```bash
cd /Users/roger.gost/Documents/repos/MatchMap

# ✅ Verificar que estás logueado en EAS
eas whoami

# Si NO estás logueado:
eas login
```

### 6.2 Configurar Credenciales (Primera vez)
```bash
# Configurar credenciales iOS
eas credentials

# Seleccionar:
# → iOS
# → Build Credentials
# → Set up build credentials
# → Seleccionar "Let EAS create the credentials" (recomendado)
```

### 6.3 Ejecutar Build
```bash
# Build para TestFlight
eas build --platform ios --profile production-ios

# EAS te preguntará:
# ✓ "Generate a new Apple Distribution Certificate?" → Yes
# ✓ "Generate a new Apple Provisioning Profile?" → Yes
# ✓ Confirmación de build → Yes

# ⏱️ Tiempo estimado: 15-25 minutos
```

### 6.4 Seguir el Progreso
```bash
# La build se ejecuta en la nube (EAS)
# Puedes cerrar la terminal si quieres

# Para ver el progreso:
# 1. Ve a la URL que te dio EAS
# 2. O ejecuta:
eas build:list --platform ios

# Estados posibles:
# - IN_QUEUE: En cola
# - IN_PROGRESS: Compilando
# - FINISHED: ✅ Completado
# - ERRORED: ❌ Error
```

### 6.5 Descargar Build (Opcional)
```bash
# Una vez completada, descargar .ipa:
eas build:download --platform ios --latest

# O desde la URL de EAS Dashboard
```

---

## ✅ PASO 7: SUBIR A TESTFLIGHT

### 7.1 Subida Automática (Recomendado)
Si configuraste `autoSubmit: true` en eas.json:
- ✅ EAS sube automáticamente a App Store Connect
- ⏱️ Processing en Apple: 5-10 minutos
- ✅ Aparece en TestFlight automáticamente

### 7.2 Subida Manual (Si autoSubmit no está configurado)
1. **Descargar .ipa** de EAS
2. **Abrir Transporter** (macOS App Store):
   - Arrastra el .ipa a Transporter
   - Click "Deliver"
3. **Esperar processing** en App Store Connect

### 7.3 Verificar en App Store Connect
1. **Ve a**: App Store Connect → MatchMap → TestFlight
2. **Builds** → Verifica que aparece tu build
3. **Estado**: Processing → Ready to Test
4. **⏱️ Tiempo**: 5-10 minutos

---

## ✅ PASO 8: AÑADIR TESTERS Y DISTRIBUIR

### 8.1 Aprobar Build (Si requiere)
Algunos builds requieren aprobación de encriptación:
1. **En TestFlight**, si aparece "Missing Compliance"
2. **Click en** el build
3. **Responde** el cuestionario (la mayoría de respuestas serán "No")
4. **Submit**

### 8.2 Añadir Testers Internos
1. **TestFlight** → **Testers Internos**
2. **"+"** → Selecciona miembros de tu equipo
3. **Add**
4. ✅ Recibirán email automático con link de TestFlight

### 8.3 Añadir Testers Externos (Opcional)
1. **TestFlight** → **Grupos de prueba externos**
2. **"+"** → Crear grupo (ej: "Beta Testers")
3. **Añadir testers** (hasta 10,000)
4. **Submit for Review** (Apple revisa, 24-48h)

### 8.4 Probar la App
1. **Instala TestFlight** en iPhone/iPad
2. **Abre el email** de invitación
3. **Click en** "View in TestFlight"
4. **Instala** MatchMap
5. **Testa** funcionalidades:
   - ✅ Login / Registro
   - ✅ Mapa y ubicación
   - ✅ Búsqueda de bares
   - ✅ Subida de imágenes
   - ✅ Compra de Boost (con sandbox tester)

---

## 📋 CHECKLIST FINAL (ANTES DE BUILD)

Marca cada item antes de ejecutar `eas build`:

### Configuración
- [ ] **API key RevenueCat iOS** añadida en `eas.json`
- [ ] **App creada** en App Store Connect
- [ ] **Bundle ID** registrado: `com.tuorg.matchmap`
- [ ] **4 productos** creados en App Store Connect
- [ ] **RevenueCat** configurado (productos, entitlement, offering)
- [ ] **Política de privacidad** publicada con URL pública
- [ ] **URL de privacidad** añadida en App Store Connect
- [ ] **IDs de productos** actualizados en `utils/revenuecat.ts`

### Código
- [ ] **No hay errores** de linting
- [ ] **Dependencias** actualizadas (expo-doctor OK)
- [ ] **app.json** correcto (bundleID, buildNumber, permisos)
- [ ] **eas.json** correcto (perfil production-ios)

### Apple Developer
- [ ] **Apple Developer Program** activo ($99/año pagado)
- [ ] **EAS login** completado (`eas whoami` funciona)
- [ ] **Credenciales** configuradas (o listas para generar)

---

## 🎯 COMANDO FINAL

```bash
# Una vez completado TODO el checklist arriba:

cd /Users/roger.gost/Documents/repos/MatchMap
eas build --platform ios --profile production-ios
```

---

## ⏱️ TIEMPOS ESTIMADOS

| Paso | Tiempo |
|------|--------|
| **Configuración previa** (pasos 2-5) | 30-45 min |
| **Build en EAS** (paso 6) | 15-25 min |
| **Processing en Apple** (paso 7) | 5-10 min |
| **Distribución TestFlight** (paso 8) | 5 min |
| **TOTAL** | ~60-85 min |

---

## 🆘 TROUBLESHOOTING

### Error: "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY not found"
**Solución**: Verifica que la key esté en `eas.json` líneas 72 y 85

### Error: "Bundle identifier not found"
**Solución**: Crea el Bundle ID en Apple Developer Portal (Paso 3.1)

### Error: "Missing credentials"
**Solución**: Ejecuta `eas credentials` y deja que EAS los genere

### Error: "Build failed - Mapbox"
**Solución**: Verifica que `RNMapboxMapsDownloadToken` esté en `app.json`

### Build OK pero no aparece en TestFlight
**Solución**: Espera 10 minutos. Si sigue sin aparecer, revisa "Activity" en App Store Connect

---

## 📚 DOCUMENTACIÓN CREADA

| Archivo | Descripción |
|---------|-------------|
| `REVENUECAT_IOS_SETUP.md` | Config completa RevenueCat + productos |
| `APP_STORE_CONNECT_SETUP.md` | Crear app en App Store Connect |
| `PRIVACY_POLICY_PUBLISH.md` | Publicar política de privacidad |
| `RELEASE_IOS_TESTFLIGHT_CHECKLIST.md` | Este archivo (checklist final) |
| `TESTFLIGHT_SETUP.md` | Setup general TestFlight |
| `TESTFLIGHT_CHECKLIST_FINAL.md` | Checklist ejecutivo |
| `CAMBIOS_APLICADOS.md` | Resumen de cambios aplicados |

---

## ✅ SIGUIENTE PASO

**Una vez hayas completado el checklist arriba:**

```bash
cd /Users/roger.gost/Documents/repos/MatchMap
eas build --platform ios --profile production-ios
```

**¡Buena suerte con tu primera build en TestFlight! 🍎🚀**

---

**Soporte**: Si tienes problemas, revisa `TESTFLIGHT_SETUP.md` o la documentación de Expo EAS Build.
