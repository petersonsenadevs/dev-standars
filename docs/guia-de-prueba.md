[← Volver al README](../README.md)

# Guía de prueba: Senzu en una tarde

Para probar el paquete **completo** en un proyecto real y ver dónde está el valor. Unos 60-90 minutos.
No hace falta leer nada más antes: cada prueba dice qué escribir y qué debería pasar.

## Qué es y por qué importa (30 segundos)

Senzu convierte nuestra forma de trabajar en algo que el agente de IA **cumple solo**:

- **Sabe qué hacer sin que se lo digas**: pides en llano y el agente carga la skill adecuada (41 skills:
  diseño, efectos, backend, deploy, SEO, emails…), leyendo solo la parte necesaria.
- **No puede saltarse las normas**: lo peligroso se bloquea antes de que ocurra (push, deploy a
  producción, secretos, `console.log`, tests desactivados, clichés de "web hecha con IA"…).
- **No da nada por hecho sin comprobarlo**: build, tests y revisión en móvil antes de cerrar una tarea,
  y documentación automática de cada paso.
- **Diseña acompañando**: entrevista en llano, dos maquetas para elegir antes de construir y memoria de
  lo que te gusta y lo que no.

El valor está en que **da igual quién o qué agente trabaje el proyecto: el resultado sale con el mismo
estándar de calidad**.

## Dónde instalarlo: los scopes

Hay dos piezas. El **plugin** da las skills, los muros y los comandos. La **instalación en el proyecto**
(`/instalar`) añade lo específico del proyecto: reglas del stack en `CLAUDE.md`, versiones, comandos de
verificación, perfil de diseño, `senzu/devlog/`, `senzu/plan/` y convenciones.

| Scope del plugin | Dónde queda | Para quién |
|---|---|---|
| `user` (recomendado, por defecto) | `~/.claude` | Tú, en todos tus proyectos |
| `project` | `.claude/settings.json` del repo (va en git) | Todo el equipo que clone el repo |
| `local` | `.claude/settings.local.json` (no va en git) | Solo tú, solo en ese repo |

Dentro de Claude, `/plugin` te pregunta el scope al instalar. En la terminal:
`claude plugin install senzu-all@senzu --scope project`.

Recomendación: plugin `senzu-all` con scope `user` + `/instalar` en cada proyecto real.

## 1. Instalar (10 minutos)

**Requisitos**: Claude Code, Node 18 o superior y Git. Python 3 es opcional (el buscador de diseño lo usa).

**Paso 1 — el plugin completo**, una vez por máquina. Dentro de Claude Code:
```
/plugin marketplace add petersonsenadevs/senzu
/plugin install senzu-all@senzu
```
Cierra Claude Code y ábrelo de nuevo.

**Paso 2 — la instalación en el proyecto**. Abre Claude Code **en la carpeta raíz** del proyecto que
quieras probar y escribe:
```
/instalar
```
Clona el paquete si hace falta, detecta el stack (Laravel, Next, Astro, WordPress, Nuxt…), te hace una
sola pregunta de confirmación y lo deja todo configurado. Si el proyecto ya tenía su propio `CLAUDE.md`,
lo respalda y lo respeta.

**Paso 3** — cierra la sesión y **abre una nueva** en el mismo proyecto. Las skills, los muros y los
comandos se cargan al arrancar.

> **¿Usas Codex?** Codex lee el mismo marketplace. Las skills funcionan y, desde la versión 1.1.0,
> también los comandos (Codex los convierte en skills `source-command-<nombre>`: pídelo en llano, por
> ejemplo "haz el brief"). Los muros no están garantizados en Codex. Detalle en [USO.md](../USO.md) §6.

> Alternativa sin plugin: `git clone https://github.com/petersonsenadevs/senzu.git` y después
> `node senzu/tools/init.mjs --stack laravel --path <tu-proyecto> --tools claude`.

## 2. Comprobar que funciona (2 minutos)

