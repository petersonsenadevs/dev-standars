# Recorrido completo: agente de soporte con LangGraph

## Índice
1. Brief y por qué un agente es un caso de uso
2. Glosario
3. Eventos, comandos y políticas
4. Dominio: Conversation, Ticket y políticas de escalado
5. Puertos: LLM, base de conocimiento, CRM
6. Nodos como casos de uso y grafo como orquestación
7. Adaptadores: Anthropic/OpenAI, vector store, HTTP
8. Tests sin llamar al modelo
9. Estructura de carpetas final

---

## 1. Brief y por qué un agente es un caso de uso

"Un agente atiende mensajes de clientes en el chat de soporte: responde con la base de
conocimiento, abre un ticket en el CRM cuando no puede resolver, y escala a un humano si
el cliente es prioritario, está enfadado o el problema afecta a facturación."

Un agente es un caso de uso con un grafo dentro (`references/stacks/python/overview.md`
§9). LLM, base de conocimiento y CRM son puertos driven. Las reglas expresables sin el
modelo (cuándo escalar, cuántos intentos) son dominio puro. El prompt es un detalle del adaptador.

## 2. Glosario

| Término | Definición | Sinónimo prohibido |
|---|---|---|
| Conversación (Conversation) | Hilo de mensajes de un cliente en un canal | chat, sesión |
| Turno (Turn) | Par mensaje de cliente + respuesta del agente | iteración |
| Resolución (Resolution) | Respuesta dada por conocimiento con confianza suficiente | contestación |
| Ticket | Incidencia abierta en el CRM cuando no hay resolución | caso, issue |
| Escalado (Escalation) | Paso a agente humano con motivo | handoff, transfer |
| Política de escalado | Regla determinista que decide escalar | heurística |
| Intención (Intent) | Categoría del mensaje según el LLM | tema |

## 3. Eventos, comandos y políticas

| Comando | Agregado | Evento | Política |
|---|---|---|---|
| ReceiveMessage | Conversation | MessageReceived | ejecutar grafo de triaje |
| Reply | Conversation | ReplySent | - |
| OpenTicket | Conversation | TicketOpened | crear en CRM (adaptador) |
| Escalate | Conversation | ConversationEscalated | avisar en Slack; bloquear respuestas automáticas |
| Close | Conversation | ConversationClosed | - |

## 4. Dominio: Conversation, Ticket y políticas de escalado

```python
# domain/conversation.py — sin langgraph, sin anthropic, sin httpx
class ConversationStatus(str, Enum):
    OPEN = "open"; ESCALATED = "escalated"; CLOSED = "closed"

@dataclass(frozen=True, slots=True)
class Message:            # VO: role ("customer" | "agent" | "human"), text, at
    role: str; text: str; at: datetime
@dataclass(frozen=True, slots=True)
class EscalationReason:   # code: priority_customer | angry | billing | max_turns
    code: str; detail: str

@dataclass(eq=False)
class Conversation:
    id: ConversationId
    customer: CustomerProfile           # snapshot: tier, language
    status: ConversationStatus = ConversationStatus.OPEN
    ticket_id: str | None = None
    _messages: list[Message] = field(default_factory=list, repr=False)
    _events: list[DomainEvent] = field(default_factory=list, repr=False)

    def receive(self, text: str, now: datetime) -> None:
        if self.status is not ConversationStatus.OPEN: raise ConversationNotOpen(self.id, self.status)
        self._messages.append(Message("customer", text, now))
        self._events.append(MessageReceived(self.id, text, now))

    def reply(self, text: str, now: datetime) -> None:
        if self.status is ConversationStatus.ESCALATED: raise AutomaticReplyForbidden(self.id)  # escalada = solo humanos
        self._messages.append(Message("agent", text, now))
        self._events.append(ReplySent(self.id, text, now))

    def escalate(self, reason: EscalationReason, now: datetime) -> None:
        if self.status is ConversationStatus.ESCALATED: return   # idempotente
        self.status = ConversationStatus.ESCALATED
        self._events.append(ConversationEscalated(self.id, reason.code, reason.detail, now))

    def agent_turns(self) -> int: return sum(1 for m in self._messages if m.role == "agent")
```

