# Prohibiciones específicas — Python + LangGraph / LangChain

Además de las globales (`core/methodology/prohibited-actions.md`):

- Escribir código LangChain/LangGraph **sin consultar la documentación** primero
  (la documentación oficial (https://docs.langchain.com) o tu copia offline si la tienes). Las APIs cambian entre versiones.
- Hardcodear API keys / secretos en el código o en prompts; loguear secretos.
- Instalar dependencias globalmente en vez de en el entorno del proyecto (uv/poetry/venv).
- Tools que ejecuten shell, borrados o SQL destructivo sin control humano.
- `Base.metadata.drop_all` / migraciones destructivas (Alembic `downgrade base`) sin aprobación.
- Silenciar `mypy`/`ruff` con ignores masivos para "que pase".
