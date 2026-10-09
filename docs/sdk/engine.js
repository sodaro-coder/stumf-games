// STUMF BrowserDev engine: the small shared core every game uses. Fixed-step loop (60 updates/s, render on rAF,
// paused when the tab is hidden), unified input (keyboard, mouse + pointer lock, touch sticks, gamepad), object pools,
// a spatial hash for AABB checks, procedural sound (WebAudio, no files), procedural textures (canvas, no images),
// adaptive resolution that keeps the frame rate up on weak machines, tiny HUD/menu helpers and local saves.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// seeded RNG (mulberry32): the same seed gives the same world on every player's machine
export function rng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  return r;
}

// ---- loop ----------------------------------------------------------------------------------------------------------
export function loop(update, render, hz = 60) {
  const step = 1 / hz; let acc = 0, last = performance.now(), running = true, raf = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;  // came back from a stall: don't spiral
    acc += dt;
    let n = 0;
    while (acc >= step && n < 5) { update(step); acc -= step; n++; }
    if (n === 5) acc = 0;
    render(acc / step, dt);
    input.endFrame();
  };
  document.addEventListener('visibilitychange', () => { last = performance.now(); acc = 0; });
  raf = requestAnimationFrame(frame);
  return { stop() { running = false; cancelAnimationFrame(raf); }, get running() { return running; } };
}

// ---- input ---------------------------------------------------------------------------------------------------------
export const input = (() => {
  const down = new Set(), pressed = new Set(), mouse = { dx: 0, dy: 0, b: [false, false, false], wheel: 0, locked: false };
  const touch = { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, buttons: new Set(), active: false };
  let pad = null;
  addEventListener('keydown', (e) => { if (e.repeat) return; down.add(e.code); pressed.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault(); });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => { down.clear(); mouse.b = [false, false, false]; });
  addEventListener('mousemove', (e) => { if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
  addEventListener('mousedown', (e) => { mouse.b[e.button] = true; pressed.add('Mouse' + e.button); });
  addEventListener('mouseup', (e) => { mouse.b[e.button] = false; });
  addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { mouse.locked = !!document.pointerLockElement; });
  const api = {
    down: (c) => down.has(c), pressed: (c) => pressed.has(c), mouse, touch,
    lock(el) { if (!matchMedia('(pointer: coarse)').matches) el.requestPointerLock?.(); },
    // movement vector from WASD / arrows / left stick / touch stick
    move() {
      let x = (down.has('KeyD') || down.has('ArrowRight') ? 1 : 0) - (down.has('KeyA') || down.has('ArrowLeft') ? 1 : 0);
      let y = (down.has('KeyW') || down.has('ArrowUp') ? 1 : 0) - (down.has('KeyS') || down.has('ArrowDown') ? 1 : 0);
      if (pad) { if (Math.abs(pad.axes[0]) > 0.15) x = pad.axes[0]; if (Math.abs(pad.axes[1]) > 0.15) y = -pad.axes[1]; }
      if (touch.active && (touch.move.x || touch.move.y)) { x = touch.move.x; y = touch.move.y; }
      const l = Math.hypot(x, y); return l > 1 ? { x: x / l, y: y / l } : { x, y };
    },
    look() {
      let dx = mouse.dx, dy = mouse.dy;
      if (pad) { if (Math.abs(pad.axes[2]) > 0.12) dx += pad.axes[2] * 12; if (Math.abs(pad.axes[3]) > 0.12) dy += pad.axes[3] * 12; }
      dx += touch.look.dx; dy += touch.look.dy;
      return { dx, dy };
    },
    button(name) {  // logical buttons shared by every game: fire, aim, jump, use, alt, reload, menu
      const map = { fire: () => mouse.b[0] || padB(7) || touch.buttons.has('fire'), aim: () => mouse.b[2] || padB(6) || touch.buttons.has('aim'),
        jump: () => down.has('Space') || padB(0) || touch.buttons.has('jump'), use: () => down.has('KeyF') || down.has('KeyE') || padB(3) || touch.buttons.has('use'),
        alt: () => down.has('ShiftLeft') || padB(10) || touch.buttons.has('alt'), reload: () => down.has('KeyR') || padB(2) || touch.buttons.has('reload'),
        menu: () => down.has('Escape') || padB(9) };
      return !!(map[name] && map[name]());
    },
    tapped(name) {  // edge-triggered version of button()
      const k = { jump: 'Space', use: 'KeyF', reload: 'KeyR', fire: 'Mouse0', alt: 'KeyQ' }[name];
      return (k && pressed.has(k)) || (name === 'use' && pressed.has('KeyE')) || padEdge(name) || touch.tapped.has(name);
    },
    endFrame() {
      pressed.clear(); mouse.dx = mouse.dy = 0; mouse.wheel = 0; touch.look.dx = touch.look.dy = 0; touch.tapped.clear();
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      const prev = pad ? pad.buttons.map((b) => b.pressed) : [];
      pad = pads[0] || null;
      padPrev = prev;
    },
  };
  let padPrev = [];
  const padB = (i) => !!(pad && pad.buttons[i] && pad.buttons[i].pressed);
  const padEdge = (name) => { const i = { jump: 0, use: 3, reload: 2, fire: 7, alt: 1 }[name]; return i !== undefined && padB(i) && !padPrev[i]; };
  touch.tapped = new Set();
  return api;
})();

