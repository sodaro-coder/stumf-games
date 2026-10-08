// Models built at runtime from smooth primitives and extruded profiles (no model files): players (every agent look,
// with knees, elbows and hands that reach for the gun), first-person guns with real silhouettes and CS-style arms,
// knives (including the joke ones), grenades, the bomb and map props. Each body part / gun material is merged into a
// single mesh with vertex colours, so a whole player is ~12 draw calls and a gun 3-5: cheap on weak machines.
import * as THREE from '../sdk/three.module.min.js';
import { W_BY_ID } from './data.js';
import { paintSkin, KNIFE_BY_ID } from './skins.js';
import { litPatch } from './world.js';
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
const CYL = (rt, rb, h, seg = 10, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
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
const rigMat = () => rigMatC || (rigMatC = litPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), 'dyn'));
const UA = 0.29, FA = 0.27;  // upper arm, forearm (to the middle of the hand)
// a rig: group at the feet. hip -> thighs -> shins; torso -> shoulders -> elbows; neck -> head; aim -> the gun
export function makePlayer(look, team) {
  const L = look, g = new THREE.Group(), M = rigMat(), ct = team === 'CT';
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
export function setTpGun(r, wid) {
  if (r.tpKey === wid) return; r.tpKey = wid;
  for (const c of [...r.tpGun.children]) r.tpGun.remove(c);
  const w = W_BY_ID[wid], cat = w ? w.cat : wid === 'c4' ? 'c4' : wid === 'knife' || !wid ? 'knife' : 'grenade';
  const m = cat === 'c4' ? makeBomb() : cat === 'knife' ? makeKnife(null, null, undefined, undefined, false) : cat === 'grenade' ? makeGrenade(wid, undefined, undefined, false) : makeGun(wid, null, undefined, undefined, false);
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
const gmat = new Map();
function gm(key) {
  const k = key + (HQ ? 'H' : 'L');
  if (gmat.has(k)) return gmat.get(k);
  const D = { metal: ['#3b3e44', 70, '#6a6e76'], dark: ['#1f2125', 18, '#2a2a2a'], steel: ['#9aa0aa', 90, '#d8dce4'], blade: ['#c8ccd2', 110, '#ffffff'], wood: ['#a8703e', 20, '#3a2a1a'],
    green: ['#4c5a3a', 20, '#333'], tan: ['#a8946a', 15, '#333'], olive: ['#5a6040', 18, '#333'], yellow: ['#e2c840', 30, '#444'], grip: ['#26221f', 6, '#111'], lens: ['#1a3040', 120, '#9ad0ff'], brass: ['#b89040', 80, '#ffe0a0'] }[key] || ['#888', 20, '#333'];
  const o = { color: D[0], vertexColors: false };
  if (key === 'wood') { const t = new THREE.CanvasTexture(surface('darkwood', 128, false).map); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; o.map = t; o.color = '#e0b080'; }
  const m = HQ ? new THREE.MeshPhongMaterial({ ...o, shininess: D[1], specular: D[2] }) : new THREE.MeshLambertMaterial(o);
  gmat.set(k, m); return m;
}
const skinTexCache = new Map();
export function skinTexture(item, info) {
  const k = item ? item.uid : 'none';
  if (skinTexCache.has(k)) return skinTexCache.get(k);
  let t = null;
  if (item && info && info.paint) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    paintSkin(c, info.paint, item.seed, item.float);
    const big = document.createElement('canvas'); big.width = 256; big.height = 128;
    const g = big.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, 256, 128);
    const im = g.getImageData(0, 0, 256, 128);   // a fine grain on top so the paint reads as a coating, not a blur
    let s = (item.seed | 0) * 7919 + 1; for (let i = 0; i < im.data.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 16) & 15) - 7; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
    g.putImageData(im, 0, 0);
    t = new THREE.CanvasTexture(big); t.colorSpace = THREE.SRGBColorSpace;
  }
  skinTexCache.set(k, t);
  return t;
}
const paintMats = new Map();
const paintMat = (tex) => { if (!paintMats.has(tex)) paintMats.set(tex, HQ ? new THREE.MeshPhongMaterial({ map: tex, shininess: 35, specular: '#555' }) : new THREE.MeshLambertMaterial({ map: tex })); return paintMats.get(tex); };

