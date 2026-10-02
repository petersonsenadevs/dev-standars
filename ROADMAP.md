# Roadmap de Senzu (para que nada se olvide)

Actualizado: 2026-10-02. Las tandas completadas viven en el devlog (`INDEX.md`).

## 0. Siguiente tanda (2026-10-03): cuarta pared, doble pantalla y combinaciones
Idea: un efecto suelto lo copia cualquiera; **combinar varios con una idea detrás** es lo que hace que una web
parezca de estudio. Se construye igual que «Física e impacto» (082-083): categoría en el catálogo, receta por
stack, demos HTML que funcionan con su ficha (`senzu-demo`), suite en Chromium real a 375 y 1440, publicadas
en `docs/efectos.*` para la web. Código de terceros solo con licencia verificada (vendor-effects).

**Orden propuesto** (a confirmar con el usuario al empezar: cuarta pared primero, o ir directos a «La semilla»
para senzu-web y sacar de ahí las piezas):
- [ ] **Categoría «Cuarta pared»** (la web sabe que la miras), tres demos estrella:
  - [ ] **Se sale del marco**: foto, producto o personaje que sobresale de su tarjeta o sección y se apoya en la
        siguiente (capas, `overflow: visible`, sticky); en móvil, sin solapar texto.
  - [ ] **La web te mira**: ojos, logo o personaje que siguen al cursor (en móvil, la inclinación con permiso
        de `DeviceOrientation`, o nada); parpadea, se asusta si vas rápido.
  - [ ] **La interfaz se rompe a propósito**: botón que se cae tras muchos hovers, texto que se despega y se
        recoloca, scroll que «pesa» (reutiliza el motor de 082).
  - [ ] Más ideas para la receta: reacciona a irte o volver (`visibilitychange`), a quedarte quieto, cursor que
        empuja las letras del titular.
- [ ] **Categoría «Doble pantalla»**: dividida animada que cuenta dos historias (antes/después, B/N y color,
      mitades que van en sentidos contrarios con el scroll); doble capa con linterna o rasgado que revela la
      web de debajo; ventanas arrastrables dentro de la web (portfolios). La composición estática ya existe
      (`composiciones.md` → pantalla dividida): aquí va la versión animada.
- [ ] **Recetario de combinaciones (coreografías)**, cada una con UNA idea y UN clímax:
  - [ ] *La semilla*: intro que cae y rompe la pantalla → brota en el hero (trazo SVG que crece) → sale de su
        tarjeta al hacer scroll → acaba apoyada junto al CTA.
  - [ ] *Antes y después*: pantalla dividida → la mitad del antes se agrieta y cae → aparece el después.
  - [ ] *La web viva*: personaje que te mira → se asoma por el borde de las secciones → en la 404 la página se
        desmorona y él la recoge.
  - [ ] Reglas de combinación: una idea que lo une, **un solo efecto de coste alto por página**, un clímax,
        móvil decidido, todo saltable y con «reducir movimiento»; se votan en las rondas como una pieza **M**.
  - [ ] Que el agente, ante «algo que impacte», proponga una COMBINACIÓN con su idea en vez de amontonar efectos
        (front-activation y ui-ux-pro-max; caso nuevo en test-router).
- [ ] Más adelante (ofrecido, sin confirmar): componentes listos por stack (`<IntroRotura />` en Astro, React y
      Vue con props) y un comando `/intro` que pregunte objeto, colores y modo y lo monte verificado.

**Abierto de hoy** (no olvidar):
- [ ] `verify-ui` decide la carpeta de capturas por el directorio actual: si se ejecuta desde otra carpeta, las
      deja fuera de `senzu/ui-verify/`. Que busque la raíz del proyecto.
- [ ] El muro de UI (`front-skill-reminder`) salta en el propio repo de Senzu al escribir demos de recetas
      (`core/`): que no cuente como UI de un proyecto.
- [ ] Comprobación de enlaces rotos como herramienta fija (no un script de usar y tirar en temp): en la
      checklist de lanzamiento de ui-verify.
- [ ] La web (senzu-web) consume `docs/efectos.md` y `docs/efectos.json` (v2.6.1): bloque de instrucciones ya
      entregado a su agente.

## 1. Pendientes que dependen del usuario
- [ ] **Estreno real del ciclo completo**: un proyecto de verdad con `/brief` → `/propuestas` (maquetas A/B)
  → construir → `/repaso` → `/lanzar`. Lo que falle ahí define la siguiente tanda (regla aprendida:
  lo real destapa más que construir en vacío).
- [x] **Publicado en GitHub** (2026-09-29): https://github.com/petersonsenadevs/senzu (público).
  Activos `/plugin marketplace add petersonsenadevs/senzu` y el `irm … install.ps1 | iex`.
  Repositorio renombrado a `petersonsenadevs/senzu` (v2.0.0); GitHub redirige la URL antigua.
- [ ] En un proyecto Laravel de prueba: verificación móvil de una landing (F2-T1), fotos reales del servicio,
  cifras de contadores confirmadas, alta del subdominio en Netlify/DNS, y commit del proyecto.
- [x] Evals ejecutadas (2026-09-18, 1,65 $): landing 1.0 ✅ · backend 0.67 · **efecto 0 — sin el hook
  del router, el agente no usa skills para efectos: reforzar la description de gsap/front-activation o
  asumir que el enrutado de efectos depende del hook** · no-molestar era bug del grader (corregido, min: 0).
- [ ] Re-ejecutar evals tras reforzar descriptions de efectos y revisar el transcript de backend-sintoma.

