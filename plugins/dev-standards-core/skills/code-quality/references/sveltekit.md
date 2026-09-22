# SvelteKit: recetas (Svelte 5 runes + Kit)

Índice: 1 Runes (Svelte 5) · 2 Load: dónde va cada dato · 3 Form actions · 4 Auth con hooks ·
5 Prerender y adapters · 6 Errores típicos del agente

## 1. Runes (Svelte 5) — mira la versión ANTES de escribir
```svelte
<script lang="ts">
  let { titulo, items = [] }: Props = $props();     // props (antes: export let)
  let abierto = $state(false);                       // estado reactivo (antes: let + asignación)
  let total = $derived(items.length);                // computado (antes: $:)
  $effect(() => { console.log(total); return () => {/* cleanup */} });  // dev-standards-allow
</script>
```
- Svelte 4 (sin runes): `export let`, `$:`, stores con `$store`. **No mezclar estilos en un proyecto.**
- Estado compartido en Svelte 5: clase o funciones con `$state` en `x.svelte.ts`; en 4: `writable()` en `$lib/stores`.
- `$derived` para calcular, `$effect` SOLO para el mundo exterior (DOM, listeners); un `$effect` que asigna
  `$state` es casi siempre un `$derived` mal planteado.

## 2. Load: dónde va cada dato
| Necesita | Archivo | Corre en |
|---|---|---|
| BD, secretos, sesión | `+page.server.ts` → `load` | solo servidor |
| API pública, sin secretos | `+page.ts` → `load` | servidor Y cliente |
| Datos de todo un árbol | `+layout(.server).ts` | ídem |
- Devuelve solo los campos que la página pinta (el resultado viaja serializado al navegador).
- `await parent()` para heredar datos del layout; `depends('app:pedidos')` + `invalidate('app:pedidos')` tras mutar.

## 3. Form actions (la mutación por defecto)
```ts
// +page.server.ts
export const actions = {
  crear: async ({ request, locals }) => {
    const data = Object.fromEntries(await request.formData());
    const parsed = Schema.safeParse(data);
    if (!parsed.success) return fail(422, { errores: parsed.error.flatten().fieldErrors, valores: data });
    await crearPedido(locals.user, parsed.data);
    throw redirect(303, '/pedidos');
  },
};
```
- En el componente: `<form method="POST" action="?/crear" use:enhance>` — funciona sin JS y mejora con él.
- `fail()` devuelve los valores para repoblar el formulario; superforms si el proyecto ya lo usa.

## 4. Auth con hooks
- `hooks.server.ts` → `handle`: lee la cookie de sesión, cuelga el usuario en `event.locals` (tipado en `app.d.ts`).
- Protege rutas en el `load` de servidor del layout del área privada (`if (!locals.user) throw redirect(303, '/login')`);
  el middleware de cliente NO es seguridad.

## 5. Prerender y adapters
- `export const prerender = true` en páginas estáticas (legal, landing); `entries` para rutas dinámicas conocidas.
- Adapter según hosting: `adapter-auto` (Vercel/Netlify lo detectan), `adapter-node` para VPS/Docker,
  `adapter-static` si TODO es prerenderizable. Deploy: `deploy-ops §deploy-by-stack`.

## 6. Errores típicos del agente
- Escribir Svelte 4 en un proyecto 5 (o al revés) por no mirar la versión.
- Query a BD o secreto en `+page.ts` (corre en el cliente) — va en `+page.server.ts`.
- Mutar con `fetch('/api/...')` a mano cuando una form action lo hace con progressive enhancement.
- `$effect` para computar estado · olvidar el cleanup en `$effect` con listeners.
- Estado en módulo compartido sin runes/stores (fuga entre requests en SSR).
