<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo/senzu-horizontal-color-oscuro.svg">
    <img alt="Senzu" src="assets/logo/senzu-horizontal-color-claro.svg" width="360">
  </picture>
</p>

# Senzu

*Una semilla y el proyecto se recupera.* (Antes **dev-standards**.)

**El estándar de trabajo de la agencia convertido en sistema ejecutable para agentes de IA.**
Escribes las reglas UNA vez y viajan a Claude Code, Codex, Cursor, Windsurf y Antigravity — con
skills que se activan solas, muros que bloquean de verdad y verificación obligatoria antes de dar
nada por hecho.

<!-- GEN:resumen -->
![Version](https://img.shields.io/badge/version-v2.7.1-black) ![Skills](https://img.shields.io/badge/skills-43-blue) ![Stacks](https://img.shields.io/badge/stacks-9-green) ![Plugins](https://img.shields.io/badge/plugins_Claude-4-purple) ![Muros](https://img.shields.io/badge/muros-16_hooks-red) ![Comandos](https://img.shields.io/badge/comandos-20-orange) ![Idioma](https://img.shields.io/badge/idioma-espa%C3%B1ol-yellow)

| Grupo | Skills | Entra por |
|---|---|---|
| **Planificación** (1) | project-planner | `project-planner` |
| **Enrutado** (3) | front-activation, instalar-proyecto, skill-router | `skill-router` |
| **Calidad de código** (3) | backend-audit, code-quality, depurar | router |
| **Arquitectura** (1) | ddd-hexagonal | router |
| **Documentación** (1) | devlog | router |
| **Front y diseño** (6) | design-system, image-gen, modern-web-design, ui-styling… | `ui-ux-pro-max` |
| **Animación** (9) | animated-component-libraries, animejs, barba-js, gsap-scrolltrigger… | router |
| **3D / WebGL** (12) | aframe-webxr, babylonjs-engine, blender-web-pipeline, lightweight-3d-effects… | router |
| **Diseño gráfico y marca** (4) | banner-design, brand, graphic-design, slides | router |
| **Marketing y SEO** (2) | email-html, marketing-seo | router |
| **Operaciones y despliegue** (1) | deploy-ops | router |
<!-- /GEN:resumen -->

## Instalación rápida

```text
# 1) Claude Code — plugin desde el marketplace (cualquier máquina/OS):
/plugin marketplace add petersonsenadevs/senzu
/plugin install senzu-all@senzu          # TODO el paquete (recomendado)
#   packs ligeros si no quieres todo: senzu-front, senzu-backend, senzu-core

# 2) ...y desde el plugin, la instalación COMPLETA del proyecto en un comando:
#    (abre Claude en tu proyecto y escribe)
/instalar                    # clona el repo si falta, detecta el stack y lo deja todo configurado

# Skills globales para Codex / Cursor / Windsurf (Windows PowerShell):
irm https://raw.githubusercontent.com/petersonsenadevs/senzu/main/tools/install.ps1 | iex

# Instalador interactivo: eliges todo, por categorías o a medida (skills, muros y comandos):
git clone https://github.com/petersonsenadevs/senzu.git && node senzu/tools/init.mjs

# Manual por proyecto (equivalente a /instalar; Node = Windows, WSL, Linux y macOS):
git clone https://github.com/petersonsenadevs/senzu.git
node senzu/tools/init.mjs --stack laravel --path /ruta/mi-app --tools claude,codex
```

Requisitos, actualización y las vías al detalle: **[INSTALL.md](INSTALL.md)**.

---

## Los muros bloquean de verdad (no "recomiendan")

Lo peligroso no se le pide por favor al agente: un hook lo **deniega** con el motivo, antes de que ocurra.

```text
> git push origin main
[BLOQUEADO por Senzu] git push está prohibido sin aprobación explícita.

> netlify deploy --prod
[BLOQUEADO] Deploy a PRODUCCIÓN detectado. Requiere aprobación explícita del usuario
(checklist /desplegar: backup fresco verificado + plan de rollback + smoke posterior).

> it.only('calcula el total', ...)
[BLOQUEADO] Estás introduciendo .only en un test: un test enfocado que llega a CI
desactiva la suite en silencio.

> <span class="badge">AGENDA ABIERTA ESTE MES</span>
[BLOQUEADO] Badge de disponibilidad: urgencia falsa que delata web hecha con IA.
Lista negra: anti-ia.md (qué usar en su lugar).
```

También: secretos en código, `console.log` nuevos, migraciones ya desplegadas, archivos generados,
`rm -rf`, `chmod 777`, `curl|bash`, marcadores de conflicto, vetos del cliente en `gustos.md`…
**→ Todos los muros, uno a uno, con sus escapes: [docs/hooks.md](docs/hooks.md)**

## Pides en llano, el agente sabe qué leer

Sin invocar skills a mano: un enrutador con todas las skills registradas detecta la tarea y carga SOLO la
sección necesaria (disciplina de contexto: nada se lee entero).

| Tú dices… | El agente usa… |
|---|---|
| "haz la landing de la clínica" | `ui-ux-pro-max` — y ANTES te entrevista (brief) y te enseña 2 maquetas A/B |
| "los usuarios duplican pedidos con doble clic" | `code-quality` → receta de idempotencia y race conditions |
| "monta el webhook de Stripe" | `code-quality` → integraciones (verificación de firma, reintentos, idempotencia) |
| "dockeriza el proyecto y súbelo" | `deploy-ops` → Docker multi-stage + checklist de deploy (y el muro de producción) |
| "añade un chatbot que responda con nuestros docs" | `code-quality` → llm-apps (RAG, streaming, costes, evals) |
| "se ve roto en el móvil" | `ui-verify` → verificación 375px-primero con Playwright: geometría en px, menú usado de verdad, captura anotada + crítica visual |

**→ Todas las skills por grupo, con las señales que activan cada una: [docs/skills.md](docs/skills.md)**

## Sabe en qué proyecto está

- **Versiones reales**: detecta Laravel 11, React 19, Python 3.12… (también en monorepos) y aplica las
  prácticas de ESA versión — con aviso si algo está sin soporte (EOL).
- **Nuevo vs heredado**: proyecto vacío → brief + plan; proyecto con código → `/adoptar` analiza su
  estilo real, lo pacta contigo y lo **sella como inmutable** (un hook bloquea el código que lo viole).
- **Respeta lo que ya hay**: tu `CLAUDE.md`/`AGENTS.md`, tu diario, tu plan — pregunta antes de adaptarse.

## Diseño acompañado (y sin olor a IA)

Entrevista sin tecnicismos (`/brief`) → blueprint aprobable → **2 maquetas A/B** que se ven →
construcción con checkpoint por sección → verificación móvil-primero → checklist de lanzamiento.
La **versión móvil se piensa, no se encoge**: cada sección decide en el blueprint su orden, sus efectos en
táctil, su menú (burger, barra inferior; nunca kebab para navegar) y sus tamaños, y se vota como una pieza más.
La verificación **mide en píxeles** (centrado, loaders, iconos, alineación) y en móvil **usa el menú de
verdad** (lo abre, mide los enlaces, prueba Escape); cada aviso sale numerado sobre una **captura anotada**,
para confirmarlo mirándolo.
Tus opiniones van a una memoria de gustos con **vetos ejecutables**, y una **lista negra anti-IA**
(badges de disponibilidad, numeración de secciones, "trusted by" gris, métricas inventadas…) está
prohibida por defecto y vigilada por hook + crítica visual.
Y cuando la marca pide impacto, un **catálogo de efectos** con recetas por stack, incluida **física**: una
intro o un loader en el que cae tu logo y la pantalla se rompe en trozos de cristal, un objeto que cae
encima de la web y se queda apoyado, o una página que se desmorona; con demos que funcionan, saltables,
sin intro para quien pide menos movimiento y probados en móvil.

**→ Todos los comandos y los flujos completos: [docs/comandos.md](docs/comandos.md)**

## Documentación

| Documento | Qué encontrarás |
|---|---|
| **[docs/guia-de-prueba.md](docs/guia-de-prueba.md)** | **Empieza aquí**: instalar y probarlo todo en una tarde, prueba a prueba |
| **[INSTALL.md](INSTALL.md)** | Instalar paso a paso: por proyecto, como plugin o skills globales; actualizar |
| **[USO.md](USO.md)** | El día a día: qué es automático, qué frases activan cada cosa, muros y escapes |
| **[docs/skills.md](docs/skills.md)** | Las skills por grupo: cuándo salta cada una y con qué señales |
| **[docs/comandos.md](docs/comandos.md)** | Los comandos slash explicados + flujos típicos |
| **[docs/hooks.md](docs/hooks.md)** | Los hooks/muros: qué bloquea cada uno y sus escapes |
| **[docs/efectos.md](docs/efectos.md)** | El catálogo de efectos por categoría y las demos que funcionan (también en `docs/efectos.json`) |
| **[docs/stacks.md](docs/stacks.md)** | Los stacks (+ Go/Java/C#) y los bundles opcionales |
| **[docs/arquitectura.md](docs/arquitectura.md)** | Cómo funciona por dentro: registro único, vendor/overlay, disciplina de contexto |
| **[REFERENCIA.md](REFERENCIA.md)** | Todo el catálogo en UNA página |
| **[CREDITOS.md](CREDITOS.md)** | Los repositorios de terceros que usamos, con su autor y su licencia |
| **[CHANGELOG.md](CHANGELOG.md)** | Qué cambió en cada versión (generado del devlog) |
| **[ROADMAP.md](ROADMAP.md)** | Qué está hecho y qué viene |

> Los badges, `docs/`, `REFERENCIA.md` y `CHANGELOG.md` **se regeneran en cada commit desde las fuentes
> de verdad**: si añades una skill o un hook sin documentar, el build falla. La docu no puede mentir.

## Cómo se mantiene sano

Tres suites corren en cada commit (el pre-commit no deja pasar nada roto):

- `check-skills.ps1` — 11 checks de conectividad: registro ↔ skills 1:1, límites de tamaño, citas que resuelven.
- `test-router.ps1` — 51 casos dorados de "frase del usuario → skill correcta".
- `test-hooks.ps1` — 34 casos de los muros (lo que debe bloquear, bloquea; lo legítimo, pasa).

## Filosofía en una frase

El agente no "intenta acordarse" de las normas: **las normas viven en archivos versionados, se cargan
solas cuando tocan, y lo importante se bloquea por hook**. Cada error real de un proyecto vuelve aquí
como regla, muro o caso de test — el paquete aprende del uso.

## Créditos y licencia

Senzu es MIT ([LICENSE](LICENSE)) © 2026 Peterson Sena. Se apoya en el trabajo de otras personas, sobre
todo [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) y
[claudedesignskills](https://github.com/freshtechbro/claudedesignskills), además de 132 repositorios de
efectos: la lista completa, con autor y licencia, está en [CREDITOS.md](CREDITOS.md). Cada semana se
comprueba si hay versión nueva de esos repositorios (y que su licencia no haya cambiado) y se propone
la actualización en un pull request.
