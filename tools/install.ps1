#requires -Version 5.1
<#
.SYNOPSIS
  Bootstrap de Senzu: descarga el repo y deja las skills instaladas para cualquier agente.
.DESCRIPTION
  Pensado para ejecutarse con un solo comando (PowerShell 5.1+):

    irm https://raw.githubusercontent.com/petersonsenadevs/senzu/main/tools/install.ps1 | iex

  Hace tres cosas:
    1. Clona (o actualiza) el repo en ~\.senzu (git si existe; si no, ZIP de GitHub).
    2. Instala las skills globales para Codex/Cursor/Windsurf/Claude (tools\install-skills.ps1).
    3. Te deja impresos los comandos de Claude Code (/plugin marketplace add) y de proyecto (init-project).
  Variables opcionales (definir antes del irm|iex):
    $env:SENZU_REPO  = 'https://github.com/otro/fork'   # otro origen
    $env:SENZU_DIR   = 'D:\herramientas\senzu'  # otro destino
    $env:SENZU_ALL   = '1'                              # instalar TODAS las skills, no solo el nucleo+front
#>
$ErrorActionPreference = 'Stop'

# SENZU_* (nombre actual) o DEV_STANDARDS_* (anterior). Si ya habia una copia en ~/.dev-standards, se sigue usando.   # compat-dev-standards
$repo = if ($env:SENZU_REPO) { $env:SENZU_REPO } elseif ($env:DEV_STANDARDS_REPO) { $env:DEV_STANDARDS_REPO } else { 'https://github.com/petersonsenadevs/senzu' }   # compat-dev-standards
$dest = if ($env:SENZU_DIR) { $env:SENZU_DIR } elseif ($env:DEV_STANDARDS_DIR) { $env:DEV_STANDARDS_DIR } elseif ((Test-Path (Join-Path $HOME '.dev-standards')) -and -not (Test-Path (Join-Path $HOME '.senzu'))) { Join-Path $HOME '.dev-standards' } else { Join-Path $HOME '.senzu' }   # compat-dev-standards
$slug = ($repo -replace '^https?://github\.com/', '') -replace '\.git$', ''

Write-Host "== Senzu :: bootstrap ==" -ForegroundColor Cyan
Write-Host "Repo: $repo"
Write-Host "Destino: $dest"

$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
    if (Test-Path (Join-Path $dest '.git')) {
        Write-Host "Actualizando (git pull)..."
        git -C $dest pull --ff-only
    } else {
        Write-Host "Clonando..."
        git clone --depth 1 $repo $dest
    }
} else {
    Write-Host "git no encontrado: descargando ZIP..."
    $zip = Join-Path $env:TEMP 'senzu.zip'
    Invoke-WebRequest -Uri "$repo/archive/refs/heads/main.zip" -OutFile $zip -UseBasicParsing
    $tmp = Join-Path $env:TEMP ('ds-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Move-Item $inner.FullName $dest
    Remove-Item $zip -Force; Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Instalando skills globales (Codex / Cursor / Windsurf / Claude)..."
$args_ = @()
if ($env:SENZU_ALL -eq '1' -or $env:DEV_STANDARDS_ALL -eq '1') { $args_ += '-All' }   # compat-dev-standards
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $dest 'tools\install-skills.ps1') @args_

Write-Host ""
Write-Host "Listo. Siguientes pasos:" -ForegroundColor Green
Write-Host "  Claude Code (plugins con hooks y comandos):"
Write-Host "    /plugin marketplace add $slug"
Write-Host "    /plugin install senzu-all@senzu   (TODO, recomendado; ligeros: -front, -backend, -core)"
Write-Host "  Por proyecto (CLAUDE.md/AGENTS.md + hooks + plan/devlog):"
Write-Host "    $dest\tools\init-project.ps1 -Stack astro -Path C:\ruta\proyecto"
Write-Host "  Actualizar mas adelante: repite el mismo comando irm | iex."
