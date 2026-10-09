// Potentially Visible Set: precomputed occlusion culling for the maps. The map compiler (node, pvs_build.mjs) splits
// each map into 8 m view regions and 16 m render tiles and records, per region, every tile that can possibly be seen
// from anywhere a player can stand (or jump) in it. In game the camera's region picks a bitset and every world chunk,
// prop and player in a tile outside it is not drawn at all: rooms behind solid walls cost nothing.
//
// How a region's set is found: from eye points across the region (every cell a player can reach, at standing and
// jump-peak eye heights), a horizon sweep runs along 1440 directions. Walking outward, a cell is visible if its top
// (plus a margin for things that stick up: pipes, beams, roof trim) rises above the steepest occluder passed so far;
// on a heightfield that test is exact along each line, so the result is conservative: it can only over-include.
// Frustum culling (three.js, per chunk bounding sphere) still runs on top of it.

export const PVS_TILE = 16, PVS_REGION = 8;
const MARGIN = 1.5, EYES = [1.7, 2.9];

// a hash of the map's collision grid: shipped data is only used for the exact map it was compiled from
export function mapHash(B) {
  let x = 2166136261 >>> 0;
  const mix = (v) => { x ^= v & 0xff; x = Math.imul(x, 16777619) >>> 0; x ^= (v >>> 8) & 0xff; x = Math.imul(x, 16777619) >>> 0; };
  mix(B.w); mix(B.d);
  for (let i = 0; i < B.h.length; i++) mix(Math.round(B.h[i] * 20));
  return x.toString(36);
}

// cells a player can stand on: flood fill from the spawns, stepping or jumping up at most 1.4 m, dropping any height
function reachable(B) {
  const { w, d, h } = B, seen = new Uint8Array(w * d), q = [];
  const push = (x, z) => { if (x < 0 || z < 0 || x >= w || z >= d) return; const i = z * w + x; if (!seen[i]) { seen[i] = 1; q.push(i); } };
  for (const t of ['T', 'CT']) for (const s of B.spawns[t] || []) push(Math.floor(s[0]), Math.floor(s[1]));
  for (const t of ['T', 'CT']) for (const s of (B.duel || {})[t] || []) push(Math.floor(s[0]), Math.floor(s[1]));
  while (q.length) {
    const i = q.pop(), x = i % w, z = (i / w) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= w || nz >= d) continue;
      const j = nz * w + nx; if (!seen[j] && h[j] - h[i] <= 1.4) { seen[j] = 1; q.push(j); }
    }
  }
  return seen;
}

// B: the map's build (w, d, h); top(x, z): the visual height there (walls and buildings)
export function compilePVS(B, top, { az = 1440, maxDist = 200 } = {}) {
  const { w, d } = B, TW = Math.ceil(w / PVS_TILE), TD = Math.ceil(d / PVS_TILE), RW = Math.ceil(w / PVS_REGION), RD = Math.ceil(d / PVS_REGION);
  const words = Math.ceil(TW * TD / 32), bits = new Uint32Array(RW * RD * words), reach = reachable(B);
  let maxH = 0; for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) maxH = Math.max(maxH, top(x + 0.5, z + 0.5));
  const cos = new Float64Array(az), sin = new Float64Array(az); for (let k = 0; k < az; k++) { cos[k] = Math.cos(k / az * 2 * Math.PI); sin[k] = Math.sin(k / az * 2 * Math.PI); }
  const used = new Uint8Array(RW * RD);
  for (let rz = 0; rz < RD; rz++) for (let rx = 0; rx < RW; rx++) {
    const base = (rz * RW + rx) * words, set = (t) => { bits[base + (t >> 5)] |= 1 << (t & 31); };
    for (let cz = rz * PVS_REGION; cz < Math.min(d, (rz + 1) * PVS_REGION); cz++) for (let cx = rx * PVS_REGION; cx < Math.min(w, (rx + 1) * PVS_REGION); cx++) {
      if (!reach[cz * w + cx]) continue;
      used[rz * RW + rx] = 1;
      set(Math.floor(cx / PVS_TILE) + Math.floor(cz / PVS_TILE) * TW);
      // eye points: this cell's corners region-side (every 2nd cell, plus the region's edge cells, keeps it fast)
      const edge = cx % PVS_REGION === 0 || cz % PVS_REGION === 0 || cx % PVS_REGION === PVS_REGION - 1 || cz % PVS_REGION === PVS_REGION - 1;
      if (!edge && (cx + cz) % 2) continue;
      const fl = B.h[cz * w + cx];
      for (const eh of EYES) {
        const ex = cx + 0.5, ez = cz + 0.5, ey = fl + eh;
        for (let k = 0; k < az; k++) {
          const dx = cos[k], dz = sin[k]; let best = -Infinity;
          for (let t = 0.35; t < maxDist; t += 0.35) {
            const x = ex + dx * t, z = ez + dz * t; if (x < 0 || z < 0 || x >= w || z >= d) break;
            const tp = top(x, z), s = (tp + MARGIN - ey) / t;
            if (s > best) set(Math.floor(x / PVS_TILE) + Math.floor(z / PVS_TILE) * TW);
            const so = (tp - ey) / t; if (so > best) best = so;
            if (best * t > maxH + MARGIN - ey) break;   // nothing further can rise above this horizon
          }
        }
      }
    }
  }
  return { TW, TD, RW, RD, words, bits, used };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function encodePVS(p, hash) {
  const u8 = new Uint8Array(p.bits.buffer.slice(0)); let s = '';
  for (let i = 0; i < u8.length; i += 3) { const n = (u8[i] << 16) | ((u8[i + 1] || 0) << 8) | (u8[i + 2] || 0); s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]; }
  let us = ''; for (let i = 0; i < p.used.length; i++) us += p.used[i] ? '1' : '0';
  return { hash, TW: p.TW, TD: p.TD, RW: p.RW, RD: p.RD, words: p.words, bits: s, used: us };
}
export function decodePVS(o) {
  const n = o.RW * o.RD * o.words * 4, u8 = new Uint8Array(Math.ceil(n / 3) * 3), map = {}; for (let i = 0; i < 64; i++) map[B64[i]] = i;
  for (let i = 0, j = 0; i < o.bits.length; i += 4, j += 3) { const v = (map[o.bits[i]] << 18) | (map[o.bits[i + 1]] << 12) | (map[o.bits[i + 2]] << 6) | map[o.bits[i + 3]]; u8[j] = v >> 16; u8[j + 1] = (v >> 8) & 255; u8[j + 2] = v & 255; }
  return { ...o, bits: new Uint32Array(u8.buffer.slice(0, n)), used: Uint8Array.from(o.used, (c) => +c) };
}

