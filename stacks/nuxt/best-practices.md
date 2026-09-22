# Mejores prácticas — Nuxt

## Datos y SSR
- `useFetch`/`useAsyncData` (con `key`) para datos de página; `$fetch` solo en handlers de eventos.
- `lazy: true` + estados de carga para lo no crítico; `server: false` para lo puramente cliente.
- Cachea en Nitro (`cachedEventHandler`, `routeRules` con `swr`/`isr`) lo costoso; no en el componente.
- `routeRules` para decidir por ruta: estático (`prerender`), SWR, SPA (`ssr: false`) — no todo el sitio igual.

## Componentes
- Auto-import: nombres por carpeta (`components/ui/Button.vue` → `<UiButton>`); no imports manuales redundantes.
- Props tipadas con `defineProps<T>()`; eventos con `defineEmits<T>()`; `defineModel` para v-model.
- Slots para composición; evita prop drilling con provide/inject tipado o Pinia.

## Rendimiento
- `<NuxtImg>`/`<NuxtPicture>` con tamaños; fuentes con `@nuxt/fonts`; `<LazyComponente>` para bajo el fold.
- Payload pequeño: no pases datasets enteros del server al cliente (selecciona campos en el endpoint).

## Módulos
- Antes de escribir a mano, mira si hay módulo oficial (@nuxt/image, @nuxtjs/i18n, @nuxt/content,
  @nuxtjs/sitemap…) — pero cada módulo se justifica, no se colecciona.

## Testing
- Vitest + @vue/test-utils para composables/componentes; @nuxt/test-utils para e2e ligero de rutas críticas.

## Seguridad
- Validación en `server/api` SIEMPRE (el cliente miente); auth con nuxt-auth-utils o middleware propio de servidor.
- Nada de secretos en `public`; CSRF si hay cookies de sesión.

> Detalle y ejemplos bajo demanda: skill `code-quality` → `references/nuxt.md` (+ `vue.md`, `api-design.md`, `performance.md`).
