# rules/ — reglas aprendidas de este stack

Carpeta EXTENSIBLE por cualquier agente. Cada `*.md` de aquí (salvo este README) se anexa
automáticamente al CLAUDE.md/AGENTS.md de los proyectos del stack al correr `sync.ps1`.

Protocolo para añadir una regla:
1. Un archivo por tema (`inertia-forms.md`, `imagenes.md`…), conciso: la regla + el porqué en 1-3 líneas
   + un ejemplo mínimo de bien/mal si aporta. Nada de ensayos.
2. Solo reglas GENERALES del stack aprendidas en proyectos reales (errores repetidos, convenciones del
   equipo). Lo específico de UN proyecto va en su devlog, no aquí.
3. Tras añadir/editar: `sync.ps1 -Path <proyecto>` en los proyectos donde quieras aplicarla, y commit
   en dev-standards con mensaje `docs(rules): ...`.
