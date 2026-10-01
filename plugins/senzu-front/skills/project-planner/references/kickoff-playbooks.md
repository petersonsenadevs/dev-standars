# Playbooks de arranque

Plantillas de fases y tareas tipo para los proyectos más frecuentes. No se copian tal cual:
se adaptan tras el descubrimiento (`discovery.md`) y el brief (`brief-and-scope.md`). Cada
tarea lleva tamaño y skill; las secciones exactas se confirman en el `SKILL.md` correspondiente.

## Índice

- [Cómo usar un playbook](#cómo-usar-un-playbook)
- [Fase 0 común](#fase-0-común)
- [A. Landing o sitio de marketing (Astro o Next)](#a-landing-o-sitio-de-marketing-astro-o-next)
- [B. App Laravel + Inertia + Vue con CRUD y roles](#b-app-laravel--inertia--vue-con-crud-y-roles)
- [C. Módulo complejo con DDD en Laravel](#c-módulo-complejo-con-ddd-en-laravel)
- [D. API Next o Node](#d-api-next-o-node)
- [E. Agente LangGraph con FastAPI](#e-agente-langgraph-con-fastapi)
- [F. Rediseño de UI existente](#f-rediseño-de-ui-existente)
- [Checklist](#checklist)

## Cómo usar un playbook

1. Elegir el playbook más cercano; si el proyecto mezcla dos (app Laravel con un módulo DDD),
   usar B para el esqueleto y C para la fase del módulo.
2. Renombrar tareas con el vocabulario del proyecto ("Factura", no "Entidad").
3. Quitar tareas que el descubrimiento demostró innecesarias (ya hay CI, ya hay design system).
4. Añadir "Hecho cuando", "Verificar" y "Depende de" a cada tarjeta (`plan-format.md`).
5. Copiar los riesgos típicos al registro y ajustar dueño y mitigación.

## Fase 0 común

Aplica a todo proyecto que no la tenga ya cubierta (se fusiona en F1 si son ≤ 3 tareas):

- F0-T1 · Inicializar devlog e INDEX · S · `devlog §Pasos`
- F0-T2 · Crear `.env.example` y verificar arranque local documentado · S · `ninguna`
- F0-T3 · Asegurar script de test, lint y tipos que pasan (aunque sea trivial) · S · `code-quality §testing`
- F0-T4 · CI mínima (lint + test) · S · `code-quality §git-and-reviews`
- F0-T5 · Design system MASTER.md si hay UI y no existe · M · `ui-ux-pro-max §2`

## A. Landing o sitio de marketing (Astro o Next)

Fases:

- F1 Walking skeleton: página con hero + una sección + formulario funcional, desplegable.
- F2 Contenido completo: todas las secciones, SEO, analítica.
- F3 Pulido: animaciones, rendimiento, accesibilidad final.

Tareas:

- F1-T1 · Crear layout base con design system (header, footer, contenedor) · M · `ui-ux-pro-max §references/es/page-patterns "landing"` + `code-quality §astro "Islas"` (o `§react-next`)
- F1-T2 · Construir hero y sección de propuesta de valor · M · `ui-ux-pro-max §references/es/components-spec Hero`
- F1-T3 · Formulario de contacto con validación y envío al CRM/email · M · `ui-ux-pro-max §references/es/components-spec Form` + `code-quality §security-owasp "Validación"`
- F1-T4 · Test e2e del envío y CI · S · `code-quality §testing "E2E"`
- F2-T1 · Secciones de casos de éxito, beneficios y FAQ · M · `ui-ux-pro-max §references/es/components-spec Cards/Accordion`
- F2-T2 · SEO: meta, OG, sitemap, robots, datos estructurados · S · `code-quality §astro "SEO"`
- F2-T3 · Analítica y consentimiento de cookies (RGPD) · S · `code-quality §security-owasp "Criptografía y datos"`
- F2-T4 · Página legal (privacidad, aviso) · S · `ninguna`
- F3-T1 · Animaciones de scroll en hero y casos · M · `gsap-scrolltrigger §references/es/scrolltrigger-patterns`
- F3-T2 · Rendimiento: imágenes, fuentes, Lighthouse ≥ 90 móvil · M · `code-quality §performance`
- F3-T3 · Auditoría a11y y responsive final · S · `ui-ux-pro-max §references/es/review-rubric`
- F3-T4 · Devlog de cierre y guía de despliegue (sin desplegar) · S · `devlog §Resumen de fase`

Riesgos típicos: copy no disponible (mitigar: el agente redacta, el usuario revisa);
integración CRM con límites; imágenes pesadas de marca; dominio/hosting sin decidir.

## B. App Laravel + Inertia + Vue con CRUD y roles

Fases:

- F1 Walking skeleton: auth + un recurso completo (listar/crear) con design system.
- F2 CRUD completo y roles: editar/borrar, permisos, validaciones, listados con filtros.
- F3 Calidad y operación: emails, jobs, auditoría, rendimiento.

Tareas:

- F1-T1 · Configurar auth (Breeze/Fortify) con roles base admin/usuario · M · `code-quality §php-laravel "Autorización: políticas y gates"` + `§security-owasp "AuthN/AuthZ"`
- F1-T2 · Layout de app con navegación y design system · M · `ui-ux-pro-max §references/es/page-patterns "dashboard"`
- F1-T3 · Migración, modelo y factory del recurso principal · S · `code-quality §php-laravel "Migraciones seguras"`
- F1-T4 · Ruta, controlador, Form Request y página de listado + creación · M · `code-quality §php-laravel "Arquitectura: controladores"` + `ui-ux-pro-max §references/es/components-spec "Table" + ui-ux-pro-max §references/es/components-spec "Form"`
- F1-T5 · Tests de feature (listar, crear, 403 sin rol) · S · `code-quality §testing`
- F2-T1 · Editar y borrar con confirmación y policies · M · `code-quality §security-owasp "Control de acceso e IDOR"` + `ui-ux-pro-max §references/es/components-spec Modal`
- F2-T2 · Filtros, búsqueda y paginación sin N+1 · M · `code-quality §performance "N+1"`
- F2-T3 · Gestión de usuarios y asignación de roles (admin) · M · `code-quality §php-laravel "Autorización: políticas y gates"`
- F2-T4 · Tests de componente Vue para formularios · S · `code-quality §vue "Testing"`
- F3-T1 · Notificaciones por email con jobs en cola · M · `code-quality §php-laravel "Colas y jobs idempotentes"`
- F3-T2 · Registro de auditoría (quién cambió qué) · M · `code-quality §errors-logging`
- F3-T3 · Auditoría de seguridad y rendimiento · S · `code-quality §security-owasp` + `§performance`
- F3-T4 · Devlog de cierre, README, guía de despliegue · S · `devlog §Resumen de fase`

Riesgos típicos: roles que crecen sin modelo (mitigar: policies desde F1); BD de producción
con datos reales; formularios Inertia sin tests de front; N+1 en listados.

## C. Módulo complejo con DDD en Laravel

Precondición: `ddd-hexagonal §1` confirma dominio rico (invariantes, estados,
reglas legales). Si no, usar el playbook B.

Fases:

- F1 Esqueleto hexagonal: un caso de uso de extremo a extremo con dominio puro.
- F2 Dominio completo: resto de casos de uso, eventos, invariantes.
- F3 Integraciones y UI: adaptadores externos, páginas admin/cliente.

Tareas:

- F1-T1 · Spike: validar reglas de negocio críticas con el usuario y escribir ADR · S · `ddd-hexagonal §templates/docs/adr`
- F1-T2 · Crear estructura de carpetas del módulo · S · `ddd-hexagonal §references/hexagonal/folder-structures`
- F1-T3 · Modelar agregado principal y value objects con tests unitarios · M · `ddd-hexagonal §references/tactical/aggregates`
- F1-T4 · Repositorio (puerto + adaptador Eloquent) y migración · M · `ddd-hexagonal §references/persistence/orm-mapping`
- F1-T5 · Caso de uso principal + ruta + test de feature · M · `ddd-hexagonal §references/application/use-cases`
- F2-T1 · Casos de uso secundarios (2-4 tarjetas, una por caso) · M · `ddd-hexagonal §references/application/use-cases`
- F2-T2 · Eventos de dominio y listeners · M · `ddd-hexagonal §references/tactical/domain-events`
- F2-T3 · Test de invariantes bajo concurrencia · S · `code-quality §testing "Integración con BD real"`
- F3-T1 · Adaptador externo (PDF, email, pasarela) con test de contrato · M · `ddd-hexagonal §references/hexagonal/ports-and-adapters`
- F3-T2 · Páginas Inertia del módulo · M · `ui-ux-pro-max §references/es/components-spec "Table" + ui-ux-pro-max §references/es/components-spec "Form"`
- F3-T3 · README del módulo y ADR de cierre · S · `ddd-hexagonal §templates/docs/context-sheet`

Riesgos típicos: sobreingeniería (mitigar: solo el módulo, el resto sigue MVC); reglas de
negocio ambiguas; acoplamiento del dominio a Eloquent; equipo sin costumbre de DDD.

## D. API Next o Node

Fases:

- F1 Esqueleto: un recurso con validación, auth y tests, documentado.
- F2 Recursos completos y reglas de negocio.
- F3 Operación: rate limit, observabilidad, rendimiento.

Tareas:

- F1-T1 · Estructura de proyecto, tipado estricto, lint, test runner · S · `code-quality §typescript "tsconfig recomendado"`
- F1-T2 · Esquema de datos (Prisma/Drizzle) y migración inicial · S · `ddd-hexagonal §references/persistence/prisma-drizzle`
- F1-T3 · Autenticación (JWT/sesión) y middleware de autorización · M · `code-quality §security-owasp "Autenticación y sesiones"`
- F1-T4 · Endpoints del recurso principal con Zod y errores uniformes · M · `code-quality §api-design` + `§errors-logging`
- F1-T5 · Tests de integración y documentación OpenAPI · M · `code-quality §testing` + `§api-design "Documentación"`
- F2-T1 · Recursos secundarios (una tarjeta por recurso) · M · `code-quality §api-design`
- F2-T2 · Reglas de negocio en servicios con tests unitarios · M · `code-quality §typescript "Módulos"`
- F2-T3 · Webhooks entrantes con verificación de firma e idempotencia · M · `code-quality §api-design "Webhooks"`
- F3-T1 · Rate limiting y cabeceras de seguridad · S · `code-quality §security-owasp`
- F3-T2 · Logs estructurados, trazas y métricas · S · `code-quality §errors-logging`
- F3-T3 · Rendimiento: índices, caché, medición · M · `code-quality §performance`
- F3-T4 · Devlog de cierre y guía de despliegue · S · `devlog §Resumen de fase`

Riesgos típicos: contratos que cambian sin versionar; auth casera; secretos en variables
de entorno mal gestionadas; falta de idempotencia en webhooks.

## E. Agente LangGraph con FastAPI

Fases:

- F1 Esqueleto: grafo mínimo (entrada -> LLM -> salida) expuesto por API con test.
- F2 Grafo completo: nodos, herramientas, memoria, escalado.
- F3 Evaluación y operación: dataset, métricas, coste, trazas.

Tareas:

- F1-T1 · Spike: 10 casos reales contra el modelo, anotar calidad y coste · S · `code-quality §python` (devlog con resultados)
- F1-T2 · Estructura del proyecto, tipado, ruff, pytest · S · `code-quality §python "Estructura"`
- F1-T3 · Adaptador del proveedor LLM con interfaz, reintentos y presupuesto · M · `ddd-hexagonal §references/hexagonal/ports-and-adapters`
- F1-T4 · Grafo mínimo con estado tipado y test por nodo · M · `code-quality §python` + `ddd-hexagonal §references/application/use-cases`
- F1-T5 · Endpoint FastAPI `/chat` con Pydantic y test · M · `code-quality §api-design` + `§python "FastAPI"`
- F2-T1 · Nodo de clasificación con umbral de confianza · M · `code-quality §testing`
- F2-T2 · Recuperación sobre base de conocimiento (ingesta + búsqueda) · M · `ddd-hexagonal §references/hexagonal/ports-and-adapters`
- F2-T3 · Herramientas del agente (una tarjeta por herramienta) · M · `code-quality §python`
- F2-T4 · Escalado a humano y persistencia de conversación · M · `code-quality §errors-logging`
- F3-T1 · Dataset de evaluación (≥ 30 casos) y script con métrica · M · `code-quality §python "LangGraph"`
- F3-T2 · Trazas por nodo, coste por conversación, sin PII · S · `code-quality §errors-logging`
- F3-T3 · Límites: pasos máximos, tokens, timeouts · S · `code-quality §security-owasp`
- F3-T4 · Devlog de cierre, README, guía de despliegue · S · `devlog §Resumen de fase`

Riesgos típicos: calidad del modelo insuficiente para el caso (spike primero); coste por
conversación; PII en logs; prompts sin versionar; bucles en el grafo.

## F. Rediseño de UI existente

Fases:

- F1 Base: design system nuevo y layout aplicado a una página piloto.
- F2 Migración página a página por valor de uso.
- F3 Limpieza: retirar estilos antiguos, a11y y rendimiento.

Tareas:

- F1-T1 · Inventario de páginas y componentes actuales con capturas · S · `ui-ux-pro-max §references/es/review-rubric`
- F1-T2 · Crear/actualizar MASTER.md con tokens y componentes base · M · `ui-ux-pro-max §2`
- F1-T3 · Layout nuevo (navegación, contenedores) conviviendo con el antiguo · M · `ui-ux-pro-max §page-blueprints <tipo>`
- F1-T4 · Migrar página piloto (la más usada) y validar con el usuario · M · `ui-ux-pro-max §references/es/components-spec <los que use>`
- F1-T5 · Tests de componente para los componentes base · S · `code-quality §vue "Testing"` (o `§react-next`)
- F2-T1..Tn · Migrar página X (una tarjeta por página, orden por uso) · M · `ui-ux-pro-max §references/es/components-spec`
- F3-T1 · Retirar CSS/componentes antiguos sin referencias · S · `ninguna` (verificar con grep + build)
- F3-T2 · Auditoría a11y y responsive global · M · `ui-ux-pro-max §references/es/review-rubric`
- F3-T3 · Rendimiento: bundle, fuentes, imágenes · S · `code-quality §performance`
- F3-T4 · Devlog de cierre con antes/después · S · `devlog §Resumen de fase`

Riesgos típicos: dos sistemas de estilos conviviendo demasiado tiempo (mitigar: F2 corta y
ordenada por uso); regresiones funcionales al tocar plantillas (tests de feature antes);
decisiones de diseño sin validar (página piloto con el usuario en F1).

## Checklist

- [ ] Playbook elegido y adaptado al vocabulario del proyecto.
- [ ] Fase 0 fusionada o eliminada según lo que ya exista.
- [ ] F1 es un walking skeleton verificable por el usuario.
- [ ] Cada tarea tiene tamaño, skill + sección, y se completará con hecho cuando / verificar / depende de.
- [ ] Riesgos típicos copiados al registro con dueño y mitigación.
- [ ] Tareas que no aplican eliminadas; ninguna tarea "por si acaso".
- [ ] Despliegue solo como guía documentada, nunca como tarea ejecutable sin aprobación.
