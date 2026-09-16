# ADR: plantilla de Architecture Decision Record

Copiar la sección "Plantilla" a `docs/adr/NNNN-titulo-corto.md`. Un ADR por decisión;
nunca se edita uno aceptado: se escribe otro que lo sustituye (`Supersedes`).

Numeración correlativa de cuatro dígitos. Título en imperativo o como afirmación
("Publicar eventos tras el commit", "Invoice y rectificativa en la misma transacción").

---

## Plantilla

```markdown
# ADR-NNNN: <título>

- **Estado**: Propuesto | Aceptado | Rechazado | Obsoleto | Sustituido por ADR-NNNN
- **Fecha**: AAAA-MM-DD
- **Contexto (bounded context)**: <Facturación | Soporte | Transversal>
- **Decisores**: <nombres/roles>
- **Relacionados**: ADR-NNNN, <ticket>, <ficha de contexto>

## Contexto

<Qué situación obliga a decidir. Hechos, restricciones, fuerzas en tensión. Sin opinar
todavía. 3-8 líneas. Incluir la regla de la biblioteca que se cumple o se rompe, si aplica.>

## Opciones consideradas

### Opción A: <nombre>
- Descripción: <una o dos frases>
- Ventajas: <lista>
- Inconvenientes: <lista>

### Opción B: <nombre>
- Descripción:
- Ventajas:
- Inconvenientes:

### Opción C: <nombre> (si la hay)

## Decisión

<Opción elegida y por qué, en una o dos frases. Qué criterio ha pesado más.>

## Consecuencias

- Positivas: <qué mejora>
- Negativas: <qué se acepta a cambio; deuda asumida>
- Neutras / a vigilar: <señales que obligarían a revisar la decisión>

## Cumplimiento

<Cómo se verifica: regla de deptrac/import-linter, test, revisión en checklist. Si es una
excepción a una regla general, indicar dónde queda documentada la excepción.>
```

---

## Ejemplo relleno

```markdown
# ADR-0007: Anular factura y emitir rectificativa en la misma transacción

- **Estado**: Aceptado
- **Fecha**: 2026-03-12
- **Contexto (bounded context)**: Facturación
- **Decisores**: equipo Facturación, responsable fiscal
- **Relacionados**: ADR-0003 (un agregado por transacción), ticket FAC-214

## Contexto

La regla general del proyecto (ADR-0003) es una transacción por agregado. Anular una
factura emitida exige, por normativa, que exista una rectificativa emitida con número de
la serie R. Si la anulación se guarda y la rectificativa falla (numeración, caída), queda
una factura anulada sin rectificativa: estado fiscalmente inválido. Ambos agregados
(`Invoice` original y `Invoice` rectificativa) pertenecen a este contexto y a la misma BD.

## Opciones consideradas

### Opción A: dos casos de uso coordinados por evento
- Descripción: `CancelInvoice` publica `InvoiceCancelled`; un listener ejecuta `IssueCreditNote`.
- Ventajas: respeta ADR-0003; desacoplado.
- Inconvenientes: ventana de inconsistencia; requiere compensación y monitorización de
  "anuladas sin rectificativa"; complejidad operativa para un caso que siempre va junto.

### Opción B: un caso de uso, dos escrituras en una transacción
- Descripción: `CancelInvoiceHandler` guarda la original y la rectificativa dentro de
  `DB::transaction`; `Invoice::cancel()` devuelve la rectificativa.
- Ventajas: atomicidad; una sola regla de negocio visible en el agregado; simple.
- Inconvenientes: excepción explícita a ADR-0003; lock de la secuencia R dentro de la
  transacción (aceptable: milisegundos).

### Opción C: la rectificativa como entidad hija de la original
- Descripción: un solo agregado que contiene ambas.
- Ventajas: sin excepción a la regla.
- Inconvenientes: la rectificativa tiene número, cobros y ciclo de vida propios; el
  agregado crecería y se cargaría siempre doble.

## Decisión

Opción B. La atomicidad es un requisito legal y ambos agregados viven en el mismo contexto
y base de datos; el coste de la opción A no está justificado.

## Consecuencias

- Positivas: imposible tener anulada sin rectificativa; handler de 15 líneas; tests de
  dominio cubren la creación de la rectificativa sin BD.
- Negativas: excepción documentada a "un agregado por transacción"; si Facturación se
  extrajera a un servicio con BD distinta para rectificativas, habría que revisar.
- A vigilar: tiempo de bloqueo de `invoice_sequences` serie R bajo carga.

## Cumplimiento

- Comentario en `CancelInvoiceHandler` referenciando este ADR.
- `design-review-checklist.md` 9.1 satisfecho por este documento.
- Test de integración `CancelInvoiceHandlerTest::it_rolls_back_both_when_sequence_fails`.
```

---

## Cuándo escribir un ADR

- Se rompe o se matiza una regla dura de `SKILL.md` §4 o del stack.
- Se elige entre alternativas con coste de cambio alto (ORM, bus, estrategia de eventos,
  proveedor externo, corte de contexto, extracción a servicio).
- Se descarta una opción que alguien volverá a proponer.

No hace falta ADR para decisiones reversibles en una tarde o ya cubiertas por la biblioteca.
