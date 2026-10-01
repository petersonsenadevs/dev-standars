# Value Objects: inmutables, válidos por construcción

## Índice

- [Definición operativa](#definición-operativa)
- [Inmutabilidad por stack](#inmutabilidad-por-stack)
- [Igualdad por valor](#igualdad-por-valor)
- [Validación en construcción](#validación-en-construcción)
- [VO compuestos: Money, DateRange, Email, Address](#vo-compuestos-money-daterange-email-address)
- [Enums como value objects](#enums-como-value-objects)
- [Serialización y persistencia](#serialización-y-persistencia)
- [Cuándo no crear un VO](#cuándo-no-crear-un-vo)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

Amplía [overview-concepts](overview-concepts.md) §3. Relacionado: [entities](entities.md),
[invariants-and-errors](invariants-and-errors.md), [specifications](specifications.md).

## Definición operativa

Un VO describe una característica, no una cosa: `Money`, `Email`, `Percentage`, `Address`,
`DateRange`, `TaxId`. Reglas que lo definen:

1. Sin identidad: se compara por sus atributos.
2. Inmutable: cualquier "cambio" devuelve una instancia nueva.
3. Válido siempre: si existe, cumple sus reglas. Quien lo recibe no vuelve a validar.
4. Autocontenido: sus operaciones (`add`, `overlaps`, `contains`) viven dentro.

Beneficio: elimina validaciones repetidas y da nombre a lo que sería `string`/`int` con comentarios.

## Inmutabilidad por stack

```php
// PHP 8.3: readonly class. Clonación con with*() para "modificar".
final readonly class Percentage
{
    private function __construct(public int $basisPoints) {}   // 12.5% = 1250

    public static function of(float $percent): self
    {
        if ($percent < 0 || $percent > 100) throw new InvalidPercentage($percent);
        return new self((int) round($percent * 100));
    }

    public function applyTo(Money $m): Money { return $m->multiply($this->basisPoints)->divide(10_000); }
}
```

```ts
// TS: readonly fields + Object.freeze si expone objetos; constructor privado.
export class Percentage {
  private constructor(readonly basisPoints: number) {}
  static of(percent: number): Percentage {
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new InvalidPercentage(percent);
    return new Percentage(Math.round(percent * 100));
  }
  applyTo(m: Money): Money { return m.multiply(this.basisPoints).divide(10_000); }
}
```

```python
# Python 3.12: dataclass(frozen=True, slots=True); validación en __post_init__.
@dataclass(frozen=True, slots=True)
class Percentage:
    basis_points: int

    @classmethod
    def of(cls, percent: float) -> "Percentage":
        if not 0 <= percent <= 100:
            raise InvalidPercentage(percent)
        return cls(round(percent * 100))
```

En TS, `readonly` no es profundo: si el VO contiene arrays u objetos, copia y congela en
el constructor (`Object.freeze([...items])`).

## Igualdad por valor

- PHP: método `equals(self $o): bool` comparando cada campo. `==` entre objetos funciona
  para VO planos pero no documenta intención ni maneja floats; no lo uses en dominio.
- TS: `equals()` explícito. Nunca `===` (compara referencias). Para VO usados como clave
  de `Map`, expón `toString()`/`key()` canónico.
- Python: `dataclass(frozen=True)` genera `__eq__` y `__hash__` gratis.

```php
public function equals(self $other): bool
{
    return $this->amountCents === $other->amountCents && $this->currency === $other->currency;
}
```

Normaliza antes de comparar: `Email` en minúsculas, `TaxId` sin guiones, `Money` en céntimos.

## Validación en construcción

Toda regla intrínseca al valor va en la factoría/constructor, y falla con una excepción
de dominio específica ([invariants-and-errors](invariants-and-errors.md)). Distingue:

| Tipo de regla | Dónde | Ejemplo |
|---|---|---|
| Formato/rango del valor en sí | VO | email con `@`, porcentaje 0-100, IBAN checksum |
| Depende de otro valor del mismo objeto | VO compuesto | `DateRange`: `end >= start` |
| Depende de estado externo (BD, otro agregado) | caso de uso o servicio de dominio | email no registrado ya |
| Requisito de la interfaz (campo obligatorio en un formulario) | adaptador driving (FormRequest, zod) | "el campo es obligatorio" |

El adaptador valida forma para dar mensajes de UI; el VO garantiza la regla aunque la
entrada venga de un job, un CSV o un test.

```ts
export class Email {
  private static readonly RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private constructor(readonly value: string) {}
  static of(raw: string): Email {
    const v = raw.trim().toLowerCase();
    if (!Email.RE.test(v)) throw new InvalidEmail(raw);
    return new Email(v);
  }
  domain(): string { return this.value.split('@')[1]; }
  equals(o: Email): boolean { return this.value === o.value; }
}
```

## VO compuestos: Money, DateRange, Email, Address

**Money**: enteros en unidad mínima + moneda. Operaciones que verifican moneda; reparto
(`allocate`) sin perder céntimos; nunca `float`.

```php
final readonly class Money
{
    private function __construct(public int $amountCents, public Currency $currency) {}
    public static function of(int $cents, Currency $c): self { return new self($cents, $c); }
    public static function zero(Currency $c): self { return new self(0, $c); }

    public function add(self $o): self { $this->assertSame($o); return new self($this->amountCents + $o->amountCents, $this->currency); }
    public function multiply(int $factor): self { return new self($this->amountCents * $factor, $this->currency); }
    public function divide(int $divisor): self { return new self(intdiv($this->amountCents, $divisor), $this->currency); }

    /** @return list<self> Reparte sin perder céntimos: 100/3 = [34, 33, 33]. */
    public function allocate(int $parts): array
    {
        $base = intdiv($this->amountCents, $parts); $rest = $this->amountCents % $parts; $out = [];
        for ($i = 0; $i < $parts; $i++) $out[] = new self($base + ($i < $rest ? 1 : 0), $this->currency);
        return $out;
    }
    private function assertSame(self $o): void { if ($this->currency !== $o->currency) throw new CurrencyMismatch($this->currency, $o->currency); }
}
```

**DateRange**: `start`, `end` inclusivos o exclusivos (decídelo y documéntalo); métodos
`contains(date)`, `overlaps(other)`, `days()`. Sustituye a pares de columnas sueltas.

```ts
export class DateRange {
  private constructor(readonly start: LocalDate, readonly end: LocalDate) {}
  static between(start: LocalDate, end: LocalDate): DateRange {
    if (end.isBefore(start)) throw new InvalidDateRange(start, end);
    return new DateRange(start, end);
  }
  overlaps(o: DateRange): boolean { return !this.end.isBefore(o.start) && !o.end.isBefore(this.start); }
  contains(d: LocalDate): boolean { return !d.isBefore(this.start) && !d.isAfter(this.end); }
}
```

**Address**: `street`, `postalCode`, `city`, `country` (ISO). Un VO, no cinco columnas sueltas.
Si Ventas y Logística lo entienden distinto, son dos VO en dos contextos ([bounded-contexts](../strategic/bounded-contexts.md)).

## Enums como value objects

Un enum es un VO con dominio finito. Añade comportamiento, no solo valores:

```php
enum InvoiceStatus: string
{
    case Draft = 'draft'; case Issued = 'issued'; case Paid = 'paid'; case Voided = 'voided';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Draft => $next === self::Issued,
            self::Issued => in_array($next, [self::Paid, self::Voided], true),
            self::Paid => $next === self::Voided,
            self::Voided => false,
        };
    }
    public function isFinal(): bool { return $this === self::Voided; }
}
```

En TS, `as const` + tipo unión y funciones puras, o una clase con instancias estáticas si
necesitas métodos. En Python, `enum.Enum` con métodos. Si el conjunto de valores lo
gestiona el usuario (categorías, etiquetas), no es enum: es entidad o VO con `string`
validado contra un catálogo.

## Serialización y persistencia

El VO no sabe de JSON ni de columnas; el mapper decide entre dos estrategias:

| Estrategia | Cuándo | Ejemplo |
|---|---|---|
| **Columnas planas (embed)** | VO simple, se filtra/ordena por él en SQL | `total_cents`, `total_currency`; `email` |
| **Columna JSON** | VO complejo que no se consulta por partes | `shipping_address` JSON |
| **Tabla propia** | VO en colección grande dentro del agregado | `invoice_lines` (aunque sea entidad hija normalmente) |

```ts
// Prisma: aplanar/rehidratar en el mapper, no en el VO
const toRow = (i: Invoice) => ({ totalCents: i.total().amountCents, totalCurrency: i.total().currency });
const toDomain = (r: InvoiceRow) => Money.of(r.totalCents, Currency.of(r.totalCurrency));
```

Laravel: casts personalizados (`Attribute` o `CastsAttributes`) para VO en columnas
Eloquent son válidos como adaptador; el VO sigue sin importar Eloquent. Doctrine:
`Embeddable`. SQLAlchemy: `composite()`.

Para APIs, exponer `value`/`toString()` o un DTO plano; nunca serializar la clase con sus
campos internos (cambiar un campo privado rompería el contrato).

## Cuándo no crear un VO

- El valor no tiene reglas ni operaciones (`comment: string`, `displayOrder: int`).
- Solo existe para satisfacer una preferencia estética ("todo debe ser VO").
- Dos VO distintos para el mismo concepto en el mismo contexto: unifica.
- Envolver un tipo de librería (`Carbon`) para "aislarlo": usa el tipo estándar
  (`DateTimeImmutable`, `Temporal`, `datetime`) en el dominio.

Regla: crea el VO con la segunda validación o la primera operación sobre el primitivo.

## Errores frecuentes

- **Setters o propiedades mutables**: el VO deja de ser compartible con seguridad.
- **Validación en el caso de uso en vez de en el VO**: se duplica en cada entrada.
- **Float para dinero o porcentajes**: errores de redondeo; usa enteros en unidad mínima.
- **`equals` que compara referencias** (TS `===`, Python sin `frozen`).
- **VO que consulta BD o llama a servicios** en el constructor: rompe pureza y tests.
- **VO "God"**: `Address` con `validateAgainstGoogleMaps()`. La verificación externa es un
  servicio de dominio o puerto ([domain-services](domain-services.md)).
- **Exponer arrays internos por referencia** en TS/PHP: se muta desde fuera.
- **Serializar el VO con `JSON.stringify`/`json_encode` directo**: acopla la API a campos privados.

## Checklist

- [ ] Constructor privado + factoría estática que valida y normaliza.
- [ ] `readonly`/`frozen`; operaciones devuelven instancias nuevas.
- [ ] `equals()` por valor; `toString()`/`key()` canónico si se usa como clave.
- [ ] Excepción de dominio específica por regla violada.
- [ ] Money en enteros + moneda; `allocate` sin perder céntimos.
- [ ] Enums con comportamiento (transiciones, predicados), no solo valores.
- [ ] Mapper decide embed vs JSON vs tabla; el VO no importa ORM ni serializador.
- [ ] Un VO por concepto y contexto; sin VO especulativos sobre primitivos sin reglas.
