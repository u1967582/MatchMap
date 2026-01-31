# 🗺️ Sistema de Navegación en la App con MapBox

## 📅 Fecha de Implementación
30 de enero de 2026

## 🎯 Objetivo
Implementar un sistema completo de navegación dentro de la aplicación usando MapBox Directions API, similar a Google Maps, permitiendo a los usuarios ver rutas trazadas en el mapa y obtener información de distancia y tiempo estimado.

---

## ✨ Funcionalidades Implementadas

### 1. **Botón "Cómo llegar" en la Carta del Bar**
- ✅ Botón azul prominente en `BarInfoCard`
- ✅ Se muestra cuando hay coordenadas disponibles
- ✅ Al presionar, inicia la navegación dentro de la app

### 2. **Sistema de Rutas con MapBox Directions API**
- ✅ Hook personalizado `useMapboxDirections` para gestionar rutas
- ✅ Cálculo automático de la mejor ruta en auto
- ✅ Obtención de distancia (km) y tiempo estimado (min)
- ✅ Instrucciones paso a paso (turn-by-turn)

### 3. **Visualización de Ruta en el Mapa**
- ✅ Línea azul con borde blanco sobre el mapa
- ✅ Marcador de bandera roja en el destino
- ✅ Cámara ajustada automáticamente para mostrar toda la ruta
- ✅ Animación suave al cambiar de vista

### 4. **Panel de Información de Navegación**
- ✅ Panel flotante en la parte superior del mapa
- ✅ Muestra nombre del destino
- ✅ Tiempo estimado de llegada
- ✅ Distancia total
- ✅ Botón de cancelar navegación

---

## 📁 Archivos Modificados/Creados

### 1. **Nuevo Hook: `hooks/useMapboxDirections.ts`**

**Propósito:** Gestionar las llamadas a la API de MapBox Directions y procesar las respuestas.

**Funciones principales:**
- `getDirections(origin, destination)`: Obtiene la ruta entre dos puntos
- `clearRoute()`: Limpia la ruta actual
- Estados: `loading`, `error`, `routeData`

**Ejemplo de uso:**
```typescript
const { routeData, getDirections, clearRoute } = useMapboxDirections();

await getDirections(
  { latitude: 41.3851, longitude: 2.1734 },
  { latitude: 41.3879, longitude: 2.1699 }
);
```

**Respuesta de `routeData`:**
```typescript
{
  coordinates: [[lng, lat], [lng, lat], ...], // Array de coordenadas de la ruta
  distance: 2.5, // km
  duration: 8, // minutos
  steps: [
    { instruction: "Gira a la derecha", distance: 150 },
    { instruction: "Continúa recto", distance: 500 },
    // ...
  ]
}
```

---

### 2. **Actualizado: `components/BarInfoCard.tsx`**

#### Cambios en la Interface:
```typescript
interface Bar {
  // ... campos existentes
  latitude: number;  // NUEVO
  longitude: number; // NUEVO
}

interface BarInfoCardProps {
  // ... props existentes
  onStartNavigation?: (destination: {
    latitude: number;
    longitude: number;
    name: string;
  }) => void; // NUEVO
}
```

#### Nueva Función:
```typescript
const handleStartNavigation = () => {
  if (onStartNavigation) {
    onStartNavigation({
      latitude: bar.latitude,
      longitude: bar.longitude,
      name: bar.name
    });
    onClose(); // Cierra la carta al iniciar navegación
  }
};
```

#### Nuevo Botón en la UI:
```tsx
{onStartNavigation && (
  <TouchableOpacity 
    style={styles.navigateButton}
    onPress={handleStartNavigation}
  >
    <Ionicons name="navigate" size={18} color="#FFFFFF" />
    <Text style={styles.navigateButtonText}>Cómo llegar</Text>
  </TouchableOpacity>
)}
```

---

### 3. **Actualizado: `components/Map.tsx`**

#### Nuevos Estados:
```typescript
const [isNavigating, setIsNavigating] = useState(false);
const [navigationDestination, setNavigationDestination] = useState<{
  latitude: number;
  longitude: number;
  name: string;
} | null>(null);
```

#### Nuevas Funciones:

**1. `handleStartNavigation`:**
```typescript
const handleStartNavigation = async (destination) => {
  // 1. Establece el destino
  setNavigationDestination(destination);
  setIsNavigating(true);
  
  // 2. Obtiene la ruta de MapBox
  const route = await getDirections(userLocation, destination);
  
  // 3. Ajusta la cámara para mostrar toda la ruta
  if (route) {
    // Calcula bounds y hace fit
    cam.fitBounds(bounds.ne, bounds.sw, padding, duration);
  }
};
```

**2. `handleCancelNavigation`:**
```typescript
const handleCancelNavigation = () => {
  setIsNavigating(false);
  setNavigationDestination(null);
  clearRoute();
  
  // Vuelve a centrar en ubicación del usuario
  cam.setCamera({ centerCoordinate: userLocation, zoomLevel: 15 });
};
```

