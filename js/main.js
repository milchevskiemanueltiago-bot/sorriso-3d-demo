import { createTeeth } from './teeth.js';
import { createImplant } from './implant.js';

// Demo template: links open WhatsApp with the message pre-filled; the clinic picks the number later.
const WA = '';   // e.g. '5511999999999'
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEBUG = new URLSearchParams(location.search).has('debug');

// ---------- WhatsApp links with a pre-filled message per CTA ----------
$$('[data-wa]').forEach(a => {
  a.href = `https://wa.me/${WA}?text=${encodeURIComponent(a.dataset.wa)}`;
  a.target = '_blank'; a.rel = 'noopener';
});

// ---------- smooth scroll ----------
const lenis = window.Lenis && !reduce ? new window.Lenis({ lerp: 0.09, smoothWheel: true }) : null;
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const t = $(a.getAttribute('href')); if (!t) return;
  e.preventDefault(); lenis ? lenis.scrollTo(t, { offset: 0 }) : t.scrollIntoView({ behavior: 'smooth' });
}));

// ---------- hero face sequence ----------
const FRAMES = 100;
const frames = new Array(FRAMES);
const faceCanvas = $('#faceCanvas');
const fctx = faceCanvas.getContext('2d');
const FOCUS = { x: 0.45, y: 0.46 };   // face centre in the source frame
const MOUTH = { x: 0.48, y: 0.66 };   // where the camera dives in

document.body.classList.add('is-loading');
let loaded = 0;
const loaderBar = $('#loaderBar'), loaderPct = $('#loaderPct');
const ready = new Promise(res => {
  for (let i = 0; i < FRAMES; i++) {
    const img = new Image();
    img.decoding = 'async';
    img.src = `assets/seq/f${String(i + 1).padStart(3, '0')}.webp`;
    const done = () => {
      loaded++;
      const p = loaded / FRAMES;
      loaderBar.style.transform = `scaleX(${p})`;
      loaderPct.textContent = String(Math.round(p * 100)).padStart(2, '0');
      if (loaded === FRAMES) res();
    };
    img.onload = done; img.onerror = done;
    frames[i] = img;
  }
});

function sizeFace() {
  const dpr = Math.min(devicePixelRatio, 2);
  faceCanvas.width = Math.round(faceCanvas.clientWidth * dpr);
  faceCanvas.height = Math.round(faceCanvas.clientHeight * dpr);
}
function drawFace(idx, zoom) {
  const img = frames[idx];
  if (!img || !img.complete || !img.naturalWidth) return;
  const W = faceCanvas.width, H = faceCanvas.height, iw = img.naturalWidth, ih = img.naturalHeight;
  const wide = W > H * 1.15;
  // wide screens: whole head on the right; phones: head in the upper half, text below it
  const base = wide ? (H / ih) * 1.14 : (H * 0.5) / ih;
  const s = base * zoom;
  const zt = ss(1, 2.5, zoom);
  const fx = FOCUS.x + (MOUTH.x - FOCUS.x) * ss(1, 2.2, zoom);
  const fy = FOCUS.y + (MOUTH.y - FOCUS.y) * ss(1, 2.2, zoom);
  const targetX = wide ? W * (0.64 - 0.14 * zt) : W * 0.5;
  const targetY = wide ? H * 0.5 : H * (0.26 + 0.24 * zt);
  let dx = targetX - fx * iw * s, dy = targetY - fy * ih * s;
  if (iw * s >= W) dx = Math.min(0, Math.max(W - iw * s, dx));
  if (ih * s >= H) dy = Math.min(0, Math.max(H - ih * s, dy));
  fctx.globalCompositeOperation = 'source-over';
  fctx.clearRect(0, 0, W, H);
  fctx.drawImage(img, dx, dy, iw * s, ih * s);
  // feather any visible edge of the photo into the page background
  const feather = (x0, y0, x1, y1) => {
    const g = fctx.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i <= 8; i++) { const t = i / 8; g.addColorStop(t, `rgba(0,0,0,${(t * t * (3 - 2 * t)).toFixed(3)})`); }
    fctx.globalCompositeOperation = 'destination-in';
    fctx.fillStyle = g; fctx.fillRect(0, 0, W, H);
    fctx.globalCompositeOperation = 'source-over';
  };
  if (dx > -4) feather(dx, 0, dx + iw * s * 0.38, 0);
  if (dx + iw * s < W + 4) feather(dx + iw * s, 0, dx + iw * s * 0.62, 0);
  if (dy + ih * s < H - 4) feather(0, dy + ih * s, 0, dy + ih * s * 0.7);
}

// ---------- 3D ----------
const teeth = createTeeth($('#teethCanvas'));
const implant = createImplant($('#implantCanvas'));

// ---------- scroll state ----------
const hero = $('#hero'), intro = $('#heroIntro'), shade = $('#faceShade'), scanLine = $('#scanLine');
const teethCanvas = $('#teethCanvas'), hud = $('#hud'), hudItems = $$('#hud li'), rail = $('.rail'), railFill = $('#railFill');
const readout = $('#readout'), final = $('#heroFinal'), hint = $('#scrollHint'), nav = $('#nav'), waFloat = $('.wa-float');
const roPlaque = $('#roPlaque'), roAlign = $('#roAlign'), roShade = $('#roShade');
const implantSec = $('#implante'), hours = $('#hours'), steps = $$('#implantSteps li'), jawLabel = $('#jawLabel');

