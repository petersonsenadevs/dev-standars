<!-- GENERADO por tools/build-docs.ps1 desde core/skills-registry.json, core/commands/, core/hooks/ y stacks/. NO editar a mano. -->

# Comandos slash

[← Volver al README](../README.md)

Atajos opcionales: hablar en llano activa lo mismo vía enrutador. `plan/siguiente/verificar/desplegar/adoptar`
se instalan SIEMPRE; el resto solo en stacks con perfil de front.

| Comando | Argumento | Qué hace |
|---|---|---|
| `/plan` | [descripción del proyecto o feature] | Crea o retoma el plan del proyecto (plan/PLAN.md) con la skill project-planner |
| `/siguiente` | [id de tarea opcional, p. ej. F1-T3] | Ejecuta la siguiente tarea del plan (task-protocol de project-planner) |
| `/verificar` |  | Verifica el proyecto tras los cambios — build, lint, types, tests y (si hay UI) móvil |
| `/desplegar` | [entorno u objetivo, p. ej. "producción" o "staging"] | Deploy con red — checklist PRE/DEPLOY/POST/ROLLBACK con evidencia y aprobación explícita |
| `/adoptar` | [notas opcionales, p. ej. "solo backend" o "el idioma oficial es inglés"] | Adoptar las convenciones de un proyecto existente y sellarlas como regla inmutable |
| `/auditar` | [área opcional, p. ej. "pagos", "API pública" o "antes de producción"] | Auditoría del backend y la arquitectura con pruebas — herramientas reales, evidencia por hallazgo, informe y plan |
| `/brief` | [tipo de negocio si ya se sabe, p. ej. "restaurante"] | Entrevista de descubrimiento en lenguaje llano — para clientes que no saben el palabreo técnico |
| `/design-system` | [producto/industria, p. ej. "saas facturación autónomos"] | Genera (o revisa) el design system del proyecto con ui-ux-pro-max |
| `/efecto` | <nombre del efecto> [dónde, p. ej. "marquee en el footer de logos"] | Aplica un efecto pro de frontend desde el catálogo (parallax, marquee, cursor, stacking…) |
| `/instalar` | [stack opcional: laravel, next, astro, vue-ts, nuxt, sveltekit, wordpress, node-api, python-langgraph] | Instala/actualiza dev-standards COMPLETO en este proyecto desde el plugin (clona el repo, detecta el stack y ejecuta init-project) |
| `/lanzar` | [url de preview/producción] | Checklist de lanzamiento — todo lo que se comprueba antes de publicar la web |
| `/propuestas` | [página, p. ej. "home" o "landing de escombros"] | Modo propuesta — blueprint aprobable + 2 maquetas A/B visuales antes de construir |
| `/refactor` | <objetivo, p. ej. "sacar la lógica de precios de OrderController"> | Refactor seguro — tests de caracterización primero, pasos pequeños verificados y mismo comportamiento demostrado |
| `/repaso` | [url o página, p. ej. "http://localhost:4321" o "la home"] | Sesión de revisión conversacional — repasamos la web juntos, sección a sección |
| `/revisar-ui` | [url o ruta de la vista, p. ej. http://localhost:5173 o Pages/Home.vue] | Audita la UI (rúbrica + verificación en navegador si hay Chrome disponible) |

### Flujos típicos
- **Proyecto nuevo con web**: `/brief` (entrevista en llano) → `/propuestas` (blueprint + maquetas A/B) →
  `/design-system` → construir con checkpoints → `/revisar-ui` → `/lanzar` → `/desplegar`.
- **Cualquier feature**: `/plan` → `/siguiente` (una tarjeta cada vez) → `/verificar` antes de cerrar.
- **Proyecto heredado**: `/adoptar` la primera sesión (analiza y sella sus convenciones) y después lo normal.
- **Efecto concreto** ("quiero un parallax/marquee/cursor"): `/efecto <nombre>` va directo al catálogo con receta y coste móvil.