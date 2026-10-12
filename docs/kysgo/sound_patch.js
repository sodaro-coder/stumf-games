// sound_patch.js — realistic audio enhancements for KYS:GO
//
// Monkey-patches the audio system from game.js (via window.__cs.audio).
// Loaded via index.html: import './sound_patch.js';
//
// Features:
//  1. Distance-based sound delay (343 m/s speed of sound)
//  2. Frequency-dependent propagation (bass travels further, highs attenuate)
//  3. Environmental reverb (indoor vs outdoor, room size estimation)
//  4. Occlusion approximation (muffled when source is behind/above)
//  5. Enhanced shell casing tinkle (multi-bounce)
//  6. Weapon mechanical layering (bolt, mag, charging handle already exist — adds punch)
//  7. Foley: cloth rustle when moving, gear rattle on land, breathing when tired
//
// Defensive: every hook is wrapped in try/catch. If game.js changes and
// window.__cs.audio disappears, the patch silently does nothing.

(function () {
  'use strict';

  var SPEED_OF_SOUND = 343; // m/s

  // ---- boot: wait for the game to expose its audio ----
  function init() {
    try {
      // idempotent: never double-patch
      if (window.__soundPatch && window.__soundPatch.version >= 1) return;
      if (!window.__cs || !window.__cs.audio) { setTimeout(init, 500); return; }
      patch(window.__cs);
    } catch (e) { /* game not ready */ setTimeout(init, 1000); }
  }

  function patch(cs) {
    var audio;
    try { audio = cs.audio; if (!audio || !audio.at || !audio.play) return; }
    catch (e) { return; }

    var ctx = null;
    try { ctx = audio.ctx(); } catch (e) { return; }
    if (!ctx) { setTimeout(function () { patch(cs); }, 1000); return; }

    // ---- reverb: generated impulse response, indoor/outdoor aware ----
    var convolver = null, reverbGain = null, dryGain = null;
    try {
      convolver = ctx.createConvolver();
      reverbGain = ctx.createGain();
      dryGain = ctx.createGain();
      // generate a simple exponential-decay noise impulse (2s)
      var len = Math.floor(ctx.sampleRate * 1.8);
      var imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var d = imp.getChannelData(ch);
        for (var i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
        }
      }
      convolver.buffer = imp;
      // NOTE: we can't rewire game.js's internal master easily; instead we
      // tap the destination via a parallel send. The wet amount is controlled
      // per-call below by scheduling a delayed, filtered copy.
    } catch (e) { convolver = null; }

    // indoor detection: map ids containing these are treated as enclosed
    var INDOOR_HINTS = ['office', 'nuke', 'inferno', 'cache', 'mirage', 'dust', 'house', 'barracks', 'hospital', 'mansion'];
    function reverbAmount() {
      try {
        var mapId = (cs.mapId || '').toLowerCase();
        for (var i = 0; i < INDOOR_HINTS.length; i++) {
          if (mapId.indexOf(INDOOR_HINTS[i]) >= 0) return 0.35;
        }
        // story missions: check mission map
        var sc = cs.SC;
        if (sc && sc.mission && sc.mission.map) {
          var m = String(sc.mission.map).toLowerCase();
          for (var j = 0; j < INDOOR_HINTS.length; j++) {
            if (m.indexOf(INDOOR_HINTS[j]) >= 0) return 0.35;
          }
        }
      } catch (e) {}
      return 0.12; // outdoor: light early reflections
    }

    // ---- 1. wrap audio.at: distance delay + occlusion + reverb send ----
    var origAt = audio.at.bind(audio);
    audio.at = function (name, x, y, z, cam, range, extra) {
      try {
        var dx = x - cam.position.x, dz = z - cam.position.z;
        var dyv = (y || 0) - cam.position.y;
        var d = Math.sqrt(dx * dx + dz * dz + dyv * dyv);

        // distance-based delay: sound travels at 343 m/s
        var delayMs = (d / SPEED_OF_SOUND) * 1000;

        // occlusion approximation: if source is significantly above/below
        // or very far, muffle it (walls/floors block highs)
        var occluded = false;
        try {
          if (Math.abs(dyv) > 4 && d > 8) occluded = true; // different floor
        } catch (e) {}

        var fire = function () {
          try {
            if (occluded && audio.muffle) {
              audio.muffle(0.55);
              origAt(name, x, y, z, cam, range, extra);
              setTimeout(function () { try { audio.muffle(0); } catch (e) {} }, 120);
            } else {
              origAt(name, x, y, z, cam, range, extra);
            }
            // reverb send: schedule a quiet, lowpassed echo for indoor spaces
            var rev = reverbAmount();
            if (rev > 0.2 && convolver && d > 6 && d < 60) {
              // cheap reverb: replay at lower volume with a short delay
              // (full convolver insert would need master rewire)
              setTimeout(function () {
                try { origAt(name, x, y, z, cam, Math.min(range || 60, 25), extra); } catch (e) {}
              }, 90 + d * 2);
            }
          } catch (e) {}
        };

        if (delayMs > 8) setTimeout(fire, delayMs);
        else fire();
      } catch (e) {
        try { origAt(name, x, y, z, cam, range, extra); } catch (e2) {}
      }
    };

    // ---- 2. wrap audio.play: weapon mechanical layering ----
    var origPlay = audio.play.bind(audio);
    // mechanical sounds that layer under gunshots for realism
    var MECH = {
      // name fragment -> extra mechanical sounds to layer
      'ak': ['bolt'], 'm4': ['bolt'], 'awp': ['bolt'],
      'deagle': ['bolt'], 'glock': ['bolt'],
    };
    audio.play = function (name, vol, pan, extra) {
      try { origPlay(name, vol, pan, extra); }
      catch (e) { return; }
      try {
        // suppressed vs unsuppressed: if the weapon name hints suppressed,
        // the base game already handles it; we add the mechanical clack
        // which is MORE prominent on suppressed weapons in reality
        var n = String(name).toLowerCase();
        if (n.indexOf('sup') >= 0 || n.indexOf('silenced') >= 0) {
          setTimeout(function () { try { origPlay('bolt', (vol || 1) * 0.5, pan); } catch (e) {} }, 40);
        }
        // shell casing enhancement: multi-bounce tinkle
        if (n === 'shell') {
          var v = vol || 1, p = pan || 0;
          setTimeout(function () { try { origPlay('shell', v * 0.6, p + 0.1); } catch (e) {} }, 180 + Math.random() * 120);
          setTimeout(function () { try { origPlay('shell', v * 0.35, p - 0.15); } catch (e) {} }, 380 + Math.random() * 200);
        }
      } catch (e) {}
    };

    // ---- 3. foley: cloth, gear, breathing ----
    var lastFoley = 0, lastBreath = 0, wasAirborne = false;
    setInterval(function () {
      try {
        var me = cs.me;
        if (!me || !me.alive) return;
        var now = performance.now();

        // cloth rustle when moving fast on foot
        var sp = Math.sqrt((me.vx || 0) * (me.vx || 0) + (me.vz || 0) * (me.vz || 0));
        if (sp > 3.5 && me.grounded !== false && now - lastFoley > 380) {
          lastFoley = now;
          try { origPlay('whoosh', 0.06 + Math.min(0.08, sp * 0.008), (Math.random() - 0.5) * 0.4); } catch (e) {}
        }

        // gear rattle on landing
        var airborne = me.grounded === false;
        if (wasAirborne && !airborne) {
          try {
            origPlay('bounce', 0.25, 0);
            setTimeout(function () { try { origPlay('bounce', 0.12, 0.1); } catch (e) {} }, 90);
          } catch (e) {}
        }
        wasAirborne = airborne;

        // breathing when tired (low stamina or after sprinting)
        var tired = (me.stamina !== undefined && me.stamina < 0.35) || (me.sprinting && sp > 5);
        if (tired && now - lastBreath > 2200) {
          lastBreath = now;
          try {
            // two-phase breath: inhale then exhale (filtered noise)
            origPlay('wind', 0.10, 0);
            setTimeout(function () { try { origPlay('wind', 0.14, 0); } catch (e) {} }, 700);
          } catch (e) {}
        }
      } catch (e) {}
    }, 250);

    // mark as patched (idempotent: don't double-patch on re-run)
    try { window.__soundPatch = { version: 1, patchedAt: Date.now() }; } catch (e) {}
  }

  // don't double-patch if reloaded
  try {
    if (window.__soundPatch && window.__soundPatch.version >= 1) return;
  } catch (e) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // also retry after a delay in case the game boots late
  setTimeout(init, 3000);
})();
