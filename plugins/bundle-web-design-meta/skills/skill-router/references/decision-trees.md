# Árboles de decisión de dev-standards

Puerta de entrada del sistema de skills. Cada árbol es una secuencia de preguntas sí/no; se
responde en orden y la primera SALIDA alcanzada nombra la skill exacta (y, si aplica, el
`archivo §sección` a leer). Si una pregunta no se puede responder, elige la opción más simple.
Rutas: las skills viven en `core/skills*/` del repo o junto a esta en el plugin instalado.

## Índice
- [A0. ¿Qué stack y librerías para un proyecto nuevo?](#a0-qué-stack-y-librerías-para-un-proyecto-nuevo)
- [A. Árbol global (empieza siempre aquí)](#a-árbol-global-empieza-siempre-aquí)
- [B1. ¿Capas simples o DDD?](#b1-capas-simples-o-ddd)
- [B2. Backend por síntoma](#b2-backend-por-síntoma)
- [F2. ¿Qué librería de animación?](#f2-qué-librería-de-animación)
- [F3. ¿Necesito WebGL?](#f3-necesito-webgl)
- [F4. ¿Puedo permitirme este efecto?](#f4-puedo-permitirme-este-efecto)

---

## A0. ¿Qué stack y librerías para un proyecto nuevo?

Solo cuando el proyecto aún no existe y el usuario pregunta (o no sabe) con qué hacerlo.
El stack del equipo/proyecto existente SIEMPRE gana a esta tabla.

```
P1 ¿Es sobre todo contenido (web de empresa, landing, blog, docs, marketing) con poca lógica de app?
   sí -> SALIDA: stack `astro` (Astro + React islands + Tailwind): HTML primero, SEO, el mejor rendimiento;
         islas solo donde haya estado. Fin.
   no -> P2
P2 ¿Hay backend de negocio en PHP, o el equipo vive en Laravel (auth, BD, colas, admin)?
   sí -> SALIDA: stack `laravel` (Laravel + Inertia + Vue 3): un solo repo, sin API que mantener.
   no -> P3
P3 ¿App web compleja con mucho ecosistema React (dashboards, SaaS, auth, server actions)?
   sí -> SALIDA: stack `next` (Next.js App Router + React).
   no -> P4
P4 ¿SPA/PWA y el equipo prefiere Vue, o pieza embebida en algo existente?
   sí -> SALIDA: stack `vue-ts` (Vue 3 + TS + Vite).
   no -> SALIDA: el más simple que cubra el caso (por defecto `astro`); documenta la duda en el devlog.
```

Librerías por defecto del stack elegido (no acumules alternativas):
UI kit -> shadcn/ui (React) o shadcn-vue/Reka (Vue); CSS -> Tailwind 4; iconos y fuentes -> UN set y
1-2 familias según `ui-ux-pro-max §references/es/fonts-icons.md`; animación -> árbol F2; 3D -> F3;
formularios -> los del framework (server actions / useForm de Inertia / vee-validate); nada de jQuery,
Bootstrap ni una segunda librería de componentes sin aprobación.

## A. Árbol global (empieza siempre aquí)

```
P1 ¿Existe `plan/PLAN.md` en el proyecto?
   sí -> SALIDA: sigue la tarjeta en `doing` (o la primera `todo`) según
         `project-planner §references/task-protocol.md`. Fin.
   no -> P2
P2 ¿Es un proyecto nuevo o una feature nueva (hay que decidir alcance y trocear)?
   sí -> SALIDA: `project-planner` (crea `plan/PLAN.md` antes de tocar código).
   no -> P3
P3 ¿La tarea produce UI, estilos o una página (.vue, .tsx, .jsx, .astro, .blade.php, .html, .css)?
   sí -> SALIDA: `ui-ux-pro-max` PRIMERO (design system + patrón + componentes);
         después la especialista si hace falta (animación -> F2, 3D -> F3).
   no -> P4
P4 ¿Es animación, efecto de scroll o transición entre páginas?
   sí -> SALIDA: árbol F2 (valida el coste con F4).
   no -> P5
P5 ¿Es 3D, WebGL, shaders o canvas?
   sí -> SALIDA: árbol F3 (valida el coste con F4).
   no -> P6
P6 ¿Es lógica, endpoint/API, tests, seguridad o rendimiento?
   sí -> SALIDA: `code-quality` (si dudas de qué referencia abrir, árbol B2).
   no -> P7
P7 ¿Es un módulo con dominio rico (invariantes, varios contextos) o "¿cómo estructuro esto?"?
   sí -> SALIDA: árbol B1.
   no -> P8
P8 ¿Vas a cerrar la tarea o commitear?
   sí -> SALIDA: `devlog` (siempre, antes del commit).
   no -> SALIDA: revisa la tabla de activación de `skill-router/SKILL.md`; si nada encaja, pregunta.
```

## B1. ¿Capas simples o DDD?

Versión global del árbol táctico de `ddd-hexagonal/references/examples/decision-trees.md`,
con salidas que nombran skills.

```
P1 ¿Hay reglas con estados, límites o cálculos que un test de formulario no cubre?
   no -> SALIDA: capas simples (controlador -> action -> modelo) ->
         `code-quality §references/php-laravel.md` (o la referencia de tu stack:
         typescript, react-next, vue, astro, python). Fin.
   sí -> P2
P2 ¿Se cumplen al menos 3 de la checklist de `ddd-hexagonal/SKILL.md` §1 "¿Hace falta?"
   (invariantes, varios contextos o integraciones, vida > 1 año o equipo > 2,
   testear sin BD, ya duele)?
   no -> SALIDA: capas simples + value objects para los primitivos con reglas (Money, Email):
         `code-quality` del stack y, si necesitas el patrón VO,
         `ddd-hexagonal §references/tactical/value-objects.md`.
   sí -> SALIDA: `ddd-hexagonal` (empieza por su §1 "¿Hace falta?"; los árboles tácticos
         —entidad/VO, agregados, eventos, repositorios— siguen en
         `ddd-hexagonal/references/examples/decision-trees.md`).
```

## B2. Backend por síntoma

```
Síntoma: "va lento"
P1 ¿El tiempo se va en BD o servidor (N+1, índices, payload grande, sin caché)?
   sí -> SALIDA: `code-quality §references/performance.md` (empieza por §medir).
   no -> SALIDA: es front (bundle, LCP, imágenes) -> `ui-ux-pro-max`.

Síntoma: "falla en producción"
P1 ¿Huele a input malicioso, auth rota, uploads o secretos expuestos?
   sí -> SALIDA: `code-quality §references/security-owasp.md`.
   no -> SALIDA: `code-quality §references/errors-logging.md` (logs con contexto, reintentos).

Síntoma: "endpoint/API nueva"
   SALIDA: `code-quality §references/api-design.md`; si el dominio es rico, además árbol B1.

Síntoma: "migración/datos"
P1 ¿El módulo usa DDD (agregados, repositorios)?
   sí -> SALIDA: `ddd-hexagonal §references/persistence/migrations-and-domain.md`.
   no -> SALIDA: `code-quality §references/php-laravel.md` §"Migraciones seguras"
         (o la referencia del stack correspondiente).

Síntoma: "tests" (crear o arreglar)
   SALIDA: `code-quality §references/testing.md` (§pirámide + §tu stack).

Síntoma: "integración externa / colas"
   SALIDA: `ddd-hexagonal §references/integration/messaging-and-queues.md`;
   entrega garantizada -> `ddd-hexagonal §references/integration/outbox-pattern.md`;
   reintentos seguros -> `ddd-hexagonal §references/integration/idempotency.md`.
```

## F2. ¿Qué librería de animación?

```
P1 ¿Es un hover o una transición simple de estado (opacity, transform, color)?
   sí -> SALIDA: CSS/Tailwind transitions; sin skill. Fin.
   no -> P2
P2 ¿Solo elementos que aparecen al entrar en viewport, en una landing?
   sí -> SALIDA: `scroll-reveal-libraries` (AOS).
   no -> P3
P3 ¿Stack React y animación de componentes o presencia (mount/unmount, layout, gestos)?
   sí -> SALIDA: `motion-framer`.
   no -> P4
P4 ¿Scroll-driven (scrub, pin, parallax, timeline) en cualquier stack?
   sí -> SALIDA: `gsap-scrolltrigger`.
   no -> P5
P5 ¿Smooth scroll?
   sí -> SALIDA: Lenis, dentro de `gsap-scrolltrigger`.
   no -> P6
P6 ¿Transiciones entre páginas de un sitio multipágina (MPA)?
   sí -> SALIDA: `barba-js`.
   no -> SALIDA: `gsap-scrolltrigger` como comodín de animación JS.
```

Nota: el catálogo de efectos concretos (receta por efecto) está en
`front-activation/references/effects-catalog.md`. Antes de implementar, pasa por F4.

Sub-árbol Astro (los efectos SÍ son posibles en Astro):
```
P-A ¿Es efecto de scroll, parallax, reveal, marquee o timeline?
  sí -> gsap-scrolltrigger en un <script> de Astro, SIN isla (§references/es/astro): Astro anima perfectamente así
P-B ¿Animación ligada a estado de componente (modales, presencia, gestos, listas) o quieres Motion/R3F/shadcn-ui?
  sí -> island React con client:visible (motion-framer / react-three-fiber / ui-styling)
  no -> CSS o gsap vanilla. La isla es la excepción, no la norma.
```

## F3. ¿Necesito WebGL?

```
P1 ¿Se logra con CSS 3D o GSAP (tilt, parallax, perspective)?
   sí -> SALIDA: sin WebGL; para tilt usa `lightweight-3d-effects`. Fin.
   no -> P2
P2 ¿Es un fondo animado estándar (olas, redes, partículas decorativas)?
   sí -> SALIDA: `lightweight-3d-effects` (Vanta) o CSS animado.
   no -> P3
P3 ¿Modelo 3D, configurador de producto o hero con GLB/GLTF?
   sí -> SALIDA: `threejs-webgl` (en React/Next: `react-three-fiber`).
   no -> P4
P4 ¿Efecto sobre imagen (distorsión, hover WebGL, transición entre imágenes)?
   sí -> SALIDA: `threejs-webgl §references/es/shaders-basics.md` o `pixijs-2d`.
   no -> P5
P5 ¿Shader propio (mesh gradient, partículas custom)?
   sí -> SALIDA: `threejs-webgl §references/es/shaders-basics.md` + presupuesto móvil
         (draw calls, pixel ratio <= 2, probar en gama media);
         si el presupuesto no da, degrada a CSS.
   no -> SALIDA: probablemente no necesitas WebGL; vuelve a F2.
```

## F4. ¿Puedo permitirme este efecto?

```
P1 ¿Respeta `prefers-reduced-motion` con un fallback digno (estado final visible, sin saltos)?
   no -> SALIDA: no hacerlo hasta tener el fallback.
   sí -> P2
P2 ¿Afecta al LCP (está en el hero o bloquea el primer render con JS/canvas pesado)?
   sí -> SALIDA: simplificar: versión estática primero y carga diferida del efecto.
   no -> P3
P3 ¿Funciona en móvil táctil (no depende de hover ni de puntero fino)?
   no -> SALIDA: simplificar: alternativa táctil o desactivar el efecto en móvil.
   sí -> P4
P4 ¿Secuestra el scroll (pin/scrub largos) en formularios, checkout o rutas de conversión?
   sí -> SALIDA: no hacerlo ahí; resérvalo para páginas narrativas.
   no -> SALIDA: adelante.
```
