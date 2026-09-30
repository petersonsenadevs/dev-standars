#requires -Version 5.1
# Librería compartida para init-project.ps1, sync.ps1 y vendor.ps1

$script:StandardsRoot = Split-Path -Parent $PSScriptRoot   # D:\dev-standards

function Get-StandardsRoot { $script:StandardsRoot }

function Get-Stack {
    param([Parameter(Mandatory)][string]$Name)
    $dir = Join-Path $script:StandardsRoot "stacks\$Name"
    if (-not (Test-Path $dir)) {
        throw "Stack '$Name' no existe en $dir. Stacks disponibles: $((Get-ChildItem (Join-Path $script:StandardsRoot 'stacks') -Directory).Name -join ', ')"
    }
    $meta = (Read-Utf8 (Join-Path $dir 'stack.json')) | ConvertFrom-Json
    [pscustomobject]@{ Name = $Name; Dir = $dir; Meta = $meta }
}

function Get-EffectiveFrontProfile {
    # Perfil de front EFECTIVO: manual del marcador > deteccion de package.json > default del stack.
    # Devuelve @{ profile = <obj>; source = 'manual'|'auto'|'default' }.
    param([Parameter(Mandatory)]$Stack, [Parameter(Mandatory)][string]$ProjectPath, $Marker)
    $fp = $Stack.Meta.frontProfile
    if (-not $fp) { return $null }
    if ($Marker -and $Marker.frontProfileSource -eq 'manual' -and $Marker.frontProfile) {
        return @{ profile = $Marker.frontProfile; source = 'manual' }
    }
    $pkgPath = Join-Path $ProjectPath 'package.json'
    if (-not (Test-Path $pkgPath)) { return @{ profile = $fp; source = 'default' } }
    $pkg = $null
    try { $pkg = (Read-Utf8 $pkgPath) | ConvertFrom-Json } catch { return @{ profile = $fp; source = 'default' } }
    $deps = @()
    foreach ($k in @('dependencies', 'devDependencies')) {
        if ($pkg.$k) { $deps += @($pkg.$k.PSObject.Properties.Name) }
    }
    $hasReact = ($deps -contains 'react') -or ($deps -contains '@astrojs/react')
    $hasTw    = @($deps | Where-Object { $_ -eq 'tailwindcss' -or $_ -like '@tailwindcss/*' }).Count -gt 0
    $stacks = @($fp.stacks)
    $label  = [string]$fp.label
    if ($Stack.Name -eq 'astro' -and -not $hasReact) {
        $stacks = @($stacks | Where-Object { $_ -notin @('react', 'shadcn') })
        $label = $label.Replace(' + React islands', '')
    }
    if (-not $hasTw) {
        $stacks = @($stacks | Where-Object { $_ -notin @('html-tailwind', 'shadcn') })
        $label = $label.Replace(' + Tailwind', ' + CSS propio')
    }
    if (-not $stacks.Count) { $stacks = @($fp.stacks[0]) }
    if (@($stacks).Count -eq @($fp.stacks).Count) { return @{ profile = $fp; source = 'default' } }
    return @{ profile = [pscustomobject]@{ label = $label; stacks = $stacks }; source = 'auto' }
}

function Read-Utf8 {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return '' }
    # Leer SIEMPRE como UTF-8 (PS 5.1 usa el codepage del sistema por defecto -> mojibake)
    [System.IO.File]::ReadAllText($Path, (New-Object System.Text.UTF8Encoding($false)))
}

function Read-Md { param([string]$Path) Read-Utf8 $Path }

function Ensure-Dir { param([string]$Path) if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null } }

