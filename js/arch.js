// Builds a full upper + lower dental arch: 28 individual crowns, a lofted gum band with
// papillae, tongue, mouth cavity and lips. Shared by the hero and the implant scene.
import * as THREE from 'three';
import { TOOTH, toothGeometry } from './toothgeo.js';
import { NOISE } from './noise.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const UPPER = ['incisor', 'lateral', 'canine', 'premolar', 'premolar', 'molar'];
const LOWER = ['lowInc', 'lowInc', 'canine', 'premolar', 'premolar', 'molar'];

export function createArches({ missing = [], mouth = true, gumOpacity = 1, dirty = true, seed = 7 } = {}) {
  let _s = seed;
  const rnd = () => (_s = (_s * 16807) % 2147483647) / 2147483647;
  const sr = a => (rnd() * 2 - 1) * a;

  const U = {
    uDirt: { value: dirty ? 1 : 0 }, uClean: { value: dirty ? 0 : 1.2 }, uWhite: { value: 0 },
    uScanY: { value: 9 }, uScan: { value: 0 }, uTime: { value: 0 }, uSweep: { value: -9 },
    uHealth: { value: dirty ? 0 : 1 },
  };

  // ---------------------------------------------------------------- materials
  function toothMaterial(seedv, cavity, size) {
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.27, clearcoat: 0.8, clearcoatRoughness: 0.1,
      sheen: 0.3, sheenColor: new THREE.Color(0xfff4dc), sheenRoughness: 0.5,
    });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U, { uSeed: { value: seedv }, uCavity: { value: cavity }, uH: { value: size.h }, uW: { value: size.w } });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uDirt,uClean,uWhite,uScanY,uScan,uTime,uSweep,uSeed,uCavity,uH,uW;
