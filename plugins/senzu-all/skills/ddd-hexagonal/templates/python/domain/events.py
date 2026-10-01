"""Eventos de dominio: frozen, en pasado, con datos mínimos y nombre versionado."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, ClassVar, Protocol

from .money import Money


class DomainEvent(Protocol):
    name: ClassVar[str]

    def occurred_at(self) -> datetime: ...
    def to_payload(self) -> dict[str, Any]: ...


@dataclass(frozen=True, slots=True)
class InvoiceIssued:
    name: ClassVar[str] = "invoicing.invoice_issued.v1"

    invoice_id: str
    customer_id: str
    number: str
    total: Money
    issued_at: datetime

    def occurred_at(self) -> datetime:
        return self.issued_at

    def to_payload(self) -> dict[str, Any]:
        """Plano y serializable para outbox/colas. asdict aplana Money a dict."""
        data = asdict(self)
        data["issued_at"] = self.issued_at.isoformat()
        return data
