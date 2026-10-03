# Física e impacto: objetos que caen, cristal que se rompe, intros y loaders

## Índice
- [Cuándo sí y reglas comunes](#cuándo-sí-y-reglas-comunes)
- [Intro o loader con caída y pantalla rota](#intro-o-loader-con-caída-y-pantalla-rota)
- [La web se rompe como un cristal](#la-web-se-rompe-como-un-cristal)
- [Pantalla que se rompe](#pantalla-que-se-rompe)
- [Objeto que cae encima de todo](#objeto-que-cae-encima-de-todo)
- [La página se desmorona](#la-página-se-desmorona)
- [Arrastrar y lanzar](#arrastrar-y-lanzar)
- [Confeti y lluvia con física](#confeti-y-lluvia-con-física)
- [El producto explota en partículas](#el-producto-explota-en-partículas)
- [Tela, cuerda y gelatina](#tela-cuerda-y-gelatina)
- [Verificar](#verificar)

Demos que funcionan (ábrelas con doble clic y cópialas): `recipes/demos/web-rota.html` (la propia web se
parte), `recipes/demos/intro-rotura.html`,
`recipes/demos/objeto-cae.html`, `recipes/demos/pagina-desmorona.html`. Código de referencia con licencia
verificada en `core/effects-vendor/` (categoría `fisica`): matter-js, matter-dropdown, d3-delaunay,
canvas-confetti, react-three-rapier.

## Cuándo sí y reglas comunes
Encajan en marcas que quieren impacto (agencias, campañas, portfolios, lanzamientos, juegos, 404). NO en una
web cuyo objetivo es una llamada o una reserva rápida: ahí, como mucho, un confeti al convertir. Se
proponen como pieza **M** votable en las rondas; si no gusta, queda vetado en `gustos.md`.
1. **Uno de coste alto por página.** El motor se carga solo cuando va a usarse (`IntersectionObserver` o el
   clic que lo dispara), nunca en la carga inicial.
2. **Con intención y una vez**: al entrar (intro, una vez por sesión), al pulsar o al llegar a la sección.
   Saltable (botón visible + Escape) y con tope de tiempo.
3. **Nada tapa lo importante al terminar**: el objeto se apoya en un bloque decidido (`data-fisica-destino`),
   nunca sobre un CTA o un texto; las capas de efecto se quitan del DOM al acabar.
4. **Quieto = motor parado** (`enableSleeping` + `Runner.stop` al dormirse): cero CPU en reposo.
5. **«Reducir movimiento»**: sin caída ni rotura; el resultado final aparece directamente (o no hay intro).
6. **Móvil decidido** (ui-ux-pro-max `movil.md`): menos trozos, objeto más pequeño, destino propio para
   móvil (`data-fisica-destino-movil`) porque los bloques se apilan, y toque en vez de ratón.
7. Solo `transform` y `opacity` en el DOM; lo pesado, en `<canvas>`. Limpieza al desmontar (Runner.stop,
   Engine.clear, quitar listeners).

## Intro o loader con caída y pantalla rota
Demo: `demos/intro-rotura.html` (sin dependencias, ~8 KB). El objeto (logo final de `logos/final/simbolo/`,
el producto…) cae, golpea la pantalla, salen grietas en radios y anillos desde el impacto (así se rompe
el cristal de verdad), tiembla, y el cristal se parte en trozos con brillo que caen con gravedad y giro
dejando ver la web, que ya estaba cargada debajo.
- **Sin destello**: un script mínimo en el `<head>` añade `intro-activa` a `<html>` ANTES de pintar (velo
  CSS del color de la intro) solo si toca intro (no vista en la sesión, sin reducir movimiento). El JS
  pinta el cristal en canvas y entonces quita el velo. Red de seguridad: el velo se quita solo a los 9 s.
- **Ajustes** (`AJUSTES` en la demo): `texto` pintado en el cristal, `caidaMs` 520, `grietaMs` 170, `maxMs`
  2600 (tope duro), punto de impacto (`ix`, `iy`), `radios` (14; 10 en móvil), crecimiento de anillos 1,55.
- **Modo loader** (`?modo=loader`): el golpe es inmediato y las grietas avanzan con la carga real
  (imágenes completas, evento `load`); al terminar, se rompe. Tope `loaderMaxMs` (8 s): se rompe igual.
  Solo si la página carga de verdad algo pesado (3D, vídeo); si carga en 1 s, es una intro, no un loader.
- Evento `senzu:intro-fin` al acabar (para arrancar las animaciones de entrada del hero DESPUÉS).
- Stacks: **Astro** → el script del velo `is:inline` en el `<head>` del Layout y la intro en un `<script>` del
  Layout (sin isla). **Next** → velo con `<script dangerouslySetInnerHTML>` en `app/layout.tsx` y la intro en
  un Client Component montado en el layout (`useEffect`, limpiar al desmontar). **Vue/Inertia** → velo en
  `app.blade.php` / `index.html` y la intro en un componente del layout persistente (`onMounted`).
- Variante sin objeto: la rotura la dispara un clic en el cristal («toca para entrar»), con el texto de marca.

## La web se rompe como un cristal
Demo: `demos/web-rota.html` (sin dependencias). La diferencia con la intro: aquí NO hay un cristal pintado
encima. **La página se ve normal** y lo que se parte es **la propia web**: cada trozo es una copia del DOM
(`cloneNode`) recortada con `clip-path` a la forma del trozo, así que se lee el texto real, nítido, en los
pedazos que caen girando en 3D. Sin capturas (html2canvas es lento e imperfecto) ni librerías.
- Marcado: `data-romper` (la raíz de la web: envuelve TODO en un `<div id="app">`; las reglas CSS tipo
  `body > header` no se aplicarían a las copias), `data-romper-detras` (lo que aparece detrás: otra sección,
  «el otro lado», la página siguiente), `data-romper-boton` (rompe DONDE se pulsa), `data-romper-volver`.
- Secuencia: golpe (la web real tiembla 180 ms) → grietas en SVG, quebradas y más gruesas cerca del impacto,
  con astillado alrededor del golpe → a los 240 ms se parte: los trozos usan los MISMOS bordes que las grietas
  → caen con gravedad, se alejan hacia ti (`translate3d` + `perspective`) y se voltean (`rotateX/Y`) con una
  luz que cambia al girar → detrás queda lo nuevo y el foco pasa a su título. «Volver» lo recompone.
- `?auto=1` (modo intro): un objeto cae (se estira al caer y se aplasta al chocar) y es él quien la rompe.
- Rendimiento: cada trozo ocupa SOLO su recuadro (no la pantalla entera) y se quita del DOM al salir de la
  vista; 54 trozos en escritorio, 42 en móvil. Con una página muy pesada (miles de nodos visibles), menos
  trozos: el coste es nodos × trozos durante ~1 s.
- Lo que `cloneNode` no copia y la demo resuelve: el contenido de los `<canvas>` (se redibuja en cada copia).
  Los vídeos salen con su primer fotograma o su póster; las animaciones CSS de las copias se pausan; los `id`
  internos se repiten en las copias (son `inert` y `aria-hidden`, no molestan).
- Como transición entre páginas: rompe al pulsar el enlace, y lo de detrás es la página nueva (en Astro con
  View Transitions desactivadas para ese enlace; en Next/Vue, la ruta nueva montada debajo antes de romper).
- «Reducir movimiento»: fundido de 220 ms a lo de detrás, sin rotura. Escape la termina al momento.

## Pantalla que se rompe
El mismo motor de la intro sobre una capa de UNA sección (no de toda la página): al pulsar un botón, al
llegar con el scroll o al soltar un objeto encima. El contenido del cristal es lo que tú pintes en el canvas
(color, imagen, texto): no hace falta capturar el DOM (html2canvas es lento e imperfecto).
- Cristal irregular (no radial): puntos al azar más densos cerca del impacto y celdas con `d3-delaunay`
  (`Delaunay.from(puntos).voronoi([0,0,W,H]).cellPolygons()`); cada celda es un trozo.
- Variante barata (sin romper): solo grietas en SVG que se dibujan (`stroke-dasharray`) + temblor de 150 ms.
- Sonido: solo si el usuario ya interactuó y con control para silenciar; nunca al cargar.

## Objeto que cae encima de todo
Demo: `demos/objeto-cae.html` (matter-js 0.20 desde jsdelivr, cargado al ver el destino). Atributos:
`data-fisica="objeto"` (el que cae, `position:absolute`, `z-index` alto, `aria-hidden`),
`data-fisica="suelo"` (bloques reales con los que choca), `data-fisica-destino` / `-movil` (dónde acaba).
- `FORMA` = lo que ocupa el dibujo dentro de su caja (la semilla: 64 % × 88 %): el cuerpo físico se ajusta al
  dibujo, no a la caja, o se queda flotando o hundido unos píxeles.
- Inercia ×25: aterriza de pie. Si aun así se duerme torcido, se **endereza** con un balanceo de 520 ms
  (tentetieso): la pose final siempre es limpia y la geometría la puede medir.
- El primer golpe fuerte hunde 6 px el bloque que lo recibe (`collisionStart` + `element.animate`).
- Cogerlo y lanzarlo: `pointerdown` lo vuelve estático y lo sigue; al soltar, velocidad del gesto.
- 3D (un GLB que cae y choca): **React/Next** → `react-three-rapier` (`<Physics><RigidBody colliders="hull">`
  y los bloques como `CuboidCollider` fijos); **Vue/Astro** → Three.js + `@dimforge/rapier3d-compat`. Coste
  alto: en móvil, la versión 2D o una imagen.

## La página se desmorona
Demo: `demos/pagina-desmorona.html`. Técnica de matter-dropdown: cada `data-fisica="cae"` pasa a cuerpo y se
mueve con `transform` (el maquetado no cambia); paredes = la pantalla y el scroll se bloquea mientras dura.
Se activa A PROPÓSITO (botón con `aria-pressed`): huevo de pascua o página 404. Mientras hay gravedad, un
enlace no navega al soltarlo. «Recomponer» o Escape: todo vuelve a su sitio en cascada (600 ms + 40 ms por
pieza). Marca elementos sueltos (títulos, fichas, botones), no contenedores que tengan otros dentro.

## Arrastrar y lanzar
Pegatinas, fichas o fotos que se cogen y se lanzan con inercia: el código de arrastre de `objeto-cae.html`
con varios objetos y sin destino. En React también `@react-spring/web` + `@use-gesture/react` (skill
react-spring-physics) para lanzar con muelle sin motor de física.

## Confeti y lluvia con física
`canvas-confetti` (ISC, 6 KB): `confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 }, colors: [tokens
de marca], disableForReducedMotion: true })`. Formas propias con `confetti.shapeFromPath` (la semilla, el
logo). Solo al conseguir algo (enviar, comprar, completar), nunca al cargar.

## El producto explota en partículas
Three.js: puntos sacados de los vértices del modelo o de los píxeles de la foto, que se separan con el scroll
o al pasar y vuelven a formar el producto (skill threejs-webgl; referencia Codrops «Pixel-to-Voxel Video Drop»
en `sources/codrops-index.md`). Coste alto: imagen fija en móvil.

## Tela, cuerda y gelatina
Integración verlet en canvas: puntos con posición actual y anterior, gravedad, y restricciones de distancia
resueltas 3-5 veces por fotograma. Banderola que cuelga, cuerda de la que tirar, botón gelatina. Bajo coste,
pero sin texto dentro (el texto deformado no se lee).

## Verificar
- `ui-verify` a 375 y 1440 cuando ya ha terminado el efecto: la geometría mide que el objeto quede centrado
  y apoyado, y la anotada enseña dónde ha acabado. Que nada tape el CTA.
- La intro termina antes de su tope, quita su capa del DOM y devuelve el scroll; con «reducir movimiento» no
  existe; la segunda visita de la sesión no la repite (`tools/test-fisica.mjs` lo comprueba en las demos).
- Lighthouse con y sin el efecto: el motor no debe aparecer en el JS de la carga inicial.
