#!/bin/bash

# Comandos útiles para trabajar con Claude Code

case "$1" in
  "sync")
    echo "🔄 Sincronizando tipos de Supabase..."
    npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/supabase.ts
    echo "✅ Tipos actualizados"
    ;;

  "feature")
    if [ -z "$2" ]; then
      echo "Uso: ./claude-commands.sh feature <nombre>"
      exit 1
    fi
    echo "🚀 Creando feature: $2"
    git checkout -b "feature/$2"
    mkdir -p "src/features/$2"/{components,hooks,screens}
    echo "✅ Feature branch y estructura creada"
    ;;

  "migration")
    if [ -z "$2" ]; then
      echo "Uso: ./claude-commands.sh migration <descripción>"
      exit 1
    fi
    TIMESTAMP=$(date +%Y%m%d%H%M%S)
    FILENAME="supabase/migrations/${TIMESTAMP}_$2.sql"
    cat > $FILENAME << EOF
-- Migration: $2
-- Created: $(date)

-- Your SQL here

EOF
    echo "✅ Migration creada: $FILENAME"
    code $FILENAME  # Abrir en VS Code
    ;;

  "check")
    echo "🔍 Ejecutando checks..."
    npm run type-check
    npm run lint
    echo "✅ Checks completados"
    ;;

  "clean")
    echo "🧹 Limpiando proyecto..."
    rm -rf node_modules .expo android/app/build ios/build
    npm install
    echo "✅ Proyecto limpio"
    ;;

  *)
    echo "Comandos disponibles:"
    echo "  sync       - Regenerar tipos de Supabase"
    echo "  feature    - Crear nueva feature"
    echo "  migration  - Crear nueva migración SQL"
    echo "  check      - Ejecutar type-check y lint"
    echo "  clean      - Limpiar y reinstalar dependencias"
    ;;
esac
