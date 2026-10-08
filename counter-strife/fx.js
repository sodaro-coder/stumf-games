// Effects: one pooled particle system (shell casings, sparks, dust, blood, confetti, feathers, ketchup...), comic
// text pops, the sky dome, and the joke weapons' own inspect animations and kill effects.
import * as THREE from '../sdk/three.module.min.js';
import { ITEM_BY_ID, KNIFE_BY_ID } from './skins.js';

// ---- particles: a fixed pool of tiny boxes, gravity + bounce on the floor height, no garbage ----
export class Particles {
  constructor(scene, groundAt, n = 220) {
    this.geo = new THREE.BoxGeometry(1, 1, 1); this.mats = new Map(); this.p = []; this.groundAt = groundAt;
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(this.geo, this.mat('#ffffff')); m.visible = false; m.matrixAutoUpdate = true; scene.add(m); this.p.push({ m, t: 0, vx: 0, vy: 0, vz: 0, g: 1, spin: 0 }); }
    this.i = 0;
  }
  mat(c) { if (!this.mats.has(c)) this.mats.set(c, new THREE.MeshBasicMaterial({ color: c })); return this.mats.get(c); }
  emit(x, y, z, { n = 8, colors = ['#ffffff'], speed = 2, up = 1, size = 0.05, life = 0.6, g = 1, spread = 1, dir = null } = {}) {
    for (let k = 0; k < n; k++) {
      const q = this.p[this.i = (this.i + 1) % this.p.length], a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      q.m.material = this.mat(colors[k % colors.length]); q.m.visible = true; q.m.position.set(x, y, z); q.m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      q.vx = Math.cos(a) * s * spread + (dir ? dir.x * speed : 0); q.vz = Math.sin(a) * s * spread + (dir ? dir.z * speed : 0); q.vy = up * (0.5 + Math.random()) * speed + (dir ? dir.y * speed : 0);
      q.t = life * (0.6 + Math.random() * 0.8); q.g = g; q.spin = (Math.random() - 0.5) * 20;
    }
  }
  tick(dt) {
    for (const q of this.p) {
      if (q.t <= 0) continue;
      q.t -= dt; if (q.t <= 0) { q.m.visible = false; continue; }
      q.vy -= 14 * q.g * dt; const m = q.m.position;
      m.x += q.vx * dt; m.y += q.vy * dt; m.z += q.vz * dt;
      const gr = this.groundAt(m.x, m.z);
      if (m.y < gr) { m.y = gr; q.vy *= -0.35; q.vx *= 0.6; q.vz *= 0.6; }
      q.m.rotation.x += q.spin * dt; q.m.rotation.y += q.spin * dt * 0.7;
    }
  }
}

