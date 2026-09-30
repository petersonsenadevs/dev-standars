#requires -Version 5.1
<#
.SYNOPSIS
  Genera la documentacion derivada de las fuentes de verdad (registro, core\commands, core\hooks, stacks\):
    - docs\skills.md    (las 41 skills por grupo, con enrutamiento)
    - docs\comandos.md  (los comandos slash con flujos tipicos)
    - docs\hooks.md     (muros y hooks, con escapes)
    - docs\stacks.md    (stacks, perfiles de front, bundles)
    - REFERENCIA.md     (todo lo anterior en UNA pagina)
.DESCRIPTION
  El README es el hub que enlaza estos docs. Se regeneran en el pre-commit (como plugins/):
  editar las fuentes, nunca estos archivos a mano.
#>
. (Join-Path $PSScriptRoot '_lib.ps1')
$root = Get-StandardsRoot
Ensure-Dir (Join-Path $root 'docs')

function Clean-Keywords([string]$k, [int]$Max = 8) {
    # Convierte la regex de keywords en una muestra legible de señales ("landing, web, hero, ...").
    if (-not $k) { return '' }
    $s = $k -replace '\(\?i\)', '' -replace '\\b', ''
    $s = $s.Trim()
    if ($s.StartsWith('(') -and $s.EndsWith(')')) { $s = $s.Substring(1, $s.Length - 2) }
    # colapsar grupos anidados a su primera alternativa: test(s|ing|ea)? -> tests · revis(a|ar|ion) -> revisa
    for ($i = 0; $i -lt 3; $i++) { $s = $s -replace '\(([^()|]*)\|[^()]*\)\??', '$1' }
    $clean = @(); $parts = @($s -split '\|')
    foreach ($p in $parts) {
        $t = $p -replace '\(\?[=!][^\)]*\)', '' -replace '\[([a-zA-Z0-9áéíóúñ])[^\]]*\]', '$1' -replace '\\w\*?', '' -replace '\\s\+?', ' ' -replace '\\[.d]\+?', ' ' -replace '[\\^\$\(\)\?\:\+\*\{\}]', ''
        $t = ($t -replace '\s+', ' ').Trim(' ', ',', '.')
        if ($t -and $t.Length -ge 3 -and $t.Length -le 28 -and $clean -notcontains $t) { $clean += $t }
        if ($clean.Count -ge $Max) { break }
    }
    return ($clean -join ', ') + $(if ($parts.Count -gt $Max) { '…' } else { '' })
}

$GEN = '<!-- GENERADO por tools/build-docs.ps1 desde core/skills-registry.json, core/commands/, core/hooks/ y stacks/. NO editar a mano. -->'

# ============================================================ SKILLS + ENRUTAMIENTO
function Get-SkillsBody {
    $L = New-Object System.Collections.Generic.List[string]
    $L.Add('El agente decide solo, en tres capas automáticas:')
    $L.Add('1. **Al arrancar la sesión** (hook SessionStart): estado del proyecto (stack, versiones+EOL, si es nuevo o')
    $L.Add('   existente, design system, plan, devlog, convenciones) + puertas de entrada: UI → `ui-ux-pro-max` ·')
    $L.Add('   lógica → `code-quality` · proyecto nuevo → `project-planner` · duda → `skill-router`.')
    $L.Add('2. **En cada petición** (hook UserPromptSubmit): las *señales* de las tablas de abajo sugieren la skill')
    $L.Add('   (máx. 2, una vez por skill y sesión). Los *entrypoints* van primero; a igual match gana la prioridad mayor.')
    $L.Add('3. **Tablas de activación** (`skill-router` y `front-activation`, generadas del registro): el agente las')
    $L.Add('   consulta cuando duda; `references/decision-trees.md` tiene los árboles de decisión completos.')
    $L.Add('')
    $total = @($script:Registry.skills).Count
    $L.Add(('Total: **{0} skills**. Fuente única: `core/skills-registry.json` (grupo, cuándo, señales, prioridad, dependencias).' -f $total))
    $L.Add('')
    foreach ($g in @($script:Registry.groups.PSObject.Properties.Name)) {
        $skills = @($script:Registry.skills | Where-Object { $_.group -eq $g } | Sort-Object -Property @{Expression = { [bool]$_.entrypoint }; Descending = $true }, @{Expression = { $_.priority }; Descending = $true }, name)
        if (-not $skills.Count) { continue }
        $label = $script:Registry.groups.$g
        $L.Add(('### {0} (grupo `{1}`, {2} skill{3})' -f $label, $g, $skills.Count, $(if ($skills.Count -eq 1) { '' } else { 's' })))
        $L.Add('')
        $L.Add('| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |')
        $L.Add('|---|---|---|---|')
        foreach ($s in $skills) {
            $name = if ($s.entrypoint) { "**``$($s.name)``** (entrada)" } else { "``$($s.name)``" }
            $L.Add("| $name | $($s.priority) | $($s.when) | $(Clean-Keywords $s.keywords) |")
        }
        $L.Add('')
    }
    return $L
}

