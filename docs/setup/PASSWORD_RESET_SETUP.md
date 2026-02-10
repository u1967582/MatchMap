# 🔑 Configuración de Recuperación de Contraseña

## ⚠️ PROBLEMA: El link del email no abre la app

Si después de recibir el email de recuperación, al hacer click en el link **no se abre la app**, sigue estos pasos:

---

## 📋 SOLUCIÓN: Configurar URLs en Supabase

### Paso 1: Ir a Supabase Dashboard

1. Abre tu navegador
2. Ve a: https://supabase.com/dashboard
3. Selecciona tu proyecto: **hmtfxpihkoisncglllmq**

### Paso 2: Configurar Redirect URLs

1. En el menú lateral, ve a: **Authentication → URL Configuration**
2. Busca la sección: **Redirect URLs**
3. Añade estas URLs (una por línea):

```
matchmap://auth/reset-password
matchmap://auth/callback
exp://localhost:8081/--/auth/reset-password
exp://localhost:8081/--/auth/callback
exp://192.168.1.135:8081/--/auth/reset-password
exp://192.168.1.135:8081/--/auth/callback
```

⚠️ **IMPORTANTE:** Reemplaza `192.168.1.100` con tu IP local real.

Para saber tu IP:
```bash
# En Mac/Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# En Windows:
ipconfig
```

### Paso 3: Configurar Email Templates (Opcional pero Recomendado)

1. En Supabase Dashboard: **Authentication → Email Templates**
2. Selecciona: **Reset Password**
3. Verifica que el template tenga este formato:

```html
<h2>Reset Password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

---

## 🧪 CÓMO PROBAR

### Test 1: Desarrollo (Simulador/Dispositivo)

1. **Inicia la app:**
   ```bash
   npx expo start --dev-client
   ```

2. **Ve a Login → "¿Olvidaste tu contraseña?"**

3. **Ingresa tu email**

4. **Revisa tu inbox**
   - Deberías recibir un email
   - Con el asunto: "Reset Password"

5. **Revisa los logs de la consola:**
   ```
   LOG  📧 Enviando email de recuperación a: tu-email@gmail.com
   LOG  🔗 Password Reset Redirect URL: exp://192.168.x.x:8081/--/auth/reset-password
   LOG  🌍 Environment: Development
   LOG  ✅ Email de recuperación enviado
   ```

6. **Click en el link del email**
   - **iOS:** Se abre Safari/Chrome → debe redirigir a la app
   - **Android:** Pregunta qué app abrir → selecciona MatchMap

7. **Debería abrir la pantalla de reset password**

### Test 2: Producción

1. **Compila la app:**
   ```bash
   eas build --platform ios --profile preview
   # o
   eas build --platform android --profile preview
   ```

2. **Instala la build en tu dispositivo**

3. **Sigue los pasos 2-6 del Test 1**

4. **Verifica los logs:**
   ```
   LOG  🔗 Password Reset Redirect URL: matchmap://auth/reset-password
   LOG  🌍 Environment: Production
   ```

---

## 🔍 DEBUGGING

### Problema 1: "❌ No hay sesión válida"

**Causa:** El link del email no abrió la app correctamente.

**Solución:**
1. Verifica que las URLs estén en Supabase Dashboard
2. Verifica tu IP local (en desarrollo)
3. Intenta abrir el link manualmente:
   - Copia el link del email
   - Pégalo en Notes/Notas
   - Toca el link

### Problema 2: El email no llega

**Causa:** Email de prueba no verificado o en spam.

**Solución:**
1. Revisa la carpeta de spam
2. En Supabase Dashboard → Authentication → Users
   - Verifica que el usuario exista
3. Usa un email real (Gmail, Outlook, etc.)

### Problema 3: El link abre el navegador pero no la app

**Causa:** Deep linking no configurado correctamente.

**Solución:**
1. Verifica `app.json`:
   ```json
   {
     "scheme": "matchmap"
   }
   ```

2. En iOS: reinstala la app
   ```bash
   # Borra la app del simulador
   # Vuelve a correr:
   npx expo start --dev-client
   ```

3. En Android: verifica `intentFilters` en `app.json`

---

## 📱 URLs por Entorno

| Entorno | URL de Redirect |
|---------|----------------|
| **Desarrollo (iOS Sim)** | `exp://192.168.x.x:8081/--/auth/reset-password` |
| **Desarrollo (Expo Go)** | `exp://192.168.x.x:8081/--/auth/reset-password` |
| **Producción (iOS)** | `matchmap://auth/reset-password` |
| **Producción (Android)** | `matchmap://auth/reset-password` |

---

## ✅ Checklist de Verificación

Antes de reportar un error, verifica:

- [ ] URLs configuradas en Supabase Dashboard
- [ ] IP local correcta (en desarrollo)
- [ ] `scheme: "matchmap"` en app.json
- [ ] App reiniciada después de cambios
- [ ] Email llegó a inbox (no spam)
- [ ] Click en el link del email (no copiar/pegar)
- [ ] Logs muestran la URL correcta
- [ ] Pantalla reset-password.tsx existe en `app/auth/`

---

## 🆘 Si Nada Funciona

### Opción 1: Usar URL Universal

En lugar de `matchmap://`, usa una URL web que redirige:

```typescript
// En utils/auth.ts
const redirectUrl = 'https://tudominio.com/reset-password';
```

Luego configura tu dominio para deep link.

### Opción 2: Copiar Token Manualmente (Solo para Testing)

1. Abre el link del email en el navegador
2. Copia el `access_token` de la URL
3. En la app, añade un botón temporal para pegar el token

---

## 📚 Recursos

- [Expo Deep Linking](https://docs.expo.dev/guides/deep-linking/)
- [Supabase Email Auth](https://supabase.com/docs/guides/auth/auth-email)
- [Supabase Password Reset](https://supabase.com/docs/guides/auth/auth-password-reset)

---

## 🎯 TL;DR (Resumen Rápido)

**Problema:** Link no abre la app
**Solución:**
1. Ve a Supabase Dashboard
2. Authentication → URL Configuration
3. Añade: `matchmap://auth/reset-password`
4. Añade: `exp://TU-IP:8081/--/auth/reset-password` (desarrollo)
5. Guarda
6. Prueba de nuevo

