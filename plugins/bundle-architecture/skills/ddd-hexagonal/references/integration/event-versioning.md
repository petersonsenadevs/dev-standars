# Versionado de eventos

## Índice

- [Por qué los eventos son un contrato](#por-qué-los-eventos-son-un-contrato)
- [Cambios compatibles e incompatibles](#cambios-compatibles-e-incompatibles)
- [Estrategia por defecto: aditivo y tolerante](#estrategia-por-defecto-aditivo-y-tolerante)
- [Nueva versión del evento](#nueva-versión-del-evento)
- [Upcasters](#upcasters)
- [Esquemas y validación](#esquemas-y-validación)
- [Consumidores tolerantes](#consumidores-tolerantes)
- [Ejemplos](#ejemplos)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `messaging-and-queues.md`, `outbox-pattern.md`, `anti-corruption-layer.md`,
`../application/read-models-projections.md`.

## Por qué los eventos son un contrato

Un evento publicado sale de tu control: hay mensajes en la outbox pendientes, en colas,
en DLQ, en logs y quizá en un event store, todos con la forma de ayer. Y hay consumidores
(otro contexto, otro equipo, una proyección) que dependen de esa forma. Cambiar el payload
sin plan rompe consumidores o deja mensajes antiguos imposibles de procesar.

Distingue: **evento de dominio** (clase interna, puedes refactorizarla) y **evento de
integración** (contrato serializado; versionado). El publicador traduce del primero al
segundo; el contrato es lo que se versiona.

## Cambios compatibles e incompatibles

| Cambio | Compatible | Acción |
|---|---|---|
| Añadir campo opcional (o con valor por defecto) | sí | misma versión; consumidores lo ignoran o lo usan |
| Añadir un nuevo tipo de evento | sí | consumidores ignoran tipos desconocidos |
| Eliminar un campo | no | nueva versión; o mantenerlo deprecado |
| Renombrar un campo | no | nueva versión (o añadir el nuevo y deprecar el viejo) |
| Cambiar tipo/semántica (`amount` float -> cents int) | no | nueva versión |
| Hacer obligatorio un campo opcional | no para publicadores antiguos; sí para consumidores | nueva versión si hay publicadores antiguos |
| Cambiar `type` del evento | no | es otro evento |
| Dividir un evento en dos | no | publicar ambos durante transición |

Compatible = un consumidor escrito para la versión anterior sigue funcionando sin cambios.

## Estrategia por defecto: aditivo y tolerante

1. Los publicadores solo hacen cambios **aditivos**: nuevos campos opcionales.
2. Los consumidores son **tolerantes**: ignoran campos desconocidos, aceptan ausencia de
   campos opcionales, ignoran tipos de evento que no manejan.
3. La versión entera del evento (`version: 1`) solo cambia ante incompatibilidad.

Con estas tres reglas, la mayoría de proyectos nunca pasan de la versión 1 de ningún
evento. Deprecación: marca el campo en el esquema (`deprecated: true`), sigue rellenándolo
durante N meses, mide quién lo lee, elimínalo en la siguiente versión mayor.

## Nueva versión del evento

Cuando el cambio es incompatible:

- `type` igual, `version: 2`; o `type: invoicing.invoice_issued.v2`. Elige una convención
  y mantenla. La primera permite routing por `type` con dispatch por versión; la segunda
  es más explícita en colas por tipo.
- Durante la transición, el publicador emite **v2** y (opcionalmente) también v1 hasta que
  todos los consumidores migren; o los consumidores aplican upcasters.
- Documenta en el esquema qué cambió y cómo derivar v2 desde v1 (si es posible).
- No reutilices nunca `version: 1` con otra forma.

## Upcasters

Un upcaster transforma un mensaje de versión N a N+1 antes de que el consumidor lo vea.
Cadena: v1 -> v2 -> v3. Viven en el adaptador de consumo (deserialización), no en el caso
de uso.

```ts
// contracts/invoicing/invoiceIssued.ts
export const InvoiceIssuedV1 = z.object({ invoice_id: z.string(), customer_id: z.string(), total: z.number(), currency: z.string(), issued_at: z.string() });
export const InvoiceIssuedV2 = z.object({ invoice_id: z.string(), customer_id: z.string(), total_cents: z.number().int(), currency: z.string(), issued_at: z.string(), series: z.string().default('standard') });
export type InvoiceIssued = z.infer<typeof InvoiceIssuedV2>;

const upcasters: Record<number, (p: unknown) => unknown> = {
  1: (p) => { const v1 = InvoiceIssuedV1.parse(p); return { ...v1, total: undefined, total_cents: Math.round(v1.total * 100) }; },
};
export function readInvoiceIssued(msg: { version: number; payload: unknown }): InvoiceIssued {
  let v = msg.version; let p = msg.payload;
  while (v < 2) { p = upcasters[v](p); v++; }
  return InvoiceIssuedV2.parse(p);
}
```

Un upcaster solo puede usar los datos del propio mensaje (y constantes). Si necesita
consultar BD para rellenar un campo, el campo debe ser opcional en v2 o el consumidor lo
resuelve él mismo.

Los upcasters son código de contrato: tests con fixtures reales de cada versión.

## Esquemas y validación

- Un esquema por evento y versión: JSON Schema (agnóstico), zod (TS), pydantic (Python),
  clase `readonly` + `fromPayload()` con validación (PHP). Publicado en una carpeta o
  paquete `contracts/` accesible a publicador y consumidores.
- El publicador **valida antes de escribir en outbox** (test en CI que serializa cada
  evento de dominio y valida contra el esquema).
- El consumidor valida al deserializar; mensaje inválido -> DLQ con alerta, no excepción
  silenciosa ni reintento infinito.
- Registro de esquemas (Confluent Schema Registry, Avro/Protobuf) solo con Kafka y varios
  equipos; para Redis/SQS en un monolito, el paquete `contracts/` versionado en git basta.
- Cambios al esquema pasan por revisión con la tabla de compatibilidad de arriba como
  checklist del PR.

## Consumidores tolerantes

- Deserializa a un tipo propio del consumidor con **solo los campos que usa**; el resto se
  ignora. No compartas la clase completa del evento entre contextos si puedes evitarlo.
- Campos opcionales con valores por defecto explícitos en el consumidor.
- `switch` sobre `type` con `default: ignorar + log debug`, nunca lanzar.
- Orden: no asumas que v1 llega antes que v2 ni que los eventos de distintos agregados
  llegan ordenados.
- Idempotencia por `message_id` (`idempotency.md`).
- Si el consumidor necesita más datos de los que trae el evento, consulta al contexto
  origen por su fachada (API/lector) con el id del evento; no pidas engordar el evento
  para todos.

## Ejemplos

**PHP: contrato con versión y factoría desde payload**

```php
final readonly class InvoiceIssuedV2 implements IntegrationEvent
{
    public const TYPE = 'invoicing.invoice_issued'; public const VERSION = 2;
    public function __construct(public string $invoiceId, public string $customerId, public int $totalCents, public string $currency, public string $issuedAt, public string $series = 'standard') {}

    public static function fromMessage(array $msg): self
    {
        $p = match ($msg['version']) {
            1 => self::upcastFromV1($msg['payload']),
            2 => $msg['payload'],
            default => throw UnsupportedEventVersion::for(self::TYPE, $msg['version']),
        };
        return new self($p['invoice_id'], $p['customer_id'], $p['total_cents'], $p['currency'], $p['issued_at'], $p['series'] ?? 'standard');
    }
    private static function upcastFromV1(array $p): array { return [...$p, 'total_cents' => (int) round($p['total'] * 100)]; }
}
```

**Python: pydantic tolerante**

```python
class InvoiceIssuedV2(BaseModel):
    model_config = ConfigDict(extra="ignore")      # campos desconocidos se ignoran
    invoice_id: str; customer_id: str; total_cents: int; currency: str; issued_at: datetime
    series: str = "standard"

def read_invoice_issued(msg: dict) -> InvoiceIssuedV2:
    payload = msg["payload"]
    if msg["version"] == 1:
        payload = {**payload, "total_cents": round(payload["total"] * 100)}
    return InvoiceIssuedV2.model_validate(payload)
```

**Test de compatibilidad en CI**: por cada evento, fixtures `v1.json`, `v2.json` en
`contracts/fixtures/`; el test lee cada uno con `readInvoiceIssued`/`fromMessage` y
comprueba el resultado. Añadir una versión = añadir un fixture; nunca borrar fixtures.

## Errores frecuentes

- Serializar la clase del evento de dominio como contrato; renombrar una propiedad rompe
  todo.
- Cambiar tipo o semántica de un campo manteniendo `version: 1`.
- Consumidor con `extra='forbid'` / `z.object().strict()` que muere cuando el publicador
  añade un campo.
- Eventos "gordos" con el agregado entero para que nadie tenga que consultar.
- Borrar fixtures/upcasters de versiones antiguas mientras hay mensajes en DLQ o en
  retención.
- Upcaster que consulta BD.
- Sin esquema: el contrato es "lo que el código publica ahora".
- Compartir la misma clase de evento entre contextos y hacer que un cambio en Facturación
  obligue a desplegar Clientes.

## Checklist

- [ ] Evento de dominio y evento de integración separados; traducción en el publicador.
- [ ] Esquema por evento y versión en `contracts/`, validado en publicador y consumidor.
- [ ] Solo cambios aditivos sin subir versión; incompatibles = nueva versión.
- [ ] Upcasters puros en el adaptador de consumo, con fixtures de cada versión.
- [ ] Consumidores ignoran campos y tipos desconocidos; defaults explícitos.
- [ ] Deprecación de campos con plazo y medición antes de eliminar.
- [ ] Revisión de PR con la tabla de compatibilidad para cualquier cambio de contrato.