# ============================================================ COMANDOS
function Get-CommandsBody {
    $L = New-Object System.Collections.Generic.List[string]
    $L.Add('Atajos opcionales: hablar en llano activa lo mismo vía enrutador. `plan/siguiente/verificar/desplegar/adoptar`')
    $L.Add('se instalan SIEMPRE; el resto solo en stacks con perfil de front.')
    $L.Add('')
    $L.Add('| Comando | Argumento | Qué hace |')
    $L.Add('|---|---|---|')
    $always = @('plan', 'siguiente', 'verificar', 'desplegar', 'adoptar')
    $cmds = Get-ChildItem (Join-Path $root 'core\commands') -Filter *.md | Sort-Object { $always.IndexOf($_.BaseName) -lt 0 }, { $always.IndexOf($_.BaseName) }, Name
    foreach ($f in $cmds) {
        $txt = Read-Utf8 $f.FullName
        $desc = ''; $hint = ''
        if ($txt -match '(?s)^---(.*?)---') {
            $fmBlock = $Matches[1]
            if ($fmBlock -match '(?m)^description:\s*(.+)$') { $desc = $Matches[1].Trim() }
        }
        # La pista de uso vive en la linea "Uso: `/cmd <args>`" (sin argument-hint: Codex no migra comandos con argumentos)
        if ($txt -match '(?m)^Uso: `/\S+\s*([^`]*)`') { $hint = $Matches[1].Trim()
        }
        $L.Add("| ``/$($f.BaseName)`` | $hint | $desc |")
    }
    $L.Add('')
    $L.Add('### Flujos típicos')
    $L.Add('- **Proyecto nuevo con web**: `/brief` (entrevista en llano) → `/propuestas` (blueprint + maquetas A/B) →')
    $L.Add('  `/design-system` → construir con checkpoints → `/revisar-ui` → `/lanzar` → `/desplegar`.')
    $L.Add('- **Cualquier feature**: `/plan` → `/siguiente` (una tarjeta cada vez) → `/verificar` antes de cerrar.')
    $L.Add('- **Proyecto heredado**: `/adoptar` la primera sesión (analiza y sella sus convenciones) y después lo normal.')
    $L.Add('- **Efecto concreto** ("quiero un parallax/marquee/cursor"): `/efecto <nombre>` va directo al catálogo con receta y coste móvil.')
    return $L
}

