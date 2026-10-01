# Índice de `ddd-hexagonal`

Un documento por tema, ≤ 250 líneas, con índice interno. Lee solo el que indique `SKILL.md` §2 y solo su sección.

## references/

### references/application/

- `references/application/authorization.md` (185 líneas) — Autorización por capas
- `references/application/commands-queries-cqrs.md` (179 líneas) — Commands, queries y CQRS
- `references/application/dtos-and-mapping.md` (189 líneas) — DTOs y mapeo entre capas
- `references/application/read-models-projections.md` (178 líneas) — Read models y proyecciones
- `references/application/transactions-unit-of-work.md` (193 líneas) — Transacciones y Unit of Work
- `references/application/use-cases.md` (213 líneas) — Casos de uso (servicios de aplicación)
- `references/application/validation-layers.md` (185 líneas) — Validación por capas
### references/checklists/

- `references/checklists/anti-patterns.md` (187 líneas) — Anti-patrones: síntoma, por qué duele, arreglo
- `references/checklists/code-review-checklist.md` (151 líneas) — Checklist de revisión de PR en un proyecto DDD/hexagonal
- `references/checklists/design-review-checklist.md` (146 líneas) — Checklist de revisión de diseño DDD/hexagonal
- `references/checklists/migration-from-mvc.md` (207 líneas) — Migración incremental desde MVC clásico
- `references/checklists/naming-conventions.md` (163 líneas) — Convenciones de nombres
- `references/checklists/smells-and-refactorings.md` (194 líneas) — Olores y refactorizaciones
### references/examples/

- `references/examples/crud-vs-ddd-side-by-side.md` (181 líneas) — CRUD vs DDD lado a lado: emitir una factura
- `references/examples/decision-trees.md` (190 líneas) — Árboles de decisión
- `references/examples/walkthrough-agent-langgraph.md` (251 líneas) — Recorrido completo: agente de soporte con LangGraph
- `references/examples/walkthrough-invoicing.md` (250 líneas) — Recorrido completo: bounded context "Facturación"
### references/hexagonal/

- `references/hexagonal/clean-vs-hexagonal-vs-vertical-slices.md` (161 líneas) — Clean, Onion, Hexagonal, Vertical Slices y Screaming: comparación
- `references/hexagonal/dependency-injection.md` (213 líneas) — Inyección de dependencias y composición
- `references/hexagonal/dependency-rules-tooling.md` (239 líneas) — Reglas de dependencia: herramientas y CI
- `references/hexagonal/driving-vs-driven.md` (180 líneas) — Adaptadores driving vs driven
- `references/hexagonal/folder-structures.md` (201 líneas) — Estructuras de carpetas por stack
- `references/hexagonal/ports-and-adapters.md` (176 líneas) — Puertos y adaptadores
### references/integration/

- `references/integration/anti-corruption-layer.md` (188 líneas) — Anti-Corruption Layer (ACL)
- `references/integration/event-versioning.md` (189 líneas) — Versionado de eventos
- `references/integration/eventual-consistency.md` (160 líneas) — Consistencia eventual
- `references/integration/idempotency.md` (196 líneas) — Idempotencia
- `references/integration/messaging-and-queues.md` (201 líneas) — Mensajería y colas
- `references/integration/outbox-pattern.md` (225 líneas) — Patrón Outbox
- `references/integration/sagas-process-managers.md` (188 líneas) — Sagas y process managers
### references/persistence/

- `references/persistence/eloquent-pitfalls.md` (251 líneas) — Eloquent como adaptador: trampas y soluciones
- `references/persistence/migrations-and-domain.md` (230 líneas) — Migraciones guiadas por el dominio
- `references/persistence/orm-mapping.md` (235 líneas) — Mapeo ORM: entidad de dominio frente a modelo de persistencia
- `references/persistence/prisma-drizzle.md` (251 líneas) — Prisma y Drizzle como adaptadores de persistencia
- `references/persistence/read-models-and-projections.md` (248 líneas) — Read models y proyecciones
- `references/persistence/sqlalchemy.md` (251 líneas) — SQLAlchemy 2 como adaptador de persistencia
### references/stacks/laravel/

- `references/stacks/laravel/http-and-inertia-adapters.md` (248 líneas) — Adaptadores HTTP e Inertia
- `references/stacks/laravel/jobs-events-listeners.md` (249 líneas) — Jobs, eventos y listeners como adaptadores
- `references/stacks/laravel/laravel-modules-layout.md` (251 líneas) — Laravel: monolito modular, un módulo por contexto
- `references/stacks/laravel/overview.md` (245 líneas) — Laravel (PHP 8.3+): monolito modular hexagonal
- `references/stacks/laravel/service-providers-and-bindings.md` (246 líneas) — Service providers y bindings por contexto
### references/stacks/python/

- `references/stacks/python/fastapi-adapters.md` (251 líneas) — FastAPI como adaptador driving
- `references/stacks/python/langgraph-agents.md` (250 líneas) — LangGraph: agentes hexagonales
- `references/stacks/python/overview.md` (251 líneas) — Python (FastAPI / LangGraph): hexagonal con Protocols
### references/stacks/typescript/

