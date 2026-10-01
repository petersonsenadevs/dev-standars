/**
 * Clase base para una escena Three.js vanilla (TypeScript).
 *
 * Contrato: init() -> start()/stop() -> dispose(). Sin dependencias de framework.
 * Incluye: renderer configurado (sRGB + ACES + sombras + DPR cap), ResizeObserver
 * sobre el contenedor, pausa fuera de viewport y con pestaña oculta, gestión de
 * webglcontextlost, reduced motion, loop con delta clampeado y dispose completo.
 *
 * Extiende la clase e implementa `build()` y `update(delta, elapsed)`.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  /** Elemento que define el tamaño; por defecto el padre del canvas. */
  container?: HTMLElement;
  /** Máximo pixel ratio. 2 desktop, 1.5 móvil es un buen valor. */
  maxPixelRatio?: number;
  /** Fondo transparente (alpha). */
  alpha?: boolean;
  /** Respetar prefers-reduced-motion (se lee de matchMedia si no se indica). */
  reducedMotion?: boolean;
  /** Activar OrbitControls. */
  controls?: boolean;
  /** Ruta de los decoders Draco/KTX2 (copiados a public/). */
  dracoPath?: string;
  basisPath?: string;
  /** Callback de progreso de carga (0-1). */
  onProgress?: (ratio: number) => void;
  /** Se dispara al perder/recuperar el contexto WebGL. */
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

interface Disposable {
  dispose(): void;
}

export abstract class Scene {
  readonly canvas: HTMLCanvasElement;
  readonly container: HTMLElement;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly clock = new THREE.Clock(false);
  readonly manager = new THREE.LoadingManager();
  readonly options: Required<Pick<SceneOptions, 'maxPixelRatio' | 'alpha' | 'reducedMotion' | 'controls' | 'dracoPath' | 'basisPath'>> & SceneOptions;

  controls: OrbitControls | null = null;

  protected disposables: Disposable[] = [];
  protected readonly abort = new AbortController();

  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private inView = true;
  private pageVisible = !document.hidden;
  private running = false;
  private disposed = false;
  private initialized = false;

  private gltfLoader: GLTFLoader | null = null;
  private dracoLoader: DRACOLoader | null = null;
  private ktx2Loader: KTX2Loader | null = null;

