// Surface textures, painted procedurally at load (no image files): weathered plaster over sandstone blocks, packed
// sand, crates with frames and braces, corrugated metal, concrete with formwork seams, brick, tile, wood... Each gives
// a colour map and a height map (used as a bump map so light catches the mortar lines and plank gaps). Everything
// tiles seamlessly, and the size drops on low settings so weak machines load fast.

const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// tileable value noise: p lattice cells across the tile
function vnoise(x, y, p, s, py = p) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % p) + p) % p, y0 = ((yi % py) + py) % py, x1 = (x0 + 1) % p, y1 = (y0 + 1) % py;
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(u, v, base, oct, s) {
  let f = 0, amp = 0.5, tot = 0, p = base;
  for (let o = 0; o < oct; o++) { f += amp * vnoise(u * p, v * p, p, s + o * 17); tot += amp; amp *= 0.5; p *= 2; }
  return f / tot;
}
// cellular noise on an n x n tile grid: distance to the nearest and second nearest point (in cell units) and its id
function cell(u, v, n, s, out) {
  const x = u * n, y = v * n, xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 9, d2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
    const px = cx + hash(wx, wy, s), py = cy + hash(wx, wy, s + 9), d = Math.hypot(px - x, py - y);
    if (d < d1) { d2 = d1; d1 = d; id = hash(wx, wy, s + 3); } else if (d < d2) d2 = d;
  }
  out[0] = d1; out[1] = d2; out[2] = id;
  return out;
}
const C = [0, 0, 0];
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const frac = (x) => x - Math.floor(x);
// running-bond blocks: rows x cols per tile; returns [mortar 0..1 (1 = in the joint), block id, u in block, v in block]
function blocks(u, v, rows, cols, joint, out) {
  const r = Math.floor(v * rows), off = (r % 2) * 0.5, x = u * cols + off, c = Math.floor(x);
  const bu = x - c, bv = v * rows - r, e = Math.min(bu, 1 - bu) / cols * rows, f = Math.min(bv, 1 - bv);
  out[0] = 1 - sm(joint * 0.6, joint, Math.min(e, f)); out[1] = hash(((c % cols) + cols) % cols, r, 77); out[2] = bu; out[3] = bv;
  return out;
}
const B4 = [0, 0, 0, 0];

