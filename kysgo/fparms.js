// First-person arms: a real rigged pair of arms (models/fparms.glb, CC BY "FREE [FPS Arms] GameReady - RIGGED" by
// bamenwo05: tactical fingerless gloves with their own photo textures, every finger jointed), wearing the team's sleeve
// in a photographed nylon weave. The shoulders stay put under the camera; each frame the hands are put on the gun with
// two-bone IK (shoulder -> elbow -> wrist, the elbow hanging down and out like a person's) and turned to a hold made for
// that kind of weapon, then the fingers close round what they hold: the trigger hand round the pistol grip with the
// index finger at the trigger, the support hand under the handguard / round the pump / round the firing hand on a pistol.
// The hand targets ride the gun's own moving parts (the reload's support-hand path, the pump, the bolt), so the hands
// follow every reload, rack, draw, recoil and inspect the gun group already does. Until the file has loaded (and on
// Performance, where the light file is used) nothing changes: the built arms stay.
import * as THREE from '../sdk/three.module.min.js';
import { loadGLB, modelManifest, modelFile } from './glb.js';
import { gunSurface, isBuiltArm } from './models.js';

let SRC = null, SRCK = '';
export function loadArms(tier = 'hi') {
  if (SRCK === tier && SRC) return SRC; SRCK = tier;
  SRC = modelManifest().then((m) => (m.fparms ? loadGLB(modelFile(m.fparms, tier)) : null)).catch(() => null);
  SRC.then((g) => { READY = g; });
  return SRC;
}
let READY = null;
export const armsReady = () => !!READY;

