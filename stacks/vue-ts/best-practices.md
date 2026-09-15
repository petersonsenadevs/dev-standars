# Mejores prácticas — Vue 3 + TS

## Componentes
- `<script setup lang="ts">`. Props/emits tipados con genéricos. `withDefaults` para defaults.
- Un componente = una responsabilidad. Extrae lógica a composables.
- `:key` estable en `v-for`. Evita `v-if` + `v-for` en el mismo nodo.

## Reactividad
- `computed` para derivados (no métodos en template para cálculos). `toRefs` al desestructurar reactive.
- `watch` con `{ immediate, deep }` sólo cuando haga falta; limpia efectos.

## Estado
- Pinia con stores tipados; getters/acciones claras. No compartir estado por variables globales sueltas.
- Composables para lógica compartida (`useAuth`, `useFetch`…).

## TypeScript
- `strict`. Tipa respuestas de API en el borde. Sin `any`.

## Testing
- Vitest + Vue Test Utils. Testea composables como funciones puras y componentes por comportamiento.

## Rendimiento
- `defineAsyncComponent` para carga diferida. `v-once`/`v-memo` en listas costosas. Evita watchers profundos innecesarios.

> Detalle y ejemplos bajo demanda: skill `code-quality` → `references/vue.md` (+ `testing.md`, `security-owasp.md`, `performance.md`, `api-design.md`).
