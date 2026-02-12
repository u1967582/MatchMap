# Configuración del MCP Server de Supabase

El MCP (Model Context Protocol) Server de Supabase permite a Claude Code tener acceso completo a la base de datos para diagnosticar problemas y entender el esquema.

## 📋 Requisitos

- Claude Desktop o Claude Code CLI
- Credenciales de Supabase (service_role key)

## 🔑 Obtener Credenciales

1. Ve a: https://supabase.com/dashboard/project/hmtfxpihkoisncglllmq/settings/api
2. En "Project API keys", copia:
   - **URL del proyecto**: `https://hmtfxpihkoisncglllmq.supabase.co`
   - **service_role key** (secret): `eyJhbGci...` (NO uses anon key)

3. Connection string (opcional para conexión directa):
   ```
   postgresql://postgres:YOUR_PASSWORD@db.hmtfxpihkoisncglllmq.supabase.co:5432/postgres
   ```

## ⚙️ Configuración del MCP Server

### Opción 1: Usando @modelcontextprotocol/server-postgres (Recomendado)

Crea o edita el archivo de configuración de MCP:

**Para Claude Desktop:**
`~/.claude/claude_desktop_config.json`

**Para Claude Code:**
`~/.claude/mcp_config.json`

```json
{
  "mcpServers": {
    "supabase-postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://postgres:YOUR_PASSWORD@db.hmtfxpihkoisncglllmq.supabase.co:5432/postgres"
      ]
    }
  }
}
```

**Ventajas:**
- ✅ Acceso directo a PostgreSQL con todas las capacidades SQL
- ✅ Puede ejecutar queries complejas, ver esquemas, triggers, etc.
- ✅ No está limitado por RLS policies

**Desventajas:**
- ⚠️ Requiere contraseña de la base de datos

### Opción 2: Usando @modelcontextprotocol/server-supabase

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-supabase",
        "https://hmtfxpihkoisncglllmq.supabase.co",
        "YOUR_SERVICE_ROLE_KEY_HERE"
      ]
    }
  }
}
```

**Ventajas:**
- ✅ Usa la API REST de Supabase
- ✅ Service role key bypasses RLS

**Desventajas:**
- ⚠️ Limitado a operaciones de la API REST (no puede ver triggers/functions directamente)

## 🧪 Verificar Configuración

Después de configurar, reinicia Claude y verifica:

```bash
# En Claude Code, deberías poder hacer queries como:
# "¿Cuántos usuarios hay en public.users?"
# "Muéstrame el esquema de la tabla users"
# "¿Qué triggers existen en auth.users?"
```

## 🔍 Diagnosticar Sin MCP

Si no puedes configurar MCP, usa los scripts:

```bash
# Con service_role key
node scripts/check-all-users.js YOUR_SERVICE_ROLE_KEY

# Verificar estructura
node scripts/check-onboarding.js
```

## 🔒 Seguridad

⚠️ **NUNCA compartas tu service_role key públicamente**
⚠️ **NUNCA la subas a Git**
⚠️ El service_role key tiene acceso completo a la base de datos

## 📝 Configuración Actual del Proyecto

```
URL:     https://hmtfxpihkoisncglllmq.supabase.co
Proyecto: hmtfxpihkoisncglllmq
Región:   EU West (Paris)
```

## 🚀 Próximos Pasos

1. **Configura el MCP** con el método que prefieras
2. **Reinicia Claude Desktop** o Claude Code
3. **Verifica** que puedes consultar la base de datos
4. **Diagnostica** el problema del onboarding con contexto completo

---

## Problema Actual: Onboarding No Funciona

**Síntomas:**
- El tour de onboarding no aparece para usuarios nuevos
- Hay 19 usuarios en public.users (según dashboard)
- El script con anon key no puede verlos (RLS)

**Necesitamos:**
1. Service role key para diagnosticar
2. Verificar valores de onb_u y onb_o en esos 19 usuarios
3. Verificar si existe el trigger de creación automática
4. Entender por qué el onboarding no se activa

**Ejecuta:**
```bash
node scripts/check-all-users.js YOUR_SERVICE_ROLE_KEY
```
