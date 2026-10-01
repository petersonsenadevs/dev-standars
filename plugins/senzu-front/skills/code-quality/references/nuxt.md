# Nuxt 3/4: recetas (Vue 3 + Nitro)

Índice: 1 Datos (useFetch vs $fetch) · 2 routeRules por página · 3 Server routes · 4 Estado ·
5 SEO e imágenes · 6 Errores · 7 Errores típicos del agente

## 1. Datos: useFetch vs $fetch
- **Página necesita datos** → `useFetch('/api/x', { key: 'x' })` o `useAsyncData` (SSR + hidratación sin doble petición).
- **Evento del usuario** (submit, click) → `$fetch` en el handler.
- `lazy: true` + `<div v-if="status === 'pending'">` para no bloquear la navegación en lo secundario.
- Refresco tras mutación: `refresh()` del propio useFetch o `refreshNuxtData('key')`.
- `transform:` para quedarte solo con los campos que la página usa (payload más pequeño).

## 2. routeRules por página (nuxt.config)
```ts
routeRules: {
  '/':            { prerender: true },          // estática en build
  '/blog/**':     { isr: 3600 },                // regenerada cada hora
  '/api/**':      { cors: true },
  '/panel/**':    { ssr: false },               // SPA para el área privada
}
```
Decide por ruta, no un modo global para todo el sitio.

## 3. Server routes (Nitro)
```ts
// server/api/contacto.post.ts
const Body = z.object({ email: z.string().email(), mensaje: z.string().min(10) });
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Body.parse);   // 422 automático si no valida
  const config = useRuntimeConfig();                          // secretos server-only
  // ...
});
```
- Secretos en `runtimeConfig` (mapeados de `NUXT_*` env); lo que ve el navegador, en `runtimeConfig.public`.
- `cachedEventHandler` / `defineCachedFunction` para endpoints costosos con TTL.
- Auth: `nuxt-auth-utils` (sesión sellada en cookie) o middleware de servidor propio; protege en servidor, no solo con middleware de cliente.

## 4. Estado
- Pinia para dominio (carrito, usuario); `useState('clave', () => ...)` para estado SSR-safe puntual.
- Nunca `ref` exportado de un módulo (se comparte entre requests en SSR = fuga entre usuarios).

## 5. SEO e imágenes
- `useSeoMeta({ title, ogTitle, description, ogImage })` por página; `useHead` para lo estructural.
- `<NuxtImg>` con `width/height/sizes` (evita CLS); `@nuxt/fonts` para fuentes sin FOUT.
- i18n con `@nuxtjs/i18n` (prefijos de ruta + hreflang automático) — ver también `i18n.md`.

## 6. Errores
- `createError({ statusCode: 404, statusMessage: 'No existe' })` en server routes y load; `error.vue` global.
- `<NuxtErrorBoundary>` para aislar fallos de una sección sin tumbar la página.

## 7. Errores típicos del agente
- `$fetch` en setup (doble petición SSR+cliente) · `window` fuera de `onMounted`/`import.meta.client`.
- Olvidar `key` en useAsyncData dentro de componentes reutilizados (datos cruzados).
- Poner un secreto en `public` "para probar" · fetch a API externa desde el cliente cuando debía pasar por `/server/api` (CORS + clave expuesta).
- Instalar módulos que duplican lo nativo (un router, un fetch, un head manager).
