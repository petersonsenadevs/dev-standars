# Ficha de bounded context: plantilla

Copiar la sección "Plantilla" a `docs/contexts/<contexto>.md`. Una ficha por contexto,
mantenida por el equipo dueño; se revisa cuando cambia un agregado, un evento publicado o
una relación con otro contexto. Cabe en una pantalla; el detalle vive en el código y en
el glosario (`glossary.md`).

---

## Plantilla

```markdown
# Contexto: <Nombre>

- **Módulo / paquete**: `src/<Contexto>/` · `src/modules/<contexto>/` · `src/<contexto>/`
- **Equipo dueño**: <equipo> — contacto: <canal>
- **Estado**: Activo | En extracción | Legacy | Planificado
- **Última revisión**: AAAA-MM-DD

## 1. Propósito

<Una o dos frases: qué capacidad de negocio cubre y qué NO cubre. Ejemplo: "Emite,
cobra y anula facturas. No gestiona clientes ni ejecuta cobros en pasarela.">

## 2. Lenguaje ubicuo (resumen)

| Término | Definición corta | En código |
|---|---|---|
| <Término> | <definición> | `<Clase/método>` |

Glosario completo: `docs/glossary/<contexto>.md`.

## 3. Agregados

| Agregado | Raíz | Invariantes principales | Repositorio |
|---|---|---|---|
| <Nombre> | `<Clase>` | <2-4 invariantes> | `<Interfaz>` |

## 4. Comandos (casos de uso de escritura)

| Comando | Handler | Agregado(s) | Canales driving |
|---|---|---|---|
| <VerboAgregado> | `<Handler>` | <Agregado> | HTTP, job, CLI, webhook |

## 5. Consultas (read models)

| Reader | Devuelve | Consumido por |
|---|---|---|
| `<Reader>` | `<Row/DTO>` | <pantalla/API> |

## 6. Eventos publicados

| Evento | Nombre de integración | Payload (campos) | Consumidores conocidos |
|---|---|---|---|
| `<Evento>` | `<contexto>.<agregado>_<verbo>.v1` | <ids, importes, fecha> | <contexto/servicio> |

## 7. Eventos consumidos

| Evento (origen) | Reacción (caso de uso o listener) | Idempotencia |
|---|---|---|
| `<origen>.<evento>.v1` | `<Handler/Listener>` | <clave> |

## 8. Puertos driven

| Puerto | Tipo | Adaptador actual | Fake en tests |
|---|---|---|---|
| `<Puerto>` | persistencia / gateway externo / ACL / reloj / bus | `<Adaptador>` | `<Fake>` |

## 9. Relaciones con otros contextos

| Contexto | Tipo de relación | Dirección | Contrato |
|---|---|---|---|
| <Otro> | customer/supplier · conformist · ACL · published language · shared kernel · separate ways | upstream / downstream | <evento, API, módulo> |

Diagrama (opcional):
[Otro] --(tipo)--> [Este] --(tipo)--> [Otro]

## 10. Datos compartidos y snapshots

<Qué datos de otros contextos guarda este como copia (y cuándo se toma la copia).>

## 11. Reglas de dependencia y verificación

- Regla de capas: <deptrac / dependency-cruiser / import-linter, nombre del contrato>
- Independencia entre contextos: <contrato>
- Suite: `<comando de tests del módulo>`

## 12. Decisiones y deuda

| ADR | Título | Estado |
|---|---|---|
| ADR-NNNN | <título> | Aceptado |

Deuda conocida: <lista corta con enlace a tickets>.
```

---

## Ejemplo resumido: Facturación

```markdown
# Contexto: Facturación (Invoicing)

- **Módulo**: `src/Invoicing/` — **Equipo**: Backoffice — **Estado**: Activo — **Revisión**: 2026-03-12

## 1. Propósito
Emite, cobra y anula facturas de clientes. No gestiona datos de cliente (Clientes) ni
ejecuta cobros en pasarela (Pagos): los consume vía ACL.

## 3. Agregados
| Agregado | Raíz | Invariantes | Repositorio |
|---|---|---|---|
| Factura | `Invoice` | solo Draft admite líneas; no se emite sin líneas; cobro <= pendiente; Cancelled terminal | `InvoiceRepository` |
| Secuencia | `InvoiceSequence` | número correlativo único por (serie, año) | `InvoiceSequenceRepository` |

## 4. Comandos
| Comando | Handler | Canales |
|---|---|---|
| IssueInvoice | `IssueInvoiceHandler` | HTTP (Inertia), job nocturno |
| RegisterPayment | `RegisterPaymentHandler` | HTTP, webhook Stripe |
| CancelInvoice | `CancelInvoiceHandler` | HTTP |

## 6. Eventos publicados
| Evento | Integración | Payload | Consumidores |
|---|---|---|---|
| `InvoiceIssued` | `invoicing.invoice_issued.v1` | invoice_id, customer_id, number, total_cents, currency, issued_at | Contabilidad, listener PDF |
| `InvoicePaid` | `invoicing.invoice_paid.v1` | invoice_id, number, paid_at | Contabilidad |

## 8. Puertos driven
| Puerto | Tipo | Adaptador | Fake |
|---|---|---|---|
| `PaymentGateway` | ACL (Pagos) | `StripePaymentGateway` | `FakePaymentGateway` |
| `CustomerBillingData` | ACL (Clientes) | `CustomersModuleBillingData` | `InMemoryCustomerBillingData` |

## 9. Relaciones
| Contexto | Relación | Dirección | Contrato |
|---|---|---|---|
| Clientes | customer/supplier + ACL | upstream | `CustomerBillingData` |
| Pagos (Stripe) | ACL | upstream | `PaymentGateway` |
| Contabilidad | published language | downstream | eventos v1 |

## 12. Decisiones
| ADR-0007 | Anular + rectificativa en una transacción | Aceptado |
```

Recorrido completo del ejemplo: `references/examples/walkthrough-invoicing.md`.