# ============================================================ HOOKS / MUROS
function Get-HooksBody {
    $L = New-Object System.Collections.Generic.List[string]
    $L.Add('Hooks en Node (`.mjs`, agnósticos de OS: funcionan igual en Windows/macOS/Linux). Los que BLOQUEAN salen')
    $L.Add('con exit 2 y el motivo; el resto solo informa. Solo Claude Code ejecuta hooks: en Codex/Cursor/Windsurf el')
    $L.Add('trabajo lo hacen las tablas de activación de las reglas generadas y los githooks (`sync.ps1 -GitHooks`).')
    $L.Add('')
    $hookInfo = [ordered]@{
        'session-start.mjs'        = @('SessionStart', 'Inyecta estado: stack/perfil, si el proyecto es NUEVO (→ /brief + /plan) o EXISTENTE (→ /adoptar), diario propio detectado, versiones con aviso EOL, convenciones adoptadas, git, design system, plan, devlog y protocolo de skills.')
        'prompt-router.mjs'        = @('UserPromptSubmit', 'Sugiere la skill que encaja con la petición (señales de docs/skills.md), una vez por skill y sesión.')
        'guard.mjs'                = @('PreToolUse Bash/PowerShell', 'BLOQUEA: git push, destructivos de BD/git, rm -rf, deploy a prod sin aprobación (escape `DEV_STANDARDS_ALLOW_DEPLOY=1`), jQuery/Bootstrap (`DEV_STANDARDS_ALLOW_LIB=1`), devops peligroso (curl\|bash, chmod 777, dd, mkfs, docker prune, parar servicios, vaciar firewall, crontab -r); commits: rama protegida, Conventional ≤72, sin co-autores.')
        'protect-files.mjs'        = @('PreToolUse Edit/Write', 'BLOQUEA editar: generados por dev-standards, secretos (.env, *.pem, credentials), dependencias/artefactos, migraciones versionadas, conventions.md/json sellados y `protectedPaths` del proyecto.')
        'secrets-guard.mjs'        = @('PreToolUse Edit/Write', 'BLOQUEA escribir credenciales reales (AWS, GitHub, Stripe, OpenAI/Anthropic, PEM, JWT, cadenas con password); ignora placeholders.')
        'code-hygiene.mjs'         = @('PreToolUse Edit/Write', 'BLOQUEA introducir: console.log/debugger/dd()/var_dump/ray, términos vetados en `gustos.md` §No, marcadores de conflicto de git, `.only`/`.skip`/xit en tests, y la lista negra anti-IA (badges de disponibilidad, numeración de secciones). Escape puntual: comentario `dev-standards-allow`.')
        'conventions-guard.mjs'    = @('PreToolUse Edit/Write', 'BLOQUEA código que viole las reglas ejecutables de `conventions.json` (/adoptar): la convención del proyecto gana.')
        'backend-guard.mjs'        = @('PreToolUse Edit/Write', 'BLOQUEA introducir: migraciones destructivas en la parte que se aplica (borrar o renombrar columnas o tablas: patrón expandir → contraer), `env()` fuera de `config/` en Laravel, y datos personales en logs (request completa, cuerpos, contraseñas o tokens). Escape: `dev-standards-allow` con el motivo.')
        'back-skill-reminder.mjs'  = @('PreToolUse Edit/Write (backend)', 'Primera edición de backend en la sesión: recuerda la receta del stack, las convenciones selladas y la versión real del framework. No bloquea.')
        'depurar-coach.mjs'        = @('PostToolUse Bash/PowerShell', 'Si falla un test, build o verificación, activa el método de la skill depurar (reproducir, test que falla, hipótesis, acotar, arreglar la causa). Como mucho una vez cada 20 minutos.')
        'front-skill-reminder.mjs' = @('PreToolUse Edit/Write (front)', 'Primera edición de UI: BLOQUEA una vez si no hay design system NI brief (obliga a preguntar); después recuerda ui-ux-pro-max, el set de iconos del MASTER y las reglas duras de UI.')
        'format-on-save.mjs'       = @('PostToolUse', 'Formatea el archivo guardado con la herramienta del stack (Pint/Prettier/ruff) si existe. Nunca bloquea.')
        'edit-tracker.mjs'         = @('PostToolUse', 'Marca que se editó código; stop-guard exige verificación posterior.')
        'stop-guard.mjs'           = @('Stop', 'BLOQUEA el cierre (una vez) si falta: devlog del día, verify-build tras editar código, o ui-verify móvil tras tocar UI.')
        'pre-compact.mjs'          = @('PreCompact', 'Re-inyecta lo esencial (stack, versiones, design system, plan, reglas) para sobrevivir a la compactación de contexto.')
        'session-end.mjs'          = @('SessionEnd', 'Limpia los marcadores de sesión.')
        'lib.mjs'                  = $null
    }
    $L.Add('| Hook | Evento | Qué hace |')
    $L.Add('|---|---|---|')
    foreach ($f in (Get-ChildItem (Join-Path $root 'core\hooks') -Filter *.mjs | Sort-Object { @($hookInfo.Keys).IndexOf($_.Name) })) {
        if (-not $hookInfo.Contains($f.Name)) { throw "build-docs: hook '$($f.Name)' sin descripcion en hookInfo (añadela)" }
        $info = $hookInfo[$f.Name]
        if ($null -eq $info) { continue }   # lib.mjs
        $L.Add("| ``$($f.Name)`` | $($info[0]) | $($info[1]) |")
    }
    $L.Add('')
    $L.Add('### Escapes (siempre con aprobación explícita del usuario, documentada en el devlog)')
    $L.Add('- `DEV_STANDARDS_ALLOW_DEPLOY=1` — deploy a producción tras la aprobación del checklist `/desplegar`.')
    $L.Add('- `DEV_STANDARDS_ALLOW_LIB=1` — instalar una librería vetada (jQuery/Bootstrap) si el usuario lo pide.')
    $L.Add('- Comentario `dev-standards-allow` en la línea — excepción puntual de code-hygiene (script CLI con console.log, test .skip justificado, patrón anti-IA pedido por su nombre).')
    $L.Add('- Convenciones selladas: se cambian borrando `conventions.*` y re-ejecutando `/adoptar` (decisión del usuario).')
    return $L
}

