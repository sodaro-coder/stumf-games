// The map's baked light, as one RGBA texel per 1/K m of floor (world.js samples it in every surface shader):
//   R  how high the sun's shadow reaches at this spot (a point above it is in sunlight)
//   G  ambient occlusion on the floor (corners, under walls)
//   B  the floor's height (walls darken towards their foot)
//   A  indirect light: how much sky this spot sees, plus sunlight bounced off nearby lit floors (0.5 = unchanged)
//
// Two qualities from the same code:
//   quick  run in the browser while a map loads (and for maps made in the editor): one hard sun ray, 8-way AO, no GI.
//   full   run OFFLINE by browserdev/lightbake.mjs (on a PC or a free GitHub Actions runner), never on the player's
//          machine: a soft sun (12 rays over the sun's disc and penumbra), 16-way AO at 8 distances, sky visibility from
//          32 horizon traces and one bounce of sunlight. Shipped gzipped per map (bake_<map>.lmz) and swapped in when
//          it arrives, so weak PCs get path-traced-style light for the price of one texture read.
// Pure JavaScript (no three.js, no DOM): the same file runs in Node.
export const BAKE_VERSION = 1;

export function bakeLight(c, full = false) {
  const { w, d, K, topR, roofAt, occAt, maxH, sd, albedo } = c, TW = w * K, TD = d * K;
  const out = new Uint8Array(TW * TD * 4), enc = (v) => Math.max(0, Math.min(255, Math.round((v + 2) / 16 * 255)));
  const sl = Math.hypot(sd[0], sd[2]), st = 1 / K;
  // sun rays: the centre ray, or (full) a disc of rays spread ~2.5 degrees for soft shadow edges
  const rays = [];
  const az0 = Math.atan2(sd[2], sd[0]), el0 = Math.atan2(sd[1], sl);
  if (!full) rays.push([Math.cos(az0), Math.sin(az0), Math.tan(el0)]);
  else for (let k = 0; k < 12; k++) { const a = k * 2.39996, r = 0.045 * Math.sqrt((k + 0.5) / 12); rays.push([Math.cos(az0 + Math.cos(a) * r), Math.sin(az0 + Math.cos(a) * r), Math.tan(el0 + Math.sin(a) * r)]); }
  const AO_D = full ? [0.2, 0.4, 0.65, 0.95, 1.35, 1.9, 2.6, 3.4] : [0.3, 0.65, 1.1, 1.8, 2.6];
  const NDIR = full ? 16 : 8, AO_DIR = [];
  for (let k = 0; k < NDIR; k++) { const a = k / NDIR * Math.PI * 2; AO_DIR.push([Math.cos(a), Math.sin(a)]); }
  const sunH = (px, pz, y0, best0, hx, hz, tanEl) => {
    let best = best0; const ox = Math.floor(px), oz = Math.floor(pz);
    for (let t = st; ; t += st) {
      const lim = maxH - t * tanEl; if (lim <= best || lim < y0 - 0.3) break;
      const qx = px + hx * t, qz = pz + hz * t; if (Math.floor(qx) === ox && Math.floor(qz) === oz) continue;
      const v = occAt(qx, qz) - t * tanEl; if (v > best) best = v;
    }
    return best;
  };
  for (let tz = 0; tz < TD; tz++) for (let tx = 0; tx < TW; tx++) {
    const px = (tx + 0.5) / K, pz = (tz + 0.5) / K, y0 = topR(px, pz);
    const rOver = roofAt(px, pz), under = rOver > y0, b0 = under ? rOver : -2;
    let best = 0; for (const [hx, hz, tanEl] of rays) best += sunH(px, pz, y0, b0, hx, hz, tanEl); best /= rays.length;
    let occ = 0;
    for (const [dx, dz] of AO_DIR) { let mo = 0; for (const dd of AO_D) { const dh = topR(px + dx * dd, pz + dz * dd) - y0; if (dh > 0.05) { const s = dh / Math.hypot(dh, dd); if (s > mo) mo = s; } } occ += mo; }
    const k = (tz * TW + tx) * 4;
    out[k] = enc(best); out[k + 1] = Math.round(255 * (1 - occ / NDIR * 0.8) * (under ? 0.62 : 1)); out[k + 2] = enc(y0); out[k + 3] = 128;
  }
  if (full) indirect(c, out, TW, TD);
  return { K, TW, TD, data: out };
}

