# Logos de Senzu — cómo se generan y cómo se elige

Cuatro briefs, uno por tipo. Cada uno tiene **tres direcciones** (A, B, C) con su prompt listo:

| Archivo | Qué | Dónde se usa |
|---|---|---|
| [01-simbolo.md](01-simbolo.md) | Icono solo | favicon, avatar de GitHub, icono del plugin |
| [02-logotipo.md](02-logotipo.md) | La palabra «senzu» | README, pie, textos |
| [03-combinado.md](03-combinado.md) | Símbolo + palabra | cabecera de la web, portada del README |
| [04-mascota.md](04-mascota.md) | Personaje | portada de la web, 404, redes |

Orden recomendado: **símbolo primero** (el combinado depende de él), luego logotipo, combinado y mascota.

## Generar
Con la skill `image-gen` (generación nativa del host: app de ChatGPT/Codex) o con `graphic-design`
(Gemini, necesita `GEMINI_API_KEY`). Por cada dirección, 4 variantes:
```bash
py -3 <skills-dir>/graphic-design/scripts/logo/generate.py --brand "Senzu" \
  --prompt "<prompt de la dirección>" --batch 4 --pro \
  --output-dir web/senzu/design-system/senzu/logos/generados/<tipo>/<dirección>
```
La IA da bocetos: **el logo final se redibuja en SVG** (vector limpio, sin texto rasterizado).

## Elegir (rondas)
Las variantes se enseñan con la plantilla de rondas (`ui-ux-pro-max references/es/plantilla-maqueta.html`):
cada logo es una pieza votable (`A·N1`, `B·N2`…; categoría N = iconos). Lo aprobado va a «Fijado» en
`../gustos.md`, lo rechazado a «No», y la ronda siguiente explora solo lo abierto con algo nuevo
(`/ronda`).

## Criterios para todos
1. Se reconoce a 16 px (favicon) y funciona en **un solo color**, en negro y en blanco.
2. Guiño sutil, nunca copia (ver `../marca.md` → «Lo que NO»).
3. Sin texto dentro del símbolo; sin degradados imprescindibles; formas simples.
4. Distinto del resto de herramientas de IA (nada de chispas, cerebros ni robots).