// each painter: (u, v, o) -> o = [r, g, b, height 0..1]
const P = {
  sand(u, v, o) {
    const n = fbm(u, v, 4, 4, 11), f = fbm(u, v, 48, 2, 12), k = 0.86 + n * 0.26;
    o[0] = 196 * k + (f - 0.5) * 22; o[1] = 167 * k + (f - 0.5) * 20; o[2] = 118 * k + (f - 0.5) * 16; o[3] = f * 0.4 + n * 0.2;
    cell(u, v, 22, 13, C); if (C[0] < 0.16) { const t = C[2] < 0.5 ? 0.78 : 1.1, e = 1 - C[0] / 0.16; o[0] *= t; o[1] *= t; o[2] *= t; o[3] += e * 0.5; }
    const wind = vnoise(u * 6 + v * 40, v * 3, 40, 14); o[0] -= wind * 6; o[1] -= wind * 6; o[2] -= wind * 4;
  },
  dirt(u, v, o) {
    const n = fbm(u, v, 4, 4, 21), f = fbm(u, v, 40, 2, 22), k = 0.8 + n * 0.35;
    o[0] = 122 * k + (f - 0.5) * 24; o[1] = 94 * k + (f - 0.5) * 20; o[2] = 66 * k + (f - 0.5) * 16; o[3] = f * 0.5 + n * 0.3;
    cell(u, v, 18, 23, C); if (C[0] < 0.2) { const t = 0.75 + C[2] * 0.45; o[0] *= t; o[1] *= t; o[2] *= t; o[3] += (1 - C[0] / 0.2) * 0.6; }
  },
  sandwall(u, v, o) {   // weathered plaster over sandstone blocks; the plaster has fallen off in patches
    blocks(u, v, 10, 6, 0.07, B4);
    const patch = fbm(u, v, 3, 5, 31), bare = sm(0.56, 0.6, patch), rim = sm(0.5, 0.56, patch) * (1 - bare);
    const fine = fbm(u, v, 64, 2, 32), stain = fbm(u, v, 6, 3, 33), streak = vnoise(u * 48, v * 4, 48, 34);
    const pk = 0.9 + fine * 0.12 - stain * 0.1 - streak * 0.05;
    const pr = 216 * pk, pg = 192 * pk, pb = 148 * pk;
    const bj = 0.85 + B4[1] * 0.25 + (fine - 0.5) * 0.15;
    let sr = 182 * bj, sg = 150 * bj, sb = 104 * bj;
    sr = sr * (1 - B4[0]) + 120 * B4[0]; sg = sg * (1 - B4[0]) + 100 * B4[0]; sb = sb * (1 - B4[0]) + 76 * B4[0];
    o[0] = pr * (1 - bare) + sr * bare - rim * 26; o[1] = pg * (1 - bare) + sg * bare - rim * 24; o[2] = pb * (1 - bare) + sb * bare - rim * 20;
    o[3] = (1 - bare) * 0.75 + bare * (0.45 - B4[0] * 0.45) + fine * 0.1;
  },
  plaster(u, v, o) {
    const fine = fbm(u, v, 64, 2, 41), stain = fbm(u, v, 5, 4, 42), crack = Math.abs(fbm(u, v, 6, 4, 43) - 0.5);
    const k = 0.92 + fine * 0.1 - stain * 0.12 - (crack < 0.004 ? 0.14 : 0);
    o[0] = 228 * k; o[1] = 214 * k; o[2] = 184 * k; o[3] = 0.6 + fine * 0.15 - (crack < 0.004 ? 0.3 : 0);
  },
  brick(u, v, o) {
    blocks(u, v, 28, 8, 0.12, B4);
    const fine = fbm(u, v, 64, 2, 51), k = 0.8 + B4[1] * 0.35 + (fine - 0.5) * 0.2;
    o[0] = 152 * k * (1 - B4[0]) + 168 * B4[0]; o[1] = 78 * k * (1 - B4[0]) + 160 * B4[0]; o[2] = 58 * k * (1 - B4[0]) + 148 * B4[0];
    o[3] = 0.6 - B4[0] * 0.55 + fine * 0.1;
  },
  wood(u, v, o, c = [140, 100, 60], planks = 10) {   // boards along u, stacked in v
    const r = Math.floor(v * planks), pv = v * planks - r, seam = 1 - sm(0.02, 0.08, Math.min(pv, 1 - pv));
    const tone = 0.82 + hash(r, 3, 61) * 0.3, sh = hash(r, 1, 62) * 50;
    const grain = vnoise(u * 4, pv * 14 + sh, 4, 63, 64) * 0.55 + vnoise(u * 12, pv * 40 + sh, 12, 64, 64) * 0.45;
    const knot = cell(u, frac(v + hash(r, 2, 67)), 5, 65 + r, C)[0] < 0.07 ? 0.72 : 1;
    const k = tone * (0.84 + grain * 0.28) * knot * (1 - seam * 0.65);
    o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; o[3] = 0.7 - seam * 0.7 + grain * 0.12;
  },
  crate(u, v, o) {   // a crate face: framed edges, a diagonal brace, horizontal boards, nails
    const fr = 0.1, eu = Math.min(u, 1 - u), ev = Math.min(v, 1 - v), dd = (u - v) / Math.SQRT2;
    let raised = 0.25;
    if (Math.min(eu, ev) < fr) {
      if (eu < ev) P.wood(v, eu / fr, o, [146, 104, 60], 1); else P.wood(u, ev / fr, o, [146, 104, 60], 1);
    } else if (Math.abs(dd) < 0.065) P.wood((u + v) * 0.5, dd / 0.13 + 0.5, o, [150, 108, 62], 1);
    else { P.wood(u, (v - fr) / (1 - 2 * fr), o, [170, 128, 78], 4); raised = -0.1; const gap = Math.min(Math.min(eu, ev) - fr, Math.abs(Math.abs(dd) - 0.065)); const sh = 1 - sm(0, 0.02, gap) * 1; o[0] *= 1 - sh * 0.35; o[1] *= 1 - sh * 0.35; o[2] *= 1 - sh * 0.35; }
    o[3] += raised;
    for (const [nx, ny] of [[0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95], [0.5, 0.05], [0.5, 0.95], [0.05, 0.5], [0.95, 0.5]]) {
      if (Math.hypot(u - nx, v - ny) < 0.012) { o[0] = 70; o[1] = 68; o[2] = 66; o[3] = 0.9; }
    }
    const grime = fbm(u, v, 4, 3, 66); o[0] *= 0.88 + grime * 0.16; o[1] *= 0.88 + grime * 0.16; o[2] *= 0.88 + grime * 0.14;
  },
  metal(u, v, o, c = [128, 134, 140], paint = false) {
    const rib = 0.5 + 0.5 * Math.cos(u * Math.PI * 2 * 16), fine = fbm(u, v, 48, 2, 71), rustN = fbm(u, v, 4, 5, 72);
    const k = 0.78 + rib * 0.3 + (fine - 0.5) * 0.08;
    let r = c[0] * k, g = c[1] * k, b = c[2] * k;
    if (paint) { const chip = sm(0.7, 0.72, rustN); r = r * (1 - chip) + 120 * chip * k; g = g * (1 - chip) + 118 * chip * k; b = b * (1 - chip) + 112 * chip * k; }
    const rust = sm(0.6, 0.75, fbm(u, v, 3, 4, 73)) * (paint ? 0.4 : 0.8);
    r = r * (1 - rust) + 128 * k * rust; g = g * (1 - rust) + 76 * k * rust; b = b * (1 - rust) + 44 * k * rust;
    const dirt = sm(0.25, 1, 1 - v) * 0.0 + fbm(u, v, 8, 3, 74) * 0.1;
    o[0] = r * (1 - dirt); o[1] = g * (1 - dirt); o[2] = b * (1 - dirt); o[3] = rib * 0.8 + fine * 0.1;
  },
  concrete(u, v, o) {
    const n = fbm(u, v, 4, 5, 81), fine = fbm(u, v, 64, 2, 82), k = 0.84 + n * 0.22 + (fine - 0.5) * 0.1;
    let r = 152 * k, g = 151 * k, b = 146 * k, h = 0.6 + fine * 0.15;
    const su = frac(u * 4), sv = frac(v * 2), seam = Math.min(su, 1 - su) < 0.008 || Math.min(sv, 1 - sv) < 0.006;
    if (seam) { r *= 0.72; g *= 0.72; b *= 0.72; h = 0.2; }
    if (Math.hypot(su - 0.5, frac(v * 4) - 0.5) < 0.04) { r *= 0.6; g *= 0.6; b *= 0.6; h = 0.1; }  // form-tie holes
    if (hash(Math.floor(u * 256), Math.floor(v * 256), 83) < 0.02) { r *= 0.7; g *= 0.7; b *= 0.7; h = 0.3; }
    o[0] = r; o[1] = g; o[2] = b; o[3] = h;
  },
  asphalt(u, v, o) {
    const n = fbm(u, v, 4, 4, 91), sp = hash(Math.floor(u * 256), Math.floor(v * 256), 92), k = 0.85 + n * 0.25 + (sp - 0.5) * 0.3;
    const crack = Math.abs(fbm(u, v, 5, 4, 93) - 0.5) < 0.006;
    o[0] = 64 * k * (crack ? 0.5 : 1); o[1] = 66 * k * (crack ? 0.5 : 1); o[2] = 70 * k * (crack ? 0.5 : 1); o[3] = 0.5 + sp * 0.3 - (crack ? 0.4 : 0);
  },
  grass(u, v, o) {
    const n = fbm(u, v, 4, 4, 101), bl = hash(Math.floor(u * 256), Math.floor(v * 96), 102), dry = sm(0.55, 0.75, fbm(u, v, 3, 3, 103));
    const k = 0.75 + n * 0.3 + (bl - 0.5) * 0.35;
    o[0] = (84 + dry * 70) * k; o[1] = (132 + dry * 20) * k; o[2] = (60 + dry * 20) * k; o[3] = bl * 0.8;
  },
  roof(u, v, o) {
    const rows = 10, r = Math.floor(v * rows), pv = v * rows - r, x = u * 12 + (r % 2) * 0.5, cu = frac(x);
    const curve = Math.sin(cu * Math.PI), edge = pv > 0.85 ? 0.6 : 1, k = (0.7 + curve * 0.4) * edge * (0.9 + hash(Math.floor(x), r, 111) * 0.2);
    o[0] = 176 * k; o[1] = 86 * k; o[2] = 60 * k; o[3] = curve * 0.8 * edge;
  },
  carpet(u, v, o) {
    const w = ((Math.floor(u * 256) + Math.floor(v * 256)) % 2) * 0.06, n = fbm(u, v, 6, 3, 121), k = 0.85 + n * 0.2 + w;
    o[0] = 128 * k; o[1] = 38 * k; o[2] = 46 * k; o[3] = 0.5 + w;
  },
  tile(u, v, o) {
    const tu = frac(u * 4), tv = frac(v * 4), g = Math.min(tu, 1 - tu, tv, 1 - tv) < 0.03, t = hash(Math.floor(u * 4), Math.floor(v * 4), 131);
    const dirt = fbm(u, v, 4, 4, 132), k = g ? 0.6 : 0.92 + t * 0.08 - dirt * 0.12;
    o[0] = 206 * k; o[1] = 204 * k; o[2] = 198 * k; o[3] = g ? 0.1 : 0.7;
  },
  fence(u, v, o) { P.wood(v, u, o, [236, 232, 220], 8); },
  lava(u, v, o) {
    const n = fbm(u, v, 4, 5, 141), k = sm(0.35, 0.75, n);
    o[0] = 160 + 95 * k; o[1] = 40 + 160 * k * k; o[2] = 10 + 40 * k * k * k; o[3] = n;
  },
  rock(u, v, o) {
    cell(u, v, 6, 151, C); const crack = 1 - sm(0.03, 0.08, C[1] - C[0]), n = fbm(u, v, 16, 3, 152), k = (0.75 + C[2] * 0.3 + (n - 0.5) * 0.2) * (1 - crack * 0.55);
    o[0] = 118 * k; o[1] = 108 * k; o[2] = 98 * k; o[3] = 0.7 - crack * 0.7 + n * 0.2;
  },
  bus(u, v, o) {
    P.metal(u, v, o, [232, 182, 44], true);
    const wu = frac(u * 4), inWin = v > 0.12 && v < 0.42 && wu > 0.08 && wu < 0.92;
    if (inWin) { const refl = 0.6 + (1 - (v - 0.12) / 0.3) * 0.5; o[0] = 44 * refl; o[1] = 58 * refl; o[2] = 72 * refl; o[3] = 0.2; }
    if (v > 0.42 && v < 0.46) { o[0] = 30; o[1] = 30; o[2] = 30; }
  },
  potty(u, v, o) { const rib = 0.5 + 0.5 * Math.cos(u * Math.PI * 2 * 6), n = fbm(u, v, 8, 2, 161), k = 0.85 + rib * 0.15 + (n - 0.5) * 0.1; o[0] = 56 * k; o[1] = 108 * k; o[2] = 204 * k; o[3] = rib; },
  trim(u, v, o) { const n = fbm(u, v, 16, 3, 171), k = 0.9 + n * 0.12; o[0] = 222 * k; o[1] = 204 * k; o[2] = 166 * k; o[3] = 0.5 + n * 0.3; },
  sill(u, v, o) { const n = fbm(u, v, 16, 3, 172), k = 0.86 + n * 0.14; o[0] = 158 * k; o[1] = 140 * k; o[2] = 112 * k; o[3] = 0.5 + n * 0.3; },
};
const paintPlaster = (c) => (u, v, o) => { P.plaster(u, v, o); o[0] *= c[0] / 228; o[1] *= c[1] / 214; o[2] *= c[2] / 184; };
P.yellow = paintPlaster([226, 192, 96]); P.green = paintPlaster([120, 170, 128]);
P.cred = (u, v, o) => P.metal(u, v, o, [172, 56, 44], true); P.cblue = (u, v, o) => P.metal(u, v, o, [48, 94, 162], true);
P.cgreen = (u, v, o) => P.metal(u, v, o, [64, 128, 76], true); P.corange = (u, v, o) => P.metal(u, v, o, [214, 124, 44], true);
P.darkwood = (u, v, o) => P.wood(u, v, o, [92, 62, 42]);
P.woodplank = (u, v, o) => P.wood(u, v, o);
const ALIAS = { wood: 'woodplank' };

