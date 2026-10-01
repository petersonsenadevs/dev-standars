---
description: Entrevista de descubrimiento en lenguaje llano — para clientes que no saben el palabreo técnico
---

Uso: `/brief [tipo de negocio si ya se sabe, p. ej. "restaurante"]` — el argumento es opcional salvo que se indique lo contrario; si no llega, aplica el comportamiento por defecto de abajo.

Aplica `ui-ux-pro-max §references/es/brief-discovery.md` (modo descubrimiento §2b) para averiguar qué quiere
el usuario SIN tecnicismos:

0. **Mira qué hay ya**: si `senzu/plan/brief.md` tiene contenido real (no plantilla), o existe
   `senzu/design-system/*/BRAND.md` o `MASTER.md` o `gustos.md`, NO empieces de cero: resume en 3 líneas lo que
   ya está decidido y pregunta "¿lo repasamos/actualizamos o rehacemos el brief?". **Nunca re-preguntes lo
   que ya está escrito**. Máximo 5 preguntas por tanda, siempre con una propuesta para poder decir "ok".
1. Identifica el tipo de negocio (lo que el usuario escribió tras el comando o pregúntalo primero) y lee su bloque en
   `references/es/business-playbooks.md` + la base común.
2. Haz las preguntas de §2 UNA a una, en lenguaje llano, ofreciendo 2-3 opciones cerradas (usa AskUserQuestion
   si está disponible). Pide siempre 2-3 webs que le gusten. Nunca preguntes con términos técnicos: traduce tú
   con el glosario §3.
3. Propón la estructura de secciones del playbook adaptada a sus respuestas, y dos direcciones visuales A/B
   descritas en llano (§2b.3) apoyadas en `references/es/industry-rules.md`.
4. Con sus elecciones: escribe `senzu/plan/brief.md` (objetivo, audiencia, dirección elegida, checklist "Pide:" de
   contenido pendiente del cliente) y confirma el resumen en sus palabras.
5. Cierra ofreciendo generar el design system (`/design-system "<producto industria keywords>"`).
