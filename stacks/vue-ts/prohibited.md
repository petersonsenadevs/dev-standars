# Prohibiciones específicas — Vue 3 + TS

Además de las globales (`core/methodology/prohibited-actions.md`):

- Options API en componentes nuevos.
- Mutar props directamente.
- `any` para "callar" el type-checker; silenciar `vue-tsc` con ignores masivos.
- Estado global fuera de Pinia (variables sueltas, singletons ad-hoc).
- Watchers `deep` sobre estructuras grandes sin necesidad (fugas de rendimiento).
