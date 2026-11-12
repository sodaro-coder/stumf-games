// Ragdoll: a body going limp. When a soldier dies, his joints become point masses (verlet) held at their bone lengths,
// the torso a rigid box of hips, shoulders, neck and the top of the legs; gravity takes him down, knees and elbows fold
// only the way a person's do, and every point is a ball of its own size that lands on the map's floor, steps, stairs and
// crates and stops against walls (the map is a height grid: a cell taller than a step is a wall). Each frame the bones
// are turned so they run between their points (the clip's twist and the hands and fingers stay as they were), so the
// skinned body, its wounds and its gear follow.
// The shot's push is the round's real momentum (ballistics.js: mass x velocity) given to the few kilograms around the
// hit, so a pistol hardly moves a body and he simply drops; a shotgun or a .338 up close shoves the hit part back.
// Fixed 1/60 s steps (at most 6 a frame: a slow frame slows the fall, it never throws the body). A body that has stopped
// moving sleeps and costs nothing. A severed limb's points leave the simulation.
import * as THREE from '../sdk/three.module.min.js';

const STEP = 1 / 60, ITER = 10, G = 9.81;
// [name, bone, radius m, mass share]; 'HeadC' is the middle of the skull (from the Head bone and the top of the head)
const PTS = [['Hips', 'Hips', 0.12, 3], ['Chest', 'Spine2', 0.14, 3], ['Neck', 'Neck', 0.07, 1], ['HeadC', 'Head', 0.11, 1.2],
  ['LArm', 'LeftArm', 0.07, 1], ['LFore', 'LeftForeArm', 0.05, 0.8], ['LHand', 'LeftHand', 0.045, 0.5],
  ['RArm', 'RightArm', 0.07, 1], ['RFore', 'RightForeArm', 0.05, 0.8], ['RHand', 'RightHand', 0.045, 0.5],
  ['LUp', 'LeftUpLeg', 0.09, 2], ['LLeg', 'LeftLeg', 0.07, 1.5], ['LFoot', 'LeftFoot', 0.05, 0.8], ['LToe', 'LeftToeBase', 0.035, 0.3],
  ['RUp', 'RightUpLeg', 0.09, 2], ['RLeg', 'RightLeg', 0.07, 1.5], ['RFoot', 'RightFoot', 0.05, 0.8], ['RToe', 'RightToeBase', 0.035, 0.3]];
const TORSO = ['Hips', 'Chest', 'Neck', 'LArm', 'RArm', 'LUp', 'RUp'];
const LINKS = [['Neck', 'HeadC'], ['LArm', 'LFore'], ['LFore', 'LHand'], ['RArm', 'RFore'], ['RFore', 'RHand'],
  ['LUp', 'LLeg'], ['LLeg', 'LFoot'], ['LFoot', 'LToe'], ['RUp', 'RLeg'], ['RLeg', 'RFoot'], ['RFoot', 'RToe']];
// not closer than this share of their starting distance: elbows and knees do not fold flat, the head does not sink into the chest, feet don't fold into the shin
const MINS = [['LArm', 'LHand', 0.42], ['RArm', 'RHand', 0.42], ['LUp', 'LFoot', 0.38], ['RUp', 'RFoot', 0.38], ['HeadC', 'Chest', 0.85], ['HeadC', 'LArm', 0.8], ['HeadC', 'RArm', 0.8],
  ['LLeg', 'LToe', 0.85], ['RLeg', 'RToe', 0.85], ['LHand', 'Chest', 0.3], ['RHand', 'Chest', 0.3], ['LFoot', 'RFoot', 0.0], ['LLeg', 'RLeg', 0.0]];
// bones turned to follow their points: [bone, from point, to point] (direction only, twist kept); the hips and the chest
// take a whole frame (up and across) from their points
const AIM = [['LeftArm', 'LArm', 'LFore'], ['LeftForeArm', 'LFore', 'LHand'], ['RightArm', 'RArm', 'RFore'], ['RightForeArm', 'RFore', 'RHand'],
  ['LeftUpLeg', 'LUp', 'LLeg'], ['LeftLeg', 'LLeg', 'LFoot'], ['LeftFoot', 'LFoot', 'LToe'], ['RightUpLeg', 'RUp', 'RLeg'], ['RightLeg', 'RLeg', 'RFoot'], ['RightFoot', 'RFoot', 'RToe'], ['Neck', 'Neck', 'HeadC']];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();

