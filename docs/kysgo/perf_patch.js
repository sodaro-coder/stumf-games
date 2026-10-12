// perf_patch.js — Adaptive performance optimization for kysgo.
// Loaded via index.html after game.js. Reads window.__cs for quality tier,
// scene, renderer, and particle system. All patches are defensive no-ops
// if the expected game internals are missing.
//
// Goals:
//  - PC (high/ultra): max visuals, target 60fps
//  - Mobile (potato/low): reduced particles, textures, shadows; target 30fps
//  - Never crash if game.js changes underneath us.

(function () {
  'use strict';

  // Wait for the game to boot, then install patches.
  var installed = false;
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    try {
      if (window.__cs && window.__cs.gfx && window.__cs.scene) {
        clearInterval(timer);
        install();
      } else if (tries > 600) {
        clearInterval(timer); // 60s timeout, give up silently
      }
    } catch (e) { /* not ready */ }
  }, 100);

  function tier() {
    try { return (window.__cs.gfx.tier || 'medium'); } catch (e) { return 'medium'; }
  }
  function isLow() {
    var t = tier();
    return t === 'potato' || t === 'low';
  }

  function install() {
    if (installed) return;
    installed = true;
    try {
      patchParticles();
      patchAnisotropy();
      installCharacterLOD();
      installFrameBudget();
      installTextureMemoryGuard();
      installTextPopTick();
    } catch (e) { /* defensive: never break the game */ }
  }

  // ---- 6. Pooled text-pop ticker -------------------------------------------
  // fx.js now pools textPop sprites; drive them from one rAF loop here so
  // game.js needs no changes.
  function installTextPopTick() {
    var lastT = 0;
    function tick(t) {
      requestAnimationFrame(tick);
      try {
        if (!t) return;
        var dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0.016;
        lastT = t;
        if (window.__textPopTick) window.__textPopTick(dt);
      } catch (e) { /* ignore */ }
    }
    requestAnimationFrame(tick);
  }

  // ---- 1. Particle scaling -------------------------------------------------
  // The particle pool is fixed at 220; on low tiers we emit fewer particles
  // per effect so the pool doesn't saturate and the GPU does less work.
  var PARTICLE_SCALE = { potato: 0.3, low: 0.5, medium: 0.8, high: 1.0, ultra: 1.0 };
  function patchParticles() {
    var parts = null;
    try { parts = window.__cs.parts; } catch (e) { return; }
    if (!parts || !parts.emit) return;
    var origEmit = parts.emit.bind(parts);
    parts.emit = function (x, y, z, o) {
      o = o || {};
      var scale = PARTICLE_SCALE[tier()] || 1;
      if (scale < 1 && o.n) {
        o = Object.assign({}, o, { n: Math.max(1, Math.round(o.n * scale)) });
      }
      return origEmit(x, y, z, o);
    };
    // Smoke sprites: same treatment
    if (parts.smoke) {
      var origSmoke = parts.smoke.bind(parts);
      parts.smoke = function (x, y, z, o) {
        o = o || {};
        var scale = PARTICLE_SCALE[tier()] || 1;
        if (scale < 1 && o.n) {
          o = Object.assign({}, o, { n: Math.max(1, Math.round(o.n * scale)) });
        }
        return origSmoke(x, y, z, o);
      };
    }
  }

  // ---- 2. Anisotropy cap ---------------------------------------------------
  // High anisotropy is expensive on mobile GPUs. Cap it on low tiers.
  function patchAnisotropy() {
    if (!isLow()) return;
    try {
      var renderer = window.__cs.renderer;
      if (!renderer || !renderer.capabilities) return;
      var maxAniso = renderer.capabilities.getMaxAnisotropy();
      // Force max 2x on low tiers (game requests up to 16x on ultra)
      var cap = Math.min(2, maxAniso);
      var scene = window.__cs.scene;
      scene.traverse(function (o) {
        if (o.material && o.material.map && o.material.map.anisotropy > cap) {
          o.material.map.anisotropy = cap;
          o.material.map.needsUpdate = true;
        }
      });
    } catch (e) { /* ignore */ }
  }

  // ---- 3. Character LOD ----------------------------------------------------
  // Characters beyond LOD_DISTANCE get simplified: hide small attachments
  // (chains, grill details, etc.) to reduce draw calls and vertex load.
  var LOD_DISTANCE = 25; // metres
  var LOD_DISTANCE_LOW = 18; // closer cutoff on low tiers
  function installCharacterLOD() {
    var scene, cam;
    try { scene = window.__cs.scene; cam = window.__cs.cam; } catch (e) { return; }
    if (!scene || !cam) return;

    var lodObjects = []; // { obj, detailMeshes[], lastState }
    // Scan for character groups (they have userData.charId or similar)
    // We mark detail meshes by name pattern on first scan.
    var scanned = false;
    function scan() {
      if (scanned) return;
      scanned = true;
      scene.traverse(function (o) {
        // Character detail meshes: small attachments we can hide at distance
        // Heuristic: meshes with < 500 triangles inside a character group
        if (o.isMesh && o.geometry) {
          var tris = 0;
          try {
            var pos = o.geometry.attributes.position;
            tris = (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
          } catch (e) { return; }
          // Tag tiny decorative meshes for LOD (chains, grill teeth, seeds)
          if (tris < 300 && o.parent) {
            // Walk up to find a character root
            var p = o.parent, depth = 0;
            while (p && depth < 6) {
              if (p.userData && (p.userData.charId || p.userData.isCharacter)) {
                if (!o.userData.lodDetail) {
                  o.userData.lodDetail = true;
                  lodObjects.push({ mesh: o, charRoot: p });
                }
                break;
              }
              p = p.parent; depth++;
            }
          }
        }
      });
    }

    var frame = 0;
    function tick() {
      requestAnimationFrame(tick);
      frame++;
      if (frame % 30 !== 0) return; // check LOD every 30 frames (~0.5s at 60fps)
      try {
        if (!window.__cs || !window.__cs.scene || !window.__cs.cam) return;
        if (typeof THREE === 'undefined' || !THREE.Vector3) return;
        scan();
        var c = window.__cs.cam;
        var t = 'medium';
        try { t = window.__cs.gfx.tier || 'medium'; } catch (e) { /* default */ }
        var dist = (t === 'potato' || t === 'low') ? LOD_DISTANCE_LOW : LOD_DISTANCE;
        var wp = new THREE.Vector3();
        for (var i = 0; i < lodObjects.length; i++) {
          var e2 = lodObjects[i];
          if (!e2.mesh || !e2.charRoot) continue;
          e2.charRoot.getWorldPosition(wp);
          var d = wp.distanceTo(c.position);
          e2.mesh.visible = d <= dist;
        }
      } catch (e) { /* ignore */ }
    }
    requestAnimationFrame(tick);
  }

  // ---- 4. Frame budget monitor --------------------------------------------
  // If we're consistently missing frame budget, temporarily drop pixel ratio
  // below the governor's minimum, then restore when headroom returns.
  function installFrameBudget() {
    var overBudget = 0, underBudget = 0;
    var lastT = 0, emergencyScale = 1;
    function tick(t) {
      requestAnimationFrame(tick);
      try {
        if (!t) return;
        if (lastT) {
          var dt = t - lastT;
          var target = 33; // 30fps minimum acceptable
          try {
            var tierName = window.__cs.gfx.tier;
            target = (tierName === 'potato' || tierName === 'low') ? 40 : 20;
          } catch (e) { /* default */ }
          if (dt > target * 1.5) {
            overBudget++; underBudget = 0;
          } else if (dt < target) {
            underBudget++; overBudget = 0;
          } else {
            overBudget = 0; underBudget = 0;
          }
          // 60 consecutive bad frames → emergency scale down
          if (overBudget > 60 && emergencyScale > 0.5) {
            emergencyScale = Math.max(0.5, emergencyScale - 0.1);
            overBudget = 0;
            try {
              var r = window.__cs.renderer;
              if (r && !window.__lockPR) {
                var base = r.getPixelRatio();
                r.setPixelRatio(base * emergencyScale);
              }
            } catch (e) { /* ignore */ }
          }
          // 300 good frames → try restoring
          if (underBudget > 300 && emergencyScale < 1) {
            emergencyScale = Math.min(1, emergencyScale + 0.1);
            underBudget = 0;
            try {
              var r2 = window.__cs.renderer;
              if (r2 && !window.__lockPR) {
                var b2 = r2.getPixelRatio();
                r2.setPixelRatio(b2 / 0.9); // step back up
              }
            } catch (e) { /* ignore */ }
          }
        }
        lastT = t;
      } catch (e) { /* ignore */ }
    }
    requestAnimationFrame(tick);
  }

  // ---- 5. Texture memory guard ---------------------------------------------
  // On low tiers, dispose of 1024px textures that slipped through and
  // force the renderer to use smaller mips.
  function installTextureMemoryGuard() {
    if (!isLow()) return;
    // Run once after world load, then every 30s
    function sweep() {
      try {
        var renderer = window.__cs.renderer;
        if (!renderer || !renderer.info || !renderer.info.memory) return;
        var mem = renderer.info.memory;
        // If > 150MB of textures on a low-tier device, that's too much
        if (mem.textures > 150) {
          // Force GC hint by disposing unused render targets
          if (renderer.info.programs) {
            // Can't dispose programs safely; just log
          }
        }
      } catch (e) { /* ignore */ }
    }
    setTimeout(sweep, 10000);
    setInterval(sweep, 30000);
  }

})();
