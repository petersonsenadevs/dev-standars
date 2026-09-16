#requires -Version 5.1
<#
.SYNOPSIS
  Hook SessionStart: inyecta el estado del proyecto (stack, perfil de front, rama, cambios pendientes,
  design system, devlog de hoy, skills instaladas) y el protocolo de carga de skills. No bloquea.
#>
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
$root = Get-ProjectRoot
$marker = Get-Marker $root
$L = @()
$L += "[dev-standards] Estado del proyecto al iniciar la sesion:"
if ($marker) {
    $L += "- Stack: $($marker.stack)" + $(if ($marker.frontProfile) { " | Perfil de front: $($marker.frontProfile.label) (stacks del buscador: $($marker.frontProfile.stacks -join ', '))" } else { '' })
    $inst = @($marker.extraSkills) + @($marker.bundles | ForEach-Object { "bundle:$_" })
    if ($inst.Count) { $L += "- Skills/bundles opcionales instalados: $($inst -join ', ')" }
} else {
    $L += "- Sin .dev-standards.json: detecta el stack (composer.json / package.json / pyproject.toml) antes de asumir nada."
}
$branch = Get-GitBranch $root
if ($branch) {
    $dirty = Get-GitDirty $root
    $warn = if ($branch -in @('main', 'master', 'develop')) { ' -> NO commitees aqui: crea una rama primero.' } else { '' }
    $L += "- Git: rama '$branch', $dirty archivo(s) con cambios sin commitear.$warn"
}
$ds = Get-DesignSystemMaster $root
if ($ds) { $L += "- Design system del proyecto: $ds (fuente de verdad de UI)." }
elseif ($marker -and $marker.frontProfile) { $L += "- No hay design-system/*/MASTER.md: genera uno con ui-ux-pro-max antes de maquetar." }
$plan = Get-PlanStatus $root
if ($plan.exists) {
    $L += "- Plan del proyecto: plan/PLAN.md ($($plan.done)/$($plan.total) tareas hechas)." + $(if ($plan.doing.Count) { " EN CURSO: $($plan.doing -join '; ')." } else { '' }) + $(if ($plan.next.Count) { " Siguientes: $($plan.next -join '; ')." } else { '' }) + " Sigue el plan (skill project-planner, task-protocol) antes de hacer otra cosa."
} elseif ($marker) {
    $L += "- No hay plan/PLAN.md: si la tarea es un proyecto o feature (no un arreglo puntual), usa la skill project-planner para crear el plan antes de codificar."
}
$today = Get-TodayDevlog $root
$next = Get-DevlogNextNumber $root
$L += if ($today.Count) { "- Devlog de hoy: $($today -join ', ') (siguiente numero global: $('{0:000}' -f $next))" } else { "- Devlog de hoy: ninguno todavia; la siguiente entrada es devlog/$(Get-Date -Format 'yyyy-MM-dd')/$('{0:000}' -f $next)-<slug>.md (crea la entrada antes de cerrar la tarea o commitear)." }
$cfg = Get-HookConfig $root
if ($cfg -and $cfg.commands) {
    $cm = @(); foreach ($pr in $cfg.commands.PSObject.Properties) { $cm += "$($pr.Name): $($pr.Value)" }
    if ($cm.Count) { $L += "- Comandos del stack para verificar antes de dar algo por hecho: " + ($cm -join ' | ') }
}
$L += "- Puertas de entrada (empieza SIEMPRE por ellas): tarea de UI/front -> skill ui-ux-pro-max (via front-activation si dudas del stack); logica/backend -> code-quality (dominio rico: ddd-hexagonal); proyecto o feature nueva -> project-planner; duda general -> skill-router y su references/decision-trees.md."
$L += "- Protocolo: lee UNA skill por tarea y solo su seccion de 'Lectura minima'; SKILL.upstream.md y references/ por secciones, nunca enteros."
Out-HookJson 'SessionStart' @{ additionalContext = ($L -join "`n") }
exit 0