function frameOf(P, o, upFrom, upTo, l, r, out) {   // an orthonormal frame: y up the body, x across it (left to right)
  const y = _a.copy(P[upTo].p).sub(P[upFrom].p).normalize(), x = _b.copy(P[r].p).sub(P[l].p); x.addScaledVector(y, -x.dot(y)).normalize(); const z = _c.crossVectors(x, y);
  out.makeBasis(x, y, z); return o ? out.setPosition(o) : out;
}

// start: r (a soldier rig with r.bones), W (the world: topAt), opts: { dir: unit {x,y,z} of the shot, imp: kg m/s, at: point name hit, vel: body velocity }
export function startRagdoll(r, W, { dir = null, imp = 0, at = 'Chest', vel = null, lost = null } = {}) {
  const B = r.bones; if (!B || !B.Hips || !(B.Spine2 || B.Spine1) || !B.Head || !B.LeftLeg || !B.RightLeg) return null;
  const chestB = B.Spine2 || B.Spine1;   // one of the two soldier files has no third spine bone
  r.g.updateMatrixWorld(true);
  const P = {}, gone = new Set();
  if (lost) for (const n of lost) for (const [pn, bn] of PTS) { let b = B[bn]; while (b) { if (b === B[n]) { gone.add(pn); break; } b = b.parent; } }
  for (const [pn, bn, rad, m] of PTS) {
    const b = (pn === 'Chest' ? chestB : B[bn]) || (pn === 'LToe' ? B.LeftFoot : pn === 'RToe' ? B.RightFoot : null); if (!b) return null;
    const p = b.getWorldPosition(new THREE.Vector3());
    if (pn === 'HeadC') { const top = B.HeadTop_End ? B.HeadTop_End.getWorldPosition(new THREE.Vector3()) : p.clone().add(new THREE.Vector3(0, 0.2, 0)); p.lerp(top, 0.45); }
    if ((pn === 'LToe' || pn === 'RToe') && !B[bn]) { p.y -= 0.05; p.z -= 0.12; }
    const v = vel ? new THREE.Vector3(vel.x || 0, Math.max(0, vel.y || 0), vel.z || 0) : new THREE.Vector3();
    P[pn] = { p, o: p.clone().addScaledVector(v, -STEP), rad, w: 1 / m, off: gone.has(pn) };
  }
  // the round's push: momentum over the few kg around the hit (shared with the neighbours), a person's whole mass is never moved by a bullet
  if (dir && imp > 0 && P[at]) {
    const near = { Chest: ['Chest', 'Neck', 'LArm', 'RArm'], HeadC: ['HeadC', 'Neck'], Hips: ['Hips', 'LUp', 'RUp'], LArm: ['LArm', 'LFore'], RArm: ['RArm', 'RFore'], LUp: ['LUp', 'LLeg'], RUp: ['RUp', 'RLeg'] }[at] || [at];
    const kg = { Chest: 8, HeadC: 4.5, Hips: 10, LArm: 3, RArm: 3, LUp: 6, RUp: 6 }[at] || 8, dv = imp / kg;   // the part of the body that takes the hit in the first instant
    for (const n of near) { const q = P[n], k = n === at ? 1 : 0.6; q.o.x -= dir.x * dv * k * STEP; q.o.y -= dir.y * dv * k * STEP; q.o.z -= dir.z * dv * k * STEP; }
  }
  const C = [];
  const link = (a, b, stiff = 1) => { if (P[a].off || P[b].off) return; C.push({ a: P[a], b: P[b], L: P[a].p.distanceTo(P[b].p), s: stiff, min: 0 }); };
  for (let i = 0; i < TORSO.length; i++) for (let j = i + 1; j < TORSO.length; j++) link(TORSO[i], TORSO[j], 1);
  for (const [a, b] of LINKS) link(a, b, 1);
  for (const [a, b, k] of MINS) { if (P[a].off || P[b].off) continue; const L = P[a].p.distanceTo(P[b].p); C.push({ a: P[a], b: P[b], L: k > 0 ? L * k : P[a].rad + P[b].rad, s: 1, min: 1 }); }
  // each bone's starting world rotation and direction (what the pose was: the bones only swing from there)
  const aims = [];
  for (const [bn, f, t] of AIM) { const b = B[bn]; if (!b || P[f].off || P[t].off) continue; aims.push({ b, f: P[f], t: P[t], q0: b.getWorldQuaternion(new THREE.Quaternion()), d0: P[t].p.clone().sub(P[f].p).normalize() }); }
  const F0h = frameOf(P, null, 'Hips', 'Chest', 'LUp', 'RUp', new THREE.Matrix4()), F0c = frameOf(P, null, 'Chest', 'Neck', 'LArm', 'RArm', new THREE.Matrix4());
  const qh = new THREE.Quaternion().setFromRotationMatrix(F0h).invert(), qc = new THREE.Quaternion().setFromRotationMatrix(F0c).invert();
  const hipsOff = B.Hips.getWorldPosition(new THREE.Vector3()).sub(P.Hips.p).applyQuaternion(qh);   // where the hip bone sits in the pelvis frame
  r.rd = { P, C, aims, t: 0, acc: 0, still: 0, asleep: false, W, g0p: r.g.position.clone(), g0q: r.g.quaternion.clone(),
    hips: { q0: B.Hips.getWorldQuaternion(new THREE.Quaternion()), inv: qh, off: hipsOff }, chest: { b: chestB, q0: chestB.getWorldQuaternion(new THREE.Quaternion()), inv: qc },
    head: B.Head ? { b: B.Head, q0: B.Head.getWorldQuaternion(new THREE.Quaternion()), inv: qc.clone() } : null };
  return r.rd;
}

