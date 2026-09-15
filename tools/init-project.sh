#!/usr/bin/env bash
# Wrapper Bash (Git Bash / WSL) para init-project.ps1
# El motor real es PowerShell (los hooks son .ps1). Este script solo traduce y delega.
#
# Uso:
#   ./init-project.sh <stack> <ruta> [herramientas]
# Ejemplo:
#   ./init-project.sh laravel "D:/proyectos/mi-app" claude,cursor
#   ./init-project.sh python-langgraph /d/proyectos/bot claude,cursor,codex
#
# Herramientas por defecto: claude
set -euo pipefail

STACK="${1:-}"
RUTA="${2:-}"
TOOLS="${3:-claude}"

if [[ -z "$STACK" || -z "$RUTA" ]]; then
  echo "Uso: $0 <stack> <ruta> [herramientas]"
  echo "Stacks: laravel | next | astro | vue-ts | python-langgraph"
  echo "Herramientas (coma): claude,cursor,windsurf,codex,antigravity"
  exit 1
fi

# Normaliza rutas estilo /d/... a D:\... si cygpath está disponible
if command -v cygpath >/dev/null 2>&1; then
  RUTA="$(cygpath -w "$RUTA")"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if command -v cygpath >/dev/null 2>&1; then
  PS1_PATH="$(cygpath -w "$SCRIPT_DIR/init-project.ps1")"
else
  PS1_PATH="$SCRIPT_DIR/init-project.ps1"
fi

# Convierte "a,b,c" en la lista que espera PowerShell: a,b,c (ya vale como array por coma)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PS1_PATH" \
  -Stack "$STACK" -Path "$RUTA" -Tools $(echo "$TOOLS" | tr ',' ' ')
