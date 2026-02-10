# ⚡ Guía Rápida: Marcadores del Mapa

## 🚀 Quick Start

### Uso Básico
```typescript
import BarMapMarker from '~/components/BarMapMarker';

// En tu componente
<BarMapMarker type="default" />        // Bar normal
<BarMapMarker type="boosted" animated />  // Bar con boost
<BarMapMarker type="selected" />       // Bar seleccionado
```

---

## 📋 Cheat Sheet

### Props del Componente
```typescript
interface BarMapMarkerProps {
  type: 'default' | 'boosted' | 'selected';
  animated?: boolean;  // default: false
}
```

### Colores por Estado
```typescript
const COLORS = {
  default: {
    bg: '#1E3A5F',      // Deep Blue
    border: '#4A90E2',   // Bright Blue
  },
  boosted: {
    bg: '#2C1810',      // Dark Brown
    border: '#FFD700',   // Gold
  },
  selected: {
    bg: '#C44D2C',      // Deep Orange
    border: '#FF8C42',   // Bright Orange
  },
};
```

### Reglas de Priorización
```typescript
// En Map.tsx
let markerType = 'default';
if (isBoosted && !isSelected) markerType = 'boosted';
if (isSelected) markerType = 'selected';
```

---

## 🔧 Integración con Context

### Obtener Bares con Boost
```typescript
import { useBoostSelection } from '~/context/BoostSelectionContext';

const { selectedBoostBarIds } = useBoostSelection();

// Verificar si un bar tiene boost
const isBoosted = selectedBoostBarIds.includes(bar.id);
```

---

## 📱 Ejemplo Completo

```typescript
import MapboxGL from '@rnmapbox/maps';
import BarMapMarker from '~/components/BarMapMarker';
import { useBoostSelection } from '~/context/BoostSelectionContext';

function MyMap() {
  const [selectedBarId, setSelectedBarId] = useState(null);
  const { selectedBoostBarIds } = useBoostSelection();
  
  return (
    <MapboxGL.MapView>
      {bars.map((bar) => {
        const isSelected = bar.id === selectedBarId;
        const isBoosted = selectedBoostBarIds.includes(bar.id);
        
        let type = 'default';
        if (isBoosted && !isSelected) type = 'boosted';
        if (isSelected) type = 'selected';
        
        return (
          <MapboxGL.PointAnnotation
            key={bar.id}
            coordinate={[bar.longitude, bar.latitude]}
            onSelected={() => setSelectedBarId(bar.id)}
          >
            <BarMapMarker 
              type={type} 
              animated={type === 'boosted'} 
            />
          </MapboxGL.PointAnnotation>
        );
      })}
    </MapboxGL.MapView>
  );
}
```

---

## 🎨 Customización Rápida

### Cambiar Colores
Edita `/components/BarMapMarker.tsx`:
```typescript
// Busca estas líneas en los estilos:
backgroundColor: '#1E3A5F',  // Cambia aquí
borderColor: '#4A90E2',      // Y aquí
```

### Ajustar Animación
```typescript
// En BarMapMarker.tsx, busca:
Animated.timing(pulseAnim, {
  toValue: 1.15,        // Cambiar scale máximo
  duration: 1000,       // Cambiar velocidad
  useNativeDriver: true,
})
```

### Cambiar Tamaño
```typescript
// En los estilos del componente:
markerBubble: {
  width: 28,   // Cambiar aquí
  height: 28,  // Y aquí
  // ...
}
```

---

## 🐛 Troubleshooting

### Marcador no se muestra
```typescript
// Verificar:
1. ✅ Importación correcta
2. ✅ Props correctas
3. ✅ Coordenadas válidas
4. ✅ Anchor correcto: { x: 0.5, y: 1.0 }
```

### Animación no funciona
```typescript
// Verificar:
1. ✅ prop animated={true}
2. ✅ type="boosted"
3. ✅ No está seleccionado
```

### Color incorrecto
```typescript
// Verificar orden de prioridad:
if (isSelected) return 'selected';  // PRIMERO
if (isBoosted) return 'boosted';    // SEGUNDO
return 'default';                   // ÚLTIMO
```

---

## 📚 Archivos Importantes

| Archivo | Descripción |
|---------|-------------|
| `/components/BarMapMarker.tsx` | Componente principal |
| `/components/Map.tsx` | Implementación en mapa |
| `/context/BoostSelectionContext.tsx` | Context de boost |
| `/docs/MAP_MARKERS_IMPLEMENTATION.md` | Docs completas |
| `/docs/VISUAL_MARKERS_GUIDE.md` | Guía visual |

---

## 💡 Tips Rápidos

### Performance
- ✅ Componente memoizado automáticamente
- ✅ Animaciones nativas (60fps)
- ✅ No animar marcador seleccionado

### UX
- 🎯 Priorizar estado seleccionado
- 🟡 Animar solo marcadores boosted
- 🔵 Mantener diseño simple y claro

### Debugging
```typescript
// Añadir logs temporales:
console.log('Marker type:', type);
console.log('Is boosted:', isBoosted);
console.log('Is selected:', isSelected);
```

---

## 🔗 Enlaces Rápidos

- 📖 [Documentación Completa](./MAP_MARKERS_IMPLEMENTATION.md)
- 🎨 [Guía Visual](./VISUAL_MARKERS_GUIDE.md)
- 📝 [Resumen de Cambios](./CAMBIOS_MARCADORES_MAPA.md)
- 🏗️ [Context de Boost](../context/BoostSelectionContext.tsx)

---

## ✅ Checklist de Implementación

Cuando agregues marcadores a una nueva pantalla:

- [ ] Importar `BarMapMarker`
- [ ] Importar `useBoostSelection`
- [ ] Obtener `selectedBoostBarIds` del context
- [ ] Implementar estado de selección
- [ ] Aplicar lógica de priorización
- [ ] Añadir prop `animated` solo para boosted
- [ ] Configurar `anchor: { x: 0.5, y: 1.0 }`
- [ ] Probar los tres estados
- [ ] Verificar animaciones
- [ ] Hacer cleanup del código

---

**¡Happy Coding!** 🚀

