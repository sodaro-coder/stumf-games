// Low-poly models built from boxes and cylinders at runtime (no model files): players (every agent look), first-person
// guns with painted finishes, knives (including the joke ones), the bomb, grenades and map props.
import * as THREE from '../sdk/three.module.min.js';
import { W_BY_ID } from './data.js';
import { paintSkin, KNIFE_BY_ID } from './skins.js';

const matCache = new Map();
export const lam = (color) => { const k = 'l' + color; if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color })); return matCache.get(k); };
export const basic = (color) => { const k = 'b' + color; if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color })); return matCache.get(k); };
const boxGeo = new Map();
const box = (w, h, d) => { const k = `${w}|${h}|${d}`; if (!boxGeo.has(k)) boxGeo.set(k, new THREE.BoxGeometry(w, h, d)); return boxGeo.get(k); };
export const part = (parent, w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(box(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };

// ---- players ----------------------------------------------------------------------------------------------------
// a rig: group at the feet; legs swing from the hips, arms hold the gun forward, the head looks up/down
export function makePlayer(look, team) {
  const L = look, g = new THREE.Group();
  const skin = lam(L.head), body = lam(L.body), legs = lam(L.legs);
  const hip = new THREE.Group(); hip.position.y = 0.92; g.add(hip);
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.12, 0, 0); legR.position.set(0.12, 0, 0); hip.add(legL, legR);
  part(legL, 0.2, 0.9, 0.22, legs, 0, -0.45, 0); part(legR, 0.2, 0.9, 0.22, legs, 0, -0.45, 0);
  part(legL, 0.21, 0.12, 0.3, lam('#222'), 0, -0.86, -0.04); part(legR, 0.21, 0.12, 0.3, lam('#222'), 0, -0.86, -0.04);
  const torso = new THREE.Group(); torso.position.y = 0.92; g.add(torso);
  part(torso, 0.5, 0.62, 0.28, body, 0, 0.31, 0);
  if (L.speedo) part(torso, 0.51, 0.16, 0.29, lam(L.speedo), 0, 0.02, 0);
  if (L.belly) part(torso, 0.4, 0.3, 0.12, skin, 0, 0.2, -0.17);
  if (L.mustard) part(torso, 0.08, 0.6, 0.02, lam('#f2d33c'), 0, 0.31, -0.15);
  if (L.stripes) for (let k = 0; k < 4; k++) part(torso, 0.51, 0.05, 0.29, lam('#111'), 0, 0.1 + k * 0.14, 0);
  if (team === 'CT' && !L.speedo && !L.mustard) part(torso, 0.52, 0.4, 0.3, lam('#2b3340'), 0, 0.38, 0);  // vest
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-0.31, 0.56, 0); armR.position.set(0.31, 0.56, 0); torso.add(armL, armR);
  part(armL, 0.14, 0.55, 0.14, L.speedo ? skin : body, 0, -0.25, 0); part(armR, 0.14, 0.55, 0.14, L.speedo ? skin : body, 0, -0.25, 0);
  armL.rotation.x = -1.2; armR.rotation.x = -1.35; armL.rotation.z = -0.5;
  const neck = new THREE.Group(); neck.position.y = 0.66; torso.add(neck);
  part(neck, 0.3, 0.3, 0.3, skin, 0, 0.17, 0);
  if (L.eyes || L.hat === 'beak') { part(neck, 0.06, 0.06, 0.02, basic('#fff'), -0.07, 0.2, -0.155); part(neck, 0.06, 0.06, 0.02, basic('#fff'), 0.07, 0.2, -0.155); part(neck, 0.03, 0.03, 0.02, basic('#000'), -0.07, 0.2, -0.165); part(neck, 0.03, 0.03, 0.02, basic('#000'), 0.07, 0.2, -0.165); }
  const hc = lam(L.hatColor || '#333');
  switch (L.hat) {
    case 'helmet': part(neck, 0.34, 0.14, 0.34, hc, 0, 0.36, 0); if (L.visor) part(neck, 0.3, 0.08, 0.02, basic('#334'), 0, 0.22, -0.16); break;
    case 'balaclava': part(neck, 0.31, 0.31, 0.31, hc, 0, 0.17, 0.005); part(neck, 0.22, 0.06, 0.02, skin, 0, 0.22, -0.16); break;
    case 'shemagh': part(neck, 0.33, 0.2, 0.33, hc, 0, 0.27, 0); part(neck, 0.32, 0.12, 0.32, hc, 0, 0.06, 0); break;
    case 'cap': part(neck, 0.32, 0.08, 0.32, hc, 0, 0.34, 0); part(neck, 0.3, 0.03, 0.14, hc, 0, 0.31, -0.2); break;
    case 'bun': part(neck, 0.42, 0.18, 0.36, hc, 0, 0.36, 0); break;
    case 'swirl': for (let k = 0; k < 3; k++) part(neck, 0.3 - k * 0.08, 0.1, 0.3 - k * 0.08, hc, 0, 0.36 + k * 0.1, 0); break;
    case 'curlers': for (let k = 0; k < 5; k++) part(neck, 0.06, 0.06, 0.2, hc, -0.12 + k * 0.06, 0.35, 0); break;
    case 'beak': part(neck, 0.08, 0.06, 0.12, hc, 0, 0.12, -0.2); break;
    case 'stem': part(neck, 0.05, 0.14, 0.05, hc, 0, 0.38, 0); break;
    case 'beret': part(neck, 0.34, 0.06, 0.34, hc, 0.03, 0.34, 0); break;
    default: break;
  }
  // third-person gun in the right hand
  const tpGun = new THREE.Group(); tpGun.position.set(0, -0.5, 0); armR.add(tpGun);
  return { g, hip, legL, legR, torso, armL, armR, neck, tpGun, tpKey: '' };
}
// the gun in a player's hands, sized by what they hold (so you can tell an AWP from a pistol at a glance)
const TP = { pistol: [0.05, 0.1, 0.22], smg: [0.06, 0.11, 0.4], heavy: [0.07, 0.1, 0.7], rifle: [0.06, 0.1, 0.7], sniper: [0.06, 0.1, 0.9], knife: [0.02, 0.04, 0.22], zeus: [0.05, 0.08, 0.18] };
export function setTpGun(r, wid) {
  if (r.tpKey === wid) return; r.tpKey = wid;
  for (const c of [...r.tpGun.children]) r.tpGun.remove(c);
  const w = W_BY_ID[wid], cat = w ? w.cat : wid === 'c4' ? 'c4' : 'knife';
  if (cat === 'c4') { part(r.tpGun, 0.2, 0.08, 0.14, lam('#5a4a32'), 0, 0, -0.08); return; }
  const [a, b, c] = TP[cat] || TP.rifle;
  part(r.tpGun, a, b, c, lam(cat === 'knife' ? '#a8adb6' : '#26282c'), 0, 0, -c / 2 + 0.08);
  if (cat === 'sniper') part(r.tpGun, 0.05, 0.05, 0.2, lam('#111'), 0, 0.08, -0.15);
}
// animate the rig: walk cycle, crouch, aim pitch
export function posePlayer(r, { speed = 0, t = 0, crouch = 0, pitch = 0, dead = 0, emote = null }) {
  const sw = Math.sin(t * 9) * Math.min(1, speed / 4) * 0.7;
  r.legL.rotation.set(sw, 0, 0); r.legR.rotation.set(-sw, 0, 0);
  const c = crouch * 0.38;
  r.hip.position.y = 0.92 - c; r.torso.position.y = 0.92 - c; r.legL.scale.y = r.legR.scale.y = 1 - crouch * 0.4;
  r.torso.rotation.set(0, 0, 0); r.neck.rotation.set(-pitch * 0.6, 0, 0);
  r.armL.rotation.set(-1.2 - pitch * 0.8, 0, -0.5); r.armR.rotation.set(-1.35 - pitch * 0.8, 0, 0);
  r.tpGun.visible = !emote;
  r.g.rotation.z = 0; r.g.rotation.x = dead ? -Math.PI / 2 * Math.min(1, dead) : 0;
  if (emote && !dead) poseEmote(r, emote.anim, emote.t);
}
// emote animations (procedural: a few sines per limb)
function poseEmote(r, anim, t) {
  const s = Math.sin, aL = r.armL.rotation, aR = r.armR.rotation, T = r.torso.rotation, N = r.neck.rotation;
  aL.set(0, 0, -0.2); aR.set(0, 0, 0.2);
  switch (anim) {
    case 'wave': aR.set(-2.9, 0, 0.3 + s(t * 10) * 0.45); break;
    case 'salute': aR.set(-2.4, 0, 1.1); N.x = 0.05; break;
    case 'dance': T.z = s(t * 6) * 0.25; aL.set(-1.6 + s(t * 6) * 1.2, 0, -0.4); aR.set(-1.6 - s(t * 6) * 1.2, 0, 0.4); r.legL.rotation.x = Math.max(0, s(t * 6)) * 0.6; r.legR.rotation.x = Math.max(0, -s(t * 6)) * 0.6; break;
    case 'dab': aL.set(-2.3, 0, -1.0); aR.set(-1.4, 0, 1.3); N.set(0.6, 0, 0.3); break;
    case 'tpose': aL.set(0, 0, -Math.PI / 2); aR.set(0, 0, Math.PI / 2); break;
    case 'floss': { const k = s(t * 9); aL.set(0.3 * k, 0, -0.3 + k * 0.4); aR.set(-0.3 * k, 0, 0.3 + k * 0.4); T.z = -k * 0.15; break; }
    case 'chicken': aL.set(0, 0, -0.4 - Math.abs(s(t * 12)) * 0.9); aR.set(0, 0, 0.4 + Math.abs(s(t * 12)) * 0.9); r.hip.position.y -= 0.15; r.torso.position.y -= 0.15; N.x = s(t * 12) * 0.3; break;
    case 'fart': T.x = 0.5; N.x = -0.3; aL.set(0.6, 0, -0.3); aR.set(0.6, 0, 0.3); r.hip.position.y -= Math.abs(s(t * 3)) * 0.05; break;
    case 'worm': T.x = 1.2 + s(t * 7) * 0.25; r.torso.position.y -= 0.5; aL.set(-2.8, 0, -0.2); aR.set(-2.8, 0, 0.2); r.legL.rotation.x = r.legR.rotation.x = -1.4 + s(t * 7 + 1) * 0.3; break;
    case 'flex': aL.set(-0.2, 0, -1.6); aR.set(-0.2, 0, 1.6); T.y = s(t * 2) * 0.3; break;
    case 'cry': aL.set(-2.6, 0, 0.5); aR.set(-2.6, 0, -0.5); N.x = 0.4 + s(t * 14) * 0.08; T.x = 0.2; break;
    case 'twerk': T.x = 0.9; r.hip.position.y += s(t * 18) * 0.06; r.torso.position.y += s(t * 18) * 0.03; aL.set(0.9, 0, -0.3); aR.set(0.9, 0, 0.3); break;
    default: break;
  }
}

