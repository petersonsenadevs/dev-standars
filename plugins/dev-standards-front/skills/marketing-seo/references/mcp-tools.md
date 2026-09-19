# MCPs de analítica y marketing: operar los datos con agentes de IA

Verificado 2026-09-19. La idea: el agente LEE los datos (GA4, Search Console, PostHog…) y diagnostica
o propone en lenguaje natural; los cambios en la web siguen el flujo normal (plan → cambio →
verificación). Los MCP son mayormente de lectura — perfecto: nadie quiere que una IA borre audiencias.

## Los que existen (y cuáles usar)

| MCP | Qué da al agente | Estado |
|---|---|---|
| **Google Analytics (GA4) — OFICIAL de Google** | Cuentas/propiedades, informes estándar y en tiempo real, funnels, dimensiones custom. **Solo lectura.** | github.com/googleanalytics/google-analytics-mcp (docu en developers.google.com/analytics/devguides/MCP). Necesita credenciales de Google Cloud (ADC): sigue su README |
| **PostHog — OFICIAL, alojado** | Product analytics, funnels, retención, feature flags, session replays, SQL | Remoto en `https://mcp.posthog.com/mcp` — sin instalar nada, se añade con la API key de PostHog |
| Search Console (comunidad) | Consultas, impresiones/CTR, indexación — el complemento natural del SEO | Varios servers comunitarios; revisa mantenimiento y permisos antes de dar acceso |
| Matomo | Informes de Matomo con permisos capados por el admin (plugin MCP propio) | Para clientes que huyen de Google |
| Plausible | Stats API (requiere plan Business) | Simple pero de pago para API |
| **SE Ranking** (¡ya lo tienes como conector en claude.ai!) | Posiciones, auditoría SEO, keywords, competencia | Conector de claude.ai: actívalo con su login desde la app |
| **Meta Ads** (también en tus conectores de claude.ai) | Campañas, resultados, audiencias de Meta | Ídem |
| Apollo (en tus conectores) | Prospección/outbound B2B | Ya conectado en esta cuenta |

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
