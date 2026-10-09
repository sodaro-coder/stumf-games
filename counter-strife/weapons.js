// Hitscan weapons: spread, spray patterns, view recoil and bullet tracing (hitboxes, wall penetration), shared by the
// local player, the host and the bots. Everything here is allocation free per shot: hitboxes go into one shared
// Float64Array, a trace writes into a reusable TraceResult (pooled hit and wall-hit records), and recoil writes into
// caller-owned {up, side} objects. Callers that keep a hit past the next trace copy the fields they need.
import { U, LEAN } from './data.js';
import { recoilPatternInto } from './guns.js';

// ---- hitboxes ---------------------------------------------------------------------------------------------------------
// four AABBs per player: head, chest, stomach, legs ([x0,y0,z0,x1,y1,z1] each, 24 floats). Leaning moves the head and
// chest sideways (you only show what you peek with); crouching shrinks the stack; prone lays it flat along the facing.
export const GROUPS = ['head', 'chest', 'stomach', 'legs'];
const HB = new Float64Array(24);
function put(k, x0, y0, z0, x1, y1, z1) { const o = k * 6; HB[o] = x0; HB[o + 1] = y0; HB[o + 2] = z0; HB[o + 3] = x1; HB[o + 4] = y1; HB[o + 5] = z1; }
function putAlong(k, p, fx, fz, d, r, y0, y1) { put(k, p.x + fx * d - r, p.y + y0, p.z + fz * d - r, p.x + fx * d + r, p.y + y1, p.z + fz * d + r); }
export function fillHitboxes(p) {
  const yaw = p.yaw || 0;
  if ((p.prone || 0) > 0.6) {   // lying down: head out in front, legs behind, everything low
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    putAlong(0, p, fx, fz, 0.72, 0.15, 0.12, 0.45); putAlong(1, p, fx, fz, 0.3, 0.24, 0.02, 0.38);
    putAlong(2, p, fx, fz, -0.1, 0.22, 0.02, 0.32); putAlong(3, p, fx, fz, -0.62, 0.26, 0.0, 0.26);
    return HB;
  }
  const k = 1 - (p.crouch || 0) * 0.28, y = p.y, l = (p.lean || 0) * LEAN, cx = Math.cos(yaw), sz = -Math.sin(yaw);
  const hx = cx * l, hz = sz * l, chx = hx * 0.55, chz = hz * 0.55, stx = hx * 0.2, stz = hz * 0.2;
  put(0, p.x + hx - 0.15, y + 1.5 * k, p.z + hz - 0.15, p.x + hx + 0.15, y + 1.86 * k, p.z + hz + 0.15);
  put(1, p.x + chx - 0.24, y + 1.15 * k, p.z + chz - 0.24, p.x + chx + 0.24, y + 1.5 * k, p.z + chz + 0.24);
  put(2, p.x + stx - 0.22, y + 0.9 * k, p.z + stz - 0.22, p.x + stx + 0.22, y + 1.15 * k, p.z + stz + 0.22);
  put(3, p.x - 0.22, y, p.z - 0.2, p.x + 0.22, y + 0.9 * k, p.z + 0.2);
  return HB;
}
// entry distance of the ray o + d*t into box k of a hitbox array, or -1
export function slabT(o, d, b, k, maxT) {
  const i = k * 6; let t0 = 0, t1 = maxT;
  // x
  if (Math.abs(d.x) < 1e-9) { if (o.x < b[i] || o.x > b[i + 3]) return -1; }
  else { let a = (b[i] - o.x) / d.x, c = (b[i + 3] - o.x) / d.x; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1; }
  // y
  if (Math.abs(d.y) < 1e-9) { if (o.y < b[i + 1] || o.y > b[i + 4]) return -1; }
  else { let a = (b[i + 1] - o.y) / d.y, c = (b[i + 4] - o.y) / d.y; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1; }
  // z
  if (Math.abs(d.z) < 1e-9) { if (o.z < b[i + 2] || o.z > b[i + 5]) return -1; }
  else { let a = (b[i + 2] - o.z) / d.z, c = (b[i + 5] - o.z) / d.z; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1; }
  return t0;
}
// the allocating form, for anything outside the hot path that wants [group, box] pairs
export function hitboxes(p) { const b = fillHitboxes(p); return GROUPS.map((g, k) => [g, Array.from(b.subarray(k * 6, k * 6 + 6))]); }

