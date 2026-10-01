# Anti-patrones: síntoma, por qué duele, arreglo

Índice
1. Modelo anémico
2. Agregados gigantes
3. Repositorio genérico con 40 métodos
4. Entidad = fila de BD (fuga del ORM al dominio)
5. Casos de uso que llaman a otros casos de uso
6. Eventos síncronos que acoplan todo
7. DTOs por todas partes sin necesidad
8. Abstracción del framework por moda
9. Interfaces con una sola implementación sin motivo
10. ACL inexistente frente a APIs externas
11. Transacciones en el controlador
12. Lógica en listeners
13. Value objects que no validan
14. Read side a través del agregado
15. Excepciones genéricas para errores de negocio
16. Dominio que conoce el usuario autenticado

---

## 1. Modelo anémico

**Síntoma**: entidades con getters/setters y cero métodos de negocio; las reglas están en
"services" que reciben la entidad, la inspeccionan y la mutan desde fuera.
```php
$invoice->setStatus('issued'); $invoice->setIssuedAt(now()); // desde InvoiceService
```
**Por qué duele**: las invariantes se repiten en cada servicio que toca la entidad, y se
olvidan en el tercero. No hay un sitio donde leer "qué puede hacer una factura".
**Arreglo**: mover cada mutación a un método con nombre de negocio (`issue()`), eliminar
setters, validar dentro. El servicio queda como orquestador o desaparece.

## 2. Agregados gigantes

**Síntoma**: `Customer` contiene pedidos, facturas, direcciones, tickets, y cargarlo hace
12 joins. Dos usuarios editando cosas distintas del mismo cliente se pisan.
**Por qué duele**: una transacción por agregado significa bloqueo/conflicto en todo el
grafo; rendimiento pésimo; tests que necesitan construir medio mundo.
**Arreglo**: un agregado por invariante real. `Order`, `Invoice`, `Customer` separados,
referenciados por id. Preguntar "¿qué tiene que ser consistente en la misma transacción?";
lo demás va fuera y se coordina por eventos.

## 3. Repositorio genérico con 40 métodos

**Síntoma**: `BaseRepository<T>` con `all, find, findBy, where, paginate, orderBy,
with, first, count, ...`; o `InvoiceRepository` con `findByCustomerAndStatusAndDate`.
**Por qué duele**: es un query builder con otro nombre; no hay abstracción, los tests
tienen que simular un ORM; y las lecturas de pantalla deforman la interfaz del agregado.
**Arreglo**: repositorio con `ofId`, `save`, `nextId` y 1-3 consultas de dominio con
nombre de negocio (`overdueAt(date)`). Listados -> read models/queries directas (CQRS
ligero). Si un método solo lo usa una pantalla, no va en el repositorio.

## 4. Entidad = fila de BD (fuga del ORM al dominio)

**Síntoma**: `class Invoice extends Model` en `Domain/`, o entidades con `@Column`,
`$fillable`, `relations()`. Los tests de dominio necesitan BD.
**Por qué duele**: el esquema dicta el modelo; no puedes tener VO reales (Money en dos
columnas), ni encapsular (todo es público via magic), ni probar sin BD. El "dominio" es
Eloquent con otra carpeta.
**Arreglo**: entidad propia (clase plana), modelo ORM en `Infrastructure/Persistence`,
mapeo explícito en el repositorio. Aceptar que hay dos clases; el mapeo son 30 líneas.
Excepción pragmática: CRUD sin reglas, donde directamente no hay dominio.

## 5. Casos de uso que llaman a otros casos de uso

**Síntoma**: `IssueInvoiceHandler` inyecta `SendInvoiceEmailHandler` y
`PostLedgerEntryHandler` y los invoca.
**Por qué duele**: transacciones anidadas, acoplamiento entre intenciones de usuario
distintas, un fallo en el email deshace la emisión, y el grafo de handlers se vuelve
inescrutable.
**Arreglo**: (a) si es la misma transacción y la misma regla, la lógica común va a un
servicio de dominio o al agregado; (b) si es una reacción, evento de dominio + listener
que invoca al segundo caso de uso; (c) si es composición de pasos en un flujo, un
"process manager"/saga explícito, no una cadena oculta.

## 6. Eventos síncronos que acoplan todo

**Síntoma**: al emitir factura se disparan 7 listeners síncronos que envían email, llaman
a Stripe, regeneran un PDF y actualizan Elastic; la petición tarda 4 s y falla si Stripe
está caído.
**Por qué duele**: el evento se ha convertido en una llamada directa disfrazada; el
usuario paga el coste de efectos que no le importan; un listener puede romper el commit.
**Arreglo**: publicar tras commit; listeners con IO en cola (`ShouldQueue`, jobs,
BackgroundTasks); solo reacciones que deban ser consistentes se quedan síncronas y dentro
del mismo agregado o transacción. Si necesitas garantía, outbox.

## 7. DTOs por todas partes sin necesidad

**Síntoma**: `CreateInvoiceRequestDto` -> `CreateInvoiceCommandDto` -> `InvoiceDto` ->
`InvoiceResponseDto`, todos con los mismos 6 campos, y mappers entre ellos.
**Por qué duele**: cuatro archivos por cada cambio de campo; nadie sabe cuál es la fuente
de verdad; el ruido esconde el DTO que sí importa.
**Arreglo**: un command por caso de uso (entrada), un DTO de salida solo si hay salida,
y el Form Request / zod schema como validación de forma. El Resource/serializer del
framework puede construirse desde el DTO de salida sin clase intermedia.

