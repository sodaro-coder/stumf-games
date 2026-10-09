// Item pictures, the click-to-inspect viewer and the main-menu stage, all rendered with the game's own 3D models in a
// photo studio: a soft-box environment map (so painted metal, chrome and gloss finishes reflect like real objects),
// a warm key light, a cool rim light and filmic tone mapping. Weapons and knives show their painted finish; outfits
// are the real animated soldier wearing them, rifle in hand, three-quarter on; emotes are performed by a soldier.
//  thumb(item, cb)        inventory / case / pass pictures: one small offscreen renderer, cached, a few per frame
//  viewer(canvas, item)   the inspect window when you click an item: live 3D, drag to turn, wheel / pinch to zoom
//  stage(canvas, look)    the main-menu courtyard with your equipped outfit
import * as THREE from '../sdk/three.module.min.js';
import { makeGun, makeKnife, makeFingerGun, makePlayer, posePlayer, skinTexture, setTpGun, animateGlow } from './models.js';
import { itemInfo, AGENT_BY_ID, ITEM_BY_ID, EMOTE_BY_ID } from './skins.js';
import { loadChars, charsReady, makeSoldier, poseSoldier } from './chars.js';
import { LIGHT } from './world.js';

// ---- the studio --------------------------------------------------------------------------------------------------------
// what shiny surfaces reflect: a graded backdrop with two big soft boxes (key above-left, strip on the right) and a
// dark floor, blurred into a PMREM environment once per renderer
function studioEnv(renderer) {
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD; void main() { float y = vD.y;
      vec3 c = y > 0.0 ? mix(vec3(0.42, 0.44, 0.48), vec3(0.85, 0.88, 0.95), pow(y, 0.7)) : mix(vec3(0.3, 0.28, 0.26), vec3(0.06, 0.06, 0.07), min(1.0, -y * 2.5));
      gl_FragColor = vec4(c, 1.0); }` })));
  const box = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 0.97, k * 0.92), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
  box(6, 4, -4, 6, 4, 6); box(1.5, 8, 7, 1, -2, 3.5); box(5, 2, 2, 2, -7, 2);
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(es, 0.03); pm.dispose();
  es.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt;
}
function studio(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const sc = new THREE.Scene(), env = studioEnv(renderer);
  sc.environment = env.texture;
  // soft, even studio light: a big sky dome, a warm key from the upper left, a front fill so nothing goes black, and a
  // cool rim from behind that traces the silhouette
  sc.add(new THREE.HemisphereLight(0xf4f0ff, 0x8a8070, 1.5));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.0); key.position.set(-2, 3.2, 3); sc.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1.0); fill.position.set(2.5, 0.8, 3); sc.add(fill);
  const rim = new THREE.DirectionalLight(0x9cc0ff, 1.6); rim.position.set(2.5, 1.8, -3); sc.add(rim);
  return { sc, env };
}
// the soldier's materials also read the map's baked light; in the studio there is no map, so switch it off while drawing
function studioRender(renderer, sc, cam) {
  const b = LIGHT.bake.value, p = LIGHT.prInfo.value.z;
  LIGHT.bake.value = 0; LIGHT.prInfo.value.z = 0;
  renderer.render(sc, cam);
  LIGHT.bake.value = b; LIGHT.prInfo.value.z = p;
}
// a soft contact shadow under standing figures
let shadowTex = null;
function contactShadow(r = 0.55) {
  if (!shadowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.6, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); shadowTex = new THREE.CanvasTexture(c); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.005; return m;
}

// ---- what to show for an item ------------------------------------------------------------------------------------------
// figure: { o, kind: 'gun' | 'figure', emote, rig }. Outfits and emotes need the soldier: null (wait) until it has loaded.
const PERFORMER = { look: { ...AGENT_BY_ID.a_t_default.look }, team: 'T' };
function figureFor(item, opt = {}) {
  const info = itemInfo(item); if (!info) return undefined;
  if (info.kind === 'agent' || info.kind === 'emote') {
    if (!charsReady()) return null;
    const a = info.kind === 'agent' ? AGENT_BY_ID[info.weapon] : (opt.performer || PERFORMER); if (!a) return undefined;
    const r = makeSoldier(a.look, a.team, true), g = new THREE.Group(); g.add(r.g); g.add(contactShadow());
    const em = info.kind === 'emote' ? EMOTE_BY_ID[info.weapon] : null;
    if (!em) { setTpGun(r, a.team === 'CT' ? 'm4a4' : 'ak47'); r.g.rotation.y = Math.PI; }   // armed: the rig faces down its aim (-z), so turn it round to the camera; emotes already play facing out
    return { o: g, kind: 'figure', rig: r, emote: em ? { anim: em.anim, t: 0, dur: 1e9 } : null };
  }
  const tex = info.paint && !(info.kind === 'knife' && /:Vanilla$/.test(item.def)) ? skinTexture(item, info) : null;
  const g = /:Finger Gun$/.test(item.def) ? makeFingerGun('#3c4e66') : info.kind === 'knife' ? makeKnife(info.weapon, tex, undefined, undefined, false) : makeGun(info.weapon, tex, undefined, undefined, false);
  const holder = new THREE.Group(); holder.add(g);
  g.rotation.set(0, -Math.PI / 2, 0);   // muzzle / blade tip to the right
  const box = new THREE.Box3().setFromObject(holder); g.position.sub(box.getCenter(new THREE.Vector3()));
  return { o: holder, kind: 'gun', size: box.getSize(new THREE.Vector3()) };
}
// every texture on it has arrived (an outfit drawn before its uniform photo loads comes out black)
function texReady(o) {
  let ok = true;
  o.traverse((m) => { const mt = m.material; if (!mt || !ok) return; for (const k of ['map', 'normalMap']) { const t = mt[k]; if (t && t.isTexture && !t.isCanvasTexture && !t.isDataTexture && !(t.image && (t.image.width || t.image.complete))) ok = false; } });
  return ok;
}
// pose a figure for time t (seconds): idle with the gun, or the emote at that moment
function poseFigure(f, t, dt) {
  const r = f.rig;
  if (f.emote) { f.emote.t = t; r.t = t; }
  poseSoldier(r, { dt, yaw: f.o.rotation.y, emote: f.emote, pitch: f.emote ? 0 : Math.sin(t * 0.7) * 0.04 });
}
// the moment of each emote that reads best as a still picture
const EMOTE_STILL = { wave: 0.5, salute: 0.6, dance: 0.9, dab: 0.6, cry: 0.8, flex: 0.7, tpose: 0.5, floss: 0.35, chicken: 0.45, worm: 0.9, fart: 0.9, twerk: 0.6,
  griddy: 0.4, headbang: 0.3, heli: 0.4, clap: 0.35, zombie: 0.6, tbag: 0.75 };
// camera framing: guns side on with a slight high three-quarter; figures full body from the front three-quarter
function frame(cam, f, aspect, zoom = 1) {
  cam.aspect = aspect;
  if (f.kind === 'gun') {
    const s = f.size, fitW = (s.z > s.x ? s.z : s.x) / 2 / aspect, fitH = s.y / 2, fit = Math.max(fitW, fitH) * 1.18;
    const d = fit / Math.tan(cam.fov * Math.PI / 360) / zoom;
    cam.position.set(0, d * 0.12, d); cam.lookAt(0, 0, 0);
  } else {
    const h = 1.95, d = h * 0.56 / Math.tan(cam.fov * Math.PI / 360) / zoom;
    cam.position.set(0, 1.0, d); cam.lookAt(0, 0.9, 0);
  }
  cam.updateProjectionMatrix();
}

// ---- inventory pictures ------------------------------------------------------------------------------------------------
let R = null, S = null, cam = null, failed = false;
const cache = new Map(), queue = [];
let pumping = false;
function init() {
  if (R || failed) return !!R;
  try {
    R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    R.setPixelRatio(1); R.setSize(640, 320, false);
    S = studio(R); cam = new THREE.PerspectiveCamera(24, 2, 0.01, 50);
  } catch (e) { failed = true; R = null; }
  return !!R;
}
// rendered at 640 x 320 (twice the card's canvas) so the downscale smooths every edge
function render(item) {
  const f = figureFor(item); if (f === null) return null; if (!f) return undefined;
  if (!texReady(f.o)) return null;   // try again in a moment
  R.toneMappingExposure = f.kind === 'figure' ? 1.25 : 1.05;
  const holder = new THREE.Group(); holder.add(f.o); S.sc.add(holder);
  if (f.kind === 'gun') { f.o.rotation.set(0.1, 0.32, 0.04); }
  else {
    f.o.rotation.y = f.emote ? -0.35 : -0.22;
    if (f.emote) { const t1 = EMOTE_STILL[f.emote.anim] ?? 0.6; for (let t = 0; t <= t1 + 1e-6; t += 1 / 30) poseFigure(f, t, 1 / 30); }
    else for (let k = 0; k < 20; k++) poseFigure(f, k / 30, 1 / 30);
  }
  frame(cam, f, 2);
  R.setClearColor(0x000000, 0); R.clear(); studioRender(R, S.sc, cam);
  const url = R.domElement.toDataURL('image/png');
  S.sc.remove(holder);
  return url;
}
const keyOf = (it) => `${it.def}|${it.seed | 0}|${(+it.float || 0).toFixed(2)}`;
// ask for a picture: cb(url) now if cached, else soon. Returns false when 3D isn't available (draw flat instead).
export function thumb(item, cb) {
  const k = keyOf(item);
  if (cache.has(k)) { cb(cache.get(k)); return true; }
  if (!ITEM_BY_ID[item.def]) return false;
  if (!init()) return false;
  queue.push([item, k, cb]);
  if (!pumping) { pumping = true; requestAnimationFrame(pump); }
  return true;
}
let waiting = false;
function pump() {
  const t0 = performance.now(), later = [];
  while (queue.length && performance.now() - t0 < 12) {
    const job = queue.shift(), [item, k, cb] = job;
    let url = cache.get(k);
    if (!url) {
      try { url = render(item); } catch (e) { url = undefined; }
      if (url === null) { later.push(job); if (!waiting) { waiting = true; loadChars().then(() => { waiting = false; if (!pumping && queue.length) { pumping = true; requestAnimationFrame(pump); } }); } continue; }
      if (url) cache.set(k, url);
    }
    if (url) cb(url);
  }
  queue.push(...later);
  if (queue.length && !later.length) requestAnimationFrame(pump);
  else if (queue.length && charsReady()) setTimeout(() => requestAnimationFrame(pump), 150);   // waiting on textures
  else pumping = false;
}

// ---- the inspect viewer (click an item) ----------------------------------------------------------------------------------
// Live 3D on the modal's canvas: guns turn slowly and can be spun round by dragging (see both sides, the finish
// catching the soft boxes); outfits stand idling with their gun and turn on drag; emotes play on a loop. Mythics glow.
// opt.performer: { look, team } who performs an emote (your equipped outfit). Returns { stop }.
export function viewer(canvas, item, opt = {}) {
  let r3;
  try { r3 = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return null; }
  r3.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const { sc, env } = studio(r3), vc = new THREE.PerspectiveCamera(24, 2, 0.01, 50);
  let f = null, stopped = false, raf = 0, t = 0, last = performance.now(), yaw = 0, pitch = 0, vyaw = 0.35, zoom = 1, drag = null, idle = 0;
  const build = () => { f = figureFor(item, opt); if (f) { r3.toneMappingExposure = f.kind === 'figure' ? 1.25 : 1.05; sc.add(f.o); if (f.kind === 'figure') yaw = f.emote ? -0.35 : -0.22; else { yaw = 0.3; pitch = 0.08; } } return f; };
  if (build() === null) loadChars().then(() => { if (!stopped) build(); });
  // drag to turn (and tilt guns), wheel / pinch to zoom; it keeps drifting the way you threw it, then settles back
  const pts = new Map();
  const down = (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); drag = { x: e.clientX, y: e.clientY, d: pts.size > 1 ? pinch() : 0 }; idle = 0; };
  const pinch = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  const move = (e) => {
    if (!pts.has(e.pointerId) || !drag) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size > 1) { const d = pinch(); if (drag.d) zoom = Math.min(2.6, Math.max(0.7, zoom * d / drag.d)); drag.d = d; return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    yaw += dx * 0.012; vyaw = dx * 0.6; if (f && f.kind === 'gun') pitch = Math.min(0.9, Math.max(-0.9, pitch + dy * 0.008)); idle = 0;
  };
  const up = (e) => { pts.delete(e.pointerId); if (!pts.size) drag = null; };
  const wheel = (e) => { e.preventDefault(); zoom = Math.min(2.6, Math.max(0.7, zoom * Math.exp(-e.deltaY * 0.0015))); };
  canvas.style.touchAction = 'none'; canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('wheel', wheel, { passive: false });
  const tick = (now) => {
    if (stopped) return; raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; idle += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight, pr = r3.getPixelRatio();
    if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) r3.setSize(w, h, false);
    if (!f) return;
    if (!drag) { vyaw += ((f.kind === 'gun' ? 0.32 : 0.22) - vyaw) * Math.min(1, dt * 1.5); yaw += vyaw * dt; if (idle > 2.5 && f.kind === 'gun') pitch += (0.08 - pitch) * Math.min(1, dt * 1.2); }
    if (f.kind === 'gun') { f.o.rotation.set(pitch, yaw, 0); f.o.position.y = Math.sin(t * 1.3) * 0.004; }
    else { f.o.rotation.y = yaw; poseFigure(f, t, dt); }
    frame(vc, f, w / Math.max(1, h), zoom);
    animateGlow(t, dt);
    r3.setClearColor(0x000000, 0); r3.clear(); studioRender(r3, sc, vc);
  };
  raf = requestAnimationFrame(tick);
  return { stop() { stopped = true; cancelAnimationFrame(raf); env.dispose(); r3.dispose(); try { r3.forceContextLoss(); } catch (e) { /* gone */ } } };
}

// ---- the main-menu stage: your equipped agent and gun, in a warm desert courtyard, slowly breathing ----
export function stage(canvas, look) {
  let r3;
  try { r3 = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); } catch (e) { return { set() {}, stop() {} }; }
  r3.setPixelRatio(Math.min(1, devicePixelRatio || 1));
  r3.toneMapping = THREE.ACESFilmicToneMapping; r3.toneMappingExposure = 1.05;
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x1a1e24); sc.fog = new THREE.Fog(0x1a1e24, 7, 22);
  const env = studioEnv(r3); sc.environment = env.texture;
  sc.add(new THREE.HemisphereLight(0xffe8c8, 0x2a2018, 1.0));
  const sun = new THREE.DirectionalLight(0xffd8a8, 1.8); sun.position.set(-3, 5, 4); sc.add(sun);
  const rim = new THREE.DirectionalLight(0x6a9aff, 1.1); rim.position.set(3, 3, -4); sc.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: 0x8a7350 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
  const wallM = new THREE.MeshLambertMaterial({ color: 0xb89a68 }), crateM = new THREE.MeshLambertMaterial({ color: 0x7a5a32 });
  for (const [x, z, w, h, d, m] of [[-4, -5, 6, 4, 1, wallM], [3.5, -6, 5, 5, 1, wallM], [-6.5, -1, 1, 3.5, 8, wallM], [1.8, -2.2, 1.1, 1.1, 1.1, crateM], [2.6, -2.6, 0.9, 0.9, 0.9, crateM], [1.9, -2.3, 0.8, 0.8, 0.8, crateM]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, h / 2 + (m === crateM && w < 0.9 ? 1.1 : 0), z); sc.add(b);
  }
  const shadow = contactShadow(0.6); shadow.position.set(0.9, 0.01, 0); sc.add(shadow);
  const cam3 = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  let rig = null, t = 0, raf = 0, stopped = false, last = performance.now();
  let cur = look;
  const set = (lk, team, wid) => {
    cur = { look: lk, team, wid };
    if (rig) sc.remove(rig.g);
    rig = charsReady() ? makeSoldier(lk, team, true) : makePlayer(lk, team);   // the realistic soldier once it has loaded
    setTpGun(rig, wid || (team === 'CT' ? 'm4a4' : 'ak47')); rig.g.position.set(0.9, 0, 0); rig.g.rotation.y = 0.5; sc.add(rig.g);
  };
  set(look.look, look.team, look.wid);
  if (!charsReady()) loadChars().then(() => { if (!stopped && charsReady()) set(cur.look, cur.team, cur.wid); });
  const frame3 = (now) => {
    if (stopped) return; raf = requestAnimationFrame(frame3);
    if (now - last < 33) return; const dt = (now - last) / 1000; last = now; t += dt;   // 30 fps is plenty here
    const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== w || canvas.height !== h) { r3.setSize(w, h, false); cam3.aspect = w / Math.max(1, h); cam3.updateProjectionMatrix(); }
    if (rig && rig.soldier) { rig.g.rotation.y = 0.5 + Math.sin(t * 0.25) * 0.12; poseSoldier(rig, { dt, yaw: rig.g.rotation.y, pitch: Math.sin(t * 0.7) * 0.05 }); }
    else if (rig) { posePlayer(rig, { t, pitch: Math.sin(t * 0.7) * 0.05 }); rig.torso.position.y += Math.sin(t * 1.6) * 0.008; rig.g.rotation.y = 0.5 + Math.sin(t * 0.25) * 0.12; }
    const a = Math.sin(t * 0.08) * 0.15;
    cam3.position.set(Math.sin(a) * 5.2, 1.55, Math.cos(a) * 5.2); cam3.lookAt(0.15, 1.05, 0);
    animateGlow(t, dt); studioRender(r3, sc, cam3);
  };
  raf = requestAnimationFrame(frame3);
  return { set, stop() { stopped = true; cancelAnimationFrame(raf); env.dispose(); r3.dispose(); try { r3.forceContextLoss(); } catch (e) { /* gone */ } } };
}
