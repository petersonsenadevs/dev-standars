# Verificación en navegador — pasos con Chrome MCP

## Índice
- [Preparación](#preparación)
- [Responsive](#responsive)
- [Dark mode](#dark-mode)
- [Consola y red](#consola-y-red)
- [Accesibilidad con axe](#accesibilidad-con-axe)
- [Interacción](#interacción)
- [Plantilla de informe](#plantilla-de-informe)

Los nombres exactos de herramientas dependen del cliente; en Claude Code con `claude-in-chrome` son
`mcp__claude-in-chrome__*`. Carga primero las que vayas a usar en UNA sola búsqueda de herramientas:
`tabs_context_mcp, tabs_create_mcp, navigate, resize_window, computer, read_console_messages, read_network_requests, javascript_tool`.

## Preparación
1. `tabs_context_mcp` para ver pestañas; crea una nueva (`tabs_create_mcp`) — no reutilices pestañas del usuario.
2. `navigate` a la URL objetivo; espera a que cargue (screenshot de control con `computer`).
3. Si la app no corre: arranca el comando `dev` del stack en background y reintenta.

## Responsive
Para cada ancho (alto 900): `resize_window` a 375, 768 y 1440 → screenshot con `computer` (pantalla completa y, si la
página es larga, tras hacer scroll a mitad y al footer). Busca: scroll horizontal (aparece barra inferior), textos
cortados o montados, imágenes deformadas, botones que rompen en 2 líneas, elementos que saltan (CLS).

## Dark mode
- Si la app tiene toggle: haz clic con `computer` y captura 375 y 1440.
- Si va por `prefers-color-scheme`: `javascript_tool` no puede cambiar la media query del SO; usa el toggle de la app o,
  si expone la clase, `document.documentElement.classList.add('dark')` y anota que fue forzado.
- Revisa contraste de textos `muted` y bordes de inputs en oscuro (los fallos típicos).

## Consola y red
- `read_console_messages` (filtra con `pattern` si hay ruido): cero errores; los warnings se listan.
- `read_network_requests`: sin 4xx/5xx ni assets 404; anota pesos anómalos (> 1 MB en una imagen).

## Accesibilidad con axe
Con `javascript_tool`, inyecta y ejecuta axe-core (una sola llamada; espera el resultado):

```js
const s = document.createElement('script');
s.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
document.head.appendChild(s);
await new Promise(r => s.onload = r);
const res = await axe.run(document, { resultTypes: ['violations'] });
console.log('[ui-verify] axe: ' + JSON.stringify(res.violations.map(v => ({
  id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target?.[0] }))));
```
Lee el resultado con `read_console_messages` (`pattern: "\\[ui-verify\\]"`). Ordena por impact (critical → minor).
Complemento manual: exactamente un `h1` (`document.querySelectorAll('h1').length`), foco visible tabulando (captura
tras 3-4 Tab con `computer`), `Esc` cierra el modal abierto.

## Interacción
- Hover y focus en el CTA principal (captura de cada estado). Navegación principal clicable.
- Un formulario: envía vacío → el error aparece junto al campo, con foco en el primero. NO envíes datos reales.

## Plantilla de informe
```
## ui-verify — <url> — <fecha>
| Vista | 375 | 768 | 1440 | Dark |
|---|---|---|---|---|
| <home> | OK | OK | texto cortado en hero | contraste muted 3.2:1 |
Axe: 0 critical · 2 serious (link-name ×3, color-contrast ×1) · consola: limpia · red: 1×404 (favicon)
Veredicto: APTA con menores — acciones: 1) … 2) …
Capturas: <rutas>
```
