// Kit: 2D top-down arena shooter (Canvas). Waves of enemies, pickups, co-op. Host-authoritative: the host simulates
// everything; clients send inputs ~20/s and draw the host's snapshots (~15/s) with interpolation. Everything is drawn
// with shapes and glow: no image files. All tuning comes from config.json.

export default function start({ cfg, E, N, session, name }) {
  const C = cfg.game, P = cfg.palette;
  const cv = document.createElement('canvas'); document.body.appendChild(cv);
  const g = cv.getContext('2d');
  let scale = 1, W = 0, H = 0;
  const resize = () => { W = innerWidth; H = innerHeight; cv.width = W * scale | 0; cv.height = H * scale | 0; cv.style.width = W + 'px'; cv.style.height = H + 'px'; };
  addEventListener('resize', resize);
  const gov = E.qualityGovernor((s) => { scale = s; resize(); }, { max: 1, min: 0.5 });
  E.touchControls(['fire', 'use']);
  const fps = E.fpsMeter();
  const hud = E.el(`<div style="position:fixed;top:10px;left:50%;transform:translateX(-50%);color:${P.text};font:800 18px system-ui;text-shadow:0 2px 6px #000;z-index:20;text-align:center"></div>`);
  const banner = E.el(`<div style="position:fixed;top:38%;left:0;right:0;text-align:center;color:${P.accent};font:900 44px system-ui;text-shadow:0 4px 20px #000;z-index:20;opacity:0;transition:opacity .4s"></div>`);
  const show = (t) => { banner.textContent = t; banner.style.opacity = 1; setTimeout(() => (banner.style.opacity = 0), 1800); };
  const rnd = E.rng(cfg.seed || 7);
  const A = C.arena;  // {w, h, obstacles}
  const obstacles = [];
  for (let i = 0; i < A.obstacles; i++) {
    const w = 40 + rnd() * 90, h = 40 + rnd() * 90;
    obstacles.push({ x: rnd() * (A.w - w), y: rnd() * (A.h - h), w, h });
  }
  const solid = new E.Grid(96); obstacles.forEach((o) => solid.insert(o));
  const hitsWall = (x, y, r) => solid.query({ x: x - r, y: y - r, w: r * 2, h: r * 2 }, []).length > 0 || x < r || y < r || x > A.w - r || y > A.h - r;

  // ---- simulation (runs on the host, or locally when solo) ----
  const isHost = () => !session || session.isHost;
  const me = session ? session.id : 'solo';
  const sim = {
    players: new Map(), wave: 0, left: 0, spawnT: 0, over: false, t: 0,
    enemies: new E.Pool(() => ({ x: 0, y: 0, hp: 0, type: 0, vx: 0, vy: 0, cd: 0 }), 64),
    bullets: new E.Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, owner: '' }), 128),
    pickups: new E.Pool(() => ({ x: 0, y: 0, kind: 0, life: 0 }), 16),
  };
  const addPlayer = (id, nm) => { if (!sim.players.has(id)) sim.players.set(id, { id, name: nm, x: A.w / 2 + rnd() * 80 - 40, y: A.h / 2 + rnd() * 80 - 40, hp: C.player.hp, score: 0, cd: 0, inp: { mx: 0, my: 0, ax: 1, ay: 0, fire: false }, dead: 0 }); };
  addPlayer(me, name);
  const nextWave = () => { sim.wave++; sim.left = Math.round(C.waves.start + C.waves.growth * (sim.wave - 1)) * Math.max(1, sim.players.size); show(cfg.text.wave.replace('{n}', sim.wave)); };
  const spawnEnemy = () => {
    const types = C.enemies, unlocked = types.filter((t) => (t.from || 1) <= sim.wave), t = unlocked[Math.floor(Math.random() * unlocked.length)] || types[0];
    const e = sim.enemies.get(); const side = Math.random() * 4 | 0;
    e.x = side === 0 ? 10 : side === 1 ? A.w - 10 : Math.random() * A.w; e.y = side === 2 ? 10 : side === 3 ? A.h - 10 : Math.random() * A.h;
    e.type = types.indexOf(t); e.hp = t.hp * (1 + C.waves.hpGrowth * (sim.wave - 1)); e.cd = 0;
  };
  const step = (dt) => {
    sim.t += dt;
    if (!sim.wave) nextWave();
    // players
    for (const p of sim.players.values()) {
      if (p.dead > 0) { p.dead -= dt; if (p.dead <= 0) { p.hp = C.player.hp; p.x = A.w / 2; p.y = A.h / 2; } continue; }
      const i = p.inp, sp = C.player.speed;
      const nx = p.x + i.mx * sp * dt, ny = p.y - i.my * sp * dt;
      if (!hitsWall(nx, p.y, 12)) p.x = nx; if (!hitsWall(p.x, ny, 12)) p.y = ny;
      p.cd -= dt;
      if (i.fire && p.cd <= 0) {
        const w = C.weapon; p.cd = 1 / w.rate;
        for (let k = 0; k < w.count; k++) {
          const a = Math.atan2(i.ay, i.ax) + (Math.random() - 0.5) * w.spread + (k - (w.count - 1) / 2) * w.spread * 0.6;
          const b = sim.bullets.get(); b.x = p.x; b.y = p.y; b.vx = Math.cos(a) * w.speed; b.vy = Math.sin(a) * w.speed; b.life = w.range / w.speed; b.dmg = w.damage; b.owner = p.id;
        }
        ev('shot');
      }
    }
    // spawning
    sim.spawnT -= dt;
    if (sim.left > 0 && sim.spawnT <= 0 && sim.enemies.live.length < C.waves.maxAlive) { spawnEnemy(); sim.left--; sim.spawnT = Math.max(0.15, C.waves.spawnGap * Math.pow(0.93, sim.wave)); }
    if (sim.left === 0 && sim.enemies.live.length === 0) nextWave();
    // enemies chase the nearest living player
    sim.enemies.each((e) => {
      const t = C.enemies[e.type]; let best = null, bd = 1e9;
      for (const p of sim.players.values()) { if (p.dead > 0) continue; const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2; if (d < bd) { bd = d; best = p; } }
      if (!best) return;
      const d = Math.sqrt(bd) || 1, ux = (best.x - e.x) / d, uy = (best.y - e.y) / d;
      const nx = e.x + ux * t.speed * dt, ny = e.y + uy * t.speed * dt;
      if (!hitsWall(nx, e.y, t.size)) e.x = nx; else e.y += (uy >= 0 ? 1 : -1) * t.speed * dt;
      if (!hitsWall(e.x, ny, t.size)) e.y = ny; else e.x += (ux >= 0 ? 1 : -1) * t.speed * dt;
      e.cd -= dt;
      if (d < t.size + 14 && e.cd <= 0) { e.cd = 0.8; best.hp -= t.damage; ev('hurt', best.id); if (best.hp <= 0) { best.dead = C.player.respawn; ev('down', best.id); } }
    });
    // bullets
    sim.bullets.each((b) => {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || hitsWall(b.x, b.y, 2)) { sim.bullets.release(b); return; }
      sim.enemies.each((e) => {
        if (!b.alive) return; const t = C.enemies[e.type];
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < t.size * t.size) {
          e.hp -= b.dmg; sim.bullets.release(b);
          if (e.hp <= 0) {
            sim.enemies.release(e); const p = sim.players.get(b.owner); if (p) p.score += t.score; ev('kill');
            if (Math.random() < C.pickupChance) { const k = sim.pickups.get(); k.x = e.x; k.y = e.y; k.kind = Math.random() < 0.5 ? 0 : 1; k.life = 12; }
          }
        }
      });
    });
    sim.pickups.each((k) => {
      k.life -= dt; if (k.life <= 0) { sim.pickups.release(k); return; }
      for (const p of sim.players.values()) if (p.dead <= 0 && (p.x - k.x) ** 2 + (p.y - k.y) ** 2 < 600) {
        if (k.kind === 0) p.hp = Math.min(C.player.hp, p.hp + C.player.hp * 0.35); else p.score += 50;
        sim.pickups.release(k); ev('pickup', p.id); break;
      }
    });
    sim.enemies.sweep(); sim.bullets.sweep(); sim.pickups.sweep();
  };
  const ev = (kind, who) => { local(kind, who); if (session && isHost()) session.send('ev', { k: kind, w: who }); };
  const local = (kind, who) => { if (kind === 'shot') E.sfx.play('shot'); else if (kind === 'kill') E.sfx.play('hit'); else if (kind === 'pickup' && who === me) E.sfx.play('pickup'); else if (kind === 'hurt' && who === me) E.sfx.play('hurt'); };
  const snapshot = () => ({
    w: sim.wave, l: sim.left + sim.enemies.live.length,
    p: [...sim.players.values()].map((p) => [p.id, Math.round(p.x), Math.round(p.y), Math.round(p.hp), p.score, p.dead > 0 ? 1 : 0, +p.inp.ax.toFixed(2), +p.inp.ay.toFixed(2), p.name]),
    e: sim.enemies.live.filter((e) => e.alive).map((e) => [Math.round(e.x), Math.round(e.y), e.type]),
    b: sim.bullets.live.filter((b) => b.alive).map((b) => [Math.round(b.x), Math.round(b.y)]),
    k: sim.pickups.live.filter((k) => k.alive).map((k) => [Math.round(k.x), Math.round(k.y), k.kind]),
  });

  // ---- networking ----
  const interp = new N.Interp(110);
  if (session) {
    session.on('in', (d, peer) => { if (!isHost()) return; const p = sim.players.get(peer); if (p && d) Object.assign(p.inp, { mx: +d.mx || 0, my: +d.my || 0, ax: +d.ax || 1, ay: +d.ay || 0, fire: !!d.f }); });
    session.on('st', (s) => { if (!isHost()) interp.push(s); });
    session.on('ev', (d) => { if (!isHost()) local(d.k, d.w); });
    session.on('_roster', (_, peer) => { if (isHost()) addPlayer(peer, session.names.get(peer) || 'Player'); });
    session.on('_join', (_, peer) => { if (isHost()) addPlayer(peer, session.names.get(peer) || 'Player'); });
    session.on('_leave', (_, peer) => sim.players.delete(peer));
    session.on('_host', () => { const s = interp.buf[interp.buf.length - 1]; if (isHost() && s) { s.p.forEach((q) => { addPlayer(q[0], q[8]); Object.assign(sim.players.get(q[0]), { x: q[1], y: q[2], hp: q[3], score: q[4] }); }); sim.wave = s.w; sim.left = s.l; } });
  }

  // ---- input ----
  const myInput = { mx: 0, my: 0, ax: 1, ay: 0, f: false };
  addEventListener('mousemove', (e) => { myInput.ax = e.clientX - W / 2; myInput.ay = e.clientY - H / 2; });
  let sendT = 0, snapT = 0;
  const readInput = () => {
    const m = E.input.move(); myInput.mx = m.x; myInput.my = m.y;
    myInput.f = E.input.button('fire');
    if (E.input.touch.active) {  // touch: aim at the nearest enemy automatically
      const v = view(); let bd = 1e9;
      for (const e of v.e) { const d = (e[0] - v.mx) ** 2 + (e[1] - v.my) ** 2; if (d < bd) { bd = d; myInput.ax = e[0] - v.mx; myInput.ay = e[1] - v.my; } }
    }
  };

  // ---- view: what to draw this frame (host: live sim; client: interpolated snapshots) ----
  const view = () => {
    if (isHost()) { const s = snapshot(); const mp = s.p.find((q) => q[0] === me) || s.p[0]; return { ...s, mx: mp ? mp[1] : A.w / 2, my: mp ? mp[2] : A.h / 2 }; }
    const smp = interp.sample(); if (!smp) return { w: 0, l: 0, p: [], e: [], b: [], k: [], mx: A.w / 2, my: A.h / 2 };
    const [a, b, t] = smp;
    const p = b.p.map((q) => { const o = a.p.find((x) => x[0] === q[0]) || q; return [q[0], E.lerp(o[1], q[1], t), E.lerp(o[2], q[2], t), ...q.slice(3)]; });
    const mp = p.find((q) => q[0] === me) || p[0];
    return { ...b, p, mx: mp ? mp[1] : A.w / 2, my: mp ? mp[2] : A.h / 2 };
  };

  const draw = () => {
    const v = view(), z = scale * (Math.min(W, H) < 700 ? 0.8 : 1);
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = P.bg; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(z, 0, 0, z, cv.width / 2 - v.mx * z, cv.height / 2 - v.my * z);
    g.strokeStyle = P.grid; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x <= A.w; x += 64) { g.moveTo(x, 0); g.lineTo(x, A.h); }
    for (let y = 0; y <= A.h; y += 64) { g.moveTo(0, y); g.lineTo(A.w, y); }
    g.stroke();
    g.strokeStyle = P.accent; g.lineWidth = 4; g.strokeRect(0, 0, A.w, A.h);
    g.fillStyle = P.wall; for (const o of obstacles) g.fillRect(o.x, o.y, o.w, o.h);
    for (const k of v.k) { g.fillStyle = k[2] === 0 ? P.good : P.gold; g.beginPath(); g.arc(k[0], k[1], 9, 0, 7); g.fill(); }
    g.shadowBlur = 12;
    for (const e of v.e) { const t = C.enemies[e[2]] || C.enemies[0]; g.shadowColor = g.fillStyle = t.color; g.beginPath(); g.arc(e[0], e[1], t.size, 0, 7); g.fill(); }
    g.shadowColor = g.fillStyle = P.bullet; for (const b of v.b) g.fillRect(b[0] - 2, b[1] - 2, 4, 4);
    for (const p of v.p) {
      if (p[5]) continue;
      const mine = p[0] === me; g.shadowColor = g.fillStyle = mine ? P.player : P.ally;
      g.beginPath(); g.arc(p[1], p[2], 13, 0, 7); g.fill();
      const a = Math.atan2(p[7], p[6]); g.strokeStyle = P.text; g.lineWidth = 4; g.beginPath(); g.moveTo(p[1], p[2]); g.lineTo(p[1] + Math.cos(a) * 20, p[2] + Math.sin(a) * 20); g.stroke();
      g.shadowBlur = 0; g.fillStyle = P.text; g.font = '12px system-ui'; g.textAlign = 'center'; g.fillText(p[8], p[1], p[2] - 20); g.shadowBlur = 12;
    }
    g.shadowBlur = 0;
    const mp = v.p.find((q) => q[0] === me);
    hud.textContent = `${cfg.text.wave.replace('{n}', v.w)} · ${v.l} ${cfg.text.left}` + (mp ? ` · ❤ ${mp[3]} · ${mp[4]} pts` + (mp[5] ? ' · ' + cfg.text.down : '') : '') + (session ? ` · ${1 + session.peers().length} players · code ${session.code}` : '');
  };

  E.loop((dt) => {
    readInput();
    if (isHost()) {
      Object.assign(sim.players.get(me)?.inp || {}, { mx: myInput.mx, my: myInput.my, ax: myInput.ax, ay: myInput.ay, fire: myInput.f });
      step(dt);
      snapT += dt; if (session && snapT > 1 / 15) { snapT = 0; session.send('st', snapshot()); }
    } else { sendT += dt; if (sendT > 0.05) { sendT = 0; session.toHost('in', myInput); } }
  }, (_, dt) => { gov(dt); fps(dt); draw(); });
  resize();
}
