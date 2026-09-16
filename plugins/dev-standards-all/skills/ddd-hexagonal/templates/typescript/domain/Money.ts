/**
 * Value Object Money: inmutable, igualdad por valor, validación en la factory.
 * Céntimos como entero; nunca floats. Sin imports de framework.
 *
 * Si varios módulos lo usan, muévelo a src/modules/shared/domain/Money.ts.
 */
export class Money {
  private constructor(
    readonly amountCents: number,
    readonly currency: string,
  ) {}

  static of(amountCents: number, currency: string): Money {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new Error(`Money must be a non-negative integer of cents, got ${amountCents}`);
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error(`Invalid ISO currency: ${currency}`);
    }
    return new Money(amountCents, currency);
  }

  static zero(currency: string): Money {
    return Money.of(0, currency);
  }

  static eur(amountCents: number): Money {
    return Money.of(amountCents, 'EUR');
  }

  /** Entrada de usuario "12.50" -> 1250. Redondeo half-up. */
  static fromDecimal(decimal: string, currency: string): Money {
    const n = Number(decimal);
    if (Number.isNaN(n)) throw new Error(`Invalid decimal: ${decimal}`);
    return Money.of(Math.round(n * 100), currency);
  }

  // Operaciones: siempre devuelven una instancia nueva
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountCents + other.amountCents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amountCents - other.amountCents, this.currency); // lanza si negativo
  }

  times(factor: number): Money {
    if (!Number.isInteger(factor)) throw new Error('factor must be an integer');
    return Money.of(this.amountCents * factor, this.currency);
  }

  /** Porcentaje en puntos básicos (21 % = 2100) para no usar floats en impuestos. */
  percentage(basisPoints: number): Money {
    return Money.of(Math.round((this.amountCents * basisPoints) / 10_000), this.currency);
  }

  equals(other: Money): boolean {
    return this.amountCents === other.amountCents && this.currency === other.currency;
  }

  isZero(): boolean {
    return this.amountCents === 0;
  }

  /** Serialización para DTOs; el formato con locale es cosa de la UI. */
  toJSON(): { amountCents: number; currency: string } {
    return { amountCents: this.amountCents, currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