// ---- floating comic text ("BANG!", "PEW") ----
export function textPop(scene, x, y, z, text, color = '#ffd23a') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.font = '900 64px Impact, "Arial Black", system-ui'; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(text, 128, 72); g.fillStyle = color; g.fillText(text, 128, 72);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.position.set(x, y, z); s.scale.set(1.6, 0.6, 1); s.renderOrder = 9; scene.add(s);
  const t0 = performance.now();
  const step = () => { const k = (performance.now() - t0) / 900; if (k >= 1) { scene.remove(s); s.material.map.dispose(); s.material.dispose(); return; } s.position.y = y + k * 0.8; s.material.opacity = 1 - k * k; s.scale.set(1.6 + k * 0.6, 0.6 + k * 0.22, 1); requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// ---- sky: a big inside-out sphere with a vertical gradient (horizon to zenith) ----
export function skyDome(scene, horizon, zenith) {
  const geo = new THREE.SphereGeometry(300, 24, 12), col = [], a = new THREE.Color(horizon), b = new THREE.Color(zenith);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = Math.max(0, pos.getY(i) / 300); const c = a.clone().lerp(b, Math.pow(k, 0.6)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10; scene.add(m); return m;
}

// ---- joke weapons: what's special about the one you hold / killed with ----
const KNIFE_STYLE = { dildo: 'jiggle', hotdog: 'squeeze', plunger: 'plunge', chicken: 'squeeze', baguette: 'twirl', fish: 'flop', banana: 'twirl' };
const SKIN_STYLE = { 'Finger Gun': 'spin', 'BRRRT': 'shake', 'Fart Cloud': 'shake', 'Poop Emoji Party': 'shake', 'Thicc Boi': 'jiggle', 'Dong Doppler': 'jiggle', 'Golden Shower': 'spin', 'Hot Dog Water': 'squeeze' };
export function funnyKey(skin) {
  const d = skin && ITEM_BY_ID[skin.def]; if (!d) return null;
  return d.kind === 'knife' ? ((KNIFE_BY_ID[d.weapon] || {}).joke ? KNIFE_BY_ID[d.weapon].model : null) : (SKIN_STYLE[d.finish] ? d.finish : null);
}
export const inspectStyle = (key) => KNIFE_STYLE[key] || SKIN_STYLE[key] || null;
export const INSPECT_SOUND = { jiggle: 'boing', squeeze: 'squeak', plunge: 'fwoop', twirl: 'whoosh', flop: 'flop', spin: 'pewpew', shake: 'fart' };
// apply the funny inspect on top of the normal pose (k = 0..1 through the animation)
export function applyInspect(vm, style, k) {
  const s = Math.sin(k * Math.PI);
  switch (style) {
    case 'jiggle': vm.rotation.z += Math.sin(k * 40) * 0.35 * s; vm.scale.y *= 1 + Math.sin(k * 30) * 0.15 * s; vm.position.y += s * 0.05; break;
    case 'squeeze': vm.scale.x *= 1 + Math.sin(k * 18) * 0.25 * s; vm.scale.y *= 1 - Math.sin(k * 18) * 0.2 * s; vm.position.y += s * 0.05; break;
    case 'plunge': vm.position.z += Math.sin(k * 22) * 0.08 * s; vm.position.y += s * 0.04; break;
    case 'twirl': vm.rotation.z += k * Math.PI * 4; vm.position.y += s * 0.06; break;
    case 'flop': vm.rotation.x += Math.sin(k * 25) * 0.7 * s; vm.rotation.z += Math.sin(k * 17) * 0.4 * s; break;
    case 'spin': vm.rotation.x -= k * Math.PI * 6; vm.position.y += s * 0.08; break;
    case 'shake': vm.position.x += Math.sin(k * 90) * 0.012 * s; vm.position.y += Math.sin(k * 70) * 0.012 * s; break;
    default: break;
  }
}
// kill effects: particles + a sound (+ text) at the victim
export const KILL_FX = {
  dildo: { colors: ['#ff4ad2', '#7a2aff', '#ffffff', '#ffd23a'], n: 40, speed: 4, sound: 'doing', text: 'BOING!', textColor: '#ff4ad2' },
  hotdog: { colors: ['#c8321e', '#f2d33c'], n: 30, speed: 3, sound: 'squish', text: 'SPLAT!' },
  chicken: { colors: ['#ffffff', '#f4f0e0'], n: 30, speed: 2.5, g: 0.15, sound: 'squeak', text: 'BAWK!' },
  fish: { colors: ['#4ab0ff', '#a8e0ff'], n: 30, speed: 3, sound: 'flop', text: 'SLAP!' },
  banana: { colors: ['#f2d33c', '#8a6a20'], n: 22, speed: 3, sound: 'squish', text: 'PEELED' },
  plunger: { colors: ['#6b4423', '#4ab0ff'], n: 26, speed: 3, sound: 'fwoop', text: 'FLUSHED' },
  baguette: { colors: ['#d8a050', '#f4e0b0'], n: 26, speed: 2.5, sound: 'crunch', text: 'OUI OUI' },
  'Finger Gun': { colors: ['#ffd23a', '#ffffff'], n: 16, speed: 2, sound: 'pewpew', text: 'BANG!' },
  'BRRRT': { colors: ['#9ac84a', '#7a9a3a'], n: 24, speed: 1.2, g: -0.05, sound: 'fart', text: 'BRRRT' },
  'Fart Cloud': { colors: ['#9ac84a', '#b8c870'], n: 24, speed: 1.2, g: -0.05, sound: 'fart', text: 'PFFT' },
  'Poop Emoji Party': { colors: ['#6b4423', '#7ad0ff'], n: 26, speed: 3, sound: 'fart', text: 'OOPS' },
  'Golden Shower': { colors: ['#f2e04a', '#fff3a0'], n: 30, speed: 3, sound: 'squirt', text: 'PSSSH' },
  'Hot Dog Water': { colors: ['#c8a050', '#f2d8a0'], n: 26, speed: 3, sound: 'squirt', text: 'GROSS' },
  'Thicc Boi': { colors: ['#ff5ab4', '#ffffff'], n: 26, speed: 3, sound: 'boing', text: 'THICC' },
  'Dong Doppler': { colors: ['#ff4ad2', '#2ad2ff', '#7a2aff'], n: 34, speed: 4, sound: 'boing', text: 'BOING!' },
};
