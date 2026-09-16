#requires -Version 5.1
<#
.SYNOPSIS
  Hook PreToolUse (Edit|Write|MultiEdit|NotebookEdit): bloquea la edicion de archivos protegidos.
.DESCRIPTION
  Bloquea (exit 2 + motivo en STDERR):
    - archivos GENERADOS por dev-standards (CLAUDE.md, AGENTS.md, .cursor/rules, .windsurf/rules, .claude/skills/**, .agents/skills/**)
    - secretos y config sensible: .env, .env.*, *.pem, *.key, id_rsa*, credentials*, secrets*
    - dependencias y artefactos: vendor/**, node_modules/**, .git/**, dist/**, build/**, storage/framework/**, __pycache__/**
    - migraciones ya ejecutadas/compartidas: database/migrations/* que existan en git (no nuevas)  [solo Laravel]
    - rutas extra definidas en .claude/hooks/config.json -> protectedPaths (glob simples con * y **)
  Permite todo lo demas. Nunca bloquea la creacion de archivos nuevos salvo secretos.
#>
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

. "$PSScriptRoot\_common.ps1"
$p = Read-HookInput
if (-not $p -or $p.tool_name -notin @('Edit', 'Write', 'MultiEdit', 'NotebookEdit')) { exit 0 }

$file = [string]$p.tool_input.file_path
if (-not $file) { $file = [string]$p.tool_input.notebook_path }
if (-not $file) { exit 0 }

$root = Get-ProjectRoot
$rel = $file
try { $full = [System.IO.Path]::GetFullPath($file); if ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { $rel = $full.Substring($root.Length).TrimStart('\', '/') } } catch {}
$rel = $rel -replace '\\', '/'
$exists = Test-Path $file

function Deny([string]$why) {
    [Console]::Error.WriteLine("[BLOQUEADO por dev-standards] $why")
    [Console]::Error.WriteLine("Archivo: $rel")
    exit 2
}

# 1) Generados por dev-standards
if ($rel -match '^(CLAUDE\.md|AGENTS\.md)$' -and $exists) {
    $head = ''
    try { $head = (Get-Content $file -TotalCount 2 -Encoding UTF8) -join ' ' } catch {}
    if ($head -match 'GENERADO por dev-standards') { Deny 'Archivo generado por dev-standards. Edita stacks\<stack>\ o core\ en D:\dev-standards y corre sync.ps1.' }
}
if ($rel -match '^(\.claude/skills|\.agents/skills|\.cursor/skills|\.windsurf/skills|\.cursor/rules|\.windsurf/rules|\.claude/hooks)/' -or $rel -match '^(\.claude/settings\.json|\.mcp\.json|\.dev-standards\.json)$') {
    Deny 'Archivo generado por dev-standards (skills, reglas, hooks, settings, mcp, marcador). Edita el origen en dev-standards y corre sync.ps1; para permisos locales usa .claude/settings.local.json.'
}
if ($rel -match '^(plugins|core/skills-vendor)/' -and (Test-Path (Join-Path $root 'tools\vendor.ps1'))) {
    Deny 'Carpeta generada de dev-standards (plugins/ o core/skills-vendor/). Edita core/skills-overlay o core/skills y regenera con build-plugins.ps1 / vendor.ps1.'
}

# 2) Secretos
if ($rel -match '(^|/)\.env(\.|$)' -or $rel -match '\.(pem|key|p12|pfx)$' -or $rel -match '(^|/)(id_rsa|id_ed25519)' -or $rel -match '(?i)(^|/)(credentials|secrets?)(\.|/|$)') {
    Deny 'Archivo de secretos/credenciales. No se edita desde el agente: hazlo tu a mano.'
}

# 3) Dependencias y artefactos
if ($rel -match '(^|/)(vendor|node_modules|\.git|dist|build|\.next|\.nuxt|\.astro|__pycache__|\.venv|venv)/' -or $rel -match '(^|/)storage/framework/') {
    Deny 'Dependencias o artefactos generados: no se editan a mano (cambia la fuente o la configuracion).'
}

# 4) Migraciones ya versionadas (Laravel/Prisma/Alembic): solo bloquea si el archivo ya esta en git
if ($exists -and $rel -match '(^|/)(database/migrations|prisma/migrations|alembic/versions|migrations)/[^/]+') {
    $tracked = ''
    try { $tracked = (git -C $root ls-files --error-unmatch -- $rel 2>$null | Out-String).Trim() } catch {}
    if ($tracked) { Deny 'Migracion ya versionada/compartida: no se edita. Crea una migracion nueva.' }
}

# 5) Rutas extra del proyecto (config.json -> protectedPaths)
$cfg = Get-HookConfig $root
if ($cfg) {
    try {
        foreach ($g in @($cfg.protectedPaths)) {
            if (-not $g) { continue }
            $rx = '^' + [regex]::Escape($g).Replace('\*\*/', '(.*/)?').Replace('\*\*', '.*').Replace('\*', '[^/]*') + '$'
            if ($rel -match $rx) { Deny "Ruta protegida por el proyecto ($g). Pide aprobacion explicita." }
        }
    } catch {}
}
exit 0
