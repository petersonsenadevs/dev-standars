"""Adaptador driving: router FastAPI + wiring con Depends.

Único lugar que conoce FastAPI, SQLAlchemy y el caso de uso a la vez.
El router: valida forma (pydantic), resuelve actor, construye command, invoca, serializa.
Sin `if` de negocio: los errores de dominio los mapea un exception handler global.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Iterable
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from invoicing.application.issue_invoice import IssueInvoice, IssueInvoiceCommand
from invoicing.domain.events import DomainEvent
from invoicing.domain.invoice import DomainError, InvoiceNotFound
from invoicing.infrastructure.sqlalchemy_invoice_repository import SqlAlchemyUnitOfWork

# ---- Infraestructura compartida (normalmente en infrastructure/deps.py) ----------------------
engine = create_engine("postgresql+psycopg://app:app@localhost/app", future=True)
SessionLocal = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(tz=UTC)


class InProcessEventBus:
    """Listeners rápidos en proceso. Con IO externo: BackgroundTasks/cola/outbox."""

    def __init__(self) -> None:
        self._handlers: dict[str, list] = {}

    def on(self, name: str, handler) -> InProcessEventBus:
        self._handlers.setdefault(name, []).append(handler)
        return self

    def publish(self, events: Iterable[DomainEvent]) -> None:
        for e in events:
            for h in self._handlers.get(e.name, []):
                h(e)  # en producción: try/except + log; no romper el caso de uso


bus = InProcessEventBus()


# ---- Wiring: Depends solo aquí -----------------------------------------------------------------
def get_uow() -> SqlAlchemyUnitOfWork:
    return SqlAlchemyUnitOfWork(SessionLocal)


def get_issue_invoice(uow: Annotated[SqlAlchemyUnitOfWork, Depends(get_uow)]) -> IssueInvoice:
    return IssueInvoice(uow=uow, clock=SystemClock(), events=bus)


def current_user_id(request: Request) -> str:
    # Sustituir por tu auth real (JWT, sesión). El dominio solo recibe el id.
    user = getattr(request.state, "user", None)
    return user.id if user else "anonymous"


# ---- Router ---------------------------------------------------------------------------------------
router = APIRouter(prefix="/invoices", tags=["invoices"])


class IssueInvoiceResponse(BaseModel):
    invoice_id: str
    number: str


@router.post("/{invoice_id}/issue", response_model=IssueInvoiceResponse)
def issue_invoice(
    invoice_id: UUID,
    actor_id: Annotated[str, Depends(current_user_id)],
    use_case: Annotated[IssueInvoice, Depends(get_issue_invoice)],
) -> IssueInvoiceResponse:
    result = use_case(IssueInvoiceCommand(invoice_id=str(invoice_id), actor_id=actor_id))
    return IssueInvoiceResponse(invoice_id=result.invoice_id, number=result.number)


# ---- App y mapeo de errores de dominio -> HTTP (una sola vez) -----------------------------------
def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)

    @app.exception_handler(InvoiceNotFound)
    def _not_found(_: Request, exc: InvoiceNotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"error": exc.code, "message": str(exc)})

    @app.exception_handler(DomainError)
    def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"error": exc.code, "message": str(exc)})

    return app


# tests e2e: app.dependency_overrides[get_uow] = lambda: FakeUnitOfWork()
