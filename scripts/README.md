# Scripts de MatchMap

Colección de scripts útiles para desarrollo y mantenimiento de MatchMap.

## Scripts Disponibles

### claude-commands.sh
Comandos rápidos para tareas comunes de desarrollo.

**Uso:**
```bash
./scripts/claude-commands.sh <comando> [argumentos]
```

**Comandos:**

#### `sync`
Regenera los tipos TypeScript desde el schema de Supabase.

```bash
./scripts/claude-commands.sh sync
```

**Requiere:** Variable de entorno `SUPABASE_PROJECT_ID`

**Genera:** `src/types/supabase.ts`

---

#### `feature <nombre>`
Crea una nueva feature branch y estructura de carpetas.

```bash
./scripts/claude-commands.sh feature user-notifications
```

**Crea:**
- Branch: `feature/user-notifications`
- Carpetas: `src/features/user-notifications/{components,hooks,screens}`

---

#### `migration <descripción>`
Crea una nueva migración SQL con timestamp.

```bash
./scripts/claude-commands.sh migration "add_notifications_table"
```

**Crea:** `supabase/migrations/YYYYMMDDHHMMSS_add_notifications_table.sql`

**Abre automáticamente** el archivo en VS Code.

---

#### `check`
Ejecuta type-check y lint en el proyecto.

```bash
./scripts/claude-commands.sh check
```

**Ejecuta:**
- `npm run type-check` - Verifica tipos TypeScript
- `npm run lint` - Verifica reglas de ESLint

---

#### `clean`
Limpia y reinstala todas las dependencias del proyecto.

```bash
./scripts/claude-commands.sh clean
```

**Elimina:**
- `node_modules/`
- `.expo/`
- `android/app/build/`
- `ios/build/`

**Reinstala:** Ejecuta `npm install`

---

### install-mcp-servers.sh
Instala MCP Servers necesarios para Claude Code.

**Uso:**
```bash
./scripts/install-mcp-servers.sh
```

**Instala:**
- `@modelcontextprotocol/server-postgres` - Supabase
- `@modelcontextprotocol/server-filesystem` - Archivos
- `@modelcontextprotocol/server-github` - GitHub
- `@modelcontextprotocol/server-brave-search` - Búsquedas

---

## Variables de Entorno Requeridas

Algunos scripts requieren variables de entorno. Configúralas en `.env`:

```bash
# Supabase
SUPABASE_PROJECT_ID=tu-project-id
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_KEY=tu-service-key

# API Keys
GOOGLE_MAPS_API_KEY_IOS=tu-key
GOOGLE_MAPS_API_KEY_ANDROID=tu-key
REVENUECAT_API_KEY_IOS=tu-key
REVENUECAT_API_KEY_ANDROID=tu-key
```

---

## Crear Nuevos Scripts

Al crear un nuevo script:

1. **Añadir shebang:** `#!/bin/bash`
2. **Dar permisos:** `chmod +x scripts/tu-script.sh`
3. **Documentar aquí:** Agregar sección en este README
4. **Seguir convenciones:**
   - Usar emojis para feedback visual (✅ ❌ 🔄)
   - Validar argumentos requeridos
   - Proveer mensajes de error claros
   - Incluir comando de ayuda

**Ejemplo:**
```bash
#!/bin/bash

if [ -z "$1" ]; then
  echo "❌ Error: Falta argumento"
  echo "Uso: ./script.sh <argumento>"
  exit 1
fi

echo "🔄 Ejecutando..."
# Tu código aquí
echo "✅ Completado"
```

---

## Troubleshooting

### Permiso denegado
```bash
chmod +x scripts/nombre-script.sh
```

### Script no encuentra comando
Asegúrate de ejecutar desde la raíz del proyecto:
```bash
cd /path/to/MatchMap
./scripts/claude-commands.sh <comando>
```

### Variables de entorno no definidas
```bash
# Cargar .env
export $(cat .env | xargs)

# O usar directamente
SUPABASE_PROJECT_ID=xxx ./scripts/claude-commands.sh sync
```