- `references/stacks/typescript/next-adapters.md` (251 líneas) — Next.js (App Router) como adaptador driving
- `references/stacks/typescript/node-services.md` (251 líneas) — Servicios Node (Fastify, NestJS-lite, BullMQ) como adaptadores driving
- `references/stacks/typescript/overview.md` (249 líneas) — TypeScript (Next.js / Node): módulos hexagonales
- `references/stacks/typescript/type-driven-domain.md` (251 líneas) — Dominio dirigido por tipos en TypeScript
### references/stacks/vue-front/

- `references/stacks/vue-front/inertia-and-spa-usecases.md` (250 líneas) — Casos de uso de cliente en Vue: SPA e Inertia
- `references/stacks/vue-front/overview.md` (218 líneas) — Vue 3 SPA / Inertia: dónde acaba el dominio en el cliente
### references/strategic/

- `references/strategic/bounded-contexts.md` (197 líneas) — Bounded contexts: detección, tamaño y materialización
- `references/strategic/context-mapping.md` (228 líneas) — Context mapping: patrones de relación entre contextos
- `references/strategic/event-storming.md` (205 líneas) — Event storming: big picture y process level en una sesión
- `references/strategic/modular-monolith.md` (246 líneas) — Monolito modular: estructura, comunicación y reglas
- `references/strategic/overview.md` (199 líneas) — Diseño estratégico: contextos, lenguaje y mapa
- `references/strategic/subdomains.md` (179 líneas) — Subdominios: core, supporting y generic
- `references/strategic/ubiquitous-language.md` (190 líneas) — Lenguaje ubicuo: del glosario al código
- `references/strategic/when-microservices.md` (178 líneas) — Cuándo (no) pasar a microservicios
### references/tactical/

- `references/tactical/aggregates.md` (234 líneas) — Agregados: límites de consistencia
- `references/tactical/domain-events.md` (234 líneas) — Eventos de dominio
- `references/tactical/domain-services.md` (213 líneas) — Servicios de dominio: lógica que no cabe en un agregado
- `references/tactical/entities.md` (237 líneas) — Entidades: identidad, ciclo de vida y comportamiento
- `references/tactical/factories.md` (222 líneas) — Fábricas
- `references/tactical/invariants-and-errors.md` (231 líneas) — Invariantes y errores de dominio
- `references/tactical/overview-concepts.md` (231 líneas) — Conceptos tácticos: DDD + Hexagonal + CQRS ligero
- `references/tactical/repositories.md` (237 líneas) — Repositorios: colección de agregados, no DAO
- `references/tactical/specifications.md` (216 líneas) — Especificaciones
- `references/tactical/value-objects.md` (250 líneas) — Value Objects: inmutables, válidos por construcción
### references/testing/

- `references/testing/adapter-tests.md` (251 líneas) — Tests de adaptadores: repositorios, contratos, HTTP y colas
- `references/testing/architecture-tests.md` (251 líneas) — Tests de arquitectura: reglas de dependencia automatizadas
- `references/testing/domain-tests.md` (249 líneas) — Tests de dominio: agregados y value objects puros
- `references/testing/overview.md` (198 líneas) — Estrategia de testing por capas
- `references/testing/test-data-builders.md` (251 líneas) — Builders y object mothers para datos de test
- `references/testing/use-case-tests.md` (251 líneas) — Tests de casos de uso: fakes en memoria y orquestación

## templates/

### templates/docs/

- `templates/docs/adr.md` (129 líneas) — ADR: plantilla de Architecture Decision Record
- `templates/docs/context-sheet.md` (147 líneas) — Ficha de bounded context: plantilla
- `templates/docs/glossary.md` (123 líneas) — Glosario de lenguaje ubicuo: plantilla
### templates/laravel/Application/IssueInvoice/

- `templates/laravel/Application/IssueInvoice/IssueInvoiceCommand.php` (21 líneas) — * Command: intención de cambiar estado, datos planos ya validados en forma.
- `templates/laravel/Application/IssueInvoice/IssueInvoiceHandler.php` (64 líneas) — * Caso de uso (servicio de aplicación). Orquesta: cargar -> regla -> guardar -> publicar.
### templates/laravel/Application/Port/

- `templates/laravel/Application/Port/Ports.php` (51 líneas) — Puertos driven no persistentes. Un archivo por interfaz en el proyecto real.
### templates/laravel/

- `templates/laravel/deptrac.yaml` (73 líneas) — deptrac.yaml — reglas de dependencia para el monolito modular.
### templates/laravel/Domain/Event/

- `templates/laravel/Domain/Event/InvoiceIssued.php` (55 líneas) — * Hecho pasado, inmutable, con los datos mínimos que un consumidor necesita
### templates/laravel/Domain/Exception/

- `templates/laravel/Domain/Exception/InvoiceCannotBeIssued.php` (44 líneas) — * Excepción de dominio con constructores nombrados: el mensaje explica la regla,
### templates/laravel/Domain/Model/

