# 🔧 Fix: Safari Error al Abrir Google OAuth

## Problema

Cuando intentas hacer login con Google, Safari se abre y muestra un error de conexión en lugar de abrir un navegador embebido.

## ✅ Solución Implementada

He actualizado `utils/auth.ts` para usar el **método robusto** con `WebBrowser.openAuthSessionAsync()` que abre un navegador embebido en lugar de Safari nativo.

---

## 📋 Cambios Realizados

### 1. **utils/auth.ts** - Método Robusto

**Cambios clave:**

- ✅ Añadido `import * as AuthSession from 'expo-auth-session'`
- ✅ Añadida función `getRedirectUrl()` para generar URLs correctas por entorno
- ✅ Actualizado `signInWithGoogle()` para usar:
  - `skipBrowserRedirect: true` en la llamada a Supabase
  - `WebBrowser.openAuthSessionAsync()` para abrir navegador embebido
  - Parseo manual de tokens del callback
  - `setSession()` manual para establecer la sesión
- ✅ Retorna objeto `{ success, error, session }` en lugar de `data`

### 2. **screens/LoginScreen.tsx** - Handler Actualizado

**Cambios:**

- ✅ Actualizado `handleGoogleLogin()` para manejar el nuevo formato de respuesta
- ✅ Añadidos logs detallados
- ✅ Manejo de errores mejorado

---

## 🔄 Cómo Funciona Ahora

### Flujo Anterior (Problemático):

```
1. signInWithGoogle() → Obtiene URL
2. Linking.openURL() → Abre Safari NATIVO ❌
3. Safari intenta redirigir → Error de conexión ❌
```

### Flujo Nuevo (Robusto):

```
1. signInWithGoogle() → Obtiene URL con skipBrowserRedirect: true
2. WebBrowser.openAuthSessionAsync() → Abre navegador EMBEBIDO ✅
3. Usuario autoriza en el navegador embebido
4. Callback con tokens en la URL
5. Parseo manual de tokens
6. setSession() establece la sesión en Supabase
7. useAuthStateChange detecta SIGNED_IN
8. Navegación automática al mapa ✅
```

---

## ⚠️ Prerequisitos

Asegúrate de tener estas dependencias instaladas:

```bash
npx expo install expo-auth-session expo-crypto expo-web-browser
```

**Verificar en package.json:**

```json
{
  "dependencies": {
    "expo-auth-session": "~6.2.1",
    "expo-crypto": "^13.0.2",
    "expo-web-browser": "~14.2.0"
  }
}
```

---

## 📱 Testing

### 1. Limpiar y Rebuild

```bash
# Limpiar cache
rm -rf node_modules .expo

# Reinstalar
npm install

# Rebuild (crítico después de cambios en OAuth)
npx expo prebuild --clean

# Iniciar
npx expo start --dev-client
```

### 2. Probar en iOS Simulator

```bash
# Presionar 'i' en la terminal o:
npx expo run:ios
```

### 3. Flujo de Prueba

1. Abre la app
2. Ve a la pantalla de Login
3. Click en "Continuar con Google"
4. **Observa la consola** - deberías ver:
   ```
   🔐 Iniciando Google OAuth (método robusto)...
      Platform: ios
      Environment: Development
   🔗 Dev Redirect URL: exp://...
   ✅ Redirect URL configurada
   ✅ Authorization URL received
   🌐 Opening embedded browser...
   ```
5. **Navegador embebido se abre** (NO Safari nativo)
6. Selecciona tu cuenta de Google
7. Autoriza la app
8. **Deberías ver en consola:**
   ```
   📱 Browser result type: success
   ✅ Success! Received callback URL
   ✅ Tokens extracted from URL
   🔄 Setting session in Supabase...
   ✅ Session established successfully!
      User: tu-email@gmail.com
      User ID: [UUID]
      Provider: google
   ```
9. La app redirige automáticamente al mapa

---

## 🐛 Troubleshooting

### Problema 1: Todavía abre Safari

**Síntomas:** Safari nativo se abre en lugar del navegador embebido

**Causas posibles:**
- No hiciste rebuild después de los cambios
- Caché de Expo no se limpió

**Solución:**

```bash
# Limpiar COMPLETAMENTE
rm -rf node_modules
rm -rf .expo
rm -rf ios
rm -rf android

# Reinstalar
npm install

# Rebuild desde cero
npx expo prebuild --clean

# Iniciar en modo dev client
npx expo start --dev-client

# Abrir en iOS
# Presiona 'i' en la terminal
```

### Problema 2: "No tokens received in callback URL"

**Síntomas:** Navegador embebido se abre, autorizas, pero falla al volver

**Causa:** Redirect URL no coincide con la configurada en Supabase

**Solución:**

1. **Ejecuta la app y mira los logs:**
   ```
   🔗 Dev Redirect URL: exp://192.168.1.x:8081/--/auth/callback
   ```

2. **Copia esa URL exacta**

3. **Ve a Supabase Dashboard → Authentication → URL Configuration**

4. **En "Redirect URLs" añade:**
   ```
   exp://192.168.1.x:8081/--/auth/callback
   exp://localhost:8081/--/auth/callback
   exp://127.0.0.1:8081/--/auth/callback
   matchmap://auth/callback
   ```

5. **Guarda y vuelve a probar**

### Problema 3: "OAuth Error: ... not enabled"

