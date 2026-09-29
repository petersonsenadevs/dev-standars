# Lista negra anti-IA: lo que delata que la web la hizo una máquina

Estos patrones aparecen en miles de landings generadas con IA y el cliente (y su competencia) los
reconoce. **Prohibidos por defecto en TODOS los proyectos** — solo entran si el USUARIO los pide
explícitamente por su nombre. Algunos además están bloqueados por hook (marcados ⛔).

## Los prohibidos

| Patrón | Por qué delata | Qué hacer en su lugar |
|---|---|---|
| ⛔ **Badge de disponibilidad** con puntito verde ("Agenda abierta este mes", "3 slots disponibles", "Disponible para proyectos") | Urgencia falsa; lo lleva media internet generada por IA | Nada, o una frase honesta en el contacto ("Respondemos en 24 h") |
| ⛔ **Numeración de secciones** ("01 — SOBRE", "02 — TRABAJOS") | El tic más reconocible del portfolio-IA | Encabezados con jerarquía tipográfica real; si hace falta guía, nav sticky o índice |
| **Meta-línea de servicios con interpuntos** en el hero ("WEBS · APPS · AGENTES DE IA") | Relleno decorativo que no comunica | El H1 dice QUÉ haces para QUIÉN; los servicios, en su sección con contenido real |
| **"Trusted by" con logos grises** (más aún si son inventados) | Prueba social falsa = confianza destruida | Solo logos REALES con permiso; si no hay, testimonios con nombre y cara, o nada |
| **Métricas infladas o inventadas** ("+500 proyectos", "98% satisfacción") | Nadie las cree y son indefendibles | Datos verificables del cliente o ninguno |
| **Gradiente violeta/azul por defecto** + glassmorphism genérico | La paleta "IA startup" nº 1 | La paleta sale del design system del CLIENTE, no del gusto del modelo |
| **Sparkles/cohetes** (✨🚀💡) y emojis como iconos | Ya vetado por regla dura | Iconos SVG del set fijado en el MASTER |
| **Copy hinchado**: "Elevamos tu marca al siguiente nivel", "Soluciones innovadoras 360" | Palabrería que no dice nada | `copywriting.md`: concreto, con el beneficio del cliente y sus palabras |
| **Marquee de logos de tecnologías** (React, Node, Figma girando) | Al cliente le da igual tu stack | Casos reales con resultado; el stack, en el footer si acaso |
| **Blobs/mesh gradients decorativos** de fondo en cada sección | Relleno visual sin intención | Aire, retícula y UNA decisión memorable (inspiration.md §5) |
| **Tres cards de features con icono+título+párrafo idénticas** clonadas en cada sección | Estructura plantilla | Varía el patrón por sección (bento, lista editorial, imagen+texto alternado) |
| **"Hecho con ❤️"** en el footer | Relleno | Crédito sobrio o nada |

## Cómo se hace cumplir (tres capas)
1. **Al construir**: esta lista es parte de la lectura de toda tarea de UI nueva; ante la duda, fuera.
2. **Hook** (⛔): `code-hygiene` bloquea los regexeables (frases de disponibilidad, numeración de
   secciones) al escribirse en archivos de front. Escape puntual: `dev-standards-allow` si el usuario
   lo pidió con su nombre — y anótalo en `gustos.md`.
3. **Crítica visual**: el eje 9 de `ui-verify §references/visual-critique.md` ("olor a IA") puntúa 1-2
   si aparece cualquiera de esta tabla → NO APTA hasta limpiarlo.

## Regla de referencias (el anti-"siempre Stripe")
Al proponer direcciones o citar ejemplos: las referencias salen de `inspiration.md` **filtradas por la
industria del cliente**, 2-3 DISTINTAS por dirección. Stripe, Linear, Apple, Notion, Airbnb y Vercel
están **vetadas como muletilla**: solo se citan si el usuario las nombra o si el proyecto ES de su
sector directo. Una clínica no necesita parecerse a un SaaS de pagos.