// runtime: hide what the camera's region can't see. Objects register with their tile (from position or bounding
// sphere); update() runs once per frame and only touches .visible when the region (or region blend) changes.
export class PVSCuller {
  constructor(p, B) {
    this.p = p; this.B = B; this.items = []; this.dyn = []; this.key = -2; this.cur = new Uint32Array(p.words); this.enabled = true; this.stats = { shown: 0, hidden: 0 };
  }
  static tileOf(p, x, z) { return Math.min(p.TW - 1, Math.max(0, Math.floor(x / PVS_TILE))) + Math.min(p.TD - 1, Math.max(0, Math.floor(z / PVS_TILE))) * p.TW; }
  add(obj, x, z) { obj.userData.pvsTile = PVSCuller.tileOf(this.p, x, z); this.items.push(obj); this.key = -2; }
  // a static object spanning several tiles (a merged chunk): visible if any tile its bounds touch is
  addBox(obj, x0, z0, x1, z1) {
    const p = this.p, t = [];
    for (let tz = Math.max(0, Math.floor(z0 / PVS_TILE)); tz <= Math.min(p.TD - 1, Math.floor(z1 / PVS_TILE)); tz++) for (let tx = Math.max(0, Math.floor(x0 / PVS_TILE)); tx <= Math.min(p.TW - 1, Math.floor(x1 / PVS_TILE)); tx++) t.push(tx + tz * p.TW);
    obj.userData.pvsTiles = t; this.items.push(obj); this.key = -2;
  }
  vis(t) { return (this.cur[t >> 5] >>> (t & 31)) & 1; }
  visibleAt(x, z) { return this.key === -1 || this.vis(PVSCuller.tileOf(this.p, x, z)) === 1; }
  // cam: position {x, y, z}; floorAt(x, z): the floor there (to tell standing eyes from a free / overhead camera)
  update(cam, floorAt) {
    const p = this.p, rx = Math.floor(cam.x / PVS_REGION), rz = Math.floor(cam.z / PVS_REGION);
    let key = -1;
    if (this.enabled && rx >= 0 && rz >= 0 && rx < p.RW && rz < p.RD && p.used[rz * p.RW + rx] && cam.y <= floorAt(cam.x, cam.z) + 3.3) {
      // near a region border: also take the neighbour's set, so peeking across the line never pops
      const fx = cam.x / PVS_REGION - rx, fz = cam.z / PVS_REGION - rz, nx = fx < 0.15 ? -1 : fx > 0.85 ? 1 : 0, nz = fz < 0.15 ? -1 : fz > 0.85 ? 1 : 0;
      key = ((rz * p.RW + rx) * 3 + nx + 1) * 3 + nz + 1;
      if (key !== this.key) {
        this.cur.fill(0);
        const or = (ax, az) => { if (ax < 0 || az < 0 || ax >= p.RW || az >= p.RD) return; const r = az * p.RW + ax; if (!p.used[r]) return; const b = r * p.words; for (let i = 0; i < p.words; i++) this.cur[i] |= p.bits[b + i]; };
        or(rx, rz); if (nx) or(rx + nx, rz); if (nz) or(rx, rz + nz); if (nx && nz) or(rx + nx, rz + nz);
      }
    }
    if (key === this.key) return;
    this.key = key; let s = 0, h = 0;
    for (const o of this.items) {
      let v = key === -1;
      if (!v) { if (o.userData.pvsTiles) { for (const t of o.userData.pvsTiles) if (this.vis(t)) { v = true; break; } } else v = this.vis(o.userData.pvsTile) === 1; }
      o.visible = v; v ? s++ : h++;
    }
    this.stats.shown = s; this.stats.hidden = h;
  }
}
