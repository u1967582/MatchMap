# 🔐 Variables de Entorno - MatchMap

## Configuración de .env

### Archivo .env Local

Crea un archivo `.env` en la raíz del proyecto con:

```env
# ==============================================
# SUPABASE CONFIGURATION
# ==============================================

# Project URL
# Obtener de: Supabase Dashboard → Settings → API → Project URL
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co

# Anon/Public Key
# Obtener de: Supabase Dashboard → Settings → API → Project API keys → anon/public
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ==============================================
# GOOGLE OAUTH (OPCIONAL)
# ==============================================

# iOS Client ID
# Obtener de: Google Cloud Console → Credentials → iOS app
# Nota: Solo necesario si lo usas directamente en la app
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com

# Web Client ID
# Obtener de: Google Cloud Console → Credentials → Web application
# Nota: Este también se configura en Supabase Dashboard
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-hijklmn.apps.googleusercontent.com

# ==============================================
# DEEP LINKING
# ==============================================

# App Scheme
# Ya configurado en app.json como "matchmap"
EXPO_PUBLIC_SCHEME=matchmap
```

---

## Dónde Obtener Cada Valor

### 1. EXPO_PUBLIC_SUPABASE_URL

**Ubicación:** [Supabase Dashboard](https://supabase.com/dashboard)

**Pasos:**
1. Selecciona tu proyecto
2. Ve a **Settings** (⚙️ en el menú lateral)
3. Click en **API**
4. Copia el valor de **Project URL**
   - Formato: `https://abcdefghijk.supabase.co`

**Ejemplo:**
```env
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
```

### 2. EXPO_PUBLIC_SUPABASE_ANON_KEY

**Ubicación:** [Supabase Dashboard](https://supabase.com/dashboard)

**Pasos:**
1. Mismo lugar que la URL (Settings → API)
2. En la sección **Project API keys**
3. Copia el valor de **anon** / **public**
   - Es un JWT token largo (empieza con `eyJ...`)

**Ejemplo:**
```env
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUyMDMyMDAsImV4cCI6MTk2MDc3OTIwMH0.1234567890abcdefghijklmnopqrstuvwxyz
```

**⚠️ Nota de Seguridad:**
- El `anon` key ES SEGURO de exponer en el cliente
- Supabase usa Row Level Security (RLS) para proteger datos
- NUNCA uses el `service_role` key en el cliente

### 3. EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID

**Ubicación:** [Google Cloud Console](https://console.cloud.google.com/)

**Pasos:**
1. Selecciona tu proyecto "MatchMap"
2. Ve a **APIs & Services** → **Credentials**
3. Busca el **OAuth 2.0 Client ID** de tipo **iOS**
4. Copia el **Client ID**
   - Formato: `123456789-abcdefghijklmnop.apps.googleusercontent.com`

**Ejemplo:**
```env
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
```

**Cuándo necesitas esto:**
- Solo si usas el Client ID directamente en tu código
- Para esta implementación, NO es necesario (Supabase maneja todo)

### 4. EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID

**Ubicación:** [Google Cloud Console](https://console.cloud.google.com/)

**Pasos:**
1. Mismo lugar que el iOS Client ID
2. Busca el **OAuth 2.0 Client ID** de tipo **Web application**
3. Copia el **Client ID**

**Ejemplo:**
```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=987654321-xyz789abc123.apps.googleusercontent.com
```

**Nota Importante:**
- Este valor también debe configurarse en Supabase Dashboard
- Ve a Authentication → Providers → Google
- Pega este Client ID + el Client Secret

---

## Configuración para Diferentes Entornos

### Development (.env)

```env
# Development (local)
EXPO_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
EXPO_PUBLIC_SCHEME=matchmap
```

### Production (EAS Secrets)

Para producción, usa EAS Secrets en lugar de archivo .env:

```bash
# 1. Instalar EAS CLI
npm install -g eas-cli

# 2. Login
eas login

# 3. Configurar secrets
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-prod-project.supabase.co"

eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-prod-anon-key"

eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value "your-ios-client-id"

eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "your-web-client-id"

# 4. Ver secrets configurados
eas secret:list
```

### Staging (opcional)

Si tienes un entorno de staging:

```bash
# Usar perfiles de EAS
# En eas.json:
{
  "build": {
    "staging": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://staging-project.supabase.co"
      }
    }
  }
}
```

---

## Uso en el Código

### Acceder a Variables de Entorno

```typescript
// En cualquier archivo .ts/.tsx
import Constants from 'expo-constants';

// Método 1: Usando process.env (recomendado)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Método 2: Usando Constants (alternativo)
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
```

### Validación al Inicio

En `utils/supabase.ts`:

```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // ...configuración
});
```

---

## Seguridad

### ✅ Seguros de Exponer (Cliente)

Estos valores PUEDEN estar en el código del cliente:

- ✅ `EXPO_PUBLIC_SUPABASE_URL` - URL pública
- ✅ `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Key anónimo protegido por RLS
- ✅ `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` - Client ID público
- ✅ `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` - Client ID público
- ✅ `EXPO_PUBLIC_SCHEME` - Scheme público de la app

### ❌ NUNCA Exponer (Solo Backend)

Estos valores NUNCA deben estar en el cliente:

- ❌ `SUPABASE_SERVICE_ROLE_KEY` - Acceso total sin restricciones
- ❌ `GOOGLE_CLIENT_SECRET` - Secret de OAuth
- ❌ `DATABASE_URL` - Connection string de PostgreSQL
- ❌ `PRIVATE_API_KEYS` - Cualquier key privado

### Buenas Prácticas

1. **Archivo .env en .gitignore:**
   ```gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Usar EAS Secrets para producción:**
   - No guardar secrets en repositorio
   - Usar CLI de EAS para configurar

3. **Validar variables al inicio:**
   - Lanzar error si faltan
   - Prevenir bugs difíciles de debug

4. **Documentar todas las variables:**
   - Incluir descripción de cada una
   - Indicar dónde obtenerlas

---

## Troubleshooting

### "Missing Supabase environment variables"

**Problema:** La app crashea al iniciar

**Soluciones:**

1. **Verifica que existe archivo .env:**
   ```bash
   ls -la .env
   ```

2. **Verifica el contenido:**
   ```bash
   cat .env
   ```

3. **Reinicia el servidor de Expo:**
   ```bash
   npx expo start -c
   ```

4. **Verifica que las variables empiezan con EXPO_PUBLIC_:**
   - Expo solo expone variables que empiezan con `EXPO_PUBLIC_`
   - Sin ese prefijo, no estarán disponibles en el cliente

### Variables No Se Actualizan

**Problema:** Cambias .env pero la app no refleja los cambios

**Solución:**

```bash
# Limpiar cache y reiniciar
npx expo start -c

# Si aún no funciona, rebuild completo
rm -rf node_modules
npm install
npx expo prebuild --clean
npm run ios  # o npm run android
```

### Variables Undefined en Producción

**Problema:** Funciona en desarrollo pero no en producción

**Solución:**

1. **Configurar EAS Secrets:**
   ```bash
   eas secret:create --scope project --name VARIABLE_NAME --value "value"
   ```

2. **Verificar eas.json:**
   ```json
   {
     "build": {
       "production": {
         "env": {
           "EXPO_PUBLIC_SUPABASE_URL": "https://..."
         }
       }
     }
   }
   ```

---

## Checklist de Configuración

- [ ] Archivo `.env` creado en la raíz
- [ ] `EXPO_PUBLIC_SUPABASE_URL` configurado
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` configurado
- [ ] Variables empiezan con `EXPO_PUBLIC_`
- [ ] Archivo `.env` está en `.gitignore`
- [ ] App funciona en desarrollo
- [ ] EAS Secrets configurados para producción
- [ ] Documentación actualizada con tus valores

---

## Recursos

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [EAS Secrets](https://docs.expo.dev/build-reference/variables/)
- [Supabase Client Keys](https://supabase.com/docs/guides/auth#client-api-keys)
- [Google OAuth Credentials](https://developers.google.com/identity/protocols/oauth2)

---

**Variables de entorno configuradas correctamente! 🔐**

