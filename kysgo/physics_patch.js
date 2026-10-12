// physics_patch.js — player physics + world interaction enhancements for KYS:GO
//
// Loaded via index.html: import './physics_patch.js';
// (must come before `import start from './game.js'` — order among the patch
// imports does not matter).
//
// WHAT IT DOES
//  1. Physics tuning: snappier acceleration, crisper stops, tamer air control
//     (mutates controller.js CVARS — the movement code reads them live).
//  2. Landing: camera nod scaled by fall height + surface-appropriate thud.
//  3. Slope sliding: steep slopes push you downhill.
//  4. Breakable FX: shooting wood/crate/fence sprays splinters + crack sound.
//  5. Recoil moves aim: small permanent pitch/yaw nudge per shot, directional
//     by weapon class (game.js's own camKick is view-only and temporary).
//  6. Weapon weight feel: subtle ADS sway, heavier for snipers/heavies.
//  7. Crouch footsteps: soft steps while crouched (base game is silent).
//
// WHAT IT DELIBERATELY DOES NOT DO (and why)
//  - Animated doors / pushable crates / working buttons: the world is a static
//    heightfield (world.js buildWorld merges everything into per-material
//    meshes). There are no door meshes, no rigid bodies, no per-object
//    transforms to animate or push. Those need map-format + buildWorld changes,
//    not a runtime patch.
//  - ADS transition speed per weapon weight: game.js hardcodes the ADS lerp
//    rate (dt*12). Overriding it from outside would fight the game's own lerp
//    every frame. The ADS sway (6) is the feasible "heavy gun" feel.
//  - Footsteps by surface / landing sound / tracers / shell ejection: already
//    in game.js (lines ~1461-1464, ~1537, ~805, ~1231). Not duplicated.
//
// DEFENSIVE: everything is feature-detected and wrapped in try/catch. If
// game.js/controller.js change shape, the patch degrades feature-by-feature
// and never throws into the game's loop. Idempotent (safe to import twice).

