# Implementación de Toasts en MatchMap

## Resumen

Se ha implementado un sistema completo de toasts cross-platform usando `react-native-toast-message` para dar feedback consistente al usuario en acciones comunes, validaciones y errores recuperables.

## Infraestructura (Ya existente)

### Toast Helper (`components/ds/feedback/Toast.tsx`)

✅ **Actualizado** - Añadido método `toastSupabaseError()`

```typescript
export const toast = {
  success(title: string, subtitle?: string)
  error(title: string, subtitle?: string)
  info(title: string, subtitle?: string)
  warning(title: string, subtitle?: string)
  supabaseError(error: any, fallbackMsg: string) // NUEVO
}
```

**Características:**
- Haptic feedback integrado
- Traducciones automáticas de errores comunes de Supabase
- Export centralizado desde `~/components/ds`

## Archivos Modificados

### 1. Autenticación (`app/(auth)/components/`)

#### LoginModal.tsx
**Cambios:**
- ✅ Validación de campos: `toast.warning('Completa todos los campos')`
- ✅ Error de login: `toast.supabaseError(error, 'No se pudo iniciar sesión')`
- ✅ Login exitoso: `toast.success('¡Bienvenido! 👋')`
- ✅ Error genérico: `toast.error('Error inesperado', 'No se pudo iniciar sesión')`

**Justificación:** Toasts son apropiados porque:
- Login es una acción rápida y común
- El usuario solo necesita confirmación breve
- No hay consecuencias irreversibles

#### RegisterModal.tsx
**Cambios:**
- ✅ Validaciones múltiples: `toast.warning()` para cada campo
- ✅ Contraseñas no coinciden: `toast.error('Las contraseñas no coinciden')`
- ✅ Error de registro: `toast.supabaseError(error, 'No se pudo crear la cuenta')`
- ✅ Registro exitoso: `toast.success('Cuenta creada correctamente')`

**Justificación:**
- Validaciones en tiempo real → feedback inmediato con toasts
- Sustituye múltiples Alerts que bloqueaban la UI

#### ForgotPasswordModal.tsx
**Cambios:**
- ✅ Email inválido: `toast.warning('Ingresa un email válido')`
- ✅ Email enviado: `toast.success('Email enviado', 'Revisa tu bandeja de entrada')`
- ✅ Error al enviar: `toast.error('No se pudo enviar el email', 'Inténtalo de nuevo')`

**Justificación:**
- No bloquear la UI con Alert después de enviar email
- Feedback más elegante y menos intrusivo

---

### 2. Favoritos (`app/favorites.tsx`)

**Cambios:**
- ✅ Eliminar favorito (exitoso): `toast.success('Eliminado de favoritos')`
- ✅ Eliminar favorito (error): `toast.error('No se pudo eliminar de favoritos')`
- ⚠️ **Mantiene Alert de confirmación** antes de eliminar

**Justificación:**
- Alert de confirmación se mantiene porque es destructivo y requiere confirmación explícita
- Toast solo para feedback post-acción (éxito/error)
- No usar toast como única señal para acciones importantes

---

### 3. Reseñas

#### WriteReviewScreen (`app/write-review/[barId].tsx`)
**Cambios:**
- ✅ Sin valoración: `toast.warning('Selecciona una valoración')`
- ✅ Sin comentario: `toast.warning('Escribe un comentario sobre tu experiencia')`
- ✅ Reseña publicada: `toast.success('Reseña publicada')` o `'Reseña actualizada'`
- ✅ Error al publicar: `toast.error('No se pudo publicar la reseña', 'Inténtalo de nuevo')`

**Justificación:**
- Publicar reseña no es destructivo
- Toast + navegación automática = mejor UX
- Sustituye Alert que requería tap adicional

#### BarReviewsSection (`components/BarReviewsSection.tsx`)
**Cambios:**
- ✅ Like añadido: `toast.success('Te ha gustado esta reseña')`
- ✅ Like quitado: Sin toast (sería molesto)
- ✅ Error al añadir like: `toast.error('No se pudo registrar el like')`
- ✅ Error al quitar like: `toast.error('No se pudo quitar el like')`

**Justificación:**
- Like es acción rápida y común (estilo Instagram)
- Toast solo en caso de éxito al añadir (celebración)
- Sin toast al quitar para evitar ruido

---

### 4. Filtros (`components/ui/FilterModal.tsx`)

**Cambios:**
- ✅ Filtros aplicados: `toast.success('Filtros aplicados')` (solo si hay filtros activos)
- ✅ Filtros limpiados: `toast.info('Filtros restablecidos')`

**Justificación:**
- Feedback de que los filtros se aplicaron correctamente
- Usuario sabe que la acción tuvo efecto
- No bloquear el flujo con Alerts

---

### 5. Gestión de Partidos

