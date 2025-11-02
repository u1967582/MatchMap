# 🧪 Guía de Testing - Persistencia de Sesión

## 🎯 Objetivo del Testing

Verificar que el usuario permanece logueado cuando cierra y vuelve a abrir la app.

## ✅ Test Suite Completa

### Test 1: Login y Persistencia Básica

**Pasos:**
1. Abre la app (primera vez o después de logout)
2. Verifica que ves la **WelcomeScreen**
3. Haz click en **"Iniciar sesión"**
4. Ingresa email y contraseña
5. Haz click en **"Iniciar sesión"**
6. Verifica que te redirige al **Mapa** ✅

**Resultado esperado:**
```
✅ Sesión restaurada automáticamente al iniciar la app
   Usuario: tu@email.com
✅ Usuario ya autenticado, redirigiendo al mapa...
```

### Test 2: Cerrar y Reabrir App (EL TEST PRINCIPAL)

**Pasos:**
1. Con el usuario logueado en el mapa
2. **Cierra la app COMPLETAMENTE** (force quit):
   - **iOS**: Swipe up y cierra la app
   - **Android**: Botón de apps recientes → Cierra la app
3. **Espera 5 segundos**
4. **Vuelve a abrir la app**
5. **NO deberías ver WelcomeScreen**
6. **Deberías ir DIRECTAMENTE al mapa** ✅

**Resultado esperado:**
```
✅ Sesión restaurada automáticamente al iniciar la app
   Usuario: tu@email.com
✅ Usuario ya autenticado, redirigiendo al mapa...
```

**❌ Si falla:**
- Verás WelcomeScreen en lugar del mapa
- Revisa la consola para ver los logs
- Puede haber un problema con AsyncStorage

### Test 3: Logout y Verificación

**Pasos:**
1. Desde el mapa, ve a **Perfil** (tab inferior)
2. Scroll hasta el final
3. Haz click en **"Cerrar sesión"**
4. Verifica que te redirige a **WelcomeScreen** ✅
5. **Cierra la app completamente**
6. **Vuelve a abrir la app**
7. Deberías ver **WelcomeScreen** (no el mapa) ✅

**Resultado esperado:**
```
❌ No hay sesión activa, mostrando pantalla de bienvenida
ℹ️ No hay sesión guardada
```

### Test 4: Navegación con Sesión Activa

**Pasos:**
1. Con usuario logueado
2. Navega a diferentes tabs (Buscar, Favoritos, Perfil)
3. **Cierra la app**
4. **Vuelve a abrir**
5. Deberías volver al **Mapa** (no al último tab) ✅

**Resultado esperado:**
```
✅ Usuario ya autenticado, redirigiendo al mapa...
```

### Test 5: Sesión Después de Mucho Tiempo

**Pasos:**
1. Haz login
2. **Espera 1 hora** (o el tiempo de expiración de tu configuración)
3. Abre la app
4. Debería:
   - ✅ Opción A: Renovar el token automáticamente y seguir en el mapa
   - ✅ Opción B: Si expiró completamente, mostrar WelcomeScreen

**Nota:** Supabase renueva automáticamente los tokens antes de que expiren, así que normalmente verás Opción A.

## 📱 Testing en Diferentes Plataformas

### iOS (Simulator)

```bash
# 1. Inicia la app
npx expo start

# 2. Presiona 'i' para abrir iOS simulator
# 3. Haz login
# 4. Presiona Cmd+Shift+H+H para ver apps
# 5. Swipe up para cerrar MatchMap
# 6. Abre de nuevo desde el home screen
```

### iOS (Dispositivo Real)

```bash
# 1. Instala la app en tu iPhone
# 2. Haz login
# 3. Swipe up desde abajo y pausa
# 4. Swipe up en MatchMap para cerrarla
# 5. Abre de nuevo
```

### Android (Emulator)

```bash
# 1. Inicia la app
npx expo start

# 2. Presiona 'a' para abrir Android emulator
# 3. Haz login
# 4. Presiona el botón de apps recientes (cuadrado)
# 5. Swipe la app para cerrarla
# 6. Abre de nuevo desde el app drawer
```

### Android (Dispositivo Real)

```bash
# 1. Instala la app en tu Android
# 2. Haz login
# 3. Botón de apps recientes
# 4. Cierra MatchMap
# 5. Abre de nuevo
```

## 🔍 Verificación de Logs

