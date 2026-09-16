<script setup lang="ts">
/**
 * HeroContent.vue: contenido de la escena (hijo de <TresCanvas>).
 * Separado del canvas para poder usar useTres/useLoop.
 */
import { onBeforeUnmount, shallowRef, watch, markRaw } from 'vue';
import { useLoop, useTres } from '@tresjs/core';
import { OrbitControls, Environment, ContactShadows } from '@tresjs/cientos';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const props = defineProps<{
  modelUrl: string;
  hdriUrl?: string;
  controls: boolean;
  autoRotate: boolean;
  reducedMotion: boolean;
}>();

const emit = defineEmits<{ progress: [ratio: number]; ready: []; error: [error: unknown] }>();

const { renderer, scene, camera } = useTres();
const model = shallowRef<THREE.Group>();
let mixer: THREE.AnimationMixer | null = null;

// Loader manual (en lugar de useGLTF de cientos) para controlar Draco/KTX2/Meshopt locales,
// progreso y dispose. Si prefieres cientos: const { state } = useGLTF(props.modelUrl, { draco: true }).
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => emit('progress', total ? loaded / total : 1);

const draco = new DRACOLoader(manager).setDecoderPath('/draco/');
const ktx2 = new KTX2Loader(manager).setTranscoderPath('/basis/');
const loader = new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);

watch(
  () => renderer.value,
  async (r) => {
    if (!r || model.value) return;
    try {
      ktx2.detectSupport(r);
      loader.setKTX2Loader(ktx2);
      const gltf = await loader.loadAsync(props.modelUrl);
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(gltf.scene);
        mixer.clipAction(gltf.animations[0]).play();
      }
      model.value = markRaw(gltf.scene);
      await r.compileAsync(scene.value, camera.value!);
      emit('ready');
    } catch (error) {
      emit('error', error);
    }
  },
  { immediate: true },
);

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta }) => {
  if (props.reducedMotion) return;
  mixer?.update(Math.min(delta, 0.1));
  if (model.value && !props.controls) model.value.rotation.y += delta * 0.3;
});

onBeforeUnmount(() => {
  mixer?.stopAllAction();
  if (model.value) {
    model.value.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose();
        mat.dispose();
      }
    });
  }
  draco.dispose();
  ktx2.dispose();
});
</script>

<template>
  <TresPerspectiveCamera :position="[0, 1.2, 5]" :fov="45" :near="0.1" :far="100" :look-at="[0, 0.6, 0]" />
  <OrbitControls
    v-if="controls"
    make-default
    enable-damping
    :enable-pan="false"
    :enable-zoom="false"
    :auto-rotate="autoRotate"
    :auto-rotate-speed="0.8"
    :min-polar-angle="Math.PI * 0.2"
    :max-polar-angle="Math.PI * 0.5"
    :target="[0, 0.6, 0]"
  />

  <TresHemisphereLight :args="['#ffffff', '#444466', 0.5]" />
  <TresDirectionalLight
    :position="[4, 6, 3]"
    :intensity="2.5"
    cast-shadow
    :shadow-mapSize="[2048, 2048]"
    :shadow-camera-near="0.5"
    :shadow-camera-far="30"
    :shadow-camera-left="-6"
    :shadow-camera-right="6"
    :shadow-camera-top="6"
    :shadow-camera-bottom="-6"
    :shadow-normalBias="0.02"
  />

  <Suspense>
    <Environment v-if="hdriUrl" :files="hdriUrl" :background="false" :blur="0.6" />
    <Environment v-else preset="studio" :background="false" :blur="0.6" />
  </Suspense>

  <primitive v-if="model" :object="model" />

  <ContactShadows :opacity="0.5" :blur="2" :scale="10" :far="4" :position-y="0" :frames="reducedMotion ? 1 : Infinity" />
</template>