function cloneRig(src) {
  const c = src.clone(true), a = [], b = []; src.traverse((o) => a.push(o)); c.traverse((o) => b.push(o));
  const map = new Map(a.map((o, i) => [o, b[i]]));
  b.forEach((o, i) => { if (o.isSkinnedMesh) { const sk = a[i].skeleton; o.bind(new THREE.Skeleton(sk.bones.map((x) => map.get(x)), sk.boneInverses), o.bindMatrix); o.frustumCulled = false; } });
  return c;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const sleeveMats = new Map();
function sleeveMat(col) {
  if (!sleeveMats.has(col)) sleeveMats.set(col, gunSurface(new THREE.MeshStandardMaterial({ color: new THREE.Color(col), metalness: 0, roughness: 0.92, envMapIntensity: 0.35, side: THREE.DoubleSide }), 'gcloth', { tile: 24, normal: 1.8, albedo: 1.0, rough: 0.1 }));
  return sleeveMats.get(col);
}
// one hold: where the wrist goes and how the hand is turned, in the gun's own space (x right, y up, -z down the barrel),
// and how far each finger closes (0 straight .. 1 a fist): [thumb, index, middle, ring, little]
// fwd: wrist -> middle knuckle; palm: the way the palm faces
export const HOLD = {
  // the trigger hand: the web of the hand high on the back of the grip, palm on its right side, knuckles down the front
  // strap; the fingers wrap round to the left side, the index finger lies on the trigger
  grip: { at: [0.022, 0.03, 0.052], fwd: [-0.22, -0.32, -0.92], palm: [-1, 0, 0.1], curl: [0.55, 0.42, 0.95, 1.0, 1.0] },
  // the support hand under a handguard: palm up against it, the hand turned forward-right, fingers up round the far
  // side, thumb along the near side
  fore: { at: [-0.03, -0.045, 0.07], fwd: [0.5, 0.2, -0.84], palm: [0, 1, 0.2], curl: [0.35, 0.7, 0.8, 0.85, 0.9] },
  // a pump: the same, a fuller grip round the forend
  pump: { at: [-0.032, -0.042, 0.025], fwd: [0.45, 0.25, -0.86], palm: [0, 1, 0.2], curl: [0.45, 0.85, 0.95, 1.0, 1.0] },
  // a pistol's support hand: palm on the left of the grip over the firing hand's fingers, thumb forward along the frame
  pistol: { at: [-0.035, 0.012, 0.03], fwd: [0.32, -0.35, -0.88], palm: [1, 0, 0.1], curl: [0.15, 0.95, 1.0, 1.0, 1.0] },
  // a knife: a fist round the handle, edge forward; the support hand rests low, open
  knife: { at: [0.02, 0.0, 0.045], fwd: [-0.15, -0.4, -0.9], palm: [-1, 0, 0.1], curl: [0.7, 0.95, 1.0, 1.0, 1.0] },
  // the support hand over the top of the gun (a charging handle pulled, a slide racked or press-checked): palm down,
  // fingers across to the right side
  over: { at: [-0.025, 0.012, 0.015], fwd: [0.85, -0.25, -0.45], palm: [0, -1, 0], curl: [0.45, 0.9, 0.95, 1.0, 1.0] },
  // the support hand round a magazine (pulled out, brought up, seated): palm on its left side, fingers round the front
  mag: { at: [-0.032, -0.02, 0.0], fwd: [0.2, -0.35, -0.9], palm: [1, 0, 0.1], curl: [0.3, 0.75, 0.85, 0.9, 0.95] },
  // a grenade or the bomb: the hand round it
  ball: { at: [0.03, -0.01, 0.05], fwd: [-0.3, -0.15, -0.94], palm: [-1, 0.2, 0], curl: [0.6, 0.6, 0.65, 0.7, 0.75] },
};
export const SIGN = { R: -1, L: -1 };   // measured: which way the knuckle line runs for a given palm, per hand
const FING = ['Finger_1', 'Finger_2', 'Finger_3', 'Finger_4', 'Finger_5'];   // thumb, index, middle, ring, little (from the bind pose: 1 sits by the wrist)

export function makeArms(sleeve = '#5e5440') {
  if (!READY) return null;
  const root = cloneRig(READY.scene), B = {};
  root.traverse((o) => {
    if (o.isBone) B[o.name.replace(/_\d+$/, '').replace(/_end$/, '_end')] = o;
    if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.renderOrder = 1;
      if (/arm/i.test(o.material.name || '') && !/hand/i.test(o.material.name || '')) o.material = sleeveMat(sleeve); else { o.material = o.material.clone(); o.material.envMapIntensity = 0.45; } }
  });
  root.updateMatrixWorld(true);
  const side = (s) => {
    const S = { s, up: B['Arm_1.' + s], lo: B['Arm_2.' + s], hand: B['Hand_1.' + s], palm: B['Hand_2.' + s], fingers: [] };
    if (!S.up || !S.lo || !S.hand) return null;
    // the rest frame of the hand (from the file's own pose): fingers' direction and the knuckle line
    const w = S.hand.getWorldPosition(new THREE.Vector3()), mid = B['Finger_3_1.' + s].getWorldPosition(new THREE.Vector3()), idx = B['Finger_2_1.' + s].getWorldPosition(new THREE.Vector3()), lit = B['Finger_5_1.' + s].getWorldPosition(new THREE.Vector3());
    const f = mid.clone().sub(w).normalize(), ac = lit.clone().sub(idx); ac.addScaledVector(f, -ac.dot(f)).normalize();
    S.rest = new THREE.Matrix4().makeBasis(f, ac, new THREE.Vector3().crossVectors(f, ac)); S.q0 = S.hand.getWorldQuaternion(new THREE.Quaternion());
    S.restInvQ = new THREE.Quaternion().setFromRotationMatrix(S.rest).invert();
    S.palmN = new THREE.Vector3().crossVectors(f, ac).multiplyScalar(s === 'R' ? 1 : -1);
    for (const fn of FING) { const ch = []; for (let k = 1; k <= 4; k++) { const b = B[`${fn}_${k}.${s}`]; if (b) ch.push({ b, q0: b.quaternion.clone() }); } S.fingers.push(ch); }
    // the axis each finger closes about (in the hand's rest frame): across the knuckles, so the tips go to the palm
    S.curlAxis = ac.clone().multiplyScalar(s === 'R' ? -1 : 1);
    S.la = S.up.getWorldPosition(new THREE.Vector3()).distanceTo(S.lo.getWorldPosition(new THREE.Vector3())); S.lb = S.lo.getWorldPosition(new THREE.Vector3()).distanceTo(w);
    S.sh0 = S.up.position.clone();
    return S;
  };
  const R = side('R'), L = side('L');
  if (!R || !L) return null;
  const A = { root, B, R, L, sleeve };
  A.dispose = () => { root.traverse((o) => { if (o.isMesh && o.material && !sleeveMats.has(A.sleeve)) o.material.dispose && o.material.dispose(); }); };
  return A;
}

