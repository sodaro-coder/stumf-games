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
export function dressWorld({ B, hr, mat, flag, faces, matName, add, ts, detail = 1 }) {
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

  // ---- many shapes: the world shouldn't be made of boxes. Arches, columns, balconies, awnings, lamps, conduit and
  // sagging cables on the walls; barrels, tyres, sandbags, pallets, bins, pots and bags at their feet; domes, chimneys,
  // tanks and solar panels on the roofs. All looks only, seeded so every player sees the same street.
  if (detail >= 1) {   // Medium and up: on the lowest settings the streets stay plain and fast
  const put = (m, g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, uvk = 1) => {
    const uv = g.attributes.uv; if (uv) { const k = ts(m) * uvk; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k); }
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)); g.applyMatrix4(_m); add(m, g);
  };
  const local = (f, s, off, y) => { const [x, z] = at(f, s, off); return [x, y, z]; };
  const WALLY = new Set(['sandwall', 'plaster', 'brick', 'concrete', 'yellow', 'green', 'rock']);
  for (const f of faces) {
    const M = matName(f.m), len = f.s1 - f.s0, hgt = f.top - f.bot, ry = yawOf(f);
    if (!WALLY.has(M) || hgt < 2.4 || len < 2) continue;
    const seed = f.a * 977 + f.s0 * 31 + (f.dirx + 2) * 13 + (f.dirz + 2) * 5;
    // pilasters: shallow columns with a base and a capital, every few metres on long walls
    if (len >= 6 && hash(seed, 1, 101) < 0.4) for (let sp = f.s0 + 2; sp <= f.s1 - 2; sp += 4 + Math.floor(hash(seed, sp, 102) * 3)) {
      const [x, , z] = local(f, sp, 0.08, 0), ph = Math.min(hgt - 0.3, 4.2);
      put(M, new THREE.BoxGeometry(0.42, ph, 0.16), x, f.bot + ph / 2, z, 0, ry);
      put('trim', new THREE.BoxGeometry(0.56, 0.18, 0.26), x, f.bot + 0.09, z, 0, ry);
      put('trim', new THREE.CylinderGeometry(0.3, 0.24, 0.16, 4), x, f.bot + ph + 0.02, z, 0, ry + Math.PI / 4, 0, 1, 1, 0.55);
    }
    // a blind arch: a recessed panel under a half-round stone arch
    if (len >= 4 && (M === 'sandwall' || M === 'plaster' || M === 'brick') && hash(seed, 2, 103) < 0.3) {
      const sp = f.s0 + 1.2 + hash(seed, 2, 104) * (len - 2.4), [x, , z] = local(f, sp, 0.03, 0), wR = 0.55 + hash(seed, 2, 105) * 0.3;
      put('glassdark', new THREE.PlaneGeometry(wR * 2 - 0.1, 1.5), x, f.bot + 0.75, z, 0, ry);
      put('trim', new THREE.TorusGeometry(wR, 0.07, 4, 12, Math.PI), x, f.bot + 1.5, z, 0, ry);
      for (const sd of [-1, 1]) { const [px, , pz] = local(f, sp + sd * wR, 0.03, 0); put('trim', new THREE.CylinderGeometry(0.07, 0.08, 1.5, 8), px, f.bot + 0.75, pz); }
    }
    // a balcony: a slab on corbels with a railing of round balusters
    if (hgt >= 5.5 && len >= 4 && hash(seed, 3, 106) < 0.28) {
      const sp = f.s0 + 1.5 + hash(seed, 3, 107) * (len - 3), y = f.bot + 3.4, bw = 2.2;
      { const [x, , z] = local(f, sp, 0.5, 0); put('concrete', new THREE.BoxGeometry(bw, 0.14, 1.0), x, y, z, 0, ry); }
      for (const sd of [-0.8, 0.8]) { const [x, , z] = local(f, sp + sd, 0.25, 0); put('trim', new THREE.ConeGeometry(0.16, 0.5, 4), x, y - 0.3, z, Math.PI, ry + Math.PI / 4); }
      for (let k = 0; k <= 10; k++) { const t = -bw / 2 + 0.06 + k * (bw - 0.12) / 10, [x, , z] = local(f, sp + t, 0.94, 0); put('metal', new THREE.CylinderGeometry(0.018, 0.018, 0.85, 4), x, y + 0.5, z); }
      { const [x, , z] = local(f, sp, 0.94, 0); put('metal', new THREE.CylinderGeometry(0.03, 0.03, bw, 8), x, y + 0.94, z, 0, ry, Math.PI / 2); }
      for (const sd of [-1, 1]) { const [x0, , z0] = local(f, sp + sd * bw / 2, 0.06, 0), [x1, , z1] = local(f, sp + sd * bw / 2, 0.94, 0); cyl('metal', x0, y + 0.94, z0, x1, y + 0.94, z1, 0.03, 8); }
      { const [x, , z] = local(f, sp, 0.05, 0); put('darkwood', new THREE.BoxGeometry(0.95, 2.1, 0.06), x, y + 1.12, z, 0, ry); }   // the door onto it
    }
    // a wall lamp: bracket, cone shade, a glowing bulb
    if (hgt >= 3 && len >= 3 && hash(seed, 4, 108) < 0.2) {
      const sp = f.s0 + 0.7 + hash(seed, 4, 109) * (len - 1.4), y = f.bot + 2.7;
      const [x0, , z0] = local(f, sp, 0.0, 0), [x1, , z1] = local(f, sp, 0.32, 0);
      cyl('metal', x0, y + 0.18, z0, x1, y + 0.1, z1, 0.02, 6);
      put('metal', new THREE.ConeGeometry(0.14, 0.16, 8, 1, true), x1, y, z1);
      put('lava', new THREE.SphereGeometry(0.05, 6, 4), x1, y - 0.06, z1);
      put('metal', new THREE.CylinderGeometry(0.07, 0.09, 0.12, 6), x0, y + 0.18, z0, Math.PI / 2, ry);
    }
    // electrical conduit along the wall with junction boxes, dropping into a meter box
    if (len >= 5 && hash(seed, 5, 110) < 0.22) {
      const y = f.bot + 2.2 + hash(seed, 5, 111) * 0.6, s0 = f.s0 + 0.4, s1 = f.s1 - 0.4;
      const [ax, , az] = local(f, s0, 0.05, 0), [bx, , bz] = local(f, s1, 0.05, 0); cyl('metal', ax, y, az, bx, y, bz, 0.025, 6);
      for (let sp = s0 + 1.5; sp < s1; sp += 2.5 + hash(seed, sp, 112) * 2) { const [x, , z] = local(f, sp, 0.06, 0); put('metal', new THREE.BoxGeometry(0.12, 0.12, 0.06), x, y, z, 0, ry); }
      const sp = s0 + hash(seed, 5, 113) * (s1 - s0), [x, , z] = local(f, sp, 0.05, 0);
      cyl('metal', x, y, z, x, f.bot + 1.5, z, 0.025, 6);
      put('metal', new THREE.BoxGeometry(0.34, 0.45, 0.14), x, f.bot + 1.3, z, 0, ry);
      { const [gx, , gz] = local(f, sp, 0.125, 0); put('glassdark', new THREE.CircleGeometry(0.07, 8), gx, f.bot + 1.38, gz, 0, ry); }
    }
    // an awning over a stretch of wall: a sloped canvas on two rods
    if (len >= 3 && hgt >= 3 && (M === 'sandwall' || M === 'plaster' || M === 'yellow' || M === 'brick') && hash(seed, 6, 114) < 0.3) {
      const sp = f.s0 + 1.2 + hash(seed, 6, 115) * (len - 2.4), y = f.bot + 2.55, aw = 1.8, col = ['cred', 'cblue', 'cgreen', 'corange'][Math.floor(hash(seed, 6, 116) * 4)];
      const [x, , z] = local(f, sp, 0.45, 0); put(col, new THREE.BoxGeometry(aw, 0.03, 0.95), x, y, z, -0.35, ry);
      for (let k = 0; k < 6; k++) { const [vx, , vz] = local(f, sp - aw / 2 + 0.15 + k * (aw - 0.3) / 5, 0.92, 0); put(col, new THREE.ConeGeometry(0.08, 0.14, 3), vx, y - 0.24, vz, Math.PI, ry); }   // scalloped edge
      for (const sd of [-1, 1]) { const [a0, , b0] = local(f, sp + sd * aw / 2, 0, 0), [a1, , b1] = local(f, sp + sd * aw / 2, 0.85, 0); cyl('metal', a0, y + 0.3, b0, a1, y - 0.15, b1, 0.015, 5); }
    }
  }
  // sagging cables between facing walls across a lane
  for (const f of faces) {
    if (!WALLY.has(matName(f.m)) || f.top - f.bot < 3.5 || !f.dirx || hash(f.a, f.s0, 120) > 0.18) continue;
    const sp = f.s0 + 0.5 + hash(f.a, f.s0, 121) * Math.max(0, f.s1 - f.s0 - 1), z = sp; let x2 = null;
    for (let k = 2; k < 14; k++) { const xx = f.a + f.dirx * k; if (HR(xx, Math.floor(z)) > f.bot + 3.2) { x2 = f.dirx > 0 ? xx : xx + 1; break; } }
    if (x2 === null) continue;
    const x1 = f.dirx > 0 ? f.a + 1 : f.a, y = f.bot + 3.1 + hash(f.a, f.s0, 122) * 0.6, sag = 0.25 + Math.abs(x2 - x1) * 0.04;
    const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(x1 + (x2 - x1) * t, y - Math.sin(t * Math.PI) * sag, z)); }
    add('metal', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 4, false));
  }
  // things people leave against walls: a cluster per spot, chosen by the street it's in
  const KIND = ['barrel', 'tyres', 'sandbags', 'pallet', 'blocks', 'bin', 'pot', 'bags', 'jerry', 'crates'];
  for (let z = 1; z < d - 1; z++) for (let x = 1; x < w - 1; x++) {
    const i = z * w + x; if (flag[i] !== 2 || hash(x, z, 130) > 0.11) continue;
    let wx = 0, wz = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (HR(x + dx, z + dz) > hr[i] + 1.5) { wx = dx; wz = dz; break; }
    if (!wx && !wz) continue;
    const fl = hr[i], cx = x + 0.5 + wx * 0.22, cz = z + 0.5 + wz * 0.22, yaw = Math.atan2(wx, wz), r = hash(x, z, 131), kind = KIND[Math.floor(hash(x, z, 132) * KIND.length)];
    const col = ['cred', 'cblue', 'cgreen', 'corange', 'yellow'][Math.floor(r * 5)];
    if (kind === 'barrel') { for (let k = 0; k < 1 + (r > 0.5); k++) { const ox = (k - 0.25) * 0.6 * Math.cos(yaw), oz = -(k - 0.25) * 0.6 * Math.sin(yaw); put(col, new THREE.CylinderGeometry(0.28, 0.28, 0.86, 12), cx + ox, fl + 0.43, cz + oz); for (const yy of [0.15, 0.43, 0.71]) put('metal', new THREE.TorusGeometry(0.285, 0.015, 3, 12), cx + ox, fl + yy, cz + oz, Math.PI / 2); put('metal', new THREE.CylinderGeometry(0.04, 0.04, 0.03, 8), cx + ox + 0.12, fl + 0.875, cz + oz); } }
    else if (kind === 'tyres') { const n = 2 + Math.floor(r * 3); for (let k = 0; k < n; k++) put('asphalt', new THREE.TorusGeometry(0.26, 0.11, 6, 12), cx + (hash(x, z, 140 + k) - 0.5) * 0.08, fl + 0.11 + k * 0.21, cz + (hash(x, z, 150 + k) - 0.5) * 0.08, Math.PI / 2, 0, hash(x, z, 160 + k) * 0.2); }
    else if (kind === 'sandbags') { for (let row = 0; row < 3; row++) for (let k = 0; k < 3 - (row > 1); k++) { const t = (k - (row > 1 ? 0.5 : 1)) * 0.42 + (row % 2) * 0.2; put('sand', new THREE.CapsuleGeometry(0.11, 0.22, 2, 6), cx + Math.cos(yaw) * t, fl + 0.1 + row * 0.17, cz - Math.sin(yaw) * t, 0, yaw, Math.PI / 2, 1.2, 1, 0.7); } }
    else if (kind === 'pallet') { put('wood', new THREE.BoxGeometry(1.0, 0.03, 1.2), cx, fl + 0.06, cz, Math.PI / 2 - 0.15, yaw, 0); for (let k = -2; k <= 2; k++) put('wood', new THREE.BoxGeometry(0.12, 0.025, 1.2), cx + Math.cos(yaw) * k * 0.22, fl + 0.6, cz - Math.sin(yaw) * k * 0.22, Math.PI / 2 - 0.15, yaw, 0); }
    else if (kind === 'blocks') { for (let k = 0; k < 4 + Math.floor(r * 3); k++) { const t = (k % 3 - 1) * 0.42, yy = Math.floor(k / 3) * 0.2; put('concrete', new THREE.BoxGeometry(0.39, 0.19, 0.19), cx + Math.cos(yaw) * t, fl + 0.1 + yy, cz - Math.sin(yaw) * t, 0, yaw + (hash(x, z, 170 + k) - 0.5) * 0.2); } }
    else if (kind === 'bin') { put(col === 'yellow' ? 'cgreen' : col, new THREE.CylinderGeometry(0.27, 0.23, 0.95, 10), cx, fl + 0.48, cz); put('metal', new THREE.CylinderGeometry(0.29, 0.29, 0.05, 10), cx, fl + 0.98, cz, 0.25, 0, 0); put('metal', new THREE.TorusGeometry(0.06, 0.012, 3, 6, Math.PI), cx, fl + 1.02, cz); }
    else if (kind === 'pot') { put('corange', new THREE.CylinderGeometry(0.26, 0.18, 0.42, 10), cx, fl + 0.21, cz); put('dirt', new THREE.CylinderGeometry(0.24, 0.24, 0.02, 12), cx, fl + 0.4, cz); for (let k = 0; k < 4; k++) put('grass', new THREE.SphereGeometry(0.2 - k * 0.025, 7, 5), cx + (hash(x, z, 180 + k) - 0.5) * 0.2, fl + 0.55 + k * 0.1, cz + (hash(x, z, 190 + k) - 0.5) * 0.2, 0, 0, 0, 1, 0.85, 1); }
    else if (kind === 'bags') { for (let k = 0; k < 2 + Math.floor(r * 3); k++) { const a = hash(x, z, 200 + k) * 6.28, rr = hash(x, z, 210 + k) * 0.3; put('asphalt', new THREE.SphereGeometry(0.2 + hash(x, z, 220 + k) * 0.08, 7, 5), cx + Math.cos(a) * rr, fl + 0.15, cz + Math.sin(a) * rr, 0, a, 0, 1, 0.75, 0.9); put('asphalt', new THREE.ConeGeometry(0.05, 0.1, 6), cx + Math.cos(a) * rr, fl + 0.32, cz + Math.sin(a) * rr); } }
    else if (kind === 'jerry') { for (let k = 0; k < 2; k++) { const t = (k - 0.5) * 0.36; put(k ? 'cgreen' : 'cred', new THREE.BoxGeometry(0.17, 0.46, 0.34), cx + Math.cos(yaw) * t, fl + 0.23, cz - Math.sin(yaw) * t, 0, yaw); put('metal', new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), cx + Math.cos(yaw) * t, fl + 0.49, cz - Math.sin(yaw) * t + 0.08); } }
    else { put('crate', new THREE.BoxGeometry(0.55, 0.55, 0.55), cx, fl + 0.275, cz, 0, yaw + r * 0.4); put('crate', new THREE.BoxGeometry(0.4, 0.4, 0.4), cx + 0.05, fl + 0.75, cz, 0, yaw - r * 0.6); }
  }
  // roofs: a dome here, a chimney or a water tank there, solar panels on the flat ones
  for (let bz = 2; bz < d; bz += 6) for (let bx = 2; bx < w; bx += 6) {
    const i = idx(bx, bz); if (i < 0 || flag[i] !== 0 || hr[i] < 3 || !WALLY.has(matName(mat[i]))) continue;
    let ok = true; for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (Math.abs(HR(bx + dx, bz + dz) - hr[i]) > 0.01) ok = false; if (!ok) continue;
    const top = hr[i], r = hash(bx, bz, 230), M = matName(mat[i]), cx = bx + 0.5, cz = bz + 0.5;
    if (r < 0.18 && (M === 'sandwall' || M === 'plaster')) { put(M, new THREE.SphereGeometry(0.95, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), cx, top, cz); put('trim', new THREE.TorusGeometry(0.95, 0.05, 5, 24), cx, top + 0.02, cz, Math.PI / 2); put('metal', new THREE.ConeGeometry(0.06, 0.4, 8), cx, top + 1.1, cz); }
    else if (r < 0.34) { put('brick', new THREE.BoxGeometry(0.5, 1.2, 0.5), cx, top + 0.6, cz); put('concrete', new THREE.BoxGeometry(0.62, 0.08, 0.62), cx, top + 1.24, cz); put('metal', new THREE.CylinderGeometry(0.1, 0.1, 0.35, 10), cx, top + 1.45, cz); }
    else if (r < 0.48) { put('cblue', new THREE.CylinderGeometry(0.45, 0.45, 0.9, 12), cx, top + 1.0, cz, 0, 0, Math.PI / 2); for (const sd of [-0.3, 0.3]) put('metal', new THREE.BoxGeometry(0.06, 0.55, 0.8), cx + sd, top + 0.28, cz); }
    else if (r < 0.62) { for (let k = 0; k < 3; k++) { put('glassdark', new THREE.BoxGeometry(0.9, 0.04, 1.4), cx - 1 + k, top + 0.45, cz, -0.5, 0, 0); put('metal', new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), cx - 1 + k, top + 0.25, cz + 0.4); } }
  }
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
