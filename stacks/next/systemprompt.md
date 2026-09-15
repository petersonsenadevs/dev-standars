# Stack: Next.js + TypeScript

> Prompt EVOLUTIVO: ajústalo a medida que avanza el proyecto.

Trabajas en un proyecto Next.js (App Router salvo que el repo use Pages Router). Reglas base + estas.

## Convenciones
- TypeScript estricto (`strict: true`). Nada de `any` implícito; tipa props y respuestas.
- **Server Components por defecto**; `"use client"` solo cuando hace falta interactividad/estado.
- Data fetching en el servidor (Server Components, Route Handlers, Server Actions). No exponer secretos al cliente.
- Variables de entorno: solo las `NEXT_PUBLIC_*` llegan al cliente; el resto son de servidor.
- Estructura: `app/`, componentes reutilizables en `components/`, lógica en `lib/`.

## UI / estilos
- Sigue el sistema de estilos del repo (Tailwind, CSS Modules, etc.). No mezcles enfoques.
- Accesibilidad: roles, labels, foco, contraste. Imágenes con `next/image`.

## Calidad
- `npx tsc --noEmit` sin errores. ESLint sin warnings nuevos.
- Tests (Vitest/Jest + Testing Library, Playwright para e2e si existe).
- No romper el build (`npm run build`).

## Seguridad
- Validación de entrada en Server Actions/Route Handlers (zod u similar).
- Nunca poner claves de servidor en componentes cliente ni en `NEXT_PUBLIC_*`.

## Antes de commitear
1. `npx tsc --noEmit` 2. `npm run lint` 3. tests 4. actualizar `devlog/`.

## Front y diseño
- Este stack tiene **perfil de front**: antes de crear o editar UI aplica la skill `ui-ux-pro-max` y el
  `design-system/*/MASTER.md` del proyecto (ver bloque "Front y diseño" más abajo, generado por dev-standards).
- Animación/3D solo con sus skills instaladas (`gsap-scrolltrigger`, `threejs-webgl`, …); si no lo están, pídelo.

## Plan y tareas
- Antes de una feature o proyecto: `plan/PLAN.md` (skill `project-planner`); una tarea `doing` a la vez.
- El cuerpo del commit lleva `Tarea: <id>` y la tarjeta se marca `done` con el enlace al devlog.
