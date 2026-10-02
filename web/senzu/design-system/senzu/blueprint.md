# Blueprint — web de Senzu (PENDIENTE DE APROBACIÓN)

Estructura y textos esbozados con contenido REAL. Lo marcado «generado» sale del repositorio en cada
build (no se escribe a mano en la web).

## Portada (`/`)
| # | Sección | Contenido (texto real esbozado) | Lo trae |
|---|---|---|---|
| 1 | Hero | Titular: **«Una semilla y tu proyecto se recupera.»** · Subtítulo: «Reglas, memoria y muros que bloquean de verdad para Claude Code y Codex. En castellano.» · Bloque con el comando `/plugin marketplace add petersonsenadevs/senzu` + botón copiar · Enlace secundario: GitHub | agente · logo/mascota: rondas |
| 2 | El problema | «Tu agente se olvida de lo que decidisteis, sube a producción sin preguntar y da por hecho lo que no ha probado.» Tres frases, tres iconos | agente |
| 3 | Muros que bloquean | Terminal real con un bloqueo: `[BLOQUEADO por Senzu] git push está prohibido sin aprobación explícita.` + 4 muros destacados (push y deploy, secretos, migraciones destructivas, convenciones) | agente · captura: usuario |
| 4 | Memoria | «Empieza cada sesión sabiendo qué se decidió.» MEMORIA.md + el buscador con un ejemplo de búsqueda y su resultado | agente |
| 5 | Verifica antes de cerrar | Lint, tipos, tests y móvil 375 px; monorepos incluidos. Ejemplo de resumen PASS/FAIL | agente |
| 6 | Diseño por rondas | Maqueta con piezas votables (A·T1, B·B2): lo que te gusta se fija, lo que no se veta, siempre algo nuevo. Imagen del panel «Tu opinión» | agente (captura ya hecha en pruebas) |
| 7 | Cifras reales | 44 skills · 16 hooks · 20 comandos · 9 stacks (**generado** de los contadores del README) | generado |
| 8 | Instalar | Pestañas: Claude Code · Codex · Instalador interactivo (`node senzu/tools/init.mjs`) | generado de INSTALL.md |
| 9 | Pie | GitHub · Licencia MIT · versión actual (**generado**) · autoría (pregunta abierta) | agente |

## Documentación (`/docs`, Starlight)
| Sección | Fuente en el repo |
|---|---|
| Empezar | INSTALL.md |
| Uso diario | USO.md |
| Comandos | docs/comandos.md (generado) |
| Muros y hooks | docs/hooks.md (generado) |
| Skills | docs/skills.md (generado) |
| Stacks | docs/stacks.md (generado) |
| Arquitectura | docs/arquitectura.md |
| Referencia completa | REFERENCIA.md (generado) |
| Novedades | CHANGELOG.md (generado del devlog) |

Excluido de la web pública: skill de marca de la agencia, devlogs de proyectos, notas internas.

## Preguntas abiertas
- ¿Mascota en el hero (sección 1) o ilustración sin personaje? Se decide en la ronda de logos.
- ¿La sección 6 (diseño por rondas) va en portada o solo en docs?
