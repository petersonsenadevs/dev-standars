# Errores frecuentes en Three.js y cómo evitarlos

Cada entrada: síntoma → causa → solución.

## Color, luz y aspecto

1. **Todo se ve lavado/gris o demasiado oscuro y saturado.** Color space mal configurado. Causas típicas: textura de color cargada con `TextureLoader` sin `texture.colorSpace = THREE.SRGBColorSpace`; `renderer.outputColorSpace` cambiado a `LinearSRGBColorSpace`; render target intermedio sin `OutputPass`/`ToneMapping` al final de un `EffectComposer`. Solución: `renderer.outputColorSpace = SRGBColorSpace` (por defecto), sRGB solo en `map`/`emissiveMap`, mapas de datos en `NoColorSpace`, y `OutputPass` como último pase del composer.

2. **Colores del shader propio no coinciden con el hex.** `ShaderMaterial` recibe `THREE.Color` ya convertido a lineal y no aplica la conversión de salida. Añade `#include <colorspace_fragment>` (y `<tonemapping_fragment>` si quieres tone mapping) al final del fragment.

3. **La escena se ve muy oscura tras actualizar Three.** Desde r155 las luces usan unidades físicas (`useLegacyLights = false`, ya eliminado). Multiplica intensidades: `PointLight`/`SpotLight` x ~100-500, `DirectionalLight` x ~2-3, o usa `scene.environment`.

4. **Metales negros.** `MeshStandardMaterial` con `metalness: 1` refleja el entorno; sin `scene.environment` no hay nada que reflejar. Añade HDRI/`RoomEnvironment`.

5. **Vidrio con `transmission` se ve opaco o negro.** Necesita fondo o environment para refractar y no funciona bien con `transparent: true` (usa `transmission` sin `transparent`). Además no atraviesa otros objetos transmisivos y requiere `renderer` con `transmissionResolutionScale` razonable (r165+).

6. **No hay sombras.** Faltan una o varias de: `renderer.shadowMap.enabled = true`, `light.castShadow = true`, `mesh.castShadow = true`, `plane.receiveShadow = true`, o el frustum de `light.shadow.camera` no cubre la escena (usa `CameraHelper`). En modelos glTF hay que hacer `traverse` para activar `castShadow` en cada mesh. `AmbientLight`/`HemisphereLight`/`RectAreaLight` no proyectan sombras.

7. **Shadow acne (rayas) o peter-panning (sombra despegada).** `shadow.bias` mal ajustado. Empieza con `normalBias = 0.02` y `bias = -0.0005`; reduce el frustum de la sombra al mínimo necesario y sube `mapSize`.

8. **Bordes de sombra pixelados.** `shadow.mapSize` pequeño para un frustum grande. Ajusta `shadow.camera.left/right/top/bottom` al área real y usa `PCFSoftShadowMap`. Para escenas estáticas, `ContactShadows` o baking.

## Actualizaciones y estado

9. **Cambié un atributo/uniform/textura y no se ve.** Falta `needsUpdate`: `geometry.attributes.position.needsUpdate = true` tras editar el array; `material.needsUpdate = true` tras cambiar `map` de null a textura, `transparent`, `side`, `defines`, `flatShading`; `texture.needsUpdate = true` tras modificar un `CanvasTexture` o `image`. Cambiar `color`, `roughness`, `opacity`, `uniforms.x.value` no lo requiere.

10. **Cambié `camera.fov`/`aspect`/`near`/`far` y no pasa nada.** `camera.updateProjectionMatrix()` obligatorio (en resize y en tweens de fov).

11. **`OrbitControls` con `enableDamping` no se mueve suave o se queda "pegado".** Sin `controls.update()` en cada frame el damping no se integra. Con render bajo demanda, escucha `change` y renderiza.

12. **La cámara animada con GSAP vuelve sola o tiembla.** `OrbitControls` sigue activo y sobreescribe la posición en `update()`. Desactívalo durante el tween (`controls.enabled = false`) y al terminar `controls.target.copy(target); controls.update()`.

13. **Animación va al doble de velocidad en monitores 120 Hz o se acelera en desktop.** Incrementos fijos por frame (`rotation.y += 0.01`). Usa `delta` de `Clock`/`useFrame`/`useLoop`. Y clampea `delta` (`Math.min(delta, 0.1)`) para evitar saltos al volver de pestaña oculta.

