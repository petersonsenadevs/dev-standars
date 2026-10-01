# Consistencia eventual

## Índice

- [Qué es y de dónde sale](#qué-es-y-de-dónde-sale)
- [Cuándo aceptarla y cuándo no](#cuándo-aceptarla-y-cuándo-no)
- [Garantías que sí puedes dar](#garantías-que-sí-puedes-dar)
- [UX: estados pendientes y read-your-writes](#ux-estados-pendientes-y-read-your-writes)
- [Compensaciones](#compensaciones)
- [Detección y reparación de inconsistencias](#detección-y-reparación-de-inconsistencias)
- [Comunicación con negocio](#comunicación-con-negocio)
- [Ejemplo: emitir factura y actualizar saldo del cliente](#ejemplo-emitir-factura-y-actualizar-saldo-del-cliente)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `outbox-pattern.md`, `sagas-process-managers.md`, `idempotency.md`,
`../application/read-models-projections.md`.

## Qué es y de dónde sale

Consistencia eventual: tras un cambio, otras partes del sistema lo reflejan **más tarde**,
no en la misma transacción. Aparece en cuanto decides que un agregado = una transacción
(`../tactical/overview-concepts.md` §4): el segundo agregado, el otro contexto, la
proyección o el sistema externo se actualizan reaccionando a un evento.

No es una degradación: es la consecuencia de no bloquear todo el sistema en cada
operación. El coste es diseño explícito de los estados intermedios.

## Cuándo aceptarla y cuándo no

| Acepta consistencia eventual | Exige consistencia inmediata |
|---|---|
| Entre agregados distintos (factura -> saldo del cliente) | Dentro de un agregado (líneas -> total) |
| Entre contextos (Ventas -> Facturación) | Invariantes de negocio duras (no vender más stock del que hay, si negocio lo exige) |
| Proyecciones, buscadores, dashboards, notificaciones | Lo que el usuario ve inmediatamente después de su propia acción (con read-your-writes) |
| Integraciones con terceros (contabilidad, CRM) | Secuencias legales (numeración de facturas) |
| Cualquier efecto cuya latencia de segundos no cambia una decisión | Autorización y saldos con límite duro |

Pregunta clave a negocio: "si esto tarda 5 segundos (o 5 minutos) en reflejarse, ¿qué
decisión se toma mal?". Si la respuesta es "ninguna", es eventual. Si es "alguien podría
comprar sin saldo", entonces o bien es un mismo agregado, o bien aceptas el riesgo con
compensación (sobreventa con cancelación), o bien es una transacción explícita en el
monolito, documentada como deuda de acoplamiento.

## Garantías que sí puedes dar

- **At-least-once** con outbox: el evento llegará, quizá repetido. Consumidores idempotentes.
- **Orden por agregado**: eventos del mismo agregado se procesan en orden si la
  partición/cola lo respeta. Entre agregados, no.
- **Latencia acotada**: métrica de edad del mensaje pendiente + alerta. "Eventual" debe
  tener un número: p95 < 2 s, máximo tolerable 5 min.
- **Convergencia**: si todo funciona, el estado final es el mismo que con una transacción.
  Si algo falla permanentemente, hay un mecanismo (reintento, dead-letter, reparación) que
  lo lleva al estado final o lo señala.

No puedes dar: exactly-once end-to-end, lectura inmediata consistente en todos los
modelos, atomicidad entre contextos.

## UX: estados pendientes y read-your-writes

- **Estados explícitos en el modelo**: `PaymentStatus: Pending | Confirmed | Failed`. El
  usuario ve "Pago en proceso", no un spinner infinito ni un estado final falso.
- **Read-your-writes**: tras un command, la pantalla del mismo usuario debe reflejar su
  cambio. Opciones: responder con el DTO resultante y actualizar el cliente sin releer;
  leer del modelo de escritura durante N segundos; incluir la versión en la respuesta y
  esperar a que la proyección alcance esa versión (`?minVersion=`).
- **Feedback asíncrono**: notificación in-app, polling ligero o SSE/WebSocket cuando el
  proceso termina. Sin esto el usuario recarga compulsivamente.
- **Acciones bloqueadas mientras pende**: si el estado es `Pending`, deshabilita acciones
  que dependan del resultado y explícalo.
- **Idempotencia en la UI**: botón deshabilitado tras clic + clave de idempotencia; el
  usuario impaciente reenvía.

## Compensaciones

Cuando un paso posterior falla y no se puede reintentar hasta el éxito, hay que deshacer
el efecto del paso anterior con una **acción de negocio inversa** (no un rollback):

| Acción | Compensación |
|---|---|
| Reservar stock | Liberar reserva |
| Cobrar | Reembolsar |
| Emitir factura | Emitir factura rectificativa (no borrar) |
| Enviar email | No hay: envía un segundo email aclaratorio |

Las compensaciones son casos de uso normales, con sus reglas, y se disparan desde el
proceso (`sagas-process-managers.md`). Diseña primero qué es compensable y qué no; lo no
compensable (email, envío físico) va al final del proceso.

## Detección y reparación de inconsistencias

Aunque todo esté bien diseñado, habrá inconsistencias (bug en un consumidor, mensaje
descartado a dead-letter y olvidado). Prepara:

- **Reconciliación periódica**: job que compara fuentes (`SUM(invoices.total)` vs
  `customer_balances.total`) y reporta o corrige. Útil también para integraciones con
  terceros (Stripe vs pagos internos).
- **Replay**: reprocesar eventos desde la outbox o el histórico para un agregado o rango
  de fechas. Requiere consumidores idempotentes.
- **Rebuild** de proyecciones desde cero (`../application/read-models-projections.md`).
- **Dead-letter con revisión humana** y procedimiento escrito.
- **Alertas** sobre edad de pendientes y tasa de fallos.

## Comunicación con negocio

- Habla de **tiempos**, no de patrones: "el saldo se actualiza en menos de 10 segundos;
  en incidentes, hasta 1 hora, y el sistema avisa".
- Presenta los estados intermedios como estados de negocio reales ("pendiente de
  confirmación bancaria") que aparecerán en pantallas e informes.
- Acuerda qué pasa en el fallo permanente de cada paso: quién revisa, qué se le dice al
  cliente, qué se compensa.
- Documenta la decisión (ADR): qué es eventual, latencia esperada, compensaciones.
  Negocio firma la latencia máxima.

## Ejemplo: emitir factura y actualizar saldo del cliente

```
IssueInvoice (Invoicing)                            UpdateCustomerBalance (Customers)
  tx: invoice.issue(); save; outbox(InvoiceIssued)   <- consumidor: balance.add(total); save; processed(msg_id)
  respuesta 202 { invoiceId, status: 'issued' }      proyección CustomerSummary: outstanding_cents += total
```

```ts
// Consumidor idempotente (Customers)
export const onInvoiceIssued = (d: { balances: CustomerBalanceRepository; tx: TransactionRunner; inbox: Inbox }) =>
  async (msg: Message<InvoiceIssuedV1>) => {
    await d.tx.run(async (ctx) => {
      if (!(await d.inbox.markProcessed('customers.balance', msg.id, ctx))) return;   // ya visto
      const balance = (await d.balances.ofCustomer(CustomerId.of(msg.payload.customerId), ctx)) ?? CustomerBalance.empty(...);
      balance.add(Money.of(msg.payload.totalCents, msg.payload.currency), InvoiceId.of(msg.payload.invoiceId));
      await d.balances.save(balance, ctx);
    });
  };
```

UI: la ficha del cliente muestra el saldo del read model; la pantalla de la factura recién
emitida muestra los datos que devolvió el command. Reconciliación nocturna compara
`SUM(invoices)` con `customer_balances`.

## Errores frecuentes

- Decir "eventual" sin número de latencia ni alerta.
- Estados finales falsos en la UI ("Pagado") antes de la confirmación.
- Compensar con `DELETE`: borra el rastro; en negocio se rectifica, no se borra.
- Consumidores que asumen orden global entre agregados.
- Sin reconciliación: la primera inconsistencia se descubre por un cliente.
- Convertir todo en eventual, incluidas invariantes duras que negocio no acepta.
- Transacción distribuida "casera" (dos commits secuenciales con try/catch) creyendo que
  es atómica.

## Checklist

- [ ] Para cada relación entre agregados/contextos está decidido: inmediata o eventual.
- [ ] Latencia objetivo y máxima documentadas y monitorizadas.
- [ ] Estados intermedios modelados y visibles en UI.
- [ ] Read-your-writes resuelto para el usuario que ejecuta el command.
- [ ] Compensaciones definidas como casos de uso; lo no compensable al final.
- [ ] Reconciliación periódica y replay disponibles.
- [ ] Negocio ha aceptado por escrito la latencia y el comportamiento ante fallo.
