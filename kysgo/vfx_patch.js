// ============================================================================
// vfx_patch.js — enhanced combat visual effects for KYS:GO
//
// WHAT IT DOES
//   1. AUTO-ACTIVE (no integration needed, works the moment it's imported):
//      - Impact effects: metal throws bright spark streaks + flash, wood throws
//        chips + dust, concrete/sand throw dust clouds + debris, blood gets a
//        stylized (non-gore) puff + droplets. Done by intercepting the game's
//        own Particles.emit calls and classifying the impact from its colors.
//      - Muzzle blast: the game's own muzzle-spark emit is detected and gets a
//        big additive flash sprite, a brief PointLight that lights the area,
//        and a lingering smoke puff.
//      - Smoke: all smoke puffs are denser and longer-lived.
//   2. DROP-IN REPLACEMENTS (tiny one-line swaps in game.js, documented below):
//      - window.__VFX__.tracer : glowing tracer with fade + smoke trail
//      - window.__VFX__.casing : brass with metallic glint + per-gun patterns
//      - window.__VFX__.decal  : persistent, surface-appropriate bullet holes
//      - window.__VFX__.flash  : bigger muzzle flash + environment light
//
// INTEGRATION (for game.js — each is a single-line swap):
//   tracer:   tracer(m.o, m.e)
//        →    (window.__VFX__ ? window.__VFX__.tracer(fx, m.o, m.e, { ammo: w.ammoType }) : tracer(m.o, m.e))
//   casing:   ejectCasing({x,y,z}, rx, rz, ax, az, false)
//        →    (window.__VFX__ ? window.__VFX__.casing(fx, {x,y,z}, rx, rz, ax, az, false, w.id, (x,z)=>W?W.groundAt(x,z,60):0) : ejectCasing({x,y,z}, rx, rz, ax, az, false))
//   decal:    decal(tr.wallHits[0], d)
//        →    (window.__VFX__ ? window.__VFX__.decal(fx, tr.wallHits[0], d, W.matName(tr.wallHits[0])) : decal(tr.wallHits[0], d))
//   flash:    (in models.js muzzleFlash, or right after makeGun in game.js)
//             vm.userData.flash = (window.__VFX__ && window.__VFX__.flash(z, k)) || vm.userData.flash
//
// LOAD: add to index.html alongside the other patches:
//   import './vfx_patch.js';
//
// Everything is defensive: if THREE/Particles/document is missing, it silently
// no-ops. `node --check` clean. Never touches game.js itself.
// ============================================================================
import * as THREE from '../sdk/three.module.min.js';
import { Particles } from './fx.js';

