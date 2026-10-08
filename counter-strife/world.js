// The world: every map is a 1 m height grid (floors, platforms, ramps, walls, crates, cars) authored with a tiny
// builder. One grid gives everything the game needs, cheaply: merged meshes (one draw call per material), player
// collision (step up small ledges, slide along walls), bullet raycasts with wall penetration, line of sight for bots,
// and A* paths. That's what keeps it smooth on weak machines.
import * as THREE from '../sdk/three.module.min.js';
import { PHYS } from './data.js';
import { surface, macroCanvas } from './textures.js';
import { raiseBuildings, dressWorld, mergeGeos } from './dress.js';

export const MATS = {  // surfaces (painted in textures.js): base colour (radar, particles), world size of one texture tile (m), wall-bang density
  sand: { c: [196, 168, 118], s: 3, d: 6 }, sandwall: { c: [214, 186, 136], s: 4, d: 4, trim: 1 },
  plaster: { c: [222, 206, 172], s: 3, d: 3, trim: 1 }, brick: { c: [150, 82, 62], s: 2, d: 5, trim: 1 },
  wood: { c: [138, 98, 58], s: 2, d: 1 }, crate: { c: [160, 118, 64], s: 1, d: 1 },
  metal: { c: [120, 128, 136], s: 2, d: 2.5 }, concrete: { c: [150, 150, 146], s: 4, d: 6, trim: 1 },
  asphalt: { c: [62, 64, 68], s: 4, d: 8 }, grass: { c: [92, 140, 70], s: 3, d: 6 },
  roof: { c: [120, 60, 50], s: 2, d: 3 }, carpet: { c: [120, 40, 46], s: 2, d: 6 }, tile: { c: [200, 200, 196], s: 1.2, d: 6 },
  cred: { c: [168, 54, 44], s: 2, d: 2.5 }, cblue: { c: [46, 92, 160], s: 2, d: 2.5 },
  cgreen: { c: [62, 128, 74], s: 2, d: 2.5 }, corange: { c: [210, 120, 40], s: 2, d: 2.5 },
  yellow: { c: [226, 190, 80], s: 3, d: 3, trim: 1 }, green: { c: [110, 168, 120], s: 3, d: 3, trim: 1 },
  fence: { c: [236, 232, 220], s: 2, d: 1 }, lava: { c: [240, 90, 20], s: 4, d: 9, glow: true },
  dirt: { c: [120, 92, 66], s: 3, d: 6 }, rock: { c: [110, 100, 92], s: 4, d: 8, trim: 1 }, bus: { c: [232, 180, 40], s: 3, d: 2 },
  potty: { c: [60, 110, 200], s: 1, d: 1 }, darkwood: { c: [86, 58, 40], s: 2, d: 1 },
  trim: { c: [222, 204, 166], s: 2, d: 6 }, sill: { c: [158, 140, 112], s: 2, d: 6 },
};
export const MAT_LIST = Object.keys(MATS);
const MAT_ID = Object.fromEntries(MAT_LIST.map((k, i) => [k, i]));