(function () {
  'use strict';

  // Never double-patch (e.g. HMR, double import).
  try {
    if (window.__physicsPatch && window.__physicsPatch.version >= 1) return;
  } catch (e) { return; }

  var CFG = {
    // --- physics tuning (applied to controller.js CVARS) ---
    accel: 6.2,        // stock 5.5 — snappier first step
    friction: 6.0,     // stock 5.2 — crisper stops, less ice
    airAccel: 9,       // stock 12  — less mid-air steering (bhop still works)
    // --- landing ---
    landMinFall: 2.2,  // m/s of downward speed before a landing registers
    landNodScale: 0.055,
    landNodMax: 0.5,
    // --- slope slide ---
    slideSlope: 0.62,  // ground-gradient magnitude that starts a slide (~32 deg)
    slideAccel: 9.0,   // m/s^2 added downhill
    slideMax: 7.5,     // terminal slide speed m/s
    // --- breakable FX ---
    splinterMats: { wood: 1, crate: 1, darkwood: 1, fence: 1 },
    // --- recoil -> aim ---
    recoilAimScale: 0.38,  // fraction of weapon kick applied as permanent aim nudge
    recoilSideBias: 0.35,  // sideways component relative to vertical
    // --- ADS weight sway ---
    swayAmp: 0.0011,   // radians, light weapons
    swayHeavyMul: 2.2, // snipers + heavies sway this much more
  };

  var state = {
    booted: false,
    lastT: 0,
    wasGround: true,
    minVy: 0,          // most negative vy seen while airborne
    dip: 0,            // landing camera dip (applied via me.punch)
    spray: 0,          // shots since last pause (for recoil ramp)
    sprayT: 0,
    lastAmmoKey: '',
    slideX: 0, slideZ: 0,
    crouchDist: 0,
    swayT: Math.random() * 10,
    sim: null,         // cached { eyePos, aimDir } from sim.js (optional)
  };

  function mark() {
    try { window.__physicsPatch = { version: 1, cfg: CFG }; } catch (e) {}
  }

  // ---------------------------------------------------------------- boot ---
  function boot() {
    try {
      if (state.booted) return;
      if (typeof window === 'undefined' || !window.__cs) { setTimeout(boot, 400); return; }
      state.booted = true;
      tunePhysics();
      loadSimHelpers();
      requestAnimationFrame(frame);
      mark();
    } catch (e) { setTimeout(boot, 1000); }
  }

  // --- 1. physics tuning: CVARS is a live mutable object ---------------------
  function tunePhysics() {
    try {
      import('./controller.js').then(function (m) {
        try {
          if (m && m.CVARS) {
            m.CVARS.sv_accelerate = CFG.accel;
            m.CVARS.sv_friction = CFG.friction;
            m.CVARS.sv_airaccelerate = CFG.airAccel;
          }
        } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
  }

  function loadSimHelpers() {
    try {
      import('./sim.js').then(function (m) {
        try { if (m && m.eyePos && m.aimDir) state.sim = { eyePos: m.eyePos, aimDir: m.aimDir }; } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
  }

  // ---------------------------------------------------------------- loop ---
  function frame(t) {
    try { requestAnimationFrame(frame); } catch (e) { return; }
    var now = t || 0, dt = state.lastT ? Math.min(0.05, (now - state.lastT) / 1000) : 0.016;
    state.lastT = now;
    try { tick(dt); } catch (e) { /* never break the game loop */ }
  }

  function live() {
    try {
      var cs = window.__cs;
      if (!cs || !cs.me) return null;
      return cs;
    } catch (e) { return null; }
  }

  function tick(dt) {
    var cs = live();
    if (!cs) return;
    var me = cs.me;
    if (!me || !me.alive) { resetAir(); return; }

    var W = null, audio = null, parts = null, cam = null;
    try { W = cs.W; audio = cs.audio; parts = cs.parts; cam = cs.cam; } catch (e) {}

    landing(dt, me, W, audio);
    slopeSlide(dt, me, W);
    adsSway(dt, me);
    crouchSteps(dt, me, W, audio);
    shotFx(dt, me, W, audio, parts, cam);
  }

  function resetAir() {
    state.wasGround = true; state.minVy = 0; state.dip = 0;
    state.spray = 0; state.lastAmmoKey = ''; state.crouchDist = 0;
  }

  // --- 2. landing: nod + surface thud ----------------------------------------
  function landing(dt, me, W, audio) {
    try {
      var g = !!me.onGround;
      if (!g && me.vy < state.minVy) state.minVy = me.vy;
      if (g && !state.wasGround) {
        var fall = -state.minVy;
        if (fall > CFG.landMinFall && audio && audio.play) {
          var vol = Math.min(1, fall / 9);
          var mat = surfaceAt(W, me.x, me.z);
          // soft surfaces land quieter
          if (mat === 'sand' || mat === 'grass' || mat === 'carpet' || mat === 'snow' || mat === 'dirt') vol *= 0.55;
          else if (mat === 'metal' || mat === 'tile') vol = Math.min(1, vol * 1.15);
          try { audio.play('land', vol); } catch (e) {}
          // camera nod via me.punch (game.js folds punch into view pitch and decays it)
          var nod = Math.min(CFG.landNodMax, fall * CFG.landNodScale);
          me.punch = Math.min(0.9, (me.punch || 0) + nod);
        }
      }
      state.wasGround = g;
      if (g) state.minVy = 0;
    } catch (e) {}
  }

  function surfaceAt(W, x, z) {
    try {
      if (!W || !W.mat || !W.idx || !W.matName) return '';
      var i = W.idx(Math.floor(x), Math.floor(z));
      return W.matName(W.mat[i]) || '';
    } catch (e) { return ''; }
  }

  // --- 3. slope sliding -------------------------------------------------------
  function slopeSlide(dt, me, W) {
    try {
      if (!W || !W.groundAt || !me.onGround || me.prone) return;
      var r = 0.55;
      var gx = (W.groundAt(me.x + r, me.z, me.y + 1) - W.groundAt(me.x - r, me.z, me.y + 1)) / (2 * r);
      var gz = (W.groundAt(me.x, me.z + r, me.y + 1) - W.groundAt(me.x, me.z - r, me.y + 1)) / (2 * r);
      var mag = Math.hypot(gx, gz);
      if (mag > CFG.slideSlope) {
        var k = Math.min(1, (mag - CFG.slideSlope) * 3);
        me.vx -= gx * CFG.slideAccel * k * dt * 3;
        me.vz -= gz * CFG.slideAccel * k * dt * 3;
        var sp = Math.hypot(me.vx, me.vz);
        if (sp > CFG.slideMax) { me.vx *= CFG.slideMax / sp; me.vz *= CFG.slideMax / sp; }
      }
    } catch (e) {}
  }

  // --- 6. ADS weight sway -----------------------------------------------------
  function adsSway(dt, me) {
    try {
      if (!(me.ads > 0.5)) return;
      var w = curWeapon(me);
      var heavy = w && (w.cat === 'sniper' || w.cat === 'heavy');
      var amp = CFG.swayAmp * (heavy ? CFG.swayHeavyMul : 1) * me.ads;
      state.swayT += dt;
      var t = state.swayT;
      me.yaw += Math.sin(t * 2.1) * amp * dt * 8 * 0.12;
      me.pitch += Math.cos(t * 1.7) * amp * dt * 8 * 0.12;
    } catch (e) {}
  }

  // --- 7. crouch footsteps (base game is silent while crouched) ----------------
  function crouchSteps(dt, me, W, audio) {
    try {
      if (!audio || !audio.play || !me.onGround) { state.crouchDist = 0; return; }
      var sp = Math.hypot(me.vx || 0, me.vz || 0);
      if (me.crouch > 0.5 && sp > 1.2) {
        state.crouchDist += sp * dt;
        if (state.crouchDist > 2.4) {
          state.crouchDist = 0;
          var mat = surfaceAt(W, me.x, me.z);
          try { audio.play('step', 0.22, 0, mat); } catch (e) {}
        }
      } else state.crouchDist = 0;
    } catch (e) {}
  }

  // --- 4+5. shot detection -> breakable FX + aim recoil -----------------------
  function curWeapon(me) {
    try {
      if (!me.inv) return null;
      var it = me.inv[me.cur];
      if (!it || !it.wid) return null;
      return { it: it, def: null, wid: it.wid };
    } catch (e) { return null; }
  }

  function weaponDef(wid) {
    try {
      // dynamic import cached on first use
      return null; // resolved via window below; kept separate for defensiveness
    } catch (e) { return null; }
  }

  var W_BY_ID_CACHE = null, wbyTried = false;
  function wdef(wid) {
    if (!wbyTried) {
      wbyTried = true;
      try {
        import('./data.js').then(function (m) {
          try { if (m && m.W_BY_ID) W_BY_ID_CACHE = m.W_BY_ID; } catch (e) {}
        }).catch(function () {});
      } catch (e) {}
    }
    try { return (W_BY_ID_CACHE && W_BY_ID_CACHE[wid]) || null; } catch (e) { return null; }
  }

  function shotFx(dt, me, W, audio, parts, cam) {
    try {
      // spray decay
      state.sprayT += dt;
      if (state.sprayT > 0.45) { state.spray = 0; }
      if (!me.inv) return;
      var it = me.inv[me.cur];
      if (!it || typeof it.ammo !== 'number') { state.lastAmmoKey = ''; return; }
      var key = me.cur + ':' + it.wid;
      var ammoKey = key + ':' + it.ammo;
      if (state.lastAmmoKey && state.lastAmmoKey !== ammoKey) {
        var prev = parseInt(state.lastAmmoKey.split(':').pop(), 10);
        // ammo decreased => a shot was fired (reloads only increase it)
        if (!isNaN(prev) && it.ammo < prev && state.lastAmmoKey.indexOf(key + ':') === 0) {
          onShot(me, it, W, audio, parts, cam);
        }
      }
      state.lastAmmoKey = ammoKey;
    } catch (e) {}
  }

  function onShot(me, it, W, audio, parts, cam) {
    var def = wdef(it.wid);
    state.spray += 1; state.sprayT = 0;
    try { breakableFx(me, W, audio, parts); } catch (e) {}
    try { aimRecoil(me, def); } catch (e) {}
  }

  // --- 4. wood splinters when bullets hit wooden surfaces ---------------------
  function breakableFx(me, W, audio, parts) {
    try {
      if (!W || !W.ray || !W.matName || !parts || !parts.emit) return;
      var o = eyeOf(me), d = dirOf(me);
      if (!o || !d) return;
      var hit = W.ray(o, d, 40);
      if (!hit || typeof hit.m !== 'number') return;
      var mat = W.matName(hit.m) || '';
      if (!CFG.splinterMats[mat]) return;
      var hx = o.x + d.x * hit.t, hy = o.y + d.y * hit.t, hz = o.z + d.z * hit.t;
      try {
        parts.emit(hx, hy, hz, {
          n: 14, colors: ['#a8703e', '#7a5030', '#c89858', '#5a3a22'],
          speed: 3.2, up: 1.4, size: 0.035, life: 0.9, g: 1.6, spread: 0.7,
          dir: { x: -d.x * 0.5, y: 0.4, z: -d.z * 0.5 },
        });
      } catch (e) {}
      try { if (audio && audio.at && cam) audio.at('crunch', hx, hy, hz, cam, 26); } catch (e) {}
    } catch (e) {}
  }

  // --- 5. recoil moves the aim point (directional by weapon class) -------------
  function aimRecoil(me, def) {
    try {
      var kick = (def && def.kick) || 0.012;
      var cat = (def && def.cat) || '';
      var heavy = cat === 'sniper' || cat === 'heavy';
      var ramp = 1 + Math.min(state.spray, 8) * 0.06; // recoil ramps with sustained fire
      var up = kick * CFG.recoilAimScale * ramp * (heavy ? 1.35 : 1);
      // directional: heavies climb straight, light autos wander sideways
      var sideMag = kick * CFG.recoilAimScale * CFG.recoilSideBias * ramp * (heavy ? 0.4 : 1);
      var side = (state.spray % 2 === 0 ? 1 : -1) * sideMag * (0.5 + Math.random() * 0.5);
      me.pitch = Math.min(1.55, (me.pitch || 0) + up);
      me.yaw = (me.yaw || 0) + side;
    } catch (e) {}
  }

  // --- helpers -----------------------------------------------------------------
  function eyeOf(me) {
    try {
      if (state.sim && state.sim.eyePos) {
        var e = state.sim.eyePos(me);
        return { x: e.x, y: e.y, z: e.z };
      }
    } catch (e) {}
    try {
      // fallback: standing eye height
      var crouch = me.crouch || 0;
      return { x: me.x, y: me.y + 1.6 - crouch * 0.45, z: me.z };
    } catch (e) { return null; }
  }

  function dirOf(me) {
    try {
      if (state.sim && state.sim.aimDir) {
        var out = { x: 0, y: 0, z: 0 };
        state.sim.aimDir(me.yaw || 0, me.pitch || 0, out);
        return out;
      }
    } catch (e) {}
    try {
      var cp = Math.cos(me.pitch || 0);
      return { x: -Math.sin(me.yaw || 0) * cp, y: Math.sin(me.pitch || 0), z: -Math.cos(me.yaw || 0) * cp };
    } catch (e) { return null; }
  }

  // ------------------------------------------------------------------ go ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
    setTimeout(boot, 2500); // belt and suspenders
  } else {
    boot();
  }
})();
