# 📊 Flujo Visual de Autenticación y Persistencia

## 🔄 Flujo Completo de Sesión

```
┌─────────────────────────────────────────────────────────────────┐
│                     USUARIO ABRE LA APP                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              app/_layout.tsx (Layout Principal)                  │
│  • Inicializa la configuración de Supabase                      │
│  • Restaura sesión desde AsyncStorage (automático)              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    app/index.tsx (Home)                          │
│             Verificación de Sesión Inicial                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
         ┌────────┴─────────┐
         │                  │
    ¿HAY SESIÓN?            │
         │                  │
    ┌────┴────┐            │
    │         │            │
   SÍ        NO            │
    │         │            │
    ▼         ▼            │
    │    ┌──────────────┐  │
    │    │ WelcomeScreen│  │
    │    │              │  │
    │    │ • Login      │  │
    │    │ • Registro   │  │
    │    └──────────────┘  │
    │                      │
    ▼                      │
┌────────────────┐         │
│  Redirige a:   │         │
│  /(protected)  │         │
│     /map       │         │
└────────────────┘         │
                           │
                           ▼
```

## 🔐 Proceso de Login

```
┌─────────────────────────────────────────────────────────────────┐
│                    USUARIO HACE LOGIN                            │
│                (Email/Password o OAuth)                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Supabase Auth API                                │
│  • Verifica credenciales                                         │
│  • Genera tokens (access + refresh)                             │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AsyncStorage                                  │
│  GUARDA:                                                         │
│  • Access Token (token de acceso)                               │
│  • Refresh Token (para renovar)                                 │
│  • User Data (datos del usuario)                                │
│  • Expiration Time (tiempo de expiración)                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│            useAuthStateChange Hook                               │
│  • Detecta evento 'SIGNED_IN'                                   │
│  • Redirige a /(protected)/map                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Flujo al Reabrir la App

```
┌─────────────────────────────────────────────────────────────────┐
│           USUARIO CIERRA Y VUELVE A ABRIR LA APP                │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  app/index.tsx                                   │
│              [LOADING INDICATOR]                                 │
│  • checkAuthAndRedirect()                                       │
│  • supabase.auth.getSession()                                   │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AsyncStorage                                   │
│  LEE:                                                            │
│  • Tokens guardados                                             │
│  • Datos de sesión                                              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
         ┌────────┴─────────┐
         │                  │
  ¿TOKENS VÁLIDOS?          │
         │                  │
    ┌────┴────┐            │
    │         │            │
   SÍ        NO            │
    │         │            │
    ▼         ▼            │
    │   ┌───────────────┐  │
    │   │ WelcomeScreen │  │
    │   │               │  │
    │   │ Pide Login    │  │
    │   └───────────────┘  │
    │                      │
    ▼                      │
┌──────────────────┐       │
│ ✅ REDIRIGE AL   │       │
│      MAPA        │       │
│                  │       │
│ Usuario logeado  │       │
│ automáticamente  │       │
└──────────────────┘       │
                           │
                           ▼
```

## 🔄 Renovación Automática de Tokens

```
┌─────────────────────────────────────────────────────────────────┐
│            Usuario usando la app normalmente                     │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
         ┌────────┴─────────┐
         │                  │
  ¿TOKEN A PUNTO            │
   DE EXPIRAR?              │
         │                  │
    ┌────┴────┐            │
    │         │            │
   SÍ        NO            │
    │         │            │
    │         └──────────► Continúa normal
    │                      
    ▼                      
┌─────────────────────────────────────────────────────────────────┐
│          Supabase Auto Refresh (automático)                      │
│  • Usa Refresh Token                                            │
│  • Obtiene nuevo Access Token                                   │
│  • Guarda en AsyncStorage                                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│           ✅ Sesión renovada transparentemente                   │
│        Usuario no nota ninguna interrupción                      │
└─────────────────────────────────────────────────────────────────┘
```

## 🚪 Flujo de Cierre de Sesión

```
┌─────────────────────────────────────────────────────────────────┐
│      USUARIO HACE CLICK EN "CERRAR SESIÓN"                      │
│               (En Perfil)                                        │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                 supabase.auth.signOut()                          │
│  • Invalida tokens en servidor                                  │
│  • Elimina datos de AsyncStorage                                │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│           onAuthStateChange detecta 'SIGNED_OUT'                 │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│          Redirige a WelcomeScreen (/)                           │
│                                                                  │
│  Al reabrir la app:                                             │
│  • No hay tokens en AsyncStorage                                │
│  • Muestra pantalla de bienvenida                               │
│  • Usuario debe volver a hacer login                            │
└─────────────────────────────────────────────────────────────────┘
```

## 📱 Estados de la App

### Estado 1: Primera Vez (Usuario Nuevo)
```
APP ABIERTA
    ↓
Sin sesión en AsyncStorage
    ↓
Muestra WelcomeScreen
    ↓
Usuario hace Login/Registro
    ↓
Sesión guardada
    ↓
Redirige al Mapa
```

### Estado 2: Usuario Retornando (Con Sesión)
```
APP ABIERTA
    ↓
Lee sesión de AsyncStorage
    ↓
Tokens válidos ✅
    ↓
Redirige DIRECTAMENTE al Mapa
    ↓
Usuario continúa navegando
```

### Estado 3: Sesión Expirada
```
APP ABIERTA
    ↓
Lee sesión de AsyncStorage
    ↓
Tokens expirados ❌
    ↓
Muestra WelcomeScreen
    ↓
Usuario debe hacer login nuevamente
```

## 🔧 Componentes Clave

```
┌────────────────────────────────────────────────────────────┐
│                   SISTEMA DE PERSISTENCIA                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. utils/supabase.ts                                      │
│     • Configuración de persistSession: true               │
│     • storage: AsyncStorage                               │
│     • autoRefreshToken: true                              │
│                                                            │
│  2. app/_layout.tsx                                        │
│     • Inicializa sesión al arrancar                       │
│     • Restaura automáticamente                            │
│                                                            │
│  3. app/index.tsx                                          │
│     • Verifica sesión activa                              │
│     • Redirige según estado                               │
│                                                            │
│  4. app/(protected)/_layout.tsx                            │
│     • Protege rutas                                       │
│     • Verifica autenticación                              │
│                                                            │
│  5. utils/auth.ts                                          │
│     • Hook useAuthStateChange                             │
│     • Funciones de login/logout                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## ⏱️ Timeline de Eventos

```
T=0s    │ Usuario abre la app
        ▼
T=0.1s  │ Layout principal se renderiza
        │ Supabase intenta restaurar sesión
        ▼
T=0.2s  │ AsyncStorage lee tokens
        ▼
T=0.3s  │ index.tsx verifica sesión
        ▼
T=0.4s  │ ✅ DECISIÓN:
        │   • Con sesión → Mapa
        │   • Sin sesión → Welcome
        ▼
T=0.5s  │ Usuario ve la pantalla correcta
```

## 🎯 Beneficios

✅ **Experiencia fluida**: Usuario no tiene que hacer login cada vez
✅ **Seguridad**: Tokens encriptados y renovados automáticamente
✅ **Performance**: Verificación rápida (<500ms)
✅ **Offline-friendly**: Sesión persiste sin conexión
✅ **UX moderna**: Comportamiento esperado en apps modernas

