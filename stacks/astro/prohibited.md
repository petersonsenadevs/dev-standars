# Prohibiciones específicas — Astro

Además de las globales (`core/methodology/prohibited-actions.md`):

- Hidratar todo con `client:load` "por si acaso" (rompe el propósito de Astro).
- Meter frameworks pesados como isla cuando un componente `.astro` estático bastaría.
- Exponer secretos: variables de servidor en código que llega al cliente.
- Saltarse `astro check` para que "pase" el build.
