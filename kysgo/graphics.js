// GraphicsSettingsManager: the one place that decides how the game is drawn. Five tiers (Potato and Ultra around the
// three core ones: Low, Medium, High); every renderer, world, model and post-processing switch reads its profile
// instead of comparing quality numbers. Also here: the short-range dynamic sun shadows for players (Medium and up,
// cascaded and soft-filtered on High) and the post-processing defines.
//
// The lighting pipeline stays baked: the environment's sun shadows and ambient occlusion come from the lightmap
// (world.js), players and props are lit by interpolating the baked light-probe grid. The dynamic shadow map is the only
// real-time shadow, it only contains players, and it is only drawn on tiers that ask for it.
import * as THREE from '../sdk/three.module.min.js';
import { LIGHT } from './world.js';

export const TIERS = ['potato', 'low', 'medium', 'high', 'ultra'];
// the four profiles players pick (Ultra, High, Medium, Performance); 'potato' is only Auto's emergency floor (a weak
// phone that cannot hold even Performance, or a graphics crash), shown as Performance (saver)
export const TIER_NAMES = ['Performance (saver)', 'Performance', 'Medium', 'High', 'Ultra'];
export const QSTEPS = [0.5, 0.75, 1, 1.5, 2];   // the saved setting's numbers (settings and Auto memory use these)

// what each tier turns on. Numbers are engine parameters, not hints:
//  texSize      which shipped photo maps stream in (512 / 1024 px)
//  mipBias      added to every world texture lookup's mip level (+1 = half resolution, less memory bandwidth)
//  nearestMip   no blending between mip levels (cheaper filtering)
//  normalMaps   painted normal + roughness maps on the world;   detail: close-up grit layer;  macro: large-scale variation
//  aniso        anisotropic filtering (capped by the GPU)
//  bakeK        lightmap texels per metre
//  probes       light-probe interpolation for players and props (otherwise a flat hemisphere light)
//  shadows      dynamic sun shadow cascades for players: [{ r: half-size m, size: px }], pcf: filter taps (1, 4 or 9)
//  post         HDR composite pass;   bloom: quarter-resolution bloom (0 = off);   grade: ACES + colour grade + vignette + grain
//  ssao         screen-space ambient occlusion in the composite
//  ssr          screen-space reflections: ray-march steps (0 = off); smoothness comes from the world's roughness maps
//  msaa         samples on the HDR render target (0 = off);  fxaa: one-pass FXAA in the composite
//  hqModels     shiny PBR guns / bevelled parts / detailed soldiers
//  dress        set dressing geometry (beams, pipes, rubble);   clouds;   env: per-map reflection map
//  pixel        render scale band for the frame-time governor: start / max as multiples of the screen's pixel ratio
const BASE = {
  texSize: 512, mipBias: 0, nearestMip: false, normalMaps: false, detail: false, macro: true, aniso: 1, bakeK: 4, probes: true,
  shadows: null, post: false, bloom: 0, grade: false, ssao: false, ssr: 0, msaa: 0, fxaa: false,
  hqModels: false, dress: true, clouds: true, env: false, chars: true, pixel: { start: 1, max: 1, min: 0.4 }, targetMs: 25,   // frame-time targets: Performance 30-60 fps (25 ms keeps 40 with room), Medium/High a steady 60, Ultra 60-120
};
export const PROFILES = {
  // integrated graphics at its weakest: everything that costs per pixel is off
  potato: { ...BASE, q: 0.5, mipBias: 1.5, nearestMip: true, macro: false, bakeK: 2, probes: false, dress: false, clouds: false, pixel: { start: 0.5, max: 0.5, min: 0.4 } },
  // LOW: maximum fps. Higher mip bias, no dynamic shadows (lightmaps only), no post-processing at all, no AA
  low: { ...BASE, q: 0.75, mipBias: 1, nearestMip: true, clouds: false, pixel: { start: 0.75, max: 0.75, min: 0.4 } },
  // MEDIUM: balanced. Full-resolution textures (bias 0), short-range player shadows, colour grade + quarter-res bloom, FXAA
  medium: { ...BASE, q: 1, texSize: 1024, normalMaps: true, aniso: 4, shadows: { cascades: [{ r: 9, size: 1024 }], pcf: 1 },
    post: true, bloom: 1, grade: true, fxaa: true, hqModels: true, env: true, pixel: { start: 1, max: 1, min: 0.55 }, targetMs: 16.7 },
  // HIGH: built for integrated graphics (a Ryzen 3200U / Vega 3 mini PC holds it): the realism comes from what is nearly
  // free at run time. Baked lightmaps and light probes, a photographed HDR sky for reflections (PMREM, once per map),
  // scanned PBR textures with detail normals, ONE soft sun cascade for players only, and one composite pass (ACES, grade,
  // quarter-resolution bloom, vignette, grain, FXAA). No SSAO, no SSR, no MSAA: those cost bandwidth an iGPU hasn't got.
  // The render scale drops (to 0.6) before the frame rate does.
  high: { ...BASE, q: 1.5, texSize: 1024, normalMaps: true, detail: true, aniso: 8, bakeK: 6, shadows: { cascades: [{ r: 10, size: 2048 }], pcf: 4 },
    post: true, bloom: 1, grade: true, fxaa: true, hqModels: true, env: true, pixel: { start: 1, max: 1, min: 0.6 }, targetMs: 17 },
  // ULTRA: the showcase, for a console (Edge on Xbox: picked automatically there) or a real graphics card. Everything
  // High has, plus what a console GPU affords live: one big soft sun cascade (9-tap filtered), SSAO, screen-space
  // reflections on wet and polished floors, 2x MSAA, 16x filtering, the finest lightmap, more blood and debris, and up
  // to 1.5x the screen's pixels where the frame time allows it.
  ultra: { ...BASE, q: 2, texSize: 1024, normalMaps: true, detail: true, aniso: 16, bakeK: 8, shadows: { cascades: [{ r: 14, size: 4096 }], pcf: 9 },
    post: true, bloom: 1, grade: true, ssao: true, ssr: 32, msaa: 2, hqModels: true, env: true, gore: 2, pixel: { start: 1, max: 1.5, min: 0.75 }, targetMs: 16.7 },
};
export const tierOf = (q) => { let best = 0; QSTEPS.forEach((s, i) => { if (Math.abs(s - q) < Math.abs(QSTEPS[best] - q)) best = i; }); return TIERS[best]; };