varying vec3 vLocal; varying vec3 vWPos;
${NOISE}
float gD; float gEdge; float gGrime;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float ly = vLocal.y / uH;                       // -1 crown edge .. +1 root
  vec3 q = vLocal + uSeed;
  float n1 = snoise(q*3.6), n2 = snoise(q*9.0+3.1), n3 = snoise(q*1.8-7.3);
  float neckW = smoothstep(-0.15, 0.5, ly);
  float edgeW = smoothstep(-0.5, -0.98, ly);
  vec3 cerv = vec3(0.93,0.85,0.70), body = vec3(0.96,0.94,0.89), edgeC = vec3(0.82,0.88,0.93);
  vec3 clean = mix(body, cerv, neckW);
  clean = mix(clean, edgeC, edgeW*0.75);
  clean *= 0.965 + 0.035*n3;
  float plaque = clamp(smoothstep(-0.75,-0.1, ly + n1*0.25) * (0.6 + 0.5*n2), 0., 1.);
  float tartar = clamp(smoothstep(-0.35,-0.05, ly + n2*0.12) * smoothstep(0.2,0.8, abs(vLocal.x)/uW + n1*0.3), 0., 1.);
  float cav = uCavity * smoothstep(0.3,0.38, snoise(q*2.6+11.0)) * smoothstep(-0.1,-0.4, ly);
  float t = snoise(q*3.1+5.0)*0.5+0.5;
  float keep = smoothstep(uClean-0.07, uClean, t);
  gD = uDirt * keep;
  gGrime = max(max(plaque, tartar), cav);
  gEdge = (1.0 - smoothstep(0.0,0.035, abs(t-uClean))) * step(0.001,uClean) * step(uClean,1.0) * (0.25+gGrime);
  vec3 dirtyC = vec3(0.80,0.66,0.40);
  vec3 col = mix(clean, dirtyC, gD*(0.55+0.45*n3));
  col = mix(col, vec3(0.78,0.60,0.22), gD*plaque*0.9);
  col = mix(col, vec3(0.40,0.29,0.14), gD*tartar*0.9);
  col = mix(col, vec3(0.08,0.05,0.03), gD*cav);
  vec3 porcelain = mix(vec3(1.0,0.99,0.965), vec3(0.88,0.93,0.97), edgeW*0.55);
  col = mix(col, porcelain, uWhite);
  diffuseColor.rgb = col;
}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 qq = vLocal + uSeed;
  float ridges = sin(vLocal.y*120.0 + snoise(qq*2.0)*2.0)*0.5;      // perikymata growth lines
  float micro = snoise(qq*38.0);
  float h = (ridges*0.016 + micro*0.010) * (1.0 - uWhite*0.9);
  h += gD * gGrime * snoise(qq*14.0) * 0.05;                        // lumpy plaque / tartar
  vec2 dh = vec2(dFdx(h), dFdy(h)) * 18.0;
  normal = bumpN(-vViewPosition, normal, dh, faceDirection);
}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.72, gD*gGrime);
roughnessFactor = mix(roughnessFactor, 0.12, uWhite);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec3 tealc = vec3(0.35,1.0,0.9);
  float band = exp(-pow((vWPos.y-uScanY)*9.0, 2.0));
  float grid = smoothstep(0.9,1.0,fract(vWPos.x*12.0)) + smoothstep(0.9,1.0,fract(vWPos.y*12.0));
  float passed = smoothstep(uScanY-0.05, uScanY+0.6, vWPos.y);
  totalEmissiveRadiance += tealc * uScan * (band*1.4 + grid*0.22*passed);
  totalEmissiveRadiance += tealc * gEdge * 2.2;
  float sw = (vWPos.x*0.55 + vWPos.y*0.35) - uSweep;
  totalEmissiveRadiance += vec3(1.0,0.97,0.9) * exp(-sw*sw*30.0) * 0.45 * uWhite;
  totalEmissiveRadiance += vec3(0.30,0.07,0.06) * 0.10 * smoothstep(0.0,0.8,vLocal.y/uH) * (1.0-uWhite*0.5);
}`);
    };
    m.customProgramCacheKey = () => 'tooth-v2';
    return m;
  }

  const gumMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.22,
    sheen: 1, sheenColor: new THREE.Color(0xff9aa6), sheenRoughness: 0.4, side: THREE.DoubleSide,
    transparent: gumOpacity < 1, opacity: gumOpacity, depthWrite: gumOpacity >= 1,
  });
  gumMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aV;\nvarying float vV;\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvV = aV;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uHealth; varying float vV; varying vec3 vWPos;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 marginC = mix(vec3(0.72,0.17,0.21), vec3(0.92,0.50,0.52), uHealth);
  vec3 attachC = mix(vec3(0.70,0.14,0.19), vec3(0.88,0.40,0.44), uHealth);
  vec3 mucC    = mix(vec3(0.55,0.08,0.13), vec3(0.70,0.20,0.26), uHealth);
  vec3 c = mix(marginC, attachC, smoothstep(0.0,0.22,vV));
  c = mix(c, mucC, smoothstep(0.38,0.95,vV));
  c *= 0.94 + 0.06*snoise(vWPos*6.0);
  diffuseColor.rgb = c;
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  float h = snoise(vWPos*34.0)*0.5 + snoise(vWPos*14.0)*0.3;       // stippled attached gingiva
  vec2 dh = vec2(dFdx(h), dFdy(h)) * 1.0 * (1.0 - smoothstep(0.5,0.9,vV));
  normal = bumpN(-vViewPosition, normal, dh, faceDirection);
}`);
  };
  gumMat.customProgramCacheKey = () => 'gum-v1';

  // ---------------------------------------------------------------- layout
  const root = new THREE.Group();
  const teeth = [], veneers = [];

  function layout(types, upper) {
    const R = upper ? 3.05 : 2.78, D = upper ? 2.5 : 2.3;
    const N = 400, pts = [], len = [0];
    for (let i = 0; i <= N; i++) {
      const a = (-1 + 2 * i / N) * 1.25;
      pts.push(new THREE.Vector3(Math.sin(a) * R, 0, -(1 - Math.cos(a)) * D));
    }
    for (let i = 1; i <= N; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = len[N], mid = total / 2;
    const at = s => {
      s = clamp(s, 0, total);
      let i = 1; while (i < N && len[i] < s) i++;
      const k = (s - len[i - 1]) / (len[i] - len[i - 1] || 1);
      const p = pts[i - 1].clone().lerp(pts[i], k);
      const tg = pts[i].clone().sub(pts[i - 1]).normalize();
      return { p, n: new THREE.Vector3(-tg.z, 0, tg.x) };
    };
    const slots = [];
    for (const side of [-1, 1]) {
      let s = 0;
      types.forEach((type, idx) => {
        const S = TOOTH[type], wid = S.w * 2 * 0.98;
        const c = mid + side * (s + wid / 2);
        s += wid + 0.015;
        const { p, n } = at(c);
        const jaw = upper ? 'U' : 'L';
        slots.push({ type, idx, side, c, wid, p, n, S, jaw, upper,
          missing: missing.some(m => m.jaw === jaw && m.side === side && m.idx === idx) });
      });
    }
    slots.sort((a, b) => a.c - b.c);
    return { slots, at, total };
  }

  const meshY = (S, idx, upper) => upper ? S.h - 0.06 + 0.08 * idx * 0.4 : -S.h - 0.34 - 0.08 * idx * 0.3;
  const marginY = (sl) => meshY(sl.S, sl.idx, sl.upper) + (sl.upper ? 1 : -1) * 0.08 * sl.S.h;

  function placeTeeth(L) {
    for (const sl of L.slots) {
      if (sl.missing) continue;
      const { type, idx, side, S, p, n, upper } = sl;
      const pivot = new THREE.Group();
      pivot.position.copy(p);
      pivot.rotation.y = Math.atan2(n.x, n.z);
      const seedv = rnd() * 50;
      const cavity = (upper && ((idx === 1 && side === 1) || (idx === 4 && side === 1) || (idx === 5 && side === -1))) ||
                     (!upper && idx === 3 && side === -1) ? 1 : 0;
      const mesh = new THREE.Mesh(toothGeometry(type), toothMaterial(seedv, cavity, S));
      mesh.position.y = meshY(S, idx, upper);
      if (!upper) mesh.rotation.z = Math.PI;
      const crooked = {
        ry: sr(idx < 3 ? 0.42 : 0.18), rz: sr(idx < 3 ? 0.16 : 0.06), rx: sr(0.1),
        z: sr(idx < 3 ? 0.22 : 0.08), x: sr(0.05), y: sr(0.05),
      };
      if (idx === 1) crooked.z = (upper ? -0.26 : 0.2) * side;
      if (idx === 2 && upper) { crooked.z = 0.26; crooked.y = 0.12; }
      const inner = new THREE.Group(); inner.add(mesh); pivot.add(inner);
      root.add(pivot);
      const t = { pivot, inner, mesh, upper, idx, side, crooked };
      teeth.push(t);
      if (upper && idx <= 3) {
        const vm = new THREE.MeshPhysicalMaterial({
          color: 0xfffdf8, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03,
          ior: 1.6, specularIntensity: 1, transparent: true, opacity: 0, depthWrite: false,
          emissive: 0x7ff3e4, emissiveIntensity: 0, side: THREE.DoubleSide,
        });
        const v = new THREE.Mesh(toothGeometry(type, { half: true, seg: 56 }), vm);
        v.scale.set(1.06, 1.0, 1.12);
        v.position.copy(mesh.position);
        v.renderOrder = 2;
        inner.add(v);
        veneers.push({ v, t, order: idx });
      }
    }
  }

  // ---------------------------------------------------------------- gum band
  const PROFILE = [ // [lateral offset, distance toward the root, v]
    [-0.17, 0.00, 0.00], [-0.28, 0.16, 0.10], [-0.50, 0.45, 0.36], [-0.62, 0.85, 0.66], [-0.42, 1.15, 0.90],
    [0.00, 1.25, 1.00], [0.32, 1.12, 0.90], [0.42, 0.80, 0.66], [0.40, 0.45, 0.36], [0.30, 0.17, 0.12], [0.18, 0.00, 0.00],
  ];
  function buildGum(L) {
    const sorted = L.slots, upper = sorted[0].upper, dir = upper ? 1 : -1;
    const first = sorted[0], last = sorted[sorted.length - 1];
    const s0 = first.c - first.wid / 2 - 0.55, s1 = last.c + last.wid / 2 + 0.55;
    const M = 260, P = PROFILE.length;
    const meanMargin = sorted.reduce((a, sl) => a + marginY(sl), 0) / sorted.length;
    const pos = new Float32Array((M + 1) * P * 3), av = new Float32Array((M + 1) * P);
    for (let m = 0; m <= M; m++) {
      const s = s0 + (s1 - s0) * m / M;
      const { p, n } = L.at(s);
      let bi = 0, bd = 1e9;
      sorted.forEach((sl, i) => { const d = Math.abs(s - sl.c); if (d < bd) { bd = d; bi = i; } });
      const sl = sorted[bi];
      const t = clamp((s - sl.c) / (sl.wid / 2), -1, 1);
      const nj = sorted[bi + (t > 0 ? 1 : -1)] || sl;
      const q = Math.pow(Math.abs(t), 1.7);
      const mi = marginY(sl), mb = (mi + marginY(nj)) / 2;
      const endClose = 1 - ss(0, 0.5, Math.min(s - s0, s1 - s));
      const gap = Math.max(sl.missing ? 1 : 0, nj.missing ? ss(0.5, 1, Math.abs(t)) : 0);
      const closed = Math.max(gap, endClose);
      const papillae = 0.2 * sl.S.h * (1 - closed);
      const my = mi + (mb - mi) * q - dir * papillae * q;
      const flat = meanMargin;                       // upper parts of the gum ignore the papillae scallops
      for (let k = 0; k < P; k++) {
        const [on, oy, v] = PROFILE[k];
        let offN = on, offY = oy * 0.72;
        if (k === 0 || k === P - 1) { offN *= (1 - closed * 0.9); offY -= closed * 0.14; }
        else if (k === 1 || k === P - 2) { offN *= (1 - closed * 0.6); offY -= closed * 0.07; }
        const i3 = (m * P + k) * 3;
        pos[i3] = p.x + n.x * offN;
        const wS = 1 - ss(0.0, 0.5, v);
        pos[i3 + 1] = (flat + (my - flat) * wS) + dir * offY;
        pos[i3 + 2] = p.z + n.z * offN;
        av[m * P + k] = v;
      }
    }
    const idx = [];
    for (let m = 0; m < M; m++) for (let k = 0; k < P - 1; k++) {
      const a = m * P + k, b = a + 1, c = a + P, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aV', new THREE.BufferAttribute(av, 1));
    g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, gumMat);
    root.add(mesh);
    return mesh;
  }

  const LU = layout(UPPER, true), LL = layout(LOWER, false);
  placeTeeth(LU); placeTeeth(LL);
  const gums = [buildGum(LU), buildGum(LL)];

  // ---------------------------------------------------------------- mouth
  const mouthGroup = new THREE.Group(); root.add(mouthGroup);
  let cavity = null, tongue = null;
  if (mouth) {
    cavity = new THREE.Mesh(new THREE.SphereGeometry(4.0, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x1d0709, side: THREE.BackSide, transparent: true }));
    cavity.scale.set(1.2, 0.78, 1.0); cavity.position.set(0, -0.55, -3.1);
    mouthGroup.add(cavity);

    const tg = new THREE.SphereGeometry(1, 72, 52);
    const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
      const n = Math.sin(x * 9 + z * 7) * Math.sin(y * 8 + x * 5) * 0.02 + Math.sin(x * 23 + z * 19) * 0.006;
      tp.setXYZ(i, x * (1 + n), y * (1 + n) - 0.12 * Math.max(0, y) * x * x, z * (1 + n));
    }
    tg.computeVertexNormals();
    tongue = new THREE.Mesh(tg, new THREE.MeshPhysicalMaterial({
      color: 0xd47f86, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xffb4ba), clearcoat: 0.4, transparent: true,
    }));
    tongue.scale.set(1.75, 0.55, 1.55); tongue.position.set(0, -1.45, -1.95);
    mouthGroup.add(tongue);

  }

  // implant sites (root space) for the implant scene
  const sites = [...LU.slots, ...LL.slots].filter(s => s.missing).map(s => ({
    jaw: s.jaw, upper: s.upper, idx: s.idx, side: s.side, type: s.type, S: s.S,
    p: s.p.clone(), rotY: Math.atan2(s.n.x, s.n.z), meshY: meshY(s.S, s.idx, s.upper), marginY: marginY(s),
  }));

  return { root, teeth, veneers, gums, gumMat, U, mouth: { group: mouthGroup, cavity, tongue }, sites };
}
