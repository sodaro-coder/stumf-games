// First-person weapon handling, per class of weapon: draw (and the first draw's flourish), holster, inspect, sprint,
// jump / land and crouch. Each is a pure function of a 0..1 progress applied to the gun group (vm), its support-hand
// piece (userData.leftArm), its magazine, slide, bolt and pump, so the real rigged arms (fparms.js, by IK) and the
// built arms (Performance, left-handed, joke guns) both follow, and a film can pin any frame.
// Gun space: x right, y up, -z down the barrel. Nothing here changes gameplay timing: the draw lives inside the
// existing deploy time, inspects can be cut by anything, the flourish is cancelled by firing, aiming, reloading.
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bell = (a, b, x) => Math.sin(Math.PI * sm(a, b, x));
const env = (a, b, c, d, x) => sm(a, b, x) * (1 - sm(c, d, x));   // up over a..b, held, down over c..d

// what kind of handling a weapon gets
export function vmClass(w, ud) {
  if (!w) return 'ball';
  if (w.cat === 'knife') return 'knife';
  if (w.cat === 'pistol' || w.id === 'zeus') return 'pistol';
  if (w.cat === 'sniper' && w.rpm < 60) return 'bolt';
  if (ud && ud.pump) return 'pump';
  if (w.cat === 'shotgun') return 'pump';
  return 'rifle';
}

// ---- draw: the gun comes up from where it was carried. Rifles swing up from a low port across the body, rolled in;
// pistols come out of the holster at the right hip muzzle-down and punch up; the knife flips up into the hand; a bolt
// gun rises heavy; a shotgun comes up from the hip. k: 0 (out of sight) .. 1 (at the ready)
export function drawPose(vm, cls, k) {
  const u = 1 - sm(0, 1, k), o = Math.sin(Math.min(1, k) * Math.PI) * (1 - k);   // u: how far still to come; o: a small overshoot as it settles
  switch (cls) {
    case 'pistol': vm.position.y -= 0.24 * u; vm.position.x += 0.05 * u; vm.position.z += 0.06 * u; vm.rotation.x -= 1.1 * u * u - 0.06 * o; vm.rotation.z -= 0.35 * u; break;
    case 'knife': vm.position.y -= 0.22 * u; vm.position.x += 0.06 * u; vm.rotation.z += 1.6 * u; vm.rotation.x += 0.8 * u - 0.1 * o; vm.rotation.y -= 0.6 * u; break;
    case 'bolt': vm.position.y -= 0.3 * u; vm.position.x -= 0.04 * u; vm.rotation.x -= 0.5 * u; vm.rotation.z += 0.75 * u + 0.05 * o; break;
    case 'pump': vm.position.y -= 0.26 * u; vm.position.x += 0.03 * u; vm.rotation.x -= 0.45 * u; vm.rotation.z += 0.55 * u + 0.05 * o; vm.rotation.y -= 0.2 * u; break;
    case 'ball': vm.position.y -= 0.25 * u; vm.rotation.x -= 0.5 * u; break;
    default: vm.position.y -= 0.28 * u; vm.position.x -= 0.06 * u; vm.rotation.x -= 0.55 * u; vm.rotation.z += 0.7 * u + 0.06 * o; vm.rotation.y += 0.25 * u;
  }
}
// ---- holster: the old weapon goes away before the next comes up (the reverse path, faster). k: 0 (ready) .. 1 (gone)
export function holsterPose(vm, cls, k) { drawPose(vm, cls, 1 - sm(0, 1, k) * 0.999); }