```python
# domain/escalation_policy.py — función pura; aquí viven las reglas de negocio del agente
MAX_AUTOMATIC_TURNS = 3
BILLING_INTENTS = {"refund", "double_charge", "invoice_error"}

def escalation_for(conv: Conversation, analysis: MessageAnalysis) -> EscalationReason | None:
    if conv.customer.tier == "enterprise":
        return EscalationReason("priority_customer", conv.customer.tier)
    if analysis.sentiment == "angry":
        return EscalationReason("angry", analysis.sentiment_evidence)
    if analysis.intent in BILLING_INTENTS:
        return EscalationReason("billing", analysis.intent)
    if conv.agent_turns() >= MAX_AUTOMATIC_TURNS:
        return EscalationReason("max_turns", str(conv.agent_turns()))
    return None

def can_resolve(candidates: Sequence[KnowledgeHit], threshold: float = 0.78) -> bool:
    return bool(candidates) and candidates[0].score >= threshold
```

`Ticket` no es agregado aquí: es un id devuelto por el CRM (su dueño) y guardado en la conversación.

## 5. Puertos: LLM, base de conocimiento, CRM

```python
# application/ports.py — Protocols tipados; nunca "invoke(prompt) -> str"
class MessageAnalyzer(Protocol):
    def analyze(self, text: str, history: Sequence[Message]) -> MessageAnalysis: ...   # intent, sentiment, language

class AnswerComposer(Protocol):
    def compose(self, question: str, hits: Sequence[KnowledgeHit], language: str) -> str: ...

class KnowledgeBase(Protocol):
    def search(self, query: str, limit: int = 5) -> list[KnowledgeHit]: ...            # (doc_id, excerpt, score)

class Crm(Protocol):
    def open_ticket(self, conv: ConversationId, summary: str, customer: CustomerProfile) -> str: ...

class ConversationRepository(Protocol):
    def of_id(self, id: ConversationId) -> Conversation | None: ...
    def save(self, conv: Conversation) -> None: ...
```

Dos puertos para el LLM en lugar de uno genérico: cada uno tiene contrato en tipos del
dominio, su propio prompt y su propio test de contrato. El structured output de pydantic
se queda en el adaptador; `MessageAnalysis` es un dataclass del dominio.

## 6. Nodos como casos de uso y grafo como orquestación

```python
# application/handle_message.py
class SupportState(TypedDict, total=False):
    conversation_id: str; text: str
    analysis: MessageAnalysis; hits: list[KnowledgeHit]
    escalation: EscalationReason | None; reply: str | None

def build_graph(deps: Deps) -> CompiledGraph:          # deps: repos + puertos + clock
    def analyze(s: SupportState) -> SupportState:
        conv = deps.conversations.of_id(ConversationId(s["conversation_id"]))
        return {**s, "analysis": deps.analyzer.analyze(s["text"], conv.messages)}

    def decide(s: SupportState) -> SupportState:      # nodo puro: solo dominio
        conv = deps.conversations.of_id(ConversationId(s["conversation_id"]))
        return {**s, "escalation": escalation_for(conv, s["analysis"])}

    def search(s: SupportState) -> SupportState:
        return {**s, "hits": deps.knowledge.search(s["text"])}

    def answer(s: SupportState) -> SupportState:
        conv = deps.conversations.of_id(ConversationId(s["conversation_id"]))
        if can_resolve(s["hits"]):
            reply = deps.composer.compose(s["text"], s["hits"], s["analysis"].language)
        else:
            conv.ticket_id = deps.crm.open_ticket(conv.id, summary=s["text"][:200], customer=conv.customer)
            reply = TICKET_OPENED_TEMPLATE[s["analysis"].language].format(ticket=conv.ticket_id)
        conv.reply(reply, deps.clock.now())
        deps.conversations.save(conv)
        return {**s, "reply": reply}

    def escalate(s: SupportState) -> SupportState:
        conv = deps.conversations.of_id(ConversationId(s["conversation_id"]))
        conv.escalate(s["escalation"], deps.clock.now())
        deps.conversations.save(conv)
        return {**s, "reply": None}

    g = StateGraph(SupportState)
    for name, fn in [("analyze", analyze), ("decide", decide), ("search", search), ("answer", answer), ("escalate", escalate)]:
        g.add_node(name, fn)
    g.add_edge(START, "analyze"); g.add_edge("analyze", "decide"); g.add_edge("search", "answer")
    g.add_conditional_edges("decide", lambda s: "escalate" if s["escalation"] else "search")
    g.add_edge("answer", END); g.add_edge("escalate", END); return g.compile()
```

El caso de uso driving `HandleMessage` hace `conv.receive(text, now)`, `save`, ejecuta el
grafo y publica eventos fuera de la transacción. Cada nodo es un pequeño caso de uso:
cargar, decidir (dominio o puerto), guardar. No hay `if tier == "enterprise"` en el grafo.

## 7. Adaptadores: Anthropic/OpenAI, vector store, HTTP