## 8. Abstracción del framework por moda

**Síntoma**: `interface LoggerInterface`, `interface CacheInterface`, `interface
ConfigInterface` propias que envuelven las del framework 1:1; `Application/` no puede
usar `Illuminate\Support\Collection` "por pureza".
**Por qué duele**: código de envoltorio sin comportamiento, y cada feature nueva del
framework hay que re-exponerla. La portabilidad entre frameworks no ocurre nunca.
**Arreglo**: en `Domain/` cero framework. En `Application/` permitir contratos estables
y sin IO (PSR Logger, Clock propio, colecciones). Abstraer solo lo que tenga IO o quieras
sustituir en tests. El framework se cambia rehaciendo `Infrastructure/`, no envolviendo todo.

## 9. Interfaces con una sola implementación sin motivo

**Síntoma**: `PricingCalculatorInterface` + `PricingCalculator`; ninguna otra impl, ningún
test la sustituye. IDE salta a la interfaz vacía.
**Por qué duele**: indirección gratuita; el binding en el contenedor es un archivo más
que mantener; da falsa sensación de desacoplamiento.
**Arreglo**: interfaz solo para puertos driven con IO (repositorio, gateway, reloj, bus)
o cuando haya de verdad dos implementaciones. Servicios puros de dominio: clase final,
sin interfaz. Se puede extraer la interfaz el día que haga falta (refactor de 2 minutos).

## 10. ACL inexistente frente a APIs externas

**Síntoma**: `StripeCustomer`, `HubSpotDeal`, respuestas JSON del proveedor o modelos del
SDK circulando por casos de uso y entidades. Cambia la API v2 -> v3 y toca 40 archivos.
**Por qué duele**: el modelo del proveedor se convierte en tu modelo; su nomenclatura y
sus nulls contaminan el dominio; no puedes testear sin sus objetos.
**Arreglo**: puerto en tu vocabulario (`PaymentGateway::charge(Money, CustomerId):
PaymentResult`) + adaptador que llama al SDK y traduce en ambos sentidos. El adaptador
es el ACL; sus tests usan un servidor fake. Errores del proveedor -> excepciones o Result
tuyos.

## 11. Transacciones en el controlador

**Síntoma**: `DB::transaction(function () { $action(...); Mail::send(...); })` en el
controlador; o `prisma.$transaction` en el route handler.
**Por qué duele**: el controlador decide semántica de consistencia que pertenece al caso
de uso; la misma acción desde un job o CLI se ejecuta sin transacción; el email va dentro
del commit.
**Arreglo**: transacción en el handler (o decorador/middleware del bus). Efectos con IO
externo fuera, tras commit, vía eventos.

## 12. Lógica en listeners

**Síntoma**: `OnInvoiceIssued` calcula comisiones, decide si aplica descuento, actualiza
tres tablas y llama a dos APIs.
**Por qué duele**: la lógica está en el sitio menos visible, sin transacción clara, sin
test de dominio, y se ejecuta en un orden que nadie controla.
**Arreglo**: listener = adaptador de 5 líneas que traduce el evento a un command y llama
a un caso de uso. Las reglas van a un agregado (`Commission`) o servicio de dominio.

## 13. Value objects que no validan

**Síntoma**: `new Email($raw)` acepta cualquier string; la validación está en el Form
Request y "se supone" que ya llegó válido.
**Por qué duele**: el VO no garantiza nada, así que cada consumidor vuelve a comprobar; y
el dato entra inválido por cualquier camino que no sea HTTP (job, import CSV, seed).
**Arreglo**: validar en el constructor/factory, lanzar excepción de dominio. El Form
Request valida forma para dar buen feedback de UI; el VO valida de verdad.

## 14. Read side a través del agregado

**Síntoma**: para listar 200 facturas se llama a `repository->all()`, se rehidratan 200
agregados con sus líneas y se mapean a array para la tabla.
**Por qué duele**: N+1, memoria, y presión para añadir al agregado campos "para la
pantalla" (`customerName`, `formattedTotal`).
**Arreglo**: query dedicada (`PendingInvoicesReader`) que devuelve DTOs planos con SQL/
ORM directo. El agregado solo se carga para cambiarlo.

## 15. Excepciones genéricas para errores de negocio

**Síntoma**: `throw new \Exception('Cannot issue')`, `throw new RuntimeException`, o
`abort(422)` dentro del dominio.
**Por qué duele**: el adaptador HTTP no puede mapear a código/mensaje; los tests hacen
match por string; el dominio conoce HTTP.
**Arreglo**: excepciones de dominio con nombre (`InvoiceCannotBeIssued::withoutLines(id)`)
y una jerarquía mínima (`DomainException`), o Result type en TS. Mapeo a HTTP en un solo
sitio del adaptador.

## 16. Dominio que conoce el usuario autenticado

**Síntoma**: `auth()->user()` o `request.user` dentro de entidades, servicios de dominio
o handlers.
**Por qué duele**: el dominio depende de una sesión HTTP; imposible ejecutar desde un job
o test sin simular login; la autorización se mezcla con la regla.
**Arreglo**: el adaptador driving resuelve el actor y lo pasa en el command (`actorId`).
Autorización de acceso: policy/middleware en el adaptador. Regla de negocio que depende
del actor ("solo el emisor puede anular"): dentro del agregado, con el `UserId` recibido.
