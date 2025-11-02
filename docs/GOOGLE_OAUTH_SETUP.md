# 🔐 Guía Completa de Implementación de Google OAuth

## Índice
1. [Configuración de Google Cloud Console](#1-configuración-de-google-cloud-console)
2. [Configuración de Supabase](#2-configuración-de-supabase)
3. [SQL para Creación Automática de Usuarios](#3-sql-para-creación-automática-de-usuarios)
4. [Configuración de la App](#4-configuración-de-la-app)
5. [Testing](#5-testing)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Configuración de Google Cloud Console

### Paso 1.1: Crear/Acceder al Proyecto

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. **Selecciona o crea un proyecto:**
   - Si ya tienes un proyecto: Selecciónalo del dropdown superior
   - Si no: Click en "Nuevo Proyecto" → Nombre: "MatchMap" → Crear

### Paso 1.2: Habilitar Google+ API

1. En el menú lateral → **APIs & Services** → **Library**
2. Busca "Google+ API"
3. Click en "Google+ API"
4. Click en **"Enable"** (Habilitar)

**Nota:** Si no encuentras Google+ API, busca "Google Identity API" o "Google Sign-In API" (las APIs han cambiado de nombre).

### Paso 1.3: Configurar Pantalla de Consentimiento OAuth

1. **APIs & Services** → **OAuth consent screen**
2. **Tipo de usuario:**
   - Selecciona **"External"** (usuarios externos)
   - Click en **"Create"**

3. **Información de la App:**
   ```
   App name: MatchMap
   User support email: [tu email]
   App logo: (opcional, puedes subir el logo de la app)
   Application home page: https://tudominio.com (o deja vacío)
   Application privacy policy link: https://tudominio.com/privacy (requerido para producción)
   Application terms of service link: https://tudominio.com/terms (opcional)
   Authorized domains: supabase.co, tudominio.com
   Developer contact information: [tu email]
   ```

4. **Scopes (Alcances):**
   - Click en "ADD OR REMOVE SCOPES"
   - Selecciona:
     - `.../auth/userinfo.email` (Ver tu dirección de correo)
     - `.../auth/userinfo.profile` (Ver tu información personal)
   - Click en "UPDATE"
   - Click en "SAVE AND CONTINUE"

5. **Test users** (solo si está en modo Testing):
   - Añade los emails que usarás para testing
   - Click en "SAVE AND CONTINUE"

6. **Summary:**
   - Revisa la información
   - Click en "BACK TO DASHBOARD"

### Paso 1.4: Crear Credenciales OAuth 2.0

#### A) Client ID para iOS

1. **APIs & Services** → **Credentials**
2. Click en **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. **Application type:** Selecciona **"iOS"**
4. **Name:** `MatchMap iOS`
5. **Bundle ID:** `com.tuorg.matchmap` ⚠️ (debe coincidir exactamente con tu app.json)

   ```json
   // En tu app.json actual:
   "ios": {
     "bundleIdentifier": "com.tuorg.matchmap"
   }
   ```

6. Click en **"CREATE"**
7. **IMPORTANTE:** Copia el **Client ID** generado (lo necesitarás después)
   - Formato: `XXXXX-XXXXX.apps.googleusercontent.com`

#### B) Client ID para Web (Supabase)

1. Click nuevamente en **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
2. **Application type:** Selecciona **"Web application"**
3. **Name:** `MatchMap Web (Supabase)`
4. **Authorized JavaScript origins:** (deja vacío)
5. **Authorized redirect URIs:** Añade estas URLs ⚠️

   **Para tu proyecto de Supabase:**
   ```
   https://[TU-PROJECT-REF].supabase.co/auth/v1/callback
   ```

   **Cómo obtener tu Project Ref:**
   - Ve a tu [Supabase Dashboard](https://supabase.com/dashboard)
   - Selecciona tu proyecto
   - En Settings → API → Project URL
   - Ejemplo: Si tu URL es `https://abcdefghijk.supabase.co`
   - Tu Project Ref es: `abcdefghijk`

   **URLs completas a añadir:**
   ```
   https://[TU-PROJECT-REF].supabase.co/auth/v1/callback
   ```

6. Click en **"CREATE"**
7. **IMPORTANTE:** Copia:
   - **Client ID** (lo usarás en Supabase)
   - **Client Secret** (lo usarás en Supabase)

### Paso 1.5: Configurar URLs de Redirección Adicionales (Desarrollo)

Si quieres que funcione en desarrollo local:

1. Edita el **Web Client ID** que acabas de crear
2. En **Authorized redirect URIs**, añade:
   ```
   http://localhost:8081/auth/callback
   exp://localhost:8081/--/auth
   ```

### Resumen de Credenciales Creadas

Al finalizar, deberías tener:

```
✅ iOS Client ID: XXXXX-XXXXX.apps.googleusercontent.com
✅ Web Client ID: YYYYY-YYYYY.apps.googleusercontent.com
✅ Web Client Secret: GOCSPX-ZZZZZZZZZZZZZ
```

**⚠️ GUARDA ESTOS VALORES DE FORMA SEGURA - Los necesitarás en los siguientes pasos**

---

## 2. Configuración de Supabase

### Paso 2.1: Configurar Provider de Google

1. Ve a tu [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Providers**
4. Busca **Google** en la lista de providers
5. Activa el toggle de **"Enable Sign in with Google"**

### Paso 2.2: Ingresar Credenciales

Ingresa los valores que obtuviste de Google Cloud Console:

```
Client ID (for OAuth): [WEB Client ID - YYYYY-YYYYY.apps.googleusercontent.com]
Client Secret (for OAuth): [Web Client Secret - GOCSPX-ZZZZZZZZZZZZZ]
```

⚠️ **USA EL WEB CLIENT ID, NO EL iOS CLIENT ID**

### Paso 2.3: Configurar Redirect URLs

En la misma pantalla, asegúrate de tener configuradas:

**Site URL:**
```
https://tudominio.com
```
(o tu URL de producción)

**Redirect URLs (una por línea):**
```
matchmap://
matchmap://auth
exp://localhost:8081/--/
exp://localhost:8081/--/auth
```

### Paso 2.4: Guardar Configuración

1. Click en **"Save"** en la parte inferior
2. Verifica que el provider de Google muestre "Enabled"

---

## 3. SQL para Creación Automática de Usuarios

### Descripción

Este trigger se ejecutará automáticamente cada vez que un usuario se registre vía OAuth (Google, Facebook, Apple, etc.) y creará el registro correspondiente en la tabla `users`.

### Paso 3.1: Crear la Función

Ve a **SQL Editor** en Supabase y ejecuta este código:

```sql
-- ============================================
-- FUNCIÓN: Crear usuario automáticamente después de registro OAuth
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_oauth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_full_name TEXT;
  v_username TEXT;
  v_profile_image_url TEXT;
  v_base_username TEXT;
  v_counter INTEGER := 1;
  v_username_exists BOOLEAN;
BEGIN
  -- Solo procesar si es un nuevo usuario OAuth
  -- Verificar que no exista ya en la tabla users
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Extraer datos del perfil OAuth
  v_email := NEW.email;
  
  -- Obtener nombre completo del metadata
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'display_name',
    ''
  );
  
  -- Obtener imagen de perfil
  v_profile_image_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'photo_url',
    NULL
  );

  -- ============================================
  -- GENERACIÓN DE USERNAME ÚNICO
  -- ============================================
  
  -- Intentar generar username desde el nombre
  IF v_full_name IS NOT NULL AND v_full_name != '' THEN
    -- Tomar el primer nombre, convertir a minúsculas y quitar espacios
    v_base_username := LOWER(REGEXP_REPLACE(
      SPLIT_PART(v_full_name, ' ', 1),
      '[^a-zA-Z0-9]',
      '',
      'g'
    ));
  ELSE
    -- Si no hay nombre, usar la parte del email antes del @
    v_base_username := LOWER(SPLIT_PART(v_email, '@', 1));
    v_base_username := REGEXP_REPLACE(v_base_username, '[^a-zA-Z0-9]', '', 'g');
  END IF;

  -- Asegurar que el username tenga al menos 3 caracteres
  IF LENGTH(v_base_username) < 3 THEN
    v_base_username := 'user' || SUBSTRING(MD5(v_email), 1, 5);
  END IF;

  -- Intentar con el username base primero
  v_username := v_base_username;
  
  -- Si el username ya existe, agregar sufijo numérico
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.users WHERE username = v_username
    ) INTO v_username_exists;
    
    EXIT WHEN NOT v_username_exists;
    
    v_username := v_base_username || v_counter::TEXT;
    v_counter := v_counter + 1;
    
    -- Prevenir loop infinito
    IF v_counter > 9999 THEN
      v_username := v_base_username || SUBSTRING(MD5(RANDOM()::TEXT), 1, 4);
      EXIT;
    END IF;
  END LOOP;

  -- ============================================
  -- INSERTAR NUEVO USUARIO
  -- ============================================
  
  INSERT INTO public.users (
    id,
    email,
    username,
    full_name,
    profile_image_url,
    is_bar_owner,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_email,
    v_username,
    v_full_name,
    v_profile_image_url,
    false,
    NOW(),
    NOW()
  );

  -- Log exitoso (opcional, para debugging)
  RAISE NOTICE 'Usuario OAuth creado: email=%, username=%, full_name=%', 
    v_email, v_username, v_full_name;

  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log del error pero no fallar el registro de autenticación
    RAISE WARNING 'Error al crear usuario en tabla users: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Paso 3.2: Crear el Trigger

```sql
-- ============================================
-- TRIGGER: Ejecutar función después de insert en auth.users
-- ============================================

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear nuevo trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_oauth_user();

-- Comentario descriptivo
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 
'Crea automáticamente un registro en public.users cuando un usuario se registra vía OAuth o email';
```

### Paso 3.3: Verificar la Instalación

Ejecuta este query para verificar que el trigger existe:

```sql
SELECT 
  tgname AS trigger_name,
  tgtype,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND tgname = 'on_auth_user_created';
```

Deberías ver un resultado con el trigger `on_auth_user_created`.

### Paso 3.4: Permisos y Seguridad

Asegúrate de que la función tiene los permisos correctos:

```sql
-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.handle_new_oauth_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_oauth_user() TO service_role;

-- Verificar RLS en tabla users (si aplica)
-- Si tienes RLS habilitado, asegúrate de tener políticas apropiadas
```

---

## 4. Configuración de la App

### Paso 4.1: Variables de Entorno

Actualiza tu archivo `.env` o `.env.local`:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://[TU-PROJECT-REF].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[TU-ANON-KEY]

# OAuth
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=[iOS Client ID de Google Cloud Console]
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=[Web Client ID de Google Cloud Console]

# Deep Linking
EXPO_PUBLIC_SCHEME=matchmap
```

### Paso 4.2: app.json Actualizado

El archivo ya está configurado correctamente con:

```json
{
  "expo": {
    "scheme": "matchmap",
    "ios": {
      "bundleIdentifier": "com.tuorg.matchmap"
    }
  }
}
```

---

## 5. Testing

### Test 1: Desarrollo Local (iOS Simulator)

```bash
# 1. Inicia el dev client
npx expo start --dev-client

# 2. Presiona 'i' para abrir iOS simulator
# 3. En la app, click en "Continuar con Google"
# 4. Debería abrir el navegador
# 5. Selecciona tu cuenta de Google
# 6. Debería redirigir a la app
```

**Verificaciones:**

✅ Se abre el navegador de Google
✅ Puedes seleccionar tu cuenta
✅ Redirige correctamente a la app
✅ Se crea el usuario en la tabla `users`

**Verificar en Supabase:**

```sql
-- Ver usuarios en auth.users
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Ver usuarios en public.users
SELECT id, email, username, full_name, profile_image_url 
FROM public.users 
ORDER BY created_at DESC 
LIMIT 5;

-- Verificar que coincidan
SELECT 
  au.email AS auth_email,
  pu.email AS public_email,
  pu.username,
  pu.full_name
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email = 'tu-email@gmail.com';
```

### Test 2: Verificar Datos del Perfil

Después de hacer login, verifica en Supabase SQL Editor:

```sql
SELECT 
  u.username,
  u.email,
  u.full_name,
  u.profile_image_url,
  u.is_bar_owner,
  u.created_at
FROM public.users u
WHERE u.email = 'tu-email@gmail.com';
```

Deberías ver:
- ✅ Username único generado
- ✅ Email de Google
- ✅ Nombre completo
- ✅ URL de foto de perfil (si está disponible)
- ✅ is_bar_owner = false

### Test 3: Persistencia de Sesión

```bash
# 1. Haz login con Google
# 2. Cierra la app completamente
# 3. Vuelve a abrir la app
# 4. Deberías seguir logueado (ir directo al mapa)
```

### Test 4: Usernames Duplicados

Para testear que los usernames se manejan correctamente:

```sql
-- Simular un usuario con username "juan"
INSERT INTO public.users (id, email, username, full_name)
VALUES (
  gen_random_uuid(),
  'test@example.com',
  'juan',
  'Juan Test'
);

-- Ahora registra un usuario OAuth cuyo nombre sea "Juan"
-- El sistema debería crear: juan1, juan2, etc.
```

---

## 6. Troubleshooting

### Problema 1: "Sign in with Google failed"

**Síntomas:** Error al intentar hacer login

**Causas posibles:**
1. Client IDs incorrectos en Supabase
2. Redirect URLs no configuradas
3. OAuth consent screen no configurado

**Solución:**
```bash
# Ver logs en la consola de Expo
npx expo start --dev-client

# Ver logs de Supabase
# Dashboard → Logs → Auth
```

Verifica:
- ✅ Web Client ID en Supabase (no iOS)
- ✅ Redirect URLs incluyen `matchmap://`
- ✅ OAuth consent screen está completado

### Problema 2: "redirect_uri_mismatch"

**Error completo:**
```
Error 400: redirect_uri_mismatch
The redirect URI in the request: matchmap:// does not match...
```

**Solución:**

1. Ve a Google Cloud Console → Credentials
2. Edita el **Web Client ID**
3. En **Authorized redirect URIs**, asegúrate de tener:
   ```
   https://[TU-PROJECT-REF].supabase.co/auth/v1/callback
   matchmap://
   matchmap://auth
   ```

### Problema 3: Usuario no se crea en tabla `users`

**Síntomas:** Login exitoso pero no hay registro en `public.users`

**Debug:**

```sql
-- Ver logs de la función
-- (si agregaste RAISE NOTICE)
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%handle_new_oauth_user%';

-- Ver usuarios en auth pero no en public
SELECT au.id, au.email
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- Ver raw_user_meta_data
SELECT id, email, raw_user_meta_data
FROM auth.users
WHERE email = 'tu-email@gmail.com';
```

**Solución:**
- Verifica que el trigger esté habilitado
- Revisa los permisos de la función
- Verifica que no haya errores en los logs de Supabase

### Problema 4: La app no redirige después del login

**Síntomas:** Después de autenticarte en Google, no vuelves a la app

**Solución:**

1. Verifica el scheme en `app.json`:
   ```json
   "scheme": "matchmap"
   ```

2. Verifica que `expo-web-browser` esté inicializado:
   ```typescript
   import * as WebBrowser from 'expo-web-browser';
   WebBrowser.maybeCompleteAuthSession();
   ```

3. Verifica que el listener de URLs esté activo en `app/_layout.tsx`

### Problema 5: "Client ID mismatch"

**Síntomas:** Error que menciona que el Client ID no coincide

**Causas:**
- Usando iOS Client ID en vez de Web Client ID en Supabase

**Solución:**
- Asegúrate de usar el **Web Client ID** en Supabase Dashboard
- El **iOS Client ID** NO se usa en Supabase, solo se necesita para configurar el bundle ID

---

## URLs de Referencia

- [Google Cloud Console](https://console.cloud.google.com/)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Expo AuthSession Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)

---

## Checklist Final

Antes de considerar la implementación completa:

- [ ] ✅ Proyecto creado en Google Cloud Console
- [ ] ✅ Google+ API habilitada
- [ ] ✅ OAuth consent screen configurado
- [ ] ✅ iOS Client ID creado con bundle correcto
- [ ] ✅ Web Client ID creado con redirect URIs
- [ ] ✅ Web Client ID + Secret configurados en Supabase
- [ ] ✅ Redirect URLs configuradas en Supabase
- [ ] ✅ Función SQL `handle_new_oauth_user()` creada
- [ ] ✅ Trigger `on_auth_user_created` creado
- [ ] ✅ Variables de entorno configuradas
- [ ] ✅ Login con Google funciona en desarrollo
- [ ] ✅ Usuario se crea automáticamente en `public.users`
- [ ] ✅ Username es único
- [ ] ✅ Datos del perfil (nombre, foto) se guardan correctamente
- [ ] ✅ Sesión persiste al cerrar/abrir app

---

## Próximos Pasos

Una vez que todo funcione en desarrollo:

1. **Preparar para producción:**
   - Crear build de producción con EAS
   - Actualizar redirect URLs para producción
   - Verificar que funcione en dispositivos reales

2. **Publicar OAuth consent screen:**
   - Si quieres que usuarios externos usen tu app
   - Completar el proceso de verificación de Google
   - Puede tomar varios días

3. **Testing adicional:**
   - Probar en Android
   - Probar con diferentes cuentas de Google
   - Probar casos edge (email sin nombre, etc.)

---

¡Implementación completa de Google OAuth con Supabase terminada! 🎉

