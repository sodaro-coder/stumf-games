// Set dressing: the details that make a grid of walls read as real places. Buildings rise to different heights
// (a stepped skyline with parapets and rooftop clutter), doorways get stone lintels, walls get windows with frames
// and shutters, wooden roof beams, drain pipes and AC units, and sand drifts pile against wall bases. Everything here
// is looks only (players, bullets and bots use the grid), placed from a seeded hash so every client sees the same.
import * as THREE from '../sdk/three.module.min.js';

const hash = (a, b, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const RAISE = new Set(['sandwall', 'plaster', 'brick', 'concrete', 'rock', 'yellow', 'green']);
const BEAMS = new Set(['sandwall', 'plaster']);

// visual heights: solid wall masses grow by 0-4.5 m per 5x5 m block, so the skyline steps like real buildings
export function raiseBuildings(B, hr, matName) {
  const { w, d } = B;
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    const i = z * w + x; if (B.flag[i] !== 0 || B.h[i] < B.wallH - 0.01 || !RAISE.has(matName(B.mat[i]))) continue;
    const r = hash(Math.floor(x / 5), Math.floor(z / 5), 7);
    hr[i] = B.h[i] + (r < 0.35 ? 0 : r < 0.6 ? 1.6 : r < 0.85 ? 3.2 : 4.6);
  }
}

