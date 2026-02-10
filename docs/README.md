# Documentación de MatchMap

Esta carpeta contiene toda la documentación interna del proyecto MatchMap, organizada por categorías para facilitar el acceso y la navegación.

## 📁 Estructura de Documentación

### 🔐 [auth/](./auth/)
Documentación relacionada con autenticación, OAuth, y gestión de sesiones.
- Flujos de autenticación
- Implementación de Google OAuth
- Persistencia de sesión
- Auto-registro y login
- Verificación y testing de auth

**Archivos principales:**
- `FLUJO_AUTENTICACION_VISUAL.md` - Diagrama visual del flujo de autenticación
- `GOOGLE_OAUTH_IMPLEMENTATION_SUMMARY.md` - Resumen de implementación OAuth
- `PERSISTENCIA_DE_SESION.md` - Sistema de persistencia de sesión

### 🚀 [deployment/](./deployment/)
Guías y checklists para despliegue en tiendas de aplicaciones.
- TestFlight setup
- App Store Connect configuración
- Checklists de release
- Preparación para producción

**Archivos principales:**
- `TESTFLIGHT_SETUP.md` - Configuración inicial de TestFlight
- `RELEASE_IOS_TESTFLIGHT_CHECKLIST.md` - Checklist para releases
- `APP_STORE_CONNECT_SETUP.md` - Configuración de App Store Connect

### ✨ [features/](./features/)
Implementación de funcionalidades específicas del producto.
- Sistema de toasts
- Navegación
- Marcadores de mapa
- Filtros de TV
- Sistema de upgrade/boost
- Componentes de UI

**Archivos principales:**
- `TOAST_IMPLEMENTATION_SUMMARY.md` - Sistema completo de toasts
- `NAVIGATION_FEATURE.md` - Implementación de navegación
- `UNIFIED_MARKER_SYSTEM.md` - Sistema unificado de marcadores
- `UPGRADE_FLOW_IMPLEMENTATION.md` - Flujo de upgrade a plan Boost

### 🛠️ [fixes/](./fixes/)
Documentación de bugs resueltos y debugging.
- Fixes de crashes
- Correcciones de UI/UX
- Debugging guides
- Parches de seguridad

**Archivos principales:**
- `APK_CRASH_FIX.md` - Fix de crash en APK
- `USER_LOCATION_MAP_FIX.md` - Corrección de ubicación en mapa
- `CRITICAL_FIX_NULL_PATHS.md` - Fix crítico de paths null

### 📖 [guides/](./guides/)
Guías de referencia rápida y tutoriales.
- Guías de uso de marcadores
- Referencias rápidas
- Comparaciones de implementaciones
- Debugging guides

**Archivos principales:**
- `COMO_FUNCIONAN_TUS_MARCADORES.md` - Explicación del sistema de marcadores
- `QUICK_REFERENCE_MARKERS.md` - Referencia rápida de marcadores
- `VISUAL_MARKERS_GUIDE.md` - Guía visual de marcadores

### ⚖️ [legal/](./legal/)
Documentación legal y políticas.
- Privacy Policy
- Instrucciones de publicación de políticas

**Archivos principales:**
- `PRIVACY_POLICY_PUBLISH.md` - Guía para publicar privacy policy
- `INSTRUCCIONES_PRIVACY_POLICY.md` - Instrucciones para crear/actualizar policy

### 💳 [payments/](./payments/)
Integración de sistema de pagos y subscripciones.
- RevenueCat integration
- Configuración de pagos iOS
- Migración de sistemas de pago
- Quick starts

**Archivos principales:**
- `REVENUECAT_INTEGRATION.md` - Integración completa de RevenueCat
- `REVENUECAT_QUICKSTART.md` - Inicio rápido con RevenueCat
- `PAYMENT_MIGRATION.md` - Migración del sistema de pagos

### ⚙️ [setup/](./setup/)
Configuraciones iniciales y setup de servicios.
- Mapbox setup
- Google OAuth setup
- Variables de entorno
- Configuración de registro de bares
- MCP server config

**Archivos principales:**
- `MAPBOX_SETUP.md` - Configuración de Mapbox
- `GOOGLE_OAUTH_SETUP.md` - Setup completo de Google OAuth
- `ENV_VARIABLES.md` - Documentación de variables de entorno
- `.mcp-config-instructions.md` - Configuración de MCP server

## 🔍 Búsqueda Rápida

### Por tema:
- **Autenticación**: `auth/`
- **Mapas y Ubicación**: `features/` + `setup/MAPBOX_SETUP.md`
- **Pagos**: `payments/`
- **Despliegue**: `deployment/`
- **Bugs y Fixes**: `fixes/`

### Por tipo de documento:
- **Quick Starts**: Busca archivos con `QUICK_START` o `QUICKSTART`
- **Summaries**: Busca archivos con `SUMMARY`
- **Checklists**: Busca archivos con `CHECKLIST`
- **Guides**: Carpeta `guides/`

## 📝 Convenciones

- Archivos en MAYÚSCULAS para facilitar identificación
- Prefijos descriptivos (`FIX_`, `SETUP_`, `GUIDE_`, etc.)
- Formato Markdown para toda la documentación
- Incluir fecha de última actualización cuando sea relevante

## 🔄 Mantenimiento

Al agregar nueva documentación:
1. Determina la categoría apropiada
2. Usa nombres descriptivos en MAYÚSCULAS
3. Actualiza este README si es necesario
4. Vincula documentos relacionados entre sí

---

**Última actualización**: 2026-02-10
