#requires -Version 5.1
<#
.SYNOPSIS
  Hook PreToolUse para Claude Code. Bloquea acciones prohibidas:
  git push, borrados/alteraciones destructivas de BD, resets destructivos, rm -rf peligrosos.

.DESCRIPTION
  Claude Code invoca este script pasando por STDIN un JSON con { tool_name, tool_input }.
  Si el comando coincide con un patrón prohibido, el hook lo DENIEGA:
    - Escribe el motivo en STDERR
    - Sale con código 2  (=> Claude Code bloquea la ejecución y muestra el motivo)
  Si no coincide, sale con 0 (permite continuar el flujo de permisos normal).

  Se usa como capa "inteligente" además de permissions.deny (capa simple) en settings.json.
#>

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# --- Leer payload de STDIN ---
$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

try { $payload = $raw | ConvertFrom-Json } catch { exit 0 }

$tool = $payload.tool_name
# Solo nos interesan ejecuciones de shell
if ($tool -notin @('Bash', 'PowerShell')) { exit 0 }

$cmd = ''
if ($payload.tool_input) {
    if ($payload.tool_input.command) { $cmd = [string]$payload.tool_input.command }
}
if ([string]::IsNullOrWhiteSpace($cmd)) { exit 0 }

# Normalizar para regex (una sola línea, minúsculas para comparación case-insensitive vía (?i))
$c = $cmd

# --- Patrones prohibidos: { patrón; motivo } ---
$rules = @(
    @{ p = '(?i)\bgit\s+push\b';                                  m = 'git push está prohibido sin aprobación explícita.' },
    @{ p = '(?i)\bgit\s+push\s+.*--force';                        m = 'git push --force está terminantemente prohibido.' },
    @{ p = '(?i)--force-with-lease';                              m = 'push forzado (--force-with-lease) prohibido.' },
    @{ p = '(?i)\bdrop\s+(database|table|schema)\b';             m = 'DROP DATABASE/TABLE/SCHEMA en BD requiere aprobación explícita.' },
    @{ p = '(?i)\btruncate\s+table\b|\btruncate\s+\w';          m = 'TRUNCATE en BD requiere aprobación explícita.' },
    @{ p = '(?i)\bdelete\s+from\s+\w+\s*(;|$)';                  m = 'DELETE sin WHERE requiere aprobación explícita.' },
    @{ p = '(?i)\bupdate\s+\w+\s+set\b(?!.*\bwhere\b)';         m = 'UPDATE sin WHERE requiere aprobación explícita.' },
    @{ p = '(?i)migrate:(fresh|refresh)';                        m = 'migrate:fresh/refresh es destructivo: requiere aprobación.' },
    @{ p = '(?i)\bdb:wipe\b';                                    m = 'db:wipe es destructivo: requiere aprobación.' },
    @{ p = '(?i)prisma\s+migrate\s+reset';                       m = 'prisma migrate reset es destructivo: requiere aprobación.' },
    @{ p = '(?i)drop_all\b|metadata\.drop_all';                  m = 'drop_all (SQLAlchemy) es destructivo: requiere aprobación.' },
    @{ p = '(?i)\bgit\s+reset\s+--hard\b';                       m = 'git reset --hard descarta trabajo: requiere aprobación.' },
    @{ p = '(?i)\bgit\s+clean\s+-\w*f';                          m = 'git clean -f elimina archivos no versionados: requiere aprobación.' },
    @{ p = '(?i)rm\s+-\w*r\w*f|rm\s+-\w*f\w*r';                  m = 'rm -rf requiere revisión: puede borrar de más.' },
    @{ p = '(?i)remove-item\s+.*-recurse.*-force|remove-item\s+.*-force.*-recurse'; m = 'Remove-Item -Recurse -Force requiere revisión.' },
    @{ p = '(?i)\bnpm\s+publish\b|\bcomposer\s+.*publish\b';     m = 'Publicar paquetes requiere aprobación explícita.' }
)

# --- Reglas de git commit: rama protegida, Conventional Commits, sin co-autores ---
if ($c -match '(?i)\bgit\s+commit\b') {
    $branch = ''
    try { $branch = (git rev-parse --abbrev-ref HEAD 2>$null | Out-String).Trim() } catch {}
    if ($branch -in @('main', 'master', 'develop')) {
        [Console]::Error.WriteLine("[BLOQUEADO por dev-standards] No se commitea en '$branch'. Crea una rama (git switch -c feat/...) y commitea ahi.")
        exit 2
    }
    if ($c -match '(?i)co-authored-by') {
        [Console]::Error.WriteLine('[BLOQUEADO por dev-standards] Los commits no llevan Co-Authored-By (regla del equipo).')
        exit 2
    }
    # Mensaje: -m "..." o -m '...'  (se valida solo el primer -m)
    $msg = $null
    if ($c -match '(?is)-m\s+"([^"]*)"') { $msg = $Matches[1] } elseif ($c -match "(?is)-m\s+'([^']*)'") { $msg = $Matches[1] }
    if ($msg) {
        $first = ($msg -split "`r?`n")[0].Trim()
        if ($first -notmatch '^(feat|fix|refactor|docs|test|chore|perf|build|ci|style|revert)(\([\w\-\./ ]+\))?!?:\s\S') {
            [Console]::Error.WriteLine("[BLOQUEADO por dev-standards] El mensaje no sigue Conventional Commits: '$first'. Formato: tipo(scope): descripcion  (feat|fix|refactor|docs|test|chore|perf|build|ci|style|revert).")
            exit 2
        }
        if ($first.Length -gt 72) {
            [Console]::Error.WriteLine("[BLOQUEADO por dev-standards] Primera linea del commit > 72 caracteres ($($first.Length)). Acortala y pasa el detalle al cuerpo.")
            exit 2
        }
    }
}

foreach ($r in $rules) {
    if ($c -match $r.p) {
        [Console]::Error.WriteLine("[BLOQUEADO por dev-standards] $($r.m)")
        [Console]::Error.WriteLine("Comando: $cmd")
        [Console]::Error.WriteLine("Si de verdad quieres hacerlo, pídeme aprobación explícita y ejecútalo tú, o autorízalo para esta vez.")
        exit 2
    }
}

exit 0
