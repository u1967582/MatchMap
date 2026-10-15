# ✅ TESTFLIGHT - CHECKLIST FINAL

## 📊 RESUMEN EJECUTIVO

**Estado**: ✅ **LISTO PARA BUILD** (con tareas manuales pendientes)

**Fecha**: 4 de Febrero de 2026

---

## ✅ CAMBIOS APLICADOS AUTOMÁTICAMENTE

### 1. **app.json - Configuración iOS** ✅
**Archivo**: `/app.json`

**Cambios**:
- ✅ **buildNumber**: Añadido `"1"` (línea 77)
- ✅ **Schema errors**: Eliminado `package` y `edgeToEdgeEnabled` de `android.adaptiveIcon`
- ✅ **LSApplicationQueriesSchemes**: Limpiado duplicados (de 4 a 2 entradas)
- ✅ **Permisos iOS**: Añadidos 4 permisos en `ios.infoPlist`:
  ```json
  "NSLocationWhenInUseUsageDescription": "MatchMap uses your location to show nearby bars and sports events on the map.",
  "NSCameraUsageDescription": "MatchMap needs camera access to let you take photos for your bar profile and posts.",
  "NSPhotoLibraryUsageDescription": "MatchMap needs access to your photo library to let you select images for your bar profile, menus, and posts.",
  "NSPhotoLibraryAddUsageDescription": "MatchMap would like to save photos to your photo library."
  ```

---

### 2. **eas.json - Perfil iOS para TestFlight** ✅
**Archivo**: `/eas.json`

**Cambios**:
- ✅ Creado perfil `production-ios` (líneas 73-96):
  ```json
  "production-ios": {
    "distribution": "store",
    "ios": {
      "autoIncrement": true  // 🔥 Auto-increment de buildNumber
    },
    "env": { /* todas las env vars */ }
  }
  ```
- ⚠️ **PENDIENTE**: Reemplazar `appl_YOUR_IOS_API_KEY_HERE` con tu API key real de RevenueCat
  - **Línea 82**: perfil `production` (Android)
  - **Línea 96**: perfil `production-ios`

---

### 3. **app/edit-bar-info/[barId].tsx - Fix Image Upload** ✅
**Archivo**: `/app/edit-bar-info/[barId].tsx`

**Cambios en 3 funciones**:

#### a) `handleAddBarImage` (línea ~313):
```typescript
// ✅ ANTES: No pedía permisos
const result = await ImagePicker.launchImageLibraryAsync(...);

// ✅ DESPUÉS: Pide permisos primero
const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (status !== 'granted') {
  Alert.alert('Permiso denegado', '...');
  return;
}
const result = await ImagePicker.launchImageLibraryAsync(...);
```

#### b) `handleAddMenuImage` (línea ~336):
```typescript
// ✅ Mismo fix: solicita permisos antes de abrir ImagePicker
```

#### c) `uploadBarImage` (línea ~359):
```typescript
// ✅ ANTES: fetch().blob() - falla en React Native nativo
const response = await fetch(imageUri);
const blob = await response.blob();

// ✅ DESPUÉS: FormData - funciona mejor en iOS/Android
const fileUri = Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri;
const formData = new FormData();
formData.append('file', {
  uri: fileUri,
  type: 'image/jpeg',
  name: fileName,
} as any);
```

**Impacto**: ✅ Las imágenes ahora se suben correctamente en iOS y Android

---

### 4. **Dependencias Actualizadas** ✅

**Actualizaciones aplicadas**:
```bash
✅ expo: 53.0.17 → 53.0.26
✅ expo-router: 5.1.3 → 5.1.11
✅ expo-constants: 17.1.7 → 17.1.8
✅ expo-secure-store: 14.2.3 → 14.2.4
✅ expo-system-ui: 5.0.10 → 5.0.11
✅ react-native: 0.79.5 → 0.79.6
✅ @react-native-community/datetimepicker: 8.4.3 → 8.4.1
✅ expo-font: INSTALADO (peer dependency requerida)
```

**Resultado expo-doctor**: ✅ **15/17 checks passed**

