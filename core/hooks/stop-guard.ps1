#requires -Version 5.1
<#
.SYNOPSIS
  Hook Stop: antes de que el agente termine, comprueba el cierre de la tarea.
.DESCRIPTION
  Si hay cambios de codigo sin commitear (git) y NO hay entrada de devlog de hoy, BLOQUEA la parada UNA vez por
  sesion pidiendo crear/actualizar el devlog (decision=block + reason). Si ya se bloqueo antes (stop_hook_active
  o marcador de sesion), deja parar y solo recuerda. Sin git o sin cambios: solo recordatorio si falta devlog.
  Sustituye a devlog-reminder.ps1.
#>
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
$root = Get-ProjectRoot
$sid = if ($p -and $p.session_id) { [string]$p.session_id } else { 'default' }
$plan = Get-PlanStatus $root
$planMsg = ''
if ($plan.exists -and $plan.doing.Count) { $planMsg = " Ademas hay tarea(s) en curso en plan/PLAN.md ($($plan.doing -join '; ')): si la has terminado, marcala done con el enlace al devlog y propon la siguiente." }
$today = Get-TodayDevlog $root
if ($today.Count) {
    $notIdx = @($today | Where-Object { -not (Test-DevlogIndexed $root $_) })
    $extra = ''
    if ($notIdx.Count) { $extra = " Falta indexar en devlog/INDEX.md: $($notIdx -join ', ')." }
    $cfg = Get-HookConfig $root
    if ($cfg -and $cfg.commands -and (Get-GitBranch $root) -and (Get-GitDirty $root) -gt 0) { $extra += " Hay cambios sin commitear: ejecuta los comandos del stack (lint/test/types de config.json) y pega la salida antes de cerrar." }
    if ($planMsg -or $extra) { Write-Output ("recordatorio:" + $planMsg + $extra) }
    exit 0
}

$dirty = 0
if (Get-GitBranch $root) { $dirty = Get-GitDirty $root }
$date = Get-Date -Format 'yyyy-MM-dd'
$reason = "[dev-standards] Hay $dirty archivo(s) con cambios y no existe ninguna entrada en devlog/$date/. Antes de terminar: crea devlog/$date/NNN-<slug>.md (numeracion global correlativa) con que se hizo, verificacion y proximos pasos, y actualiza devlog/INDEX.md (skill devlog). Si el cambio es trivial y no merece devlog, dilo explicitamente y termina." + $planMsg

$alreadyActive = ($p -and $p.stop_hook_active -eq $true)
if ($dirty -gt 0 -and -not $alreadyActive -and (Test-Once $sid 'stop-devlog')) {
    Write-Output ((@{ decision = 'block'; reason = $reason }) | ConvertTo-Json -Compress)
    exit 0
}
Write-Output ("recordatorio: aun no hay entrada de devlog para hoy ($date). Documenta el avance en devlog/$date/ antes de cerrar." + $planMsg)
exit 0
