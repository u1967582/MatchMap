# Claude Code Setup para MatchMap

## Quick Start
```bash
# 1. Ejecutar setup
./scripts/claude-setup.sh

# 2. Configurar credenciales
# Editar: ~/Library/Application Support/Claude/claude_desktop_config.json
# Agregar SUPABASE_URL, SUPABASE_SERVICE_KEY, GITHUB_TOKEN

# 3. Reiniciar Claude Desktop

# 4. Verificar
claude "Test MCP servers"
```

## Estructura
```
.claude/
├── README.md                   # Este archivo
├── custom-instructions.md      # Instrucciones personalizadas
├── context/                    # Contexto del proyecto
│   ├── architecture.md         # Arquitectura de la aplicación
│   ├── conventions.md          # Convenciones de código
│   └── troubleshooting.md      # Solución de problemas comunes
├── agents/                     # Sistema de agentes especializados
│   ├── coordinator-agent.md    # Coordinador principal
│   ├── database-agent.md       # Especialista en Supabase
│   ├── ui-agent.md            # Especialista en React Native
│   ├── testing-agent.md       # Especialista en QA
│   └── deployment-agent.md    # Especialista en Deploy
└── templates/                  # Templates de código (futuro)
    ├── component.template.tsx
    ├── hook.template.ts
    └── migration.template.sql
```

## Sistema de Agentes

### Cómo Funcionan

Los agentes son especialistas que trabajan en conjunto para tareas complejas:

**Coordinador** (`@coordinator`):
- Analiza la solicitud
- Decide qué agentes involucrar
- Coordina el flujo de trabajo
- Integra resultados

**Database Agent** (`@database`):
- Diseño de schema
- Migraciones SQL
- RLS policies
- Optimización de queries

**UI Agent** (`@ui`):
- Componentes React Native
- Screens con navegación
- Optimización de performance
- Hooks personalizados

**Testing Agent** (`@testing`):
- Tests unitarios
- Tests de integración
- Tests de RLS policies
- Coverage y calidad

**Deployment Agent** (`@deployment`):
- EAS Builds
- App Store + Google Play
- CI/CD
- Version management

### Uso de Agentes

```bash
# Invocar agente específico (futuro)
claude "@database Crear tabla de notificaciones"
claude "@ui Crear pantalla de perfil"
claude "@testing Generar tests para BarCard"

# Coordinador decide automáticamente
claude "Implementar sistema de mensajería entre usuarios"
# → Coordinator analiza y delega a: Database → UI → Testing
```

## Custom Instructions

Las instrucciones personalizadas en `custom-instructions.md` definen:

### Principios de Trabajo
1. **Calidad sobre Velocidad** - TypeScript strict, validaciones, edge cases
2. **Security First** - RLS policies, sin service keys en frontend
3. **Performance Matters** - FlatList, memoization, optimizaciones
4. **UX Excellence** - Loading states, error handling, feedback
5. **Testability** - Código testeable, separación de concerns

### Flujos de Trabajo
- **Nuevas Features**: BD → Backend → Frontend → Tests
- **Bug Fixes**: Reproducir → Root cause → Fix → Test regresión
- **Refactors**: Entender → Proponer → Implementar → Verificar

### Contexto MatchMap
- Stack: React Native + Expo + Supabase + RevenueCat
- Usuarios: Customers + Bar Owners
- Features: Mapa, Boosts, Reviews, Favoritos, Eventos

## Convenciones de Código

El archivo `context/conventions.md` establece:

### Naming
- **PascalCase**: Components, Screens, Types
- **camelCase**: Variables, functions, hooks
- **kebab-case**: Folders, assets
- **SCREAMING_SNAKE_CASE**: Constants

### TypeScript
- Strict mode activado
- Prefer `interface` para objects (extensibles)
- Prefer `type` para unions, primitives

### File Structure
```typescript
// 1. Imports (orden específico)
// 2. Types/Interfaces
// 3. Component/Hook
// 4. Styles
// 5. Display name
```

### Error Handling
```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  if (error instanceof NetworkError) {
    showToast('No internet connection');
  } else {
    console.error('Unexpected error:', error);
    Sentry.captureException(error);
  }
  throw error;
}
```

### Performance
- Usar `FlatList` para listas largas
- Memoizar callbacks con `useCallback`
- Memoizar computaciones con `useMemo`
- Memoizar componentes con `memo`

### Accessibility
- Siempre incluir `accessibilityLabel`
- Usar `accessibilityRole` apropiado
- Agregar `accessibilityHint` cuando ayude

## MCP Servers

### Configurados

Los siguientes MCP servers están disponibles (ver `mcp-servers/`):

1. **supabase** (via skill)
   - Queries tipados
   - RLS policies
   - Auth & Storage

2. **expo** (via skill)
   - Config de app
   - EAS Build
   - Deep linking

3. **revenuecat** (via skill)
   - Productos IAP
   - Suscripciones
   - Entitlements

### Configuración

Ver `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": ["/path/to/mcp-servers/supabase/index.js"],
      "env": {
        "SUPABASE_URL": "https://xxx.supabase.co",
        "SUPABASE_SERVICE_KEY": "xxx"
      }
    }
  }
}
```

## Skills Disponibles

Los skills son herramientas especializadas accesibles via comandos:

### Active Skills
- **expo**: Config, builds, OTA updates, deployment
- **supabase**: Queries, RLS, migrations, auth, storage
- **revenuecat**: IAP, subscriptions, entitlements