(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  let T = null;
  try { T = THREE; if (!T || !T.Sprite) return; } catch (e) { return; }
  let Pcls = null;
  try { Pcls = Particles; if (!Pcls || !Pcls.prototype || !Pcls.prototype.emit) return; } catch (e) { return; }

  // --------------------------------------------------------------------------
  // canvas texture helpers (created lazily, never at import time)
  // --------------------------------------------------------------------------
  let _glowTex = null, _softTex = null, _ringTex = null;
  function canvasTex(draw, size) {
    const c = document.createElement('canvas'); c.width = c.height = size || 128;
    draw(c.getContext('2d'), c.width);
    const t = new T.CanvasTexture(c); return t;
  }
  function glowTex() {
    if (!_glowTex) _glowTex = canvasTex((g, w) => {
      const gr = g.createRadialGradient(w/2, w/2, 0, w/2, w/2, w/2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,200,0.9)');
      gr.addColorStop(0.6, 'rgba(255,180,80,0.35)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
    return _glowTex;
  }
  function softTex() {
    if (!_softTex) _softTex = canvasTex((g, w) => {
      const gr = g.createRadialGradient(w/2, w/2, w*0.05, w/2, w/2, w/2);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
    return _softTex;
  }
  function ringTex() {
    if (!_ringTex) _ringTex = canvasTex((g, w) => {
      const gr = g.createRadialGradient(w/2, w/2, w*0.28, w/2, w/2, w*0.5);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.55, 'rgba(20,12,8,0.95)');
      gr.addColorStop(0.8, 'rgba(30,18,10,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
    return _ringTex;
  }

  // --------------------------------------------------------------------------
  // per-Particles-instance pools (WeakMap so instances can be GC'd)
  // --------------------------------------------------------------------------
  const pools = new WeakMap();
  const registry = [];
  function poolFor(parts) {
    let p = pools.get(parts);
    if (!p) {
      p = { glows: [], puffs: [], lights: [], tracers: [], li: 0, gi: 0, pi: 0, scene: null };
      registry.push(p);
      try { p.scene = parts.scene || null; } catch (e) {}
      for (let i = 0; i < 24; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }));
        s.visible = false; p.glows.push({ s, t: 0, life: 1, s0: 1, grow: 0 });
        if (p.scene) { try { p.scene.add(s); } catch (e) {} }
      }
      for (let i = 0; i < 24; i++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: softTex(), transparent: true, depthWrite: false, opacity: 0 }));
        s.visible = false; p.puffs.push({ s, t: 0, life: 1, s0: 1, grow: 1.5, a: 0.5 });
        if (p.scene) { try { p.scene.add(s); } catch (e) {} }
      }
      for (let i = 0; i < 4; i++) {
        const l = new T.PointLight(0xffb347, 0, 7, 2); l.visible = false;
        p.lights.push({ l, t: 0 });
        if (p.scene) { try { p.scene.add(l); } catch (e) {} }
      }
      pools.set(parts, p);
    }
    return p;
  }
  function glowAt(parts, x, y, z, color, size, life, grow) {
    try {
      const p = poolFor(parts), q = p.glows[p.gi = (p.gi + 1) % p.glows.length];
      q.s.visible = true; q.s.position.set(x, y, z); q.s.material.color.set(color);
      q.s.material.opacity = 1; q.t = q.life = life; q.s0 = size; q.grow = grow || 0;
      q.s.scale.setScalar(size);
    } catch (e) {}
  }
  function puffAt(parts, x, y, z, color, size, life, alpha, rise) {
    try {
      const p = poolFor(parts), q = p.puffs[p.pi = (p.pi + 1) % p.puffs.length];
      q.s.visible = true; q.s.position.set(x, y, z); q.s.material.color.set(color);
      q.a = alpha == null ? 0.5 : alpha; q.t = q.life = life; q.s0 = size; q.grow = 1.8;
      q.s.scale.setScalar(size); q.vy = rise == null ? 0.3 : rise;
    } catch (e) {}
  }
  function lightAt(parts, x, y, z, color, intensity, dist, life) {
    try {
      const p = poolFor(parts), q = p.lights[p.li = (p.li + 1) % p.lights.length];
      q.l.visible = true; q.l.position.set(x, y, z); q.l.color.set(color);
      q.l.intensity = intensity; q.l.distance = dist || 7; q.i0 = intensity; q.t = q.life = life || 0.09;
    } catch (e) {}
  }

  // global decay loop for the pooled sprites/lights
  let loopOn = false, lastT = 0;
  function ensureLoop() {
    if (loopOn) return; loopOn = true; lastT = performance.now();
    const step = () => {
      const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      try {
        // WeakMap isn't iterable; keep a registry list instead
        for (const p of registry) {
          for (const q of p.glows) {
            if (q.t <= 0) continue; q.t -= dt;
            if (q.t <= 0) { q.s.visible = false; continue; }
            const k = 1 - q.t / q.life;
            q.s.scale.setScalar(q.s0 * (1 + q.grow * k));
            q.s.material.opacity = Math.max(0, 1 - k) * Math.min(1, k * 30 + 0.2);
          }
          for (const q of p.puffs) {
            if (q.t <= 0) continue; q.t -= dt;
            if (q.t <= 0) { q.s.visible = false; continue; }
            const k = 1 - q.t / q.life;
            q.s.position.y += (q.vy || 0.3) * dt;
            q.s.scale.setScalar(q.s0 * (1 + q.grow * k));
            q.s.material.opacity = q.a * Math.max(0, 1 - k) * Math.min(1, k * 6);
          }
          for (const q of p.lights) {
            if (q.t <= 0) continue; q.t -= dt;
            if (q.t <= 0) { q.l.intensity = 0; q.l.visible = false; continue; }
            const k = q.t / q.life;
            q.l.intensity = (q.i0 || 4) * k * k;
          }
          for (const tr of p.tracers) {
            if (tr.t <= 0) continue; tr.t -= dt;
            if (tr.t <= 0) { tr.g.visible = false; continue; }
            const k = tr.t / tr.life;
            tr.mats.forEach((m) => { m.opacity = tr.o0 * k; });
          }
        }
      } catch (e) {}
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // --------------------------------------------------------------------------
  // Part 1: intercept Particles.emit — classify impacts, add stages
  // --------------------------------------------------------------------------
  const BLOOD = new Set(['#8a0a0a', '#c01a1a', '#8a0d0d', '#5a0505']);
  function sig(colors) { return (colors || []).join(','); }
  const origEmit = Pcls.prototype.emit;
  Pcls.prototype.emit = function (x, y, z, o) {
    o = o || {};
    if (this._vfxBusy) { origEmit.call(this, x, y, z, o); return; }
    origEmit.call(this, x, y, z, o);
    try {
      ensureLoop();
      const s = sig(o.colors), c0 = (o.colors || [])[0];
      this._vfxBusy = true;
      // -- muzzle blast spark (game.js fires exactly one of these per shot) --
      if (o.n === 1 && o.life === 1.2 && o.dir && o.speed === 2.2 && (c0 === '#d4a640' || c0 === '#c8321e')) {
        glowAt(this, x, y, z, '#ffdf9a', 0.55, 0.07, 0.6);
        glowAt(this, x, y, z, '#ff9a3a', 0.3, 0.09, 0.4);
        lightAt(this, x, y, z, 0xffb347, 5, 7, 0.09);
        this.smoke(x, y, z, { n: 2, color: '#b9b4a8', size: 0.13, life: 1.5, rise: 0.3, alpha: 0.42 });
      }
      // -- metal impact: spark streaks + hot flash --
      else if (s === '#fff3c0,#ffd27a,#ffffff') {
        glowAt(this, x, y, z, '#fff2c0', 0.34, 0.06, 0.5);
        origEmit.call(this, x, y, z, { n: 10, colors: ['#fff3c0', '#ffd27a', '#ffffff'], speed: 5.5, up: 0.9, size: 0.007, life: 0.32, g: 1.4 });
        this.smoke(x, y, z, { n: 1, color: '#8a8a86', size: 0.1, life: 0.7, rise: 0.4, alpha: 0.4 });
      }
      // -- wood impact: chips + dust --
      else if (s === '#8a5a2a,#c89a5a,#5a3a1a') {
        origEmit.call(this, x, y, z, { n: 9, colors: ['#8a5a2a', '#c89a5a', '#5a3a1a'], speed: 2.6, up: 1.1, size: 0.03, life: 0.7, g: 1.6 });
        this.smoke(x, y, z, { n: 2, color: '#b89a6a', size: 0.16, life: 1.0, rise: 0.3, alpha: 0.5 });
      }
      // -- concrete impact: dust cloud + debris --
      else if (s === '#9a9a96,#c8c8c0,#6a6a66') {
        this.smoke(x, y, z, { n: 3, color: '#a8a8a2', size: 0.2, life: 1.2, rise: 0.35, alpha: 0.55 });
        origEmit.call(this, x, y, z, { n: 5, colors: ['#9a9a96', '#6a6a66'], speed: 2.2, up: 1.0, size: 0.02, life: 0.5, g: 1.8 });
      }
      // -- sand/dirt: soft poof --
      else if (s === '#d8c49a,#c8b07a,#e8d8b0') {
        this.smoke(x, y, z, { n: 3, color: '#d8c49a', size: 0.24, life: 1.1, rise: 0.4, alpha: 0.6 });
      }
      // -- networked impact tick --
      else if (s === '#8a8070,#ffd27a') {
        glowAt(this, x, y, z, '#ffe0a0', 0.22, 0.06, 0.4);
        this.smoke(x, y, z, { n: 1, color: '#9a9a96', size: 0.12, life: 0.8, rise: 0.3, alpha: 0.45 });
      }
      // -- blood: stylized puff + droplets (not gore: small, fast) --
      else if ((o.colors || []).length > 0 && (o.colors || []).every((c) => BLOOD.has(c))) {
        puffAt(this, x, y, z, '#c01a1a', 0.22, 0.22, 0.75, 0.5);
        origEmit.call(this, x, y, z, { n: 5, colors: ['#a01010', '#7a0808'], speed: 1.6, up: 0.9, size: 0.02, life: 0.4, g: 1.6 });
      }
      this._vfxBusy = false;
    } catch (e) { try { this._vfxBusy = false; } catch (e2) {} }
  };

  // --------------------------------------------------------------------------
  // Part 2: richer smoke everywhere (muzzle wisps, impact dust, grenades)
  // --------------------------------------------------------------------------
  // Tier-aware: ultra gets thick lingering smoke; low tiers get a lighter touch for perf.
  function smokeTier() { try { return (window.__cs && window.__cs.gfx && window.__cs.gfx.tier) || 'medium'; } catch (e) { return 'medium'; } }
  const SMOKE_BOOST = { potato: 0, low: 0, medium: 1, high: 1, ultra: 2 };
  const origSmoke = Pcls.prototype.smoke;
  Pcls.prototype.smoke = function (x, y, z, o) {
    o = o || {};
    try {
      var boost = SMOKE_BOOST[smokeTier()] || 1;
      o = Object.assign({}, o);
      if (boost > 0) {
        o.n = Math.min(8, (o.n == null ? 1 : o.n) + boost);
        o.alpha = Math.min(0.75, (o.alpha == null ? 0.45 : o.alpha) * (1 + 0.22 * boost));
        o.life = (o.life == null ? 1.0 : o.life) * (1 + 0.22 * boost);
      }
    } catch (e) {}
    return origSmoke.call(this, x, y, z, o);
  };

  // --------------------------------------------------------------------------
  // Part 3: drop-in replacements on window.__VFX__ (one-line game.js swaps)
  // --------------------------------------------------------------------------
  const AMMO_COLORS = {
    standard: '#ffe0a0', tracer: '#ff4a3a', ap: '#bfe8ff', incendiary: '#ff8a2a',
    shotgun: '#ffc46a', sniper: '#fff2c8'
  };
  // per-gun ejection: how violently the brass leaves (AK throws far, pistol drops close)
  const EJECT = [
    [/ak|galil|rpk/i, { power: 2.7, up: 2.3, side: 1.5, spin: 26 }],
    [/m4|aug|famas|sg55/i, { power: 2.2, up: 2.0, side: 1.2, spin: 22 }],
    [/awp|ssg08|scar20|g3sg1/i, { power: 2.9, up: 2.5, side: 1.0, spin: 24 }],
    [/deagle|r8|revolver/i, { power: 1.6, up: 1.8, side: 1.0, spin: 18 }],
    [/glock|usp|p2000|fiveseven|tec9|cz75|dual/i, { power: 1.2, up: 1.4, side: 0.8, spin: 15 }],
    [/mp7|mp9|mac10|ump|p90|bizon/i, { power: 1.8, up: 1.8, side: 1.1, spin: 20 }],
    [/nova|sawed|mag7|xm1014/i, { power: 1.1, up: 1.7, side: 0.9, spin: 14 }],
    [/m249|negev/i, { power: 2.4, up: 1.6, side: 1.6, spin: 20 }],
  ];
  function ejectFor(wid) {
    const id = String(wid || '');
    for (const [re, v] of EJECT) if (re.test(id)) return v;
    return { power: 1.8, up: 1.8, side: 1.0, spin: 18 };
  }

  const api = {
    AMMO_COLORS: AMMO_COLORS,
    // Glowing tracer with fade + subtle smoke trail. Drop-in for tracer(a, b).
    tracer: function (fx, a, b, opts) {
      try {
        ensureLoop();
        opts = opts || {};
        const col = new T.Color(opts.color || AMMO_COLORS[opts.ammo] || AMMO_COLORS.standard);
        const A = new T.Vector3(a[0], a[1], a[2]), B = new T.Vector3(b[0], b[1], b[2]);
        const dir = B.clone().sub(A), len = Math.max(0.001, dir.length()); dir.normalize();
        const g = new T.Group();
        const coreMat = new T.MeshBasicMaterial({ color: col.clone().lerp(new T.Color('#ffffff'), 0.55), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false });
        const glowMat = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false });
        const core = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, len, 6, 1, true), coreMat);
        const glow = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, len, 6, 1, true), glowMat);
        for (const m of [core, glow]) {
          m.position.copy(A).addScaledVector(dir, len / 2);
          m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
          g.add(m);
        }
        const head = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
        head.position.copy(B); head.scale.setScalar(0.16); g.add(head);
        const headMat = head.material;
        fx.add(g);
        // smoke trail: 3 faint puffs along the path
        for (let k = 1; k <= 3; k++) {
          const p = A.clone().addScaledVector(dir, (len * k) / 4);
          const s = new T.Sprite(new T.SpriteMaterial({ map: softTex(), color: 0xbfb8a8, transparent: true, depthWrite: false, opacity: 0.22 }));
          s.position.copy(p); s.scale.setScalar(0.09); g.add(s);
        }
        // fade out fast, then recycle
        let host = null;
        for (const p of registry) host = p; // attach to any live pool for the decay loop
        const tr = { g: g, t: 0.07, life: 0.07, mats: [coreMat, glowMat, headMat], o0: 1 };
        if (host) host.tracers.push(tr);
        else setTimeout(() => { try { fx.remove(g); } catch (e) {} }, 90);
        // hard cap: reuse oldest
        if (host && host.tracers.length > 30) { const old = host.tracers.shift(); try { fx.remove(old.g); } catch (e) {} }
      } catch (e) {}
    },
    // Brass with metallic glint + per-gun ejection pattern. Drop-in for ejectCasing(...).
    casing: function (fx, o, rx, rz, ax, az, shell, wid, groundAt) {
      try {
        ensureLoop();
        const P = ejectFor(wid);
        const geo = shell ? new T.CylinderGeometry(0.009, 0.009, 0.06, 7) : new T.CylinderGeometry(0.0045, 0.0045, 0.022, 6);
        const mat = shell
          ? new T.MeshPhongMaterial({ color: '#b8221e', shininess: 60, specular: '#ff9a8a' })
          : new T.MeshPhongMaterial({ color: '#d8a840', shininess: 150, specular: '#fff2c0' }); // brass glint
        const m = new T.Mesh(geo, mat);
        const j = () => (Math.random() - 0.5);
        m.position.set(o.x + rx * 0.16 + ax * 0.32, o.y - 0.08, o.z + rz * 0.16 + az * 0.32);
        m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
        const v = new T.Vector3(
          rx * P.power * (0.85 + Math.random() * 0.3) - ax * 0.3 + j() * 0.3,
          P.up * (0.85 + Math.random() * 0.3),
          rz * P.power * (0.85 + Math.random() * 0.3) - az * 0.3 + j() * 0.3);
        const av = new T.Vector3(j() * P.spin, j() * P.spin, j() * P.spin);
        const st = { m, v, av, t: 0, bounced: 0, glinted: false };
        fx.add(m);
        if (!api._casings) { api._casings = []; api._casingLoop = false; }
        api._casings.push(st);
        if (api._casings.length > 48) { const old = api._casings.shift(); try { fx.remove(old.m); } catch (e) {} }
        if (!api._casingLoop) {
          api._casingLoop = true;
          let last = performance.now();
          const stepC = () => {
            const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
            try {
              for (let i = api._casings.length - 1; i >= 0; i--) {
                const c = api._casings[i]; c.t += dt;
                if (c.t > 9) { try { fx.remove(c.m); } catch (e) {} api._casings.splice(i, 1); continue; }
                if (c.bounced > 2) continue;
                c.v.y -= 9.8 * dt;
                c.m.position.addScaledVector(c.v, dt);
                c.m.rotation.x += c.av.x * dt; c.m.rotation.y += c.av.y * dt; c.m.rotation.z += c.av.z * dt;
                const gy = groundAt ? groundAt(c.m.position.x, c.m.position.z) : 0;
                if (c.m.position.y < gy + 0.005) {
                  c.m.position.y = gy + 0.005;
                  if (c.v.y < -0.6) {
                    c.v.y *= -0.35; c.v.x *= 0.5; c.v.z *= 0.5;
                    c.av.multiplyScalar(0.5); c.bounced++;
                    if (!c.glinted && !shell) { // metallic glint on first bounce
                      c.glinted = true;
                      const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xffe9a8, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
                      s.position.copy(c.m.position); s.scale.setScalar(0.09); fx.add(s);
                      setTimeout(() => { try { fx.remove(s); } catch (e) {} }, 120);
                    }
                  } else { c.bounced = 3; c.m.rotation.set(Math.PI / 2, Math.random() * 6, 0); }
                }
              }
            } catch (e) {}
            if (api._casings.length) requestAnimationFrame(stepC); else api._casingLoop = false;
          };
          requestAnimationFrame(stepC);
        }
      } catch (e) {}
    },
    // Persistent, surface-appropriate bullet holes. Drop-in for decal(p, d).
    decal: function (fx, p, d, matName) {
      try {
        const m = String(matName || 'concrete');
        const isMetal = /metal|cred|cblue|cgreen|corange|bus|potty|steel/.test(m);
        const isWood = /wood|crate|darkwood|fence/.test(m);
        if (!api._decals) api._decals = [];
        let hole;
        if (api._decals.length >= 90) hole = api._decals.shift();
        else {
          hole = new T.Group();
          const dark = new T.Mesh(new T.PlaneGeometry(0.075, 0.075),
            new T.MeshBasicMaterial({ color: 0x0d0a07, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
          const rim = new T.Sprite(new T.SpriteMaterial({ map: ringTex(), transparent: true, depthWrite: false, opacity: 0.85 }));
          rim.scale.setScalar(0.19);
          hole.add(dark); hole.add(rim); hole.userData.rim = rim;
        }
        hole.userData.rim.material.color.set(isMetal ? '#3a2416' : isWood ? '#5a3a1e' : '#7a7670');
        hole.position.set(p.x - d.x * 0.012, p.y - d.y * 0.012, p.z - d.z * 0.012);
        hole.lookAt(p.x - d.x, p.y - d.y, p.z - d.z);
        if (!hole.parent) fx.add(hole);
        api._decals.push(hole);
      } catch (e) {}
    },
    // Bigger muzzle flash that lights the environment + smokes when it dies.
    // Drop-in: vm.userData.flash = (window.__VFX__ && window.__VFX__.flash(z, k)) || vm.userData.flash
    // (game.js drives it exactly like the old one: visible / rotation.z / scale)
    flash: function (z, k) {
      k = k || 1;
      const g = new T.Group();
      const tex = glowTex();
      const core = new T.Sprite(new T.SpriteMaterial({ map: tex, color: 0xfff3d0, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.95 }));
      core.scale.setScalar(0.34 * k); g.add(core);
      const starMat = new T.MeshBasicMaterial({ map: tex, color: 0xffc46a, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
      for (let i = 0; i < 3; i++) {
        const pl = new T.Mesh(new T.PlaneGeometry(0.3 * k, 0.1 * k), starMat);
        pl.rotation.z = (i * Math.PI) / 3; g.add(pl);
      }
      const light = new T.PointLight(0xffa63d, 0, 6, 2);
      g.add(light);
      g.position.set(0, 0.006, -z); g.visible = false;
      let scene = null, t0 = 0;
      const findScene = () => {
        if (scene) return scene;
        let o = g.parent;
        while (o) { if (o.isScene) { scene = o; break; } o = o.parent; }
        return scene;
      };
      // light decay driven by the patch's own loop
      const decay = () => {
        const dt = Math.min(0.05, (performance.now() - t0) / 1000);
        light.intensity = Math.max(0, light.intensity - dt * 60);
        if (light.intensity > 0.02 && g.visible) requestAnimationFrame(decay);
        else light.intensity = 0;
      };
      let vis = false;
      Object.defineProperty(g, 'visible', {
        get: function () { return vis; },
        set: function (v) {
          v = !!v;
          if (v && !vis) { // flash on: blast the light
            light.intensity = 4.5; t0 = performance.now(); requestAnimationFrame(decay);
          } else if (!v && vis) { // flash off: smoke puff at the muzzle
            try {
              const sc = findScene();
              if (sc) {
                const wp = new T.Vector3(); g.getWorldPosition(wp);
                for (let i = 0; i < 2; i++) {
                  const s = new T.Sprite(new T.SpriteMaterial({ map: softTex(), color: 0xbdb8ac, transparent: true, depthWrite: false, opacity: 0.4 }));
                  s.position.copy(wp).add(new T.Vector3((Math.random() - 0.5) * 0.06, Math.random() * 0.04, (Math.random() - 0.5) * 0.06));
                  s.scale.setScalar(0.1 + Math.random() * 0.06); sc.add(s);
                  const born = performance.now();
                  const drift = () => {
                    const kk = (performance.now() - born) / 1400;
                    if (kk >= 1) { try { sc.remove(s); } catch (e) {} return; }
                    s.position.y += 0.0016; s.scale.setScalar(0.12 * (1 + kk * 2.2));
                    s.material.opacity = 0.4 * (1 - kk);
                    requestAnimationFrame(drift);
                  };
                  requestAnimationFrame(drift);
                }
              }
            } catch (e) {}
          }
          vis = v;
        },
        configurable: true
      });
      return g;
    }
  };
  window.__VFX__ = api;
})();
