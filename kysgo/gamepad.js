// Controllers: Xbox / PlayStation / Switch pads and console browsers (Xbox Edge, PlayStation, Steam Deck, smart TVs).
// In a match the pad writes into the same touch input the phone controls use (move stick, look, held buttons, taps),
// so every action the game knows works from a controller without special cases. Out of a match (menus, inventory,
// modals) the left stick / d-pad moves a focus ring between buttons and tiles, A clicks, B goes back.
// Layout (standard mapping):
//   left stick move · right stick look (curved, deadzone) · RT fire · LT aim (hold) · A jump · B crouch (hold)
//   X reload · Y swap weapon · LB grenade · RB use / plant / defuse (hold) · L3 sprint · R3 inspect
//   d-pad up buy · d-pad down prone · d-pad left / right lean · View/Back scoreboard (hold) · Start/Menu pause
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const HOLD = { [B.RT]: 'fire', [B.A]: 'jump', [B.B]: 'crouch', [B.RB]: 'use', [B.L3]: 'sprint', [B.BACK]: 'score' };
const TAP = { [B.X]: 'reload', [B.Y]: 'swap', [B.LB]: 'nade', [B.R3]: 'inspect', [B.UP]: 'buy', [B.DOWN]: 'prone', [B.LEFT]: 'leanL', [B.RIGHT]: 'leanR', [B.START]: 'menu' };
// button layouts (Settings → Controller): each one moves a few actions; 'southpaw' also swaps the sticks
const swapIn = (m, a, b) => { const o = { ...m }; const va = o[a], vb = o[b]; delete o[a]; delete o[b]; if (vb) o[a] = vb; if (va) o[b] = va; return o; };
export const PAD_LAYOUTS = {
  default: { name: 'Default', hold: HOLD, tap: TAP, help: 'A jump · B crouch · X reload · Y swap · LB grenade · RB use · L3 sprint · R3 inspect' },
  bumper: { name: 'Bumper jumper', hold: { ...swapIn(HOLD, B.A, B.LB), [B.LB]: 'jump' }, tap: { ...swapIn(TAP, B.LB, B.A), [B.A]: 'nade' }, help: 'LB jump (thumbs stay on the sticks) · A grenade' },
  tactical: { name: 'Tactical', hold: { ...swapIn(HOLD, B.B, B.R3), [B.R3]: 'crouch' }, tap: { ...swapIn(TAP, B.R3, B.B), [B.B]: 'inspect' }, help: 'R3 crouch (crouch-shoot without letting go of the right stick) · B inspect' },
  southpaw: { name: 'Southpaw', hold: HOLD, tap: TAP, swap: true, help: 'Left stick looks, right stick moves' },
};
// radial deadzone, rescaled so the stick still reaches 1 at the edge
function stick(x, y, dead = 0.16) {
  const m = Math.hypot(x, y); if (m < dead) return [0, 0];
  const k = Math.min(1, (m - dead) / (1 - dead)) / m; return [x * k, y * k];
}
export const isConsole = () => /Xbox|PlayStation|Nintendo|SMART-TV|SmartTV|Tizen|Web0S|webOS|CrKey|AFT[A-Z]|Valve Steam/i.test(navigator.userAgent || '');

