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
import { litPatch, LIGHT } from './world.js';
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
    const m = new THREE.MeshStandardMaterial({ color: FRESH, alphaMap: map, bumpMap: map, bumpScale: 1.6, transparent: true, opacity, roughness: 0.12, metalness: 0, envMapIntensity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    litPatch(m, 'dyn');
    // blood, not oil: where the film is thin (the spreading edge, the spray's droplets) the red shows through bright and
    // saturated; the deep middle is near-black red; a thin darker rim where it has started to dry (the coffee-ring edge);
    // the sky in its reflection is only a sheen, never a blue mirror
    const lp = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => { lp.call(m, sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
	{ float th = texture2D(alphaMap, vAlphaMapUv).r; float rim = smoothstep(0.02, 0.09, th) * (1.0 - smoothstep(0.09, 0.22, th));
	  diffuseColor.rgb *= mix(3.2, 0.85, smoothstep(0.04, 0.5, th)) * (1.0 - 0.55 * rim); }`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
	{ float sl = dot(reflectedLight.indirectSpecular, vec3(0.2126, 0.7152, 0.0722)); reflectedLight.indirectSpecular = mix(vec3(sl), reflectedLight.indirectSpecular, 0.25); }`); };
    m.customProgramCacheKey = () => 'lit-dyn-blood';
    return m;
  };

  const FRESH = new THREE.Color().setRGB(0.05, 0.0025, 0.002, THREE.LinearSRGBColorSpace), DRY = new THREE.Color().setRGB(0.022, 0.007, 0.0045, THREE.LinearSRGBColorSpace), SOAK = new THREE.Color().setRGB(0.03, 0.006, 0.004, THREE.LinearSRGBColorSpace);
  const LOWF = new THREE.Color(0x3a0303), LOWD = new THREE.Color(0x24100a);
  // a ring of decals of one kind: placed on a surface (position + normal), the oldest reused
  // Every ring is ONE instanced draw (it used to be one mesh per decal: a long round's bullet holes and blood could add
  // 400 draw calls); each decal's colour, opacity and gloss are per-instance values, so blood still dries one by one.
  // Instances keep the order they were made in (the newest blood is drawn over the older).
  const _o = new THREE.Object3D();
  function ring(n, mat, life = Infinity) {
    const list = [], std = !!mat.isMeshStandardMaterial, base = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1), baseOp = mat.opacity ?? 1, baseR = mat.roughness ?? 1;
    if (mat.color) mat.color.set(0xffffff); mat.opacity = 1;
    const geo = plane.clone(), iOR = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2); iOR.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('iOR', iOR);
    const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, r) => { if (prev) prev.call(mat, sh, r);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 iOR; varying vec2 vIOR;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvIOR = iOR;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vIOR;').replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.a *= vIOR.x;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = vIOR.y;'); };
    mat.customProgramCacheKey = () => (key ? key.call(mat) : '') + '-iring';
    const im = new THREE.InstancedMesh(geo, mat, n); im.count = 0; im.renderOrder = 2; im.frustumCulled = false; im.visible = false; root.add(im);
    im.setColorAt(0, base); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const _c = new THREE.Color();
    function flush() {
      im.count = list.length; im.visible = list.length > 0; if (!list.length) return;
      for (let i = 0; i < list.length; i++) { const d = list[i]; d.m.updateMatrix(); im.setMatrixAt(i, d.m.matrix); im.setColorAt(i, d.own ? d.col : base); iOR.setXY(i, d.alpha, d.rough); }
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; iOR.needsUpdate = true;
    }
    return {
      add(p, nrm, size, spin = Math.random() * 6.28, stretch = 1, opts = {}) {
        let d = list.length >= n ? list.shift() : null;
        if (!d) d = { m: new THREE.Object3D(), col: new THREE.Color() };
        const m = d.m; m.position.set(p.x + nrm.x * 0.012, p.y + nrm.y * 0.012, p.z + nrm.z * 0.012); m.quaternion.identity(); m.rotation.set(0, 0, 0);
        if (opts.along && nrm.y > 0.9) m.rotation.set(-Math.PI / 2, 0, Math.atan2(-opts.along.z, opts.along.x));   // on the floor: the streaks point the way the blood flew
        else { m.lookAt(p.x + nrm.x, p.y + nrm.y, p.z + nrm.z); m.rotateZ(opts.along ? Math.atan2(opts.along.y, opts.along.x * nrm.z - opts.along.z * nrm.x) : spin); }   // on a wall: along the shot's path across it
        m.scale.set(size * stretch, size, 1);
        d.t = 0; d.life = opts.life ?? life; d.grow = opts.grow || 0; d.size = size; d.max = opts.max || size; d.dry = opts.dry || 0; d.op = (opts.opacity ?? 1) * (opts.own ? 1 : baseOp); d.stretch = stretch;
        d.r0 = opts.soak ? 0.75 : 0.12; d.r1 = opts.soak ? 0.95 : 0.7; d.c0 = opts.soak ? SOAK : FRESH; d.drip = opts.drip || 0; d.len = 0.02; d.own = !!opts.own;
        if (d.drip) { d.top = d.top || new THREE.Vector3(); d.top.set(p.x + nrm.x * 0.013, p.y, p.z + nrm.z * 0.013); d.floor = opts.floor ?? -1e9; m.scale.set(size, d.len, 1); }
        d.alpha = d.op; d.rough = d.own && std ? d.r0 : baseR;
        if (d.own) d.col.copy(std ? d.c0 : LOWF);
        list.push(d); flush(); return d;
      },
      tick(dt) {
        if (!list.length) return;
        for (let i = list.length - 1; i >= 0; i--) {
          const d = list[i]; d.t += dt;
          if (d.grow && d.size < d.max) { d.size = Math.min(d.max, d.size + d.grow * dt * (1 - d.size / d.max * 0.8)); d.m.scale.set(d.size * d.stretch, d.size, 1); }   // creeps out, slower as it thins
          if (d.drip && d.len < d.drip) {   // a run down a wall: grows downward from where it landed, stops at the floor
            d.len = Math.min(d.drip, d.len + dt * 0.35 * (1 - d.len / d.drip * 0.85), Math.max(0.02, d.top.y - d.floor)); d.m.scale.y = d.len; d.m.position.set(d.top.x, d.top.y - d.len / 2, d.top.z);
          }
          if (d.dry && d.own) { const k = Math.min(1, d.t / d.dry); if (std) { d.col.copy(d.c0).lerp(DRY, k); d.rough = d.r0 + (d.r1 - d.r0) * k * k; } else d.col.copy(LOWF).lerp(LOWD, k); }
          if (d.t > d.life) { const f = Math.max(0, 1 - (d.t - d.life) / 3); d.alpha = d.op * f; if (f <= 0) list.splice(i, 1); }
        }
        flush();
      },
      clear() { list.length = 0; flush(); },
      get count() { return list.length; },
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
  const mistMat = new THREE.SpriteMaterial({ map: T.soft2, color: 0x4a0404, transparent: true, depthWrite: false, opacity: 0 });
  const mist = Array.from({ length: hq ? 40 : 12 }, () => { const s = new THREE.Sprite(mistMat.clone()); s.visible = false; root.add(s); return { s, t: 1, life: 1, v: new THREE.Vector3() }; }); let mi = 0;

  // ---- blood droplets: one instanced draw for every drop in the air. Each is a round, soft-edged bead with a wet
  // highlight, stretched along its own motion on screen (a fast drop reads as a streak, a slow one as a bead), dark red
  // and lit by the map's sun and sky. They fall, and the ones that land leave a small spot.
  const DN = ultra ? 900 : hq ? 600 : 260, dGeo = new THREE.InstancedBufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3)); dGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const dP = new Float32Array(DN * 3), dV = new Float32Array(DN * 3), dSA = new Float32Array(DN * 2), dT = new Float32Array(DN);
  dGeo.setAttribute('iP', new THREE.InstancedBufferAttribute(dP, 3)); dGeo.setAttribute('iV', new THREE.InstancedBufferAttribute(dV, 3)); dGeo.setAttribute('iSA', new THREE.InstancedBufferAttribute(dSA, 2));
  dGeo.instanceCount = DN;
  const dMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { sunCol: LIGHT.sunCol, skyCol: LIGHT.skyCol },
    vertexShader: `attribute vec3 iP; attribute vec3 iV; attribute vec2 iSA; varying vec2 vC; varying float vA;
      void main() { vec4 c = viewMatrix * vec4(iP, 1.0); vec2 d = (viewMatrix * vec4(iV, 0.0)).xy; float sp = length(d);
        vec2 ax = sp > 1e-4 ? d / sp : vec2(0.0, 1.0), ay = vec2(-ax.y, ax.x); float L = iSA.x + sp * 0.012;
        c.xy += ax * position.y * L + ay * position.x * iSA.x; vC = position.xy; vA = iSA.y; gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform vec3 sunCol; uniform vec3 skyCol; varying vec2 vC; varying float vA;
      void main() { float r = length(vC); if (r > 1.0 || vA <= 0.0) discard;
        vec3 lit = sunCol * 2.2 + skyCol * 1.2;
        vec3 col = mix(vec3(0.16, 0.008, 0.005), vec3(0.055, 0.002, 0.0015), r * r) * lit;                // thick in the middle, darker at the rim
        col += lit * 0.35 * smoothstep(0.42, 0.0, length(vC - vec2(-0.32, 0.38)));                        // the wet highlight
        gl_FragColor = vec4(col, vA * smoothstep(1.0, 0.72, r));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const drops = new THREE.Mesh(dGeo, dMat); drops.frustumCulled = false; drops.renderOrder = 3; root.add(drops); let dI = 0;
  function dropEmit(x, y, z, { n = 8, speed = 2.5, up = 0.4, size = 0.012, life = 1.2, dir = null, spread = 0.5 } = {}) {
    for (let k = 0; k < n; k++) {
      const i = dI = (dI + 1) % DN, a = Math.random() * 6.28, sv = speed * rnd(0.35, 1.25);
      let vx = Math.cos(a) * spread, vz = Math.sin(a) * spread, vy = rnd(-0.3, 1) * up; if (dir) { vx += dir.x; vy += dir.y; vz += dir.z; }
      dP[i * 3] = x + rnd(-0.03, 0.03); dP[i * 3 + 1] = y + rnd(-0.03, 0.03); dP[i * 3 + 2] = z + rnd(-0.03, 0.03);
      dV[i * 3] = vx * sv; dV[i * 3 + 1] = vy * sv + up * rnd(0.2, 1.4); dV[i * 3 + 2] = vz * sv;
      dSA[i * 2] = size * rnd(0.45, 1.6); dSA[i * 2 + 1] = 1; dT[i] = life * rnd(0.6, 1.3);
    }
  }
  function tickDrops(dt) {
    let any = false;
    for (let i = 0; i < DN; i++) {
      if (dSA[i * 2 + 1] <= 0) continue; any = true; dT[i] -= dt;
      const o = i * 3; dV[o + 1] -= 9.8 * dt; const dr = 1 - Math.min(0.5, dt * 0.6); dV[o] *= dr; dV[o + 2] *= dr;   // a little air drag on the small ones
      dP[o] += dV[o] * dt; dP[o + 1] += dV[o + 1] * dt; dP[o + 2] += dV[o + 2] * dt;
      const gy = W ? W.groundAt(dP[o], dP[o + 2], dP[o + 1] + 0.3) : -1e9;
      if (dP[o + 1] <= gy || dT[i] <= 0) {
        if (dP[o + 1] <= gy && gore > 0 && Math.random() < 0.18) splats.add({ x: dP[o], y: gy, z: dP[o + 2] }, _up, rnd(0.03, 0.07) * (dSA[i * 2] / 0.012), Math.random() * 6.28, 1, { own: true, dry: 40, life: 70 });
        dSA[i * 2 + 1] = 0;
      }
    }
    if (any) { dGeo.attributes.iP.needsUpdate = true; dGeo.attributes.iV.needsUpdate = true; dGeo.attributes.iSA.needsUpdate = true; }
    drops.visible = any;
  }

  // ---- gore (settings: 0 low, 1 heavy, 2 max): flying chunks that bounce, roll and leave splats; fountains from wounds ----
  let gore = 2;
  const GK = () => [0.6, 1.6, 3][gore] || 1;   // how much more blood everything throws
  // the pieces: torn chunks of a body, built once as irregular solids (no two faces alike) and drawn instanced (one draw
  // per kind, whatever the burst size): a chunk of the body wall with the uniform still on it over a band of yellow fat,
  // ragged muscle torn along its fibres, a flap of skin and fat, a jagged bone splinter with red marrow at the break,
  // stringy bits, and a scrap of bloodied fabric. One painted atlas (meat fibres, fat, bone, cloth) and the vertex
  // colours carry the surfaces; everything is wet (glossy, darkened with blood) and lit by the map's baked light.
  const wet = (o) => litPatch(new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0, envMapIntensity: 0.55, ...o }), 'dyn');
  const gibTex = canvasTex(512, (g, sz) => {   // atlas: [0-.5, 0-.5] muscle, [.5-1, 0-.5] fat and skin, [0-.5, .5-1] bone, [.5-1, .5-1] cloth
    const h = sz / 2;
    g.fillStyle = '#4c0707'; g.fillRect(0, 0, h, h);
    for (let k = 0; k < 700; k++) { const y = rnd(0, h), x = rnd(-20, h), L = rnd(8, 46); g.strokeStyle = `rgba(${rnd(95, 160) | 0},${rnd(8, 24) | 0},${rnd(8, 20) | 0},${rnd(0.25, 0.65)})`; g.lineWidth = rnd(0.6, 2.4); g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y + rnd(-4, 4)); g.stroke(); }   // muscle fibres
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${rnd(14, 34) | 0},2,2,${rnd(0.45, 0.85)})`; blob(g, rnd(0, h), rnd(0, h), rnd(4, 16), 0.45, 6); }   // clots
    for (let k = 0; k < 8; k++) { g.strokeStyle = `rgba(${rnd(200, 235) | 0},${rnd(170, 205) | 0},${rnd(120, 150) | 0},${rnd(0.3, 0.6)})`; g.lineWidth = rnd(1, 3); g.beginPath(); const x = rnd(0, h), y = rnd(0, h); g.moveTo(x, y); g.bezierCurveTo(x + rnd(-30, 30), y + rnd(-30, 30), x + rnd(-30, 30), y + rnd(-30, 30), x + rnd(-50, 50), y + rnd(-50, 50)); g.stroke(); }   // fascia
    g.fillStyle = '#d9b25e'; g.fillRect(h, 0, h, h);   // fat: lobules, blood in the gaps
    for (let k = 0; k < 160; k++) { g.fillStyle = `rgba(${rnd(225, 245) | 0},${rnd(190, 215) | 0},${rnd(100, 140) | 0},${rnd(0.4, 0.9)})`; g.beginPath(); g.arc(h + rnd(0, h), rnd(0, h), rnd(3, 9), 0, 6.28); g.fill(); }
    for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(${rnd(80, 140) | 0},8,6,${rnd(0.3, 0.75)})`; blob(g, h + rnd(0, h), rnd(0, h), rnd(2, 9), 0.4, 5); }
    g.fillStyle = '#cfc2a2'; g.fillRect(0, h, h, h);   // bone: dense pale shaft, pores, blood stains
    for (let k = 0; k < 260; k++) { g.fillStyle = `rgba(${rnd(150, 200) | 0},${rnd(135, 180) | 0},${rnd(110, 150) | 0},${rnd(0.2, 0.5)})`; g.fillRect(rnd(0, h), h + rnd(0, h), rnd(1, 3), rnd(1, 2)); }
    for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(${rnd(80, 130) | 0},8,6,${rnd(0.35, 0.85)})`; blob(g, rnd(0, h), h + rnd(0, h), rnd(3, 12), 0.4, 5); }
    g.fillStyle = '#5a5648'; g.fillRect(h, h, h, h);   // cloth: a woven fabric soaked through in places
    for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(30,28,22,${0.25 + 0.1 * Math.sin(y)})`; g.fillRect(h, h + y, h, 1); }
    for (let x = 0; x < h; x += 3) { g.fillStyle = 'rgba(140,135,115,.18)'; g.fillRect(h + x, h, 1, h); }
    for (let k = 0; k < 18; k++) { g.fillStyle = `rgba(${rnd(50, 90) | 0},4,4,${rnd(0.5, 0.9)})`; blob(g, h + rnd(0, h), h + rnd(0, h), rnd(8, 30), 0.5, 7); }
  });
  // a deterministic noise on the vertex position (shared corners move together: no cracks)
  const nz = (x, y, z, s) => Math.sin(x * 37.1 + s) * Math.cos(y * 41.7 - s * 1.3) + 0.6 * Math.sin(z * 53.3 + x * 17.9 + s * 2.1) + 0.35 * Math.sin((x + y + z) * 113 + s);
  // UV for a point from its region of the atlas: [u0, v0] corner, a spherical projection inside it
  const reg = { meat: [0, 0], fat: [0.5, 0], bone: [0, 0.5], cloth: [0.5, 0.5] };
  function chunk({ r = 0.05, sx = 1, sy = 1, sz = 1, rough = 0.35, seed = 1, cutTop = null, layers = null, detail = 2 }) {
    const g = new THREE.IcosahedronGeometry(r, ultra ? detail : Math.max(1, detail - 1)), p = g.attributes.position;   // 80 faces a chunk (320 on Ultra)
    const uv = new Float32Array(p.count * 2), col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) / r, y = p.getY(i) / r, z = p.getZ(i) / r;
      const n = 1 + rough * nz(x, y, z, seed) + 0.5 * rough * nz(x * 2.7, y * 2.3, z * 2.9, seed * 3.1);
      x *= n * sx; y *= n * sy; z *= n * sz;
      if (cutTop !== null && y > cutTop) y = cutTop + 0.04 * nz(x * 3, 0, z * 3, seed);   // the outside of the body: a flatter face
      p.setXYZ(i, x * r, y * r, z * r);
    }
    g.computeVertexNormals();
    const nr = g.attributes.normal;
    for (let t = 0; t < p.count; t += 3) {   // per triangle: which layer it is (by height in the chunk and facing)
      let cy = 0, ny = 0; for (let k = 0; k < 3; k++) { cy += p.getY(t + k) / r / 3; ny += nr.getY(t + k) / 3; }
      let L = 'meat'; if (layers) for (const [lim, name, face] of layers) if (cy > lim && (!face || ny > face)) L = name;
      const [u0, v0] = reg[L];
      for (let k = 0; k < 3; k++) { const i = t + k, x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x) / 6.2832 + 0.5, b = L === 'cloth' || L === 'fat' ? (x * 3 + z * 2) / r * 0.08 + 0.5 : y / r * 0.25 + 0.5;
        uv[i * 2] = u0 + 0.02 + 0.46 * ((L === 'cloth' ? (z / r * 0.2 + 0.5) : a) % 1); uv[i * 2 + 1] = 1 - (v0 + 0.02 + 0.46 * Math.min(1, Math.max(0, b)));
        const w = L === 'meat' ? 0.75 + 0.25 * nz(x * 80, y * 80, z * 80, seed) : 0.9 + 0.1 * nz(x * 60, y * 60, z * 60, seed); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.max(0.35, w); }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }
  function splinter(seed) {   // a broken bone: an irregular shaft, both ends snapped jagged, the marrow showing red at the break
    const g = new THREE.CylinderGeometry(0.011, 0.014, 0.12, 7, 4, false).toNonIndexed(), p = g.attributes.position, uv = new Float32Array(p.count * 2), col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const k = 1 + 0.25 * Math.sin(a * 3 + seed) + 0.15 * Math.sin(y * 90 + seed), end = Math.abs(y) > 0.059 ? 0.035 * nz(x * 90, y, z * 90, seed) : 0;
      p.setXYZ(i, x * k + (y > 0 ? 0.004 : 0), y + end, z * k); }
    g.computeVertexNormals(); const nr = g.attributes.normal;
    for (let t = 0; t < p.count; t += 3) { let ny = 0; for (let k = 0; k < 3; k++) ny += Math.abs(nr.getY(t + k)) / 3; const cap = ny > 0.6, [u0, v0] = reg[cap ? 'meat' : 'bone'];
      for (let k = 0; k < 3; k++) { const i = t + k; uv[i * 2] = u0 + 0.02 + 0.46 * (Math.atan2(p.getZ(i), p.getX(i)) / 6.2832 + 0.5); uv[i * 2 + 1] = 1 - (v0 + 0.02 + 0.46 * (p.getY(i) / 0.14 + 0.5)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = cap ? 0.6 : 0.95; } }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }
  const gibGeo = [
    chunk({ r: 0.05, sx: 1.4, sy: 0.75, sz: 1.0, rough: 0.32, seed: 1.3, cutTop: 0.45, layers: [[0.1, 'fat'], [0.36, 'cloth', 0.35]] }),   // body wall: uniform, fat, then muscle
    chunk({ r: 0.045, sx: 1.6, sy: 0.7, sz: 0.8, rough: 0.45, seed: 2.7 }),                                                                     // torn muscle
    chunk({ r: 0.055, sx: 1.3, sy: 0.32, sz: 1.1, rough: 0.4, seed: 4.1, cutTop: 0.18, layers: [[-0.05, 'fat'], [0.12, 'fat', 0.5]] }),          // skin and fat flap
    splinter(5.3),                                                                                                                               // bone
    chunk({ r: 0.028, sx: 2.2, sy: 0.55, sz: 0.6, rough: 0.55, seed: 6.6, detail: 1 }),                                                         // stringy bits
    chunk({ r: 0.05, sx: 1.3, sy: 0.18, sz: 1.0, rough: 0.5, seed: 7.9, layers: [[-0.2, 'cloth']] }),                                           // a scrap of fabric
  ];
  const gibMat = wet({ map: gibTex, bumpMap: gibTex, bumpScale: 1.6, vertexColors: true, roughness: 0.3 });
  const GN = ultra ? 96 : hq ? 60 : 32, GK_N = gibGeo.length, gibIM = gibGeo.map((geo) => { const m = new THREE.InstancedMesh(geo, gibMat, Math.ceil(GN / GK_N)); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.name = 'gibs'; root.add(m); return m; });
  const gibs = Array.from({ length: GN }, (_, i) => ({ m: new THREE.Object3D(), v: new THREE.Vector3(), w: new THREE.Vector3(), t: 99, life: 0, landed: 0, kind: i % GK_N, slot: Math.floor(i / GK_N) }));
  for (const q of gibs) q.m.visible = false;
  function flushGibs() {   // write the live pieces into their kind's instance buffer (dead ones packed out)
    for (const im of gibIM) im.count = 0;
    for (const q of gibs) { if (!q.m.visible) continue; const im = gibIM[q.kind]; q.m.updateMatrix(); im.setMatrixAt(im.count++, q.m.matrix); }
    for (const im of gibIM) { im.visible = im.count > 0; if (im.count) im.instanceMatrix.needsUpdate = true; }
  }
  let gi = 0;
  const fountains = [];
  // ---- what comes off (gore max): a head or an arm as a physical piece, and the stump cap left on the body ----
  // A severed piece is a simple stand-in shaped and coloured like the part (a head in its balaclava or skin, an arm in
  // its sleeve with a gloved hand), with a raw cut face; it flies with the shot, tumbles, bounces, rolls to a stop and
  // drips. The cap (meat with a ring of fat and the bone in the middle) covers the cut on the body.
  const capGeo = (() => { const g = new THREE.RingGeometry(0.001, 1, 18, 6), c = new Float32Array(g.attributes.position.count * 3), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)), bone = r < 0.2, fat = r > 0.84; c[i * 3] = bone ? 0.7 : fat ? 0.72 : 0.32 + Math.sin(i * 7.3) * 0.05; c[i * 3 + 1] = bone ? 0.6 : fat ? 0.55 : 0.02; c[i * 3 + 2] = bone ? 0.48 : fat ? 0.32 : 0.02; p.setZ(i, (1 - r) * 0.25); }
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
    if (piece && piece.cut) {   // the raw face where the piece came away (cutPiece measured it): on the cut, facing out of it
      L.cap.position.copy(piece.cut).sub(piece.center); L.cap.quaternion.setFromUnitVectors(_sd.set(0, 0, 1), piece.cutDir); L.cap.scale.setScalar(Math.max(0.02, Math.min(0.07, piece.rad)));
    } else { L.cap.position.set(0, kind === 'head' ? -0.1 : 0.27, 0); L.cap.rotation.set(kind === 'head' ? Math.PI / 2 : -Math.PI / 2, 0, 0); L.cap.scale.setScalar(kind === 'head' ? 0.06 : 0.048); }
    const sp = rnd(2.5, 4.5) * force; L.v.set(dir.x * sp + rnd(-0.6, 0.6), rnd(2.2, 3.6) * force, dir.z * sp + rnd(-0.6, 0.6)); L.w.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
    fountains.push({ pos: () => (L.g.visible && L.t < 3 ? _lp.copy(L.cap.position).applyMatrix4(L.g.matrixWorld) : null), dur: 1.4, dir: { x: 0, y: -0.2, z: 0 }, t: 0, acc: 0, drip: 2 });
  }
  const _lp = new THREE.Vector3(), _sd = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), pending = [];
  function tickLimbs(dt) {
    for (const L of limbs) {
      if (!L.g.visible) continue; L.t += dt; if (L.t > 40) { L.g.visible = false; continue; }
      if (L.landed > 4) continue;
      const px = L.g.position.x, pz = L.g.position.z; L.v.y -= 9.8 * dt; L.g.position.addScaledVector(L.v, dt); L.g.rotation.x += L.w.x * dt; L.g.rotation.y += L.w.y * dt; L.g.rotation.z += L.w.z * dt;
      if (!W) continue; const p = L.g.position, rad = L.kind === 'head' ? 0.11 : 0.06;
      if (W.ray && (L.v.x || L.v.z)) { const s = Math.hypot(L.v.x, L.v.z); if (s > 0.3) { const h = rayAt({ x: p.x, y: p.y, z: p.z }, { x: L.v.x / s, y: 0, z: L.v.z / s }, s * dt + rad); if (h) { splats.add({ x: h.x, y: h.y, z: h.z }, normalOf(h, { x: L.v.x / s, y: 0, z: L.v.z / s }).clone(), rnd(0.35, 0.55), Math.random() * 6.28, 1.2, { own: true, color: 0x5a0505, dry: 40, life: 90 }); L.v.x *= -0.25; L.v.z *= -0.25; } } }
      if (W.topAt && W.topAt(p.x, p.z) > p.y + rad) { p.x = px; p.z = pz; L.v.x *= -0.25; L.v.z *= -0.25; }   // flew into a wall between two frames (a slow frame): back out and bounce, never fall inside it
      const gy = W.groundAt(p.x, p.z, p.y + 0.3);
      if (p.y < gy + rad) {
        p.y = gy + rad; if (gore > 0) splats.add({ x: p.x, y: gy, z: p.z }, { x: 0, y: 1, z: 0 }, rnd(0.3, 0.5), Math.random() * 6.28, rnd(1, 1.6), { own: true, color: 0x5a0404, dry: 40, life: 90 });
        L.landed++; L.v.y *= -0.28; L.v.x *= 0.5; L.v.z *= 0.5; L.w.multiplyScalar(0.35);
        if (L.landed === 1 && audio) audio.at('shell', p.x, p.y, p.z, cam, 10);
        if (L.landed > 4) pools.add({ x: p.x, y: gy, z: p.z }, { x: 0, y: 1, z: 0 }, 0.08, Math.random() * 6.28, 1, { own: true, color: 0x4a0303, grow: 0.12, max: 0.45, dry: 60, life: 120, opacity: 0.95 });
      }
    }
  }
  // ---- wounds that stay on the body: an entry hole where the round went in, a torn exit where it came out (bigger), each
  // stuck to the bone under it so it moves with the body, alive or dead, until the round ends. Lit like the soldier.
  const exitTex = canvasTex(128, (g, sz) => { const c = sz / 2; g.fillStyle = 'rgba(45,3,3,.8)'; blob(g, c, c + 8, 40, 0.45, 7);
    g.fillStyle = 'rgba(95,8,8,1)'; blob(g, c, c, 26, 0.5, 8); g.fillStyle = 'rgba(150,30,24,1)'; blob(g, c, c, 17, 0.55, 8);
    for (let k = 0; k < 14; k++) { const a = rnd(0, 6.28); g.fillStyle = k % 3 ? 'rgba(120,14,12,1)' : 'rgba(220,200,170,1)'; g.beginPath(); g.ellipse(c + Math.cos(a) * rnd(8, 20), c + Math.sin(a) * rnd(8, 20), rnd(2, 5), rnd(1, 3), a, 0, 6.28); g.fill(); }   // torn tissue, a fleck of bone
    g.fillStyle = 'rgba(10,1,1,1)'; blob(g, c, c, 8, 0.4, 6); });
  const woundMat = (map) => litPatch(new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.06, roughness: 0.25, envMapIntensity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 'dyn');
  const WM = [woundMat(T.wound), woundMat(exitTex)];
  const wounds = Array.from({ length: ultra ? 80 : hq ? 48 : 12 }, () => { const m = new THREE.Mesh(plane, WM[0]); m.renderOrder = 2; return m; }); let wi = 0;
  const _wp = new THREE.Vector3(), _wq = new THREE.Quaternion(), _ws = new THREE.Vector3(), _wz = new THREE.Vector3(0, 0, 1);
  function wound(bone, p, dir, size, exit) {
    if (!bone) return null; const m = wounds[wi = (wi + 1) % wounds.length]; if (m.parent) m.parent.remove(m);
    m.material = WM[exit ? 1 : 0]; bone.updateMatrixWorld(true);
    _wp.set(p.x, p.y, p.z); bone.worldToLocal(_wp); m.position.copy(_wp);
    // face out of the body: against the shot for an entry, along it for an exit
    _ws.set(exit ? dir.x : -dir.x, exit ? dir.y : -dir.y, exit ? dir.z : -dir.z).normalize(); _wq.setFromUnitVectors(_wz, _ws);
    bone.getWorldQuaternion(m.quaternion).invert().multiply(_wq); m.rotateZ(Math.random() * 6.28);
    m.scale.setScalar(size / Math.max(1e-6, bone.getWorldScale(_ws).x)); m.visible = true; bone.add(m); return m;
  }
  // organs (gore max): a real scanned heart thrown out of a body that was blown open. Two in the pool, loaded on first use
  const organs = []; let organSrc = null, oi = 0;
  function organ(x, y, z, dir, force = 1) {
    if (!organSrc) loadOrgans();
    organSrc.then((ok) => { if (!ok || !organs.length) return; const o = organs[oi = (oi + 1) % organs.length]; o.m.position.set(x, y, z); o.m.visible = true; o.t = 0; o.landed = 0; o.m.name = 'heart';
      const sp = rnd(2.5, 4.5) * force; o.v.set((dir ? dir.x : 0) * sp + rnd(-0.8, 0.8), rnd(2, 4) * force, (dir ? dir.z : 0) * sp + rnd(-0.8, 0.8)); o.w.set(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)); });
  }
  function loadOrgans() {
    if (!organSrc) organSrc = modelManifest().then((m) => (m.heart ? loadGLB(m.heart.files[ultra ? 'hi' : 'lo']) : null)).then((h) => {   // the full scan is 50k triangles: Ultra only; the light one (9k) is drawn two-sided so its few gaps don't show through
      if (!h) return null; const b = new THREE.Box3().setFromObject(h.scene), sz = b.getSize(new THREE.Vector3()), k = 0.12 / Math.max(sz.x, sz.y, sz.z);   // an adult heart: about 12 cm
      if (!ultra) h.scene.traverse((o) => { if (o.isMesh) o.material.side = THREE.DoubleSide; });
      for (let i = 0; i < 2; i++) { const g = new THREE.Group(), m = h.scene.clone(true); m.scale.setScalar(k); m.position.copy(b.getCenter(new THREE.Vector3())).multiplyScalar(-k); g.add(m); g.visible = false; root.add(g); organs.push({ m: g, v: new THREE.Vector3(), w: new THREE.Vector3(), t: 99, life: 30, landed: 0 }); }
      return true; }).catch(() => null);
    return organSrc;
  }
  if (hq) setTimeout(() => { if (gore > 1) loadOrgans(); }, 4000);   // ready before the first kill that throws one
  function gibBurst(x, y, z, n, dir = null, force = 1) {
    for (let k = 0; k < n; k++) {
      const g = gibs[gi = (gi + 1) % gibs.length], sc = rnd(0.6, 1.6);
      g.m.position.set(x + rnd(-0.15, 0.15), y + rnd(-0.2, 0.2), z + rnd(-0.15, 0.15)); g.m.scale.setScalar(sc); g.m.visible = true; g.t = 0; g.life = rnd(18, 30); g.landed = 0;
      const sp = rnd(2, 5.5) * force;
      g.v.set((dir ? dir.x * sp * 0.8 : 0) + rnd(-1, 1) * sp * 0.6, rnd(1.5, 4.5) * force, (dir ? dir.z * sp * 0.8 : 0) + rnd(-1, 1) * sp * 0.6);
      g.w.set(rnd(-12, 12), rnd(-12, 12), rnd(-12, 12));
    }
  }
  function tickGibs(dt) { for (const g of gibs) tickGib(g, dt); for (const g of organs) tickGib(g, dt); flushGibs(); }   // no array built per frame
  function tickGib(g, dt) {
    {
      if (!g.m.visible) return; g.t += dt;
      if (g.t > g.life) { g.m.visible = false; return; }
      if (g.landed > 3) return;
      const px = g.m.position.x, pz = g.m.position.z; g.v.y -= 9.8 * dt; g.m.position.addScaledVector(g.v, dt); g.m.rotation.x += g.w.x * dt; g.m.rotation.y += g.w.y * dt; g.m.rotation.z += g.w.z * dt;
      if (W) {
        const p = g.m.position;
        if (W.ray && (g.v.x || g.v.z)) { /* walls: a chunk that hits one drops straight down */ const L = Math.hypot(g.v.x, g.v.z); if (L > 0.3) { const h = rayAt({ x: p.x, y: p.y, z: p.z }, { x: g.v.x / L, y: 0, z: g.v.z / L }, L * dt + 0.06); if (h) { if (gore > 0) splats.add({ x: h.x, y: h.y, z: h.z }, normalOf(h, { x: g.v.x / L, y: 0, z: g.v.z / L }).clone(), rnd(0.12, 0.25), Math.random() * 6.28, 1, { own: true, color: 0x6a0505, dry: 40, life: 70 }); g.v.x *= -0.2; g.v.z *= -0.2; } } }
        if (W.topAt && W.topAt(p.x, p.z) > p.y + 0.03) { p.x = px; p.z = pz; g.v.x *= -0.2; g.v.z *= -0.2; }   // inside a wall after a long frame: back out
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
        if (f.acc > 0.22) { f.acc = 0; dropEmit(p.x, p.y - 0.02, p.z, { n: 1, speed: 0.1, up: -0.5, size: 0.01, life: 0.9, spread: 0.1 });
          if (W && Math.random() < 0.35) splats.add({ x: p.x + rnd(-0.05, 0.05), y: W.groundAt(p.x, p.z, p.y), z: p.z + rnd(-0.05, 0.05) }, { x: 0, y: 1, z: 0 }, rnd(0.05, 0.1), Math.random() * 6.28, 1, { own: true, color: 0x5a0505, dry: 40, life: 80 }); }
        continue;
      }
      const k = 1 - f.t / f.dur;   // pumps hard, then weakens (with a pulse, like a heartbeat)
      const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(f.t * 9));
      while (f.acc > 0.04) {
        f.acc -= 0.04;
        dropEmit(p.x, p.y, p.z, { n: Math.round(6 * k * pulse * GK()) + 1, speed: 2.8 * k * pulse + 0.4, up: 2.6 * k + 0.4, size: 0.011, life: 1.1, dir: f.dir, spread: 0.4 });
        if (Math.random() < 0.5 * k) { const m = mist[mi = (mi + 1) % mist.length]; m.s.position.set(p.x, p.y, p.z); m.s.visible = true; m.t = 0; m.life = 0.5; m.v.set(f.dir.x * 1.2 + rnd(-0.4, 0.4), 1.6 * k + 0.3, f.dir.z * 1.2 + rnd(-0.4, 0.4)); m.s.scale.setScalar(rnd(0.12, 0.22)); }
        if (W && Math.random() < 0.25 * k) { const gx = p.x + f.dir.x * rnd(0.3, 1.2) + rnd(-0.3, 0.3), gz = p.z + f.dir.z * rnd(0.3, 1.2) + rnd(-0.3, 0.3); splats.add({ x: gx, y: W.groundAt(gx, gz, p.y), z: gz }, { x: 0, y: 1, z: 0 }, rnd(0.15, 0.3), Math.random() * 6.28, 1.3, { own: true, color: 0x6a0505, dry: 40, life: 80 }); }
      }
    }
  }

  // ---- dropped magazines and gun smoke ----
  const magGeo = new THREE.BoxGeometry(0.03, 0.12, 0.06), magMat = new THREE.MeshLambertMaterial({ color: 0x23252a }), mags = [];
  const _n = new THREE.Vector3(), _d = new THREE.Vector3();

  // W.ray answers with the CELL it hit (integer x, z) and the distance t, not the point: every blood and gib test used
  // the cell corner and no height (y undefined: the spray on a wall had no position and never showed). The point:
  function rayAt(o, d, L) { const h = W.ray(o, d, L); return h ? { x: o.x + d.x * h.t, y: o.y + d.y * h.t, z: o.z + d.z * h.t, t: h.t, side: h.side, m: h.m } : null; }
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
      for (let k = 0; k < Math.round((heavy ? 8 : 4) * G); k++) {
        const m = mist[mi = (mi + 1) % mist.length]; m.s.position.set(x, y, z); m.s.visible = true; m.t = 0; m.life = rnd(0.35, 0.6);
        m.v.set(d.x * rnd(1.5, 3) + rnd(-0.6, 0.6), d.y * 2 + rnd(-0.2, 0.6), d.z * rnd(1.5, 3) + rnd(-0.6, 0.6)); m.s.scale.setScalar(rnd(0.15, 0.28));
      }
      dropEmit(x, y, z, { n: Math.round((heavy ? 26 : 14) * G), speed: 2.6 + (gore > 1 ? 1.4 : 0), up: 0.6, size: 0.01, life: 1.0, dir: d, spread: 0.45 + (gore > 1 ? 0.2 : 0) });   // the spray: beads and streaks along the shot
      if (gore > 0) dropEmit(x, y, z, { n: Math.round(10 * G), speed: 0.8, up: 0.3, size: 0.006, life: 0.5, dir: { x: -d.x * 0.6, y: 0.1, z: -d.z * 0.6 }, spread: 0.8 });   // back spatter toward the shooter
      if (!W) return;
      // the spray follows the shot: streaked droplets fanned out behind the victim, on the wall (running down it) or the floor
      const fan = gore > 1 ? (heavy ? 4 : 3) : gore > 0 ? 2 : 1;
      for (let k = 0; k < fan; k++) {
        const a = k ? rnd(-0.35, 0.35) : rnd(-0.08, 0.08), dd = _sd.set(d.x * Math.cos(a) - d.z * Math.sin(a), d.y - 0.12 + (k ? rnd(-0.2, 0.15) : 0), d.x * Math.sin(a) + d.z * Math.cos(a));
        const h2 = rayAt({ x, y, z }, dd, k ? 4.5 : 3.2);
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
    // a hit that stays: entry (and exit) wound on the bone, and the wound keeps bleeding: drops run off it to the floor
    wound(bone, p, dir, size = 0.04, exit = false, bleed = 0) { if (gore < 1 && exit) return null; const m = wound(bone, p, dir, size, exit);
      if (m && bleed > 0 && gore > 0) { const wp = new THREE.Vector3(); fountains.push({ pos: () => (m.parent && m.visible ? m.getWorldPosition(wp) : null), dur: 0.01, dir: { x: 0, y: -1, z: 0 }, t: 0, acc: 0, drip: bleed }); }
      return m; },
    clearWounds() { for (const m of wounds) { if (m.parent) m.parent.remove(m); } },
    heart(x, y, z, dir, force = 1) { if (gore > 1) organ(x, y, z, dir, force); },   // a torso blown open (max gore)
    fountain(pos, dur = 2.2, dir = { x: 0, y: 1, z: 0 }) { if (gore > 0) fountains.push({ pos, dur: dur * (gore > 1 ? 1 : 0.5), dir, t: 0, acc: 0 }); },
    // a severed head or arm flying off with the shot (gore max), and the cap for the stump left behind (on a bone)
    limb(kind, x, y, z, dir, color, force = 1, piece = null) { if (gore > 1) limb(kind, x, y, z, dir, color, force, piece); },
    stumpCap(bone, child, radius) {   // child: the bone that came off (the cap sits at its joint, facing along it)
      if (gore < 2 || !bone || !child) return null; const c = caps[ci = (ci + 1) % caps.length]; if (c.parent) c.parent.remove(c);
      c.position.copy(child.position); c.quaternion.setFromUnitVectors(_n.set(0, 0, 1), _d.copy(child.position).normalize()); c.scale.setScalar(radius * 0.01 / Math.max(1e-6, bone.getWorldScale(_lp).x));   // radius in cm, whatever units the rig's bones use
      c.visible = true; bone.add(c); return c;
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
      smokeTick(dt); fireTick(dt); tickDrops(dt); tickGibs(dt); tickLimbs(dt); tickFountains(dt);
    },
    setWorld(w) { W = w; api.clear(); },
    clear() {
      for (const r of [holes.concrete, holes.wood, holes.metal, holes.soft, splats, sprays, drips, pools, scorches, gouges]) r.clear();
      for (const k of [...smokes.keys()]) api.smoke.remove(k); for (const k of [...fires.keys()]) api.fire.remove(k);
      for (const m of mags) m.o.visible = false; mags.length = 0;
      for (const g of gibs) g.m.visible = false; flushGibs(); for (const o of organs) o.m.visible = false; dSA.fill(0); fountains.length = 0; pending.length = 0; for (const m of wounds) if (m.parent) m.parent.remove(m); for (const L of limbs) L.g.visible = false; for (const c of caps) { if (c.parent) c.parent.remove(c); c.visible = false; }
    },
  };
  return api;
}
