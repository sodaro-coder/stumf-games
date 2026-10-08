// Effects: one pooled particle system (shell casings, sparks, dust, blood, confetti, feathers, ketchup...), comic
// text pops, the sky dome, and the joke weapons' own inspect animations and kill effects.
import * as THREE from '../sdk/three.module.min.js';
import { ITEM_BY_ID, KNIFE_BY_ID } from './skins.js';
import { cloudCanvas } from './textures.js';

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

// ---- sky: an inside-out sphere (horizon haze to deep blue, a warm glow around the sun) with the cloud layer painted
// on in the same pass (no full-screen transparent layer: that alone halved the frame rate on weak machines), and the sun.
// It follows the camera (position it there each frame), so it never gets clipped.
let cloudT = null;
export function skyDome(scene, horizon, zenith, sunDir = [0.6, 0.7, 0.4], sunColor = 0xffffff, clouds = true) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(300, 32, 16), col = [], a = new THREE.Color(horizon), b = new THREE.Color(zenith), sc = new THREE.Color(sunColor);
  const pos = geo.attributes.position, sd = new THREE.Vector3(...sunDir).normalize(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const k = Math.max(0, v.y), c = a.clone().lerp(b, Math.pow(k, 0.5)), sdot = Math.max(0, v.dot(sd));
    c.lerp(sc, Math.pow(sdot, 6) * 0.45 + Math.pow(sdot, 40) * 0.4);
    if (v.y < 0) c.copy(a);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (clouds && !cloudT) { cloudT = new THREE.CanvasTexture(cloudCanvas(256)); cloudT.wrapS = cloudT.wrapT = THREE.RepeatWrapping; }
  const mat = new THREE.ShaderMaterial({
    uniforms: { cloudTex: { value: cloudT }, cloudsOn: { value: clouds ? 1 : 0 }, drift: { value: new THREE.Vector2() } },
    vertexShader: `attribute vec3 color; varying vec3 vCol; varying vec3 vDir; void main() { vCol = color; vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D cloudTex; uniform float cloudsOn; uniform vec2 drift; varying vec3 vCol; varying vec3 vDir;
      void main() { vec3 c = vCol; vec3 d = normalize(vDir);
        if (cloudsOn > 0.5 && d.y > 0.02) { vec4 cl = texture2D(cloudTex, d.xz / (d.y + 0.15) * 0.35 + drift); c = mix(c, cl.rgb, cl.a * 0.85 * smoothstep(0.02, 0.3, d.y)); }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  // drawn last among solid things, so it only fills the pixels nothing else covered (not the whole screen first)
  const dome = new THREE.Mesh(geo, mat); dome.renderOrder = 1e6; dome.frustumCulled = false; g.add(dome);
  const disk = document.createElement('canvas'); disk.width = disk.height = 64;
  { const x = disk.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,250,1)'); gr.addColorStop(0.18, 'rgba(255,250,235,1)'); gr.addColorStop(0.3, 'rgba(255,240,210,.35)'); gr.addColorStop(1, 'rgba(255,230,200,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(disk), fog: false, depthWrite: false, transparent: true }));
  sun.position.copy(sd).multiplyScalar(280); sun.scale.setScalar(50); g.add(sun);
  g.userData.drift = mat.uniforms.drift.value;
  scene.add(g); return g;
}

// ---- joke weapons: what's special about the one you hold / killed with ----
const KNIFE_STYLE = { dildo: 'stroke', hotdog: 'squeeze', plunger: 'plunge', chicken: 'squeeze', baguette: 'twirl', fish: 'flop', banana: 'twirl' };
const SKIN_STYLE = { 'Finger Gun': 'spin', 'BRRRT': 'shake', 'Fart Cloud': 'shake', 'Poop Emoji Party': 'shake', 'Thicc Boi': 'jiggle', 'Dong Doppler': 'jiggle', 'Golden Shower': 'spin', 'Hot Dog Water': 'squeeze' };
export function funnyKey(skin) {
  const d = skin && ITEM_BY_ID[skin.def]; if (!d) return null;
  return d.kind === 'knife' ? ((KNIFE_BY_ID[d.weapon] || {}).joke ? KNIFE_BY_ID[d.weapon].model : null) : (SKIN_STYLE[d.finish] ? d.finish : null);
}
export const inspectStyle = (key) => KNIFE_STYLE[key] || SKIN_STYLE[key] || null;
export const INSPECT_SOUND = { mythic: 'shimmer', stroke: 'squelch', jiggle: 'boing', squeeze: 'squeak', plunge: 'fwoop', twirl: 'whoosh', flop: 'flop', spin: 'pewpew', shake: 'fart' };
// apply the funny inspect on top of the normal pose (k = 0..1 through the animation)
export function applyInspect(vm, style, k) {
  const s = Math.sin(k * Math.PI);
  switch (style) {
    case 'mythic': vm.position.y += s * 0.035; vm.position.z += s * 0.03; vm.rotation.y += s * 0.35; vm.rotation.z += Math.sin(k * Math.PI * 3) * 0.08 * s; break;   // a slow showcase while the veins flare and spark
    case 'stroke': vm.rotation.y += s * 0.55; vm.rotation.x += s * 0.25; vm.position.x -= s * 0.06; vm.position.y += s * 0.05; break;   // hold it up to admire; the hand does the rest
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
