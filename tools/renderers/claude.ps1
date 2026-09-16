#requires -Version 5.1
# Renderer: Claude Code  ->  CLAUDE.md + .claude/ (skills, hooks, config, settings) + .mcp.json

function Get-HookSet {
    # Conjunto estandar de hooks de dev-standards (archivo -> evento/matcher). Los de front solo con -HasFront.
    param([bool]$HasFront)
    $set = [ordered]@{
        SessionStart     = @(@{ matcher = $null; files = @('session-start.ps1') })
        UserPromptSubmit = @(@{ matcher = $null; files = @('prompt-router.ps1') })
        PreToolUse       = @(
            @{ matcher = 'Bash|PowerShell';                   files = @('guard.ps1') },
            @{ matcher = 'Edit|Write|MultiEdit|NotebookEdit'; files = @('protect-files.ps1', 'secrets-guard.ps1') + $(if ($HasFront) { @('front-skill-reminder.ps1') } else { @() }) }
        )
        PostToolUse      = @(@{ matcher = 'Edit|Write|MultiEdit'; files = @('format-on-save.ps1') })
        Stop             = @(@{ matcher = $null; files = @('stop-guard.ps1') })
        PreCompact       = @(@{ matcher = $null; files = @('pre-compact.ps1') })
        SessionEnd       = @(@{ matcher = $null; files = @('session-end.ps1') })
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
                $cmds += [ordered]@{ type = 'command'; command = ('powershell -NoProfile -ExecutionPolicy Bypass -File "' + $PathPrefix + $f + '"'); timeout = $(if ($ev -eq 'SessionEnd') { 5 } else { $Timeout }) }
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
    # hooks: conservar los del usuario que no sean de dev-standards (.claude\hooks\*.ps1 nuestros)
    $merged = [ordered]@{}
    foreach ($ev in $Hooks.Keys) { $merged[$ev] = @($Hooks[$ev]) }
    if ($existing -and $existing.hooks) {
        foreach ($pr in $existing.hooks.PSObject.Properties) {
            foreach ($grp in @($pr.Value)) {
                $isOurs = @($grp.hooks | Where-Object { $_.command -match '\\\.claude\\hooks\\' }).Count -gt 0
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

    # 1) CLAUDE.md — si ya existe uno del proyecto (sin nuestra marca), respaldarlo antes de sobrescribir
    $claudeMd = Join-Path $ProjectPath 'CLAUDE.md'
    if (Test-Path $claudeMd) {
        $existing = Get-Content $claudeMd -Raw -ErrorAction SilentlyContinue
        if ($existing -and $existing -notmatch 'GENERADO por dev-standards') {
            $backup = Join-Path $ProjectPath 'CLAUDE.project.md'
            if (-not (Test-Path $backup)) { Write-Utf8 $backup $existing }
            Write-Host "  [claude]     CLAUDE.md existente respaldado en CLAUDE.project.md (revisa si quieres fusionarlo)"
        }
    }
    Write-Utf8 $claudeMd $rules

    # 2) Skills -> .claude/skills/<skill>/
    $installed = Copy-Skills -Stack $Stack -Dst (Join-Path $ProjectPath '.claude\skills') -Extra $ExtraSkills -Bundles $Bundles
    $frontInstalled = @($script:Registry.skills | Where-Object { $script:FrontGroups -contains $_.group -and $installed -contains $_.name }).Count -gt 0
    $useFrontHook = $hasFront -or $frontInstalled

    # 3) Hooks -> .claude/hooks/
    $hooksDst = Join-Path $ProjectPath '.claude\hooks'
    Ensure-Dir $hooksDst
    Get-ChildItem (Join-Path $root 'core\hooks') -Filter *.ps1 | ForEach-Object { Copy-Item $_.FullName (Join-Path $hooksDst $_.Name) -Force }
    Copy-Tree (Join-Path $Stack.Dir 'hooks') $hooksDst

    # 3a) Comandos slash -> .claude/commands/ (plan y siguiente siempre; los de front solo con perfil)
    $cmdSrc = Join-Path $root 'core\commands'
    if (Test-Path $cmdSrc) {
        $cmdDst = Join-Path $ProjectPath '.claude\commands'
        Ensure-Dir $cmdDst
        $names = @('plan.md', 'siguiente.md') + $(if ($hasFront) { @('design-system.md', 'efecto.md', 'revisar-ui.md') } else { @() })
        foreach ($n in $names) { $f = Join-Path $cmdSrc $n; if (Test-Path $f) { Copy-Item $f (Join-Path $cmdDst $n) -Force } }
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
    Merge-Settings -Path (Join-Path $ProjectPath '.claude\settings.json') -Permissions @{ deny = $deny; ask = $ask } -Hooks (New-HooksJson -HasFront $useFrontHook -PathPrefix '$CLAUDE_PROJECT_DIR\.claude\hooks\')

    # 5) .mcp.json (servidores MCP del stack)
    $mcpPath = Join-Path $Stack.Dir $Stack.Meta.mcp
    if (Test-Path $mcpPath) {
        $mcp = Get-Content $mcpPath -Raw | ConvertFrom-Json
        $servers = if ($mcp.mcpServers) { $mcp.mcpServers } else { [pscustomobject]@{} }
        Write-Utf8 (Join-Path $ProjectPath '.mcp.json') (([ordered]@{ mcpServers = $servers }) | ConvertTo-Json -Depth 10)
    }

    Write-Host "  [claude]     CLAUDE.md + .claude/{skills,hooks,settings.json} + .mcp.json  (skills: $($installed -join ', '))"
}
