# Adoptar convenciones de un proyecto existente (/adoptar)

Índice: 1 Cuándo · 2 Qué analizar · 3 Entrevista · 4 Salida (conventions.md + conventions.json) ·
5 Inmutabilidad · 6 Conflictos con dev-standards

## 1. Cuándo
- Proyecto existente/heredado (de otro equipo o de antes de dev-standards) con un estilo propio marcado.
- Objetivo: que el agente escriba código **indistinguible del que ya hay**, no "su" estilo. Una convención
  fea pero consistente gana a una bonita que rompe la consistencia.
- Se ejecuta UNA vez por proyecto (comando `/adoptar`); se re-ejecuta solo si el usuario decide cambiar convenciones.

## 2. Qué analizar (evidencia, no intuición)
Lee esto y toma notas con ejemplos literales (archivo:línea):
- **Configs primero** (verdad declarada): `.editorconfig`, eslint/prettier/biome, `pint.json`/`phpcs`,
  `phpstan/larastan`, `tsconfig` (strict?, paths), `composer.json`/`package.json` (scripts, versiones).
- **3–5 archivos por capa** (los más recientes, no los más viejos): controllers/handlers, modelos/entidades,
  servicios, componentes de UI, un test. En cada uno: naming (clases, métodos, variables, archivos, tablas y
  columnas), estructura de carpetas, imports (alias `@/` u rutas relativas), manejo de errores, formato de
  respuesta API (envelope? códigos?), validación (FormRequest vs inline; zod vs manual), inyección de
  dependencias, idioma de nombres y comentarios (¡ES o EN!).
- **Front**: CSS (Tailwind / BEM / CSS Modules / styled), librería de componentes, gestión de estado,
  cómo se nombran y organizan los componentes (`PascalCase.vue`? carpetas por feature?).
- **Tests**: framework, ubicación (`tests/` espejo vs junto al código), naming (`it('...')` en qué idioma), factories.
- **Git**: `git log --oneline -30` — idioma y formato de los mensajes (¿ya usan Conventional?), tamaño de commits.

## 3. Entrevista (máx. 5 preguntas)
Pregunta SOLO lo ambiguo o contradictorio (el resto se deduce de la evidencia), siempre con propuesta:
"Veo X en unos sitios e Y en otros: ¿cuál fijamos? Propongo X (mayoría / más reciente)". Típicas:
convención dominante cuando hay mezcla, idioma oficial del código, si lo nuevo debe seguir el patrón viejo
o hay migración en curso (p. ej. Options API → Composition), y qué partes del código NO tocar.

## 4. Salida: dos archivos en la raíz
**`conventions.md`** (humano, fuente de verdad): secciones Naming · Estructura · Backend · Front · Tests ·
Git e idioma · Zonas intocables. Cada convención = regla + ejemplo real del proyecto. Encabezado obligatorio:

```markdown
# Convenciones del proyecto (adoptadas con /adoptar)
<!-- dev-standards:inmutable -->
Analizado el YYYY-MM-DD sobre <n> archivos. Estas convenciones GANAN a las preferencias de dev-standards.
```

**`conventions.json`** (ejecutable, lo lee el hook `conventions-guard` en cada edición): reglas de veto
sobre lo que se INTRODUCE (mismo motor que code-hygiene: lo viejo no bloquea; `dev-standards-allow` escapa una línea).

```json
{
  "_sello": "dev-standards:inmutable",
  "_generado": "/adoptar YYYY-MM-DD — no editar a mano; para cambiar: borrar y re-ejecutar /adoptar",
  "rules": [
    { "files": "\\.(ts|tsx|vue)$", "forbid": "\\binterface\\s+\\w", "why": "este proyecto tipa con 'type', no 'interface'" },
    { "files": "\\.php$",          "forbid": "\\$request->validate\\(", "why": "la validacion va en FormRequests, no inline" },
    { "files": "\\.(tsx|vue)$",    "forbid": "style=\\{\\{|style=\"",   "why": "sin estilos inline: Tailwind/tokens del proyecto" }
  ]
}
```
Solo convierte en regla lo **regexeable sin falsos positivos** (3–8 reglas); el resto vive en conventions.md.
`files` y `forbid` son regex (sintaxis JS/.NET compatible, sin `(?i)` inline: ya es case-insensitive).

## 5. Inmutabilidad
- El sello `dev-standards:inmutable` hace que `protect-files` bloquee editar ambos archivos: ni el agente
  ni un despiste los degradan. `conventions-guard` además bloquea código que viole las reglas ejecutables.
- Cambio legítimo: el usuario lo pide explícitamente → borrar los archivos (`rm conventions.json conventions.md`)
  y re-ejecutar `/adoptar` (o los edita él a mano). Documentar el cambio y el porqué en el devlog.

## 6. Conflictos con dev-standards
- **La convención del proyecto GANA** a las preferencias de dev-standards (naming, estructura, estilo, idioma).
- **EXCEPTO los muros de seguridad e higiene**, que aplican siempre: secretos fuera del código, nada
  destructivo sin aprobación, sin `console.log`/`dd()` nuevos, Conventional Commits ≤72 sin co-autores.
  Si el proyecto commitea distinto, dilo en la entrevista y pacta con el usuario qué formato fijamos.
