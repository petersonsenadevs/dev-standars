# Guía de uso diario (para el usuario)

Instalación: [`INSTALL.md`](INSTALL.md). Esto es lo que haces DESPUÉS, en el día a día.
Regla de oro: **no tienes que activar nada** — con el proyecto sincronizado y una sesión nueva,
el agente se entera solo (router, hooks y skills). Los comandos slash son atajos, no requisitos.

## 1. Lo único que ejecutas tú (mantenimiento)

| Cuándo | Comando |
|---|---|
| Una vez por proyecto | `D:\dev-standards\tools\init-project.ps1 -Stack <stack> -Path <ruta> -Tools claude,codex` |
| Stacks disponibles | `laravel` · `next` · `astro` · `vue-ts` · `nuxt` · `sveltekit` · `wordpress` · `node-api` · `python-langgraph` (Go/Java/C# como referencias de code-quality) |
| Tras cada mejora de Senzu | `D:\dev-standards\tools\sync.ps1 -Path <ruta>` **+ sesión nueva del agente** |
| Refrescar la colección de efectos | `D:\dev-standards\tools\vendor-effects.ps1 -Missing` |
| Ver que el paquete está sano | `tools\check-skills.ps1` + `tools\test-router.ps1` |
| Catálogo completo (skills, enrutamiento, comandos, muros) | [`REFERENCIA.md`](REFERENCIA.md) (generado, siempre al día) |

## 2. Qué pasa solo (sin comandos) en Claude Code

- **Router**: cada petición tuya en llano sugiere al agente la skill correcta ("mejora la página" →
  ui-ux-pro-max; "webhook de stripe" → code-quality; "genera una imagen" → image-gen).
- **Brief forzado**: si va a diseñar sin brief ni design system, el hook le obliga a preguntarte primero
  (marca, 2-3 webs que te gusten, objetivo). No inventa la dirección visual.
- **Cierre bloqueado**: no puede dar nada por terminado sin (a) build/lint/types/tests en verde si tocó
  código, (b) verificación móvil-primero si tocó UI, (c) devlog del día escrito.
- **Guard**: nada destructivo (push, resets, DROP) sin tu aprobación; secretos y archivos protegidos vetados;
  comandos devops peligrosos bloqueados (`curl|bash`, `chmod 777`, `dd` a discos, `mkfs`, `docker prune`,
  parar servicios, vaciar el firewall, `crontab -r`). Los hooks son Node (`.mjs`): funcionan igual en
  Windows, macOS y Linux.
- **Muros nuevos**: jQuery/Bootstrap bloqueados al instalar (salvo aprobación explícita); `console.log`/`dd()`/
  `debugger` bloqueados al introducirse en código fuente; `.only`/`.skip`/`xit` introducidos en tests
  bloqueados (desactivan la suite en CI sin que se note); marcadores de conflicto de git (`<<<<<<<`)
  bloqueados al guardarse; los términos entre acentos graves en la sección "No"
  de `gustos.md` se bloquean de verdad; primera edición de UI sin brief ni design system → muro (una vez por sesión); deploy a producción
  (`--prod`) bloqueado hasta tu aprobación explícita.
- **Memoria de gustos**: tus opiniones de diseño van a `senzu/design-system/<slug>/gustos.md`; un veto no se re-propone.
- **Consciente de versiones**: al arrancar la sesión detecta las versiones reales (PHP/Laravel/Node/framework)
  y avisa si algo está sin soporte (EOL); el agente aplica las prácticas de ESA versión, no de la última.
- **Consciente de nuevo vs existente**: si hay código previo sin convenciones selladas te propone `/adoptar`
  (y mientras tanto imita el código vecino); si está vacío, empieza por `/brief` + `/plan` (o `/adoptar` en
  modo entrevista). Si el proyecto ya lleva su diario (CHANGELOG, ADRs) o su CLAUDE.md, **pregunta antes de
  adaptarse** — puedes dejar tu CLAUDE.md intacto (las reglas van a `CLAUDE.dev-standards.md`).
- **Convenciones adoptadas** (`/adoptar`): en proyectos heredados, las convenciones se analizan, se pactan
  contigo y se sellan como inmutables; el hook `conventions-guard` bloquea el código que las viole.
- **Muros de backend**: bloquea migraciones que borran o renombran columnas y tablas en la parte `up`
  (lo destructivo va con tu aprobación), `env('…')` de Laravel fuera de `config/` (con la caché de config
  devuelve null) y logs con datos personales (`$request->all()`, `req.body`, contraseñas o tokens). La
  primera vez que toca backend en la sesión le recuerda la receta de su stack.
- **Depuración con método**: cuando un test, build o lint falla, el agente recibe el método de `/depurar`
  (reproducir → aislar → hipótesis → un cambio cada vez) en lugar de probar a ciegas. Tras tres intentos
  fallidos se para y te lo cuenta.
- **Memoria del proyecto** (`senzu/devlog/MEMORIA.md`): decisiones vigentes, reglas del cliente, lo que no
  funcionó y lo pendiente, en una línea cada cosa con su entrada del devlog. Llega sola al empezar cada
  sesión; si el día trae una decisión nueva y no se apuntó en la memoria, no deja cerrar. Antes de llevarte
  la contraria con algo ya decidido, el agente tiene que citarlo y preguntarte. El devlog se sigue
  escribiendo igual: para lo que no está en la memoria busca hacia atrás con
  `node .claude/skills/devlog/scripts/buscar.mjs "palabras"` (acentos, plurales, erratas y sinónimos)
  y cita la entrada. En un proyecto con historial y sin memoria, la crea en la primera sesión y te la
  enseña para que la confirmes.
- **Permisos por proyecto** (los decides tú, en el menú del instalador o con `--permitir`): por defecto el
  agente no hace push ni commitea en main. En un proyecto puedes darle `push` (ramas que no son main),
  `push-main` (también main) o `commit-main`. El push forzado, lo destructivo y los secretos siguen
  bloqueados siempre. Puedes apagar hooks concretos con `--apagar-hooks format-on-save,front-skill-reminder`
  (guard, secretos y archivos protegidos no se apagan). Se guarda en `senzu/senzu.json`, que el agente
  no puede tocar: ni editándolo, ni desde la terminal, ni lanzando él el instalador con esos flags o
  respondiendo él al menú. Vale para Claude y para Codex. Es una barrera contra errores y atajos, no una
  caja fuerte: el guard lee el texto de los comandos, así que un agente empeñado podría sortearlo con un
  script propio. Por eso las reglas también se lo prohíben y cualquier cambio queda en git.
- **Assets pesados**: al cerrar la tarea avisa (sin bloquear) de imágenes de más de 500 KB, SVG de más de
  150 KB, fuentes TTF/OTF sin convertir a WOFF2 y vídeos de más de 5 MB añadidos en las últimas 24 horas.
- **Modo ahorro** (opcional, `--ahorro` al instalar): CLAUDE.md compacto (unos 7.000 caracteres menos por
  sesión) y respuestas técnicas en estilo telegráfico. Los textos para el cliente, `/brief`, `/propuestas`,
  `/estimar` y `/entregar` siguen en lenguaje completo. Se quita con `--sin-ahorro`.

## 3. Comandos slash (Claude Code) — atajos

| Comando | Para qué | Cuándo usarlo |
|---|---|---|
| `/plan` | Crea/retoma `senzu/plan/PLAN.md` con tarjetas | Proyecto o feature nueva |
| `/siguiente` | Coge la siguiente tarjeta del plan | Cada vez que quieras avanzar |
| `/brief` | Entrevista en llano (sin palabreo técnico) | Antes de diseñar nada nuevo |
| `/propuestas [página]` | Blueprint aprobable + 2 maquetas A/B que se VEN | Proyecto nuevo, rediseño, o "no sé lo que quiero" |
| `/design-system [keywords]` | Genera/revisa el design system persistido | Al fijar la dirección visual |
| `/efecto [nombre]` | Efecto concreto vía catálogo (receta + coste móvil) | "Quiero un parallax/marquee/lo-que-sea" |
| `/verificar` | Build+lint+types+tests, y móvil si hubo UI | Antes de dar algo por terminado (o deja que el bloqueo lo pida) |
| `/desplegar [entorno]` | Deploy con red: PRE (backup+rollback+aprobación) → deploy → smoke POST | Cada subida a producción |
| `/adoptar [notas]` | Analiza un proyecto existente y sella sus convenciones como regla inmutable (+ hook que las hace cumplir) | Al entrar en un proyecto heredado |
| `/ronda [tu opinión]` | Siguiente ronda de maquetas: lo que te gustó se fija, lo que no se veta, y cada maqueta trae algo nuevo | Tras ver las maquetas de `/propuestas` |
| `/revisar-ui [url]` | Pasada de UI en navegador (375/768/1440, dark, consola, axe) | "Revisa cómo se ve" |
| `/depurar [síntoma]` | Depuración con método: reproducir, aislar, hipótesis, arreglo y test que lo cubre | "No funciona", error 500, tests en rojo (se activa solo al fallar una prueba) |
| `/estimar [alcance]` | Estimación en horas con rango (mínimo, previsto, máximo) y lo que suele olvidarse | Antes de dar un presupuesto |
| `/entregar` | Paquete de entrega al cliente en `docs/entrega/`: manual, accesos (sin contraseñas), mantenimiento | Al cerrar un proyecto |
| `/mapa` | `docs/MAPA.md`: cómo está montado el proyecto y dónde tocar para cada cosa | Al heredar un proyecto o para que entre alguien nuevo |

## 4. Frases en llano que activan cada cosa (sin slash)

- "haz la web / landing / página de …" → diseño completo con brief primero.
- "enséñame dos propuestas antes" → modo propuesta (maquetas A/B).
- "que se vea moderna / tipo bento / con un fondo aurora" → recetario del look moderno.
- "ponle [efecto]: parallax, marquee, antes/después, cursor, texto que se deshace…" → catálogo → receta.
- "genera una imagen del producto flotando para el hero" → image-gen (nativo o script).
- "¿qué framework uso para …?" → árbol A0 de elección de stack.
- "se ve mal en el móvil" → ui-verify.
- "añade login / el webhook de stripe / se duplican pedidos / va lento" → recetas backend por síntoma.
- "no me gusta X / nunca me pongas Y" → queda vetado en gustos.md.
- "hazme más maquetas con lo que me gustó / otra ronda" → rondas de maquetas (fija, veta y propone algo nuevo).
- "¿por qué hicimos…? / ¿cuándo cambiamos…? / ¿en qué quedamos con…?" → busca en el devlog y cita la entrada.
- "no funciona / da error 500 / los tests están en rojo" → depurar.
- "¿cuántas horas es esto? / prepárame el presupuesto" → estimación.
- "prepara la entrega al cliente / el manual de uso" → paquete de entrega.
- "explícame este proyecto / haz un mapa del proyecto" → mapa del proyecto.
- "texto que rodea una forma / titular que se reajusta al ancho" → recetas de Pretext.

## 5. Flujos típicos de principio a fin

**Web nueva**: `/brief` → `/propuestas home` (apruebas blueprint; ronda 1 con maquetas A y B) → abres las
maquetas, pulsas «Tu opinión» y votas Sí / No cada pieza (letra, botones, color, layout…) → «Copiar» y lo
pegas en el chat (o lo dices con tus palabras) → `/ronda` → nueva ronda: lo que te gustó fijo en todas, lo
vetado fuera y algo nuevo en cada una → repites hasta que digas «esta» → el agente construye → `/verificar`
(+ móvil) → devlog → commit (te lo pedirá, nunca push sin tu ok). Todas las rondas quedan en
`senzu/design-system/<slug>/propuestas/index.html` y las decisiones en `gustos.md`.

**Rediseño de algo existente**: "quiero renovar la página X" → brief corto + `/propuestas X` →
construir sobre la elegida.

**Solo un efecto**: `/efecto marquee de logos` (o pedirlo en llano) → receta + coste móvil → implementa →
verificación móvil obligatoria.

**Imágenes para la web**: pide la imagen describiendo dónde va ("para el hero, el producto flotando");
la paleta sale sola del design system. En la app de ChatGPT/Codex la genera nativa; en CLI usa tu API key.

**Bug/feature de backend**: descríbelo con tus palabras ("los usuarios duplican pedidos") → receta exacta
→ arregla → `/verificar` bloquea el cierre hasta tests en verde.

## 6. En Codex (diferencias honestas)

Codex puede usar Senzu de dos formas, y conviene saber qué llega con cada una.

**a) Con el marketplace de plugins de Codex** (el mismo repo: Codex lo añade como marketplace git y
descarga los plugins `senzu-*`):