// ---- gun geometry: side profiles (u = forward, v = up, metres) extruded to thickness, plus barrels and parts ---------
function ext(pts, depth, bevel = 0.0035, holes = null) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p[0] === 'q') sh.quadraticCurveTo(p[1], p[2], p[3], p[4]); else sh.lineTo(p[0], p[1]); }
  sh.closePath();
  if (holes) for (const hp of holes) { const h = new THREE.Path(); h.moveTo(hp[0][0], hp[0][1]); for (let i = 1; i < hp.length; i++) h.lineTo(hp[i][0], hp[i][1]); h.closePath(); sh.holes.push(h); }
  const d = Math.max(0.002, depth - bevel * 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -d / 2); g.rotateY(Math.PI / 2);
  return g;
}
const tube = (r, u0, u1, v, x = 0, seg = 10, r1 = r) => { const g = CYL(r1, r, u1 - u0, seg); g.rotateX(-Math.PI / 2); g.translate(x, v, -(u0 + u1) / 2); return g; };
const blk = (u0, u1, v0, v1, w, x = 0) => { const g = BOX(w, v1 - v0, u1 - u0); g.translate(x, (v0 + v1) / 2, -(u0 + u1) / 2); return g; };
const guard = (u0, u1, v0, v1, w = 0.012) => ext([[u0, v1], [u1, v1], [u1, v0 + 0.012], ['q', u1, v0, u1 - 0.015, v0], [u0 + 0.01, v0], [u0, v0 + 0.012]], w, 0.002, [[[u0 + 0.008, v1 - 0.001], [u1 - 0.008, v1 - 0.001], [u1 - 0.008, v0 + 0.008], [u0 + 0.008, v0 + 0.008]]]);

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
  if (o.mag === 'curve') G(o.magMat || 'metal', ext([[m0, rb + 0.005], [m0 + 0.075, rb + 0.005], ['q', m0 + 0.09, rb - 0.12, m0 + 0.15, rb - 0.205], [m0 + 0.085, rb - 0.235], ['q', m0 + 0.025, rb - 0.13, m0, rb + 0.005]], w * 0.72));
  else if (o.mag === 'straight') G(o.magMat || 'dark', ext([[m0, rb + 0.005], [m0 + 0.068, rb + 0.005], [m0 + 0.085, rb - 0.165], [m0 + 0.017, rb - 0.172]], w * 0.68));
  else if (o.mag === 'box') G(o.magMat || 'dark', ext([[m0, rb + 0.005], [m0 + 0.085, rb + 0.005], [m0 + 0.085, rb - 0.07], [m0, rb - 0.07]], w * 0.75));
  else if (o.mag === 'mg') { G('dark', blk(m0, m0 + 0.13, rb - 0.13, rb + 0.005, w * 1.6, -0.02)); G('olive', blk(m0 + 0.01, m0 + 0.12, rb - 0.125, rb - 0.04, w * 1.62, -0.02)); }
  // handguard
  const [h0, h1] = o.hg, hv = (rb + rt) / 2;
  if (o.hgType === 'ak') { G(F, ext([[h0, rb + 0.002], [h1, rb + 0.01], [h1, hv + 0.004], [h0, hv + 0.008]], w * 1.12)); G(F, ext([[h0 + 0.02, hv + 0.012], [h1 - 0.05, hv + 0.012], [h1 - 0.05, rt - 0.008], [h0 + 0.02, rt - 0.006]], w * 0.9)); G('metal', tube(0.011, h1 - 0.05, h1 + 0.02, rt - 0.012)); }
  else if (o.hgType === 'quad') { G(F, tube(0.03, h0, h1, hv, 0, 8)); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; G('dark', blk(h0, h1, -0.004, 0.004, 0.022).translate(0, 0, 0).applyMatrix4(new THREE.Matrix4().makeTranslation(0, hv, 0).multiply(new THREE.Matrix4().makeRotationZ(a)).multiply(new THREE.Matrix4().makeTranslation(0, 0.03, 0)))); } }
  else if (o.hgType === 'round') G(F, tube(o.hgR || 0.026, h0, h1, hv - 0.004, 0, 12));
  else if (o.hgType === 'slab') G(F, ext([[h0, rb - 0.01], [h1, rb - 0.004], [h1, rt - 0.004], [h0, rt]], w * 1.15));
  // barrel, front sight, muzzle
  const bv = o.bv ?? (hv + 0.006), bEnd = h1 + (o.blen || 0.12);
  G('metal', tube(o.br || 0.0105, h1 - 0.02, bEnd, bv));
  if (o.fsight !== false) G('metal', ext([[h1 + 0.02, bv], [h1 + 0.05, bv], [h1 + 0.045, bv + 0.05], [h1 + 0.03, bv + 0.05]], 0.012, 0.002));
  if (o.muzzle === 'ak') G('metal', tube(0.016, bEnd, bEnd + 0.045, bv));
  else if (o.muzzle === 'bird') G('dark', tube(0.015, bEnd, bEnd + 0.06, bv, 0, 6));
  else if (o.muzzle === 'brake') { G('metal', tube(0.02, bEnd, bEnd + 0.08, bv, 0, 8)); G('dark', blk(bEnd + 0.015, bEnd + 0.06, bv - 0.006, bv + 0.006, 0.05)); }
  else if (o.muzzle === 'sil') G('dark', tube(0.023, bEnd, bEnd + 0.2, bv, 0, 14));
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
  } else if (o.rear !== false) G('metal', blk(r0 + 0.03, r0 + 0.05, rt, rt + 0.03, 0.03));
  if (o.handle) { G(F, ext([[r0 + 0.02, rt], [r0 + 0.04, rt + 0.06], [r1 + 0.12, rt + 0.06], [r1 + 0.14, rt], [r1 + 0.1, rt], [r1 + 0.09, rt + 0.04], [r0 + 0.07, rt + 0.04], [r0 + 0.06, rt]], 0.028)); }
  if (o.bipod) { G('dark', tube(0.006, h1 - 0.02, h1 + 0.15, bv - 0.03, 0.02, 6)); G('dark', tube(0.006, h1 - 0.02, h1 + 0.15, bv - 0.03, -0.02, 6)); }
  return { grip: [-0.03, rb - 0.055], fore: [(h0 + h1) / 2 - 0.02, rb - 0.006] };
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
  if (o.mag) G('dark', ext([[s0 + 0.075, sb - 0.016], [s0 + 0.095, sb - 0.016], [s0 + 0.105, sb - (o.mag + 0.02)], [s0 + 0.08, sb - (o.mag + 0.02)]], w * 0.8));
  return { grip: [s0 + 0.03, sb - 0.06], fore: null };
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
R('nova', (G) => { const r = rifle(G, { recv: [-0.1, 0.2, -0.03, 0.028], hgType: 'none', hg: [0.2, 0.2], blen: 0.42, br: 0.013, muzzle: 'none', mag: 'none', stock: 'm4', rear: false }); G('dark', tube(0.014, 0.2, 0.55, -0.012)); G('grip', tube(0.024, 0.26, 0.4, -0.012, 0, 10)); r.fore = [0.33, -0.03]; return r; });
R('xm1014', (G) => { const r = rifle(G, { recv: [-0.11, 0.22, -0.03, 0.03], rail: true, hgType: 'none', hg: [0.22, 0.22], blen: 0.38, br: 0.013, muzzle: 'none', mag: 'none', stock: 'm4' }); G('dark', tube(0.014, 0.22, 0.56, -0.014)); G('dark', blk(0.22, 0.4, -0.035, 0.01, 0.05)); r.fore = [0.32, -0.04]; return r; });
R('sawedoff', (G) => { const r = rifle(G, { recv: [-0.06, 0.12, -0.03, 0.03], furn: 'wood', gripMat: 'wood', hgType: 'none', hg: [0.12, 0.12], blen: 0.22, br: 0.014, bv: 0.008, muzzle: 'none', mag: 'none', stock: 'none', rear: false }); G('metal', tube(0.014, 0.1, 0.34, -0.018)); G('wood', tube(0.024, 0.13, 0.26, -0.016, 0, 10)); r.fore = [0.2, -0.035]; return r; });
R('mag7', (G) => { const r = rifle(G, { recv: [-0.1, 0.2, -0.04, 0.03], w: 0.055, hgType: 'slab', hg: [0.2, 0.3], blen: 0.1, br: 0.014, muzzle: 'none', mag: 'box', mag0: -0.02, stock: 'fold' }); r.fore = [0.25, -0.05]; return r; });
R('mac10', (G) => { pistol(G, { slide: [-0.1, 0.1], sh: 0.06, w: 0.045, bl: 0.03, mag: 0.14 }); return { grip: [-0.06, -0.06], fore: null }; });
R('mp9', (G) => { const r = rifle(G, { recv: [-0.06, 0.16, -0.025, 0.03], w: 0.042, rail: true, hgType: 'none', hg: [0.16, 0.16], blen: 0.04, muzzle: 'none', mag: 'straight', mag0: -0.045, stock: 'fold' }); r.fore = [0.13, -0.03]; return r; });
R('mp7', (G) => { const r = rifle(G, { recv: [-0.08, 0.18, -0.028, 0.03], w: 0.045, rail: true, hgType: 'slab', hg: [0.18, 0.24], blen: 0.05, muzzle: 'none', mag: 'straight', mag0: -0.045, stock: 'fold' }); r.fore = [0.2, -0.03]; return r; });
R('mp5', (G) => rifle(G, { recv: [-0.1, 0.2, -0.028, 0.03], w: 0.045, hgType: 'round', hgR: 0.025, hg: [0.2, 0.32], blen: 0.02, muzzle: 'sil', mag: 'curve', mag0: 0.08, stock: 'm4' }));
R('ump', (G) => rifle(G, { recv: [-0.1, 0.22, -0.035, 0.035], w: 0.05, rail: true, hgType: 'slab', hg: [0.22, 0.32], blen: 0.05, muzzle: 'none', mag: 'straight', mag0: 0.08, stock: 'skel' }));
R('bizon', (G) => { const r = rifle(G, { recv: [-0.1, 0.2, -0.028, 0.03], w: 0.045, top: 'ak', hgType: 'none', hg: [0.2, 0.2], blen: 0.12, muzzle: 'bird', mag: 'none', stock: 'skel' }); G('dark', tube(0.034, 0.05, 0.36, -0.06, 0, 12)); r.fore = [0.28, -0.1]; return r; });
R('p90', (G) => { G('body', ext([[-0.2, -0.06], [0.18, -0.03], [0.2, 0.02], [0.12, 0.05], [-0.18, 0.05], [-0.22, 0.0]], 0.06, 0.008, [[[-0.08, -0.04], [0.0, -0.035], [0.0, -0.01], [-0.08, -0.01]]])); G('dark', blk(-0.16, 0.12, 0.05, 0.065, 0.04)); G('dark', tube(0.009, 0.18, 0.24, 0.0)); return { grip: [-0.05, -0.04], fore: [0.1, -0.03] }; });
R('glock', (G) => pistol(G, { slide: [-0.08, 0.1] }));
R('usp', (G) => pistol(G, { slide: [-0.08, 0.1], sil: true }));
R('p2000', (G) => pistol(G, { slide: [-0.08, 0.1] }));
R('p250', (G) => pistol(G, { slide: [-0.08, 0.095] }));
R('fiveseven', (G) => pistol(G, { slide: [-0.08, 0.11], sh: 0.036 }));
R('cz75', (G) => pistol(G, { slide: [-0.08, 0.1], mag: 0.03 }));
R('dualies', (G) => pistol(G, { slide: [-0.085, 0.1], frame: 'steel' }));
R('tec9', (G) => { pistol(G, { slide: [-0.09, 0.14], sh: 0.04, w: 0.035, bl: 0.05 }); G('dark', ext([[0.07, -0.01], [0.1, -0.01], [0.105, -0.18], [0.075, -0.18]], 0.03)); return { grip: [-0.06, -0.06], fore: null }; });
R('deagle', (G) => pistol(G, { slide: [-0.1, 0.13], sh: 0.045, w: 0.036, frame: 'steel' }));
R('r8', (G) => { pistol(G, { slide: [-0.08, -0.01], sh: 0.04 }); G('steel', tube(0.024, -0.01, 0.04, 0.02, 0, 10)); G('steel', tube(0.009, 0.04, 0.2, 0.03)); G('steel', blk(0.04, 0.2, 0.034, 0.046, 0.012)); return { grip: [-0.05, -0.06], fore: null }; });
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
export function makeGun(id, tex, sleeve = '#3c4e66', glove = '#2a2a2a', hands = true) {
  const w = W_BY_ID[id] || { cat: 'pistol' }, recipe = RECIPE[id] || RECIPE[w.cat === 'pistol' ? 'p250' : w.cat === 'smg' ? 'mp7' : w.cat === 'sniper' ? 'ssg08' : w.cat === 'heavy' ? 'nova' : 'm4a4'];
  let cg = geoCache.get(id);
  if (!cg) {
    const buckets = {}, G = (k, g) => { (buckets[k] = buckets[k] || []).push([g, null]); };
    const hold = recipe(G);
    const geos = {};
    let box = null;
    for (const [k, list] of Object.entries(buckets)) { geos[k] = merge(list); geos[k].computeBoundingBox(); if (k === 'body') box = geos[k].boundingBox; }
    if (box && geos.body) {   // the skin wraps the whole gun side-on (u along the barrel, v up)
      const p = geos.body.attributes.position, uv = geos.body.attributes.uv, du = box.max.z - box.min.z || 1, dv = box.max.y - box.min.y || 1;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (box.max.z - p.getZ(i)) / du, (p.getY(i) - box.min.y) / dv);
    }
    if (geos.wood) { const p = geos.wood.attributes.position, uv = geos.wood.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, -p.getZ(i) * 3, p.getY(i) * 3 + p.getX(i) * 3); }
    let len = 0; for (const g of Object.values(geos)) { g.computeBoundingBox(); len = Math.max(len, -g.boundingBox.min.z); }
    cg = { geos, hold, len };
    geoCache.set(id, cg);
  }
  const g = new THREE.Group();
  for (const [k, geo] of Object.entries(cg.geos)) g.add(new THREE.Mesh(geo, k === 'body' ? (tex ? paintMat(tex) : gm(DEFAULT_BODY[id] || 'dark')) : gm(k)));
  const grip = new THREE.Vector3(0, cg.hold.grip[1], -cg.hold.grip[0]), fore = cg.hold.fore ? new THREE.Vector3(0, cg.hold.fore[1], -cg.hold.fore[0]) : null;
  if (hands) {
    const parts = [];
    vmArm(parts, [grip.x + 0.005, grip.y + 0.005, grip.z + 0.01], [0.38, -0.5, 0.78], sleeve, glove, 0.6);
    if (fore) vmArm(parts, [fore.x - 0.012, fore.y - 0.012, fore.z], [-0.55, -0.42, 0.72], sleeve, glove, 0.7);
    else vmArm(parts, [grip.x - 0.025, grip.y - 0.02, grip.z + 0.015], [-0.5, -0.5, 0.7], sleeve, glove, 0.6);
    g.add(new THREE.Mesh(merge(parts), armMat()));
  }
  g.add(muzzleFlash(cg.len + (w.silenced ? 0.04 : 0.02), w.cat === 'pistol' ? 0.6 : 1));
  g.userData = { flash: g.children[g.children.length - 1], len: cg.len, grip, fore };
  return g;
}
let armMatC = null;
const armMat = () => armMatC || (armMatC = HQ ? new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 8, specular: '#222' }) : new THREE.MeshLambertMaterial({ vertexColors: true }));
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
  switch (model) {
    case 'hotdog': G('bun', place(CAP(0.042, 0.3, 10), [0, -0.012, -0.15], [Math.PI / 2, 0, 0], [1.3, 1, 0.75])); G(paintKey || 'sausage', place(CAP(0.026, 0.36, 10), [0, 0.022, -0.15], [Math.PI / 2, 0, 0])); for (let i = 0; i < 6; i++) G('mustard', place(BOX(0.04, 0.006, 0.012), [i % 2 ? 0.008 : -0.008, 0.048, -0.02 - i * 0.05], [0, i % 2 ? 0.6 : -0.6, 0])); break;
    case 'dildo': G(paintKey || 'pink', place(CAP(0.028, 0.28, 12), [0, 0.02, -0.17], [Math.PI / 2, 0, 0])); G(paintKey || 'pink', place(SPH(0.036, 12, 9), [0, 0.022, -0.33], [0, 0, 0], [1, 1, 1.1])); G(paintKey || 'pink2', place(SPH(0.034, 10, 8), [-0.026, 0.0, 0.0])); G(paintKey || 'pink2', place(SPH(0.034, 10, 8), [0.026, 0.0, 0.0])); break;
    case 'plunger': G('woodk', place(CYL(0.012, 0.012, 0.5, 8), [0, 0, -0.12], [Math.PI / 2, 0, 0])); G(paintKey || 'red', place(SPH(0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0, -0.38], [-Math.PI / 2, 0, 0], [1, 0.8, 1])); break;
    case 'chicken': G(paintKey || 'yellowk', place(SPH(0.05, 12, 9), [0, 0.02, -0.14], [0, 0, 0], [1, 1.1, 2.3])); G(paintKey || 'yellowk', place(CYL(0.018, 0.022, 0.12, 8), [0, 0.07, -0.28], [0.6, 0, 0])); G(paintKey || 'yellowk', place(SPH(0.03, 10, 8), [0, 0.11, -0.32])); G('orange', place(new THREE.ConeGeometry(0.012, 0.04, 6), [0, 0.105, -0.355], [-Math.PI / 2, 0, 0])); G('red', place(BOX(0.006, 0.03, 0.04), [0, 0.14, -0.32])); break;
    case 'baguette': G(paintKey || 'bread', place(CAP(0.034, 0.52, 10), [0, 0.02, -0.2], [Math.PI / 2 + 0.05, 0, 0], [1, 1, 0.85])); for (let i = 0; i < 5; i++) G('crust', place(BOX(0.05, 0.006, 0.014), [0, 0.052, -0.04 - i * 0.09], [0, 0.7, 0])); break;
    case 'fish': G(paintKey || 'salmon', place(SPH(0.06, 12, 9), [0, 0.02, -0.15], [0, 0, 0], [0.4, 1, 3])); G(paintKey || 'salmon2', ext([[0.0, 0.0], [-0.08, 0.06], [-0.08, -0.06]], 0.01, 0.002).translate(0, 0.02, 0.04)); G('eyek', place(SPH(0.01, 6, 4), [0.022, 0.035, -0.29])); break;
    case 'banana': { const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0.02), new THREE.Vector3(0, 0.1, -0.18), new THREE.Vector3(0, 0.0, -0.4)); G(paintKey || 'yellowk', new THREE.TubeGeometry(curve, 12, 0.026, 8)); G('brown', place(CYL(0.01, 0.014, 0.04, 6), [0, 0.0, 0.03], [Math.PI / 2, 0, 0])); break; }
    case 'karambit': G(paintKey || 'blade', ext([[0, 0.01], [0.06, 0.03], ['q', 0.14, 0.04, 0.17, -0.04], ['q', 0.12, 0.0, 0.05, -0.005], [0, -0.01]], 0.006, 0.0015)); G('gripk', ext([[-0.11, -0.012], [0, -0.012], [0, 0.014], [-0.11, 0.016]], 0.024)); G('steelk', place(new THREE.TorusGeometry(0.022, 0.006, 6, 12), [0, 0, 0.13], [0, Math.PI / 2, 0])); break;
    case 'butterfly': G(paintKey || 'blade', ext([[0, -0.012], [0.16, -0.008], [0.21, 0.01], [0.15, 0.018], [0, 0.016]], 0.005, 0.0015)); for (const x of [-0.009, 0.009]) G('steelk', ext([[-0.13, -0.014], [0, -0.014], [0, 0.012], [-0.13, 0.012]], 0.012, 0.002, [[[-0.11, -0.006], [-0.02, -0.006], [-0.02, 0.004], [-0.11, 0.004]]]).translate(x, 0, 0)); break;
    case 'bayonet': G(paintKey || 'blade', ext([[0, -0.016], [0.24, -0.01], [0.29, 0.012], [0.22, 0.02], [0, 0.02]], 0.006, 0.0015)); G('steelk', blk(-0.01, 0.006, -0.03, 0.035, 0.022)); G('gripk', ext([[-0.12, -0.016], [-0.01, -0.016], [-0.01, 0.018], [-0.12, 0.016]], 0.026)); for (let i = 0; i < 6; i++) G('steelk', blk(-0.115 + i * 0.018, -0.11 + i * 0.018, -0.017, 0.019, 0.027)); break;
    default: G(paintKey || 'blade', ext([[0, -0.014], [0.17, -0.009], [0.215, 0.012], [0.15, 0.02], [0, 0.018]], 0.005, 0.0015)); G('steelk', blk(-0.008, 0.004, -0.024, 0.03, 0.02)); G('gripk', ext([[-0.11, -0.014], [-0.008, -0.014], [-0.008, 0.016], [-0.11, 0.014]], 0.024)); break;
  }
  const KC = { bun: '#e0a85a', sausage: '#b8402a', mustard: '#f2d33c', pink: '#ff4ad2', pink2: '#e030b8', woodk: '#8a5a2a', red: '#b8221e', yellowk: '#f2d33c', orange: '#e8702a', bread: '#d8a050', crust: '#9a6024', salmon: '#e8806a', salmon2: '#c8604a', eyek: '#111', brown: '#5a3a1a', gripk: '#26221f', steelk: '#8a9098' };
  for (const [key, list] of Object.entries(buckets)) {
    const geo = merge(list);
    if (key === 'body' || key === 'blade') { geo.computeBoundingBox(); const b = geo.boundingBox, p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (b.max.z - p.getZ(i)) / ((b.max.z - b.min.z) || 1), (p.getY(i) - b.min.y) / ((b.max.y - b.min.y) || 1)); }
    const mt = key === 'body' ? paintMat(tex) : key === 'blade' ? gm('blade') : key === 'steelk' ? gm('steel') : key === 'gripk' ? gm('grip') : (HQ ? new THREE.MeshPhongMaterial({ color: KC[key] || '#888', shininess: key === 'pink' || key === 'pink2' ? 70 : 20, specular: '#444' }) : lam(KC[key] || '#888'));
    g.add(new THREE.Mesh(geo, mt));
  }
  const grip = new THREE.Vector3(0, 0, 0.06);
  if (hands) { const parts = []; vmArm(parts, [0, -0.005, 0.05], [0.35, -0.5, 0.78], sleeve, glove, 0.6); g.add(new THREE.Mesh(merge(parts), armMat())); }
  g.userData = { flash: null, len: 0.3, grip, fore: null };
  return g;
}

