// Phone and tablet controls, laid out like the big mobile shooters: a floating stick wherever your left thumb lands,
// drag anywhere on the right to look, a big fire button you can also drag to aim while shooting, a second fire button
// on the left, and every action a PC player has a key for (aim, lean, crouch, jump, reload, grenade, swap, use, buy,
// scoreboard, menu). Writes into the engine's touch input, so the game reads phones and PCs the same way.
// Buttons: held ones go in touch.buttons while pressed; taps go in touch.tapped for one frame.
export function mobileControls(input) {
  const t = input.touch; t.active = true;
  const css = document.createElement('style');
  css.textContent = `.kc-t{position:fixed;inset:0;z-index:45;pointer-events:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .kc-t .zone{position:absolute;top:0;bottom:0;pointer-events:auto;touch-action:none}
  .kc-t .zl{left:0;width:42%;top:64px}.kc-t .zr{right:0;width:58%}
  .kc-t .stick{position:absolute;width:118px;height:118px;margin:-59px 0 0 -59px;border-radius:50%;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.22);display:none;pointer-events:none}
  .kc-t .stick.on{display:block}.kc-t .stick i{position:absolute;left:34px;top:34px;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.38)}
  .kc-t .stick.ghost{display:block;opacity:.45;left:calc(env(safe-area-inset-left,0px) + 92px);top:calc(100% - 92px)}
  .kc-t b{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;display:grid;place-items:center;background:rgba(10,12,16,.38);border:2px solid rgba(255,255,255,.28);
    color:#fff;font:800 11px system-ui,sans-serif;letter-spacing:.04em;text-shadow:0 1px 2px #000;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
  .kc-t b.dn{background:rgba(242,163,58,.45);border-color:#f2a33a}.kc-t b.tog{background:rgba(242,163,58,.3);border-color:#f2a33a}
  .kc-t b svg{width:52%;height:52%;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
  .kc-t b.fire{width:88px;height:88px;right:calc(env(safe-area-inset-right,0px) + 22px);bottom:58px;background:rgba(200,40,30,.42);border-color:rgba(255,120,100,.6)}
  .kc-t b.fire2{width:62px;height:62px;left:calc(env(safe-area-inset-left,0px) + 18px);top:38%;background:rgba(200,40,30,.36);border-color:rgba(255,120,100,.5)}
  .kc-t b.aim{width:62px;height:62px;right:calc(env(safe-area-inset-right,0px) + 122px);bottom:96px}
  .kc-t b.jump{width:52px;height:52px;right:calc(env(safe-area-inset-right,0px) + 30px);bottom:156px}
  .kc-t b.crouch{width:52px;height:52px;right:calc(env(safe-area-inset-right,0px) + 120px);bottom:26px}
  .kc-t b.reload{width:46px;height:46px;right:calc(env(safe-area-inset-right,0px) + 92px);bottom:170px}
  .kc-t b.leanL,.kc-t b.leanR{width:46px;height:46px;bottom:178px;display:none}.kc-t.aiming b.leanL,.kc-t.aiming b.leanR{display:grid}
  .kc-t b.leanL{right:calc(env(safe-area-inset-right,0px) + 200px)}.kc-t b.leanR{right:calc(env(safe-area-inset-right,0px) + 148px)}
  .kc-t .row{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:calc(env(safe-area-inset-right,0px) + 8px);display:flex;gap:6px;pointer-events:none}
  .kc-t .row b{position:static;width:40px;height:40px;border-radius:10px;font-size:9px}
  .kc-t .row2{position:absolute;right:calc(env(safe-area-inset-right,0px) + 196px);bottom:14px;display:grid;grid-template-columns:repeat(2,46px);gap:8px;pointer-events:none}
  .kc-t .row2 b{position:static;width:46px;height:46px;font-size:9px}
  @media (max-width:720px){.kc-t .row2{right:calc(env(safe-area-inset-right,0px) + 186px);grid-template-columns:repeat(2,40px)}.kc-t .row2 b{width:40px;height:40px}.kc-t b.aim{right:calc(env(safe-area-inset-right,0px) + 112px)}}
  @media (max-height:340px){.kc-t b.fire{width:76px;height:76px;bottom:44px}.kc-t b.jump{bottom:130px}.kc-t b.reload{bottom:142px}.kc-t b.aim{bottom:80px}.kc-t b.leanL,.kc-t b.leanR{bottom:148px}}`;
  document.head.appendChild(css);
  const root = document.createElement('div'); root.className = 'kc-t'; document.body.appendChild(root);
  const I = {   // tiny line icons
    aim: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>',
    jump: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>', crouch: '<svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    reload: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>', fire: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>',
    leanL: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', leanR: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  };
  const zl = document.createElement('div'); zl.className = 'zone zl'; root.appendChild(zl);
  const zr = document.createElement('div'); zr.className = 'zone zr'; root.appendChild(zr);
  const stick = document.createElement('div'); stick.className = 'stick ghost'; stick.innerHTML = '<i></i>'; root.appendChild(stick);
  const knob = stick.firstChild;
  // left thumb: the stick appears where you touch; push past the rim and it follows your thumb
  let sid = null, cx = 0, cy = 0;
  zl.addEventListener('pointerdown', (e) => { if (sid != null) return; sid = e.pointerId; cx = e.clientX; cy = e.clientY; stick.className = 'stick on'; stick.style.left = cx + 'px'; stick.style.top = cy + 'px'; try { zl.setPointerCapture(sid); } catch (x) { /* fine */ } e.preventDefault(); });
  zl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid) return;
    let x = (e.clientX - cx) / 46, y = (e.clientY - cy) / 46; const l = Math.hypot(x, y);
    if (l > 1.25) { cx += (x / l) * (l - 1.25) * 46; cy += (y / l) * (l - 1.25) * 46; stick.style.left = cx + 'px'; stick.style.top = cy + 'px'; }
    if (l > 1) { x /= l; y /= l; }
    t.move.x = Math.abs(x) < 0.12 ? 0 : x; t.move.y = Math.abs(y) < 0.12 ? 0 : -y; knob.style.transform = `translate(${x * 36}px,${y * 36}px)`;
  });
  const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; t.move.x = t.move.y = 0; knob.style.transform = ''; stick.className = 'stick ghost'; stick.style.left = stick.style.top = ''; };
  zl.addEventListener('pointerup', endStick); zl.addEventListener('pointercancel', endStick);
  // right thumb: look. Several fingers can look at once (each moves the view by its own drag)
  const looks = new Map(), sens = { k: 1 };
  const lookStart = (e) => looks.set(e.pointerId, [e.clientX, e.clientY]);
  const lookMove = (e) => { const p = looks.get(e.pointerId); if (!p) return; t.look.dx += (e.clientX - p[0]) * 1.25 * sens.k; t.look.dy += (e.clientY - p[1]) * 1.25 * sens.k; p[0] = e.clientX; p[1] = e.clientY; };
  const lookEnd = (e) => looks.delete(e.pointerId);
  zr.addEventListener('pointerdown', (e) => { lookStart(e); try { zr.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } e.preventDefault(); });
  zr.addEventListener('pointermove', lookMove); zr.addEventListener('pointerup', lookEnd); zr.addEventListener('pointercancel', lookEnd);
  // buttons. kind: 'hold' (pressed while down), 'tap' (one frame), 'toggle' (on/off). drag: also looks while held
  const btn = (parent, cls, name, label, kind = 'tap', drag = false) => {
    const el = document.createElement('b'); el.className = cls; el.innerHTML = I[label] || label; parent.appendChild(el);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      if (kind === 'toggle') { const on = !t.buttons.has(name); if (on) t.buttons.add(name); else t.buttons.delete(name); el.classList.toggle('tog', on); }
      else { el.classList.add('dn'); t.tapped.add(name); if (kind === 'hold') t.buttons.add(name); }
      if (drag) lookStart(e);
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { /* fine */ }
    });
    if (drag) el.addEventListener('pointermove', lookMove);
    const up = (e) => { el.classList.remove('dn'); if (kind === 'hold') t.buttons.delete(name); if (drag) lookEnd(e); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    return el;
  };
  btn(root, 'fire', 'fire', 'fire', 'hold', true);
  btn(root, 'fire2', 'fire', 'fire', 'hold', false);
  btn(root, 'aim', 'alt', 'aim', 'tap', true);
  btn(root, 'jump', 'jump', 'jump', 'hold');
  const crouchB = btn(root, 'crouch', 'crouch', 'crouch', 'toggle');
  btn(root, 'reload', 'reload', 'reload');
  btn(root, 'leanL', 'leanL', 'leanL'); btn(root, 'leanR', 'leanR', 'leanR');
  const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
  btn(row, '', 'buy', 'BUY'); btn(row, '', 'score', 'TAB', 'hold'); btn(row, '', 'menu', '❚❚');
  const row2 = document.createElement('div'); row2.className = 'row2'; root.appendChild(row2);
  btn(row2, '', 'swap', 'SWAP'); btn(row2, '', 'nade', 'NADE'); btn(row2, '', 'use', 'USE', 'hold'); btn(row2, '', 'inspect', 'LOOK');
  let aiming = false;
  return {
    root,
    setAiming(on) { if (on !== aiming) { aiming = on; root.classList.toggle('aiming', on); } },
    setCrouch(on) { if (!on && t.buttons.has('crouch')) { t.buttons.delete('crouch'); crouchB.classList.remove('tog'); } },
    setSens(k) { sens.k = k; },
    show(on) { root.style.display = on ? '' : 'none'; if (!on) { t.buttons.clear(); t.move.x = t.move.y = 0; looks.clear(); crouchB.classList.remove('tog'); } },
    destroy() { root.remove(); css.remove(); t.buttons.clear(); t.active = false; },
  };
}
