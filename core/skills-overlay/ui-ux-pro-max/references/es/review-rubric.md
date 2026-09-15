# Rúbrica de revisión de UI existente

Puntúa cada dimensión de 1 (mal) a 5 (excelente). Documenta evidencia (captura, ruta del archivo,
línea). Prioriza los cambios por impacto × esfuerzo y propón 3-5 acciones concretas.

| # | Dimensión | Qué mirar | Señales de 1-2 | Señales de 5 |
|---|---|---|---|---|
| 1 | Jerarquía | ¿Se entiende en 5 s qué es y qué hacer? | Todo del mismo peso; varios CTAs primarios | Un foco claro por vista, escala tipográfica evidente |
| 2 | Consistencia | Botones, radios, sombras, espaciados iguales en todo | 4 tamaños de botón distintos, radios mezclados | Tokens únicos; componentes reutilizados |
| 3 | Color | Paleta acotada, semántica, contraste | Hex sueltos, > 2 acentos, texto gris claro | ≤ 1 primary + 1 accent + neutros; 4.5:1 |
| 4 | Tipografía | ≤ 2 familias, escala, medida, line-height | 3+ familias, párrafos de 120 caracteres | Pairing coherente, `max-w-prose`, 1.5 lh |
| 5 | Espaciado | Ritmo vertical, agrupación (Gestalt) | Márgenes arbitrarios, secciones pegadas | Escala 4/8 constante, secciones respiran |
| 6 | Estados | hover/focus/loading/empty/error | Solo happy path, sin foco visible | Todos los estados diseñados |
| 7 | Accesibilidad | Semántica, teclado, ARIA, alt | `div` clicables, emojis-icono, sin labels | Lighthouse a11y ≥ 95, Tab completo |
| 8 | Responsive | 375–1440, tablas, imágenes, nav | Scroll horizontal, texto cortado | Fluido, container queries donde aporta |
| 9 | Rendimiento | LCP, CLS, fuentes, imágenes, JS | Imágenes 3 MB, 5 fuentes, CLS visible | LCP < 2.5 s, CLS < 0.1, lazy correcto |
| 10 | Copy y contenido | Claridad, CTAs, errores útiles | Lorem ipsum, "Enviar", "Error" | Verbo + beneficio; errores accionables |

## Plantilla de informe
```
## Revisión UI — <vista> — <fecha>
Puntuación: J4 C2 Co3 T3 E2 St1 A2 R3 P3 Cp3  → 26/50

Top acciones (impacto/esfuerzo):
1. [alto/bajo] Unificar botones en un componente <Button> con tokens (afecta 14 archivos).
2. [alto/medio] Añadir estados loading/empty a /invoices (tabla).
3. [alto/bajo] Sustituir emojis por Phosphor icons con aria-hidden.
4. …
Evidencia: capturas en devlog/<fecha>/ y rutas de archivo.
```