// ---- grenades and the bomb ------------------------------------------------------------------------------------------
export function makeGrenade(type, sleeve = '#3c4e66', glove = '#2a2a2a', hands = false) {
  const g = new THREE.Group(), P = [];
  const col = { he: '#4a5a32', flash: '#9aa0a8', smoke: '#5a6a7a', molotov: '#5a8a4a', incendiary: '#8a4a2a', decoy: '#8a8a4a' }[type] || '#555';
  if (type === 'he') { P.push([place(SPH(0.036, 12, 9), [0, 0, 0], [0, 0, 0], [1, 1.15, 1]), col]); for (let k = 0; k < 3; k++) P.push([place(CYL(0.0372, 0.0372, 0.004, 12), [0, -0.02 + k * 0.02, 0], [0, 0, 0], [1, 1, 1]), shade(col, 0.75)]); }
  else if (type === 'molotov') { P.push([place(new THREE.LatheGeometry([[0, -0.07], [0.034, -0.07], [0.036, -0.06], [0.036, 0.02], [0.016, 0.05], [0.012, 0.075], [0, 0.075]].map(([x, y]) => new THREE.Vector2(x, y)), 12), [0, 0, 0]), col], [place(CYL(0.014, 0.01, 0.05, 6), [0.004, 0.095, 0], [0, 0, 0.25]), '#e8e0c0']); }
  else { P.push([place(CYL(0.031, 0.031, type === 'decoy' ? 0.085 : 0.11, 12), [0, 0, 0]), col], [place(CYL(0.0315, 0.0315, 0.012, 12), [0, 0.03, 0]), shade(col, 0.6)]); }
  if (type !== 'molotov') P.push([place(CYL(0.012, 0.016, 0.022, 8), [0, 0.055, 0]), '#8a8f98'], [place(BOX(0.012, 0.075, 0.016), [0.024, 0.03, 0], [0, 0, -0.15]), '#8a8f98'], [place(new THREE.TorusGeometry(0.012, 0.0025, 4, 10), [-0.012, 0.07, 0], [0, Math.PI / 2, 0]), '#b8bcc4']);
  if (hands) vmArm(P, [0.0, -0.02, 0.04], [0.35, -0.5, 0.78], sleeve, glove, 0.6);
  g.add(new THREE.Mesh(merge(P), HQ ? new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 30, specular: '#333' }) : new THREE.MeshLambertMaterial({ vertexColors: true })));
  g.userData = { flash: null, grip: new THREE.Vector3(0, 0, 0), fore: null };
  return g;
}
export function makeBomb(sleeve = '#3c4e66', glove = '#2a2a2a', hands = false) {
  const g = new THREE.Group(), P = [];
  for (let k = 0; k < 4; k++) P.push([place(CYL(0.032, 0.032, 0.26, 10), [-0.1 + k * 0.066, 0.035, 0], [Math.PI / 2, 0, 0]), '#c8b890']);
  for (const z of [-0.08, 0.08]) P.push([place(BOX(0.28, 0.075, 0.03), [0, 0.035, z]), '#1c1c1c']);
  P.push([place(BOX(0.13, 0.03, 0.1), [0, 0.085, 0]), '#2a2a2a'], [place(BOX(0.09, 0.004, 0.035), [0, 0.101, -0.02]), '#3a6a3a']);
  for (let i = 0; i < 9; i++) P.push([place(BOX(0.018, 0.006, 0.014), [-0.025 + (i % 3) * 0.025, 0.102, 0.012 + Math.floor(i / 3) * 0.018]), '#555']);
  for (let k = 0; k < 3; k++) P.push([place(CYL(0.004, 0.004, 0.28, 4), [-0.12 + k * 0.012, 0.075, 0], [0, 0, Math.PI / 2 + 0.2]), ['#c22', '#22c', '#cc2'][k]]);
  if (hands) { vmArm(P, [0.11, 0.0, 0.08], [0.4, -0.5, 0.75], sleeve, glove, 0.6); vmArm(P, [-0.11, 0.0, 0.08], [-0.4, -0.5, 0.75], sleeve, glove, 0.6); }
  g.add(new THREE.Mesh(merge(P), HQ ? new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 12, specular: '#222' }) : new THREE.MeshLambertMaterial({ vertexColors: true })));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), basic('#f00')); led.position.set(0.05, 0.104, -0.035); g.add(led);
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
