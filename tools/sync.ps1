#requires -Version 5.1
<#
.SYNOPSIS
  Re-renderiza la config de dev-standards a un proyecto ya inicializado.
.DESCRIPTION
  Lee el marcador .dev-standards.json del proyecto (stack, herramientas, skills y bundles opcionales) y
  regenera los archivos de cada herramienta a partir de core\ y stacks\<stack>\.
  Úsalo tras editar un systemprompt del stack, una skill o tras actualizar el vendor.
.PARAMETER Path
  Ruta del proyecto. Por defecto, el directorio actual.
.PARAMETER Stack
  (Opcional) Fuerza un stack, ignorando el marcador.
.PARAMETER Tools
  (Opcional) Fuerza el set de herramientas, ignorando el marcador.
.PARAMETER Skills
  (Opcional) Skills OPCIONALES además de las base del stack (p. ej. gsap-scrolltrigger,threejs-webgl).
  Se guardan en el marcador; para quitarlas pasa -Skills @().
.PARAMETER Bundle
  (Opcional) Bundles de core\bundles.json (p. ej. core-3d-animation). Se guardan en el marcador; -Bundle @() los quita.
.EXAMPLE
  D:\dev-standards\tools\sync.ps1 -Path "D:\proyectos\mi-app"
.EXAMPLE
  D:\dev-standards\tools\sync.ps1 -Path "D:\proyectos\mi-app" -Bundle core-3d-animation
.EXAMPLE
  D:\dev-standards\tools\sync.ps1 -Path "D:\proyectos\mi-app" -Skills gsap-scrolltrigger
#>
param(
    [string]$Path = (Get-Location).Path,
    [string]$Stack,
    [string[]]$Tools,
    [string[]]$Skills,
    [string[]]$Bundle,
    [switch]$GitHooks
)

. (Join-Path $PSScriptRoot '_lib.ps1')

$Path = (Resolve-Path $Path).Path
$markerPath = Join-Path $Path '.dev-standards.json'
$marker = $null
if (Test-Path $markerPath) { $marker = Get-Content $markerPath -Raw | ConvertFrom-Json }

if (-not $Stack -or -not $Tools) {
    if ($marker) {
        if (-not $Stack) { $Stack = $marker.stack }
        if (-not $Tools) { $Tools = @($marker.tools) }
    } else {
        throw "No hay .dev-standards.json en $Path. Usa init-project.ps1 primero, o pasa -Stack y -Tools."
    }
}
# Skills/bundles opcionales: si no se pasan, se conservan los del marcador.
if (-not $PSBoundParameters.ContainsKey('Skills')) { $Skills = if ($marker -and $marker.extraSkills) { @($marker.extraSkills) } else { @() } }
if (-not $PSBoundParameters.ContainsKey('Bundle')) { $Bundle = if ($marker -and $marker.bundles) { @($marker.bundles) } else { @() } }
$Skills = @($Skills | Where-Object { $_ } | ForEach-Object { $_.ToLower() } | Select-Object -Unique)
$Bundle = @($Bundle | Where-Object { $_ } | ForEach-Object { $_.ToLower() } | Select-Object -Unique)

$stackObj = Get-Stack -Name $Stack

$validTools = @{
    claude      = 'Render-Claude'
    cursor      = 'Render-Cursor'
    windsurf    = 'Render-Windsurf'
    codex       = 'Render-Codex'
    antigravity = 'Render-Antigravity'
}

Write-Host "Sincronizando '$($stackObj.Name)' en $Path"
Write-Host "Herramientas: $($Tools -join ', ')"
if ($stackObj.Meta.frontProfile) { Write-Host "Perfil de front: $($stackObj.Meta.frontProfile.label)" }
if ($Skills.Count) { Write-Host "Skills opcionales: $($Skills -join ', ')" }
if ($Bundle.Count) { Write-Host "Bundles: $($Bundle -join ', ')" }

$rendererDir = Join-Path $PSScriptRoot 'renderers'
$toolsToRender = @($Tools | ForEach-Object { $_.ToLower() } | Select-Object -Unique)
if ($toolsToRender -contains 'codex' -and $toolsToRender -contains 'antigravity') { $toolsToRender = @($toolsToRender | Where-Object { $_ -ne 'antigravity' }) }  # mismo AGENTS.md
foreach ($t in $toolsToRender) {
    $key = $t.ToLower()
    if (-not $validTools.ContainsKey($key)) { Write-Warning "Herramienta desconocida: $t (ignorada)"; continue }
    . (Join-Path $rendererDir "$key.ps1")
    & $validTools[$key] -Stack $stackObj -ProjectPath $Path -ExtraSkills $Skills -Bundles $Bundle
}

# Git hooks (capa dura comun): .githooks/ + core.hooksPath
$wantGit = $GitHooks -or ($marker -and $marker.gitHooks -eq $true)
if ($wantGit -and (Test-Path (Join-Path $Path '.git'))) {
    $ghDst = Join-Path $Path '.githooks'
    Ensure-Dir $ghDst
    Get-ChildItem (Join-Path (Get-StandardsRoot) 'core\githooks') -File | ForEach-Object {
        $t = Join-Path $ghDst $_.Name
        [System.IO.File]::WriteAllText($t, ((Read-Utf8 $_.FullName) -replace "`r`n", "`n"), (New-Object System.Text.UTF8Encoding($false)))
    }
    git -C $Path config core.hooksPath .githooks 2>$null
    git -C $Path update-index --chmod=+x .githooks/commit-msg .githooks/pre-commit .githooks/pre-push 2>$null | Out-Null
    Write-Host "  [git]        .githooks/ (commit-msg, pre-commit, pre-push) + core.hooksPath"
} elseif ($wantGit) { Write-Warning "-GitHooks: el proyecto no es un repositorio git; omitido." }

# Marcador (sin fecha, para que el archivo sea idempotente)
$markerObj = [ordered]@{
    stack = $stackObj.Name
    tools = @($Tools | ForEach-Object { $_.ToLower() } | Select-Object -Unique)
    extraSkills = @($Skills)
    bundles = @($Bundle)
    standardsRoot = (Get-StandardsRoot)
}
if ($wantGit) { $markerObj.gitHooks = $true }
if ($stackObj.Meta.frontProfile) { $markerObj.frontProfile = $stackObj.Meta.frontProfile }
Write-Utf8 $markerPath ($markerObj | ConvertTo-Json -Depth 5)

Write-Host "Listo. Config regenerada."