function Resolve-GuideTarget {
    # Comun a los renderers que escriben una guia en la raiz (CLAUDE.md, AGENTS.md): si el proyecto ya
    # tiene la suya (sin nuestra marca), PREGUNTA antes de adaptarla. Con "si": respaldo en <base>.project.md
    # y el generado la referencia arriba (lo del proyecto MANDA). Con "no": la guia queda intacta y las
    # reglas van a <base>.dev-standards.md (decision persistente: si ese archivo existe, no se re-pregunta).
    # Devuelve @{ Target = ruta donde escribir; Rules = reglas con el puntero anadido si procede }.
    param([string]$ProjectPath, [string]$FileName, [string]$Rules, [string]$ImportSyntax = '')
    $main = Join-Path $ProjectPath $FileName
    $base = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
    $alt = Join-Path $ProjectPath "$base.dev-standards.md"
    $backupName = "$base.project.md"
    $backup = Join-Path $ProjectPath $backupName
    $target = $main
    if (Test-Path $alt) {
        $target = $alt
    } elseif (Test-Path $main) {
        $existing = Get-Content $main -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if ($existing -and $existing -notmatch 'GENERADO por dev-standards') {
            if (Ask-YesNo "Este proyecto ya tiene $FileName propio. ¿Respaldarlo en $backupName y referenciarlo desde el generado?" $true) {
                if (-not (Test-Path $backup)) { Write-Utf8 $backup $existing }
                Write-Host "  [guia]       $FileName respaldado en $backupName (referenciado desde el generado)"
            } else {
                $target = $alt
                Write-Host "  [guia]       $FileName intacto; reglas generadas en $base.dev-standards.md (referencialo tu desde $FileName si quieres cargarlas)"
            }
        }
    }
    if ($target -eq $main -and (Test-Path $backup)) {
        $head = if ($ImportSyntax) { $ImportSyntax } else { "LEE PRIMERO $backupName (guia propia de este proyecto) antes de aplicar lo de abajo." }
        $Rules = "$head`n`n> Este proyecto tiene guia PROPIA en ${backupName}: sus reglas especificas (dominio, comandos,`n> estructura) MANDAN sobre lo generico de este archivo cuando choquen.`n`n" + $Rules
    }
    return @{ Target = $target; Rules = $Rules }
}

function Ask-YesNo {
    # Pregunta interactiva con valor por defecto. En modo no interactivo (stdin redirigido, CI,
    # DEV_STANDARDS_ASSUME_YES=1) devuelve el default sin preguntar: sync/init nunca se cuelgan.
    param([string]$Message, [bool]$DefaultYes = $true)
    if ($env:DEV_STANDARDS_ASSUME_YES -eq '1') { return $DefaultYes }
    try { if ([Console]::IsInputRedirected) { return $DefaultYes } } catch { return $DefaultYes }
    $hint = if ($DefaultYes) { '[S/n]' } else { '[s/N]' }
    try { $r = Read-Host "$Message $hint" } catch { return $DefaultYes }
    if ([string]::IsNullOrWhiteSpace($r)) { return $DefaultYes }
    return ($r.Trim() -match '^(s|si|sí|y|yes)$')
}

