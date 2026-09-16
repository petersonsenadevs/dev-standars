# Vue 3.5 + TypeScript: buenas prácticas

## Índice

- [script setup y tipado de props/emits](#script-setup-y-tipado-de-propsemits)
- [defineModel y v-model](#definemodel-y-v-model)
- [Reactividad: ref, reactive, computed](#reactividad-ref-reactive-computed)
- [watch vs watchEffect](#watch-vs-watcheffect)
- [Pitfalls de reactividad](#pitfalls-de-reactividad)
- [Composables](#composables)
- [Pinia con setup stores](#pinia-con-setup-stores)
- [provide/inject tipado](#provideinject-tipado)
- [Slots y composición](#slots-y-composición)
- [Templates: reglas](#templates-reglas)
- [Rendimiento](#rendimiento)
- [Testing](#testing)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Tooling](#tooling)

## script setup y tipado de props/emits

- Siempre `<script setup lang="ts">`. Options API solo en legado.
- Props con genéricos de tipo y `withDefaults` o, en 3.5+, desestructuración reactiva con valores por defecto:

```vue
<script setup lang="ts">
interface Props {
  items: readonly Item[];
  pageSize?: number;
  variant?: "compact" | "full";
}
const { items, pageSize = 20, variant = "full" } = defineProps<Props>();

const emit = defineEmits<{
  select: [item: Item];
  "update:page": [page: number];
}>();
</script>
```

- Props son de solo lectura: nunca las mutes ni las asignes a un `ref` para "editarlas" sin sincronizar (usa `defineModel` o emite).
- Emits tipados con sintaxis de tupla; nombres en `kebab-case` en templates, `camelCase` en TS.
- `defineExpose` solo para lo que un padre necesita mediante ref de plantilla (p. ej. `focus()`); por defecto no expongas nada.
- Un componente = un archivo `.vue` en `PascalCase.vue`; multi-palabra siempre (`UserCard`, no `Card`) para evitar colisiones con HTML.

## defineModel y v-model

- `defineModel<T>()` sustituye a `props.modelValue` + `emit('update:modelValue')`. Soporta múltiples modelos con nombre y modificadores.

```ts
const value = defineModel<string>({ required: true });
const checked = defineModel<boolean>("checked", { default: false });
```

- Para transformar (trim, número), usa la firma `[model, modifiers] = defineModel({ set(v) {...} })`.
- No uses `v-model` sobre props anidadas de objetos (`v-model="form.user.name"` está bien; `v-model="props.user.name"` no).

## Reactividad: ref, reactive, computed

- `ref` por defecto para todo (primitivos y objetos). `reactive` solo para objetos que nunca reasignarás y que quieres desestructurar con `toRefs`.
- `reactive` pierde reactividad al desestructurar o reasignar (`state = {...}`); `ref` no.
- `computed` para todo valor derivado. Debe ser puro: sin efectos secundarios, sin llamadas async, sin mutar otro estado.
- `computed` con setter solo para proxies de v-model; no lo uses como "estado con validación".
- `shallowRef` para estructuras grandes que reemplazas enteras (listas de miles de filas, respuestas de API) y para instancias de clases externas (mapas, editores).
- `readonly()` al exponer estado desde composables/stores si el consumidor no debe mutarlo.
- Tipa refs con genéricos cuando el valor inicial no basta: `ref<User | null>(null)`.

## watch vs watchEffect

- `watch(source, cb)` cuando: necesitas el valor anterior, quieres lazy (no ejecutar al inicio), o vigilas fuentes concretas. Preferido en la mayoría de casos por su explicitud.
- `watchEffect` cuando el efecto lee varias fuentes y quieres que se rastreen automáticamente; asume que se ejecuta al inicio.
- Ambos deben usarse para efectos secundarios (fetch, localStorage, DOM), nunca para derivar estado (eso es `computed`).
- `watch` con `{ deep: true }` es caro: vigila una propiedad concreta o un `computed` que la resuma. En 3.5 puedes usar `deep: N` para limitar profundidad.
- Cancelación: usa `onWatcherCleanup` (3.5) o la función `onCleanup` del callback para abortar fetches obsoletos.
- `{ flush: 'post' }` si necesitas el DOM actualizado; `'sync'` casi nunca.

```ts
watch(query, async (q, _prev, onCleanup) => {
  const ctrl = new AbortController();
  onCleanup(() => ctrl.abort());
  results.value = await search(q, ctrl.signal);
});
```

## Pitfalls de reactividad

- Desestructurar `props` o un `reactive` sin `toRefs` rompe la reactividad (excepto la desestructuración de `defineProps` en 3.5+, que el compilador transforma).
- Leer `.value` en templates no hace falta; en `<script>` sí. Los refs dentro de `reactive` se desenvuelven; dentro de arrays/Maps no.
- Asignar un objeto reactivo a otra variable no lo copia: mutaciones afectan a ambos.
- `watch` sobre `ref` de objeto no dispara por mutaciones internas salvo `deep`; vigila `() => obj.value.prop`.
- No mutes estado en `computed` ni en el render; Vue lo detectará como bucle o dará resultados inconsistentes.
- Nunca guardes componentes en `ref` normal (usa `shallowRef` o `markRaw`): proxies profundos sobre instancias son caros y rompen cosas.
- `nextTick()` para leer el DOM tras cambiar estado; no `setTimeout(0)`.

## Composables

- Un composable = una preocupación (`useFetch`, `usePagination`, `useClipboard`). Nombre `useX`, en `composables/useX.ts`.
- Devuelven un **objeto de refs** (no `reactive`) para que el consumidor pueda desestructurar sin perder reactividad. Añade `readonly` a lo que no deba mutarse desde fuera.
- Aceptan `MaybeRefOrGetter<T>` y normalizan con `toValue()`, para que funcionen con valores, refs o getters.
- Los efectos y listeners que registran deben limpiarse con `onScopeDispose` / `onUnmounted`. Un composable solo debe llamarse en `setup` (síncrono) o en otro composable.
- Sin estado global escondido dentro de un composable (módulo con `ref` compartido): si es global, es una store de Pinia.
- Prefiere VueUse antes de escribir el tuyo (`useDebounceFn`, `useLocalStorage`, `useIntersectionObserver`).

```ts
export function usePagination(total: MaybeRefOrGetter<number>, pageSize = 20) {
  const page = ref(1);
  const pages = computed(() => Math.ceil(toValue(total) / pageSize));
  const next = () => { if (page.value < pages.value) page.value++; };
  return { page: readonly(page), pages, next };
}
```

## Pinia con setup stores

- Setup stores (función) sobre option stores: mismo modelo mental que composables y mejor inferencia de tipos.
- Una store por dominio (`useCartStore`, `useSessionStore`), no una "app store" global.
- Devuelve **todo** el estado desde el setup (Pinia lo necesita para devtools/SSR); marca como privado con `_` lo que no forme parte del contrato o exponlo con `readonly`.
- Acciones asíncronas viven en la store; manejan `loading`/`error` como estado explícito (idealmente una unión discriminada).
- Al desestructurar una store en componentes usa `storeToRefs(store)` para estado y computed; las acciones se pueden desestructurar directamente.
- Sin acceso a `router` o a componentes desde la store; inyecta dependencias (API client) por plugin de Pinia o por argumento.
- Persistencia con `pinia-plugin-persistedstate` solo para lo necesario (nunca tokens sensibles en `localStorage` si puedes evitarlo).

```ts
export const useCartStore = defineStore("cart", () => {
  const items = ref<CartItem[]>([]);
  const total = computed(() => items.value.reduce((s, i) => s + i.price * i.qty, 0));
  function add(item: CartItem) { /* ... */ }
  return { items, total, add };
});
```

## provide/inject tipado

- Usa `InjectionKey<T>` en un módulo compartido; nunca strings sueltos.

```ts
export const ThemeKey: InjectionKey<Ref<"light" | "dark">> = Symbol("theme");
// padre
provide(ThemeKey, theme);
// hijo
const theme = inject(ThemeKey); // Ref<...> | undefined
```

- Trata `inject` sin valor por defecto como posible `undefined` y falla pronto con un mensaje claro, o pasa un default.
- Provee `readonly` refs si los hijos no deben mutar; expón funciones de mutación explícitas junto al estado.
- `provide/inject` para dependencias de subárbol (formularios, tablas, tema); para estado de app, Pinia.

## Slots y composición

- Slots con nombre y scoped slots tipados con `defineSlots<{ default(props: { item: Item }): any }>()`.
- Diseña componentes "contenedor" que reciben contenido por slots en lugar de props de configuración interminables.
- Renderless components / composables para lógica reutilizable sin imponer marcado.
- `$attrs` fallthrough: desactiva `inheritAttrs` y usa `v-bind="$attrs"` en el elemento raíz correcto cuando el componente tiene varios nodos raíz o un wrapper.

## Templates: reglas

- `v-for` siempre con `:key` estable (ID, nunca índice si la lista cambia).
- No combines `v-if` y `v-for` en el mismo elemento (en Vue 3, `v-if` tiene prioridad y no ve la variable del bucle).
- Expresiones en template simples; si necesitas más de una operación, crea un `computed` o un método.
- Sin `v-html` con contenido de usuario (XSS); si es inevitable, sanitiza con DOMPurify.
- Directivas custom solo para manipulación de DOM de bajo nivel (`v-focus`, `v-click-outside`).
- Estilos `scoped` o CSS Modules; `:deep()` con moderación y comentario.

## Rendimiento

- `shallowRef`/`shallowReactive` para colecciones grandes; reemplaza en vez de mutar profundamente.
- `v-memo="[dep]"` en filas de listas grandes que solo cambian si `dep` cambia; `v-once` para contenido estático.
- Virtualiza listas > ~500 filas (`@tanstack/vue-virtual`, `vue-virtual-scroller`).
- `defineAsyncComponent` + `<Suspense>` para componentes pesados y rutas lazy (`() => import(...)` en el router).
- Evita `computed` que crean arrays nuevos en cada acceso dentro de plantillas de listas anidadas.
- `KeepAlive` con `include` acotado para conservar estado de tabs/rutas; no envuelvas todo.
- Mide con Vue DevTools (timeline, component render) antes de optimizar.

## Testing

- Vitest + Vue Test Utils (`mount`), o Testing Library Vue si prefieres queries por rol.
- Testea salida y comportamiento: emits (`wrapper.emitted("select")`), DOM, interacción (`await wrapper.find("button").trigger("click")`). Nunca `wrapper.vm.internalState`.
- Pinia: `createTestingPinia({ stubActions: false })` para probar integración real, o con stubs para aislar el componente.
- Composables: pruébalos dentro de un componente mínimo o con `withSetup` helper para tener ciclo de vida; usa `flushPromises()` tras async.
- Mockea HTTP con MSW, no el módulo del cliente.
- Componentes con `<Suspense>`/async setup: envuelve en un `Suspense` en el test y espera `flushPromises`.
- E2E: Playwright para flujos críticos; `getByRole`, sin selectores CSS frágiles.
- Comandos: `vitest run --coverage`, `vue-tsc --noEmit` en CI (Vite no comprueba tipos).

## Estructura de carpetas

```
src/
  app/            # main.ts, router, plugins, providers globales
  features/<f>/   # components/, composables/, stores/, api/, types.ts
  components/ui/  # base (BaseButton, BaseDialog), sin lógica de negocio
  composables/    # transversales (useAuth, useToast)
  stores/         # solo stores realmente globales (session)
  lib/            # http client, utils puras, schemas zod
  pages/          # vistas de ruta (delgadas, componen features)
```

- Import por alias `@/`; sin importaciones relativas de más de dos niveles (`../../..`).
- `features/` no se importan entre sí directamente; comparten por `lib/` o `components/ui`.

## Tooling

- `vue-tsc` en CI; `strict: true` y `noUncheckedIndexedAccess` en tsconfig.
- ESLint flat config con `eslint-plugin-vue` (`flat/recommended`) + `typescript-eslint` `strictTypeChecked` + `eslint-plugin-vuejs-accessibility`.
- Reglas clave: `vue/require-explicit-emits`, `vue/no-mutating-props`, `vue/no-unused-properties`, `vue/block-order` (`script`, `template`, `style`), `vue/component-name-in-template-casing` (PascalCase).
- Volar (Vue - Official) en el editor; Prettier para formato.
- Nuxt 3/4 si necesitas SSR: mismas reglas, con `useFetch`/`useAsyncData` en lugar de fetch en `onMounted`.
