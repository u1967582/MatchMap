# ⚡ Quick Start: Google OAuth con Supabase

Guía rápida para implementar Google OAuth en MatchMap.

## 📋 Checklist Rápida

### 1. Google Cloud Console (15 min)

1. **Ir a:** [console.cloud.google.com](https://console.cloud.google.com/)
2. **Crear proyecto:** "MatchMap"
3. **Habilitar:** Google+ API / Google Identity API
4. **OAuth consent screen:**
   - Tipo: External
   - App name: MatchMap
   - Email de soporte: [tu email]
5. **Crear credenciales:**
   - **iOS Client ID:**
     - Type: iOS
     - Bundle ID: `com.tuorg.matchmap`
   - **Web Client ID:**
     - Type: Web application  
     - Redirect URIs:
       ```
       https://[TU-PROJECT-REF].supabase.co/auth/v1/callback
       matchmap://
       matchmap://auth
       ```
6. **Guardar:**
   - ✅ Web Client ID
   - ✅ Web Client Secret

### 2. Supabase Dashboard (5 min)

1. **Ir a:** [supabase.com/dashboard](https://supabase.com/dashboard)
2. **Authentication → Providers → Google:**
   - Enable: ✅
   - Client ID: [Web Client ID]
   - Client Secret: [Web Client Secret]
3. **Redirect URLs:** (añadir estas líneas)
   ```
   matchmap://
   matchmap://auth
   exp://localhost:8081/--/
   exp://localhost:8081/--/auth
   ```
4. **Save**

### 3. SQL en Supabase (5 min)

1. **SQL Editor:**
   ```bash
   # Copia el contenido de:
   migrations/create_oauth_user_trigger.sql
   ```
2. **Ejecutar** el SQL completo
3. **Verificar:**
   ```sql
   SELECT * FROM pg_trigger 
   WHERE tgname = 'on_auth_user_created';
   ```

### 4. Verificar Código (2 min)

Tu código ya está actualizado:
- ✅ `utils/auth.ts` - Mejorado con logging
- ✅ `app.json` - Scheme configurado
- ✅ `screens/LoginScreen.tsx` - Ya tiene botón de Google

### 5. Testing (5 min)

```bash
# 1. Iniciar dev client
npx expo start --dev-client

# 2. Abrir en iOS (presiona 'i')

# 3. Ir a Login → "Continuar con Google"

# 4. Seleccionar cuenta y autorizar

# 5. Verificar redirección al mapa
```

**Verificar en Supabase:**
```sql
-- Ver usuario recién creado
SELECT * FROM public.users 
ORDER BY created_at DESC 
LIMIT 1;
```

## 🎯 Valores que Necesitas

### Desde Google Cloud Console:

| Campo | Dónde Encontrarlo | Usar En |
|-------|------------------|---------|
| **iOS Client ID** | Credentials → iOS app | Google Cloud (solo para bundle ID) |
| **Web Client ID** | Credentials → Web application | Supabase Dashboard |
| **Web Client Secret** | Credentials → Web application | Supabase Dashboard |

### Tu Bundle ID (ya configurado):
```
com.tuorg.matchmap
```

### Tu Supabase Project Ref:
```
Ir a: Settings → API → Project URL
Formato: https://[PROJECT-REF].supabase.co
```

## 🐛 Troubleshooting Rápido

| Problema | Solución Rápida |
|----------|----------------|
| `redirect_uri_mismatch` | Añadir `https://[REF].supabase.co/auth/v1/callback` a Google |
| No redirige a la app | Verificar `scheme: "matchmap"` en app.json |
| Usuario no se crea | Ejecutar SQL del trigger nuevamente |
| Crashea al abrir OAuth | `npx expo install expo-web-browser expo-auth-session` |

## 📚 Documentación Completa

- **Setup detallado:** `docs/GOOGLE_OAUTH_SETUP.md`
- **Testing completo:** `docs/GOOGLE_OAUTH_TESTING.md`
- **SQL trigger:** `migrations/create_oauth_user_trigger.sql`

## ✅ Resultado Final

Después de completar estos pasos:

1. ✅ Usuario hace click en "Continuar con Google"
2. ✅ Se abre navegador con login de Google
3. ✅ Usuario autoriza la app
4. ✅ Redirige automáticamente a la app
5. ✅ Usuario se crea en `public.users` con datos del perfil
6. ✅ Va directamente al mapa
7. ✅ Sesión persiste entre reinicios

**Tiempo total de implementación: ~30 minutos**

---

## 🚀 Comandos Útiles

```bash
# Iniciar desarrollo
npx expo start --dev-client

# Ver logs detallados
# (en la app, importa y llama)
import { debugUserInfo } from '~/utils/auth';
await debugUserInfo();

# Limpiar y rebuild
npx expo prebuild --clean
npm run ios
```

## 📞 Soporte

Si algo no funciona:
1. Revisa los logs de Expo
2. Revisa Supabase → Logs → Auth
3. Consulta `GOOGLE_OAUTH_SETUP.md` sección Troubleshooting
4. Verifica que todos los redirect URLs están configurados

---

**¡Google OAuth listo para usar! 🎉**