Warnings no críticos (NO bloquean build):
- ⚠️ `react-native-image-viewing` - Unmaintained (safe, funciona)
- ⚠️ `@supabase/auth-helpers-react` - No metadata (safe, es oficial)

---

## ⚠️ TAREAS MANUALES PENDIENTES

### 1. **RevenueCat iOS API Key** 🔑
**CRÍTICO** - Sin esto, los pagos en iOS no funcionarán.

**Pasos**:
1. Ve a: https://app.revenuecat.com/
2. Selecciona proyecto "MatchMap"
3. Ve a "API Keys"
4. Copia la key de **iOS** (formato: `appl_XXXXXX`)
5. Edita `/eas.json`:
   - **Línea 82** (perfil `production`): `"EXPO_PUBLIC_REVENUECAT_IOS_API_KEY": "appl_TU_KEY_AQUI"`
   - **Línea 96** (perfil `production-ios`): `"EXPO_PUBLIC_REVENUECAT_IOS_API_KEY": "appl_TU_KEY_AQUI"`

**Comando para editar**:
```bash
# Abre el archivo y busca: appl_YOUR_IOS_API_KEY_HERE
nano /Users/roger.gost/Documents/repos/MatchMap/eas.json
```

---

### 2. **Crear App en App Store Connect** 🍎
**CRÍTICO** - Necesario para subir a TestFlight.

**Pasos**:
1. Ve a: https://appstoreconnect.apple.com/
2. Click en "My Apps"
3. Click en "+" → "Nueva App"
4. Rellena:
   - **Plataforma**: iOS
   - **Nombre**: MatchMap
   - **Idioma principal**: Español (o el que prefieras)
   - **Bundle ID**: Selecciona `com.tuorg.matchmap` (debe aparecer en la lista)
   - **SKU**: `matchmap` (o el que prefieras, es solo interno)
   - **Acceso de usuario**: Full Access
5. Click en "Crear"

**Verificación**:
- El Bundle ID `com.tuorg.matchmap` debe existir en:
  - Apple Developer → Certificates, IDs & Profiles → Identifiers
  - Si NO existe, créalo primero antes de crear la app

---

### 3. **Configurar Productos en App Store Connect + RevenueCat** 💳
**IMPORTANTE** - Sin esto, los Boost no funcionarán.

#### a) Crear productos en App Store Connect:
1. En App Store Connect, ve a tu app "MatchMap"
2. Ve a "Funciones" → "Compras integradas"
3. Crea 4 productos:

| Product ID | Tipo | Precio Referencia | Nombre |
|------------|------|-------------------|--------|
| `lifetime` | No-Consumible | €49.99 | MatchMap Lifetime |
| `boost_7d` | Consumible | €4.99 | Boost 7 Días |
| `boost_1m` | Consumible | €14.99 | Boost 1 Mes |
| `boost_1y` | Consumible | €99.99 | Boost 1 Año |

**Nota**: Los precios son sugeridos, ajústalos según tu estrategia.

#### b) Configurar RevenueCat:
1. Ve a RevenueCat Dashboard → MatchMap
2. Ve a "Products"
3. Conecta los 4 productos de App Store Connect
4. Ve a "Entitlements"
5. Crea entitlement: `boost_active`
6. Asigna los productos `boost_7d`, `boost_1m`, `boost_1y` al entitlement `boost_active`

---

### 4. **Publicar Política de Privacidad** 📜
**CRÍTICO** - Apple lo requiere obligatoriamente.

**Opciones**:

#### Opción A: GitHub Pages (Recomendado)
Ya tienes el archivo en el repo, pero necesitas hacerlo público:

1. **Opción A1: Hacer repo público** (expone keys, NO recomendado)
2. **Opción A2: Crear repo separado solo para privacy**:
   ```bash
   # Crear nuevo repo público en GitHub: "matchmap-privacy"
   # Subir solo el archivo privacy-policy.html
   # URL final: https://tu-usuario.github.io/matchmap-privacy/
   ```

#### Opción B: Netlify Drop (2 minutos, recomendado) ⚡
Instrucciones completas en: `/INSTRUCCIONES_PRIVACY_POLICY.md`