// on-screen controls for phones and tablets: left stick moves, right side drags to look, buttons for actions
export function touchControls(buttons = ['fire', 'jump', 'use']) {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const t = input.touch; t.active = true;
  const css = document.createElement('style');
  css.textContent = `.bd-stick{position:fixed;left:18px;bottom:18px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.25);touch-action:none;z-index:50}
  .bd-knob{position:absolute;left:40px;top:40px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.35)}
  .bd-btns{position:fixed;right:14px;bottom:14px;display:grid;grid-template-columns:repeat(2,64px);gap:10px;z-index:50}
  .bd-btn{width:64px;height:64px;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:rgba(0,0,0,.35);color:#fff;font:700 12px system-ui;touch-action:none}
  .bd-look{position:fixed;right:0;top:0;width:55%;height:70%;z-index:40;touch-action:none}`;
  document.head.appendChild(css);
  const stick = document.createElement('div'); stick.className = 'bd-stick'; stick.innerHTML = '<div class="bd-knob"></div>'; document.body.appendChild(stick);
  const knob = stick.firstChild;
  let sid = null, cx = 0, cy = 0;
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(sid); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId !== sid) return; let x = (e.clientX - cx) / 50, y = (e.clientY - cy) / 50; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } t.move.x = x; t.move.y = -y; knob.style.transform = `translate(${x * 40}px,${y * 40}px)`; });
  const end = () => { sid = null; t.move.x = t.move.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  const look = document.createElement('div'); look.className = 'bd-look'; document.body.appendChild(look);
  let lid = null, lx = 0, ly = 0;
  look.addEventListener('pointerdown', (e) => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; look.setPointerCapture(lid); });
  look.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; t.look.dx += (e.clientX - lx) * 1.4; t.look.dy += (e.clientY - ly) * 1.4; lx = e.clientX; ly = e.clientY; });
  look.addEventListener('pointerup', () => { lid = null; });
  const box = document.createElement('div'); box.className = 'bd-btns'; document.body.appendChild(box);
  for (const b of buttons) {
    const el = document.createElement('button'); el.className = 'bd-btn'; el.textContent = b.toUpperCase();
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); t.buttons.add(b); t.tapped.add(b); });
    el.addEventListener('pointerup', () => t.buttons.delete(b)); el.addEventListener('pointerleave', () => t.buttons.delete(b));
    box.appendChild(el);
  }
}

// ---- pools & collision -------------------------------------------------------------------------------------------
export class Pool {  // reuse objects instead of allocating (no garbage-collector hitches)
  constructor(make, size = 32) { this.make = make; this.free = []; this.live = []; for (let i = 0; i < size; i++) this.free.push(make()); }
  get() { const o = this.free.pop() || this.make(); o.alive = true; this.live.push(o); return o; }
  release(o) { o.alive = false; }
  sweep(onDead) { let w = 0; for (const o of this.live) { if (o.alive) this.live[w++] = o; else { onDead && onDead(o); this.free.push(o); } } this.live.length = w; }
  each(fn) { for (const o of this.live) if (o.alive) fn(o); }
}

export const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Grid {  // spatial hash: "what's near this box?" without checking everything
  constructor(cell = 64) { this.cell = cell; this.map = new Map(); }
  key(x, y) { return ((x | 0) * 73856093) ^ ((y | 0) * 19349663); }
  clear() { this.map.clear(); }
  insert(o) {
    const c = this.cell, x0 = Math.floor(o.x / c), y0 = Math.floor(o.y / c), x1 = Math.floor((o.x + o.w) / c), y1 = Math.floor((o.y + o.h) / c);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = this.key(x, y); let b = this.map.get(k); if (!b) this.map.set(k, (b = [])); b.push(o); }
  }
  query(box, out = []) {
    out.length = 0; const c = this.cell, seen = new Set();
    for (let x = Math.floor(box.x / c); x <= Math.floor((box.x + box.w) / c); x++)
      for (let y = Math.floor(box.y / c); y <= Math.floor((box.y + box.h) / c); y++) {
        const b = this.map.get(this.key(x, y)); if (b) for (const o of b) if (!seen.has(o) && aabb(o, box)) { seen.add(o); out.push(o); }
      }
    return out;
  }
}

