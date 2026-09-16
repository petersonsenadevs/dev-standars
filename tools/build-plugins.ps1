#requires -Version 5.1
<#
.SYNOPSIS
  Genera los plugins de Claude Code (plugins\<nombre>\) y el marketplace local (.claude-plugin\marketplace.json)
  a partir de core\skills, core\skills-vendor (+ overlay) y core\bundles.json.
.DESCRIPTION
  Plugins generados:
    Nucleo (en TODOS los plugins): devlog + project-planner + code-quality + skill-router, para que el planner funcione solo.
    dev-standards-core   : nucleo + TODOS los hooks (guard, protect-files, secrets, format-on-save, session-start,
                           prompt-router, stop-guard, pre-compact, session-end) + hooks/config.json neutro.
    dev-standards-backend: nucleo + ddd-hexagonal + hooks.
    dev-standards-front  : nucleo + ui-ux-pro-max + gsap-scrolltrigger + threejs-webgl + front-activation + hooks
                           (set completo, incluido prompt-router: el marcador de sesion evita avisos duplicados si core tambien esta instalado).
    bundle-<nombre>      : nucleo + skills del bundle (+ front-activation si trae skills de front).
    dev-standards-all    : todas las skills + hooks.
  Instalacion en Claude Code:
    /plugin marketplace add D:\dev-standards
    /plugin install dev-standards-front@dev-standards
  Vuelve a ejecutar este script tras vendor.ps1 o tras editar core\skills-overlay\.
.PARAMETER Version
  Version para plugin.json (por defecto: fecha yyyy.M.d).
#>
param([string]$Version = (Get-Date -Format 'yyyy.M.d'))

. (Join-Path $PSScriptRoot '_lib.ps1')
$root      = Get-StandardsRoot
$pluginsDir = Join-Path $root 'plugins'
$author    = @{ name = 'dev-standards' }

function New-Plugin {
    param([string]$Name, [string]$Description, [string[]]$Skills, [hashtable]$Hooks, [string[]]$HookFiles = @(), [string[]]$ExtraSkillDirs = @(), [string[]]$Commands = @())
    $dir = Join-Path $pluginsDir $Name
    if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
    Ensure-Dir (Join-Path $dir '.claude-plugin')
    $manifest = [ordered]@{ name = $Name; description = $Description; version = $Version; author = $author; license = 'MIT (skills de terceros: ver LICENSE.upstream en cada skill)' }
    Write-Utf8 (Join-Path $dir '.claude-plugin\plugin.json') ($manifest | ConvertTo-Json -Depth 4)
    $skillsDst = Join-Path $dir 'skills'
    Ensure-Dir $skillsDst
    $installed = @()
    foreach ($s in $Skills) { if (Copy-SkillByName -Name $s -Dst $skillsDst) { $installed += $s } }
    foreach ($e in $ExtraSkillDirs) { Copy-Tree $e (Join-Path $skillsDst (Split-Path $e -Leaf)); $installed += (Split-Path $e -Leaf) }
    if ($Hooks) {
        Ensure-Dir (Join-Path $dir 'hooks')
        foreach ($h in $HookFiles) { Copy-Item (Join-Path $root "core\hooks\$h") (Join-Path $dir "hooks\$h") -Force }
        Write-Utf8 (Join-Path $dir 'hooks\hooks.json') ($Hooks | ConvertTo-Json -Depth 8)
        # config.json neutro (modo plugin: sin stack.json del proyecto)
        $cfg = [ordered]@{
            stack = $null; frontProfile = $null
            formatters = [ordered]@{ '.php' = 'php vendor/bin/pint {file}'; '.ts' = 'npx prettier --write {file}'; '.tsx' = 'npx prettier --write {file}'; '.js' = 'npx prettier --write {file}'; '.jsx' = 'npx prettier --write {file}'; '.vue' = 'npx prettier --write {file}'; '.astro' = 'npx prettier --write {file}'; '.css' = 'npx prettier --write {file}'; '.py' = 'ruff format {file}' }
            protectedPaths = @('composer.lock', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'uv.lock', '.github/workflows/**')
            skills = @($installed)
            commands = $null
            router = (Get-RouterRules)
        }
        Write-Utf8 (Join-Path $dir 'hooks\config.json') ($cfg | ConvertTo-Json -Depth 6)
    }
    if ($Commands.Count) {
        Ensure-Dir (Join-Path $dir 'commands')
        foreach ($c in $Commands) { $f = Join-Path $root "core\commands\$c"; if (Test-Path $f) { Copy-Item $f (Join-Path $dir "commands\$c") -Force } }
    }
    Write-Utf8 (Join-Path $dir 'README.md') "# $Name`n`n$Description`n`nSkills: $($installed -join ', ')`n`nGenerado por tools/build-plugins.ps1 (dev-standards). No editar a mano.`n"
    Write-Host "  [plugin] $Name  ($($installed.Count) skills)"
    return [ordered]@{ name = $Name; source = "./plugins/$Name"; description = $Description; version = $Version; category = 'development'; keywords = @($installed) }
}

function Hook-Cmd { param([string]$File) 'powershell -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/hooks/' + $File + '"' }
. (Join-Path $PSScriptRoot 'renderers\claude.ps1')   # New-HooksJson / Get-HookSet

Ensure-Dir $pluginsDir
$entries = @()

# Nucleo que necesita cualquier plugin para que el planner funcione (skill-map cita code-quality y devlog)
$coreSkills = @('devlog', 'project-planner', 'code-quality')
$routerDir  = @((Join-Path $root 'core\skills-plugin\skill-router'))

