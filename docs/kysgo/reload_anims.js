// ============================================================================
// reload_anims.js — cinematic first-person reload choreography for KYS:GO
//
// WHAT: a drop-in, high-fidelity replacement for the closure-local
// `reloadPose(vm, w, k)` inside game.js. Every weapon family gets a
// hand-choreographed sequence:
//
//   * box-mag rifles / SMGs (AR, AK, bullpup, MP5, P90, Bizon …):
//     mag-release thumb press, strip, pouch retrieve, insert (rock-and-lock
//     for AKs, straight for ARs), palm-strike seat, then the correct charge:
//     AR rear-handle pull, AK right-side bolt, MP5 cocking-tube slap,
//     bullpup top handle
//   * pistols: release press, drop, fresh mag, heel-of-palm seat, overhand
//     slide grab -> pull -> release (slide slams), or a thumb flick on the
//     slide release for tactical reloads; Deagle gets heavier everything
//   * bolt snipers (AWP/SSG08): short mag cycle, then a crisp 4-beat bolt —
//     LIFT (wrist roll, gun rolls toward the hand), PULL, PUSH, LOCK DOWN
//   * belt-feds (M249/Negev): feed-cover flip, old box out, fresh box in,
//     belt laid across the tray, cover SLAMMED, charging handle
//   * revolver (R8): cylinder swings out, muzzle-up eject, speedloader in,
//     snap shut
//   * dualies: alternating compact cycles, left gun then right gun
//   * MAG-7: mag cycle plus a finishing pump tug
//   * tube shotguns: enhanced shell-by-shell — dip to the carrier, rise with
//     a shell, thumb it into the port, gun dips to meet the hand
//
// The support hand genuinely travels to the part it operates (mag well,
// charging handle, bolt knob, slide, feed cover, cylinder). The arm rolls to
// suggest grip changes (fist around the mag, palm strike, overhand slide
// grab, bolt wrist-roll). The gun answers with jolts when the mag seats and
// the action slams home.
//
// WHY A PATCH MODULE: game.js is ~180KB — too big to push through the file
// API — so this ships as an importable module. Integration is 3 tiny edits:
//
//  1. index.html — add BEFORE the game.js import:
//       import './reload_anims.js';
//     (this module self-registers window.__RELOAD_POSE__ / __RELOAD_CUES__)
//  2. game.js render loop (~line 1626) — change:
//       if (animReload) reloadPose(vm, w, me.reload > 0 && w ? 1 - me.reload / w.reload : -1);
//     to:
//       if (animReload) (window.__RELOAD_POSE__ || reloadPose)(vm, w, me.reload > 0 && w ? 1 - me.reload / w.reload : -1);
//  3. game.js startReload() — right after `me.reloadEmpty = it.ammo === 0;` add:
//       window.__RELOAD_EMPTY__ = me.reloadEmpty;
//     (optional; without it the patch assumes a full empty reload)
//  4. (optional, recommended) game.js startReload() — replace the sound
//     scheduling block with the cue table from this module so the foley
//     lands exactly on the new beats:
//       const cues = (window.__RELOAD_CUES__ || (() => []))(w.id, me.reloadEmpty);
//       const it0 = it, at = (f, n, v = 0.6) => setTimeout(() => { if (me.inv[me.cur] === it0 && me.reload > 0) audio.play(n, v); }, w.reload * f * 1000);
//       for (const c of cues) at(c.f, c.n, c.v);
//
// SIGNATURE: improvedReloadPose(vm, w, k, emptyOverride)
//   vm            — first-person viewmodel Group. Uses vm.userData: leftArm,
//                   leftHand, magPos, magGroup, charge.
//   w             — weapon def. Uses w.id, w.cat, w.shellReload.
//   k             — reload progress 0..1. k < 0 means "not reloading": the
//                   pose fully resets (mirrors the original contract).
//   emptyOverride — optional bool. Defaults to window.__RELOAD_EMPTY__,
//                   else assumes an empty (full) reload.
//
// All gun-body offsets are ADDITIVE (vm.rotation.x += ...) so this composes
// with the breathing / sway / ADS pose code that runs around it. The support
// arm is positioned absolutely relative to its rest pose, exactly like the
// original implementation.
// ============================================================================

import * as THREE from '../sdk/three.module.min.js';

export const RELOAD_ANIMS_VERSION = '1.0.0';