// desktop / mini-PC integrated graphics (shared memory): AMD APUs (Vega 3/6/8, "AMD Radeon(TM) Graphics"), Intel UHD/Iris/HD
export const isIntegrated = (r) => /Radeon\(TM\) (Vega \d+ )?Graphics|Radeon Vega \d|Vega \d+ Graphics|AMD Radeon Graphics|Intel.*(UHD|Iris|HD) Graphics/i.test(String(r || ''));
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };

export class GraphicsSettingsManager {
  // setting: the saved quality number (0 = Auto). Auto starts from what this device managed before, or a guess from
  // its cores / memory / platform, and later steps down (or remembers headroom) from measured frame times.
  constructor(setting = 0, env = {}) {
    this.auto = !setting;
    this.xbox = /Xbox/i.test(((env.navigator || (typeof navigator !== 'undefined' ? navigator : {})).userAgent) || '');   // Edge on Xbox Series X: Ultra tuned for it
    const nav = env.navigator || (typeof navigator !== 'undefined' ? navigator : {});
    let q = setting;
    if (this.auto) {
      const saved = +(store.get('cs:autoq') || 0), weak = (nav.hardwareConcurrency || 4) <= 4 || (nav.deviceMemory || 8) <= 4 || /Mobi|Android|iPhone|iPad|CrOS|PlayStation|Nintendo|SMART-TV|SmartTV|Tizen|Web0S|webOS|CrKey|AFT[A-Z]/i.test(nav.userAgent || '');   // phones, Chromebooks, TV browsers and handheld consoles start on Low (Xbox: Ultra, below)
      q = QSTEPS.includes(saved) && saved < 2 ? saved : weak ? 0.75 : 1;
      if (this.xbox && !saved) q = QSTEPS[4];   // Edge on Xbox: the console's GPU gets the showcase tier (stepped down if it can't hold it)
    }
    this.floatRT = true; this.maxAniso = 16; this.listeners = [];
    this.set(q, true);
  }
  set(q, silent = false) {
    this.tier = tierOf(q); this.q = PROFILES[this.tier].q; this.p = PROFILES[this.tier];
    LIGHT.mipBias.value = this.p.mipBias;
    if (!silent) this.listeners.forEach((f) => f(this));
    return this;
  }
  get name() { return TIER_NAMES[TIERS.indexOf(this.tier)] + (this.auto ? (this.igpu ? ' (Auto, integrated graphics)' : ' (Auto)') : ''); }
  onChange(f) { this.listeners.push(f); }
  // read once the renderer exists: what this GPU can actually do
  probe(renderer) {
    const caps = renderer.capabilities;
    this.floatRT = caps.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float'));
    this.maxAniso = caps.getMaxAnisotropy();
    this.maxSamples = caps.isWebGL2 ? caps.maxSamples || 4 : 0;
    // integrated graphics on a desktop or mini PC (AMD Vega / "Radeon Graphics" APUs, Intel UHD / Iris): High is built
    // for exactly these, so Auto starts there (once; after that it remembers what the device really managed)
    try {
      const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      this.gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    } catch (e) { this.gpu = ''; }
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    this.igpu = isIntegrated(this.gpu) && !/Mobi|Android|iPhone|iPad/i.test(nav.userAgent || '');
    if (this.auto && this.igpu && store.get('cs:igpu') !== '1') { store.set('cs:igpu', '1'); store.set('cs:autoq', String(QSTEPS[3])); if (this.tier !== 'high') this.set(QSTEPS[3], true); }
    return this;
  }
  get postOn() { return this.p.post && this.floatRT; }
  get msaa() { return Math.min(this.p.msaa, this.maxSamples ?? 4); }
  get aniso() { return Math.min(this.xbox && this.tier === 'ultra' ? 8 : this.p.aniso, this.maxAniso || 1); }
  // Auto steps effects down (a tier) when the frame stays over this budget at the lowest render scale
  get stepBudget() { return this.xbox ? 1 / 55 : 1 / 40; }
  get shadowsOn() { return !!this.p.shadows; }
  // the frame-time governor's render-scale band for this screen
  pixelBand(dpr = 1) {
    const b = this.p.pixel, ultra = this.tier === 'ultra';
    if (ultra && this.xbox) {   // Series X on a 4K TV: start near 1440p, let the scaler move between 0.6 and 1.0 of the canvas
      const w = (typeof innerWidth !== 'undefined' && innerWidth) || 1920, full = dpr, s1440 = Math.min(full, 2560 / w);
      return { start: s1440, max: full, min: 0.6 * full, targetMs: 16.7 };
    }
    return ultra ? { start: Math.min(1.5, dpr * b.start), max: Math.min(2, dpr * b.max), min: b.min, targetMs: this.p.targetMs }
      : { start: Math.min(dpr, 1) * b.start, max: Math.min(1.5, dpr * b.max), min: this.auto && this.tier !== 'potato' ? Math.max(b.min, 0.55) : b.min, targetMs: this.p.targetMs };
  }
  // everything buildWorld needs to compile a map for this tier
  worldOpts() {
    const p = this.p;
    return { quality: p.q, texSize: p.texSize, normalMaps: p.normalMaps, detail: p.detail, macro: p.macro, dress: p.dress, nearestMip: p.nearestMip,
      aniso: this.aniso, bakeK: p.bakeK, probes: p.probes, dynShadows: p.shadows ? p.shadows.cascades.length : 0, pcf: p.shadows ? p.shadows.pcf : 0 };
  }
  // the HDR target's options (MSAA samples, depth texture for SSAO)
  targetOpts(w, h, depth) {
    const o = { type: THREE.HalfFloatType, samples: this.msaa };
    if (depth && (this.p.ssao || this.p.ssr)) { o.depthTexture = new THREE.DepthTexture(w, h); o.depthTexture.type = THREE.UnsignedIntType; }
    return o;
  }
  // composite shader defines for this tier
  postDefines() {
    const p = this.p, d = {};
    if (p.bloom) d.BLOOM = ''; if (p.grade) d.GRADE = ''; if (p.ssao) d.SSAO = ''; if (p.ssr) { d.SSR = ''; d.SSR_STEPS = String(p.ssr); } if (p.fxaa) d.FXAA = '';
    return d;
  }
  // Auto: one tier down (true if it changed). Never below Potato, never into Ultra by itself.
  stepDown() { const i = TIERS.indexOf(this.tier); if (!this.auto || i <= 0) return false; this.set(QSTEPS[i - 1]); store.set('cs:autoq', String(this.q)); return true; }
  rememberHeadroom() { const i = TIERS.indexOf(this.tier); if (this.auto && (i < 2 || (this.igpu && i < 3))) store.set('cs:autoq', String(QSTEPS[i + 1])); }
}

