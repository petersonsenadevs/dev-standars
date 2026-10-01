# Definición de hecho (DoD)

"Hecho" significa usable en producto, verificado y documentado. No existe "hecho salvo los
tests" ni "hecho, falta el responsive". Cada tarjeta de `senzu/plan/PLAN.md` hereda la DoD global
del brief, la DoD de su tipo (este documento) y añade su "Hecho cuando" específico.

## Índice

- [DoD base (toda tarea)](#dod-base-toda-tarea)
- [UI: página o componente](#ui-página-o-componente)
- [Endpoint o ruta](#endpoint-o-ruta)
- [Migración y datos](#migración-y-datos)
- [Job, cola o comando](#job-cola-o-comando)
- [Integración externa](#integración-externa)
- [Agente LLM / grafo](#agente-llm--grafo)
- [Documentación](#documentación)
- [Animación y 3D](#animación-y-3d)
- [DoD de fase](#dod-de-fase)
- [DoD de proyecto](#dod-de-proyecto)
- [Checklist resumen](#checklist-resumen)

## DoD base (toda tarea)

Se cumple siempre, sea cual sea el tipo:

- [ ] "Hecho cuando" de la tarjeta cumplido, incluido el caso negativo.
- [ ] Verificación de la tarjeta ejecutada; salida real pegada en el devlog.
- [ ] Tests del área tocada en verde; test nuevo si hay lógica nueva.
- [ ] Lint y tipos limpios (`pint`, `eslint`, `tsc`, `ruff`, `mypy` según stack).
- [ ] Sin `TODO`/`FIXME` sin issue o tarjeta asociada; sin código comentado; sin `dd()`, `console.log`, `print` de depuración.
- [ ] Sin secretos ni credenciales en el código; nuevas variables añadidas a `.env.example`.
- [ ] Solo los archivos necesarios tocados; desviaciones anotadas en la tarjeta.
- [ ] Entrada de devlog creada e indexada (`senzu/devlog/<YYYY-MM-DD>/NNN-<slug>.md`); commit Conventional con `Tarea: <id>` en el cuerpo.
- [ ] Tarjeta en `done` con tamaño real y notas.

## UI: página o componente

Skill de referencia: `ui-ux-pro-max §references/es/review-rubric` y `ui-ux-pro-max §references/pro-rules` (checklist de entrega).

- [ ] Usa tokens del `senzu/design-system/*/MASTER.md` (sin colores ni tamaños "a mano").
- [ ] Responsive comprobado en 375, 768 y 1440 px; sin scroll horizontal.
- [ ] Estados cubiertos: vacío, cargando, error, éxito; y deshabilitado si aplica.
- [ ] Accesibilidad: navegable por teclado, foco visible, etiquetas en controles, contraste AA, `alt` en imágenes, roles ARIA solo cuando el HTML nativo no basta.
- [ ] Textos finales en el idioma del proyecto (sin "lorem ipsum" ni claves de i18n sin traducir).
- [ ] Formularios: validación inline, mensajes de error concretos, envío deshabilitado mientras procesa.
- [ ] Captura guardada en `senzu/devlog/assets/` (móvil y escritorio) y enlazada.
- [ ] Sin `console` errores ni warnings de Vue/React en la página.
- [ ] Test de componente o de feature cuando hay lógica de UI (filtros, cálculos, condiciones).

## Endpoint o ruta

Skill de referencia: `code-quality §references/api-design`, `code-quality §references/security-owasp`.

- [ ] Entrada validada (Form Request, Zod, Pydantic); rechazo con 422/400 y mensajes útiles.
- [ ] Autorización explícita (policy, middleware, guard) con tests de 401 y 403.
- [ ] Respuesta con forma estable y documentada (recurso/DTO), sin exponer modelos crudos.
- [ ] Códigos HTTP correctos; errores con formato uniforme del proyecto.
- [ ] Sin N+1 en listados (eager loading o consulta específica); paginación en colecciones.
- [ ] Idempotencia en operaciones que puedan repetirse (PUT, webhooks).
- [ ] Test de feature: caso feliz, validación, autorización, y un caso de borde.
- [ ] Documentación de API actualizada si el proyecto la tiene (OpenAPI, tabla de rutas).

## Migración y datos

Skill de referencia: `code-quality §references/php-laravel "Migraciones seguras"` / `ddd-hexagonal §references/persistence/prisma-drizzle`.

- [ ] Migración aditiva salvo aprobación explícita; `down()` funcional y probado.
- [ ] `migrate --pretend` (o equivalente) revisado; sin `drop` no autorizado.
- [ ] Índices para columnas de búsqueda/FK; restricciones (`unique`, `not null`) donde el dominio lo exige.
- [ ] Factory/fixture actualizada; seeders siguen funcionando (`migrate:fresh --seed` verde).
- [ ] Backfill de datos existentes si la columna nueva no admite nulos.
- [ ] Modelos: `$fillable`/`$guarded` o equivalente coherente con la validación (sin mass assignment).
- [ ] Impacto en datos personales revisado (cifrado, borrado, RGPD) si aplica.

## Job, cola o comando

Skill de referencia: `code-quality §references/php-laravel "Colas y jobs idempotentes"`, `code-quality §references/errors-logging`.

- [ ] Idempotente: ejecutarlo dos veces no duplica efectos.
- [ ] Reintentos y backoff configurados; comportamiento ante fallo definitivo definido (log + alerta o `failed_jobs`).
- [ ] Sin PII en logs; contexto suficiente para depurar (ids, no payloads completos).
- [ ] Procesa por lotes si el volumen puede crecer; timeout configurado.
- [ ] Comandos: `--dry-run` disponible cuando modifican datos.
- [ ] Test: ejecución correcta, fallo controlado, idempotencia.
- [ ] Programación (cron/scheduler) documentada si aplica.

## Integración externa

Skill de referencia: `ddd-hexagonal §references/hexagonal/ports-and-adapters`, `code-quality §references/security-owasp`.

- [ ] Cliente aislado tras interfaz; el resto del código no conoce la SDK.
- [ ] Credenciales por variables de entorno; `.env.example` actualizado; nunca en tests.
- [ ] Timeouts, reintentos y manejo de rate limit explícitos.
- [ ] Errores del proveedor mapeados a excepciones propias; sin filtrar detalles al usuario final.
- [ ] Test de contrato con respuestas grabadas (fixtures) y test de fallo del proveedor.
- [ ] Webhooks: firma verificada, idempotencia por id de evento, respuesta rápida + job.
- [ ] Modo sandbox/mock disponible para desarrollo local.

## Agente LLM / grafo

Skill de referencia: `code-quality §references/python "LangGraph"`, `code-quality §references/testing "Tests de contrato"`, `ddd-hexagonal §references/stacks/python/langgraph-agents`.

- [ ] Estado del grafo tipado; cada nodo es una función pura o con dependencias inyectadas.
- [ ] Test unitario por nodo con LLM simulado; test de integración del grafo con casos fijos.
- [ ] Dataset de evaluación versionado; métrica y umbral definidos (p. ej. ≥ 85 % en 30 casos) y resultado pegado.
- [ ] Presupuesto de tokens/coste por conversación y límite de pasos del grafo.
- [ ] Prompts en archivos versionados, con versión o hash en las trazas.
- [ ] Salidas estructuradas validadas (Pydantic); manejo de respuesta malformada.
- [ ] Sin PII en trazas ni logs; datos del usuario solo van al proveedor autorizado.
- [ ] Escalado/fallback a humano definido y probado.

## Documentación

Skill de referencia: `devlog §Plantilla de entrada`, `ddd-hexagonal §templates/docs/adr`.

- [ ] Entrada de devlog con: qué, decisiones, verificación (salida real), desviaciones, siguiente paso.
- [ ] `senzu/devlog/INDEX.md` actualizado; enlaces relativos válidos.
- [ ] ADR cuando hubo decisión con alternativas; enlazado desde la tarjeta.
- [ ] README de módulo actualizado si cambió la estructura o el modo de probar.
- [ ] Sin documentación duplicada: se enlaza, no se copia.

## Animación y 3D

Skill de referencia: `gsap-scrolltrigger`, `threejs-webgl`, `react-three-fiber`, `motion-framer`.

- [ ] `prefers-reduced-motion` respetado (animación desactivada o reducida).
- [ ] Cleanup al desmontar (kill de timelines, dispose de geometrías/texturas, cancel de RAF).
- [ ] Sin layout shift (CLS) ni bloqueo del hilo principal > 50 ms en carga.
- [ ] Rendimiento medido: 60 fps en escritorio, ≥ 30 fps en móvil medio; peso de assets anotado.
- [ ] Fallback estático si WebGL no está disponible.
- [ ] Vídeo corto o capturas en `senzu/devlog/assets/`.

## DoD de fase

- [ ] Todas las tareas de la fase en `done` (o descartadas con motivo).
- [ ] Suite completa verde en local y CI verde en la rama.
- [ ] Hito verificable por el usuario descrito paso a paso en el resumen de fase (entrada de tipo docs, `devlog §Resumen de fase`).
- [ ] Demo o captura del entregable enviada al usuario; feedback anotado.
- [ ] Riesgos de la fase revisados (cerrados o trasladados).
- [ ] Retro corta escrita (qué mantener, qué cambiar) enlazada al devlog.
- [ ] Cabecera y tabla `## Fases` de PLAN.md actualizadas (estado, fecha, siguiente fase).

## DoD de proyecto

- [ ] Todas las fases cerradas; backlog revisado con el usuario (qué se archiva, qué pasa a nuevo plan).
- [ ] README raíz con: propósito, requisitos, instalación, comandos, estructura, cómo desplegar (instrucciones, no ejecución).
- [ ] `.env.example` completo; sin secretos en el histórico de git.
- [ ] Suite verde, lint y tipos limpios, CI verde en `main`.
- [ ] Auditoría rápida de seguridad (`code-quality §references/security-owasp "Checklist de revisión"`) sin hallazgos altos.
- [ ] Rendimiento básico medido (Lighthouse para web, tiempos de respuesta para API).
- [ ] Devlog de cierre con resumen del proyecto y decisiones clave (ADR enlazados).
- [ ] Despliegue: NUNCA lo ejecuta el agente sin aprobación explícita y por escrito del usuario en esa misma sesión. El plan puede incluir una tarea "Preparar despliegue" (documentar pasos, variables, checklist), pero no "Desplegar".

## Checklist resumen

- [ ] DoD base cumplida en cada tarea.
- [ ] DoD del tipo aplicada (UI, endpoint, migración, job, integración, agente, docs, animación).
- [ ] DoD global del brief respetada (restricciones de datos, marca, legal).
- [ ] DoD de fase al cerrar cada fase; DoD de proyecto al cerrar el plan.
- [ ] Ningún despliegue sin aprobación explícita.