/* ================================ math =================================== */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
// smoothstep between a and b
const sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// ease in-out for deliberate hand moves
const eio = (x) => { const t = clamp01(x); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
// Gaussian bump centered at c, width w — for jolts, presses, snaps
const bump = (k, c, w) => Math.exp(-((k - c) * (k - c)) / (2 * w * w));
// out = lerp(p0, p1, clamp01(t))
function segV(out, p0, p1, t) { return out.copy(p0).lerp(p1, clamp01(t)); }

const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
const HAND_FB = new THREE.Vector3(0, -0.12, 0.12);   // fallback support-hand rest
const MAG_FB = new THREE.Vector3(0, -0.07, 0.06);    // fallback mag-well position

/* ========================= choreography tables =========================== */
// charge kinds:
//   pull   — AR-style rear charging handle (straight back)
//   side   — AK-style bolt on the receiver's right side
//   slap   — MP5-style: hand slaps the cocking tube down-forward
//   bolt   — bolt-action: lift / pull / push / lock (4 crisp beats)
//   slide  — pistol: overhand slide grab, pull, release
//   top    — bullpup top charging handle
//   pump   — MAG-7: finishing pump tug
//   none   — no charging motion
const FAM = {
  ar:       { tilt: 0.42, jolt: 1.00, charge: 'pull' },
  ak:       { tilt: 0.30, jolt: 1.00, charge: 'side', rock: 0.55 },
  bullpup:  { tilt: 0.26, jolt: 0.90, charge: 'top', noseUp: 0.30 },
  slap:     { tilt: 0.36, jolt: 1.00, charge: 'slap' },
  smg:      { tilt: 0.34, jolt: 0.90, charge: 'pull', flick: true },
  p90:      { tilt: 0.20, jolt: 0.90, charge: 'side', top: true },
  bizon:    { tilt: 0.30, jolt: 0.90, charge: 'side' },
  pistol:   { tilt: 0.25, jolt: 0.80, charge: 'slide' },
  heavy:    { tilt: 0.38, jolt: 1.50, charge: 'slide' },
  bolt:     { tilt: 0.36, jolt: 1.00, charge: 'bolt' },
  belt:     { tilt: 0.55, jolt: 1.40, charge: 'pull', cover: true },
  revolver: { tilt: 0.55, jolt: 1.20, charge: 'none', cyl: true },
  dual:     { tilt: 0.30, jolt: 0.80, charge: 'slide', dual: true },
  magshot:  { tilt: 0.40, jolt: 1.20, charge: 'pump' },
  shell:    { tilt: 0.35, jolt: 0.70, charge: 'none' },
};
const BY_ID = {
  ak47: 'ak', galil: 'ak',
  m4a4: 'ar', m4a1s: 'ar', scar20: 'ar', sg553: 'ar', mp7: 'ar', mp9: 'ar',
  famas: 'bullpup', aug: 'bullpup',
  mp5: 'slap', ump: 'slap', g3sg1: 'slap',
  mac10: 'smg',
  p90: 'p90', bizon: 'bizon',
  glock: 'pistol', usp: 'pistol', p2000: 'pistol', p250: 'pistol', tec9: 'pistol',
  fiveseven: 'pistol', cz75: 'pistol',
  deagle: 'heavy',
  ssg08: 'bolt', awp: 'bolt',
  m249: 'belt', negev: 'belt',
  r8: 'revolver',
  dualies: 'dual',
  mag7: 'magshot',
  nova: 'shell', xm1014: 'shell', sawedoff: 'shell',
};
const styleFor = (w) => {
  const fam = BY_ID[w.id]
    || (w.cat === 'pistol' ? 'pistol' : w.cat === 'smg' ? 'smg' : w.cat === 'sniper' ? 'bolt' : w.cat === 'heavy' ? 'shell' : 'ar');
  return Object.assign({ wid: w.id }, FAM[fam] || FAM.ar);
};

/* Where the charging hand goes, per charge kind (viewmodel space). */
function chargePos(out, ud, S, mp) {
  if (S.charge === 'pull' && ud.charge) return out.copy(ud.charge);
  switch (S.charge) {
    case 'side':  return out.copy(mp).add(_t1.set(0.075, 0.085, 0.030));
    case 'slap':  return out.copy(mp).add(_t1.set(0.000, 0.105, -0.100));
    case 'bolt':  return out.copy(mp).add(_t1.set(0.075, 0.075, 0.150));
    case 'top':   return out.copy(mp).add(_t1.set(0.000, 0.135, 0.030));
    case 'slide': return out.copy(mp).add(_t1.set(0.000, 0.115, 0.045));
    case 'pump':  return out.copy(mp).add(_t1.set(0.000, -0.020, -0.160));
    default:      return ud.charge ? out.copy(ud.charge) : out.copy(mp).add(_t1.set(0, 0.08, 0.1));
  }
}

/* Sum of Gaussian jolts -> applied to vm.position (z back, y down a touch). */
function applyJolts(vm, S, list, k) {
  let j = 0;
  for (let i = 0; i < list.length; i++) j += list[i][2] * bump(k, list[i][0], list[i][1]);
  j *= S.jolt;
  vm.position.z += j;
  vm.position.y -= j * 0.35;
}

/* ============================ sound cues ================================ */
// Fractions line up with the choreography below. Uses the game's existing
// foley names only: 'magout' | 'magin' | 'bolt' | 'shell'.
const CUES = {
  ar:      (e) => [[0.075, 'magout', 0.6], [0.505, 'magin', 0.6], ...(e ? [[0.72, 'bolt', 0.6]] : [])],
  ak:      (e) => [[0.075, 'magout', 0.6], [0.505, 'magin', 0.6], ...(e ? [[0.72, 'bolt', 0.65]] : [])],
  bullpup: (e) => [[0.075, 'magout', 0.6], [0.505, 'magin', 0.6], ...(e ? [[0.72, 'bolt', 0.6]] : [])],
  slap:    (e) => [[0.075, 'magout', 0.6], [0.505, 'magin', 0.6], ...(e ? [[0.685, 'bolt', 0.7]] : [])],
  smg:     (e) => [[0.075, 'magout', 0.6], [0.505, 'magin', 0.6], ...(e ? [[0.72, 'bolt', 0.6]] : [])],
  p90:     (e) => [[0.12, 'magout', 0.6], [0.50, 'magin', 0.6], ...(e ? [[0.68, 'bolt', 0.6]] : [])],
  bizon:   (e) => [[0.075, 'magout', 0.6], [0.505, 'magin', 0.6], ...(e ? [[0.72, 'bolt', 0.6]] : [])],
  pistol:  (e) => [[0.07, 'magout', 0.6], [0.465, 'magin', 0.6], ...(e ? [[0.67, 'bolt', 0.65]] : [[0.55, 'bolt', 0.35]])],
  heavy:   (e) => [[0.07, 'magout', 0.65], [0.465, 'magin', 0.65], ...(e ? [[0.67, 'bolt', 0.7]] : [[0.55, 'bolt', 0.4]])],
  bolt:    (e) => [[0.08, 'magout', 0.6], [0.48, 'magin', 0.6], ...(e ? [[0.62, 'bolt', 0.4], [0.70, 'bolt', 0.45], [0.86, 'bolt', 0.55]] : [])],
  belt:    (e) => [[0.14, 'bolt', 0.4], [0.26, 'magout', 0.6], [0.48, 'magin', 0.6], [0.58, 'bolt', 0.7], ...(e ? [[0.72, 'bolt', 0.6]] : [])],
  revolver:(e) => [[0.16, 'bolt', 0.35], [0.27, 'shell', 0.5], [0.44, 'magin', 0.5], [0.54, 'bolt', 0.5]],
  dual:    (e) => [[0.06, 'magout', 0.6], [0.36, 'magin', 0.6], [0.50, 'magout', 0.6], [0.80, 'magin', 0.6]],
  magshot: (e) => [[0.08, 'magout', 0.6], [0.46, 'magin', 0.6], [0.70, 'bolt', 0.5]],
  shell:   (e) => [],
};
export function getReloadCues(wid, empty) {
  const fn = CUES[BY_ID[wid] || 'ar'] || CUES.ar;
  return fn(!!empty).map(([f, n, v]) => ({ f, n, v }));
}

/* ============================ main entry ================================ */
export function improvedReloadPose(vm, w, k, emptyArg) {
  const ud = vm.userData, arm = ud.leftArm, mg = ud.magGroup;

  // ---- reset path: identical contract to the original ----
  if (k < 0 || !w) {
    if (arm) {
      arm.position.set(0, 0, 0); arm.rotation.set(0, 0, 0);
      if (arm.userData.shell) arm.userData.shell.visible = false;
    }
    if (mg) { mg.position.set(0, 0, 0); mg.rotation.set(0, 0, 0); mg.visible = true; }
    return;
  }
  if (!arm) return;

  const empty = emptyArg !== undefined ? !!emptyArg
    : (typeof window !== 'undefined' && window.__RELOAD_EMPTY__ !== undefined) ? !!window.__RELOAD_EMPTY__
    : true;

  const S = styleFor(w);

  if (w.shellReload) { poseShell(vm, arm, S, k); return; }

  const hand = ud.leftHand || HAND_FB;
  const mp = ud.magPos || MAG_FB;
  const ctx = {
    ud, arm, mg, S, hand, mp, empty,
    atMag: new THREE.Vector3().copy(mp).add(new THREE.Vector3(0, -0.03, 0.02)),
    pouch: new THREE.Vector3().copy(mp).add(new THREE.Vector3(0.05, -0.38, 0.12)),
  };

  if (S.dual) poseDualies(vm, ctx, k);
  else if (S.cyl) poseRevolver(vm, ctx, k);
  else if (S.cover) poseBelt(vm, ctx, k, empty);
  else if (S.top) poseTopLoader(vm, ctx, k, empty);
  else if (S.charge === 'bolt') poseBoltAction(vm, ctx, k, empty);
  else if (S.charge === 'slide') posePistol(vm, ctx, k, empty);
  else if (S.charge === 'pump') poseMagShotgun(vm, ctx, k, empty);
  else poseBoxMag(vm, ctx, k, empty);
}

/* Shared gun-body language: tilt in, present the mag well, settle back. */
function bodyPresent(vm, S, k, recoverAt) {
  const env = sm(0, 0.10, k) * (1 - sm(recoverAt - 0.18, recoverAt, k));
  vm.rotation.z += S.tilt * env;
  vm.rotation.x += (0.12 + (S.noseUp || 0)) * env;
  vm.position.y -= 0.025 * env;
  return env;
}

/* The old mag falls away; the fresh one rides up seated in the fist. */
function magMesh(mg, S, tgt, atMag, k, stripA, stripB, grabB, seatB) {
  if (!mg) return;
  if (k < stripA) { mg.position.set(0, 0, 0); mg.rotation.set(0, 0, 0); mg.visible = true; }
  else if (k < stripB) {
    const f = eio(sm(stripA, stripB, k));
    mg.position.set(0.01 * f, -0.15 * f, 0.04 * f);
    mg.rotation.set(0.45 * f, 0, 0.15 * f); mg.visible = true;
  }
  else if (k < grabB) mg.visible = false;
  else if (k < seatB) {
    mg.visible = true;
    mg.position.copy(tgt).sub(atMag); mg.position.y += 0.012;
    const rock = S.rock ? S.rock * Math.sin(Math.PI * sm(grabB, seatB, k)) * 0.5 : 0;
    mg.rotation.set(0.15 * (1 - sm(grabB, seatB, k)) + rock, 0, 0.06);
  }
  else { mg.position.set(0, 0, 0); mg.rotation.set(0, 0, 0); mg.visible = true; }
}

/* ================= box-mag rifles / SMGs (AR, AK, bullpup, slap) ========= */
function poseBoxMag(vm, ctx, k, empty) {
  const { arm, mg, S, hand, atMag, pouch, mp, ud } = ctx;
  const tgt = new THREE.Vector3();
  bodyPresent(vm, S, k, empty ? 1.0 : 0.86);
  if (S.flick) vm.rotation.z += 0.30 * bump(k, 0.14, 0.03);            // flick the empty free
  vm.position.y -= 0.006 * bump(k, 0.075, 0.012);                        // thumb hits the mag release

  const ch = chargePos(new THREE.Vector3(), ud, S, mp);
  const chBack = ch.clone().add(new THREE.Vector3(0, S.charge === 'slap' ? -0.055 : 0, S.charge === 'slap' ? 0.045 : 0.075));

  if (k < 0.08) segV(tgt, hand, atMag, eio(sm(0, 0.08, k)));                          // reach for the mag
  else if (k < 0.18) segV(tgt, atMag, _t1.copy(atMag).add(_t2.set(0, -0.13, 0.03)), eio(sm(0.08, 0.18, k))); // strip it down
  else if (k < 0.30) {                                                                // retrieve a fresh one
    if (k < 0.26) segV(tgt, _t1.copy(atMag).add(_t2.set(0, -0.13, 0.03)), pouch, eio(sm(0.18, 0.26, k)));
    else tgt.copy(pouch);                                                             // dwell: fingers close on the mag
  }
  else if (k < 0.48) segV(tgt, pouch, atMag, eio(sm(0.30, 0.48, k)));                 // drive it home
  else if (k < 0.54) { tgt.copy(atMag); tgt.y += 0.018 * Math.sin(Math.PI * sm(0.48, 0.54, k)); } // PALM STRIKE
  else if (empty && k < 0.62) segV(tgt, atMag, ch, eio(sm(0.54, 0.62, k)));            // to the charging handle
  else if (empty && k < 0.72) {                                                       // CHARGE
    if (S.charge === 'slap') {
      if (k < 0.66) segV(tgt, ch, chBack, eio(sm(0.62, 0.66, k)) ** 0.7);              // the HK slap: violent and fast
      else segV(tgt, chBack, hand, eio(sm(0.66, 0.72, k)));
    } else {
      if (k < 0.70) segV(tgt, ch, chBack, eio(sm(0.62, 0.70, k)));                     // pull...
      else segV(tgt, chBack, hand, eio(sm(0.70, 0.78, k)));                            // ...release, hand comes home
    }
  }
  else if (!empty && k < 0.62) { tgt.copy(atMag); tgt.y += 0.008 * Math.sin(Math.PI * sm(0.54, 0.62, k)); } // tactical: reassuring pat
  else segV(tgt, empty ? chBack : atMag, hand, eio(sm(empty ? 0.72 : 0.62, empty ? 0.92 : 0.80, k)));       // recover

  // fist-around-the-mag wrist language
  const gripEnv = sm(0.06, 0.12, k) * (1 - sm(0.50, 0.60, k));
  const chEnv = empty ? sm(0.60, 0.66, k) * (1 - sm(0.74, 0.84, k)) : 0;
  arm.rotation.set(-0.32 * gripEnv - 0.30 * bump(k, 0.51, 0.018) - 0.15 * chEnv, 0, 0.14 * gripEnv + 0.12 * chEnv);
  arm.position.copy(tgt).sub(hand);

  magMesh(mg, S, tgt, atMag, k, 0.08, 0.17, 0.30, 0.48);

  const jolts = empty
    ? [[0.505, 0.012, 0.014], [S.charge === 'slap' ? 0.685 : 0.72, 0.020, 0.020]]
    : [[0.505, 0.012, 0.014], [0.58, 0.015, 0.006]];
  applyJolts(vm, S, jolts, k);
}

/* ============================ pistols ==================================== */
function posePistol(vm, ctx, k, empty) {
  const { arm, mg, S, hand, atMag, pouch, mp } = ctx;
  const tgt = new THREE.Vector3();
  bodyPresent(vm, S, k, empty ? 1.0 : 0.84);
  vm.position.y -= 0.005 * bump(k, 0.07, 0.012);                         // thumb on the mag release

  const slide = new THREE.Vector3().copy(mp).add(new THREE.Vector3(0, 0.115, 0.045)); // overhand grab point
  const slideBack = slide.clone().add(new THREE.Vector3(0, 0, 0.062));

  if (k < 0.08) segV(tgt, hand, atMag, eio(sm(0, 0.08, k)));
  else if (k < 0.16) segV(tgt, atMag, _t1.copy(atMag).add(_t2.set(0, -0.11, 0.03)), eio(sm(0.08, 0.16, k)));
  else if (k < 0.28) {
    if (k < 0.24) segV(tgt, _t1.copy(atMag).add(_t2.set(0, -0.11, 0.03)), pouch, eio(sm(0.16, 0.24, k)));
    else tgt.copy(pouch);
  }
  else if (k < 0.44) segV(tgt, pouch, atMag, eio(sm(0.28, 0.44, k)));
  else if (k < 0.50) { tgt.copy(atMag); tgt.y += 0.016 * Math.sin(Math.PI * sm(0.44, 0.50, k)); } // heel-of-palm seat
  else if (empty && k < 0.58) segV(tgt, atMag, slide, eio(sm(0.50, 0.58, k)));          // hand rides up over the slide
  else if (empty && k < 0.70) {
    if (k < 0.66) segV(tgt, slide, slideBack, eio(sm(0.58, 0.66, k)));                 // drag it back...
    else segV(tgt, slideBack, _t1.copy(slide).add(_t2.set(0, -0.05, 0.10)), eio(sm(0.66, 0.72, k))); // ...let it fly
  }
  else if (!empty && k < 0.60) segV(tgt, atMag, _t1.copy(slide).lerp(atMag, 0.55), Math.sin(Math.PI * sm(0.50, 0.60, k))); // thumb flicks the slide release
  else segV(tgt, empty ? slideBack : atMag, hand, eio(sm(empty ? 0.70 : 0.60, empty ? 0.90 : 0.80, k)));

  // overhand grip while racking: palm down over the slide
  const gripEnv = sm(0.06, 0.12, k) * (1 - sm(0.44, 0.52, k));
  const slideEnv = empty ? sm(0.54, 0.60, k) * (1 - sm(0.68, 0.76, k)) : 0;
  arm.rotation.set(-0.30 * gripEnv + 0.55 * slideEnv, 0, 0.12 * gripEnv);
  arm.position.copy(tgt).sub(hand);

  magMesh(mg, S, tgt, atMag, k, 0.08, 0.15, 0.28, 0.44);

  const jolts = empty
    ? [[0.465, 0.012, 0.013], [0.67, 0.016, 0.024]]
    : [[0.465, 0.012, 0.013], [0.55, 0.014, 0.008]];
  applyJolts(vm, S, jolts, k);
  if (empty) vm.position.z -= 0.010 * bump(k, 0.67, 0.014);   // the slide slamming home shoves the muzzle
}

/* ====================== bolt-action snipers ============================== */
function poseBoltAction(vm, ctx, k, empty) {
  const { arm, mg, S, hand, atMag, pouch, mp, ud } = ctx;
  const tgt = new THREE.Vector3();
  bodyPresent(vm, S, k, 1.0);
  vm.position.y -= 0.005 * bump(k, 0.07, 0.012);

  const knob = chargePos(new THREE.Vector3(), ud, S, mp);
  const knobUp = knob.clone().add(new THREE.Vector3(0, 0.048, 0));
  const knobBack = knobUp.clone().add(new THREE.Vector3(0, 0, 0.105));

  if (k < 0.08) segV(tgt, hand, atMag, eio(sm(0, 0.08, k)));
  else if (k < 0.17) segV(tgt, atMag, _t1.copy(atMag).add(_t2.set(0, -0.12, 0.03)), eio(sm(0.08, 0.17, k)));
  else if (k < 0.29) {
    if (k < 0.25) segV(tgt, _t1.copy(atMag).add(_t2.set(0, -0.12, 0.03)), pouch, eio(sm(0.17, 0.25, k)));
    else tgt.copy(pouch);
  }
  else if (k < 0.46) segV(tgt, pouch, atMag, eio(sm(0.29, 0.46, k)));
  else if (k < 0.52) { tgt.copy(atMag); tgt.y += 0.016 * Math.sin(Math.PI * sm(0.46, 0.52, k)); }
  else if (!empty) segV(tgt, atMag, hand, eio(sm(0.52, 0.70, k)));
  else if (k < 0.58) segV(tgt, atMag, knob, eio(sm(0.52, 0.58, k)));        // hand finds the bolt knob
  else if (k < 0.64) segV(tgt, knob, knobUp, eio(sm(0.58, 0.64, k)));       // LIFT — bolt rotates up
  else if (k < 0.72) segV(tgt, knobUp, knobBack, eio(sm(0.64, 0.72, k)));   // PULL — bolt slides back
  else if (k < 0.75) tgt.copy(knobBack);                                    // dwell: chamber checked
  else if (k < 0.83) segV(tgt, knobBack, knobUp, eio(sm(0.75, 0.83, k)));  // PUSH — drive it home
  else if (k < 0.88) segV(tgt, knobUp, knob, eio(sm(0.83, 0.88, k)));      // LOCK DOWN
  else segV(tgt, knob, hand, eio(sm(0.88, 0.97, k)));                       // recover

  // the rifle rolls in toward the bolt hand; wrist rolls with the lift
  const liftEnv = empty ? sm(0.58, 0.64, k) * (1 - sm(0.83, 0.88, k)) : 0;
  vm.rotation.z -= 0.22 * liftEnv;
  const gripEnv = sm(0.06, 0.12, k) * (1 - sm(0.46, 0.54, k));
  arm.rotation.set(-0.30 * gripEnv, 0, 0.12 * gripEnv + 0.50 * liftEnv);
  arm.position.copy(tgt).sub(hand);

  magMesh(mg, S, tgt, atMag, k, 0.08, 0.16, 0.29, 0.46);

  const jolts = empty
    ? [[0.485, 0.012, 0.013], [0.86, 0.014, 0.012]]
    : [[0.485, 0.012, 0.013]];
  applyJolts(vm, S, jolts, k);
}

/* ==================== belt-feds (M249 / Negev) =========================== */
function poseBelt(vm, ctx, k, empty) {
  const { arm, mg, S, hand, atMag, pouch, mp, ud } = ctx;
  const tgt = new THREE.Vector3();
  const env = bodyPresent(vm, S, k, empty ? 1.0 : 0.88);
  vm.position.y += 0.020 * env;                                            // the gun comes up to the chest

  const cover = new THREE.Vector3().copy(mp).add(new THREE.Vector3(0, 0.13, -0.02)); // feed cover
  const trayL = new THREE.Vector3().copy(mp).add(new THREE.Vector3(-0.07, 0.10, 0.0));
  const trayR = new THREE.Vector3().copy(mp).add(new THREE.Vector3(0.07, 0.10, 0.0));
  const ch = chargePos(new THREE.Vector3(), ud, S, mp);
  const chBack = ch.clone().add(new THREE.Vector3(0, 0, 0.075));

  if (k < 0.10) segV(tgt, hand, cover, eio(sm(0, 0.10, k)));
  else if (k < 0.20) { segV(tgt, cover, _t1.copy(cover).add(_t2.set(0, 0.06, 0.06)), eio(sm(0.10, 0.20, k))); vm.rotation.x -= 0.16 * sm(0.10, 0.20, k); } // COVER UP
  else if (k < 0.30) segV(tgt, _t1.copy(cover).add(_t2.set(0, 0.06, 0.06)), pouch, eio(sm(0.20, 0.30, k))); // old box out, hand dives
  else if (k < 0.48) segV(tgt, pouch, atMag, eio(sm(0.30, 0.48, k)));        // fresh box seats
  else if (k < 0.56) segV(tgt, trayL, trayR, eio(sm(0.48, 0.56, k)));       // belt laid across the tray
  else if (k < 0.62) { tgt.copy(trayR); tgt.y -= 0.035 * Math.sin(Math.PI * sm(0.56, 0.62, k)); } // COVER SLAM
  else if (empty && k < 0.70) segV(tgt, trayR, ch, eio(sm(0.62, 0.70, k)));
  else if (empty && k < 0.78) {
    if (k < 0.74) segV(tgt, ch, chBack, eio(sm(0.70, 0.74, k)));
    else segV(tgt, chBack, hand, eio(sm(0.74, 0.82, k)));
  }
  else segV(tgt, empty ? chBack : trayR, hand, eio(sm(empty ? 0.74 : 0.62, empty ? 0.94 : 0.82, k)));

  arm.rotation.set(-0.25 * sm(0.28, 0.36, k) * (1 - sm(0.56, 0.64, k)), 0, 0.10 * env);
  arm.position.copy(tgt).sub(hand);

  if (mg) {
    if (k < 0.22) { mg.position.set(0, 0, 0); mg.rotation.set(0, 0, 0); mg.visible = true; }
    else if (k < 0.30) { const f = eio(sm(0.22, 0.30, k)); mg.position.set(0.02 * f, -0.20 * f, 0.06 * f); mg.visible = true; }
    else if (k < 0.32) mg.visible = false;
    else if (k < 0.48) { mg.visible = true; mg.position.copy(tgt).sub(atMag); mg.position.y += 0.012; mg.rotation.set(0, 0, 0); }
    else { mg.position.set(0, 0, 0); mg.rotation.set(0, 0, 0); mg.visible = true; }
  }

  const jolts = empty
    ? [[0.585, 0.016, 0.026], [0.72, 0.020, 0.020]]
    : [[0.585, 0.016, 0.026]];
  applyJolts(vm, S, jolts, k);
}

/* ========================= revolver (R8) ================================= */
function poseRevolver(vm, ctx, k) {
  const { arm, S, hand, mp } = ctx;
  const tgt = new THREE.Vector3();
  const env = bodyPresent(vm, S, k, 1.0);
  vm.rotation.x -= 0.22 * env;                                             // nose tips up

  const cyl = new THREE.Vector3().copy(mp).add(new THREE.Vector3(-0.06, 0.02, 0.0)); // cylinder, swings out left
  const eject = cyl.clone().add(new THREE.Vector3(0, 0.03, -0.04));

  if (k < 0.12) segV(tgt, hand, cyl, eio(sm(0, 0.12, k)));
  else if (k < 0.22) { segV(tgt, cyl, _t1.copy(cyl).add(_t2.set(-0.03, 0, 0)), eio(sm(0.12, 0.22, k))); vm.rotation.z += 0.28 * sm(0.12, 0.22, k); } // cylinder out
  else if (k < 0.32) { tgt.copy(eject); tgt.z -= 0.035 * Math.sin(Math.PI * sm(0.24, 0.32, k)); }  // punch the ejector rod
  else if (k < 0.48) { segV(tgt, eject, cyl, eio(sm(0.32, 0.48, k))); arm.rotation.y = 0.55 * Math.sin(Math.PI * sm(0.36, 0.48, k)); } // speedloader in + twist
  else if (k < 0.56) { tgt.copy(cyl); }                                    // snap shut
  else segV(tgt, cyl, hand, eio(sm(0.56, 0.78, k)));

  if (!(k >= 0.32 && k < 0.48)) arm.rotation.y *= 0.9; // ease the twist out (kept simple)
  arm.rotation.x = -0.2 * env;
  arm.position.copy(tgt).sub(hand);

  applyJolts(vm, S, [[0.27, 0.014, 0.010], [0.54, 0.014, 0.020]], k);        // ejector tick, cylinder snap
  vm.rotation.z -= 0.28 * sm(0.48, 0.56, k);                               // gun levels as it snaps shut
}

/* ===================== P90 top-loader ==================================== */
function poseTopLoader(vm, ctx, k, empty) {
  const { arm, mg, S, hand, pouch, mp, ud } = ctx;
  const tgt = new THREE.Vector3();
  bodyPresent(vm, S, k, empty ? 1.0 : 0.86);

  const topMag = new THREE.Vector3().copy(mp).add(new THREE.Vector3(0, 0.10, 0.06));
  const topBack = topMag.clone().add(new THREE.Vector3(0, 0.02, 0.15));    // mag slides out rearward
  const ch = chargePos(new THREE.Vector3(), ud, S, mp);
  const chBack = ch.clone().add(new THREE.Vector3(0, 0, 0.09));

  if (k < 0.10) segV(tgt, hand, topMag, eio(sm(0, 0.10, k)));
  else if (k < 0.22) segV(tgt, topMag, topBack, eio(sm(0.10, 0.22, k)));    // slide the long mag out the back
  else if (k < 0.34) {
    if (k < 0.30) segV(tgt, topBack, pouch, eio(sm(0.22, 0.30, k)));
    else tgt.copy(pouch);
  }
  else if (k < 0.44) segV(tgt, pouch, topBack, eio(sm(0.34, 0.44, k)));
  else if (k < 0.52) segV(tgt, topBack, topMag, eio(sm(0.44, 0.52, k)));    // slide the fresh one home
  else if (empty && k < 0.60) segV(tgt, topMag, ch, eio(sm(0.52, 0.60, k)));
  else if (empty && k < 0.70) {
    if (k < 0.66) segV(tgt, ch, chBack, eio(sm(0.60, 0.66, k)));
    else segV(tgt, chBack, hand, eio(sm(0.66, 0.74, k)));
  }
  else segV(tgt, empty ? chBack : topMag, hand, eio(sm(empty ? 0.70 : 0.54, empty ? 0.90 : 0.78, k)));

  arm.rotation.set(-0.45 * sm(0.08, 0.16, k) * (1 - sm(0.48, 0.56, k)), 0, 0); // hand works overhead
  arm.position.copy(tgt).sub(hand);

  if (mg) {
    if (k < 0.10) { mg.position.set(0, 0, 0); mg.rotation.set(0, 0, 0); mg.visible = true; }
    else if (k < 0.22) { const f = eio(sm(0.10, 0.22, k)); mg.position.set(0, 0.02 * f, 0.15 * f); mg.visible = true; }
    else if (k < 0.34) mg.visible = false;
    else if (k < 0.52) { mg.visible = true; mg.position.copy(tgt).sub(topMag); }
    else { mg.position.set(0, 0, 0); mg.rotation.set(0, 0, 0); mg.visible = true; }
  }

  const jolts = empty ? [[0.51, 0.012, 0.013], [0.68, 0.020, 0.018]] : [[0.51, 0.012, 0.013]];
  applyJolts(vm, S, jolts, k);
}

/* ================== mag-fed shotgun (MAG-7) ============================== */
function poseMagShotgun(vm, ctx, k, empty) {
  const { arm, mg, S, hand, atMag, pouch, mp, ud } = ctx;
  const tgt = new THREE.Vector3();
  bodyPresent(vm, S, k, 1.0);
  vm.position.y -= 0.005 * bump(k, 0.07, 0.012);

  const pump = chargePos(new THREE.Vector3(), ud, S, mp);
  const pumpBack = pump.clone().add(new THREE.Vector3(0, 0, 0.055));

  if (k < 0.08) segV(tgt, hand, atMag, eio(sm(0, 0.08, k)));
  else if (k < 0.17) segV(tgt, atMag, _t1.copy(atMag).add(_t2.set(0, -0.12, 0.03)), eio(sm(0.08, 0.17, k)));
  else if (k < 0.29) {
    if (k < 0.25) segV(tgt, _t1.copy(atMag).add(_t2.set(0, -0.12, 0.03)), pouch, eio(sm(0.17, 0.25, k)));
    else tgt.copy(pouch);
  }
  else if (k < 0.46) segV(tgt, pouch, atMag, eio(sm(0.29, 0.46, k)));
  else if (k < 0.52) { tgt.copy(atMag); tgt.y += 0.016 * Math.sin(Math.PI * sm(0.46, 0.52, k)); }
  else if (k < 0.60) segV(tgt, atMag, pump, eio(sm(0.52, 0.60, k)));        // hand to the pump
  else if (k < 0.72) {
    if (k < 0.66) segV(tgt, pump, pumpBack, eio(sm(0.60, 0.66, k)));       // tug back...
    else segV(tgt, pumpBack, pump, eio(sm(0.66, 0.72, k)));                // ...slam forward
  }
  else segV(tgt, pump, hand, eio(sm(0.72, 0.90, k)));

  const gripEnv = sm(0.06, 0.12, k) * (1 - sm(0.46, 0.54, k));
  arm.rotation.set(-0.30 * gripEnv, 0, 0.12 * gripEnv);
  arm.position.copy(tgt).sub(hand);

  magMesh(mg, S, tgt, atMag, k, 0.08, 0.16, 0.29, 0.46);
  applyJolts(vm, S, [[0.485, 0.012, 0.013], [0.70, 0.018, 0.020]], k);
}

/* ========================= dualies ======================================= */
// One compact pistol cycle, u in 0..1. Writes hand target into tgt.
function dualCycle(tgt, u, hand, atMag, pouch, slide) {
  const sb = _t1.copy(slide).add(_t2.set(0, 0, 0.055));
  if (u < 0.10) segV(tgt, hand, atMag, eio(u / 0.10));
  else if (u < 0.22) segV(tgt, atMag, _t1.copy(atMag).add(_t2.set(0, -0.11, 0.03)), eio((u - 0.10) / 0.12));
  else if (u < 0.36) {
    if (u < 0.30) segV(tgt, _t1.copy(atMag).add(_t2.set(0, -0.11, 0.03)), pouch, eio((u - 0.22) / 0.08));
    else tgt.copy(pouch);
  }
  else if (u < 0.58) segV(tgt, pouch, atMag, eio((u - 0.36) / 0.22));
  else if (u < 0.66) { tgt.copy(atMag); tgt.y += 0.015 * Math.sin(Math.PI * (u - 0.58) / 0.08); }
  else if (u < 0.80) segV(tgt, atMag, slide, eio((u - 0.66) / 0.14));
  else if (u < 0.88) segV(tgt, slide, sb, eio((u - 0.80) / 0.08));
  else segV(tgt, sb, hand, eio((u - 0.88) / 0.12));
}
function poseDualies(vm, ctx, k) {
  const { arm, mg, S, hand, atMag, pouch, mp } = ctx;
  const tgt = new THREE.Vector3();
  const env = bodyPresent(vm, S, k, 1.0);
  const slide = new THREE.Vector3().copy(mp).add(new THREE.Vector3(0, 0.115, 0.045));

  // the pair shifts: left gun serviced first, then right
  const shift = (-0.035 * (1 - sm(0.42, 0.48, k)) + 0.035 * sm(0.42, 0.48, k)) * (1 - sm(0.92, 1.0, k));
  vm.position.x += shift * env;

  if (k < 0.44) dualCycle(tgt, k / 0.44, hand, atMag, pouch, slide);
  else if (k < 0.48) tgt.copy(hand).lerp(atMag, 0.4);
  else if (k < 0.90) dualCycle(tgt, (k - 0.48) / 0.42, hand, atMag, pouch, slide);
  else segV(tgt, atMag, hand, eio(sm(0.90, 0.98, k)));

  arm.rotation.set(-0.28 * env, 0, 0.12 * env);
  arm.position.copy(tgt).sub(hand);

  // the shared mag mesh follows whichever gun is being serviced
  if (mg) {
    const u = k < 0.44 ? k / 0.44 : (k - 0.48) / 0.42;
    const active = (k < 0.44 && u > 0.36 && u < 0.58) || (k >= 0.48 && k < 0.90 && u > 0.36 && u < 0.58);
    if (active) { mg.visible = true; mg.position.copy(tgt).sub(atMag); mg.position.y += 0.012; mg.rotation.set(0.1, 0, 0.05); }
    else if ((u > 0.22 && u < 0.36) || (k >= 0.44 && k < 0.48)) mg.visible = false;
    else { mg.position.set(0, 0, 0); mg.rotation.set(0, 0, 0); mg.visible = true; }
  }

  applyJolts(vm, S, [[0.36 * 0.44 + 0.22, 0.012, 0.012], [0.48 + 0.42 * 0.58, 0.012, 0.012], [0.48 + 0.42 * 0.86, 0.016, 0.018]], k);
}

/* ============ tube shotguns: shell-by-shell (per-shell cycle) ============ */
function poseShell(vm, arm, S, k) {
  const ud = vm.userData;
  const hand = ud.leftHand || HAND_FB;
  const mp = ud.magPos || MAG_FB;
  const tgt = new THREE.Vector3();
  const carrier = new THREE.Vector3().copy(mp).add(new THREE.Vector3(0.06, -0.30, 0.10)); // shell carrier / pouch
  const port = new THREE.Vector3().copy(mp).add(new THREE.Vector3(0, 0.015, 0.06));       // loading port

  const env = sm(0, 0.12, k) * (1 - sm(0.78, 1, k));
  vm.rotation.z += S.tilt * env;
  vm.rotation.x += 0.10 * env;

  if (k < 0.22) segV(tgt, hand, carrier, eio(sm(0.02, 0.22, k)));          // dip for a shell
  else if (k < 0.32) tgt.copy(carrier);                                     // fingers close on the brass
  else if (k < 0.54) segV(tgt, carrier, port, eio(sm(0.32, 0.54, k)));     // rise with it
  else if (k < 0.64) { tgt.copy(port); tgt.y += 0.012; tgt.z -= 0.010; }   // THUMB it into the port
  else segV(tgt, port, hand, eio(sm(0.64, 0.86, k)));                       // hand drops for the next

  const shell = arm.userData.shell;
  if (shell) shell.visible = k > 0.24 && k < 0.60;                         // shell rides in the fist
  vm.position.y -= 0.008 * bump(k, 0.58, 0.03);                             // gun dips to meet the thumb
  vm.rotation.x += 0.06 * bump(k, 0.58, 0.03);

  arm.rotation.set(-0.25 * sm(0.30, 0.50, k) * (1 - sm(0.60, 0.75, k)), 0, 0.10 * env);
  arm.position.copy(tgt).sub(hand);
  applyJolts(vm, S, [[0.60, 0.020, 0.008]], k);                             // soft click as the shell seats
}

/* ======================== self-registration ============================= */
if (typeof window !== 'undefined') {
  window.__RELOAD_POSE__ = improvedReloadPose;
  window.__RELOAD_CUES__ = getReloadCues;
  window.__RELOAD_ANIMS_VERSION__ = RELOAD_ANIMS_VERSION;
}
