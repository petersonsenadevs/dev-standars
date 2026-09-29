#requires -Version 5.1
<#
.SYNOPSIS
  Genera REFERENCIA.md: catalogo completo del paquete (skills + enrutamiento, comandos, muros/hooks,
  stacks y bundles) desde las fuentes de verdad (registro, core\commands, core\hooks, stacks\).
.DESCRIPTION
  Documento pensado para publicar el repo: un solo archivo donde ver TODO lo que hace el complemento.
  Se regenera en el pre-commit (como plugins/): editar las fuentes, nunca REFERENCIA.md a mano.
#>
. (Join-Path $PSScriptRoot '_lib.ps1')
$root = Get-StandardsRoot

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

$L = New-Object System.Collections.Generic.List[string]
$L.Add('<!-- GENERADO por tools/build-docs.ps1 desde core/skills-registry.json, core/commands/, core/hooks/ y stacks/. NO editar a mano. -->')
$L.Add('')
$L.Add('# Referencia completa de dev-standards')
$L.Add('')
$L.Add('Catálogo de TODO lo que hace el paquete: qué skills existen y cuándo salta cada una (enrutamiento),')
$L.Add('los comandos slash, los muros que bloquean de verdad, y los stacks y bundles disponibles.')
$L.Add('Guías hermanas: [README.md](README.md) (arquitectura), [INSTALL.md](INSTALL.md) (instalar), [USO.md](USO.md) (día a día).')
$L.Add('')

# --- 1. Enrutamiento ---
$L.Add('## 1. Cómo decide el agente qué usar (enrutamiento)')
$L.Add('')
$L.Add('Tres capas, todas automáticas:')
$L.Add('1. **Al arrancar la sesión** (hook SessionStart): estado del proyecto (stack, versiones+EOL, design system,')
$L.Add('   plan, devlog, convenciones) + puertas de entrada: UI → `ui-ux-pro-max` · lógica → `code-quality` ·')
$L.Add('   proyecto nuevo → `project-planner` · duda → `skill-router`.')
$L.Add('2. **En cada petición** (hook UserPromptSubmit): las *señales* de la tabla de abajo sugieren la skill')
$L.Add('   (máx. 2, una vez por skill y sesión). Los *entrypoints* van primero; a igual match gana la prioridad mayor.')
$L.Add('3. **Tablas de activación** (`skill-router` y `front-activation`, generadas del registro): el agente las')
$L.Add('   consulta cuando duda; `references/decision-trees.md` para el árbol completo.')
$L.Add('')

$groupOrder = @($script:Registry.groups.PSObject.Properties.Name)
foreach ($g in $groupOrder) {
    $skills = @($script:Registry.skills | Where-Object { $_.group -eq $g } | Sort-Object -Property @{Expression = { [bool]$_.entrypoint }; Descending = $true }, @{Expression = { $_.priority }; Descending = $true }, name)
    if (-not $skills.Count) { continue }
    $label = $script:Registry.groups.$g
    $L.Add(('### {0} (grupo `{1}`)' -f $label, $g))
    $L.Add('')
    $L.Add('| Skill | Prio | Cuándo usarla | Señales que la activan (muestra) |')
    $L.Add('|---|---|---|---|')
    foreach ($s in $skills) {
        $name = if ($s.entrypoint) { "**``$($s.name)``** (entrada)" } else { "``$($s.name)``" }
        $kw = Clean-Keywords $s.keywords
        $L.Add("| $name | $($s.priority) | $($s.when) | $kw |")
    }
    $L.Add('')
}

# --- 2. Comandos ---
$L.Add('## 2. Comandos slash')
$L.Add('')
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
        if ($fmBlock -match '(?m)^argument-hint:\s*(.+)$') { $hint = $Matches[1].Trim() }
    }
    $L.Add("| ``/$($f.BaseName)`` | $hint | $desc |")
}
$L.Add('')