// ---- first-person weapons ---------------------------------------------------------------------------------------
const skinTexCache = new Map();
export function skinTexture(item, info) {
  const k = item ? item.uid : 'none';
  if (skinTexCache.has(k)) return skinTexCache.get(k);
  let t = null;
  if (item && info && info.paint) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    paintSkin(c, info.paint, item.seed, item.float);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  }
  skinTexCache.set(k, t);
  return t;
}
// dims per category: [receiver length, barrel length, stock, mag height, height]
const SHAPE = { pistol: [0.2, 0.05, 0, 0.1, 0.1], smg: [0.32, 0.12, 0.14, 0.18, 0.12], heavy: [0.42, 0.34, 0.2, 0.08, 0.13], rifle: [0.46, 0.28, 0.22, 0.2, 0.12],
  sniper: [0.52, 0.42, 0.26, 0.12, 0.12], zeus: [0.18, 0.06, 0, 0.04, 0.1] };
export function makeGun(id, tex, sleeve = '#3c4e66', glove = '#2a2a2a', hands = true) {
  const w = W_BY_ID[id] || { cat: 'pistol' }, g = new THREE.Group();
  const paint = tex ? new THREE.MeshLambertMaterial({ map: tex }) : lam(w.cat === 'zeus' ? '#e8d040' : w.cat === 'rifle' && w.team === 'T' ? '#6a4a2e' : w.cat === 'pistol' ? '#5a5f68' : '#454a52');
  const dark = lam('#24272c'), metal = lam('#6a6e76');
  const [rl, bl, sl, mh, hh] = SHAPE[w.cat] || SHAPE.rifle;
  part(g, 0.08, hh, rl, paint, 0, 0, 0);                                     // receiver
  part(g, 0.035, 0.035, bl, metal, 0, 0.02, -rl / 2 - bl / 2);              // barrel
  if (w.silenced) part(g, 0.055, 0.055, 0.16, dark, 0, 0.02, -rl / 2 - bl - 0.08);
  if (sl) part(g, 0.07, hh * 0.9, sl, paint, 0, -0.01, rl / 2 + sl / 2);     // stock
  if (mh > 0.05) part(g, 0.05, mh, 0.07, dark, 0, -hh / 2 - mh / 2, -rl * 0.12);  // magazine
  part(g, 0.05, 0.12, 0.06, dark, 0, -hh / 2 - 0.06, rl * 0.28);             // grip
  if (w.zoom) part(g, 0.06, 0.06, 0.22, dark, 0, hh / 2 + 0.04, 0);          // scope
  if (w.cat === 'heavy' && w.pellets > 1) part(g, 0.06, 0.05, 0.18, lam('#5a3a22'), 0, -0.03, -rl / 2 + 0.05);  // pump
  // hands
  if (hands) part(g, 0.09, 0.09, 0.1, lam(glove), 0, -hh / 2 - 0.06, rl * 0.28 + 0.02);
  if (hands) part(g, 0.1, 0.1, 0.36, lam(sleeve), 0.02, -hh / 2 - 0.1, rl * 0.28 + 0.22);
  if (hands && w.cat !== 'pistol' && w.cat !== 'zeus') { part(g, 0.09, 0.09, 0.1, lam(glove), -0.02, -0.06, -rl / 2 + 0.02); part(g, 0.1, 0.1, 0.4, lam(sleeve), -0.14, -0.1, -rl / 2 + 0.24).rotation.y = -0.5; }
  const flash = new THREE.Mesh(box(0.12, 0.12, 0.12), basic('#ffd27a')); flash.position.set(0, 0.02, -rl / 2 - bl - (w.silenced ? 0.2 : 0.06)); flash.visible = false; g.add(flash);
  g.userData = { flash, len: rl + bl };
  return g;
}
export function makeKnife(knifeId, tex, sleeve = '#3c4e66', glove = '#2a2a2a', hands = true) {
  const k = KNIFE_BY_ID[knifeId], model = k ? k.model : 'default', g = new THREE.Group();
  const blade = tex ? new THREE.MeshLambertMaterial({ map: tex }) : lam('#a8adb6'), handle = lam('#2a2622');
  const P = (w, h, d, m, x, y, z, rx = 0) => { const p = part(g, w, h, d, m, x, y, z); p.rotation.x = rx; return p; };
  switch (model) {
    case 'hotdog': P(0.07, 0.07, 0.42, tex ? blade : lam('#c8462e'), 0, 0.02, -0.12); P(0.1, 0.05, 0.36, lam('#e8b060'), 0, -0.02, -0.1); P(0.02, 0.012, 0.34, lam('#f2d33c'), 0, 0.058, -0.12); break;
    case 'dildo': P(0.07, 0.07, 0.4, tex ? blade : lam('#ff4ad2'), 0, 0.02, -0.14); P(0.085, 0.085, 0.08, tex ? blade : lam('#ff4ad2'), 0, 0.02, -0.36); P(0.16, 0.06, 0.06, tex ? blade : lam('#e030b8'), 0, -0.01, 0.08); break;
    case 'plunger': P(0.035, 0.035, 0.5, lam('#8a5a2a'), 0, 0, -0.1); P(0.16, 0.16, 0.08, tex ? blade : lam('#b8221e'), 0, 0, -0.38); break;
    case 'chicken': P(0.08, 0.12, 0.32, tex ? blade : lam('#f2d33c'), 0, 0.02, -0.14); P(0.06, 0.06, 0.06, lam('#e8702a'), 0, 0.06, -0.32); P(0.02, 0.04, 0.04, lam('#d22'), 0, 0.11, -0.28); break;
    case 'baguette': P(0.07, 0.07, 0.6, tex ? blade : lam('#d8a050'), 0, 0.02, -0.2, 0.05); break;
    case 'fish': P(0.04, 0.12, 0.42, tex ? blade : lam('#e8806a'), 0, 0.02, -0.14); P(0.02, 0.16, 0.08, tex ? blade : lam('#c8604a'), 0, 0.02, 0.1); break;
    case 'banana': for (let i = 0; i < 5; i++) P(0.06, 0.06, 0.1, tex ? blade : lam('#f2d33c'), 0, 0.02 + Math.sin(i / 4 * Math.PI) * 0.05, -0.04 - i * 0.09); break;
    case 'karambit': P(0.02, 0.05, 0.2, blade, 0, 0.05, -0.12, -0.6); P(0.035, 0.05, 0.14, handle, 0, -0.02, 0.04); break;
    case 'butterfly': P(0.02, 0.04, 0.24, blade, 0, 0.03, -0.16); P(0.03, 0.04, 0.14, handle, -0.012, 0, 0.04); P(0.03, 0.04, 0.14, handle, 0.012, 0, 0.04); break;
    case 'bayonet': P(0.02, 0.05, 0.3, blade, 0, 0.03, -0.2); P(0.08, 0.02, 0.02, metal(), 0, 0.02, -0.04); P(0.035, 0.05, 0.13, handle, 0, 0.02, 0.04); break;
    default: P(0.02, 0.045, 0.22, blade, 0, 0.03, -0.14); P(0.035, 0.05, 0.12, handle, 0, 0.02, 0.04); break;
  }
  if (hands) part(g, 0.065, 0.065, 0.08, lam(glove), 0, -0.01, 0.07);
  if (hands) part(g, 0.075, 0.075, 0.3, lam(sleeve), 0.015, -0.05, 0.26);
  g.userData = { flash: null, len: 0.3 };
  return g;
}
const metal = () => lam('#8a8f98');
export function makeGrenade(type) {
  const g = new THREE.Group(), col = { he: '#3a5a2a', flash: '#9aa0a8', smoke: '#5a6a8a', molotov: '#6a8a3a', incendiary: '#8a4a2a', decoy: '#8a8a3a' }[type] || '#555';
  if (type === 'molotov') { part(g, 0.08, 0.16, 0.08, lam(col), 0, 0, 0); part(g, 0.03, 0.06, 0.03, lam('#e8e0c0'), 0, 0.1, 0); }
  else { part(g, 0.09, 0.12, 0.09, lam(col), 0, 0, 0); part(g, 0.04, 0.04, 0.06, metal(), 0, 0.08, 0); }
  return g;
}
export function makeBomb() {
  const g = new THREE.Group();
  part(g, 0.32, 0.1, 0.22, lam('#5a4a32'), 0, 0.05, 0); part(g, 0.14, 0.03, 0.1, basic('#1a2a1a'), 0, 0.11, 0);
  for (let k = 0; k < 3; k++) part(g, 0.3, 0.02, 0.02, lam(['#c22', '#22c', '#cc2'][k]), 0, 0.1, -0.08 + k * 0.08);
  const led = part(g, 0.03, 0.03, 0.03, basic('#f00'), 0.1, 0.12, 0.06);
  g.userData.led = led;
  return g;
}

