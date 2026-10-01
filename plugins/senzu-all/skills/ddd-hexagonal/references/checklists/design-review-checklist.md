# Checklist de revisión de diseño DDD/hexagonal

## Índice
1. Cómo usarla
2. Estratégico: contexto y lenguaje
3. Capa de dominio
4. Capa de aplicación
5. Adaptadores driven (persistencia, gateways)
6. Adaptadores driving (HTTP, jobs, CLI)
7. Integración entre contextos
8. Tests
9. Documentación y decisiones
10. Plantilla de informe

---

## 1. Cómo usarla

Se aplica antes de escribir el grueso del código (revisión del diseño propuesto: glosario,
agregados, casos de uso, puertos) o al auditar un módulo existente. Cada pregunta se
responde sí/no; la severidad indica qué pasa si la respuesta es "no":

| Severidad | Significado |
|---|---|
| BLOQUEA | no se aprueba el diseño hasta resolverlo |
| ALTA | se aprueba con tarea abierta y fecha |
| MEDIA | se anota; se resuelve en la siguiente iteración |
| BAJA | sugerencia |

Para revisar un PR concreto, usar `code-review-checklist.md`. Para los olores y su
refactorización, `smells-and-refactorings.md`.

## 2. Estratégico: contexto y lenguaje

| # | Pregunta | Severidad |
|---|---|---|
| 2.1 | ¿La decisión "aplica DDD / no aplica" está escrita con la checklist de `SKILL.md` §1? | BLOQUEA |
| 2.2 | ¿El bounded context tiene nombre, propósito de una frase y glosario de 5-15 términos? | BLOQUEA |
| 2.3 | ¿Cada término del glosario tiene una sola definición dentro del contexto? | ALTA |
| 2.4 | ¿Hay ficha de contexto (`templates/docs/context-sheet.md`) con relaciones y tipo (customer/supplier, ACL, conformist)? | ALTA |
| 2.5 | ¿Se ha identificado qué contexto es dueño de cada dato compartido (Cliente, Producto)? | ALTA |
| 2.6 | ¿Se han listado los puntos calientes (concurrencia, cálculos, integraciones) y cada uno tiene una invariante o regla asignada? | MEDIA |

## 3. Capa de dominio

| # | Pregunta | Severidad |
|---|---|---|
| 3.1 | ¿`Domain/` no importa framework, ORM, HTTP ni SDKs (nada de `Model`, `Carbon`, `PrismaClient`, `pydantic` en agregados, `langgraph`)? | BLOQUEA |
| 3.2 | ¿Cada agregado tiene sus invariantes escritas (comentario de clase o doc) y cada una vive en un método de la raíz? | BLOQUEA |
| 3.3 | ¿Los agregados son pequeños: una transacción, referencia a otros por id, cargables completos? | ALTA |
| 3.4 | ¿Las entidades exponen métodos con nombre de negocio y no setters? | ALTA |
| 3.5 | ¿Todo primitivo con reglas (dinero, número fiscal, email, periodo) es un VO inmutable que valida en el constructor? | ALTA |
| 3.6 | ¿Los estados son enums y las transiciones se validan en el agregado, no en el enum ni en el caso de uso? | ALTA |
| 3.7 | ¿Los eventos de dominio están en pasado, son inmutables y llevan ids y datos mínimos (no la entidad entera)? | ALTA |
| 3.8 | ¿Las excepciones de dominio son tipadas, con constructores nombrados y `code()` estable (o `Result` tipado en TS)? | MEDIA |
| 3.9 | ¿Hay fábrica (`draftFor`) separada de la rehidratación (`reconstitute`) para no re-emitir eventos? | MEDIA |
| 3.10 | ¿Los servicios de dominio son puros, sin estado y necesarios (involucran más de un agregado)? | MEDIA |
| 3.11 | ¿El dominio no conoce al usuario autenticado, la request ni el tenant salvo como VO recibido? | ALTA |
| 3.12 | ¿La fecha/hora entra como parámetro (`Clock`), nunca `now()` dentro del dominio? | ALTA |

## 4. Capa de aplicación

| # | Pregunta | Severidad |
|---|---|---|
| 4.1 | ¿Hay un caso de uso por intención de usuario/sistema, con un command de entrada plano? | BLOQUEA |
| 4.2 | ¿El caso de uso no contiene reglas de negocio (solo cargar, invocar agregado, guardar, publicar)? | BLOQUEA |
| 4.3 | ¿Una transacción por caso de uso, abierta en el handler o en un decorador, no en el controlador ni en el repositorio? | ALTA |
| 4.4 | ¿Los eventos se publican después del commit (o via outbox)? | ALTA |
| 4.5 | ¿Los casos de uso no se llaman entre sí? | ALTA |
| 4.6 | ¿El IO externo no transaccional (cobro en pasarela, LLM) ocurre antes de la transacción o de forma compensable? | ALTA |
| 4.7 | ¿Los puertos driven están declarados como interfaces/Protocols y solo existen si tienen IO o se sustituyen en tests? | MEDIA |
| 4.8 | ¿Las lecturas para pantallas van por read models/readers y no rehidratan agregados? | ALTA |
| 4.9 | ¿La salida del caso de uso es un DTO/Result/valor simple, nunca un agregado ni un modelo ORM? | ALTA |
| 4.10 | ¿La única dependencia de framework tolerada en Application está documentada (`DB::transaction`, `Collection`)? | BAJA |

