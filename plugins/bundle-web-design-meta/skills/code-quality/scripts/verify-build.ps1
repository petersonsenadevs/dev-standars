#requires -Version 5.1
<#
.SYNOPSIS
  Verifica el proyecto tras editar codigo: lint, types, tests y build del stack, con veredicto.
.DESCRIPTION
  Ejecutar desde la RAIZ del proyecto (cualquier agente):
    powershell -File <skills-dir>/code-quality/scripts/verify-build.ps1
  Comandos: 1) .claude/hooks/config.json -> commands (dev-standards); 2) si no existe, se infieren de
  package.json (scripts lint/typecheck/test/build + astro check) y composer.json (pint/phpstan/artisan test).
  Un script npm inexistente cuenta como SKIP, no como fallo. Si TODO pasa, deja constancia (flag que lee el
  stop-guard de Claude); sale con 1 si algo FALLA. El agente debe corregir y re-ejecutar hasta 0 fallos.
#>
$ErrorActionPreference = 'Continue'
$root = (Get-Location).Path
$cmds = [ordered]@{}

$cfgPath = Join-Path $root '.claude\hooks\config.json'
if (Test-Path $cfgPath) {
    try {
        $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
        foreach ($k in @('lint', 'types', 'test', 'build')) { if ($cfg.commands.$k) { $cmds[$k] = [string]$cfg.commands.$k } }
    } catch {}
}
if (-not $cmds.Count) {
    $pkgPath = Join-Path $root 'package.json'
    if (Test-Path $pkgPath) {
        try {
            $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
            $scripts = @($pkg.scripts.PSObject.Properties.Name)
            if ($scripts -contains 'lint') { $cmds['lint'] = 'npm run lint' }
            if ($scripts -contains 'typecheck') { $cmds['types'] = 'npm run typecheck' }
            elseif ($pkg.dependencies.astro -or $pkg.devDependencies.astro) { $cmds['types'] = 'npx astro check' }
            if ($scripts -contains 'test') { $cmds['test'] = 'npm test' }
            if ($scripts -contains 'build') { $cmds['build'] = 'npm run build' }
        } catch {}
    }
    if (Test-Path (Join-Path $root 'composer.json')) {
        if (Test-Path (Join-Path $root 'vendor\bin\pint.bat')) { $cmds['lint'] = '.\vendor\bin\pint --test' }
        if (Test-Path (Join-Path $root 'vendor\bin\phpstan.bat')) { $cmds['types'] = '.\vendor\bin\phpstan analyse' }
        if (Test-Path (Join-Path $root 'artisan')) { $cmds['test'] = 'php artisan test' }
    }
}
if (-not $cmds.Count) { Write-Host '[verify-build] No hay comandos que ejecutar (ni config.json ni package/composer reconocibles).'; exit 2 }

$results = @(); $fails = 0
foreach ($k in $cmds.Keys) {
    $c = $cmds[$k]
    Write-Host ("== {0}: {1}" -f $k, $c)
    $out = & cmd /c "$c 2>&1" | Out-String
    $code = $LASTEXITCODE
    if ($code -ne 0 -and $out -match 'Missing script|no test specified|command not found|no se reconoce') {
        $results += "SKIP  $k  (no configurado en este proyecto)"
        continue
    }
    if ($code -ne 0) {
        $fails++
        $tail = ($out -split "`r?`n" | Where-Object { $_ } | Select-Object -Last 15) -join "`n"
        $results += "FAIL  $k  (exit $code)"
        Write-Host $tail
    } else {
        $results += "PASS  $k"
    }
}

Write-Host "`n== Resumen =="
$results | ForEach-Object { Write-Host "  $_" }
if ($fails) {
    Write-Host "`n[verify-build] $fails comando(s) en FALLO: corrige y re-ejecuta hasta 0. No des la tarea por hecha en rojo."
    exit 1
}
# Constancia para el stop-guard (mismo esquema de hash que core/hooks/_common.ps1)
$md5 = [System.Security.Cryptography.MD5]::Create()
$hash = -join ($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($root.ToLower())) | ForEach-Object { $_.ToString('x2') })
$flag = Join-Path $env:TEMP "dev-standards-verified-$($hash.Substring(0,12)).flag"
New-Item -ItemType File -Path $flag -Force | Out-Null
(Get-Item $flag).LastWriteTime = Get-Date
Write-Host "`n[verify-build] Todo en verde. Constancia registrada. Si tocaste UI, ademas ui-verify (movil primero)."
exit 0
