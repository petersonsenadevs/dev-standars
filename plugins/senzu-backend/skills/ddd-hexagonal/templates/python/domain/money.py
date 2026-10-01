"""Value Object Money: frozen dataclass, igualdad por valor, validación en __post_init__.

Céntimos como int; nunca float. Sin imports de framework.
Si varios contextos lo usan, mover a shared/domain/money.py.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

_CURRENCY = re.compile(r"^[A-Z]{3}$")


@dataclass(frozen=True, slots=True)
class Money:
    amount_cents: int
    currency: str

    def __post_init__(self) -> None:
        if not isinstance(self.amount_cents, int) or self.amount_cents < 0:
            raise ValueError(f"Money must be a non-negative integer of cents, got {self.amount_cents!r}")
        if not _CURRENCY.match(self.currency):
            raise ValueError(f"Invalid ISO currency: {self.currency!r}")

    # ---- Constructores nombrados ----------------------------------------------------

    @classmethod
    def zero(cls, currency: str) -> Money:
        return cls(0, currency)

    @classmethod
    def eur(cls, amount_cents: int) -> Money:
        return cls(amount_cents, "EUR")

    @classmethod
    def from_decimal(cls, amount: str | Decimal, currency: str) -> Money:
        """Entrada '12.50' -> 1250 con redondeo half-up (nunca float)."""
        cents = (Decimal(amount) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return cls(int(cents), currency)

    # ---- Operaciones: devuelven instancias nuevas ---------------------------------------

    def add(self, other: Money) -> Money:
        self._assert_same_currency(other)
        return Money(self.amount_cents + other.amount_cents, self.currency)

    def subtract(self, other: Money) -> Money:
        self._assert_same_currency(other)
        return Money(self.amount_cents - other.amount_cents, self.currency)  # lanza si negativo

    def times(self, factor: int) -> Money:
        if not isinstance(factor, int):
            raise ValueError("factor must be an integer")
        return Money(self.amount_cents * factor, self.currency)

    def percentage(self, basis_points: int) -> Money:
        """21 % = 2100 puntos básicos. Redondeo half-up en enteros."""
        return Money((self.amount_cents * basis_points + 5_000) // 10_000, self.currency)

    def __add__(self, other: Money) -> Money:
        return self.add(other)

    # ---- Presentación -----------------------------------------------------------------

    def is_zero(self) -> bool:
        return self.amount_cents == 0

    def to_decimal(self) -> Decimal:
        return Decimal(self.amount_cents) / 100

    def _assert_same_currency(self, other: Money) -> None:
        if other.currency != self.currency:
            raise ValueError(f"Currency mismatch: {self.currency} vs {other.currency}")