## 5. Adaptadores driven

| # | Pregunta | Severidad |
|---|---|---|
| 5.1 | ¿Hay un repositorio por agregado, con métodos de intención (`ofId`, `save`, `nextId`, `overdueAt`) y sin `findBy*` genéricos? | ALTA |
| 5.2 | ¿El mapeo ORM <-> agregado es explícito (mapper) y el modelo ORM solo lo conoce el repositorio? | ALTA |
| 5.3 | ¿`save` es idempotente y maneja hijos (reemplazo o diff) y, si hay concurrencia, versión optimista o lock? | ALTA |
| 5.4 | ¿Las integraciones externas pasan por un puerto en tipos del dominio y un adaptador que traduce (ACL)? | BLOQUEA |
| 5.5 | ¿Los errores de la infraestructura se traducen a excepciones propias (`PaymentDeclined`, `CrmUnavailable`)? | MEDIA |
| 5.6 | ¿Los prompts de LLM, credenciales y reintentos viven en el adaptador, no en aplicación ni dominio? | ALTA |
| 5.7 | ¿Los readers de consulta devuelven DTOs planos y contienen la paginación/filtros? | MEDIA |

## 6. Adaptadores driving

| # | Pregunta | Severidad |
|---|---|---|
| 6.1 | ¿El controlador/action/job solo valida forma, construye el command, invoca el caso de uso y mapea la respuesta? | BLOQUEA |
| 6.2 | ¿Las excepciones de dominio se mapean a HTTP en un único sitio (handler global) con código estable? | ALTA |
| 6.3 | ¿La autorización (policy) está en el adaptador o en el caso de uso, pero no en el dominio? | MEDIA |
| 6.4 | ¿Las vistas/props/Resources se construyen desde DTOs, nunca desde entidades ni modelos con relaciones lazy? | ALTA |
| 6.5 | ¿Un mismo caso de uso puede invocarse desde HTTP, job y CLI sin duplicar lógica? | MEDIA |
| 6.6 | ¿Los webhooks y consumidores de cola son idempotentes (referencia externa, id de evento)? | ALTA |

## 7. Integración entre contextos

| # | Pregunta | Severidad |
|---|---|---|
| 7.1 | ¿Los contextos no se importan entre sí salvo `Shared` y contratos públicos (eventos, puertos ACL)? | BLOQUEA |
| 7.2 | ¿Los eventos de integración están versionados (`invoicing.invoice_issued.v1`) y su payload es plano? | ALTA |
| 7.3 | ¿La comunicación entre contextos es asíncrona; si hace falta garantía, hay outbox? | ALTA |
| 7.4 | ¿Cada contexto guarda snapshot de lo que necesita del otro en lugar de hacer joins cruzados? | MEDIA |
| 7.5 | ¿La regla de dependencia está automatizada (deptrac, dependency-cruiser, import-linter) y en CI? | BLOQUEA |
| 7.6 | ¿`Shared` contiene solo utilidades sin reglas de negocio (`AggregateRoot`, `DomainEvent`, `Uuid`)? | MEDIA |

## 8. Tests

| # | Pregunta | Severidad |
|---|---|---|
| 8.1 | ¿Cada invariante del agregado tiene un test de dominio puro (sin BD, sin contenedor)? | BLOQUEA |
| 8.2 | ¿Cada caso de uso tiene tests con fakes en memoria que comprueban guardado y eventos publicados? | ALTA |
| 8.3 | ¿Los repositorios y readers tienen test de integración con BD real (round-trip, locks)? | ALTA |
| 8.4 | ¿Los adaptadores externos tienen test de contrato con respuesta grabada o servidor fake? | MEDIA |
| 8.5 | ¿Los tests HTTP son pocos y finos (contrato y mapeo de errores), no el sitio donde se prueban las reglas? | MEDIA |
| 8.6 | ¿Existen builders (`anInvoice()->withLine()`) en lugar de factories ORM para dominio? | MEDIA |
| 8.7 | ¿Ningún test de dominio/aplicación necesita red, claves de API ni modelo real? | BLOQUEA |
| 8.8 | ¿La suite unitaria del módulo corre en segundos y está en pre-commit? | BAJA |

## 9. Documentación y decisiones

| # | Pregunta | Severidad |
|---|---|---|
| 9.1 | ¿Las excepciones a las reglas (dos agregados en una transacción, framework en Application) tienen ADR? | ALTA |
| 9.2 | ¿La estructura de carpetas sigue la del stack (`references/stacks/<stack>/overview.md`)? | MEDIA |
| 9.3 | ¿El glosario está en el repo (`templates/docs/glossary.md`) y los nombres del código coinciden? | MEDIA |

## 10. Plantilla de informe

```
Revisión de diseño: <contexto> — <fecha> — revisor: <nombre>
Decisión: APROBADO | APROBADO CON TAREAS | RECHAZADO

BLOQUEA
- 3.1 Domain importa Carbon en Invoice::issue() -> sustituir por DateTimeImmutable + Clock.
ALTA
- 4.4 Eventos publicados dentro de DB::transaction -> mover tras commit / DB::afterCommit.
MEDIA
- 5.7 Reader devuelve modelos Eloquent -> InvoiceRow DTO.
Notas
- ADR pendiente para cancel() que escribe dos agregados.
```
