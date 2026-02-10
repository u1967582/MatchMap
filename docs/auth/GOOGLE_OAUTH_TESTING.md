# 🧪 Guía Completa de Testing - Google OAuth

## Índice
1. [Pre-requisitos](#pre-requisitos)
2. [Testing en Desarrollo Local (iOS Simulator)](#testing-en-desarrollo-local-ios-simulator)
3. [Testing en Dispositivo Real iOS](#testing-en-dispositivo-real-ios)
4. [Testing en Android](#testing-en-android)
5. [Verificación en Supabase](#verificación-en-supabase)
6. [Testing de Casos Edge](#testing-de-casos-edge)
7. [Debugging y Troubleshooting](#debugging-y-troubleshooting)

---

## Pre-requisitos

Antes de comenzar el testing, asegúrate de tener:

### ✅ Configuración de Google Cloud Console
- [ ] Proyecto creado en Google Cloud
- [ ] Google+ API / Google Identity API habilitada
- [ ] OAuth consent screen configurado
- [ ] iOS Client ID creado con bundle `com.tuorg.matchmap`
- [ ] Web Client ID creado
- [ ] Web Client Secret generado
- [ ] Redirect URIs configurados:
  ```
  https://[PROJECT-REF].supabase.co/auth/v1/callback
  matchmap://
  matchmap://auth
  ```

### ✅ Configuración de Supabase
- [ ] Provider de Google habilitado
- [ ] Web Client ID configurado
- [ ] Web Client Secret configurado
- [ ] Redirect URLs configuradas
- [ ] Función `handle_new_oauth_user()` creada
- [ ] Trigger `on_auth_user_created` creado

### ✅ Configuración de la App
- [ ] `expo-auth-session` instalado
- [ ] `expo-web-browser` instalado
- [ ] `scheme: "matchmap"` en app.json
- [ ] Bundle identifier correcto en app.json
- [ ] Archivo .env con variables correctas

---

## Testing en Desarrollo Local (iOS Simulator)

### Setup Inicial

```bash
# 1. Instalar expo-dev-client si no lo tienes
npx expo install expo-dev-client

# 2. Prebuild para iOS
npx expo prebuild --platform ios

# 3. Instalar pods (si es necesario)
cd ios && pod install && cd ..

# 4. Iniciar el dev client
npx expo start --dev-client
```

### Test 1: Login Básico con Google

**Pasos:**

1. **Inicia la app en el simulador:**
   ```bash
   # En la terminal de Expo, presiona 'i' para iOS
   ```

2. **Ve a la pantalla de Login:**
   - Si es primera vez: Verás WelcomeScreen → Click "Iniciar sesión"
   - Si ya tienes cuenta: Puedes omitir el registro

3. **Click en "Continuar con Google"**

4. **Verifica los logs en consola:**
   ```
   🔐 Iniciando Google OAuth...
      Platform: ios
      Environment: Development
      Redirect URL: matchmap://auth
   ✅ URL de Google OAuth generada
   🌐 Abriendo navegador para autenticación...
   ```

5. **Se debe abrir Safari/Browser:**
   - Verás la pantalla de selección de cuenta de Google
   - Selecciona tu cuenta de prueba

6. **Autoriza la app:**
   - Click en "Continuar" o "Allow"

7. **Redirección automática:**
   - El navegador debe cerrar automáticamente
   - La app debe volver al foreground

8. **Verifica redirección al mapa:**
   ```
   📡 Auth event: SIGNED_IN
   ✅ Usuario autenticado: tu-email@gmail.com
      Provider: google
      User ID: [UUID]
   🗺️  Redirigiendo al mapa...
   ```

**Resultado esperado:**
- ✅ Navegador se abre con pantalla de Google
- ✅ Usuario puede seleccionar cuenta
- ✅ Redirige de vuelta a la app
- ✅ Va automáticamente al mapa
- ✅ Usuario está autenticado

**Si falla:**
- Ver [Debugging](#debugging-y-troubleshooting)
- Verificar redirect URLs
- Revisar logs de Supabase

### Test 2: Verificar Creación de Usuario en public.users

**Objetivo:** Confirmar que el trigger SQL creó el usuario

**Pasos:**

1. Después de login exitoso, ve a Supabase Dashboard

2. **SQL Editor** → Ejecuta:

```sql
-- Ver el usuario recién creado
SELECT 
  u.id,
  u.email,
  u.username,
  u.full_name,
  u.profile_image_url,
  u.is_bar_owner,
  u.created_at
FROM public.users u
ORDER BY u.created_at DESC
LIMIT 1;
```

3. **Verifica que el usuario tiene:**
   - ✅ `id`: UUID (mismo que en auth.users)
   - ✅ `email`: Tu email de Google
   - ✅ `username`: Único, basado en tu nombre o email
   - ✅ `full_name`: Tu nombre de Google
   - ✅ `profile_image_url`: URL de tu foto de Google (si tienes)
   - ✅ `is_bar_owner`: false

4. **Verifica que coincide con auth.users:**

```sql
SELECT 
  au.id,
  au.email AS auth_email,
  au.raw_user_meta_data,
  pu.email AS public_email,
  pu.username,
  pu.full_name
FROM auth.users au
INNER JOIN public.users pu ON au.id = pu.id
WHERE au.email = 'tu-email@gmail.com';
```

**Resultado esperado:**
- ✅ Usuario existe en ambas tablas
- ✅ IDs coinciden
- ✅ Emails coinciden
- ✅ Datos del perfil se extrajeron correctamente

### Test 3: Persistencia de Sesión

**Objetivo:** Verificar que la sesión persiste al cerrar/abrir la app

**Pasos:**

1. Con el usuario logueado, **cierra la app completamente:**
   - En iOS Simulator: `Cmd + Shift + H + H` → Swipe up
   - O usa el botón de apps y cierra MatchMap

2. **Espera 5 segundos**

3. **Vuelve a abrir la app:**
   - Desde el home screen del simulador

4. **Verifica los logs:**
   ```
   ✅ Sesión restaurada automáticamente al iniciar la app
      Usuario: tu-email@gmail.com
   ✅ Usuario ya autenticado, redirigiendo al mapa...
   ```

5. **No deberías ver WelcomeScreen**
   - Debe ir directamente al mapa

**Resultado esperado:**
- ✅ Sin WelcomeScreen
- ✅ Directo al mapa
- ✅ Usuario sigue autenticado
- ✅ No pide login nuevamente

### Test 4: Logout y Re-Login

**Objetivo:** Verificar el flujo completo de logout

**Pasos:**

1. **Desde el mapa, ve a Perfil:**
   - Tab inferior → Perfil

2. **Scroll hasta abajo**

3. **Click en "Cerrar sesión"**

4. **Verifica los logs:**
   ```
   👋 Cerrando sesión...
   ✅ Sesión cerrada exitosamente
   📡 Auth event: SIGNED_OUT
   👋 Usuario cerró sesión
   ```

5. **Verifica redirección:**
   - Debe redirigir a WelcomeScreen

6. **Cierra y abre la app:**
   - Debe mostrar WelcomeScreen (no el mapa)

7. **Haz login de nuevo con Google:**
   - Debe funcionar correctamente
   - Debe usar la misma cuenta (datos ya existen)

**Resultado esperado:**
- ✅ Logout exitoso
- ✅ Redirige a WelcomeScreen
- ✅ Sesión eliminada de AsyncStorage
- ✅ Al reabrir, pide login
- ✅ Re-login funciona correctamente

### Test 5: Usernames Únicos

**Objetivo:** Verificar que si 2 usuarios tienen el mismo nombre, el username es único

**Pasos:**

1. **Crea manualmente un usuario en Supabase:**

```sql
INSERT INTO public.users (id, email, username, full_name)
VALUES (
  gen_random_uuid(),
  'test-manual@example.com',
  'juan',  -- Username que queremos probar
  'Juan Manual'
);
```

2. **Haz login con Google usando una cuenta que se llame "Juan"**

3. **Verifica que el nuevo usuario tiene username diferente:**

```sql
SELECT username, email, full_name
FROM public.users
WHERE full_name LIKE '%Juan%'
ORDER BY created_at DESC;
```

4. **Debería ver:**
   - Usuario manual: `username = 'juan'`
   - Usuario OAuth: `username = 'juan1'` (o 'juan2', etc.)

**Resultado esperado:**
- ✅ Usernames son únicos
- ✅ Sistema agrega sufijo numérico automáticamente
- ✅ No hay conflictos de unique constraint

---

## Testing en Dispositivo Real iOS

### Setup para Dispositivo Real

```bash
# 1. Conecta tu iPhone con cable USB

# 2. Abre Xcode y registra tu dispositivo

# 3. Build para el dispositivo
npx expo run:ios --device

# O usa EAS Build:
eas build --platform ios --profile development
```

### Diferencias vs Simulador

- **Navegador:** Usa Safari real, no el del simulador
- **Performance:** Más rápido y realista
- **Face ID/Touch ID:** Puedes testear autenticación biométrica
- **Network:** Usa tu red real (WiFi/cellular)

### Tests Específicos del Dispositivo

#### Test 1: Interrupción Durante OAuth

**Pasos:**

1. Inicia Google OAuth
2. Cuando se abra Safari, **sal de Safari sin completar**
3. Vuelve a la app

**Resultado esperado:**
- ✅ App no crashea
- ✅ Loading state se resetea
- ✅ Usuario puede intentar nuevamente

#### Test 2: Sin Conexión a Internet

**Pasos:**

1. Activa modo avión
2. Intenta hacer login con Google

**Resultado esperado:**
- ✅ Mensaje de error claro
- ✅ "No hay conexión a internet" o similar
- ✅ App no crashea

#### Test 3: Autorización Denegada

**Pasos:**

1. Inicia Google OAuth
2. En la pantalla de Google, **click en "Cancelar"** o "Deny"

**Resultado esperado:**
- ✅ Vuelve a la app
- ✅ Loading state se quita
- ✅ Muestra mensaje de error o simplemente regresa a login
- ✅ Usuario puede intentar nuevamente

---

## Testing en Android

### Setup para Android

```bash
# 1. Instala Android Studio y configura emulador

# 2. Inicia el emulador
npx expo start --dev-client

# 3. Presiona 'a' en la terminal de Expo

# O build para dispositivo real:
npx expo run:android --device
```

### Diferencias vs iOS

- **Navegador:** Chrome en vez de Safari
- **Deep linking:** Se maneja diferente
- **Permisos:** Pueden requerir configuración adicional
- **Back button:** Usuario puede presionar "atrás" durante OAuth

### Tests Específicos de Android

#### Test 1: Botón Atrás Durante OAuth

**Pasos:**

1. Inicia Google OAuth
2. Cuando se abra Chrome, **presiona botón atrás**

**Resultado esperado:**
- ✅ Vuelve a la app
- ✅ Loading state se resetea
- ✅ No crashea

#### Test 2: Múltiples Cuentas de Google

**Pasos:**

1. Asegúrate de tener múltiples cuentas de Google en el dispositivo
2. Inicia OAuth
3. Selecciona cuenta A
4. Logout
5. Inicia OAuth nuevamente
6. Selecciona cuenta B

**Resultado esperado:**
- ✅ Ambas cuentas pueden autenticarse
- ✅ Se crean 2 usuarios diferentes
- ✅ Cada uno con su propio username

---

## Verificación en Supabase

### Dashboard de Autenticación

1. **Ve a Authentication → Users** en Supabase

2. **Verifica:**
   - Columna "Provider": debe mostrar "google"
   - Columna "Last Sign In": debe ser reciente
   - Columna "Email": tu email de Google

### Logs de Autenticación

1. **Ve a Logs → Auth** en Supabase

2. **Busca eventos:**
   - `user.signin.success`
   - `user.created`

3. **Verifica detalles del evento:**
   - IP address
   - User agent
   - Provider (google)

### Queries de Verificación

```sql
-- 1. Ver todos los usuarios OAuth
SELECT 
  au.id,
  au.email,
  au.raw_app_meta_data->>'provider' AS provider,
  au.created_at,
  pu.username,
  pu.full_name
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.raw_app_meta_data->>'provider' = 'google'
ORDER BY au.created_at DESC;

-- 2. Ver usuarios sin registro en public.users (NO debería haber)
SELECT 
  au.id,
  au.email,
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 3. Ver errores de autenticación (si existen)
SELECT *
FROM public.auth_errors
ORDER BY created_at DESC
LIMIT 10;

-- 4. Ver metadata de usuarios Google
SELECT 
  email,
  raw_user_meta_data->>'full_name' AS nombre_google,
  raw_user_meta_data->>'picture' AS foto_google,
  raw_user_meta_data AS metadata_completo
FROM auth.users
WHERE raw_app_meta_data->>'provider' = 'google'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Testing de Casos Edge

### Caso 1: Usuario Sin Nombre en Google

**Simular:** Usa una cuenta de Google sin nombre configurado (raro pero posible)

**Resultado esperado:**
- ✅ Username se genera desde email
- ✅ full_name puede ser string vacío
- ✅ No crashea

### Caso 2: Usuario Sin Foto de Perfil

**Simular:** Usa cuenta de Google sin foto

**Resultado esperado:**
- ✅ `profile_image_url` es NULL
- ✅ App muestra avatar por defecto
- ✅ Todo funciona normalmente

### Caso 3: Email Muy Largo

**Simular:** Email con +100 caracteres

**Resultado esperado:**
- ✅ Se guarda correctamente
- ✅ Username se genera apropiadamente
- ✅ No hay overflow en UI

### Caso 4: Caracteres Especiales en Nombre

**Simular:** Nombre como "José María Pérez-Gómez"

**Resultado esperado:**
- ✅ Username generado: `jose` o similar (sin acentos ni guiones)
- ✅ full_name se guarda tal cual: "José María Pérez-Gómez"
- ✅ No crashea

### Caso 5: Login Simultáneo en Múltiples Dispositivos

**Pasos:**

1. Login en dispositivo A
2. Login con la misma cuenta en dispositivo B
3. Usa la app en ambos dispositivos

**Resultado esperado:**
- ✅ Ambas sesiones son válidas
- ✅ No se expulsan entre sí
- ✅ Tokens se renuevan independientemente

---

## Debugging y Troubleshooting

### Ver Logs Detallados

#### En la App (Consola de Expo)

```
🔐 Iniciando Google OAuth...
   Platform: ios
   Environment: Development
   Redirect URL: matchmap://auth
✅ URL de Google OAuth generada
🌐 Abriendo navegador para autenticación...
📡 Auth event: SIGNED_IN
✅ Usuario autenticado: user@gmail.com
   Provider: google
   User ID: [UUID]
```

#### Activar Debug Mode en utils/auth.ts

Llama a `debugUserInfo()` después del login:

```typescript
import { debugUserInfo } from '~/utils/auth';

// Después del login:
await debugUserInfo();
```

Verás:
```
👤 ==== USER DEBUG INFO ====
ID: [UUID]
Email: user@gmail.com
Provider: google
Created: 11/1/2025, 3:45:12 PM
Last Sign In: 11/1/2025, 3:45:12 PM
Metadata: {
  "full_name": "User Name",
  "picture": "https://..."
}
========================
```

### Problemas Comunes

#### 1. "redirect_uri_mismatch"

**Síntoma:**
```
Error 400: redirect_uri_mismatch
```

**Solución:**
- Ve a Google Cloud Console → Credentials
- Edita el Web Client ID
- Añade/verifica redirect URIs:
  ```
  https://[PROJECT-REF].supabase.co/auth/v1/callback
  matchmap://
  matchmap://auth
  ```

#### 2. No Redirige a la App

**Síntoma:** Después de autorizar en Google, se queda en el navegador

**Solución:**
1. Verifica `scheme: "matchmap"` en app.json
2. Verifica que `WebBrowser.maybeCompleteAuthSession()` se llama
3. Rebuild la app: `npx expo prebuild --clean`

#### 3. Usuario No Se Crea en public.users

**Síntoma:** Login exitoso pero no hay registro en public.users

**Debug:**

```sql
-- Ver si el trigger existe
SELECT * FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Ver errores de autenticación
SELECT * FROM public.auth_errors 
ORDER BY created_at DESC 
LIMIT 5;

-- Ver raw_user_meta_data del usuario
SELECT id, email, raw_user_meta_data
FROM auth.users
WHERE email = 'tu-email@gmail.com';
```

**Solución:**
- Verifica que el trigger está habilitado
- Revisa los logs de Supabase
- Ejecuta el SQL del trigger nuevamente

#### 4. App Crashea al Abrir OAuth

**Síntoma:** App se cierra al presionar "Continuar con Google"

**Debug:**
- Revisa logs de Expo/React Native
- Busca errores de `expo-web-browser`
- Verifica que todas las dependencias están instaladas

**Solución:**
```bash
# Reinstalar dependencias
npx expo install expo-web-browser expo-auth-session

# Limpiar y rebuild
npx expo prebuild --clean
npm run ios  # o npm run android
```

---

## Checklist Completo de Testing

### Pre-Implementación
- [ ] Google Cloud Console configurado
- [ ] Supabase configurado
- [ ] SQL trigger creado
- [ ] Variables de entorno configuradas
- [ ] Dependencies instaladas

### Testing Básico
- [ ] Login con Google funciona en simulador iOS
- [ ] Usuario se crea en public.users
- [ ] Username es único
- [ ] Datos del perfil (nombre, foto) se guardan
- [ ] Sesión persiste al cerrar/abrir
- [ ] Logout funciona correctamente
- [ ] Re-login funciona

### Testing Avanzado
- [ ] Funciona en dispositivo real iOS
- [ ] Funciona en Android emulator
- [ ] Funciona en dispositivo real Android
- [ ] Múltiples cuentas de Google funcionan
- [ ] Manejo correcto de cancelación
- [ ] Manejo correcto de sin internet
- [ ] Botón atrás (Android) funciona correctamente

### Testing de Casos Edge
- [ ] Usuario sin nombre
- [ ] Usuario sin foto
- [ ] Email muy largo
- [ ] Caracteres especiales en nombre
- [ ] Login simultáneo en múltiples dispositivos
- [ ] Usernames duplicados se manejan

### Verificación en Supabase
- [ ] Usuarios aparecen en Auth → Users
- [ ] Provider es "google"
- [ ] Logs de auth muestran eventos correctos
- [ ] No hay usuarios huérfanos (auth sin public.users)
- [ ] No hay errores en auth_errors table

---

## Performance y Métricas

### Tiempos Esperados

| Operación | Tiempo Esperado |
|-----------|----------------|
| Abrir navegador OAuth | < 1 segundo |
| Autorización en Google | Variable (usuario) |
| Redirección a la app | < 2 segundos |
| Creación de usuario en public.users | < 500ms |
| Navegación al mapa | < 1 segundo |
| **Total (sin usuario)** | **< 5 segundos** |

### Monitoreo

```sql
-- Ver tiempos de creación entre auth.users y public.users
SELECT 
  au.email,
  au.created_at AS auth_created,
  pu.created_at AS public_created,
  EXTRACT(EPOCH FROM (pu.created_at - au.created_at)) AS delay_seconds
FROM auth.users au
INNER JOIN public.users pu ON au.id = pu.id
WHERE au.raw_app_meta_data->>'provider' = 'google'
ORDER BY au.created_at DESC
LIMIT 10;
```

---

## Testing en Producción

### Antes de Lanzar

- [ ] Testear en build de producción (no dev client)
- [ ] Verificar que redirect URLs de producción están configuradas
- [ ] Publicar OAuth consent screen (si quieres usuarios externos)
- [ ] Testear en dispositivos reales de usuarios beta
- [ ] Monitorear logs de Supabase después del lanzamiento

### Monitoreo Post-Lanzamiento

```sql
-- Ver tasa de éxito de OAuth por día
SELECT 
  DATE(created_at) AS fecha,
  COUNT(*) AS usuarios_oauth,
  COUNT(*) FILTER (WHERE raw_app_meta_data->>'provider' = 'google') AS usuarios_google
FROM auth.users
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY fecha DESC;

-- Ver errores recientes
SELECT * FROM public.auth_errors
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

**¡Testing completo de Google OAuth implementado! 🎉**

Si encuentras algún problema no documentado aquí, añádelo a la guía para futuras referencias.

