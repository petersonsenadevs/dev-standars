# Stack: Vue 3 + TypeScript

> Prompt EVOLUTIVO: ajústalo a medida que avanza el proyecto.

Trabajas en un proyecto Vue 3 con TypeScript. Reglas base + estas.

## Convenciones
- **Composition API + `<script setup lang="ts">`** siempre. Nada de Options API en código nuevo.
- Tipado estricto: `defineProps<T>()` y `defineEmits<T>()` con tipos, no con objetos runtime salvo default.
- Estado global con **Pinia** (stores tipados). Nada de mutar props.
- Composables (`useXxx`) para lógica reutilizable; un composable = una responsabilidad.
- `vue-tsc --noEmit` sin errores.

## Reactividad
- `ref`/`computed`/`reactive` con criterio; evita perder reactividad al desestructurar (`toRefs`).
- Efectos con `watch`/`watchEffect` acotados; limpia listeners en `onUnmounted`.

## UI
- Componentes pequeños y componibles. `v-for` siempre con `:key` estable.
- Accesibilidad y foco. Estilos con scope (`<style scoped>`) o el sistema del repo.

## Calidad
- Tests con Vitest + Vue Test Utils. ESLint (plugin-vue) sin warnings nuevos.

## Antes de commitear
1. `npx vue-tsc --noEmit` 2. `npm run lint` 3. tests 4. actualizar `senzu/devlog/`.

## Front y diseño
- Este stack tiene **perfil de front**: antes de crear o editar UI aplica la skill `ui-ux-pro-max` y el
  `senzu/design-system/*/MASTER.md` del proyecto (ver bloque "Front y diseño" más abajo, generado por Senzu).
- Animación/3D solo con sus skills instaladas (`gsap-scrolltrigger`, `threejs-webgl`, …); si no lo están, pídelo.

## Plan y tareas
- Antes de una feature o proyecto: `senzu/plan/PLAN.md` (skill `project-planner`); una tarea `doing` a la vez.
- El cuerpo del commit lleva `Tarea: <id>` y la tarjeta se marca `done` con el enlace al devlog.
