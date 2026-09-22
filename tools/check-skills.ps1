#requires -Version 5.1
<#
.SYNOPSIS
  Verifica la conectividad del sistema de skills. Sale con 1 si hay errores.
.DESCRIPTION
  Checks:
   1. SKILL.md efectivo (propio/plugin/overlay): frontmatter, <= MaxLines, description <= MaxDesc.
   2. Referencias citadas (`references/...`, `templates/...`, `<skill>/references/...`) existen.
   3. Registro (core\skills-registry.json) <-> skills reales: 1:1, sin huerfanas.
   4. Citas `<skill> §seccion` en SKILL.md y references/*.md de skills propias resuelven contra archivos/encabezados reales.
   5. skill-router / front-activation generados al dia (build-routers.ps1).
   6. requires del registro satisfechos en bundles y plugins generados.
   7. Contrato de tarjeta: la regex de core\hooks\lib.mjs casa con los ejemplos de templates/PLAN.md, task-card.md, plan-format.md y SKILL.md del planner.
#>
param([int]$MaxLines = 100, [int]$MaxDesc = 250)

. (Join-Path $PSScriptRoot '_lib.ps1')
$root = Get-StandardsRoot
$errors = 0; $checked = 0
function Fail([string]$who, [string]$msg) { $script:errors++; Write-Host ("FAIL {0,-32} {1}" -f $who, $msg) }

# --- inventario ---
$skillDirs = @{}
foreach ($base in @('core\skills', 'core\skills-plugin', 'core\skills-vendor')) {
    $p = Join-Path $root $base
    if (Test-Path $p) { Get-ChildItem $p -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') } | ForEach-Object { $skillDirs[$_.Name] = $_.FullName } }
}
function Get-EffectiveSkillMd([string]$name) {
    $o = Join-Path $root "core\skills-overlay\$name\SKILL.md"
    if (Test-Path $o) { return $o }
    return (Join-Path $skillDirs[$name] 'SKILL.md')
}
function Get-SkillRoots([string]$name) {   # carpetas donde puede vivir un archivo de la skill
    @((Join-Path $root "core\skills-overlay\$name"), $skillDirs[$name]) | Where-Object { $_ -and (Test-Path $_) }
}
function Resolve-SkillFile([string]$name, [string]$rel) {
    $rel = ($rel -replace '/', '\').TrimEnd('\')
    foreach ($r in (Get-SkillRoots $name)) {
        foreach ($base in @('', 'references\', 'references\es\', 'templates\')) {
            foreach ($cand in @((Join-Path $r ($base + $rel)), (Join-Path $r ($base + $rel + '.md')))) { if (Test-Path $cand) { return $true } }
        }
    }
    return $false
}
function Strip-Accents([string]$t) {
    $n = $t.Normalize([Text.NormalizationForm]::FormD); $sb = New-Object Text.StringBuilder
    foreach ($c in $n.ToCharArray()) { if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($c) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($c) } }
    return $sb.ToString()
}
function Get-Headings([string]$file) {
    if (-not (Test-Path $file)) { return @() }
    return @((Read-Utf8 $file) -split "`r?`n" | Where-Object { $_ -match '^#{1,4}\s+' } | ForEach-Object { ($_ -replace '^#{1,4}\s+', '').Trim() })
}
function Resolve-Section([string]$name, [string]$section) {
    if (-not $skillDirs.ContainsKey($name)) { return $false }
    $sec = $section.Trim().Trim('"').Trim("'")
    if ($sec -match '^\d+[a-z]?$' -or $sec -match '^\d+[a-z]?\.') { return $true }   # §1, §2b: secciones numeradas del SKILL.md
    if ($sec -match '<') { return $true }                                              # placeholder (<tipo>, <Componente>)
    # forma "archivo "Encabezado"" o "archivo Encabezado": el archivo debe existir y el encabezado estar en el (parcial, sin acentos)
    if ($sec -match '^(\S+)\s+["'']?(.+?)["'']?$' -and (Resolve-SkillFile $name $Matches[1])) {
        $fileRel = $Matches[1]; $head = $Matches[2]
        $hn = Strip-Accents (($head -replace '[`*"'']', '').ToLower())
        foreach ($r in (Get-SkillRoots $name)) {
            $fr = ($fileRel -replace '/', '\')
            $cands = @()
            foreach ($base in @('', 'references\', 'references\es\', 'templates\')) { $cands += @((Join-Path $r ($base + $fr)), (Join-Path $r ($base + $fr + '.md'))) }
            foreach ($cand in $cands) {
                if (Test-Path $cand) { foreach ($h in (Get-Headings $cand)) { $x = Strip-Accents (($h -replace '[`*"'']', '').ToLower()); if ($x -like "*$hn*" -or $hn -like "*$x*") { return $true } } }
            }
        }
        return $false
    }
    if (Resolve-SkillFile $name $sec) { return $true }
    # encabezado del SKILL.md efectivo o de cualquier references/*.md
    $heads = @(Get-Headings (Get-EffectiveSkillMd $name))
    foreach ($r in (Get-SkillRoots $name)) { Get-ChildItem (Join-Path $r 'references') -Recurse -Filter *.md -ErrorAction SilentlyContinue | ForEach-Object { $heads += Get-Headings $_.FullName } }
    $secNorm = Strip-Accents (($sec -replace '[`*]', '').ToLower())
    foreach ($h in $heads) { $hn = Strip-Accents (($h -replace '[`*]', '').ToLower()); if ($hn -eq $secNorm -or $hn -like "*$secNorm*") { return $true } }
    return $false
}

# --- 1 y 2: SKILL.md efectivos ---
foreach ($name in ($skillDirs.Keys | Sort-Object)) {
    $checked++
    $file = Get-EffectiveSkillMd $name
    $txt = Read-Utf8 $file
    $lines = ($txt -split "`r?`n").Count
    $problems = @()
    if ($txt -notmatch '(?s)^---\s*\r?\n.*?\r?\n---') { $problems += 'sin frontmatter' }
    if ($txt -notmatch '(?m)^name:\s*\S') { $problems += 'sin name' }
    $desc = ''
    if ($txt -match '(?m)^description:\s*"?(.+?)"?\s*$') { $desc = $Matches[1] } else { $problems += 'sin description' }
    if ($desc.Length -gt $MaxDesc) { $problems += "description $($desc.Length) > $MaxDesc" }
    if ($lines -gt $MaxLines) { $problems += "$lines lineas > $MaxLines" }
    foreach ($line in ($txt -split "`r?`n")) {
        if ($line -match '(?i)no existe|inexistente|no incluye') { continue }
        foreach ($m in [regex]::Matches($line, '`((?:[\w\-]+/)?(?:references|templates)/[^`\s|)]+)`')) {
            $r = $m.Groups[1].Value
            if ($r -match '<|\.\.\.|\*|\{') { continue }
            $target = $name; $rel = $r
            if ($r -match '^([\w\-]+)/((?:references|templates)/.+)$' -and $skillDirs.ContainsKey($Matches[1])) { $target = $Matches[1]; $rel = $Matches[2] }
            if (-not (Resolve-SkillFile $target $rel)) { $problems += "falta $r" }
        }
    }
    if ($problems.Count) { Fail $name ($problems -join '; ') } else { Write-Host ("ok   {0,-32} {1,3} lineas, desc {2,3}" -f $name, $lines, $desc.Length) }
}

# --- 3: registro <-> skills ---
$regNames = @($script:Registry.skills | ForEach-Object name)
foreach ($n in $skillDirs.Keys) { if ($regNames -notcontains $n) { Fail 'registry' "skill '$n' existe pero no esta en core\skills-registry.json" } }
foreach ($n in $regNames) { if (-not $skillDirs.ContainsKey($n)) { Fail 'registry' "'$n' esta en el registro pero no existe" } }
foreach ($sk in $script:Registry.skills) {
    if (-not $sk.when) { Fail 'registry' "'$($sk.name)' sin 'when'" }
    if ($sk.group -notin @('routing') -and -not $sk.keywords) { Fail 'registry' "'$($sk.name)' sin keywords" }
    foreach ($req in @($sk.requires)) { if (-not $skillDirs.ContainsKey($req)) { Fail 'registry' "'$($sk.name)' requiere '$req' que no existe" } }
}

# --- 4: citas §skill ---
$own = @('core\skills', 'core\skills-plugin') | ForEach-Object { Get-ChildItem (Join-Path $root $_) -Directory }
foreach ($d in $own) {
    $files = @(Get-Item (Join-Path $d.FullName 'SKILL.md')) + @(Get-ChildItem (Join-Path $d.FullName 'references') -Recurse -Filter *.md -ErrorAction SilentlyContinue)
    foreach ($f in $files) {
        $txt = Read-Utf8 $f.FullName
        foreach ($m in [regex]::Matches($txt, '`?([\w\-]+)\s*§\s*((?:[^`|\n)"]*"[^"\n]*"|[^`|\n)"]+?))(?:`|\s*\||\s*\)|\s*\+|,|$)')) {
            $sk = $m.Groups[1].Value; $sec = $m.Groups[2].Value.Trim()
            if (-not $skillDirs.ContainsKey($sk)) { continue }   # "code §x" u otros falsos positivos
            # varias secciones separadas por " + " o " / "
            foreach ($part in ($sec -split '\s+\+\s+|\s+/\s+|\s*→\s*')) {
                $pp = $part.Trim().Trim('"').Trim()
                if (-not $pp -or $pp -match '^<') { continue }
                if (-not (Resolve-Section $sk $pp)) { Fail ($d.Name + ':' + $f.Name) "cita '$sk §$pp' no resuelve" }
            }
        }
    }
}

# --- 5: routers generados al dia ---
$tmpRouter = Join-Path $env:TEMP 'ds-router-check'
Ensure-Dir $tmpRouter
foreach ($n in 'skill-router', 'front-activation') {
    $src = Join-Path $root "core\skills-plugin\$n\SKILL.md"
    $before = Read-Utf8 $src
    & (Join-Path $PSScriptRoot 'build-routers.ps1') | Out-Null
    $after = Read-Utf8 $src
    if ($before -ne $after) { Fail $n 'tabla GENERATED desactualizada (build-routers.ps1 la ha regenerado; revisa y vuelve a ejecutar check)' }
}

# --- 6: requires en bundles y plugins ---
$bundles = Get-Bundles
$baseCore = @('devlog', 'project-planner', 'code-quality', 'skill-router')
foreach ($b in $bundles.Keys) {
    foreach ($sk in $bundles[$b]) {
        $entry = $script:Registry.skills | Where-Object { $_.name -eq $sk }
        foreach ($req in @($entry.requires)) {
            if ($bundles[$b] -notcontains $req -and $baseCore -notcontains $req -and $req -notin @('ui-ux-pro-max','threejs-webgl','gsap-scrolltrigger')) { Fail "bundle:$b" "'$sk' requiere '$req'" }
        }
    }
}
$plugins = Join-Path $root 'plugins'
if (Test-Path $plugins) {
    foreach ($pd in (Get-ChildItem $plugins -Directory)) {
        $have = @(Get-ChildItem (Join-Path $pd.FullName 'skills') -Directory -ErrorAction SilentlyContinue | ForEach-Object Name)
        foreach ($h in $have) {
            $entry = $script:Registry.skills | Where-Object { $_.name -eq $h }
            foreach ($req in @($entry.requires)) { if ($have -notcontains $req) { Fail "plugin:$($pd.Name)" "'$h' requiere '$req' (no incluida)" } }
        }
    }
}

# --- 7: contrato de tarjeta ---
$commonTxt = Read-Utf8 (Join-Path $root 'core\hooks\lib.mjs')
if ($commonTxt -match '/(\^###[^/]+)/') {
    $cardRx = $Matches[1]
    $samples = @()
    foreach ($f in @('core\skills\project-planner\templates\PLAN.md', 'core\skills\project-planner\templates\task-card.md', 'core\skills\project-planner\references\plan-format.md', 'core\skills\project-planner\SKILL.md')) {
        $t = Read-Utf8 (Join-Path $root $f)
        $cards = @($t -split "`r?`n" | Where-Object { $_ -match '^###\s+' -and $_ -match '\[' } | ForEach-Object { $_ -replace '<Fase>', 'F1' -replace '<n>', '1' -replace '<[^>]+>', 'x' })
        $cards = @($cards | Where-Object { $_ -match '^###\s+[A-Z]+\d*-T\d' })
        if (-not $cards.Count) { Fail $f 'sin tarjetas de ejemplo (### F1-T1 ...)'; continue }
        foreach ($c in $cards) {
            $probe = $c -replace '\[S\|M\]', '[S]' -replace '\[S\|M\|L\]', '[S]' -replace '\[todo\|doing\|blocked\|done\]', '[todo]'
            if ($probe -notmatch $cardRx) { Fail $f "tarjeta no parseable por lib.mjs: $c" }
        }
    }
    $bad = @('#### F1-T1 · x · S · doing')
    foreach ($b in $bad) { if ($b -match $cardRx) { Fail 'lib.mjs' "la regex acepta un formato no canonico: $b" } }
} else { Fail 'lib.mjs' 'no se encontro la regex de tarjeta' }

# --- 8: entrypoints y marca de precedencia ---
$eps = @($script:Registry.skills | Where-Object { $_.entrypoint })
foreach ($g in 'front', 'routing', 'planning') {
    $inG = @($eps | Where-Object { $_.group -eq $g })
    if ($inG.Count -ne 1) { Fail 'registry' "grupo '$g' debe tener exactamente 1 entrypoint (tiene $($inG.Count))" }
}
foreach ($e in $eps) {
    $txt = Read-Utf8 (Get-EffectiveSkillMd $e.name)
    if ($txt -match '(?m)^description:\s*"?(.+?)"?\s*$') {
        if ($Matches[1] -notmatch '(?i)PRIMERO|POR DEFECTO|puerta de entrada') { Fail $e.name 'description de entrypoint sin marca de precedencia (PRIMERO / POR DEFECTO)' }
    }
}

# --- 9: catalogo de efectos con punteros validos ---
$cat = Join-Path $root 'core\skills-plugin\front-activation\references\effects-catalog.md'
if (Test-Path $cat) {
    foreach ($line in ((Read-Utf8 $cat) -split "`r?`n")) {
        foreach ($m in [regex]::Matches($line, '`([\w\-]+)`?\s*(?:→|->)\s*`?((?:references|templates|SKILL)[^`\s§|]+)')) {
            $skn = $m.Groups[1].Value; $relf = $m.Groups[2].Value.TrimEnd('`')
            if ($skillDirs.ContainsKey($skn) -and -not (Resolve-SkillFile $skn $relf)) { Fail 'effects-catalog' "puntero '$skn -> $relf' no resuelve" }
        }
    }
} else { Fail 'effects-catalog' 'falta core\skills-plugin\front-activation\references\effects-catalog.md' }

# --- 10: hooks de plugins sin huecos ni muertos ---
$plugRoot = Join-Path $root 'plugins'
if (Test-Path $plugRoot) {
    foreach ($pd in (Get-ChildItem $plugRoot -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'hooks\hooks.json') })) {
        $hj = Read-Utf8 (Join-Path $pd.FullName 'hooks\hooks.json')
        $files = @(Get-ChildItem (Join-Path $pd.FullName 'hooks') -Filter *.mjs | Where-Object { $_.Name -ne 'lib.mjs' } | ForEach-Object Name)
        foreach ($f in $files) { if ($hj -notmatch [regex]::Escape($f)) { Fail "plugin:$($pd.Name)" "hook muerto: $f copiado pero no registrado en hooks.json" } }
        if ($pd.Name -in @('dev-standards-front', 'dev-standards-core', 'dev-standards-backend', 'dev-standards-all') -and $hj -notmatch 'UserPromptSubmit') { Fail "plugin:$($pd.Name)" 'sin UserPromptSubmit (prompt-router)' }
    }
}

# --- 11: los .ps1 del tooling con BOM UTF-8 (dev-003: sin BOM, PS 5.1 lee ANSI y corrompe literales con acentos).
#         Los hooks ya son .mjs (Node, UTF-8 nativo): sin requisito de BOM. ---
foreach ($ps in (Get-ChildItem (Join-Path $root 'tools'), (Join-Path $root 'tools\renderers') -Filter *.ps1 -ErrorAction SilentlyContinue)) {
    $b = [System.IO.File]::ReadAllBytes($ps.FullName)
    if ($b.Length -lt 3 -or $b[0] -ne 0xEF -or $b[1] -ne 0xBB -or $b[2] -ne 0xBF) { Fail $ps.Name 'sin BOM UTF-8 (PS 5.1 leera el archivo como ANSI)' }
}

Write-Host "Revisadas: $checked skills  Errores: $errors"
if ($errors) { exit 1 } else { exit 0 }
