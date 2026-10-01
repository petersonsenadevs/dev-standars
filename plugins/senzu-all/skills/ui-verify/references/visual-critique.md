# Crítica visual de capturas: de "no está roto" a "está bien"

`verify-ui.mjs` detecta lo objetivo (overflow, consola, tap targets). Esto es el paso siguiente y es
OBLIGATORIO para el veredicto APTA: **abrir las capturas** (`senzu/ui-verify/*.png` con Read, o el navegador)
y evaluarlas como diseñador. Una página puede pasar el script y seguir viéndose amateur.

## Protocolo (por cada captura: 375 primero, luego 1440)
Puntúa cada eje 1-5 mirando la imagen (no el código). Un 1-2 en cualquiera = corregir antes de entregar.

1. **Jerarquía**: ¿se ve en 3 segundos qué es lo más importante? ¿Un solo protagonista por pantalla?
   (Síntoma de fallo: todo del mismo tamaño, tres cosas gritando a la vez.)
2. **Aire**: ¿los bloques respiran o está apretado? ¿El espaciado es consistente (misma escala) o
   cada sección tiene márgenes distintos?
3. **Alineación**: ¿todo cae en una retícula (bordes izquierdos alineados, mismo ancho de contenedor) o
   hay elementos "bailando"? Mira los bordes con atención: es lo que más delata.
4. **Contraste percibido**: más allá del 4.5:1 medido — ¿el texto sobre imagen se lee de verdad?
   ¿El CTA destaca sobre TODO lo demás de su pantalla?
5. **Consistencia**: ¿mismos radios, misma familia de sombras, mismo estilo de iconos y botones en toda
   la captura? ¿O hay un botón "de otra web"?
6. **Densidad móvil (solo 375)**: ¿el above-the-fold móvil dice quién eres + qué haces + qué hacer
   (CTA/tel)? ¿Los textos largos parten bien, sin ríos ni palabras cortadas feas?
7. **Fotos e imágenes**: ¿tamaños coherentes, mismo tratamiento (radio/filtro), sin estirar ni pixelar?
   ¿Alguna imagen IA con defectos (manos, texto) que se coló?
8. **Test de portada**: ¿la distinguirías de una plantilla genérica? ¿Hay UNA decisión memorable
   (checklist de `ui-ux-pro-max §references/es/inspiration.md` §5)?
9. **Olor a IA** (`ui-ux-pro-max §references/es/anti-ia.md`): ¿aparece ALGO de la lista negra?
   Badge de disponibilidad con puntito, numeración de secciones ("02 — TRABAJOS"), meta-línea de
   servicios con interpuntos en el hero, "trusted by" gris, métricas inventadas, gradiente violeta
   por defecto, marquee de tecnologías, tres cards clónicas por sección. UNA sola de estas = nota 1-2
   en este eje (y por tanto NO se entrega hasta limpiarla).

## Cómo reportar
Tabla eje×viewport con nota y UNA frase por fallo señalando dónde ("375: el tel del hero queda pegado
al borde"), + captura o coordenada aproximada. Correcciones: aplica las de nota 1-2, re-captura y
re-evalúa (máx 2 iteraciones; si no converge, enseña ambas versiones al usuario y que elija).

## Veredicto
- **APTA**: todos los ejes ≥ 3 y los de nota 3 anotados como mejora futura (tarjeta X-Tn).
- **APTA con menores** / **NO APTA**: igual que en el informe de ui-verify, con las notas de esta rúbrica.
El veredicto visual va JUNTO al del script en devlog: los dos son la verificación de UI completa.
