# MatchMap Database MCP Server

MCP Server personalizado para operaciones de base de datos de MatchMap usando Supabase.

## 🛠️ Herramientas Disponibles

### 1. `get_active_boosts`
Obtiene todos los boosts activos con información completa de los bares.

**Sin parámetros**

**Retorna:**
- Total de boosts activos
- Lista de boosts con información del bar y usuario

---

### 2. `validate_bar_setup`
Valida que un bar tenga toda la información necesaria y calcula el porcentaje de completitud.

**Parámetros:**
- `bar_id` (string, requerido): UUID del bar a validar

**Retorna:**
- Porcentaje de completitud (0-100%)
- Desglose de información básica, imágenes, menú, deportes y características

---

### 3. `get_user_favorites`
Obtiene los bares favoritos de un usuario con información completa.

**Parámetros:**
- `user_id` (string, requerido): UUID del usuario

**Retorna:**
- Total de favoritos
- Lista de bares favoritos con detalles

---

### 4. `get_upcoming_matches`
Obtiene los próximos partidos con eventos en bares.

**Parámetros:**
- `days` (number, opcional, default: 7): Número de días a futuro
- `competition_id` (string, opcional): Filtrar por competición específica

**Retorna:**
- Total de partidos
- Número de partidos con eventos
- Lista de partidos con equipos, competición y eventos en bares

---

### 5. `analyze_bar_performance`
Analiza el rendimiento completo de un bar (reviews, favoritos, boosts).

**Parámetros:**
- `bar_id` (string, requerido): UUID del bar

**Retorna:**
- Información básica del bar
- Estadísticas de reviews (total, promedio, recientes)
- Engagement (favoritos)
- Historial de boosts (total, activos, expirados, boost actual)

---

### 6. `check_rls_policies`
Verifica que las políticas RLS (Row Level Security) estén correctamente configuradas.

**Parámetros:**
- `table_name` (string, requerido): Nombre de la tabla a verificar

**Retorna:**
- Políticas RLS configuradas para la tabla
- Nota si no existe la función `get_rls_policies` en Supabase

---

## 🔧 Variables de Entorno Requeridas

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu-service-key-aqui
```

⚠️ **Importante:** Usa el **service_role key**, no el anon key, para tener acceso completo a la base de datos.

---

## 📦 Instalación

```bash
cd mcp-servers/matchmap-db
npm install
```

---

## 🚀 Uso

El servidor se ejecuta automáticamente cuando Claude Code está configurado para usarlo.

Para probarlo manualmente:

```bash
node index.js
```

---

## 📝 Configuración en Claude Code

Agregar a `.claude/config.json`:

```json
{
  "mcpServers": {
    "matchmap-db": {
      "command": "node",
      "args": ["./mcp-servers/matchmap-db/index.js"],
      "env": {
        "SUPABASE_URL": "https://tu-proyecto.supabase.co",
        "SUPABASE_SERVICE_KEY": "tu-service-key"
      }
    }
  }
}
```

---

## 🔍 Ejemplos de Uso

### Validar setup de un bar
```
Claude, usa matchmap-db para validar el setup del bar con ID "abc-123"
```

### Obtener boosts activos
```
Claude, muéstrame todos los boosts activos usando matchmap-db
```

### Analizar rendimiento de un bar
```
Claude, analiza el rendimiento del bar "xyz-789" con matchmap-db
```

---

## 🛡️ Correcciones Aplicadas

- ✅ Corregido `inputSema` → `inputSchema`
- ✅ Corregido `it supabase` → `await supabase`
- ✅ Corregido `isEor` → `isError`

---

## 📚 Dependencias

- `@modelcontextprotocol/sdk`: SDK oficial de MCP
- `@supabase/supabase-js`: Cliente de Supabase

---

## 🎯 Próximas Mejoras

- [ ] Agregar caché para consultas frecuentes
- [ ] Implementar paginación en resultados grandes
- [ ] Agregar más herramientas de análisis
- [ ] Crear función `get_rls_policies` en Supabase
