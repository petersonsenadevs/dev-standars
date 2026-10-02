# Stack: Python + LangGraph / LangChain

> Prompt EVOLUTIVO: ajústalo a medida que avanza el proyecto.

Trabajas en un proyecto Python con LangGraph/LangChain. Reglas base + estas.

## REGLA CRÍTICA: consulta la documentación ANTES de escribir código
- Documentación de LangChain/LangGraph (Python): la oficial, https://docs.langchain.com, o una copia
  offline del proyecto si existe (su ruta va en `CLAUDE.project.md` / `AGENTS.project.md`). En la copia
  offline: subcarpetas `langgraph/`, `langchain/`, `integrations/`, `deepagents/`, `concepts/`, `reference/`, `migrate/`.
- **Siempre** consulta la docu antes de usar una API de LangChain/LangGraph. No inventes
  firmas ni imports: las APIs cambian entre versiones.
- Si hay un MCP de documentación configurado (ver `mcp.json`), úsalo para buscar antes de codificar.

## Convenciones Python
- Python 3.11+. Tipado con type hints en todo lo público. `mypy` sin errores.
- Formato y lint con **ruff** (`ruff format` + `ruff check`).
- Entornos: usa el gestor del repo (uv/poetry/venv). No instales global.
- Estructura: paquetes con `__init__.py`, config por `pydantic-settings`/`.env` (nunca hardcodear claves).

## LangGraph / LangChain
- Modela flujos como **grafos de estado** (`StateGraph`) con estado tipado (TypedDict/pydantic).
- Nodos pequeños y puros donde se pueda; efectos (LLM, tools, IO) aislados y testeables.
- Herramientas (tools) con esquemas claros y descripciones útiles. Maneja errores de tool.
- Checkpointing/persistencia según la docu; memoria e hilos (`thread_id`) bien gestionados.
- Modelos: usa los más capaces de Claude por defecto (ver referencia de la API si aplica).
- Streaming y manejo de tokens según la API; controla límites y timeouts.

## Calidad / seguridad
- Tests con pytest (incluye tests de los grafos con LLM mockeado). `mypy` + `ruff` limpios.
- Claves/API keys solo en `.env`/settings; nunca en el código ni en logs.
- Cuidado con prompt injection en entradas externas; valida y acota lo que llega a las tools.

## Antes de commitear
1. `ruff format .` 2. `ruff check .` 3. `mypy .` 4. `pytest` 5. actualizar `senzu/devlog/`.

## Plan y tareas
- Antes de una feature o proyecto: `senzu/plan/PLAN.md` (skill `project-planner`); una tarea `doing` a la vez.
- El cuerpo del commit lleva `Tarea: <id>` y la tarjeta se marca `done` con el enlace al devlog.
