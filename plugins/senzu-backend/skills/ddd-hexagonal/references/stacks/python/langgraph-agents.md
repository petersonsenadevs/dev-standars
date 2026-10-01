# LangGraph: agentes hexagonales

## Índice

- [Alcance](#alcance)
- [Estado tipado y reducers](#estado-tipado-y-reducers)
- [Puertos: LLM, tools y memoria](#puertos-llm-tools-y-memoria)
- [Dominio del agente sin modelo](#dominio-del-agente-sin-modelo)
- [Nodos como casos de uso](#nodos-como-casos-de-uso)
- [Adaptador LLM y structured output](#adaptador-llm-y-structured-output)
- [Tools de LangChain envolviendo puertos](#tools-de-langchain-envolviendo-puertos)
- [Checkpointers como adaptadores](#checkpointers-como-adaptadores)
- [Human-in-the-loop con interrupt](#human-in-the-loop-con-interrupt)
- [Tests: FakeLLM, grafo completo y contrato del prompt](#tests-fakellm-grafo-completo-y-contrato-del-prompt)
- [Errores frecuentes](#errores-frecuentes)
- [Checklist](#checklist)

## Alcance

Amplía el §9 de [`overview.md`](overview.md): un agente es un caso de uso con un grafo
dentro; modelo, tools y memoria son puertos driven; lo decidible sin LLM es dominio puro.
Estructura: la del overview más `testing/` (fakes) e `infrastructure/prompts/`. `langgraph`
solo en `application/graph.py` e `infrastructure/`; `langchain_*` y SDKs solo en `infrastructure/`.
HTTP en [`fastapi-adapters.md`](fastapi-adapters.md); tests en [`../../testing/adapter-tests.md`](../../testing/adapter-tests.md).

## Estado tipado y reducers

Contrato entre nodos: `TypedDict` con `Annotated` para campos que acumulan; el resto se sobreescribe. Ningún `Any`.

```python
# domain/state.py
class SimilarTicket(TypedDict):
    id: str; title: str; resolution: str

class TriageState(TypedDict, total=False):
    ticket_id: str; text: str
    category: Category                      # Literal["billing", "bug", "howto", "other"]
    confidence: float
    similar: Annotated[list[SimilarTicket], operator.add]     # reducer: cada nodo añade
    decision: TriageDecision | None
    attempts: int
```

Preferir `TypedDict` a `MessagesState` salvo en agentes conversacionales puros: el estado refleja el
problema, no la transcripción; los mensajes van en `messages: Annotated[list[AnyMessage], add_messages]`.

## Puertos: LLM, tools y memoria

```python
# application/ports.py
class LLM(Protocol):
    def classify(self, text: str, categories: Sequence[Category]) -> Classification: ...
    def draft_reply(self, ticket: TicketSummary, similar: Sequence[SimilarTicket]) -> DraftReply: ...

class TicketSearch(Protocol):
    def similar(self, text: str, *, limit: int) -> list[SimilarTicket]: ...

class Escalation(Protocol):
    def escalate(self, ticket_id: str, reason: str, priority: Priority) -> None: ...

class ConversationMemory(Protocol):          # memoria de largo plazo, no el checkpointer
    def recall(self, customer_id: str) -> CustomerContext | None: ...
    def remember(self, customer_id: str, fact: str) -> None: ...
```

`LLM` expone operaciones con significado (`classify`, `draft_reply`), no `invoke(prompt) -> str`:
prompt, parseo y proveedor quedan en el adaptador y el `FakeLLM` devuelve dataclasses.

## Dominio del agente sin modelo

```python
# domain/triage.py
@dataclass(frozen=True, slots=True)
class TriageDecision:
    action: Literal["auto_reply", "escalate", "ask_more"]; priority: Priority; reason: str

def decide_triage(category: Category, confidence: float, similar: Sequence[SimilarTicket],
                  sla: SlaPolicy) -> TriageDecision:
    if confidence < sla.min_confidence:
        return TriageDecision("ask_more", Priority.NORMAL, "low confidence")
    if category == "billing" and sla.escalate_billing:
        return TriageDecision("escalate", Priority.HIGH, "billing policy")
    if similar and similar[0].get("resolution"):
        return TriageDecision("auto_reply", Priority.NORMAL, f"similar to {similar[0]['id']}")
    return TriageDecision("escalate", Priority.NORMAL, "no precedent")
```

Un umbral que vive en el prompt no se puede testear ni versionar: saca del LLM toda regla.

## Nodos como casos de uso

Un nodo = una intención; cierra sobre sus puertos, recibe estado y devuelve solo el delta.
Las aristas condicionales llaman a funciones puras del dominio.

```python
# application/graph.py
def build_graph(llm: LLM, search: TicketSearch, escalation: Escalation, sla: SlaPolicy,
                checkpointer: BaseCheckpointSaver | None = None) -> CompiledStateGraph:
    def classify(state: TriageState) -> TriageState:
        c = llm.classify(state["text"], CATEGORIES)
        return {"category": c.category, "confidence": c.confidence, "attempts": state.get("attempts", 0) + 1}
    def find_similar(state: TriageState) -> TriageState:
        return {"similar": search.similar(state["text"], limit=3)}
    def decide(state: TriageState) -> TriageState:
        return {"decision": decide_triage(state["category"], state["confidence"], state["similar"], sla)}
    def escalate(state: TriageState) -> TriageState:
        d = state["decision"]; escalation.escalate(state["ticket_id"], d.reason, d.priority); return {}

    g = StateGraph(TriageState)
    for name, fn in [("classify", classify), ("find_similar", find_similar), ("decide", decide), ("escalate", escalate)]:
        g.add_node(name, fn)
    g.add_edge(START, "classify"); g.add_edge("classify", "find_similar"); g.add_edge("find_similar", "decide")
    g.add_conditional_edges("decide", lambda s: s["decision"].action,
                            {"escalate": "escalate", "auto_reply": END, "ask_more": END})
    g.add_edge("escalate", END)
    return g.compile(checkpointer=checkpointer)
```

El caso de uso driving (`run_triage.py`) construye el estado inicial desde un command,
invoca `graph.invoke(state, config={"configurable": {"thread_id": ticket_id}})` y traduce
el estado final a un resultado de aplicación. Ninguna ruta HTTP toca el grafo.

## Adaptador LLM y structured output

El prompt es infraestructura: fichero versionado que carga el adaptador. Structured output
con pydantic se queda dentro; el puerto devuelve dataclasses del dominio.

```python
# infrastructure/anthropic_llm.py
class _ClassificationOut(BaseModel):
    category: Category; confidence: float = Field(ge=0, le=1); rationale: str

class AnthropicLLM:
    def __init__(self, model: BaseChatModel, prompts: PromptStore) -> None:
        self._classifier = model.with_structured_output(_ClassificationOut)
        self._prompts = prompts

    def classify(self, text: str, categories: Sequence[Category]) -> Classification:
        prompt = self._prompts.render("triage_v3", text=text, categories=list(categories))
        out = self._classifier.invoke(prompt)
        return Classification(category=out.category, confidence=out.confidence)
```

`model` llega inyectado desde `deps.py` (reintentos, timeouts). Cambiar de proveedor es
otra clase que implementa `LLM`; el grafo no cambia.

## Tools de LangChain envolviendo puertos

Cuando el modelo decide qué tool llamar (ReAct), las `@tool` se crean en infraestructura
a partir del puerto, nunca al revés: el puerto no sabe que existe LangChain.

```python
# infrastructure/tools.py
def make_tools(search: TicketSearch, memory: ConversationMemory) -> list[BaseTool]:
    @tool
    def find_similar_tickets(query: str) -> list[SimilarTicket]:
        """Find up to 3 previously resolved tickets similar to the query."""
        return search.similar(query, limit=3)
    @tool
    def recall_customer(customer_id: str) -> str:
        """Return known context about the customer, or 'none'."""
        ctx = memory.recall(customer_id); return ctx.summary if ctx else "none"
    return [find_similar_tickets, recall_customer]
```

`ToolNode` recibe `make_tools(...)` desde `deps.py`; en tests, `make_tools` sobre fakes
produce tools reales y el bucle de tool-calling se prueba entero.

## Checkpointers como adaptadores

El checkpointer persiste el estado del grafo por `thread_id`: memoria de corto plazo y
mecanismo de reanudación, no el repositorio del dominio. Se inyecta en `build_graph`.

```python
# infrastructure/deps.py
def build_triage_graph(settings: Settings) -> CompiledStateGraph:
    checkpointer = PostgresSaver.from_conn_string(settings.checkpoint_dsn) if settings.env != "test" else MemorySaver()
    return build_graph(llm=AnthropicLLM(chat_model(settings), PromptStore(PROMPTS_DIR)),
                       search=ElasticTicketSearch(es_client(settings)), escalation=SlackEscalation(slack(settings)),
                       sla=SlaPolicy.default(), checkpointer=checkpointer)
```

Lo que el negocio conserva (decisión, respuesta enviada) se guarda vía repositorio del
contexto desde el caso de uso, no leyendo checkpoints.

## Human-in-the-loop con interrupt

`interrupt()` pausa el grafo; reanudar es otro caso de uso (`ResumeTriage`) que recibe la respuesta humana como command.

```python
def confirm_escalation(state: TriageState) -> TriageState:
    answer = interrupt({"ticket_id": state["ticket_id"], "reason": state["decision"].reason})
    return {"decision": state["decision"] if answer["approved"] else replace(state["decision"], action="auto_reply")}

class ResumeTriage:                                   # application/resume_triage.py
    def __init__(self, graph: CompiledStateGraph) -> None: self._graph = graph
    def __call__(self, cmd: ResumeTriageCommand) -> TriageResult:
        cfg = {"configurable": {"thread_id": cmd.ticket_id}}
        return TriageResult.from_state(self._graph.invoke(Command(resume={"approved": cmd.approved}), config=cfg))
```

Requiere checkpointer. HTTP expone `POST /triage/{id}/resume`; la UI solo ve el payload del `interrupt`.

## Tests: FakeLLM, grafo completo y contrato del prompt

```python
class FakeLLM:                                        # testing/fakes.py
    def __init__(self, classification: Classification, reply: DraftReply | None = None) -> None:
        self._c, self._r, self.calls = classification, reply, []
    def classify(self, text, categories): self.calls.append(("classify", text)); return self._c
    def draft_reply(self, ticket, similar): return self._r or DraftReply("ok")

def test_low_confidence_asks_for_more_without_escalating():          # tests/unit/test_triage_graph.py
    escalation = RecordingEscalation()
    graph = build_graph(FakeLLM(Classification("bug", 0.3)), InMemoryTicketSearch([]), escalation, SlaPolicy.default())
    final = graph.invoke({"ticket_id": "t1", "text": "it broke"})
    assert final["decision"].action == "ask_more" and escalation.calls == []

@pytest.mark.llm                                      # tests/contract/test_triage_prompt.py, bajo demanda
@pytest.mark.parametrize("text,expected", [("charged twice", "billing"), ("how do I export?", "howto")])
def test_prompt_classifies_golden_set(real_llm: AnthropicLLM, text, expected):
    assert real_llm.classify(text, CATEGORIES).category == expected
```

Tres niveles: `decide_triage` puro (ms), grafo completo con fakes (ms, cubre aristas y
reducers), contrato del prompt contra el proveedor real con golden set y umbral de aciertos
(no exigir 100 %). Cambiar el prompt sin correr el tercero es desplegar a ciegas.

## Errores frecuentes

- Puerto `LLM.invoke(prompt: str) -> str`: prompt y parseo se filtran a aplicación.
- Reglas de negocio en el prompt ("escala si supera 500"): no testeables, deriva entre versiones del modelo.
- Nodos a nivel de módulo con clientes globales creados al importar: imposible inyectar fakes.
- Estado `dict[str, Any]` o `MessagesState` como cajón de sastre: nada protege el contrato entre nodos.
- Checkpointer como base de datos del negocio, o checkpoints leídos desde HTTP.
- Nodos que devuelven el estado completo en vez del delta: pisan reducers y campos ajenos.
- Tools con cliente propio en vez de envolver un puerto; tests solo contra el modelo real.
- `interrupt` sin checkpointer, o reanudación desde la ruta HTTP sin caso de uso.

## Checklist

- [ ] `langgraph` solo en `application/graph.py` e `infrastructure/`; SDKs solo en `infrastructure/`.
- [ ] Estado `TypedDict` tipado en términos del dominio; reducers explícitos en campos acumulativos.
- [ ] Puertos `LLM`, tools y memoria como `Protocol` con operaciones con significado.
- [ ] Reglas deterministas en `domain/` como funciones puras con tests propios.
- [ ] `build_graph(deps)` recibe todos los puertos; nodos devuelven deltas.
- [ ] Prompt versionado en `infrastructure/prompts/`; structured output solo en el adaptador.
- [ ] `@tool` creadas por una factoría que envuelve puertos; checkpointer inyectado (`MemorySaver` en tests).
- [ ] `interrupt` con caso de uso de reanudación; tres niveles de test (dominio, grafo con fakes, contrato del prompt).