// ---- tracing ------------------------------------------------------------------------------------------------------------
// one bullet: up to 2 players hit, up to 3 surfaces passed (thin walls are shot through, each costing penetration power)
export class TraceResult {
  constructor() {
    this.hits = []; this.wallHits = []; this.end = null;
    this._hitPool = Array.from({ length: 4 }, () => ({ id: null, group: '', dist: 0, pen: 1 }));
    this._wallPool = Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 0, m: 0 }));
    this._end = { x: 0, y: 0, z: 0, m: 0 };
    this._ids = [];
  }
  reset() { this.hits.length = 0; this.wallHits.length = 0; this.end = null; this._ids.length = 0; return this; }
}
const SHARED = new TraceResult();
export function traceShot(W, players, shooterId, o, d, w, range = 8192 * U, out = SHARED) {
  const res = out.reset();
  let t = 0, pen = 1;
  for (let n = 0; n < 3; n++) {
    const wall = W.ray(o, d, range, t), wallT = wall ? wall.t : range;
    // the closest player in [t, wallT)
    let bestT = Infinity, bestP = null, bestG = 0;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.alive || p.id === shooterId || res._ids.includes(p.id)) continue;
      const b = fillHitboxes(p);
      for (let k = 0; k < 4; k++) { const tt = slabT(o, d, b, k, wallT); if (tt >= t && tt < bestT) { bestT = tt; bestP = p; bestG = k; } }
    }
    if (bestP) {
      const h = res._hitPool[res.hits.length]; h.id = bestP.id; h.group = GROUPS[bestG]; h.dist = bestT; h.pen = pen;
      res.hits.push(h); res._ids.push(bestP.id);
      if (res.hits.length >= 2) break;
      n--; continue;   // look for a second body along the same stretch (doesn't use up a wall pass; max 2 hits)
    }
    if (!wall) { const e = res._end; e.x = o.x + d.x * range; e.y = o.y + d.y * range; e.z = o.z + d.z * range; e.m = 0; res.end = e; break; }
    const pt = res._wallPool[res.wallHits.length]; pt.x = o.x + d.x * wall.t; pt.y = o.y + d.y * wall.t; pt.z = o.z + d.z * wall.t; pt.m = wall.m;
    res.wallHits.push(pt); res.end = pt;
    const th = W.thickness(o, d, wall.t), cost = th * W.density(wall.m), cap = (w.pen || 1) * 0.55;
    if (!isFinite(th) || cost >= cap) break;
    pen *= (1 - cost / cap) * 0.85; t = wall.t + th + 0.01;
    if (pen < 0.1) break;
  }
  return res;
}
// a direction from view angles (yaw about +y, pitch up), into a reusable vector
export function aimDir(yaw, pitch, out) { const c = Math.cos(pitch); out.x = -Math.sin(yaw) * c; out.y = Math.sin(pitch); out.z = -Math.cos(yaw) * c; return out; }

// ---- spread --------------------------------------------------------------------------------------------------------------
// inaccuracy for the current state: standing / moving / in the air / crouched / prone / scoped, plus the spray
export function spreadOf(w, p, scoped, sprayIdx) {
  const inacc = w.inacc, stand = inacc ? inacc[0] : 0.005, move = inacc ? inacc[1] : 0.03, jump = inacc ? inacc[2] : 0.1;
  const speed = Math.hypot(p.vx || 0, p.vz || 0), ref = (w.speed || 250) * U;
  if (w.zoom && scoped && w.scopedInacc) return w.scopedInacc + (p.onGround ? 0 : jump) + Math.max(0, speed / ref - 0.34) * move;
  const sp = Math.min(1, speed / ref);
  let s = stand * ((p.prone || 0) > 0.6 ? 0.5 : (p.crouch || 0) > 0.5 ? 0.7 : 1) + Math.max(0, sp - 0.34) * move * 1.4 + (p.sprinting ? move * 0.6 : 0) + (p.onGround ? 0 : jump);
  if (w.cat === 'sniper' && !scoped) s = Math.max(s, move * 0.6);
  s += Math.min(sprayIdx, 12) * (w.kick || 0.01) * 0.12;
  return s;
}

// ---- recoil ----------------------------------------------------------------------------------------------------------------
// The spray pattern (guns.js) as view angles: where bullet i of a spray points relative to the first, in radians.
const PAT = { x: 0, y: 0 };
export function recoilAt(w, i, out = { up: 0, side: 0 }) {
  recoilPatternInto(w, i, PAT);
  const k = (w.kick || 0.01) * 0.78;   // a touch lighter than the classic numbers
  out.up = PAT.y * k; out.side = -PAT.x * k * 0.8;
  return out;
}
// Per-shooter recoil state: the spray counter (recovers smoothly once you stop firing, like CS's recoil decay) and the
// view punch for the next shot. kick() returns how much the view climbs for the shot just fired, so the crosshair always
// sits where the next bullet goes and pulling down against it is the skill.
const RA = { up: 0, side: 0 }, RB = { up: 0, side: 0 };
export class RecoilState {
  constructor() { this.spray = 0; this.idle = 0; this.dPitch = 0; this.dYaw = 0; }
  // call once per shot, before incrementing: view climb for this shot, scaled for aimed-in (ADS) and the recoil helper
  kick(w, ads = false, scale = 1) {
    const n0 = this.spray;
    recoilAt(w, n0 + 1, RA); recoilAt(w, n0, RB);
    const kv = ads ? 0.62 : 0.78, ks = ads ? 0.55 : 0.7;
    this.dPitch = (RA.up - RB.up) * kv * scale; this.dYaw = (RA.side - RB.side) * ks * scale;
    this.spray = n0 + 1; this.idle = 0;
    return this;
  }
  // between shots: after a short pause the spray counter decays (faster for guns with a quick cycle)
  recover(w, dt) {
    this.idle += dt;
    const hold = w ? 0.4 + 60 / (w.rpm || 600) : 0.4;
    if (this.idle > hold && this.spray > 0) this.spray = Math.max(0, this.spray - dt * 18);
  }
  reset() { this.spray = 0; this.idle = 0; }
}
