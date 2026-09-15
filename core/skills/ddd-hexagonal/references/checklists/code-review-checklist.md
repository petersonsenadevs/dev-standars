# Checklist de revisión de PR en un proyecto DDD/hexagonal

## Índice
1. Antes de leer el código
2. Dependencias y ubicación
3. Lenguaje ubicuo y nombres
4. Invariantes y agregados
5. Transacciones y concurrencia
6. Eventos y efectos secundarios
7. Adaptadores y fronteras
8. Tests por capa
9. Señales de sobreingeniería
10. Formato del comentario de revisión

---

## 1. Antes de leer el código

- [ ] La descripción del PR nombra el caso de uso o regla de negocio en términos del glosario
      ("permite registrar cobros parciales"), no solo lo técnico ("añade columna").
- [ ] Si cambia una regla, enlaza la historia/ticket y, si toca una frontera, un ADR.
- [ ] CI en verde incluyendo la regla de dependencias (deptrac / dependency-cruiser /
      import-linter). Si el PR añade `skip_violations` o excepciones al linter, motivo escrito.
- [ ] Tamaño: un caso de uso o un agregado por PR. Si toca dominio + migración + UI de
      varios casos de uso, pedir división.

## 2. Dependencias y ubicación

- [ ] Ningún archivo en `Domain/` importa framework, ORM, HTTP, SDK, `Carbon`, `Str`,
      `pydantic` (salvo VO), `zod`, `langgraph`.
- [ ] `Application/` solo importa `Domain` y sus puertos; la excepción tolerada
      (`DB::transaction`, `Collection`) está en la lista documentada del stack.
- [ ] Los modelos ORM (`InvoiceModel`, tablas SQLAlchemy, tipos de Prisma) no salen del
      repositorio/mapper. Buscar `InvoiceModel` fuera de `Infrastructure/Persistence`.
