#requires -Version 5.1
<#
.SYNOPSIS
  Inicializa (bootstrap) un proyecto con un stack de dev-standards.
.DESCRIPTION
  - Crea la carpeta del proyecto si no existe.
  - Crea el esqueleto de devlog/ (INDEX.md + carpeta del día).
  - Escribe el marcador .dev-standards.json.
  - Renderiza la config de cada herramienta elegida (llama a sync.ps1).
.PARAMETER Stack
  Nombre del stack: laravel | next | astro | vue-ts | python-langgraph
.PARAMETER Path
  Ruta del proyecto (se crea si no existe).
.PARAMETER Tools
  Herramientas a configurar: claude, cursor, windsurf, codex, antigravity.
  Por defecto: claude.
.PARAMETER Skills
  Skills OPCIONALES además de las base del stack (devlog + ui-ux-pro-max van siempre en stacks front).
  Ejemplo: -Skills gsap-scrolltrigger,threejs-webgl  (solo cuando el proyecto necesite animación/3D).
.PARAMETER Bundle
  Bundles de skills opcionales (coreundles.json): core-3d-animation, extended-3d-scroll, animation-components,
  3d-authoring, web-design-meta, design-extras, motion-web, 3d-web.
.EXAMPLE
  D:\dev-standards\tools\init-project.ps1 -Stack laravel -Path "D:\proyectos\mi-app" -Tools claude,cursor
.EXAMPLE
  D:\dev-standards\tools\init-project.ps1 -Stack laravel -Path "D:\proyectos\web-3d" -Bundle core-3d-animation
#>
param(
    [Parameter(Mandatory)][ValidateSet('laravel','next','astro','vue-ts','python-langgraph')][string]$Stack,
    [Parameter(Mandatory)][string]$Path,
    [string[]]$Tools = @('claude'),
    [string[]]$Skills = @(),
    [string[]]$Bundle = @()
)

. (Join-Path $PSScriptRoot '_lib.ps1')

Ensure-Dir $Path
$Path = (Resolve-Path $Path).Path
$root = Get-StandardsRoot

Write-Host "== dev-standards :: init =="
Write-Host "Stack: $Stack"
Write-Host "Proyecto: $Path"

# 1) Esqueleto de devlog/
$today   = Get-Date -Format 'yyyy-MM-dd'
$devlog  = Join-Path $Path 'devlog'
$dayDir  = Join-Path $devlog $today
Ensure-Dir $dayDir

$indexDst = Join-Path $devlog 'INDEX.md'
if (-not (Test-Path $indexDst)) {
    Copy-Item (Join-Path $root 'templates\devlog-index.md') $indexDst -Force
}
$firstEntry = Join-Path $dayDir '001-setup-inicial.md'
if (-not (Test-Path $firstEntry)) {
    $tpl = Read-Utf8 (Join-Path $root 'templates\devlog-day.md')
    $tpl = $tpl.Replace('NNN', '001').Replace('YYYY-MM-DD HH:MM', "$today " + (Get-Date -Format 'HH:mm'))
    Write-Utf8 $firstEntry $tpl
}
$decis = Join-Path $dayDir 'DECISIONES.md'
if (-not (Test-Path $decis)) { Write-Utf8 $decis "# Decisiones - $today`n`n" }

Write-Host "  devlog/ inicializado ($today)"

# 1b) Semilla del plan (skill project-planner)
$planDir = Join-Path $Path 'plan'
Ensure-Dir $planDir
$planTpl = Join-Path $root 'core\skills\project-planner\templates'
if (-not (Test-Path (Join-Path $planDir 'PLAN.md')))  { Copy-Item (Join-Path $planTpl 'PLAN.md')  (Join-Path $planDir 'PLAN.md') }
if (-not (Test-Path (Join-Path $planDir 'brief.md'))) { Copy-Item (Join-Path $planTpl 'brief.md') (Join-Path $planDir 'brief.md') }
Write-Host "  plan/ inicializado (PLAN.md y brief.md son plantillas: rellenalos con la skill project-planner)"

# 2) Delegar el render a sync.ps1
& (Join-Path $PSScriptRoot 'sync.ps1') -Path $Path -Stack $Stack -Tools $Tools -Skills $Skills -Bundle $Bundle

Write-Host ""
Write-Host "Proyecto listo. Recuerda: el systemprompt del stack es EVOLUTIVO."
Write-Host "Edita  stacks\$Stack\  y vuelve a correr:  sync.ps1 -Path `"$Path`""
Write-Host "Skills opcionales (animación/3D):  sync.ps1 -Path `"$Path`" -Bundle core-3d-animation  (o -Skills gsap-scrolltrigger)"
