#requires -Version 5.1
<#
.SYNOPSIS
  Instala skills de dev-standards (vendor + overlay fusionados) de forma GLOBAL para cada agente,
  sin necesidad de inicializar un proyecto.
.DESCRIPTION
  Copia las skills pedidas a las carpetas de skills de usuario:
    claude  -> ~\.claude\skills\<skill>
    codex   -> ~\.codex\skills\<skill>   y   ~\.agents\skills\<skill>  (estandar Agent Skills, lo leen Codex y Cursor)
    cursor  -> ~\.cursor\skills\<skill>
    windsurf-> ~\.windsurf\skills\<skill>
  Las skills instaladas asi se autodescubren por su descripcion; para la tabla de activacion por stack
  sigue usando init-project.ps1 / sync.ps1 en el proyecto, o el plugin de Claude Code (tools\build-plugins.ps1).
.PARAMETER Skills
  Nombres de skills. Por defecto: project-planner, skill-router, front-activation, ui-ux-pro-max, gsap-scrolltrigger, threejs-webgl, code-quality.
.PARAMETER Bundle
  Bundles de core\bundles.json a instalar ademas.
.PARAMETER All
  Instala TODAS las skills (core + vendor).
.PARAMETER Agents
  claude, codex, cursor, windsurf, all. Por defecto: all.
.PARAMETER Uninstall
  Elimina las skills indicadas de las carpetas de usuario.
.PARAMETER HomeDir
  (Pruebas) Carpeta que hace de HOME en lugar de la real.
.EXAMPLE
  D:\dev-standards\tools\install-skills.ps1                       # nucleo + front (7 skills) en todos los agentes
  D:\dev-standards\tools\install-skills.ps1 -Bundle core-3d-animation -Agents codex
  D:\dev-standards\tools\install-skills.ps1 -All
#>
param(
    [string[]]$Skills = @('project-planner', 'skill-router', 'instalar-proyecto', 'devlog', 'code-quality', 'backend-audit', 'depurar', 'deploy-ops', 'marketing-seo', 'email-html', 'front-activation', 'ui-ux-pro-max', 'ui-verify', 'image-gen', 'gsap-scrolltrigger', 'threejs-webgl'),
    [string[]]$Bundle = @(),
    [switch]$All,
    [string[]]$Agents = @('all'),
    [switch]$Uninstall,
    [string]$HomeDir
)

. (Join-Path $PSScriptRoot '_lib.ps1')
$root = Get-StandardsRoot
$home_ = if ($HomeDir) { $HomeDir } elseif ($HOME) { $HOME } else { $env:USERPROFILE }

$targets = @{
    claude   = @((Join-Path $home_ '.claude\skills'))
    codex    = @((Join-Path $home_ '.codex\skills'), (Join-Path $home_ '.agents\skills'))
    cursor   = @((Join-Path $home_ '.cursor\skills'))
    windsurf = @((Join-Path $home_ '.windsurf\skills'))
}
$sel = if ($Agents -contains 'all') { $targets.Keys } else { $Agents | ForEach-Object { $_.ToLower() } }

$names = @()
if ($All) {
    $names = @(Get-ChildItem (Join-Path $root 'core\skills') -Directory | ForEach-Object Name) +
             @(Get-ChildItem (Join-Path $root 'core\skills-plugin') -Directory | ForEach-Object Name) +
             @(Get-ChildItem (Join-Path $root 'core\skills-vendor') -Directory | ForEach-Object Name)
} else {
    $names = @($Skills) + (Expand-Bundles -Bundles $Bundle)
}
$names = @($names | Where-Object { $_ } | Select-Object -Unique)

foreach ($a in $sel) {
    if (-not $targets.ContainsKey($a)) { Write-Warning "Agente desconocido: $a"; continue }
    foreach ($dst in $targets[$a]) {
        Ensure-Dir $dst
        foreach ($n in $names) {
            $skillDst = Join-Path $dst $n
            if ($Uninstall) {
                if (Test-Path $skillDst) { Remove-Item $skillDst -Recurse -Force; Write-Host "  [$a] eliminada $n  ($dst)" }
                continue
            }
            $r = Copy-SkillByName -Name $n -Dst $dst
            if ($r) { Write-Host "  [$a] $n -> $skillDst" }
        }
    }
}
if ($Uninstall) { Write-Host "Listo (desinstaladas: $($names -join ', '))." }
else { Write-Host "Listo. Skills instaladas globalmente: $($names -join ', '). Reinicia la sesion del agente para que las descubra." }
