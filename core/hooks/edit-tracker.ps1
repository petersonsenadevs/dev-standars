#requires -Version 5.1
<#
.SYNOPSIS
  Hook PostToolUse (Edit|Write|MultiEdit): marca que la sesion ha editado CODIGO fuente.
.DESCRIPTION
  Toca el flag por-proyecto "codeedit". stop-guard lo compara con el flag "verified" que escribe
  code-quality/scripts/verify-build.ps1: si hay ediciones posteriores a la ultima verificacion,
  bloquea el cierre pidiendo ejecutar la verificacion (build/lint/types/tests del stack).
#>
$ErrorActionPreference = 'SilentlyContinue'
. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
if (-not $p) { exit 0 }
if ($p.tool_name -notin @('Edit', 'Write', 'MultiEdit')) { exit 0 }
$file = [string]$p.tool_input.file_path
if (-not $file) { exit 0 }
if ($file -notmatch '(?i)\.(php|ts|tsx|js|jsx|mjs|cjs|py|vue|astro|svelte|css|scss|html|blade\.php|json)$') { exit 0 }
if ($file -match '(?i)(devlog|plan|design-system)[\/]|package-lock\.json|\.dev-standards\.json') { exit 0 }
$root = Get-ProjectRoot
$flag = Get-ProjectFlag $root 'codeedit'
New-Item -ItemType File -Path $flag -Force | Out-Null
(Get-Item $flag).LastWriteTime = Get-Date
exit 0