// ---- the builder maps are written with ----------------------------------------------------------------------------
export class MapBuilder {
  constructor(w, d, wallH = 7, wallMat = 'sandwall', floorMat = 'sand') {
    this.w = w; this.d = d; this.wallH = wallH;
    this.h = new Float32Array(w * d).fill(wallH);
    this.mat = new Uint8Array(w * d).fill(MAT_ID[wallMat]);
    this.flag = new Uint8Array(w * d);  // 1 = lava, 2 = open (walkable area)
    this.rid = new Int16Array(w * d).fill(-1); this.ramps = [];  // which ramp a cell belongs to (drawn and walked as a smooth slope)
    this.floorMat = floorMat; this.wallMat = wallMat;
    this.spawns = { T: [], CT: [] }; this.sites = {}; this.zones = []; this.buy = {}; this.signs = []; this.props = []; this.duel = { T: [], CT: [] };
  }
  _rect(x0, z0, x1, z1, fn) {
    for (let z = Math.max(0, z0); z < Math.min(this.d, z1); z++) for (let x = Math.max(0, x0); x < Math.min(this.w, x1); x++) { this.rid[z * this.w + x] = -1; fn(z * this.w + x, x, z); }
  }
  open(x0, z0, x1, z1, h = 0, mat = this.floorMat) { this._rect(x0, z0, x1, z1, (i) => { this.h[i] = h; this.mat[i] = MAT_ID[mat]; this.flag[i] = 2; }); return this; }
  // stairs/ramp rising from h0 to h1 along +x ('x'), -x ('-x'), +z ('z') or -z ('-z')
  ramp(x0, z0, x1, z1, h0, h1, dir, mat = this.floorMat) {
    const n = dir.endsWith('x') ? x1 - x0 : z1 - z0, r = this.ramps.length;
    this.ramps.push({ x0, z0, x1, z1, h0, h1, dir, n });
    this._rect(x0, z0, x1, z1, (i, x, z) => {
      let k = dir.endsWith('x') ? x - x0 : z - z0; if (dir[0] === '-') k = n - 1 - k;
      this.h[i] = h0 + (h1 - h0) * (k + 1) / n; this.mat[i] = MAT_ID[mat]; this.flag[i] = 2; this.rid[i] = r;
    });
    return this;
  }
  block(x0, z0, x1, z1, h, mat = 'crate') { this._rect(x0, z0, x1, z1, (i) => { this.h[i] = h; this.mat[i] = MAT_ID[mat]; this.flag[i] = 0; }); return this; }
  // raise by h from the floor already there (crates on a raised site)
  stack(x0, z0, x1, z1, h, mat = 'crate') { this._rect(x0, z0, x1, z1, (i) => { this.h[i] += h; this.mat[i] = MAT_ID[mat]; this.flag[i] = 0; }); return this; }
  solid(x0, z0, x1, z1, mat = this.wallMat, h = this.wallH) { this._rect(x0, z0, x1, z1, (i) => { this.h[i] = h; this.mat[i] = MAT_ID[mat]; this.flag[i] = 0; }); return this; }
  lava(x0, z0, x1, z1, h = -0.3) { this._rect(x0, z0, x1, z1, (i) => { this.h[i] = h; this.mat[i] = MAT_ID.lava; this.flag[i] = 3; }); return this; }
  // a hollow building: walls of thickness 1 around the rect with the given gaps (doors open, windows a sill to jump over)
  house(x0, z0, x1, z1, h, mat, floor, gaps = []) {
    this.open(x0, z0, x1, z1, 0, floor);
    this.block(x0, z0, x1, z0 + 1, h, mat); this.block(x0, z1 - 1, x1, z1, h, mat); this.block(x0, z0, x0 + 1, z1, h, mat); this.block(x1 - 1, z0, x1, z1, h, mat);
    for (const [gx0, gz0, gx1, gz1, sill] of gaps) sill ? this.block(gx0, gz0, gx1, gz1, sill, mat) : this.open(gx0, gz0, gx1, gz1, 0, floor);
    this.roofs = this.roofs || []; this.roofs.push([x0, z0, x1, z1, h]);
    return this;
  }
  spawn(team, x, z, yaw = 0) { this.spawns[team].push([x, z, yaw]); return this; }
  duelSpawn(team, x, z, yaw = 0) { this.duel[team].push([x, z, yaw]); return this; }
  site(name, x0, z0, x1, z1) { this.sites[name] = [x0, z0, x1, z1]; return this; }
  zone(name, x0, z0, x1, z1) { this.zones.push([name, x0, z0, x1, z1]); return this; }
  buyzone(team, x0, z0, x1, z1) { this.buy[team] = [x0, z0, x1, z1]; return this; }
  // a sign with text painted on a board: x,z position, y height, rot = facing (radians), w,h size in m
  sign(x, z, y, rot, text, w = 3, h = 1, bg = '#2b2118', fg = '#f4e7c4') { this.signs.push({ x, z, y, rot, text, w, h, bg, fg }); return this; }
  prop(type, x, z, o = {}) { this.props.push({ type, x, z, ...o }); return this; }
}

