// Scroll-driven immediate-load implants on a real upper + lower arch.
// Upper lateral and lower first premolar are missing: titanium screw -> abutment -> crown, one jaw at a time.
import * as THREE from 'three';
import { createStage } from './stage.js';
import { createArches } from './arch.js';
import { toothGeometry } from './toothgeo.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const TEAL = 0x7ff3e4;

export function createImplant(canvas) {
  const stage = createStage(canvas, { fov: 32, ao: true, bloom: 0.14 });
  const { scene, camera } = stage;
  const A = createArches({
    missing: [{ jaw: 'U', side: 1, idx: 1 }, { jaw: 'L', side: -1, idx: 3 }],
    mouth: false, gumOpacity: 0.52, dirty: false, seed: 11,
  });
  const { root, sites } = A;
  root.scale.setScalar(0.5);
  scene.add(root);

  const titanium = new THREE.MeshPhysicalMaterial({ color: 0xc6d0d6, metalness: 1, roughness: 0.24, clearcoat: 0.35, envMapIntensity: 1.3 });
  const goldTi = new THREE.MeshPhysicalMaterial({ color: 0xd9b36a, metalness: 1, roughness: 0.26, envMapIntensity: 1.2 });

  // glow behind
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;void main(){float d=length((vUv-.5)*vec2(1.6,1.));gl_FragColor=vec4(.11,.46,.45,(1.-smoothstep(0.,.5,d))*.55);}',
  }));
  glow.position.set(-0.8, -0.3, -5); scene.add(glow);

  class Helix extends THREE.Curve {
    constructor(L, rTop, rBot) { super(); this.L = L; this.rt = rTop; this.rb = rBot; }
    getPoint(t, out = new THREE.Vector3()) {
      const y = -0.12 - t * (this.L - 0.25), r = THREE.MathUtils.lerp(this.rt, this.rb, (-y) / this.L) + 0.035, a = t * Math.PI * 2 * 9;
      return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  function makeScrew() {
    const g = new THREE.Group();
    const L = 1.5, rTop = 0.2, rBot = 0.13;
    const prof = [[0, -L], [rBot * 0.6, -L], [rBot, -L + 0.1], [rTop, -0.08], [rTop * 1.05, 0], [0.09, 0.02], [0, 0.02]].map(p => new THREE.Vector2(p[0], p[1]));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 48), titanium));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new Helix(L, rTop, rBot), 500, 0.034, 8, false), titanium));
    return g;
  }

  const jobs = sites.map((s, i) => {
    const up = s.upper, dir = up ? 1 : -1;
    const g = new THREE.Group();
    g.position.copy(s.p); g.rotation.y = s.rotY;
    root.add(g);
    const crestY = s.marginY - dir * 0.14;

    // titanium fixture. Built head-up with the body hanging down; flipped for the upper jaw.
    const screwHold = new THREE.Group(); screwHold.position.y = crestY - dir * 0.02;
    const screwFlip = new THREE.Group(); if (up) screwFlip.rotation.z = Math.PI;
    const screw = makeScrew(); screwFlip.add(screw); screwHold.add(screwFlip); g.add(screwHold);

    // abutment (gold-tone titanium collar + post)
    const ab = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.5, 8), goldTi); post.position.y = dir * -0.0 + (up ? -0.26 : 0.26);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 36), goldTi); collar.position.y = up ? -0.02 : 0.02;
    ab.add(post, collar); ab.position.y = crestY - dir * 0.02; g.add(ab);

    // crown
    const crown = new THREE.Mesh(toothGeometry(s.type), new THREE.MeshPhysicalMaterial({
      color: 0xfffcf6, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, emissive: TEAL, emissiveIntensity: 0,
    }));
    if (!up) crown.rotation.z = Math.PI;
    crown.position.y = s.meshY;
    g.add(crown);

    // bone block around the fixture (x-ray)
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.4, 1.75, 28, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0x2a8f89, transparent: true, opacity: 0.13, roughness: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    bone.position.y = crestY + dir * 0.82;
    const pts = [];
    for (let k = 0; k < 520; k++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 0.44;
      pts.push(Math.cos(a) * r, (Math.random() - 0.5) * 1.7, Math.sin(a) * r);
    }
    bone.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
      new THREE.PointsMaterial({ color: 0x9fe9df, size: 0.016, transparent: true, opacity: 0.6, depthWrite: false })));
    g.add(bone);

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.29, 64), new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = crestY; g.add(ring);

    // timing windows (q = 0..1 over the whole section)
    const t0 = up ? 0.05 : 0.52;
    return { s, up, dir, g, screwHold, screw, ab, crown, ring, crestY, bone, t0 };
  });

  // world positions for camera targets
  const tmp = new THREE.Vector3();
  function worldOf(job) { return root.localToWorld(tmp.set(job.s.p.x, job.crestY, job.s.p.z).clone()); }

  let q = 0, mx = 0, fit = 1;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; });

  function setProgress(v) { q = Math.min(1, Math.max(0, v)); }
  function applyOffset() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    fit = Math.max(1, 1.1 / camera.aspect);
    if (innerWidth >= 700) camera.setViewOffset(w, h, w * 0.2, 0, w, h); else camera.clearViewOffset();
  }
  function resize() { if (stage.resize()) applyOffset(); }
  addEventListener('resize', resize); resize();

  const stepsState = [false, false, false];
  let jawLabel = 'Arcada superior';
  const clock = new THREE.Clock();
  const progress = [];
  function render() {
    const t = clock.getElapsedTime();
    jobs.forEach((j, idx) => {
      const a = easeOut(ss(j.t0, j.t0 + 0.15, q));
      const b = easeOut(ss(j.t0 + 0.17, j.t0 + 0.25, q));
      const c = easeOut(ss(j.t0 + 0.27, j.t0 + 0.37, q));
      const far = 2.4 * (j.up ? -1 : 1);                      // inserted from the crown side
      j.screwHold.position.y = j.crestY - j.dir * 0.02 + far * (1 - a);
      j.screw.rotation.y = (1 - a) * Math.PI * 7;
      j.screwHold.visible = a > 0.001;
      j.ab.position.y = j.crestY - j.dir * 0.02 + far * (1 - b);
      j.ab.visible = b > 0.001;
      j.crown.position.y = j.s.meshY + far * 1.05 * (1 - c);
      j.crown.visible = c > 0.001;
      j.crown.material.emissiveIntensity = Math.max(0, 1 - Math.abs(c - 0.97) / 0.06) * 0.6;
      j.ring.material.opacity = (Math.max(0, 1 - Math.abs(a - 0.96) / 0.08) + Math.max(0, 1 - Math.abs(c - 0.96) / 0.08)) * 0.9;
      j.ring.scale.setScalar(1 + (a > 0.9 ? (a - 0.9) * 22 : 0));
      progress[idx] = [a > 0.5, b > 0.5, c > 0.5];
    });
    const lowerPhase = q >= 0.5;
    const cur = progress[lowerPhase ? 1 : 0] || [false, false, false];
    stepsState[0] = cur[0]; stepsState[1] = cur[1]; stepsState[2] = cur[2];
    jawLabel = lowerPhase ? 'Arcada inferior' : 'Arcada superior';

    // camera: upper site -> lower site -> wide shot
    const up = jobs.find(j => j.up) || jobs[0], lo = jobs.find(j => !j.up) || jobs[1];
    const Tu = worldOf(up).clone(), Tl = worldOf(lo).clone(), C = new THREE.Vector3(0, -0.15, -0.3);
    const w1 = ss(0.42, 0.58, q), w2 = ss(0.88, 1.0, q);
    const target = Tu.lerp(C, 0.6).lerp(Tl.lerp(C, 0.6), w1).lerp(C, w2);
    const dist = lerp(8.2, 9.6, w2) * fit;
    const ang = -0.5 + q * 0.6 + mx * 0.3;
    camera.position.set(target.x + Math.sin(ang) * dist, target.y + lerp(0.05, 1.1, w1) + Math.sin(t * 0.5) * 0.04, target.z + Math.cos(ang) * dist);
    camera.lookAt(target);
    stage.render();
  }

  return {
    setProgress, render, resize,
    steps: () => stepsState,
    jaw: () => jawLabel,
  };
}
