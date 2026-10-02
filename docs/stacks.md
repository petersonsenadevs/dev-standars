<!-- GENERADO por tools/build-docs.ps1 desde core/skills-registry.json, core/commands/, core/hooks/ y stacks/. NO editar a mano. -->

# Stacks y bundles

[← Volver al README](../README.md)

Cada stack define systemprompt evolutivo, mejores prácticas, prohibiciones, comandos de verificación,
formateadores, permisos y (en los de front) el perfil del buscador de diseño. `init-project.ps1 -Stack <n>`.

| Stack | Qué es | Perfil de front |
|---|---|---|
| `astro` | Astro | Astro + React islands + Tailwind |
| `laravel` | PHP / Laravel | Laravel + Inertia + Vue 3 + Tailwind |
| `next` | Next.js + TypeScript | Next.js (App Router) + React + Tailwind |
| `node-api` | Node API (Express / NestJS) | — (backend) |
| `nuxt` | Nuxt 3/4 + Vue 3 | Nuxt 3 + Vue 3 + Tailwind |
| `python-langgraph` | Python + LangGraph / LangChain | — (backend) |
| `sveltekit` | SvelteKit + Svelte 5 | SvelteKit + Svelte 5 + Tailwind |
| `vue-ts` | Vue 3 + TypeScript | Vue 3 + TypeScript + Tailwind |
| `wordpress` | WordPress / PHP clásico | WordPress + theme a medida (child theme) + CSS propio |

Lenguajes sin stack propio (referencias de `code-quality`, el router los enruta igual): **Go** (`go.md`),
**Java/Spring** (`java.md`), **C#/.NET** (`csharp.md`).

### Bundles opcionales (`init.mjs --bundle <nombre>` o `sync.ps1 -Bundle <nombre>`)

| Bundle | Skills |
|---|---|
| `3d-authoring` | blender-web-pipeline, spline-interactive, rive-interactive, substance-3d-texturing |
| `3d-web` | threejs-webgl, react-three-fiber, gsap-scrolltrigger, web3d-integration-patterns |
| `animation-components` | react-spring-physics, animated-component-libraries, scroll-reveal-libraries, animejs, lottie-animations |
| `architecture` | ddd-hexagonal, code-quality |
| `core-3d-animation` | threejs-webgl, gsap-scrolltrigger, react-three-fiber, motion-framer, babylonjs-engine |
| `design-extras` | ui-ux-pro-max, ui-styling, design-system, graphic-design, slides, brand, banner-design |
| `extended-3d-scroll` | aframe-webxr, lightweight-3d-effects, playcanvas-engine, pixijs-2d, locomotive-scroll, barba-js |
| `motion-web` | gsap-scrolltrigger, motion-framer, scroll-reveal-libraries |
| `web-design-meta` | web3d-integration-patterns, modern-web-design |