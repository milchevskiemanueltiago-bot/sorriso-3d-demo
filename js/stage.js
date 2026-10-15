// Shared renderer: studio environment, three-point light, ambient occlusion + soft bloom.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createStage(canvas, { fov = 30, bg = 0x061416, ao = true, bloom = 0.28 } = {}) {
  const small = innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.9;

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.5, 60);

  const key = new THREE.DirectionalLight(0xfff1e2, 2.6); key.position.set(3.5, 5, 6.5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe9ff, 0.7); fill.position.set(-5, 1, 4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x7ff3e4, 3.4); rim.position.set(-4, 2.5, -5); scene.add(rim);
  const under = new THREE.PointLight(0x35c2b8, 8, 14); under.position.set(0, -3.2, 3.2); scene.add(under);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (ao) {
    gtao = new GTAOPass(scene, camera, 512, 512);
    gtao.updateGtaoMaterial({ radius: 0.28, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.9;
    composer.addPass(gtao);
  }
  const bl = new UnrealBloomPass(new THREE.Vector2(512, 512), bloom, 0.65, 0.88);
  composer.addPass(bl);
  composer.addPass(new OutputPass());

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    const pr = renderer.getPixelRatio();
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return true;
  }
  resize();
  addEventListener('resize', resize);

  return { renderer, scene, camera, composer, resize, gtao, bloom: bl, lights: { key, fill, rim, under },
    render: () => composer.render() };
}
