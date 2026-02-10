# 🚀 APK Crash Fix - Build Production Ready

## ❌ **Problema Original**
La app se abría y cerraba inmediatamente al instalarla desde Google Play debido a:
1. Variables de entorno faltantes (Supabase)
2. RevenueCat bloqueando la app si fallaba la inicialización

---

## ✅ **Soluciones Aplicadas**

### **1. Fix en `utils/supabase.ts`**
- ✅ Añadidos valores por defecto para Supabase URL y Anon Key
- ✅ La app ya NO crasheará si faltan las variables de entorno
- ✅ Se muestra un warning en consola si se usan valores fallback

**Antes:**
```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables'); // ❌ CRASH
}
```

**Después:**
```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hmtfxpihkoisncglllmq.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGci...';

// Log warning if using fallback values
if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
  console.warn('⚠️ Using fallback Supabase URL');
}
```

---

### **2. Fix en `contexts/RevenueCatContext.tsx`**
- ✅ La app NO se bloquea si RevenueCat falla al inicializar
- ✅ Se marca como inicializado INCLUSO si hay error
- ✅ Se muestra pantalla de carga en lugar de pantalla en blanco

**Antes:**
```typescript
} catch (error) {
  console.error('Failed to initialize RevenueCat:', error);
  // ❌ NO se marcaba como inicializado → return null → pantalla en blanco
} finally {
  setIsLoading(false);
}

if (!isInitialized) {
  return null; // ❌ Pantalla en blanco = parece crash
}
```

**Después:**
```typescript
} catch (error) {
  console.error('Failed to initialize RevenueCat:', error);
  // ✅ Se marca como inicializado AUNQUE FALLE
} finally {
  setIsInitialized(true); // ← MOVED HERE
  setIsLoading(false);
}

if (!isInitialized) {
  return ( // ✅ Pantalla de carga visible
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C2A3A' }}>
      <ActivityIndicator size="large" color="#1976D2" />
      <Text style={{ color: '#FFFFFF', marginTop: 16 }}>Iniciando MatchMap...</Text>
    </View>
  );
}
```

---

### **3. Fix en `eas.json`**
- ✅ Variables de entorno ahora se incluyen en TODOS los perfiles de build
- ✅ Ya no depende SOLO del archivo `.env` local

**Añadido a todos los perfiles:**
```json
"env": {
  "EXPO_PUBLIC_SUPABASE_URL": "https://hmtfxpihkoisncglllmq.supabase.co",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJ...",
  "EXPO_PUBLIC_FUNCTIONS_URL": "https://hmtfxpihkoisncglllmq.functions.supabase.co",
  "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN": "pk.eyJ..."
}
```

---

## 🎯 **Próximos Pasos para Testing**

### **PASO 1: Recompilar la APK**
```bash
# Opción A: Build con EAS (Recomendado)
eas build --platform android --profile preview

# Opción B: Build local (más rápido para testing)
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

### **PASO 2: Instalar y Verificar**
```bash
# Si usas EAS, descarga la APK y súbela a Google Play

# Si usas build local, instala directamente:
adb install android/app/build/outputs/apk/release/app-release.apk
```

### **PASO 3: Ver Logs en Tiempo Real**
```bash
# Conecta el dispositivo o usa el emulador
adb logcat | grep -E "ReactNative|MatchMap|Supabase|RevenueCat"
```

**Busca estos mensajes:**
- ✅ `Supabase client initialized successfully`
- ✅ `RevenueCat initialized` o `Failed to initialize RevenueCat` (pero sin crash)
- ✅ `Iniciando MatchMap...` (pantalla de carga)
- ❌ NO deberías ver: `Missing Supabase environment variables`

---

## 📋 **Checklist de Verificación**

- [x] ✅ `utils/supabase.ts` tiene valores por defecto
- [x] ✅ `contexts/RevenueCatContext.tsx` NO bloquea la app
- [x] ✅ `eas.json` incluye variables de entorno en todos los perfiles
- [ ] 🔄 Recompilar APK con `eas build` o local build
- [ ] 🔄 Instalar en dispositivo de prueba
- [ ] 🔄 Verificar que la app se abre sin crashear
- [ ] 🔄 Verificar logs con `adb logcat`
- [ ] 🔄 Subir a Google Play Console para testing interno

---

## ⚠️ **Notas Importantes**

### **Seguridad de las Claves**
- Las claves de Supabase Anon Key son **públicas por diseño** (van en el cliente)
- Las claves de Mapbox Access Token también son **públicas**
- NO pongas claves secretas (como Service Role Key) en el código o `eas.json`

### **Para Producción Final**
En el futuro, considera usar EAS Secrets para mayor seguridad:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
```

Y en `eas.json`:
```json
"env": {
  "EXPO_PUBLIC_SUPABASE_URL": "$EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY": "$EXPO_PUBLIC_SUPABASE_ANON_KEY"
}
```

---

## 🎉 **Resultado Esperado**

✅ La app ya NO crasheará al abrirse  
✅ Verás la pantalla de carga "Iniciando MatchMap..."  
✅ La app cargará correctamente incluso si RevenueCat falla  
✅ Podrás navegar por la app sin problemas  

---

## 🆘 **Si Aún Hay Problemas**

### **1. Ver logs detallados:**
```bash
adb logcat -c  # Limpiar logs anteriores
adb logcat | grep -E "FATAL|ERROR|ReactNative|MatchMap"
```

### **2. Verificar que las variables se cargaron:**
Añade esto temporalmente en `App.tsx` o `_layout.tsx`:
```typescript
console.log('ENV CHECK:', {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  hasAnonKey: !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  mapboxToken: !!process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
});
```

### **3. Build limpio:**
```bash
# Limpiar caché y recompilar
rm -rf android/build android/app/build
cd android && ./gradlew clean
cd .. && eas build --platform android --profile preview --clear-cache
```

---

**Fecha:** 2026-02-03  
**Estado:** ✅ Fixes aplicados, listo para recompilar y testear
