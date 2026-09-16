# Caja de herramientas: recursos prácticos de diseño

Recursos para USAR durante el trabajo (generar, comprobar, producir assets). Complementa a
`inspiration.md` (dónde mirar) y `fonts-icons.md` (qué elegir). Regla: la herramienta genera el punto
de partida; el resultado se adapta a los tokens del proyecto y se documenta en MASTER.md.

## Color y contraste
| Herramienta | Para qué |
|---|---|
| realtimecolors.com | Probar paleta completa sobre una web real (texto/fondo/primario/acento), claro y oscuro |
| huemint.com | Paletas generadas por contexto de uso (brand, gradiente, ilustración) |
| coolors.co | Iterar rápido una paleta; bloquear colores de marca y variar el resto |
| uicolors.app | Generar la escala 50-950 de Tailwind desde UN hex de marca |
| webaim.org/resources/contrastchecker | Verificar 4.5:1 / 3:1 (obligatorio antes de entregar) |
| oklch.com | Ajustar colores en OKLCH (aclarar/oscurecer sin ensuciar el tono) |

## Tipografía
| Herramienta | Para qué |
|---|---|
| typescale.com | Generar la escala tipográfica (ratio 1.2-1.333) y copiar los rem |
| fontjoy.com / fontpair.co | Probar pairings si los de `fonts-icons.md` no encajan |
| modernfontstacks.com | Stacks del sistema (proyectos sin fuente web: rendimiento máximo) |
| wakamaifondue.com | Inspeccionar qué pesos/ejes trae un archivo de fuente variable |
| gwfh.mranftl.com (google-webfonts-helper) | Self-host de Google Fonts (RGPD/CLS) |

## Fondos, formas y texturas
| Herramienta | Para qué |
|---|---|
| haikei.app | Blobs, olas, layered peaks en SVG (separadores de sección, fondos de hero) |
| fffuel.co | Colección de generadores SVG (ruido, esquinas, patrones, gradientes animados) |
| heropatterns.com | Patrones SVG sutiles de fondo (repetibles, un color) |
| pattern.monster | Más patrones SVG parametrizables |
| grainy-gradients (css-tricks) / noice.site | Gradiente + grano (evita el banding, da textura "premium") |
| getwaves.io | Olas SVG rápidas |

## Sombras, gradientes y detalles CSS
| Herramienta | Para qué |
|---|---|
| shadows.brumm.af | Sombras suaves en capas (mejor que un box-shadow duro) |
| open-props.style | Valores de referencia (sombras, easings, gradientes) aunque no uses la librería |
| easings.net + cubic-bezier.com | Elegir y ajustar curvas de animación |
| clip-path maker (bennettfeely.com/clippy) | Recortes de sección/imagen |
| animista.net | Micro-animaciones CSS de partida (ajustar duración/easing a 150-300ms) |

## Imágenes y media
| Herramienta | Para qué |
|---|---|
| unsplash.com / pexels.com | Fotos de stock; SIEMPRE mejor foto real del cliente — el stock se nota |
| squoosh.app | Comprimir a WebP/AVIF a mano cuando el build no lo hace |
| svgomg (jakearchibald.github.io/svgomg) | Optimizar SVG (logos, iconos) antes de commitear |
| shots.so / mockuuups.studio | Mockups de producto (screenshot en dispositivo) para heros y OG |
| remove.bg | Recortar fondo de fotos de equipo/producto |
| unDraw / Storyset / Popsy | Ilustraciones recolorables al primario (empty states, 404) |

## Entrega y SEO técnico
| Herramienta | Para qué |
|---|---|
| realfavicongenerator.net | Favicon + manifest + iconos de plataforma desde un SVG |
| og-playground (vercel) / previewhub | Diseñar y previsualizar la imagen OG (1200×630) |
| schema.org + validator.schema.org | JSON-LD (LocalBusiness, Service, FAQPage, Product) y su validación |
| pagespeed.web.dev | Core Web Vitals sobre la URL real (LCP/CLS/INP) |
| responsively.app | Ver varios viewports a la vez en desarrollo (complemento de ui-verify, no sustituto) |

## Reglas de uso
1. Nada de recursos con licencia dudosa: verifica licencia comercial (fotos, fuentes, ilustraciones) antes de usarlas en un cliente.
2. Todo lo generado (paleta, escala, sombras) acaba como **tokens** en el proyecto, no como valores pegados sueltos.
3. No cargues librerías por un solo efecto: si un generador da el SVG/CSS, incrústalo estático.
4. Las imágenes pasan por compresión (WebP/AVIF) y llevan dimensiones + `alt`; el stock se documenta como provisional si el cliente debe aportar fotos reales.