// ---- lighting shared by the world and the players: the baked sun-shadow/AO texture, applied in the shader ----
export const LIGHT = { shTex: { value: null }, shInfo: { value: new THREE.Vector4(1, 1, 0, 0) }, macro: { value: null }, bake: { value: 0 } };
let macroT = null;
export const macroTex = () => { if (!macroT) { macroT = new THREE.CanvasTexture(macroCanvas(64)); macroT.wrapS = macroT.wrapT = THREE.RepeatWrapping; } return macroT; };
// three's bump mapping divides by zero when the camera is exactly level (the resting aim in an FPS): a guarded copy
const BUMP_SAFE = `#ifdef USE_BUMPMAP
uniform sampler2D bumpMap;
uniform float bumpScale;
vec2 dHdxy_fwd() {
  vec2 dSTdx = dFdx( vBumpMapUv ), dSTdy = dFdy( vBumpMapUv );
  float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
  return vec2( bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll, bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll );
}
vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
  vec3 dx = dFdx( surf_pos.xyz ), dy = dFdy( surf_pos.xyz );
  if ( dot( dx, dx ) < 1e-14 || dot( dy, dy ) < 1e-14 ) return surf_norm;
  vec3 vSigmaX = normalize( dx ), vSigmaY = normalize( dy ), R1 = cross( vSigmaY, surf_norm ), R2 = cross( surf_norm, vSigmaX );
  float fDet = dot( vSigmaX, R1 ) * faceDirection;
  if ( abs( fDet ) < 1e-5 ) return surf_norm;
  vec3 n = abs( fDet ) * surf_norm - sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
  return dot( n, n ) > 1e-12 ? normalize( n ) : surf_norm;
}
#endif`;
// kind 'world': static surfaces (shadow looked up just outside the surface, AO on floors and wall bases, large-scale
// colour variation so tiling doesn't show); 'dyn': players and props (shadow at their own position)
export function litPatch(mat, kind = 'dyn') {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.shTex = LIGHT.shTex; sh.uniforms.shInfo = LIGHT.shInfo; sh.uniforms.macroTex = LIGHT.macro; sh.uniforms.bakeOn = LIGHT.bake;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    let f = sh.fragmentShader.replace('#include <bumpmap_pars_fragment>', BUMP_SAFE).replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\nuniform sampler2D shTex;\nuniform vec4 shInfo;\nuniform sampler2D macroTex;\nuniform float bakeOn;');
    if (kind === 'world') f = f.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb *= mix(1.0, 0.8 + 0.4 * texture2D(macroTex, vWP.xz * 0.037 + vec2(vWP.y * 0.029, vWP.y * 0.013)).r, bakeOn);');
    f = f.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
	{
		vec4 bk = texture2D(shTex, (vWP.xz + ${kind === 'world' ? 'vWN.xz * 0.3' : 'vec2(0.0)'}) * shInfo.xy);
		float shH = bk.r * 16.0 - 2.0;
		float vis = smoothstep(shH - 0.05, shH + 0.16, vWP.y);
		float ao = 1.0;
		${kind === 'world' ? 'if (vWN.y > 0.5) ao = bk.g; else if (vWN.y > -0.5) ao = mix(0.45, 1.0, smoothstep(0.0, 1.4, vWP.y - (bk.b * 16.0 - 2.0)));' : 'ao = mix(0.7, 1.0, smoothstep(0.0, 0.9, vWP.y - (bk.b * 16.0 - 2.0)));'}
		vis = mix(1.0, vis, bakeOn); ao = mix(1.0, ao, bakeOn);
		reflectedLight.directDiffuse *= vis * mix(1.0, ao, 0.35);
		reflectedLight.indirectDiffuse *= ao;
	}`);
    sh.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => 'lit-' + kind;
  return mat;
}

// ---- the world built from a map ----------------------------------------------------------------------------------
export function buildWorld(E, def, scene, quality = 1, opt = {}) {
  const B = def.build();
  const { w, d, h, mat, flag } = B;
  const rid = B.rid, ramps = B.ramps, headless = typeof document === 'undefined';
  const idx = (x, z) => (x < 0 || z < 0 || x >= w || z >= d ? -1 : z * w + x);
  const H = (x, z) => { const i = idx(x, z); return i < 0 ? B.wallH : h[i]; };
  // ramps are smooth slopes: the slope's height at a point (clamped to the ramp)
  const slope = (r, x, z) => {
    const R = ramps[r]; let k;
    switch (R.dir) { case 'x': k = (x - R.x0) / R.n; break; case '-x': k = (R.x1 - x) / R.n; break; case 'z': k = (z - R.z0) / R.n; break; default: k = (R.z1 - z) / R.n; }
    return R.h0 + (R.h1 - R.h0) * Math.min(1, Math.max(0, k));
  };
  // the surface height at a point; a cell's height as seen from a point (ramps: the slope at the cell's nearest point)
  const topAt = (x, z) => { const i = idx(Math.floor(x), Math.floor(z)); if (i < 0) return B.wallH; return rid[i] >= 0 ? slope(rid[i], x, z) : h[i]; };
  // what you see can be taller than what you collide with: buildings rise above the playable walls (looks only)
  const hr = Float32Array.from(h); if (!headless) raiseBuildings(B, hr, (m) => MAT_LIST[m]);
  const topR = (x, z) => { const i = idx(Math.floor(x), Math.floor(z)); if (i < 0) return B.wallH; return rid[i] >= 0 ? slope(rid[i], x, z) : hr[i]; };
  const cellTop = (xx, zz, px, pz) => { const i = idx(xx, zz); if (i < 0) return B.wallH; const r = rid[i]; return r < 0 ? h[i] : slope(r, Math.min(xx + 1, Math.max(xx, px)), Math.min(zz + 1, Math.max(zz, pz))); };

  // --- meshes: greedy-merged tops + side faces, one mesh per material; ramps as slopes; stone coping along wall tops ---
  const geo = MAT_LIST.map(() => ({ pos: [], uv: [], idx: [] }));
  const quad = (m, a, b, c, dd, uvs) => {
    const g = geo[m], base = g.pos.length / 3;
    g.pos.push(...a, ...b, ...c, ...dd); g.uv.push(...uvs); g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const tsOf = (m) => 1 / MATS[MAT_LIST[m]].s;
  // a horizontal quad (y per corner: (x0,z1) (x1,z1) (x1,z0) (x0,z0)); down = facing down
  const flat = (m, x0, z0, x1, z1, ya, yb = ya, yc = ya, yd = ya, down = false) => {
    const k = tsOf(m);
    if (!down) quad(m, [x0, ya, z1], [x1, yb, z1], [x1, yc, z0], [x0, yd, z0], [x0 * k, z1 * k, x1 * k, z1 * k, x1 * k, z0 * k, x0 * k, z0 * k]);
    else quad(m, [x0, yd, z0], [x1, yc, z0], [x1, yb, z1], [x0, ya, z1], [x0 * k, z0 * k, x1 * k, z0 * k, x1 * k, z1 * k, x0 * k, z1 * k]);
  };
  // a vertical face on the dir side of column/row a, along s0..s1, bottom b0/b1 and top t0/t1 at each end, pushed out by off
  const wallFace = (m, dirx, dirz, a, s0, s1, b0, b1, t0, t1, off = 0) => {
    const f = (dirx || dirz) > 0 ? a + 1 : a, k = tsOf(m), flip = dirx > 0 || dirz < 0, sg = flip ? -1 : 1;
    const P = (s, y) => (dirx ? [f + dirx * off, y, s] : [s, y, f + dirz * off]);
    if (flip) quad(m, P(s1, b1), P(s0, b0), P(s0, t0), P(s1, t1), [s1 * k * sg, b1 * k, s0 * k * sg, b0 * k, s0 * k * sg, t0 * k, s1 * k * sg, t1 * k]);
    else quad(m, P(s0, b0), P(s1, b1), P(s1, t1), P(s0, t0), [s0 * k * sg, b0 * k, s1 * k * sg, b1 * k, s1 * k * sg, t1 * k, s0 * k * sg, t0 * k]);
  };
  const TRIM = MAT_ID.trim;
  const coping = (dirx, dirz, a, s0, s1, top) => {   // a capstone ledge: front, underside and cap
    const o = 0.08, ch = 0.2, lip = 0.03, e0 = s0 - o, e1 = s1 + o, f = (dirx || dirz) > 0 ? a + 1 : a, dir = dirx || dirz;
    wallFace(TRIM, dirx, dirz, a, e0, e1, top - ch, top - ch, top + lip, top + lip, o);
    const pa = f + dir * o, pb = f - dir * 0.3, lo = Math.min(pa, pb), hi2 = Math.max(pa, pb), la = Math.min(f, pa), ha = Math.max(f, pa);
    if (dirx) { flat(TRIM, la, e0, ha, e1, top - ch, top - ch, top - ch, top - ch, true); flat(TRIM, lo, e0, hi2, e1, top + lip); }
    else { flat(TRIM, e0, la, e1, ha, top - ch, top - ch, top - ch, top - ch, true); flat(TRIM, e0, lo, e1, hi2, top + lip); }
  };
  // tops: greedy rectangles of equal (height, material); ramp cells get sloped quads of their own
  const done = new Uint8Array(w * d);
  for (let i = 0; i < w * d; i++) if (rid[i] >= 0) { done[i] = 1; const x = i % w, z = (i / w) | 0, r = rid[i]; flat(mat[i], x, z, x + 1, z + 1, slope(r, x, z + 1), slope(r, x + 1, z + 1), slope(r, x + 1, z), slope(r, x, z)); }
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    const i = z * w + x; if (done[i]) continue;
    const hh = hr[i], mm = mat[i];
    let x1 = x + 1; while (x1 < w && !done[z * w + x1] && hr[z * w + x1] === hh && mat[z * w + x1] === mm) x1++;
    let z1 = z + 1;
    outer: while (z1 < d) { for (let k = x; k < x1; k++) { const j = z1 * w + k; if (done[j] || hr[j] !== hh || mat[j] !== mm) break outer; } z1++; }
    for (let zz = z; zz < z1; zz++) for (let k = x; k < x1; k++) done[zz * w + k] = 1;
    flat(mm, x, z, x1, z1, hh);
  }
  // sides: where a cell is higher than its neighbour, merged along rows
  const side = (dirx, dirz) => {
    const along = dirx ? d : w, across = dirx ? w : d;
    for (let a = 0; a < across; a++) {
      let run = null;
      const flush = () => {
        if (!run) return;
        const { s0, s1, top, bot, m } = run;
        wallFace(m, dirx, dirz, a, s0, s1, bot, bot, top, top); faces.push({ dirx, dirz, a, s0, s1, bot, top, m });
        if (MATS[MAT_LIST[m]].trim && top - bot >= 1.6 && top >= 2.2) coping(dirx, dirz, a, s0, s1, top);
        run = null;
      };
      for (let b = 0; b < along; b++) {
        const x = dirx ? a : b, z = dirx ? b : a, i = z * w + x;
        const ni = idx(x + dirx, z + dirz), m = mat[i], ri = rid[i], rn = ni >= 0 ? rid[ni] : -1;
        if (ri >= 0 || rn >= 0) {   // a ramp on either side: one cell's face, following the slope
          flush();
          const f = (dirx || dirz) > 0 ? a + 1 : a, ax = dirx ? f : b, az = dirx ? b : f, bx = dirx ? f : b + 1, bz = dirx ? b + 1 : f;
          const tA = ri >= 0 ? slope(ri, ax, az) : hr[i], tB = ri >= 0 ? slope(ri, bx, bz) : hr[i];
          const bA = ni < 0 ? tA : rn >= 0 ? slope(rn, ax, az) : hr[ni], bB = ni < 0 ? tB : rn >= 0 ? slope(rn, bx, bz) : hr[ni];
          if (tA > bA + 1e-3 || tB > bB + 1e-3) wallFace(m, dirx, dirz, a, b, b + 1, bA, bB, Math.max(tA, bA), Math.max(tB, bB));
          continue;
        }
        const top = hr[i], bot = ni < 0 ? top : hr[ni];
        if (top > bot + 1e-3) {
          if (run && run.top === top && run.bot === bot && run.m === m && run.s1 === b) run.s1 = b + 1;
          else { flush(); run = { s0: b, s1: b + 1, top, bot, m }; }
        } else flush();
      }
      flush();
    }
  };
  const faces = [];
  side(1, 0); side(-1, 0); side(0, 1); side(0, -1);
  // set dressing (windows, lintels, beams, pipes, sand drifts, rooftop clutter): extra geometry per material
  const extra = new Map();
  if (!headless && quality >= 0.75) dressWorld({ B, hr, mat, flag, faces, matName: (m) => MAT_LIST[m], ts: (k) => 1 / ((MATS[k] || { s: 2 }).s), add: (k, g) => { if (!extra.has(k)) extra.set(k, []); extra.get(k).push(g); } });

  // --- baked light: for every 1/K m of floor, how high the sun's shadow reaches there, plus ambient occlusion ---
  // One small texture gives soft sun shadows on every floor, wall and player and darkened corners, for the price of a
  // texture read: nothing is re-rendered per frame, so it's as fast on a school laptop as on a gaming PC.
  const K = opt.bakeK || (quality >= 1.5 ? 6 : quality >= 0.75 ? 4 : 2), TW = w * K, TD = d * K;
  const sd = B.sunDir || [0.62, 0.66, 0.42], sl = Math.hypot(sd[0], sd[2]), hx = sd[0] / sl, hz = sd[2] / sl, tanEl = sd[1] / sl;
  let maxH = B.wallH; for (let i = 0; i < w * d; i++) if (hr[i] > maxH) maxH = hr[i];
  const bake = new Uint8Array(TW * TD * 4), enc = (v) => Math.max(0, Math.min(255, Math.round((v + 2) / 16 * 255)));
  const AO_D = [0.3, 0.65, 1.1, 1.8, 2.6], AO_DIR = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707]];
  const st = 1 / K;
  for (let tz = 0; tz < TD; tz++) for (let tx = 0; tx < TW; tx++) {
    const px = (tx + 0.5) / K, pz = (tz + 0.5) / K, ox = Math.floor(px), oz = Math.floor(pz), y0 = topR(px, pz);
    let best = -2;
    for (let t = st; ; t += st) {
      const lim = maxH - t * tanEl; if (lim <= best || lim < y0 - 0.3) break;
      const qx = px + hx * t, qz = pz + hz * t; if (Math.floor(qx) === ox && Math.floor(qz) === oz) continue;
      const c = topR(qx, qz) - t * tanEl; if (c > best) best = c;
    }
    let occ = 0;
    for (const [dx, dz] of AO_DIR) { let mo = 0; for (const dd of AO_D) { const dh = topR(px + dx * dd, pz + dz * dd) - y0; if (dh > 0.05) { const s = dh / Math.hypot(dh, dd); if (s > mo) mo = s; } } occ += mo; }
    const k = (tz * TW + tx) * 4;
    bake[k] = enc(best); bake[k + 1] = Math.round(255 * (1 - occ / 8 * 0.8)); bake[k + 2] = enc(y0); bake[k + 3] = 255;
  }
  const bakeTex = new THREE.DataTexture(bake, TW, TD, THREE.RGBAFormat, THREE.UnsignedByteType);
  bakeTex.magFilter = bakeTex.minFilter = THREE.LinearFilter; bakeTex.needsUpdate = true;
  const useLight = () => { LIGHT.shTex.value = bakeTex; LIGHT.shInfo.value.set(1 / w, 1 / d, 0, 0); LIGHT.bake.value = 1; if (!LIGHT.macro.value && !headless) LIGHT.macro.value = macroTex(); };
  useLight();
  // is the sun hitting this point? (CPU side of the same bake: the first-person arms darken in the shade)
  const sunAt = (x, y, z) => {
    const tx = Math.min(TW - 1, Math.max(0, Math.floor(x * K))), tz = Math.min(TD - 1, Math.max(0, Math.floor(z * K)));
    const sh = bake[(tz * TW + tx) * 4] / 255 * 16 - 2; return Math.min(1, Math.max(0, (y - sh + 0.05) / 0.2));
  };

  const group = new THREE.Group(); scene.add(group);
  const texSize = quality >= 1 ? 256 : 128, bumpOn = quality >= 1, aniso = Math.min(8, opt.aniso || 1);
  const texCache = {};
  const matTex = (k) => {
    if (texCache[k]) return texCache[k];
    const sf = surface(k, texSize, bumpOn), mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
    return (texCache[k] = { map: mk(sf.map, true), bump: sf.bump ? mk(sf.bump, false) : null });
  };
  const worldMat = (k) => {
    if (headless) return new THREE.MeshBasicMaterial();   // simulations without a browser: geometry only
    const M = MATS[k], t = matTex(k);
    if (M.glow) return new THREE.MeshBasicMaterial({ map: t.map });
    return litPatch(new THREE.MeshLambertMaterial({ map: t.map, bumpMap: t.bump, bumpScale: t.bump ? 1.2 : 1 }), 'world');
  };
  geo.forEach((g, m) => {
    if (!g.pos.length) return;
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    bg.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    bg.setIndex(g.idx); bg.computeVertexNormals();
    const mesh = new THREE.Mesh(bg, worldMat(MAT_LIST[m])); mesh.matrixAutoUpdate = false; group.add(mesh);
  });
  for (const [k, list] of extra) {
    const mt = k === 'glassdark' ? litPatch(new THREE.MeshLambertMaterial({ color: 0x1c2328 }), 'world') : worldMat(k);
    const mesh = new THREE.Mesh(mergeGeos(list), mt); mesh.matrixAutoUpdate = false; group.add(mesh); list.forEach((g) => g.dispose());
  }
  // roofs over buildings (look only: walls are too tall to climb)
  const roofM = worldMat('roof');
  for (const [x0, z0, x1, z1, rh] of B.roofs || []) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.6, 0.3, z1 - z0 + 0.6), roofM);
    r.position.set((x0 + x1) / 2, rh + 0.15, (z0 + z1) / 2); group.add(r);
  }

  // --- signs (text painted onto a board) ---
  const boardM = worldMat('darkwood');
  for (const s of B.signs) {
    const cw = 256, ch = Math.max(32, Math.round(256 * s.h / s.w));
    const c = E.tex.canvas(cw, ch, (g) => {
      g.fillStyle = s.bg; g.fillRect(0, 0, cw, ch); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 6; g.strokeRect(3, 3, cw - 6, ch - 6);
      g.fillStyle = s.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lines = String(s.text).split('\n'); let fs = Math.min(ch / (lines.length + 0.6), 44);
      g.font = `900 ${fs}px system-ui,sans-serif`;
      while (lines.some((l) => g.measureText(l).width > cw - 16) && fs > 9) { fs -= 1; g.font = `900 ${fs}px system-ui,sans-serif`; }
      lines.forEach((l, k) => g.fillText(l, cw / 2, ch / 2 + (k - (lines.length - 1) / 2) * fs * 1.08));
      const gr = g.createLinearGradient(0, 0, cw, ch); if (gr) { gr.addColorStop(0, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = gr; g.fillRect(0, 0, cw, ch); }
    });
    const t = headless ? null : new THREE.CanvasTexture(c); if (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), litPatch(new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }), 'world'));
    m.position.set(s.x, s.y, s.z); m.rotation.y = s.rot; group.add(m);
    const bd = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.12, s.h + 0.12, 0.05), boardM);
    bd.position.set(s.x - Math.sin(s.rot) * 0.03, s.y, s.z - Math.cos(s.rot) * 0.03); bd.rotation.y = s.rot; group.add(bd);
  }

  // --- collision helpers ---
  const R = PHYS.radius;
  // highest floor under a circle that's within stepping reach of the feet (what you stand on)
  const groundAt = (x, z, feet, r = R) => {
    let g = -50;
    for (let zz = Math.floor(z - r); zz <= Math.floor(z + r); zz++) for (let xx = Math.floor(x - r); xx <= Math.floor(x + r); xx++) {
      const hh = cellTop(xx, zz, x, z); if (hh <= feet + PHYS.step + 1e-3 && hh > g) g = hh;
    }
    return g;
  };
  // move a circle (feet at y) by dx,dz, sliding along walls; anything higher than feet+step blocks
  const move = (p, dx, dz, r = R, step = PHYS.step) => {
    const lim = p.y + step + 1e-3;
    const tryAxis = (ax) => {
      const nx = ax === 0 ? p.x + dx : p.x, nz = ax === 1 ? p.z + dz : p.z;
      for (let zz = Math.floor(nz - r); zz <= Math.floor(nz + r); zz++) for (let xx = Math.floor(nx - r); xx <= Math.floor(nx + r); xx++) {
        if (cellTop(xx, zz, nx, nz) > lim) {
          if (ax === 0) p.x = dx > 0 ? Math.min(nx, xx - r - 1e-4) : Math.max(nx, xx + 1 + r + 1e-4); else p.z = dz > 0 ? Math.min(nz, zz - r - 1e-4) : Math.max(nz, zz + 1 + r + 1e-4);
          return false;
        }
      }
      if (ax === 0) p.x = nx; else p.z = nz;
      return true;
    };
    const bx = tryAxis(0), bz = tryAxis(1);
    return bx && bz;
  };
  const lavaAt = (x, z) => { const i = idx(Math.floor(x), Math.floor(z)); return i >= 0 && flag[i] === 3; };

  // --- raycast through the height grid (2D DDA), returns the first solid hit; pen() continues through thin walls ---
  // o, dir: {x,y,z}; dir normalised. returns {t, x, z, m} or null
  const ray = (o, dr, maxT, fromT = 0) => {
    let t = fromT;
    let x = Math.floor(o.x + dr.x * t), z = Math.floor(o.z + dr.z * t);
    const sx = dr.x > 0 ? 1 : -1, sz = dr.z > 0 ? 1 : -1;
    const tdx = Math.abs(dr.x) < 1e-9 ? 1e9 : Math.abs(1 / dr.x), tdz = Math.abs(dr.z) < 1e-9 ? 1e9 : Math.abs(1 / dr.z);
    const px = o.x + dr.x * t, pz = o.z + dr.z * t;
    let tmx = Math.abs(dr.x) < 1e-9 ? 1e9 : t + ((sx > 0 ? x + 1 - px : px - x) * tdx);
    let tmz = Math.abs(dr.z) < 1e-9 ? 1e9 : t + ((sz > 0 ? z + 1 - pz : pz - z) * tdz);
    for (let n = 0; n < 600; n++) {
      const tExit = Math.min(tmx, tmz, maxT);
      const ci = idx(x, z), r = ci >= 0 ? rid[ci] : -1;
      const y0 = o.y + dr.y * t, y1 = o.y + dr.y * tExit;
      if (r < 0) {
        const hh = ci < 0 ? B.wallH : h[ci];
        if (y0 < hh) return { t, x, z, m: mat[ci] ?? 0, side: true };
        if (y1 < hh) { const th = (hh - o.y) / dr.y; return { t: th, x, z, m: mat[ci] ?? 0, side: false }; }
      } else {   // a ramp: compare with the slope where the ray enters and leaves the cell
        const f0 = y0 - slope(r, o.x + dr.x * t, o.z + dr.z * t), f1 = y1 - slope(r, o.x + dr.x * tExit, o.z + dr.z * tExit);
        if (f0 < 0) return { t, x, z, m: mat[ci], side: true };
        if (f1 < 0) return { t: t + (tExit - t) * f0 / (f0 - f1), x, z, m: mat[ci], side: false };
      }
      if (tExit >= maxT) return null;
      if (tmx < tmz) { t = tmx; tmx += tdx; x += sx; } else { t = tmz; tmz += tdz; z += sz; }
    }
    return null;
  };
  // how far the ray stays inside solid after entering at t (for wall-bangs); Infinity for floors
  const thickness = (o, dr, t, maxLen = 3) => {
    if (!false && Math.abs(dr.y) > 0.9) return Infinity;
    for (let k = 0.05; k <= maxLen; k += 0.05) {
      const tt = t + k, px = o.x + dr.x * tt, py = o.y + dr.y * tt, pz = o.z + dr.z * tt;
      if (py >= topAt(px, pz)) return k;
    }
    return Infinity;
  };
  const los = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz); if (L < 1e-3) return true; return !ray(a, { x: dx / L, y: dy / L, z: dz / L }, L); };

  // --- navigation: A* over cells; edges allowed when the height step is small ---
  const walk = new Uint8Array(w * d);
  for (let i = 0; i < w * d; i++) walk[i] = flag[i] === 2 ? 1 : 0;
  {  // keep only the floor bots can actually reach from the T spawn (drops crate tops, sealed rooms)
    const seen = new Uint8Array(w * d), st = [], s0 = B.spawns.T[0] || B.duel.T[0];
    if (s0) { const i0 = idx(Math.floor(s0[0]), Math.floor(s0[1])); if (i0 >= 0 && walk[i0]) { seen[i0] = 1; st.push(i0); } }
    while (st.length) {
      const c = st.pop(), cx = c % w, cz = (c / w) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = idx(cx + dx, cz + dz); if (n >= 0 && !seen[n] && walk[n] && Math.abs(h[n] - h[c]) <= PHYS.step + 0.02) { seen[n] = 1; st.push(n); } }
    }
    if (st.length === 0 && s0) for (let i = 0; i < w * d; i++) if (!seen[i]) walk[i] = 0;
  }
  const passable = (a, b) => walk[b] && Math.abs(h[a] - h[b]) <= PHYS.step + 0.02;
  const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  const gScore = new Float32Array(w * d), came = new Int32Array(w * d), stamp = new Uint32Array(w * d), closed = new Uint32Array(w * d);
  let gen = 1;
  const heap = { a: [], push(i, f) { const a = this.a; a.push([f, i]); let k = a.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (a[p][0] <= a[k][0]) break; [a[p], a[k]] = [a[k], a[p]]; k = p; } },
    pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === k) break; [a[m], a[k]] = [a[k], a[m]]; k = m; } } return top[1]; } };
  const nearestWalk = (x, z) => {
    const cx = Math.floor(x), cz = Math.floor(z);
    for (let r = 0; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const i = idx(cx + dx, cz + dz); if (i >= 0 && walk[i]) return i; }
    return -1;
  };
  const path = (fx, fz, tx, tz, maxNodes = 9000) => {
    const s = nearestWalk(fx, fz), goal = nearestWalk(tx, tz); if (s < 0 || goal < 0) return null;
    gen++; heap.a.length = 0; stamp[s] = gen; gScore[s] = 0; came[s] = -1; heap.push(s, 0);
    const gx = goal % w, gz = (goal / w) | 0; let n = 0;
    while (heap.a.length && n++ < maxNodes) {
      const cur = heap.pop(); if (cur === goal) break;
      if (closed[cur] === gen) continue; closed[cur] = gen;
      const cx = cur % w, cz = (cur / w) | 0;
      for (const [dx, dz, c] of N8) {
        const nx = cx + dx, nz = cz + dz, ni = idx(nx, nz); if (ni < 0 || !passable(cur, ni)) continue;
        if (dx && dz && (!passable(cur, idx(cx + dx, cz)) || !passable(cur, idx(cx, cz + dz)))) continue;
        const g = gScore[cur] + c + (flag[ni] === 3 ? 30 : 0);
        if (stamp[ni] !== gen || g < gScore[ni]) { stamp[ni] = gen; gScore[ni] = g; came[ni] = cur; heap.push(ni, g + Math.hypot(nx - gx, nz - gz)); }
      }
    }
    if (stamp[goal] !== gen) return null;
    const out = []; for (let c = goal; c !== -1; c = came[c]) out.push([(c % w) + 0.5, ((c / w) | 0) + 0.5]);
    out.reverse();
    // string-pull: skip points while the straight walk between stays on passable ground
    const sm = [out[0]];
    let a = 0;
    while (a < out.length - 1) {
      let b = Math.min(out.length - 1, a + 12);
      while (b > a + 1 && !walkLine(out[a], out[b])) b--;
      sm.push(out[b]); a = b;
    }
    return sm;
  };
  const walkLine = (p, q) => {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.ceil(L / 0.35);
    let prev = idx(Math.floor(p[0]), Math.floor(p[1]));
    for (let k = 1; k <= n; k++) {
      const x = p[0] + (q[0] - p[0]) * k / n, z = p[1] + (q[1] - p[1]) * k / n;
      for (const [ox, oz] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) { const j = idx(Math.floor(x + ox), Math.floor(z + oz)); if (j < 0 || !walk[j] || Math.abs(h[j] - h[prev]) > PHYS.step + 0.02 || flag[j] === 3) return false; }
      prev = idx(Math.floor(x), Math.floor(z));
    }
    return true;
  };
  const randomIn = (rect, rnd = Math.random) => {
    for (let k = 0; k < 40; k++) { const x = rect[0] + rnd() * (rect[2] - rect[0]), z = rect[1] + rnd() * (rect[3] - rect[1]), i = idx(Math.floor(x), Math.floor(z)); if (i >= 0 && walk[i]) return [x, z]; }
    return [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2];
  };
  const zoneAt = (x, z) => { for (let k = B.zones.length - 1; k >= 0; k--) { const [n, x0, z0, x1, z1] = B.zones[k]; if (x >= x0 && x < x1 && z >= z0 && z < z1) return n; } return ''; };
  const inRect = (r, x, z) => !!r && x >= r[0] && x < r[2] && z >= r[1] && z < r[3];
  const siteAt = (x, z) => { for (const [n, r] of Object.entries(B.sites)) if (inRect(r, x, z)) return n; return ''; };

  return { B, w, d, h, mat, flag, H, idx, group, groundAt, move, lavaAt, ray, thickness, los, path, walkLine, randomIn, zoneAt, siteAt, inRect,
    topAt, sunAt, useLight, density: (m) => MATS[MAT_LIST[m]]?.d ?? 6, matName: (m) => MAT_LIST[m], matTex: (k) => matTex(k).map };
}
