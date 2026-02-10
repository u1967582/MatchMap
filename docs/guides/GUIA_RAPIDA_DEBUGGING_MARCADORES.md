# 🔍 Guía Rápida: Debugging de Marcadores

## 📱 Comandos para Ejecutar

```bash
# Ejecutar la app
npm start

# Limpiar caché si hay problemas
npm start -- --clear

# Ver logs en tiempo real
# (Automáticamente en la terminal donde corre expo)
```

---

## 🎯 Qué Buscar en los Logs

### 1️⃣ Al Cargar el Mapa

**Debes ver**:
```
📊 BARS: Total bars loaded: X
```
✅ **Si aparece**: Los bares se cargaron correctamente  
❌ **Si no aparece**: Problema con Supabase o query

---

### 2️⃣ Carga de Boost

**Debes ver**:
```
🟡 BOOST: Loaded boost bars: X bars with boost
🟡 BOOST: Bar IDs with boost: ['id1', 'id2', ...]
```
✅ **Si aparece**: Los boosts se cargaron correctamente  
❌ **Si no aparece**: 
- No hay bares con boost en BD
- Problema con ubicación del usuario
- Error en useBoostBars hook

**Verificar en BD**:
```sql
SELECT * FROM bar_boosts 
WHERE status = 'active' 
AND end_at > NOW();
```

---

### 3️⃣ Estado de Boost

**Debes ver**:
```
═══════════════════════════════════════
🟡 BOOST STATE: Total boost IDs: X
🟡 BOOST STATE: IDs: [...]
🟡 BOOST STATE: Loading: false
═══════════════════════════════════════
```
✅ **Loading: false** = Carga completa  
❌ **Loading: true** permanente = Problema en el hook

---

### 4️⃣ Renderizado de Marcadores

**Debes ver (primeros 3 bares)**:
```
🎨 MARKER[Bar1]: type=default, boosted=false, selected=false
🎨 MARKER[Bar2]: type=boosted, boosted=true, selected=false
🎨 MARKER[Bar3]: type=default, boosted=false, selected=false
```
✅ **Si aparece**: Marcadores se renderizan con el tipo correcto  
❌ **Si todos son 'default'**: Boost IDs no se están usando

---

### 5️⃣ Al Tocar un Marcador

**Debes ver**:
```
🔴 MARKER TOUCHED (onSelected): Bar Name
🟢 MARKER TOUCHED (custom onPress): Bar Name
🎯 BarMapMarker TouchableOpacity pressed, type: selected
📍 Marker pressed for bar: Bar Name
```
✅ **Si aparecen los 4 logs**: Todo funciona perfecto  
⚠️ **Si solo aparece 🔴**: Solo funciona onSelected nativo  
⚠️ **Si solo aparece 🟢**: Solo funciona custom onPress  
❌ **Si no aparece nada**: Problema con toques

---

### 6️⃣ Estado de Selección

**Después de tocar, debes ver**:
```
═══════════════════════════════════════
📍 STATE: Selected bar: Bar Name
📍 STATE: Show card: true
📍 STATE: Selected marker ID: abc-123-def
═══════════════════════════════════════
```
✅ **Si aparece**: Estado se actualiza correctamente  
❌ **Si sigue "NONE"**: handleMarkerPress no se ejecuta

---

## 🎨 Qué Ver Visualmente

### Al Abrir el Mapa:
- [ ] Marcadores AZULES BRILLANTES (no oscuros)
- [ ] Algunos marcadores DORADOS PULSANDO
- [ ] Todos los marcadores son CLARAMENTE visibles

### Al Tocar un Marcador:
- [ ] Marcador cambia a NARANJA BRILLANTE
- [ ] Tarjeta del bar aparece desde abajo
- [ ] Animación se detiene si era boosted

### Al Cerrar la Tarjeta:
- [ ] Marcador vuelve a su color original
- [ ] Si era boosted, vuelve a pulsar

---

## 🐛 Problemas Comunes

### Problema: No veo logs de BOOST
```typescript
// Verificar:
1. ¿Hay ubicación del usuario?
   → Buscar logs: "Center location button pressed"
   
2. ¿Hay bares con boost en BD?
   → Query SQL arriba
   
3. ¿El hook está enabled?
   → enabled: !!userLocation debe ser true
```

---

### Problema: Marcadores no responden
```typescript
// Verificar:
1. ¿Aparecen logs al tocar?
   → Si NO: problema con TouchableOpacity o pointerEvents
   
2. ¿El estado se actualiza?
   → Buscar logs "STATE: Selected bar"
   
3. ¿La tarjeta aparece?
   → showBarCard debe ser true
```

---

### Problema: Todos los marcadores son azules
```typescript
// Verificar:
1. selectedBoostBarIds.length debe ser > 0
   → Buscar log "BOOST STATE: Total boost IDs"
   
2. isBoosted = selectedBoostBarIds.includes(bar.id)
   → Debe ser true para algunos bares
   
3. markerType debe ser 'boosted' para algunos
   → Buscar logs "MARKER[...]: type=boosted"
```

---