## 2. MOBILE — decidido (dev-023), pendiente de proyecto real que lo estrene
**Decisión**: mobile va EN ESTE repo como stacks nuevos (NO repo aparte). Motivo: la maquinaria
(registro, router, hooks, checks, suite, vendor, renderers, install) es única y el núcleo (planner,
devlog, brief, gustos, backend de code-quality) aplica igual. Separar = mantener todo dos veces.
La disciplina de contexto ya evita la saturación: cada proyecto instala SOLO su stack.

**Los 4 stacks previstos** (se construye CADA UNO cuando llegue su primer proyecto real, no antes):

| Stack | Contenido clave | Verificación en Windows |
|---|---|---|
| `react-native-expo` | Expo/EAS, Reanimated ("el gsap de RN"), React Navigation | ✔ npm test + eas build |
| `flutter` | Widgets, Riverpod/Bloc, Material 3 | ✔ flutter analyze/test |
| `android-kotlin` | Jetpack Compose, Gradle, Material 3 | ✔ gradlew lint test assembleDebug |
| `ios-swift` | SwiftUI, HIG, SPM | ✘ **xcodebuild exige macOS**: sin Mac (o Xcode Cloud/CI), el agente escribiría Swift a ciegas — NO arrancar iOS nativo sin resolver esto |

**Grupo `mobile` nuevo en el registro** (compartido por los 4): skill de diseño móvil hermana de
ui-ux-pro-max (Material 3 + Human Interface Guidelines — el design system de una app NO es el de una
web), navegación y patrones de pantalla, push notifications, offline/sync, y launch-checklist de
stores (App Store review, Play Console, screenshots, privacidad). `mobileProfile` análogo al
frontProfile; verify sobre emulador/Expo Go como nuestro ui-verify.

**Orden recomendado para agencia**: cross-platform primero (RN/Expo o Flutter cubre ~90 % de encargos
con un código); Kotlin/Swift nativos solo si el proyecto lo exige (rendimiento extremo, APIs de
plataforma profundas, heredar app nativa) — y Swift solo con Mac disponible.

## 3. Mejoras conocidas de menor prioridad (cuando toquen)
- [x] **Deploy/infra/contenedores — CUBIERTO (033)**: skill `deploy-ops` (grupo ops, en todos los stacks
  y plugins): deploy por stack, Docker, CI/CD, secretos, runtime de prod, backups+restore, /desplegar,
  muro de deploy a prod. Pendiente natural: estrenarla con el primer deploy real.
- [ ] Backend por stack profundo: colas Horizon en php-laravel.md, server actions seguras en
  react-next.md, uploads de archivos como receta propia.
- [ ] Refresco periódico (~mensual): `tools/vendor.ps1` (upstream de skills), `vendor-effects.ps1 -Missing`
  y los índices scrapeados de `front-activation/references/sources/` (instrucciones en cada índice).
- [x] Tanda "más pro" back+front (2026-09-29): referencias database-design, realtime, files-media,
  llm-apps (back) y a11y-build, web-performance, forms-ux (front); skill email-html; muros de tests
  desactivados (.only/.skip) y marcadores de conflicto; catalogo backend ampliado. Pendiente natural:
  estrenar cada pieza en proyecto real.
- [x] Más stacks y lenguajes (2026-09-22): 4 stacks completos nuevos — `wordpress` (themes/plugins/Woo),
  `node-api` (Express/NestJS), `nuxt`, `sveltekit` — y 3 lenguajes como referencias de code-quality
  (`go.md`, `java.md`, `csharp.md`). Detección de versiones ampliada (WP, go.mod, pom/gradle, .csproj).
  Pendiente natural: estrenarlos en proyectos reales y engordar `rules/` con lo aprendido.
- [x] Stacks conscientes de versión (2026-09-22): session-start detecta versiones reales (composer/package/
  pyproject) + aviso EOL; referencia `code-quality/references/stack-versions.md` (qué cambia entre majors).
- [x] `/adoptar` (2026-09-22): convenciones de proyectos heredados analizadas, pactadas y selladas como
  inmutables (`senzu/conventions.md` + `senzu/conventions.json` ejecutable + hook `conventions-guard`).
- [x] **Instalador agnóstico en Node** (2026-09-29): `tools/init.mjs` — init+sync para claude y
  codex/antigravity en Windows/WSL/Linux/macOS. Suite `test-init-parity.ps1` en el pre-commit:
  compara la salida de ambos instaladores (3 stacks probados byte a byte) para que no diverjan.
  Cursor/windsurf y -GitHooks siguen solo en la versión PowerShell.
- [x] Portabilidad de lo que VIAJA a los proyectos (2026-09-22): los 13 hooks y `verify-build` reescritos
  en Node `.mjs` — funcionan en Windows/macOS/Linux y en cualquier agente. Queda PS 5.1 SOLO el tooling
  del repo (`sync`, `init-project`, `build-*`, `check-skills`, suites, `vendor*`), que corre en esta
  máquina Windows; portarlo solo si algún día se mantiene el repo desde macOS/Linux.
- [ ] Más canteras MIT al manifest de effects-vendor a medida que aparezcan (codrops está agotado).

## Cómo se usa este archivo
Al cerrar una tanda: marcar lo hecho y añadir lo nuevo que quede pendiente. El planner y los agentes
pueden leerlo, pero la fuente de tareas de un proyecto sigue siendo su `senzu/plan/PLAN.md`; esto es el
backlog del PAQUETE.
