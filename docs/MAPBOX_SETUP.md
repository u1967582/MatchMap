# 🗺️ Configuración de Mapbox para Autocompletado de Direcciones

## 📋 Requisitos

Para usar la funcionalidad de autocompletado de direcciones en el formulario de registro de bares, necesitas configurar Mapbox.

### 1. Token de Mapbox configurado ✅

El token de Mapbox ya está configurado en el proyecto:
```
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoicm9nZXIxN2dvc3QiLCJhIjoiY21jdDlxaG9lMDNveDJqcXVsMTJvMXlvaSJ9.K41sVHLz2k0T8OI0agyp6w
```

### 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```bash
# Mapbox Configuration
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoicm9nZXIxN2dvc3QiLCJhIjoiY21jdDlxaG9lMDNveDJqcXVsMTJvMXlvaSJ9.K41sVHLz2k0T8OI0agyp6w

# Supabase Configuration (actualiza con tus valores reales)
EXPO_PUBLIC_SUPABASE_URL=tu_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### 3. Reiniciar la aplicación

```bash
npx expo start --clear
```

## 🎯 Funcionalidades implementadas

### ✅ Autocompletado de direcciones
- Búsqueda en tiempo real de direcciones
- Filtrado por España (`country: 'es'`)
- Soporte para direcciones y puntos de interés (`types: ['address', 'poi']`)

### ✅ Autocompletado automático de campos
Cuando seleccionas una dirección, se completan automáticamente:
- **Dirección**: `feature.place_name`
- **Ciudad**: Extraída del contexto de Mapbox
- **Código Postal**: Extraído del contexto de Mapbox
- **Latitud/Longitud**: Coordenadas exactas del punto

### ✅ Coordenadas manuales
- Inputs para introducir latitud y longitud manualmente
- Validación de rangos válidos
- Botón para usar ubicación actual del dispositivo

### ✅ Fallback sin token
Si no configuras el token de Mapbox, se muestra un mensaje informativo y los usuarios pueden introducir la información manualmente.

## 🔧 Configuración avanzada

### Opciones de búsqueda personalizadas

```javascript
<SearchBox
  accessToken={process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN}
  options={{ 
    language: 'es',           // Idioma español
    country: 'es',            // Solo España
    types: ['address', 'poi'], // Direcciones y puntos de interés
    limit: 5,                 // Máximo 5 resultados
    proximity: [2.1734, 41.3851] // Priorizar resultados cerca de Barcelona
  }}
  onRetrieve={handleAddressSelect}
  placeholder="Buscar dirección del bar..."
/>
```

### Manejo de errores

```javascript
const handleAddressSelect = (res) => {
  if (!res?.features?.[0]) {
    console.log('No se encontraron resultados');
    return;
  }
  
  const feature = res.features[0];
  // ... procesar la dirección seleccionada
};
```

## 📱 Uso en la aplicación

1. **Paso 3 del registro de bares**: Ubicación
2. **Buscar dirección**: Escribe en el campo de búsqueda
3. **Seleccionar**: Toca la dirección que coincida
4. **Verificar**: Los campos se completan automáticamente
5. **Ajustar**: Modifica manualmente si es necesario
6. **Coordenadas**: Usa el toggle para mostrar/ocultar coordenadas manuales

## 🚀 Beneficios

- ✅ **UX mejorada**: Búsqueda rápida y precisa
- ✅ **Datos precisos**: Coordenadas exactas de Mapbox
- ✅ **Flexibilidad**: Coordenadas manuales como respaldo
- ✅ **Validación**: Rangos válidos de latitud/longitud
- ✅ **Fallback**: Funciona sin token de Mapbox

## 💰 Costos

- **Mapbox**: Plan gratuito incluye 50,000 búsquedas/mes
- **Suficiente**: Para la mayoría de aplicaciones pequeñas/medianas
- **Escalable**: Planes de pago disponibles si necesitas más

## 🔧 Archivos modificados

- ✅ `screens/registerBar/Step3Location.tsx`: Componente con autocompletado
- ✅ `components/Map.tsx`: Usa token desde variables de entorno
- ✅ `app.config.js`: Configuración de variables de entorno
- ✅ `env.example`: Ejemplo de configuración
- ✅ `docs/MAPBOX_SETUP.md`: Documentación completa 