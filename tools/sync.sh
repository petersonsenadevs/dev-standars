#!/usr/bin/env bash
# Wrapper Bash (Git Bash / WSL) para sync.ps1
# Re-renderiza la config a un proyecto ya inicializado (lee su .dev-standards.json).
#
# Uso:
#   ./sync.sh [ruta]          # por defecto: directorio actual
# Ejemplo:
#   ./sync.sh "D:/proyectos/mi-app"
set -euo pipefail

RUTA="${1:-$(pwd)}"

if command -v cygpath >/dev/null 2>&1; then
  RUTA="$(cygpath -w "$RUTA")"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if command -v cygpath >/dev/null 2>&1; then
  PS1_PATH="$(cygpath -w "$SCRIPT_DIR/sync.ps1")"
else
  PS1_PATH="$SCRIPT_DIR/sync.ps1"
fi

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PS1_PATH" -Path "$RUTA"
