# Mejores prácticas — Python + LangGraph / LangChain

> Antes de aplicar cualquiera de estas, valida la API concreta en la documentación oficial (https://docs.langchain.com) o tu copia offline si la tienes.

## Python base
- Type hints en todo lo público; `mypy` estricto. `ruff` para lint+formato.
- `pydantic`/`pydantic-settings` para config y validación de datos.
- Funciones puras donde se pueda; efectos aislados. Logging estructurado (no `print`).

## Diseño de grafos (LangGraph)
- Estado tipado (`TypedDict`/pydantic) explícito; reducers claros para acumular.
- Nodos con una responsabilidad. Aristas condicionales legibles.
- Checkpointer para persistencia/reanudación; `thread_id` por conversación.
- Interrupciones/human-in-the-loop cuando una acción sea sensible (encaja con las acciones prohibidas).

## Herramientas / integraciones
- Tools con schema y descripción precisas; validación de argumentos. Manejo de errores y reintentos.
- Aísla llamadas a LLM/IO tras interfaces para poder mockear en tests.

## LLM
- Usa los modelos Claude más capaces por defecto. Controla `max_tokens`, timeouts y reintentos.
- Prompt caching cuando aplique. Cuenta tokens para no exceder límites.

## Testing
- pytest con LLM mockeado para lógica del grafo; tests de integración acotados y marcados.
- Fixtures para estado inicial; snapshots de las transiciones clave.

## Seguridad
- Secretos en `.env`/settings, nunca en código/logs. Sanea entradas externas (prompt injection).
- Limita lo que las tools pueden hacer (sin ejecutar shell/BD destructiva desde una tool sin control).

> Detalle y ejemplos bajo demanda: skill `code-quality` → `references/python.md` (+ `testing.md`, `security-owasp.md`, `performance.md`, `api-design.md`).