#### Visualización de la Ruta:
```tsx
{isNavigating && routeData && (
  <MapboxGL.ShapeSource
    id="routeSource"
    shape={{
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: routeData.coordinates
      }
    }}
  >
    {/* Línea exterior blanca */}
    <MapboxGL.LineLayer
      id="routeOutline"
      style={{
        lineColor: '#FFFFFF',
        lineWidth: 7,
        lineCap: 'round',
        lineJoin: 'round',
      }}
    />
    
    {/* Línea interior azul */}
    <MapboxGL.LineLayer
      id="routeLine"
      style={{
        lineColor: '#007AFF',
        lineWidth: 5,
        lineCap: 'round',
        lineJoin: 'round',
      }}
    />
  </MapboxGL.ShapeSource>
)}
```

#### Marcador de Destino:
```tsx
{isNavigating && navigationDestination && (
  <MapboxGL.PointAnnotation
    id="destination-marker"
    coordinate={[navigationDestination.longitude, navigationDestination.latitude]}
  >
    <View style={styles.destinationMarker}>
      <Ionicons name="flag" size={24} color="#EF4444" />
    </View>
  </MapboxGL.PointAnnotation>
)}
```

#### Panel de Información:
```tsx
{isNavigating && routeData && navigationDestination && (
  <View style={styles.navigationPanel}>
    <View style={styles.navigationHeader}>
      <View style={styles.navigationInfo}>
        <Text style={styles.navigationTitle}>
          {navigationDestination.name}
        </Text>
        <View style={styles.navigationStats}>
          <View style={styles.navigationStat}>
            <Ionicons name="time-outline" size={16} color="#10B981" />
            <Text>{Math.round(routeData.duration)} min</Text>
          </View>
          <View style={styles.navigationStat}>
            <Ionicons name="navigate-outline" size={16} color="#007AFF" />
            <Text>{routeData.distance.toFixed(1)} km</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity onPress={handleCancelNavigation}>
        <Ionicons name="close" size={24} color="#EF4444" />
      </TouchableOpacity>
    </View>
  </View>
)}
```

---

## 🎨 Diseño Visual

### Colores Utilizados:
- **Línea de ruta interior:** `#007AFF` (Azul iOS)
- **Línea de ruta exterior:** `#FFFFFF` (Blanco)
- **Marcador de destino:** `#EF4444` (Rojo)
- **Panel de navegación:** `#1C2A3A` (Fondo oscuro)
- **Borde del panel:** `#007AFF` (Azul)
- **Tiempo estimado:** `#10B981` (Verde)

### Animaciones:
- ✨ Transición suave de cámara (1000ms)
- ✨ Fade in/out del panel de navegación
- ✨ Animación del marcador de destino

---

## 🔄 Flujo de Usuario

### 1. **Inicio de Navegación:**
```
Usuario toca un marcador en el mapa
  ↓
Se abre la carta del bar (BarInfoCard)
  ↓
Usuario toca "Cómo llegar"
  ↓
La carta se cierra
  ↓
Se muestra el panel de navegación
  ↓
Se traza la ruta en azul sobre el mapa
  ↓
La cámara se ajusta para mostrar toda la ruta
  ↓
Se muestra una bandera roja en el destino
```

### 2. **Cancelar Navegación:**
```
Usuario toca el botón X en el panel
  ↓
Se oculta el panel de navegación
  ↓
Se borra la línea de ruta
  ↓
Se quita el marcador de destino
  ↓
La cámara vuelve a centrarse en la ubicación del usuario
```

---

## 📊 Datos de la API de MapBox

### Endpoint Utilizado:
```
https://api.mapbox.com/directions/v5/mapbox/driving/{coordinates}
```

### Parámetros:
- `coordinates`: `{lng},{lat};{lng},{lat}` (origen;destino)
- `geometries`: `geojson`
- `steps`: `true` (para instrucciones turn-by-turn)
- `access_token`: Token de MapBox

### Respuesta:
```json
{
  "routes": [
    {
      "geometry": {
        "coordinates": [[lng, lat], ...],
        "type": "LineString"
      },
      "distance": 2500, // metros
      "duration": 480, // segundos
      "legs": [
        {
          "steps": [
            {
              "distance": 150,
              "duration": 30,
              "maneuver": {
                "instruction": "Gira a la derecha en Carrer de...",
                "type": "turn"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 🚀 Cómo Usar

### Para el Usuario:
1. Abre el mapa
2. Toca cualquier marcador de bar
3. En la carta que aparece, toca "Cómo llegar"
4. ¡La ruta se traza automáticamente!
5. Toca la X para cancelar

### Para Desarrolladores:

**Usar el hook en otro componente:**
```typescript
import { useMapboxDirections } from '~/hooks/useMapboxDirections';

