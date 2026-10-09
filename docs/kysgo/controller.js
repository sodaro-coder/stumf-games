// Kinematic character controller: Source / Quake movement with CS:GO's numbers. No rigid bodies: velocity is built by
// the classic accelerate / air-accelerate / friction functions, then moved through the world with a swept AABB
// "slide move" that clips velocity against every surface it touches (Quake's ClipVelocity). Shared by the local
// player, the host's simulation of remote players and the bots, so everyone moves by identical rules.
// Allocation free: every call works on the player object and module-level scratch values only.
import { U, PHYS } from './data.js';

// ---- movement variables (CS:GO defaults, converted from Hammer units to metres where they are distances) ----------
export const CVARS = {
  sv_accelerate: 5.5,           // ground acceleration (multiples of wish speed per second)
  sv_airaccelerate: 12,         // air acceleration
  sv_friction: 5.2,             // ground friction
  sv_stopspeed: 80 * U,         // below this speed friction acts as if moving at it: you stop dead instead of sliding
  sv_maxspeed: 250 * U,         // the fastest a weapon lets you run (each weapon sets its own, at most this)
  sv_maxvelocity: 3500 * U,     // hard cap on any velocity component
  sv_gravity: 800 * U,          // units/s²
  sv_jump_impulse: 301.993 * U, // vertical speed of a jump
  sv_air_wishcap: 30 * U,       // how much of the wish speed counts in the air: strafing skill, not W, gains speed
  sv_stepsize: 18 * U,          // ledges this high are walked up
  sv_bhop_cap: 1.55,            // a hop's landing speed is capped at this many times the run speed
  sv_jump_buffer: 0.2,          // seconds a jump pressed before landing is remembered (hops never miss)
};

// ---- velocity -------------------------------------------------------------------------------------------------------
// Source's friction: speed lost = max(speed, stopspeed) * friction * dt, so slow movement dies almost instantly.
export function applyFriction(p, dt, stopScale = 1) {
  const sp = Math.hypot(p.vx, p.vz);
  if (sp < 1e-4) { p.vx = 0; p.vz = 0; return; }
  const control = Math.max(sp, CVARS.sv_stopspeed * stopScale), drop = control * CVARS.sv_friction * dt;
  const k = Math.max(0, sp - drop) / sp;
  p.vx *= k; p.vz *= k;
}
// Accelerate toward the wish direction: only the part of the wish speed you don't already have along it is added.
export function accelerate(p, wx, wz, wishSpeed, accel, dt) {
  const add = wishSpeed - (p.vx * wx + p.vz * wz);
  if (add <= 0) return;
  const a = Math.min(accel * dt * wishSpeed, add);
  p.vx += a * wx; p.vz += a * wz;
}
// Air acceleration: the wish speed is clipped to sv_air_wishcap before the dot product, so holding W in the air adds
// almost nothing, while strafing (wish direction turning with the view) keeps adding sideways speed: bunny-hopping.
export function airAccelerate(p, wx, wz, wishSpeed, dt) {
  const capped = Math.min(wishSpeed, CVARS.sv_air_wishcap), add = capped - (p.vx * wx + p.vz * wz);
  if (add <= 0) return;
  const a = Math.min(CVARS.sv_airaccelerate * wishSpeed * dt, add);
  p.vx += a * wx; p.vz += a * wz;
}
export function clampVelocity(p) {
  const m = CVARS.sv_maxvelocity;
  if (p.vx > m) p.vx = m; else if (p.vx < -m) p.vx = -m;
  if (p.vz > m) p.vz = m; else if (p.vz < -m) p.vz = -m;
  if (p.vy > m) p.vy = m; else if (p.vy < -m) p.vy = -m;
}

