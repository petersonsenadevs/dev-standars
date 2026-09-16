#requires -Version 5.1
<#
.SYNOPSIS
  Hook PreToolUse (Edit|Write|MultiEdit) para Claude Code en stacks de front.
  La PRIMERA vez por sesión que el agente va a crear/editar un archivo de UI, inyecta contexto
  recordando la skill ui-ux-pro-max y el design system del proyecto. No bloquea nada.
.DESCRIPTION
  Entrada: JSON por STDIN { session_id, tool_name, tool_input: { file_path } }.
  Salida: JSON con hookSpecificOutput.additionalContext (solo la primera vez por sesión).
  Marcador de sesión: %TEMP%\dev-standards-front-<session_id>.flag
#>
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
if (-not $p) { exit 0 }
if ($p.tool_name -notin @('Edit', 'Write', 'MultiEdit')) { exit 0 }
$file = [string]$p.tool_input.file_path
if (-not $file) { exit 0 }
if ($file -notmatch '(?i)\.(vue|tsx|jsx|astro|blade\.php|html|css|scss|svelte)$') { exit 0 }
$sid = if ($p.session_id) { [string]$p.session_id } else { 'default' }
# Marcador persistente "esta sesion ha editado UI": lo lee stop-guard para exigir la verificacion movil (ui-verify).
$editFlag = Get-SessionFlag $sid 'frontedit'
if (-not (Test-Path $editFlag)) { New-Item -ItemType File -Path $editFlag -Force | Out-Null }
if (-not (Test-Once $sid 'front')) { exit 0 }
$root = Get-ProjectRoot
$skillsDir = if ($env:CLAUDE_PLUGIN_ROOT -and (Test-Path (Join-Path $env:CLAUDE_PLUGIN_ROOT 'skills\ui-ux-pro-max'))) { '$env:CLAUDE_PLUGIN_ROOT/skills' } elseif (Test-Path (Join-Path $root '.claude\skills\ui-ux-pro-max')) { '.claude/skills' } else { '<skills-dir>' }
$master = Get-DesignSystemMaster $root
$dsMsg = if ($master) { "Lee primero el design system del proyecto: $master." }
         else { "No hay design-system/*/MASTER.md: generalo antes de maquetar: py -3 $skillsDir/ui-ux-pro-max/scripts/search.py `"<producto industria keywords>`" --design-system -p `"<Proyecto>`" --persist -o .  (python3 fuera de Windows). Si hay plan, es la primera tarjeta de UI." }
$ctx = "Vas a editar UI ($([System.IO.Path]::GetFileName($file))). Aplica la skill ui-ux-pro-max (lee su SKILL.md si no lo has hecho en esta sesion; si esta instalada la skill front-activation, empieza por ella para detectar el stack). $dsMsg Reglas duras: contraste 4.5:1, estados hover/focus/disabled/loading/empty/error, 375/768/1440 px sin scroll horizontal, prefers-reduced-motion, iconos SVG (nunca emojis), tokens en vez de valores sueltos."
Out-HookJson 'PreToolUse' @{ additionalContext = $ctx }
exit 0