1. Ve a: https://app.netlify.com/drop
2. Crea carpeta `privacy/` en tu Mac
3. Mueve `privacy-policy.html` → `privacy/index.html`
4. Arrastra la carpeta `privacy/` a Netlify Drop
5. Copia la URL (ej: `https://nombre-aleatorio.netlify.app/`)

#### Opción C: GitHub Gist (30 segundos)
1. Ve a: https://gist.github.com/
2. Filename: `index.html`
3. Pega contenido de `privacy-policy.html`
4. Click "Create public gist"
5. Click botón "Raw"
6. Copia la URL

**Una vez tengas la URL**:
- Guárdala en App Store Connect → App → Información de la App → URL de política de privacidad

---

## 🚀 COMANDOS PARA BUILD

### 1. **Primera build iOS para TestFlight**

```bash
# Paso 1: Configurar credenciales (solo primera vez)
cd /Users/roger.gost/Documents/repos/MatchMap
eas login

# Paso 2: Verificar configuración
npx expo config --type public | grep -A 20 "ios:"

# Paso 3: Build para iOS
eas build --platform ios --profile production-ios

# Paso 4: EAS te pedirá:
# - Crear credenciales automáticas (acepta)
# - Team ID de Apple Developer (si no está configurado)
```

### 2. **Builds posteriores** (buildNumber auto-increment)

```bash
# Solo ejecutar esto - el buildNumber se incrementa solo
eas build --platform ios --profile production-ios
```

---

## 📋 VERIFICACIÓN PRE-BUILD

Antes de ejecutar `eas build`, asegúrate de:

```bash
# 1. ✅ Todas las tareas manuales completadas
# 2. ✅ RevenueCat iOS API key en eas.json
# 3. ✅ App creada en App Store Connect
# 4. ✅ Productos configurados
# 5. ✅ URL de privacidad lista

# Ejecutar validaciones:
cd /Users/roger.gost/Documents/repos/MatchMap

# Check 1: expo-doctor debe pasar >13 checks
npx expo-doctor

# Check 2: Verificar configuración iOS
npx expo config --type public | grep -A 30 "ios:"

# Check 3: Verificar que buildNumber es "1"
grep -A 5 '"ios":' app.json

# Check 4: Verificar perfil production-ios existe
grep -A 15 '"production-ios":' eas.json
```

**Resultado esperado**:
```
✅ expo-doctor: 15/17 checks passed
✅ bundleIdentifier: com.tuorg.matchmap
✅ buildNumber: "1"
✅ Permisos iOS: 4 declarados
✅ Perfil production-ios: existe
```

---

## 📊 VERSIONES FINALES

| Parámetro | Valor | Ubicación |
|-----------|-------|-----------|
| Marketing Version | `1.0.1` | app.json → version |
| iOS Build Number | `1` | app.json → ios.buildNumber |
| Auto-increment | ✅ Habilitado | eas.json → production-ios.ios.autoIncrement |
| Android Version Code | `3` | app.json → android.versionCode |
| Bundle ID (iOS) | `com.tuorg.matchmap` | app.json → ios.bundleIdentifier |
| Package (Android) | `com.tuorg.matchmap` | app.json → android.package |

---

## 📂 ARCHIVOS MODIFICADOS

```
✅ /app.json                                    (iOS config + permisos)
✅ /eas.json                                    (perfil production-ios)
✅ /app/edit-bar-info/[barId].tsx              (fix imagen upload)
✅ /package.json                                (dependencias actualizadas)
✅ /package-lock.json                           (dependencias actualizadas)

📄 /TESTFLIGHT_SETUP.md                        (documentación completa)
📄 /TESTFLIGHT_CHECKLIST_FINAL.md              (este archivo)
📄 /INSTRUCCIONES_PRIVACY_POLICY.md            (instrucciones privacidad)
```

---

## ⚠️ NOTAS IMPORTANTES

### Bundle ID
- **NO cambiar** sin migrar usuarios de RevenueCat
- Ya está configurado y es consistente:
  - iOS: `com.tuorg.matchmap`
  - Android: `com.tuorg.matchmap`

### Auto-increment
- ✅ Habilitado en perfil `production-ios`
- El `buildNumber` se incrementa automáticamente en cada build
- NO necesitas editar `app.json` manualmente para cada build

