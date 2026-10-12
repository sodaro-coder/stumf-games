// KYS:GO — Home UI v3 "Command Center" runtime companion.
//
// Dramatically restructures the home tab via DOM injection (the Menu class in
// ui.js generates the home HTML; this patch layers the v3 redesign on top).
// Also adds an animated particle/grid background canvas behind the 3D stage.
//
// Everything is defensive: if the menu DOM isn't there, it silently no-ops.
(function () {
  'use strict';

  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ---- 1. News content (update this when shipping patches) ----
  var NEWS = [
    { dt: 'Oct 12', tt: 'Realism patch pack is live', ds: 'Distance-delayed gunshots, dynamic muzzle-flash lighting, glowing tracers, per-gun shell ejection, landing impacts, slope sliding and recoil that moves your aim.' },
    { dt: 'Oct 12', tt: 'Characters overhauled', ds: "Ricky finally has his gold chains and grill. Cancer wears his hospital gown. Wiener's bun has sesame seeds. Igor's ushanka got its red star." },
    { dt: 'Oct 12', tt: 'Story dialogue de-cringed', ds: 'All 31 missions got a writing pass. Less caps-lock yelling, more lines that actually land.' },
  ];

  var ACTIONS = [
    { tab: 'story', ic: '🎖️', t: 'Story', s: '31 missions · 9 chapters' },
    { tab: 'inv', ic: '🎒', t: 'Inventory', s: 'Skins, knives, agents' },
    { tab: 'crates', ic: '📦', t: 'Cases', s: 'Roll for rare finishes' },
    { tab: 'market', ic: '📈', t: 'Market', s: 'Trade with players' },
  ];

  // ---- 2. Animated background canvas ----
  var bgCanvas = null, bgCtx = null, parts = [], bgRaf = 0, bgRunning = false;
  function bgInit() {
    try {
      var menu = document.querySelector('.cs-menu');
      if (!menu || bgCanvas) return;
      bgCanvas = document.createElement('canvas');
      bgCanvas.className = 'ov3-bg';
      menu.insertBefore(bgCanvas, menu.firstChild);
      bgCtx = bgCanvas.getContext('2d');
      var n = 26;
      try { if (matchMedia('(pointer: coarse)').matches) n = 14; } catch (e) {}
      for (var i = 0; i < n; i++) parts.push(spawn(true));
      if (!reduceMotion) bgStart();
      addEventListener('resize', bgSize);
      bgSize();
    } catch (e) {}
  }
  function spawn(anywhere) {
    var w = innerWidth, h = innerHeight;
    return {
      x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
      vx: (Math.random() - 0.5) * 0.25, vy: -0.12 - Math.random() * 0.3,
      r: 1 + Math.random() * 2.2, a: 0.12 + Math.random() * 0.3,
      hue: Math.random() < 0.82 ? '61,155,255' : '242,163,58',
    };
  }
  function bgSize() {
    try {
      var dpr = Math.min(devicePixelRatio || 1, 2);
      bgCanvas.width = innerWidth * dpr; bgCanvas.height = innerHeight * dpr;
      bgCanvas.style.width = innerWidth + 'px'; bgCanvas.style.height = innerHeight + 'px';
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } catch (e) {}
  }
  function bgStart() {
    if (bgRunning) return; bgRunning = true;
    var last = 0;
    var tick = function (t) {
      if (!bgRunning) return;
      bgRaf = requestAnimationFrame(tick);
      if (t - last < 50) return;   // ~20fps is plenty for ambience
      last = t;
      try {
        var w = innerWidth, h = innerHeight, c = bgCtx;
        c.clearRect(0, 0, w, h);
        // faint grid
        c.strokeStyle = 'rgba(61,155,255,0.045)'; c.lineWidth = 1;
        var gs = 72;
        c.beginPath();
        for (var gx = (t / 90) % gs; gx < w; gx += gs) { c.moveTo(gx, 0); c.lineTo(gx, h); }
        for (var gy = 0; gy < h; gy += gs) { c.moveTo(0, gy); c.lineTo(w, gy); }
        c.stroke();
        // drifting particles
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.x += p.vx; p.y += p.vy;
          if (p.y < -12 || p.x < -12 || p.x > w + 12) parts[i] = p = spawn(false);
          var g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g.addColorStop(0, 'rgba(' + p.hue + ',' + p.a + ')');
          g.addColorStop(1, 'rgba(' + p.hue + ',0)');
          c.fillStyle = g;
          c.beginPath(); c.arc(p.x, p.y, p.r * 4, 0, 6.283); c.fill();
        }
      } catch (e) {}
    };
    bgRaf = requestAnimationFrame(tick);
  }

  // ---- 3. Home tab injection ----
  function $(sel, root) { try { return (root || document).querySelector(sel); } catch (e) { return null; } }

  function playerStats() {
    // read from the existing topnav DOM (Menu.top() fills these)
    var name = '', lvl = '';
    try {
      var n = $('#mName'), l = $('#mLvlN');
      if (n) name = (n.textContent || '').trim();
      if (l) lvl = (l.textContent || '').trim();
    } catch (e) {}
    return { name: name, lvl: lvl };
  }

  function goTab(tab) {
    try {
      var b = document.querySelector('.cs-nav button[data-tab="' + tab + '"]');
      if (b) { b.click(); return true; }
    } catch (e) {}
    return false;
  }

  function injectHome() {
    try {
      var home = $('.cs-home');
      if (!home || home.dataset.v3done) return;
      home.dataset.v3done = '1';

      var hero = $('.cs-hero', home);
      var side = $('.cs-side2', home);

      // (a) news ticker above the title
      if (hero) {
        var h1 = $('h1', hero);
        var tick = document.createElement('div');
        tick.className = 'ov3-ticker';
        tick.innerHTML = '<span class="dot"></span>Season update · v3 command center';
        if (h1) hero.insertBefore(tick, h1); else hero.insertBefore(tick, hero.firstChild);

        // (b) stats bar after the PLAY button
        var go = $('#hGo', hero);
        var st = playerStats();
        var bar = document.createElement('div');
        bar.className = 'ov3-stats';
        bar.innerHTML =
          '<div class="st"><b>' + esc(st.lvl || '1') + '</b><span>Level</span></div>' +
          '<div class="st"><b>31</b><span>Missions</span></div>' +
          '<div class="st"><b>9</b><span>Chapters</span></div>' +
          '<div class="st"><b style="color:#7cc0ff">' + esc((st.name || 'Player').split('#')[0].slice(0, 12)) + '</b><span>Operator</span></div>';
        if (go && go.parentNode === hero) hero.insertBefore(bar, go.nextSibling);
        else hero.appendChild(bar);

        // (c) quick action cards
        var acts = document.createElement('div');
        acts.className = 'ov3-actions';
        acts.innerHTML = ACTIONS.map(function (a, i) {
          return '<button class="ov3-act" data-v3tab="' + a.tab + '"><span class="ic">' + a.ic + '</span><b>' + a.t + '</b><small>' + a.s + '</small></button>';
        }).join('');
        hero.appendChild(acts);
        acts.querySelectorAll('[data-v3tab]').forEach(function (b) {
          b.addEventListener('click', function () { goTab(b.getAttribute('data-v3tab')); });
        });
      }

      // (d) news panel: side column on desktop, hero on mobile (side is hidden there)
      var news = document.createElement('div');
      news.className = 'ov3-news';
      news.innerHTML = '<h3>📡 Transmissions</h3>' + NEWS.map(function (x) {
        return '<div class="ni"><div class="dt">' + x.dt + '</div><div class="tt">' + x.tt + '</div><div class="ds">' + x.ds + '</div></div>';
      }).join('');
      var isMobile = false;
      try { isMobile = matchMedia('(max-width: 900px)').matches; } catch (e) {}
      if (side && !isMobile) {
        side.insertBefore(news, side.firstChild);
      } else if (hero) {
        hero.appendChild(news);
      }
    } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- 4. Watch for the menu + home renders ----
  function watch() {
    try {
      bgInit();
      injectHome();
      var body = $('#mBody');
      if (!body) return false;
      var bo = new MutationObserver(function () {
        try {
          var h = $('.cs-home');
          if (h) { delete h.dataset.v3done; injectHome(); }
        } catch (e) {}
      });
      bo.observe(body, { childList: true });
      return true;
    } catch (e) { return true; }
  }
  if (!watch()) {
    try {
      var mo = new MutationObserver(function () { if (watch()) mo.disconnect(); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 30000);
    } catch (e) {}
  }
})();
