// Models built at runtime from smooth primitives and extruded profiles (no model files): players (every agent look,
// with knees, elbows and hands that reach for the gun), first-person guns with real silhouettes and CS-style arms,
// knives (including the joke ones), grenades, the bomb and map props. Each body part / gun material is merged into a
// single mesh with vertex colours, so a whole player is ~12 draw calls and a gun 3-5: cheap on weak machines.
import * as THREE from '../sdk/three.module.min.js';
import { W_BY_ID } from './data.js';
import { paintSkin, KNIFE_BY_ID } from './skins.js';
import { litPatch, loadTx } from './world.js';
import { surface } from './textures.js';

const matCache = new Map();
export const lam = (color) => { const k = 'l' + color; if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color })); return matCache.get(k); };
export const basic = (color) => { const k = 'b' + color; if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color })); return matCache.get(k); };
const boxGeo = new Map();
const box = (w, h, d) => { const k = `${w}|${h}|${d}`; if (!boxGeo.has(k)) boxGeo.set(k, new THREE.BoxGeometry(w, h, d)); return boxGeo.get(k); };
export const part = (parent, w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(box(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };

let HQ = true;   // Phong (shiny metal) on Medium and up; plain Lambert on Low/Potato
export function setModelQuality(q) { HQ = q >= 1; }

// ---- geometry helpers ---------------------------------------------------------------------------------------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
const CAP = (r, len, seg = 8) => new THREE.CapsuleGeometry(r, len, 3, seg);
const CYL = (rt, rb, h, seg = 10, open = false) => new THREE.CylinderGeometry(rt, rb, h, HQ ? Math.max(16, seg * 2) : seg, 1, open);
// smooth shading across rounded edges and bevels, hard where faces meet at a real corner (> deg): light rolls over a
// bevelled edge the way it does on machined metal, instead of every part looking like a flat-shaded box
function crease(g0, deg = 38) {
  const g = g0.index ? g0.toNonIndexed() : g0, P = g.attributes.position.array, n = P.length / 9, cos = Math.cos(deg * Math.PI / 180);
  const fn = new Float32Array(n * 3), map = new Map(), key = (i) => `${Math.round(P[i] * 2e4)},${Math.round(P[i + 1] * 2e4)},${Math.round(P[i + 2] * 2e4)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < n; t++) {
    a.fromArray(P, t * 9); b.fromArray(P, t * 9 + 3); c.fromArray(P, t * 9 + 6);
    b.sub(a); c.sub(a); b.cross(c);   // area-weighted face normal
    fn[t * 3] = b.x; fn[t * 3 + 1] = b.y; fn[t * 3 + 2] = b.z;
    for (let v = 0; v < 3; v++) { const k = key(t * 9 + v * 3); let l = map.get(k); if (!l) map.set(k, (l = [])); l.push(t); }
  }
  const N = new Float32Array(P.length), u = new THREE.Vector3(), w = new THREE.Vector3();
  for (let t = 0; t < n; t++) {
    u.set(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]).normalize();
    for (let v = 0; v < 3; v++) {
      const i = t * 9 + v * 3; w.set(0, 0, 0);
      for (const s2 of map.get(key(i))) { const L = Math.hypot(fn[s2 * 3], fn[s2 * 3 + 1], fn[s2 * 3 + 2]) || 1; if ((fn[s2 * 3] * u.x + fn[s2 * 3 + 1] * u.y + fn[s2 * 3 + 2] * u.z) / L >= cos) w.add(c.set(fn[s2 * 3], fn[s2 * 3 + 1], fn[s2 * 3 + 2])); }
      if (w.lengthSq() < 1e-20) w.copy(u); w.normalize(); N[i] = w.x; N[i + 1] = w.y; N[i + 2] = w.z;
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}
const SPH = (r, ws = 12, hs = 9, p0 = 0, pl = Math.PI * 2, t0 = 0, tl = Math.PI) => new THREE.SphereGeometry(r, ws, hs, p0, pl, t0, tl);
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// place a geometry: position, rotation (euler xyz), scale
function place(g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  _m.compose(_p.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(s[0], s[1], s[2]));
  return g.applyMatrix4(_m);
}
// aim a +y-axis geometry (cylinder/capsule) from point a to point b
function span(g, a, b) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
  _q.setFromUnitVectors(_UP, d.normalize());
  _m.compose(_p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _s.set(1, 1, 1));
  void L; return g.applyMatrix4(_m);
}
// merge [geometry, colour] pairs into one geometry with vertex colours (and uvs)
function merge(list) {
  let n = 0;
  const gs = list.map(([g0, c]) => { const g = g0.index ? g0.toNonIndexed() : g0; if (g !== g0) g0.dispose(); n += g.attributes.position.count; return [g, c == null ? null : new THREE.Color(c)]; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const [g, c] of gs) {
    const k = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (!g.attributes.normal) g.computeVertexNormals();
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    const cc = c || { r: 1, g: 1, b: 1 };
    for (let i = 0; i < k; i++) { col[(o + i) * 3] = cc.r; col[(o + i) * 3 + 1] = cc.g; col[(o + i) * 3 + 2] = cc.b; }
    o += k; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };

// ---- players ------------------------------------------------------------------------------------------------------
let rigMatC = null;
const rigMat = (glow) => {
  if (glow) { const k = 'rig|' + glow.glow + glow.t; if (!glowMasks.has(k)) glowMasks.set(k, glowify(litPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), 'dyn'), glowMask(glow, 3), 0.9)); return glowMasks.get(k); }   // Mythic outfits glow on every quality
  return rigMatC || (rigMatC = litPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), 'dyn'));
};
const UA = 0.29, FA = 0.27;  // upper arm, forearm (to the middle of the hand)
// a rig: group at the feet. hip -> thighs -> shins; torso -> shoulders -> elbows; neck -> head; aim -> the gun
export function makePlayer(look, team) {
  const L = look, g = new THREE.Group(), M = rigMat(L.glow ? { glow: L.glow, t: L.glowT || 'circuit' } : null), ct = team === 'CT';
  const skin = L.head, naked = !!L.speedo, jacket = L.body, pants = L.legs;
  const glove = naked ? skin : '#29292b', boot = naked ? skin : '#2e2822', gear = ct ? shade(jacket, 0.7) : '#4b4936', strap = ct ? '#1d2027' : '#3a3528';
  const bone = (parent, x, y, z) => { const b = new THREE.Group(); b.position.set(x, y, z); parent.add(b); return b; };
  const mesh = (b, parts) => { const m = new THREE.Mesh(merge(parts), M); b.add(m); return m; };
  // legs
  const hip = bone(g, 0, 0.95, 0);
  const pel = [[place(CYL(0.165, 0.15, 0.2, 12), [0, -0.03, 0], [0, 0, 0], [1, 1, 0.72]), naked ? L.speedo : pants]];
  if (!naked) pel.push([place(CYL(0.172, 0.172, 0.045, 12), [0, 0.06, 0], [0, 0, 0], [1, 1, 0.74]), strap]);
  if (!naked && !L.mustard) pel.push([place(BOX(0.07, 0.11, 0.05), [0.17, -0.04, -0.02]), gear]);   // holster / dump pouch
  mesh(hip, pel);
  const legs = [];
  for (const sd of [-1, 1]) {
    const thigh = bone(hip, sd * 0.095, -0.02, 0);
    const tp = [[place(CAP(0.083, 0.3), [0, -0.21, 0]), naked ? skin : pants]];
    if (!naked) tp.push([place(BOX(0.06, 0.1, 0.12), [sd * 0.075, -0.2, 0.01]), shade(pants, 0.85)]);   // cargo pocket
    mesh(thigh, tp);
    const shin = bone(thigh, 0, -0.44, 0);
    const sp = [[place(CAP(0.066, 0.3), [0, -0.2, 0]), naked ? skin : pants], [place(BOX(0.12, 0.09, 0.26), [0, -0.44, -0.04]), boot], [place(CYL(0.07, 0.072, 0.1, 10), [0, -0.37, 0]), boot]];
    if (ct && !naked) sp.push([place(SPH(0.062, 10, 6), [0, -0.01, -0.05], [0, 0, 0], [1, 1.15, 0.7]), '#202226']);   // knee pad
    mesh(shin, sp);
    legs.push(thigh, shin);
  }
  // torso
  const torso = bone(g, 0, 0.95, 0);
  const tp = [[place(CYL(0.18, 0.165, 0.26, 12), [0, 0.12, 0], [0, 0, 0], [1, 1, 0.66]), jacket], [place(CYL(0.215, 0.18, 0.3, 12), [0, 0.37, 0], [0, 0, 0], [1, 1, 0.62]), jacket],
    [place(SPH(0.1, 10, 7), [-0.2, 0.47, 0]), jacket], [place(SPH(0.1, 10, 7), [0.2, 0.47, 0]), jacket], [place(CYL(0.08, 0.11, 0.07, 10), [0, 0.53, 0]), jacket]];
  if (L.belly) tp.push([place(SPH(0.19, 12, 9), [0, 0.2, -0.06], [0, 0, 0], [1, 0.9, 0.85]), skin]);
  if (L.mustard) for (let k = 0; k < 5; k++) tp.push([place(BOX(0.05, 0.1, 0.02), [k % 2 ? 0.03 : -0.03, 0.12 + k * 0.08, -0.145], [0, 0, k % 2 ? 0.6 : -0.6]), '#f2d33c']);
  if (L.stripes) for (let k = 0; k < 4; k++) tp.push([place(CYL(0.214, 0.21, 0.035, 12), [0, 0.16 + k * 0.1, 0], [0, 0, 0], [1, 1, 0.66]), '#151515']);
  if (!naked && !L.mustard && !L.stripes && !L.eyes) {
    if (ct) {   // plate carrier: front and back plates, mag pouches, radio
      tp.push([place(BOX(0.36, 0.34, 0.05), [0, 0.33, -0.135]), gear], [place(BOX(0.36, 0.36, 0.05), [0, 0.33, 0.13]), gear], [place(BOX(0.06, 0.3, 0.26), [-0.2, 0.3, 0]), gear], [place(BOX(0.06, 0.3, 0.26), [0.2, 0.3, 0]), gear]);
      for (let k = 0; k < 3; k++) tp.push([place(BOX(0.085, 0.12, 0.05), [-0.1 + k * 0.1, 0.22, -0.175]), shade(gear, 0.8)]);
      tp.push([place(BOX(0.05, 0.13, 0.04), [-0.14, 0.43, -0.17]), '#1a1a1a'], [place(CYL(0.006, 0.006, 0.12, 4), [-0.14, 0.55, -0.17]), '#111']);
    } else {    // chest rig: straps and an AK mag pouch row
      tp.push([place(BOX(0.05, 0.42, 0.02), [-0.1, 0.36, -0.14], [0, 0, 0.35]), strap], [place(BOX(0.05, 0.42, 0.02), [0.1, 0.36, -0.14], [0, 0, -0.35]), strap]);
      for (let k = 0; k < 3; k++) tp.push([place(BOX(0.095, 0.14, 0.055), [-0.105 + k * 0.105, 0.2, -0.155]), gear]);
      tp.push([place(BOX(0.3, 0.32, 0.12), [0, 0.32, 0.17]), shade(jacket, 0.75)]);   // backpack
    }
  }
  mesh(torso, tp);
  // arms
  const arms = [];
  for (const sd of [-1, 1]) {
    const sh = bone(torso, sd * 0.235, 0.46, 0);
    mesh(sh, [[place(CAP(0.064, 0.18), [0, -0.14, 0]), naked ? skin : jacket]]);
    const el = bone(sh, 0, -UA, 0);
    const fp = [[place(CAP(0.054, 0.17), [0, -0.12, 0]), naked ? skin : jacket], [place(SPH(0.056, 10, 7), [0, -FA, -0.005], [0, 0, 0], [0.8, 1.15, 0.95]), glove]];
    if (!naked) fp.push([place(CYL(0.058, 0.056, 0.05, 10), [0, -0.215, 0]), glove]);
    mesh(el, fp);
    arms.push(sh, el);
  }
  // head
  const neck = bone(torso, 0, 0.55, 0);
  mesh(neck, headParts(L, ct));
  const aim = bone(torso, 0.05, 0.42, 0);
  const tpGun = bone(aim, 0, 0, 0);
  return { g, hip, legL: legs[0], shinL: legs[1], legR: legs[2], shinR: legs[3], torso, armL: arms[0], foreL: arms[1], armR: arms[2], foreR: arms[3], neck, aim, tpGun, tpKey: '' };
}
function headParts(L, ct) {
  const skin = L.head, hc = L.hatColor || '#333', P = [];
  const HS = [0.93, 1.1, 1.0], HY = 0.165;
  const head = (c, sc = HS) => P.push([place(SPH(0.112, 14, 10), [0, HY, 0], [0, 0, 0], sc), c]);
  const band = (c, t0, tl, r = 0.1135) => P.push([place(SPH(r, 12, 3, Math.PI * 1.5 - 0.75, 1.5, t0, tl), [0, HY, 0], [0, 0, 0], HS), c]);   // a strip across the face
  const eyes = (c = '#1a1410') => { P.push([place(SPH(0.014, 6, 4), [-0.038, HY + 0.02, -0.103]), c], [place(SPH(0.014, 6, 4), [0.038, HY + 0.02, -0.103]), c]); };
  const face = () => { eyes(); P.push([place(SPH(0.02, 6, 5), [0, HY - 0.01, -0.112], [0, 0, 0], [0.8, 1, 1]), shade(skin, 0.92)], [place(SPH(0.026, 6, 5), [-0.104, HY, 0]), skin], [place(SPH(0.026, 6, 5), [0.104, HY, 0]), skin]); };
  const hair = (c = '#2a2018') => P.push([place(SPH(0.117, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), [0, HY + 0.008, 0.008], [0, 0, 0], HS), c]);
  P.push([place(CYL(0.052, 0.058, 0.1, 10), [0, 0.04, 0]), skin]);
  switch (L.hat) {
    case 'balaclava': head(hc); band(skin, 1.28, 0.26); eyes(); break;
    case 'shemagh': head(hc, [0.97, 1.13, 1.04]); band(skin, 1.28, 0.24, 0.1175); eyes(); P.push([place(CYL(0.075, 0.1, 0.09, 10), [0, 0.03, 0]), hc], [place(BOX(0.12, 0.16, 0.02), [0, 0.0, 0.1], [0.3, 0, 0]), hc]); break;
    case 'helmet':
      head(skin); face();
      if (L.visor) { band('#151515', 1.62, 0.6, 0.1145); P.push([place(BOX(0.15, 0.05, 0.03), [0, HY + 0.035, -0.112]), '#0e141c']); }
      else P.push([place(BOX(0.14, 0.045, 0.03), [0, HY + 0.06, -0.108]), '#202a34'], [place(CYL(0.122, 0.122, 0.028, 14, true), [0, HY + 0.06, 0], [0, 0, 0], [0.95, 1, 1.02]), '#1b1b1b']);
      P.push([place(SPH(0.135, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), [0, HY + 0.01, 0.005], [0, 0, 0], [1, 0.95, 1.08]), hc], [place(BOX(0.03, 0.05, 0.05), [0.125, HY + 0.05, 0]), '#222']);
      break;
    case 'cap': head(skin); face(); hair(); P.push([place(SPH(0.119, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), [0, HY + 0.012, 0.005], [0, 0, 0], HS), hc], [place(CYL(0.09, 0.09, 0.012, 14), [0, HY + 0.055, -0.1], [0, 0, 0], [1.05, 1, 1.1]), hc]); break;
    case 'bun': head(skin, [0.9, 1.35, 0.95]); eyes(); P.push([place(CAP(0.07, 0.2), [-0.12, HY, 0], [0, 0, 0.1], [1, 1, 0.8]), hc], [place(CAP(0.07, 0.2), [0.12, HY, 0], [0, 0, -0.1], [1, 1, 0.8]), hc]); break;
    case 'swirl': head(skin); for (let k = 0; k < 3; k++) P.push([place(new THREE.TorusGeometry(0.1 - k * 0.025, 0.045 - k * 0.008, 6, 14), [0, HY + 0.08 + k * 0.065, 0], [Math.PI / 2, 0, 0]), hc]); P.push([place(new THREE.ConeGeometry(0.035, 0.08, 8), [0.01, HY + 0.29, 0]), hc]); break;
    case 'curlers': head(skin); face(); hair('#b8b0a8'); for (let k = 0; k < 5; k++) P.push([place(CYL(0.024, 0.024, 0.09, 8), [-0.08 + k * 0.04, HY + 0.11, 0.01 - (k % 2) * 0.03], [Math.PI / 2, 0, 0]), hc]); break;
    case 'beak': head(skin); P.push([place(new THREE.ConeGeometry(0.035, 0.12, 8), [0, HY - 0.005, -0.15], [-Math.PI / 2, 0, 0]), hc]); break;
    case 'stem': head(skin, [0.9, 1.35, 0.9]); P.push([place(CYL(0.014, 0.02, 0.1, 6), [0.01, HY + 0.17, 0], [0, 0, -0.2]), hc]); break;
    case 'beret': head(skin); face(); P.push([place(SPH(0.12, 14, 8), [0.02, HY + 0.085, 0], [0, 0, 0.18], [1.12, 0.32, 1.1]), hc]); break;
    default: head(skin); face(); hair(); break;
  }
  if (L.eyes) for (const sd of [-1, 1]) P.push([place(SPH(0.036, 10, 7), [sd * 0.045, HY + 0.035, -0.092]), '#ffffff'], [place(SPH(0.017, 8, 5), [sd * 0.045, HY + 0.035, -0.125]), '#111111']);
  return P;
}
// the gun in a player's hands: the real model (same as first person, without arms), or simple boxes on Low
const TP_GRIP = { pistol: [-0.05, -0.02, -0.4], smg: [0.0, -0.06, -0.24], heavy: [0.0, -0.06, -0.24], rifle: [0.0, -0.06, -0.24], sniper: [0.0, -0.06, -0.24], knife: [0.03, -0.18, -0.28], zeus: [-0.05, -0.02, -0.4], c4: [-0.02, -0.12, -0.3], grenade: [0.03, -0.05, -0.3] };
export function setTpGun(r, wid, att = null) {
  const key = wid + '|' + (att ? (att.optic || '') + (att.muzzle || '') : '');
  if (r.tpKey === key) return; r.tpKey = key;
  for (const c of [...r.tpGun.children]) r.tpGun.remove(c);
  const w = W_BY_ID[wid], cat = w ? w.cat : wid === 'c4' ? 'c4' : wid === 'knife' || !wid ? 'knife' : 'grenade';
  const m = cat === 'c4' ? makeBomb() : cat === 'knife' ? makeKnife(null, null, undefined, undefined, false) : cat === 'grenade' ? makeGrenade(wid, undefined, undefined, false) : makeGun(wid, null, undefined, undefined, false, att);
  if (cat === 'c4') m.scale.setScalar(0.8);
  const grip = m.userData.grip || new THREE.Vector3(), t = TP_GRIP[cat] || TP_GRIP.rifle;
  m.position.set(t[0] - grip.x * m.scale.x, t[1] - grip.y * m.scale.y, t[2] - grip.z * m.scale.z);
  if (m.userData.flash) m.userData.flash.visible = false;
  r.tpGun.add(m); r.tpGun.userData = { grip: new THREE.Vector3(...t), fore: m.userData.fore ? m.userData.fore.clone().multiply(m.scale).add(m.position) : null, cat };
}
// two-bone arm IK: shoulder group + elbow group reach for a point given in torso space
const _d = new THREE.Vector3(), _u = new THREE.Vector3(), _pole = new THREE.Vector3(), _xa = new THREE.Vector3(), _ya = new THREE.Vector3(), _za = new THREE.Vector3(), _f = new THREE.Vector3(), _mx = new THREE.Matrix4(), _qi = new THREE.Quaternion(), _DOWN = new THREE.Vector3(0, -1, 0);
function reach(sh, el, target, side) {
  _d.copy(target).sub(sh.position); let L = _d.length();
  L = Math.min(Math.max(L, Math.abs(UA - FA) + 0.02), UA + FA - 0.004); _d.normalize();
  const alpha = Math.acos(Math.min(1, Math.max(-1, (UA * UA + L * L - FA * FA) / (2 * UA * L))));
  _pole.set(side * 0.7, -1, 0.25); _pole.addScaledVector(_d, -_pole.dot(_d)).normalize();
  _u.copy(_d).multiplyScalar(Math.cos(alpha)).addScaledVector(_pole, Math.sin(alpha));
  _ya.copy(_u).negate(); _xa.crossVectors(_d, _pole).normalize(); _za.crossVectors(_xa, _ya).normalize(); _xa.crossVectors(_ya, _za);
  _mx.makeBasis(_xa, _ya, _za); sh.quaternion.setFromRotationMatrix(_mx);
  _f.copy(target).sub(sh.position).addScaledVector(_u, -UA).normalize();
  _qi.copy(sh.quaternion).invert(); _f.applyQuaternion(_qi);
  el.quaternion.setFromUnitVectors(_DOWN, _f);
}
const _gT = new THREE.Vector3();
// animate the rig: walk cycle with knees, crouch (real knee bend), aim pitch, arms holding the gun
export function posePlayer(r, { speed = 0, t = 0, crouch = 0, pitch = 0, dead = 0, emote = null }) {
  const mv = Math.min(1, speed / 4), ph = t * 9, sw = Math.sin(ph) * 0.55 * mv, c = crouch;
  const drop = 0.36 * c, phi = Math.acos(Math.max(-1, 1 - drop / 0.88));
  r.hip.position.y = 0.95 - drop; r.torso.position.y = 0.95 - drop + Math.abs(Math.cos(ph)) * 0.02 * mv;
  r.legL.rotation.set(phi + sw, 0, 0); r.legR.rotation.set(phi - sw, 0, 0);
  r.shinL.rotation.set(-2 * phi - Math.max(0, Math.cos(ph)) * 0.9 * mv, 0, 0); r.shinR.rotation.set(-2 * phi - Math.max(0, -Math.cos(ph)) * 0.9 * mv, 0, 0);
  r.torso.rotation.set(-0.22 * c - 0.06 * mv, -sw * 0.18, 0);
  r.neck.rotation.set(pitch * 0.5 + 0.22 * c, 0, 0);
  r.aim.rotation.set(pitch * 0.85 + 0.22 * c + 0.06 * mv, 0, 0);
  r.tpGun.visible = !emote;
  r.g.rotation.z = 0; r.g.rotation.x = dead ? -Math.PI / 2 * Math.min(1, dead) : 0;
  if (emote && !dead) { poseEmote(r, emote.anim, emote.t); return; }
  r.aim.updateMatrix();
  const ud = r.tpGun.userData || {};
  if (ud.grip) { _gT.copy(ud.grip).applyMatrix4(r.aim.matrix); reach(r.armR, r.foreR, _gT, 1); } else { r.armR.rotation.set(0.3, 0, 0.1); r.foreR.rotation.set(0.5, 0, 0); }
  if (ud.fore) { _gT.copy(ud.fore).applyMatrix4(r.aim.matrix); reach(r.armL, r.foreL, _gT, -1); }
  else if (ud.cat === 'pistol' || ud.cat === 'zeus') { _gT.set(ud.grip.x + 0.03, ud.grip.y - 0.03, ud.grip.z + 0.02).applyMatrix4(r.aim.matrix); reach(r.armL, r.foreL, _gT, -1); }
  else { r.armL.rotation.set(0.25 + sw * 0.6, 0, -0.12); r.foreL.rotation.set(0.45, 0, 0); }
}
// emote animations (procedural: a few sines per limb)
function poseEmote(r, anim, t) {
  const s = Math.sin, aL = r.armL.rotation, aR = r.armR.rotation, T = r.torso.rotation, N = r.neck.rotation;
  aL.set(0, 0, -0.2); aR.set(0, 0, 0.2); r.foreL.rotation.set(0, 0, 0); r.foreR.rotation.set(0, 0, 0);
  switch (anim) {
    case 'wave': aR.set(0, 0, 2.6); r.foreR.rotation.set(0, 0, 0.6 + s(t * 10) * 0.45); break;
    case 'salute': aR.set(0.4, 0, 1.6); r.foreR.rotation.set(0, 0, 2.2); N.x = 0.05; break;
    case 'dance': T.z = s(t * 6) * 0.25; aL.set(1.6 + s(t * 6) * 1.2, 0, -0.4); aR.set(1.6 - s(t * 6) * 1.2, 0, 0.4); r.foreL.rotation.x = r.foreR.rotation.x = 0.8; r.legL.rotation.x = Math.max(0, s(t * 6)) * 0.6; r.legR.rotation.x = Math.max(0, -s(t * 6)) * 0.6; break;
    case 'dab': aL.set(0.4, 0, -2.3); aR.set(1.2, 0, 0.9); r.foreR.rotation.set(1.6, 0, 0); N.set(-0.6, 0, 0.3); break;
    case 'tpose': aL.set(0, 0, -Math.PI / 2); aR.set(0, 0, Math.PI / 2); break;
    case 'floss': { const k = s(t * 9); aL.set(-0.3 * k, 0, -0.3 + k * 0.4); aR.set(0.3 * k, 0, 0.3 + k * 0.4); T.z = -k * 0.15; r.hip.rotation.z = k * 0.15; break; }
    case 'chicken': aL.set(0, 0, -0.4 - Math.abs(s(t * 12)) * 0.9); aR.set(0, 0, 0.4 + Math.abs(s(t * 12)) * 0.9); r.foreL.rotation.z = 1.8; r.foreR.rotation.z = -1.8; r.hip.position.y -= 0.15; r.torso.position.y -= 0.15; N.x = s(t * 12) * 0.3; break;
    case 'fart': T.x = -0.5; N.x = 0.3; aL.set(-0.6, 0, -0.3); aR.set(-0.6, 0, 0.3); r.hip.position.y -= Math.abs(s(t * 3)) * 0.05; break;
    case 'worm': T.x = -1.2 - s(t * 7) * 0.25; r.torso.position.y -= 0.5; aL.set(2.8, 0, -0.2); aR.set(2.8, 0, 0.2); r.legL.rotation.x = r.legR.rotation.x = 1.4 - s(t * 7 + 1) * 0.3; break;
    case 'flex': aL.set(0, 0, -1.5); aR.set(0, 0, 1.5); r.foreL.rotation.set(0, 0, 1.9 + s(t * 6) * 0.15); r.foreR.rotation.set(0, 0, -1.9 - s(t * 6) * 0.15); T.y = s(t * 2) * 0.3; break;
    case 'cry': aL.set(1.2, 0, 0.3); aR.set(1.2, 0, -0.3); r.foreL.rotation.set(1.9, 0, 0); r.foreR.rotation.set(1.9, 0, 0); N.x = -0.4 + s(t * 14) * 0.08; T.x = -0.2; break;
    case 'twerk': T.x = -0.9; r.hip.rotation.x = 0.3 + s(t * 18) * 0.12; r.hip.position.y += s(t * 18) * 0.05; r.torso.position.y += s(t * 18) * 0.03; aL.set(-0.4, 0, -0.3); aR.set(-0.4, 0, 0.3); r.legL.rotation.x = r.legR.rotation.x = 0.5; r.shinL.rotation.x = r.shinR.rotation.x = -0.9; break;
    default: break;
  }
}

// ---- weapon materials ---------------------------------------------------------------------------------------------
// ---- weapon surfaces (Medium and up): a real finish on every part, tiled in the gun's own space so a 5 cm patch of
// steel looks the same on a pistol pin as on a rifle receiver: bead-blasted steel, stippled polymer, checkered grips,
// walnut, Cerakote paint. Edges that get handled wear through to bright metal (found from how fast the surface curves).
const SURF = { gsteel: null, gpoly: null, ggrip: null, gwood: null, gpaint: null, grubber: null };
const neutral = (() => { let c = null, n = null; return () => { if (!c) { c = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); n = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); c.needsUpdate = n.needsUpdate = true; } return [c, n]; }; })();
function surfTex(set) {
  if (!SURF[set]) {
    const [c, n] = neutral(), u = { c: { value: c }, n: { value: n } };
    SURF[set] = u;
    loadTx(`tx_${set}_512.jpg`, false, 4).then((t) => { if (t) u.c.value = t; });
    loadTx(`tx_${set}_512n.jpg`, false, 4).then((t) => { if (t) u.n.value = t; });
  }
  return SURF[set];
}
export function gunSurface(m, set, o = {}) {
  const T = surfTex(set), tile = o.tile || 20, nk = o.normal ?? 1, ak = o.albedo ?? 1, rk = o.rough ?? 0.5, wear = o.wear ?? 0;
  const wc = new THREE.Color(o.wearColor || '#b9bcc2');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { gC: T.c, gN: T.n, gTile: { value: tile }, gNk: { value: nk }, gAk: { value: ak }, gRk: { value: rk }, gWear: { value: wear }, gWearC: { value: wc } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON; varying vec3 vAX; varying vec3 vAY; varying vec3 vAZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal; vAX = normalize(normalMatrix * vec3(1.0, 0.0, 0.0)); vAY = normalize(normalMatrix * vec3(0.0, 1.0, 0.0)); vAZ = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));');
    let f = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D gC; uniform sampler2D gN; uniform float gTile; uniform float gNk; uniform float gAk; uniform float gRk; uniform float gWear; uniform vec3 gWearC;
varying vec3 vOP; varying vec3 vON; varying vec3 vAX; varying vec3 vAY; varying vec3 vAZ;
float gW; vec3 gTri; vec4 gNs;`);
    // triplanar weights and samples, once
    f = f.replace('#include <map_fragment>', `#include <map_fragment>
  vec3 gw3 = pow(abs(normalize(vON)), vec3(4.0)); gw3 /= max(gw3.x + gw3.y + gw3.z, 1e-4);
  vec3 gp = vOP * gTile;
  float gcx = texture2D(gC, gp.zy).r, gcy = texture2D(gC, gp.xz + 0.31).r, gcz = texture2D(gC, gp.xy + 0.67).r;
  vec4 gnx = texture2D(gN, gp.zy), gny = texture2D(gN, gp.xz + 0.31), gnz = texture2D(gN, gp.xy + 0.67);
  float gcol = gcx * gw3.x + gcy * gw3.y + gcz * gw3.z;
  gNs = gnx * gw3.x + gny * gw3.y + gnz * gw3.z;
  gTri = vec3(gnx.r - 0.5, gny.r - 0.5, gnz.r - 0.5) * 2.0;
  diffuseColor.rgb *= mix(1.0, gcol * 2.0, gAk);
  // handling wear: the tighter a rounded edge curves, the more its finish is rubbed back to metal
  vec3 gdn = fwidth(normalize(vON)); float gdp = length(fwidth(vOP)) + 1e-5;
  float gcurv = length(gdn) / gdp;
  float gpatch = texture2D(gC, vOP.zy * 1.3 + vOP.xy * 0.7).r;   // wear comes in patches (where hands and holsters rub), not as an outline
  gW = gWear * smoothstep(80.0, 320.0, gcurv) * smoothstep(0.5, 0.56, gpatch) * smoothstep(0.42, 0.6, gcol + (gNs.b - 0.5) * 0.5);
  diffuseColor.rgb = mix(diffuseColor.rgb, gWearC, gW);`);
    f = f.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = clamp(roughnessFactor + (gNs.b - 0.5) * gRk * 2.0, 0.04, 1.0); roughnessFactor = mix(roughnessFactor, 0.3, gW);`);
    f = f.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = mix(metalnessFactor, 1.0, gW);`);
    f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {   // the finish's normal detail, per projection plane, turned into view space through the gun's own axes
    vec3 gw3b = pow(abs(normalize(vON)), vec3(4.0)); gw3b /= max(gw3b.x + gw3b.y + gw3b.z, 1e-4);
    vec3 gp2 = vOP * gTile;
    vec2 dx = texture2D(gN, gp2.zy).rg - 0.5, dy = texture2D(gN, gp2.xz + 0.31).rg - 0.5, dz = texture2D(gN, gp2.xy + 0.67).rg - 0.5;
    vec3 dObj = vec3(0.0, dx.y, dx.x) * gw3b.x + vec3(dy.x, 0.0, dy.y) * gw3b.y + vec3(dz.x, dz.y, 0.0) * gw3b.z;
    normal = normalize(normal + (dObj.x * vAX + dObj.y * vAY + dObj.z * vAZ) * 2.0 * gNk * (1.0 - gW * 0.6));
  }`);
    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => 'gun-' + set;
  m.extensions = { derivatives: true };
  return m;
}

const gmat = new Map();
function gm(key) {
  const k = key + (HQ ? 'H' : 'L');
  if (gmat.has(k)) return gmat.get(k);
  const D = { metal: ['#2f3135', 70, '#6a6e76'], dark: ['#1c1d20', 18, '#2a2a2a'], steel: ['#9aa0aa', 90, '#d8dce4'], blade: ['#c8ccd2', 110, '#ffffff'], wood: ['#a8703e', 20, '#3a2a1a'],
    green: ['#4c5a3a', 20, '#333'], putty: ['#c9b68e', 6, '#222'], tape: ['#161616', 10, '#222'], rag: ['#cfc3a6', 4, '#111'], wireR: ['#b52020', 30, '#444'], wireB: ['#2040b0', 30, '#444'], wireY: ['#c8b020', 30, '#444'], tan: ['#a8946a', 15, '#333'], olive: ['#5a6040', 18, '#333'], yellow: ['#e2c840', 30, '#444'], grip: ['#26221f', 6, '#111'], lens: ['#1a3040', 120, '#9ad0ff'], brass: ['#b89040', 80, '#ffe0a0'] }[key] || ['#888', 20, '#333'];
  if (key === 'lcd') { const r = new THREE.MeshBasicMaterial({ color: '#5a8a3a' }); gmat.set(k, r); return r; }
  if (key === 'bottle') { const r = HQ ? new THREE.MeshStandardMaterial({ color: '#4a7a3e', metalness: 0, roughness: 0.06, transparent: true, opacity: 0.55, envMapIntensity: 1.6, depthWrite: false }) : new THREE.MeshLambertMaterial({ color: '#4a7a3e', transparent: true, opacity: 0.7 }); gmat.set(k, r); return r; }
  if (key === 'fuel') { const r = HQ ? new THREE.MeshStandardMaterial({ color: '#b08a30', metalness: 0, roughness: 0.1, transparent: true, opacity: 0.8 }) : lam('#b08a30'); gmat.set(k, r); return r; }
  if (key === 'dot') { const r = new THREE.MeshBasicMaterial({ color: '#e8f0dc' }); gmat.set(k, r); return r; }
  if (key === 'reticle') { const r = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.1, 0.07), side: THREE.DoubleSide, toneMapped: false, fog: false }); gmat.set(k, r); return r; }   // illuminated: bright enough to bloom
  if (key === 'glass') {   // coated optic glass: barely tinted head-on, a blue-violet coating sheen toward the edges and at angles
    const g = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }',
      fragmentShader: `varying vec3 vN; varying vec3 vP; void main() { float f = pow(1.0 - abs(dot(normalize(-vP), normalize(vN))), 2.0);
        vec3 c = mix(vec3(0.55, 0.72, 0.95), vec3(0.62, 0.42, 0.95), f); gl_FragColor = vec4(c, 0.07 + 0.4 * f); }` });
    gmat.set(k, g); return g;
  }
  const o = { color: D[0], vertexColors: false };
  if (key === 'optic') { o.color = '#1d1f23'; o.side = THREE.DoubleSide; }
  if (key === 'wood' && HQ) o.color = '#4a2a1a';   // red-brown laminate, grain from the walnut finish below
  else if (key === 'wood') { const t = new THREE.CanvasTexture(surface('darkwood', 128, false).map); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; o.map = t; o.color = '#e0b080'; }
  // Medium and up: physically based (metal reflects the map's sky, painted and plastic parts stay matte)
  const PBR = { metal: [0.85, 0.36], dark: [0.25, 0.62], steel: [0.95, 0.22], blade: [1, 0.14], wood: [0, 0.62], green: [0, 0.72], tan: [0, 0.75],
    olive: [0, 0.72], yellow: [0.1, 0.5], grip: [0, 0.86], lens: [0.4, 0.06], brass: [1, 0.3], optic: [0.55, 0.42], putty: [0, 0.85], tape: [0, 0.5], rag: [0, 0.95], wireR: [0, 0.35], wireB: [0, 0.35], wireY: [0, 0.35] }[key] || [0.2, 0.6];
  const m = HQ ? new THREE.MeshStandardMaterial({ ...o, metalness: PBR[0], roughness: PBR[1], envMapIntensity: 1.1 }) : new THREE.MeshLambertMaterial(o);
  if (HQ) {
    const S = { metal: ['gsteel', { wear: 0.75 }], steel: ['gsteel', { wear: 0.5, wearColor: '#e2e6ec' }], blade: ['gsteel', { normal: 0.4, rough: 0.3 }], brass: ['gsteel', { normal: 0.5, wear: 0.6, wearColor: '#f0d890' }],
      dark: ['gpoly', { wear: 0.35, wearColor: '#6a6e74' }], grip: ['ggrip', { tile: 26 }], wood: ['gwood', { tile: 7, albedo: 1.1, wear: 0.4, wearColor: '#a8683a' }], green: ['gpaint', { wear: 0.7, wearColor: '#7a7d80' }],
      tan: ['gpaint', { wear: 0.7, wearColor: '#7a7d80' }], olive: ['gpoly', { wear: 0.4 }], yellow: ['gpaint', { wear: 0.6 }], putty: ['gpoly', { normal: 1.6 }], tape: ['grubber', {}], rag: ['gwood', { tile: 30, albedo: 0.6 }], optic: ['gpaint', { wear: 0.5, wearColor: '#8a8d92' }] }[key];
    if (S) gunSurface(m, S[0], S[1]);
  }
  gmat.set(k, m); return m;
}
const skinTexCache = new Map();
export function skinTexture(item, info) {
  const k = item ? item.uid : 'none';
  if (skinTexCache.has(k)) return skinTexCache.get(k);
  let t = null;
  if (item && info && info.paint) {
    const sc = HQ ? 8 : 4, big = document.createElement('canvas'); big.width = 64 * sc; big.height = 32 * sc;   // painted at full resolution: crisp edges, fine scratches
    paintSkin(big, info.paint, item.seed, item.float, sc);
    const g = big.getContext('2d'), im = g.getImageData(0, 0, big.width, big.height);   // a fine grain on top so the paint reads as a coating
    let s = (item.seed | 0) * 7919 + 1; for (let i = 0; i < im.data.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 16) & 15) - 7; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
    g.putImageData(im, 0, 0);
    t = new THREE.CanvasTexture(big); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (info.paint.glow) t.userData.glow = glowMask(info.paint);
  }
  skinTexCache.set(k, t);
  return t;
}
// ---- Mythic glow: a bright-on-black copy of the vein pattern, used as the light the finish gives off. It scrolls
// (mirrored, so there is no seam) and pulses, so the veins look alive. One mask per pattern + colour, shared.
const glowMasks = new Map(), GLOW_MATS = new Set();
export function glowMask(paint, repeat = 1) {
  const key = `${paint.g || paint.t}|${paint.glow}|${repeat}`;
  if (glowMasks.has(key)) return glowMasks.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const t0 = paint.g || paint.t, band = t0 === 'fade' || t0 === 'wave';
  paintSkin(c, { t: t0, c: band ? ['#000000', paint.glow, '#000000'] : ['#000000', paint.glow, paint.glow], s: paint.s, mask: true }, 7, 0, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(repeat, repeat);
  glowMasks.set(key, t); return t;
}
export function glowify(m, mask, strength = 1) {   // turn a material into a glowing, animated one
  m.emissive = new THREE.Color(1, 1, 1); m.emissiveMap = mask; m.emissiveIntensity = strength; m.userData.glowK = strength; m.userData.glowMask = mask;
  GLOW_MATS.add(m); return m;
}
let glowBoost = 0;
export const flareGlow = (s = 1) => { glowBoost = Math.max(glowBoost, s); };   // a Mythic inspect: the veins flare up
export function animateGlow(t, dt) {   // call once a frame
  glowBoost = Math.max(0, glowBoost - dt * 0.6);
  const pulse = 0.72 + 0.28 * Math.sin(t * 2.6) + glowBoost * 1.6, seen = new Set();
  for (const m of GLOW_MATS) {
    m.emissiveIntensity = (m.userData.glowK || 1) * pulse;
    const mk = m.userData.glowMask; if (mk && !seen.has(mk)) { seen.add(mk); mk.offset.x = (t * 0.07) % 2; mk.offset.y = Math.sin(t * 0.4) * 0.15; }
  }
}
const paintMats = new Map();
const paintMat = (tex) => {
  if (paintMats.has(tex)) return paintMats.get(tex);
  const m = HQ ? new THREE.MeshStandardMaterial({ map: tex, metalness: tex.userData.glow ? 0.5 : 0.3, roughness: tex.userData.glow ? 0.25 : 0.42, envMapIntensity: 1.1 }) : new THREE.MeshLambertMaterial({ map: tex });
  if (HQ && !tex.userData.glow) gunSurface(m, 'gpaint', { wear: 0.85, albedo: 0.6 });   // skins are paint: it chips at the edges
  if (tex.userData.glow) glowify(m, tex.userData.glow, 1);
  paintMats.set(tex, m); return m;
};

// ---- gun geometry: side profiles (u = forward, v = up, metres) extruded to thickness, plus barrels and parts ---------
function ext(pts, depth, bevel = 0.0035, holes = null) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p[0] === 'q') sh.quadraticCurveTo(p[1], p[2], p[3], p[4]); else sh.lineTo(p[0], p[1]); }
  sh.closePath();
  if (holes) for (const hp of holes) { const h = new THREE.Path(); h.moveTo(hp[0][0], hp[0][1]); for (let i = 1; i < hp.length; i++) h.lineTo(hp[i][0], hp[i][1]); h.closePath(); sh.holes.push(h); }
  const d = Math.max(0.002, depth - bevel * 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: HQ && bevel > 0 ? 3 : 1, curveSegments: HQ ? 12 : 6 });
  g.translate(0, 0, -d / 2); g.rotateY(Math.PI / 2);
  return HQ ? crease(g) : g;
}
const tube = (r, u0, u1, v, x = 0, seg = 10, r1 = r) => { const g = CYL(r1, r, u1 - u0, seg); g.rotateX(-Math.PI / 2); g.translate(x, v, -(u0 + u1) / 2); return g; };
// a block (u along the gun, v up, w across): on Medium+ with softly bevelled edges like a machined or moulded part
const blk = (u0, u1, v0, v1, w, x = 0) => {
  const m = Math.min(u1 - u0, v1 - v0, w), bv = Math.min(0.0016, m * 0.18);
  if (!HQ || bv < 0.0004) { const g = BOX(w, v1 - v0, u1 - u0); g.translate(x, (v0 + v1) / 2, -(u0 + u1) / 2); return g; }
  const e = bv * 0.8;
  return ext([[u0 + e, v0 + e], [u1 - e, v0 + e], [u1 - e, v1 - e], [u0 + e, v1 - e]], w, bv).translate(x, 0, 0);
};
const guard = (u0, u1, v0, v1, w = 0.012) => ext([[u0, v1], [u1, v1], [u1, v0 + 0.012], ['q', u1, v0, u1 - 0.015, v0], [u0 + 0.01, v0], [u0, v0 + 0.012]], w, 0.002, [[[u0 + 0.008, v1 - 0.001], [u1 - 0.008, v1 - 0.001], [u1 - 0.008, v0 + 0.008], [u0 + 0.008, v0 + 0.008]]]);

const xpin = (u, v, len, r = 0.0032) => place(CYL(r, r, len, 8), [0, v, -u], [0, 0, Math.PI / 2]);   // a pin/rivet/button across the gun
// per-weapon recipes. Parts go into material buckets: body (takes the skin), metal, dark, wood, ...
const RECIPE = {};
const R = (ids, fn) => { for (const id of ids.split(' ')) RECIPE[id] = fn; };
function rifle(G, o) {
  const [r0, r1, rb, rt] = o.recv, w = o.w || 0.05, F = o.furn || 'dark', B = 'body';
  // receiver (dust cover rounded on the AK family, flat-top rail on the western rifles)
  if (o.top === 'ak') G(B, ext([[r0, rb], [r1, rb], [r1, rt - 0.012], ['q', (r0 + r1) / 2, rt + 0.01, r0, rt - 0.004]], w));
  else G(B, ext([[r0, rb], [r1, rb], [r1, rt - 0.01], [r1 - 0.015, rt], [r0 + 0.01, rt], [r0, rt - 0.012]], w));
  G('dark', blk(r1 - 0.13, r1 - 0.05, rt - 0.036, rt - 0.014, w + 0.004));   // ejection port
  G('metal', blk(r1 - 0.045, r1 - 0.025, rt - 0.03, rt - 0.016, w + 0.03, w / 2 + 0.012));   // charging handle
  // grip + trigger guard + trigger
  G(o.gripMat || F, ext([[-0.04, rb + 0.004], [0.018, rb + 0.004], [-0.004, rb - 0.115], [-0.056, rb - 0.12], ['q', -0.064, rb - 0.06, -0.04, rb + 0.004]], w * 0.82));
  G('metal', guard(0.012, 0.09, rb - 0.048, rb + 0.002)); G('metal', blk(0.04, 0.048, rb - 0.03, rb, 0.006));
  // magazine
  const m0 = o.mag0 ?? 0.11;
  if (o.mag === 'curve') G('mag|' + (o.magMat || 'metal'), ext([[m0, rb + 0.005], [m0 + 0.075, rb + 0.005], ['q', m0 + 0.09, rb - 0.12, m0 + 0.15, rb - 0.205], [m0 + 0.085, rb - 0.235], ['q', m0 + 0.025, rb - 0.13, m0, rb + 0.005]], w * 0.72));
  else if (o.mag === 'straight') G('mag|' + (o.magMat || 'dark'), ext([[m0, rb + 0.005], [m0 + 0.068, rb + 0.005], [m0 + 0.085, rb - 0.165], [m0 + 0.017, rb - 0.172]], w * 0.68));
  else if (o.mag === 'box') G('mag|' + (o.magMat || 'dark'), ext([[m0, rb + 0.005], [m0 + 0.085, rb + 0.005], [m0 + 0.085, rb - 0.07], [m0, rb - 0.07]], w * 0.75));
  else if (o.mag === 'mg') { G('mag|dark', blk(m0, m0 + 0.13, rb - 0.13, rb + 0.005, w * 1.6, -0.02)); G('mag|olive', blk(m0 + 0.01, m0 + 0.12, rb - 0.125, rb - 0.04, w * 1.62, -0.02)); }
  // handguard
  const [h0, h1] = o.hg, hv = (rb + rt) / 2;
  if (o.hgType === 'ak') {
    const L = h1 - h0;   // lower handguard: a swell under the palm, finger grooves along the bottom edge
    G(F, ext([[h0, rb + 0.004], [h0 + L * 0.2, rb - 0.004], ['q', h0 + L * 0.5, rb - 0.01, h0 + L * 0.8, rb - 0.002], [h1, rb + 0.008], [h1, hv + 0.004], [h0 + L * 0.5, hv + 0.006], [h0, hv + 0.008]], w * 1.12, 0.005));
    G(F, ext([[h0 + 0.02, hv + 0.012], [h1 - 0.05, hv + 0.012], [h1 - 0.05, rt - 0.008], ['q', (h0 + h1) / 2, rt - 0.002, h0 + 0.02, rt - 0.006]], w * 0.9, 0.004));   // upper (gas tube cover)
    G('metal', blk(h0 - 0.008, h0 + 0.004, rb, rt - 0.01, w * 1.16));   // rear retainer
    G('metal', blk(h1 - 0.006, h1 + 0.004, rb + 0.006, hv + 0.01, w * 1.18));   // front ferrule
    G('metal', tube(0.011, h1 - 0.05, h1 + 0.02, rt - 0.012));
    for (let k = 0; k < 3; k++) G('dark', blk(h1 - 0.045 + k * 0.012, h1 - 0.039 + k * 0.012, rt - 0.016, rt - 0.008, 0.0235));   // gas vents
  }
  else if (o.hgType === 'quad') {
    G(F, tube(0.028, h0, h1, hv, 0, 8));
    for (let k = 0; k < 4; k++) {   // four picatinny rails: a spine and a row of slotted teeth on each side
      const M = new THREE.Matrix4().makeTranslation(0, hv, 0).multiply(new THREE.Matrix4().makeRotationZ(k * Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(0, 0.028, 0));
      G('dark', blk(h0, h1, -0.003, 0.004, 0.016).applyMatrix4(M));
      for (let u = h0 + 0.006; u < h1 - 0.012; u += 0.01) G('dark', blk(u, u + 0.0055, 0.004, 0.0085, 0.021).applyMatrix4(M));
    }
    G('metal', tube(0.036, h0 - 0.012, h0, hv, 0, 14)); G('metal', tube(0.032, h0 - 0.02, h0 - 0.012, hv, 0, 14));   // delta ring + its spring
  }
  else if (o.hgType === 'round') G(F, tube(o.hgR || 0.026, h0, h1, hv - 0.004, 0, 12));
  else if (o.hgType === 'slab') G(F, ext([[h0, rb - 0.01], [h1, rb - 0.004], [h1, rt - 0.004], [h0, rt]], w * 1.15));
  // barrel, front sight, muzzle
  const bv = o.bv ?? (hv + 0.006), bEnd = h1 + (o.blen || 0.12);
  G('metal', tube(o.br || 0.0105, h1 - 0.02, bEnd, bv));
  if (o.fsight !== false && o.top === 'ak') {   // AK front sight: a block on the barrel, a post between two protective ears
    G('metal', blk(h1 + 0.03, h1 + 0.06, bv - 0.014, bv + 0.016, 0.024)); G('metal', blk(h1 + 0.038, h1 + 0.052, bv + 0.016, bv + 0.05, 0.004));
    for (const x of [-0.011, 0.011]) G('metal', ext([[h1 + 0.034, bv + 0.012], [h1 + 0.056, bv + 0.012], [h1 + 0.052, bv + 0.055], [h1 + 0.04, bv + 0.055]], 0.004, 0).translate(x, 0, 0));
  } else if (o.fsight !== false) {
    G('dark', ext([[h1 + 0.012, bv - 0.014], [h1 + 0.058, bv - 0.014], [h1 + 0.05, bv + 0.03], [h1 + 0.032, bv + 0.046], [h1 + 0.026, bv + 0.046], [h1 + 0.02, bv + 0.03]], 0.016, 0.002));   // A2 base
    for (const x of [-0.009, 0.009]) G('dark', blk(h1 + 0.026, h1 + 0.034, bv + 0.04, bv + 0.058, 0.003, x));   // protective ears
    G('dark', blk(h1 + 0.028, h1 + 0.032, bv + 0.042, bv + 0.056, 0.0025));   // post
    G('dark', blk(h1 + 0.03, h1 + 0.05, bv - 0.03, bv - 0.014, 0.01));   // bayonet lug
    G('metal', place(new THREE.TorusGeometry(0.008, 0.002, 6, 12), [0, bv - 0.024, -(h1 + 0.016)], [0, Math.PI / 2, 0]));   // sling swivel
  }
  if (o.hgType !== 'none') G('metal', blk(h1 - 0.004, h1 + 0.022, bv - 0.013, Math.max(bv + 0.014, rt - 0.006), 0.024));   // gas block
  if (o.bead) { G('steel', place(SPH(0.0028, 10, 8), [0, bv + (o.br || 0.0105) + 0.002, -(bEnd - 0.012)])); G('dark', blk(h1, bEnd - 0.02, bv + (o.br || 0.0105) - 0.001, bv + (o.br || 0.0105) + 0.002, 0.008)); }   // bead + vent rib
  muzzle(G, (G.att && G.att.muzzle && G.att.muzzle !== 'standard' && !o.noMuzzleAtt) ? G.att.muzzle : o.muzzle, bEnd, bv);
  // stock
  const so = o.stock;
  if (so === 'ak') G(F, ext([[r0, rt - 0.008], [r0, rb + 0.004], [r0 - 0.27, rb - 0.075], [r0 - 0.3, rb - 0.078], [r0 - 0.305, rt - 0.03], ['q', r0 - 0.15, rt - 0.018, r0, rt - 0.008]], w * 0.9));
  else if (so === 'm4') { G('dark', tube(0.017, r0 - 0.2, r0, rt - 0.028)); G(F, ext([[r0 - 0.11, rt - 0.004], [r0 - 0.245, rt - 0.004], [r0 - 0.262, rb - 0.075], [r0 - 0.205, rb - 0.075], ['q', r0 - 0.16, rb - 0.02, r0 - 0.11, rt - 0.05]], w * 0.86)); }
  else if (so === 'skel') { G(F, blk(r0 - 0.24, r0, rt - 0.03, rt - 0.012, 0.022)); G(F, ext([[r0, rb + 0.01], [r0 - 0.012, rb - 0.01], [r0 - 0.24, rb - 0.055], [r0 - 0.24, rb - 0.035]], 0.022)); G(F, blk(r0 - 0.26, r0 - 0.235, rb - 0.06, rt - 0.01, w)); }
  else if (so === 'thumb') G(B, ext([[r0, rt], [r0, rb - 0.01], [r0 - 0.05, rb - 0.035], [r0 - 0.32, rb - 0.08], [r0 - 0.34, rb - 0.08], [r0 - 0.345, rt + 0.005], [r0 - 0.2, rt + 0.012]], w * 1.05, 0.004, [[[r0 - 0.07, rb - 0.015], [r0 - 0.16, rb - 0.035], [r0 - 0.15, rt - 0.03], [r0 - 0.08, rt - 0.025]]]));
  else if (so === 'fold') G('dark', blk(r0 - 0.03, r0, rb + 0.01, rt - 0.01, w * 0.6));
  // top: rail / carry handle / scope / iron sights
  if (o.rail) for (let k = 0; k * 0.024 < (o.railLen || (r1 - r0 - 0.02)); k++) G('dark', blk(r0 + 0.01 + k * 0.024, r0 + 0.026 + k * 0.024, rt, rt + 0.011, w * 0.72));
  if (o.scope) {
    const sv = rt + (o.scopeH || 0.055), s0 = o.scope[0], s1 = o.scope[1];
    G('dark', tube(0.019, s0, s1, sv, 0, 14)); G('dark', tube(0.019, s1, s1 + 0.07, sv, 0, 14, 0.028)); G('dark', tube(0.026, s0 - 0.07, s0, sv, 0, 14, 0.019));
    G('dark', blk(s0 + 0.03, s0 + 0.05, rt, sv - 0.012, 0.025)); G('dark', blk(s1 - 0.05, s1 - 0.03, rt, sv - 0.012, 0.025)); G('dark', tube(0.012, s0 + 0.1, s0 + 0.13, sv + 0.022, 0, 8));
    G('lens', tube(0.024, s1 + 0.066, s1 + 0.071, sv, 0, 14));
    G('lens', tube(0.023, s0 - 0.068, s0 - 0.064, sv, 0, 14));
    for (const u of [s0 + 0.04, s1 - 0.04]) G('metal', tube(0.022, u - 0.008, u + 0.008, sv, 0, 16));   // scope rings
    const tu = (s0 + s1) / 2;   // elevation (top) and windage (right) turrets with ridged caps
    G('dark', place(CYL(0.012, 0.012, 0.022, 16), [0, sv + 0.026, -tu])); G('metal', place(CYL(0.0125, 0.0125, 0.006, 24), [0, sv + 0.036, -tu]));
    for (let k = 0; k < 12; k++) G('dark', place(BOX(0.0015, 0.008, 0.0015), [Math.cos(k * 0.5236) * 0.0127, sv + 0.033, -tu + Math.sin(k * 0.5236) * 0.0127]));
    G('dark', place(CYL(0.012, 0.012, 0.022, 16), [0.026, sv, -tu], [0, 0, Math.PI / 2])); G('metal', place(CYL(0.0125, 0.0125, 0.006, 24), [0.036, sv, -tu], [0, 0, Math.PI / 2]));
    G('grip', tube(0.027, s0 - 0.075, s0 - 0.055, sv, 0, 16));   // rubber eyecup
  } else if (o.rear !== false && o.top !== 'ak') G('metal', blk(r0 + 0.03, r0 + 0.05, rt, rt + 0.03, 0.03));
  const mount = o.scope ? null : o.handle ? [(r0 + r1) / 2 - 0.02, rt + 0.06] : [r0 + (r1 - r0) * 0.42, rt + (o.rail ? 0.011 : 0)];
  if (o.handle) { G(F, ext([[r0 + 0.02, rt], [r0 + 0.04, rt + 0.06], [r1 + 0.12, rt + 0.06], [r1 + 0.14, rt], [r1 + 0.1, rt], [r1 + 0.09, rt + 0.04], [r0 + 0.07, rt + 0.04], [r0 + 0.06, rt]], 0.028)); }
  if (o.bipod) { G('dark', tube(0.006, h1 - 0.02, h1 + 0.15, bv - 0.03, 0.02, 6)); G('dark', tube(0.006, h1 - 0.02, h1 + 0.15, bv - 0.03, -0.02, 6)); }
  // the small parts that make it read as a real gun: pins and rivets, controls, mag floor plates and ribs, buttpads
  for (const u of [r0 + 0.025, (r0 + r1) / 2 - 0.02, r1 - 0.025]) G('dark', xpin(u, rb + 0.011, w + 0.004));
  G('dark', xpin(0.044, rb - 0.006, w + 0.004, 0.0025));   // trigger pin
  if (o.top === 'ak') {
    G('metal', ext([[r1 - 0.17, rt - 0.031], [r1 - 0.03, rt - 0.025], [r1 - 0.025, rt - 0.017], [r1 - 0.17, rt - 0.023]], 0.003, 0).translate(w / 2 + 0.0025, 0, 0));   // selector lever
    G('metal', blk(r1 - 0.17, r1 - 0.15, rt - 0.034, rt - 0.024, 0.006, w / 2 + 0.003));
    if (o.rear !== false) { G('metal', blk(r1 + 0.002, r1 + 0.05, rt - 0.012, rt + 0.012, w * 0.62)); G('dark', ext([[r1 + 0.008, rt + 0.012], [r1 + 0.06, rt + 0.016], [r1 + 0.06, rt + 0.02], [r1 + 0.008, rt + 0.018]], w * 0.5, 0)); }   // rear sight block + leaf
    for (const u of [r0 + 0.05, r0 + 0.09, r1 - 0.06]) G('metal', xpin(u, rt - 0.02, w + 0.003, 0.0026));   // rivets
    for (let k = 0; k < 6; k++) G(B, blk(r0 + 0.03 + k * 0.022, r0 + 0.036 + k * 0.022, rt - 0.004, rt + 0.0035, w * 0.7));   // dust cover ribs
    G('dark', ext([[m0 + 0.012, rb + 0.016], [m0 + 0.062, rb + 0.016], [m0 + 0.058, rb + 0.006], [m0 + 0.016, rb + 0.006]], w + 0.002, 0.001));   // magazine-guide dimple
    G('metal', ext([[m0 - 0.004, rb + 0.002], [m0 + 0.002, rb + 0.002], [m0 - 0.004, rb - 0.034], [m0 - 0.014, rb - 0.036]], 0.016, 0.001));   // mag release paddle
    G('metal', place(CYL(0.006, 0.006, 0.016, 10), [w / 2 + 0.016, rt - 0.024, -(r1 - 0.035)], [0, 0, Math.PI / 2]));   // bolt-carrier handle knob
    if (o.fsight !== false) {
      G('metal', blk(h1 + 0.028, h1 + 0.04, bv - 0.032, bv - 0.012, 0.01));                         // bayonet lug
      G('metal', tube(0.0032, h1 - 0.03, (h1 + (o.blen || 0.12)) - 0.012, bv - 0.022, 0, 8));           // cleaning rod
      G('metal', place(new THREE.TorusGeometry(0.007, 0.0018, 6, 12), [0, bv - 0.022, -(h1 + 0.008)], [0, Math.PI / 2, 0]));   // front sling loop
    }
  } else if (o.rail || o.stock === 'm4') {
    G('dark', tube(0.0075, r1 - 0.075, r1 - 0.035, rt - 0.02, w / 2 + 0.006, 8));            // forward assist
    G('dark', blk(r1 - 0.13, r1 - 0.12, rt - 0.026, rt - 0.006, 0.014, w / 2 + 0.004));      // brass deflector
    G('dark', xpin(m0 - 0.014, rb - 0.012, w + 0.01, 0.0048));                               // mag release
    G('metal', blk(r1 - 0.13, r1 - 0.05, rt - 0.034, rt - 0.012, 0.0025, w / 2 + 0.0012));    // ejection port dust cover
    G('dark', ext([[m0 - 0.006, rb + 0.004], [m0 + 0.09, rb + 0.004], [m0 + 0.092, rb - 0.026], ['q', m0 + 0.045, rb - 0.034, m0 - 0.008, rb - 0.024]], w + 0.006, 0.002));   // flared magwell
    G('dark', ext([[r0 + 0.004, rt + 0.004], [r0 + 0.03, rt + 0.004], [r0 + 0.03, rt + 0.012], [r0 - 0.012, rt + 0.012], [r0 - 0.012, rt + 0.006]], 0.024, 0.0015));   // charging handle
    G('metal', place(CYL(0.006, 0.006, 0.006, 12), [-(w / 2 + 0.003), rb - 0.004, -(r0 + 0.045)], [0, 0, Math.PI / 2]));   // safety selector hub
    G('metal', ext([[r0 + 0.035, rb - 0.003], [r0 + 0.06, rb - 0.0], [r0 + 0.06, rb - 0.008], [r0 + 0.035, rb - 0.006]], 0.003, 0).translate(-(w / 2 + 0.006), 0, 0));   // and its lever
    G('dark', blk(m0 + 0.078, m0 + 0.094, rb - 0.006, rb + 0.012, 0.004, -w / 2 - 0.0025));    // bolt catch
  }
  if (o.mag === 'curve') { const k = 'mag|' + (o.magMat || 'metal'); G(k, ext([[m0 + 0.146, rb - 0.2], [m0 + 0.162, rb - 0.212], [m0 + 0.094, rb - 0.244], [m0 + 0.08, rb - 0.232]], w * 0.8, 0.002)); for (let i = 0; i < 4; i++) G(k, ext([[m0 + 0.012 + i * 0.012, rb - 0.03 - i * 0.04], [m0 + 0.07 + i * 0.016, rb - 0.03 - i * 0.04], [m0 + 0.07 + i * 0.016, rb - 0.034 - i * 0.04], [m0 + 0.012 + i * 0.012, rb - 0.034 - i * 0.04]], w * 0.72 + 0.003, 0)); }
  if (o.mag === 'straight') { const k = 'mag|' + (o.magMat || 'dark'); G(k, ext([[m0 + 0.014, rb - 0.172], [m0 + 0.088, rb - 0.165], [m0 + 0.09, rb - 0.176], [m0 + 0.014, rb - 0.183]], w * 0.74, 0.002)); for (let i = 0; i < 3; i++) G(k, blk(m0 + 0.03 + i * 0.003, m0 + 0.06 + i * 0.003, rb - 0.04 - i * 0.04, rb - 0.036 - i * 0.04, w * 0.68 + 0.003)); }
  if (o.stock === 'm4') {
    G('dark', ext([[r0 - 0.245, rt - 0.002], [r0 - 0.262, rt - 0.002], [r0 - 0.279, rb - 0.077], [r0 - 0.262, rb - 0.077]], w * 0.9, 0.002));   // rubber buttpad
    G('metal', tube(0.02, r0 - 0.012, r0 - 0.004, rt - 0.028, 0, 12));   // castle nut
    for (let k = 0; k < 4; k++) G('metal', blk(r0 - 0.012, r0 - 0.004, rt - 0.028 + 0.019, rt - 0.028 + 0.023, 0.005).applyMatrix4(new THREE.Matrix4().makeTranslation(0, rt - 0.028, 0).multiply(new THREE.Matrix4().makeRotationZ(k * Math.PI / 2 + 0.4)).multiply(new THREE.Matrix4().makeTranslation(0, -(rt - 0.028), 0))));
    G('dark', blk(r0 - 0.004, r0, rb + 0.004, rt - 0.004, w + 0.004));   // receiver end plate
    G('dark', blk(r0 - 0.2, r0 - 0.15, rb - 0.03, rb - 0.016, 0.012));   // stock adjustment lever
    for (let k = 0; k < 3; k++) G('dark', blk(r0 - 0.235 + k * 0.035, r0 - 0.215 + k * 0.035, rt - 0.03, rt - 0.012, w * 0.86 + 0.004));   // stock side ribs
  }
  if (o.stock === 'ak') G('metal', ext([[r0 - 0.3, rb - 0.08], [r0 - 0.312, rb - 0.08], [r0 - 0.316, rt - 0.03], [r0 - 0.305, rt - 0.03]], w * 0.92, 0.0015));   // steel buttplate
  if (o.stock && o.stock !== 'none' && o.stock !== 'fold') G('metal', place(new THREE.TorusGeometry(0.009, 0.0022, 6, 12), [0, rb - 0.03, -(r0 - 0.1)], [0, Math.PI / 2, 0]));   // sling swivel
  return { iron: o.fsight !== false && !o.scope ? [h1 + 0.045, bv + 0.05] : null, grip: [-0.03, rb - 0.055], fore: [(h0 + h1) / 2 - 0.02, rb - 0.006], mount, charge: [r1 - 0.035, rt - 0.023, w / 2 + 0.02] };
}
// muzzle devices (looks only; the suppressor only makes the gun quieter)
function muzzle(G, kind, bEnd, bv) {
  switch (kind) {
    case 'ak': {   // slant brake: a stepped nut and a cut-away lip on the right
      G('metal', tube(0.0125, bEnd - 0.008, bEnd + 0.012, bv)); G('metal', tube(0.015, bEnd + 0.012, bEnd + 0.045, bv));
      G('dark', blk(bEnd + 0.03, bEnd + 0.046, bv - 0.004, bv + 0.016, 0.022, 0.006)); break;
    }
    case 'bird': {   // A2 birdcage: closed bottom, slots around the top
      G('dark', tube(0.012, bEnd - 0.005, bEnd + 0.012, bv)); G('dark', tube(0.0145, bEnd + 0.012, bEnd + 0.06, bv, 0, 12));
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.6; G('metal', blk(bEnd + 0.022, bEnd + 0.054, -0.002, 0.002, 0.004).applyMatrix4(new THREE.Matrix4().makeTranslation(0, bv, 0).multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeTranslation(0, 0.0145, 0)))); }
      break;
    }
    case 'brake': G('metal', tube(0.02, bEnd, bEnd + 0.08, bv, 0, 8)); G('dark', blk(bEnd + 0.015, bEnd + 0.06, bv - 0.006, bv + 0.006, 0.05)); break;
    case 'sil': case 'suppressor': G('dark', tube(0.024, bEnd, bEnd + 0.2, bv, 0, 14)); G('metal', tube(0.025, bEnd + 0.19, bEnd + 0.2, bv, 0, 14)); break;
    case 'comp': G('dark', tube(0.017, bEnd, bEnd + 0.055, bv, 0, 8)); for (let k = 0; k < 3; k++) G('metal', blk(bEnd + 0.01 + k * 0.014, bEnd + 0.018 + k * 0.014, bv + 0.012, bv + 0.019, 0.012)); break;
    case 'flashhider': G('dark', tube(0.014, bEnd, bEnd + 0.07, bv, 0, 5)); break;
    case 'shroud': G('dark', tube(0.021, bEnd - 0.1, bEnd + 0.07, bv, 0, 10)); break;
    default: break;
  }
}
// optics on the top rail: mount = [u, v] of the rail top. Returns the sight line point [u, v] (for aiming down sights)
function optic(G, kind, mount) {
  const [u, v] = mount;
  G('dark', blk(u - 0.035, u + 0.035, v, v + 0.012, 0.032));
  if (kind === 'reddot') { G('reticle', new THREE.CircleGeometry(0.0013, 18).translate(0, v + 0.036, -(u + 0.0165))); G('optic', CYL(0.019, 0.019, 0.044, 14, true).rotateX(-Math.PI / 2).translate(0, v + 0.036, -u)); G('dark', blk(u - 0.02, u + 0.02, v + 0.012, v + 0.02, 0.026)); G('glass', CYL(0.017, 0.017, 0.002, 14).rotateX(-Math.PI / 2).translate(0, v + 0.036, -(u + 0.018))); return [u, v + 0.036]; }
  if (kind === 'holo') {
    G('optic', blk(u - 0.035, u + 0.035, v + 0.012, v + 0.062, 0.006, 0.026)); G('optic', blk(u - 0.035, u + 0.035, v + 0.012, v + 0.062, 0.006, -0.026));
    G('optic', blk(u - 0.035, u + 0.035, v + 0.056, v + 0.064, 0.058)); G('glass', blk(u + 0.02, u + 0.022, v + 0.014, v + 0.056, 0.046));
    const z = -(u + 0.0195), y = v + 0.036;   // the holographic reticle: a 65 MOA ring, a 1 MOA dot and four ticks
    G('reticle', new THREE.RingGeometry(0.0076, 0.0084, 40).translate(0, y, z)); G('reticle', new THREE.CircleGeometry(0.0006, 12).translate(0, y, z));
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) G('reticle', new THREE.PlaneGeometry(dx ? 0.0022 : 0.0007, dy ? 0.0022 : 0.0007).translate(dx * 0.0069, y + dy * 0.0069, z));
    return [u, y];
  }
  if (kind === 'acog') {
    G('optic', CYL(0.021, 0.021, 0.09, 14, true).rotateX(-Math.PI / 2).translate(0, v + 0.042, -u)); G('optic', CYL(0.026, 0.021, 0.03, 14, true).rotateX(-Math.PI / 2).translate(0, v + 0.042, -(u + 0.06)));
    G('dark', blk(u - 0.015, u + 0.015, v + 0.012, v + 0.03, 0.03)); G('dark', blk(u - 0.01, u + 0.02, v + 0.06, v + 0.072, 0.012)); G('glass', CYL(0.024, 0.024, 0.002, 14).rotateX(-Math.PI / 2).translate(0, v + 0.042, -(u + 0.074))); return [u, v + 0.042];
  }
  return null;
}
function pistol(G, o) {
  const [s0, s1] = o.slide, sb = 0, st = o.sh || 0.034, w = o.w || 0.03, F = o.frame || 'dark';
  G('body', ext([[s0, sb], [s1, sb], [s1, st - 0.006], [s1 - 0.008, st], [s0 + 0.006, st], [s0, st - 0.01]], w));
  for (let k = 0; k < 5; k++) G('dark', blk(s0 + 0.012 + k * 0.009, s0 + 0.016 + k * 0.009, sb + 0.008, st - 0.008, w + 0.002));   // serrations
  G(F, ext([[s0 + 0.01, sb + 0.002], [s1 - 0.01, sb + 0.002], [s1 - 0.012, sb - 0.016], [s0 + 0.08, sb - 0.018], [s0 + 0.05, sb - 0.11], [s0 - 0.005, sb - 0.112], ['q', -0.008 + s0, sb - 0.05, s0 + 0.012, sb - 0.012]], w * 0.95));
  G('metal', guard(s0 + 0.045, s0 + 0.095, sb - 0.05, sb - 0.012, 0.01)); G('metal', blk(s0 + 0.064, s0 + 0.07, sb - 0.04, sb - 0.016, 0.005));
  G('metal', tube(0.0075, s1 - 0.01, s1 + (o.bl || 0.006), st / 2 - 0.002));
  G('dark', blk(s1 - 0.012, s1 - 0.004, st, st + 0.008, 0.006)); G('dark', blk(s0 + 0.004, s0 + 0.014, st, st + 0.008, 0.016));
  if (o.sil) G('dark', tube(0.017, s1 + 0.005, s1 + 0.16, st / 2 - 0.002, 0, 12));
  else if (G.att && G.att.muzzle && G.att.muzzle !== 'standard') muzzle(G, G.att.muzzle, s1 + (o.bl || 0.006), st / 2 - 0.002);
  G('mag|dark', blk(s0 + 0.008, s0 + 0.046, sb - 0.1, sb - 0.03, w * 0.7));   // the magazine inside the grip (drops out on reload)
  G('mag|metal', blk(s0 - 0.002, s0 + 0.05, sb - 0.119, sb - 0.11, w * 0.86));   // its floor plate
  G('grip', ext([[s0 + 0.012, sb - 0.022], [s0 + 0.052, sb - 0.024], [s0 + 0.044, sb - 0.1], [s0 + 0.004, sb - 0.102]], w * 0.95 + 0.004, 0.0015));   // textured grip panels
  G('metal', ext([[s0 - 0.008, st - 0.016], [s0 + 0.004, st - 0.014], [s0 + 0.004, st - 0.002], [s0 - 0.01, st + 0.002]], 0.008, 0.001));   // hammer
  G('dark', blk(s0 + 0.045, s0 + 0.08, sb - 0.004, sb + 0.005, 0.003, w / 2 + 0.0015));      // slide stop
  G('dark', blk(s1 - 0.075, s1 - 0.035, st - 0.0015, st + 0.0007, w * 0.6));                 // ejection port
  G('dark', xpin(s0 + 0.06, sb - 0.012, w + 0.004, 0.0028)); G('dark', xpin(s0 + 0.03, sb - 0.022, w + 0.006, 0.0042));   // takedown pin, mag release
  for (let k = 0; k < 4; k++) G('dark', blk(s1 - 0.04 + k * 0.007, s1 - 0.037 + k * 0.007, sb + 0.01, st - 0.01, w + 0.002));   // front serrations
  for (const x of [-0.0045, 0.0045]) G('dark', blk(s0 + 0.004, s0 + 0.012, st, st + 0.009, 0.005, x));   // rear sight: two ears (a notch between)
  G('dot', place(CYL(0.0011, 0.0011, 0.001, 8), [0.0045, st + 0.0065, -(s0 + 0.0125)], [Math.PI / 2, 0, 0])); G('dot', place(CYL(0.0011, 0.0011, 0.001, 8), [-0.0045, st + 0.0065, -(s0 + 0.0125)], [Math.PI / 2, 0, 0]));
  G('dot', place(CYL(0.0012, 0.0012, 0.001, 8), [0, st + 0.006, -(s1 - 0.0125)], [Math.PI / 2, 0, 0]));   // three white dots
  for (let k = 0; k < 3; k++) G(F, blk(s1 - 0.045 + k * 0.011, s1 - 0.039 + k * 0.011, sb - 0.019, sb - 0.012, w * 0.7));   // accessory rail
  G('metal', tube(0.0035, s1 - 0.004, s1 + 0.002, sb + 0.006));   // recoil spring guide rod
  G('metal', blk(s1 - 0.07, s1 - 0.05, st - 0.012, st - 0.007, 0.002, w / 2 + 0.0008));   // extractor
  G('dark', blk(s0 + 0.066, s0 + 0.068, sb - 0.036, sb - 0.02, 0.002));   // trigger safety blade
  G(F, ext([[s0 - 0.002, sb - 0.012], [s0 - 0.016, sb - 0.008], [s0 - 0.014, sb - 0.016], [s0 + 0.004, sb - 0.026]], w * 0.9, 0.002));   // beavertail
  if (o.mag) G('mag|dark', ext([[s0 + 0.075, sb - 0.016], [s0 + 0.095, sb - 0.016], [s0 + 0.105, sb - (o.mag + 0.02)], [s0 + 0.08, sb - (o.mag + 0.02)]], w * 0.8));
  return { iron: [s1 - 0.008, st + 0.008], grip: [s0 + 0.03, sb - 0.06], fore: null, mount: [s0 + 0.045, st], charge: [s0 + 0.02, st, 0] };
}
R('ak47', (G) => rifle(G, { recv: [-0.12, 0.25, -0.03, 0.03], w: 0.05, top: 'ak', furn: 'wood', hgType: 'ak', hg: [0.25, 0.43], blen: 0.17, muzzle: 'ak', mag: 'curve', stock: 'ak', gripMat: 'wood' }));
R('galil', (G) => rifle(G, { recv: [-0.12, 0.25, -0.03, 0.03], w: 0.05, top: 'ak', hgType: 'ak', hg: [0.25, 0.42], blen: 0.16, muzzle: 'bird', mag: 'curve', stock: 'skel' }));
R('m4a4', (G) => rifle(G, { recv: [-0.11, 0.23, -0.028, 0.032], rail: true, hgType: 'quad', hg: [0.23, 0.45], blen: 0.13, muzzle: 'bird', mag: 'straight', stock: 'm4', railLen: 0.32 }));
R('m4a1s', (G) => rifle(G, { recv: [-0.11, 0.23, -0.028, 0.032], rail: true, hgType: 'round', hgR: 0.027, hg: [0.23, 0.42], blen: 0.05, muzzle: 'sil', mag: 'straight', stock: 'm4', railLen: 0.3 }));
R('famas', (G) => rifle(G, { recv: [-0.36, 0.2, -0.03, 0.035], handle: true, hgType: 'slab', hg: [0.2, 0.32], blen: 0.12, muzzle: 'bird', mag: 'straight', mag0: -0.2, stock: 'none', rear: false, fsight: false }));
R('aug', (G) => rifle(G, { recv: [-0.36, 0.22, -0.035, 0.03], furn: 'olive', hgType: 'round', hgR: 0.022, hg: [0.22, 0.3], blen: 0.16, muzzle: 'bird', mag: 'straight', mag0: -0.22, magMat: 'dark', stock: 'none', scope: [0.0, 0.16], scopeH: 0.05, rear: false, fsight: false }));
R('sg553', (G) => rifle(G, { recv: [-0.11, 0.24, -0.03, 0.032], hgType: 'slab', hg: [0.24, 0.4], blen: 0.12, muzzle: 'bird', mag: 'curve', stock: 'm4', scope: [-0.04, 0.14], rear: false }));
R('awp', (G) => rifle(G, { recv: [-0.08, 0.26, -0.035, 0.03], w: 0.055, furn: 'green', hgType: 'slab', hg: [0.26, 0.5], blen: 0.34, br: 0.012, muzzle: 'brake', mag: 'box', stock: 'thumb', scope: [-0.06, 0.2], scopeH: 0.06, rear: false, fsight: false, bv: 0.004 }));
R('ssg08', (G) => rifle(G, { recv: [-0.08, 0.22, -0.03, 0.028], w: 0.045, hgType: 'slab', hg: [0.22, 0.42], blen: 0.3, br: 0.009, muzzle: 'none', mag: 'box', stock: 'thumb', scope: [-0.05, 0.17], rear: false, fsight: false }));
R('g3sg1', (G) => rifle(G, { recv: [-0.12, 0.26, -0.032, 0.032], hgType: 'slab', hg: [0.26, 0.46], blen: 0.24, muzzle: 'bird', mag: 'straight', stock: 'ak', scope: [-0.06, 0.18], rear: false }));
R('scar20', (G) => rifle(G, { recv: [-0.12, 0.26, -0.032, 0.032], rail: true, hgType: 'quad', hg: [0.26, 0.46], blen: 0.24, muzzle: 'brake', mag: 'straight', stock: 'm4', scope: [-0.06, 0.18], rear: false }));
R('m249', (G) => rifle(G, { recv: [-0.13, 0.25, -0.035, 0.04], w: 0.06, rail: true, hgType: 'slab', hg: [0.25, 0.4], blen: 0.24, muzzle: 'bird', mag: 'mg', mag0: 0.06, stock: 'skel', bipod: true }));
R('negev', (G) => rifle(G, { recv: [-0.13, 0.25, -0.035, 0.04], w: 0.06, hgType: 'round', hgR: 0.03, hg: [0.25, 0.4], blen: 0.22, muzzle: 'bird', mag: 'mg', mag0: 0.06, stock: 'm4', bipod: true }));
R('nova', (G) => { const r = rifle(G, { fsight: false, bead: true, recv: [-0.1, 0.2, -0.03, 0.028], hgType: 'none', hg: [0.2, 0.2], blen: 0.42, br: 0.013, muzzle: 'none', mag: 'none', stock: 'm4', rear: false }); G('dark', tube(0.014, 0.2, 0.55, -0.012)); G('grip', tube(0.024, 0.26, 0.4, -0.012, 0, 10)); r.fore = [0.33, -0.03]; return r; });
R('xm1014', (G) => { const r = rifle(G, { fsight: false, bead: true, recv: [-0.11, 0.22, -0.03, 0.03], rail: true, hgType: 'none', hg: [0.22, 0.22], blen: 0.38, br: 0.013, muzzle: 'none', mag: 'none', stock: 'm4' }); G('dark', tube(0.014, 0.22, 0.56, -0.014)); G('dark', blk(0.22, 0.4, -0.035, 0.01, 0.05)); r.fore = [0.32, -0.04]; return r; });
R('sawedoff', (G) => { const r = rifle(G, { recv: [-0.06, 0.12, -0.03, 0.03], furn: 'wood', gripMat: 'wood', hgType: 'none', hg: [0.12, 0.12], blen: 0.22, br: 0.014, bv: 0.008, muzzle: 'none', mag: 'none', stock: 'none', rear: false }); G('metal', tube(0.014, 0.1, 0.34, -0.018)); G('wood', tube(0.024, 0.13, 0.26, -0.016, 0, 10)); r.fore = [0.2, -0.035]; return r; });
R('mag7', (G) => { const r = rifle(G, { fsight: false, bead: true, recv: [-0.1, 0.2, -0.04, 0.03], w: 0.055, hgType: 'slab', hg: [0.2, 0.3], blen: 0.1, br: 0.014, muzzle: 'none', mag: 'box', mag0: -0.02, stock: 'fold' }); r.fore = [0.25, -0.05]; return r; });
R('mac10', (G) => { pistol(G, { slide: [-0.1, 0.1], sh: 0.06, w: 0.045, bl: 0.03, mag: 0.14 }); return { grip: [-0.06, -0.06], fore: null, mount: [-0.03, 0.06] }; });
R('mp9', (G) => { const r = rifle(G, { recv: [-0.06, 0.16, -0.025, 0.03], w: 0.042, rail: true, hgType: 'none', hg: [0.16, 0.16], blen: 0.04, muzzle: 'none', mag: 'straight', mag0: -0.045, stock: 'fold' }); r.fore = [0.13, -0.03]; return r; });
R('mp7', (G) => { const r = rifle(G, { recv: [-0.08, 0.18, -0.028, 0.03], w: 0.045, rail: true, hgType: 'slab', hg: [0.18, 0.24], blen: 0.05, muzzle: 'none', mag: 'straight', mag0: -0.045, stock: 'fold' }); r.fore = [0.2, -0.03]; return r; });
R('mp5', (G) => rifle(G, { recv: [-0.1, 0.2, -0.028, 0.03], w: 0.045, hgType: 'round', hgR: 0.025, hg: [0.2, 0.32], blen: 0.02, muzzle: 'sil', mag: 'curve', mag0: 0.08, stock: 'm4' }));
R('ump', (G) => rifle(G, { recv: [-0.1, 0.22, -0.035, 0.035], w: 0.05, rail: true, hgType: 'slab', hg: [0.22, 0.32], blen: 0.05, muzzle: 'none', mag: 'straight', mag0: 0.08, stock: 'skel' }));
R('bizon', (G) => { const r = rifle(G, { recv: [-0.1, 0.2, -0.028, 0.03], w: 0.045, top: 'ak', hgType: 'none', hg: [0.2, 0.2], blen: 0.12, muzzle: 'bird', mag: 'none', stock: 'skel' }); G('dark', tube(0.034, 0.05, 0.36, -0.06, 0, 12)); r.fore = [0.28, -0.1]; return r; });
R('p90', (G) => { G('body', ext([[-0.2, -0.06], [0.18, -0.03], [0.2, 0.02], [0.12, 0.05], [-0.18, 0.05], [-0.22, 0.0]], 0.06, 0.008, [[[-0.08, -0.04], [0.0, -0.035], [0.0, -0.01], [-0.08, -0.01]]])); G('mag|dark', blk(-0.16, 0.12, 0.05, 0.065, 0.04)); G('dark', tube(0.009, 0.18, 0.24, 0.0)); if (G.att && G.att.muzzle && G.att.muzzle !== 'standard') muzzle(G, G.att.muzzle, 0.24, 0.0); return { grip: [-0.05, -0.04], fore: [0.1, -0.03], mount: [-0.02, 0.065] }; });
R('glock', (G) => pistol(G, { slide: [-0.08, 0.1] }));
R('usp', (G) => pistol(G, { slide: [-0.08, 0.1], sil: true }));
R('p2000', (G) => pistol(G, { slide: [-0.08, 0.1] }));
R('p250', (G) => pistol(G, { slide: [-0.08, 0.095] }));
R('fiveseven', (G) => pistol(G, { slide: [-0.08, 0.11], sh: 0.036 }));
R('cz75', (G) => pistol(G, { slide: [-0.08, 0.1], mag: 0.03 }));
R('dualies', (G) => pistol(G, { slide: [-0.085, 0.1], frame: 'steel' }));
R('tec9', (G) => { pistol(G, { slide: [-0.09, 0.14], sh: 0.04, w: 0.035, bl: 0.05 }); G('mag|dark', ext([[0.07, -0.01], [0.1, -0.01], [0.105, -0.18], [0.075, -0.18]], 0.03)); return { grip: [-0.06, -0.06], fore: null, mount: [-0.04, 0.04] }; });
R('deagle', (G) => pistol(G, { slide: [-0.1, 0.13], sh: 0.045, w: 0.036, frame: 'steel' }));
R('r8', (G) => { pistol(G, { slide: [-0.08, -0.01], sh: 0.04 }); G('steel', tube(0.024, -0.01, 0.04, 0.02, 0, 10)); G('steel', tube(0.009, 0.04, 0.2, 0.03)); G('steel', blk(0.04, 0.2, 0.034, 0.046, 0.012)); return { grip: [-0.05, -0.06], fore: null, mount: [-0.05, 0.04] }; });
R('zeus', (G) => { G('body', ext([[-0.06, -0.02], [0.1, -0.02], [0.12, 0.02], [-0.05, 0.03]], 0.035, 0.006)); G('dark', ext([[-0.05, -0.02], [-0.02, -0.02], [-0.03, -0.1], [-0.07, -0.1]], 0.03)); G('metal', blk(0.1, 0.13, -0.01, 0.015, 0.025)); return { grip: [-0.045, -0.06], fore: null }; });
const DEFAULT_BODY = { ak47: 'metal', galil: 'dark', awp: 'green', aug: 'olive', famas: 'dark', deagle: 'steel', dualies: 'steel', fiveseven: 'dark', zeus: 'yellow', sawedoff: 'metal', p90: 'dark', r8: 'steel', ssg08: 'dark', mag7: 'dark' };

// first-person arms: a gloved hand at each hold point and a sleeve running back out of view
function vmArm(parts, hand, dir, sleeve, glove, len = 0.55, two = false) {
  const d = new THREE.Vector3(...dir).normalize(), h = new THREE.Vector3(...hand);
  const at = (k) => { const p = h.clone().addScaledVector(d, k); return [p.x, p.y, p.z]; };
  parts.push([span(CAP(0.034, 0.05, 8), at(-0.01), at(0.04)), glove]);                    // hand
  parts.push([place(CAP(0.02, 0.06, 6), [h.x, h.y - 0.01, h.z], [0, 0, Math.PI / 2]), glove]);   // fingers wrapped over
  parts.push([span(CYL(0.04, 0.042, 0.05, 10), at(0.05), at(0.1)), glove]);               // cuff
  parts.push([span(CYL(0.047, 0.062, len, 10), at(0.1), at(0.1 + len)), sleeve]);         // sleeve
  parts.push([span(CYL(0.064, 0.064, 0.03, 10), at(0.1 + len * 0.55), at(0.13 + len * 0.55)), shade(sleeve, 0.8)]);  // seam
  void two;
}
const geoCache = new Map();
export function makeGun(id, tex, sleeve = '#3c4e66', glove = '#2a2a2a', hands = true, att = null) {
  const w = W_BY_ID[id] || { cat: 'pistol' }, recipe = RECIPE[id] || RECIPE[w.cat === 'pistol' ? 'p250' : w.cat === 'smg' ? 'mp7' : w.cat === 'sniper' ? 'ssg08' : w.cat === 'heavy' ? 'nova' : 'm4a4'];
  const opt = att && att.optic && att.optic !== 'iron' && !w.zoom ? att.optic : null, mz = att && att.muzzle && att.muzzle !== 'standard' && !w.silenced ? att.muzzle : null;
  const ckey = `${id}|${opt || ''}|${mz || ''}`;
  let cg = geoCache.get(ckey);
  if (!cg) {
    const buckets = {}, G = (k, g) => { if (g) (buckets[k] = buckets[k] || []).push([g, null]); };
    G.att = { muzzle: mz };
    const hold = recipe(G);
    if (opt && hold.mount) hold.sight = optic(G, opt, hold.mount);
    const geos = {};
    let box = null;
    for (const [k, list] of Object.entries(buckets)) { geos[k] = merge(list); geos[k].computeBoundingBox(); if (k === 'body') box = geos[k].boundingBox; }
    if (box && geos.body) {   // the skin wraps the whole gun side-on (u along the barrel, v up)
      const p = geos.body.attributes.position, uv = geos.body.attributes.uv, du = box.max.z - box.min.z || 1, dv = box.max.y - box.min.y || 1;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (box.max.z - p.getZ(i)) / du, (p.getY(i) - box.min.y) / dv);
    }
    if (geos.wood) { const p = geos.wood.attributes.position, uv = geos.wood.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, -p.getZ(i) * 3, p.getY(i) * 3 + p.getX(i) * 3); }
    let len = 0; for (const g of Object.values(geos)) { g.computeBoundingBox(); len = Math.max(len, -g.boundingBox.min.z); }
    if (hold.iron && !opt) {   // iron sights, R6-style: a raised sight line over the gun, a front post and (long guns) a rear aperture ring
      const fz = -hold.iron[0]; let top = hold.iron[1];
      for (const [k, g] of Object.entries(geos)) { if (k.startsWith('mag|')) continue; const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 0.012 && p.getZ(i) > fz + 0.03) top = Math.max(top, p.getY(i)); }
      const long = !!hold.fore, line = top + (long ? 0.026 : 0.004), parts = [];
      parts.push([blk(hold.iron[0] - 0.003, hold.iron[0] + 0.003, hold.iron[1] - 0.012, line, 0.003), null]);                       // front post
      if (long) {
        parts.push([blk(hold.iron[0] - 0.006, hold.iron[0] + 0.006, line - 0.012, line - 0.009, 0.026), null]);                       // post wings
        const ur = Math.max(hold.grip[0] - 0.015, hold.iron[0] - 0.24);   // 10-15 cm in front of the eye when aimed in
        parts.push([new THREE.TorusGeometry(0.0075, 0.0022, 6, 16).translate(0, line, -ur), null]);                                 // rear aperture
        let base = -1;   // the stand reaches down to whatever is right under the ring (receiver, rail or dust cover)
        for (const [k, g2] of Object.entries(geos)) { if (k.startsWith('mag|')) continue; const p = g2.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 0.014 && Math.abs(p.getZ(i) + ur) < 0.012 && p.getY(i) < line - 0.01) base = Math.max(base, p.getY(i)); }
        if (base < -0.5) base = top - 0.004;
        parts.push([blk(ur - 0.006, ur + 0.006, base - 0.002, line - 0.006, 0.008), null]);                                            // its stand
        parts.push([blk(ur - 0.012, ur + 0.012, base - 0.002, base + 0.004, 0.02), null]);                                             // clamped to the gun
      }
      geos.ironpost = merge(parts); hold.iron = [hold.iron[0], line];
    }
    cg = { geos, hold, len };
    geoCache.set(ckey, cg);
  }
  const g = new THREE.Group(), magGroup = new THREE.Group(); g.add(magGroup);
  for (const [k, geo] of Object.entries(cg.geos)) {
    if (k.startsWith('mag|')) { magGroup.add(new THREE.Mesh(geo, gm(k.slice(4)))); continue; }
    g.add(new THREE.Mesh(geo, k === 'body' ? (tex ? paintMat(tex) : gm(DEFAULT_BODY[id] || 'dark')) : gm(k === 'ironpost' ? 'dark' : k)));
  }
  const magBox = new THREE.Box3().setFromObject(magGroup), magPos = magGroup.children.length ? magBox.getCenter(new THREE.Vector3()) : null;
  const grip = new THREE.Vector3(0, cg.hold.grip[1], -cg.hold.grip[0]), fore = cg.hold.fore ? new THREE.Vector3(0, cg.hold.fore[1], -cg.hold.fore[0]) : null;
  let leftArm = null, leftHand = null;
  if (hands) {   // right arm on the grip; the left (support) arm is its own piece so reloads can move it
    const parts = [], lp = [];
    vmArm(parts, [grip.x + 0.005, grip.y + 0.005, grip.z + 0.01], [0.38, -0.5, 0.78], sleeve, glove, 0.6);
    leftHand = fore ? new THREE.Vector3(fore.x - 0.012, fore.y - 0.012, fore.z) : new THREE.Vector3(grip.x - 0.025, grip.y - 0.02, grip.z + 0.015);
    vmArm(lp, leftHand.toArray(), fore ? [-0.55, -0.42, 0.72] : [-0.5, -0.5, 0.7], sleeve, glove, fore ? 0.7 : 0.6);
    g.add(new THREE.Mesh(merge(parts), armMat()));
    leftArm = new THREE.Group(); leftArm.add(new THREE.Mesh(merge(lp), armMat())); g.add(leftArm);
    if (w.shellReload) { const sh = new THREE.Mesh(place(CYL(0.011, 0.011, 0.06, 8), leftHand.toArray(), [Math.PI / 2, 0, 0]), lam('#b8221e')); sh.visible = false; leftArm.add(sh); leftArm.userData.shell = sh; }
  }
  g.add(muzzleFlash(cg.len + (w.silenced ? 0.04 : 0.02), w.cat === 'pistol' ? 0.6 : 1));
  const ch = cg.hold.charge;
  g.userData = { magGroup: magGroup.children.length ? magGroup : null, magPos, leftArm, leftHand, charge: ch ? new THREE.Vector3(ch[2], ch[1], -ch[0]) : null, flash: g.children[g.children.length - 1], len: cg.len, grip, fore, sight: cg.hold.sight ? new THREE.Vector3(0, cg.hold.sight[1], -cg.hold.sight[0]) : null, optic: opt, iron: !opt && cg.hold.iron ? new THREE.Vector3(0, cg.hold.iron[1], -cg.hold.iron[0]) : null };
  return g;
}
let armMatC = null;
const armMat = () => armMatC || (armMatC = HQ ? gunSurface(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.92, envMapIntensity: 0.5 }), 'gpoly', { tile: 34, normal: 1.4, albedo: 1.2, rough: 0.2 }) : new THREE.MeshLambertMaterial({ vertexColors: true }));   // woven sleeve / glove fabric
let flashTex = null;
function muzzleFlash(z, k = 1) {
  if (!flashTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,220,120,.9)'); gr.addColorStop(0.6, 'rgba(255,140,40,.35)'); gr.addColorStop(1, 'rgba(255,100,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,230,160,.8)'; x.lineWidth = 3; for (let a = 0; a < 6; a++) { x.beginPath(); x.moveTo(32, 32); x.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); x.stroke(); }
    flashTex = new THREE.CanvasTexture(c);
  }
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const a = new THREE.Mesh(new THREE.PlaneGeometry(0.16 * k, 0.16 * k), m); g.add(a);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(0.1 * k, 0.26 * k), m); b.rotation.y = Math.PI / 2; b.position.z = -0.08 * k; g.add(b);
  const c2 = b.clone(); c2.rotation.set(0, Math.PI / 2, Math.PI / 2); g.add(c2);
  g.position.set(0, 0.006, -z); g.visible = false;
  return g;
}

// ---- knives ---------------------------------------------------------------------------------------------------------
export function makeKnife(knifeId, tex, sleeve = '#3c4e66', glove = '#2a2a2a', hands = true) {
  const k = KNIFE_BY_ID[knifeId], model = k ? k.model : 'default', g = new THREE.Group();
  const buckets = {}, G = (key, geo) => { (buckets[key] = buckets[key] || []).push([geo, null]); };
  const paintKey = tex ? 'body' : null;
  // a blade with a real grind: full thickness along the spine (v >= full), thinning to an edge at v = edge
  const blade = (pts, thick, edge, full) => {
    const geo = ext(pts, thick, 0.0007), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (p.getY(i) - edge) / ((full - edge) || 1))); p.setX(i, p.getX(i) * (0.12 + 0.88 * t)); }
    geo.computeVertexNormals(); return geo;
  };
  const pin = (u, v, len = 0.03) => place(CYL(0.0028, 0.0028, len, 8), [0, v, -u], [0, 0, Math.PI / 2]);
  const guardAndHandle = (w, len, hook) => {   // a folder's handle: two scales, steel liners, pins, a bolster and a clip
    G('steelk', ext([[-0.014, -0.016], [0.004, -0.015], [0.004, 0.017], [-0.014, 0.017]], w, 0.002));   // bolster
    G('gripk', ext([[-len, -0.014], ['q', -len * 0.5, -0.019, -0.014, -0.015], [-0.014, 0.017], ['q', -len * 0.5, 0.019, -len, 0.015], ['q', -len - 0.008, 0, -len, -0.014]], w - 0.002, 0.0025));
    for (const x of [-(w / 2 - 0.0035), w / 2 - 0.0035]) G('steelk', ext([[-len + 0.004, -0.013], [-0.014, -0.014], [-0.014, 0.016], [-len + 0.004, 0.014]], 0.0016, 0).translate(x, 0, 0));
    for (const u of [-0.03, -len * 0.55, -len + 0.012]) G('steelk', pin(u, 0, w + 0.002));
    G('steelk', blk(-len + 0.006, -len * 0.45, 0.004, 0.009, 0.0016, w / 2 + 0.0015));                    // pocket clip
    if (hook) G('darkk', pin(0.005, 0.012, w * 0.6));
  };
  switch (model) {
    case 'hotdog': G('bun', place(CAP(0.042, 0.3, 10), [0, -0.012, -0.15], [Math.PI / 2, 0, 0], [1.3, 1, 0.75])); G(paintKey || 'sausage', place(CAP(0.026, 0.36, 10), [0, 0.022, -0.15], [Math.PI / 2, 0, 0])); for (let i = 0; i < 6; i++) G('mustard', place(BOX(0.04, 0.006, 0.012), [i % 2 ? 0.008 : -0.008, 0.048, -0.02 - i * 0.05], [0, i % 2 ? 0.6 : -0.6, 0])); break;
    case 'dildo': break;   // built below as a jointed, springy shaft
    case 'plunger': G('woodk', place(CYL(0.012, 0.012, 0.5, 8), [0, 0, -0.12], [Math.PI / 2, 0, 0])); G(paintKey || 'red', place(SPH(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0, -0.38], [-Math.PI / 2, 0, 0], [1, 0.8, 1])); break;
    case 'chicken': G(paintKey || 'yellowk', place(SPH(0.05, 12, 9), [0, 0.02, -0.14], [0, 0, 0], [1, 1.1, 2.3])); G(paintKey || 'yellowk', place(CYL(0.018, 0.022, 0.12, 8), [0, 0.07, -0.28], [0.6, 0, 0])); G(paintKey || 'yellowk', place(SPH(0.03, 10, 8), [0, 0.11, -0.32])); G('orange', place(new THREE.ConeGeometry(0.012, 0.04, 6), [0, 0.105, -0.355], [-Math.PI / 2, 0, 0])); G('red', place(BOX(0.006, 0.03, 0.04), [0, 0.14, -0.32])); break;
    case 'baguette': G(paintKey || 'bread', place(CAP(0.034, 0.52, 10), [0, 0.02, -0.2], [Math.PI / 2 + 0.05, 0, 0], [1, 1, 0.85])); for (let i = 0; i < 5; i++) G('crust', place(BOX(0.05, 0.006, 0.014), [0, 0.052, -0.04 - i * 0.09], [0, 0.7, 0])); break;
    case 'fish': G(paintKey || 'salmon', place(SPH(0.06, 12, 9), [0, 0.02, -0.15], [0, 0, 0], [0.4, 1, 3])); G(paintKey || 'salmon2', ext([[0.0, 0.0], [-0.08, 0.06], [-0.08, -0.06]], 0.01, 0.002).translate(0, 0.02, 0.04)); G('eyek', place(SPH(0.01, 6, 4), [0.022, 0.035, -0.29])); break;
    case 'banana': { const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0.02), new THREE.Vector3(0, 0.1, -0.18), new THREE.Vector3(0, 0.0, -0.4)); G(paintKey || 'yellowk', new THREE.TubeGeometry(curve, 12, 0.026, 8)); G('brown', place(CYL(0.01, 0.014, 0.04, 6), [0, 0.0, 0.03], [Math.PI / 2, 0, 0])); break; }
    // the real knives: ground blades (thick spine thinning to a sharp edge), fullers, sawbacks, guards, handle scales
    // with pins and liners, finger rings: shaped after the classic patterns, at real sizes
    case 'karambit': {
      G(paintKey || 'blade', blade([[0, 0.012], ['q', 0.07, 0.045, 0.15, 0.006], ['q', 0.175, -0.012, 0.17, -0.042], ['q', 0.13, -0.004, 0.06, -0.008], ['q', 0.02, -0.01, 0, -0.012]], 0.0055, -0.03, 0.02));
      G('gripk', ext([[-0.105, -0.016], ['q', -0.05, -0.024, 0, -0.014], [0, 0.015], ['q', -0.05, 0.022, -0.105, 0.014]], 0.02, 0.002));
      for (const x of [-0.0105, 0.0105]) G('steelk', ext([[-0.104, -0.014], ['q', -0.05, -0.022, 0, -0.012], [0, 0.013], ['q', -0.05, 0.02, -0.104, 0.012]], 0.0015, 0).translate(x, 0, 0));   // liners
      for (const u of [-0.02, -0.06, -0.09]) G('steelk', pin(u, 0));
      G('steelk', place(new THREE.TorusGeometry(0.019, 0.0055, 8, 18), [0, 0, 0.125], [0, Math.PI / 2, 0]));
      G('gripk', place(new THREE.TorusGeometry(0.019, 0.0085, 8, 18), [0, 0, 0.125], [0, Math.PI / 2, 0], [0.75, 1, 1]));
      break;
    }
    case 'gut': {
      G(paintKey || 'blade', blade([[0, -0.016], [0.15, -0.014], ['q', 0.2, -0.008, 0.212, 0.008], ['q', 0.2, 0.016, 0.175, 0.016], ['q', 0.165, 0.004, 0.15, 0.012], ['q', 0.14, 0.02, 0.12, 0.02], [0, 0.02]], 0.0055, -0.016, 0.004));
      G('darkk', blk(0.02, 0.11, 0.008, 0.011, 0.006));                                      // fuller
      guardAndHandle(0.026, 0.11, true);
      break;
    }
    case 'butterfly': {
      G(paintKey || 'blade', blade([[0, -0.013], [0.155, -0.011], ['q', 0.2, -0.004, 0.205, 0.007], ['q', 0.185, 0.011, 0.15, 0.012], [0.1, 0.016], [0, 0.016]], 0.005, -0.013, 0.006));
      for (const x of [-0.0095, 0.0095]) {                                                    // two channel handles with skeleton cut-outs
        G('steelk', ext([[-0.135, -0.015], [0, -0.015], ['q', 0.006, 0, 0, 0.013], [-0.135, 0.013], ['q', -0.141, -0.001, -0.135, -0.015]], 0.011, 0.0015,
          [[[-0.118, -0.007], [-0.075, -0.007], [-0.075, 0.005], [-0.118, 0.005]], [[-0.062, -0.007], [-0.018, -0.007], [-0.018, 0.005], [-0.062, 0.005]]]).translate(x, 0, 0));
      }
      G('steelk', pin(-0.006, -0.008, 0.032)); G('steelk', pin(-0.006, 0.008, 0.032));        // pivot pins
      G('darkk', blk(-0.142, -0.132, -0.01, 0.008, 0.026));                                    // latch
      break;
    }
    case 'bayonet': {
      G(paintKey || 'blade', blade([[0, -0.018], [0.2, -0.016], ['q', 0.255, -0.01, 0.272, 0.006], [0.215, 0.012], [0.13, 0.02], [0, 0.02]], 0.0058, -0.018, 0.004));
      G('darkk', blk(0.015, 0.15, 0.007, 0.0105, 0.0064));                                    // fuller
      for (let i = 0; i < 9; i++) G(paintKey || 'blade', ext([[0.03 + i * 0.011, 0.0195], [0.0355 + i * 0.011, 0.027], [0.041 + i * 0.011, 0.0195]], 0.004, 0));   // sawback
      G('steelk', ext([[-0.013, -0.036], [0, -0.034], [0, 0.03], [-0.013, 0.03]], 0.024, 0.002));          // crossguard
      G('steelk', place(new THREE.TorusGeometry(0.011, 0.004, 6, 14), [0, 0.042, 0.007], [0, Math.PI / 2, 0]));   // muzzle ring
      G('gripk', ext([[-0.125, -0.017], ['q', -0.07, -0.021, -0.013, -0.018], [-0.013, 0.019], ['q', -0.07, 0.022, -0.125, 0.018]], 0.027, 0.003));
      for (let i = 0; i < 7; i++) G('darkk', blk(-0.115 + i * 0.014, -0.111 + i * 0.014, -0.0185, 0.02, 0.0285));   // grip ribs
      G('steelk', ext([[-0.142, -0.016], [-0.124, -0.018], [-0.124, 0.019], [-0.142, 0.016]], 0.03, 0.003)); G('darkk', pin(-0.134, 0, 0.032));   // pommel
      break;
    }
    case 'huntsman': {
      G(paintKey || 'blade', blade([[0, -0.02], [0.2, -0.019], ['q', 0.26, -0.012, 0.28, 0.006], [0.225, 0.014], ['q', 0.17, 0.02, 0.13, 0.022], [0, 0.022]], 0.006, -0.02, 0.006));
      for (let i = 0; i < 8; i++) G(paintKey || 'blade', ext([[0.02 + i * 0.012, 0.0215], [0.026 + i * 0.012, 0.029], [0.032 + i * 0.012, 0.0215]], 0.0042, 0));
      G('darkk', blk(0.01, 0.16, 0.006, 0.0095, 0.0066));
      G('steelk', ext([[-0.012, -0.04], [0, -0.038], [0, 0.034], [-0.012, 0.03]], 0.026, 0.002));
      G('gripk', ext([[-0.13, -0.017], ['q', -0.11, -0.025, -0.095, -0.018], ['q', -0.08, -0.025, -0.065, -0.018], ['q', -0.05, -0.025, -0.035, -0.018], ['q', -0.022, -0.024, -0.012, -0.02], [-0.012, 0.02], [-0.13, 0.017]], 0.028, 0.003));   // finger grooves
      for (const u of [-0.03, -0.075, -0.115]) G('steelk', pin(u, 0, 0.03));
      G('steelk', ext([[-0.146, -0.016], [-0.129, -0.018], [-0.129, 0.019], [-0.146, 0.016]], 0.03, 0.003));
      break;
    }
    default: {   // a folding flipper: drop point, thumb stud, scales, liners, pins and a pocket clip
      G(paintKey || 'blade', blade([[0, -0.014], [0.15, -0.012], ['q', 0.205, -0.004, 0.215, 0.012], ['q', 0.16, 0.02, 0.05, 0.019], [0, 0.018]], 0.005, -0.014, 0.006));
      G('steelk', pin(0.022, 0.011, 0.016));                                                    // thumb stud
      guardAndHandle(0.024, 0.11, false);
      break;
    }
  }
  const KC = { bun: '#e0a85a', sausage: '#b8402a', mustard: '#f2d33c', pink: '#ff4ad2', pink2: '#e030b8', woodk: '#8a5a2a', red: '#b8221e', yellowk: '#f2d33c', orange: '#e8702a', bread: '#d8a050', crust: '#9a6024', salmon: '#e8806a', salmon2: '#c8604a', eyek: '#111', brown: '#5a3a1a', gripk: '#26221f', steelk: '#8a9098', darkk: '#2a2c30' };
  for (const [key, list] of Object.entries(buckets)) {
    const geo = merge(list);
    if (key === 'body' || key === 'blade') { geo.computeBoundingBox(); const b = geo.boundingBox, p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (b.max.z - p.getZ(i)) / ((b.max.z - b.min.z) || 1), (p.getY(i) - b.min.y) / ((b.max.y - b.min.y) || 1)); }
    const mt = key === 'body' ? paintMat(tex) : key === 'blade' ? gm('blade') : key === 'steelk' ? gm('steel') : key === 'gripk' ? gm('grip') : (HQ ? new THREE.MeshPhongMaterial({ color: KC[key] || '#888', shininess: key === 'pink' || key === 'pink2' ? 70 : 20, specular: '#444' }) : lam(KC[key] || '#888'));
    g.add(new THREE.Mesh(geo, mt));
  }
  const grip = new THREE.Vector3(0, 0, 0.06);
  let flop = null, strokeHand = null;
  if (model === 'dildo') {   // a chain of soft segments on springs (game.js swings them), balls at the base, glossy
    const mt = tex ? paintMat(tex) : (HQ ? new THREE.MeshPhongMaterial({ color: '#ff4ad2', shininess: 90, specular: '#ffd0f0' }) : lam('#ff4ad2'));
    const base = new THREE.Group(); base.position.set(0, 0.02, -0.03); g.add(base);
    base.add(new THREE.Mesh(place(SPH(0.034, 12, 9), [-0.026, -0.02, 0.03]), mt), new THREE.Mesh(place(SPH(0.034, 12, 9), [0.026, -0.02, 0.03]), mt));
    flop = []; let parent = base; const N = 5, seg = 0.066;
    for (let i = 0; i < N; i++) {
      const j = new THREE.Group(); j.position.z = i ? -seg : 0; parent.add(j);
      const r0 = 0.03 - i * 0.0015;
      j.add(new THREE.Mesh(place(CAP(r0, seg, 12), [0, 0, -seg / 2], [Math.PI / 2, 0, 0]), mt));   // capsules overlap at the joints: one smooth shaft
      if (i === N - 1) j.add(new THREE.Mesh(place(SPH(0.036, 14, 10), [0, 0, -seg - 0.012], [0, 0, 0], [1, 1, 1.25]), mt), new THREE.Mesh(place(CYL(0.037, 0.037, 0.012, 14), [0, 0, -seg + 0.006], [Math.PI / 2, 0, 0]), mt));
      flop.push(j); parent = j;
    }
    if (hands) {   // the stroking hand for the inspect, hidden until then
      const P = []; vmArm(P, [0, 0, 0], [-0.35, -0.7, 0.62], sleeve, glove, 0.32);
      strokeHand = new THREE.Mesh(merge(P), armMat()); strokeHand.visible = false; strokeHand.position.set(-0.004, 0.02, -0.08); g.add(strokeHand);
    }
  }
  if (hands) { const parts = []; vmArm(parts, [0, -0.005, 0.05], [0.35, -0.5, 0.78], sleeve, glove, 0.6); g.add(new THREE.Mesh(merge(parts), armMat())); }
  g.userData = { flash: null, len: 0.3, grip, fore: null, flop, strokeHand };
  return g;
}

// ---- grenades and the bomb ------------------------------------------------------------------------------------------
// the Finger Gun skin: a bare hand doing finger guns (index out as the barrel, thumb up as the hammer, the rest curled)
export function makeFingerGun(sleeve = '#3c4e66', skin = '#d9a77e') {
  const P = [], g = new THREE.Group();
  P.push([place(SPH(0.03, 14, 10), [0, -0.005, 0.0], [0, 0, 0], [0.75, 0.95, 1.25]), skin]);                       // palm
  P.push([span(CAP(0.0085, 0.05, 10), [0, 0.012, -0.03], [0, 0.016, -0.1]), skin]);                                  // index finger, pointed
  P.push([span(CAP(0.0075, 0.012, 8), [0, 0.016, -0.1], [0, 0.014, -0.118]), skin]);                                 // its tip
  P.push([span(CAP(0.009, 0.028, 10), [0.008, 0.02, -0.005], [0.01, 0.05, -0.02]), skin]);                           // thumb up: the hammer
  for (let k = 0; k < 3; k++) P.push([place(new THREE.TorusGeometry(0.012, 0.0075, 8, 12, Math.PI * 1.25), [0, -0.012 - k * 0.0165, -0.03], [0, Math.PI / 2, -0.4]), skin]);   // curled fingers
  P.push([place(SPH(0.003, 8, 6), [0, 0.0235, -0.112], [0, 0, 0], [1.6, 0.6, 1.2]), '#f0d2c0']);                     // fingernail
  vmArm(P, [0, -0.02, 0.035], [0.38, -0.5, 0.78], sleeve, skin, 0.6);
  g.add(new THREE.Mesh(merge(P), HQ ? gunSurface(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.62, envMapIntensity: 0.4 }), 'gpoly', { tile: 60, normal: 0.5, albedo: 0.4 }) : new THREE.MeshLambertMaterial({ vertexColors: true })));
  const flash = new THREE.Object3D(); flash.visible = false; g.add(flash);   // no muzzle flash: it's a finger
  g.userData = { magGroup: null, magPos: null, leftArm: null, leftHand: null, charge: null, flash, len: 0.12, grip: new THREE.Vector3(0, -0.02, 0.035), fore: null, sight: null, optic: null, iron: new THREE.Vector3(0, 0.026, -0.112) };
  return g;
}

// grenades and the bomb: built part by part in real finishes (painted steel, spoon and pin, glass and cloth, tape)
const NADE = { he: '#46502e', flash: '#7d8188', smoke: '#3e4a36', molotov: '#3a6a34', incendiary: '#6a6e72', decoy: '#8a8a4a' };
function partsGroup(B) {
  const g = new THREE.Group();
  for (const [k, list] of Object.entries(B)) {
    const geo = merge(list.map((x) => [x, null]));
    const mt = k.startsWith('#') ? (HQ ? (() => { const m = new THREE.MeshStandardMaterial({ color: k, metalness: 0.15, roughness: 0.6 }); return gunSurface(m, 'gpaint', { wear: 0.7 }); })() : lam(k)) : gm(k);
    g.add(new THREE.Mesh(geo, mt));
  }
  return g;
}
const paintMatCache = new Map();
export function makeGrenade(type, sleeve = '#3c4e66', glove = '#2a2a2a', hands = false) {
  const B = {}, A = (k, geo) => (B[k] = B[k] || []).push(geo), col = NADE[type] || '#555', body = col;
  const fuze = () => {   // the fuze, its spoon (lever) along the body and the pull ring
    A('steel', place(CYL(0.011, 0.014, 0.018, 12), [0, 0.06, 0])); A('steel', place(CYL(0.009, 0.009, 0.01, 12), [0, 0.073, 0]));
    A('steel', ext([[-0.004, 0.07], [0.004, 0.07], [0.006, 0.052], ['q', 0.012, 0.0, 0.004, -0.045], [-0.002, -0.044], ['q', 0.006, 0.0, -0.002, 0.05]], 0.012, 0.001).translate(0, 0, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(-Math.PI / 2)).translate(0.03, 0, 0));
    A('steel', place(new THREE.TorusGeometry(0.012, 0.0022, 8, 18), [-0.016, 0.066, 0], [0, Math.PI / 2, 0]));
    A('steel', place(CYL(0.0016, 0.0016, 0.03, 6), [-0.006, 0.066, 0], [0, 0, Math.PI / 2]));
  };
  if (type === 'he') {   // M67 style: a smooth steel ball with a fuze collar
    A(body, place(SPH(0.034, 20, 14), [0, 0, 0], [0, 0, 0], [1, 1.08, 1])); A(body, place(CYL(0.016, 0.02, 0.012, 16), [0, 0.042, 0]));
    A('#c8b45a', place(CYL(0.0345, 0.0345, 0.004, 24), [0, 0.008, 0]));   // yellow identification band
    fuze();
  } else if (type === 'molotov') {   // a glass bottle with fuel inside and a rag stuffed in the neck
    A('bottle', new THREE.LatheGeometry([[0, -0.075], [0.03, -0.075], [0.034, -0.068], [0.035, 0.015], ['n'], [0.02, 0.04], [0.013, 0.052], [0.013, 0.07], [0.015, 0.074], [0, 0.074]].filter((p) => p[0] !== 'n').map(([x, y]) => new THREE.Vector2(x, y)), 18));
    A('fuel', place(CYL(0.031, 0.031, 0.06, 18), [0, -0.042, 0]));
    A('rag', place(CYL(0.012, 0.009, 0.05, 8), [0.002, 0.085, 0], [0, 0, 0.18])); A('rag', place(SPH(0.016, 8, 6), [0.008, 0.112, 0], [0.4, 0, 0.6], [1, 0.7, 1.2]));
  } else {   // cylinders: flashbang (M84, holes), smoke (M18, green with a band), incendiary, decoy
    const h = type === 'decoy' ? 0.085 : 0.11, r = type === 'flash' ? 0.024 : 0.031;
    A(body, place(CYL(r, r, h, 18), [0, 0, 0])); A('steel', place(CYL(r + 0.001, r + 0.001, 0.006, 18), [0, h / 2 - 0.003, 0])); A('steel', place(CYL(r + 0.001, r + 0.001, 0.006, 18), [0, -h / 2 + 0.003, 0]));
    if (type === 'flash') for (let row = 0; row < 3; row++) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + row * 0.39; A('dark', place(CYL(0.0035, 0.0035, 0.004, 8), [Math.cos(a) * r, -0.03 + row * 0.03, Math.sin(a) * r], [0, -a, Math.PI / 2])); }
    if (type === 'smoke') { A('#d8d0b0', place(CYL(r + 0.0005, r + 0.0005, 0.018, 18), [0, 0.012, 0])); for (let k = 0; k < 4; k++) A('dark', place(CYL(0.003, 0.003, 0.003, 8), [Math.cos(k * 1.57) * 0.015, h / 2, Math.sin(k * 1.57) * 0.015])); }
    if (type === 'incendiary') A('#8a2a1e', place(CYL(r + 0.0005, r + 0.0005, 0.012, 18), [0, 0.02, 0]));
    if (type === 'decoy') A('#2a2a2a', place(CYL(r + 0.0005, r + 0.0005, 0.02, 18), [0, 0.0, 0]));
    fuze();
  }
  const g = partsGroup(B);
  if (hands) { const P = []; vmArm(P, [0.0, -0.02, 0.04], [0.35, -0.5, 0.78], sleeve, glove, 0.6); g.add(new THREE.Mesh(merge(P), armMat())); }
  g.userData = { flash: null, grip: new THREE.Vector3(0, 0, 0), fore: null };
  return g;
}
export function makeBomb(sleeve = '#3c4e66', glove = '#2a2a2a', hands = false) {
  const B = {}, A = (k, geo) => (B[k] = B[k] || []).push(geo);
  for (let k = 0; k < 4; k++) A('putty', blk(-0.125, 0.125, 0.014, 0.058, 0.062, -0.099 + k * 0.066));   // four wrapped charges, side by side
  for (const z of [-0.085, 0.0, 0.085]) A('tape', place(BOX(0.27, 0.05, 0.022), [0, 0.036, z]));   // black tape bands round them
  A('dark', blk(-0.05, 0.05, 0.058, 0.086, 0.12));   // the control box on top
  A('metal', place(BOX(0.078, 0.003, 0.032), [0, 0.0868, -0.025])); A('lcd', place(BOX(0.07, 0.002, 0.024), [0, 0.0878, -0.025]));   // display + bezel
  for (let i = 0; i < 12; i++) A('tape', blk(-0.0055, 0.0055, 0.086, 0.09, 0.012, -0.022 + (i % 3) * 0.022).translate(0, 0, -(0.0 + Math.floor(i / 3) * 0.0125) + 0.002));   // rubber keypad
  A('metal', place(CYL(0.005, 0.005, 0.03, 12), [0.05, 0.1, 0.035]));   // antenna stub
  for (let k = 0; k < 3; k++) A(['wireR', 'wireB', 'wireY'][k], new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.06, 0.075, -0.035 + k * 0.012), new THREE.Vector3(-0.085, 0.082, -0.03 + k * 0.01), new THREE.Vector3(-0.12, 0.062, -0.02 + k * 0.012), new THREE.Vector3(-0.11 + k * 0.03, 0.06, 0.045)]), 16, 0.0026, 6));
  const g = partsGroup(B);
  if (hands) { const P = []; vmArm(P, [0.11, 0.0, 0.08], [0.4, -0.5, 0.75], sleeve, glove, 0.6); vmArm(P, [-0.11, 0.0, 0.08], [-0.4, -0.5, 0.75], sleeve, glove, 0.6); g.add(new THREE.Mesh(merge(P), armMat())); }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), basic('#f00')); led.position.set(0.045, 0.09, -0.048); g.add(led);
  g.userData = { led, flash: null, grip: new THREE.Vector3(0.1, 0, 0.06), fore: null };
  return g;
}

// ---- map props (one merged mesh each, lit by the baked sun) ---------------------------------------------------------
let propMatC = null, leafMatC = null;
const propMat = () => propMatC || (propMatC = litPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), 'dyn'));
const leafMat = () => leafMatC || (leafMatC = litPatch(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'dyn'));
function frond(len, a, tilt) {   // a palm frond: a bent, tapering leaf strip
  const g = new THREE.PlaneGeometry(len, 0.5, 8, 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + len / 2, k = x / len, y = p.getY(i) * (1 - k * 0.8) * (0.4 + Math.sin(k * Math.PI) * 0.8); p.setXYZ(i, x, -k * k * len * 0.45 + Math.abs(y) * 0.25, y); }
  g.rotateX(0); g.rotateZ(tilt); g.rotateY(a); g.computeVertexNormals(); return g;
}
export function makeProp(p) {
  const g = new THREE.Group(), P = [], L = [];
  switch (p.type) {
    case 'palm': {
      let x = 0, y = 0; const lean = 0.06;
      for (let k = 0; k < 6; k++) { const nx = x + lean * k * 0.25, ny = y + 0.85; P.push([span(CYL(0.13 - k * 0.012, 0.15 - k * 0.012, 0.9, 8), [x, y, 0], [nx, ny, 0]), k % 2 ? '#7a5e40' : '#6e5438']); x = nx; y = ny; }
      for (let k = 0; k < 9; k++) L.push([frond(2.6, k * 0.7 + 0.3, 0.25 + (k % 3) * 0.12).translate(x, y, 0), k % 2 ? '#4a7a32' : '#3e6a2a']);
      P.push([place(SPH(0.16, 8, 6), [x, y + 0.02, 0]), '#5a4a2a']); break;
    }
    case 'tree': P.push([place(CYL(0.13, 0.2, 2.4, 8), [0, 1.2, 0]), '#5e4430']); for (const [dx, dy, dz, r] of [[0, 3.2, 0, 1.3], [0.7, 2.7, 0.3, 0.9], [-0.6, 2.8, -0.4, 0.95], [0.1, 3.9, 0.2, 0.8]]) P.push([place(new THREE.IcosahedronGeometry(r, 1), [dx, dy, dz]), dy > 3.5 ? '#4a8a3a' : '#3a7230']); break;
    case 'goat': P.push([place(CAP(0.2, 0.45, 8), [0, 0.78, 0], [0, 0, Math.PI / 2], [1, 1, 0.85]), '#e8e4d8']); for (const [x, z] of [[-0.3, -0.12], [0.3, -0.12], [-0.3, 0.12], [0.3, 0.12]]) P.push([place(CYL(0.035, 0.03, 0.55, 6), [x, 0.28, z]), '#d8d0c0'], [place(CYL(0.04, 0.04, 0.05, 6), [x, 0.02, z]), '#333']);
      P.push([place(CAP(0.09, 0.12, 8), [0.52, 1.0, 0], [0, 0, -0.9]), '#e8e4d8'], [place(new THREE.ConeGeometry(0.025, 0.2, 6), [0.5, 1.2, -0.06], [0.3, 0, 0.5]), '#8a7a6a'], [place(new THREE.ConeGeometry(0.025, 0.2, 6), [0.5, 1.2, 0.06], [-0.3, 0, 0.5]), '#8a7a6a'], [place(CAP(0.03, 0.08, 6), [0.62, 0.85, 0]), '#ccc']); break;
    case 'tv': P.push([place(BOX(0.9, 0.7, 0.5), [0, 1.25, 0]), '#2a2a2a'], [place(BOX(0.72, 0.52, 0.02), [0, 1.25, -0.255]), '#3a6a9a'], [place(BOX(1.2, 0.9, 0.6), [0, 0.45, 0]), '#6a4a2a']); for (let k = 0; k < 5; k++) P.push([place(BOX(0.2, 0.04, 0.12), [-0.4 + k * 0.05, 0.92 + k * 0.04, 0.1]), '#111']); break;
    case 'barrel': P.push([place(CYL(0.3, 0.3, 0.88, 14), [0, 0.44, 0]), '#3a6a8a']); for (const y of [0.12, 0.44, 0.76]) P.push([place(CYL(0.31, 0.31, 0.04, 14), [0, y, 0]), '#2a4a62']); P.push([place(CYL(0.29, 0.29, 0.01, 14), [0, 0.885, 0]), '#2e5470'], [place(CYL(0.04, 0.04, 0.02, 8), [0.15, 0.89, 0.05]), '#222']); break;
    case 'dummy': for (const x of [-0.1, 0.1]) P.push([place(CAP(0.07, 0.7, 8), [x, 0.45, 0]), '#e8d040']); P.push([place(CAP(0.17, 0.4, 10), [0, 1.15, 0], [0, 0, 0], [1, 1, 0.65]), '#e8d040'], [place(SPH(0.13, 12, 9), [0, 1.62, 0]), '#e8d040'], [place(BOX(0.22, 0.02, 0.02), [0, 1.64, -0.125]), '#111']);
      for (const x of [-0.24, 0.24]) P.push([place(CAP(0.055, 0.5, 8), [x, 1.08, 0], [0, 0, x > 0 ? 0.12 : -0.12]), '#e8d040']); break;
    case 'duck': P.push([place(SPH(0.25, 12, 9), [0, 0.2, 0], [0, 0, 0], [1.2, 0.8, 0.9]), '#f2d33c'], [place(SPH(0.15, 12, 9), [0.22, 0.48, 0]), '#f2d33c'], [place(new THREE.ConeGeometry(0.06, 0.14, 8), [0.4, 0.46, 0], [0, 0, -Math.PI / 2], [1, 1, 0.5]), '#e8702a'], [place(SPH(0.025, 6, 4), [0.33, 0.53, 0.07]), '#111'], [place(SPH(0.025, 6, 4), [0.33, 0.53, -0.07]), '#111']); break;
    case 'lamp': P.push([place(CYL(0.06, 0.09, 4, 8), [0, 2, 0]), '#3a3a3a'], [place(CYL(0.14, 0.16, 0.2, 8), [0, 0.1, 0]), '#333'], [place(CYL(0.025, 0.025, 0.6, 6), [0.28, 3.95, 0], [0, 0, Math.PI / 2]), '#3a3a3a'], [place(CYL(0.08, 0.18, 0.14, 10), [0.55, 3.88, 0]), '#2a2a2a']);
      break;
    default: break;
  }
  if (P.length) g.add(new THREE.Mesh(merge(P), propMat()));
  if (L.length) g.add(new THREE.Mesh(merge(L), leafMat()));
  if (p.type === 'lamp') { const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), basic('#ffe9a8')); bulb.position.set(0.55, 3.8, 0); g.add(bulb); }
  g.position.set(p.x, p.y || 0, p.z); g.rotation.y = p.rot || 0;
  return g;
}
