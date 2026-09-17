#requires -Version 5.1
<#
.SYNOPSIS
  Hook UserPromptSubmit: detecta por palabras clave que skill(s) instaladas encajan con la peticion y lo recuerda
  UNA sola vez por skill y sesion. Reglas = core\skills-registry.json (via config.json -> router). No bloquea.
.DESCRIPTION
  Fuentes de reglas (primera que exista): <proyecto>\.claude\hooks\config.json -> router,
  $env:CLAUDE_PLUGIN_ROOT\hooks\config.json -> router. Skills disponibles: .claude\skills del proyecto,
  skills de TODOS los plugins instalados (~\.claude\plugins\**\skills), ~\.claude\skills y config.skills.
  Una skill con mayor "priority" gana a la generica (react-three-fiber antes que threejs-webgl).
#>
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
if (-not $p -or -not $p.prompt) { exit 0 }
$prompt = [string]$p.prompt
if ($prompt.Length -lt 12 -or $prompt -match '^\s*/') { exit 0 }
$root = Get-ProjectRoot
$sid = if ($p.session_id) { [string]$p.session_id } else { 'default' }
$cfg = Get-HookConfig $root
if (-not $cfg -or -not $cfg.router) { exit 0 }

$available = Get-AvailableSkills $root $cfg
# Entrypoints primero (ui-ux-pro-max, project-planner, skill-router), luego por prioridad descendente.
$rules = @($cfg.router | Where-Object { $_.keywords -and ($available -contains $_.name) } |
    Sort-Object -Property @{Expression={[bool]$_.entrypoint}; Descending=$true}, @{Expression={$_.priority}; Descending=$true})

$FrontGroups = @('front', 'motion', '3d', 'design')
$matched = @()
foreach ($r in $rules) { if ($prompt -match $r.keywords) { $matched += $r } }
if (-not $matched.Count) { exit 0 }

# Si algo de front matchea y el proyecto no tiene design system, el entrypoint de front entra SIEMPRE primero.
$dsNote = ''
$frontHit = @($matched | Where-Object { $FrontGroups -contains $_.group }).Count -gt 0
if ($frontHit -and ($available -contains 'ui-ux-pro-max') -and -not (Get-DesignSystemMaster $root)) {
    if (@($matched | Where-Object { $_.name -eq 'ui-ux-pro-max' }).Count -eq 0) {
        $entry = @($cfg.router | Where-Object { $_.name -eq 'ui-ux-pro-max' })
        if ($entry.Count) { $matched = @($entry[0]) + $matched }
    }
    $dsNote = " No hay design-system/*/MASTER.md: primero ui-ux-pro-max (design system y patron), despues el efecto o el componente."
    if (-not (Test-Path (Join-Path $root 'plan\brief.md'))) { $dsNote += " Tampoco hay plan/brief.md: pregunta al usuario primero (marca, referencias, objetivo; entrevista /brief o brief-discovery.md) en vez de inventar la direccion visual." }
}

# Maximo 2 sugerencias, una vez por skill y sesion.
$hits = @()
foreach ($r in $matched) {
    if ($hits.Count -ge 2) { break }
    if (Test-Once $sid "router-$($r.name)") { $hits += $r.name }
}
if (-not $hits.Count) { exit 0 }
$msg = "[dev-standards] Esta peticion parece de: " + ($hits -join ', ') + ". Antes de actuar lee el SKILL.md de la skill que aplique (su tabla 'Lectura minima por tarea' te dice que seccion abrir); las tareas de UI empiezan SIEMPRE por ui-ux-pro-max.$dsNote Si crees que no aplica, ignora este aviso."
Out-HookJson 'UserPromptSubmit' @{ additionalContext = $msg }
exit 0
