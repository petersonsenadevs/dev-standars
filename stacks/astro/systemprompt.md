# Stack: Astro

> Prompt EVOLUTIVO: ajústalo a medida que avanza el proyecto.

Trabajas en un proyecto Astro. Reglas base + estas.

## Convenciones
- Islands architecture: **HTML estático por defecto**, JS solo en islas con `client:*`
  (`client:load`, `client:visible`, `client:idle`). Usa la directiva más perezosa posible.
- Componentes `.astro` para estructura; frameworks (React/Vue/Svelte) solo en islas interactivas.
- Content Collections (`src/content/`) con esquemas `zod` para contenido tipado.
- TypeScript estricto. `astro check` sin errores.

## Rendimiento (la razón de usar Astro)
- Minimiza el JS enviado. No hidrates lo que no necesita interactividad.
- Imágenes con `astro:assets` (`<Image />`). Prefetch para navegación.

## Datos
- Fetch en build (SSG) o en endpoints/SSR según el `output` configurado.
- Endpoints en `src/pages/**/*.ts` para APIs; valida entrada.

## Antes de commitear
1. `npx astro check` 2. `npm run lint` 3. `npm run build` 4. actualizar `devlog/`.

## Front y diseño
- Este stack tiene **perfil de front**: antes de crear o editar UI aplica la skill `ui-ux-pro-max` y el
  `design-system/*/MASTER.md` del proyecto (ver bloque "Front y diseño" más abajo, generado por dev-standards).
- Animación/3D solo con sus skills instaladas (`gsap-scrolltrigger`, `threejs-webgl`, …); si no lo están, pídelo.

## Plan y tareas
- Antes de una feature o proyecto: `plan/PLAN.md` (skill `project-planner`); una tarea `doing` a la vez.
- El cuerpo del commit lleva `Tarea: <id>` y la tarjeta se marca `done` con el enlace al devlog.