| Pieza | ¿Funciona en Codex? |
|---|---|
| Skills | **Sí**, todas las del plugin. Se descubren solas por su descripción o con `$nombre-de-skill`. |
| Comandos | **Sí, desde la versión 1.1.0.** Codex no tiene comandos slash propios: convierte cada comando de Claude en una skill llamada `source-command-<nombre>` (por ejemplo `source-command-brief`). Se usan pidiéndolo en llano ("haz el brief", "ejecuta el comando plan") o mencionando esa skill. |
| Hooks (muros) | **Sí, desde la 1.5.0, con el plugin.** Codex ejecuta el `hooks.json` del plugin. Sus ediciones llegan como parches (`apply_patch`) y los hooks los traducen, así que los muros de archivos, secretos, higiene, convenciones y backend funcionan igual que en Claude, también con parches de varios archivos. Tras actualizar el plugin, Codex pide **volver a aprobar los hooks** (guarda una huella de cada uno): apruébalos o no se ejecutarán. Con la instalación por proyecto sin plugin (solo `AGENTS.md` y `.agents/skills`) Codex no recibe hooks. |

**Por qué antes solo aparecía `/verificar`**: Codex solo convierte los comandos que **no usan
argumentos**. Hasta la 1.0.x, 14 de los 15 comandos llevaban `$ARGUMENTS` o `argument-hint` y Codex los
descartaba sin avisar; `verificar` era el único sin argumentos. Ojo: Codex también cuenta como argumento cualquier `$NOMBRE` escrito en el texto (`$HOME`, `$env:X`); por eso `/instalar` siguió sin aparecer hasta la 1.1.2. Desde la 1.1.2 ningún comando usa ninguna de las dos cosas
(la pista de uso va en una línea "Uso:" del propio comando) y `check-skills` falla si alguien vuelve a
añadirlos. En Claude no cambia nada: lo que escribas tras el comando le llega igual.
Tras actualizar el marketplace en Codex, **reinstala o actualiza el plugin desde la app** para que
vuelva a convertir los comandos. **No lo actualices con la CLI** (`codex plugin marketplace upgrade`):
la CLI descarga la versión nueva pero no convierte los comandos, y la app, al verla ya descargada, no
los convierte después (el plugin aparece sin ningún comando). Si te pasa: desinstala y vuelve a instalar
el plugin desde la app.

**b) Con las skills globales** (`install.ps1` → `~/.agents/skills` y `~/.codex/skills`): solo skills, sin
comandos ni hooks. Desde la 1.1.0 instala por defecto también `backend-audit`, `deploy-ops`,
`marketing-seo`, `email-html` y `devlog`, que antes faltaban (`SENZU_ALL=1` instala todas).

Con las skills globales (sin plugin) no hay hooks: ahí sé un punto más explícito en Codex: "usa la skill
image-gen", `$ui-ux-pro-max`, o "verifica el build" (`node .agents/skills/code-quality/scripts/verify-build.mjs`).

## 7. Mapa de dónde vive cada cosa (por si quieres mirar)

`senzu/design-system/<slug>/` → BRAND.md (marca) · gustos.md (tus vetos) · blueprint.md · propuestas/ (maquetas) ·
MASTER.md (tokens) · prompts.md (imágenes) — `senzu/plan/` → PLAN.md y brief.md — `senzu/devlog/` → diario del proyecto —
En Senzu: `core/effects-vendor/INDEX.md` (124 carpetas de efectos) · `front-activation/references/`
(catálogo y fuentes) · `code-quality/references/backend-catalog.md` (backend por síntoma).
