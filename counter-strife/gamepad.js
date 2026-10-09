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
const DEAD = 0.16;
// radial deadzone, rescaled so the stick still reaches 1 at the edge
function stick(x, y) {
  const m = Math.hypot(x, y); if (m < DEAD) return [0, 0];
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m; return [x * k, y * k];
}
export const isConsole = () => /Xbox|PlayStation|Nintendo|SMART-TV|SmartTV|Tizen|Web0S|webOS|CrKey|AFT[A-Z]|Valve Steam/i.test(navigator.userAgent || '');

let inst = null;
// one controller for the whole page: calling again (menu -> match -> menu) just swaps what it drives
export function gamepadControls(input, opt = {}) {
  if (inst) { inst.setOpt(opt); return inst; }
  const t = input.touch;
  if (!t.tapped) t.tapped = new Set();
  try { if ('gamepadInputEmulation' in navigator) navigator.gamepadInputEmulation = 'gamepad'; } catch (e) { /* Xbox Edge only: stop the pad driving a mouse cursor */ }
  let prev = [], active = false, focusEl = null, navT = 0, lastUse = 0, raf = 0, aimHeld = false;
  const css = document.createElement('style');
  css.textContent = `.kc-pad-focus{outline:3px solid #f2a33a!important;outline-offset:3px;box-shadow:0 0 0 6px #f2a33a33!important;border-radius:8px}
  body.kc-tv .cs{font-size:118%}body.kc-tv .cs-btn{min-height:44px;padding:10px 18px}body.kc-tv .cs-tile{transform-origin:center}`;
  document.head.appendChild(css);
  if (isConsole()) document.body.classList.add('kc-tv');   // 10-foot UI: bigger type and targets on a TV
  const pads = () => { try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch (e) { return []; } };
  const pressed = (p, i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));

  // ---- menus: spatial focus between visible, clickable things ----
  const SEL = 'button:not([disabled]), [data-uid], [data-tab], [data-see], [data-claim], .cs-tile, .cs-case, input, select, a[href], [data-x]';
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && getComputedStyle(el).visibility !== 'hidden'; };
  const candidates = () => { const modal = Array.from(document.querySelectorAll('.cs-modal')).pop(); return Array.from((modal || document).querySelectorAll(SEL)).filter(visible); };
  const setFocus = (el) => { if (focusEl) focusEl.classList.remove('kc-pad-focus'); focusEl = el; if (el) { el.classList.add('kc-pad-focus'); try { el.focus({ preventScroll: true }); } catch (e) { /* not focusable */ } el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } };
  const move = (dx, dy) => {
    const all = candidates(); if (!all.length) return;
    if (!focusEl || !all.includes(focusEl)) return setFocus(all[0]);
    const a = focusEl.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = Infinity;
    for (const el of all) {
      if (el === focusEl) continue;
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2 - ax, y = r.top + r.height / 2 - ay;
      const along = x * dx + y * dy; if (along <= 4) continue;            // must lie in the pushed direction
      const across = Math.abs(x * dy - y * dx), score = along + across * 2.5;
      if (score < bs) { bs = score; best = el; }
    }
    if (best) setFocus(best);
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
      const [mx, my] = stick(p.axes[0] || 0, p.axes[1] || 0); t.move.x = mx; t.move.y = -my;
      // look: a response curve (fine aim near the centre, fast turns at the edge), scaled by the touch sensitivity
      const [lx, ly] = stick(p.axes[2] || 0, p.axes[3] || 0), sens = (opt.sens ? opt.sens() : 1) * 1050 * dt;
      const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.7);
      t.look.dx += curve(lx) * sens; t.look.dy += curve(ly) * sens * 0.8;
      for (const [i, n] of Object.entries(HOLD)) { if (b[i]) t.buttons.add(n); else if (prev[i]) t.buttons.delete(n); }
      for (const [i, n] of Object.entries(TAP)) if (edge(+i)) t.tapped.add(n);
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
      if ((dx || dy) && (dpadEdge || navT <= 0)) { move(dx, dy); navT = dpadEdge ? 0.35 : 0.18; }
      if (edge(B.A)) { if (!focusEl || !document.contains(focusEl)) move(0, 1); else focusEl.click(); }
      if (edge(B.B)) back();
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
  };
  return inst;
}