// ---- sound: every effect is synthesised (no audio files to download) ------------------------------------------------
export const sfx = (() => {
  let ctx = null, master = null, muted = false;
  const ensure = () => { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination); } if (ctx.state === 'suspended') ctx.resume(); return ctx; };
  addEventListener('pointerdown', ensure, { once: true }); addEventListener('keydown', ensure, { once: true });
  const noise = (dur) => { const c = ensure(), b = c.createBuffer(1, Math.max(1, c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; };
  const env = (node, t0, a, d, peak = 1) => { const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.001, t0 + a + d); node.connect(g); g.connect(master); return g; };
  const tone = (type, f0, f1, dur, vol = 0.6) => { const c = ensure(), o = c.createOscillator(), t = c.currentTime; o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); env(o, t, 0.005, dur, vol); o.start(t); o.stop(t + dur + 0.05); };
  const burst = (dur, freq, vol = 0.8, q = 1) => { const c = ensure(), s = noise(dur), f = c.createBiquadFilter(), t = c.currentTime; f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q; s.connect(f); env(f, t, 0.002, dur, vol); s.start(t); };
  const fx = {
    shot: () => { burst(0.12, 2400, 0.9); tone('square', 220, 60, 0.08, 0.3); },
    heavy: () => { burst(0.25, 900, 1); tone('sawtooth', 120, 40, 0.2, 0.4); },
    hit: () => tone('square', 900, 400, 0.05, 0.25),
    pickup: () => { tone('sine', 660, 990, 0.08, 0.35); setTimeout(() => tone('sine', 990, 1320, 0.08, 0.3), 70); },
    break: () => burst(0.18, 1400, 0.7, 4),
    place: () => tone('triangle', 300, 200, 0.06, 0.4),
    explode: () => { burst(0.8, 500, 1.2); tone('sine', 90, 30, 0.6, 0.6); },
    jump: () => tone('sine', 300, 600, 0.12, 0.25),
    hurt: () => tone('sawtooth', 300, 120, 0.2, 0.35),
    siren: () => { tone('sine', 700, 1000, 0.35, 0.18); setTimeout(() => tone('sine', 1000, 700, 0.35, 0.18), 350); },
    click: () => tone('square', 1200, 1200, 0.02, 0.2),
  };
  return { play(name) { if (muted) return; try { (fx[name] || fx.click)(); } catch (e) { /* audio not ready yet */ } }, mute(on) { muted = on; } };
})();

// ---- procedural textures ------------------------------------------------------------------------------------------
export const tex = {
  canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; },
  // a 16x16 "pixel art" tile: base colour, per-pixel noise, optional pattern (bricks, planks, windows, grass, stripes)
  pixel(base, opts = {}) {
    const r = rng(opts.seed || 1), [R, G, B] = base, n = opts.noise ?? 18, s = opts.size || 16;
    return tex.canvas(s, s, (g) => {
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        let k = (r() - 0.5) * n;
        const p = opts.pattern;
        if (p === 'bricks' && (y % 4 === 0 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0)) k -= 35;
        if (p === 'planks' && y % 4 === 0) k -= 30;
        if (p === 'windows' && x % 8 > 1 && x % 8 < 6 && y % 8 > 1 && y % 8 < 6) { g.fillStyle = r() < (opts.lit ?? 0.3) ? '#ffe9a8' : '#2a3a4a'; g.fillRect(x, y, 1, 1); continue; }
        if (p === 'stripes' && x >= s / 2 - 1 && x <= s / 2 && y % 8 < 4) { g.fillStyle = opts.stripe || '#e8d44a'; g.fillRect(x, y, 1, 1); continue; }
        if (p === 'grass' && y < 3 + (r() * 2 | 0)) k += 25;
        g.fillStyle = `rgb(${clamp(R + k, 0, 255) | 0},${clamp(G + k, 0, 255) | 0},${clamp(B + k, 0, 255) | 0})`; g.fillRect(x, y, 1, 1);
      }
    });
  },
};

// ---- adaptive quality: drop render resolution when frames are slow, raise it back when there's headroom ------------
export function qualityGovernor(setScale, opts = {}) {
  let scale = opts.start || Math.min(1, devicePixelRatio || 1), avg = 16, t = 0;
  const min = opts.min || 0.45, max = opts.max || Math.min(1.5, devicePixelRatio || 1), target = opts.targetMs || 17.5;
  setScale(scale);
  return (dt) => {
    avg = avg * 0.95 + dt * 1000 * 0.05; t += dt;
    // resizing reallocates the frame buffers (a visible hitch), so it waits for a clear, lasting trend and moves in
    // bigger, rarer steps instead of nudging every 1.5 s
    if (t < 4) return; t = 0;
    if (avg > target * 1.25 && scale > min) { scale = Math.max(min, scale - 0.15); setScale(scale); }
    else if (avg < target * 0.6 && scale < max) { scale = Math.min(max, scale + 0.1); setScale(scale); }
  };
}

// ---- HUD / menus / saves ------------------------------------------------------------------------------------------
export function el(html, parent = document.body) { const t = document.createElement('template'); t.innerHTML = html.trim(); const n = t.content.firstChild; parent.appendChild(n); return n; }
export const save = {
  get(k, d) { try { const v = localStorage.getItem('bd:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('bd:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};
export function fpsMeter() {
  const box = el('<div style="position:fixed;left:6px;top:6px;font:11px monospace;color:#9fe;opacity:.6;z-index:60;pointer-events:none"></div>');
  let n = 0, t = 0;
  return (dt) => { n++; t += dt; if (t >= 1) { box.textContent = n + ' fps'; n = 0; t = 0; } };
}
