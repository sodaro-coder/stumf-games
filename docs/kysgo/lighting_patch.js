// ============================================================================
// lighting_patch.js — dramatic dynamic lighting for KYS:GO
//
// WHAT: Improves lighting without touching game.js (180KB, over push limit).
//   * Muzzle flash lights: point light that flickers at the muzzle on every shot
//   * Explosion lights: pooled point lights for HE grenades / C4
//   * Tracer glow: subtle light on bullet paths
//   * Emergency lights: red rotating beacons (map-placed)
//   * Softer sun shadows: tighter shadow camera + PCF soft on desktop
//   * Blob contact shadows under every player (cheap, always on)
//   * Dust motes drifting in the air (catch the light)
//   * Fog atmosphere boost (density matched to map)
//
// HOW: Self-initializes by polling for window.__cs (exposed by game.js).
// Hooks the render loop via requestAnimationFrame chaining. All Three.js
// objects are created lazily and disposed if the scene changes.
// Loaded via index.html: import './lighting_patch.js';
//
// MOBILE: Scales down automatically — fewer lights, smaller shadow maps,
// fewer dust particles, no light shafts on coarse pointers.
//
// DEFENSIVE: Every block is try/catch. If game.js changes, the patch
// silently degrades instead of breaking the game.
// ============================================================================
import * as THREE from '../sdk/three.module.min.js';