# ============================================================ STACKS Y BUNDLES
function Get-StacksBody {
    $L = New-Object System.Collections.Generic.List[string]
    $L.Add('Cada stack define systemprompt evolutivo, mejores prácticas, prohibiciones, comandos de verificación,')
    $L.Add('formateadores, permisos y (en los de front) el perfil del buscador de diseño. `init-project.ps1 -Stack <n>`.')
    $L.Add('')
    $L.Add('| Stack | Qué es | Perfil de front |')
    $L.Add('|---|---|---|')
    foreach ($d in (Get-ChildItem (Join-Path $root 'stacks') -Directory | Sort-Object Name)) {
        $meta = (Read-Utf8 (Join-Path $d.FullName 'stack.json')) | ConvertFrom-Json
        $fp = if ($meta.frontProfile) { $meta.frontProfile.label } else { '— (backend)' }
        $L.Add("| ``$($d.Name)`` | $($meta.label) | $fp |")
    }
    $L.Add('')
    $L.Add('Lenguajes sin stack propio (referencias de `code-quality`, el router los enruta igual): **Go** (`go.md`),')
    $L.Add('**Java/Spring** (`java.md`), **C#/.NET** (`csharp.md`).')
    $L.Add('')
    $bundles = Get-Bundles
    $L.Add('### Bundles opcionales (`sync.ps1 -Bundle <nombre>` o plugin `bundle-<nombre>`)')
    $L.Add('')
    $L.Add('| Bundle | Skills |')
    $L.Add('|---|---|')
    foreach ($b in ($bundles.Keys | Sort-Object)) { $L.Add("| ``$b`` | $(@($bundles[$b]) -join ', ') |") }
    return $L
}

# ============================================================ EMISION
function Emit([string]$Path, [string]$Title, [string]$Intro, $Body) {
    $L = New-Object System.Collections.Generic.List[string]
    $L.Add($GEN); $L.Add(''); $L.Add("# $Title"); $L.Add('')
    if ($Intro) { $L.Add($Intro); $L.Add('') }
    foreach ($x in $Body) { $L.Add($x) }
    Write-Utf8 (Join-Path $root $Path) ($L -join "`n")
    Write-Host "  [docs] $Path"
}

$skillsBody = Get-SkillsBody
$cmdsBody = Get-CommandsBody
$hooksBody = Get-HooksBody
$stacksBody = Get-StacksBody
$volver = '[← Volver al README](../README.md)'

Emit 'docs\skills.md' 'Skills y enrutamiento' "$volver`n`nQué skill existe, cuándo salta cada una y con qué señales. Las de terceros van vendorizadas con capa propia en español (ver [arquitectura](arquitectura.md))." $skillsBody
Emit 'docs\comandos.md' 'Comandos slash' "$volver" $cmdsBody
Emit 'docs\hooks.md' 'Muros y hooks' "$volver`n`nLo que el agente NO puede hacer aunque quiera — y lo que se le recuerda solo." $hooksBody
Emit 'docs\stacks.md' 'Stacks y bundles' "$volver" $stacksBody

# REFERENCIA.md: todo en una pagina (para leer del tiron o imprimir)
$R = New-Object System.Collections.Generic.List[string]
$R.Add($GEN); $R.Add(''); $R.Add('# Referencia completa de dev-standards'); $R.Add('')
$R.Add('Todo el catálogo en una página. Por temas: [skills](docs/skills.md) · [comandos](docs/comandos.md) · [hooks](docs/hooks.md) · [stacks](docs/stacks.md) · [arquitectura](docs/arquitectura.md). Guías: [README](README.md) · [INSTALL](INSTALL.md) · [USO](USO.md).')
$R.Add('')
$R.Add('## 1. Skills y enrutamiento'); $R.Add('')
foreach ($x in $skillsBody) { $R.Add($x) }
$R.Add('## 2. Comandos slash'); $R.Add('')
foreach ($x in $cmdsBody) { $R.Add($x) }
$R.Add(''); $R.Add('## 3. Muros y hooks'); $R.Add('')
foreach ($x in $hooksBody) { $R.Add($x) }
$R.Add(''); $R.Add('## 4. Stacks y bundles'); $R.Add('')
foreach ($x in $stacksBody) { $R.Add($x) }
Write-Utf8 (Join-Path $root 'REFERENCIA.md') ($R -join "`n")
Write-Host "  [docs] REFERENCIA.md ($($R.Count) lineas)"

