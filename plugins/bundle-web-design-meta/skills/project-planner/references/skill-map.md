# Mapa tipo de tarea -> skill, sección y salida esperada

Al escribir cada tarjeta, el planner fija la skill y la sección a leer. Este mapa es la
tabla de decisión. Si una tarea no encaja en ninguna fila, casi siempre es un cambio trivial
(sin skill) o una tarea mal acotada (dividir). Si hay duda real, `skill-router` decide.

## Índice

- [Cómo usar el mapa](#cómo-usar-el-mapa)
- [Interfaz de usuario](#interfaz-de-usuario)
- [Animación y 3D](#animación-y-3d)
- [Lógica, API, tests, seguridad y rendimiento](#lógica-api-tests-seguridad-y-rendimiento)
- [Dominio rico y arquitectura](#dominio-rico-y-arquitectura)
- [Datos y migraciones](#datos-y-migraciones)
- [Documentación y decisiones](#documentación-y-decisiones)
- [Agentes LLM y Python](#agentes-llm-y-python)
- [Cuándo NO usar ninguna skill](#cuándo-no-usar-ninguna-skill)
- [Combinar dos skills en una tarea](#combinar-dos-skills-en-una-tarea)
- [Skill no instalada](#skill-no-instalada)
- [Checklist](#checklist)

## Cómo usar el mapa

1. Clasificar la tarea por su salida principal (una página, un endpoint, una migración...).
2. Buscar la fila; copiar skill + sección en la tarjeta con el formato `skill §sección`.
3. Verificar que la sección existe abriendo el `SKILL.md` de la skill (30 segundos).
4. Si la tarea produce dos salidas de tipos distintos, ver "Combinar dos skills".

Convención de `§`:

- `<skill> §<ruta-relativa-sin-.md>`: un archivo de la skill (p. ej. `ddd-hexagonal §references/tactical/aggregates`).
  Entre comillas, el encabezado `##` literal dentro de ese archivo: `code-quality §references/api-design "OpenAPI como contrato"`.
- `<skill> §<encabezado ##>`: una sección del `SKILL.md` efectivo (para skills vendor, el de
  `core/skills-overlay/<skill>/SKILL.md`), p. ej. `ui-ux-pro-max §2. Flujo obligatorio`.

Las secciones citadas siguen la nomenclatura de cada skill; si una skill cambia de nombre
de sección, se corrige la tarjeta y este mapa.

## Interfaz de usuario

| Tarea | Skill §sección | Salida esperada |
|-------|----------------|-----------------|
| Crear design system / tema | `ui-ux-pro-max §2. Flujo obligatorio` (paso 2) + `ui-ux-pro-max §references/es/tokens-tailwind` | `senzu/design-system/<slug>/MASTER.md` con tokens, tipografía, espaciado |
| Página nueva (landing, dashboard) | `ui-ux-pro-max §references/es/page-patterns "<tipo>"` | Página con secciones, jerarquía, responsive, a11y |
| Componente (formulario, tabla, modal) | `ui-ux-pro-max §references/es/components-spec "<Componente>"` | Componente con estados (vacío, carga, error), teclado, ARIA |
| Ajuste visual sobre lo existente | `ui-ux-pro-max §references/es/review-rubric` | Diff pequeño verificado con la rúbrica |
| Entrega de UI (checklist final) | `ui-ux-pro-max §references/pro-rules` + `ui-ux-pro-max §references/es/accessibility` | 375/768/1440 px y dark mode comprobados |
| Componente Vue 3 (lógica de UI) | `code-quality §references/vue "Composables"` | Componente tipado con composables reutilizables |
| Componente React/Next | `code-quality §references/react-next "Server Components vs Client Components"` | Componente con límites server/client claros |
| Página Astro | `code-quality §references/astro "Modelo mental: HTML primero, islas mínimas"` | Página estática con islas mínimas |

Si hay UI y no existe `senzu/design-system/<slug>/MASTER.md`, la primera tarjeta de la fase de UI
es generarlo con `ui-ux-pro-max`.

## Animación y 3D

| Tarea | Skill §sección | Salida esperada |
|-------|----------------|-----------------|
| Animación ligada al scroll | `gsap-scrolltrigger §references/es/scrolltrigger-patterns "Fade-up on enter"` o `"Pin + scrub timeline"` (+ `gsap-scrolltrigger §references/es/api-cheatsheet`) | Timeline con cleanup y `prefers-reduced-motion` |
| Microinteracciones en React | `motion-framer §2. Lectura mínima por tarea` (fila "Variants") | Variantes declarativas, sin layout shift |
| Escena 3D vanilla / Vue / Astro | `threejs-webgl §references/es/fundamentals` + `threejs-webgl §references/es/performance` | Escena con resize, dispose y presupuesto de triángulos |
| Escena 3D en React/Next | `react-three-fiber §references/es/next` | Canvas con Suspense, `useFrame` acotado |
| Animación de entrada simple (fade/slide) | ninguna (CSS) | Transición CSS con `prefers-reduced-motion` |

Regla: animación y 3D nunca van en la misma tarea que la lógica; primero la página
funciona sin animación (tarea UI), después se anima (tarea propia).

## Lógica, API, tests, seguridad y rendimiento

| Tarea | Skill §sección | Salida esperada |
|-------|----------------|-----------------|
| Endpoint REST / ruta Laravel | `code-quality §references/api-design` + `code-quality §references/php-laravel "Arquitectura: controladores, Form Requests, Actions y Services"` | Ruta, request validado, respuesta tipada, test de feature |
| Route handler Next / API Node | `code-quality §references/api-design` + `code-quality §references/typescript "Validación en los bordes con zod"` | Handler con esquema de entrada, códigos HTTP correctos |
| Servicio / caso de uso simple | `code-quality §references/php-laravel "Arquitectura: controladores, Form Requests, Actions y Services"` o `code-quality §references/typescript "Módulos, barrels y ciclos"` | Clase pequeña, inyectable, testada unitariamente |
| Tests (unit, feature, e2e) | `code-quality §references/testing` | Tests deterministas, nombres descriptivos, sin sleeps |
| Autenticación / autorización | `code-quality §references/security-owasp "Autenticación y sesiones"` + `code-quality §references/security-owasp "Control de acceso e IDOR"` | Policies/guards, tests de 401/403 |
| Validación y saneado de entrada | `code-quality §references/security-owasp "Validación en servidor"` | Reglas explícitas, sin mass assignment |
| Manejo de errores y logs | `code-quality §references/errors-logging` | Excepciones tipadas, logs sin PII, respuestas de error uniformes |
| Rendimiento (N+1, cache, bundle) | `code-quality §references/performance` | Medición antes/después pegada en devlog |
| Job / cola / cron | `code-quality §references/php-laravel "Colas y jobs idempotentes"` + `code-quality §references/errors-logging "Reintentos con backoff"` | Job idempotente, reintentos, fallo registrado |
| PR, ramas, revisión | `code-quality §references/git-and-reviews` | Commits Conventional, PR con checklist |

## Dominio rico y arquitectura

Usar `ddd-hexagonal` solo cuando hay reglas de negocio con invariantes, varios estados o
integraciones que conviene aislar. Un CRUD no es un dominio rico.

| Tarea | Skill §sección | Salida esperada |
|-------|----------------|-----------------|
| Decidir si aplica DDD al módulo | `ddd-hexagonal §1. ¿Hace falta?` | Nota en la tarjeta: "aplica / no aplica, porque..." |
| Modelar entidades, VO, agregados | `ddd-hexagonal §references/tactical/entities` + `ddd-hexagonal §references/tactical/aggregates` (VO: `ddd-hexagonal §references/tactical/value-objects`) | Clases de dominio puras con tests unitarios |
| Caso de uso de aplicación | `ddd-hexagonal §references/application/use-cases` | Caso de uso + puerto + test con dobles |
| Adaptador de persistencia | `ddd-hexagonal §references/persistence/orm-mapping` + el de tu ORM: `ddd-hexagonal §references/persistence/eloquent-pitfalls`, `ddd-hexagonal §references/persistence/prisma-drizzle` o `ddd-hexagonal §references/persistence/sqlalchemy` | Repositorio Eloquent/Prisma detrás de interfaz |
| Adaptador externo (API, email, LLM) | `ddd-hexagonal §references/hexagonal/ports-and-adapters` + `ddd-hexagonal §references/testing/adapter-tests` | Cliente aislado con contrato y test de contrato |
| Eventos de dominio | `ddd-hexagonal §references/tactical/domain-events` | Evento + listener + test de publicación |
| Estructura de carpetas del módulo | `ddd-hexagonal §references/hexagonal/folder-structures` + `references/stacks/<stack>/overview.md` de tu stack | Árbol creado y documentado |

## Datos y migraciones

| Tarea | Skill §sección | Salida esperada |
|-------|----------------|-----------------|
| Migración Laravel | `code-quality §references/php-laravel "Migraciones seguras"` | Migración aditiva, `down()` correcto, factory |
| Esquema Prisma / Drizzle | `ddd-hexagonal §references/persistence/prisma-drizzle` | Modelo, migración generada, seed |
| Migración con cambio de dominio | anterior + `ddd-hexagonal §references/persistence/migrations-and-domain` | Mapeo entidad <-> tabla explícito |
| Seeders / fixtures | `code-quality §references/testing "Fixtures, factories y datos de prueba"` | Datos mínimos y deterministas |
| Migración de datos (backfill) | `code-quality §references/php-laravel "Migraciones seguras"` + `code-quality §references/errors-logging "Reintentos con backoff"` | Comando idempotente, por lotes, con dry-run |

Restricción heredada del brief: si "solo migraciones aditivas", la DoD de la tarea lo repite.

## Documentación y decisiones

| Tarea | Skill §sección | Salida esperada |
|-------|----------------|-----------------|
| Entrada de devlog por tarea | `devlog §Plantilla de entrada` | `senzu/devlog/<YYYY-MM-DD>/NNN-<slug>.md` con `Tarea: <id>`; `senzu/devlog/INDEX.md` actualizado |
| Resumen de fase | `devlog §Resumen de fase` | Entrada de tipo docs con lo entregado, verificación y retro; enlaza todas las tareas |
| Decisión de arquitectura | `ddd-hexagonal §templates/docs/adr` | `docs/adr/NNN-titulo.md` con contexto, decisión, consecuencias |
| Ficha de contexto y glosario del módulo | `ddd-hexagonal §templates/docs/context-sheet` + `ddd-hexagonal §templates/docs/glossary` | Contexto delimitado, lenguaje ubicuo, integraciones |
| README de módulo | sin skill (propósito, estructura, cómo probar) | README corto enlazado desde el README raíz |
| Documentación de API | `code-quality §references/api-design "OpenAPI como contrato"` | OpenAPI o tabla de endpoints con ejemplos |

Toda tarea, sea del tipo que sea, termina con la fila "Entrada de devlog".

## Agentes LLM y Python

| Tarea | Skill §sección | Salida esperada |
|-------|----------------|-----------------|
| Grafo LangGraph (nodos, estado) | `code-quality §references/python "LangGraph"` + `ddd-hexagonal §references/stacks/python/langgraph-agents` | Nodos puros, estado tipado, test por nodo |
| Endpoint FastAPI | `code-quality §references/api-design` + `code-quality §references/python "FastAPI"` | Router con Pydantic, errores uniformes |
| Cliente del proveedor LLM | `ddd-hexagonal §references/hexagonal/ports-and-adapters` + `ddd-hexagonal §references/testing/adapter-tests` | Adaptador con interfaz, reintentos, presupuesto de tokens |
| Evaluación del agente | `code-quality §references/python "LangGraph"` + `code-quality §references/python "pytest"` | Dataset de casos + script con métrica |
| Observabilidad (trazas, coste) | `code-quality §references/errors-logging "Observabilidad mínima"` + `code-quality §references/performance "LLM y agentes"` | Trazas por nodo sin PII, coste por conversación |

## Cuándo NO usar ninguna skill

Se escribe `Skill: sin skill: cambio trivial` cuando la tarea es trivial y el riesgo de hacerla mal es bajo:

- Corregir un texto, un enlace, una traducción.
- Renombrar una variable o mover un archivo sin cambiar comportamiento.
- Subir una versión de dependencia patch con suite verde.
- Añadir una entrada a un enum o una constante de configuración.
- Ajustar un valor de estilo puntual (margen, color de un token ya definido).

Aun sin skill, la tarea sigue el protocolo: verificación, devlog (puede ser una línea en la
entrada de la tarea anterior o de la sesión) y commit. Si un cambio "trivial" toca más de
3 archivos o requiere test nuevo, ya no es trivial: asignar skill.

## Combinar dos skills en una tarea

Preferencia: una skill por tarea. Cuando una tarea tiene UI y lógica inseparables (p. ej.
un formulario con su endpoint), se elige el orden por riesgo:

| Situación | Orden | Motivo |
|-----------|-------|--------|
| La lógica tiene reglas o integraciones inciertas | Lógica -> UI | Se descubre el problema difícil antes; la UI se hace contra un contrato real |
| La UI es lo que el usuario debe validar (diseño, flujo) | UI con datos falsos -> Lógica | Se obtiene feedback de diseño pronto; la lógica reemplaza el mock |
| Ambas son conocidas y pequeñas | Lógica -> UI en una sola tarea S/M | No merece dos tarjetas |

Notación en la tarjeta: `Skill: code-quality §references/api-design` y `ui-ux-pro-max §references/es/components-spec "Form"` (dos skills como máximo, cada una entre acentos graves)
(en orden de lectura). Si la combinación hace la tarea L, se divide en dos tarjetas
(`F1-T3a`, `F1-T3b`) con dependencia explícita. Nunca más de dos skills por tarea.

## Skill no instalada

Si el mapa asigna una skill que no está en `senzu/senzu.json`:

1. Se escribe igualmente en la tarjeta (la asignación es correcta).
2. Se añade en "Notas": `requiere instalar <skill>`.
3. Al planificar se avisa al usuario en "Preguntas abiertas" con la lista de skills a instalar.
4. Al ejecutar, la tarea queda `[blocked]` hasta que se instale (ver `task-protocol.md`).

## Checklist

- [ ] Cada tarjeta tiene skill + sección concreta o `sin skill: cambio trivial`.
- [ ] Ninguna tarea combina más de dos skills.
- [ ] Animación/3D separadas de la tarea de lógica.
- [ ] `ddd-hexagonal` solo donde hay dominio rico; los CRUD usan `code-quality`.
- [ ] Toda tarea termina con `devlog §Plantilla de entrada` (`senzu/devlog/<YYYY-MM-DD>/NNN-<slug>.md`).
- [ ] Skills no instaladas listadas para el usuario.
- [ ] Secciones citadas comprobadas: el archivo `§ruta.md` o el encabezado `##` existen.
