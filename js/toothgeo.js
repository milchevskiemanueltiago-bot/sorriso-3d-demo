// Procedural tooth anatomy, one crown per type, shared by the hero arches and the implant scene.
// Local space: crown edge at y = -h (bottom), short root toward +y, labial face toward +z.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const TOOTH = {
  incisor:  { w: 0.43, d: 0.36, h: 1.05 },
  lateral:  { w: 0.34, d: 0.33, h: 0.95 },
  canine:   { w: 0.40, d: 0.42, h: 1.0 },
  premolar: { w: 0.36, d: 0.46, h: 0.86 },
  molar:    { w: 0.52, d: 0.56, h: 0.80 },
  lowInc:   { w: 0.28, d: 0.30, h: 0.92 },
};

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

function shape(x0, y0, z0, type) {
  const s = TOOTH[type];
  const anterior = type === 'incisor' || type === 'lateral' || type === 'lowInc';
  // superellipsoid base: squarer than a sphere, like an enamel crown
  const x = spow(x0, anterior ? 0.62 : 0.7), z = spow(z0, 0.72), y = spow(y0, 0.78);
  const t = (1 - y) / 2;                              // 0 = root tip, 1 = crown edge
  let w = s.w, d = s.d;
  if (anterior) {
    w *= 1 + 0.18 * Math.pow(t, 1.3);                 // flare toward the incisal edge
    d *= 1 - 0.74 * Math.pow(t, 1.9);                 // chisel-thin edge
  } else if (type === 'canine') {
    w *= 1 - 0.28 * Math.pow(t, 2.2);
    d *= 1 - 0.42 * Math.pow(t, 1.5);
  } else {
    w *= 1 - 0.08 * Math.pow(t, 2.0);
  }
  const root = ss(0.2, 1.0, y);                       // taper into the gum
  w *= 1 - 0.46 * root; d *= 1 - 0.42 * root;
  // cervical constriction (the "neck" of the crown)
  const neck = Math.exp(-Math.pow((y - 0.12) * 3.2, 2));
  w *= 1 - 0.1 * neck; d *= 1 - 0.1 * neck;

  let X = x * w, Y = y * s.h * (y > 0 ? 0.42 : 1), Z = z * d;
  const crown = 1 - root;

  if (anterior) {
    // labial convexity + two soft developmental grooves
    Z += 0.06 * (1 - x * x) * Math.max(0, z0) * crown;
    Z += 0.012 * Math.cos(x0 * Math.PI * 2.4) * Math.max(0, z0) * crown * ss(0.2, 0.8, t);
    // lingual shovel concavity
    Z += 0.07 * (1 - x * x) * Math.max(0, -z0) * crown * ss(0.15, 0.7, t);
    // mamelons: scalloped incisal edge
    if (t > 0.8) {
      const k = (t - 0.8) / 0.2;
      Y += 0.03 * k * (0.5 - 0.5 * Math.cos(x0 * Math.PI * 3.0)) + 0.012 * k * Math.sin(x0 * 17.0);
    }
  } else if (type === 'canine') {
    Z += 0.06 * (1 - x * x) * Math.max(0, z0) * crown;
    if (t > 0.6) { const k = (t - 0.6) / 0.4; Y += 0.2 * k * k * Math.min(1, Math.abs(x0)) ; } // cusp tip drops to a point at x=0
    if (t > 0.6) Y -= 0.0;
  } else {
    // premolar / molar: cusps with a central fissure
    if (t > 0.74) {
      const k = (t - 0.74) / 0.26;
      const cu = type === 'molar' ? 2.0 : 1.0;
      const cusps = (0.5 + 0.5 * Math.cos(x0 * Math.PI * cu * 1.0)) * (0.5 + 0.5 * Math.cos(z0 * Math.PI * 1.0));
      Y += 0.1 * k * (1 - cusps) - 0.0;
      Y += 0.015 * k * Math.sin(x0 * 23 + z0 * 19);
    }
  }
  return [X, Y, Z];
}

export function toothGeometry(type, { half = false, seg = 72 } = {}) {
  let g = half
    ? new THREE.SphereGeometry(1, seg, seg, 0, Math.PI)
    : new THREE.SphereGeometry(1, seg, seg);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4);                           // weld the seam so normals are smooth everywhere
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = shape(p.getX(i), p.getY(i), p.getZ(i), type);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