# ============================================================ README: bloque GEN:resumen (badges + numeros vivos)
$readmePath = Join-Path $root 'README.md'
if (Test-Path $readmePath) {
    $md = Read-Utf8 $readmePath
    $nSkills = @($script:Registry.skills).Count
    $nStacks = @(Get-ChildItem (Join-Path $root 'stacks') -Directory).Count
    $nHooks = @(Get-ChildItem (Join-Path $root 'core\hooks') -Filter *.mjs | Where-Object { $_.Name -ne 'lib.mjs' }).Count
    $nCmds = @(Get-ChildItem (Join-Path $root 'core\commands') -Filter *.md).Count
    $nPlugins = @(Get-ChildItem (Join-Path $root 'plugins') -Directory -ErrorAction SilentlyContinue).Count
    $ver = ''
    try { $ver = ((git -C $root describe --tags --abbrev=0 2>$null) | Out-String).Trim() } catch {}
    $B = New-Object System.Collections.Generic.List[string]
    $verBadge = if ($ver) { "![Version](https://img.shields.io/badge/version-$ver-black) " } else { '' }
    $B.Add("$verBadge![Skills](https://img.shields.io/badge/skills-$nSkills-blue) ![Stacks](https://img.shields.io/badge/stacks-$nStacks-green) ![Plugins](https://img.shields.io/badge/plugins_Claude-$nPlugins-purple) ![Muros](https://img.shields.io/badge/muros-${nHooks}_hooks-red) ![Comandos](https://img.shields.io/badge/comandos-$nCmds-orange) ![Idioma](https://img.shields.io/badge/idioma-espa%C3%B1ol-yellow)")
    $B.Add('')
    $B.Add('| Grupo | Skills | Entra por |')
    $B.Add('|---|---|---|')
    foreach ($g in @($script:Registry.groups.PSObject.Properties.Name)) {
        $skills = @($script:Registry.skills | Where-Object { $_.group -eq $g })
        if (-not $skills.Count) { continue }
        $entry = @($skills | Where-Object { $_.entrypoint } | ForEach-Object { "``$($_.name)``" })
        $names = @($skills | Sort-Object name | Select-Object -First 4 | ForEach-Object { $_.name })
        $sample = ($names -join ', ') + $(if ($skills.Count -gt 4) { '…' } else { '' })
        $B.Add("| **$($script:Registry.groups.$g)** ($($skills.Count)) | $sample | $(if ($entry.Count) { $entry -join ', ' } else { 'router' }) |")
    }
    $block = $B -join "`n"
    $md2 = [regex]::Replace($md, '(?s)(<!-- GEN:resumen -->).*?(<!-- /GEN:resumen -->)', ('${1}' + "`n$block`n" + '${2}'))
    if ($md2 -ne $md) { Write-Utf8 $readmePath $md2; Write-Host '  [docs] README.md (bloque GEN:resumen)' }
}

# ============================================================ CHANGELOG.md desde devlog/INDEX.md
$idxPath = Join-Path $root 'devlog\INDEX.md'
if (Test-Path $idxPath) {
    $rows = @()
    foreach ($line in ((Read-Utf8 $idxPath) -split "`r?`n")) {
        if ($line -match '^\|\s*(\d{3})\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*([^|]+?)\s*\|\s*(\w+)\s*\|') {
            $rows += [pscustomobject]@{ N = $Matches[1]; Fecha = $Matches[2]; Titulo = $Matches[3]; Tipo = $Matches[4] }
        }
    }
    $C = New-Object System.Collections.Generic.List[string]
    $C.Add('<!-- GENERADO por tools/build-docs.ps1 desde devlog/INDEX.md. El detalle de cada entrada vive en devlog/<fecha>/NNN-*.md -->')
    $C.Add(''); $C.Add('# Changelog'); $C.Add('')
    $C.Add('Resumen por fecha (lo nuevo arriba). Cada línea tiene su entrada completa en `devlog/`.')
    $C.Add('')
    foreach ($fecha in ($rows | Group-Object Fecha | Sort-Object Name -Descending)) {
        $C.Add("## $($fecha.Name)")
        $C.Add('')
        foreach ($r in ($fecha.Group | Sort-Object N -Descending)) { $C.Add(('- **{0}** — {1} (entrada {2})' -f $r.Tipo, $r.Titulo, $r.N)) }
        $C.Add('')
    }
    Write-Utf8 (Join-Path $root 'CHANGELOG.md') ($C -join "`n")
    Write-Host "  [docs] CHANGELOG.md ($($rows.Count) entradas)"
}
