# core/skills-vendor

Skills de terceros copiadas tal cual por `tools/vendor.ps1` (ver `VENDOR.json` para repo/commit/fecha).

- **NO editar a mano**: se sobrescribe en cada actualizacion. La capa propia (espanol, perfiles de stack, plantillas)
  vive en `core/skills-overlay/<skill>/` y se copia encima al renderizar un proyecto.
- Si el overlay trae `SKILL.md`, el original se instala como `SKILL.upstream.md`.
- `data/stacks/<stack>.extra.csv` del overlay se anexa al `<stack>.csv` upstream al renderizar.
- Licencias: cada skill incluye `LICENSE.upstream` (MIT en ambos repos).