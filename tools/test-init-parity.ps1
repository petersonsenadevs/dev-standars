#requires -Version 5.1
<#
.SYNOPSIS
  Suite de PARIDAD: init-project.ps1 (Windows) y init.mjs (Node agnóstico) deben producir el MISMO proyecto.
.DESCRIPTION
  Inicializa dos proyectos sintéticos (uno con cada instalador, stack astro, claude+codex, ASSUME_YES)
  y compara: CLAUDE.md/AGENTS.md byte a byte, los JSON (settings/config/mcp/marcador) parseados y
  canónicos, y los listados de skills/hooks/comandos. devlog/ se compara solo por nombres (lleva hora).
  Si divergen, los dos instaladores se han separado: arregla el que se quedó atrás. Sale con 1 si falla.
#>
param([string]$Stack = 'astro')
. (Join-Path $PSScriptRoot '_lib.ps1')
$root = Get-StandardsRoot
$fail = 0
function Fail([string]$msg) { $script:fail++; Write-Host "FAIL $msg" }

$a = Join-Path $env:TEMP 'ds-parity-ps'
$b = Join-Path $env:TEMP 'ds-parity-node'
Remove-Item $a, $b -Recurse -Force -ErrorAction SilentlyContinue
$env:DEV_STANDARDS_ASSUME_YES = '1'
& (Join-Path $PSScriptRoot 'init-project.ps1') -Stack $Stack -Path $a -Tools claude,codex *>$null
node (Join-Path $PSScriptRoot 'init.mjs') --stack $Stack --path $b --tools claude,codex *>$null
$env:DEV_STANDARDS_ASSUME_YES = ''

# 1) Guias byte a byte
foreach ($f in 'CLAUDE.md', 'AGENTS.md') {
    $ta = Read-Utf8 (Join-Path $a $f); $tb = Read-Utf8 (Join-Path $b $f)
    if ($ta -ne $tb) {
        $la = $ta -split "`r?`n"; $lb = $tb -split "`r?`n"
        $n = [Math]::Min($la.Count, $lb.Count); $diff = "longitudes $($la.Count) vs $($lb.Count)"
        for ($i = 0; $i -lt $n; $i++) { if ($la[$i] -cne $lb[$i]) { $diff = "linea $($i+1): PS='$($la[$i])' NODE='$($lb[$i])'"; break } }
        Fail "$f difiere ($diff)"
    }
}

# 2) JSON canonicos (parseados y re-serializados con claves ordenadas via python-free: ConvertTo-Json de objeto ordenado)
function Canon($obj) {
    if ($null -eq $obj) { return 'null' }
    if ($obj -is [System.Array]) { return '[' + (@($obj | ForEach-Object { Canon $_ }) -join ',') + ']' }
    if ($obj -is [System.Management.Automation.PSCustomObject]) {
        $pairs = @($obj.PSObject.Properties | Sort-Object Name | ForEach-Object { '"' + $_.Name + '":' + (Canon $_.Value) })
        return '{' + ($pairs -join ',') + '}'
    }
    return ($obj | ConvertTo-Json -Compress -Depth 1)
}
foreach ($f in '.claude\settings.json', '.claude\hooks\config.json', '.mcp.json', '.dev-standards.json') {
    $ja = (Read-Utf8 (Join-Path $a $f)) | ConvertFrom-Json
    $jb = (Read-Utf8 (Join-Path $b $f)) | ConvertFrom-Json
    if ((Canon $ja) -cne (Canon $jb)) { Fail "$f difiere (canonico)" }
}

# 3) Listados de archivos (skills completas por rutas relativas; hooks y comandos por nombre; devlog/plan por nombre)
function RelFiles([string]$Base, [string]$Sub) {
    $p = Join-Path $Base $Sub
    if (-not (Test-Path $p)) { return @() }
    return @(Get-ChildItem $p -Recurse -File | ForEach-Object { $_.FullName.Substring($p.Length + 1) -replace '\\', '/' } | Sort-Object)
}
foreach ($sub in '.claude\skills', '.agents\skills', '.claude\hooks', '.claude\commands', 'plan', 'devlog') {
    $fa = RelFiles $a $sub; $fb = RelFiles $b $sub
    if (($fa -join '|') -cne ($fb -join '|')) {
        $solo1 = @($fa | Where-Object { $fb -notcontains $_ }) | Select-Object -First 3
        $solo2 = @($fb | Where-Object { $fa -notcontains $_ }) | Select-Object -First 3
        Fail "$sub difiere (solo PS: $($solo1 -join ', ') | solo NODE: $($solo2 -join ', '))"
    }
}
# SKILL.md efectivos identicos (el contenido critico de las skills)
foreach ($sk in (RelFiles $a '.claude\skills' | Where-Object { $_ -match '/SKILL(\.upstream)?\.md$' })) {
    $ta = Read-Utf8 (Join-Path $a ".claude\skills\$($sk -replace '/', '\')")
    $tb = Read-Utf8 (Join-Path $b ".claude\skills\$($sk -replace '/', '\')")
    if ($ta -cne $tb) { Fail "skill $sk difiere entre instaladores" }
}

Remove-Item $a, $b -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Paridad init.ps1 vs init.mjs ($Stack): $(if ($fail) { "$fail diferencias" } else { 'OK' })"
if ($fail) { exit 1 } else { exit 0 }
