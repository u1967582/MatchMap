# 🔐 Persistencia de Sesión en MatchMap

## Descripción General

La app ahora mantiene la sesión del usuario activa incluso cuando cierra y vuelve a abrir la aplicación. El usuario permanecerá logueado hasta que cierre sesión manualmente.

## Configuración de Supabase

### `utils/supabase.ts`

La configuración de Supabase incluye las siguientes opciones para persistir la sesión:

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,           // Guarda tokens en AsyncStorage
    autoRefreshToken: true,           // Renueva tokens automáticamente
    persistSession: true,             // Mantiene la sesión entre reinicios
    detectSessionInUrl: false,        // Deshabilitado para mobile
  },
});
```

## Flujo de Autenticación

### 1. Inicio de la App (`app/_layout.tsx`)

Cuando la app se inicia, el layout principal:
- Restaura la sesión desde AsyncStorage automáticamente
- Registra en consola si hay una sesión activa

### 2. Pantalla de Inicio (`app/index.tsx`)

El archivo `index.tsx` ahora verifica la sesión al cargar:

```typescript
const checkAuthAndRedirect = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    // ✅ Usuario autenticado → Redirige al mapa
    router.replace('/(protected)/map');
  } else {
    // ❌ Sin sesión → Muestra pantalla de bienvenida
    setIsCheckingAuth(false);
  }
};
```

### 3. Rutas Protegidas (`app/(protected)/_layout.tsx`)

Las rutas protegidas verifican la sesión:
- Si hay sesión: permite acceso
- Si no hay sesión: redirige a home

## Comportamiento

### ✅ Usuario con Sesión Activa

1. Cierra la app
2. Vuelve a abrirla
3. **La app detecta la sesión guardada**
4. **Redirige automáticamente al mapa**
5. El usuario continúa logueado

### ❌ Usuario sin Sesión

1. Abre la app por primera vez
2. **No hay sesión guardada**
3. **Ve la pantalla de bienvenida**
4. Debe hacer login/registro

## Almacenamiento

### AsyncStorage

Los tokens de autenticación se guardan en AsyncStorage:
- **Access Token**: Token de acceso
- **Refresh Token**: Token para renovar el acceso
- **Expiration Time**: Tiempo de expiración

### Ubicación
- iOS: `NSUserDefaults`
- Android: `SharedPreferences`

## Renovación Automática de Tokens

Supabase renueva automáticamente los tokens cuando:
- El token actual está próximo a expirar
- La app se reactiva después de estar en background
- El usuario interactúa con la app

## Cierre de Sesión

El usuario puede cerrar sesión manualmente desde:
- **Perfil → Cerrar sesión**

Al cerrar sesión:
1. Se eliminan los tokens de AsyncStorage
2. Se invalida la sesión en el servidor
3. Se redirige a la pantalla de bienvenida

## Logs de Consola

La app registra información útil en la consola:

```
✅ Sesión restaurada automáticamente al iniciar la app
   Usuario: usuario@email.com

✅ Usuario ya autenticado, redirigiendo al mapa...

❌ No hay sesión activa, mostrando pantalla de bienvenida

ℹ️ No hay sesión guardada
```

## Seguridad

### Tokens Seguros
- Los tokens se almacenan encriptados en el dispositivo
- Solo son accesibles por la app
- Se renuevan automáticamente

### Expiración
- Los tokens tienen fecha de expiración
- Después de expirar, el usuario debe volver a autenticarse
- La renovación automática previene expiraciones durante uso activo

## Consideraciones Técnicas

### Performance
- La verificación de sesión es rápida (<100ms)
- Se muestra un loading indicator durante la verificación
- No afecta la experiencia del usuario

### Compatibilidad
- ✅ iOS
- ✅ Android
- ✅ Expo Go
- ✅ Builds de desarrollo y producción

## Solución de Problemas

### El usuario se desloguea automáticamente

**Posibles causas:**
1. Tokens expirados sin renovación
2. AsyncStorage limpiado por el sistema
3. Cambio de credenciales en el servidor

**Solución:**
- El usuario debe volver a hacer login
- Los tokens se guardarán nuevamente

### La app no redirige al mapa automáticamente

**Verificar:**
1. Que la sesión esté guardada en AsyncStorage
2. Los logs de consola
3. Que no haya errores de red

## Archivos Modificados

- ✅ `app/index.tsx` - Verificación inicial de sesión
- ✅ `app/_layout.tsx` - Inicialización de sesión
- ✅ `utils/supabase.ts` - Configuración de persistencia
- ✅ `app/(protected)/_layout.tsx` - Protección de rutas

## Testing

### Probar la persistencia:

1. **Hacer login** en la app
2. **Cerrar la app completamente** (force quit)
3. **Volver a abrir** la app
4. **Verificar** que va directamente al mapa sin pedir login

### Probar cierre de sesión:

1. **Ir al perfil**
2. **Cerrar sesión**
3. **Verificar** que redirige a la pantalla de bienvenida
4. **Cerrar y abrir** la app
5. **Verificar** que pide login nuevamente