- [ ] Nada de otro bounded context importado directamente (`Sales\Domain\...` desde
      `Invoicing\`), salvo `Shared` y contratos de integración.
- [ ] Cada clase nueva está en la carpeta que le corresponde según
      `references/stacks/<stack>/overview.md` §1 (un command nuevo no va en `Domain`; un
      listener no va en `Application`).
- [ ] Los `use`/imports no revelan una dirección invertida (Infrastructure -> Application ->
      Domain es la única válida).

## 3. Lenguaje ubicuo y nombres

- [ ] Los nombres de clases, métodos y eventos usan términos del glosario del contexto
      (`issue`, `cancel`, `registerPayment`), no genéricos (`process`, `handle`, `update`).
- [ ] No aparecen sinónimos prohibidos del glosario (`pago` donde el contexto dice `cobro`;
      `confirm` donde dice `issue`).
- [ ] Eventos en pasado (`InvoiceIssued`), commands en imperativo (`IssueInvoiceCommand`),
      excepciones que nombran la regla (`InvoiceCannotBeIssued::withoutLines`).
- [ ] No hay `Manager`, `Helper`, `Util`, `Service` genéricos nuevos en dominio.
- [ ] Los VO nuevos tienen nombre de concepto (`InvoiceNumber`), no de tipo (`NumberString`).
- [ ] Ver `naming-conventions.md` para el detalle por stack.

## 4. Invariantes y agregados

- [ ] Cada regla nueva del PR está en un método del agregado o en un VO, no en el
      controlador, el Form Request, el handler ni un listener.
- [ ] El método del agregado comprueba el estado antes de mutar y lanza excepción tipada
      (o devuelve `Result`); no deja el agregado a medias si falla.
- [ ] No se han añadido setters públicos ni propiedades públicas mutables al agregado.
- [ ] Las entidades hijas solo se modifican a través de la raíz (no hay
      `$invoice->lines()[0]->quantity = 3` desde fuera).
- [ ] Referencias a otros agregados por id (`CustomerId`), no por objeto ni por relación ORM.
- [ ] Si se añade un campo al agregado: tiene valor en `reconstitute`, en el mapper y en la
      migración; el builder de tests lo cubre.
- [ ] Si se añade un estado al enum: todos los `match`/`switch` siguen siendo exhaustivos y
      hay test para las transiciones inválidas nuevas.
- [ ] `equals` en VO y comparación por id en entidades siguen correctos tras el cambio.

## 5. Transacciones y concurrencia

- [ ] Una transacción por caso de uso, abierta en el handler (o UoW/decorador). No hay
      `DB::transaction`/`session.begin` en controladores, repositorios ni listeners.
- [ ] Dentro de la transacción solo hay persistencia; el IO externo (pasarela, email, LLM)
      está fuera.
- [ ] Si el PR escribe dos agregados en una transacción, hay ADR o comentario que lo
      justifica (p. ej. anulación + rectificativa).
- [ ] Secuencias, contadores y "el último" usan `lockForUpdate`/`FOR UPDATE` o versión
      optimista; hay test que lo demuestra.
- [ ] Operaciones invocadas por webhook/cola son idempotentes (referencia externa única,
      comprobación de "ya procesado" en el agregado).
- [ ] No hay lecturas fuera de la transacción cuyo resultado se use para decidir dentro
      (comprobar-y-actuar sin lock).

## 6. Eventos y efectos secundarios

- [ ] Los eventos se registran en el agregado (`record`) y se publican en el handler tras
      el commit (`pullEvents` + bus con `afterCommit`), no con `Event::dispatch` en medio.
- [ ] El payload del evento son ids, importes y fechas; no la entidad ni el modelo ORM.
- [ ] Los listeners con IO están en cola (`ShouldQueue`, worker) con `afterCommit` y son
      reintentables.
- [ ] Un listener no contiene reglas de negocio ni invoca varios casos de uso de escritura
      del mismo contexto; si lo hace, la regla pertenece al agregado o a un caso de uso.
- [ ] Los eventos de integración (otro contexto) tienen nombre versionado y `toPayload()`.
- [ ] No hay observers ni hooks del ORM (`creating`, `saved`, `@event.listens_for`) con lógica.

## 7. Adaptadores y fronteras

- [ ] Controlador/action/job: valida forma, construye command, invoca handler, mapea
      respuesta. Sin `if` de negocio, sin acceso a BD, sin envío de emails.
- [ ] El command se construye con datos del request y del usuario autenticado; el handler
      no recibe `Request` ni `Auth`.
- [ ] Repositorio: métodos de intención; no se ha añadido `findAll`, `paginate` ni
      filtros de pantalla. Eso va a un reader.
- [ ] Reader: devuelve DTOs planos; no devuelve modelos ORM ni agregados.
- [ ] Adaptador externo: el SDK y sus tipos no cruzan el puerto; errores traducidos.
- [ ] Prompt/LLM: el prompt está en el adaptador, versionado; el puerto devuelve tipos de
      dominio; hay test de contrato con respuesta grabada.
- [ ] Respuesta HTTP: excepciones de dominio mapeadas en el handler global con `code`
      estable; no hay `try/catch` que convierta a 500 genérico.

## 8. Tests por capa

- [ ] Regla nueva -> test de dominio puro que la nombra (`it('cannot register a payment
      above outstanding')`).
- [ ] Caso de uso nuevo -> test con fakes en memoria: guarda, publica el evento esperado, y
      caso negativo (no guarda ni publica si el agregado lanza).
- [ ] Repositorio/mapper tocado -> test de integración round-trip (`save` + `ofId`
      devuelve equivalente), incluyendo el campo nuevo.
- [ ] Adaptador HTTP tocado -> un test Feature por contrato (status, `error` code), no uno
      por regla.
- [ ] Los tests usan builders de dominio, no factories ORM, para construir agregados.
- [ ] Ningún test unitario necesita `RefreshDatabase`, red o variables de entorno.
- [ ] Ningún test hace mock del agregado ni del VO (se usan reales); solo se doblan puertos.
- [ ] Los tests eliminados o marcados `skip` tienen justificación en el PR.

## 9. Señales de sobreingeniería

Marcar y pedir simplificación si aparece:

- [ ] Interfaz con una sola implementación que no tiene IO ni se sustituye en tests.
- [ ] DTO para pasar datos entre dos clases de la misma capa.
- [ ] VO sin reglas ni operaciones (`Note`, `Description`) envolviendo un string.
- [ ] Bus de comandos, mediator o CQRS con dos bases de datos sin necesidad documentada.
- [ ] Especificación o servicio de dominio para una regla de una línea usada una vez.
- [ ] Módulo DDD para un CRUD de maestros sin reglas.

## 10. Formato del comentario de revisión

```
[BLOQUEA] Domain/Model/Invoice.php:84 — usa Carbon::now(); la fecha debe venir por parámetro (Clock).
[ALTA]    Application/RegisterPayment/RegisterPaymentHandler.php:31 — gateway->charge() dentro de DB::transaction.
[MEDIA]   Infrastructure/Http/InvoicesController.php:22 — comprueba status === 'draft'; mover a Invoice::issue().
[BAJA]    naming — `processInvoice` -> `issueInvoice` (glosario: emitir).
[OK]      Tests de dominio cubren las 3 transiciones nuevas.
```

Un PR se aprueba sin `[BLOQUEA]` y con los `[ALTA]` resueltos o convertidos en tarea con
fecha. Las categorías coinciden con `design-review-checklist.md`.