// merge plain geometries (position/normal/uv) into one
export function mergeGeos(list) {
  let n = 0; const gs = list.map((g0) => { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals(); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  for (const g of gs) { const k = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += k; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

// faces: [{dirx, dirz, a, s0, s1, bot, top, m}] wall faces from the mesh builder; add(material, geometry); ts(material) = 1/tile size
export function dressWorld({ B, hr, mat, flag, faces, matName, add, ts }) {
  const { w, d } = B;
  const idx = (x, z) => (x < 0 || z < 0 || x >= w || z >= d ? -1 : z * w + x);
  const HR = (x, z) => { const i = idx(x, z); return i < 0 ? B.wallH : hr[i]; };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  // a textured box: centre, size, yaw; uvs scaled to the material's tile size
  const box = (m, cx, cy, cz, sx, sy, sz, ry = 0, rx = 0, rz = 0) => {
    const g = new THREE.BoxGeometry(sx, sy, sz), uv = g.attributes.uv, k = ts(m), big = Math.max(sx, sy, sz) * k;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * big, uv.getY(i) * big);
    _m.compose(_p.set(cx, cy, cz), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1)); g.applyMatrix4(_m); add(m, g);
  };
  const cyl = (m, x0, y0, z0, x1, y1, z1, r, seg = 8) => {
    const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), dir = b.clone().sub(a), L = dir.length();
    const g = new THREE.CylinderGeometry(r, r, L, seg, 1), uv = g.attributes.uv, k = ts(m);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 6 * k, uv.getY(i) * L * k);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); _m.compose(_p.copy(a).add(b).multiplyScalar(0.5), _q, _s.set(1, 1, 1)); g.applyMatrix4(_m); add(m, g);
  };
  // a point on a wall face: along s, height y, out from the wall by off
  const at = (f, s, off) => { const pl = (f.dirx || f.dirz) > 0 ? f.a + 1 : f.a; return f.dirx ? [pl + f.dirx * off, s] : [s, pl + f.dirz * off]; };
  const yawOf = (f) => (f.dirx ? (f.dirx > 0 ? Math.PI / 2 : -Math.PI / 2) : (f.dirz > 0 ? 0 : Math.PI));   // box local +z = out of the wall
  const floorMatAt = (f, s) => { const [x, z] = at(f, s, 0.5); const i = idx(Math.floor(x), Math.floor(z)); return i < 0 ? '' : matName(mat[i]); };

  for (const f of faces) {
    const len = f.s1 - f.s0, hgt = f.top - f.bot, M = matName(f.m), ry = yawOf(f);
    if (!RAISE.has(M) || hgt < 2.4) continue;
    const seed = f.a * 131 + f.s0 * 17 + (f.dirx + 2) * 7 + (f.dirz + 2) * 3;
    // windows: a dark recess with a stone frame, a sill and wooden shutters (above head height)
    if (hgt >= 4.4 && len >= 3) {
      const floors = hgt >= 8 ? [f.bot + 3.1, f.bot + 6.2] : [f.bot + 3.1];
      for (let s = f.s0 + 1.6; s <= f.s1 - 1.6; s += 3.5 + hash(seed, Math.floor(s), 1) * 3) {
        if (hash(seed, Math.floor(s), 2) < 0.35) continue;
        for (const wy of floors) {
          if (wy + 0.8 > f.top - 0.3) continue;
          const ww = 0.9 + hash(seed, s, 3) * 0.4, wh = 1.15;
          const [cx, cz] = at(f, s, 0.012);
          box('glassdark', cx, wy, cz, ww, wh, 0.02, ry);
          for (const [ox, oy, sx, sy] of [[0, wh / 2 + 0.06, ww + 0.24, 0.12], [-ww / 2 - 0.06, 0, 0.12, wh], [ww / 2 + 0.06, 0, 0.12, wh]]) {
            const [px, pz] = at(f, s + ox, 0.05); box('trim', px, wy + oy, pz, sx, sy, 0.1, ry);
          }
          const [sx2, sz2] = at(f, s, 0.09); box('sill', sx2, wy - wh / 2 - 0.05, sz2, ww + 0.34, 0.1, 0.18, ry);
          if (hash(seed, s, 4) < 0.6 && M === 'sandwall') for (const sd of [-1, 1]) {   // shutters, swung open against the wall
            const [hx, hz] = at(f, s + sd * (ww / 2 + 0.38), 0.06);
            box('darkwood', hx, wy, hz, ww / 2 + 0.05, wh + 0.04, 0.04, ry);
          }
        }
      }
    }
    // wooden roof beams poking out under the parapet (desert adobe style)
    if (BEAMS.has(M) && f.top >= 4 && hash(seed, 0, 5) < 0.45) {
      for (let s = f.s0 + 0.6; s < f.s1 - 0.4; s += 1.1) { const [a0, b0] = at(f, s, 0); const [a1, b1] = at(f, s, 0.45); cyl('darkwood', a0, f.top - 0.55, b0, a1, f.top - 0.6, b1, 0.075, 6); }
    }
    // a drain pipe from the roof to the ground
    if (len >= 4 && hash(seed, 0, 6) < 0.35) {
      const s = f.s0 + 0.5 + hash(seed, 0, 7) * (len - 1); const [px, pz] = at(f, s, 0.12);
      cyl('metal', px, f.bot, pz, px, f.top - 0.15, pz, 0.055, 8);
      const [qx, qz] = at(f, s, 0.06); cyl('metal', qx, f.top - 0.3, qz, px, f.top - 0.15, pz, 0.055, 8);
      for (let y = f.bot + 1; y < f.top - 0.4; y += 1.6) { const [bx, bz] = at(f, s, 0.06); box('metal', bx, y, bz, 0.14, 0.04, 0.12, ry); }
    }
    // an AC unit or a utility box, high on the wall
    if (len >= 3 && hgt >= 3.6 && hash(seed, 0, 8) < 0.3) {
      const s = f.s0 + 0.8 + hash(seed, 0, 9) * (len - 1.6); const [px, pz] = at(f, s, 0.28);
      box('metal', px, f.bot + 2.6, pz, 0.8, 0.55, 0.5, ry); const [gx, gz] = at(f, s, 0.535); box('glassdark', gx, f.bot + 2.6, gz, 0.6, 0.38, 0.02, ry);
    }
    // sand drifting against the wall base
    if ((floorMatAt(f, (f.s0 + f.s1) / 2) === 'sand' || floorMatAt(f, (f.s0 + f.s1) / 2) === 'dirt') && f.bot <= 1.3) {
      const pos = [], uv = [], k = ts('sand');
      for (let s = f.s0; s < f.s1 - 1e-3; s += 0.5) {
        const s2 = Math.min(f.s1, s + 0.5), h0 = 0.08 + hash(seed, Math.round(s * 2), 10) * 0.16, h1 = 0.08 + hash(seed, Math.round(s2 * 2), 10) * 0.16;
        const o0 = 0.3 + h0 * 1.6, o1 = 0.3 + h1 * 1.6;
        const [ax, az] = at(f, s, 0), [bx, bz] = at(f, s2, 0), [cx, cz] = at(f, s2, o1), [dx, dz] = at(f, s, o0);
        const flip = f.dirx > 0 || f.dirz < 0;
        const A = [ax, f.bot + h0, az], Bp = [bx, f.bot + h1, bz], Cp = [cx, f.bot + 0.005, cz], D = [dx, f.bot + 0.005, dz];
        const tri = flip ? [A, Bp, Cp, A, Cp, D] : [A, Cp, Bp, A, D, Cp];
        for (const p of tri) { pos.push(...p); uv.push(p[0] * k, p[2] * k); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      add('sand', g);
    }
  }

  // doorways through walls get a stone lintel (and the passage under it reads as a real door)
  const solidAt = (x, z) => { const i = idx(x, z); return i < 0 || flag[i] === 0; };
  const doors = [];
  for (const axis of [0, 1]) {
    const A = axis ? w : d, Bn = axis ? d : w;   // scan lines along x (axis 0) or z (axis 1)
    for (let l = 0; l < A; l++) {
      let b = 0;
      while (b < Bn) {
        const x = axis ? l : b, z = axis ? b : l;
        if (solidAt(x, z)) { b++; continue; }
        let e = b; while (e < Bn && !solidAt(axis ? l : e, axis ? e : l)) e++;
        const wid = e - b;
        if (wid >= 2 && wid <= 5 && b > 0 && e < Bn) {
          const lh = Math.min(HR(axis ? l : b - 1, axis ? b - 1 : l), HR(axis ? l : e, axis ? e : l));
          if (lh >= 4.5) doors.push({ axis, l, b, e, lh });
        }
        b = e;
      }
    }
  }
  // keep only short passages (a door through a wall, not a long corridor): group consecutive scan lines
  const key = (o) => `${o.axis}|${o.b}|${o.e}`, byKey = new Map();
  for (const o of doors) { const k = key(o); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(o); }
  for (const list of byKey.values()) {
    list.sort((p, q) => p.l - q.l);
    let run = [list[0]];
    const flushRun = () => {
      if (run.length && run.length <= 3) {
        const o = run[0], l0 = o.l, l1 = run[run.length - 1].l + 1, lh = Math.min(...run.map((r) => r.lh)), y0 = 3.5, top = Math.min(lh, y0 + 2.5);
        const cx = o.axis ? (l0 + l1) / 2 : (o.b + o.e) / 2, cz = o.axis ? (o.b + o.e) / 2 : (l0 + l1) / 2, sx = o.axis ? l1 - l0 : o.e - o.b, sz = o.axis ? o.e - o.b : l1 - l0;
        box('trim', cx, (y0 + top) / 2, cz, sx + 0.02, top - y0, sz + 0.02);
        box('sill', cx, y0 - 0.06, cz, sx + (o.axis ? 0.24 : 0.02), 0.12, sz + (o.axis ? 0.02 : 0.24));
      }
    };
    for (let i = 1; i < list.length; i++) { if (list[i].l === run[run.length - 1].l + 1) run.push(list[i]); else { flushRun(); run = [list[i]]; } }
    flushRun();
  }

  // rooftop clutter on the raised blocks: water tanks, dishes, antennas, little stair houses
  for (let bz = 0; bz < d; bz += 5) for (let bx = 0; bx < w; bx += 5) {
    const cx = bx + 2.5, cz = bz + 2.5, i = idx(Math.floor(cx), Math.floor(cz)); if (i < 0 || flag[i] !== 0 || hr[i] <= B.wallH + 0.5) continue;
    const top = hr[i], r = hash(bx, bz, 11); if (r > 0.55) continue;
    if (!solidAt(Math.floor(cx) - 1, Math.floor(cz)) || !solidAt(Math.floor(cx) + 1, Math.floor(cz))) continue;
    if (r < 0.2) { cyl('metal', cx, top, cz, cx, top + 1.3, cz, 0.55, 10); for (const [ox, oz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) cyl('metal', cx + ox, top, cz + oz, cx + ox, top + 0.4, cz + oz, 0.04, 4); }
    else if (r < 0.35) { cyl('metal', cx, top, cz, cx, top + 3.2, cz, 0.04, 4); cyl('metal', cx - 0.4, top + 2.6, cz, cx + 0.4, top + 2.6, cz, 0.02, 4); cyl('metal', cx - 0.3, top + 3, cz, cx + 0.3, top + 3, cz, 0.02, 4); }
    else { box(matName(mat[i]), cx, top + 1.1, cz, 2.2, 2.2, 1.8); box('darkwood', cx, top + 1.0, cz - 0.91, 0.9, 1.9, 0.04); }
  }

  // ground clutter: stones, broken bits of wall and the odd brick collect at the foot of walls (never in the middle of
  // a lane, so nothing reads as cover that isn't)
  const GROUND = new Set(['sand', 'dirt', 'asphalt', 'concrete', 'grass', 'rock']);
  for (let z = 1; z < d - 1; z++) for (let x = 1; x < w - 1; x++) {
    const i = z * w + x; if (flag[i] !== 2 || !GROUND.has(matName(mat[i]))) continue;
    let wx = 0, wz = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (HR(x + dx, z + dz) > hr[i] + 1.2) { wx = dx; wz = dz; break; }
    if (!wx && !wz) continue;
    const r0 = hash(x, z, 31); if (r0 > 0.45) continue;
    const n = 1 + Math.floor(hash(x, z, 32) * 3), fl = hr[i];
    for (let k = 0; k < n; k++) {
      const u = hash(x, z, 40 + k), v = hash(x, z, 50 + k), sz = 0.03 + hash(x, z, 60 + k) * 0.09;
      const px = x + 0.5 + wx * (0.32 + u * 0.12) + (wz ? (u - 0.5) * 0.9 : 0), pz = z + 0.5 + wz * (0.32 + v * 0.12) + (wx ? (v - 0.5) * 0.9 : 0);
      const g = new THREE.DodecahedronGeometry(sz, 0), uv = g.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * sz * 2, uv.getY(j) * sz * 2);
      _m.compose(_p.set(px, fl + sz * 0.45, pz), _q.setFromEuler(_e.set(u * 6, v * 6, u * v * 6)), _s.set(1, 0.6 + v * 0.5, 1)); g.applyMatrix4(_m);
      add(hash(x, z, 70 + k) < 0.7 ? 'rock' : matName(HR(x + wx, z + wz) > 0 ? mat[idx(x + wx, z + wz)] : mat[i]), g);
    }
  }

  // softened edges: nothing real has a razor corner. Every exposed block top gets a rolled edge and every outside
  // corner a rounded one (a thin bullnose in the block's own material: the shading rolls round instead of snapping)
  const NOROUND = new Set(['lava', 'water', 'neon', 'snow', 'sand', 'grass', 'dirt', 'asphalt']), corners = new Set();
  for (const f of faces) {
    const m = matName(f.m), hgt = f.top - f.bot; if (NOROUND.has(m) || hgt < 0.15) continue;
    const fp = (f.dirx || f.dirz) > 0 ? f.a + 1 : f.a, r = hgt < 1.4 ? 0.035 : 0.05, P = (s, y) => (f.dirx ? [fp, y, s] : [s, y, fp]);
    const coped = (m === 'sandwall' || m === 'plaster' || m === 'brick' || m === 'concrete' || m === 'rock' || m === 'yellow' || m === 'green' || m === 'trim') && hgt >= 1.6 && f.top >= 2.2;
    if (!coped) { const [ax, ay, az] = P(f.s0, f.top), [bx, by, bz] = P(f.s1, f.top); cyl(m, ax, ay, az, bx, by, bz, r, 6); }
    for (const [s, sOut] of [[f.s0, f.s0 - 1], [f.s1, f.s1]]) {   // an outside corner: the solid cell round the end is lower
      const ox = f.dirx ? f.a : sOut, oz = f.dirx ? sOut : f.a; if (HR(ox, oz) > f.top - 0.3) continue;
      const [cx, , cz] = P(s, 0), key = cx + ',' + cz + ',' + f.bot; if (corners.has(key)) continue; corners.add(key);
      cyl(m, cx, f.bot, cz, cx, f.top, cz, r, 6);
    }
  }
}
