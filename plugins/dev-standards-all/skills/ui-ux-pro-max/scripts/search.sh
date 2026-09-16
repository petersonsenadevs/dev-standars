#!/usr/bin/env bash
# Wrapper bash de search.py (UI UX Pro Max) para Codex/WSL/macOS/Linux/Git Bash.
#   <skills-dir>/ui-ux-pro-max/scripts/search.sh "fintech dashboard" --design-system -p "Mi App" --persist -o .
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for py in python3 python py; do
  if command -v "$py" >/dev/null 2>&1; then
    if [ "$py" = "py" ]; then exec py -3 "$here/search.py" "$@"; fi
    exec "$py" "$here/search.py" "$@"
  fi
done
echo "No se encontró Python (python3/python/py). Instálalo o consulta los CSV de data/ directamente." >&2
exit 1