# --- core: metodologia + TODOS los hooks (menos los de front) ---
$coreFiles = @('_common.ps1','session-start.ps1','prompt-router.ps1','guard.ps1','protect-files.ps1','secrets-guard.ps1','format-on-save.ps1','stop-guard.ps1','pre-compact.ps1','session-end.ps1')
$coreHooks = @{ hooks = (New-HooksJson -HasFront $false -PathPrefix '${CLAUDE_PLUGIN_ROOT}/hooks/') }
$entries += New-Plugin -Name 'dev-standards-core' -Description 'Metodología dev-standards: skill devlog + skill-router + hooks (guard de git/BD, archivos protegidos, secretos, formateo al guardar, estado de sesión, router de prompts, cierre con devlog, pre-compact).' `
    -Skills $coreSkills -Hooks $coreHooks -HookFiles $coreFiles -ExtraSkillDirs $routerDir -Commands @('plan.md', 'siguiente.md')

# --- front (todo en uno) ---
$frontFiles = $coreFiles + @('front-skill-reminder.ps1')   # incluye prompt-router: es el unico enrutado temprano si solo se instala front (dedupe por marcador de sesion)
$frontHooks = @{ hooks = (New-HooksJson -HasFront $true -PathPrefix '${CLAUDE_PLUGIN_ROOT}/hooks/' -Only $frontFiles) }
$entries += New-Plugin -Name 'dev-standards-front' -Description 'Front y diseño todo en uno: UI UX Pro Max (design systems, 79 estilos, 192 paletas, 22 stacks) + GSAP ScrollTrigger + Three.js, con capa en español, perfiles por stack (Laravel+Inertia+Vue, Next.js, Astro, Vue 3), tabla de activación y hook recordatorio.' `
    -Skills ($coreSkills + @('ui-ux-pro-max', 'ui-verify', 'gsap-scrolltrigger', 'threejs-webgl')) -Hooks $frontHooks -HookFiles $frontFiles `
    -ExtraSkillDirs ($routerDir + @((Join-Path $root 'core\skills-plugin\front-activation'))) -Commands @('plan.md', 'siguiente.md', 'design-system.md', 'efecto.md', 'revisar-ui.md')

# --- backend: calidad + arquitectura ---
$entries += New-Plugin -Name 'dev-standards-backend' -Description 'Calidad de código y arquitectura: code-quality (buenas prácticas por stack, tests, seguridad, rendimiento, APIs, PR) + ddd-hexagonal (DDD y puertos/adaptadores para proyectos complejos) + devlog + hooks de guard.' `
    -Skills ($coreSkills + @('ddd-hexagonal')) -Hooks $coreHooks -HookFiles $coreFiles -ExtraSkillDirs $routerDir -Commands @('plan.md', 'siguiente.md')

# --- un plugin por bundle ---
$bundles = Get-Bundles
foreach ($b in ($bundles.Keys | Sort-Object)) {
    $extraDirs = $routerDir
    if (@($bundles[$b] | Where-Object { $_ -in @('ui-ux-pro-max','gsap-scrolltrigger','threejs-webgl','motion-framer','react-three-fiber') }).Count) { $extraDirs += (Join-Path $root 'core\skills-plugin\front-activation') }
    $withFront = @($extraDirs | Where-Object { $_ -like '*front-activation' }).Count -gt 0
    $bundleSkills = Expand-Requires -Names ($coreSkills + @($bundles[$b]) + $(if ($withFront) { @('front-activation') } else { @() })) | Where-Object { $_ -notin @('skill-router', 'front-activation') }
    $entries += New-Plugin -Name "bundle-$b" -Description "Bundle dev-standards '$b' (+ nucleo devlog/project-planner/code-quality/skill-router): $($bundles[$b] -join ', ')." -Skills $bundleSkills -ExtraSkillDirs $extraDirs
}

# --- all ---
$all = @(Get-ChildItem (Join-Path $root 'core\skills') -Directory | ForEach-Object Name) + @(Get-ChildItem (Join-Path $root 'core\skills-vendor') -Directory | ForEach-Object Name)
$entries += New-Plugin -Name 'dev-standards-all' -Description 'Todas las skills de dev-standards (core + UI UX Pro Max + Claude Design Skillstack) con capa en español.' `
    -Skills $all -Hooks (@{ hooks = (New-HooksJson -HasFront $true -PathPrefix '${CLAUDE_PLUGIN_ROOT}/hooks/') }) -HookFiles ($coreFiles + @('front-skill-reminder.ps1')) -ExtraSkillDirs ($routerDir + @((Join-Path $root 'core\skills-plugin\front-activation'))) -Commands @('plan.md', 'siguiente.md', 'design-system.md', 'efecto.md', 'revisar-ui.md')

# --- marketplace ---
$market = [ordered]@{
    name = 'dev-standards'
    owner = @{ name = 'dev-standards' }
    metadata = @{ description = 'Marketplace local de dev-standards: metodología, front/diseño (UI UX Pro Max + Design Skillstack) y bundles de animación/3D.'; version = $Version }
    plugins = $entries
}
Ensure-Dir (Join-Path $root '.claude-plugin')
Write-Utf8 (Join-Path $root '.claude-plugin\marketplace.json') ($market | ConvertTo-Json -Depth 8)
Write-Host "Marketplace: $(Join-Path $root '.claude-plugin\marketplace.json')  ($($entries.Count) plugins)"
Write-Host 'Instalar:  /plugin marketplace add D:\dev-standards   ->   /plugin install dev-standards-front@dev-standards'
