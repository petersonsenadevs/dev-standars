# Memoria del proyecto (`devlog/MEMORIA.md`) y búsqueda en el pasado

## Índice
1. Tres niveles: memoria, índice, entradas
2. Qué entra en la memoria y qué no
3. Formato y ciclo de vida de una decisión
4. Crear la memoria desde un devlog existente
5. Buscar en el pasado con `buscar.mjs`
6. Qué obliga y qué no

## 1. Tres niveles: memoria, índice, entradas
| Nivel | Archivo | Cuándo se lee |
|---|---|---|
| Memoria | `devlog/MEMORIA.md` | Siempre: el hook session-start la inyecta al empezar y pre-compact al compactar |
| Índice | `devlog/INDEX.md` | Para ubicar una entrada por número, fecha o título |
| Entradas | `devlog/<fecha>/NNN-slug.md` y `DECISIONES.md` | Solo la que haga falta, por su sección |

El devlog se sigue escribiendo igual: la memoria es el resumen de lo vigente con enlaces a las entradas.
Nada se borra del devlog; viajar atrás siempre es posible.

## 2. Qué entra en la memoria y qué no
**Entra** (una línea por punto, con la entrada que lo explica):
- **Decisiones vigentes**: qué se eligió y por qué en media frase (`Sanctum, no Passport: sin terceros`).
- **Reglas del cliente y del proyecto**: lo que el cliente pidió o vetó, convenciones no escritas.
- **Lo que no funcionó**: intentos fallidos que nadie debe repetir, con el motivo.
- **Pendientes abiertos**: lo que está esperando a alguien (textos legales, accesos, una respuesta).

**No entra**: el detalle de cómo se hizo (va en la entrada), commits, salidas de comandos, lo que ya
dicen `conventions.md`, `design-system/*/gustos.md` o `plan/PLAN.md` (se enlaza, no se copia).

Máximo **60 líneas**. Lo sustituido y lo cerrado se mueve a `devlog/MEMORIA-historico.md` (el buscador
también lo lee). Si la memoria no cabe en 60 líneas, el proyecto necesita resumir, no ampliar el límite.

## 3. Formato y ciclo de vida de una decisión
```markdown
## Decisiones vigentes
- D-020 · Pagos con Stripe Checkout alojado, no Elements (3DS y facturas sin código propio) · ver 041
- D-007 · Correos siempre por cola (Horizon + Redis), nunca síncronos · ver 012

## Lo que no funcionó (no repetir)
- D-012 · Stripe Elements: sustituida por D-020 (demasiado código propio para 3DS) · ver 034
```
- **Numeración `D-xxx`** correlativa en todo el proyecto; nunca se reutiliza un número.
- **Cambiar una decisión**: no se edita ni se borra la antigua. Se añade la nueva y la antigua pasa a
  «Lo que no funcionó» (o al histórico) con `sustituida por D-yyy`. El buscador pone por delante la vigente.
- **Contradecir una decisión vigente**: el agente la cita (`D-007 dice…`) y pregunta antes de actuar.
  Si el usuario la cambia, se registra como arriba en la entrada del día.
- Cada decisión nueva va también en la sección «Decisiones» de la entrada del día (o en `DECISIONES.md`):
  así el stop-guard detecta que hay algo que llevar a la memoria.

## 4. Crear la memoria desde un devlog existente
Cuando session-start avisa de que no hay memoria y ya hay historial:
1. Lee `devlog/INDEX.md` entero (es corto) y todos los `DECISIONES.md`.
2. Abre solo la sección «Decisiones» de las entradas de tipo `decisión`, `feature` o `infra`
   (`buscar.mjs "decision" --max 20` ayuda a localizarlas).
3. Escribe una línea por decisión que siga vigente, con su `ver NNN`. Las que se cambiaron después
   van a «Lo que no funcionó» marcadas como sustituidas.
4. Añade las reglas del cliente que aparezcan en el devlog o en `plan/brief.md`.
5. Enséñale la memoria al usuario en una lista corta y pídele que confirme o corrija antes de darla
   por buena: es la fuente de verdad a partir de ahora.
6. Regístralo en el devlog del día (tipo `docs`).

## 5. Buscar en el pasado con `buscar.mjs`
```
node <skills-dir>/devlog/scripts/buscar.mjs "webhook stripe"
node <skills-dir>/devlog/scripts/buscar.mjs "cola correos" --desde 2026-09 --max 10
node <skills-dir>/devlog/scripts/buscar.mjs "login" --tipo decision
```
- Sin dependencias, en Claude y en Codex. `<skills-dir>` es `.claude/skills` o `.agents/skills`.
- Tolera acentos y mayúsculas, plurales y conjugaciones («pagar» → pagos), erratas de una letra
  («stirpe»), palabras cortadas («migr») y sinónimos técnicos (login = auth = Sanctum…).
- Sinónimos propios del proyecto en `devlog/sinonimos.json`: `[["datafono", "tpv", "cobro"]]`. Si un
  grupo comparte una palabra con uno de base (aquí «cobro» con pagos), lo amplía.
- Ranking: las palabras del título y las decisiones pesan más; gana quien cubre todas las palabras; a
  igualdad, lo más reciente. Las decisiones sustituidas salen marcadas y por detrás.
- Devuelve 5 resultados con su frase clave y la ruta (unos 300 tokens). Abre solo la entrada útil y
  solo la sección indicada.
- Sin resultados: prueba con un sinónimo; si sigue sin aparecer, di que no hay registro.
- No busca por significado («cobrar a los clientes» no encuentra «Stripe» si no está en los sinónimos).

## 6. Qué obliga y qué no
| Momento | Mecanismo | Obliga |
|---|---|---|
| Inicio de sesión | session-start inyecta la memoria, los próximos pasos de la última entrada y cómo buscar | Sí (llega siempre) |
| Compactación | pre-compact la re-inyecta | Sí |
| Cierre con decisiones nuevas | stop-guard bloquea una vez si MEMORIA.md no se actualizó después | Sí |
| Memoria de más de 60 líneas | stop-guard recuerda pasar lo viejo al histórico | Aviso |
| Preguntas sobre el pasado | prompt-router sugiere la skill devlog | Aviso |
| No contradecir una decisión | Regla del CLAUDE.md/AGENTS.md + memoria en contexto | No hay hook que lo vea |

En Codex con el plugin, los mismos hooks hacen lo mismo. Sin plugin (solo `.agents/skills`) no hay hooks:
AGENTS.md pide leer `devlog/MEMORIA.md` al empezar y usar el buscador.