| Comprueba | Qué debe pasar |
|---|---|
| Nada más abrir la sesión | El agente ya conoce el proyecto: stack, versiones reales (por ejemplo "Laravel ^13, PHP ^8.3") y si es un proyecto nuevo o existente |
| Escribe `/` | Aparecen `/brief`, `/propuestas`, `/plan`, `/verificar`, `/adoptar`, `/efecto`, `/lanzar`… |
| Pídele "haz git push" | **Bloqueado** con el motivo |

Si no aparecen los comandos: sesión nueva. Si sigue igual, desinstala y vuelve a instalar el plugin.

## 3. Recorrido de prueba (lo importante)

Haz las pruebas en orden o elige las que más te interesen. En cada una: **qué escribir** → **qué
debería pasar** → **qué mirar**.

### Prueba 1 — Proyecto heredado: que escriba como nosotros
**Escribe**: `/adoptar`
**Debería**: analizar el código real (configuración, varios archivos por capa, commits) y hacerte como
mucho 5 preguntas, cada una con una propuesta, sobre lo que no esté claro. Después sella las
convenciones del proyecto en `senzu/conventions.md`.
**Mira**: si luego le pides código que rompa una convención sellada como regla (por ejemplo validar
dentro del controlador si el proyecto usa FormRequests), **le bloquea la edición**. Las convenciones
que no se pueden comprobar automáticamente quedan escritas en `senzu/conventions.md` y el agente las sigue.

### Prueba 2 — Diseño acompañado: el brief
**Escribe**: `/brief` (o "quiero rediseñar la home")
**Debería**: entrevistarte **sin tecnicismos**, con opciones cerradas: tipo de negocio, a quién va,
qué debe hacer el visitante, dos o tres webs que te gusten. Si ya existe un brief, te lo resume y
pregunta si lo repasáis.
**Mira**: que no te pregunte nada técnico y que no empiece a diseñar sin preguntarte antes.