### Credenciales iOS (EAS Managed)
- EAS generará automáticamente:
  - Distribution Certificate
  - Provisioning Profile
- Solo necesitas:
  - Apple Developer account activo ($99/año)
  - Hacer login con `eas login`

### Builds locales vs EAS
- **EAS Build** (recomendado): En la nube, sin necesidad de Xcode
- **Local Build**: Requiere Xcode instalado (solo para debugging)

---

## 🆘 TROUBLESHOOTING

### Error: "Bundle ID not found"
**Causa**: El Bundle ID `com.tuorg.matchmap` no existe en Apple Developer.

**Solución**:
1. Ve a: https://developer.apple.com/account/resources/identifiers/list
2. Click "+" → "App IDs"
3. Selecciona "App"
4. Description: MatchMap
5. Bundle ID: `com.tuorg.matchmap` (Explicit)
6. Capabilities: selecciona las que uses (In-App Purchase, etc.)
7. Click "Continue" → "Register"

---

### Error: "Invalid build number"
**Causa**: El buildNumber ya existe en App Store Connect.

**Solución**:
- Si `autoIncrement: true` está activado, esto NO debería pasar
- Si pasa, incrementa manualmente en `app.json`:
  ```json
  "buildNumber": "2"  // o el siguiente disponible
  ```

---

### Error: "Missing credentials"
**Causa**: EAS no tiene credenciales configuradas.

**Solución**:
```bash
eas credentials

# Selecciona:
# → iOS
# → Build Credentials
# → Set up build credentials
# → Selecciona "Let EAS create the credentials"
```

---

### Error: "RevenueCat initialization failed"
**Causa**: API key de iOS no configurada o incorrecta.

**Solución**:
1. Verifica que `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` esté en `eas.json`
2. Verifica que empiece por `appl_`
3. Verifica que esté en AMBOS perfiles:
   - `production` (línea 82)
   - `production-ios` (línea 96)

---

### Warning: "react-native-image-viewing unmaintained"
**Causa**: El paquete no está siendo mantenido.

**Solución**:
- ✅ Safe: NO bloquea el build
- 📌 Opcional: Considera reemplazar en el futuro por:
  - `react-native-image-zoom-viewer`
  - `react-native-reanimated-viewer`

---

## ✅ CHECKLIST FINAL (MANUAL)

Antes de ejecutar `eas build --platform ios --profile production-ios`:

- [ ] **RevenueCat iOS API Key** añadida en `eas.json`
- [ ] **App creada** en App Store Connect
- [ ] **Bundle ID** `com.tuorg.matchmap` registrado en Apple Developer
- [ ] **Productos** configurados en App Store Connect (4 productos)
- [ ] **Entitlement** `boost_active` configurado en RevenueCat
- [ ] **Política de privacidad** publicada con URL pública
- [ ] **URL de privacidad** añadida en App Store Connect
- [ ] **Apple Developer Program** activo ($99/año)
- [ ] `eas login` ejecutado y autenticado

---

## 🚀 LISTO PARA BUILD

Una vez completado el checklist arriba:

```bash
cd /Users/roger.gost/Documents/repos/MatchMap

# Build para TestFlight
eas build --platform ios --profile production-ios

# EAS mostrará:
# ✓ Checking project configuration
# ✓ Resolving version
# ✓ Building iOS app
# ✓ Uploading to EAS servers
# ✓ Submitting to App Store Connect (si autoSubmit: true)

# Al final te dará:
# - URL de la build
# - Link para descargar .ipa
# - Si autoSubmit está activado, link a TestFlight
```

---

**¡Todo listo para tu primera build en TestFlight! 🍎🚀**

**Tiempo estimado**:
- Tareas manuales: 15-30 minutos
- Build en EAS: 15-25 minutos
- Processing en App Store Connect: 5-10 minutos
- **Total**: ~45-65 minutos hasta TestFlight

**Preguntas?** Revisa:
- `/TESTFLIGHT_SETUP.md` - Documentación completa
- `/INSTRUCCIONES_PRIVACY_POLICY.md` - Privacidad
- Este archivo - Checklist rápido