  constructor(options: SceneOptions) {
    this.canvas = options.canvas;
    this.container = options.container ?? (options.canvas.parentElement as HTMLElement);
    this.options = {
      maxPixelRatio: options.maxPixelRatio ?? (matchMedia('(pointer: coarse)').matches ? 1.5 : 2),
      alpha: options.alpha ?? false,
      reducedMotion: options.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
      controls: options.controls ?? false,
      dracoPath: options.dracoPath ?? '/draco/',
      basisPath: options.basisPath ?? '/basis/',
      ...options,
    };

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 1.2, 5);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: this.options.alpha,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.options.maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.manager.onProgress = (_url, loaded, total) => this.options.onProgress?.(total ? loaded / total : 1);
  }

  // ---------------------------------------------------------------------------
  // Ciclo de vida
  // ---------------------------------------------------------------------------

  /** Carga assets, construye la escena y arranca el loop. Idempotente. */
  async init(): Promise<void> {
    if (this.initialized || this.disposed) return;
    this.initialized = true;

    this.bindContextEvents();
    this.bindResize();
    this.bindVisibility();

    if (this.options.controls) {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enablePan = false;
      this.controls.enableZoom = false;
      this.controls.autoRotate = !this.options.reducedMotion;
      this.controls.autoRotateSpeed = 0.8;
      this.disposables.push(this.controls);
    }

    await this.build();

    // Precompila shaders y sube texturas para evitar stutter en el primer frame.
    await this.renderer.compileAsync(this.scene, this.camera);

    this.resize();
    this.renderer.render(this.scene, this.camera);
    this.start();
  }

  /** Implementa aquí la construcción del grafo (luces, modelos, materiales). */
  protected abstract build(): Promise<void> | void;

  /** Se llama en cada frame con delta (s) y tiempo acumulado (s). */
  protected abstract update(delta: number, elapsed: number): void;

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(this.loop);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.clock.stop();
    this.renderer.setAnimationLoop(null);
  }

  resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.options.maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.onResize(width, height);
  }

  /** Hook opcional para resize (uniforms de resolución, composer...). */
  protected onResize(_width: number, _height: number): void {}

  /** Libera todo. Idempotente. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stop();
    this.abort.abort();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();

    for (const d of this.disposables.splice(0)) d.dispose();

    Scene.disposeObject(this.scene);
    this.scene.clear();
    (this.scene.environment as THREE.Texture | null)?.dispose();
    if (this.scene.background && (this.scene.background as THREE.Texture).isTexture) {
      (this.scene.background as THREE.Texture).dispose();
    }

    this.dracoLoader?.dispose();
    this.ktx2Loader?.dispose();

    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ---------------------------------------------------------------------------
  // Loaders
  // ---------------------------------------------------------------------------

  protected getGLTFLoader(): GLTFLoader {
    if (!this.gltfLoader) {
      this.dracoLoader = new DRACOLoader(this.manager).setDecoderPath(this.options.dracoPath);
      this.ktx2Loader = new KTX2Loader(this.manager)
        .setTranscoderPath(this.options.basisPath)
        .detectSupport(this.renderer);
      this.gltfLoader = new GLTFLoader(this.manager);
      this.gltfLoader.setDRACOLoader(this.dracoLoader);
      this.gltfLoader.setKTX2Loader(this.ktx2Loader);
      this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    }
    return this.gltfLoader;
  }

  protected async loadGLTF(url: string, shadows = true): Promise<GLTF> {
    const gltf = await this.getGLTFLoader().loadAsync(url);
    if (shadows) {
      gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
    }
    return gltf;
  }

  /** Carga un HDRI y lo aplica como environment (y opcionalmente background). */
  protected async loadEnvironment(url: string, asBackground = false): Promise<THREE.Texture> {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const hdr = await new RGBELoader(this.manager).loadAsync(url);
    const envMap = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
    this.scene.environment = envMap;
    if (asBackground) this.scene.background = envMap;
    return envMap;
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private loop = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;
    this.controls?.update(delta);
    this.update(delta, elapsed);
    this.render();
  };

  /** Sobrescribe para usar un EffectComposer. */
  protected render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private bindResize(): void {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  private bindVisibility(): void {
    const { signal } = this.abort;

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.inView = entry.isIntersecting;
        this.syncRunning();
      },
      { threshold: 0.01, rootMargin: '100px' },
    );
    this.intersectionObserver.observe(this.canvas);

    document.addEventListener(
      'visibilitychange',
      () => {
        this.pageVisible = !document.hidden;
        this.syncRunning();
      },
      { signal },
    );
  }

  private syncRunning(): void {
    if (!this.initialized || this.disposed) return;
    const shouldRun = this.inView && this.pageVisible;
    if (shouldRun && !this.running) this.start();
    else if (!shouldRun && this.running) this.stop();
  }

  private bindContextEvents(): void {
    const { signal } = this.abort;
    this.canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        this.stop();
        this.options.onContextLost?.();
      },
      { signal },
    );
    this.canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.options.onContextRestored?.();
        this.syncRunning();
      },
      { signal },
    );
  }

  /** Dispone geometrías, materiales y texturas de un subárbol. */
  static disposeObject(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) {
          if (value && typeof value === 'object' && (value as THREE.Texture).isTexture) {
            (value as THREE.Texture).dispose();
          }
        }
        material.dispose();
      }
    });
  }
}

// -----------------------------------------------------------------------------
// Ejemplo de escena concreta
// -----------------------------------------------------------------------------

export interface HeroSceneOptions extends SceneOptions {
  modelUrl?: string;
  hdriUrl?: string;
}

export class HeroScene extends Scene {
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private readonly heroOptions: HeroSceneOptions;

  constructor(options: HeroSceneOptions) {
    super({ controls: true, ...options });
    this.heroOptions = options;
  }

  protected async build(): Promise<void> {
    this.camera.position.set(0, 1.2, 5);
    this.camera.lookAt(0, 0.6, 0);
    if (this.controls) this.controls.target.set(0, 0.6, 0);

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#444466', 0.5));

    const sun = new THREE.DirectionalLight('#ffffff', 2.5);
    sun.position.set(4, 6, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 30;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
    sun.shadow.camera.right = sun.shadow.camera.top = 6;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const tasks: Promise<unknown>[] = [];
    if (this.heroOptions.hdriUrl) tasks.push(this.loadEnvironment(this.heroOptions.hdriUrl));
    if (this.heroOptions.modelUrl) {
      tasks.push(
        this.loadGLTF(this.heroOptions.modelUrl).then((gltf) => {
          this.model = gltf.scene;
          this.scene.add(gltf.scene);
          if (gltf.animations.length) {
            this.mixer = new THREE.AnimationMixer(gltf.scene);
            this.mixer.clipAction(gltf.animations[0]).play();
          }
        }),
      );
    } else {
      const mesh = new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.5, 0.18, 160, 32),
        new THREE.MeshStandardMaterial({ color: '#4f8cff', roughness: 0.3, metalness: 0.2 }),
      );
      mesh.position.y = 0.8;
      mesh.castShadow = true;
      this.model = mesh;
      this.scene.add(mesh);
    }
    await Promise.all(tasks);
  }

  protected update(delta: number, _elapsed: number): void {
    if (this.options.reducedMotion) return;
    this.mixer?.update(delta);
    if (this.model && !this.controls?.autoRotate) this.model.rotation.y += delta * 0.3;
  }
}
