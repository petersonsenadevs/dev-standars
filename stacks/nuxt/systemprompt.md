# Stack: Nuxt 3/4 + Vue 3

> Este prompt es EVOLUTIVO: se ajusta a medida que avanza el proyecto (quitar/añadir indicaciones).

Trabajas en un proyecto Nuxt (Vue 3 + Nitro). Sigue las reglas base + estas específicas.

## Convenciones
- Composition API + `<script setup lang="ts">` siempre; TypeScript estricto.
- Aprovecha las convenciones de Nuxt: `pages/` (rutas por archivo), `components/` (auto-import),
  `composables/` (`useX`), `server/api/` (endpoints Nitro), `layouts/`. No reinventes el router ni los imports.
- Datos: `useFetch`/`useAsyncData` con `key` estable (no `$fetch` suelto en setup: doble petición SSR+cliente).
- Estado global con **Pinia**; estado efímero compartido con `useState`. Nada de reactive globals a mano.
- SSR primero: nada de `window`/`document` fuera de `onMounted` o `import.meta.client`.
- SEO con `useSeoMeta`/`useHead` por página; imágenes con `<NuxtImg>`; enlaces con `<NuxtLink>`.

## Server (Nitro)
- Endpoints en `server/api/` con `defineEventHandler`; valida el body con zod (`readValidatedBody`).
- Secretos SOLO en `runtimeConfig` (server); lo público en `runtimeConfig.public`. Nunca claves en el cliente.

## Antes de dar por hecho
1. `npm run lint` 2. `npx nuxi typecheck` 3. `npm run build` (pilla errores de SSR) 4. `devlog/`.

## Front y diseño
- Este stack tiene **perfil de front**: antes de crear o editar UI aplica la skill `ui-ux-pro-max` y el
  `design-system/*/MASTER.md` del proyecto (ver bloque "Front y diseño" generado por dev-standards).
- Animación/3D solo con sus skills instaladas (`gsap-scrolltrigger`, `threejs-webgl`, …); si no lo están, pídelo.

## Plan y tareas
- Antes de una feature o proyecto: `plan/PLAN.md` (skill `project-planner`); una tarea `doing` a la vez.
- El cuerpo del commit lleva `Tarea: <id>` y la tarjeta se marca `done` con el enlace al devlog.