const cache = new Map();
// the colour canvas and (when asked) a height canvas for a material, size x size pixels
export function surface(name, size = 256, withBump = true) {
  const key = `${name}|${size}|${withBump}`;
  if (cache.has(key)) return cache.get(key);
  const fn = P[ALIAS[name] || name] || P.plaster;
  const col = document.createElement('canvas'); col.width = col.height = size;
  const cg = col.getContext('2d'), ci = cg.createImageData(size, size), cd = ci.data;
  let hd = null, hi = null, hg = null, hc = null;
  if (withBump) { hc = document.createElement('canvas'); hc.width = hc.height = size; hg = hc.getContext('2d'); hi = hg.createImageData(size, size); hd = hi.data; }
  const o = [0, 0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    fn((x + 0.5) / size, (y + 0.5) / size, o);
    const k = (y * size + x) * 4;
    cd[k] = o[0] < 0 ? 0 : o[0] > 255 ? 255 : o[0]; cd[k + 1] = o[1] < 0 ? 0 : o[1] > 255 ? 255 : o[1]; cd[k + 2] = o[2] < 0 ? 0 : o[2] > 255 ? 255 : o[2]; cd[k + 3] = 255;
    if (hd) { const h = Math.max(0, Math.min(255, o[3] * 255)); hd[k] = hd[k + 1] = hd[k + 2] = h; hd[k + 3] = 255; }
  }
  cg.putImageData(ci, 0, 0); if (hg) hg.putImageData(hi, 0, 0);
  const r = { map: col, bump: hc };
  cache.set(key, r);
  return r;
}
export const SURFACES = Object.keys(P);

// a soft, tiling grey noise used to vary surfaces over many metres (so repeating tiles don't show)
export function macroCanvas(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), im = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = fbm(x / size, y / size, 4, 4, 901) * 255, k = (y * size + x) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
}

// tiling cloud cover (alpha = cloud), for the sky dome
export function cloudCanvas(size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), im = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const f = fbm(x / size, y / size, 4, 5, 777), a = Math.max(0, Math.min(1, (f - 0.47) / 0.25)), k = (y * size + x) * 4, sh = 250 - a * 45;
    im.data[k] = sh; im.data[k + 1] = sh; im.data[k + 2] = sh + 5; im.data[k + 3] = a * 255;
  }
  g.putImageData(im, 0, 0); return c;
}