function Write-Utf8 {
    param([string]$Path, [string]$Content)
    Ensure-Dir (Split-Path -Parent $Path)
    # UTF-8 sin BOM para máxima compatibilidad con las herramientas
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Copy-Tree {
    param([string]$Src, [string]$Dst)
    if (-not (Test-Path $Src)) { return }
    Ensure-Dir $Dst
    Copy-Item -Path (Join-Path $Src '*') -Destination $Dst -Recurse -Force
}

# Lista global de comandos denegados (capa simple de permisos).
function Get-BaseDeny {
    @(
        "Bash(git push:*)", "PowerShell(git push:*)",
        "Bash(git reset --hard:*)", "PowerShell(git reset --hard:*)",
        "Bash(git clean:*)",
        "Bash(rm -rf:*)", "PowerShell(Remove-Item * -Recurse -Force:*)",
        "Bash(npm publish:*)"
    )
}

# ---------------------------------------------------------------------------
# Skills: resolución (stack -> core/skills -> core/skills-vendor), bundles y overlay
# ---------------------------------------------------------------------------

function Get-Bundles {
    $p = Join-Path $script:StandardsRoot 'core\bundles.json'
    if (-not (Test-Path $p)) { return @{} }
    $obj = (Read-Utf8 $p) | ConvertFrom-Json
    $h = @{}
    foreach ($prop in $obj.PSObject.Properties) { if ($prop.Name -notlike '_*') { $h[$prop.Name] = @($prop.Value) } }
    return $h
}

# Expande nombres de bundles a skills (ignora desconocidos con aviso).
function Expand-Bundles {
    param([string[]]$Bundles = @())
    $b = Get-Bundles
    $out = @()
    foreach ($name in $Bundles) {
        if (-not $name) { continue }
        $k = $name.ToLower()
        if ($b.ContainsKey($k)) { $out += $b[$k] } else { Write-Warning "Bundle desconocido: $name (disponibles: $($b.Keys -join ', '))" }
    }
    return @($out | Select-Object -Unique)
}

# Cierre transitivo de dependencias (requires del registro): p. ej. front-activation -> ui-ux-pro-max.
function Expand-Requires {
    param([string[]]$Names)
    $out = New-Object System.Collections.Generic.List[string]
    $queue = New-Object System.Collections.Generic.Queue[string]
    foreach ($n in $Names) { if ($n) { $queue.Enqueue($n) } }
    while ($queue.Count) {
        $n = $queue.Dequeue()
        if ($out.Contains($n)) { continue }
        $out.Add($n)
        $e = $script:Registry.skills | Where-Object { $_.name -eq $n }
        if ($e) { foreach ($r in @($e.requires)) { if ($r -and -not $out.Contains($r)) { $queue.Enqueue($r) } } }
    }
    return @($out)
}

# Resuelve el nombre de una skill a su carpeta origen.
function Resolve-SkillDir {
    param([Parameter(Mandatory)]$Stack, [Parameter(Mandatory)][string]$Name)
    $root = $script:StandardsRoot
    $candidates = @(
        (Join-Path $Stack.Dir "skills\$Name"),
        (Join-Path $root "core\skills\$Name"),
        (Join-Path $root "core\skills-plugin\$Name"),
        (Join-Path $root "core\skills-vendor\$Name"),
        (Join-Path $Stack.Dir $Name),
        $Name
    )
    foreach ($c in $candidates) {
        if ((Test-Path $c) -and (Test-Path (Join-Path $c 'SKILL.md'))) { return (Resolve-Path $c).Path }
    }
    return $null
}

# Carpetas de skills a instalar para un stack:
#   - declaradas en stack.json -> "skills" (rutas relativas al stack, nombres o carpeta contenedora "skills")
#   - opcionales: -Skills (nombres) y -Bundles (expandidos con core\bundles.json)
$script:Nucleo = @('skill-router', 'project-planner', 'devlog', 'code-quality')   # va siempre, con cualquier seleccion

function Get-SkillDirs {
    param([Parameter(Mandatory)]$Stack, [string[]]$Extra = @(), [string[]]$Bundles = @())
    $dirs = New-Object System.Collections.Generic.List[string]
    # Seleccion guardada en el marcador (instalador interactivo de init.mjs): categorias o a medida.
    $sel = $Stack.PSObject.Properties['Selection']
    if ($sel -and $sel.Value -and $sel.Value.modo -in @('categorias', 'a-medida')) {
        $s = $sel.Value
        $elegidas = if ($s.modo -eq 'categorias') {
            @($script:Registry.skills | Where-Object { @($s.grupos) -contains $_.group } | ForEach-Object { $_.name })
        } else { @($s.skills) }
        foreach ($e in (Expand-Requires -Names (@($script:Nucleo) + $elegidas + @($Extra) + (Expand-Bundles -Bundles $Bundles)))) {
            if (-not $e) { continue }
            $d = Resolve-SkillDir -Stack $Stack -Name $e
            if ($d) { if (-not $dirs.Contains($d)) { $dirs.Add($d) } } else { Write-Warning "Skill '$e' no encontrada. Ignorada." }
        }
        return @($dirs)
    }
    $declared = @()
    if ($Stack.Meta.skills) { $declared = @($Stack.Meta.skills) }
    foreach ($s in $declared) {
        $p = if ([System.IO.Path]::IsPathRooted($s)) { $s } else { Join-Path $Stack.Dir $s }
        if (Test-Path $p) {
            if (Test-Path (Join-Path $p 'SKILL.md')) { $dirs.Add((Resolve-Path $p).Path); continue }
            Get-ChildItem $p -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') } |
                ForEach-Object { $dirs.Add($_.FullName) }
            continue
        }
        if ($s -eq 'skills') { continue }   # carpeta convencional stacks\<x>\skills\ aún sin crear: silencio
        $d = Resolve-SkillDir -Stack $Stack -Name $s
        if ($d) { $dirs.Add($d) } else { Write-Warning "Skill '$s' declarada en stack.json no encontrada. Ignorada." }
    }
    $wanted = Expand-Requires -Names (@($Extra) + (Expand-Bundles -Bundles $Bundles))
    foreach ($e in $wanted) {
        if (-not $e) { continue }
        $d = Resolve-SkillDir -Stack $Stack -Name $e
        if ($d) { $dirs.Add($d) } else { Write-Warning "Skill opcional '$e' no encontrada (core\skills, core\skills-vendor o stacks\$($Stack.Name)\skills). Ignorada." }
    }
    return @($dirs | Select-Object -Unique)
}

# Anexa las filas de <stack>.extra.csv (overlay) al <stack>.csv ya copiado.
function Merge-ExtraCsv {
    param([string]$SkillDst, [string]$OverlayDir)
    $extraDir = Join-Path $OverlayDir 'data\stacks'
    if (-not (Test-Path $extraDir)) { return }
    Get-ChildItem $extraDir -Filter '*.extra.csv' | ForEach-Object {
        $target = Join-Path $SkillDst ('data\stacks\' + ($_.Name -replace '\.extra\.csv$', '.csv'))
        if (-not (Test-Path $target)) { Write-Warning "extra.csv sin CSV upstream: $($_.Name)"; return }
        $base  = Read-Utf8 $target
        $extra = Read-Utf8 $_.FullName
        $extraLines = $extra -split "`r?`n" | Select-Object -Skip 1 | Where-Object { $_ -ne '' }
        if (-not $base.EndsWith("`n")) { $base += "`n" }
        Write-Utf8 $target ($base + ($extraLines -join "`n") + "`n")
        Remove-Item (Join-Path $SkillDst ('data\stacks\' + $_.Name)) -ErrorAction SilentlyContinue
    }
}

# Copia cada skill a <Dst>\<nombre>\ y aplica encima core\skills-overlay\<nombre>\ (si existe).
# Si el overlay trae SKILL.md, el original se conserva como SKILL.upstream.md.
function Copy-Skills {
    param([Parameter(Mandatory)]$Stack, [Parameter(Mandatory)][string]$Dst, [string[]]$Extra = @(), [string[]]$Bundles = @())
    $root = $script:StandardsRoot
    $dirs = Get-SkillDirs -Stack $Stack -Extra $Extra -Bundles $Bundles
    Ensure-Dir $Dst
    # Quitar skills de dev-standards que ya no estan seleccionadas (las propias del proyecto no se tocan)
    $elegidas = @($dirs | ForEach-Object { Split-Path $_ -Leaf })
    foreach ($sk in $script:Registry.skills) {
        if ($elegidas -notcontains $sk.name) { $p = Join-Path $Dst $sk.name; if (Test-Path $p) { Remove-Item $p -Recurse -Force } }
    }
    foreach ($d in $dirs) {
        $name = Split-Path $d -Leaf
        $skillDst = Join-Path $Dst $name
        if (Test-Path $skillDst) { Remove-Item $skillDst -Recurse -Force }
        Copy-Tree $d $skillDst
        $overlay = Join-Path $root "core\skills-overlay\$name"
        if (Test-Path $overlay) {
            if ((Test-Path (Join-Path $overlay 'SKILL.md')) -and (Test-Path (Join-Path $skillDst 'SKILL.md'))) {
                Move-Item (Join-Path $skillDst 'SKILL.md') (Join-Path $skillDst 'SKILL.upstream.md') -Force
            }
            Copy-Tree $overlay $skillDst
            Merge-ExtraCsv -SkillDst $skillDst -OverlayDir $overlay
        }
    }
    return @($dirs | ForEach-Object { Split-Path $_ -Leaf })
}

# Resuelve una skill por nombre SIN stack (core\skills -> core\skills-vendor).
function Resolve-SkillDirGlobal {
    param([Parameter(Mandatory)][string]$Name)
    $root = $script:StandardsRoot
    foreach ($c in @((Join-Path $root "core\skills\$Name"), (Join-Path $root "core\skills-plugin\$Name"), (Join-Path $root "core\skills-vendor\$Name"))) {
        if (Test-Path (Join-Path $c 'SKILL.md')) { return (Resolve-Path $c).Path }
    }
    return $null
}

# Copia UNA skill (vendor/core + overlay + extra.csv) a <Dst>\<nombre>. Devuelve la ruta o $null.
function Copy-SkillByName {
    param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][string]$Dst)
    $src = Resolve-SkillDirGlobal -Name $Name
    if (-not $src) { Write-Warning "Skill '$Name' no encontrada en core\skills ni core\skills-vendor."; return $null }
    $skillDst = Join-Path $Dst $Name
    if (Test-Path $skillDst) { Remove-Item $skillDst -Recurse -Force }
    Copy-Tree $src $skillDst
    $overlay = Join-Path $script:StandardsRoot "core\skills-overlay\$Name"
    if (Test-Path $overlay) {
        if ((Test-Path (Join-Path $overlay 'SKILL.md')) -and (Test-Path (Join-Path $skillDst 'SKILL.md'))) {
            Move-Item (Join-Path $skillDst 'SKILL.md') (Join-Path $skillDst 'SKILL.upstream.md') -Force
        }
        Copy-Tree $overlay $skillDst
        Merge-ExtraCsv -SkillDst $skillDst -OverlayDir $overlay
    }
    return $skillDst
}

# Lee name/description del SKILL.md efectivo (overlay si existe, si no el original).
function Get-SkillMeta {
    param([string]$Dir)
    $name = Split-Path $Dir -Leaf
    $overlay = Join-Path $script:StandardsRoot "core\skills-overlay\$name\SKILL.md"
    $file = if (Test-Path $overlay) { $overlay } else { Join-Path $Dir 'SKILL.md' }
    $txt = Read-Utf8 $file
    $desc = ''
    if ($txt -match '(?m)^name:\s*"?([^"\r\n]+)"?\s*$')     { $name = $Matches[1].Trim() }
    if ($txt -match '(?m)^description:\s*"?(.+?)"?\s*$')    { $desc = $Matches[1].Trim() }
    [pscustomobject]@{ Name = $name; Description = $desc }
}

# Bloque "Skills disponibles" (para todas las herramientas; Codex/GPT no tiene otra vía de descubrimiento que las reglas).
function Get-SkillsSection {
    param([Parameter(Mandatory)]$Stack, [string[]]$Extra = @(), [string[]]$Bundles = @(), [string]$RelPath = '.claude/skills')
    $dirs = Get-SkillDirs -Stack $Stack -Extra $Extra -Bundles $Bundles
    if (-not $dirs -or $dirs.Count -eq 0) { return '' }
    $lines = @("`n---`n`n# Skills disponibles en este proyecto`n",
               'Cada skill es una carpeta con `SKILL.md` (instrucciones), `references/`, `scripts/` y `templates/`.',
               ('Cuando la tarea encaje con la descripción, **lee su `SKILL.md` completo antes de actuar** y sigue su flujo. ' +
                'En Codex puedes invocarla explícitamente con `$<nombre>`.' + "`n"))
    foreach ($d in $dirs) {
        $m = Get-SkillMeta $d
        $short = if ($m.Description.Length -gt 200) { $m.Description.Substring(0, 197) + '...' } else { $m.Description }
        $lines += ('- **{0}** (`{1}/{0}/SKILL.md`): {2}' -f $m.Name, $RelPath, $short)
    }
    return ($lines -join "`n") + "`n"
}

# Registro único de skills (core\skills-registry.json): grupo, cuándo, keywords, prioridad, dependencias.
function Get-SkillRegistry {
    $p = Join-Path $script:StandardsRoot 'core\skills-registry.json'
    if (-not (Test-Path $p)) { throw "Falta core\skills-registry.json" }
    return ((Read-Utf8 $p) | ConvertFrom-Json)
}
$script:Registry = Get-SkillRegistry
$script:FrontGroups = @('front', 'motion', '3d', 'design')
$script:CoreGroups  = @('planning', 'routing', 'quality', 'architecture', 'growth', 'ops', 'docs')

# Protocolo de carga (texto común)
$script:LoadProtocol = @(
    '**Protocolo de carga de contexto:** lee una sola skill por tarea (dos si cruza UI + lógica) y, dentro, solo la sección o referencia',
    'que indique su tabla "Lectura mínima por tarea". `SKILL.upstream.md` y `references/` se leen por secciones (Read con offset/limit o Grep),',
    'nunca enteros. No releas lo ya leído. Si la skill necesaria no está instalada, dilo y propón instalarla; no improvises esa librería.'
) -join "`n"

function Get-ActivationRows {
    param([string[]]$Installed, [string]$RelPath, [string[]]$Groups)
    $rows = @()
    # Orden determinista (prioridad desc, nombre asc): Sort-Object de PS 5.1 es inestable en empates y
    # la suite de paridad con init.mjs exige salida identica.
    foreach ($sk in ($script:Registry.skills | Sort-Object -Property @{Expression={$_.priority}; Descending=$true}, @{Expression={$_.name}})) {
        if ($Groups -notcontains $sk.group) { continue }
        if ($Installed -contains $sk.name) { $rows += ('| {0} | `{1}/{2}/SKILL.md` |' -f $sk.when, $RelPath, $sk.name) }
    }
    return $rows
}

# Bloques "# Planificación y calidad" (siempre) y "# Front y diseño" (si hay frontProfile o alguna skill de front instalada).
function Get-ActivationSection {
    param([Parameter(Mandatory)]$Stack, [string[]]$Extra = @(), [string[]]$Bundles = @(), [string]$RelPath = '.claude/skills')
    $installed = @(Get-SkillDirs -Stack $Stack -Extra $Extra -Bundles $Bundles | ForEach-Object { Split-Path $_ -Leaf })
    $L = @()

    # --- Planificación y calidad ---
    $core = Get-ActivationRows -Installed $installed -RelPath $RelPath -Groups $script:CoreGroups
    if ($core.Count) {
        $L += "`n---`n`n# Planificación y calidad`n"
        if ($installed -contains 'project-planner') {
            $L += '**Plan del proyecto:** si existe `plan/PLAN.md`, es la fuente de verdad de qué se hace ahora: elige la tarea `doing` o la primera `todo` y sigue su tarjeta (skill + sección, hecho cuando, verificar). Si no existe y la petición es un proyecto o feature (no un arreglo puntual), crea el plan con la skill `project-planner` antes de codificar.'
            $L += ''
        }
        $L += $script:LoadProtocol
        $L += ''
        $L += '| Si la tarea implica… | Lee antes |'
        $L += '|---|---|'
        $L += $core
        if ($installed -notcontains 'ddd-hexagonal') {
            $L += ''
            $L += 'Para dominios complejos (reglas de negocio ricas, varios contextos) existe la skill opcional `ddd-hexagonal`: pídeme instalarla con `sync.ps1 -Bundle architecture`.'
        }
    }

    # --- Front y diseño ---
    $fp = $Stack.Meta.frontProfile
    $frontInstalled = @($script:Registry.skills | Where-Object { $script:FrontGroups -contains $_.group -and $installed -contains $_.name })
    if ($fp -or $frontInstalled.Count) {
        $L += "`n---`n`n# Front y diseño" + $(if ($fp) { " (perfil: $($fp.label))" } else { '' }) + "`n"
        if ($fp) {
            $stacks = @($fp.stacks); $primary = $stacks[0]
            $L += "Este proyecto es de **$($fp.label)**. Para cualquier trabajo de UI se aplica la skill ``ui-ux-pro-max`` con estos stacks del"
            $L += "buscador, en este orden de prioridad: " + (($stacks | ForEach-Object { '`' + $_ + '`' }) -join ', ') + '.'
            $L += ''
            $L += '**Antes de crear o editar UI** (páginas, componentes, estilos, layouts, formularios):'
            $L += "1. Lee ``$RelPath/ui-ux-pro-max/SKILL.md`` (flujo, perfiles y reglas duras) si aún no lo has hecho en esta sesión; solo su tabla de lectura mínima te dirá qué referencia abrir."
            $L += '2. Si existe `design-system/*/MASTER.md`, es la fuente de verdad de estilo, color y tipografía. Si no existe, genéralo (y si hay plan, es la primera tarjeta de UI):'
            $L += '   ```bash'
            $L += "   python3 $RelPath/ui-ux-pro-max/scripts/search.py `"<producto industria keywords>`" --design-system -p `"<Proyecto>`" --persist -o ."
            $L += "   # Windows: py -3 $RelPath/ui-ux-pro-max/scripts/search.py ..."
            $L += '   ```'
            $L += "3. Guías del stack: ``python3 $RelPath/ui-ux-pro-max/scripts/search.py `"<tema>`" --stack $primary`` (y el resto de stacks del perfil si aplica)."
            $L += '4. Antes de entregar, pasa el checklist de `references/pro-rules.md` (contraste, teclado, 375/768/1440 px, estados, reduced-motion, sin emojis como iconos).'
            $L += ''
        } else {
            $L += 'Este stack no tiene perfil de front, pero hay skills de front/animación/3D instaladas. Detecta el stack de UI como indica `skill-router` antes de usarlas.'
            $L += ''
        }
        $L += '## Activación de skills de front (lee el SKILL.md indicado ANTES de actuar)'
        $L += ''
        $L += '| Si la tarea implica… | Skill |'
        $L += '|---|---|'
        $L += (Get-ActivationRows -Installed $installed -RelPath $RelPath -Groups $script:FrontGroups)
        $notInstalled = @($script:Registry.skills | Where-Object { $installed -notcontains $_.name -and $_.name -in @('gsap-scrolltrigger','threejs-webgl','react-three-fiber','motion-framer') } | ForEach-Object { $_.name })
        if ($notInstalled.Count) {
            $L += ''
            $L += "Skills opcionales NO instaladas en este proyecto: " + (($notInstalled | ForEach-Object { '`' + $_ + '`' }) -join ', ') +
                  ". Si la tarea las necesita, pídeme instalarlas con ``sync.ps1 -Skills <nombre>`` o ``-Bundle core-3d-animation``; no improvises esas librerías sin su skill."
        }
    }
    if ($L.Count -eq 0) { return '' }
    return ($L -join "`n") + "`n"
}

# Bloque "# Sesión y comandos": paridad para herramientas sin hooks (Codex/Cursor/Windsurf) y comandos del stack.
function Get-SessionSection {
    param([Parameter(Mandatory)]$Stack)
    $L = @("`n---`n`n# Sesión y comandos del proyecto`n")
    $L += '**Al iniciar cada sesión** (si no hay hooks que lo hagan por ti, hazlo tú): ejecuta y lee `git status -sb`, `git log --oneline -5`,'
    $L += 'la cabecera y la fase activa de `plan/PLAN.md` (si existe) y `devlog/<hoy>/` + última entrada de `devlog/INDEX.md`. No commitees en `main`/`master`/`develop`.'
    $L += '**Al cerrar**: tarea del plan actualizada (`done` con enlace al devlog), devlog del día escrito, siguiente tarea propuesta.'
    $cmds = $Stack.Meta.commands
    if ($cmds) {
        $L += ''
        $L += '**Comandos del stack** (úsalos para verificar antes de decir "hecho" y pega su salida):'
        $L += ''
        $L += '| Acción | Comando |'
        $L += '|---|---|'
        foreach ($prop in $cmds.PSObject.Properties) { $L += ('| {0} | `{1}` |' -f $prop.Name, $prop.Value) }
    }
    return ($L -join "`n") + "`n"
}

# Construye el bloque de reglas combinado (base + metodología + stack + front + skills).
# Modo ahorro (opcional, solo en CLAUDE.md): mismo texto EXACTO que init.mjs (la suite de paridad lo compara).
$script:AhorroDevlog = 'Documenta cada paso relevante en `devlog/<fecha>/NNN-slug.md` con la skill `devlog` (numeración global e INDEX.md al día). El hook stop-guard lo exige al cerrar la tarea.' + "`n"
$script:AhorroGit = 'Una rama por tarea (nunca commits en main, master ni develop), Conventional Commits de 72 caracteres como máximo y sin co-autores, y nunca `git push` sin aprobación explícita. El hook guard lo hace cumplir.' + "`n"
$script:AhorroEstilo = "`n---`n`n# Modo ahorro`n`n" + 'Respuestas técnicas en estilo telegráfico: sin preámbulos ni resúmenes repetidos, frases cortas, primero el resultado y el código. Excepciones, en lenguaje normal y completo: `/brief`, `/propuestas`, `/repaso`, `/estimar` y `/entregar`, cualquier texto para el cliente y cualquier explicación que pida el usuario. Las skills cargan sus descripciones solas: abre solo la sección que necesites.' + "`n"

function Get-CombinedRules {
    param([Parameter(Mandatory)]$Stack, [string[]]$ExtraSkills = @(), [string[]]$Bundles = @(), [string]$SkillsRelPath = '.claude/skills')
    $root = $script:StandardsRoot
    $sd   = $Stack.Dir
    $ahProp = $Stack.PSObject.Properties['Ahorro']
    $ahorro = ($ahProp -and $ahProp.Value) -and ($SkillsRelPath -eq '.claude/skills')
    $parts = @(
        (Read-Md (Join-Path $root 'core\prompts\base-systemprompt.md')),
        "`n---`n`n# Acciones prohibidas (global)`n",
        (Read-Md (Join-Path $root 'core\methodology\prohibited-actions.md')),
        "`n---`n`n# Metodología de devlog`n",
        $(if ($ahorro) { $script:AhorroDevlog } else { Read-Md (Join-Path $root 'core\methodology\devlog.md') }),
        "`n---`n`n# Flujo de Git`n",
        $(if ($ahorro) { $script:AhorroGit } else { Read-Md (Join-Path $root 'core\methodology\git-workflow.md') }),
        "`n---`n",
        (Read-Md (Join-Path $sd $Stack.Meta.systemprompt)),
        "`n---`n`n# Mejores prácticas del stack`n",
        (Read-Md (Join-Path $sd $Stack.Meta.bestPractices)),
        "`n---`n`n# Prohibiciones del stack`n",
        (Read-Md (Join-Path $sd $Stack.Meta.prohibited))
    )
    # Reglas aprendidas: cualquier stacks\<stack>\rules\*.md (menos README) se anexa; el agente puede
    # añadir reglas nuevas ahi y correr sync.ps1 para propagarlas a todos los proyectos del stack.
    $rulesDir = Join-Path $sd 'rules'
    if (Test-Path $rulesDir) {
        $ruleFiles = Get-ChildItem $rulesDir -Filter '*.md' | Where-Object { $_.Name -ne 'README.md' } | Sort-Object Name
        foreach ($rf in $ruleFiles) {
            $parts += "`n---`n`n# Reglas aprendidas: $($rf.BaseName)`n"
            $parts += (Read-Md $rf.FullName)
        }
    }
    $header = "<!-- GENERADO por dev-standards. NO editar a mano: edita stacks\$($Stack.Name)\ y corre sync.ps1. Stack: $($Stack.Name) -->`n`n"
    $header + ($parts -join "`n") +
        (Get-ActivationSection -Stack $Stack -Extra $ExtraSkills -Bundles $Bundles -RelPath $SkillsRelPath) +
        (Get-SessionSection -Stack $Stack) +
        $(if ($ahorro) { $script:AhorroEstilo } else { Get-SkillsSection -Stack $Stack -Extra $ExtraSkills -Bundles $Bundles -RelPath $SkillsRelPath })
}