14. **El objeto animado por shader desaparece en los bordes de la pantalla.** Frustum culling usa la esfera envolvente de la geometría original; el desplazamiento en GPU la desborda. `mesh.frustumCulled = false` o agranda `geometry.boundingSphere`.

## Memoria y ciclo de vida

15. **La pestaña va cada vez más lenta / "WARNING: Too many active WebGL contexts".** No se dispone nada al desmontar (SPA con Inertia, Next router, Astro View Transitions, HMR). Geometrías, materiales, texturas, render targets, composer, controls, loaders (Draco/KTX2) y `renderer.dispose()`; parar el loop (`setAnimationLoop(null)`); desconectar observers y listeners. Comprueba `renderer.info.memory` tras el dispose.

16. **`window is not defined` / `document is not defined` / `self is not defined`.** Importar `three`, addons o componentes de canvas en SSR (Inertia SSR, Next Server Components, Astro build). Carga el componente 3D con `import()` dinámico dentro de `onMounted`/`useEffect`, `next/dynamic` con `ssr: false` en un Client Component, `client:visible`/`client:only` en Astro. Nunca crees `WebGLRenderer` a nivel de módulo.

17. **Contexto WebGL perdido (canvas en negro tras un rato, sobre todo en iOS o al cambiar de pestaña).** El navegador reclama la GPU (memoria, pestaña en segundo plano, otra app). Maneja `webglcontextlost` (llama a `event.preventDefault()`, para el loop y muestra el poster) y `webglcontextrestored` (re-sube texturas, reanuda). Reduce el consumo (texturas KTX2, DPR ≤ 1.5, sin bloom en móvil) para que ocurra menos.

```ts
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); renderer.setAnimationLoop(null); showPoster(); });
canvas.addEventListener('webglcontextrestored', () => { renderer.setAnimationLoop(loop); hidePoster(); });
```

18. **Muchas instancias de `useGLTF`/`useLoader` con el mismo modelo y sombras que "desaparecen".** La caché devuelve el mismo `scene`; al montarlo dos veces lo reparentas (solo uno lo muestra). Clona: `scene.clone()` o `SkeletonUtils.clone` para skinned. No dispongas geometrías de objetos cacheados a mano (`dispose={null}` en R3F).

## Rendimiento

19. **20 fps en móvil con una escena "sencilla".** Pixel ratio 3 sin cap → 9x píxeles. `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` (1.5 en móvil). Segunda causa: bloom/postprocesado a DPR completo. Tercera: varias luces con sombras.

20. **Stutter la primera vez que un objeto entra en cámara.** Compilación de shaders y upload de texturas perezosos. `await renderer.compileAsync(scene, camera)` (o `<Preload all />` en drei) antes de mostrar el canvas.

21. **Modelo de 30 MB.** Exportado sin comprimir, texturas 4096 PNG, geometría sin decimar. Pipeline: `gltf-transform optimize --texture-compress webp|ktx2 --compress meshopt|draco`, texturas ≤ 2048, decimate en Blender. Objetivo < 2 MB para el hero.

22. **Texturas borrosas o con bordes negros, o errores "texture is not power of two".** En WebGL2 las NPOT funcionan con mipmaps, pero en WebGL1/algunos móviles no; además las NPOT desperdician memoria en atlas. Exporta 512/1024/2048. Para UI a 1:1 desactiva mipmaps (`generateMipmaps = false`, `minFilter = LinearFilter`).

23. **Cientos de draw calls.** Cada mesh es un draw call; un glTF de Blender con 300 objetos separados = 300+ calls. Une en Blender (Ctrl+J), `mergeGeometries`, `InstancedMesh`/`BatchedMesh` para repetidos, o `gltf-transform join`/`instance`.

24. **La página entera hace scroll a trompicones cuando el canvas está fuera de pantalla.** El loop sigue corriendo. Pausa con `IntersectionObserver` y `visibilitychange`; con OrbitControls + rueda, `enableZoom = false` para no secuestrar el scroll.

25. **El bundle inicial pesa 600 KB más por `three`.** Importado estáticamente en una página cuyo LCP no depende del 3D. `import()` dinámico tras `requestIdleCallback`/intersección; `manualChunks` para `three`.

## Cámara, geometría y encuadre

