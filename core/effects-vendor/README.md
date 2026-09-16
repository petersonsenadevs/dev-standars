# effects-vendor — código real de efectos, con licencia verificada

Repos completos vendorizados por `tools/vendor-effects.ps1` según `manifest.json`. Cada carpeta lleva
su `LICENSE` original + `ATTRIBUTION.md` (fuente, licencia, fecha). Todos MIT: usables en proyectos de
cliente manteniendo la atribución del archivo si se copia código sustancial.

| Carpeta | Qué hay | Cómo se usa |
|---|---|---|
| `uiverse-galaxy/` | ~3.800 elementos UI (Buttons/, Cards/, Checkboxes/, Forms/, Inputs/, loaders/, Notifications/, Patterns/), cada uno un HTML autocontenido | `Grep`/`Glob` por carpeta de tipo; copiar el patrón y **adaptarlo a los tokens del proyecto** (nunca pegar sus colores) |
| `vanta/` | Fuente de los 14 fondos animados WebGL de Vanta | Referencia al implementar `lightweight-3d-effects` |
| `codrops-*/` (6) | Demos completos MIT de Codrops: tipografía on-scroll, texto en movimiento, grid elástico, clip menu, rotaciones 3D, transición cinética | Leer el JS del demo al destilar la receta (protocolo effect-sources §3) |

Actualizar/añadir: editar `manifest.json` (el script verifica que el LICENSE del repo confirme la
licencia declarada; si no, lo manda a `_local/`, que está gitignorado) y ejecutar `tools/vendor-effects.ps1`.
