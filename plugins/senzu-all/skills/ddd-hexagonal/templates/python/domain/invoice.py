"""Agregado Invoice: raíz única, invariantes en los métodos, eventos registrados.

Sin imports de fastapi/sqlalchemy/pydantic. Fecha inyectada (no datetime.now()).
Errores de negocio como excepciones de dominio con `code` para el mapeo HTTP.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import NewType

from .events import DomainEvent, InvoiceIssued
from .money import Money

# ---- Ids: NewType cuando solo hay que distinguir tipos; validación en una función ----
InvoiceId = NewType("InvoiceId", str)
CustomerId = NewType("CustomerId", str)
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def invoice_id(value: str) -> InvoiceId:
    if not _UUID.match(value):
        raise ValueError(f"Invalid InvoiceId: {value!r}")
    return InvoiceId(value)


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    VOIDED = "voided"


# ---- Errores de dominio ---------------------------------------------------------------
class DomainError(Exception):
    code: str = "domain_error"


class InvoiceNotFound(DomainError):
    code = "invoice_not_found"

    def __init__(self, invoice_id: str) -> None:
        super().__init__(f"Invoice {invoice_id} not found")


class InvoiceCannotBeIssued(DomainError):
    def __init__(self, message: str, code: str) -> None:
        super().__init__(message)
        self.code = code

    @classmethod
    def without_lines(cls, invoice_id: InvoiceId) -> InvoiceCannotBeIssued:
        return cls(f"Invoice {invoice_id} has no lines and cannot be issued", "invoice_without_lines")

    @classmethod
    def already_issued(cls, invoice_id: InvoiceId) -> InvoiceCannotBeIssued:
        return cls(f"Invoice {invoice_id} is already issued", "invoice_already_issued")

    @classmethod
    def locked(cls, invoice_id: InvoiceId) -> InvoiceCannotBeIssued:
        return cls(f"Invoice {invoice_id} is not a draft and cannot be modified", "invoice_locked")


# ---- Entidad hija: frozen; cambiar cantidad = reemplazar la línea vía la raíz ----------
@dataclass(frozen=True, slots=True)
class InvoiceLine:
    id: str
    description: str
    unit_price: Money
    quantity: int

    def __post_init__(self) -> None:
        if self.quantity <= 0:
            raise ValueError("quantity must be > 0")
        if not self.description.strip():
            raise ValueError("description cannot be empty")

    def total(self) -> Money:
        return self.unit_price.times(self.quantity)


# ---- Raíz del agregado ------------------------------------------------------------------
@dataclass(eq=False)
class Invoice:
    id: InvoiceId
    customer_id: CustomerId
    currency: str = "EUR"
    status: InvoiceStatus = InvoiceStatus.DRAFT
    number: str | None = None
    issued_at: datetime | None = None
    _lines: list[InvoiceLine] = field(default_factory=list, repr=False)
    _events: list[DomainEvent] = field(default_factory=list, repr=False)

    # Fábricas -----------------------------------------------------------------------
    @classmethod
    def draft(cls, id: InvoiceId, customer_id: CustomerId, currency: str = "EUR") -> Invoice:
        return cls(id=id, customer_id=customer_id, currency=currency)

    @classmethod
    def reconstitute(
        cls, *, id: InvoiceId, customer_id: CustomerId, currency: str, status: InvoiceStatus,
        number: str | None, issued_at: datetime | None, lines: list[InvoiceLine],
    ) -> Invoice:
        """Rehidratación desde persistencia: sin validar transiciones ni emitir eventos."""
        inv = cls(id=id, customer_id=customer_id, currency=currency, status=status, number=number, issued_at=issued_at)
        inv._lines = list(lines)
        return inv

    # Comportamiento ---------------------------------------------------------------
    def add_line(self, line: InvoiceLine) -> None:
        self._assert_draft()
        if line.unit_price.currency != self.currency:
            raise ValueError(f"Line currency must be {self.currency}")
        self._lines.append(line)

    def remove_line(self, line_id: str) -> None:
        self._assert_draft()
        self._lines = [l for l in self._lines if l.id != line_id]

    def issue(self, number: str, now: datetime) -> None:
        """Draft -> Issued. El número viene de otro agregado (secuencia); la fecha, inyectada."""
        if self.status is not InvoiceStatus.DRAFT:
            raise InvoiceCannotBeIssued.already_issued(self.id)
        if not self._lines:
            raise InvoiceCannotBeIssued.without_lines(self.id)
        self.status = InvoiceStatus.ISSUED
        self.number = number
        self.issued_at = now
        self._events.append(InvoiceIssued(
            invoice_id=self.id, customer_id=self.customer_id, number=number, total=self.total(), issued_at=now,
        ))

    # Consultas ----------------------------------------------------------------------
    def total(self) -> Money:
        return sum((l.total() for l in self._lines), Money.zero(self.currency))

    @property
    def lines(self) -> tuple[InvoiceLine, ...]:
        return tuple(self._lines)  # copia defensiva

    def is_issued(self) -> bool:
        return self.status is InvoiceStatus.ISSUED

    def pull_events(self) -> list[DomainEvent]:
        events, self._events = self._events, []
        return events

    # Igualdad por identidad ------------------------------------------------------------
    def __eq__(self, other: object) -> bool:
        return isinstance(other, Invoice) and other.id == self.id

    def __hash__(self) -> int:
        return hash(self.id)

    def _assert_draft(self) -> None:
        if self.status is not InvoiceStatus.DRAFT:
            raise InvoiceCannotBeIssued.locked(self.id)