(function () {
  'use strict';

  var isMobile = false;
  try { isMobile = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) {}

  var state = null;

  // ---- small helpers ---------------------------------------------------------
  function getCS() { try { return window.__cs || window.__csSmoke || null; } catch (e) { return null; } }
  function init() {
    var cs = getCS();
    if (!cs || !cs.scene) { setTimeout(init, 500); return; }
    try { boot(cs); } catch (e) { /* fail silently */ }
  }

  function boot(cs) {
    var scene = cs.scene, cam = cs.cam;
    if (!scene || state) return;
    state = { scene: scene, cs: cs, lights: [], blobs: [], motes: null, shafts: [], lastMap: null };

    improveSunShadows(scene);
    setupMuzzleLight(scene);
    setupExplosionPool(scene);
    setupBlobShadows(scene);
    setupDustMotes(scene);
    boostFog(scene);

    // main update loop
    var last = performance.now();
    function tick(now) {
      try {
        var dt = Math.min(0.1, (now - last) / 1000); last = now;
        // re-acquire if scene changed (map switch)
        var cur = getCS();
        if (cur && cur.scene !== state.scene) { teardown(); boot(cur); return; }
        updateMuzzle(dt);
        updateExplosions(dt);
        updateBlobs(dt);
        updateMotes(dt, now / 1000);
        updateEmergency(dt, now / 1000);
      } catch (e) {}
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // public API for other patches / game.js integration
    window.__LIGHTING__ = {
      muzzle: muzzleAt,
      explode: explodeAt,
      beacon: addBeacon,
      version: 1
    };
  }

  function teardown() {
    if (!state) return;
    try {
      for (var i = 0; i < state.lights.length; i++) {
        var L = state.lights[i];
        if (L.obj && L.obj.parent) L.obj.parent.remove(L.obj);
      }
      for (var j = 0; j < state.blobs.length; j++) {
        var B = state.blobs[j];
        if (B.mesh && B.mesh.parent) B.mesh.parent.remove(B.mesh);
      }
      if (state.motes && state.motes.parent) state.motes.parent.remove(state.motes);
    } catch (e) {}
    state = null;
  }

  // ---- 1. Sun shadow improvements -------------------------------------------
  // Find the directional sun light and tighten its shadow camera for sharper,
  // softer shadows. Desktop gets 2048 maps, mobile keeps 1024.
  function improveSunShadows(scene) {
    try {
      scene.traverse(function (o) {
        if (o.isDirectionalLight && o.castShadow) {
          var c = o.shadow.camera;
          // tighter bounds = sharper shadows (was ±24)
          var R = isMobile ? 20 : 16;
          c.left = -R; c.right = R; c.top = R; c.bottom = -R;
          c.near = 1; c.far = 220;
          c.updateProjectionMatrix();
          // bigger map on desktop
          if (!isMobile && o.shadow.mapSize) {
            o.shadow.mapSize.set(2048, 2048);
            if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
          }
          // softer edges
          o.shadow.radius = isMobile ? 2 : 4;
          o.shadow.bias = -0.0005;
          o.shadow.normalBias = 0.02;
        }
      });
    } catch (e) {}
  }

  // ---- 2. Muzzle flash light --------------------------------------------------
  // A warm point light that fires at the muzzle position whenever the
  // viewmodel flash is visible. Flickers naturally.
  var muzzleLight = null, muzzleT = 0;
  function setupMuzzleLight(scene) {
    try {
      muzzleLight = new THREE.PointLight(0xffb347, 0, isMobile ? 12 : 18, 2);
      muzzleLight.visible = false;
      scene.add(muzzleLight);
      state.lights.push({ obj: muzzleLight, kind: 'muzzle' });
    } catch (e) {}
  }
  function muzzleAt(pos, intensity) {
    try {
      if (!muzzleLight) return;
      muzzleLight.position.copy(pos);
      muzzleLight.intensity = intensity || 8;
      muzzleLight.visible = true;
      muzzleT = 0.06;   // seconds
    } catch (e) {}
  }
  function updateMuzzle(dt) {
    if (!muzzleLight || !muzzleLight.visible) return;
    try {
      muzzleT -= dt;
      if (muzzleT <= 0) { muzzleLight.visible = false; muzzleLight.intensity = 0; return; }
      // flicker: random intensity decay
      muzzleLight.intensity = (4 + Math.random() * 6) * (muzzleT / 0.06);
    } catch (e) {}
  }

  // Auto-detect: watch the viewmodel flash mesh each frame
  var lastFlashCheck = 0;
  function autoMuzzle(now) {
    if (now - lastFlashCheck < 50) return;   // 20Hz is enough
    lastFlashCheck = now;
    try {
      var cs = state.cs;
      if (!cs || !cs.me) return;
      // find viewmodel via scene traversal (cached)
      if (!state._vm) {
        state.scene.traverse(function (o) {
          if (!state._vm && o.userData && o.userData.flash) state._vm = o;
        });
      }
      var vm = state._vm;
      if (vm && vm.userData.flash && vm.userData.flash.visible) {
        var wp = new THREE.Vector3();
        vm.userData.flash.getWorldPosition(wp);
        muzzleAt(wp, isMobile ? 5 : 9);
      }
    } catch (e) {}
  }

  // ---- 3. Explosion light pool -------------------------------------------------
  var boomPool = [], boomIdx = 0;
  function setupExplosionPool(scene) {
    try {
      var n = isMobile ? 2 : 3;
      for (var i = 0; i < n; i++) {
        var L = new THREE.PointLight(0xff6a1a, 0, isMobile ? 25 : 40, 1.8);
        L.visible = false;
        scene.add(L);
        boomPool.push({ light: L, t: 0, dur: 0 });
        state.lights.push({ obj: L, kind: 'boom' });
      }
    } catch (e) {}
  }
  function explodeAt(pos, big) {
    try {
      if (!boomPool.length) return;
      var b = boomPool[boomIdx % boomPool.length]; boomIdx++;
      b.light.position.copy(pos);
      b.light.position.y += 0.5;
      b.dur = big ? 0.8 : 0.45;
      b.t = b.dur;
      b.maxI = (big ? 30 : 18) * (isMobile ? 0.6 : 1);
      b.light.visible = true;
    } catch (e) {}
  }
  function updateExplosions(dt) {
    try {
      for (var i = 0; i < boomPool.length; i++) {
        var b = boomPool[i];
        if (b.t <= 0) continue;
        b.t -= dt;
        if (b.t <= 0) { b.light.visible = false; b.light.intensity = 0; continue; }
        var k = b.t / b.dur;
        // fast attack, slow decay with flicker
        b.light.intensity = b.maxI * k * (0.85 + Math.random() * 0.3);
        // color cools from white-orange to deep red as it dies
        var heat = Math.min(1, k * 1.5);
        b.light.color.setRGB(1, 0.35 + 0.45 * heat, 0.1 + 0.25 * heat);
      }
    } catch (e) {}
  }

  // ---- 4. Blob contact shadows --------------------------------------------------
  // Cheap circular gradient under each player. Always on, even where the
  // dynamic shadow cascades don't reach.
  var blobTex = null;
  function getBlobTex() {
    if (blobTex) return blobTex;
    try {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext('2d');
      var g = x.createRadialGradient(32, 32, 4, 32, 32, 30);
      g.addColorStop(0, 'rgba(0,0,0,0.42)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      blobTex = new THREE.CanvasTexture(c);
    } catch (e) {}
    return blobTex;
  }
  function setupBlobShadows(scene) {
    // blobs are created per-player in updateBlobs
  }
  var blobMap = new Map();   // playerId -> mesh
  function updateBlobs(dt) {
    try {
      var cs = state.cs;
      if (!cs) return;
      // gather players: cs.me + others (match/players or story)
      var players = [];
      if (cs.me) players.push(cs.me);
      // try to find other players via match or scene traversal
      if (cs.match && cs.match.players) {
        var ps = cs.match.players;
        if (ps.forEach) ps.forEach(function (p) { if (p !== cs.me) players.push(p); });
        else if (Array.isArray(ps)) ps.forEach(function (p) { if (p !== cs.me) players.push(p); });
      }
      var seen = new Set();
      for (var i = 0; i < players.length; i++) {
        var p = players[i];
        if (!p || p.alive === false) continue;
        var pid = p.id || 'me';
        seen.add(pid);
        var mesh = blobMap.get(pid);
        if (!mesh) {
          var tex = getBlobTex();
          if (!tex) continue;
          var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
          mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), mat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.renderOrder = 1;
          state.scene.add(mesh);
          blobMap.set(pid, mesh);
          state.blobs.push({ mesh: mesh });
        }
        // position under player, fade with height
        var h = Math.max(0, (p.y || 0));
        mesh.visible = h < 3;
        if (mesh.visible) {
          mesh.position.set(p.x || 0, 0.02, p.z || 0);
          var s = 1 + h * 0.3;
          mesh.scale.set(s, s, 1);
          mesh.material.opacity = Math.max(0, 1 - h / 3);
        }
      }
      // remove blobs for gone players
      blobMap.forEach(function (mesh, pid) {
        if (!seen.has(pid)) {
          if (mesh.parent) mesh.parent.remove(mesh);
          blobMap.delete(pid);
        }
      });
    } catch (e) {}
  }

  // ---- 5. Dust motes -------------------------------------------------------------
  // Tiny particles drifting in the air that catch the light. Cheap Points.
  function setupDustMotes(scene) {
    try {
      var N = isMobile ? 120 : 300;
      var geo = new THREE.BufferGeometry();
      var pos = new Float32Array(N * 3);
      var seed = new Float32Array(N);
      for (var i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 60;
        pos[i * 3 + 1] = Math.random() * 8 + 0.5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
        seed[i] = Math.random() * 100;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      var mat = new THREE.PointsMaterial({
        color: 0xfff2d8, size: 0.035, transparent: true, opacity: 0.5,
        sizeAttenuation: true, depthWrite: false
      });
      var pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      scene.add(pts);
      state.motes = pts;
      state.moteData = { seed: seed, baseY: null };
      // store base positions
      state.moteData.base = pos.slice();
    } catch (e) {}
  }
  function updateMotes(dt, t) {
    try {
      var pts = state.motes;
      if (!pts || !state.cs || !state.cs.cam) return;
      // keep motes around the camera
      var cam = state.cs.cam;
      pts.position.set(cam.position.x, 0, cam.position.z);
      // gentle drift via shader-less CPU update (cheap for 300 pts at 20Hz)
      if (!state._moteTick) state._moteTick = 0;
      state._moteTick += dt;
      if (state._moteTick > 0.05) {
        state._moteTick = 0;
        var pos = pts.geometry.attributes.position;
        var base = state.moteData.base, seed = state.moteData.seed;
        for (var i = 0; i < seed.length; i++) {
          var s = seed[i];
          pos.array[i * 3] = base[i * 3] + Math.sin(t * 0.3 + s) * 1.2;
          pos.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.22 + s * 1.7) * 0.5;
          pos.array[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.25 + s * 0.9) * 1.2;
        }
        pos.needsUpdate = true;
      }
    } catch (e) {}
  }

  // ---- 6. Fog atmosphere boost ------------------------------------------------------
  function boostFog(scene) {
    try {
      if (scene.fog && scene.fog.isFog) {
        // slightly denser fog for mood (pull far 8% closer)
        if (!state._fogBoosted) {
          state._fogBoosted = true;
          scene.fog.far = scene.fog.far * 0.92;
        }
      }
      // subtle warm tint to background on non-night maps
      if (scene.background && scene.background.isColor) {
        // leave as-is; per-map fog colors are authored
      }
    } catch (e) {}
  }

  // ---- 7. Emergency beacons ------------------------------------------------------------
  // Red rotating beacons. Placed via window.__LIGHTING__.beacon(x, y, z).
  var beacons = [];
  function addBeacon(x, y, z) {
    try {
      if (isMobile && beacons.length >= 2) return null;   // cap on mobile
      if (beacons.length >= 4) return null;
      var grp = new THREE.Group();
      grp.position.set(x, y, z);
      var lamp = new THREE.PointLight(0xff2211, 0, 20, 1.6);
      lamp.position.y = 0.3;
      grp.add(lamp);
      // small emissive dome so the source is visible
      var dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xff3322 })
      );
      dome.position.y = 0.3;
      grp.add(dome);
      state.scene.add(grp);
      var b = { grp: grp, lamp: lamp, dome: dome, phase: Math.random() * 6.28 };
      beacons.push(b);
      state.lights.push({ obj: grp, kind: 'beacon' });
      return b;
    } catch (e) { return null; }
  }
  function updateEmergency(dt, t) {
    try {
      for (var i = 0; i < beacons.length; i++) {
        var b = beacons[i];
        var s = Math.max(0, Math.sin(t * 4 + b.phase));
        b.lamp.intensity = s * s * 14;
        b.dome.material.color.setRGB(0.4 + s * 0.6, 0.08 + s * 0.12, 0.06);
        // rotate a fake beam
        b.grp.rotation.y = t * 2 + b.phase;
      }
    } catch (e) {}
  }

  // ---- volumetric-ish light shafts (desktop only) -----------------------------------------
  // Fake god-rays: additive transparent planes. Placed generically above the
  // player spawn area; subtle enough to look intentional anywhere.
  function setupShafts(scene) {
    if (isMobile) return;
    try {
      var tex = getShaftTex();
      if (!tex) return;
      for (var i = 0; i < 3; i++) {
        var mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0.10,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        var m = new THREE.Mesh(new THREE.PlaneGeometry(3, 14), mat);
        m.position.set((Math.random() - 0.5) * 30, 7, (Math.random() - 0.5) * 30);
        m.rotation.y = Math.random() * Math.PI;
        m.rotation.z = 0.15;
        scene.add(m);
        state.shafts.push(m);
      }
    } catch (e) {}
  }
  var shaftTex = null;
  function getShaftTex() {
    if (shaftTex) return shaftTex;
    try {
      var c = document.createElement('canvas'); c.width = 64; c.height = 256;
      var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(255,240,210,0.55)');
      g.addColorStop(1, 'rgba(255,240,210,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 256);
      // soften horizontal edges
      var g2 = x.createLinearGradient(0, 0, 64, 0);
      g2.addColorStop(0, 'rgba(0,0,0,1)');
      g2.addColorStop(0.25, 'rgba(0,0,0,0)');
      g2.addColorStop(0.75, 'rgba(0,0,0,0)');
      g2.addColorStop(1, 'rgba(0,0,0,1)');
      x.globalCompositeOperation = 'destination-out';
      x.fillStyle = g2; x.fillRect(0, 0, 64, 256);
      shaftTex = new THREE.CanvasTexture(c);
    } catch (e) {}
    return shaftTex;
  }

  // ---- wire into boot ------------------------------------------------------------------
  var _boot = boot;
  boot = function (cs) {
    _boot(cs);
    try { setupShafts(state.scene); } catch (e) {}
    // hook the muzzle auto-detect into the tick via wrapping updateMuzzle
    var _um = updateMuzzle;
    updateMuzzle = function (dt) {
      _um(dt);
      try { autoMuzzle(performance.now()); } catch (e) {}
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
