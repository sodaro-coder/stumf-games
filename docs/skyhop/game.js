// Kit: 2D platformer (Canvas). Levels are generated from a seed (the same level for everyone), tile collision with
// AABB, tight controls (coyote time, jump buffer, variable jump height), walkers, coins, checkpoints, a goal flag.
// Multiplayer: everyone runs the same level at once and sees each other's ghosts (positions ~15/s) for a race.

export default function start({ cfg, E, N, session, name }) {
  const C = cfg.game, P = cfg.palette, T = 32, me = session ? session.id : 'solo';
  const cv = document.createElement('canvas'); document.body.appendChild(cv); const g = cv.getContext('2d');
  let scale = 1, W = 0, H = 0;
  const resize = () => { W = innerWidth; H = innerHeight; cv.width = W * scale | 0; cv.height = H * scale | 0; cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.imageSmoothingEnabled = false; };
  addEventListener('resize', resize);
  const gov = E.qualityGovernor((s) => { scale = s; resize(); }, { max: 1, min: 0.5 });
  const fps = E.fpsMeter();
  E.touchControls(['jump']);
  const hud = E.el(`<div style="position:fixed;top:10px;left:14px;color:${P.text};font:800 18px system-ui;text-shadow:0 2px 4px #000;z-index:20"></div>`);
  const tiles = { ground: E.tex.pixel(hexs(P.ground), { pattern: 'grass', seed: 1 }), brick: E.tex.pixel(hexs(P.brick), { pattern: 'bricks', seed: 2 }) };
  function hexs(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

  // ---- level generator: chunks of ground with gaps, platforms, enemies and coins; difficulty rises with level ----
  let level = 0, map = [], coins = [], walkers = [], flag = null, startX = 2;
  const build = (n) => {
    const r = E.rng((cfg.seed || 5) * 1000 + n), len = C.levelLength + n * 20, h = 18;
    map = Array.from({ length: h }, () => new Array(len).fill(0)); coins = []; walkers = [];
    let y = 13, lastStep = 0;
    for (let x = 0; x < len; x++) {
      const gap = x > 8 && x < len - 8 && r() < C.gapChance + n * 0.01;
      if (gap) { const w = r.int(2, Math.min(4, 2 + n)); x += w - 1; continue; }
      if (r() < 0.12 && x - lastStep >= 3) { y = E.clamp(y + r.int(-2, 2), 9, 15); lastStep = x; }  // never more than 2 tiles at a time: always jumpable
      for (let yy = y; yy < h; yy++) map[yy][x] = yy === y ? 1 : 2;
      if (r() < 0.07 && x > 10) { const py = y - r.int(3, 4), pw = r.int(3, 5); for (let k = 0; k < pw && x + k < len; k++) { map[py][x + k] = 2; if (r() < 0.6) coins.push({ x: (x + k) * T + 10, y: (py - 1) * T + 10, got: false }); } }
      if (r() < 0.05) coins.push({ x: x * T + 10, y: (y - 2) * T + 10, got: false });
      if (r() < C.enemyChance + n * 0.01 && x > 12 && x < len - 6) walkers.push({ x: x * T, y: (y - 1) * T, vx: -C.enemySpeed, alive: true, home: y });
    }
    flag = { x: (len - 4) * T, y: 0 }; for (let yy = 0; yy < h; yy++) if (map[yy][len - 4]) { flag.y = (yy - 3) * T; break; }
    startX = 2;
  };
  const solidAt = (px, py) => { const x = Math.floor(px / T), y = Math.floor(py / T); return y >= 0 && y < map.length && x >= 0 && x < map[0].length && map[y][x] > 0; };
  const box = { x: 0, y: 0, w: 22, h: 28 };
  const pl = { x: 0, y: 0, vx: 0, vy: 0, ground: false, coyote: 0, buffer: 0, coins: 0, deaths: 0, time: 0, done: false, check: 0 };
  const respawn = () => { pl.x = pl.check || startX * T; pl.y = 0; pl.vx = pl.vy = 0; };
  const newLevel = (n) => { level = n; build(n); pl.check = 0; respawn(); pl.time = 0; pl.done = false; };
  newLevel(0);

  const move = (dx, dy) => {  // axis-separated tile collision
    pl.x += dx;
    if (dx) { const edge = dx > 0 ? pl.x + box.w : pl.x; for (const yy of [pl.y + 2, pl.y + box.h / 2, pl.y + box.h - 2]) if (solidAt(edge, yy)) { pl.x = dx > 0 ? Math.floor(edge / T) * T - box.w - 0.01 : Math.floor(edge / T + 1) * T + 0.01; pl.vx = 0; break; } }
    pl.y += dy; pl.ground = false;
    if (dy) { const edge = dy > 0 ? pl.y + box.h : pl.y; for (const xx of [pl.x + 2, pl.x + box.w - 2]) if (solidAt(xx, edge)) { if (dy > 0) { pl.y = Math.floor(edge / T) * T - box.h - 0.01; pl.ground = true; } else pl.y = Math.floor(edge / T + 1) * T + 0.01; pl.vy = 0; break; } }
  };

  const ghosts = new Map();
  if (session) {
    session.on('pos', (d, peer) => { let o = ghosts.get(peer); if (!o) ghosts.set(peer, (o = { x: d[0], y: d[1], tx: d[0], ty: d[1], lvl: d[2] })); o.tx = d[0]; o.ty = d[1]; o.lvl = d[2]; o.name = session.names.get(peer) || 'Player'; });
    session.on('_leave', (_, peer) => ghosts.delete(peer));
    session.on('win', (d) => { banner(`${d} reached the flag!`); });
  }
  const bannerEl = E.el(`<div style="position:fixed;top:30%;left:0;right:0;text-align:center;color:${P.accent};font:900 40px system-ui;text-shadow:0 4px 14px #000;opacity:0;transition:opacity .4s;z-index:20"></div>`);
  const banner = (t) => { bannerEl.textContent = t; bannerEl.style.opacity = 1; setTimeout(() => (bannerEl.style.opacity = 0), 1800); };
  banner(cfg.text.level.replace('{n}', 1));

  let netT = 0, camX = 0, camY = 0;
  E.loop((dt) => {
    const m = E.input.move(), Ph = C.physics;
    pl.time += dt;
    const target = m.x * Ph.run * (E.input.button('alt') ? 1.35 : 1);
    pl.vx += (target - pl.vx) * Math.min(1, (pl.ground ? Ph.accel : Ph.airAccel) * dt);
    pl.coyote = pl.ground ? Ph.coyote : pl.coyote - dt;
    pl.buffer = E.input.tapped('jump') || E.input.pressed('KeyW') || E.input.pressed('ArrowUp') ? Ph.buffer : pl.buffer - dt;
    if (pl.buffer > 0 && pl.coyote > 0) { pl.vy = -Ph.jump; pl.buffer = pl.coyote = 0; E.sfx.play('jump'); }
    const holding = E.input.button('jump') || E.input.down('KeyW') || E.input.down('ArrowUp');
    pl.vy += Ph.gravity * (pl.vy < 0 && !holding ? 2.2 : 1) * dt; pl.vy = Math.min(pl.vy, Ph.maxFall);
    move(pl.vx * dt, 0); move(0, pl.vy * dt);
    if (pl.y > map.length * T) { pl.deaths++; E.sfx.play('hurt'); respawn(); }
    if (pl.x > pl.check + 20 * T && pl.ground) pl.check = pl.x;
    for (const c of coins) if (!c.got && Math.abs(c.x - pl.x - 6) < 18 && Math.abs(c.y - pl.y - 10) < 22) { c.got = true; pl.coins++; E.sfx.play('pickup'); }
    for (const w of walkers) {
      if (!w.alive) continue;
      w.x += w.vx * dt; const ahead = w.vx > 0 ? w.x + 26 : w.x - 2;
      if (solidAt(ahead, w.y + 10) || !solidAt(ahead, w.y + T + 4)) w.vx = -w.vx;
      if (E.aabb({ x: pl.x, y: pl.y, w: box.w, h: box.h }, { x: w.x, y: w.y + 6, w: 26, h: 26 })) {
        if (pl.vy > 0 && pl.y + box.h - w.y < 16) { w.alive = false; pl.vy = -Ph.jump * 0.6; E.sfx.play('hit'); }
        else { pl.deaths++; E.sfx.play('hurt'); respawn(); }
      }
    }
    if (!pl.done && pl.x > flag.x - 10) {
      pl.done = true; E.sfx.play('pickup'); banner(cfg.text.clear.replace('{t}', pl.time.toFixed(1)));
      if (session) session.send('win', name);
      setTimeout(() => newLevel(level + 1), 2200);
    }
    for (const o of ghosts.values()) { o.x = E.lerp(o.x, o.tx, 0.3); o.y = E.lerp(o.y, o.ty, 0.3); }
    netT += dt; if (session && netT > 1 / 15) { netT = 0; session.send('pos', [Math.round(pl.x), Math.round(pl.y), level]); }
  }, (_, dt) => {
    gov(dt); fps(dt);
    const z = scale * Math.max(0.7, Math.min(1.6, H / (T * 14)));
    camX = E.lerp(camX, pl.x - W / z / 2.6, 0.12); camY = E.lerp(camY, Math.min(pl.y - H / z / 2, map.length * T - H / z), 0.1);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, cv.height); sky.addColorStop(0, P.sky); sky.addColorStop(1, P.sky2); g.fillStyle = sky; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = P.hills; for (let i = 0; i < 6; i++) { const x = ((i * 420 - camX * 0.3) % 2520 + 2520) % 2520 - 300; g.beginPath(); g.arc(x * scale, cv.height, 260 * scale, Math.PI, 0); g.fill(); }
    g.setTransform(z, 0, 0, z, -camX * z, -camY * z);
    const x0 = Math.max(0, Math.floor(camX / T)), x1 = Math.min(map[0].length - 1, Math.ceil((camX + W / z) / T));
    for (let y = 0; y < map.length; y++) for (let x = x0; x <= x1; x++) { const t = map[y][x]; if (t) g.drawImage(t === 1 ? tiles.ground : tiles.brick, x * T, y * T, T, T); }
    g.fillStyle = P.coin; for (const c of coins) if (!c.got) { g.beginPath(); g.arc(c.x + 6, c.y + 6, 7, 0, 7); g.fill(); }
    g.fillStyle = P.enemy; for (const w of walkers) if (w.alive) { g.fillRect(w.x, w.y + 8, 26, 24); g.fillStyle = '#fff'; g.fillRect(w.x + (w.vx < 0 ? 4 : 16), w.y + 12, 5, 5); g.fillStyle = P.enemy; }
    g.fillStyle = P.text; g.fillRect(flag.x, flag.y, 4, T * 3); g.fillStyle = P.accent; g.fillRect(flag.x + 4, flag.y, 26, 18);
    g.globalAlpha = 0.45; g.fillStyle = P.ghost; for (const o of ghosts.values()) if (o.lvl === level) { g.fillRect(o.x, o.y, box.w, box.h); g.font = '11px system-ui'; g.fillText(o.name || '', o.x - 4, o.y - 6); } g.globalAlpha = 1;
    g.fillStyle = P.player; g.fillRect(pl.x, pl.y, box.w, box.h); g.fillStyle = '#fff'; g.fillRect(pl.x + (pl.vx < 0 ? 3 : 13), pl.y + 6, 6, 6);
    hud.textContent = `${cfg.text.level.replace('{n}', level + 1)} · ● ${pl.coins} · ✝ ${pl.deaths} · ${pl.time.toFixed(1)} s` + (session ? ` · ${1 + ghosts.size} players · code ${session.code}` : '');
  });
  resize();
}