// where a hold puts the wrist and how it turns the hand, in world space, from an object's frame
function holdWorld(obj, anchor, H, outP, outF, outA, scale = 1) {
  obj.updateWorldMatrix(true, false);
  outP.set(anchor.x + H.at[0] * scale, anchor.y + H.at[1] * scale, anchor.z + H.at[2] * scale).applyMatrix4(obj.matrixWorld);
  outF.set(...H.fwd).transformDirection(obj.matrixWorld); outA.set(...H.palm).transformDirection(obj.matrixWorld);   // (the palm; solve() turns it into the knuckle line)
}
// two-bone IK (world space), the elbow toward the pole; the wrist then takes the hold's turn
function solve(S, target, fwd, across, pole, curl, grip) {
  const up = S.up, lo = up.children.includes(S.lo) ? S.lo : S.lo, hand = S.hand;
  up.position.copy(S.sh0); up.updateMatrixWorld(true);
  const a = up.getWorldPosition(_a), la = S.la, lb = S.lb;
  // out of reach: the shoulder comes forward (it does when you reach out to a long handguard), never the hand off the gun
  let d = target.distanceTo(a); const reach = (la + lb) * 0.985;
  if (d > reach) { const k = d - reach; _b.copy(target).sub(a).normalize().multiplyScalar(k); up.parent.updateWorldMatrix(true, false); _m.copy(up.parent.matrixWorld).invert(); _c.copy(a).add(_b).applyMatrix4(_m); up.position.copy(_c); up.updateMatrixWorld(true); up.getWorldPosition(a); d = target.distanceTo(a); }
  const dd = Math.min(Math.max(d, Math.abs(la - lb) + 1e-3), la + lb - 1e-4), dir = _b.copy(target).sub(a).normalize();
  const cosA = (la * la + dd * dd - lb * lb) / (2 * la * dd), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const n = _c.copy(pole).sub(a); n.addScaledVector(dir, -n.dot(dir)); if (n.lengthSq() < 1e-8) n.set(0, -1, 0); n.normalize();
  const elbow = _d.copy(a).addScaledVector(dir, la * cosA).addScaledVector(n, la * sinA);
  aim(up, lo.getWorldPosition(_e), elbow);
  aim(lo, hand.getWorldPosition(_e), target);
  // the hand: its rest frame (fingers, knuckle line) onto the hold's
  const f = fwd.clone().normalize(), pa = across.clone(); pa.addScaledVector(f, -pa.dot(f)).normalize();
  const ac = new THREE.Vector3().crossVectors(f, pa).multiplyScalar(S.s === 'R' ? SIGN.R : SIGN.L);   // the knuckle line from the palm (each hand is the other's mirror)
  _m2.makeBasis(f, ac, _e.crossVectors(f, ac));
  _q.setFromRotationMatrix(_m2).multiply(S.restInvQ).multiply(S.q0);
  hand.parent.getWorldQuaternion(_q2).invert(); hand.quaternion.copy(_q2.multiply(_q)); hand.updateMatrixWorld(true);
  // fingers: each joint closes about the knuckle line (as the hand is now turned); the thumb about its own, less
  S.fingers.forEach((ch) => ch.forEach((j) => j.b.quaternion.copy(j.q0)));
  hand.updateMatrixWorld(true);
  const dq = hand.getWorldQuaternion(_q2).multiply(_q.copy(S.q0).invert()), axF = _ax2.copy(S.curlAxis).applyQuaternion(dq).normalize(), fN = _ax3.copy(f);
  S.fingers.forEach((ch, i) => { const k = curl[i] ?? 0.5, per = i === 0 ? [0.2, 0.35, 0.45, 0.35] : [0.95, 1.25, 0.9, 0.6];
    const ax = i === 0 ? _e.copy(axF).multiplyScalar(0.5).addScaledVector(fN, S.s === 'R' ? -0.8 : 0.8).normalize() : axF;
    ch.forEach((j, n2) => turnWorld(j.b, ax, (per[n2] || 0.5) * k)); });
  void grip;
}
const _ax = new THREE.Vector3(), _ax2 = new THREE.Vector3(), _ax3 = new THREE.Vector3(), _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion();
function turnWorld(b, axis, ang) { b.parent.getWorldQuaternion(_tq); _ax.copy(axis).applyQuaternion(_tq.invert()).normalize(); b.quaternion.premultiply(_tq2.setFromAxisAngle(_ax, ang)); b.updateMatrixWorld(true); }
function aim(b, from, to) {   // turn b so its child at `from` points at `to`
  const p = b.getWorldPosition(new THREE.Vector3()), u = from.clone().sub(p).normalize(), v = to.clone().sub(p).normalize();
  _tq.setFromUnitVectors(u, v); b.getWorldQuaternion(_tq2); _tq.multiply(_tq2); b.parent.getWorldQuaternion(_tq2).invert(); b.quaternion.copy(_tq2.multiply(_tq)); b.updateMatrixWorld(true);
}