// ---- the first draw of a weapon after you spawn or pick it up: the action is worked once, the way a soldier makes
// ready (rifles: the support hand pulls the charging handle; pistols: the slide racked over the top; the knife spun;
// a bolt gun's bolt run; a shotgun racked). k: 0..1 over FLOURISH[cls] seconds
export const FLOURISH = { rifle: 1.05, pistol: 0.85, knife: 0.9, bolt: 1.1, pump: 0.8 };
export function flourishPose(vm, cls, k, ud) {
  const arm = ud.leftArm, hand = ud.leftHand, a = bell(0.05, 0.95, k);
  if (cls === 'knife') { vm.rotation.z += Math.PI * 2 * sm(0.15, 0.7, k); vm.position.y += 0.03 * a; vm.rotation.x += 0.25 * a; ud.holdSpin = Math.PI * 2 * sm(0.15, 0.7, k); return; }
  vm.rotation.z += 0.32 * a; vm.rotation.y -= 0.12 * a; vm.position.y += 0.012 * a;
  if (!arm || !hand) return;
  let p = null; const pull = env(0.35, 0.5, 0.58, 0.72, k);
  if (cls === 'rifle' && ud.charge) { p = { x: ud.charge.x - hand.x, y: ud.charge.y - hand.y + 0.01, z: ud.charge.z - hand.z + 0.07 * pull }; ud.lhHold = 'over'; if (ud.bolt) ud.bolt.position.z = (ud.boltTravel || 0.07) * pull; }
  else if (cls === 'pistol') { p = { x: -0.005 - hand.x, y: (ud.grip ? ud.grip.y : 0) + 0.04 - hand.y, z: (ud.grip ? ud.grip.z : 0) + 0.005 - hand.z + 0.035 * pull }; ud.lhHold = 'over'; if (ud.slide) ud.slide.position.z = 0.032 * pull; }
  else if (cls === 'pump' && ud.pump) { ud.pump.position.z = 0.075 * bell(0.3, 0.75, k); arm.position.z += 0.075 * bell(0.3, 0.75, k); return; }
  else if (cls === 'bolt' && ud.bolt) { const lift = env(0.2, 0.32, 0.72, 0.84, k); ud.bolt.rotation.z = -1.0 * lift; ud.bolt.position.z = (ud.boltTravel || 0.09) * env(0.34, 0.48, 0.58, 0.7, k); vm.rotation.z += 0.12 * a; return; }
  if (!p) return;
  const reach = env(0.12, 0.32, 0.78, 0.95, k);
  arm.position.set(p.x * reach, p.y * reach, p.z * reach);
}