let forcedP = null;
function heroProgress() {
  if (forcedP !== null) return forcedP;
  const r = hero.getBoundingClientRect();
  return clamp(-r.top / (r.height - innerHeight));
}
function sectionProgress(el) {
  const r = el.getBoundingClientRect();
  return clamp(-r.top / (r.height - innerHeight));
}
const inView = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

let lastStep = -1;
function frame(time) {
  const p = heroProgress();
  const heroVisible = inView(hero);

  if (heroVisible) {
    // A · face: idle breathing loop, then scroll scrubs neutral → smile
    const idle = 10 + Math.sin(time / 900) * 8;
    const k = ss(0, 0.03, p);
    const scrub = 22 + 77 * ss(0.0, 0.24, p);
    const idx = Math.round(idle * (1 - k) + scrub * k);
    const zoom = 1 + 5.5 * Math.pow(ss(0.25, 0.42, p), 2.2);
    const faceOn = 1 - ss(0.37, 0.44, p);
    if (faceOn > 0) { drawFace(clamp(idx, 0, FRAMES - 1), zoom); }
    faceCanvas.style.opacity = faceOn;
    shade.style.opacity = 1 - ss(0.2, 0.3, p);
    intro.style.opacity = 1 - ss(0.1, 0.2, p);
    intro.style.transform = `translateY(${-60 * ss(0.08, 0.22, p)}px)`;
    intro.style.pointerEvents = p > 0.15 ? 'none' : '';
    hint.style.opacity = 1 - ss(0.01, 0.06, p);

    // scan line sweeps over the smile while we dive in
    const sc = ss(0.27, 0.38, p);
    scanLine.style.opacity = sc > 0 && sc < 1 ? Math.sin(sc * Math.PI) : 0;
    scanLine.style.transform = `translateY(${innerHeight * (0.15 + 0.75 * sc)}px)`;

    // B · 3D smile
    const k3 = clamp((p - 0.37) / 0.63);
    const on3 = ss(0.37, 0.45, p);
    teethCanvas.style.opacity = on3;
    if (on3 > 0) {
      teeth.setPhase(k3);
      teeth.render();
      const st = teeth.state;
      const step = st.veneer > 0.02 ? 3 : st.align > 0.02 ? 2 : st.clean > 0.02 ? 1 : 0;
      if (step !== lastStep) {
        hudItems.forEach((li, i) => { li.classList.toggle('is-on', i === step); li.classList.toggle('is-done', i < step); });
        lastStep = step;
      }
      const hudOn = ss(0.42, 0.47, p) * (1 - ss(0.92, 0.96, p));
      hud.style.opacity = hudOn; rail.style.opacity = hudOn; readout.style.opacity = hudOn;
      railFill.style.transform = `scaleY(${clamp((k3 - 0.06) / 0.86)})`;
      const ro = teeth.readout();
      roPlaque.textContent = ro.plaque + '%'; roAlign.textContent = ro.align + '%'; roShade.textContent = ro.shade;
    } else { hud.style.opacity = 0; rail.style.opacity = 0; readout.style.opacity = 0; }
    const fin = ss(0.94, 0.985, p);
    final.style.opacity = fin;
    final.style.transform = `translateY(${30 * (1 - fin)}px)`;
    final.style.pointerEvents = fin > 0.5 ? 'auto' : 'none';
  }

  // implant section
  if (inView(implantSec)) {
    const q = sectionProgress(implantSec);
    implant.setProgress(q);
    implant.render();
    hours.textContent = String(Math.round(24 * ss(0.05, 0.84, q))).padStart(2, '0');
    implant.steps().forEach((on, i) => steps[i].classList.toggle('is-on', on));
    jawLabel.textContent = implant.jaw();
  }

  nav.classList.toggle('is-solid', scrollY > 40);
  waFloat.classList.toggle('is-on', p > 0.12 || !heroVisible);
}

function loop(t) {
  lenis?.raf(t);
  frame(t);
  requestAnimationFrame(loop);
}

// ---------- reveal + tilt ----------
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.15 });
$$('.reveal').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 0.08}s`; io.observe(el); });

if (matchMedia('(hover:hover)').matches) {
  $$('[data-tilt]').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${x * 100}%`); card.style.setProperty('--my', `${y * 100}%`);
      card.style.transform = `rotateY(${(x - 0.5) * 10}deg) rotateX(${(0.5 - y) * 8}deg)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

// ---------- boot ----------
addEventListener('resize', () => { sizeFace(); teeth.resize(); implant.resize(); });
sizeFace();
ready.then(() => {
  $('#loader').classList.add('is-done');
  document.body.classList.remove('is-loading');
  document.documentElement.classList.add('is-ready');
  requestAnimationFrame(loop);
});

if (DEBUG) {
  window.__setP = v => { forcedP = v; };
  window.__teeth = teeth;
}