#### ManualMatchSelection (`app/manual-match-selection/[barId].tsx`)
**Cambios:**
- ✅ No hay partidos seleccionados: `toast.info('Selecciona al menos un partido')`
- ✅ Error cargar partidos: `toast.error('No se pudieron cargar los partidos')`
- ✅ Error cargar equipos: `toast.error('No se pudieron cargar los equipos')`
- ✅ Error cargar competiciones: `toast.error('No se pudieron cargar las competiciones')`
- ✅ Partidos añadidos: `toast.success('Partido añadido')` o `'N partidos añadidos'`
- ✅ Error al guardar: `toast.error('No se pudieron guardar los partidos')`
- ⚠️ **Mantiene Alert** para límite de plan alcanzado

**Justificación:**
- Alert se mantiene para límite de plan (info importante del plan)
- Toast para feedback de operaciones normales
- Mejor UX al añadir múltiples partidos

#### AutoBroadcasts (`app/auto-broadcasts/[barId].tsx`)
**Cambios:**
- ✅ Automatización activada: `toast.success('Automatización activada')`
- ✅ Error al guardar: `toast.error('No se pudieron guardar las selecciones')`

**Justificación:**
- Acción importante pero reversible
- Toast + navegación = flujo más rápido

---

### 6. Boost y Pagos

#### BoostScreen (`app/boost/BoostScreen.tsx`)
**Cambios:**
- ✅ Inicio de pago: `toast.info('Redirigiendo al pago…')`
- ✅ Boost activado: `toast.success('¡Boost activado! ✅', 'Tu bar tiene mayor visibilidad')`
- ⚠️ **Mantiene Alert** para error de barId (crítico)

**Justificación:**
- Toast informativo al iniciar proceso de pago
- Toast de éxito reemplaza Alert innecesario
- Alert se mantiene solo para errores críticos de configuración

#### Paywall (`components/revenuecat/Paywall.tsx`)
**Cambios:**
- ✅ No hay plan seleccionado: `toast.warning('Selecciona un plan primero')`
- ✅ Error cargar productos: `toast.error('No se pudieron cargar los productos', 'Inténtalo de nuevo')`
- ✅ Compra exitosa: `toast.success('¡Compra exitosa!', 'Tu boost ha sido activado')`
- ✅ Pago cancelado: `toast.info('Pago cancelado')`
- ✅ Compras restauradas: `toast.success('Compras restauradas')`
- ✅ Error restaurar: `toast.error('No se pudieron restaurar las compras', '...')`
- ⚠️ **Mantiene Alert** para error crítico de compra (no cancelación)

**Justificación:**
- Cancelación de pago → Toast (usuario lo hizo intencionalmente)
- Error crítico de pago → Alert (requiere atención)
- Compra exitosa → Toast + cerrar modal (flujo rápido)

---

## Reglas de Uso: Toast vs Alert

### ✅ Usar Toast cuando:
- Acción exitosa y reversible
- Validación simple (campo vacío, formato)
- Error recuperable leve (red, timeout)
- Confirmación rápida (like, favorito)
- Feedback de progreso (cargando, procesando)

### ❌ Usar Alert cuando:
- Acción destructiva irreversible (eliminar cuenta)
- Decisión importante con consecuencias
- Error crítico que bloquea funcionalidad
- Límites de plan/subscripción
- Pago fallido por razón importante
- Confirmación antes de acción destructiva

### 🤔 Híbrido (Alert para confirmar, Toast para resultado):
- **Eliminar favorito**: Alert confirma → Toast informa resultado
- **Límite de eventos**: Alert informa límite → Toast no usado
- **Guardar cambios**: Depende del contexto (en general Toast es suficiente)

---

## Patrones de Implementación

### 1. Validaciones simples
```typescript
if (!email.trim()) {
  toast.warning('Ingresa tu correo electrónico');
  return;
}
```

### 2. Operaciones exitosas
```typescript
const { error } = await supabase.from('...').insert(...);
if (error) {
  toast.error('No se pudo guardar');
  return;
}
toast.success('Guardado correctamente');
router.back();
```

### 3. Errores de Supabase
```typescript
const { error } = await supabase.auth.signInWithPassword(...);
if (error) {
  toast.supabaseError(error, 'No se pudo iniciar sesión');
  return;
}
```

### 4. Acción con confirmación
```typescript
Alert.alert('¿Eliminar?', 'Esta acción no se puede deshacer', [
  { text: 'Cancelar', style: 'cancel' },
  {
    text: 'Eliminar',
    style: 'destructive',
    onPress: async () => {
      const success = await deleteItem();
      if (success) {
        toast.success('Eliminado');
      } else {
        toast.error('No se pudo eliminar');
      }
    }
  }
]);
```

### 5. Estados de carga
```typescript
// NO usar toast para "Cargando..." - usar indicadores visuales
// SÍ usar toast para informar inicio de procesos largos
toast.info('Redirigiendo al pago…');
```

---

## Cobertura de Funcionalidades

