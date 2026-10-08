// Item pictures and the main-menu stage, rendered with the game's own 3D models: weapons and knives with their
// painted finish (side view, like an inventory icon), agents standing. One small offscreen renderer, results cached
// as images, rendered a few per frame so menus never stutter. Falls back to flat drawings without WebGL.
import * as THREE from '../sdk/three.module.min.js';
import { makeGun, makeKnife, makePlayer, posePlayer, skinTexture, setTpGun, animateGlow } from './models.js';
import { itemInfo, AGENT_BY_ID, ITEM_BY_ID } from './skins.js';
import { loadChars, charsReady, makeSoldier, poseSoldier } from './chars.js';

let R = null, scene = null, cam = null, failed = false;
const cache = new Map(), queue = [];
let pumping = false;
function init() {
  if (R || failed) return !!R;
  try {
    R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    R.setPixelRatio(1); R.setSize(320, 160, false);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4250, 1.35));
    const d = new THREE.DirectionalLight(0xffffff, 1.2); d.position.set(1.5, 2.5, 3); scene.add(d);
    cam = new THREE.PerspectiveCamera(26, 2, 0.01, 50);
  } catch (e) { failed = true; R = null; }
  return !!R;
}
function objectFor(item) {
  const info = itemInfo(item); if (!info) return null;
  if (info.kind === 'agent') {
    const a = AGENT_BY_ID[info.weapon]; if (!a) return null;
    const r = makePlayer(a.look, a.team); posePlayer(r, { t: 0.4 }); setTpGun(r, a.team === 'T' ? 'ak47' : 'm4a4');
    r.g.rotation.y = Math.PI + 0.45; return { o: r.g, agent: true };
  }
  const tex = info.paint && !(info.kind === 'knife' && /:Vanilla$/.test(item.def)) ? skinTexture(item, info) : null;
  const g = info.kind === 'knife' ? makeKnife(info.weapon, tex, undefined, undefined, false) : makeGun(info.weapon, tex, undefined, undefined, false);
  g.rotation.set(0.12, -Math.PI / 2, 0.05);  // muzzle to the right, a touch of angle
  return { o: g };
}
function render(item) {
  const ob = objectFor(item); if (!ob) return null;
  const holder = new THREE.Group(); holder.add(ob.o); scene.add(holder);
  const box = new THREE.Box3().setFromObject(holder), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  holder.position.sub(mid);
  const fit = ob.agent ? size.y * 0.62 : Math.max(size.x / 2, size.y) * 0.62;
  cam.position.set(0, ob.agent ? 0.05 : 0.02, fit / Math.tan(13 * Math.PI / 180) * 1.08); cam.lookAt(0, 0, 0);
  if (ob.agent) { R.setSize(160, 240, false); cam.aspect = 160 / 240; } else { R.setSize(320, 160, false); cam.aspect = 2; }
  cam.updateProjectionMatrix();
  R.setClearColor(0x000000, 0); R.clear(); R.render(scene, cam);
  const url = R.domElement.toDataURL('image/png');
  scene.remove(holder);
  return url;
}
const keyOf = (it) => `${it.def}|${it.seed | 0}|${(+it.float || 0).toFixed(2)}`;
// ask for a picture: cb(url) now if cached, else soon. Returns false when 3D isn't available (draw flat instead).
export function thumb(item, cb) {
  const k = keyOf(item);
  if (cache.has(k)) { cb(cache.get(k)); return true; }
  const d = ITEM_BY_ID[item.def]; if (!d || d.kind === 'emote') return false;
  if (!init()) return false;
  queue.push([item, k, cb]);
  if (!pumping) { pumping = true; requestAnimationFrame(pump); }
  return true;
}
function pump() {
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < 12) {
    const [item, k, cb] = queue.shift();
    let url = cache.get(k);
    if (!url) { try { url = render(item); } catch (e) { url = null; } if (url) cache.set(k, url); }
    if (url) cb(url);
  }
  if (queue.length) requestAnimationFrame(pump); else pumping = false;
}

// ---- the main-menu stage: your equipped agent and gun, in a warm desert courtyard, slowly breathing ----
export function stage(canvas, look) {
  let r3;
  try { r3 = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); } catch (e) { return { set() {}, stop() {} }; }
  r3.setPixelRatio(Math.min(1, devicePixelRatio || 1));
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x1a1e24); sc.fog = new THREE.Fog(0x1a1e24, 7, 22);
  sc.add(new THREE.HemisphereLight(0xffe8c8, 0x2a2018, 1.0));
  const sun = new THREE.DirectionalLight(0xffd8a8, 1.5); sun.position.set(-3, 5, 4); sc.add(sun);
  const rim = new THREE.DirectionalLight(0x6a9aff, 0.8); rim.position.set(3, 3, -4); sc.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: 0x8a7350 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
  const wallM = new THREE.MeshLambertMaterial({ color: 0xb89a68 }), crateM = new THREE.MeshLambertMaterial({ color: 0x7a5a32 });
  for (const [x, z, w, h, d, m] of [[-4, -5, 6, 4, 1, wallM], [3.5, -6, 5, 5, 1, wallM], [-6.5, -1, 1, 3.5, 8, wallM], [1.8, -2.2, 1.1, 1.1, 1.1, crateM], [2.6, -2.6, 0.9, 0.9, 0.9, crateM], [1.9, -2.3, 0.8, 0.8, 0.8, crateM]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, h / 2 + (m === crateM && w < 0.9 ? 1.1 : 0), z); sc.add(b);
  }
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
  const frame = (now) => {
    if (stopped) return; raf = requestAnimationFrame(frame);
    if (now - last < 33) return; const dt = (now - last) / 1000; last = now; t += dt;   // 30 fps is plenty here
    const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== w || canvas.height !== h) { r3.setSize(w, h, false); cam3.aspect = w / Math.max(1, h); cam3.updateProjectionMatrix(); }
    if (rig && rig.soldier) { rig.g.rotation.y = 0.5 + Math.sin(t * 0.25) * 0.12; poseSoldier(rig, { dt, yaw: rig.g.rotation.y, pitch: Math.sin(t * 0.7) * 0.05 }); }
    else if (rig) { posePlayer(rig, { t, pitch: Math.sin(t * 0.7) * 0.05 }); rig.torso.position.y += Math.sin(t * 1.6) * 0.008; rig.g.rotation.y = 0.5 + Math.sin(t * 0.25) * 0.12; }
    const a = Math.sin(t * 0.08) * 0.15;
    cam3.position.set(Math.sin(a) * 5.2, 1.55, Math.cos(a) * 5.2); cam3.lookAt(0.15, 1.05, 0);
    animateGlow(t, dt); r3.render(sc, cam3);
  };
  raf = requestAnimationFrame(frame);
  return { set, stop() { stopped = true; cancelAnimationFrame(raf); r3.dispose(); try { r3.forceContextLoss(); } catch (e) { /* gone */ } } };
}
