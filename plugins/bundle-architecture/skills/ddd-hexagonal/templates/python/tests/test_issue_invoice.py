"""Tests de dominio y de caso de uso (pytest) con fakes en memoria.

Sin BD, sin FastAPI, sin mocks: los fakes tienen comportamiento real.
En el proyecto, fakes y builders viven en src/invoicing/testing/ para reutilizarlos.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Iterable

import pytest

from invoicing.application.issue_invoice import IssueInvoice, IssueInvoiceCommand
from invoicing.domain.events import DomainEvent, InvoiceIssued
from invoicing.domain.invoice import (
    CustomerId, Invoice, InvoiceCannotBeIssued, InvoiceId, InvoiceLine, InvoiceNotFound, InvoiceStatus,
)
from invoicing.domain.money import Money

INVOICE_ID = InvoiceId("0190a1b2-0000-7000-8000-000000000001")
NOW = datetime(2026, 1, 10, 10, 0, tzinfo=UTC)


# ---- Fakes ------------------------------------------------------------------------------------
class InMemoryInvoiceRepository:
    def __init__(self) -> None:
        self.rows: dict[str, Invoice] = {}

    def next_id(self) -> InvoiceId:
        return InvoiceId(f"0190a1b2-0000-7000-8000-{len(self.rows) + 1:012d}")

    def of_id(self, id: InvoiceId) -> Invoice | None:
        return self.rows.get(id)

    def save(self, invoice: Invoice) -> None:
        self.rows[invoice.id] = invoice

    def overdue_at(self, date: datetime) -> list[Invoice]:
        return [i for i in self.rows.values() if i.is_issued() and i.issued_at and i.issued_at < date]


class FakeSequence:
    def __init__(self) -> None:
        self.last = 0

    def next(self, at: datetime) -> str:
        self.last += 1
        return f"{at.year}-A-{self.last:06d}"


class FakeUnitOfWork:
    def __init__(self) -> None:
        self.invoices = InMemoryInvoiceRepository()
        self.sequences = FakeSequence()
        self.committed = False

    def __enter__(self) -> FakeUnitOfWork:
        return self

    def __exit__(self, *exc: object) -> None:
        pass

    def commit(self) -> None:
        self.committed = True


class RecordingEventBus:
    def __init__(self) -> None:
        self.published: list[DomainEvent] = []

    def publish(self, events: Iterable[DomainEvent]) -> None:
        self.published.extend(events)

    def of_type(self, cls: type) -> list:
        return [e for e in self.published if isinstance(e, cls)]


class FixedClock:
    def __init__(self, at: datetime) -> None:
        self._at = at

    def now(self) -> datetime:
        return self._at


# ---- Builder -----------------------------------------------------------------------------------
def a_draft_invoice(lines: int = 1) -> Invoice:
    inv = Invoice.draft(INVOICE_ID, CustomerId("cust-1"))
    for i in range(lines):
        inv.add_line(InvoiceLine(id=f"l{i}", description=f"Line {i}", unit_price=Money.eur(1000), quantity=2))
    return inv


# ---- Dominio -------------------------------------------------------------------------------------
class TestInvoiceDomain:
    def test_total_sums_lines(self) -> None:
        assert a_draft_invoice(lines=2).total() == Money.eur(4000)

    def test_cannot_issue_without_lines(self) -> None:
        with pytest.raises(InvoiceCannotBeIssued) as e:
            a_draft_invoice(lines=0).issue("2026-A-000001", NOW)
        assert e.value.code == "invoice_without_lines"

    def test_issue_records_event(self) -> None:
        inv = a_draft_invoice()
        inv.issue("2026-A-000001", NOW)
        (event,) = inv.pull_events()
        assert isinstance(event, InvoiceIssued)
        assert event.total == Money.eur(2000) and event.number == "2026-A-000001"
        assert inv.pull_events() == []  # solo se entregan una vez

    def test_locked_after_issue(self) -> None:
        inv = a_draft_invoice()
        inv.issue("2026-A-000001", NOW)
        with pytest.raises(InvoiceCannotBeIssued):
            inv.add_line(InvoiceLine("l9", "late", Money.eur(1), 1))


# ---- Caso de uso -----------------------------------------------------------------------------------
@pytest.fixture
def uow() -> FakeUnitOfWork:
    return FakeUnitOfWork()


@pytest.fixture
def bus() -> RecordingEventBus:
    return RecordingEventBus()


@pytest.fixture
def issue(uow: FakeUnitOfWork, bus: RecordingEventBus) -> IssueInvoice:
    return IssueInvoice(uow=uow, clock=FixedClock(NOW), events=bus)


def test_issues_commits_and_publishes(issue: IssueInvoice, uow: FakeUnitOfWork, bus: RecordingEventBus) -> None:
    uow.invoices.save(a_draft_invoice(lines=2))

    result = issue(IssueInvoiceCommand(invoice_id=INVOICE_ID, actor_id="u1"))

    assert result.number == "2026-A-000001"
    stored = uow.invoices.of_id(INVOICE_ID)
    assert stored is not None and stored.status is InvoiceStatus.ISSUED and stored.issued_at == NOW
    assert uow.committed
    assert bus.of_type(InvoiceIssued)[0].total == Money.eur(4000)


def test_not_found(issue: IssueInvoice, bus: RecordingEventBus) -> None:
    with pytest.raises(InvoiceNotFound):
        issue(IssueInvoiceCommand(invoice_id=INVOICE_ID, actor_id="u1"))
    assert bus.published == []


def test_no_lines_does_not_commit_nor_publish(issue: IssueInvoice, uow: FakeUnitOfWork, bus: RecordingEventBus) -> None:
    uow.invoices.save(a_draft_invoice(lines=0))
    with pytest.raises(InvoiceCannotBeIssued):
        issue(IssueInvoiceCommand(invoice_id=INVOICE_ID, actor_id="u1"))
    assert not uow.committed and bus.published == []
