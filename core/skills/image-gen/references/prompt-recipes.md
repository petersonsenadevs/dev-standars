# Recetas de prompt por tipo de imagen

Estructura universal del prompt (rellena y elimina lo que no aplique):
**[sujeto preciso] + [estilo/medio] + [iluminación] + [cámara/encuadre] + [paleta desde tokens] +
[fondo] + [mood del design system] + [lo que NO quieres]**. En inglés rinde mejor en todos los modelos.
Guarda cada prompt usado en `design-system/<slug>/prompts.md` (la serie entera reutiliza los mismos
descriptores de luz/paleta/estilo: así todas las imágenes parecen de la misma sesión).

## 1. Producto flotante / levitación (el hero de e-commerce moderno)
La clave investigada: **conservar la geometría exacta del producto** y **anclarlo con una sombra suave
debajo** — un objeto flotando sin sombra parece barato; con sombra suave parece premium.
```
Professional product photography of [PRODUCTO con material y color], floating in mid-air at a slight
[15-degree] tilt, soft studio lighting from upper left, gentle soft shadow directly below grounding the
object, clean [COLOR DE FONDO desde tokens] seamless background, shot on 85mm lens, shallow depth of
field, high detail, commercial photography style. No text, no watermark, no hands.
```
- Variante "explosión ordenada": `product deconstructed into floating parts, evenly spaced, exploded view` (ferretería/tech).
- Variante ingredientes/materiales: `surrounded by floating [ingredientes] gently suspended, motion frozen`.
- Fondo transparente para componer en la web: `--background transparent` (openai) y compón la sombra en CSS
  (`filter: drop-shadow(0 24px 24px rgb(0 0 0 / .25))`) — así la imagen sirve en claro Y oscuro.

## 2. Hero background acorde al design system
```
Abstract [SOFT GRADIENT MESH / topographic lines / flowing organic shapes] background, [COLORES: "deep
green #046a53 flowing into dark charcoal #101920 with subtle mint #2fbf9a accents"], very subtle grain,
smooth studio quality, minimalist, lots of negative space on the [left] side for text, no objects,
no text, 16:9.
```
- El espacio negativo se pide en el lado donde irá el titular. Genera 3 variantes y elige EN el layout.
- Antes de generar: ¿lo resuelve la aurora CSS de `ui-ux-pro-max modern-look.md §4` gratis y en 0 KB? Si sí, no generes.

## 3. Render 3D (clay / glass / metal — el look "producto SaaS")
```
3D render of [OBJETO/ICONO conceptual], [soft clay / frosted glass / brushed metal] material,
[COLOR primario] with [COLOR acento] details, soft studio lighting with large diffused softbox,
subtle reflections, floating on [COLOR fondo] background with soft contact shadow, octane render style,
minimal composition, high resolution. No text.
```
- Serie de iconos 3D: mismo material+luz+ángulo en todos los prompts; solo cambia el objeto.
- Claymorphism para friendly; glass para tech/premium; metal para industrial (encaja con obra/reformas).

## 4. Mockup de dispositivo con la web dentro
Genera el DISPOSITIVO, no la pantalla: `modern laptop/phone mockup at 3/4 angle on [fondo], blank white
screen, soft shadows` → y compón TU screenshot real encima en HTML/CSS (la pantalla generada por IA
siempre tiene UI inventada). Alternativa sin IA: shots.so / mockuuups (resources-toolbox).

## 5. Fotos "de ambiente" del sector (cuando no hay fotos reales AÚN)
```
Documentary style photography, [ESCENA: "construction site interior, worker in safety gear moving
debris into container"], natural window light, candid, shot on 35mm, muted realistic colors matching
[PALETA], slight motion blur on action. No faces clearly visible, no logos.
```
- REGLA DURA: esto es un recurso provisional marcado en el devlog; las obras/equipo del cliente se
  fotografían de verdad. Sin caras reconocibles evitas tanto el uncanny valley como problemas de imagen.

## 6. Texturas y patterns tileables
```
Seamless tileable texture of [MATERIAL: raw concrete / linen / brushed steel], top-down flat lighting,
even illumination, no shadows at edges, subtle, low contrast, [tinte de paleta], 1:1.
```
- Pide `seamless tileable` y pruébala repetida (background-repeat); si la costura se nota, regenera.
- Muchas veces la gana el SVG generado (heropatterns/fffuel, 2 KB): decide por peso.

## 7. Ilustración de marca (serie coherente)
```
Flat vector-style illustration of [ESCENA], [geometric / hand-drawn / isometric] style, limited palette
of exactly [3-4 hex de tokens], [COLOR fondo] background, consistent 2px line weight, minimal details,
same character proportions across series. No gradients, no text.
```
- Para vector real (SVG editable) el modelo adecuado es Recraft; gpt-image/FLUX dan PNG con estilo vector.

## 8. Edición de imagen existente (gpt-image / Nano Banana)
Ambos editan con instrucciones: "remove the background completely", "extend the background to 16:9
keeping the product untouched", "relight this product photo with soft studio lighting", "change the
background to [COLOR] keeping the exact product geometry". Para retoques de fotos REALES del cliente
(quitar un cubo de basura del fondo) es legítimo; cambiar el trabajo/resultado mostrado NO lo es.

## Errores que delatan imagen IA (revisa antes de usar)
Manos y dedos · texto/letreros dentro de la imagen · reflejos imposibles · costuras en patterns ·
demasiada perfección (añade `slightly imperfect, natural` a fotos "reales") · estilos mezclados entre
imágenes de la misma página (usa la misma receta para toda la serie).
