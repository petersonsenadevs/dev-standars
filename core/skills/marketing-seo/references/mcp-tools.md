# MCPs de analítica y marketing: operar los datos con agentes de IA

Verificado 2026-09-19. Dos modos: **leer** (GA4, Search Console, PostHog — diagnóstico e informes) y
**escribir en GTM** (crear tags, triggers y variables, organizar y versionar el contenedor — con
aprobación humana antes de publicar). Los cambios en la WEB siguen el flujo normal; los cambios en el
CONTENEDOR los puede ejecutar el agente vía MCP.

## Los que existen (y cuáles usar)

| MCP | Qué da al agente | Estado |
|---|---|---|
| **Google Analytics (GA4) — OFICIAL de Google** | Cuentas/propiedades, informes estándar y en tiempo real, funnels, dimensiones custom. **Solo lectura.** | github.com/googleanalytics/google-analytics-mcp (docu en developers.google.com/analytics/devguides/MCP). Necesita credenciales de Google Cloud (ADC): sigue su README |
| **GTM (Stape) — LECTURA Y ESCRITURA** | Crear/organizar tags, triggers, variables; auditar; versionar y publicar con aprobación | github.com/stape-io/google-tag-manager-mcp-server (alojado con OAuth o CLI local) |
| **PostHog — OFICIAL, alojado** | Product analytics, funnels, retención, feature flags, session replays, SQL | Remoto en `https://mcp.posthog.com/mcp` — sin instalar nada, se añade con la API key de PostHog |
| Search Console (comunidad) | Consultas, impresiones/CTR, indexación — el complemento natural del SEO | Varios servers comunitarios; revisa mantenimiento y permisos antes de dar acceso |
| Matomo | Informes de Matomo con permisos capados por el admin (plugin MCP propio) | Para clientes que huyen de Google |
| Plausible | Stats API (requiere plan Business) | Simple pero de pago para API |
| **SE Ranking** (¡ya lo tienes como conector en claude.ai!) | Posiciones, auditoría SEO, keywords, competencia | Conector de claude.ai: actívalo con su login desde la app |
| **Meta Ads** (también en tus conectores de claude.ai) | Campañas, resultados, audiencias de Meta | Ídem |
| Apollo (en tus conectores) | Prospección/outbound B2B | Ya conectado en esta cuenta |

## ESCRITURA: el agente crea y organiza el contenedor GTM

**Stape GTM MCP** (github.com/stape-io/google-tag-manager-mcp-server) envuelve la API completa de Tag
Manager: ~97 operaciones — lecturas de auditoría y **escrituras con aprobación** para crear tags,
triggers, variables, carpetas, versionar y publicar. Dos formas: server alojado por Stape con OAuth de
Google, o CLI local con tus credenciales (sigue su README para la config del .mcp.json).

Flujo correcto con el agente (pídelo en llano):
1. "Lee el plan de medición (`plan/brief.md` §Medición) y **monta el contenedor**": el agente crea las
   variables del dataLayer, los triggers sobre `data-track` y un tag GA4 por evento — con la convención
   de nombres de `analytics-gtm.md` (`GA4 - Evento - click_llamar`…), en un workspace nuevo.
2. "Audita este contenedor heredado y organízalo": listar tags muertos/duplicados, renombrar a la
   convención, mover a carpetas, pausar lo desconocido documentándolo.
3. El agente deja TODO en el workspace SIN publicar → tú lo revisas con Preview (Tag Assistant) y
   DebugView → solo entonces se publica la versión (con nombre y descripción).

Reglas duras de escritura: **nunca publicar sin tu aprobación explícita** (aunque el MCP lo permita);
acceso de edición SOLO al contenedor del cliente en cuestión; toda sesión de cambios acaba en una
versión nombrada (el historial de versiones es el git del contenedor y tu botón de deshacer).

Para escrituras en GA4 (marcar key events, dimensiones custom) el MCP oficial de Google es solo
lectura: se hace a mano en la UI (2 clics) o vía Admin API con script propio si se repite mucho.

## Cómo conectar en Claude Code (por proyecto)
En el `.mcp.json` del proyecto (dev-standards ya genera uno por stack; se le añaden servers):
```jsonc
{
  "mcpServers": {
    // GA4 oficial: instala el server según su README (Python + credenciales ADC de Google Cloud)
    "analytics": { "command": "uvx", "args": ["analytics-mcp"] },
    // PostHog: remoto alojado, sin instalación
    "posthog": { "type": "http", "url": "https://mcp.posthog.com/mcp", "headers": { "Authorization": "Bearer ${POSTHOG_API_KEY}" } }
  }
}
```
La clave va en variables de entorno, NUNCA commiteada. En claude.ai (web/desktop), SE Ranking y Meta Ads
se activan como conectores con su propio login — sin JSON.

## Flujos que esto habilita (pídelos en llano)
- **Informe mensual del cliente en 1 minuto**: "dame las conversiones del mes por fuente y compáralas
  con el anterior; escribe el email de resumen para el cliente" (con `measurement.md`: UN número, no un dashboard).
- **Diagnóstico SEO**: "consultas de Search Console con posición 5-15 y buen volumen → propón qué página
  reforzar y cómo" (cruza con `seo-onpage.md` §Medir).
- **Caza de fugas**: "¿qué página con tráfico tiene peor conversión? mira su formulario y proponme hipótesis".
- **Post-lanzamiento**: a los 30 días de `/lanzar`, "verifica que las conversiones del plan disparan y
  cuánto llevan" — cierra el círculo de measurement.md.
- **Auditoría de campañas**: con Meta Ads/SE Ranking, "¿qué campaña trae clics pero cero conversiones?".

## Reglas de uso con clientes
1. Acceso de SOLO LECTURA siempre que el MCP lo permita; cuentas del cliente, no de la agencia.
2. Los datos del cliente no salen de su contexto: no los pegues en otros proyectos ni en prompts ajenos.
3. Toda conclusión del agente se contrasta con el dato fuente antes de contársela al cliente (el agente
   cita qué informe/fechas usó).
4. Nada de decisiones automáticas sobre campañas con presupuesto sin aprobación humana explícita.