### Problema: Marcador no cambia a naranja
```typescript
// Verificar:
1. handleMarkerPress se ejecuta
   → Buscar "Marker pressed for bar"
   
2. selectedMarkerId se actualiza
   → Buscar "STATE: Selected marker ID"
   
3. isSelected = true para ese bar
   → bar.id === selectedMarkerId
```

---

## 🔧 Comandos de Verificación

### Verificar Estado del Context
```typescript
// Agregar temporalmente en Map.tsx:
console.log('CONTEXT DEBUG:', {
  boostIds: selectedBoostBarIds,
  count: selectedBoostBarIds.length,
  userLocation: !!userLocation,
});
```

### Verificar Props del Marcador
```typescript
// Agregar temporalmente en Map.tsx (dentro del map):
if (bar.name === 'BarEspecifico') {
  console.log('BAR DEBUG:', {
    id: bar.id,
    isSelected,
    isBoosted,
    markerType,
    animated: isBoosted && !isSelected,
  });
}
```

---

## ✅ Checklist de Funcionamiento Correcto

**Marca cada item que funciona**:

### Carga Inicial
- [ ] Logs de "BARS: Total bars loaded" aparecen
- [ ] Logs de "BOOST: Loaded boost bars" aparecen
- [ ] `BOOST STATE: Total boost IDs: X` (X > 0)
- [ ] Marcadores azules son visibles
- [ ] Marcadores dorados pulsan

### Interacción
- [ ] Al tocar: Log "MARKER TOUCHED" aparece
- [ ] Al tocar: Marcador cambia a naranja
- [ ] Al tocar: Tarjeta del bar aparece
- [ ] Estado "Selected marker ID" se actualiza

### Post-Interacción
- [ ] Al cerrar: Marcador vuelve a color original
- [ ] Si tenía boost: Vuelve a pulsar
- [ ] Estado se resetea correctamente

---

## 🚨 Señales de Alerta

### 🔴 CRÍTICO: Toques no funcionan
**Síntoma**: Nada pasa al tocar marcadores  
**Log esperado**: "MARKER TOUCHED"  
**Si no aparece**: Problema grave con interacción táctil

### 🟡 ADVERTENCIA: Boost no carga
**Síntoma**: Todos los marcadores son azules  
**Log esperado**: "BOOST: Loaded boost bars"  
**Si no aparece**: Problema con hook o BD

### 🟢 INFO: Algunos marcadores no responden
**Síntoma**: Solo algunos responden  
**Log esperado**: Logs parciales  
**Probable causa**: Problema específico de coordenadas o z-index

---

## 📊 Interpretación de Logs

### Log Normal (Todo OK):
```
📊 BARS: Total bars loaded: 15
🟡 BOOST: Loaded boost bars: 3 bars with boost
🟡 BOOST STATE: Total boost IDs: 3
🎨 MARKER[Bar1]: type=default, boosted=false
🎨 MARKER[Bar2]: type=boosted, boosted=true  ← ✅
🎨 MARKER[Bar3]: type=default, boosted=false
```

### Log Problema (Boost no carga):
```
📊 BARS: Total bars loaded: 15
🟡 BOOST: Loaded boost bars: 0 bars with boost  ← ⚠️
🟡 BOOST STATE: Total boost IDs: 0  ← ⚠️
🎨 MARKER[Bar1]: type=default
🎨 MARKER[Bar2]: type=default  ← ❌ Debería ser boosted
```

### Log Problema (Toques no funcionan):
```
(Usuario toca marcador)
... sin logs ...  ← ❌ Debería ver "MARKER TOUCHED"
```

---

## 💡 Tips Rápidos

### Ver Más Información
```typescript
// Agregar en Map.tsx:
console.log('DEBUG FULL STATE:', {
  bars: bars.length,
  boostIds: selectedBoostBarIds,
  selectedId: selectedMarkerId,
  userLoc: !!userLocation,
});
```

### Forzar Re-render
```typescript
// Si sospechas que no se actualiza:
// Agrega un log en el render del marcador
console.log('Rendering marker:', bar.id, markerType);
```

### Verificar Touch Events
```typescript
// En BarMapMarker, agregar:
onPressIn={() => console.log('PRESS IN')}
onPressOut={() => console.log('PRESS OUT')}
```

---

## 🎯 Objetivo Final

**Todos estos logs deben aparecer en orden**:

1. ✅ BARS loaded
2. ✅ BOOST bars loaded  
3. ✅ BOOST STATE actualizado
4. ✅ MARKERs renderizados con tipos correctos
5. ✅ Al tocar: MARKER TOUCHED
6. ✅ STATE actualizado con selección
7. ✅ Al cerrar: STATE reseteado

Si ves TODOS estos logs, **¡todo funciona perfecto!** 🎉

---

## 📞 Resumen Ejecutivo

**3 cosas que DEBES ver**:
1. 🟡 "BOOST: Loaded boost bars: X" (X > 0)
2. 🎨 Algunos "MARKER[...]: type=boosted"
3. 🔴 "MARKER TOUCHED" al tocar cualquier marcador

**Si ves estas 3 cosas, todo está funcionando correctamente.**

---

**¡Usa esta guía cada vez que necesites debuggear los marcadores!** 🔍

