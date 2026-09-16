# Validación por capas

## Índice

- [Forma vs reglas: la distinción](#forma-vs-reglas-la-distinción)
- [Validación de forma en el adaptador](#validación-de-forma-en-el-adaptador)
- [Validación de negocio en el dominio](#validación-de-negocio-en-el-dominio)
- [Comprobaciones de existencia y unicidad](#comprobaciones-de-existencia-y-unicidad)
- [Mensajes y códigos de error](#mensajes-y-códigos-de-error)
- [No duplicar sin querer](#no-duplicar-sin-querer)
- [Ejemplos por stack](#ejemplos-por-stack)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Relacionado: `../stacks/laravel/overview.md` §8, `dtos-and-mapping.md`,
`use-cases.md`, `authorization.md`.

## Forma vs reglas: la distinción

| | Validación de forma | Regla de negocio |
|---|---|---|
| Pregunta | ¿el input tiene el tipo/formato esperado? | ¿esta operación es válida para el negocio ahora? |
| Ejemplos | `amount` es entero positivo; `email` tiene formato; `due_at` es fecha ISO | no se puede emitir sin líneas; el descuento máximo es 30 %; el aprobador no es el autor |
| Depende de | solo del input | del estado del agregado, del actor, del tiempo |
| Vive en | adaptador driving (Form Request, zod, pydantic) | VO, entidad, agregado, servicio de dominio |
| Resultado | 422 con mapa campo -> mensaje | excepción de dominio o `Result` -> 409/422 con código |
| Test | unitario del esquema o feature test | unitario del dominio sin framework |

La frontera: si para decidir necesitas cargar algo de BD o saber el estado actual, no es
validación de forma. Si solo miras el input, sí lo es.

## Validación de forma en el adaptador

Objetivo: que el command llegue al handler con tipos correctos. El handler puede confiar
en que `amountCents` es un `int` y `invoiceId` un UUID sintácticamente válido, y no
vuelve a comprobarlo.

- Laravel: Form Request con `rules()`. Un Form Request por endpoint, en
  `Infrastructure/Http` del módulo. Su método `toCommand()` construye el command.
- TypeScript: esquema zod/valibot junto al route handler o server action;
  `schema.safeParse(body)` -> command tipado por inferencia (`z.infer`).
- Python: modelo pydantic como `body` del endpoint; `model_dump()` -> dataclass command.

El esquema **no** importa nada del dominio; a lo sumo comparte enums de strings.

## Validación de negocio en el dominio

- **VO**: garantizan validez local en construcción (`Money` no negativo, `Percentage`
  0-100, `Email` normalizado). Si el VO existe, es válido; el handler no re-valida.
- **Agregado**: invariantes de transición en cada método (`issue()` sin líneas,
  `approve()` en estado incorrecto). Lanza excepción con constructor nombrado o devuelve
  `Result`.
- **Servicio de dominio**: reglas entre agregados o que necesitan datos que el handler
  pasa como hechos (`PricingPolicy`, `CreditLimitPolicy::allows(customer, amount)`).

El dominio nunca devuelve "lista de errores de formulario"; devuelve **una** violación con
código (`INVOICE_WITHOUT_LINES`). Si la UX necesita varias violaciones a la vez, es una
validación de forma disfrazada o una query de "previsualización" separada.

## Comprobaciones de existencia y unicidad

Zona gris frecuente:

| Comprobación | Dónde | Por qué |
|---|---|---|
| El `customer_id` referenciado existe | Form Request `exists:` **y** handler (`?? throw NotFound`) | el primero da feedback rápido; el segundo es la garantía |
| El email de usuario es único | handler vía repositorio (`existsWithEmail`) + índice único en BD | la regla es de negocio; el índice cierra la carrera |
| El número de factura es único por serie | dominio (secuencia con lock) + índice único | invariante |
| La fecha de vencimiento no es pasada | depende: forma si es UX; dominio si es regla (`Clock`) | la fecha "hoy" es un dato del dominio, no del request |

`unique:` y `exists:` de Laravel valen como cortesía de UI; nunca como única defensa. El
índice único de BD es la única garantía real bajo concurrencia; captura la violación en
el repositorio y tradúcela a una excepción de dominio (`EmailAlreadyRegistered`).

## Mensajes y códigos de error

- Forma: mensajes por campo, traducibles por el framework (`validation.php`, zod
  `errorMap`, pydantic `loc`). Estructura estable: `{ errors: { field: [msg] } }`.
- Negocio: `{ error: { code: 'INVOICE_WITHOUT_LINES', message: '...' } }`. El **código**
  es el contrato con el frontend; el mensaje es humano y traducible en el adaptador.
- La excepción de dominio lleva el código y los datos (`invoiceId`), no el texto final
  traducido. El mapeo código -> texto -> HTTP está en el adaptador (handler global de
  excepciones, `toHttpError`).
- HTTP: 422 para forma; 409 para conflicto de estado (ya emitida, versión obsoleta); 422
  también aceptable para reglas de negocio sobre input; 404 para no encontrado; 403 para
  permiso.

## No duplicar sin querer

Duplicación **aceptable**: formato de email en zod y en `Email.of()`. Barata, y cada capa
necesita su garantía.

Duplicación **problemática**: la regla "descuento máximo 30 %" escrita en el Form Request,
en el VO `Discount` y en el componente Vue. Cuando cambie a 35 %, alguien olvidará una.
Remedio:

- La fuente de verdad es el dominio (`Discount::MAX`).
- El adaptador puede exponer la constante al esquema de forma (`max:` leyendo
  `Discount::MAX`) si la regla es estática. Si depende del cliente/estado, no la pongas en
  el esquema: deja que el dominio la rechace y muestra el código.
- Frontend: valida forma; para reglas de negocio, muestra el error que devuelve el
  backend. No reimplementes reglas en el cliente salvo por UX, y entonces con el mismo
  origen (endpoint de configuración o constantes generadas).

## Ejemplos por stack

**Laravel: Form Request -> command; dominio rechaza**

```php
final class AddInvoiceLineRequest extends FormRequest
{
    public function rules(): array
    {
        return ['description' => ['required', 'string', 'max:255'],
                'unit_price_cents' => ['required', 'integer', 'min:0'],
                'quantity' => ['required', 'integer', 'min:1']];
    }
    public function toCommand(string $invoiceId): AddInvoiceLineCommand
    {
        $v = $this->validated();
        return new AddInvoiceLineCommand($invoiceId, $v['description'], $v['unit_price_cents'], 'EUR', $v['quantity'], $this->user()->id);
    }
}
// Agregado: if ($this->status !== Draft) throw InvoiceIsLocked::for($this->id);  -> 409
```

**TypeScript: zod en el borde, Result en el dominio**

```ts
const AddLineSchema = z.object({
  description: z.string().min(1).max(255),
  unitPriceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

export async function addLineAction(invoiceId: string, raw: unknown) {
  const parsed = AddLineSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };  // forma
  const r = await handlers.addInvoiceLine({ invoiceId, ...parsed.data, actorId: await currentUserId() });
  if (!r.ok) return { error: r.error.kind };                                          // negocio: 'InvoiceLocked'
  return { ok: true };
}
```

**Python: pydantic en el router, excepción de dominio mapeada**

```python
class AddLineIn(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    unit_price_cents: int = Field(ge=0)
    quantity: int = Field(ge=1)

@router.post("/invoices/{id}/lines", status_code=201)
def add_line(id: str, body: AddLineIn, uc: AddInvoiceLine = Depends(add_invoice_line)):
    uc(AddInvoiceLineCommand(invoice_id=id, **body.model_dump(), currency="EUR"))

@app.exception_handler(DomainError)
def domain_error(_, e: DomainError):
    return JSONResponse(status_code=409, content={"error": {"code": e.code, "message": str(e)}})
```

## Errores frecuentes

- Reglas de negocio en el Form Request (`Rule::when($invoice->status === 'issued', ...)`):
  el request carga agregados y decide negocio; jobs y CLI no pasan por ahí.
- Handler que re-valida forma (`if (!is_int($cmd->amount))`): desconfianza inútil; el
  tipo del command ya lo garantiza.
- VO que acepta cualquier cosa y "valida después" con `isValid()`: si existe, debe ser válido.
- Devolver mensajes traducidos desde el dominio: acopla el dominio a i18n; devuelve
  código y datos.
- Confiar en `unique:` de Laravel para unicidad: falla bajo concurrencia sin índice único.
- Frontend con copia de las reglas de negocio que deriva con el tiempo.
- Un `ValidationException` genérico para todo: forma y negocio necesitan formatos y
  códigos HTTP distintos.

## Checklist

- [ ] Forma en el adaptador (Form Request / zod / pydantic); negocio en VO/agregado.
- [ ] El handler recibe tipos correctos y no re-valida forma.
- [ ] Reglas que dependen de estado, actor o tiempo viven en el dominio.
- [ ] Unicidad respaldada por índice único; violación traducida a excepción de dominio.
- [ ] Errores de negocio con código estable; texto y HTTP resueltos en el adaptador.
- [ ] Constantes de negocio con una sola fuente (dominio), expuestas al esquema si procede.
- [ ] Frontend valida forma y muestra códigos del backend para negocio.