// ---- dynamic sun shadows for players (Medium and up) ------------------------------------------------------------------
// Only objects on CASTER_LAYER are drawn into the shadow map (the player models), with one shared depth material, from
// an orthographic camera looking along the sun. Each cascade is a square around the camera's position (pushed toward
// where it's looking), snapped to whole shadow texels so the edges don't crawl when you move. The world shader
// samples it (with 1, 4 or 9 taps) only where the baked sun already reaches, so it costs a texture read per pixel and
// one depth-only draw of the nearby players per cascade.
export const CASTER_LAYER = 2;
export function markCaster(obj) { obj.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.layers.enable(CASTER_LAYER); }); return obj; }
export class DynamicShadows {
  constructor(cfg) {
    this.cfg = cfg; this.cams = []; this.rts = [];
    this.depthMat = new THREE.MeshDepthMaterial(); this.depthMat.side = THREE.DoubleSide;
    this.v = new THREE.Vector3(); this.f = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.rx = new THREE.Vector3(); this.ry = new THREE.Vector3();
    cfg.cascades.forEach((c, i) => {
      const cam = new THREE.OrthographicCamera(-c.r, c.r, c.r, -c.r, 0.5, 160); cam.layers.set(CASTER_LAYER);
      const rt = new THREE.WebGLRenderTarget(c.size, c.size, { depthBuffer: true, depthTexture: new THREE.DepthTexture(c.size, c.size) });
      rt.depthTexture.type = THREE.UnsignedIntType; rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter;
      this.cams.push(cam); this.rts.push(rt);
      LIGHT['dsTex' + i].value = rt.depthTexture;
    });
    LIGHT.dsInfo.value.set(cfg.cascades.length, 1 / cfg.cascades[0].size, cfg.cascades[1] ? 1 / cfg.cascades[1].size : 0, cfg.pcf);
  }
  // sunDir: unit vector toward the sun; eye: the view camera
  update(renderer, scene, eye, sunDir) {
    eye.getWorldDirection(this.f); this.f.y = 0; if (this.f.lengthSq() < 1e-6) this.f.set(0, 0, -1); this.f.normalize();
    const prevT = renderer.getRenderTarget(), prevO = scene.overrideMaterial, prevB = scene.background, prevF = scene.fog;
    scene.overrideMaterial = this.depthMat; scene.background = null; scene.fog = null;
    this.cfg.cascades.forEach((c, i) => {
      const cam = this.cams[i], texel = (2 * c.r) / c.size;
      // centre: ahead of the eye by 40% of the cascade. The camera's orientation is fixed (looking down the sun) and its
      // position is snapped to whole texels across the light's view plane, so shadow edges never shimmer as you move.
      this.v.copy(eye.position).addScaledVector(this.f, c.r * 0.4);
      cam.position.set(0, 0, 0); cam.up.copy(this.up); cam.lookAt(-sunDir.x, -sunDir.y, -sunDir.z); cam.updateMatrixWorld(true);
      this.rx.setFromMatrixColumn(cam.matrixWorld, 0); this.ry.setFromMatrixColumn(cam.matrixWorld, 1);
      const lx = this.v.dot(this.rx), ly = this.v.dot(this.ry);
      cam.position.copy(this.v).addScaledVector(this.rx, Math.round(lx / texel) * texel - lx).addScaledVector(this.ry, Math.round(ly / texel) * texel - ly).addScaledVector(sunDir, 80);
      cam.updateMatrixWorld(true);
      renderer.setRenderTarget(this.rts[i]); renderer.clear(true, true, false); renderer.render(scene, cam);
      LIGHT['dsMat' + i].value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    });
    scene.overrideMaterial = prevO; scene.background = prevB; scene.fog = prevF; renderer.setRenderTarget(prevT);
  }
  dispose() { this.rts.forEach((r) => { r.depthTexture.dispose(); r.dispose(); }); this.depthMat.dispose(); LIGHT.dsInfo.value.x = 0; LIGHT.dsTex0.value = LIGHT.dsTex1.value = null; }
}
