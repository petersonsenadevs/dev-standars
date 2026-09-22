# Versiones del stack: qué cambia entre majors y qué API puedes usar

Índice: 1 Regla de oro · 2 PHP · 3 Laravel · 4 Next/React · 5 Vue · 6 Astro · 7 Tailwind · 8 Node ·
9 Python · 10 TypeScript · 11 EOL y política de upgrades

## 1. Regla de oro: la versión REAL manda
- El hook de sesión inyecta "Versiones detectadas" (composer.json / package.json / pyproject.toml).
  Si no la tienes, **mírala antes de escribir**: `composer.lock` / `package-lock.json` dicen la instalada.
- **No propongas API de una versión que el proyecto no tiene** (ni sintaxis nueva ni paquetes que la exigen),
  ni API deprecada en la versión que sí tiene. En la duda, busca la firma en el vendor/ o node_modules/ real.
- Docs y tutoriales suelen ser de la última major: al copiar una receta, comprueba que existe en la del proyecto.

## 2. PHP (8.1 → 8.4)
- **8.1**: enums nativos (úsalos en vez de constantes de clase), `readonly` properties, first-class callables.
- **8.2**: `readonly class`, tipos DNF, constantes en traits. Deprecado: propiedades dinámicas (prepárate con `#[AllowDynamicProperties]` solo si es legacy).
- **8.3**: constantes de clase tipadas, `#[Override]` (úsalo al sobreescribir), `json_validate()`.
- **8.4**: property hooks (get/set en la propiedad; sustituyen muchos accessors), visibilidad asimétrica `private(set)`, `array_find()`.
- Proyecto en 8.1: nada de hooks ni `#[Override]`. Proyecto en 8.4: no escribas getters/setters boilerplate que un hook resuelve.

## 3. Laravel (10 → 11 → 12)
- **10**: última con skeleton "clásico" (Kernel.php Http/Console, config/ completo).
- **11**: skeleton slim — **no hay `app/Http/Kernel.php` ni `Console/Kernel.php`**: middleware y scheduling van en
  `bootstrap/app.php`; casts como método `casts()`; `php artisan make:...` crea menos archivos; ruta `/up` de health;
  rate limiting por segundo; `once()`. Si el proyecto viene de 10 migrado, puede conservar el skeleton viejo: respétalo.
- **12**: cambios de rotura mínimos (upgrade fácil desde 11); starter kits nuevos (Livewire/React/Vue + WorkOS).
- Error típico del agente: editar `app/Http/Kernel.php` en un proyecto 11+ (no existe) o registrar middleware al estilo 10. Mira el skeleton real primero.

## 4. Next.js (13 → 14 → 15) y React (18 → 19)
- **13**: App Router beta/estable a mitad de ciclo — proyectos 13 pueden ser Pages Router: **no mezcles patrones**.
- **14**: Server Actions estables, Partial Prerendering preview.
- **15**: React 19; **las request APIs (`cookies()`, `headers()`, `params`) pasan a async** (await); `fetch` ya
  NO se cachea por defecto (en 13/14 sí: cache implícita); `useFormState` → `useActionState`.
- **React 19**: `use()`, Actions/`useOptimistic`, **`ref` como prop normal (adiós `forwardRef`)**, metadata en JSX.
  En React 18 sigue haciendo falta `forwardRef` y no existe `use()`.

## 5. Vue (2 → 3)
- **Vue 2 está EOL (dic 2023)**: si el proyecto sigue en 2, toda feature nueva es Options API + sin `<script setup>`,
  y propón la migración (o al menos el build de compatibilidad) en el devlog.
- **3**: Composition API + `<script setup>` por defecto, Pinia (no Vuex), `defineModel` (3.4+), Teleport/Suspense.

## 6. Astro (3 → 4 → 5)
- **3**: View Transitions. **4**: dev toolbar, content collections maduras. **5**: **Content Layer** (loaders
  para markdown/API/CMS, `src/content.config.ts` en vez de `src/content/config.ts`), Server Islands, `astro:env`.
- Proyecto en 3/4: collections con `src/content/config.ts` clásico; no uses loaders ni server islands.

## 7. Tailwind (3 → 4)
- **3**: `tailwind.config.js` + directivas `@tailwind base/components/utilities`.
- **4**: config **CSS-first**: `@import "tailwindcss"` + `@theme { --color-brand: ... }` en CSS; normalmente
  **sin** `tailwind.config.js`; motor nuevo y detección automática de contenido.
- Error típico: crear `tailwind.config.js` en un proyecto v4 (se ignora salvo `@config`) o usar `@theme` en v3.

## 8. Node (18 / 20 / 22)
- 18+: `fetch` global (sin node-fetch). 20+: test runner estable (`node --test`), `--watch`. 22: `require()` de ESM.
- Respeta `engines.node` del package.json y la versión del CI/hosting antes de usar API nueva.

## 9. Python (3.10 → 3.13)
- 3.10: `match`, uniones `X | Y`. 3.11: `tomllib`, `ExceptionGroup`, gran salto de rendimiento.
- 3.12: f-strings sin restricciones, `type` alias, `@override`. 3.13: REPL nuevo, experimental free-threading.
- Respeta `requires-python`; los type hints modernos (`list[str]`, `X | None`) valen desde 3.9/3.10 — no los uses si el proyecto soporta menos.

## 10. TypeScript (5.x)
- 5.x es continuo (sin majors de rotura al estilo 4→5): mira la versión por si usas `satisfies` (4.9+),
  `const` type parameters (5.0), decoradores estándar (5.0), `using` (5.2). `verbatimModuleSyntax` cambia los imports de tipos.

## 11. EOL y política de upgrades
- Fechas (seguridad, aproximadas — verifica en endoflife.date): PHP 8.1 dic-2025 · 8.2 dic-2026 · Laravel 10
  feb-2025 · 11 mar-2026 · 12 feb-2027 · Node 18 abr-2025 · 20 abr-2026 · 22 abr-2027 · Python 3.9 oct-2025 ·
  3.10 oct-2026 · Vue 2 dic-2023. El hook de sesión avisa si algo está sin soporte o a <6 meses.
- Algo SIN SOPORTE en producción = riesgo real (sin parches de seguridad): proponlo como tarjeta del plan, no lo calles.
- Upgrade: **una major por salto**, con la guía oficial de upgrade, suites verdes entre saltos, y devlog con
  qué rompió. Nunca "aprovechar" un upgrade para refactors no relacionados.
