# Guía de uso diario (para el usuario)

Instalación: [`INSTALL.md`](INSTALL.md). Esto es lo que haces DESPUÉS, en el día a día.
Regla de oro: **no tienes que activar nada** — con el proyecto sincronizado y una sesión nueva,
el agente se entera solo (router, hooks y skills). Los comandos slash son atajos, no requisitos.

## 1. Lo único que ejecutas tú (mantenimiento)

| Cuándo | Comando |
|---|---|
| Una vez por proyecto | `D:\dev-standards\tools\init-project.ps1 -Stack <stack> -Path <ruta> -Tools claude,codex` |
| Stacks disponibles | `laravel` · `next` · `astro` · `vue-ts` · `nuxt` · `sveltekit` · `wordpress` · `node-api` · `python-langgraph` (Go/Java/C# como referencias de code-quality) |
| Tras cada mejora de dev-standards | `D:\dev-standards\tools\sync.ps1 -Path <ruta>` **+ sesión nueva del agente** |
| Refrescar la colección de efectos | `D:\dev-standards\tools\vendor-effects.ps1 -Missing` |
| Ver que el paquete está sano | `tools\check-skills.ps1` + `tools\test-router.ps1` |
| Catálogo completo (skills, enrutamiento, comandos, muros) | [`REFERENCIA.md`](REFERENCIA.md) (generado, siempre al día) |

## 2. Qué pasa solo (sin comandos) en Claude Code

- **Router**: cada petición tuya en llano sugiere al agente la skill correcta ("mejora la página" →
  ui-ux-pro-max; "webhook de stripe" → code-quality; "genera una imagen" → image-gen).
- **Brief forzado**: si va a diseñar sin brief ni design system, el hook le obliga a preguntarte primero
  (marca, 2-3 webs que te gusten, objetivo). No inventa la dirección visual.
- **Cierre bloqueado**: no puede dar nada por terminado sin (a) build/lint/types/tests en verde si tocó
  código, (b) verificación móvil-primero si tocó UI, (c) devlog del día escrito.
- **Guard**: nada destructivo (push, resets, DROP) sin tu aprobación; secretos y archivos protegidos vetados;
  comandos devops peligrosos bloqueados (`curl|bash`, `chmod 777`, `dd` a discos, `mkfs`, `docker prune`,
  parar servicios, vaciar el firewall, `crontab -r`). Los hooks son Node (`.mjs`): funcionan igual en
  Windows, macOS y Linux.
- **Muros nuevos**: jQuery/Bootstrap bloqueados al instalar (salvo aprobación explícita); `console.log`/`dd()`/
  `debugger` bloqueados al introducirse en código fuente; los términos entre acentos graves en la sección "No"
  de `gustos.md` se bloquean de verdad; primera edición de UI sin brief ni design system → muro (una vez por sesión); deploy a producción
  (`--prod`) bloqueado hasta tu aprobación explícita.
- **Memoria de gustos**: tus opiniones de diseño van a `design-system/<slug>/gustos.md`; un veto no se re-propone.
- **Consciente de versiones**: al arrancar la sesión detecta las versiones reales (PHP/Laravel/Node/framework)
  y avisa si algo está sin soporte (EOL); el agente aplica las prácticas de ESA versión, no de la última.
- **Convenciones adoptadas** (`/adoptar`): en proyectos heredados, las convenciones se analizan, se pactan
  contigo y se sellan como inmutables; el hook `conventions-guard` bloquea el código que las viole.

## 3. Comandos slash (Claude Code) — atajos

| Comando | Para qué | Cuándo usarlo |
|---|---|---|
| `/plan` | Crea/retoma `plan/PLAN.md` con tarjetas | Proyecto o feature nueva |
| `/siguiente` | Coge la siguiente tarjeta del plan | Cada vez que quieras avanzar |
| `/brief` | Entrevista en llano (sin palabreo técnico) | Antes de diseñar nada nuevo |
| `/propuestas [página]` | Blueprint aprobable + 2 maquetas A/B que se VEN | Proyecto nuevo, rediseño, o "no sé lo que quiero" |
| `/design-system [keywords]` | Genera/revisa el design system persistido | Al fijar la dirección visual |
| `/efecto [nombre]` | Efecto concreto vía catálogo (receta + coste móvil) | "Quiero un parallax/marquee/lo-que-sea" |
| `/verificar` | Build+lint+types+tests, y móvil si hubo UI | Antes de dar algo por terminado (o deja que el bloqueo lo pida) |
| `/desplegar [entorno]` | Deploy con red: PRE (backup+rollback+aprobación) → deploy → smoke POST | Cada subida a producción |
| `/adoptar [notas]` | Analiza un proyecto existente y sella sus convenciones como regla inmutable (+ hook que las hace cumplir) | Al entrar en un proyecto heredado |
| `/revisar-ui [url]` | Pasada de UI en navegador (375/768/1440, dark, consola, axe) | "Revisa cómo se ve" |

## 4. Frases en llano que activan cada cosa (sin slash)

- "haz la web / landing / página de …" → diseño completo con brief primero.
- "enséñame dos propuestas antes" → modo propuesta (maquetas A/B).
- "que se vea moderna / tipo bento / con un fondo aurora" → recetario del look moderno.
- "ponle [efecto]: parallax, marquee, antes/después, cursor, texto que se deshace…" → catálogo → receta.
- "genera una imagen del producto flotando para el hero" → image-gen (nativo o script).
- "¿qué framework uso para …?" → árbol A0 de elección de stack.
- "se ve mal en el móvil" → ui-verify.
- "añade login / el webhook de stripe / se duplican pedidos / va lento" → recetas backend por síntoma.
- "no me gusta X / nunca me pongas Y" → queda vetado en gustos.md.

## 5. Flujos típicos de principio a fin

**Web nueva**: `/brief` → `/propuestas home` (apruebas blueprint, eliges maqueta A/B) → el agente construye
→ `/verificar` (+ móvil) → devlog → commit (te lo pedirá, nunca push sin tu ok).

**Rediseño de algo existente**: "quiero renovar la página X" → brief corto + `/propuestas X` →
construir sobre la elegida.

**Solo un efecto**: `/efecto marquee de logos` (o pedirlo en llano) → receta + coste móvil → implementa →
verificación móvil obligatoria.

**Imágenes para la web**: pide la imagen describiendo dónde va ("para el hero, el producto flotando");
la paleta sale sola del design system. En la app de ChatGPT/Codex la genera nativa; en CLI usa tu API key.

**Bug/feature de backend**: descríbelo con tus palabras ("los usuarios duplican pedidos") → receta exacta
→ arregla → `/verificar` bloquea el cierre hasta tests en verde.

## 6. En Codex (diferencias honestas)

- Las skills están (AGENTS.md + `.agents/skills/`) y se autodescubren por descripción, **pero no hay
  hooks**: ni router ni bloqueos automáticos. Sé un punto más explícito: "usa la skill image-gen",
  `$ui-ux-pro-max`, o pide "verifica el build" (script: `node .agents/skills/code-quality/scripts/verify-build.mjs`).
- Los comandos slash son de Claude Code; en Codex pide lo mismo en llano.

## 7. Mapa de dónde vive cada cosa (por si quieres mirar)

`design-system/<slug>/` → BRAND.md (marca) · gustos.md (tus vetos) · blueprint.md · propuestas/ (maquetas) ·
MASTER.md (tokens) · prompts.md (imágenes) — `plan/` → PLAN.md y brief.md — `devlog/` → diario del proyecto —
En dev-standards: `core/effects-vendor/INDEX.md` (124 carpetas de efectos) · `front-activation/references/`
(catálogo y fuentes) · `code-quality/references/backend-catalog.md` (backend por síntoma).