### Logs Correctos (Con Sesión)

```
✅ Sesión restaurada automáticamente al iniciar la app
   Usuario: usuario@email.com
✅ Usuario ya autenticado, redirigiendo al mapa...
```

### Logs Correctos (Sin Sesión)

```
❌ No hay sesión activa, mostrando pantalla de bienvenida
ℹ️ No hay sesión guardada
```

### Logs de Error (Problema)

```
❌ Error al inicializar la sesión: [error message]
❌ Error inesperado al verificar la sesión: [error message]
```

## 🐛 Troubleshooting

### Problema 1: Siempre muestra WelcomeScreen

**Síntomas:**
- Usuario hace login
- Cierra y abre la app
- Ve WelcomeScreen en lugar del mapa

**Posibles causas:**
1. AsyncStorage no está guardando los tokens
2. Tokens se invalidan inmediatamente
3. Error en la verificación de sesión

**Solución:**
1. Verifica logs de consola
2. Revisa que AsyncStorage esté instalado:
   ```bash
   npx expo install @react-native-async-storage/async-storage
   ```
3. Limpia cache:
   ```bash
   npx expo start -c
   ```

### Problema 2: Se desloguea después de poco tiempo

**Síntomas:**
- Usuario hace login
- Después de 30 minutos, está deslogueado

**Posibles causas:**
1. Tokens muy cortos
2. autoRefreshToken no está funcionando

**Solución:**
1. Verifica configuración en Supabase Dashboard
2. Revisa que `autoRefreshToken: true` en supabase.ts
3. Aumenta duración de tokens en Supabase

### Problema 3: Error al leer AsyncStorage

**Síntomas:**
- Error en consola al intentar leer sesión
- App crashea al iniciar

**Solución:**
1. Reinstala AsyncStorage:
   ```bash
   npm install @react-native-async-storage/async-storage
   npx pod-install
   ```
2. Limpia y rebuild:
   ```bash
   npx expo start -c
   ```

### Problema 4: Funciona en development pero no en production

**Síntomas:**
- En Expo Go funciona
- En build de producción no funciona

**Solución:**
1. Verifica que AsyncStorage esté en dependencies (no devDependencies)
2. Rebuild la app:
   ```bash
   eas build --platform ios --profile production
   eas build --platform android --profile production
   ```

## 📊 Checklist de Verificación

Antes de considerar el testing completo, verifica:

- [ ] ✅ Login funciona correctamente
- [ ] ✅ Después de login, redirige al mapa
- [ ] ✅ Al cerrar y abrir, mantiene sesión (va al mapa)
- [ ] ✅ Logout funciona correctamente
- [ ] ✅ Después de logout y cerrar, muestra WelcomeScreen
- [ ] ✅ Logs aparecen correctamente en consola
- [ ] ✅ No hay errores en consola
- [ ] ✅ Funciona en iOS
- [ ] ✅ Funciona en Android
- [ ] ✅ Loading indicator aparece brevemente al iniciar

## 🎯 Caso de Uso Real

### Día 1
```
10:00 AM - Usuario descarga la app
10:01 AM - Se registra y hace login
10:05 AM - Explora bares en el mapa
10:15 AM - Cierra la app
```

### Día 2
```
2:00 PM - Abre la app
         ✅ Va DIRECTAMENTE al mapa
         ✅ Continúa desde donde estaba
         ✅ No tiene que hacer login
3:00 PM - Usa la app normalmente
3:30 PM - Cierra la app
```

### Día 7
```
5:00 PM - Abre la app después de una semana
         ✅ SIGUE LOGUEADO
         ✅ Va directamente al mapa
         ✅ Token se renovó automáticamente
```

## 📝 Reporting de Bugs

Si encuentras un problema, incluye:

1. **Pasos para reproducir**
2. **Plataforma** (iOS/Android, versión)
3. **Logs de consola**
4. **Comportamiento esperado vs real**
5. **Screenshots si es posible**

## ✨ Testing Exitoso

Si todos los tests pasan, verás:

✅ Usuario hace login → Va al mapa
✅ Cierra y abre app → Va al mapa (no WelcomeScreen)
✅ Logout → Muestra WelcomeScreen
✅ Cierra y abre después de logout → Muestra WelcomeScreen
✅ Logs correctos en consola
✅ Sin errores o warnings

**¡Persistencia de sesión funcionando correctamente! 🎉**