// sky visibility + one bounce, into A. Computed on a 2 texel-per-metre grid (light this soft needs no more), then
// spread over the full-resolution texels; normalised so open ground keeps the map's balanced brightness (A ~ 0.5).
function indirect(c, out, TW, TD) {
  const { w, d, K, topR, occAt, albedo } = c, G = 2, GW = w * G, GD = d * G, gi = new Float32Array(GW * GD);
  const sunlit = (x, z) => { const tx = Math.min(TW - 1, Math.max(0, Math.floor(x * K))), tz = Math.min(TD - 1, Math.max(0, Math.floor(z * K))); const sh = out[(tz * TW + tx) * 4] / 255 * 16 - 2; return topR(x, z) + 0.05 > sh ? 1 : 0; };
  const DIRS = 32, vals = [];
  for (let j = 0; j < GD; j++) for (let i = 0; i < GW; i++) {
    const px = (i + 0.5) / G, pz = (j + 0.5) / G, y = topR(px, pz) + 0.4;
    let open = 0, bounce = 0, bw = 0;
    for (let k = 0; k < DIRS; k++) {
      const a = k / DIRS * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a); let hz = 0, hitT = 0;
      for (let t = 0.35; t < 28; t += t < 3 ? 0.35 : t < 10 ? 0.8 : 1.6) { const e = (occAt(px + dx * t, pz + dz * t) - y) / t; if (e > hz) { hz = e; hitT = t; } }
      const sinH = hz / Math.hypot(1, hz); open += 1 - sinH;
      // what that blocker throws back: a sunlit wall face nearby reflects its colour into this spot
      if (hitT > 0 && hitT < 10) { const qx = px + dx * (hitT - 0.3), qz = pz + dz * (hitT - 0.3), al = albedo(px + dx * hitT, pz + dz * hitT); bounce += sinH * (al[0] + al[1] + al[2]) / 765 * sunlit(qx, qz) / (1 + hitT * 0.15); bw += 1; }
      // and the floor around it, lit by the sun
    }
    let fl = 0, fn = 0;
    for (let b = -2; b <= 2; b += 1) for (let a = -2; a <= 2; a += 1) { const al = albedo(px + a, pz + b); fl += (al[0] + al[1] + al[2]) / 765 * sunlit(px + a, pz + b); fn++; }
    open /= DIRS; const v = (0.35 + 0.65 * open) + 0.45 * (bw ? bounce / DIRS * 4 : 0) + 0.15 * fl / fn;
    gi[j * GW + i] = v; vals.push(v);
  }
  vals.sort((a, b) => a - b); const ref = vals[Math.floor(vals.length * 0.85)] || 1;   // open ground: unchanged
  for (let tz = 0; tz < TD; tz++) for (let tx = 0; tx < TW; tx++) {
    const gx = Math.min(GW - 1.001, Math.max(0, (tx + 0.5) / K * G - 0.5)), gz = Math.min(GD - 1.001, Math.max(0, (tz + 0.5) / K * G - 0.5)), i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
    const i1 = Math.min(GW - 1, i + 1), j1 = Math.min(GD - 1, j + 1);
    const g = (gi[j * GW + i] * (1 - u) + gi[j * GW + i1] * u) * (1 - v) + (gi[j1 * GW + i] * (1 - u) + gi[j1 * GW + i1] * u) * v;
    out[(tz * TW + tx) * 4 + 3] = Math.max(0, Math.min(255, Math.round(g / ref * 0.5 * 255)));
  }
}

// the key a shipped bake is valid for: the map's heights and its sun (weather can move the sun)
export function bakeKey(hash, sd) { return `${BAKE_VERSION}:${hash}:${sd.map((v) => Math.round(v * 100)).join(',')}`; }