# --- 3. Muros y hooks ---
$L.Add('## 3. Muros y hooks (Claude Code)')
$L.Add('')
$L.Add('Hooks en Node (`.mjs`, agnósticos de OS). Los que BLOQUEAN salen con exit 2 y el motivo; el resto informa.')
$L.Add('')
$hookInfo = [ordered]@{
    'session-start.mjs'        = @('SessionStart', 'Inyecta estado: stack/perfil, si el proyecto es NUEVO (→ /brief + /plan) o EXISTENTE (→ /adoptar), diario propio detectado, versiones con aviso EOL, convenciones adoptadas, git, design system, plan, devlog y protocolo de skills.')
    'prompt-router.mjs'        = @('UserPromptSubmit', 'Sugiere la skill que encaja con la petición (tabla del §1), una vez por skill y sesión.')
    'guard.mjs'                = @('PreToolUse Bash/PowerShell', 'BLOQUEA: git push, destructivos de BD/git, rm -rf, deploy a prod sin aprobación (escape `DEV_STANDARDS_ALLOW_DEPLOY=1`), jQuery/Bootstrap (`DEV_STANDARDS_ALLOW_LIB=1`), devops peligroso (curl\|bash, chmod 777, dd, mkfs, docker prune, parar servicios, vaciar firewall, crontab -r); commits: rama protegida, Conventional ≤72, sin co-autores.')
    'protect-files.mjs'        = @('PreToolUse Edit/Write', 'BLOQUEA editar: generados por dev-standards, secretos (.env, *.pem, credentials), dependencias/artefactos, migraciones versionadas, conventions.md/json sellados y `protectedPaths` del proyecto.')
    'secrets-guard.mjs'        = @('PreToolUse Edit/Write', 'BLOQUEA escribir credenciales reales (AWS, GitHub, Stripe, OpenAI/Anthropic, PEM, JWT, cadenas con password); ignora placeholders.')
    'code-hygiene.mjs'         = @('PreToolUse Edit/Write', 'BLOQUEA introducir: console.log/debugger/dd()/var_dump/ray, términos vetados en `gustos.md` §No, marcadores de conflicto de git, y `.only`/`.skip`/xit en archivos de test (escape puntual: comentario `dev-standards-allow`).')
    'conventions-guard.mjs'    = @('PreToolUse Edit/Write', 'BLOQUEA código que viole las reglas ejecutables de `conventions.json` (/adoptar): la convención del proyecto gana.')
    'front-skill-reminder.mjs' = @('PreToolUse Edit/Write (front)', 'Primera edición de UI: BLOQUEA una vez si no hay design system NI brief (obliga a preguntar); después recuerda ui-ux-pro-max y las reglas duras de UI.')
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

# --- 4. Stacks y bundles ---
$L.Add('## 4. Stacks y bundles')
$L.Add('')
$L.Add('| Stack (`init-project.ps1 -Stack …`) | Qué es | Perfil de front |')
$L.Add('|---|---|---|')
foreach ($d in (Get-ChildItem (Join-Path $root 'stacks') -Directory | Sort-Object Name)) {
    $meta = (Read-Utf8 (Join-Path $d.FullName 'stack.json')) | ConvertFrom-Json
    $fp = if ($meta.frontProfile) { $meta.frontProfile.label } else { '— (backend)' }
    $L.Add("| ``$($d.Name)`` | $($meta.label) | $fp |")
}
$L.Add('')
$L.Add('Lenguajes sin stack propio (referencias de `code-quality`): Go (`go.md`), Java/Spring (`java.md`), C#/.NET (`csharp.md`).')
$L.Add('')
$bundles = Get-Bundles
$L.Add('Bundles opcionales (`sync.ps1 -Bundle <nombre>` o plugin `bundle-<nombre>`): ' + (($bundles.Keys | Sort-Object | ForEach-Object { "``$_``" }) -join ' · ') + '.')
$L.Add('')

# --- 5. Instalación resumida ---
$L.Add('## 5. Instalar (resumen)')
$L.Add('')
$L.Add('- **Por proyecto** (recomendado): `tools\init-project.ps1 -Stack <stack> -Path <ruta> -Tools claude,codex` — detalle en [INSTALL.md](INSTALL.md).')
$L.Add('- **Como plugin de Claude Code**: `/plugin marketplace add <ruta-o-repo>` → `/plugin install dev-standards-front@dev-standards` (o `-core`, `-backend`, `-all`, `bundle-*`).')
$L.Add('- Tras cada mejora del paquete: `tools\sync.ps1 -Path <proyecto>` + sesión nueva del agente.')

Write-Utf8 (Join-Path $root 'REFERENCIA.md') ($L -join "`n")
Write-Host "  [docs] REFERENCIA.md generado ($($L.Count) lineas)"
