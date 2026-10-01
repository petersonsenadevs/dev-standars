#requires -Version 5.1
# Renderer: Claude Code  ->  CLAUDE.md + .claude/ (skills, hooks, config, settings) + .mcp.json

function Get-HookSet {
    # Conjunto estandar de hooks de dev-standards (archivo -> evento/matcher). Los de front solo con -HasFront.
    param([bool]$HasFront)
    $set = [ordered]@{
        SessionStart     = @(@{ matcher = $null; files = @('session-start.mjs') })
        UserPromptSubmit = @(@{ matcher = $null; files = @('prompt-router.mjs') })
        PreToolUse       = @(
            @{ matcher = 'Bash|PowerShell';                   files = @('guard.mjs') },
            @{ matcher = 'Edit|Write|MultiEdit|NotebookEdit|apply_patch'; files = @('protect-files.mjs', 'secrets-guard.mjs', 'code-hygiene.mjs', 'conventions-guard.mjs', 'backend-guard.mjs', 'back-skill-reminder.mjs') + $(if ($HasFront) { @('front-skill-reminder.mjs') } else { @() }) }
        )
        PostToolUse      = @(@{ matcher = 'Edit|Write|MultiEdit|apply_patch'; files = @('format-on-save.mjs', 'edit-tracker.mjs') }, @{ matcher = 'Bash|PowerShell'; files = @('depurar-coach.mjs') })
        Stop             = @(@{ matcher = $null; files = @('stop-guard.mjs') })
        PreCompact       = @(@{ matcher = $null; files = @('pre-compact.mjs') })
        SessionEnd       = @(@{ matcher = $null; files = @('session-end.mjs') })
    }
    return $set
}

function New-HooksJson {
    # Objeto "hooks" de settings.json / hooks.json. -Only limita a los archivos indicados (plugins parciales).
    param([bool]$HasFront, [string]$PathPrefix, [int]$Timeout = 30, [string[]]$Only = @())
    $set = Get-HookSet -HasFront $HasFront
    $hooks = [ordered]@{}
    foreach ($ev in $set.Keys) {
        $groups = @()
        foreach ($g in $set[$ev]) {
            $files = @($g.files | Where-Object { -not $Only.Count -or $Only -contains $_ })
            if (-not $files.Count) { continue }
            $cmds = @()
            foreach ($f in $files) {
                # node = unico runtime garantizado alla donde corre Claude Code (agnostico de OS; rutas con /)
                $cmds += [ordered]@{ type = 'command'; command = ('node "' + $PathPrefix + $f + '"'); timeout = $(if ($ev -eq 'SessionEnd') { 5 } else { $Timeout }) }
            }
            $grp = [ordered]@{}
            if ($g.matcher) { $grp.matcher = $g.matcher }
            $grp.hooks = $cmds
            $groups += $grp
        }
        if ($groups.Count) { $hooks[$ev] = $groups }
    }
    return $hooks
}

# Reglas del router (nombre, keywords, priority, requires) desde el registro, para config.json.
function Get-RouterRules {
    return @($script:Registry.skills | Where-Object { $_.keywords } | ForEach-Object { [ordered]@{ name = $_.name; group = $_.group; entrypoint = [bool]$_.entrypoint; keywords = $_.keywords; priority = $_.priority; requires = @($_.requires) } })
}

# Fusiona settings.json existente: conserva claves del usuario; sustituye solo permissions y hooks de dev-standards.
function Merge-Settings {
    param([string]$Path, $Permissions, $Hooks)
    $existing = $null
    if (Test-Path $Path) { try { $existing = Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json } catch {} }
    $out = [ordered]@{}
    if ($existing) { foreach ($pr in $existing.PSObject.Properties) { if ($pr.Name -notin @('permissions', 'hooks')) { $out[$pr.Name] = $pr.Value } } }
    # permisos: union de deny/ask del usuario con los nuestros
    $deny = @($Permissions.deny); $ask = @($Permissions.ask); $allow = @()
    if ($existing -and $existing.permissions) {
        if ($existing.permissions.deny)  { $deny  += @($existing.permissions.deny) }
        if ($existing.permissions.ask)   { $ask   += @($existing.permissions.ask) }
        if ($existing.permissions.allow) { $allow += @($existing.permissions.allow) }
    }
    $perm = [ordered]@{ deny = @($deny | Select-Object -Unique); ask = @($ask | Select-Object -Unique) }
    if ($allow.Count) { $perm.allow = @($allow | Select-Object -Unique) }
    $out.permissions = $perm
    # hooks: conservar los del usuario que no sean de dev-standards (.claude/hooks/*.mjs nuestros; tambien limpia los .ps1 antiguos)
    $merged = [ordered]@{}
    foreach ($ev in $Hooks.Keys) { $merged[$ev] = @($Hooks[$ev]) }
    if ($existing -and $existing.hooks) {
        foreach ($pr in $existing.hooks.PSObject.Properties) {
            foreach ($grp in @($pr.Value)) {
                $isOurs = @($grp.hooks | Where-Object { $_.command -match '[\\/]\.claude[\\/]hooks[\\/]' }).Count -gt 0
                if (-not $isOurs) { if (-not $merged.Contains($pr.Name)) { $merged[$pr.Name] = @() }; $merged[$pr.Name] += $grp }
            }
        }
    }
    $out.hooks = $merged
    Write-Utf8 $Path ($out | ConvertTo-Json -Depth 12)
}

