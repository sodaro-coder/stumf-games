// Gore system: directional blood spray on hits, kill bursts, headshot pops,
// dismemberment gibs (heavy weapons / snipers / knives), and persistent blood
// decals on the ground. Everything is pooled (no per-kill allocation after
// warmup) and every entry point is a no-op unless the caller passes gore on.
// Init once via initGore(parts) with the game's Particles instance.
import * as THREE from '../sdk/three.module.min.js';

export const BLOOD = ['#8a0a0a', '#a51212', '#c01a1a', '#6e0808'];
const CLOTH_T = '#4e4433', CLOTH_CT = '#2a3127';

// ---- dismemberment chunks: stretched tumbling boxes (limb-like), own pool ----
class Gibs {
  constructor(scene, groundAt, n = 24) {
    this.scene = scene; this.groundAt = groundAt; this.g = []; this.mats = new Map();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, this.mat(BLOOD[0]));
      m.visible = false; scene.add(m);
      this.g.push({ m, t: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, sx: 0.1, sy: 0.08, sz: 0.2 });
    }
    this.i = 0;
  }
  mat(c) { if (!this.mats.has(c)) this.mats.set(c, new THREE.MeshBasicMaterial({ color: c })); return this.mats.get(c); }
  spawn(x, y, z, dir, colors, n, speed) {
    for (let k = 0; k < n; k++) {
      const q = this.g[this.i = (this.i + 1) % this.g.length];
      q.m.material = this.mat(colors[(Math.random() * colors.length) | 0]);
      q.m.visible = true;
      q.m.position.set(x + (Math.random() - 0.5) * 0.35, y + Math.random() * 0.35, z + (Math.random() - 0.5) * 0.35);
      // stretched chunk: longer on one axis reads as a limb fragment, not a cube
      q.sx = 0.05 + Math.random() * 0.07; q.sy = 0.05 + Math.random() * 0.06; q.sz = 0.13 + Math.random() * 0.17;
      q.m.scale.set(q.sx, q.sy, q.sz);
      q.m.rotation.set(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3);
      const a = Math.random() * Math.PI * 2, s = speed * (0.5 + Math.random() * 0.9);
      q.vx = Math.cos(a) * s * 0.6 + (dir ? dir.x * speed : 0);
      q.vz = Math.sin(a) * s * 0.6 + (dir ? dir.z * speed : 0);
      q.vy = (0.6 + Math.random() * 0.9) * speed + (dir && dir.y ? dir.y * speed : 0);
      q.rx = (Math.random() - 0.5) * 14; q.ry = (Math.random() - 0.5) * 14;
      q.t = 2.2 + Math.random() * 0.8;
    }
  }
  tick(dt) {
    for (const q of this.g) {
      if (q.t <= 0) continue;
      q.t -= dt;
      if (q.t <= 0) { q.m.visible = false; continue; }
      q.vy -= 13 * dt;
      const m = q.m.position;
      m.x += q.vx * dt; m.y += q.vy * dt; m.z += q.vz * dt;
      const gr = this.groundAt(m.x, m.z);
      if (m.y < gr + 0.05) {
        m.y = gr + 0.05;
        q.vy = Math.abs(q.vy) > 1.2 ? q.vy * -0.4 : 0;
        q.vx *= 0.7; q.vz *= 0.7; q.rx *= 0.55; q.ry *= 0.55;
      }
      q.m.rotation.x += q.rx * dt; q.m.rotation.y += q.ry * dt;
      // sink away in the last half second instead of popping
      if (q.t < 0.5) { const k = Math.max(0.01, q.t / 0.5); q.m.scale.set(q.sx * k, q.sy * k, q.sz * k); }
    }
  }
}

