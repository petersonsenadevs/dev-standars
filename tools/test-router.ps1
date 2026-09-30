#requires -Version 5.1
<#
.SYNOPSIS
  Suite de regresion del prompt-router: casos dorados prompt -> skills esperadas/prohibidas.
.DESCRIPTION
  Monta un proyecto sintetico en %TEMP% (skills stub + hooks/config.json con el router del registro),
  ejecuta core\hooks\prompt-router.mjs (Node) con cada caso y comprueba que las sugerencias contienen las
  skills de `expect` y ninguna de `forbid`. Cada caso usa un session_id propio (sin colisiones de marcador).
  Ejecutar tras tocar keywords/prioridades del registro o el propio hook. Sale con 1 si algun caso falla.
#>
param([switch]$ShowAll)

$OutputEncoding = New-Object System.Text.UTF8Encoding($false)   # el pipe al hook emite UTF-8 (por defecto seria ASCII y rompe acentos)
. (Join-Path $PSScriptRoot '_lib.ps1')
. (Join-Path $PSScriptRoot 'renderers\claude.ps1')   # Get-RouterRules
$root = Get-StandardsRoot

# --- proyecto sintetico ---
$proj = Join-Path $env:TEMP ('ds-router-test-' + [guid]::NewGuid().ToString('N').Substring(0, 6))
$skillsDir = Join-Path $proj '.claude\skills'
$hooksDir  = Join-Path $proj '.claude\hooks'
Ensure-Dir $skillsDir; Ensure-Dir $hooksDir

$DefaultSkills = @('devlog', 'project-planner', 'code-quality', 'skill-router', 'front-activation', 'ui-ux-pro-max',
                   'gsap-scrolltrigger', 'threejs-webgl', 'react-three-fiber', 'motion-framer', 'ddd-hexagonal',
                   'lottie-animations', 'barba-js', 'pixijs-2d', 'lightweight-3d-effects', 'ui-styling', 'ui-verify')
function Set-InstalledSkills([string[]]$Names) {
    Get-ChildItem $skillsDir -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
    foreach ($n in $Names) { Ensure-Dir (Join-Path $skillsDir $n); Write-Utf8 (Join-Path $skillsDir "$n\SKILL.md") "---`nname: $n`n---`nstub" }
}
Write-Utf8 (Join-Path $hooksDir 'config.json') (([ordered]@{ skills = @(); router = (Get-RouterRules) }) | ConvertTo-Json -Depth 6)
$hook = Join-Path $root 'core\hooks\prompt-router.mjs'
# el hook importa lib.mjs desde su carpeta: ejecutar el original de core\hooks

function Invoke-Case([hashtable]$c, [int]$i) {
    if ($c.skills) { Set-InstalledSkills $c.skills } else { Set-InstalledSkills $DefaultSkills }
    $dsRoot = Join-Path $proj 'design-system'
    if (Test-Path $dsRoot) { [System.IO.Directory]::Delete($dsRoot, $true) }
    if ($c.designSystem) { Ensure-Dir (Join-Path $dsRoot 'x'); Write-Utf8 (Join-Path $dsRoot 'x\MASTER.md') '# DS' }
    if ($c.designSystem -ne $true -and (Test-Path $dsRoot)) { throw 'harness: design-system no se pudo limpiar' }
    $env:CLAUDE_PROJECT_DIR = $proj
    $env:DEV_STANDARDS_TEST_ISOLATED = '1'   # el hook ignora ~/.claude global: la suite no depende de que plugins tenga la maquina
    $sid = "rt$i-" + [guid]::NewGuid().ToString('N').Substring(0, 4)
    $json = (@{ session_id = $sid; prompt = $c.prompt } | ConvertTo-Json -Compress)
    # Transporte 100% ASCII: escapar no-ASCII a \uXXXX para que ninguna codepage del pipe pueda corromper acentos.
    $json = -join ($json.ToCharArray() | ForEach-Object { if ([int]$_ -gt 127) { '\u{0:x4}' -f [int]$_ } else { $_ } })
    $out = ($json | node $hook 2>&1 | Out-String)
    $hits = @()
    if ($out -match 'parece de: ([^\.]+)\.') { $hits = @($Matches[1] -split ',\s*') }
    $problems = @()
    foreach ($e in @($c.expect)) { if ($e -and $hits -notcontains $e) { $problems += "falta '$e'" } }
    foreach ($f in @($c.forbid)) { if ($f -and $hits -contains $f) { $problems += "sobra '$f'" } }
    if ($c.expectFirst -and ($hits.Count -eq 0 -or $hits[0] -ne $c.expectFirst)) { $problems += "'$($c.expectFirst)' no es la primera" }
    if ($c.expectSilence -and $hits.Count) { $problems += "esperaba silencio, sugirio: $($hits -join ', ')" }
    return @{ hits = $hits; problems = $problems }
}

