#!/bin/bash

echo "🚀 Instalando MCP Servers para MatchMap..."

# 1. Supabase (Base de datos)
npm install -g @modelcontextprotocol/server-postgres

# 2. Sistema de archivos
npm install -g @modelcontextprotocol/server-filesystem

# 3. Git
npm install -g @modelcontextprotocol/server-git

# 4. GitHub (para PRs, Issues)
npm install -g @modelcontextprotocol/server-github

# 5. Brave Search (para búsquedas de documentación)
npm install -g @modelcontextprotocol/server-brave-search

# 6. Memory (para persistir contexto)
npm install -g @modelcontextprotocol/server-memory

echo "✅ MCP Servers instalados"
