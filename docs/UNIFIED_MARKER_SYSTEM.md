# Sistema de Marcadores Unificados

## 📍 Resumen

Se ha implementado un sistema unificado de marcadores para el mapa que utiliza la misma estética (icono `location` de Ionicons) pero con diferentes colores y tamaños según el estado del bar.

## 🎨 Tipos de Marcadores

### 1. **Predeterminado (Default)**
- **Color**: Azul `#007AFF`
- **Tamaño**: 32px
- **Uso**: Bares normales sin estado especial
- **Prioridad**: Más baja

### 2. **Card Visible (Selected)**
- **Color**: Azul claro `#60A5FA`
- **Tamaño**: 36px
- **Uso**: Bar cuya tarjeta de información está siendo vista
- **Prioridad**: Media-baja

### 3. **Promocionado (Boosted)**
- **Color**: Dorado `#FFD700`
- **Tamaño**: 36px
- **Uso**: Bar con boost activo
- **Animación**: Pulso sutil (escala 1.0 → 1.15)
- **Prioridad**: Media-alta

### 4. **Destino (Destination)**
- **Color**: Rojo `#EF4444`
- **Tamaño**: 36px
- **Uso**: Bar al que se está navegando
- **Animación**: Pulso sutil (escala 1.0 → 1.15)
- **Prioridad**: Máxima

## 🔝 Sistema de Prioridad

Cuando un bar puede tener múltiples estados, se aplica el siguiente orden de prioridad:

```
Destination > Boosted > Selected > Default
```

### Ejemplos:
- Bar boosted + seleccionado = Muestra como **boosted** (dorado)
- Bar seleccionado + destino = Muestra como **destination** (rojo)
- Bar boosted + destino = Muestra como **destination** (rojo)
- Bar normal seleccionado = Muestra como **selected** (verde)

## 💻 Implementación Técnica

### BarMapMarker Component

```typescript
export type MarkerType = 'default' | 'boosted' | 'selected' | 'destination';

interface BarMapMarkerProps {
  type: MarkerType;
  animated?: boolean;
  onPress?: () => void;
}
```

**Características:**
- Iconos simples: `<Ionicons name="location" />`
- Sin Views anidados (soluciona error de Mapbox)
- Animación de pulso para boosted y destination
- TouchableOpacity opcional para interactividad

### Lógica de Prioridad en Map.tsx

```typescript
// Determinar tipo con prioridad
let markerType: MarkerType = 'default';

if (isSelected && !isBoosted && !isDestination) {
  markerType = 'selected';
}
if (isBoosted && !isDestination) {
  markerType = 'boosted';
}
if (isDestination) {
  markerType = 'destination';
}
```

## ✅ Ventajas del Sistema

1. **Consistencia visual**: Todos los marcadores usan el mismo icono
2. **Jerarquía clara**: El color y tamaño indican importancia
3. **Sin errores**: Un solo elemento por PointAnnotation
4. **Animaciones sutiles**: Pulso solo para estados importantes
5. **Código limpio**: Lógica centralizada y mantenible

## 🎯 Estados Visuales

```
🔵 Azul oscuro (32px)      → Bar normal
🔵 Azul claro (36px)       → Viendo información
🟡 Dorado (36px)           → Bar promocionado (con pulso)
🔴 Rojo (36px)             → Destino de navegación (con pulso)
```

## 📝 Notas de Implementación

- El marcador de destino ya NO es un elemento separado
- Cuando se navega a un bar, su marcador cambia automáticamente a tipo 'destination'
- La animación de pulso se aplica automáticamente a boosted y destination
- El anchor point es `{ x: 0.5, y: 1.0 }` para todos los marcadores

---

**Fecha de implementación**: 30 de enero de 2026
**Archivos modificados**:
- `components/BarMapMarker.tsx`
- `components/Map.tsx`