26. **Z-fighting (superficies que parpadean).** `near` muy pequeño y `far` muy grande (`0.001`-`100000`) destruyen la precisión del depth buffer; o dos planos coplanares. Sube `near` (0.1), baja `far` a lo necesario, `logarithmicDepthBuffer: true` como último recurso (cuesta), separa los planos o usa `polygonOffset` en el material de uno.

27. **El modelo no aparece pero no hay errores.** Está en escala mm (1000x grande, la cámara dentro), en el origen fuera del frustum, o con material `side` incorrecto para normales invertidas. `Box3().setFromObject(model)` para ver su tamaño, `fitCameraToObject`, `AxesHelper`, `material.side = DoubleSide` para diagnosticar.

28. **Un `PlaneGeometry` como suelo se ve solo desde abajo / no recibe luz.** El plano mira a +Z; gira `rotation.x = -Math.PI / 2` (no `+`). Con `BackSide` o normales invertidas, la iluminación se calcula al revés.

29. **`lookAt` no funciona en un mesh como en la cámara.** Las cámaras miran por -Z; los meshes orientan su +Z hacia el punto (`lookAt` invertido para ellos desde r80+). Para orientar un `PlaneGeometry` hacia la cámara usa `Sprite` o `mesh.quaternion.copy(camera.quaternion)`.

30. **Transparencias mal ordenadas (objetos de atrás pintados delante).** Three ordena transparentes por distancia del centro del objeto, no por fragmento. Reduce solapamientos, `depthWrite = false` en partículas/glow, `alphaHash` o `alphaTest` en vegetación, `renderOrder` manual, o dos meshes (FrontSide + BackSide) para esferas de vidrio.

## DOM, CSS e integración

31. **El canvas no ocupa el 100 % o deja un hueco de 4 px abajo.** `<canvas>` es inline por defecto: CSS `display: block; width: 100%; height: 100%`. Y el contenedor necesita altura explícita (`h-[80vh]`, `inset-0` absoluto) para que `clientHeight` no sea 0 (canvas de 0 px = pantalla negra sin error).

32. **`renderer.setSize` con CSS deforma o pixela.** Usa `setSize(w, h, false)` y controla el tamaño con CSS; mide el contenedor con `ResizeObserver`, no `window.innerWidth`, cuando el canvas no es fullscreen.

33. **Tocar el DOM (o `setState`/`ref` de Vue) dentro de `useFrame`/`useLoop`.** Provoca layout/re-render cada frame. Muta objetos de Three y refs planas; para HTML anclado usa `<Html>` de drei/cientos o actualiza el DOM con throttling fuera del loop.

34. **Warnings `Failed to resolve component: TresMesh` en Vue.** Falta `templateCompilerOptions` de `@tresjs/core` en `@vitejs/plugin-vue` (`isCustomElement`).

35. **El raycaster acierta en el sitio equivocado.** Coordenadas NDC calculadas con `clientX/innerWidth` cuando el canvas no está en (0,0) o no es fullscreen. Usa `getBoundingClientRect()` del canvas. Y llama a `setFromCamera` después de mover la cámara en ese frame.

36. **`useTres`/`useThree` devuelve `undefined`.** Se llama fuera del árbol de `<TresCanvas>`/`<Canvas>`. Divide en componente contenedor (canvas) y componente de contenido.

37. **Inertia navega y el canvas anterior sigue consumiendo GPU (layout persistente).** El componente no se desmonta; pausa el loop (`pause()`/`frameloop='never'`) cuando la ruta actual no lo muestra, o saca el canvas del layout persistente.

38. **`gltf.scene` con `castShadow` en el `Group` no proyecta sombra.** La propiedad no se hereda; hay que ponerla en cada `Mesh` con `traverse`.

39. **Modelos con `KHR_materials_*` se ven distintos entre Blender y Three.** Extensiones no soportadas por el exportador/loader o iluminación distinta (Blender Eevee vs env map). Compara en el glTF Viewer de Don McCurdy; ajusta `envMapIntensity`, `toneMappingExposure`, `roughness`. No esperes paridad exacta.

40. **Safari iOS recarga la página o el canvas se queda en negro.** Límite de memoria GPU/RAM por pestaña más estricto. Texturas ≤ 1024 KTX2, DPR ≤ 1.5, sin `preserveDrawingBuffer`, disposer estricto al navegar, y evita `WebGLRenderTarget` de tamaño completo (bloom, SSAO).