function collide(W, q, fric) {
  const rad = q.rad, p = q.p, o = q.o;
  if (W && W.topAt) {
    // walls: a neighbouring cell taller than a step above this point stops it (pushed back out on that axis)
    const lim = Math.max(p.y, o.y) - rad + 0.33;
    for (const [dx, dz] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) {
      const cx = Math.floor(p.x + dx), cz = Math.floor(p.z + dz);
      if (cx === Math.floor(p.x) && cz === Math.floor(p.z)) continue;
      if (W.topAt(cx + 0.5, cz + 0.5) > lim) { if (dx > 0) p.x = cx - rad - 1e-3; else if (dx < 0) p.x = cx + 1 + rad + 1e-3; else if (dz > 0) p.z = cz - rad - 1e-3; else p.z = cz + 1 + rad + 1e-3; }
    }
    let fl = W.topAt(p.x, p.z);
    if (fl > Math.max(p.y, o.y) - rad + 0.33) { p.x = o.x; p.z = o.z; fl = W.topAt(p.x, p.z); }   // ran into a wall's cell itself: back out
    if (p.y < fl + rad) {   // on the floor: lifted out, and friction drags it (cloth on sand or stone)
      p.y = fl + rad; if (fric) { o.x = p.x + (o.x - p.x) * 0.55; o.z = p.z + (o.z - p.z) * 0.55; if (o.y < p.y) o.y = p.y - (p.y - o.y) * 0.2; }
    }
  }
}