- `templates/laravel/Domain/Model/Invoice.php` (165 líneas) — * Raíz del agregado Invoice. Única puerta de entrada a sus líneas.
- `templates/laravel/Domain/Model/InvoiceLine.php` (34 líneas) — * Entidad hija del agregado Invoice. Solo se crea/modifica a través de la raíz.
- `templates/laravel/Domain/Model/InvoiceStatus.php` (18 líneas) — * Estados de la factura. Las transiciones válidas las decide el agregado, no el enum.
### templates/laravel/Domain/Repository/

- `templates/laravel/Domain/Repository/InvoiceRepository.php` (36 líneas) — * Puerto driven: persistencia del agregado Invoice.
### templates/laravel/Domain/ValueObject/

- `templates/laravel/Domain/ValueObject/Ids.php` (56 líneas) — Tres VO de identidad en un archivo solo por brevedad de la plantilla.
- `templates/laravel/Domain/ValueObject/Money.php` (99 líneas) — * Value Object: inmutable, igualdad por valor, validación en constructor.
### templates/laravel/Infrastructure/Http/

- `templates/laravel/Infrastructure/Http/IssueInvoiceController.php` (84 líneas) — * Adaptador driving HTTP. Responsabilidades y nada más:
### templates/laravel/Infrastructure/Persistence/Eloquent/

- `templates/laravel/Infrastructure/Persistence/Eloquent/EloquentInvoiceRepository.php` (113 líneas) — * Adaptador driven: implementa el puerto con Eloquent.
### templates/laravel/Infrastructure/Providers/

- `templates/laravel/Infrastructure/Providers/InvoicingServiceProvider.php` (50 líneas) — * Un ServiceProvider por módulo/contexto. Es el único sitio donde se decide
### templates/laravel/tests/Unit/Domain/

- `templates/laravel/tests/Unit/Domain/InvoiceTest.php` (117 líneas) — * Test de dominio puro (Pest). No extiende el TestCase de Laravel: sin contenedor,
### templates/python/

- `templates/python/.importlinter` (85 líneas) — .importlinter — reglas de dependencia (import-linter).
### templates/python/application/

- `templates/python/application/issue_invoice.py` (57 líneas) — Fuera de la transacción: un listener que falle no deshace la emisión.
### templates/python/domain/

- `templates/python/domain/events.py` (37 líneas)
- `templates/python/domain/invoice.py` (161 líneas) — ---- Ids: NewType cuando solo hay que distinguir tipos; validación en una función ----
- `templates/python/domain/money.py` (76 líneas) — ---- Constructores nombrados ----------------------------------------------------
- `templates/python/domain/ports.py` (52 líneas)
### templates/python/infrastructure/

- `templates/python/infrastructure/api.py` (105 líneas) — ---- Infraestructura compartida (normalmente en infrastructure/deps.py) ----------------------
- `templates/python/infrastructure/sqlalchemy_invoice_repository.py` (137 líneas) — ---- Esquema (anémico a propósito) -----------------------------------------------------------
### templates/python/tests/

- `templates/python/tests/test_issue_invoice.py` (159 líneas) — ---- Fakes ------------------------------------------------------------------------------------
### templates/typescript/

- `templates/typescript/.dependency-cruiser.cjs` (90 líneas) — * .dependency-cruiser.cjs — reglas de dependencia para módulos hexagonales.
### templates/typescript/app/actions/

- `templates/typescript/app/actions/issueInvoice.ts` (67 líneas) — * Adaptador driving: Server Action de Next.js (App Router).
### templates/typescript/application/

- `templates/typescript/application/issueInvoice.test.ts` (107 líneas) — * Test de caso de uso (Vitest) con fakes en memoria. Sin Prisma, sin Next, sin mocks.
- `templates/typescript/application/issueInvoice.ts` (61 líneas) — * Caso de uso IssueInvoice: función que recibe dependencias (puertos) y devuelve la
### templates/typescript/domain/

- `templates/typescript/domain/events.ts` (45 líneas) — * Eventos de dominio del módulo. Hechos pasados, inmutables, con datos mínimos.
- `templates/typescript/domain/Invoice.ts` (128 líneas) — * Agregado Invoice. Raíz única; las líneas solo se tocan a través de ella.
- `templates/typescript/domain/InvoiceRepository.ts` (19 líneas) — * Puerto driven: persistencia del agregado Invoice.
- `templates/typescript/domain/Money.ts` (78 líneas) — * Value Object Money: inmutable, igualdad por valor, validación en la factory.
### templates/typescript/infrastructure/

- `templates/typescript/infrastructure/container.ts` (58 líneas) — * Composition root del módulo: el único archivo que conoce a la vez los puertos y
- `templates/typescript/infrastructure/PrismaInvoiceRepository.ts` (99 líneas) — * Adaptador driven: InvoiceRepository sobre Prisma.
### templates/typescript/shared/domain/

- `templates/typescript/shared/domain/Result.ts` (25 líneas) — * Result type para errores esperados de negocio. Serializable (sin clases), así puede