$cases = @(
    @{ n = 'landing basica';        prompt = 'haz la landing de la app de facturación';                    expect = 'ui-ux-pro-max'; expectFirst = 'ui-ux-pro-max' }
    @{ n = 'mejora pagina';         prompt = 'mejora la página de precios, se ve pobre';                   expect = 'ui-ux-pro-max' }
    @{ n = 'shadcn sin ui-styling'; prompt = 'monta los componentes de ui con shadcn para el panel';       skills = @('ui-ux-pro-max','skill-router'); expect = 'ui-ux-pro-max'; forbid = 'ui-styling' }
    @{ n = 'shadcn con ui-styling'; prompt = 'monta los componentes de ui con shadcn para el panel';       expect = 'ui-ux-pro-max' }
    @{ n = 'parallax sin DS';       prompt = 'añade un parallax al hero y un marquee de logos';            expect = 'gsap-scrolltrigger'; expectFirst = 'ui-ux-pro-max' }
    @{ n = 'skew con DS';           prompt = 'aplica un efecto de skew según la velocidad del scroll';     designSystem = $true; expect = 'gsap-scrolltrigger'; forbid = 'ui-ux-pro-max' }
    @{ n = 'cursor personalizado';  prompt = 'quiero un cursor personalizado con estados al pasar por los enlaces'; expect = 'gsap-scrolltrigger' }
    @{ n = 'before/after';          prompt = 'pon un comparador before after en la galería de reformas';   expect = 'gsap-scrolltrigger' }
    @{ n = 'motion EN sin framer';  prompt = 'add motion to the hero section please';                      skills = @('ui-ux-pro-max','gsap-scrolltrigger'); expect = 'ui-ux-pro-max'; forbid = 'motion-framer' }
    @{ n = 'framer explicito';      prompt = 'anima el modal con framer motion y AnimatePresence';         expect = 'motion-framer' }
    @{ n = 'r3f gana a three';      prompt = 'monta un hero con react three fiber y drei';                 expect = 'react-three-fiber'; forbid = 'threejs-webgl' }
    @{ n = 'glb generico';          prompt = 'integra el modelo GLB del producto en la home con three.js'; expect = 'threejs-webgl' }
    @{ n = 'vanta fondo';           prompt = 'pon un fondo animado tipo vanta waves en el header';         expect = 'lightweight-3d-effects' }
    @{ n = 'lottie';                prompt = 'incrusta la animación lottie que nos pasó el diseñador';     expect = 'lottie-animations' }
    @{ n = 'barba mpa';             prompt = 'transiciones entre páginas con barba en el sitio multipágina'; expect = 'barba-js' }
    @{ n = 'pixi displacement';     prompt = 'un efecto liquid con displacement sobre el poster, con pixi'; expect = 'pixijs-2d' }
    @{ n = 'planificar';            prompt = 'planifica el proyecto de la tienda desde cero';              expect = 'project-planner'; expectFirst = 'project-planner' }
    @{ n = 'siguiente tarea';       prompt = '¿cuál es la siguiente tarea del plan?';                      expect = 'project-planner' }
    @{ n = 'tests y refactor';      prompt = 'refactoriza el servicio de pagos y añade tests';             expect = 'code-quality' }
    @{ n = 'ddd dominio';           prompt = 'diseña el módulo de facturación con DDD y agregados';        expect = 'ddd-hexagonal' }
    @{ n = 'modo propuesta';        prompt = 'enséñame dos propuestas de diseño antes de construir la home'; expect = 'ui-ux-pro-max'; expectFirst = 'ui-ux-pro-max' }
    @{ n = 'imagen producto';       prompt = 'genera una imagen del producto flotando para el hero';      skills = @('ui-ux-pro-max','image-gen','skill-router'); expect = 'image-gen' }
    @{ n = 'webhook stripe';        prompt = 'monta el webhook de stripe para marcar pedidos pagados';    expect = 'code-quality' }
    @{ n = 'doble pedido';          prompt = 'los usuarios duplican pedidos al hacer doble clic';          expect = 'code-quality' }
    @{ n = 'login google';          prompt = 'añade login con google y reset de contraseña';               expect = 'code-quality' }
    @{ n = 'commitear';             prompt = 'documenta lo de hoy y commitea los cambios';                 expect = 'devlog' }
    @{ n = 'look moderno';          prompt = 'dale un aire moderno tipo bento con un fondo aurora';       expect = 'ui-ux-pro-max'; expectFirst = 'ui-ux-pro-max' }
    @{ n = 'elegir stack';          prompt = '¿qué framework uso para la web de un restaurante?';          expect = 'skill-router' }
    @{ n = 'fuentes e iconos';      prompt = 'qué fuentes e iconos pongo para que no parezca plantilla';   expect = 'ui-ux-pro-max' }
    @{ n = 'verificar movil';       prompt = 'comprueba la ui en el móvil que algo se descuadra';          expect = 'ui-verify' }
    @{ n = 'seo google';            prompt = 'mejora el seo de la web para salir en google';               skills = @('ui-ux-pro-max','marketing-seo','skill-router'); expect = 'marketing-seo' }
    @{ n = 'tag manager';           prompt = 'monta google tag manager con consent mode para el cliente';  skills = @('ui-ux-pro-max','marketing-seo','skill-router'); expect = 'marketing-seo' }
    @{ n = 'deploy netlify';        prompt = 'prepara el deploy a producción en netlify del proyecto';    skills = @('deploy-ops','skill-router'); expect = 'deploy-ops' }
    @{ n = 'dockerizar';            prompt = 'dockeriza el proyecto con docker compose para el vps';       skills = @('deploy-ops','skill-router'); expect = 'deploy-ops' }
    @{ n = 'github actions';        prompt = 'configura github actions para que corra los tests en cada pr'; skills = @('deploy-ops','code-quality','skill-router'); expect = 'deploy-ops' }
    @{ n = 'backups bd';            prompt = 'monta los backups de la base de datos con restore probado';   skills = @('deploy-ops','skill-router'); expect = 'deploy-ops' }
    @{ n = 'lanzamiento';           prompt = 'prepara el lanzamiento de la web a producción';              expect = 'ui-verify' }
    @{ n = 'copy titulares';        prompt = 'escribe los titulares y el copy de la landing';              expect = 'ui-ux-pro-max' }
    @{ n = 'multiidioma';           prompt = 'monta la web en castellano y catalán con hreflang';          expect = 'code-quality' }
    @{ n = 'wordpress plugin';      prompt = 'monta el plugin de wordpress para las reservas';             expect = 'code-quality' }
    @{ n = 'api nestjs';            prompt = 'crea los endpoints con nestjs para los pedidos';             expect = 'code-quality' }
    @{ n = 'migrar a golang';       prompt = 'migra el servicio de informes a golang';                     expect = 'code-quality' }
    @{ n = 'esquema bd';            prompt = 'diseña el esquema y los índices de la tabla de reservas';    expect = 'code-quality' }
    @{ n = 'realtime websockets';   prompt = 'monta notificaciones en tiempo real con websockets';         expect = 'code-quality' }
    @{ n = 'chatbot rag';           prompt = 'añade un chatbot con rag sobre nuestra documentación';       expect = 'code-quality' }
    @{ n = 'uploads s3';            prompt = 'sube los archivos de los usuarios a s3 con urls firmadas';   expect = 'code-quality' }
    @{ n = 'newsletter';            prompt = 'maqueta la newsletter mensual con las novedades';            skills = @('email-html','skill-router'); expect = 'email-html' }
    @{ n = 'email roto outlook';    prompt = 'el email de bienvenida se ve roto en outlook';               skills = @('email-html','code-quality','skill-router'); expect = 'email-html' }
    @{ n = 'core web vitals';       prompt = 'mejora el lcp y los core web vitals de la home';             expect = 'ui-verify' }
    @{ n = 'aria lector pantalla';  prompt = 'revisa los aria y el uso con lector de pantalla del formulario'; expect = 'ui-verify' }
    @{ n = 'separador y blob';      prompt = 'pon un separador de onda entre secciones y un blob detrás de la foto'; expect = 'front-activation' }
    @{ n = 'view transitions';      prompt = 'añade view transitions entre las páginas del sitio';        expect = 'front-activation' }
    @{ n = 'microinteracciones';    prompt = 'mejora las microinteracciones de los botones del formulario'; expect = 'front-activation' }
    @{ n = 'liquid glass';          prompt = 'haz la barra de navegación con efecto liquid glass';        expect = 'front-activation' }
    @{ n = 'composicion pagina';    prompt = 'cambia la composición de la página a una rejilla rota';     expect = 'front-activation' }
    @{ n = 'auditar backend';       prompt = 'audita el backend y encuentra la deuda técnica';             skills = @('backend-audit','code-quality','skill-router'); expect = 'backend-audit'; expectFirst = 'backend-audit' }
    @{ n = 'dependencias circulares'; prompt = 'creo que hay dependencias circulares entre los módulos';   skills = @('backend-audit','code-quality','skill-router'); expect = 'backend-audit' }
    @{ n = 'refactor seguro';       prompt = 'quiero un refactor seguro del servicio de facturas';         skills = @('backend-audit','code-quality','skill-router'); expect = 'backend-audit'; expectFirst = 'backend-audit' }
    @{ n = 'auditoria seo no back'; prompt = 'haz una auditoría seo de la web';                            skills = @('backend-audit','marketing-seo','skill-router'); expect = 'marketing-seo'; forbid = 'backend-audit' }
    @{ n = 'prompt trivial';        prompt = 'hola';                                                       expectSilence = $true }
)

$fail = 0; $i = 0
foreach ($c in $cases) {
    $i++
    $r = Invoke-Case $c $i
    if ($r.problems.Count) { $fail++; Write-Host ("FAIL {0,-24} -> [{1}]  {2}" -f $c.n, ($r.hits -join ', '), ($r.problems -join '; ')) }
    elseif ($ShowAll)      { Write-Host ("ok   {0,-24} -> [{1}]" -f $c.n, ($r.hits -join ', ')) }
}
Remove-Item $proj -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Casos: $($cases.Count)  Fallos: $fail"
if ($fail) { exit 1 } else { exit 0 }
