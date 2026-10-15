// Hero 3D: a full mouth that goes from crooked, stained teeth with plaque, tartar and
// cavities to a clean, aligned smile with porcelain veneers. Driven by scroll progress.
import * as THREE from 'three';
import { createStage } from './stage.js';
import { createArches } from './arch.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function createTeeth(canvas) {
  const stage = createStage(canvas, { fov: 30, ao: true, bloom: 0.14 });
  const { scene, camera, resize: stageResize } = stage;
  const A = createArches({ mouth: true, dirty: true, seed: 7 });
  const { root, teeth, veneers, U, gumMat, mouth } = A;
  root.scale.setScalar(0.5);
  root.position.y = 0.05;
  scene.add(root);

  // soft teal glow behind the smile
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uA: { value: 0.5 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float uA;void main(){float d=length((vUv-.5)*vec2(1.7,1.));gl_FragColor=vec4(.1,.45,.44,(1.-smoothstep(0.,.5,d))*uA);}',
  }));
  glow.position.set(0, -0.3, -4.2); scene.add(glow);

  // sparkles that burst when a veneer lands
  const SP = 220;
  const spPos = new Float32Array(SP * 3), spSeed = new Float32Array(SP * 4);
  for (let i = 0; i < SP; i++) {
    spSeed.set([Math.random() * 6.28, Math.random() * 3.14, 0.4 + Math.random(), Math.random()], i * 4);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const sparkMat = new THREE.PointsMaterial({ color: 0xc8fff7, size: 0.045, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false; scene.add(sparks);

  // camera keyframes over the 3D phase (k in 0..1)
  const K = [
    { k: 0.00, pos: [0, -0.1, 4.2], look: [0, -0.2, 0] },
    { k: 0.10, pos: [0, 0.2, 7.2], look: [0, -0.2, -0.6] },
    { k: 0.26, pos: [3.6, 0.9, 6.6], look: [0, -0.2, -0.8] },
    { k: 0.48, pos: [-3.2, 0.5, 7.0], look: [0, -0.2, -0.8] },
    { k: 0.62, pos: [0, 4.6, 7.6], look: [0, -0.3, -1.1] },
    { k: 0.74, pos: [0, 0.6, 7.0], look: [0, -0.1, -0.4] },
    { k: 0.88, pos: [1.4, 0.3, 6.8], look: [0, 0.0, -0.4] },
    { k: 1.00, pos: [0, 0.3, 10.4], look: [0, -1.6, -0.6] },
  ];
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), lookV = new THREE.Vector3();
  function camAt(k) {
    let i = 0; while (i < K.length - 2 && K[i + 1].k < k) i++;
    const a = K[i], b = K[i + 1];
    const t = ease(Math.min(1, Math.max(0, (k - a.k) / (b.k - a.k))));
    vA.fromArray(a.pos).lerp(vB.fromArray(b.pos), t);
    camera.position.copy(vA);
    lookV.fromArray(a.look).lerp(vB.fromArray(b.look), t);
  }

  let phase = 0, mouseX = 0, mouseY = 0, fit = 1;
  const state = { scan: 0, clean: 0, align: 0, veneer: 0, final: 0, mouth: 1 };
  const healthy = new THREE.Color(); void healthy;

  function setPhase(k) {
    phase = Math.min(1, Math.max(0, k));
    state.scan = ss(0.06, 0.26, phase);
    state.clean = ss(0.28, 0.5, phase);
    state.align = ss(0.52, 0.7, phase);
    state.veneer = ss(0.72, 0.9, phase);
    state.final = ss(0.9, 1.0, phase);
    state.mouth = 1 - ss(0.04, 0.2, phase);
    U.uScan.value = Math.sin(Math.PI * Math.min(1, state.scan * 1.02)) * (state.scan < 1 ? 1 : 0) +
      (state.scan > 0 && state.clean < 0.15 ? 0.25 * (1 - state.clean / 0.15) : 0);
    U.uScanY.value = lerp(1.9, -2.4, state.scan);
    U.uClean.value = state.clean * 1.1;
    U.uWhite.value = state.veneer * 0.85 + state.align * 0.08;
    U.uHealth.value = state.clean;
  }

  function resize() {
    if (!stageResize()) return;
    fit = Math.max(1, 1.0 / camera.aspect);
  }
  addEventListener('resize', resize); resize();
  addEventListener('pointermove', e => { mouseX = e.clientX / innerWidth - 0.5; mouseY = e.clientY / innerHeight - 0.5; });

  const clock = new THREE.Clock();
  const burst = { t: -1, last: 0 };

  function render() {
    const time = clock.getElapsedTime();
    U.uTime.value = time;
    // crooked -> aligned
    const a = ease(state.align);
    for (const t of teeth) {
      const c = t.crooked, k = 1 - a;
      t.inner.rotation.set(c.rx * k, c.ry * k, c.rz * k);
      t.inner.position.set(c.x * k, c.y * k, c.z * k);
    }
    // veneers slide on from the front, staggered from the centre outward
    let landing = 0;
    for (const { v, t, order } of veneers) {
      const s = ss(order * 0.12, order * 0.12 + 0.55, state.veneer);
      v.material.opacity = Math.min(1, s * 1.6) * 0.92;
      v.position.z = t.mesh.position.z + (1 - ease(s)) * 1.4;
      v.position.y = t.mesh.position.y - (1 - ease(s)) * 0.3;
      v.rotation.x = (1 - ease(s)) * -0.5;
      const land = Math.max(0, 1 - Math.abs(s - 0.92) / 0.08);
      v.material.emissiveIntensity = land * 0.9;
      v.visible = s > 0.001;
      landing = Math.max(landing, land);
    }
    // gloss sweep after the veneers are on
    U.uSweep.value = state.veneer > 0.95 ? -4 + ((time * 0.6) % 3.4) * 2.6 : -9;

    // mouth fades away so the smile can be examined
    const m = A.mouth;
    m.cavity.material.opacity = state.mouth;
    m.tongue.material.opacity = state.mouth;
    m.tongue.visible = m.cavity.visible = state.mouth > 0.01;

    // sparkles around the incisors while veneers land
    sparkMat.opacity = landing * 0.9;
    if (landing > 0.02) {
      const tt = time;
      for (let i = 0; i < SP; i++) {
        const [az, el, sp, r] = [spSeed[i * 4], spSeed[i * 4 + 1], spSeed[i * 4 + 2], spSeed[i * 4 + 3]];
        const rad = 0.25 + ((tt * sp * 0.6 + r) % 1) * 1.4;
        spPos[i * 3] = Math.cos(az) * Math.sin(el) * rad * 1.8 * 0.5;
        spPos[i * 3 + 1] = 0.0 + Math.cos(el) * rad * 0.5 * 0.9 - 0.3 * 0.5;
        spPos[i * 3 + 2] = Math.sin(az) * Math.sin(el) * rad * 0.5 + 0.3;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    }

    camAt(phase);
    camera.position.setZ(camera.position.z * fit);
    camera.position.x += mouseX * 0.5 + Math.sin(time * 0.4) * 0.15 * state.final;
    camera.position.y += -mouseY * 0.3;
    if (camera.aspect > 1.2) lookV.x += 0.55 * ss(0.04, 0.12, phase) * (1 - state.final);
    camera.lookAt(lookV);
    root.rotation.y = Math.sin(time * 0.35) * 0.04;
    glow.material.uniforms.uA.value = 0.35 + 0.25 * state.veneer;
    stage.render();
  }

  function readout() {
    return {
      plaque: Math.round(87 * (1 - state.clean)),
      align: Math.round(41 + 59 * state.align),
      shade: state.veneer > 0.8 ? 'BL1' : state.veneer > 0.4 ? 'A1' : state.clean > 0.7 ? 'A2' : 'A3.5',
    };
  }

  return { setPhase, render, resize, readout, state };
}