// ---- map props ----------------------------------------------------------------------------------------------------
export function makeProp(p) {
  const g = new THREE.Group();
  switch (p.type) {
    case 'palm': part(g, 0.3, 5, 0.3, lam('#7a5a3a'), 0, 2.5, 0); for (let k = 0; k < 6; k++) { const l = part(g, 2.4, 0.06, 0.5, lam('#4a8a3a'), Math.cos(k) * 1, 5, Math.sin(k) * 1); l.rotation.y = -k; l.rotation.z = 0.35; } break;
    case 'tree': part(g, 0.35, 2.4, 0.35, lam('#6a4a2a'), 0, 1.2, 0); part(g, 2.2, 2, 2.2, lam('#3a7a3a'), 0, 3.2, 0); break;
    case 'goat': part(g, 0.9, 0.5, 0.35, lam('#e8e4d8'), 0, 0.75, 0); for (const [x, z] of [[-0.35, -0.12], [0.35, -0.12], [-0.35, 0.12], [0.35, 0.12]]) part(g, 0.08, 0.5, 0.08, lam('#d8d0c0'), x, 0.25, z);
      part(g, 0.3, 0.3, 0.25, lam('#e8e4d8'), 0.55, 1.05, 0); part(g, 0.05, 0.2, 0.05, lam('#8a7a6a'), 0.6, 1.3, -0.08); part(g, 0.05, 0.2, 0.05, lam('#8a7a6a'), 0.6, 1.3, 0.08); part(g, 0.06, 0.14, 0.06, lam('#bbb'), 0.7, 0.85, 0); break;
    case 'tv': part(g, 0.9, 0.7, 0.5, lam('#2a2a2a'), 0, 1.25, 0); part(g, 0.7, 0.5, 0.02, basic('#4a7aaa'), 0, 1.25, -0.26); part(g, 1.2, 0.9, 0.6, lam('#6a4a2a'), 0, 0.45, 0);
      for (let k = 0; k < 5; k++) part(g, 0.2, 0.04, 0.12, lam('#111'), -0.4 + k * 0.05, 0.92 + k * 0.04, 0.1); break;
    case 'barrel': part(g, 0.6, 0.9, 0.6, lam('#3a6a8a'), 0, 0.45, 0); part(g, 0.62, 0.05, 0.62, lam('#2a4a6a'), 0, 0.6, 0); break;
    case 'dummy': part(g, 0.16, 0.85, 0.16, lam('#e8d040'), -0.1, 0.42, 0); part(g, 0.16, 0.85, 0.16, lam('#e8d040'), 0.1, 0.42, 0); part(g, 0.44, 0.6, 0.24, lam('#e8d040'), 0, 1.15, 0);
      part(g, 0.28, 0.3, 0.28, lam('#e8d040'), 0, 1.62, 0); part(g, 0.3, 0.02, 0.02, lam('#111'), 0, 1.65, -0.15); break;
    case 'duck': part(g, 0.5, 0.36, 0.38, lam('#f2d33c'), 0, 0.18, 0); part(g, 0.28, 0.28, 0.26, lam('#f2d33c'), 0.2, 0.48, 0); part(g, 0.14, 0.06, 0.12, lam('#e8702a'), 0.4, 0.46, 0); break;
    case 'lamp': part(g, 0.12, 4, 0.12, lam('#333'), 0, 2, 0); part(g, 0.5, 0.15, 0.3, basic('#ffe9a8'), 0.2, 4, 0); break;
    default: break;
  }
  g.position.set(p.x, p.y || 0, p.z); g.rotation.y = p.rot || 0;
  return g;
}
