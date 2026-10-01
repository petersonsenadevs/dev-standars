# Stack: SvelteKit + Svelte 5

> Este prompt es EVOLUTIVO: se ajusta a medida que avanza el proyecto (quitar/añadir indicaciones).

Trabajas en un proyecto SvelteKit. Sigue las reglas base + estas específicas.

## Convenciones
- **Mira la versión de Svelte primero** (package.json): Svelte 5 = **runes** (`$state`, `$derived`,
  `$effect`, `$props`); Svelte 4 = `let` reactivo, `$:` y stores. NO mezcles los dos estilos.
- TypeScript estricto; `<script lang="ts">` en todos los componentes.
- Convenciones de Kit: `+page.svelte` / `+page.ts` (load universal) / `+page.server.ts` (load servidor +
  actions) / `+layout*` / `+server.ts` (endpoints). Los datos de página vienen del `load`, no de fetch en el componente.
- Formularios con **form actions** + `use:enhance` (progressive enhancement), no submit a mano con fetch.
- Estado compartido: runes en `.svelte.ts` (Svelte 5) o stores (`$lib/stores`) en 4; nada global a mano.
- `$lib` para imports; assets estáticos en `static/`.

## Server
- Lo secreto SOLO en `+page.server.ts` / `+server.ts` / `$env/static/private`; jamás en load universal.
- Valida en actions/endpoints con zod; devuelve `fail(400, ...)` con errores por campo.
- `hooks.server.ts` para auth/sesión; protege rutas en el load de servidor del layout correspondiente.

## Antes de dar por hecho
1. `npm run lint` 2. `npm run check` (svelte-check) 3. `npm run build` 4. `senzu/devlog/`.

## Front y diseño
- Este stack tiene **perfil de front**: antes de crear o editar UI aplica la skill `ui-ux-pro-max` y el
  `senzu/design-system/*/MASTER.md` del proyecto (ver bloque "Front y diseño" generado por Senzu).
- Animación/3D solo con sus skills instaladas (`gsap-scrolltrigger`, `threejs-webgl`, …); si no lo están, pídelo.

## Plan y tareas
- Antes de una feature o proyecto: `senzu/plan/PLAN.md` (skill `project-planner`); una tarea `doing` a la vez.
- El cuerpo del commit lleva `Tarea: <id>` y la tarjeta se marca `done` con el enlace al devlog.