### Prueba 3 — Dos maquetas antes de construir
**Escribe**: `/propuestas home`
**Debería**: proponer primero la estructura (qué va en cada sección) para que la apruebes, y después
**dos maquetas HTML distintas** que puedes abrir en el navegador. Las referencias que cite deben ser
del sector del cliente, no siempre Stripe o Apple.
**Mira**: que las maquetas **no huelan a IA** (nada de "Agenda abierta este mes", numeración "02 —
Trabajos" ni métricas inventadas) y que te enseñe cada sección y te pregunte antes de seguir.

### Prueba 4 — Efectos y formas
**Escribe**: "pon un separador de onda entre el hero y la siguiente sección y un blob detrás de la foto"
(o `/efecto marquee`, `/efecto parallax`)
**Debería**: tirar del catálogo de 79 efectos con la receta concreta, con versión para
reduced-motion y sin cargar librerías que no hacen falta.
**Mira**: que use CSS moderno cuando basta, y que no llene la página de efectos (uno memorable por página).

### Prueba 5 — Los muros
Pídele, uno a uno:
- "añade un console.log para depurar esto" → **bloqueado**
- "pon it.only en este test para ir más rápido" → **bloqueado**
- "haz deploy a producción con netlify deploy --prod" → **bloqueado** hasta tu aprobación explícita
- "pon un badge de 'Agenda abierta este mes' en el hero" → **bloqueado** (cliché de web hecha con IA)
- "escribe la API key de Stripe directamente en el código" → **bloqueado**
**Mira**: que cada bloqueo explique el motivo y qué hacer en su lugar.

### Prueba 6 — Backend: recetas, no improvisación
**Escribe**: "los usuarios duplican pedidos al hacer doble clic" o "monta el webhook de Stripe"
**Debería**: usar la receta concreta (idempotencia, bloqueos, verificación de firma, reintentos) con
las prácticas de **la versión real** de vuestro framework.
**Mira**: que no proponga código de otra versión de Laravel o de Next distinta a la del proyecto.

### Prueba 7 — Plan y seguimiento
**Escribe**: `/plan` con una feature real ("sistema de reservas con recordatorio por email")
**Debería**: crear `senzu/plan/PLAN.md` con fases entregables y tareas pequeñas; cada tarea indica qué skill
usar y cómo se verifica. Después, `/siguiente` ejecuta la siguiente tarea.
**Mira**: que al terminar cada tarea deje una entrada en `senzu/devlog/` (qué se hizo, cómo se verificó).

### Prueba 8 — No da nada por hecho
Tras cualquier cambio de código o de interfaz, intenta que dé la tarea por terminada.
**Debería**: negarse a cerrar hasta pasar build, lint y tests (`/verificar`) y, si tocó la interfaz,
revisarla **en móvil primero** con capturas (375 px, 768 px y 1440 px).
**Mira**: el informe de verificación con veredicto APTA o NO APTA.

### Prueba 9 — Emails y SEO (bonus)
- "maqueta el email de bienvenida" → email compatible con Gmail, Outlook e iPhone, con versión en
  texto plano y checklist de pruebas.
- "mejora el SEO de la home" → revisión on-page con checklist.

## 4. Qué valorar

| Pregunta | Si la respuesta es sí, está funcionando |
|---|---|
| ¿Tuviste que decirle qué skill usar? | No debería hacer falta |
| ¿Te preguntó antes de diseñar o de tocar tu configuración? | Sí, siempre |
| ¿Intentó algo peligroso y se le paró? | Sí, con explicación |
| ¿Cerró alguna tarea sin verificar? | No debería poder |
| ¿El diseño parece de plantilla o de IA? | No debería (y si lo parece, es feedback valioso) |

## 5. Dar feedback

Cualquier cosa que no te guste —un cliché de diseño, una pregunta que sobra, algo que debió bloquear y
no bloqueó— pásasela a Peterson **con una captura**. Cada error real se convierte en una regla, un
muro o un caso de test del paquete, y a partir de ahí no vuelve a pasar en ningún proyecto.

## Chuleta de comandos

| Comando | Para qué |
|---|---|
| `/instalar` | Instalar o actualizar el paquete en el proyecto |
| `/brief` | Entrevista en llano antes de diseñar |
| `/propuestas` | Estructura aprobable + dos maquetas A/B |
| `/design-system` | Generar el sistema de diseño (colores, tipografía, iconos) |
| `/efecto <nombre>` | Aplicar un efecto concreto del catálogo |
| `/revisar-ui` · `/repaso` | Revisar la interfaz (técnica o conversada contigo) |
| `/plan` · `/siguiente` | Planificar y avanzar tarea a tarea |
| `/verificar` | Build, lint, tests y móvil antes de cerrar |
| `/adoptar` | Sellar las convenciones de un proyecto existente |
| `/lanzar` · `/desplegar` | Checklist de lanzamiento y deploy con red de seguridad |

### Desde la terminal (mantenimiento)

| Quiero… | Comando |
|---|---|
| Traer la última versión del plugin | `claude plugin marketplace update senzu` |
| Ver qué plugins tengo | `claude plugin list` |
| Ver qué trae el plugin y cuántos tokens cuesta | `claude plugin details senzu-all@senzu` |
| Desinstalarlo | `claude plugin uninstall senzu-all@senzu` (con `--scope` si no era `user`) |
| Actualizar un proyecto | `node <repo>/tools/init.mjs --path <proyecto>` o `/instalar` dentro de Claude |
| Añadir animación y 3D | `<repo>\tools\sync.ps1 -Path <proyecto> -Bundle core-3d-animation` |
| Hooks de git en el proyecto | `<repo>\tools\sync.ps1 -Path <proyecto> -GitHooks` |

Más detalle: [USO.md](../USO.md) (día a día) · [docs/skills.md](skills.md) (las 41 skills) ·
[docs/hooks.md](hooks.md) (todos los muros) · [REFERENCIA.md](../REFERENCIA.md) (todo en una página).
