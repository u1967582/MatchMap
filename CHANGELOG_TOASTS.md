# Changelog - Sistema de Toasts

## [2.0.0] - 2026-02-09

### 🎨 Diseño
- **Toasts más pequeños**: Reducido el tamaño para ser menos invasivos
  - Alto mínimo: 56px → 48px
  - Padding reducido
  - Ancho: 92% → 88%
  - Tamaño de texto más compacto

### ✨ Nuevas Funcionalidades

#### Edición de Perfil de Usuario
- Toasts en validaciones de campos
- Confirmación al guardar: "Perfil actualizado"
- Errores de carga de imagen con feedback específico
- Error al cargar perfil
- Info cuando no hay cambios para guardar

#### Edición de Información del Bar
- Validaciones con toasts (nombre, teléfono, URL)
- Confirmación al guardar: "Información actualizada"
- Error al cargar información del bar
- Error al actualizar información

#### Gestión de Posts

**Crear Post:**
- Validación de campos obligatorios
- Error al seleccionar imagen
- Confirmación: "Post creado correctamente"
- Warning cuando se crea sin imagen: "Post creado, pero no se pudo subir la imagen"
- Error al crear post

**Editar Post:**
- Validación de título y descripción
- Error al cargar post
- Error al procesar/subir imagen
- Confirmación: "Post actualizado"
- Error al actualizar post

### 📊 Estadísticas
- **Archivos modificados**: 5 nuevos (total: 17)
- **Toasts añadidos**: +30 nuevos
- **Alerts reemplazados**: +29
- **Cobertura**: 15 funcionalidades completas

---

## [1.0.0] - 2026-02-07

### ✨ Lanzamiento Inicial

#### Sistema Base
- Helper centralizado con 4 métodos: success, error, info, warning
- Método especial `supabaseError()` para auto-traducción
- Haptic feedback integrado
- Configuración de diseño personalizada

#### Funcionalidades Implementadas

**Autenticación:**
- Login (éxito, error, validaciones)
- Registro (validaciones múltiples, confirmación)
- Reset password (confirmación email enviado)

**Favoritos:**
- Añadir/eliminar con confirmación
- Hybrid: Alert confirma + Toast resultado

**Reseñas:**
- Publicar/actualizar reseña
- Like/unlike reseña
- Validaciones

**Filtros:**
- Aplicar filtros
- Limpiar filtros

**Gestión de Partidos:**
- Añadir partidos manualmente (1 o múltiples)
- Automatizar retransmisiones
- Errores de carga

**Boost y Pagos:**
- Inicio de pago
- Compra exitosa
- Pago cancelado
- Restaurar compras
- Errores de carga de productos

### 📊 Estadísticas Iniciales
- **Archivos modificados**: 12
- **Toasts implementados**: ~40 puntos de feedback
- **Alerts reemplazados**: ~35
- **Cobertura**: 10 funcionalidades principales

---

## Reglas de Uso

### ✅ Usar Toast
- Acciones exitosas reversibles
- Validaciones simples
- Errores recuperables leves
- Confirmaciones rápidas

### ❌ Usar Alert
- Acciones destructivas irreversibles
- Límites de plan/subscripción
- Errores críticos de pago
- Confirmaciones antes de destruir datos

### 🤝 Híbrido (Alert + Toast)
- Alert para confirmar → Toast para resultado
- Ejemplo: Eliminar favorito, descartar cambios

---

## Próximas Versiones

### [2.1.0] - Planeado
- [ ] Toasts en búsqueda sin resultados
- [ ] Toast personalizado para subida de múltiples imágenes
- [ ] Analytics de toasts mostrados
- [ ] Toast con acción (undo/retry)

### [3.0.0] - Futuro
- [ ] Toasts con animaciones personalizadas
- [ ] Toast queue system (máximo 3 visibles)
- [ ] Toasts persistentes (con dismiss manual)
- [ ] Soporte para rich content (imágenes, progress bars)
