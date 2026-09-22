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
$hasBrief = (Test-Path (Join-Path $root 'plan\brief.md')) -or ((Test-Path (Join-Path $root 'design-system')) -and (Get-ChildItem (Join-Path $root 'design-system') -Recurse -Filter 'BRAND.md' -ErrorAction SilentlyContinue))
# MURO (una vez por sesion): primera edicion de UI sin design system NI brief -> bloquear y obligar a decidir.
if (-not $master -and -not $hasBrief -and (Test-Once $sid 'front-block')) {
    Remove-Item (Get-SessionFlag $sid 'front') -Force -ErrorAction SilentlyContinue   # el reintento recibira el aviso contextual
    [Console]::Error.WriteLine('[BLOQUEADO por dev-standards] Primera edicion de UI sin design-system/*/MASTER.md NI plan/brief.md.')
    [Console]::Error.WriteLine('Antes de tocar UI: (1) pregunta al usuario (entrevista /brief: marca, referencias, objetivo) y genera el design system, O (2) si es un arreglo trivial en algo ya construido, dilo explicitamente y reintenta la edicion: este muro solo salta UNA vez por sesion.')
    exit 2
}
$dsMsg = if ($master) { "Lee primero el design system del proyecto: $master." }
         elseif (-not $hasBrief) { "No hay design system NI brief: ANTES de maquetar PREGUNTA al usuario (entrevista de ui-ux-pro-max references/es/brief-discovery.md o comando /brief): si tiene logo/colores/manual de marca, 2-3 webs que le gusten y que debe hacer el visitante. Con eso genera y persiste el design system (search.py --design-system --persist). Si el usuario no responde, decide por el playbook de su negocio (business-playbooks.md) y documentalo como decision propia." }
         else { "Hay brief pero no design-system/*/MASTER.md: generalo antes de maquetar: py -3 $skillsDir/ui-ux-pro-max/scripts/search.py `"<producto industria keywords>`" --design-system -p `"<Proyecto>`" --persist -o .  (python3 fuera de Windows). Si hay plan, es la primera tarjeta de UI." }
$ctx = "Vas a editar UI ($([System.IO.Path]::GetFileName($file))). Aplica la skill ui-ux-pro-max (lee su SKILL.md si no lo has hecho en esta sesion; si esta instalada la skill front-activation, empieza por ella para detectar el stack). $dsMsg Reglas duras: contraste 4.5:1, estados hover/focus/disabled/loading/empty/error, 375/768/1440 px sin scroll horizontal, prefers-reduced-motion, iconos SVG (nunca emojis), tokens en vez de valores sueltos."
Out-HookJson 'PreToolUse' @{ additionalContext = $ctx }
exit 0