export function stepRagdoll(r, dt) {
  const rd = r.rd; if (!rd) return false;
  r.g.position.copy(rd.g0p); r.g.quaternion.copy(rd.g0q); r.g.updateMatrixWorld(true);   // the body stays where it fell, whatever the network says about the dead player
  rd.t += dt; if (rd.asleep) return true;
  rd.acc = Math.min(rd.acc + dt, STEP * 6);
  const P = rd.P, pts = Object.values(P);
  let moved = 0;
  while (rd.acc >= STEP) {
    rd.acc -= STEP;
    const damp = rd.t < 0.25 ? 0.995 : 0.985;
    for (const q of pts) { if (q.off) continue; const vx = (q.p.x - q.o.x) * damp, vy = (q.p.y - q.o.y) * damp, vz = (q.p.z - q.o.z) * damp; q.o.copy(q.p); q.p.x += vx; q.p.y += vy - G * STEP * STEP; q.p.z += vz; }
    for (let it = 0; it < ITER; it++) {
      for (const c of rd.C) {
        const a = c.a, b = c.b; _a.copy(b.p).sub(a.p); const d = _a.length() || 1e-6;
        if (c.min && d >= c.L) continue;
        const k = (d - c.L) / d / (a.w + b.w) * c.s; a.p.addScaledVector(_a, k * a.w); b.p.addScaledVector(_a, -k * b.w);
      }
      knees(P);
      for (const q of pts) if (!q.off) collide(rd.W, q, it === ITER - 1);
    }
    for (const q of pts) if (!q.off) moved = Math.max(moved, q.p.distanceToSquared(q.o));
  }
  // asleep once nothing has moved more than ~1.5 mm a step for half a second (or after 8 s whatever happens)
  if (moved < 2.3e-6) rd.still += dt; else rd.still = 0;
  if (rd.still > 0.5 || rd.t > 8) rd.asleep = true;
  applyBones(r);
  return rd.asleep;
}
// knees bend forward only: a knee that has gone behind the line from the hip to the foot is put back on it (the
// pelvis' own front decides which way is forward); elbows are only kept from folding flat (MINS)
function knees(P) {
  const fw = _c.copy(P.LUp.p).sub(P.RUp.p).cross(_b.copy(P.Chest.p).sub(P.Hips.p)).normalize();
  for (const [h, k, f] of [['LUp', 'LLeg', 'LFoot'], ['RUp', 'RLeg', 'RFoot']]) {
    const H = P[h], K = P[k], F = P[f]; if (H.off || K.off || F.off) continue;
    _a.copy(F.p).sub(H.p); const L2 = _a.lengthSq(); if (L2 < 1e-6) continue;
    const t = _b.copy(K.p).sub(H.p).dot(_a) / L2; _b.copy(H.p).addScaledVector(_a, t);
    const side = (K.p.x - _b.x) * fw.x + (K.p.y - _b.y) * fw.y + (K.p.z - _b.z) * fw.z;
    if (side < 0) K.p.addScaledVector(fw, -side * 1.05);
  }
}
const _F = new THREE.Matrix4();
function applyBones(r) {
  const rd = r.rd, B = r.bones, P = rd.P;
  // hips: position and the pelvis frame
  _q.setFromRotationMatrix(frameOf(P, null, 'Hips', 'Chest', 'LUp', 'RUp', _F)).multiply(rd.hips.inv).multiply(rd.hips.q0);
  setWorld(B.Hips, _q, _a.copy(rd.hips.off).applyQuaternion(_q2.setFromRotationMatrix(_F)).add(P.Hips.p));
  // chest (the spine between keeps the pose it had: the chest's own frame carries the shoulders)
  _q.setFromRotationMatrix(frameOf(P, null, 'Chest', 'Neck', 'LArm', 'RArm', _F)).multiply(rd.chest.inv).multiply(rd.chest.q0);
  setWorld(rd.chest.b, _q, null);
  for (const a of rd.aims) {
    _a.copy(a.t.p).sub(a.f.p).normalize(); _q.setFromUnitVectors(a.d0, _a).multiply(a.q0);
    setWorld(a.b, _q, null);
    if (a.b === B.Neck && rd.head) { _q3.setFromUnitVectors(a.d0, _a).multiply(rd.head.q0); setWorld(rd.head.b, _q3, null); }
  }
}
function setWorld(b, qWorld, pWorld) {
  const par = b.parent; par.updateWorldMatrix(true, false);
  par.getWorldQuaternion(_q2); b.quaternion.copy(_q2.invert().multiply(qWorld));
  if (pWorld) { b.position.copy(par.worldToLocal(_b.copy(pWorld))); }
  b.updateMatrixWorld(true);
}
export function stopRagdoll(r) { r.rd = null; }
// is this a part that's been cut off? (its points are dropped; game.js tells the ragdoll after a dismemberment)
export function ragdollLose(r, lost) { const rd = r.rd; if (!rd || !lost) return; const B = r.bones;
  for (const [pn, bn] of PTS) { let b = B[bn]; while (b) { if (lost.some((n) => B[n] === b)) { rd.P[pn].off = true; break; } b = b.parent; } }
  rd.C = rd.C.filter((c) => !c.a.off && !c.b.off); rd.aims = rd.aims.filter((a) => !a.f.off && !a.t.off); }