// ---- inspect: you look your weapon over. Rifles: rolled to show the right side, then the left, then the magazine is
// thumbed out a little and checked and slapped home. Pistols: turned to the side, then a press check (the slide eased
// back with the support hand over the top to see brass). The knife: turned, flipped in the hand, shown on both sides.
// A bolt gun: tipped up, the bolt lifted and drawn back an inch to see the chamber, closed. A shotgun: rolled, the
// pump eased back to check the chamber. k: 0..1 over INSPECT[cls] seconds
export const INSPECT = { rifle: 3.6, pistol: 3.0, knife: 2.8, bolt: 3.6, pump: 3.2, ball: 2.2 };
export function inspectPose(vm, cls, k, ud) {
  const arm = ud.leftArm, hand = ud.leftHand, inOut = env(0, 0.12, 0.88, 1, k);
  vm.position.z += 0.06 * inOut; vm.position.x -= 0.05 * inOut; vm.position.y += 0.02 * inOut;   // brought in closer to look at
  const side1 = env(0.04, 0.2, 0.3, 0.42, k), side2 = env(0.34, 0.46, 0.54, 0.66, k);
  if (cls === 'knife') {
    vm.rotation.y += 0.9 * side1 - 0.5 * side2; vm.rotation.z -= 0.7 * side1 + 0.9 * side2; vm.rotation.x += 0.3 * inOut;
    const flip = sm(0.42, 0.56, k) * Math.PI;   // a half turn about the blade: the other face shown
    vm.rotation.z += flip; ud.holdSpin = flip;
    vm.rotation.y -= 0.6 * env(0.6, 0.72, 0.8, 0.9, k);
    return;
  }
  if (cls === 'ball') { vm.rotation.y += 0.8 * side1; vm.rotation.x += 0.4 * side2; return; }
  // the turns: show the right side (roll left, yaw toward you), then the left (roll right); a pistol is held up and
  // turned flat to the eye instead
  if (cls === 'pistol') { vm.position.y += 0.05 * inOut; vm.position.x -= 0.03 * inOut; vm.rotation.y += 0.95 * side1 - 0.55 * side2; vm.rotation.z += 0.2 * side1 - 0.35 * side2; vm.rotation.x += 0.15 * inOut; }
  else { vm.rotation.y += 0.75 * side1 - 0.35 * side2; vm.rotation.z += 0.55 * side1 - 0.8 * side2; vm.rotation.x += 0.12 * side1 + 0.1 * side2; }
  if (!arm || !hand) return;
  const chk = env(0.62, 0.7, 0.84, 0.9, k);   // the check
  vm.rotation.z += 0.3 * chk; vm.rotation.x += 0.12 * chk;
  if (cls === 'rifle' && ud.magGroup && ud.magPos) {   // magazine: grabbed, eased down an inch, looked at, seated with the heel of the hand
    const grab = env(0.58, 0.66, 0.86, 0.94, k), drop = env(0.68, 0.73, 0.8, 0.84, k), m = ud.magPos;
    arm.position.set((m.x - hand.x) * grab, (m.y - 0.04 - hand.y - 0.035 * drop) * grab, (m.z + 0.01 - hand.z) * grab);
    ud.magGroup.position.y = -0.035 * drop; ud.magGroup.position.z = 0.004 * drop; ud.lhHold = grab > 0.3 ? 'mag' : null;
    vm.position.z += 0.012 * Math.exp(-Math.pow((k - 0.845) / 0.012, 2));   // the slap home
  } else if (cls === 'pistol') {   // press check: the hand over the top, the slide eased back a centimetre
    const g = ud.grip || hand, grab = env(0.56, 0.64, 0.86, 0.93, k), back = env(0.66, 0.72, 0.8, 0.85, k);
    arm.position.set((-0.004 - hand.x) * grab, (g.y + 0.04 - hand.y) * grab, (g.z + 0.005 - hand.z + 0.012 * back) * grab);   // fingers on the rear serrations
    if (ud.slide) ud.slide.position.z = 0.012 * back; ud.lhHold = grab > 0.3 ? 'over' : null;
  } else if (cls === 'bolt' && ud.bolt) {   // the bolt lifted and drawn back to see the chamber
    const lift = env(0.6, 0.66, 0.84, 0.9, k), back = env(0.66, 0.72, 0.8, 0.84, k);
    ud.bolt.rotation.z = -1.0 * lift; ud.bolt.position.z = 0.03 * back; vm.rotation.z += 0.15 * lift; vm.rotation.x += 0.15 * lift;
  } else if (cls === 'pump' && ud.pump) {   // the pump eased back to see a shell in the chamber
    const back = env(0.62, 0.7, 0.8, 0.86, k); ud.pump.position.z = 0.03 * back; arm.position.z += 0.03 * back;
  }
}

// ---- moving: sprint (rifles canted across the chest at a high port, pistols tucked in close, the knife pumping with
// the stride), the jump (the gun lags down as you rise, floats up as you fall) and crouching (lower, rolled in a touch)
export function movePose(vm, cls, { sprintK = 0, bob = 0, vy = 0, air = false, crouch = 0, hand = 1 }) {
  if (sprintK > 0.01) {
    const s = sprintK, st = Math.sin(bob), st2 = Math.abs(Math.cos(bob));
    if (cls === 'pistol') { vm.rotation.x -= 0.55 * s; vm.position.y -= 0.06 * s; vm.position.z += 0.05 * s; vm.position.x -= 0.03 * s * hand; }
    else if (cls === 'knife' || cls === 'ball') { vm.position.y -= 0.03 * s - st2 * 0.03 * s; vm.rotation.x -= 0.25 * s; vm.position.x += st * 0.03 * s; }
    else { vm.rotation.x -= 0.15 * s; vm.rotation.y += 0.62 * s * hand; vm.rotation.z += 0.42 * s * hand; vm.position.y -= 0.02 * s; vm.position.x -= 0.07 * s * hand; vm.position.z += 0.02 * s; }
    vm.position.x += st * 0.012 * s; vm.position.y += (st2 - 0.5) * 0.016 * s; vm.rotation.z += st * 0.05 * s;   // the stride
  }
  if (air) { const k = Math.max(-1, Math.min(1, vy / 5)); vm.position.y -= 0.025 * k; vm.rotation.x -= 0.06 * k; }
  if (crouch > 0.01) { vm.position.y -= 0.012 * crouch; vm.rotation.z += 0.05 * crouch * hand; vm.position.x -= 0.006 * crouch * hand; }
}