let inst = null;
// one controller for the whole page: calling again (menu -> match -> menu) just swaps what it drives
export function gamepadControls(input, opt = {}) {
  if (inst) { inst.setOpt(opt); return inst; }
  const t = input.touch;
  if (!t.tapped) t.tapped = new Set();
  try { if ('gamepadInputEmulation' in navigator) navigator.gamepadInputEmulation = 'gamepad'; } catch (e) { /* Xbox Edge only: stop the pad driving a mouse cursor */ }
  let prev = [], active = false, focusEl = null, navT = 0, lastUse = 0, raf = 0, aimHeld = false, refocusT = 0;
  const lastPos = { x: 0, y: 0 };
  let cur = null;   // the map editor's controller cursor
  const ptr = (type) => { try { cur.el.dispatchEvent(new PointerEvent(type, { clientX: cur.x, clientY: cur.y, pointerId: 7, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 })); } catch (e) { /* old browser */ } };
  const css = document.createElement('style');
  css.textContent = `.kc-pad-focus{outline:3px solid #f2a33a!important;outline-offset:3px;box-shadow:0 0 0 6px #f2a33a33!important;border-radius:8px}
  body.kc-tv .cs{font-size:118%}body.kc-tv .cs-btn{min-height:44px;padding:10px 18px}body.kc-tv .cs-tile{transform-origin:center}
  html.kc-tvsafe{background:#000}html.kc-tvsafe body{width:100vw;height:100vh;transform:scale(.9);transform-origin:50% 50%;overflow:hidden}
  .kc-osk{z-index:400}.kc-osk .kc-oskbox{background:#171c23;border:1px solid #343d4b;border-radius:12px;padding:16px;width:min(900px,92vw)}
  .kc-osk .kc-oskval{font:600 26px/1.3 system-ui,sans-serif;color:#fff;background:#0d1015;border:1px solid #343d4b;border-radius:8px;padding:10px 14px;min-height:40px;margin-bottom:12px;word-break:break-all}
  .kc-osk .kc-oskrow{display:flex;gap:8px;margin-top:8px;justify-content:center}.kc-osk button{min-width:58px;min-height:52px;font:600 20px system-ui,sans-serif;border-radius:8px;border:1px solid #343d4b;background:#202631;color:#fff}
  .kc-osk button.wide{min-width:140px}.kc-osk .kc-oskhelp{margin-top:12px;color:#9aa4b2;font:15px system-ui,sans-serif;text-align:center}`;
  document.head.appendChild(css);
  // 10-foot UI on a console or TV: bigger type and targets, and everything kept inside the middle 90% of the screen
  // (TV-safe area: some TVs crop the edges). The body is scaled, so every fixed menu, HUD and the game view move in.
  if (isConsole()) { document.body.classList.add('kc-tv'); document.documentElement.classList.add('kc-tvsafe'); }
  const pads = () => { try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch (e) { return []; } };
  const pressed = (p, i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));

  // ---- menus: spatial focus between visible, clickable things ----
  const SEL = 'button:not([disabled]), [data-uid], [data-tab], [data-see], [data-claim], .cs-tile, .cs-case, input, select, a[href], [data-x], [data-padcanvas]';
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && getComputedStyle(el).visibility !== 'hidden'; };
  // anything else that is clickable (a map card, a gun card, the featured case: its cursor is a pointer) is reachable too,
  // taking the outermost clickable element so one card is one stop
  const pointer = (el) => { try { return getComputedStyle(el).cursor === 'pointer'; } catch (e) { return false; } };
  const candidates = () => {
    const root = Array.from(document.querySelectorAll('.cs-modal')).pop() || document, list = Array.from(root.querySelectorAll(SEL));
    for (const el of root.querySelectorAll('div, li, label, img, canvas, span, td, tr, article, section')) {
      if (!pointer(el) || el.closest(SEL) || el.querySelector(SEL) || (el.parentElement && pointer(el.parentElement))) continue;
      list.push(el);
    }
    return list.filter(visible);
  };
  const setFocus = (el) => { if (focusEl) focusEl.classList.remove('kc-pad-focus'); focusEl = el; if (el) { el.classList.add('kc-pad-focus'); try { el.focus({ preventScroll: true }); } catch (e) { /* not focusable */ } el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } };
  const move = (dx, dy) => {
    const all = candidates(); if (!all.length) return;
    if (!focusEl || !all.includes(focusEl)) return setFocus(all[0]);
    const a = focusEl.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    // nearest in the pushed direction, preferring things inside a 45-degree cone (the box beside you, not the one
    // diagonally above it); edges count too, so a wide box next to a narrow button is "beside" it
    let best = null, bs = Infinity, coneBest = null, cs = Infinity;
    for (const el of all) {
      if (el === focusEl) continue;
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2 - ax, y = r.top + r.height / 2 - ay;
      const along = x * dx + y * dy; if (along <= 4) continue;            // must lie in the pushed direction
      const gapX = Math.max(0, r.left - a.right, a.left - r.right), gapY = Math.max(0, r.top - a.bottom, a.top - r.bottom);
      const across = dx ? gapY : gapX, near = dx ? gapX : gapY, score = along + across * 2.5;
      if (score < bs) { bs = score; best = el; }
      if (across <= near + 8) { const s2 = near + across * 3; if (s2 < cs) { cs = s2; coneBest = el; } }
    }
    best = coneBest || best;
    if (best) setFocus(best);
  };
  // ---- an on-screen keyboard for typing with a controller (names, codes, searches) ----
  // A on a text box opens it: the d-pad / stick moves over the keys, A types, X deletes, Y adds a space, Start (or Done)
  // keeps the text, B cancels. The text goes into the box with the usual input/change events, so every form works.
  let osk = null;
  const OSK_ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL-', 'ZXCVBNM_.@'];
  function oskOpen(inp) {
    const num = inp.type === 'number' || inp.inputMode === 'numeric', max = inp.maxLength > 0 ? inp.maxLength : 64;
    let val = String(inp.value || ''), lower = false;
    const wrap = document.createElement('div'); wrap.className = 'cs-modal kc-osk';
    const box = document.createElement('div'); box.className = 'kc-oskbox'; wrap.appendChild(box);
    const show = document.createElement('div'); show.className = 'kc-oskval'; box.appendChild(show);
    const paint = () => { show.textContent = (inp.type === 'password' ? '•'.repeat(val.length) : val) || (inp.placeholder || ' '); };
    const key = (label, fn, wide) => { const b = document.createElement('button'); b.textContent = label; if (wide) b.className = 'wide'; b.onclick = (e) => { e.stopPropagation(); fn(); paint(); }; return b; };
    const type = (ch) => { if (val.length < max) val += lower ? ch.toLowerCase() : ch; };
    for (const row of (num ? ['123', '456', '789', '0'] : OSK_ROWS)) { const r = document.createElement('div'); r.className = 'kc-oskrow'; for (const ch of row) r.appendChild(key(ch, () => type(ch))); box.appendChild(r); }
    const r = document.createElement('div'); r.className = 'kc-oskrow';
    if (!num) { r.appendChild(key('Shift', () => { lower = !lower; }, true)); r.appendChild(key('Space', () => type(' '), true)); }
    r.appendChild(key('Delete', () => { val = val.slice(0, -1); }, true));
    const done = key('Done', () => oskClose(true), true); r.appendChild(done);
    const cancel = key('Cancel', () => oskClose(false), true); cancel.setAttribute('data-x', ''); r.appendChild(cancel);
    box.appendChild(r);
    const help = document.createElement('div'); help.className = 'kc-oskhelp'; help.textContent = 'A type · X delete · Y space · Start done · B cancel'; box.appendChild(help);
    document.body.appendChild(wrap); osk = { wrap, inp, done: () => oskClose(true), del: () => { val = val.slice(0, -1); paint(); }, space: () => { if (!num) { type(' '); paint(); } }, get val() { return val; } };
    function oskClose(keep) {
      if (keep) { inp.value = val; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
      wrap.remove(); osk = null; setFocus(inp);
    }
    paint(); setFocus(box.querySelector('button'));
  }
  const TEXT = /^(text|search|email|password|number|tel|url|)$/;
  const isText = (el) => (el.tagName === 'INPUT' && TEXT.test(el.type || '')) || el.tagName === 'TEXTAREA';
  const nudge = (el, dir) => {   // a <select> steps through its options, a slider moves one step
    if (el.tagName === 'SELECT') { const n = el.options.length; if (!n) return; el.selectedIndex = (el.selectedIndex + dir + n) % n; }
    else { const st = +el.step || 1, v = Math.max(+el.min || 0, Math.min(el.max === '' ? Infinity : +el.max, (+el.value || 0) + st * dir)); el.value = String(v); }
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const back = () => { const x = document.querySelector('.cs-modal [data-x]'); if (x) x.click(); else dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })); };

  function poll() {
    raf = requestAnimationFrame(poll);
    const ps = pads(); if (!ps.length) { if (active) { active = false; t.move.x = t.move.y = 0; } return; }
    const p = ps[0], now = performance.now(), dt = Math.min(0.05, (now - (poll.last || now)) / 1000); poll.last = now;
    const b = p.buttons.map((_, i) => pressed(p, i)), edge = (i) => b[i] && !prev[i];
    const anyInput = b.some(Boolean) || p.axes.some((v) => Math.abs(v) > 0.3);
    if (anyInput) { lastUse = now; if (!active) { active = true; opt.onActive && opt.onActive(); } }
    const inGame = opt.playing ? opt.playing() : false;
    if (inGame) {
      if (focusEl) setFocus(null);
      t.active = true;
      const L = PAD_LAYOUTS[opt.layout ? opt.layout() : 'default'] || PAD_LAYOUTS.default, dz = opt.dead ? opt.dead() : 0.16;
      const ax = L.swap ? [2, 3, 0, 1] : [0, 1, 2, 3];
      const [mx, my] = stick(p.axes[ax[0]] || 0, p.axes[ax[1]] || 0, dz); t.move.x = mx; t.move.y = -my;
      // look: a response curve (fine aim near the centre, fast turns at the edge), scaled by the touch sensitivity
      const [lx, ly] = stick(p.axes[ax[2]] || 0, p.axes[ax[3]] || 0, dz), sens = (opt.sens ? opt.sens() : 1) * 1050 * dt;
      const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.7);
      t.look.dx += curve(lx) * sens; t.look.dy += curve(ly) * sens * 0.8 * (opt.invert && opt.invert() ? -1 : 1);
      for (const [i, n] of Object.entries(L.hold)) { if (b[i]) t.buttons.add(n); else if (prev[i]) t.buttons.delete(n); }
      for (const [i, n] of Object.entries(L.tap)) if (edge(+i)) t.tapped.add(n);
      // aim down sights while LT is held (the game's aim is a toggle: tap on press and on release)
      const lt = b[B.LT] || (p.buttons[B.LT] && p.buttons[B.LT].value > 0.35);
      if (lt !== aimHeld) { aimHeld = lt; t.tapped.add('alt'); }
      if (edge(B.START)) t.tapped.add('menu');
    } else {
      if (active) { t.buttons.clear(); t.move.x = t.move.y = 0; aimHeld = false; }
      navT -= dt;
      const [mx, my] = stick(p.axes[0] || 0, p.axes[1] || 0);
      let dx = (b[B.RIGHT] ? 1 : 0) - (b[B.LEFT] ? 1 : 0), dy = (b[B.DOWN] ? 1 : 0) - (b[B.UP] ? 1 : 0);
      if (!dx && !dy && Math.hypot(mx, my) > 0.5) { if (Math.abs(mx) > Math.abs(my)) dx = Math.sign(mx); else dy = Math.sign(my); }
      const dpadEdge = edge(B.UP) || edge(B.DOWN) || edge(B.LEFT) || edge(B.RIGHT);
      // drawing on a canvas (the map editor): A on it gives a cursor that the stick / d-pad moves; hold A to drag
      // (draw a wall, a ramp, a site), B hands the stick back to the menu
      if (cur) {
        const sp = 520 * dt, r = cur.el.getBoundingClientRect();
        let cx = mx, cy = my; if (b[B.LEFT]) cx = -0.6; if (b[B.RIGHT]) cx = 0.6; if (b[B.UP]) cy = -0.6; if (b[B.DOWN]) cy = 0.6;
        if (cx || cy) { cur.x = Math.max(r.left, Math.min(r.right - 1, cur.x + cx * sp)); cur.y = Math.max(r.top, Math.min(r.bottom - 1, cur.y + cy * sp)); ptr('pointermove'); }
        if (edge(B.A)) ptr('pointerdown'); else if (!b[B.A] && prev[B.A]) ptr('pointerup');
        cur.dot.style.left = cur.x - 9 + 'px'; cur.dot.style.top = cur.y - 9 + 'px';
        if (edge(B.B) || !document.contains(cur.el)) { cur.dot.remove(); cur = null; }
        prev = b; return;
      }
      const slider = focusEl && focusEl.tagName === 'INPUT' && focusEl.type === 'range';
      if ((dx || dy) && (dpadEdge || navT <= 0)) { if (slider && dx && !dy) nudge(focusEl, dx); else move(dx, dy); navT = dpadEdge ? 0.35 : 0.18; }   // a slider takes left / right
      if (osk) { if (edge(B.X)) osk.del(); if (edge(B.Y)) osk.space(); if (edge(B.START)) osk.done(); }
      if (edge(B.A)) {
        if (!focusEl || !document.contains(focusEl)) move(0, 1);
        else if (isText(focusEl)) oskOpen(focusEl);
        else if (focusEl.hasAttribute('data-padcanvas')) { const r = focusEl.getBoundingClientRect(), dot = document.createElement('div'); dot.style.cssText = 'position:fixed;width:18px;height:18px;border:3px solid #f2a33a;border-radius:50%;z-index:500;pointer-events:none;box-shadow:0 0 0 2px #000'; document.documentElement.appendChild(dot); cur = { el: focusEl, x: r.left + r.width / 2, y: r.top + r.height / 2, dot }; }
        else if (focusEl.tagName === 'SELECT') nudge(focusEl, 1);   // A: the next choice (X: the one before)
        else focusEl.click();
      }
      if (!osk && edge(B.X) && focusEl && focusEl.tagName === 'SELECT') nudge(focusEl, -1);
      // the focus ring is always somewhere: after a click re-renders the page, or a menu opens, it lands on whatever is
      // now nearest to where it was (or the first thing on screen)
      if (active && (!focusEl || !document.contains(focusEl) || !visible(focusEl))) {
        refocusT -= dt;
        if (refocusT <= 0) { refocusT = 0.25; const all = candidates(); if (all.length) { let best = all[0], bd = Infinity; for (const el of all) { const r = el.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - lastPos.x, r.top + r.height / 2 - lastPos.y); if (d < bd) { bd = d; best = el; } } setFocus(best); } }
      }
      if (focusEl) { const r = focusEl.getBoundingClientRect(); if (r.width) { lastPos.x = r.left + r.width / 2; lastPos.y = r.top + r.height / 2; } }
      if (edge(B.B)) { if (osk) { const x = osk.wrap.querySelector('[data-x]'); if (x) x.click(); } else back(); }
      if (edge(B.LB) || edge(B.RB)) {   // shoulder buttons flip between the menu's tabs
        const tabs = Array.from(document.querySelectorAll('[data-tab]')).filter(visible), on = tabs.findIndex((x) => x.classList.contains('on'));
        const nx = tabs[(on + (edge(B.RB) ? 1 : -1) + tabs.length) % tabs.length]; if (nx) { nx.click(); setFocus(nx); }
      }
      // the right stick scrolls long pages
      const ry = stick(0, p.axes[3] || 0)[1]; if (ry) { const sc = document.querySelector('.cs-modal .cs-card') || document.scrollingElement; if (sc) sc.scrollBy(0, ry * 900 * dt); }
    }
    prev = b;
  }
  addEventListener('gamepadconnected', () => { if (!raf) poll(); opt.onConnect && opt.onConnect(); });
  if (pads().length) poll();
  inst = {
    get active() { return active && performance.now() - lastUse < 60000; },
    setOpt(o) { opt = o || {}; },
    get osk() { return !!osk; },
  };
  return inst;
}
