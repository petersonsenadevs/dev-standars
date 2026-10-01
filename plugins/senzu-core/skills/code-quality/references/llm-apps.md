# Apps con LLM: chat, RAG, streaming, costes y evals (multi-stack)

Índice: 1 Arquitectura mínima · 2 Prompts como código · 3 RAG que funciona · 4 Streaming ·
5 Costes y límites · 6 Seguridad · 7 Evals: probar lo no determinista · 8 Errores típicos

## 1. Arquitectura mínima
- El LLM detrás de UNA interfaz propia (`LlmClient` con `complete()`/`stream()`): proveedor y modelo son
  config por entorno, no imports repartidos por el código. Cambiar de modelo = cambiar un valor.
- Modelos por defecto: los últimos de Anthropic (claude-sonnet-5 equilibrio, claude-haiku-4-5 barato/rápido,
  claude-opus-5/fable razonamiento profundo). Modelo POR TAREA: clasificar no paga el modelo grande.
- Toda llamada registra: modelo, tokens in/out, latencia, coste estimado y un id de conversación — sin esto
  no hay debugging ni facturas explicables.
- Reintentos con backoff SOLO en errores transitorios (429/5xx), timeout SIEMPRE; el fallo del LLM tiene
  camino degradado (mensaje honesto al usuario, nunca spinner infinito).

## 2. Prompts como código
- Prompts en archivos versionados (`prompts/`), no strings incrustados: se revisan en PR, se referencian
  por nombre y se cambian sin tocar lógica. Variables interpoladas explícitas.
- System prompt: rol + reglas + formato de salida + QUÉ HACER cuando no sabe (decir "no lo sé" > inventar).
- Salida estructurada: usa tool-use/structured output del proveedor y VALIDA el JSON contra schema
  (zod/pydantic); ante fallo de validación, un reintento con el error — luego camino degradado.

## 3. RAG que funciona
- Pipeline: trocear (por estructura semántica: títulos/párrafos, 300–800 tokens, algo de solape) →
  embeddings → guardar con metadatos (fuente, sección, fecha) → recuperar top-k → construir contexto citando fuentes.
- Vector store: **pgvector** primero (ya tienes Postgres; índice HNSW); dedicado (Qdrant/Pinecone) solo con
  volumen/filtrado que lo exija. Búsqueda híbrida (vector + full-text) mejora casi siempre: database-design §5.
- Reindexado: por eventos del contenido + comando idempotente completo. El índice desactualizado es el bug nº1.
- La respuesta cita sus fuentes (link/sección). Si la recuperación viene vacía o floja: decirlo, no alucinar.
- Antes de RAG pregunta: ¿cabe todo el contexto directamente? (docs pequeñas → contexto directo, sin pipeline).

## 4. Streaming
- Chat/generación larga SIEMPRE en streaming: SSE del proveedor → tu backend → cliente (realtime §1: SSE,
  no websockets, para servidor→cliente).
- El backend RE-EMITE (no expone la API key al navegador) y acumula la respuesta completa para guardarla
  al terminar (historial + tokens).
- UI: render incremental de markdown, botón "parar", y estado claro de "pensando" vs "escribiendo".

## 5. Costes y límites
- Presupuesto por usuario/tenant (tokens/día) ANTES del incidente de factura; rate limit propio además del
  del proveedor.
- Caché: respuestas idénticas (FAQ, clasificaciones) se cachean por hash del input; prompt caching del
  proveedor para system prompts largos y contexto RAG repetido.
- Historial de chat: ventana deslizante + resumen de lo viejo — no mandes 200 mensajes en cada turno.

## 6. Seguridad
- El input del usuario y lo RECUPERADO por RAG son datos, no instrucciones: el system prompt lo deja claro
  y los privilegios reales viven FUERA del LLM (las tools ejecutan con la autorización del usuario, con
  allowlist de acciones; confirmación humana para acciones con efectos).
- Nunca PII/secretos en prompts que salen a terceros sin necesidad y sin contrato (DPA); logs de prompts
  con retención definida (RGPD).
- La salida del LLM se escapa como cualquier input al pintarla (XSS vía markdown/HTML generado).

## 7. Evals: probar lo no determinista
- Set dorado versionado (20–50 casos reales: input → criterios de respuesta aceptable) que corre como test:
  aserciones duras donde se pueda (¿cita fuente? ¿JSON válido? ¿rechaza lo prohibido?) + LLM-as-judge con
  rúbrica para calidad. Umbral que rompe CI si baja.
- Cada bug real de prompt/RAG → caso nuevo del set (igual que un test de regresión).
- Cambio de modelo o prompt = correr evals ANTES de desplegar, no "se ve bien en dos pruebas".

## 8. Errores típicos del agente
- API key en el cliente · llamadas al proveedor esparcidas sin interfaz · prompt gigante hardcodeado.
- RAG por defecto cuando cabía en contexto · trocear por longitud ciega partiendo tablas y código.
- Sin streaming ("tarda 40 s y parece rota") · sin guardar tokens/costes · sin camino degradado.
- Confiar en la salida sin validar schema · pintar la respuesta sin escapar · "lo probé una vez y va".
