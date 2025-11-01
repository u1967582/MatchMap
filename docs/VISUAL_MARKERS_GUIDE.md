# 🎨 Guía Visual de Marcadores del Mapa

## Vista Previa de Estados

### 🔵 Marcador Predeterminado (Default)
```
     ╭───╮
    │  ●  │  ← Azul brillante (#4A90E2)
     ╰─▼─╯
```
- **Uso**: Bares estándar sin boost
- **Color principal**: Azul profundo (#1E3A5F)
- **Borde**: Azul brillante (#4A90E2)
- **Características**: Estático, sin animación

---

### 🟡 Marcador Boosted
```
     ✨╭───╮✨
    │  ●  │  ← Dorado brillante (#FFD700)
     ╰─▼─╯
    (pulsando)
```
- **Uso**: Bares con boost activo
- **Color principal**: Oscuro (#2C1810)
- **Borde**: Dorado (#FFD700)
- **Características**: 
  - ✨ Efecto de brillo dorado
  - 💫 Animación de pulso (1.0x ↔ 1.15x)
  - ⏱️ Duración: 1 segundo por ciclo
  - 🔄 Loop infinito mientras esté activo

---

### 🟠 Marcador Seleccionado
```
     ╔═══╗
    ║  ●  ║  ← Naranja brillante (#FF8C42)
     ╚═▼═╝
```
- **Uso**: Bar que está viendo el usuario
- **Color principal**: Naranja profundo (#C44D2C)
- **Borde**: Naranja brillante (#FF8C42)
- **Características**:
  - 🎯 Estático (sin animación para estabilidad)
  - ⬆️ Mayor elevación visual (z-index)
  - 🔶 Punto interior naranja claro
  - 💡 Efecto de brillo naranja suave

---

## 🎯 Jerarquía Visual

```
┌─────────────────────────────────────┐
│   PRIORIDAD DE ESTADOS              │
├─────────────────────────────────────┤
│  1. 🟠 Seleccionado (Naranja)       │  ← Mayor prioridad
│  2. 🟡 Boosted (Dorado)             │
│  3. 🔵 Predeterminado (Azul)        │  ← Menor prioridad
└─────────────────────────────────────┘
```

**Regla**: Si un bar cumple múltiples condiciones, se muestra el estado de mayor prioridad.

**Ejemplo**:
- Bar con boost + seleccionado = 🟠 Naranja (seleccionado tiene prioridad)
- Bar con boost + no seleccionado = 🟡 Dorado (con animación)
- Bar sin boost + no seleccionado = 🔵 Azul (estándar)

---

## 📐 Dimensiones

```
        28px
    ╭────────╮
    │        │
28px│   ●    │ Burbuja principal
    │   ↓    │
    ╰────▼───╯ Cola (10px altura)
    
Total: 28px × 38px (aproximado)
```

**Componentes**:
1. **Burbuja**: 28×28px, circular
2. **Punto interior**: 10×10px
3. **Cola**: Triángulo 14px base × 10px altura
4. **Borde**: 3-3.5px de grosor

---

## 🎨 Paleta de Colores Completa

### Azul (Default)
```css
Fondo:     #1E3A5F  ███ Deep Blue
Borde:     #4A90E2  ███ Bright Blue
Interior:  #4A90E2  ███ Bright Blue
Sombra:    #000000  ███ Negro (opacidad 0.4)
```

### Dorado (Boosted)
```css
Fondo:     #2C1810  ███ Dark Brown
Borde:     #FFD700  ███ Gold
Interior:  #FFF4C4  ███ Light Gold
Brillo:    #FFD700  ███ Gold (opacidad 0.8)
Sombra:    #FFD700  ███ Gold (opacidad 0.7)
```

### Naranja (Selected)
```css
Fondo:     #C44D2C  ███ Deep Orange
Borde:     #FF8C42  ███ Bright Orange
Interior:  #FFE5D9  ███ Light Orange
Brillo:    #FF6B35  ███ Medium Orange (opacidad 0.6)
Sombra:    #FF6B35  ███ Medium Orange (opacidad 0.6)
```

---

## 🎭 Efectos Visuales

### Sombra (Shadow)
```
Default:   Offset: (0, 3), Opacity: 0.4, Radius: 4
Boosted:   Offset: (0, 3), Opacity: 0.7, Radius: 6
Selected:  Offset: (0, 3), Opacity: 0.6, Radius: 5
```

### Brillo (Glow)
Solo en marcadores **Boosted** y **Selected**:
```
Tamaño:    40×40px (más grande que el marcador)
Posición:  Detrás del marcador (z-index menor)
Efecto:    Halo de color difuminado
```

### Animación de Pulso (Boosted)
```
Inicio:    Scale 1.0 (100%)
    ↓
Máximo:    Scale 1.15 (115%)
    ↓
Fin:       Scale 1.0 (100%)

Duración:  2 segundos total (1s expandir + 1s contraer)
Easing:    Linear
Loop:      Infinito
```

---

## 📱 Comportamiento en el Mapa

### Interacciones

1. **Al Cargar el Mapa**
   ```
   Todos los bares → 🔵 Azul (default)
   Bares con boost → 🟡 Dorado (pulsando)
   ```

2. **Al Hacer Clic en un Marcador**
   ```
   Marcador clicado → 🟠 Naranja (seleccionado)
   Marcadores anteriores → Vuelven a su estado original
   ```

3. **Al Cerrar la Tarjeta del Bar**
   ```
   Marcador seleccionado → Vuelve a su estado original
   (🟡 Dorado si tiene boost, 🔵 Azul si no)
   ```

---

## 🔍 Casos de Uso

### Caso 1: Usuario Explorando
```
Mapa con 10 bares:
- 7 bares → 🔵 Azul
- 3 bares con boost → 🟡 Dorado (pulsando)
- 0 seleccionados → -
```

### Caso 2: Usuario Selecciona un Bar Normal
```
Bar clicado:
🔵 Azul → 🟠 Naranja
        (detiene cualquier animación si tenía)
```

### Caso 3: Usuario Selecciona un Bar Boosted
```
Bar boosted clicado:
🟡 Dorado (pulsando) → 🟠 Naranja (sin pulso)
                      (animación se detiene)
```

### Caso 4: Usuario Cierra Tarjeta de Bar Boosted
```
Bar deseleccionado:
🟠 Naranja → 🟡 Dorado (pulsando)
           (animación se reinicia)
```

---

## 🎬 Animaciones Detalladas

### Animación de Pulso (Solo Boosted)

```typescript
// Configuración
Duración total: 2000ms (2 segundos)
Fases:
  1. Expandir: 0ms → 1000ms (scale 1.0 → 1.15)
  2. Contraer: 1000ms → 2000ms (scale 1.15 → 1.0)
Loop: Infinito

// Cuándo se activa
✅ Bar tiene boost activo
✅ Bar NO está seleccionado
❌ No se activa si el bar está seleccionado
```

### Transiciones Suaves

```
Estado A → Estado B
    ↓
Transición nativa (imperceptible)
    ↓
No hay "salto" visual
```

---

## 🔧 Personalización Futura

### Ideas para Expandir

1. **Marcadores por Categoría**
```
🍺 Pub      → Verde
🍕 Restaurante → Rojo
🎵 Club     → Morado
```

2. **Indicadores de Rating**
```
⭐⭐⭐⭐⭐ (5.0) → Marcador más grande
⭐⭐⭐ (3.0)     → Marcador estándar
```

3. **Estados Adicionales**
```
❤️ Favorito → Marcador con corazón
📍 Cercano  → Marcador con círculo de rango
🔔 Notificación → Marcador con badge
```

---

## 📊 Comparación de Estados

| Estado | Color | Animación | Brillo | Uso Típico |
|--------|-------|-----------|--------|------------|
| Default | 🔵 Azul | ❌ No | ❌ No | Bares estándar |
| Boosted | 🟡 Dorado | ✅ Sí (pulso) | ✅ Sí | Bares promocionados |
| Selected | 🟠 Naranja | ❌ No | ✅ Sí | Bar siendo visualizado |

---

## 🎓 Tips de Diseño

### ✅ Buenas Prácticas
- Usar colores con alto contraste contra el fondo oscuro
- Animaciones sutiles (max 15% de cambio de escala)
- Prioridad clara entre estados
- Feedback visual inmediato al usuario

### ❌ Evitar
- Animaciones muy rápidas (< 0.5s)
- Animaciones en el marcador seleccionado (distrae)
- Colores similares entre estados
- Demasiados estados simultáneos

---

## 🎯 Resumen Visual Rápido

```
                Mapa de MatchMap
   ┌─────────────────────────────────────┐
   │                                     │
   │    🔵   🔵   🟡*  🔵   🟡*         │
   │                                     │
   │  🔵   🟠    🔵   🟡*   🔵          │
   │      (tú)                           │
   │    🔵   🔵   🔵   🟡*   🔵         │
   │                                     │
   └─────────────────────────────────────┘
   
   🔵 = Bares normales
   🟡* = Bares con boost (pulsando)
   🟠 = Bar que estás viendo
```

---

**¡Disfruta explorando el mapa con los nuevos marcadores!** 🗺️✨