function Render-Claude {
    param([Parameter(Mandatory)]$Stack, [Parameter(Mandatory)][string]$ProjectPath, [string[]]$ExtraSkills = @(), [string[]]$Bundles = @())

    $root  = Get-StandardsRoot
    $rules = Get-CombinedRules -Stack $Stack -ExtraSkills $ExtraSkills -Bundles $Bundles -SkillsRelPath '.claude/skills'
    $hasFront = [bool]$Stack.Meta.frontProfile

    # 1) CLAUDE.md — guia propia del proyecto respetada (Resolve-GuideTarget en _lib): pregunta, respaldo en
    #    CLAUDE.project.md importado con @, o decision persistente "no tocar" via CLAUDE.dev-standards.md.
    $guide = Resolve-GuideTarget -ProjectPath $ProjectPath -FileName 'CLAUDE.md' -Rules $rules -ImportSyntax '@CLAUDE.project.md'
    Write-Utf8 $guide.Target $guide.Rules

    # 2) Skills -> .claude/skills/<skill>/
    $installed = Copy-Skills -Stack $Stack -Dst (Join-Path $ProjectPath '.claude\skills') -Extra $ExtraSkills -Bundles $Bundles
    $frontInstalled = @($script:Registry.skills | Where-Object { $script:FrontGroups -contains $_.group -and $installed -contains $_.name }).Count -gt 0
    $useFrontHook = $hasFront -or $frontInstalled

    # 3) Hooks -> .claude/hooks/
    $hooksDst = Join-Path $ProjectPath '.claude\hooks'
    Ensure-Dir $hooksDst
    Get-ChildItem (Join-Path $root 'core\hooks') -Filter *.mjs | ForEach-Object { Copy-Item $_.FullName (Join-Path $hooksDst $_.Name) -Force }
    # limpiar hooks .ps1 de versiones anteriores de dev-standards (sustituidos por .mjs agnosticos)
    Get-ChildItem $hooksDst -Filter *.ps1 -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $root ('core\hooks\' + ($_.BaseName + '.mjs'))) -or $_.Name -eq '_common.ps1' } | Remove-Item -Force
    Copy-Tree (Join-Path $Stack.Dir 'hooks') $hooksDst

    # 3a) Comandos slash -> .claude/commands/ (plan y siguiente siempre; los de front solo con perfil)
    $cmdSrc = Join-Path $root 'core\commands'
    if (Test-Path $cmdSrc) {
        $cmdDst = Join-Path $ProjectPath '.claude\commands'
        Ensure-Dir $cmdDst
        $names = @('instalar.md', 'plan.md', 'siguiente.md', 'verificar.md', 'desplegar.md', 'adoptar.md', 'auditar.md', 'refactor.md', 'depurar.md', 'estimar.md', 'entregar.md', 'mapa.md') + $(if ($hasFront) { @('brief.md', 'propuestas.md', 'ronda.md', 'design-system.md', 'efecto.md', 'revisar-ui.md', 'repaso.md', 'lanzar.md') } else { @() })
        $selProp = $Stack.PSObject.Properties['Selection']
        $cmdSel = if ($selProp -and $selProp.Value -and $selProp.Value.PSObject.Properties['comandos']) { @($selProp.Value.comandos) } else { $null }
        foreach ($cf in (Get-ChildItem $cmdSrc -Filter *.md)) {
            $n = $cf.Name
            $quiero = ($names -contains $n) -and (($null -eq $cmdSel) -or ($cmdSel -contains ($n -replace '\.md$', '')))
            if ($quiero) { Copy-Item $cf.FullName (Join-Path $cmdDst $n) -Force }
            else { Remove-Item (Join-Path $cmdDst $n) -Force -ErrorAction SilentlyContinue }   # comando nuestro ya no elegido
        }
    }

    # 3b) config.json para los hooks
    $cfg = [ordered]@{
        stack = $Stack.Name
        frontProfile = $Stack.Meta.frontProfile
        formatters = $(if ($Stack.Meta.formatters) { $Stack.Meta.formatters } else { [ordered]@{} })
        protectedPaths = @($Stack.Meta.protectedPaths)
        skills = @($installed)
        commands = $Stack.Meta.commands
        router = (Get-RouterRules)
    }
    Write-Utf8 (Join-Path $hooksDst 'config.json') ($cfg | ConvertTo-Json -Depth 6)

    # 4) settings.json (permisos + hooks), fusionando lo que ya tenga el proyecto
    $deny = Get-BaseDeny
    $ask  = @()
    $partialPath = Join-Path $Stack.Dir $Stack.Meta.settingsPartial
    if (Test-Path $partialPath) {
        $partial = Get-Content $partialPath -Raw | ConvertFrom-Json
        if ($partial.permissions.deny) { $deny += $partial.permissions.deny }
        if ($partial.permissions.ask)  { $ask  += $partial.permissions.ask }
    }
    # Hooks elegidos en el instalador (seleccion.hooks). Companeros: edit-tracker va con stop-guard,
    # pre-compact con session-start y session-end (limpieza) siempre. Igual que hooksPermitidos() de init.mjs.
    $only = @()
    $selProp = $Stack.PSObject.Properties['Selection']
    if ($selProp -and $selProp.Value -and $selProp.Value.PSObject.Properties['hooks']) {
        $companeros = @{ 'stop-guard' = @('edit-tracker'); 'session-start' = @('pre-compact') }
        $permitidos = @('session-end')
        foreach ($h in @($selProp.Value.hooks)) { $permitidos += $h; if ($companeros.ContainsKey($h)) { $permitidos += $companeros[$h] } }
        $only = @($permitidos | Select-Object -Unique | ForEach-Object { "$_.mjs" })
    }
    Merge-Settings -Path (Join-Path $ProjectPath '.claude\settings.json') -Permissions @{ deny = $deny; ask = $ask } -Hooks (New-HooksJson -HasFront $useFrontHook -PathPrefix '$CLAUDE_PROJECT_DIR/.claude/hooks/' -Only $only)

    # 5) .mcp.json (servidores MCP del stack)
    $mcpPath = Join-Path $Stack.Dir $Stack.Meta.mcp
    if (Test-Path $mcpPath) {
        # Fusiona con el .mcp.json del proyecto: conserva sus servidores (p. ej. laravel-boost) y añade o
        # actualiza los del stack. Nunca deja vacío lo que el proyecto ya tenía. Mismo resultado que init.mjs.
        $mcp = Get-Content $mcpPath -Raw | ConvertFrom-Json
        $mcpDst = Join-Path $ProjectPath '.mcp.json'
        $previo = $null
        if (Test-Path $mcpDst) { try { $previo = (Read-Utf8 $mcpDst) | ConvertFrom-Json } catch { $previo = $null } }
        $salida = [ordered]@{}
        if ($previo) { foreach ($p in $previo.PSObject.Properties) { $salida[$p.Name] = $p.Value } }
        $servers = [ordered]@{}
        if ($previo -and $previo.mcpServers) { foreach ($p in $previo.mcpServers.PSObject.Properties) { $servers[$p.Name] = $p.Value } }
        if ($mcp.mcpServers) { foreach ($p in $mcp.mcpServers.PSObject.Properties) { $servers[$p.Name] = $p.Value } }
        $salida['mcpServers'] = if ($servers.Count) { [pscustomobject]$servers } else { [pscustomobject]@{} }
        Write-Utf8 $mcpDst ([pscustomobject]$salida | ConvertTo-Json -Depth 10)
    }

    Write-Host "  [claude]     CLAUDE.md + .claude/{skills,hooks,settings.json} + .mcp.json  (skills: $($installed -join ', '))"
}