// ---- persistent blood decals: pooled flat splats on the ground ----
let decalPool = null, decalGround = null;
function decalTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  // a few overlapping blobs: reads as a splatter, not a perfect circle
  const blobs = [[64, 64, 44], [44, 58, 22], [84, 70, 20], [60, 88, 16], [88, 48, 13], [36, 82, 12]];
  for (const [bx, by, br] of blobs) {
    const g = x.createRadialGradient(bx, by, 1, bx, by, br);
    g.addColorStop(0, 'rgba(94,8,8,0.85)'); g.addColorStop(0.7, 'rgba(110,10,10,0.55)'); g.addColorStop(1, 'rgba(110,10,10,0)');
    x.fillStyle = g; x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill();
  }
  // a few flung droplets around the main splat
  for (let k = 0; k < 10; k++) {
    const a = Math.random() * 6.3, d = 46 + Math.random() * 16, r = 2 + Math.random() * 3.5;
    const g = x.createRadialGradient(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 0.5, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r);
    g.addColorStop(0, 'rgba(110,10,10,0.7)'); g.addColorStop(1, 'rgba(110,10,10,0)');
    x.fillStyle = g; x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function initBloodDecals(scene, groundAt, n = 36) {
  if (decalPool) return;
  decalGround = groundAt;
  const tex = decalTexture(), geo = new THREE.PlaneGeometry(1, 1);
  decalPool = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.3;
    m.visible = false; m.renderOrder = 1;
    scene.add(m); decalPool.push(m);
  }
  decalPool.i = 0;
}
export function bloodDecal(x, z, s = 1) {
  if (!decalPool) return;
  const m = decalPool[decalPool.i = (decalPool.i + 1) % decalPool.length];
  m.position.set(x + (Math.random() - 0.5) * 0.5, decalGround(x, z) + 0.02, z + (Math.random() - 0.5) * 0.5);
  m.rotation.z = Math.random() * 6.3;
  const sc = s * (0.8 + Math.random() * 0.8);
  m.scale.set(sc, sc, 1);
  m.visible = true;
}

// ---- wiring ----
let gibs = null, hooked = false;
export function initGore(parts) {
  try {
    if (!parts || hooked) return;
    hooked = true;
    gibs = new Gibs(parts.scene, parts.groundAt);
    initBloodDecals(parts.scene, parts.groundAt);
    // fold the gib simulation into the existing particle tick: no game-loop edit needed
    const orig = parts.tick.bind(parts);
    parts.tick = (dt) => { try { orig(dt); } finally { try { gibs.tick(dt); } catch (e) { /* never break the frame */ } } };
  } catch (e) { /* gore is cosmetic: never break the game */ }
}

// small directional spray for non-fatal hits (replaces the old inline puff)
export function bloodHit(parts, x, y, z, dir) {
  try {
    parts.emit(x, y, z, { n: 7, colors: BLOOD, speed: 2.4, up: 0.5, size: 0.045, life: 0.7, dir, spread: 0.7 });
  } catch (e) {}
}

// full kill treatment. dir = killer->victim (blood flies away from the shooter).
// cat: weapon category ('sniper' | 'heavy' | 'knife' | ...). head: bool. team: 'T' | 'CT'.
export function goreKill(parts, x, y, z, dir, cat, head, team) {
  try {
    const big = cat === 'sniper' || cat === 'heavy';
    // torso burst, directional
    parts.emit(x, y, z, { n: big ? 26 : 16, colors: BLOOD, speed: big ? 4.2 : 3.2, up: 0.7, size: 0.055, life: 1.1, dir, spread: 0.8 });
    // hanging blood mist
    try { parts.smoke(x, y + 0.2, z, { n: 2, color: '#7a0d0d', size: 0.3, life: 1.4, rise: 0.35, alpha: 0.5 }); } catch (e) {}
    // headshot: second burst at head height
    if (head) parts.emit(x, y + 0.55, z, { n: 14, colors: BLOOD, speed: 3.4, up: 0.9, size: 0.05, life: 0.9, dir, spread: 0.9 });
    // dismemberment: limb-fragment gibs for heavy weapons, snipers, knives
    if (gibs && (cat === 'sniper' || cat === 'heavy' || cat === 'knife')) {
      const cloth = team === 'CT' ? CLOTH_CT : CLOTH_T;
      const n = cat === 'sniper' ? 5 : cat === 'heavy' ? 4 : 3;
      gibs.spawn(x, y + 0.3, z, dir, [...BLOOD, ...BLOOD, cloth], n, big ? 5 : 3.6);
    }
    // blood pool on the ground where they fell
    bloodDecal(x, z, big || head ? 1.7 : 1.0);
  } catch (e) {}
}
