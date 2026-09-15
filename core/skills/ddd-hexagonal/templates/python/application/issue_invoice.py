"""Caso de uso IssueInvoice: clase callable con inyección explícita por constructor.

Orquesta: cargar -> regla (en el agregado) -> guardar -> commit -> publicar eventos.
Sin fastapi, sin sqlalchemy: solo dominio y puertos.
"""

from __future__ import annotations

from dataclasses import dataclass

from invoicing.domain.invoice import InvoiceNotFound, invoice_id
from invoicing.domain.ports import Clock, EventBus, UnitOfWork


@dataclass(frozen=True, slots=True)
class IssueInvoiceCommand:
    invoice_id: str
    actor_id: str  # lo resuelve el adaptador (auth); el caso de uso nunca mira la request


@dataclass(frozen=True, slots=True)
class IssueInvoiceResult:
    invoice_id: str
    number: str


class IssueInvoice:
    def __init__(self, uow: UnitOfWork, clock: Clock, events: EventBus) -> None:
        self._uow = uow
        self._clock = clock
        self._events = events

    def __call__(self, cmd: IssueInvoiceCommand) -> IssueInvoiceResult:
        iid = invoice_id(cmd.invoice_id)
        now = self._clock.now()

        with self._uow as uow:  # una transacción por caso de uso
            invoice = uow.invoices.of_id(iid)
            if invoice is None:
                raise InvoiceNotFound(cmd.invoice_id)

            number = uow.sequences.next(now)  # FOR UPDATE en la implementación SQL
            invoice.issue(number, now)         # invariantes viven en el agregado
            uow.invoices.save(invoice)
            uow.commit()

        # Fuera de la transacción: un listener que falle no deshace la emisión.
        self._events.publish(invoice.pull_events())
        return IssueInvoiceResult(invoice_id=invoice.id, number=number)


# ---- Variante funcional (equivalente; útil cuando hay 1-2 dependencias) ---------------
#
# def issue_invoice(cmd: IssueInvoiceCommand, *, uow: UnitOfWork, clock: Clock, events: EventBus) -> IssueInvoiceResult:
#     ...
# # wiring: functools.partial(issue_invoice, uow=SqlAlchemyUnitOfWork(SessionLocal), clock=SystemClock(), events=bus)
