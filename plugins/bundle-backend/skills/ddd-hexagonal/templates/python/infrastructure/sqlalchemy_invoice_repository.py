"""Adaptadores driven: repositorio, secuencia y Unit of Work sobre SQLAlchemy 2.x.

Modelos ORM separados del dominio + mapeo explícito (dominio 100 % puro, VO frozen).
Alternativa: imperative mapping sobre las dataclasses (menos código, entidad instrumentada).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, selectinload, sessionmaker

from invoicing.domain.invoice import CustomerId, Invoice, InvoiceId, InvoiceLine, InvoiceStatus
from invoicing.domain.money import Money


# ---- Esquema (anémico a propósito) -----------------------------------------------------------
class Base(DeclarativeBase):
    pass


class InvoiceModel(Base):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    customer_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    number: Mapped[str | None] = mapped_column(String(32), unique=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    currency: Mapped[str] = mapped_column(String(3))
    total_cents: Mapped[int] = mapped_column(Integer)  # desnormalizado para listados
    lines: Mapped[list[InvoiceLineModel]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class InvoiceLineModel(Base):
    __tablename__ = "invoice_lines"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(255))
    unit_price_cents: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer)


class InvoiceSequenceModel(Base):
    __tablename__ = "invoice_sequences"
    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    last: Mapped[int] = mapped_column(Integer, default=0)


# ---- Repositorio --------------------------------------------------------------------------------
class SqlAlchemyInvoiceRepository:
    def __init__(self, session: Session) -> None:
        self._s = session

    def next_id(self) -> InvoiceId:
        return InvoiceId(str(uuid.uuid4()))

    def of_id(self, id: InvoiceId) -> Invoice | None:
        row = self._s.get(InvoiceModel, id, options=[selectinload(InvoiceModel.lines)])
        return _to_domain(row) if row else None

    def save(self, invoice: Invoice) -> None:
        row = self._s.get(InvoiceModel, invoice.id) or InvoiceModel(id=invoice.id)
        row.customer_id = invoice.customer_id
        row.status = invoice.status.value
        row.number = invoice.number
        row.issued_at = invoice.issued_at
        row.currency = invoice.currency
        row.total_cents = invoice.total().amount_cents
        # Reemplazo completo de líneas: simple y correcto para agregados pequeños.
        row.lines = [
            InvoiceLineModel(id=l.id, description=l.description, unit_price_cents=l.unit_price.amount_cents, quantity=l.quantity)
            for l in invoice.lines
        ]
        self._s.add(row)
        self._s.flush()

    def overdue_at(self, date: datetime) -> list[Invoice]:
        stmt = select(InvoiceModel).where(InvoiceModel.status == InvoiceStatus.ISSUED.value, InvoiceModel.due_at < date)
        return [_to_domain(r) for r in self._s.scalars(stmt)]


def _to_domain(row: InvoiceModel) -> Invoice:
    return Invoice.reconstitute(
        id=InvoiceId(row.id),
        customer_id=CustomerId(row.customer_id),
        currency=row.currency,
        status=InvoiceStatus(row.status),
        number=row.number,
        issued_at=row.issued_at,
        lines=[
            InvoiceLine(id=l.id, description=l.description, unit_price=Money(l.unit_price_cents, row.currency), quantity=l.quantity)
            for l in row.lines
        ],
    )


# ---- Secuencia con bloqueo de fila ------------------------------------------------------------
class SqlAlchemyInvoiceNumberSequence:
    def __init__(self, session: Session) -> None:
        self._s = session

    def next(self, at: datetime) -> str:
        year = at.year
        row = self._s.execute(
            select(InvoiceSequenceModel).where(InvoiceSequenceModel.year == year).with_for_update()
        ).scalar_one_or_none()
        if row is None:
            row = InvoiceSequenceModel(year=year, last=0)
            self._s.add(row)
        row.last += 1
        self._s.flush()
        return f"{year}-A-{row.last:06d}"


# ---- Unit of Work -------------------------------------------------------------------------------
class SqlAlchemyUnitOfWork:
    """Una sesión por caso de uso. __exit__ hace rollback de lo no confirmado."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def __enter__(self) -> SqlAlchemyUnitOfWork:
        self.session = self._session_factory()
        self.invoices = SqlAlchemyInvoiceRepository(self.session)
        self.sequences = SqlAlchemyInvoiceNumberSequence(self.session)
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.session.rollback()  # no-op si ya se hizo commit
        self.session.close()

    def commit(self) -> None:
        self.session.commit()