const MyComponent = () => {
  const { routeData, getDirections, loading, error } = useMapboxDirections();
  
  const navigate = async () => {
    const route = await getDirections(
      { latitude: 41.3851, longitude: 2.1734 },
      { latitude: 41.3879, longitude: 2.1699 }
    );
    
    if (route) {
      console.log(`Distancia: ${route.distance.toFixed(1)} km`);
      console.log(`Tiempo: ${Math.round(route.duration)} min`);
    }
  };
  
  return <Button onPress={navigate} />;
};
```

---

## ⚡ Rendimiento

### Optimizaciones:
- ✅ Las rutas se calculan **solo cuando se necesitan**
- ✅ Se usa `useCallback` para evitar re-renders innecesarios
- ✅ La línea de ruta usa `ShapeSource` de MapBox (renderizado nativo)
- ✅ El panel de navegación solo se monta cuando `isNavigating = true`

### Consumo de API:
- 1 llamada por cada ruta calculada
- El límite gratuito de MapBox es **50,000 solicitudes/mes**
- Costo aproximado: **$0.50 por 1000 solicitudes** después del límite

---

## 🐛 Manejo de Errores

### Errores Comunes:

**1. Sin ubicación del usuario:**
```typescript
if (!userLocation) {
  Alert.alert('Error', 'No se pudo obtener tu ubicación actual');
  return;
}
```

**2. Sin coordenadas del bar:**
```typescript
if (!bar.latitude || !bar.longitude) {
  Alert.alert('Error', 'No hay coordenadas disponibles para este bar');
  return;
}
```

**3. Error de la API de MapBox:**
```typescript
if (error) {
  Alert.alert('Error', 'No se pudo calcular la ruta');
  clearRoute();
}
```

**4. Sin ruta encontrada:**
```typescript
if (!data.routes || data.routes.length === 0) {
  throw new Error('No se encontró ninguna ruta');
}
```

---

## 🔮 Futuras Mejoras

### Funcionalidades Pendientes:
- [ ] Navegación paso a paso con instrucciones en tiempo real
- [ ] Recalcular ruta si el usuario se desvía
- [ ] Mostrar tráfico en tiempo real
- [ ] Múltiples opciones de ruta (más rápida, más corta, evitar autopistas)
- [ ] Modos de transporte adicionales (caminando, bicicleta, transporte público)
- [ ] Compartir ubicación/ruta con otros usuarios
- [ ] Guardar rutas favoritas
- [ ] Navegación con voz (text-to-speech)
- [ ] Modo offline con mapas descargados

### Optimizaciones Técnicas:
- [ ] Cache de rutas calculadas
- [ ] Precalcular rutas a bares cercanos
- [ ] Compresión de coordenadas de ruta
- [ ] Lazy loading de instrucciones detalladas
- [ ] WebSocket para actualizaciones en tiempo real

---

## 📝 Notas Técnicas

### MapBox vs Google Maps:
**Ventajas de MapBox:**
- ✅ Más económico (gratuito hasta 50k peticiones/mes)
- ✅ Personalización completa del estilo del mapa
- ✅ Mejor rendimiento en React Native
- ✅ Soporte nativo para GeoJSON
- ✅ Más control sobre la visualización

**Desventajas:**
- ❌ Menos datos de tráfico en tiempo real que Google
- ❌ Menor cobertura en algunos países
- ❌ Comunidad más pequeña

### Alternativas Evaluadas:
1. **Google Maps Directions API**: Más caro ($5/1000 solicitudes)
2. **Apple Maps**: Solo iOS, integración complicada
3. **OpenStreetMap**: Gratuito pero menos preciso
4. **HERE Maps**: Similar a MapBox pero más caro

---

## ✅ Testing

### Casos de Prueba:

**1. Navegación Exitosa:**
- ✅ Se traza la ruta correctamente
- ✅ Se muestra el panel con información
- ✅ La cámara se ajusta correctamente

**2. Cancelar Navegación:**
- ✅ Se limpia la ruta
- ✅ Se oculta el panel
- ✅ La cámara vuelve al usuario

**3. Error de Ubicación:**
- ✅ Se muestra alerta apropiada
- ✅ No se inicia navegación

**4. Error de Coordenadas:**
- ✅ Se muestra alerta apropiada
- ✅ No se inicia navegación

**5. Error de API:**
- ✅ Se muestra alerta apropiada
- ✅ Se limpia el estado

---

## 🎯 Checklist de Implementación

- [x] Crear hook `useMapboxDirections`
- [x] Actualizar interface `Bar` con coordenadas
- [x] Agregar prop `onStartNavigation` a `BarInfoCard`
- [x] Crear botón "Cómo llegar" en UI
- [x] Implementar `handleStartNavigation` en `Map.tsx`
- [x] Implementar `handleCancelNavigation` en `Map.tsx`
- [x] Agregar visualización de línea de ruta
- [x] Agregar marcador de destino
- [x] Crear panel de información de navegación
- [x] Agregar ajuste automático de cámara
- [x] Implementar manejo de errores
- [x] Agregar estilos y animaciones
- [x] Testing manual
- [x] Documentación completa

---

## 🎉 Resultado Final

Los usuarios ahora pueden:
1. ✅ Ver la ruta trazada en azul dentro de la app
2. ✅ Conocer la distancia y tiempo estimado
3. ✅ Ver el destino marcado con una bandera roja
4. ✅ Cancelar la navegación en cualquier momento
5. ✅ Disfrutar de una experiencia similar a Google Maps

**¡Todo sin salir de la aplicación MatchMap!** 🗺️⚡
