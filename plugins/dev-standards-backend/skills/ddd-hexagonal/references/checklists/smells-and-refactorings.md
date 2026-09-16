# Olores y refactorizaciones

## Índice
1. Cómo leer esta tabla
2. Modelo anémico -> mover comportamiento al agregado
3. Servicio gordo -> agregado o servicio de dominio
4. Repositorio con consultas de UI -> read model
5. Controlador con lógica -> caso de uso
6. Evento con toda la entidad -> evento con ids
7. Primitivos con reglas -> value object
8. Agregado gigante -> partir por invariantes
9. Caso de uso que llama a otro -> servicio de dominio o evento
10. Lógica en listener -> método del agregado
11. Transacción en el controlador -> transacción en el handler
12. SDK externo en dominio -> puerto + ACL
13. Ifs sobre strings de estado -> enum y transiciones
14. Test que necesita BD para una regla -> test de dominio
15. Orden recomendado de refactorización

---

## 1. Cómo leer esta tabla

Cada sección: **olor** (cómo se detecta, a menudo con un grep), **riesgo** (qué se rompe
si se deja) y **refactorización** en pasos pequeños que dejan el sistema en verde tras
cada uno. Los ejemplos son Laravel; la forma es idéntica en TS y Python. Complementa
`anti-patterns.md` (por qué duele) con el "cómo se arregla".

## 2. Modelo anémico -> mover comportamiento al agregado

**Olor**: `grep -rn "->set[A-Z]" src/*/Domain` devuelve resultados; las reglas están en
`*Service.php` que reciben la entidad y la mutan.
**Riesgo**: la misma invariante en tres servicios, olvidada en el cuarto.
**Refactorización**:
1. Elegir una operación (`issue`). Crear `Invoice::issue(InvoiceNumber, DateTimeImmutable)`
   que copia las comprobaciones del servicio y muta el estado dentro.
2. El servicio llama al nuevo método; borrar los `set*` que ya no se usan.
3. Test de dominio para cada comprobación movida. Repetir por operación.
4. Cuando el servicio solo carga/guarda, renombrarlo a `<Verbo><Agregado>Handler`.

## 3. Servicio gordo -> agregado o servicio de dominio

**Olor**: `InvoiceService` con 15 métodos y 400 líneas; recibe ids y hace de todo.
**Riesgo**: un archivo que todos tocan; conflictos de merge; imposible testear aislado.
**Refactorización**:
1. Clasificar cada método: muta un agregado (-> método del agregado); combina varios sin IO
   (-> servicio de dominio con nombre, `PricingPolicy`); carga/guarda/notifica (-> caso de uso).
2. Extraer primero los casos de uso, uno por método público, cada uno con su command.
3. Mover las reglas de cada caso de uso al agregado (§2).
4. Lo que quede sin IO y con dos agregados es el servicio de dominio. Si queda vacío,
   borrar el servicio.

## 4. Repositorio con consultas de UI -> read model

**Olor**: `InvoiceRepository` con `paginate`, `search($filters)`, `findByStatusAndCustomer`,
`withRelations`; devuelve modelos Eloquent o arrays.
**Riesgo**: el agregado se deforma para servir listados; cargar 500 agregados para una tabla.
**Refactorización**:
1. Crear `Application/Query/PendingInvoicesReader` (interfaz) y `InvoiceRow` (DTO).
2. Implementar `DbPendingInvoicesReader` con query builder, paginación y filtros.
3. Cambiar el controlador de listado para usar el reader. Borrar el método del repositorio.
4. Repetir por pantalla. El repositorio queda con `ofId`, `save`, `nextId` y consultas de
   dominio (`overdueAt`) que devuelven agregados.

## 5. Controlador con lógica -> caso de uso

**Olor**: `if ($invoice->status !== 'draft')`, `DB::transaction`, `Mail::` dentro de un
controlador o Server Action; el mismo bloque en un job.
**Riesgo**: la regla no se puede invocar desde otro canal; se prueba solo por HTTP.
**Refactorización**:
1. Crear `IssueInvoiceCommand` con los datos que el controlador extrae del request.
2. Crear `IssueInvoiceHandler` y mover el cuerpo del controlador tal cual (sin mejorar).
3. Controlador: Form Request, construir command, invocar handler, mapear respuesta.
4. Test del handler con fakes. Ahora aplicar §2 al cuerpo movido.

## 6. Evento con toda la entidad -> evento con ids

**Olor**: `new InvoiceIssued($invoice)` o `InvoiceIssued { invoice: InvoiceModel }`;
listeners que llaman a `$event->invoice->customer->email`.
**Riesgo**: serialización a cola de un grafo ORM; lazy loading en el worker; el listener
ve estado posterior al evento; acoplamiento entre contextos.
**Refactorización**:
1. Definir el evento con `invoiceId`, `customerId`, `number`, `total`, `issuedAt` (VO y
   escalares) y `toPayload()`.
2. El listener carga lo que necesite por id desde un reader (`InvoiceDetailReader`).
3. Añadir `NAME` versionado si sale del contexto.

## 7. Primitivos con reglas -> value object

**Olor**: `int $amountCents, string $currency` viajando en pareja por firmas; validación
de formato repetida (`preg_match` del número de factura en tres sitios).
**Riesgo**: sumar céntimos de monedas distintas; estados inválidos representables.
**Refactorización**:
1. Crear el VO (`Money`, `InvoiceNumber`) con validación en constructor y operaciones
   (`add`, `multiply`, `equals`).
2. Sustituir la pareja de primitivos en el agregado; mapear en el repositorio a columnas.
3. Borrar las validaciones duplicadas. Test del VO.
No aplicar a strings sin reglas (`description`).