const _hm = new THREE.Matrix4(), _href = { updateWorldMatrix() {}, matrixWorld: null };
const _tR = new THREE.Vector3(), _fR = new THREE.Vector3(), _aR = new THREE.Vector3(), _tL = new THREE.Vector3(), _fL = new THREE.Vector3(), _aL = new THREE.Vector3(), _pole = new THREE.Vector3();
// per frame, after the gun group has been posed: kind 'rifle' | 'pistol' | 'shotgun' | 'knife' | 'ball'
export function poseArms(A, vm, kind, cam) {
  const ud = vm.userData; if (!A || !ud) return;
  // the shoulders: under and behind the eye, the support side a little forward and in (a shooter's stance)
  A.root.position.set(0, -1.52, 0.16); A.root.updateMatrixWorld(true);
  const sc = vm.scale.x || 1;
  const grip = ud.grip || new THREE.Vector3();
  // a knife turned in the fingers (a flip): the hand holds where it was, the blade spins about its own length
  let ref = vm;
  if (ud.holdSpin) { vm.updateWorldMatrix(true, false); _hm.copy(vm.matrixWorld).multiply(_m.makeRotationZ(-ud.holdSpin)); ref = _href; _href.matrixWorld = _hm; }
  if (kind === 'knife' || kind === 'ball') {
    holdWorld(ref, grip, HOLD[kind], _tR, _fR, _aR, 1 / sc);
    solve(A.R, _tR, _fR, _aR, _pole.set(0.6, -0.9, 0.3).add(_tR), HOLD[kind].curl);
    // the free hand: low and relaxed, out of the way
    _tL.set(-0.2, -0.36, -0.3); _fL.set(0.2, 0.3, -0.93); _aL.set(0.9, 0.2, 0.2);
    solve(A.L, _tL, _fL, _aL, _pole.set(-0.6, -0.9, 0.3).add(_tL), [0.3, 0.35, 0.4, 0.45, 0.5]);
    return;
  }
  holdWorld(vm, grip, HOLD.grip, _tR, _fR, _aR, 1 / sc);
  solve(A.R, _tR, _fR, _aR, _pole.set(0.7, -0.9, 0.35).add(_tR), HOLD.grip.curl);
  const arm = ud.leftArm, lh = ud.leftHand || grip;
  const H = ud.lhHold && HOLD[ud.lhHold] ? HOLD[ud.lhHold] : kind === 'pistol' ? HOLD.pistol : kind === 'shotgun' ? HOLD.pump : HOLD.fore;   // (a reload or an inspect turns the hand for what it is doing)
  if (arm) holdWorld(arm, lh, H, _tL, _fL, _aL, 1 / sc); else holdWorld(vm, lh, H, _tL, _fL, _aL, 1 / sc);
  solve(A.L, _tL, _fL, _aL, _pole.set(-0.75, -0.9, 0.25).add(_tL), H.curl);
}
// the gun's built arm meshes: hidden while the real arms hold it (they come back if the real arms go)
export function hideBuiltArms(vm, hide = true) {
  vm.traverse((o) => { if (o.isMesh && isBuiltArm(o)) o.visible = !hide; });
}
