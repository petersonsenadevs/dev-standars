#requires -Version 5.1
<#
.SYNOPSIS
  Hook PreCompact: re-inyecta lo que no debe perderse al compactar el contexto: stack/perfil, design system,
  devlog de hoy, rama y protocolo de carga de skills. No bloquea.
#>
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
$root = Get-ProjectRoot
$marker = Get-Marker $root
$L = @("[dev-standards] Conserva tras la compactacion:")
if ($marker) { $L += "- Stack $($marker.stack)" + $(if ($marker.frontProfile) { " | perfil de front: $($marker.frontProfile.label)" } else { '' }) }
$ds = Get-DesignSystemMaster $root; if ($ds) { $L += "- Design system: $ds" }
$today = Get-TodayDevlog $root; if ($today.Count) { $L += "- Devlog de hoy: $($today -join ', ') (sigue numerando desde ahi)" }
$b = Get-GitBranch $root; if ($b) { $L += "- Rama git: $b" }
$plan = Get-PlanStatus $root; if ($plan.exists) { $L += "- Plan: plan/PLAN.md ($($plan.done)/$($plan.total))" + $(if ($plan.doing.Count) { " | en curso: $($plan.doing -join '; ')" } else { '' }) }
$next = Get-DevlogNextNumber $root; $L += "- Siguiente numero de devlog: $('{0:000}' -f $next)"
$L += "- Reglas: sin git push ni operaciones destructivas sin aprobacion; commits Conventional sin co-autor; devlog antes de cerrar."
$L += "- Skills: una por tarea, solo su seccion de lectura minima; upstream y references por secciones."
Out-HookJson 'PreCompact' @{ additionalContext = ($L -join "`n") }
exit 0
