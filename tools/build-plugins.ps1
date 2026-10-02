#requires -Version 5.1
<#
.SYNOPSIS
  Genera los plugins de Claude Code (plugins\<nombre>\) y el marketplace local (.claude-plugin\marketplace.json)
  a partir de core\skills, core\skills-vendor (+ overlay) y core\bundles.json.
.DESCRIPTION
  Plugins generados:
    Nucleo (en TODOS los plugins): devlog + project-planner + code-quality + skill-router, para que el planner funcione solo.
    senzu-core   : nucleo + TODOS los hooks (guard, protect-files, secrets, format-on-save, session-start,
                           prompt-router, stop-guard, pre-compact, session-end) + hooks/config.json neutro.
    senzu-backend: nucleo + ddd-hexagonal + hooks.
    senzu-front  : nucleo + ui-ux-pro-max + gsap-scrolltrigger + threejs-webgl + front-activation + hooks
                           (set completo, incluido prompt-router: el marcador de sesion evita avisos duplicados si core tambien esta instalado).
    bundle-<nombre>      : nucleo + skills del bundle (+ front-activation si trae skills de front).
    senzu-all    : todas las skills + hooks.
  Instalacion en Claude Code:
    /plugin marketplace add D:\dev-standards
    /plugin install senzu-front@senzu
  Vuelve a ejecutar este script tras vendor.ps1 o tras editar core\skills-overlay\.
.PARAMETER Version
  Version para plugin.json (por defecto: fecha yyyy.M.d).
#>
param([string]$Version = '')
# Version del plugin = version de producto (tags de git), siempre creciente:
#  - Release: SENZU_RELEASE=1.2.0 al commitear -> plugin 1.2.0, y despues se crea el tag v1.2.0.
#  - Entre releases: ultimo tag vX.Y.Z + commits desde el -> X.Y.(Z+N+1) (el +1 porque el pre-commit
#    construye ANTES de crear el commit). Asi cada commit sube la version y /plugin update siempre refresca.
if (-not $Version) { $Version = if ($env:SENZU_RELEASE) { $env:SENZU_RELEASE } else { $env:DEV_STANDARDS_RELEASE } }   # compat-dev-standards
if (-not $Version) {
    $desc = ''
    try { $desc = ((git -C $PSScriptRoot describe --tags --long --match 'v[0-9]*' 2>$null) | Out-String).Trim() } catch {}
    if ($desc -match '^v(\d+)\.(\d+)\.(\d+)-(\d+)-g') {
        $Version = '{0}.{1}.{2}' -f $Matches[1], $Matches[2], ([int]$Matches[3] + [int]$Matches[4] + 1)
    } else {
        $n = 0
        try { $n = [int]((git -C $PSScriptRoot rev-list --count HEAD 2>$null | Out-String).Trim()) } catch {}
        $Version = if ($n) { "1.0.$($n + 1)" } else { (Get-Date -Format 'yyyy.M.d') }
    }
}

. (Join-Path $PSScriptRoot '_lib.ps1')
$root      = Get-StandardsRoot
$pluginsDir = Join-Path $root 'plugins'
$author    = @{ name = 'Senzu' }

function New-Plugin {
    param([string]$Name, [string]$Description, [string[]]$Skills, [hashtable]$Hooks, [string[]]$HookFiles = @(), [string[]]$ExtraSkillDirs = @(), [string[]]$Commands = @())
    $dir = Join-Path $pluginsDir $Name
    if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
    Ensure-Dir (Join-Path $dir '.claude-plugin')
    $manifest = [ordered]@{ name = $Name; description = $Description; version = $Version; author = $author; homepage = 'https://senzu-ten.vercel.app'; repository = 'https://github.com/petersonsenadevs/senzu'; license = 'MIT' }
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
    Write-Utf8 (Join-Path $dir 'README.md') "# $Name`n`n$Description`n`nSkills: $($installed -join ', ')`n`nGenerado por tools/build-plugins.ps1 (Senzu). No editar a mano.`n"
    Write-Host "  [plugin] $Name  ($($installed.Count) skills)"
    return [ordered]@{ name = $Name; source = "./plugins/$Name"; description = $Description; version = $Version; category = 'development'; keywords = @($installed) }
}

. (Join-Path $PSScriptRoot 'renderers\claude.ps1')   # New-HooksJson / Get-HookSet

Ensure-Dir $pluginsDir
$entries = @()

# Nucleo que necesita cualquier plugin para que el planner funcione (skill-map cita code-quality y devlog)
$coreSkills = @('devlog', 'project-planner', 'instalar-proyecto', 'code-quality', 'backend-audit', 'depurar', 'deploy-ops', 'email-html')
$routerDir  = @((Join-Path $root 'core\skills-plugin\skill-router'))