**Síntomas:** Error inmediato al hacer click

**Causa:** Google OAuth no está habilitado en Supabase

**Solución:**

1. **Supabase Dashboard → Authentication → Providers**
2. **Busca "Google"**
3. **Enable: ✅**
4. **Client ID: [Web Client ID de Google Cloud Console]**
5. **Client Secret: [Secret de Google Cloud Console]**
6. **Save**

### Problema 4: Funciona en dev pero no en producción

**Síntomas:** Funciona en `npx expo start --dev-client` pero falla en builds de producción

**Causa:** Redirect URL de producción no configurada

**Solución:**

1. **En `getRedirectUrl()` (ya implementado):**
   ```typescript
   if (__DEV__) {
     return makeRedirectUri({ scheme: 'matchmap', path: 'auth/callback' });
   } else {
     return 'matchmap://auth/callback'; // Producción
   }
   ```

2. **En Supabase, añadir URL de producción:**
   ```
   matchmap://auth/callback
   ```

3. **En Google Cloud Console, añadir en el Web Client ID:**
   ```
   https://[PROJECT-REF].supabase.co/auth/v1/callback
   matchmap://auth/callback
   ```

### Problema 5: "Session Error: ..."

**Síntomas:** Tokens se reciben pero falla al establecer sesión

**Causa:** Tokens inválidos o expirados

**Debug:**

```typescript
// Añade esto temporalmente en auth.ts después de extraer tokens:
console.log('🔍 DEBUG - Callback URL completa:', result.url);
console.log('🔍 DEBUG - Access Token:', accessToken);
console.log('🔍 DEBUG - Refresh Token:', refreshToken);
```

**Solución:**
- Verifica que los tokens no estén corruptos
- Asegúrate de que el Client ID/Secret en Supabase sean correctos
- Regenera las credenciales en Google Cloud Console si es necesario

---

## 📊 Logs Esperados (Flujo Exitoso)

```
// 1. Inicio
🚀 Starting Google sign in from LoginScreen...
🔐 Iniciando Google OAuth (método robusto)...
   Platform: ios
   Environment: Development

// 2. Configuración
🔗 Dev Redirect URL: exp://192.168.1.100:8081/--/auth/callback
✅ Redirect URL configurada

// 3. URL de autorización
✅ Authorization URL received
   URL preview: https://accounts.google.com/o/oauth2/v2/auth?client_id=...

// 4. Navegador embebido
🌐 Opening embedded browser...

// [Usuario autoriza en el navegador embebido]

// 5. Callback exitoso
📱 Browser result type: success
✅ Success! Received callback URL
✅ Tokens extracted from URL
   Access Token: eyJhbGciOiJIUzI1NiI...
   Refresh Token: v1.MXBw3k5YqZ...

// 6. Establecer sesión
🔄 Setting session in Supabase...
✅ Session established successfully!
   User: usuario@gmail.com
   User ID: a1b2c3d4-...
   Provider: google

// 7. Navegación
✅ Google sign in successful!
   User: usuario@gmail.com
📡 Auth event: SIGNED_IN
✅ Usuario autenticado: usuario@gmail.com
   Provider: google
   User ID: a1b2c3d4-...
🗺️  Redirigiendo al mapa...
```

---

## ✅ Verificación Final

Después de implementar, verifica:

- [ ] Navegador **embebido** se abre (no Safari nativo)
- [ ] Puedes ver la pantalla de login de Google
- [ ] Puedes seleccionar tu cuenta
- [ ] Después de autorizar, **vuelve automáticamente a la app**
- [ ] Ves logs de "Session established successfully"
- [ ] La app te lleva al mapa
- [ ] Si cierras y abres la app, sigues logueado

---

## 🎯 Diferencias Clave

| Aspecto | Método Anterior | Método Nuevo (Robusto) |
|---------|----------------|------------------------|
| **Navegador** | Safari nativo ❌ | Navegador embebido de Expo ✅ |
| **skipBrowserRedirect** | false (default) | **true** ⚠️ |
| **Apertura** | `Linking.openURL()` | `WebBrowser.openAuthSessionAsync()` |
| **Tokens** | Automático | **Parseo manual** |
| **Sesión** | Automática | **`setSession()` manual** |
| **Control** | Limitado | Total ✅ |

---

## 🔗 URLs a Configurar en Supabase

### Development

```
exp://localhost:8081/--/auth/callback
exp://127.0.0.1:8081/--/auth/callback
exp://[TU-IP-LOCAL]:8081/--/auth/callback
```

**Cómo obtener tu IP:**

```bash
# En la terminal donde corre expo:
# Verás algo como: exp://192.168.1.100:8081

# O ejecuta:
ipconfig getifaddr en0  # macOS
```

### Production

```
matchmap://auth/callback
```

---

## 📚 Referencias

- [Expo WebBrowser](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
- [Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Supabase OAuth Mobile](https://supabase.com/docs/guides/auth/social-login/auth-google#mobile-app)

---

## ✨ Resultado

Con esta implementación:

✅ **Safari error eliminado** - Usa navegador embebido
✅ **Control total** - Manejas cada paso del flujo
✅ **Logs detallados** - Debug fácil
✅ **Robusto** - Funciona en dev y producción
✅ **Seguro** - Tokens manejados correctamente

**¡El login con Google debería funcionar perfectamente ahora! 🎉**

