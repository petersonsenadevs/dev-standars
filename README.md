# dev-standards

**El estándar de trabajo de la agencia convertido en sistema ejecutable para agentes de IA.**
Escribes las reglas UNA vez y viajan a Claude Code, Codex, Cursor, Windsurf y Antigravity — con
skills que se activan solas, muros que bloquean de verdad y verificación obligatoria antes de dar
nada por hecho.

![Skills](https://img.shields.io/badge/skills-41-blue) ![Stacks](https://img.shields.io/badge/stacks-9-green) ![Plugins](https://img.shields.io/badge/plugins_Claude-13-purple) ![Hooks](https://img.shields.io/badge/muros-13_hooks-red) ![Idioma](https://img.shields.io/badge/idioma-español-yellow)

## Qué hace por ti

- **Enrutamiento automático**: pides en llano ("mejora la página de precios") y el agente sabe qué
  skill leer, en qué orden y solo la sección necesaria. Sin invocar nada a mano.
- **Muros, no consejos**: git push, deploys a producción, secretos en código, `console.log`,
  tests desactivados con `.only`, librerías vetadas o clichés de "web hecha con IA" se **bloquean**
  con el motivo — no se "recomiendan evitar".
- **Consciente del proyecto**: detecta versiones reales (y avisa de EOL), si el proyecto es nuevo
  (→ brief + plan) o heredado (→ `/adoptar` sus convenciones y sellarlas), y respeta la guía y el
  diario que el proyecto ya tenga — preguntando antes de adaptarse.
- **Diseño acompañado**: entrevista sin tecnicismos, blueprint aprobable + maquetas A/B antes de
  construir, checkpoint por sección, memoria de gustos con vetos ejecutables y lista negra anti-IA.
- **Nada se da por hecho sin verificar**: build+lint+types+tests tras tocar código, verificación
  móvil-primero tras tocar UI, checklist de lanzamiento y deploy con red (backup + rollback + smoke).
- **Todo documentado solo**: cada paso deja devlog; el plan manda; esta docu se regenera en cada
  commit desde las fuentes — no puede mentir.

## Instalación rápida

```text
# Claude Code (plugin, cualquier máquina/OS):
/plugin marketplace add petersonsenadevs/dev-standars
/plugin install dev-standards-front@dev-standards        # o -core, -backend, -all, bundle-*

# Skills globales para Codex / Cursor / Windsurf (Windows PowerShell):
irm https://raw.githubusercontent.com/petersonsenadevs/dev-standars/main/tools/install.ps1 | iex

# Completa por proyecto (la recomendada: stacks, hooks, comandos, config):
git clone https://github.com/petersonsenadevs/dev-standars.git
.\dev-standars\tools\init-project.ps1 -Stack laravel -Path "D:\proyectos\mi-app" -Tools claude,codex
```

Detalle de cada vía, requisitos y actualización: **[INSTALL.md](INSTALL.md)**.

## Documentación

| Documento | Qué encontrarás |
|---|---|
| **[INSTALL.md](INSTALL.md)** | Instalar paso a paso: por proyecto, como plugin o skills globales; actualizar |
| **[USO.md](USO.md)** | El día a día: qué es automático, qué frases activan cada cosa, los muros y sus escapes |
| **[docs/skills.md](docs/skills.md)** | Las 41 skills por grupo: cuándo salta cada una y con qué señales (enrutamiento) |
| **[docs/comandos.md](docs/comandos.md)** | Los 12 comandos slash con su explicación y los flujos típicos |
| **[docs/hooks.md](docs/hooks.md)** | Los 13 hooks/muros: qué bloquea cada uno y sus escapes |
| **[docs/stacks.md](docs/stacks.md)** | Los 9 stacks (+ Go/Java/C# como referencias) y los bundles opcionales |
| **[docs/arquitectura.md](docs/arquitectura.md)** | Cómo funciona por dentro: registro único, capas vendor/overlay, disciplina de contexto, paridad entre herramientas |
| **[REFERENCIA.md](REFERENCIA.md)** | Todo el catálogo en UNA página (para leer del tirón) |
| **[ROADMAP.md](ROADMAP.md)** | Qué está hecho y qué viene |
| `devlog/` | La historia completa de decisiones, entrada a entrada (42 y subiendo) |

> `docs/`, `REFERENCIA.md` y los `plugins/` **se generan desde las fuentes de verdad en cada commit**
> (`tools/build-docs.ps1` + pre-commit): si añades una skill o un hook sin documentar, el build falla.

## Cómo se mantiene sano

Tres suites corren en cada commit (el pre-commit no deja pasar nada roto):

- `check-skills.ps1` — 11 checks de conectividad: registro ↔ skills 1:1, límites de tamaño, citas y
  referencias que resuelven, tablas generadas al día.
- `test-router.ps1` — 51 casos dorados de "frase del usuario → skill correcta".
- `test-hooks.ps1` — 34 casos de los muros (lo que debe bloquear, bloquea; lo legítimo, pasa).

## Filosofía en una frase

El agente no "intenta acordarse" de las normas: **las normas viven en archivos versionados, se cargan
solas cuando tocan, y lo importante se bloquea por hook** — lo demás es documentación que se regenera
para no mentir. Cada error real de un proyecto vuelve aquí como regla, muro o caso de test.