# --- core: metodologia + TODOS los hooks (menos los de front) ---
$coreFiles = @('lib.mjs','session-start.mjs','prompt-router.mjs','guard.mjs','protect-files.mjs','secrets-guard.mjs','format-on-save.mjs','edit-tracker.mjs','code-hygiene.mjs','conventions-guard.mjs','backend-guard.mjs','back-skill-reminder.mjs','depurar-coach.mjs','stop-guard.mjs','pre-compact.mjs','session-end.mjs')
$coreHooks = @{ hooks = (New-HooksJson -HasFront $false -PathPrefix '${CLAUDE_PLUGIN_ROOT}/hooks/') }
$entries += New-Plugin -Name 'senzu-core' -Description 'Metodología Senzu: skill devlog + skill-router + hooks (guard de git/BD, archivos protegidos, secretos, formateo al guardar, estado de sesión, router de prompts, cierre con devlog, pre-compact).' `
    -Skills $coreSkills -Hooks $coreHooks -HookFiles $coreFiles -ExtraSkillDirs $routerDir -Commands @('instalar.md', 'plan.md', 'siguiente.md', 'verificar.md', 'desplegar.md', 'adoptar.md', 'auditar.md', 'refactor.md', 'depurar.md', 'estimar.md', 'entregar.md', 'mapa.md')

# --- front (todo en uno) ---
$frontFiles = $coreFiles + @('front-skill-reminder.mjs')   # incluye prompt-router: es el unico enrutado temprano si solo se instala front (dedupe por marcador de sesion)
$frontHooks = @{ hooks = (New-HooksJson -HasFront $true -PathPrefix '${CLAUDE_PLUGIN_ROOT}/hooks/' -Only $frontFiles) }
$entries += New-Plugin -Name 'senzu-front' -Description 'Front y diseño todo en uno: UI UX Pro Max (design systems, 79 estilos, 192 paletas, 22 stacks) + GSAP ScrollTrigger + Three.js, con capa en español, perfiles por stack (Laravel+Inertia+Vue, Next.js, Astro, Vue 3), tabla de activación y hook recordatorio.' `
    -Skills ($coreSkills + @('ui-ux-pro-max', 'ui-verify', 'marketing-seo', 'gsap-scrolltrigger', 'threejs-webgl')) -Hooks $frontHooks -HookFiles $frontFiles `
    -ExtraSkillDirs ($routerDir + @((Join-Path $root 'core\skills-plugin\front-activation'))) -Commands @('instalar.md', 'plan.md', 'siguiente.md', 'verificar.md', 'desplegar.md', 'adoptar.md', 'auditar.md', 'refactor.md', 'depurar.md', 'estimar.md', 'entregar.md', 'mapa.md', 'brief.md', 'propuestas.md', 'ronda.md', 'design-system.md', 'efecto.md', 'revisar-ui.md', 'repaso.md', 'lanzar.md')

# --- backend: calidad + arquitectura ---
$entries += New-Plugin -Name 'senzu-backend' -Description 'Calidad de código y arquitectura: code-quality (buenas prácticas por stack, tests, seguridad, rendimiento, APIs, PR) + ddd-hexagonal (DDD y puertos/adaptadores para proyectos complejos) + devlog + hooks de guard.' `
    -Skills ($coreSkills + @('ddd-hexagonal')) -Hooks $coreHooks -HookFiles $coreFiles -ExtraSkillDirs $routerDir -Commands @('instalar.md', 'plan.md', 'siguiente.md', 'verificar.md', 'desplegar.md', 'adoptar.md', 'auditar.md', 'refactor.md', 'depurar.md', 'estimar.md', 'entregar.md', 'mapa.md')

# Los bundles NO se publican como plugins (duplicaban las mismas skills: 62 MB de marketplace). Se siguen
# eligiendo al instalar en un proyecto: init.mjs --bundle <nombre> o por categorías en el menú.
# Los plugins bundle-* de versiones anteriores se borran para que no queden en el marketplace.
Get-ChildItem $pluginsDir -Directory -Filter 'bundle-*' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force

# --- all ---
$all = @(Get-ChildItem (Join-Path $root 'core\skills') -Directory | ForEach-Object Name) + @(Get-ChildItem (Join-Path $root 'core\skills-vendor') -Directory | ForEach-Object Name)
$entries += New-Plugin -Name 'senzu-all' -Description 'Todas las skills de Senzu (core + UI UX Pro Max + Claude Design Skillstack) con capa en español.' `
    -Skills $all -Hooks (@{ hooks = (New-HooksJson -HasFront $true -PathPrefix '${CLAUDE_PLUGIN_ROOT}/hooks/') }) -HookFiles ($coreFiles + @('front-skill-reminder.mjs')) -ExtraSkillDirs ($routerDir + @((Join-Path $root 'core\skills-plugin\front-activation'))) -Commands @('instalar.md', 'plan.md', 'siguiente.md', 'verificar.md', 'desplegar.md', 'adoptar.md', 'auditar.md', 'refactor.md', 'depurar.md', 'estimar.md', 'entregar.md', 'mapa.md', 'brief.md', 'propuestas.md', 'ronda.md', 'design-system.md', 'efecto.md', 'revisar-ui.md', 'repaso.md', 'lanzar.md')

# --- marketplace ---
$market = [ordered]@{
    name = 'senzu'
    owner = @{ name = 'Senzu' }
    metadata = @{ description = 'Marketplace de Senzu (antes dev-standards): metodología, front/diseño (UI UX Pro Max + Design Skillstack) y bundles de animación/3D.'; version = $Version }
    plugins = $entries
}
Ensure-Dir (Join-Path $root '.claude-plugin')
Write-Utf8 (Join-Path $root '.claude-plugin\marketplace.json') ($market | ConvertTo-Json -Depth 8)
# Evals del plugin de front (claude plugin eval): core\plugin-evals -> senzu-front\evals
$evSrc = Join-Path $root 'core\plugin-evals'
if (Test-Path $evSrc) { Copy-Tree $evSrc (Join-Path $root 'plugins\senzu-front\evals') }

Write-Host "Marketplace: $(Join-Path $root '.claude-plugin\marketplace.json')  ($($entries.Count) plugins)"
Write-Host 'Instalar:  /plugin marketplace add D:\dev-standards   ->   /plugin install senzu-front@senzu'
