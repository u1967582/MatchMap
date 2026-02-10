# Map Markers Implementation

## Overview
Este documento describe la implementación del sistema de marcadores del mapa, diseñado para mostrar diferentes estados visuales para los bares en el mapa.

## Componentes

### BarMapMarker
Componente principal para renderizar marcadores en el mapa con tres estados distintos:

#### Estados del Marcador

1. **Default (Predeterminado)**
   - Color: Azul (`#1E3A5F` fondo, `#4A90E2` borde)
   - Uso: Bares estándar sin boost activo
   - Estilo: Marcador circular con borde azul brillante y punto interior

2. **Boosted (Con Boost Activo)**
   - Color: Dorado (`#2C1810` fondo, `#FFD700` borde)
   - Uso: Bares con boost activo
   - Características especiales:
     - Animación de pulso (escala 1.0 ↔ 1.15, duración 1s)
     - Efecto de brillo dorado (glow)
     - Punto interior dorado claro (`#FFF4C4`)
     - Sombra dorada para mayor visibilidad

3. **Selected (Seleccionado)**
   - Color: Naranja (`#C44D2C` fondo, `#FF8C42` borde)
   - Uso: Bar actualmente seleccionado por el usuario
   - Características:
     - Mayor elevación (elevation: 9)
     - Efecto de brillo naranja
     - Punto interior naranja claro (`#FFE5D9`)
     - Sin animación para estabilidad visual

#### Prioridad de Estados
```
Selected > Boosted > Default
```
Si un bar está seleccionado, se muestra como "selected" independientemente de si tiene boost.

## Integración con el Sistema de Boost

### Context: BoostSelectionContext
El sistema utiliza `BoostSelectionContext` para compartir el estado de los bares con boost entre componentes:

```typescript
interface BoostSelectionContextValue {
  selectedBoostBarIds: string[];      // IDs de bares con boost activo
  centerLatLng: LatLng | null;        // Centro del mapa
  setSelectedBoostBarIds: (ids: string[]) => void;
  setCenterLatLng: (center: LatLng | null) => void;
}
```

**Características del Contexto:**
- Debouncing de 300ms para actualizaciones de centro
- Threshold de distancia de 50m para evitar actualizaciones excesivas
- Optimización con refs para evitar re-renders innecesarios

### Hook: useBoostBars
Hook personalizado para obtener información sobre bares con boost activo:

```typescript
const { boostBars, top5NearestActive, selected3Stable } = useBoostBars({
  centerLatLng,
  enabled: true
});
```

## Implementación en Map.tsx

### Lógica de Renderizado de Marcadores

```typescript
{bars.map((bar) => {
  const isSelected = bar.id === selectedMarkerId;
  const isBoosted = selectedBoostBarIds.includes(bar.id);

  // Determinar tipo de marcador: Selected > Boosted > Default
  let markerType: 'default' | 'boosted' | 'selected' = 'default';
  if (isBoosted && !isSelected) {
    markerType = 'boosted';
  }
  if (isSelected) {
    markerType = 'selected';
  }

  return (
    <MapboxGL.PointAnnotation
      key={`bar-${bar.id}`}
      id={`bar-${bar.id}`}
      coordinate={[bar.longitude, bar.latitude]}
      onSelected={() => handleMarkerPress(bar)}
      anchor={{ x: 0.5, y: 1.0 }}
    >
      <BarMapMarker 
        type={markerType} 
        animated={isBoosted && !isSelected} 
      />
    </MapboxGL.PointAnnotation>
  );
})}
```

### Características de la Implementación

1. **Animación Condicional**
   - Solo los marcadores boosted (no seleccionados) tienen animación
   - Evita distracciones visuales en el marcador seleccionado

2. **Optimización de Rendimiento**
   - Componente `BarMapMarker` memoizado con `React.memo`
   - Animaciones nativas con `useNativeDriver: true`
   - Limpieza adecuada de animaciones en desmontaje

3. **Accesibilidad Visual**
   - Colores con alto contraste contra el fondo oscuro del mapa
   - Efectos de sombra y brillo para mejorar la visibilidad
   - Punto interior en cada marcador para mayor claridad

## Paleta de Colores

### Default (Azul)
- Fondo: `#1E3A5F` (Deep Blue)
- Borde: `#4A90E2` (Bright Blue)
- Punto interior: `#4A90E2`

### Boosted (Dorado)
- Fondo: `#2C1810` (Dark Brown/Black)
- Borde: `#FFD700` (Gold)
- Punto interior: `#FFF4C4` (Light Gold)
- Brillo: `#FFD700` con opacidad 0.8

### Selected (Naranja)
- Fondo: `#C44D2C` (Deep Orange)
- Borde: `#FF8C42` (Bright Orange)
- Punto interior: `#FFE5D9` (Light Orange)
- Brillo: `#FF6B35` con opacidad 0.6

## Estructura del Marcador

Cada marcador consiste en tres elementos principales:

1. **Glow Effect (Efecto de Brillo)**
   - Solo visible en marcadores boosted y selected
   - Posicionado absolutamente detrás del marcador
   - Crea un halo de color alrededor del marcador

2. **Bubble (Burbuja Principal)**
   - Círculo de 28x28 píxeles
   - Borde de 3-3.5 píxeles
   - Contiene el punto interior
   - Sombras para profundidad visual

3. **Tail (Cola/Punta)**
   - Triángulo apuntando hacia abajo
   - Indica la ubicación exacta en el mapa
   - Color coincidente con el borde del marcador

## Uso del Componente

### Importación
```typescript
import BarMapMarker from '~/components/BarMapMarker';
```

### Props
```typescript
interface BarMapMarkerProps {
  type: 'default' | 'boosted' | 'selected';  // Tipo de marcador
  animated?: boolean;                         // Si debe animar (default: false)
}
```

### Ejemplos de Uso

```typescript
// Marcador predeterminado
<BarMapMarker type="default" />

// Marcador con boost animado
<BarMapMarker type="boosted" animated={true} />

// Marcador seleccionado (sin animación)
<BarMapMarker type="selected" />
```

## Mejoras Futuras

1. **Marcadores Personalizados por Categoría**
   - Iconos específicos para diferentes tipos de bares
   - Colores adicionales según categoría

2. **Animaciones Adicionales**
   - Transiciones suaves entre estados
   - Efecto de "pop" al seleccionar

3. **Clustering**
   - Agrupar marcadores cuando hay muchos en una zona
   - Mostrar contador de bares en cluster

4. **Información en Hover**
   - Vista previa del nombre del bar al hacer hover
   - Rating visible sin necesidad de hacer clic

## Archivos Relacionados

- `/components/BarMapMarker.tsx` - Componente de marcador
- `/components/Map.tsx` - Implementación del mapa
- `/context/BoostSelectionContext.tsx` - Contexto de boost
- `/hooks/useBoostBars.ts` - Hook para obtener bares con boost
- `/utils/geo.ts` - Utilidades de geolocalización