### Cómo Usar Skills
```bash
# Skills se activan automáticamente según contexto
# Ejemplo: al trabajar con base de datos, Supabase skill se activa

# También se pueden invocar explícitamente:
claude "/supabase Create migration for notifications table"
```

## Scripts de Utilidad

### claude-setup.sh
```bash
# Setup inicial de MCP servers
./scripts/claude-setup.sh
```

### install-mcp-servers.sh
```bash
# Instalar dependencias de MCP servers
./scripts/install-mcp-servers.sh
```

### Comandos Futuros (Roadmap)
```bash
# Sincronizar tipos de Supabase
./scripts/claude-commands.sh sync

# Scaffold nueva feature
./scripts/claude-commands.sh feature messaging

# Crear nueva migración
./scripts/claude-commands.sh migration add_notifications

# Verificar código
./scripts/claude-commands.sh check
```

## Flujo de Trabajo Típico

### 1. Nueva Feature
```bash
# Usuario pide feature
"Quiero agregar sistema de notificaciones push"

# Coordinator analiza
→ Complejidad: Alta
→ Agentes: Database, UI, Testing, Deployment

# Database Agent
→ Crea tabla notifications
→ RLS policies
→ Triggers para envío

# UI Agent
→ Componente NotificationCard
→ Screen de configuración
→ Hook useNotifications

# Testing Agent
→ Tests de RLS
→ Tests de componentes
→ Tests de hooks

# Deployment Agent
→ Verifica permisos iOS/Android
→ Configura push certificates
```

### 2. Bug Fix
```bash
# Usuario reporta bug
"Los boosts no aparecen en el mapa"

# Coordinator analiza
→ Complejidad: Media
→ Agente principal: Database

# Database Agent investiga
→ Verifica RLS policies
→ Revisa query de boosts activos
→ Identifica problema en filtro de fechas

# UI Agent (si necesario)
→ Ajusta filtros en frontend

# Testing Agent
→ Crea test para prevenir regresión
```

### 3. Deploy a Production
```bash
# Usuario solicita
"Subir versión 1.0.7 a TestFlight"

# Deployment Agent ejecuta
→ Pre-deploy checklist
→ Increment version/buildNumber
→ EAS build --platform ios
→ EAS submit --latest
→ Post-deploy verification
```

## Troubleshooting

### Claude no responde con MCP
1. Verificar `claude_desktop_config.json` tiene servidores configurados
2. Reiniciar Claude Desktop completamente
3. Verificar logs: `tail -f ~/Library/Logs/Claude/mcp*.log`
4. Verificar que MCP server inicia: `node mcp-servers/xxx/index.js`

### Skills no aparecen
1. Verificar que archivos están en carpeta correcta
2. Skills deben tener formato markdown con metadata
3. Reiniciar Claude Desktop

### Tipos de Supabase desactualizados
```bash
# Regenerar tipos desde Supabase
npx supabase gen types typescript --project-id <project-id> > types/supabase.ts
```

### Agentes no se coordinan bien
- Los agentes son documentación, no código ejecutable
- Claude Code los usa como "memoria" y "contexto"
- Si Claude no sigue el patrón, refuerza con prompts explícitos

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────┐
│         Usuario / Developer                  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│          Claude Code CLI                     │
│  • Lee custom-instructions.md                │
│  • Carga context/* según necesidad           │
│  • Consulta agents/* para decisiones         │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│       Coordinator Agent (conceptual)         │
│  • Analiza tarea                             │
│  • Decide agentes necesarios                 │
│  • Coordina ejecución                        │
└────┬─────┬──────┬──────┬────────────────────┘
     │     │      │      │
     ▼     ▼      ▼      ▼
┌────────────────────────────────────────────┐
│  Database  UI  Testing  Deployment Agents  │
│  (Especialistas siguiendo sus docs)        │
└────┬─────┬──────┬──────┬───────────────────┘
     │     │      │      │
     └─────┴──────┴──────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│        MCP Servers + Skills                  │
│  • Supabase DB access                        │
│  • File operations                           │
│  • Git operations                            │
│  • GitHub API                                │
└─────────────────────────────────────────────┘
```

## Mantenimiento

### Actualizar Documentación
Cuando cambies arquitectura o convenciones:

```bash
# Editar archivos relevantes
vim .claude/context/architecture.md
vim .claude/context/conventions.md

# Actualizar memoria de Claude
vim ~/.claude/projects/MatchMap/memory/MEMORY.md
```

### Agregar Nuevo Agente
```bash
# Crear archivo del agente
vim .claude/agents/new-agent.md

# Actualizar README.md con descripción
# Actualizar coordinator-agent.md para incluirlo
```

### Agregar Nuevo Skill
```bash
# Crear archivo del skill
vim .claude/skills/new-skill.md

# Formato requerido:
# - Metadata al inicio (---yaml---)
# - Descripción clara
# - Comandos disponibles
# - Ejemplos de uso
```

## Recursos Adicionales

- **Documentación Original**: `docs/` (organizada por categoría)
- **Scripts**: `scripts/` (setup, helpers)
- **MCP Servers**: `mcp-servers/` (servidores personalizados)
- **Types**: `types/supabase.ts` (tipos generados de Supabase)

## Contribuir

Si mejoras el sistema de Claude Code:

1. Actualiza la documentación relevante
2. Testea que funciona correctamente
3. Actualiza este README si es necesario
4. Comparte el approach en el equipo

---

**Versión**: 1.0.0  
**Última actualización**: 2026-02-10  
**Mantenedor**: Roger Gost

¿Preguntas? Revisa `context/troubleshooting.md` o consulta con Claude Code directamente.