// ---- collision: swept AABB against the world grid -------------------------------------------------------------------
// The world is a 1 m height grid; a cell blocks the player when its top (at the point nearest the player, so ramps
// count as the slope there) is above the step limit. Each blocking cell is an AABB; the player's box (half-width r)
// is swept against the cells expanded by r, i.e. a ray against Minkowski boxes. The earliest hit gives the time and
// the axis normal; velocity is then projected onto the wall plane and the rest of the move continues along it.
const HIT = { t: 1, nx: 0, nz: 0 };
const EPS = 1e-4;
function blocks(W, cx, cz, px, pz, lim) {
  return W.cellTop(cx, cz, px, pz) > lim;
}
function sweep(W, x, z, dx, dz, r, lim) {
  HIT.t = 1; HIT.nx = 0; HIT.nz = 0;
  const x0 = Math.floor(Math.min(x, x + dx) - r), x1 = Math.floor(Math.max(x, x + dx) + r);
  const z0 = Math.floor(Math.min(z, z + dz) - r), z1 = Math.floor(Math.max(z, z + dz) + r);
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
    if (!blocks(W, cx, cz, x, z, lim)) continue;
    // slab test of the ray (x,z)+(dx,dz)t against the cell grown by r
    const bx0 = cx - r, bx1 = cx + 1 + r, bz0 = cz - r, bz1 = cz + 1 + r;
    let tin = -Infinity, tout = Infinity, nx = 0, nz = 0;
    if (Math.abs(dx) < 1e-12) { if (x <= bx0 || x >= bx1) continue; }
    else {
      const a = (bx0 - x) / dx, b = (bx1 - x) / dx, lo = Math.min(a, b), hi = Math.max(a, b);
      if (lo > tin) { tin = lo; nx = dx > 0 ? -1 : 1; nz = 0; }
      if (hi < tout) tout = hi;
    }
    if (Math.abs(dz) < 1e-12) { if (z <= bz0 || z >= bz1) continue; }
    else {
      const a = (bz0 - z) / dz, b = (bz1 - z) / dz, lo = Math.min(a, b), hi = Math.max(a, b);
      if (lo > tin) { tin = lo; nz = dz > 0 ? -1 : 1; nx = 0; }
      if (hi < tout) tout = hi;
    }
    if (tin > tout || tout <= 0 || tin >= HIT.t) continue;
    if (tin < 0) {   // already touching: only block motion that goes further in
      if (tin < -1e-3) continue;
      tin = 0;
    }
    if (nx * dx + nz * dz >= 0) continue;   // moving away from this face
    HIT.t = tin; HIT.nx = nx; HIT.nz = nz;
  }
  return HIT;
}
// push out of any cell the box overlaps (spawned inside geometry, crouch-jumped into a ledge, ...): along the axis of
// least penetration, so you are never stuck
function depenetrate(W, p, r, lim) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let cz = Math.floor(p.z - r); cz <= Math.floor(p.z + r); cz++) for (let cx = Math.floor(p.x - r); cx <= Math.floor(p.x + r); cx++) {
      if (!blocks(W, cx, cz, p.x, p.z, lim)) continue;
      const ox = Math.min(p.x + r - cx, cx + 1 - (p.x - r)), oz = Math.min(p.z + r - cz, cz + 1 - (p.z - r));
      if (ox <= 0 || oz <= 0) continue;
      if (ox < oz) p.x += (p.x < cx + 0.5 ? -1 : 1) * (ox + EPS); else p.z += (p.z < cz + 0.5 ? -1 : 1) * (oz + EPS);
      moved = true;
    }
    if (!moved) return;
  }
}
// The slide move: up to 4 passes. Each pass sweeps the remaining motion, stops at the first wall (backed off a hair),
// clips the velocity to slide along it (v -= n * dot(v, n)) and continues with what's left of the time step.
export function slideMove(W, p, dt, r, step) {
  const lim = p.y + step + 1e-3;
  depenetrate(W, p, r, lim);
  let left = dt;
  for (let it = 0; it < 4 && left > 1e-6; it++) {
    const dx = p.vx * left, dz = p.vz * left;
    if (dx * dx + dz * dz < 1e-12) break;
    const h = sweep(W, p.x, p.z, dx, dz, r, lim);
    p.x += dx * h.t + h.nx * EPS; p.z += dz * h.t + h.nz * EPS;
    if (h.t >= 1) break;
    const d = p.vx * h.nx + p.vz * h.nz;
    if (d < 0) { p.vx -= h.nx * d; p.vz -= h.nz * d; }
    left *= 1 - h.t;
  }
}

