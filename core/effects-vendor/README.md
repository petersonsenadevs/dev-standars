> **No se versiona** (274 MB): solo `INDEX.md`, este README y `manifest.json` van en git, para que el
> repo se clone rápido. Para tener el código: `tools/vendor-effects.ps1 -Missing`.

# effects-vendor — código real de efectos, con licencia verificada

Repos completos vendorizados por `tools/vendor-effects.ps1` según `manifest.json`. Cada carpeta lleva su
`LICENSE` original + `ATTRIBUTION.md` (fuente, licencia, fecha). Todos MIT: usables en proyectos de cliente
manteniendo la atribución si se copia código sustancial.

**Empieza por `INDEX.md`** (autogenerado): lista todo por categoría — cursores, botones-enlaces, texto,
scroll-layout, hover-imagen, menús, transiciones, galerías, componentes-ui (uiverse ~3.800 elementos,
whirl, css-loaders, fancy-components React), fondos (vanta) y extras. ~60 repos de demos de Codrops incluidos.

Reglas de uso:
1. Localiza la categoría en `INDEX.md` → entra en la carpeta → lee `index.html`/`js/` del demo.
2. **Adapta a los tokens del proyecto** (colores, fuentes, easings propios): nunca pegues el demo tal cual.
3. Pasa el efecto por el árbol F4 (reduced-motion, LCP, táctil) antes de darlo por bueno.
4. Si lo conviertes en receta reutilizable → protocolo de `front-activation/references/effect-sources.md` §3.

Actualizar/añadir: editar `manifest.json` (el script verifica el LICENSE real; si no confirma, va a `_local/`
gitignorado; `stripMedia` recorta imágenes/vídeo > 300 KB conservando el código) y ejecutar `tools/vendor-effects.ps1`.
