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

function Compare-Proyectos([string]$Escenario) {
    # 1) Guias byte a byte
    foreach ($f in 'CLAUDE.md', 'AGENTS.md') {
        $ta = Read-Utf8 (Join-Path $a $f); $tb = Read-Utf8 (Join-Path $b $f)
        if ($ta -ne $tb) {
            $la = $ta -split "`r?`n"; $lb = $tb -split "`r?`n"
            $n = [Math]::Min($la.Count, $lb.Count); $diff = "longitudes $($la.Count) vs $($lb.Count)"
            for ($i = 0; $i -lt $n; $i++) { if ($la[$i] -cne $lb[$i]) { $diff = "linea $($i+1): PS='$($la[$i])' NODE='$($lb[$i])'"; break } }
            Fail "[$Escenario] $f difiere ($diff)"
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
        if ((Canon $ja) -cne (Canon $jb)) { Fail "[$Escenario] $f difiere (canonico)" }
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
            Fail "[$Escenario] $sub difiere (solo PS: $($solo1 -join ', ') | solo NODE: $($solo2 -join ', '))"
        }
    }
    # SKILL.md efectivos identicos (el contenido critico de las skills)
    foreach ($sk in (RelFiles $a '.claude\skills' | Where-Object { $_ -match '/SKILL(\.upstream)?\.md$' })) {
        $ta = Read-Utf8 (Join-Path $a ".claude\skills\$($sk -replace '/', '\')")
        $tb = Read-Utf8 (Join-Path $b ".claude\skills\$($sk -replace '/', '\')")
        if ($ta -cne $tb) { Fail "[$Escenario] skill $sk difiere entre instaladores" }
    }

}

Compare-Proyectos 'completo'

# Escenario 2: reinstalar con seleccion (categorias + muros y comandos elegidos). Verifica que los dos
# instaladores aplican la seleccion igual y que PODAN lo que ya no esta elegido.
$sel = [ordered]@{ modo = 'categorias'; grupos = @('motion', 'ops'); hooks = @('guard', 'stop-guard'); comandos = @('plan', 'verificar') }
foreach ($p in $a, $b) {
    $m = (Read-Utf8 (Join-Path $p '.dev-standards.json')) | ConvertFrom-Json
    $m | Add-Member -NotePropertyName seleccion -NotePropertyValue $sel -Force
    $m | Add-Member -NotePropertyName ahorro -NotePropertyValue $true -Force
    # Permisos y hooks apagados del usuario: se conservan al reinstalar; 'guard' no se puede apagar
    $m | Add-Member -NotePropertyName permisos -NotePropertyValue ([ordered]@{ push = $true; commitEnMain = $true }) -Force
    $m | Add-Member -NotePropertyName hooksApagados -NotePropertyValue @('format-on-save', 'guard', 'prompt-router') -Force
    Write-Utf8 (Join-Path $p '.dev-standards.json') ($m | ConvertTo-Json -Depth 6)
    # Un MCP propio del proyecto (como laravel-boost) debe sobrevivir a la reinstalacion
    Write-Utf8 (Join-Path $p '.mcp.json') '{ "mcpServers": { "laravel-boost": { "command": "php", "args": ["artisan", "boost:mcp"] } } }'
}
$env:DEV_STANDARDS_ASSUME_YES = '1'
& (Join-Path $PSScriptRoot 'sync.ps1') -Path $a *>$null
node (Join-Path $PSScriptRoot 'init.mjs') --path $b *>$null
$env:DEV_STANDARDS_ASSUME_YES = ''
Compare-Proyectos 'seleccion'
# Y que la seleccion se aplico de verdad (no solo que coincidan)
$cmds = @(Get-ChildItem (Join-Path $b '.claude\commands') -Filter *.md | ForEach-Object BaseName | Sort-Object)
if (($cmds -join ',') -ne 'plan,verificar') { Fail "[seleccion] comandos esperados plan,verificar; hay: $($cmds -join ',')" }
if (Test-Path (Join-Path $b '.claude\skills\ui-ux-pro-max')) { Fail '[seleccion] ui-ux-pro-max deberia haberse quitado (no esta en motion/ops ni en el nucleo)' }
if (-not (Test-Path (Join-Path $b '.claude\skills\gsap-scrolltrigger'))) { Fail '[seleccion] falta gsap-scrolltrigger (grupo motion)' }
$hk = Read-Utf8 (Join-Path $b '.claude\settings.json')
if ($hk -match 'code-hygiene' -or $hk -notmatch 'guard\.mjs' -or $hk -notmatch 'edit-tracker') { Fail '[seleccion] hooks registrados no coinciden con guard + stop-guard (+ edit-tracker y session-end)' }
foreach ($p in $a, $b) {
    $mk = (Read-Utf8 (Join-Path $p '.dev-standards.json')) | ConvertFrom-Json
    if (-not ($mk.permisos -and $mk.permisos.push -eq $true -and $mk.permisos.commitEnMain -eq $true)) { Fail "[permisos] la reinstalacion perdio los permisos ($p)" }
    if ((@($mk.hooksApagados) -join ',') -ne 'format-on-save,prompt-router') { Fail "[permisos] hooksApagados esperados format-on-save,prompt-router (guard no se apaga); hay: $(@($mk.hooksApagados) -join ',') ($p)" }
    $mj = (Read-Utf8 (Join-Path $p '.mcp.json')) | ConvertFrom-Json
    if (-not $mj.mcpServers.'laravel-boost') { Fail "[mcp] la reinstalacion borro el servidor MCP propio del proyecto ($p)" }
}
# Modo ahorro: CLAUDE.md compacto (sin lista de skills, con la sección de estilo); AGENTS.md completo (el ahorro solo afecta a CLAUDE.md)
$cm = Read-Utf8 (Join-Path $b 'CLAUDE.md'); $ag = Read-Utf8 (Join-Path $b 'AGENTS.md')
if ($cm -notmatch '# Modo ahorro' -or $cm -match '# Skills disponibles') { Fail '[ahorro] CLAUDE.md no esta en modo compacto' }
if ($ag -notmatch '# Skills disponibles' -or $ag -match '# Modo ahorro') { Fail '[ahorro] AGENTS.md deberia seguir completo' }
Write-Host ("  AGENTS.md (completo) {0} vs CLAUDE.md (ahorro) {1} caracteres" -f $ag.Length, $cm.Length)

Remove-Item $a, $b -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Paridad init.ps1 vs init.mjs ($Stack): $(if ($fail) { "$fail diferencias" } else { 'OK' })"
if ($fail) { exit 1 } else { exit 0 }
