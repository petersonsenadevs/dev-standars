# Brief — Web y marca de Senzu

> Estado: **APROBADO 2026-10-02** (respuestas del usuario en el chat). Fuente de verdad para logos y web.

## Qué es
Senzu (antes dev-standards) es el estándar de trabajo de la agencia convertido en sistema para agentes
de IA: skills que se activan solas, muros que bloquean de verdad, memoria del proyecto y verificación
obligatoria, en Claude Code y Codex. El nombre es un guiño a la semilla que, con una sola, te recupera:
**instalas Senzu y el proyecto se pone en orden.**

## Para quién
- **Público**: cualquier dev o agencia que trabaje con agentes de IA (Claude Code, Codex, Cursor…).
- Nivel técnico medio-alto, pero la portada se entiende sin saber qué es un hook.
- Idioma: castellano (el producto es en castellano y es parte de lo que lo hace distinto).

## Objetivo de la web
1. Entender en 30 segundos qué hace y por qué es distinto (muros reales, no consejos).
2. Instalarlo en 2 minutos (plugin de Claude, Codex, instalador interactivo).
3. Consultar la referencia: skills, muros, comandos, stacks, memoria, rondas de diseño.
Acción principal: **instalar** (copiar el comando). Secundaria: ir al repositorio de GitHub.

## Decisiones del usuario
| Tema | Decisión |
|---|---|
| Alcance | Pública, solo la parte de producto. Nada interno de la agencia (skill de marca de la agencia, clientes, devlogs de proyectos). |
| Dragon Ball | **Guiño sutil**: la idea de la semilla que recupera, sin imitar el dibujo, los colores ni personajes de la serie. |
| Tono visual | Por decidir con **maquetas A/B** (/propuestas y /ronda): una técnica oscura y una editorial clara. |
| Logos | Explorar los cuatro: símbolo, logotipo, combinado y mascota. |

## Restricciones
- Contenido **generado del repositorio** (docs/, REFERENCIA.md, CHANGELOG.md, comandos y skills), nunca
  escrito a mano en la web: si el repo cambia, la web cambia (D-001).
- Stack: Astro + Starlight (documentación: buscador, menú, modo oscuro). Despliegue en Vercel desde
  GitHub; vistas previas por rama; producción solo con aprobación explícita (/desplegar).
- Nada de la lista negra anti-IA (badges de «agenda abierta», métricas inventadas, «trusted by»).
- Accesible (contraste 4.5:1, teclado), móvil primero, rápida (estática).

## Lo que trae cada uno
| Qué | Quién |
|---|---|
| Logos (generación y rondas de elección) | agente → usuario elige |
| Textos de la portada | agente, a partir del README → usuario aprueba |
| Capturas o GIF de los muros en acción | usuario (o agente con una sesión de demo) |
| Dominio | usuario (por decidir: subdominio de Vercel o propio) |

## Preguntas abiertas
- ¿Dominio propio (senzu.dev, senzu.es…) o el gratuito de Vercel de momento?
- ¿Se nombra a la agencia como autora en el pie?
