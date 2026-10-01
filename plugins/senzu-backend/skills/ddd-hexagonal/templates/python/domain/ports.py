"""Puertos driven como Protocols (tipado estructural: el adaptador no hereda nada).

Regla: un puerto merece existir si tiene IO o si quieres sustituirlo en tests.
Si la API es async, define aquí `async def` y haz async los adaptadores; no mezcles.
"""

from __future__ import annotations

from datetime import datetime
from typing import Iterable, Protocol, runtime_checkable

from .events import DomainEvent
from .invoice import Invoice, InvoiceId


@runtime_checkable
class InvoiceRepository(Protocol):
    """Persistencia del agregado. Una interfaz por agregado; listados van a readers."""

    def next_id(self) -> InvoiceId: ...
    def of_id(self, id: InvoiceId) -> Invoice | None: ...
    def save(self, invoice: Invoice) -> None: ...
    def overdue_at(self, date: datetime) -> list[Invoice]: ...


class InvoiceNumberSequence(Protocol):
    """Numeración correlativa. La implementación SQL bloquea la fila (FOR UPDATE)."""

    def next(self, at: datetime) -> str: ...


class Clock(Protocol):
    def now(self) -> datetime: ...


class EventBus(Protocol):
    def publish(self, events: Iterable[DomainEvent]) -> None: ...


class UnitOfWork(Protocol):
    """Agrupa los repositorios que comparten sesión. Un caso de uso = un `with uow:`.

    __exit__ hace rollback si no hubo commit explícito.
    """

    invoices: InvoiceRepository
    sequences: InvoiceNumberSequence

    def __enter__(self) -> UnitOfWork: ...
    def __exit__(self, exc_type: object, exc: object, tb: object) -> None: ...
    def commit(self) -> None: ...