## 8. Agregado gigante -> partir por invariantes

**Olor**: `Customer` con `orders`, `invoices`, `tickets`; `ofId` hace 8 joins; conflictos
de concurrencia entre usuarios que editan cosas distintas.
**Riesgo**: bloqueos, rendimiento, tests que construyen medio mundo.
**Refactorización**:
1. Listar invariantes reales. ¿Cuáles cruzan `Customer` e `Invoice`? Normalmente ninguna.
2. Extraer `Invoice` como raíz propia con `CustomerId`; snapshot de los datos de cliente
   que la factura necesita al emitir.
3. Repositorio propio; los casos de uso que tocaban ambos pasan a coordinar por evento.
4. Repetir con `Order`, `Ticket`. `Customer` queda pequeño.

## 9. Caso de uso que llama a otro -> servicio de dominio o evento

**Olor**: `IssueInvoiceHandler` invoca `SendEmailHandler` y `UpdateAccountingHandler`;
transacciones anidadas.
**Riesgo**: transacción larga con IO; fallo en el segundo deshace el primero (o no, según
el driver); dependencias circulares.
**Refactorización**:
1. Si es un efecto (email, contabilidad): publicar evento tras commit; listener en cola.
2. Si es una regla (recalcular descuento al emitir): servicio de dominio puro invocado por
   el handler con los agregados ya cargados.
3. Si es "el mismo paso desde dos canales": ambos adaptadores invocan el mismo handler.

## 10. Lógica en listener -> método del agregado

**Olor**: `OnInvoiceIssued` que comprueba `if ($total > 10000) { $customer->markAsVip() }`
y guarda; reglas que solo existen en listeners.
**Riesgo**: reglas invisibles, ejecutadas con retraso, sin transacción, a veces dos veces.
**Refactorización**:
1. Si la regla pertenece al mismo agregado: moverla al método que emite el evento.
2. Si pertenece a otro agregado: crear caso de uso `MarkCustomerAsVip` con su command; el
   listener solo construye el command y lo invoca. Idempotente.
3. Test de la regla en dominio; el listener queda sin `if`.

## 11. Transacción en el controlador -> transacción en el handler

**Olor**: `DB::transaction` o `session.begin()` en controlador, middleware global de
"transacción por request", o en el repositorio (`save` abre y cierra).
**Riesgo**: eventos publicados dentro; commit parcial cuando el handler falla tras el
`save`; imposible componer dos escrituras.
**Refactorización**:
1. Mover `DB::transaction` al handler envolviendo solo cargar/mutar/guardar.
2. Publicar eventos después. `LaravelEventBus` con `afterCommit` como red de seguridad.
3. Quitar la transacción del repositorio; documentar que `save` asume transacción externa.

## 12. SDK externo en dominio -> puerto + ACL

**Olor**: `use Stripe\PaymentIntent` o `from anthropic import Anthropic` en `Domain/` o
`Application/`; tipos del proveedor en firmas de casos de uso.
**Riesgo**: el modelo del proveedor dicta el tuyo; cambiar de proveedor toca dominio;
tests necesitan red.
**Refactorización**:
1. Definir el puerto en tipos propios: `PaymentGateway::charge(InvoiceId, Money, Token): PaymentReceipt`.
2. Adaptador `StripePaymentGateway` que envuelve el SDK y traduce errores.
3. Binding en el provider; `FakePaymentGateway` en tests. Borrar imports del SDK fuera de
   `Infrastructure/`.
4. Regla de dependencias (deptrac/import-linter) que prohíba el namespace del SDK.

## 13. Ifs sobre strings de estado -> enum y transiciones

**Olor**: `if ($invoice->status === 'issued' || $invoice->status === 'partially_paid')`
repartido por el código; typos silenciosos (`'isued'`).
**Riesgo**: transiciones inválidas no detectadas; añadir un estado exige buscar todos los ifs.
**Refactorización**:
1. `enum InvoiceStatus: string`; sustituir literales.
2. Métodos de consulta en el agregado: `acceptsPayments()`, `isLocked()`.
3. Cada transición en un método (`issue`, `cancel`) que valida el estado origen; `match`
   exhaustivo donde haga falta.

## 14. Test que necesita BD para una regla -> test de dominio

**Olor**: `RefreshDatabase` en un test cuyo nombre es "no se puede emitir sin líneas";
factories ORM para construir el escenario; suite de 3 minutos.
**Riesgo**: reglas no probadas por lentitud; tests que fallan por datos, no por reglas.
**Refactorización**:
1. Crear `InvoiceBuilder` de dominio (`anInvoice()->withLine()->issued()->build()`).
2. Reescribir el test contra el agregado, sin `TestCase` de Laravel.
3. Dejar un único test Feature por endpoint que verifique el contrato (status + `error`).

## 15. Orden recomendado de refactorización

En un módulo existente, este orden minimiza riesgo y maximiza valor temprano:

1. §5 Controlador -> caso de uso (hace visible la lógica sin cambiarla).
2. §11 Transacción al handler y eventos tras commit.
3. §7 Value objects para dinero, números e ids.
4. §2 Comportamiento al agregado, con tests de dominio (§14) a la vez.
5. §13 Enum de estados y transiciones.
6. §4 Read models para listados; §6 eventos con ids.
7. §12 Puertos y ACL para integraciones.
8. §8 Partir agregados grandes; §3 y §9 desmontar servicios gordos y cadenas de handlers.

Ver `migration-from-mvc.md` para el plan por pasos con el legacy conviviendo.