// ---- one movement tick ------------------------------------------------------------------------------------------------
// inp: { f, s (-1..1), jump, crouch, walk, sprint, prone }. maxSpeed: the held weapon's run speed (metres/s).
export function moveStep(W, p, inp, dt, maxSpeed) {
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  let wx = -sy * inp.f + cy * inp.s, wz = -cy * inp.f - sy * inp.s;
  const wl = Math.hypot(wx, wz); if (wl > 1e-6) { wx /= wl; wz /= wl; }
  p.crouch = Math.max(0, Math.min(1, p.crouch + (inp.crouch ? 1 : -1) * dt * 8));
  p.prone = Math.max(0, Math.min(1, (p.prone || 0) + (inp.prone ? 1 : -1) * dt * 2.6));   // going prone / getting up takes a moment
  const sprint = inp.sprint && inp.f > 0.3 && p.crouch < 0.5 && !p.prone;                   // sprint: forward only, standing only
  let wish = Math.min(maxSpeed, CVARS.sv_maxspeed * PHYS.sprint) * (inp.walk ? PHYS.walk : 1) * (sprint ? PHYS.sprint : 1) * (p.crouch > 0.5 ? PHYS.crouch : 1);
  if (p.prone) wish *= 1 - p.prone * (1 - PHYS.prone);
  p.sprinting = sprint && wl > 1e-6;
  if (wl < 1e-6) wish = 0;
  const ground = W.groundAt(p.x, p.z, p.y);
  const onGround = p.y <= ground + 0.02 && p.vy <= 0;
  // jump buffer: pressed shortly before touching down (or held through the landing) = a hop on the landing frame,
  // with no ground friction that frame, so a bunny-hop always connects and keeps its speed
  if (inp.jump && !p.jumpHeld) p.jumpBuf = CVARS.sv_jump_buffer; else p.jumpBuf = Math.max(0, (p.jumpBuf || 0) - dt);
  const hop = onGround && !p.prone && (p.jumpBuf > 0 || (inp.jump && (p.landT ?? 9) < 0.04));
  if (onGround) {
    if (!hop) applyFriction(p, dt, 1 - (p.prone || 0) * 0.85);
    accelerate(p, wx, wz, wish, CVARS.sv_accelerate, dt);
    if (hop) {
      p.vy = CVARS.sv_jump_impulse; p.jumpHeld = true; p.jumpBuf = 0; p.y = ground + 0.03;
      const s2 = Math.hypot(p.vx, p.vz), cap = maxSpeed * CVARS.sv_bhop_cap;
      if (s2 > cap) { p.vx *= cap / s2; p.vz *= cap / s2; }
    } else { p.y = ground; p.vy = 0; }
  } else {
    if (wl > 1e-6) airAccelerate(p, wx, wz, wish, dt);
    p.vy -= CVARS.sv_gravity * dt;
  }
  if (!inp.jump) p.jumpHeld = false;
  clampVelocity(p);
  slideMove(W, p, dt, PHYS.radius, onGround ? CVARS.sv_stepsize : 0.05);
  p.y += p.vy * dt;
  const g2 = W.groundAt(p.x, p.z, p.y);
  if (p.y < g2) { p.y = g2; if (p.vy < 0) p.vy = 0; }
  p.onGround = p.y <= g2 + 0.02;
  p.landT = p.onGround ? (p.wasAirEnd ? 0 : (p.landT ?? 9) + dt) : 9; p.wasAirEnd = !p.onGround;
  return p.onGround;
}
