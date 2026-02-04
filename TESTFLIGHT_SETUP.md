# 📱 TESTFLIGHT SETUP - MatchMap iOS

## ✅ CAMBIOS APLICADOS

### 1. **app.json - Configuración iOS**
- ✅ Añadido `buildNumber: "1"` (auto-increment habilitado en eas.json)
- ✅ Limpiado duplicados en `LSApplicationQueriesSchemes`
- ✅ Eliminado `package` y `edgeToEdgeEnabled` de `adaptiveIcon` (errores de schema)
- ✅ Añadidos permisos iOS en `infoPlist`:
  - `NSLocationWhenInUseUsageDescription`: "MatchMap uses your location to show nearby bars and sports events on the map."
  - `NSCameraUsageDescription`: "MatchMap needs camera access to let you take photos for your bar profile and posts."
  - `NSPhotoLibraryUsageDescription`: "MatchMap needs access to your photo library to let you select images for your bar profile, menus, and posts."
  - `NSPhotoLibraryAddUsageDescription`: "MatchMap would like to save photos to your photo library."

### 2. **eas.json - Perfil iOS para TestFlight**
- ✅ Creado perfil `production-ios` con:
  - `distribution: "store"` (para TestFlight)
  - `ios.autoIncrement: true` (auto-increment de buildNumber)
  - Todas las variables de entorno necesarias
- ⚠️ **PENDIENTE**: Añadir tu API key de RevenueCat iOS (reemplazar `appl_YOUR_IOS_API_KEY_HERE`)

### 3. **app/edit-bar-info/[barId].tsx - Fix Image Upload**
- ✅ Añadido `requestMediaLibraryPermissionsAsync()` antes de abrir ImagePicker
- ✅ Reemplazado `fetch().blob()` por `FormData` (más compatible con React Native)
- ✅ Mejorado manejo de errores con mensajes detallados

### 4. **Dependencias**
- ✅ Actualizado todas las dependencias a versiones compatibles con Expo SDK 53
- ✅ Instalado `expo-font` (peer dependency requerida)

---

## 📋 CHECKLIST PRE-BUILD

### ✅ Completado
- [x] Configuración iOS en `app.json` correcta
- [x] Permisos iOS declarados y justificados
- [x] buildNumber configurado
- [x] Perfil iOS para TestFlight en `eas.json`
- [x] Dependencias actualizadas
- [x] Fix de imagen upload (permisos + FormData)
- [x] Schema errors resueltos

### ⚠️ PENDIENTE (MANUAL)

#### 1. **RevenueCat iOS API Key**
Debes obtener tu API key de iOS en RevenueCat Dashboard:
1. Ve a: https://app.revenuecat.com/
2. Selecciona tu proyecto "MatchMap"
3. Ve a "API Keys"
4. Copia la key de iOS (formato: `appl_XXXXXX`)
5. Edita `eas.json` línea 82 y 96:
   ```json
   "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY": "appl_TU_KEY_AQUI"
   ```

#### 2. **Configurar productos en RevenueCat**
Antes de hacer el build, asegúrate de:
- Crear los productos en App Store Connect:
  - `lifetime` (Compra única)
  - `boost_7d` (Consumible o No-consumible)
  - `boost_1m` (Consumible o No-consumible)
  - `boost_1y` (Consumible o No-consumible)
- Configurar entitlement `boost_active` en RevenueCat
- Asociar productos con el entitlement

#### 3. **Apple Developer Account**
Requisitos:
- ✅ Apple Developer Program activo ($99/año)
- ✅ Bundle ID: `com.tuorg.matchmap` (ya configurado)
- ⚠️ Crear app en App Store Connect:
  1. Ve a: https://appstoreconnect.apple.com/
  2. "My Apps" → "+" → "Nueva App"
  3. Plataforma: iOS
  4. Nombre: MatchMap
  5. Idioma principal: Español
  6. Bundle ID: `com.tuorg.matchmap`
  7. SKU: `matchmap` (o el que prefieras)
  8. Acceso de usuario: Full Access

#### 4. **Política de Privacidad**
⚠️ **CRÍTICO**: Apple requiere URL de política de privacidad.
- Ya tienes el archivo creado en el repo
- Necesitas hosting público (GitHub Pages, Netlify, etc.)
- Instrucciones en: `INSTRUCCIONES_PRIVACY_POLICY.md`

---

## 🚀 COMANDOS PARA BUILD IOS

### 1. **Build para TestFlight (Primera vez)**
```bash
# Configurar credenciales (EAS managed)
eas credentials

# Build para iOS (TestFlight)
eas build --platform ios --profile production-ios
```

### 2. **Builds posteriores (auto-increment activado)**
```bash
# Solo ejecutar build - el buildNumber se incrementa automáticamente
eas build --platform ios --profile production-ios
```

### 3. **Subir a TestFlight (automático)**
Si configuras `autoSubmit: true` en `eas.json`, se subirá automáticamente.

---

## ⚠️ WARNINGS NO CRÍTICOS

Los siguientes warnings de expo-doctor NO bloquean el build:

1. **react-native-image-viewing** - Unmaintained
   - ✅ Safe: No afecta el build
   - 📌 Considera reemplazar en el futuro

2. **@supabase/auth-helpers-react** - No metadata
   - ✅ Safe: Es un paquete oficial de Supabase
   - 📌 Expo no tiene metadata, pero funciona

---

## 📊 VERSIONES

- **Marketing Version**: `1.0.1` (en `app.json`)
- **iOS Build Number**: `1` (auto-increment activado)
- **Android Version Code**: `3`

Para siguiente build iOS, el buildNumber se incrementará automáticamente a `2`, `3`, etc.

---

## 🔍 VERIFICACIÓN FINAL

Antes de ejecutar `eas build`:

```bash
# 1. Verificar configuración
npx expo config --type public

# 2. Verificar salud del proyecto
npx expo-doctor

# 3. Verificar que compila localmente (opcional)
npx expo prebuild --clean
```

---

## 📝 NOTAS IMPORTANTES

### Bundle ID
- **iOS**: `com.tuorg.matchmap`
- **Android**: `com.tuorg.matchmap`
- ⚠️ NO cambiar sin migrar usuarios

### Distribución
- **TestFlight**: Perfil `production-ios`
- **Interno/Preview**: Perfil `preview4`

### Auto-increment
- Habilitado en perfil `production-ios`
- NO necesitas cambiar `buildNumber` manualmente
- EAS lo incrementa automáticamente en cada build

---

## 🆘 TROUBLESHOOTING

### Error: "Invalid Bundle ID"
- Verifica que el Bundle ID coincida en:
  - `app.json` → `ios.bundleIdentifier`
  - App Store Connect → App
  - Apple Developer → Identifiers

### Error: "Missing entitlements"
- Verifica que los permisos estén en `ios.infoPlist`
- NO uses permisos genéricos

### Error: "Build failed - credentials"
- Ejecuta: `eas credentials`
- Selecciona "iOS" → "Build Credentials" → "Set up"
- EAS generará automáticamente los certificados

### Error: "Version already exists"
- Incrementa `buildNumber` en `app.json`
- O asegúrate de que `autoIncrement: true` esté en el perfil

---

## ✅ LISTO PARA BUILD

Una vez completados los pasos PENDIENTES arriba:

```bash
eas build --platform ios --profile production-ios
```

**¡Buena suerte con tu primera build en TestFlight! 🚀**
