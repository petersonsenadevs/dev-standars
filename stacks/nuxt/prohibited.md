# Prohibiciones específicas — Nuxt

Además de las globales (`core/methodology/prohibited-actions.md`):

- Editar `.nuxt/`, `.output/` o `node_modules/` — generados (bloqueado por protect-files).
- `window`/`document` en código que corre en SSR (rompe el build) — `onMounted`/`import.meta.client`.
- Secretos en `runtimeConfig.public` o en código de cliente.
- `$fetch` en setup para datos de página (doble petición) — `useFetch`/`useAsyncData`.
- Desactivar SSR global (`ssr: false` en todo el sitio) sin decisión explícita del usuario.
- jQuery/Bootstrap (regla dura global) o un segundo sistema de estado además de Pinia.
