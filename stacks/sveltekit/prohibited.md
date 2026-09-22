# Prohibiciones específicas — SvelteKit

Además de las globales (`core/methodology/prohibited-actions.md`):

- Editar `.svelte-kit/` o `build/` — generados (bloqueado por protect-files).
- Mezclar sintaxis Svelte 4 (stores/`$:`) y Svelte 5 (runes) en el mismo proyecto sin migración pactada.
- Secretos o acceso a BD en `+page.ts`/load universal (corre en el cliente) — a `+page.server.ts`.
- Desactivar la protección CSRF de Kit (`csrf: { checkOrigin: false }`).
- Mutaciones por fetch a mano cuando una form action lo cubre (rompe el progressive enhancement).
- jQuery/Bootstrap (regla dura global).