| Funcionalidad | Toast Implementado | Justificación |
|---------------|-------------------|---------------|
| Login | ✅ | Acción común, feedback rápido |
| Registro | ✅ | Múltiples validaciones, feedback claro |
| Reset password | ✅ | Confirmación de email enviado |
| Editar perfil usuario | ✅ | Validaciones + confirmación guardado |
| Añadir/quitar favorito | ✅ | Acción reversible, feedback inmediato |
| Publicar reseña | ✅ | No bloqueante, flujo rápido |
| Like reseña | ✅ | Acción social rápida |
| Aplicar filtros | ✅ | Confirmación de cambio aplicado |
| Editar info bar | ✅ | Validaciones + confirmación guardado |
| Crear post | ✅ | Validaciones + confirmación creación |
| Editar post | ✅ | Validaciones + confirmación actualización |
| Añadir partidos | ✅ | Feedback de operación múltiple |
| Automatizar retransmisiones | ✅ | Confirmación de activación |
| Boost/Pagos | ✅ | Inicio y resultado de compra |
| Restaurar compras | ✅ | Confirmación de restauración |

---

## Impacto en UX

### Mejoras:
1. **Menos clicks**: Toasts no requieren tap para cerrar (auto-dismiss)
2. **Flujo más rápido**: No bloquean navegación
3. **Feedback claro**: Mensajes concisos en español
4. **Haptic feedback**: Sensación táctil en cada toast
5. **Consistencia**: Mismo estilo en toda la app

### Casos donde se mantuvo Alert:
- Confirmaciones destructivas (eliminar)
- Límites de plan importantes
- Errores críticos de pago
- Errores de configuración del sistema

---

## Testing Checklist

- [ ] Login exitoso muestra "¡Bienvenido! 👋"
- [ ] Login fallido muestra error de credenciales
- [ ] Registro con campos vacíos muestra warnings
- [ ] Registro exitoso muestra "Cuenta creada correctamente"
- [ ] Email de reset muestra "Email enviado"
- [ ] Eliminar favorito muestra "Eliminado de favoritos"
- [ ] Publicar reseña muestra "Reseña publicada"
- [ ] Like reseña muestra "Te ha gustado esta reseña"
- [ ] Aplicar filtros muestra "Filtros aplicados"
- [ ] Añadir 1 partido muestra "Partido añadido"
- [ ] Añadir N partidos muestra "N partidos añadidos"
- [ ] Activar automatización muestra "Automatización activada"
- [ ] Iniciar pago muestra "Redirigiendo al pago…"
- [ ] Boost activado muestra "¡Boost activado! ✅"
- [ ] Pago cancelado muestra "Pago cancelado"
- [ ] Error de red muestra toast con subtitle
- [ ] Toasts se auto-cierran en ~3 segundos
- [ ] Haptic feedback funciona en cada toast

---

## Notas Técnicas

- **Librería**: `react-native-toast-message` v2.x
- **Configuración**: `app/_layout.tsx` (ya existente)
- **Diseño**: `components/ds/feedback/ToastConfig.tsx` (ya existente)
- **Posición**: Top, offset 60px
- **Cross-platform**: Funciona en iOS y Android
- **No depende de Toast nativo**: Implementación custom

---

## Archivos Totales Modificados

### Sistema de Toasts
1. `components/ds/feedback/Toast.tsx` (helper con supabaseError)
2. `components/ds/feedback/ToastConfig.tsx` (reducido tamaño)

### Autenticación
3. `app/(auth)/components/LoginModal.tsx`
4. `app/(auth)/components/RegisterModal.tsx`
5. `app/(auth)/components/ForgotPasswordModal.tsx`

### Funcionalidades Principales
6. `app/favorites.tsx`
7. `app/write-review/[barId].tsx`
8. `components/BarReviewsSection.tsx`
9. `components/ui/FilterModal.tsx`

### Gestión de Bares
10. `app/manual-match-selection/[barId].tsx`
11. `app/auto-broadcasts/[barId].tsx`
12. `app/edit-bar-info/[barId].tsx` ✨ NUEVO
13. `screens/EditProfileScreen.tsx` ✨ NUEVO

### Posts
14. `app/create-post/[barId].tsx` ✨ NUEVO
15. `app/edit-post/[postId].tsx` ✨ NUEVO

### Boost y Pagos
16. `app/boost/BoostScreen.tsx`
17. `components/revenuecat/Paywall.tsx`

**Total: 17 archivos modificados**
**Nuevos: 5 archivos (perfil, bar info, posts)**

---

## Cambios de Diseño (2026-02-09)

### Toasts Más Pequeños
Se redujeron las dimensiones de los toasts para ser menos invasivos:
- **Alto mínimo**: 56px → 48px
- **Padding vertical**: 12px → 8px
- **Padding horizontal**: 16px → 12px
- **Borde izquierdo**: 4px → 3px
- **Radio de borde**: 12px → 10px
- **Ancho**: 92% → 88%
- **Tamaño texto principal**: body → caption
- **Tamaño texto secundario**: caption → caption-1

**Resultado**: Toasts más discretos y elegantes ✨

---

## Próximos Pasos (Opcional)

1. ✅ ~~Añadir toasts en edición de información de bar~~ (COMPLETADO)
2. ✅ ~~Añadir toasts en edición de perfil de usuario~~ (COMPLETADO)
3. ✅ ~~Añadir toasts en crear/editar posts~~ (COMPLETADO)
4. Considerar toasts para búsqueda sin resultados
5. Analytics para tracking de toasts mostrados

---

## Contacto

Para dudas o sugerencias sobre esta implementación, contactar al equipo de desarrollo.