- `infrastructure/llm/anthropic_analyzer.py`: `AnthropicMessageAnalyzer(MessageAnalyzer)`.
  Prompt versionado en un archivo (`prompts/analyze_v3.md`), tool use / structured output
  con un `BaseModel` interno y mapeo a `MessageAnalysis`. Reintento y timeout aquí.
  La versión OpenAI es otra clase con el mismo puerto; se elige en `deps.py`.
- `infrastructure/knowledge/pgvector_knowledge_base.py`: embedding + búsqueda; devuelve
  `KnowledgeHit` con `score` normalizado a `[0, 1]` para que el umbral del dominio no
  dependa del proveedor.
- `infrastructure/crm/http_crm.py`: cliente `httpx` con ACL: el JSON del CRM se traduce a
  `str` (id de ticket); los errores HTTP se traducen a `CrmUnavailable`.
- `infrastructure/api.py`: `POST /conversations/{id}/messages` (FastAPI) construye el
  command, llama a `HandleMessage`, devuelve `{"reply", "escalated"}`. Un webhook del
  canal (WhatsApp, Intercom) es otro adaptador driving del mismo caso de uso.
- Tools de LangChain (`@tool`) se definen en infraestructura envolviendo el puerto.

## 8. Tests sin llamar al modelo

| Capa | Qué se prueba | Dobles |
|---|---|---|
| Domain | `escalation_for` con cada motivo; `reply()` prohibido tras escalar; `escalate()` idempotente; `can_resolve` en el umbral | ninguno |
| Application | grafo completo con `FakeAnalyzer(returns=MessageAnalysis(intent="refund", ...))`, `InMemoryKnowledgeBase([...])`, `FakeCrm()`, `InMemoryConversationRepository`; asserts sobre `reply`, `ticket_id`, eventos | fakes en memoria |
| Contract (adaptador LLM) | respuesta grabada del proveedor se parsea a `MessageAnalysis`; un JSON incompleto lanza `AnalyzerContractError` | fixture grabada |
| Integration | `PgVectorKnowledgeBase` contra BD de test; `HttpCrm` contra servidor fake (`respx`) | infraestructura de test |
| Eval (opcional, nightly) | dataset de mensajes reales anonimizados contra el modelo real; métrica de intención | modelo real, fuera de CI de PR |
```python
def test_billing_intent_escalates_without_replying():
    repo = InMemoryConversationRepository([a_conversation().open().build()])
    graph = build_graph(Deps(conversations=repo, analyzer=FakeAnalyzer(intent="refund"),
                             knowledge=InMemoryKnowledgeBase([]), composer=FakeComposer(), crm=FakeCrm(),
                             clock=FixedClock(NOW)))
    out = graph.invoke({"conversation_id": "conv-1", "text": "me habéis cobrado dos veces"})
    conv = repo.of_id(ConversationId("conv-1"))
    assert out["reply"] is None and conv.status is ConversationStatus.ESCALATED
    assert [e.reason for e in conv.pull_events() if isinstance(e, ConversationEscalated)] == ["billing"]
```

Regla: un test que necesita `ANTHROPIC_API_KEY` va a `tests/eval/` y no bloquea el PR.

## 9. Estructura de carpetas final

```
src/agents/support/
  domain/
    conversation.py        Conversation, Message, ConversationStatus, errores
    escalation_policy.py   escalation_for, can_resolve, MAX_AUTOMATIC_TURNS
    analysis.py            MessageAnalysis, KnowledgeHit, CustomerProfile (VO)
    events.py              MessageReceived, ReplySent, ConversationEscalated, TicketOpened
  application/
    ports.py               MessageAnalyzer, AnswerComposer, KnowledgeBase, Crm, ConversationRepository, Clock
    handle_message.py      SupportState, build_graph, HandleMessage (caso de uso driving)
  infrastructure/
    llm/                   anthropic_analyzer.py, openai_analyzer.py, anthropic_composer.py, prompts/
    knowledge/             pgvector_knowledge_base.py
    crm/                   http_crm.py
    persistence/           sqlalchemy_conversation_repository.py
    api.py, deps.py
tests/
  unit/domain/, unit/application/, contract/, integration/, eval/
```

`.importlinter`: `domain` con `forbidden_modules = langgraph langchain anthropic openai
httpx sqlalchemy fastapi`; `application` igual salvo `langgraph`, tolerado solo en
`handle_message.py` y documentado como excepción. Equivalente TypeScript (LangGraph.js):
mismos puertos como interfaces, `buildGraph(deps)` y fakes en Vitest (`templates/typescript/`).
