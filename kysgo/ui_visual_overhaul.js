// UI visual overhaul — runtime companion for ui_visual_overhaul.css.
//
// The game's base CSS is injected at runtime as <style id="cs-css"> (see
// ui.js injectCss()). This module makes sure our overhaul stylesheet always
// sits AFTER it in <head>, so our rules win equal-specificity ties.
// It also adds JS-driven polish: click ripples and staggered page entrances.
// Everything is defensive: if anything is missing, it silently no-ops.
(function () {
  'use strict';
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ---- 1. Cascade order: keep #cs-overhaul after #cs-css ----
  function ensureOrder() {
    try {
      var link = document.getElementById('cs-overhaul');
      var base = document.getElementById('cs-css');
      if (!link) return true;                       // stylesheet link missing: nothing to order
      if (base && (link.compareDocumentPosition(base) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        base.after(link);                           // base follows link -> move link after base
      }
      return !!base;                                // true once base exists
    } catch (e) { return true; }
  }
  if (!ensureOrder()) {
    try {
      var mo = new MutationObserver(function () { if (ensureOrder()) mo.disconnect(); });
      mo.observe(document.head || document.documentElement, { childList: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 15000);  // don't watch forever
    } catch (e) {}
  }

  if (reduceMotion) return;   // visual flair off; the CSS paint still applies

  // ---- 2. Click ripple on menu buttons, tiles, cases, maps ----
  document.addEventListener('pointerdown', function (e) {
    try {
      var t = e.target && e.target.closest
        ? e.target.closest('.cs-menu .cs-btn, .cs-menu .cs-go, .cs-menu .cs-tile, .cs-menu .cs-case, .cs-menu .cs-map, .cs-modal .cs-btn')
        : null;
      if (!t || t.disabled) return;
      var r = t.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var d = Math.max(r.width, r.height) * 2.1;
      var s = document.createElement('span');
      s.className = 'ov-ripple';
      s.style.width = s.style.height = d + 'px';
      s.style.left = (e.clientX - r.left - d / 2) + 'px';
      s.style.top = (e.clientY - r.top - d / 2) + 'px';
      t.appendChild(s);
      setTimeout(function () { s.remove(); }, 600);
    } catch (err) {}
  }, { passive: true });

  // ---- 3. Staggered entrance: each tab render replays with a cascade ----
  function stagger(page) {
    try {
      var kids = page.children, n = Math.min(kids.length, 14);
      for (var i = 0; i < n; i++) {
        kids[i].style.animationDelay = Math.min(i * 40, 480) + 'ms';
      }
    } catch (e) {}
  }
  function watchBody() {
    try {
      var body = document.getElementById('mBody');
      if (!body) return false;
      var bo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].type === 'childList' && muts[i].addedNodes.length) { stagger(body); break; }
        }
      });
      bo.observe(body, { childList: true });
      stagger(body);   // first paint
      return true;
    } catch (e) { return true; }
  }
  if (!watchBody()) {
    try {
      var mo2 = new MutationObserver(function () { if (watchBody()) mo2.disconnect(); });
      mo2.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { try { mo2.disconnect(); } catch (e) {} }, 20000);
    } catch (e) {}
  }
})();
