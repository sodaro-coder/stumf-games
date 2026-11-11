// Combat effects: what bullets, blades, grenades and fire leave behind. Everything is pooled (fixed-size rings of
// meshes and sprites, the oldest reused), textures are painted once on small canvases, and no light is ever added or
// removed at runtime (one muzzle light and one blast light live in the scene from the start, so no shader recompiles).
//
//   bullet holes per material (concrete crater + cracks, splintered wood, bright dented metal, a dust mark on soft
//   ground) with dust and chips that match; sparks that ricochet off metal; blood that sprays in the shot's direction
//   and splats on whatever is behind the victim (drying darker over a minute); a pool spreading under the dead; HE
//   shrapnel sparks that bounce off the floor, a flash and a scorch mark; smoke that fills the room it lands in (it
//   floods the floor cells around it and stops at walls), that bullets punch holes through and blasts push away; fire
//   that runs over the ground and down slopes; ripples in water; barrel smoke after a burst; dropped magazines; knife
//   gouges on walls.
import * as THREE from '../sdk/three.module.min.js';
import { litPatch } from './world.js';
import { loadGLB, modelManifest } from './glb.js';

const rnd = (a, b) => a + Math.random() * (b - a);
function canvasTex(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); paint(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// ---- painted textures ----
const holeTex = {
  concrete: () => canvasTex(128, (g, s) => {
    const c = s / 2, gr = g.createRadialGradient(c, c, 2, c, c, c * 0.95);
    gr.addColorStop(0, 'rgba(10,9,8,1)'); gr.addColorStop(0.16, 'rgba(25,23,20,.95)'); gr.addColorStop(0.3, 'rgba(90,86,80,.75)'); gr.addColorStop(0.55, 'rgba(150,146,138,.35)'); gr.addColorStop(1, 'rgba(160,156,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(30,28,25,.7)'; g.lineWidth = 1.2;
    for (let k = 0; k < 7; k++) { let a = Math.random() * 6.28, x = c, y = c; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { a += rnd(-0.5, 0.5); x += Math.cos(a) * rnd(5, 11); y += Math.sin(a) * rnd(5, 11); g.lineTo(x, y); } g.stroke(); }
  }),
  wood: () => canvasTex(128, (g, s) => {
    const c = s / 2; g.fillStyle = 'rgba(18,10,4,1)'; g.beginPath(); g.ellipse(c, c, 9, 7, 0, 0, 6.28); g.fill();
    for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28, L = rnd(12, 30); g.strokeStyle = k % 2 ? 'rgba(220,180,120,.85)' : 'rgba(60,35,15,.8)'; g.lineWidth = rnd(1, 3); g.beginPath(); g.moveTo(c + Math.cos(a) * 6, c + Math.sin(a) * 6); g.lineTo(c + Math.cos(a) * L, c + Math.sin(a) * L * 0.6); g.stroke(); }
  }),
  metal: () => canvasTex(128, (g, s) => {
    const c = s / 2, gr = g.createRadialGradient(c, c, 1, c, c, c * 0.6);
    gr.addColorStop(0, 'rgba(20,20,22,1)'); gr.addColorStop(0.25, 'rgba(40,40,44,.9)'); gr.addColorStop(0.32, 'rgba(235,235,230,.95)'); gr.addColorStop(0.55, 'rgba(200,200,195,.5)'); gr.addColorStop(1, 'rgba(180,180,175,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }),
  soft: () => canvasTex(64, (g, s) => {
    const c = s / 2, gr = g.createRadialGradient(c, c, 1, c, c, c);
    gr.addColorStop(0, 'rgba(40,32,22,.8)'); gr.addColorStop(0.4, 'rgba(70,58,40,.45)'); gr.addColorStop(1, 'rgba(80,66,46,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }),
};
const splatTex = () => canvasTex(256, (g, s) => {   // a high-velocity spatter: a dense centre, droplets and streaks outwards
  const c = s / 2; g.fillStyle = 'rgba(255,255,255,1)';
  for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(c + rnd(-14, 14), c + rnd(-10, 10), rnd(10, 26), rnd(8, 18), rnd(0, 3), 0, 6.28); g.fill(); }
  for (let k = 0; k < 70; k++) { const a = rnd(-0.9, 0.9), d = rnd(20, 120), r = rnd(1, 5) * (1 - d / 140); g.globalAlpha = rnd(0.6, 1); g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d * 0.7, Math.max(0.6, r), 0, 6.28); g.fill(); }
  for (let k = 0; k < 10; k++) { const a = rnd(-0.6, 0.6), d0 = rnd(25, 40), d1 = d0 + rnd(20, 60); g.globalAlpha = 0.8; g.lineWidth = rnd(1.5, 3.5); g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(c + Math.cos(a) * d0, c + Math.sin(a) * d0 * 0.7); g.lineTo(c + Math.cos(a) * d1, c + Math.sin(a) * d1 * 0.7); g.stroke(); }
});
const poolTex = () => canvasTex(256, (g, s) => {   // a pool: lobes that ran into each other, a soft feathered edge, a darker rim where it thickens
  const c = s / 2; g.filter = 'blur(3px)';
  g.fillStyle = 'rgb(150,150,150)'; for (let k = 0; k < 12; k++) { g.beginPath(); g.ellipse(c + rnd(-30, 30), c + rnd(-30, 30), rnd(44, 72), rnd(38, 62), rnd(0, 3), 0, 6.28); g.fill(); }
  g.fillStyle = 'rgb(255,255,255)'; for (let k = 0; k < 12; k++) { g.beginPath(); g.ellipse(c + rnd(-26, 26), c + rnd(-26, 26), rnd(36, 62), rnd(30, 52), rnd(0, 3), 0, 6.28); g.fill(); }
  g.filter = 'none'; for (let k = 0; k < 18; k++) { g.fillStyle = 'rgba(255,255,255,.9)'; const a = rnd(0, 6.28), d = rnd(70, 100); g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, rnd(2, 6), 0, 6.28); g.fill(); }   // satellite drops
});
// Blood that reads as liquid (Medium and up): the textures carry the shape in G (a crisp, irregular edge: blood has
// surface tension, it doesn't feather) and the thickness in R (deepest inside, a rounded meniscus at the edge), which
// bumps the lighting so the sun and the sky slide over a wet, raised film. Colour comes from the material.
function liquidTex(w, h, paint, soften = 7) {
  const a = document.createElement('canvas'); a.width = w; a.height = h; const g = a.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; paint(g, w, h);
  const b = document.createElement('canvas'); b.width = w; b.height = h; const gb = b.getContext('2d'); gb.filter = `blur(${soften}px)`; gb.drawImage(a, 0, 0);
  const ga = document.createElement('canvas'); ga.width = w; ga.height = h; const gg = ga.getContext('2d'); gg.filter = 'blur(0.7px)'; gg.drawImage(a, 0, 0);
  const M = gg.getImageData(0, 0, w, h), H = gb.getImageData(0, 0, w, h);
  for (let i = 0; i < M.data.length; i += 4) { const m = M.data[i], hh = H.data[i]; M.data[i] = Math.min(255, Math.round(Math.pow(hh / 255, 0.6) * m)); M.data[i + 1] = m; M.data[i + 2] = 0; M.data[i + 3] = 255; }
  gg.filter = 'none'; gg.putImageData(M, 0, 0);
  const t = new THREE.CanvasTexture(ga); t.colorSpace = THREE.NoColorSpace; return t;
}
const blob = (g, cx, cy, r, k = 0.22, n = 7) => {   // an irregular closed outline (a few harmonics on a circle)
  const ph = Array.from({ length: n }, () => Math.random() * 6.28), am = Array.from({ length: n }, (_, j) => k * rnd(0.3, 1) / (j + 1));
  g.beginPath(); for (let i = 0; i <= 72; i++) { const a = i / 72 * 6.283; let rr = 1; for (let j = 0; j < n; j++) rr += am[j] * Math.sin((j + 2) * a + ph[j]); const x = cx + Math.cos(a) * r * rr, y = cy + Math.sin(a) * r * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.fill();
};
const poolLiquid = () => liquidTex(256, 256, (g, s) => {
  const c = s / 2; blob(g, c, c, s * 0.3, 0.28, 8);
  for (let k = 0; k < 5; k++) { const a = rnd(0, 6.28), d = rnd(20, 50); blob(g, c + Math.cos(a) * d, c + Math.sin(a) * d, rnd(16, 34), 0.3, 5); }   // lobes where it ran
  for (let k = 0; k < 3; k++) { const a = rnd(0, 6.28); g.lineWidth = rnd(5, 9); g.lineCap = 'round'; g.beginPath(); g.moveTo(c + Math.cos(a) * 60, c + Math.sin(a) * 60); g.quadraticCurveTo(c + Math.cos(a + 0.2) * 90, c + Math.sin(a + 0.2) * 90, c + Math.cos(a + 0.1) * rnd(100, 118), c + Math.sin(a + 0.1) * rnd(100, 118)); g.stroke(); }   // runnels
  for (let k = 0; k < 14; k++) { const a = rnd(0, 6.28), d = rnd(92, 120); g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, rnd(1.5, 4.5), 0, 6.28); g.fill(); }
}, 9);
const sprayLiquid = () => liquidTex(256, 256, (g, s) => {   // a shot's spray: a dense patch, then droplets stretched along the shot (+x) with tails
  const c = s / 2; blob(g, c - 40, c, 22, 0.35, 6);
  for (let k = 0; k < 60; k++) { const d = rnd(-10, 120), sp = rnd(-1, 1) * (12 + d * 0.35), r = Math.max(0.8, rnd(1, 5) * (1 - d / 160)), L = r * rnd(1.5, 4) * (0.5 + d / 80);
    g.beginPath(); g.ellipse(c - 40 + d, c + sp, L, r, 0, 0, 6.28); g.fill(); g.lineWidth = Math.max(0.6, r * 0.45); g.beginPath(); g.moveTo(c - 40 + d - L, c + sp); g.lineTo(c - 40 + d - L - rnd(4, 14), c + sp); g.stroke(); }
}, 4);
const dripLiquid = () => liquidTex(64, 256, (g, w, h) => {   // runs down a wall: a bead at the top, trails of different lengths ending in a drop
  blob(g, w / 2, 14, 12, 0.3, 5);
  for (let k = 0; k < 3; k++) { const x = w / 2 + rnd(-12, 12), L = rnd(0.45, 0.97) * h, lw = rnd(2.5, 5); g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, 14); g.bezierCurveTo(x + rnd(-3, 3), L * 0.4, x + rnd(-3, 3), L * 0.7, x + rnd(-2, 2), L - 6); g.stroke(); g.beginPath(); g.ellipse(x, L - 5, lw * 0.9, lw * 1.4, 0, 0, 6.28); g.fill(); }
}, 3);
const woundTex = () => canvasTex(128, (g, s) => {   // an entry wound in cloth: torn fabric, raw red meat, a black hole, blood soaking out and down
  const c = s / 2;
  g.fillStyle = 'rgba(40,3,3,.85)'; blob(g, c, c + 14, 30, 0.35, 6); g.fillStyle = 'rgba(40,3,3,.6)'; g.beginPath(); g.ellipse(c + 3, c + 44, 9, 18, 0, 0, 6.28); g.fill();   // soaked fabric, running down
  g.fillStyle = 'rgba(70,6,6,1)'; blob(g, c, c, 16, 0.4, 7);
  g.fillStyle = 'rgba(140,22,18,1)'; blob(g, c, c, 11, 0.45, 7);   // raw meat
  for (let k = 0; k < 9; k++) { const a = rnd(0, 6.28); g.fillStyle = k % 2 ? 'rgba(190,60,50,1)' : 'rgba(90,10,10,1)'; g.beginPath(); g.ellipse(c + Math.cos(a) * 8, c + Math.sin(a) * 8, rnd(1.5, 3.5), rnd(1, 2), a, 0, 6.28); g.fill(); }
  g.fillStyle = 'rgba(8,1,1,1)'; blob(g, c, c, 5, 0.3, 5);   // the hole
  g.strokeStyle = 'rgba(30,26,22,.9)'; g.lineWidth = 1.2; for (let k = 0; k < 10; k++) { const a = rnd(0, 6.28); g.beginPath(); g.moveTo(c + Math.cos(a) * 13, c + Math.sin(a) * 13); g.lineTo(c + Math.cos(a) * rnd(16, 22), c + Math.sin(a) * rnd(16, 22)); g.stroke(); }   // torn threads
});
const scorchTex = () => canvasTex(256, (g, s) => {
  const c = s / 2, gr = g.createRadialGradient(c, c, 4, c, c, c);
  gr.addColorStop(0, 'rgba(8,7,6,.95)'); gr.addColorStop(0.35, 'rgba(20,18,15,.75)'); gr.addColorStop(0.7, 'rgba(30,26,22,.3)'); gr.addColorStop(1, 'rgba(30,26,22,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(10,9,8,.6)'; for (let k = 0; k < 24; k++) { const a = Math.random() * 6.28; g.lineWidth = rnd(1, 3); g.beginPath(); g.moveTo(c + Math.cos(a) * 30, c + Math.sin(a) * 30); g.lineTo(c + Math.cos(a) * rnd(70, 120), c + Math.sin(a) * rnd(70, 120)); g.stroke(); }
});
const gougeTex = () => canvasTex(128, (g, s) => {   // a knife scrape: a long bright-edged groove
  g.fillStyle = 'rgba(25,22,20,.9)'; g.beginPath(); g.ellipse(s / 2, s / 2, s * 0.46, 3, 0, 0, 6.28); g.fill();
  g.fillStyle = 'rgba(210,205,195,.7)'; g.beginPath(); g.ellipse(s / 2, s / 2 - 3, s * 0.42, 1.2, 0, 0, 6.28); g.fill();
});
const softTex = () => canvasTex(64, (g, s) => { const c = s / 2, gr = g.createRadialGradient(c, c, 1, c, c, c); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
const ringTex = () => canvasTex(128, (g, s) => { const c = s / 2; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 5; g.beginPath(); g.arc(c, c, c - 6, 0, 6.28); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, c - 14, 0, 6.28); g.stroke(); });

const MAT_CLASS = { metal: 'metal', cred: 'metal', cblue: 'metal', cgreen: 'metal', corange: 'metal', bus: 'metal', potty: 'metal', steel: 'metal',
  wood: 'wood', crate: 'wood', darkwood: 'wood', fence: 'wood', sand: 'soft', dirt: 'soft', grass: 'soft', snow: 'soft', carpet: 'soft', water: 'water' };
export const matClass = (m) => MAT_CLASS[m] || 'concrete';

export function createCombatFx({ scene, W: W0, parts, audio, cam, hq = true, ultra = false }) {
  let W = W0;
  const root = new THREE.Group(); root.name = 'combatfx'; scene.add(root);
  const T = { concrete: holeTex.concrete(), wood: holeTex.wood(), metal: holeTex.metal(), soft: holeTex.soft(), splat: liquidTex(256, 256, (g, sz) => { const t0 = splatTex(); g.drawImage(t0.image, 0, 0); t0.dispose(); }, 4), pool: poolLiquid(), spray: sprayLiquid(), drip: dripLiquid(), wound: woundTex(), scorch: scorchTex(), gouge: gougeTex(), soft2: softTex(), ring: ringTex() };
  const plane = new THREE.PlaneGeometry(1, 1);
  const decalMat = (map, color = 0xffffff, opacity = 1) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  // blood (Medium and up): lit like everything else (dark in the shade, never glowing), wet and glossy while fresh so it
  // catches the sky and the sun, then duller and browner as it dries
  // the liquid textures: shape in G (alphaMap), thickness in R (bumpMap). Fresh blood is near-black red with a mirror
  // film on top (the sky and sun reflect in it); it dulls, browns and goes matte as it dries or soaks into sand.
  const bloodMat = (map, color, opacity = 1) => {
    if (!hq) return new THREE.MeshBasicMaterial({ color: 0x3a0303, alphaMap: map, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const m = new THREE.MeshStandardMaterial({ color: FRESH, alphaMap: map, bumpMap: map, bumpScale: 1.6, transparent: true, opacity, roughness: 0.12, metalness: 0, envMapIntensity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    return litPatch(m, 'dyn');
  };

  const FRESH = new THREE.Color().setRGB(0.05, 0.0025, 0.002, THREE.LinearSRGBColorSpace), DRY = new THREE.Color().setRGB(0.022, 0.007, 0.0045, THREE.LinearSRGBColorSpace), SOAK = new THREE.Color().setRGB(0.03, 0.006, 0.004, THREE.LinearSRGBColorSpace);
  const LOWF = new THREE.Color(0x3a0303), LOWD = new THREE.Color(0x24100a);
  // a ring of decals of one kind: placed on a surface (position + normal), the oldest reused
  function ring(n, mat, life = Infinity) {
    const list = [], ms = [];
    return {
      add(p, nrm, size, spin = Math.random() * 6.28, stretch = 1, opts = {}) {
        let d = list.length >= n ? list.shift() : null;
        if (!d) { const m = new THREE.Mesh(plane, opts.own ? mat.clone() : mat); m.renderOrder = 2; d = { m }; root.add(m); ms.push(m); }
        const m = d.m; m.position.set(p.x + nrm.x * 0.012, p.y + nrm.y * 0.012, p.z + nrm.z * 0.012);
        if (opts.along && nrm.y > 0.9) m.rotation.set(-Math.PI / 2, 0, Math.atan2(-opts.along.z, opts.along.x));   // on the floor: the streaks point the way the blood flew
        else { m.lookAt(p.x + nrm.x, p.y + nrm.y, p.z + nrm.z); m.rotateZ(opts.along ? Math.atan2(opts.along.y, opts.along.x * nrm.z - opts.along.z * nrm.x) : spin); }   // on a wall: along the shot's path across it m.scale.set(size * stretch, size, 1); m.visible = true;
        d.t = 0; d.life = opts.life ?? life; d.grow = opts.grow || 0; d.size = size; d.max = opts.max || size; d.dry = opts.dry || 0; d.op = opts.opacity ?? 1; d.stretch = stretch;
        d.r0 = opts.soak ? 0.75 : 0.12; d.r1 = opts.soak ? 0.95 : 0.7; d.c0 = opts.soak ? SOAK : FRESH; d.drip = opts.drip || 0; d.len = 0.02;
        if (d.drip) { d.top = d.top || new THREE.Vector3(); d.top.set(p.x + nrm.x * 0.013, p.y, p.z + nrm.z * 0.013); d.floor = opts.floor ?? -1e9; m.scale.set(size, d.len, 1); }
        if (opts.own) { m.material.opacity = d.op; if (m.material.isMeshStandardMaterial) { m.material.color.copy(d.c0); m.material.roughness = d.r0; } else m.material.color.copy(LOWF); }
        list.push(d); return d;
      },
      tick(dt) {
        for (let i = list.length - 1; i >= 0; i--) {
          const d = list[i]; d.t += dt;
          if (d.grow && d.size < d.max) { d.size = Math.min(d.max, d.size + d.grow * dt * (1 - d.size / d.max * 0.8)); d.m.scale.set(d.size * d.stretch, d.size, 1); }   // creeps out, slower as it thins
          if (d.drip && d.len < d.drip) {   // a run down a wall: grows downward from where it landed, stops at the floor
            d.len = Math.min(d.drip, d.len + dt * 0.35 * (1 - d.len / d.drip * 0.85), Math.max(0.02, d.top.y - d.floor)); d.m.scale.y = d.len; d.m.position.set(d.top.x, d.top.y - d.len / 2, d.top.z);
          }
          if (d.dry && d.m.material.color && d.m.material !== mat) { const k = Math.min(1, d.t / d.dry); if (d.m.material.isMeshStandardMaterial) { d.m.material.color.copy(d.c0).lerp(DRY, k); d.m.material.roughness = d.r0 + (d.r1 - d.r0) * k * k; } else d.m.material.color.copy(LOWF).lerp(LOWD, k); }   // fresh wet near-black red to dried brown-black, glossy to matte
          if (d.t > d.life) { const f = Math.max(0, 1 - (d.t - d.life) / 3); if (d.m.material.opacity !== undefined && d.m.material !== mat) d.m.material.opacity = d.op * f; if (f <= 0) { d.m.visible = false; list.splice(i, 1); } }
        }
      },
      clear() { for (const d of list) d.m.visible = false; list.length = 0; },
    };
  }
  const holes = { concrete: ring(70, decalMat(T.concrete)), wood: ring(40, decalMat(T.wood)), metal: ring(40, decalMat(T.metal)), soft: ring(40, decalMat(T.soft, 0xffffff, 0.8)) };
  const splats = ring(ultra ? 160 : hq ? 96 : 48, bloodMat(T.splat), 70), sprays = ring(ultra ? 64 : hq ? 40 : 16, bloodMat(T.spray), 90), drips = ring(ultra ? 48 : hq ? 28 : 10, bloodMat(T.drip), 120), pools = ring(ultra ? 32 : 24, bloodMat(T.pool, 0, 0.97), 90), scorches = ring(10, decalMat(T.scorch), 120), gouges = ring(24, decalMat(T.gouge), 120);

  // ---- glowing sparks: additive, gravity, bounce off the floor, cool from white-yellow to orange and die ----
  const SPK = hq ? 260 : 120, spGeo = new THREE.BufferGeometry(), spPos = new Float32Array(SPK * 6), spCol = new Float32Array(SPK * 6);
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
  const sparkLines = new THREE.LineSegments(spGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparkLines.frustumCulled = false; root.add(sparkLines);
  const sp = Array.from({ length: SPK }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, life: 0 })); let spi = 0;
  function sparks(x, y, z, n, { dir = null, speed = 6, up = 2, life = 0.45, cone = 1 } = {}) {
    for (let k = 0; k < n; k++) {
      const s = sp[spi = (spi + 1) % SPK], a = Math.random() * 6.28, el = rnd(-1, 1), sv = speed * rnd(0.4, 1.2);
      let vx = Math.cos(a) * Math.sqrt(1 - el * el), vy = el, vz = Math.sin(a) * Math.sqrt(1 - el * el);
      if (dir) { vx = dir.x + vx * cone; vy = dir.y + vy * cone; vz = dir.z + vz * cone; const L = Math.hypot(vx, vy, vz) || 1; vx /= L; vy /= L; vz /= L; }
      Object.assign(s, { x, y, z, vx: vx * sv, vy: vy * sv + up * Math.random(), vz: vz * sv, t: 0, life: life * rnd(0.5, 1.3) });
    }
  }
  function tickSparks(dt) {
    for (let i = 0; i < SPK; i++) {
      const s = sp[i], o = i * 6;
      if (s.t >= s.life) { spPos.fill(0, o, o + 6); spCol.fill(0, o, o + 6); continue; }
      s.t += dt; s.vy -= 9.8 * dt; const px = s.x, py = s.y, pz = s.z; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      const gy = W ? W.groundAt(s.x, s.z, py + 0.2) : 0; if (s.y < gy) { s.y = gy + 0.002; s.vy *= -0.35; s.vx *= 0.6; s.vz *= 0.6; }
      const k = 1 - s.t / s.life, tail = 0.018 / Math.max(0.004, dt);
      spPos[o] = s.x; spPos[o + 1] = s.y; spPos[o + 2] = s.z; spPos[o + 3] = s.x - (s.x - px) * tail * 0.5; spPos[o + 4] = s.y - (s.y - py) * tail * 0.5; spPos[o + 5] = s.z - (s.z - pz) * tail * 0.5;
      const r = 1.6 * k, gC = (0.5 + 0.6 * k) * k, b = 0.35 * k * k; spCol[o] = r; spCol[o + 1] = gC; spCol[o + 2] = b; spCol[o + 3] = r * 0.4; spCol[o + 4] = gC * 0.3; spCol[o + 5] = 0;
    }
    spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
  }

  // ---- lights that already exist: the muzzle flash and the blast light only change intensity ----
  const muzzle = new THREE.PointLight(0xffc070, 0, 7, 2), blast = new THREE.PointLight(0xffa040, 0, 16, 2);
  root.add(muzzle); root.add(blast); let muzzleT = 0, blastT = 0;

  // ---- blood mist: soft red sprites that puff out along the shot and sink ----
  const mistMat = new THREE.SpriteMaterial({ map: T.soft2, color: 0x7a0606, transparent: true, depthWrite: false, opacity: 0 });
  const mist = Array.from({ length: 24 }, () => { const s = new THREE.Sprite(mistMat.clone()); s.visible = false; root.add(s); return { s, t: 1, life: 1, v: new THREE.Vector3() }; }); let mi = 0;

  // ---- gore (settings: 0 low, 1 heavy, 2 max): flying chunks that bounce, roll and leave splats; fountains from wounds ----
  let gore = 2;
  const GK = () => [0.6, 1.6, 3][gore] || 1;   // how much more blood everything throws
  // the pieces: torn, lumpy flesh (a noise-displaced ball, flattened), a loop of gut, a bone shard with a marrow end,
  // a strip of skin and fat; wet flesh is glossy, bone is matte. Shapes are built once and shared by the whole pool.
  const lumpy = (r, sq, seed) => { const g = new THREE.IcosahedronGeometry(r, hq ? 1 : 0), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 0.7 + 0.45 * Math.abs(Math.sin(x * 61 + seed) * Math.cos(y * 47 - seed) + Math.sin(z * 53 + seed * 2)) * 0.6; p.setXYZ(i, x * n, y * n * sq, z * n); }
    g.computeVertexNormals(); return g; };
  const gut = (() => { const pts = []; for (let k = 0; k < 7; k++) pts.push(new THREE.Vector3(Math.sin(k * 1.3) * 0.06, Math.cos(k * 0.9) * 0.03, k * 0.035 - 0.1)); return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), hq ? 24 : 10, 0.016, hq ? 7 : 4, false); })();
  const shard = (() => { const g = new THREE.CylinderGeometry(0.008, 0.02, 0.15, 5, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) + 0.006); g.computeVertexNormals(); return g; })();
  const gibGeo = [lumpy(0.06, 0.75, 1), lumpy(0.045, 0.6, 2), gut, shard, lumpy(0.07, 0.35, 3)];
  const gibMat = [new THREE.MeshStandardMaterial({ color: 0x6a0e0b, roughness: 0.22, metalness: 0, envMapIntensity: 1.2 }), new THREE.MeshStandardMaterial({ color: 0x3a0404, roughness: 0.2, envMapIntensity: 1.2 }),
    new THREE.MeshStandardMaterial({ color: 0x9a4a46, roughness: 0.25, envMapIntensity: 1.2 }), new THREE.MeshStandardMaterial({ color: 0xd8ccb4, roughness: 0.65 }), new THREE.MeshStandardMaterial({ color: 0xb06a58, roughness: 0.35 })];   // flesh, dark, gut, bone, skin + fat
  const GIB_MAT = [0, 1, 2, 3, 4];
  const gibs = Array.from({ length: ultra ? 96 : hq ? 60 : 32 }, (_, i) => { const t = i % 5, m = new THREE.Mesh(gibGeo[t], gibMat[GIB_MAT[t]]); m.visible = false; m.castShadow = false; root.add(m); return { m, v: new THREE.Vector3(), w: new THREE.Vector3(), t: 99, life: 0, landed: 0 }; });
  let gi = 0;
  const fountains = [];
  // ---- what comes off (gore max): a head or an arm as a physical piece, and the stump cap left on the body ----
  // A severed piece is a simple stand-in shaped and coloured like the part (a head in its balaclava or skin, an arm in
  // its sleeve with a gloved hand), with a raw cut face; it flies with the shot, tumbles, bounces, rolls to a stop and
  // drips. The cap (meat with a ring of fat and the bone in the middle) covers the cut on the body.
  const capGeo = (() => { const g = new THREE.CircleGeometry(1, 18), c = new Float32Array(g.attributes.position.count * 3), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)), bone = r < 0.32, fat = r > 0.82; c[i * 3] = bone ? 0.85 : fat ? 0.75 : 0.32 + Math.sin(i * 7.3) * 0.05; c[i * 3 + 1] = bone ? 0.8 : fat ? 0.6 : 0.02; c[i * 3 + 2] = bone ? 0.7 : fat ? 0.4 : 0.02; p.setZ(i, (1 - r) * 0.25); }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); return g; })();
  const capMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  const caps = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(capGeo, capMat); m.visible = false; return m; }); let ci = 0;
  const limbGeo = { head: new THREE.SphereGeometry(0.1, hq ? 16 : 8, hq ? 12 : 6), arm: new THREE.CapsuleGeometry(0.045, 0.42, 3, hq ? 10 : 6), hand: new THREE.SphereGeometry(0.05, 8, 6) };
  const limbs = Array.from({ length: 4 }, () => {
    const g = new THREE.Group(), a = new THREE.Mesh(limbGeo.head, new THREE.MeshStandardMaterial({ roughness: 0.8 })), h = new THREE.Mesh(limbGeo.hand, new THREE.MeshStandardMaterial({ color: 0x1d1c1a, roughness: 0.6 })), cap = new THREE.Mesh(capGeo, capMat);
    g.add(a); g.add(h); g.add(cap); g.visible = false; root.add(g); return { g, a, h, cap, v: new THREE.Vector3(), w: new THREE.Vector3(), t: 99, landed: 0, kind: 'head' };
  }); let li = 0;
  function limb(kind, x, y, z, dir, color, force = 1, piece = null) {
    const L = limbs[li = (li + 1) % limbs.length]; L.kind = kind; L.t = 0; L.landed = 0; L.g.visible = true; L.g.position.set(x, y, z); L.g.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
    L.a0 = L.a0 || L.a.material;
    if (piece) { L.a.geometry = piece.geometry; L.a.material = piece.material; L.a.position.copy(piece.center).negate(); L.a.scale.set(1, 1, 1); }   // the soldier's own head / arm, cut from his mesh
    else { L.a.geometry = kind === 'head' ? limbGeo.head : limbGeo.arm; L.a.material = L.a0; L.a.material.color.set(color || '#22231f'); L.a.position.set(0, 0, 0); L.a.scale.set(1, kind === 'head' ? 1.15 : 1, 1); }
    L.h.visible = kind === 'arm' && !piece; L.h.position.set(0, -0.28, 0);
    L.cap.position.set(0, kind === 'head' ? -0.1 : 0.27, 0); L.cap.rotation.set(kind === 'head' ? Math.PI / 2 : -Math.PI / 2, 0, 0); L.cap.scale.setScalar(kind === 'head' ? 0.06 : 0.048);
    const sp = rnd(2.5, 4.5) * force; L.v.set(dir.x * sp + rnd(-0.6, 0.6), rnd(2.2, 3.6) * force, dir.z * sp + rnd(-0.6, 0.6)); L.w.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
    fountains.push({ pos: () => (L.g.visible && L.t < 3 ? _lp.copy(L.cap.position).applyMatrix4(L.g.matrixWorld) : null), dur: 1.4, dir: { x: 0, y: -0.2, z: 0 }, t: 0, acc: 0, drip: 2 });
  }
  const _lp = new THREE.Vector3(), _sd = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), pending = [];
  function tickLimbs(dt) {
    for (const L of limbs) {
      if (!L.g.visible) continue; L.t += dt; if (L.t > 40) { L.g.visible = false; continue; }
      if (L.landed > 4) continue;
      L.v.y -= 9.8 * dt; L.g.position.addScaledVector(L.v, dt); L.g.rotation.x += L.w.x * dt; L.g.rotation.y += L.w.y * dt; L.g.rotation.z += L.w.z * dt;
      if (!W) continue; const p = L.g.position, rad = L.kind === 'head' ? 0.11 : 0.06;
      if (W.ray && (L.v.x || L.v.z)) { const s = Math.hypot(L.v.x, L.v.z); if (s > 0.3) { const h = W.ray({ x: p.x, y: p.y, z: p.z }, { x: L.v.x / s, y: 0, z: L.v.z / s }, s * dt + rad); if (h) { splats.add({ x: h.x, y: h.y, z: h.z }, normalOf(h, { x: L.v.x / s, y: 0, z: L.v.z / s }).clone(), rnd(0.35, 0.55), Math.random() * 6.28, 1.2, { own: true, color: 0x5a0505, dry: 40, life: 90 }); L.v.x *= -0.25; L.v.z *= -0.25; } } }
      const gy = W.groundAt(p.x, p.z, p.y + 0.3);
      if (p.y < gy + rad) {
        p.y = gy + rad; if (gore > 0) splats.add({ x: p.x, y: gy, z: p.z }, { x: 0, y: 1, z: 0 }, rnd(0.3, 0.5), Math.random() * 6.28, rnd(1, 1.6), { own: true, color: 0x5a0404, dry: 40, life: 90 });
        L.landed++; L.v.y *= -0.28; L.v.x *= 0.5; L.v.z *= 0.5; L.w.multiplyScalar(0.35);
        if (L.landed === 1 && audio) audio.at('shell', p.x, p.y, p.z, cam, 10);
        if (L.landed > 4) pools.add({ x: p.x, y: gy, z: p.z }, { x: 0, y: 1, z: 0 }, 0.08, Math.random() * 6.28, 1, { own: true, color: 0x4a0303, grow: 0.12, max: 0.45, dry: 60, life: 120, opacity: 0.95 });
      }
    }
  }
  // organs (gore max): a real scanned heart thrown out of a body that was blown open. Two in the pool, loaded on first use
  const organs = []; let organSrc = null, oi = 0;
  function organ(x, y, z, dir, force = 1) {
    if (!organSrc) organSrc = modelManifest().then((m) => (m.heart ? loadGLB(m.heart.files.lo) : null)).then((h) => {
      if (!h) return null; const b = new THREE.Box3().setFromObject(h.scene), sz = b.getSize(new THREE.Vector3()), k = 0.12 / Math.max(sz.x, sz.y, sz.z);   // an adult heart: about 12 cm
      for (let i = 0; i < 2; i++) { const g = new THREE.Group(), m = h.scene.clone(true); m.scale.setScalar(k); m.position.copy(b.getCenter(new THREE.Vector3())).multiplyScalar(-k); g.add(m); g.visible = false; root.add(g); organs.push({ m: g, v: new THREE.Vector3(), w: new THREE.Vector3(), t: 99, life: 30, landed: 0 }); }
      return true; }).catch(() => null);
    organSrc.then((ok) => { if (!ok || !organs.length) return; const o = organs[oi = (oi + 1) % organs.length]; o.m.position.set(x, y, z); o.m.visible = true; o.t = 0; o.landed = 0;
      const sp = rnd(2.5, 4.5) * force; o.v.set((dir ? dir.x : 0) * sp + rnd(-0.8, 0.8), rnd(2, 4) * force, (dir ? dir.z : 0) * sp + rnd(-0.8, 0.8)); o.w.set(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)); });
  }
  function gibBurst(x, y, z, n, dir = null, force = 1) {
    for (let k = 0; k < n; k++) {
      const g = gibs[gi = (gi + 1) % gibs.length], sc = rnd(0.6, 1.6);
      g.m.position.set(x + rnd(-0.15, 0.15), y + rnd(-0.2, 0.2), z + rnd(-0.15, 0.15)); g.m.scale.setScalar(sc); g.m.visible = true; g.t = 0; g.life = rnd(18, 30); g.landed = 0;
      const sp = rnd(2, 5.5) * force;
      g.v.set((dir ? dir.x * sp * 0.8 : 0) + rnd(-1, 1) * sp * 0.6, rnd(1.5, 4.5) * force, (dir ? dir.z * sp * 0.8 : 0) + rnd(-1, 1) * sp * 0.6);
      g.w.set(rnd(-12, 12), rnd(-12, 12), rnd(-12, 12));
    }
  }
  function tickGibs(dt) { for (const g of gibs) tickGib(g, dt); for (const g of organs) tickGib(g, dt); }   // no array built per frame
  function tickGib(g, dt) {
    {
      if (!g.m.visible) return; g.t += dt;
      if (g.t > g.life) { g.m.visible = false; return; }
      if (g.landed > 3) return;
      g.v.y -= 9.8 * dt; g.m.position.addScaledVector(g.v, dt); g.m.rotation.x += g.w.x * dt; g.m.rotation.y += g.w.y * dt; g.m.rotation.z += g.w.z * dt;
      if (W) {
        const p = g.m.position;
        if (W.ray && (g.v.x || g.v.z)) { /* walls: a chunk that hits one drops straight down */ const L = Math.hypot(g.v.x, g.v.z); if (L > 0.3) { const h = W.ray({ x: p.x, y: p.y, z: p.z }, { x: g.v.x / L, y: 0, z: g.v.z / L }, L * dt + 0.06); if (h) { if (gore > 0) splats.add({ x: h.x, y: h.y, z: h.z }, normalOf(h, { x: g.v.x / L, y: 0, z: g.v.z / L }).clone(), rnd(0.12, 0.25), Math.random() * 6.28, 1, { own: true, color: 0x6a0505, dry: 40, life: 70 }); g.v.x *= -0.2; g.v.z *= -0.2; } } }
        const gy = W.groundAt(p.x, p.z, p.y + 0.3);
        if (p.y < gy + 0.03) {
          p.y = gy + 0.03; if (!g.landed && gore > 0) splats.add({ x: p.x, y: gy, z: p.z }, { x: 0, y: 1, z: 0 }, rnd(0.18, 0.34), Math.random() * 6.28, rnd(1, 1.8), { own: true, color: 0x5a0404, dry: 40, life: 80 });
          g.landed++; g.v.y *= -0.3; g.v.x *= 0.45; g.v.z *= 0.45; g.w.multiplyScalar(0.4);
          if (g.landed === 1 && audio && Math.random() < 0.4) audio.at('shell', p.x, p.y, p.z, cam, 8);
        }
      }
    }
  }
  function tickFountains(dt) {
    for (let i = fountains.length - 1; i >= 0; i--) {
      const f = fountains[i]; f.t += dt; f.acc += dt;
      const dripT = f.drip ?? 3.5;   // after the pumping stops, the wound keeps dripping for a few seconds
      if (f.t > f.dur + dripT) { fountains.splice(i, 1); continue; }
      const p = f.pos(); if (!p) { fountains.splice(i, 1); continue; }
      if (f.t > f.dur) {
        if (f.acc > 0.22) { f.acc = 0; if (parts) parts.emit(p.x, p.y - 0.02, p.z, { n: 1, colors: ['#5a0606'], speed: 0.1, up: -0.5, size: 0.02, life: 0.9 });
          if (W && Math.random() < 0.35) splats.add({ x: p.x + rnd(-0.05, 0.05), y: W.groundAt(p.x, p.z, p.y), z: p.z + rnd(-0.05, 0.05) }, { x: 0, y: 1, z: 0 }, rnd(0.05, 0.1), Math.random() * 6.28, 1, { own: true, color: 0x5a0505, dry: 40, life: 80 }); }
        continue;
      }
      const k = 1 - f.t / f.dur;   // pumps hard, then weakens (with a pulse, like a heartbeat)
      const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(f.t * 9));
      while (f.acc > 0.04) {
        f.acc -= 0.04;
        if (parts) parts.emit(p.x, p.y, p.z, { n: Math.round(4 * k * pulse * GK()) + 1, colors: ['#8a0808', '#b01212', '#4a0303'], speed: 2.8 * k * pulse + 0.4, up: 2.6 * k + 0.4, size: 0.026, life: 0.9, dir: f.dir, spread: 0.45 });
        if (Math.random() < 0.5 * k) { const m = mist[mi = (mi + 1) % mist.length]; m.s.position.set(p.x, p.y, p.z); m.s.visible = true; m.t = 0; m.life = 0.5; m.v.set(f.dir.x * 1.2 + rnd(-0.4, 0.4), 1.6 * k + 0.3, f.dir.z * 1.2 + rnd(-0.4, 0.4)); m.s.scale.setScalar(rnd(0.12, 0.22)); }
        if (W && Math.random() < 0.25 * k) { const gx = p.x + f.dir.x * rnd(0.3, 1.2) + rnd(-0.3, 0.3), gz = p.z + f.dir.z * rnd(0.3, 1.2) + rnd(-0.3, 0.3); splats.add({ x: gx, y: W.groundAt(gx, gz, p.y), z: gz }, { x: 0, y: 1, z: 0 }, rnd(0.15, 0.3), Math.random() * 6.28, 1.3, { own: true, color: 0x6a0505, dry: 40, life: 80 }); }
      }
    }
  }

  // ---- dropped magazines and gun smoke ----
  const magGeo = new THREE.BoxGeometry(0.03, 0.12, 0.06), magMat = new THREE.MeshLambertMaterial({ color: 0x23252a }), mags = [];
  const _n = new THREE.Vector3(), _d = new THREE.Vector3();

  // a surface normal from a grid hit: walls face back along the shot (axis-aligned), floors face up
  function normalOf(hit, d) {
    if (!hit.side) return _n.set(0, 1, 0);
    const fx = hit.x - Math.floor(hit.x), fz = hit.z - Math.floor(hit.z);
    const ex = Math.min(fx, 1 - fx), ez = Math.min(fz, 1 - fz);
    return ex < ez ? _n.set(d.x > 0 ? -1 : 1, 0, 0) : _n.set(0, 0, d.z > 0 ? -1 : 1);
  }

  // ---- smoke that fills the space it's in: flood the open floor from the landing cell (walls stop it), stack billows ----
  const smokes = new Map(), smokeMat = new THREE.SpriteMaterial({ map: T.soft2, color: 0xc9c9c6, transparent: true, depthWrite: false });
  function smokeCells(x, z, r) {
    if (!W || !W.idx) return [[x, z]];
    const out = [], seen = new Set(), q = [[Math.floor(x), Math.floor(z)]], h0 = W.groundAt(x, z, 50);
    while (q.length && out.length < 140) {
      const [cx, cz] = q.shift(), key = cx + ',' + cz; if (seen.has(key)) continue; seen.add(key);
      if (Math.hypot(cx + 0.5 - x, cz + 0.5 - z) > r) continue;
      const i = W.idx(cx, cz); if (i < 0) continue; const hh = W.h[i]; if (hh - h0 > 1.4) continue;   // a wall or a high ledge: smoke goes round, not through
      out.push([cx + 0.5, cz + 0.5, hh]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) q.push([cx + dx, cz + dz]);
    }
    return out;
  }
  function smokeAdd(key, x, y, z, r) {
    const g = new THREE.Group(), billows = [], cells = smokeCells(x, z, r);
    for (const [cx, cz, hh] of cells) for (let k = 0; k < (hq ? 2 : 1); k++) {
      const s = new THREE.Sprite(smokeMat.clone()); const sz = rnd(1.8, 2.8);
      s.position.set(cx + rnd(-0.4, 0.4), Math.max(hh, y - 0.2) + 0.4 + k * rnd(0.9, 1.5), cz + rnd(-0.4, 0.4)); s.scale.setScalar(0.2); s.material.opacity = 0;
      g.add(s); billows.push({ s, sz, base: s.position.clone(), ph: Math.random() * 6.28, hole: 0, d: Math.hypot(cx - x, cz - z) });
    }
    root.add(g); smokes.set(key, { g, billows, t: 0, x, z });
  }
  function smokeTick(dt) {
    for (const sm of smokes.values()) {
      sm.t += dt;
      for (const b of sm.billows) {
        const grow = Math.min(1, Math.max(0, (sm.t - b.d * 0.12) / 1.6));   // rolls outwards from where it landed
        b.hole = Math.max(0, b.hole - dt * 0.6);
        b.s.scale.setScalar(b.sz * (0.3 + 0.7 * grow) * (1 + Math.sin(sm.t * 0.4 + b.ph) * 0.06));
        b.s.position.set(b.base.x + Math.sin(sm.t * 0.23 + b.ph) * 0.25, b.base.y + Math.sin(sm.t * 0.17 + b.ph) * 0.12, b.base.z + Math.cos(sm.t * 0.21 + b.ph) * 0.25);
        b.s.material.opacity = 0.82 * grow * (1 - b.hole);
      }
    }
  }
  // a bullet through smoke leaves a short-lived tunnel; a blast blows a hole that slowly fills back in
  function smokeCut(a, e) {
    if (!smokes.size) return;
    const dx = e.x - a.x, dy = e.y - a.y, dz = e.z - a.z, L2 = dx * dx + dy * dy + dz * dz || 1;
    for (const sm of smokes.values()) for (const b of sm.billows) {
      const p = b.s.position, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / L2));
      const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y, a.z + dz * t - p.z); if (d < 0.7) b.hole = Math.max(b.hole, 0.55 * (1 - d / 0.7));
    }
  }
  function smokePush(x, y, z, r) { for (const sm of smokes.values()) for (const b of sm.billows) { const d = Math.hypot(b.s.position.x - x, b.s.position.z - z); if (d < r) b.hole = Math.max(b.hole, 1 - d / r); } }

  // ---- fire that carpets the ground: floods open cells around the flame, running further downhill ----
  const fires = new Map(), fireMat = new THREE.SpriteMaterial({ map: T.soft2, color: 0xff8a2a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  function fireAdd(key, x, y, z, r) {
    const g = new THREE.Group(), flames = [];
    let cells = smokeCells(x, z, r + 1.2);
    const h0 = W ? W.groundAt(x, z, y + 1) : y;
    cells = cells.filter(([cx, cz, hh]) => Math.hypot(cx - x, cz - z) <= r || hh < h0 - 0.05);   // past the edge only where it runs downhill (stairs, slopes)
    for (const [cx, cz, hh] of cells) for (let k = 0; k < 3; k++) {
      const s = new THREE.Sprite(fireMat.clone()); s.position.set(cx + rnd(-0.4, 0.4), hh + 0.25, cz + rnd(-0.4, 0.4)); s.scale.setScalar(0.1); g.add(s);
      flames.push({ s, ph: Math.random() * 6.28, d: Math.hypot(cx - x, cz - z) + (hh < h0 - 0.05 ? 1.2 : 0), base: s.position.y });
    }
    root.add(g); fires.set(key, { g, flames, t: 0, x, y, z });
  }
  function fireTick(dt) {
    for (const f of fires.values()) {
      f.t += dt;
      for (const fl of f.flames) {
        const on = Math.min(1, Math.max(0, (f.t - fl.d * 0.18) / 0.4)), fl1 = 0.75 + Math.sin(f.t * 13 + fl.ph) * 0.15 + Math.sin(f.t * 29 + fl.ph * 2) * 0.1;
        fl.s.scale.set(0.42 * on * fl1, 0.95 * on * fl1, 1); fl.s.position.y = fl.base + 0.3 * fl1; fl.s.material.opacity = 0.55 * on;
        fl.s.material.color.setRGB(1, 0.28 + 0.16 * fl1, 0.05);   // tongues of flame, not balls of light
      }
      if (Math.random() < dt * 6 && parts) parts.smoke(f.x + rnd(-1, 1), f.y + 1.4, f.z + rnd(-1, 1), { color: '#2a2622', size: 0.5, grow: 2.4, life: 2.2, rise: 0.8, alpha: 0.35 });
    }
  }

  // ---- water ripples ----
  const ripMat = new THREE.MeshBasicMaterial({ map: T.ring, transparent: true, depthWrite: false, color: 0xdfefff });
  const rips = Array.from({ length: 16 }, () => { const m = new THREE.Mesh(plane, ripMat.clone()); m.rotation.x = -Math.PI / 2; m.visible = false; root.add(m); return { m, t: 1, life: 1, max: 1 }; }); let ri = 0;
  function ripple(x, y, z, size = 1.2, life = 1.1) { const r = rips[ri = (ri + 1) % rips.length]; r.m.position.set(x, y + 0.02, z); r.t = 0; r.life = life; r.max = size; r.m.visible = true; }
  const isWater = (x, z) => W && W.idx && W.flag && W.flag[W.idx(Math.floor(x), Math.floor(z))] === 3 && W.matName && W.matName(W.mat[W.idx(Math.floor(x), Math.floor(z))]) === 'water';

  const api = {
    root,
    // a bullet hitting the world: a hole that matches the material, the debris, ricochet sparks off metal
    impact(hit, d, mat) {
      const cls = matClass(mat), n = normalOf(hit, d).clone(), p = { x: hit.x, y: hit.y, z: hit.z };
      if (cls === 'water') { ripple(p.x, p.y, p.z, 0.8, 0.9); if (parts) parts.emit(p.x, p.y + 0.05, p.z, { n: 8, colors: ['#e8f4ff', '#cfe4f4'], speed: 1.2, up: 2.2, size: 0.03, life: 0.7 }); return; }
      holes[cls].add(p, n, cls === 'soft' ? rnd(0.16, 0.24) : cls === 'metal' ? rnd(0.05, 0.07) : rnd(0.08, 0.12), undefined, 1);
      if (cls === 'metal') {   // a ricochet: a fan of sparks thrown off the surface, mirrored about it
        const dot = d.x * n.x + d.y * n.y + d.z * n.z; _d.set(d.x - 2 * dot * n.x, d.y - 2 * dot * n.y, d.z - 2 * dot * n.z);
        sparks(p.x + n.x * 0.03, p.y + n.y * 0.03, p.z + n.z * 0.03, 10, { dir: _d, speed: 7, up: 0.5, life: 0.3, cone: 0.6 });
      }
      if (cls === 'wood' && parts) parts.emit(p.x + n.x * 0.05, p.y, p.z + n.z * 0.05, { n: 5, colors: ['#d8b07a', '#8a5a2a'], speed: 2, up: 0.8, size: 0.02, life: 0.7, dir: n });
    },
    // a knife meeting a wall: a scraped groove along the swing
    gouge(hit, d, swing = 0) { const n = normalOf(hit, d).clone(); gouges.add(hit, n, rnd(0.18, 0.26), swing ? 0.1 * swing : Math.PI / 2, 1, { life: 120 }); sparks(hit.x + n.x * 0.03, hit.y, hit.z + n.z * 0.03, 5, { dir: n, speed: 3, life: 0.2, cone: 1 }); },
    // a hit on a body: a burst of mist and droplets along the shot, and a splat on whatever is behind them
    blood(x, y, z, d, heavy = false) {
      const G = GK();
      for (let k = 0; k < Math.round((heavy ? 5 : 3) * G); k++) {
        const m = mist[mi = (mi + 1) % mist.length]; m.s.position.set(x, y, z); m.s.visible = true; m.t = 0; m.life = rnd(0.35, 0.6);
        m.v.set(d.x * rnd(1.5, 3) + rnd(-0.6, 0.6), d.y * 2 + rnd(-0.2, 0.6), d.z * rnd(1.5, 3) + rnd(-0.6, 0.6)); m.s.scale.setScalar(rnd(0.15, 0.28));
      }
      if (parts) parts.emit(x, y, z, { n: Math.round((heavy ? 12 : 7) * G), colors: ['#7a0606', '#a01010', '#4a0303'], speed: 2.4 + (gore > 1 ? 1.2 : 0), up: 0.4, size: 0.022, life: 0.6 + (gore > 1 ? 0.3 : 0), dir: d, spread: 0.5 + (gore > 1 ? 0.2 : 0) });
      if (!W) return;
      // the spray follows the shot: streaked droplets fanned out behind the victim, on the wall (running down it) or the floor
      const fan = gore > 1 ? (heavy ? 4 : 3) : gore > 0 ? 2 : 1;
      for (let k = 0; k < fan; k++) {
        const a = k ? rnd(-0.35, 0.35) : rnd(-0.08, 0.08), dd = _sd.set(d.x * Math.cos(a) - d.z * Math.sin(a), d.y - 0.12 + (k ? rnd(-0.2, 0.15) : 0), d.x * Math.sin(a) + d.z * Math.cos(a));
        const h2 = W.ray({ x, y, z }, dd, k ? 4.5 : 3.2);
        if (h2) {
          const n = normalOf(h2, dd).clone(), along = Math.abs(dd.x * n.x + dd.y * n.y + dd.z * n.z), big = (heavy ? 1.3 : 1) * (1 - Math.min(0.5, Math.hypot(h2.x - x, h2.z - z) / 9));
          sprays.add({ x: h2.x, y: h2.y, z: h2.z }, n, rnd(0.45, 0.8) * big, 0, 1 + (1 - along) * 1.4, { own: true, dry: 45, life: 100, along: dd });
          if (Math.abs(n.y) < 0.5 && gore > 0) for (let j = 0; j < (heavy ? 3 : 1 + (gore > 1 ? 1 : 0)); j++) {   // what hits a wall runs down it
            const sx = h2.x + n.z * rnd(-0.2, 0.2), sz = h2.z - n.x * rnd(-0.2, 0.2), sy = h2.y + rnd(-0.1, 0.12);
            drips.add({ x: sx, y: sy, z: sz }, n, rnd(0.08, 0.14), 0, 1, { own: true, drip: rnd(0.35, 1.2) * (heavy ? 1.3 : 1), floor: W.groundAt(sx - n.x * 0.1, sz - n.z * 0.1, sy) + 0.02, dry: 50, life: 120 });
          }
        } else {
          const gx = x + dd.x * rnd(0.8, 2.2), gz = z + dd.z * rnd(0.8, 2.2);
          sprays.add({ x: gx, y: W.groundAt(gx, gz, y), z: gz }, _up, rnd(0.4, 0.7) * (heavy ? 1.3 : 1), 0, rnd(1.4, 2.2), { own: true, dry: 45, life: 100, along: dd });
        }
      }
      if (gore > 0) { const gx = x + d.x * 0.3, gz = z + d.z * 0.3; splats.add({ x: gx, y: W.groundAt(gx, gz, y), z: gz }, _up, rnd(0.15, 0.3), Math.random() * 6.28, 1, { own: true, dry: 40, life: 80 }); }   // drops straight down under the wound
    },
    // the dead: a pool that spreads out underneath and darkens
    // the dead: a pool that creeps out from under them (a lobe runs downhill after a few seconds); on sand, dirt and
    // grass it soaks in: a dull, wider wet stain round a smaller glossy middle that dries sooner
    pool(x, y, z) {
      const gy = W ? W.groundAt(x, z, y + 1) : y, big = [0.7, 1.3, 2][gore] || 1, px = x + rnd(-0.2, 0.2), pz = z + rnd(-0.2, 0.2);
      const soft = W && W.matName && matClass(W.matName(W.mat[W.idx(Math.floor(px), Math.floor(pz))])) === 'soft';
      if (soft) pools.add({ x: px, y: gy - 0.002, z: pz }, _up, 0.2, Math.random() * 6.28, 1, { own: true, soak: true, grow: 0.09 * big, max: rnd(1.4, 1.9) * big, dry: 90, life: 140, opacity: 0.8 });
      pools.add({ x: px, y: gy, z: pz }, _up, 0.15, Math.random() * 6.28, 1, { own: true, grow: 0.12 * big, max: rnd(1.0, 1.5) * big * (soft ? 0.8 : 1), dry: soft ? 35 : 70, life: 140, opacity: 0.97 });
      if (W && pending.length < 16) {   // the creep: the lowest way out, a few seconds later
        let bx = rnd(-1, 1), bz = rnd(-1, 1), lo = gy + 0.01;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const h = W.groundAt(px + dx * 0.9, pz + dz * 0.9, gy + 0.3); if (h < lo) { lo = h; bx = dx; bz = dz; } }
        const L = Math.hypot(bx, bz) || 1; pending.push({ t: rnd(3, 6), x: px + bx / L * 0.55 * big, z: pz + bz / L * 0.55 * big, big, soft });
      }
    },
    // gore: chunks flying from a body (explosions, a head that came off), and a wound that pumps (pos() follows the body)
    gibs(x, y, z, n, dir = null, force = 1) { if (gore > 0) gibBurst(x, y, z, Math.round(n * (gore > 1 ? 1 : 0.5)), dir, force); if (gore > 1 && n >= 20) organ(x, y, z, dir, force); },
    fountain(pos, dur = 2.2, dir = { x: 0, y: 1, z: 0 }) { if (gore > 0) fountains.push({ pos, dur: dur * (gore > 1 ? 1 : 0.5), dir, t: 0, acc: 0 }); },
    // a severed head or arm flying off with the shot (gore max), and the cap for the stump left behind (on a bone)
    limb(kind, x, y, z, dir, color, force = 1, piece = null) { if (gore > 1) limb(kind, x, y, z, dir, color, force, piece); },
    stumpCap(bone, child, radius) {   // child: the bone that came off (the cap sits at its joint, facing along it)
      if (gore < 2 || !bone || !child) return null; const c = caps[ci = (ci + 1) % caps.length]; if (c.parent) c.parent.remove(c);
      c.position.copy(child.position); c.quaternion.setFromUnitVectors(_n.set(0, 0, 1), _d.copy(child.position).normalize()); c.scale.setScalar(radius * 0.01 / Math.max(1e-6, bone.getWorldScale(_lp).x));   // radius in cm, whatever units the rig's bones use c.visible = true; bone.add(c); return c;
    },
    setGore(n) { gore = Math.max(0, Math.min(2, n | 0)); },
    get gore() { return gore; },
    // an HE grenade: shrapnel sparks bouncing everywhere, a flash that lights the room, a scorch mark, the smoke blown back
    he(x, y, z) {
      sparks(x, y + 0.2, z, hq ? 160 : 80, { speed: 11, up: 3, life: 0.7 });
      blast.position.set(x, y + 0.8, z); blast.intensity = 60; blastT = 0.18;
      const gy = W ? W.groundAt(x, z, y + 1) : y; scorches.add({ x, y: gy, z }, { x: 0, y: 1, z: 0 }, rnd(2.2, 2.8), Math.random() * 6.28, 1, { life: 120 });
      smokePush(x, y, z, 5);
      if (parts) for (let k = 0; k < 6; k++) parts.smoke(x + rnd(-0.8, 0.8), y + rnd(0.2, 1.2), z + rnd(-0.8, 0.8), { color: '#3a342c', size: 0.8, grow: 3, life: 2.4, rise: 0.6, alpha: 0.55 });
    },
    // every shot: the muzzle lights the shooter's hands, gun and the walls around them for a few milliseconds
    muzzle(x, y, z, k = 1) { muzzle.position.set(x, y, z); muzzle.intensity = 14 * k; muzzleT = 0.05; },
    // after a burst the barrel smokes for a moment
    barrelSmoke(x, y, z) { if (parts) parts.smoke(x, y, z, { color: '#d8d4cc', size: 0.05, grow: 2.2, life: 1.4, rise: 0.35, drift: 0.05, alpha: 0.22 }); },
    // a reload drops the empty magazine: it falls, bounces once and lies there for a while
    dropMag(x, y, z, yaw) {
      const m = mags.length >= 12 ? mags.shift() : { o: new THREE.Mesh(magGeo, magMat) };
      m.o.position.set(x, y, z); m.o.rotation.set(rnd(-0.3, 0.3), yaw, rnd(-0.3, 0.3)); m.v = new THREE.Vector3(rnd(-0.3, 0.3), -0.5, rnd(-0.3, 0.3)); m.t = 0; m.b = 0; m.spin = rnd(-6, 6);
      if (!m.o.parent) root.add(m.o); mags.push(m);
    },
    tracer(a, e) { smokeCut(a, e); },
    smoke: { add: smokeAdd, remove(key) { const s = smokes.get(key); if (s) { root.remove(s.g); smokes.delete(key); } }, has: (k) => smokes.has(k) },
    fire: { add: fireAdd, remove(key) { const f = fires.get(key); if (f) { root.remove(f.g); fires.delete(key); } }, has: (k) => fires.has(k) },
    // walking (or falling) through shallow water
    wade(x, y, z, speed) { if (speed > 1 && isWater(x, z) && Math.random() < 0.12 * speed) { ripple(x, W.groundAt(x, z, y + 1), z, 0.9 + speed * 0.1, 1.2); if (Math.random() < 0.3 && parts) parts.emit(x, y + 0.05, z, { n: 4, colors: ['#e8f4ff'], speed: 1, up: 1.6, size: 0.025, life: 0.5 }); } },
    tick(dt) {
      tickSparks(dt);
      if (muzzleT > 0) { muzzleT -= dt; if (muzzleT <= 0) muzzle.intensity = 0; }
      if (blastT > 0) { blastT -= dt; blast.intensity = Math.max(0, 60 * blastT / 0.18); }
      for (const m of mist) { if (!m.s.visible) continue; m.t += dt; const k = m.t / m.life; if (k >= 1) { m.s.visible = false; continue; } m.v.y -= 3 * dt; m.s.position.addScaledVector(m.v, dt); m.s.scale.multiplyScalar(1 + dt * 1.8); m.s.material.opacity = 0.75 * (1 - k); }
      for (const r of rips) { if (!r.m.visible) continue; r.t += dt; const k = r.t / r.life; if (k >= 1) { r.m.visible = false; continue; } r.m.scale.setScalar(0.1 + r.max * k); r.m.material.opacity = 0.6 * (1 - k); }
      for (const m of mags) {
        m.t += dt; if (m.t > 25) { m.o.visible = false; continue; } m.o.visible = true; if (m.b > 1) continue;
        m.v.y -= 9.8 * dt; m.o.position.addScaledVector(m.v, dt); m.o.rotation.x += m.spin * dt;
        const gy = W ? W.groundAt(m.o.position.x, m.o.position.z, m.o.position.y + 0.2) : 0;
        if (m.o.position.y < gy + 0.03) { m.o.position.y = gy + 0.03; m.v.y *= -0.25; m.v.x *= 0.4; m.v.z *= 0.4; m.spin *= 0.3; m.b++; m.o.rotation.x = Math.PI / 2 * (m.b > 1 ? 1 : 0.8); if (m.b === 1 && audio) audio.at('shell', m.o.position.x, m.o.position.y, m.o.position.z, cam, 10); }
      }
      for (const r of [holes.concrete, holes.wood, holes.metal, holes.soft, splats, sprays, drips, pools, scorches, gouges]) r.tick(dt);
      for (let i = pending.length - 1; i >= 0; i--) { const q = pending[i]; q.t -= dt; if (q.t > 0) continue; pending.splice(i, 1); if (!W) continue; const gy = W.groundAt(q.x, q.z, 50); pools.add({ x: q.x, y: gy, z: q.z }, _up, 0.1, Math.random() * 6.28, 1.4, { own: true, grow: 0.06 * q.big, max: rnd(0.6, 0.9) * q.big, dry: q.soft ? 35 : 70, life: 130, opacity: 0.95 }); }
      smokeTick(dt); fireTick(dt); tickGibs(dt); tickLimbs(dt); tickFountains(dt);
    },
    setWorld(w) { W = w; api.clear(); },
    clear() {
      for (const r of [holes.concrete, holes.wood, holes.metal, holes.soft, splats, sprays, drips, pools, scorches, gouges]) r.clear();
      for (const k of [...smokes.keys()]) api.smoke.remove(k); for (const k of [...fires.keys()]) api.fire.remove(k);
      for (const m of mags) m.o.visible = false; mags.length = 0;
      for (const g of gibs) g.m.visible = false; for (const o of organs) o.m.visible = false; fountains.length = 0; pending.length = 0; for (const L of limbs) L.g.visible = false; for (const c of caps) { if (c.parent) c.parent.remove(c); c.visible = false; }
    },
  };
  return api;
}
