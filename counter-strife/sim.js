// The rules. Movement and shot tracing are shared by everyone (players predict locally, bots run on the host); the
// Match runs only on the host (or alone in solo play): rounds, economy, the bomb, damage, grenades, drops, buying.
import { PHYS, ECON, BOMB, MODES, W_BY_ID, G_BY_ID, GEAR_BY_ID, MAX_GRENADES, slotOf, forTeam, itemPrice, damageFor, U } from './data.js';

// ---- movement (classic ground accel/friction, air strafing, jumping, crouching, stepping up ledges) ---------------
export function moveStep(W, p, inp, dt, maxSpeed) {
  const wish = { x: 0, z: 0 };
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  wish.x = fx * inp.f + rx * inp.s; wish.z = fz * inp.f + rz * inp.s;
  const wl = Math.hypot(wish.x, wish.z); if (wl > 1e-6) { wish.x /= wl; wish.z /= wl; }
  p.crouch = Math.max(0, Math.min(1, p.crouch + (inp.crouch ? 1 : -1) * dt * 8));
  let top = maxSpeed * (inp.walk ? PHYS.walk : 1) * (p.crouch > 0.5 ? PHYS.crouch : 1);
  if (wl < 1e-6) top = 0;
  const ground = W.groundAt(p.x, p.z, p.y);
  const onGround = p.y <= ground + 0.02 && p.vy <= 0;
  if (onGround) {
    // friction
    const sp = Math.hypot(p.vx, p.vz);
    if (sp > 0) { const ctl = Math.max(sp, PHYS.stop), drop = ctl * PHYS.friction * dt, ns = Math.max(0, sp - drop) / sp; p.vx *= ns; p.vz *= ns; }
    // accelerate
    const cur = p.vx * wish.x + p.vz * wish.z, add = top - cur;
    if (add > 0) { const acc = Math.min(PHYS.accel * dt * Math.max(top, 0.1), add); p.vx += acc * wish.x; p.vz += acc * wish.z; }
    if (inp.jump && !p.jumpHeld) { p.vy = PHYS.jump; p.jumpHeld = true; p.y = ground + 0.03; }
    else { p.y = ground; p.vy = 0; }
  } else {
    const wsp = Math.min(top, 30 * U), cur = p.vx * wish.x + p.vz * wish.z, add = wsp - cur;
    if (add > 0 && wl > 0) { const acc = Math.min(PHYS.airAccel * dt * top, add); p.vx += acc * wish.x; p.vz += acc * wish.z; }
    p.vy -= PHYS.gravity * dt;
  }
  if (!inp.jump) p.jumpHeld = false;
  W.move(p, p.vx * dt, p.vz * dt, PHYS.radius, onGround ? PHYS.step : 0.05);
  p.y += p.vy * dt;
  const g2 = W.groundAt(p.x, p.z, p.y);
  if (p.y < g2) { p.y = g2; p.vy = 0; }
  // stepping smoothing for the camera
  p.onGround = p.y <= g2 + 0.02;
  return p.onGround;
}
export const eyeHeight = (p) => PHYS.eye - (PHYS.eye - PHYS.crouchEye) * p.crouch;
export const speedOf = (p) => Math.hypot(p.vx, p.vz);

// ---- hitboxes and shot tracing -----------------------------------------------------------------------------------
const slab = (o, d, b, maxT) => {
  let t0 = 0, t1 = maxT;
  for (const [oo, dd, lo, hi] of [[o.x, d.x, b[0], b[3]], [o.y, d.y, b[1], b[4]], [o.z, d.z, b[2], b[5]]]) {
    if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return -1; continue; }
    let a = (lo - oo) / dd, c = (hi - oo) / dd; if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return -1;
  }
  return t0;
};
export function hitboxes(p) {
  const k = 1 - p.crouch * 0.28, x = p.x, y = p.y, z = p.z;
  return [['head', [x - 0.15, y + 1.5 * k, z - 0.15, x + 0.15, y + 1.86 * k, z + 0.15]], ['chest', [x - 0.24, y + 1.15 * k, z - 0.24, x + 0.24, y + 1.5 * k, z + 0.24]],
    ['stomach', [x - 0.22, y + 0.9 * k, z - 0.22, x + 0.22, y + 1.15 * k, z + 0.22]], ['legs', [x - 0.22, y, z - 0.2, x + 0.22, y + 0.9 * k, z + 0.2]]];
}
// one bullet: returns { hits: [{id, group, dist, pen}], end: {x,y,z}, wallHits: [{x,y,z}] }. Thin walls are shot through.
export function traceShot(W, players, shooterId, o, d, w, range = 8192 * U) {
  const res = { hits: [], wallHits: [], end: null };
  let t = 0, pen = 1, n = 0;
  const hitIds = new Set();
  while (n++ < 3) {
    const wall = W.ray(o, d, range, t);
    const wallT = wall ? wall.t : range;
    // closest player hit in [t, wallT)
    let best = null;
    for (const p of players) {
      if (!p.alive || p.id === shooterId || hitIds.has(p.id)) continue;
      for (const [grp, b] of hitboxes(p)) { const tt = slab(o, d, b, wallT); if (tt >= t && (!best || tt < best.t)) best = { t: tt, id: p.id, group: grp }; }
    }
    if (best) { res.hits.push({ id: best.id, group: best.group, dist: best.t, pen }); hitIds.add(best.id); if (res.hits.length >= 2) break; continue; }
    if (!wall) { res.end = { x: o.x + d.x * range, y: o.y + d.y * range, z: o.z + d.z * range }; break; }
    const pt = { x: o.x + d.x * wall.t, y: o.y + d.y * wall.t, z: o.z + d.z * wall.t };
    res.wallHits.push(pt); res.end = pt;
    const th = W.thickness(o, d, wall.t), cost = th * W.density(wall.m), cap = (w.pen || 1) * 0.55;
    if (!isFinite(th) || cost >= cap) break;
    pen *= (1 - cost / cap) * 0.85; t = wall.t + th + 0.01;
    if (pen < 0.1) break;
  }
  return res;
}
// spread for the current state: standing/moving/jumping/crouched/scoped, plus spray
export function spreadOf(w, p, scoped, sprayIdx) {
  const [stand, move, jump] = w.inacc || [0.005, 0.03, 0.1];
  if (w.zoom && scoped && w.scopedInacc) {
    const sp = speedOf(p) / (w.speed * U);
    return w.scopedInacc + (p.onGround ? 0 : jump) + Math.max(0, sp - 0.34) * move;
  }
  const sp = Math.min(1, speedOf(p) / (w.speed * U));
  let s = stand * (p.crouch > 0.5 ? 0.7 : 1) + Math.max(0, sp - 0.34) * move * 1.4 + (p.onGround ? 0 : jump);
  if (w.cat === 'sniper' && !scoped) s = Math.max(s, w.inacc[1] * 0.6);
  s += Math.min(sprayIdx, 12) * (w.kick || 0.01) * 0.12;
  return s;
}
// the recoil pattern: climbs first, then drifts side to side (same shape every spray, so it can be learned)
export function recoilAt(w, i) {
  const up = Math.min(i, 9) * (w.kick || 0.01);
  const side = i > 8 ? Math.sin((i - 8) * 0.55) * (w.sway || 0.006) * 6 : Math.sin(i * 0.9) * (w.sway || 0.006) * 0.6;
  return { up, side };
}

// ---- grenade physics (the same function on every machine, so everyone sees the same bounce) ----------------------
export function nadeStep(W, n, dt) {
  n.vy -= PHYS.gravity * dt;
  const nx = n.x + n.vx * dt, ny = n.y + n.vy * dt, nz = n.z + n.vz * dt;
  const hAt = (x, z) => W.H(Math.floor(x), Math.floor(z));
  if (hAt(nx, n.z) > n.y) { n.vx *= -0.45; } else n.x = nx;
  if (hAt(n.x, nz) > n.y) { n.vz *= -0.45; } else n.z = nz;
  const g = hAt(n.x, n.z);
  if (ny < g) { n.y = g; n.vy = -n.vy * 0.35; n.vx *= 0.6; n.vz *= 0.6; if (Math.abs(n.vy) < 0.6) { n.vy = 0; n.rest = true; } n.bounced = true; } else n.y = ny;
}

// ---- the match (host only) ---------------------------------------------------------------------------------------
export class Match {
  constructor({ W, mode, mapId, botLevel = 'normal', send, rng = Math.random, onLocal }) {
    this.W = W; this.mode = mode; this.M = MODES[mode]; this.mapId = mapId; this.botLevel = botLevel;
    this.send = send || (() => {}); this.rng = rng; this.onLocal = onLocal || (() => {});
    this.players = new Map(); this.score = { T: 0, CT: 0 }; this.round = 0; this.phase = 'warmup'; this.timer = 0; this.lossStreak = { T: 1, CT: 1 };
    this.bomb = null; this.nades = []; this.effects = []; this.drops = []; this.history = []; this.nid = 1; this.firstRound = true; this.over = null;
    this.swapped = false; this.roundKills = new Map();
  }
  // ---- roster ----
  add(id, info) {
    const teamCount = (t) => [...this.players.values()].filter((p) => p.team === t).length;
    const team = info.team || (teamCount('T') <= teamCount('CT') ? 'T' : 'CT');
    const p = { id, name: info.name || 'Player', bot: !!info.bot, team, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: 0, onGround: true,
      hp: 100, armor: 0, helmet: false, defuser: false, alive: false, money: this.M.start || ECON.start, inv: {}, cur: 2, nades: [],
      k: 0, a: 0, d: 0, mvp: 0, score: 0, hs: 0, dmgDealt: new Map(), loadout: info.loadout || {}, agent: info.agent || {}, knife: info.knife || null, lastShot: 0, ping: 0 };
    this.players.set(id, p);
    if (this.phase !== 'warmup' && this.phase !== 'freeze') p.alive = false; else this.spawn(p);
    this.broadcastRoster();
    return p;
  }
  remove(id) { const p = this.players.get(id); if (!p) return; if (p.alive) this.dropAll(p); this.players.delete(id); this.broadcastRoster(); this.checkWin(); }
  fillBots(names) {
    let n = 0;
    for (const team of ['T', 'CT']) {
      while ([...this.players.values()].filter((p) => p.team === team).length < this.M.size) {
        const id = 'bot' + (this.nid++);
        this.add(id, { name: 'BOT ' + names[(n++) % names.length], bot: true, team, loadout: {}, agent: {} });
      }
    }
  }
  broadcastRoster() { this.send('roster', [...this.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.bot, agent: p.agent, knife: p.knife }))); }

  // ---- inventory ----
  defaultPistol(team, p) { return team === 'T' ? 'glock' : (p && p.loadout && p.loadout.CT && p.loadout.CT.ctPistol === 'p2000' ? 'p2000' : 'usp'); }
  give(p, wid, skin = null, fresh = true) {
    const s = slotOf(wid);
    if (s === 4) { if (p.nades.length < MAX_GRENADES) p.nades.push(wid); }
    else if (s === 5) p.inv[5] = { wid: 'c4' };
    else { const w = W_BY_ID[wid]; p.inv[s] = { wid, ammo: w.mag, reserve: w.reserve, skin: skin || this.skinFor(p, wid), fresh }; }
    this.sendInv(p);
  }
  skinFor(p, wid) { const l = (p.loadout || {})[p.team] || {}; return (l.skins || {})[wid] || null; }
  sendInv(p) { const msg = { inv: p.inv, nades: p.nades, money: p.money, armor: p.armor, helmet: p.helmet, defuser: p.defuser, hp: p.hp };
    if (p.bot) return; if (p.local) this.onLocal('inv', msg); else this.send('inv', msg, p.id); for (const s in p.inv) if (p.inv[s]) p.inv[s].fresh = false; }
  dropAll(p) {
    const primary = p.inv[1] || p.inv[2];
    if (primary && p.alive !== 'keep') this.dropItem(p, primary);
    if (p.inv[5]) { this.bomb = { state: 'dropped', x: p.x, y: p.y, z: p.z }; delete p.inv[5]; this.send('bomb', this.bomb); }
  }
  dropItem(p, it, toss = 0) {
    const d = { id: this.nid++, wid: it.wid, ammo: it.ammo, reserve: it.reserve, skin: it.skin, x: p.x - Math.sin(p.yaw) * toss, y: p.y + 0.1, z: p.z - Math.cos(p.yaw) * toss };
    d.y = this.W.groundAt(d.x, d.z, p.y + 1) + 0.05;
    if (this.W.H(Math.floor(d.x), Math.floor(d.z)) > p.y + 1) { d.x = p.x; d.z = p.z; }
    this.drops.push(d); if (this.drops.length > 40) this.drops.shift();
    this.send('drops', this.drops); this.onLocal('drops', this.drops);
  }
  // ---- buying ----
  buy(p, item) {
    if (!p.alive || !this.canBuy(p) || !forTeam(item, p.team)) return 'not here';
    const price = item === 'vesthelm' && p.armor >= 100 ? 350 : itemPrice(item);
    if (p.money < price) return 'not enough money';
    const g = GEAR_BY_ID[item], n = G_BY_ID[item];
    if (g) {
      if (item === 'vest') { if (p.armor >= 100) return 'already have it'; p.armor = 100; }
      if (item === 'vesthelm') { if (p.armor >= 100 && p.helmet) return 'already have it'; p.armor = 100; p.helmet = true; }
      if (item === 'defuser') { if (p.defuser || p.team !== 'CT') return 'already have it'; p.defuser = true; }
    } else if (n) {
      const same = p.nades.filter((x) => x === item).length;
      if (same >= n.max || p.nades.length >= MAX_GRENADES) return 'can\'t carry more';
      p.nades.push(item);
    } else {
      const s = slotOf(item), had = p.inv[s];
      if (had && had.wid === item) return 'already have it';
      if (had) this.dropItem(p, had, 0.6);
      p.inv[s] = { wid: item, ammo: W_BY_ID[item].mag, reserve: W_BY_ID[item].reserve, skin: this.skinFor(p, item), fresh: true };
      p.cur = s;
    }
    p.money -= price;
    this.sendInv(p);
    return '';
  }
  canBuy(p) { return (this.phase === 'freeze' || (this.phase === 'live' && this.M.round - this.timer < this.M.buyTime)) && this.W.inRect(this.W.B.buy[p.team], p.x, p.z); }

  // ---- rounds ----
  start() { this.phase = 'freeze'; this.newRound(true); }
  spawn(p) {
    const pts = (this.M.size === 1 ? this.W.B.duel[p.team] : null) || this.W.B.spawns[p.team];
    const same = [...this.players.values()].filter((q) => q.team === p.team);
    const k = Math.max(0, same.indexOf(p));
    const [x, z, yaw] = pts[k % pts.length];
    p.x = x + (k >= pts.length ? 0.8 : 0); p.z = z; p.y = this.W.groundAt(p.x, p.z, 10); p.yaw = yaw; p.pitch = 0; p.vx = p.vy = p.vz = 0; p.crouch = 0;
    p.alive = true; p.hp = 100;
    if (p.local) this.onLocal('spawn', { x: p.x, y: p.y, z: p.z, yaw }); else if (!p.bot) this.send('spawn', { x: p.x, y: p.y, z: p.z, yaw }, p.id);
  }
  newRound(first = false) {
    this.round++;
    const halfNow = !this.swapped && this.round === this.M.half + 1;
    if (halfNow) {  // halftime: swap sides, reset money and kit
      this.swapped = true; for (const p of this.players.values()) { p.team = p.team === 'T' ? 'CT' : 'T'; p.inv = {}; p.nades = []; p.armor = 0; p.helmet = false; p.defuser = false; p.money = this.M.start || ECON.start; p.alive = false; }
      [this.score.T, this.score.CT] = [this.score.CT, this.score.T]; this.lossStreak = { T: 1, CT: 1 };
      this.broadcastRoster(); this.event('banner', { text: 'HALFTIME: switching sides', sub: '' });
    }
    if (first) for (const p of this.players.values()) { p.money = this.M.start || ECON.start; p.inv = {}; p.nades = []; p.armor = 0; p.helmet = false; p.alive = false; }
    this.bomb = null; this.nades = []; this.effects = []; this.drops = []; this.roundKills = new Map();
    this.send('drops', []); this.onLocal('drops', []);
    for (const p of this.players.values()) {
      if (!p.alive) { p.inv = { 3: { wid: 'knife' } }; p.inv[2] = { wid: this.defaultPistol(p.team, p), ammo: 0, reserve: 0 }; const w = W_BY_ID[p.inv[2].wid]; p.inv[2].ammo = w.mag; p.inv[2].reserve = w.reserve; p.inv[2].skin = this.skinFor(p, p.inv[2].wid); p.inv[2].fresh = true; p.nades = []; p.armor = 0; p.helmet = false; p.defuser = false; }
      p.inv[3] = { wid: 'knife' }; delete p.inv[5]; p.cur = p.inv[1] ? 1 : 2;
      p.dmgDealt = new Map(); this.spawn(p);
    }
    if (this.M.bomb) { const ts = [...this.players.values()].filter((p) => p.team === 'T'); if (ts.length) { const c = ts[Math.floor(this.rng() * ts.length)]; c.inv[5] = { wid: 'c4' }; } }
    if (this.M.size === 1 && this.round === 1) for (const p of this.players.values()) p.money = 800;
    for (const p of this.players.values()) this.sendInv(p);
    this.phase = 'freeze'; this.timer = this.M.freeze;
    this.event('round', { n: this.round, phase: 'freeze', score: this.score });
  }
  endRound(winner, reason) {
    if (this.phase === 'end' || this.phase === 'over') return;
    this.phase = 'end'; this.timer = 5;
    if (winner) this.score[winner]++;
    const loser = winner === 'T' ? 'CT' : 'T';
    // money
    for (const p of this.players.values()) {
      if (!winner) { p.money += ECON.lossBonus[0]; continue; }
      if (p.team === winner) p.money += reason === 'bomb' ? ECON.winBomb : reason === 'defuse' ? ECON.winDefuse : reason === 'time' ? ECON.winTime : ECON.winElim;
      else { let b = ECON.lossBonus[Math.min(this.lossStreak[loser] - 1, 4)]; if (loser === 'T' && this.bomb && this.bomb.state !== 'carried' && this.bomb.state !== 'dropped' && reason === 'defuse') b += ECON.plantedLossBonus; if (loser === 'T' && reason === 'time' && p.alive && this.M.bomb) b = 0; p.money += b; }
      p.money = Math.min(ECON.max, p.money);
    }
    if (winner) { this.lossStreak[loser] = Math.min(5, this.lossStreak[loser] + 1); this.lossStreak[winner] = Math.max(1, this.lossStreak[winner] - 1); }
    // MVP: most kills on the winning team (planter/defuser bonus)
    let mvp = null, best = -1;
    for (const p of this.players.values()) if (p.team === winner) { const k = (this.roundKills.get(p.id) || 0) + (this.bomb && (this.bomb.planter === p.id || this.bomb.defuser === p.id) ? 1.5 : 0); if (k > best) { best = k; mvp = p; } }
    if (mvp) { mvp.mvp++; mvp.score += 2; }
    this.history.push({ w: winner || '-', r: reason });
    const texts = { elim: winner === 'T' ? 'Terrorists Win' : 'Counter-Terrorists Win', bomb: 'Terrorists Win', defuse: 'Counter-Terrorists Win', time: winner ? (winner === 'CT' ? 'Counter-Terrorists Win' : 'Terrorists Win') : 'Draw' };
    this.event('roundEnd', { winner, reason, text: texts[reason] || (winner ? winner + ' win' : 'Draw'), mvp: mvp ? mvp.name : '', score: this.score, history: this.history });
    for (const p of this.players.values()) this.sendInv(p);
    const W2 = this.M.winTo, total = this.round;
    if (this.score.T >= W2 || this.score.CT >= W2 || total >= this.M.half * 2) {
      this.phase = 'over'; this.timer = 12;
      const w = this.score.T > this.score.CT ? 'T' : this.score.CT > this.score.T ? 'CT' : null;
      this.over = { winner: w };
      this.event('matchEnd', { winner: w, score: this.score, players: this.scoreboard() });
    }
  }
  event(type, data) { this.send('ev', { type, data }); this.onLocal('ev', { type, data }); }
  checkWin() {
    if (this.phase !== 'live' && this.phase !== 'planted') return;
    const alive = (t) => [...this.players.values()].some((p) => p.team === t && p.alive);
    if (!alive('CT') && alive('T')) return this.endRound('T', 'elim');
    if (!alive('T') && alive('CT') && !(this.bomb && this.bomb.state === 'planted')) return this.endRound('CT', 'elim');
    if (!alive('T') && !alive('CT')) return this.endRound(this.bomb && this.bomb.state === 'planted' ? 'T' : 'CT', 'elim');
  }
  tick(dt) {
    this.timer -= dt;
    if (this.phase === 'freeze' && this.timer <= 0) { this.phase = 'live'; this.timer = this.M.round; this.event('round', { n: this.round, phase: 'live', score: this.score }); }
    else if (this.phase === 'live' && this.timer <= 0) {
      if (!this.M.bomb) this.endRound(null, 'time'); else this.endRound('CT', 'time');
    } else if (this.phase === 'planted') {
      const b = this.bomb; b.timer -= dt;
      if (b.defuser) {
        const d = this.players.get(b.defuser);
        if (!d || !d.alive || Math.hypot(d.x - b.x, d.z - b.z) > 1.8 || !d.defusing) { b.defuser = null; b.dprog = 0; this.send('bomb', this.bomb); this.onLocal('bomb', this.bomb); }
        else { b.dprog += dt; if (b.dprog >= (d.defuser ? BOMB.defuseKit : BOMB.defuse) && b.timer > 0) { b.state = 'defused'; d.money = Math.min(ECON.max, d.money + ECON.defuseReward); d.score += 2; this.send('bomb', b); this.onLocal('bomb', b); this.event('sound', { s: 'defused', x: b.x, z: b.z }); this.endRound('CT', 'defuse'); } }
      }
      if (b.state === 'planted' && b.timer <= 0) {
        b.state = 'exploded'; this.send('bomb', b); this.onLocal('bomb', b);
        for (const p of this.players.values()) if (p.alive) { const dist = Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z); if (dist < BOMB.radius) { const dmg = BOMB.dmg * Math.exp(-((dist / (BOMB.radius / 3)) ** 2)); this.damage(p, null, Math.round(dmg * (p.armor ? 0.5 : 1)), 'bomb', 'chest', false); } }
        this.event('explode', { x: b.x, y: b.y, z: b.z, r: BOMB.radius });
        this.endRound('T', 'bomb');
      }
    } else if (this.phase === 'end' && this.timer <= 0) this.newRound();
    else if (this.phase === 'over' && this.timer <= 0) { this.phase = 'done'; this.event('done', {}); }
    // planting
    for (const p of this.players.values()) {
      if (!p.alive) { p.planting = 0; continue; }
      if (p.plant && this.phase === 'live' && p.inv[5] && this.siteOk(p) && speedOf(p) < 0.6 && p.onGround) {
        p.planting = (p.planting || 0) + dt;
        if (p.planting >= BOMB.plant) {
          p.planting = 0; delete p.inv[5];
          this.bomb = { state: 'planted', x: p.x, y: p.y, z: p.z, timer: BOMB.timer, planter: p.id, site: this.W.siteAt(p.x, p.z), defuser: null, dprog: 0 };
          p.money = Math.min(ECON.max, p.money + ECON.plantReward); p.score += 2;
          this.phase = 'planted'; this.send('bomb', this.bomb); this.onLocal('bomb', this.bomb); this.sendInv(p);
          this.event('planted', { site: this.bomb.site, by: p.name, x: p.x, y: p.y, z: p.z });
        }
      } else p.planting = 0;
      // defusing
      if (this.phase === 'planted' && p.team === 'CT' && p.defusing && !this.bomb.defuser && Math.hypot(p.x - this.bomb.x, p.z - this.bomb.z) < 1.8) { this.bomb.defuser = p.id; this.bomb.dprog = 0; this.bomb.kit = p.defuser; this.send('bomb', this.bomb); this.onLocal('bomb', this.bomb); }
      // pick up the dropped bomb
      if (this.bomb && this.bomb.state === 'dropped' && p.team === 'T' && Math.hypot(p.x - this.bomb.x, p.z - this.bomb.z) < 1.0) { p.inv[5] = { wid: 'c4' }; this.bomb = null; this.send('bomb', null); this.onLocal('bomb', null); this.sendInv(p); }
      // fire on the floor
      for (const e of this.effects) if (e.type === 'fire' && Math.hypot(p.x - e.x, p.z - e.z) < e.r && Math.abs(p.y - e.y) < 1.5) { e.acc = (e.acc || 0); this.burn(p, e, dt); }
      if (this.W.lavaAt(p.x, p.z) && p.y < 0.2) this.damage(p, null, 60 * dt, 'lava', 'legs', false, true);
    }
    // grenades in the air
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i]; n.age += dt; nadeStep(this.W, n, dt);
      const G = G_BY_ID[n.type];
      const fireOnGround = (n.type === 'molotov' || n.type === 'incendiary') && n.bounced && n.y <= this.W.groundAt(n.x, n.z, n.y + 0.3) + 0.05;
      if (n.age >= G.fuse || fireOnGround || ((n.type === 'smoke' || n.type === 'decoy') && n.rest && n.age > 0.8)) { this.nades.splice(i, 1); this.detonate(n); }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) { const e = this.effects[i]; e.t -= dt; if (e.t <= 0) { this.effects.splice(i, 1); this.send('fx', this.effects); this.onLocal('fx', this.effects); } }
    this.checkWin();
  }
  siteOk(p) { const s = this.W.siteAt(p.x, p.z); return !!s && (!this.M.bombSite || this.M.bombSite === s); }
  burn(p, e, dt) { e.tick = (e.tick || 0); p.burnAcc = (p.burnAcc || 0) + dt; if (p.burnAcc >= 0.25) { p.burnAcc = 0; this.damage(p, this.players.get(e.owner), Math.round(G_BY_ID[e.kind].dps * 0.25), e.kind, 'legs', false, true); } }
  detonate(n) {
    const G = G_BY_ID[n.type], owner = this.players.get(n.owner);
    if (n.type === 'he') {
      for (const p of this.players.values()) if (p.alive) {
        const dist = Math.hypot(p.x - n.x, p.y + 1 - n.y, p.z - n.z);
        if (dist < G.radius && this.W.los({ x: n.x, y: n.y + 0.3, z: n.z }, { x: p.x, y: p.y + 1.2, z: p.z })) {
          let dmg = G.dmg * (1 - dist / G.radius) ** 1.5; if (p.armor) { p.armor = Math.max(0, p.armor - dmg * 0.5); dmg *= 0.57; }
          this.damage(p, owner, Math.round(dmg), 'he', 'chest', false, true);
        }
      }
    } else if (n.type === 'smoke') {
      this.effects.push({ type: 'smoke', x: n.x, y: n.y, z: n.z, r: G.radius, t: G.last });
      for (let i = this.effects.length - 1; i >= 0; i--) { const e = this.effects[i]; if (e.type === 'fire' && Math.hypot(e.x - n.x, e.z - n.z) < G.radius + e.r) this.effects.splice(i, 1); }
    } else if (n.type === 'molotov' || n.type === 'incendiary') {
      if (!this.effects.some((e) => e.type === 'smoke' && Math.hypot(e.x - n.x, e.z - n.z) < e.r)) this.effects.push({ type: 'fire', kind: n.type, x: n.x, y: n.y, z: n.z, r: G.radius, t: G.last, owner: n.owner });
    } else if (n.type === 'decoy') this.effects.push({ type: 'decoy', x: n.x, y: n.y, z: n.z, r: 0, t: G.last, wid: (owner && owner.inv[1] && owner.inv[1].wid) || 'ak47' });
    this.event('nadefx', { type: n.type, x: n.x, y: n.y, z: n.z, owner: n.owner });
    this.send('fx', this.effects); this.onLocal('fx', this.effects);
  }
  throwNade(p, type, pos, vel) {
    const k = p.nades.indexOf(type); if (k < 0 || !p.alive) return;
    p.nades.splice(k, 1);
    const n = { id: this.nid++, type, owner: p.id, x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z, age: 0 };
    this.nades.push(n); this.send('nade', n); this.onLocal('nade', n); this.sendInv(p);
  }
  // ---- damage & kills ----
  // a reported hit (from a human's machine: checked for plausibility) or a bot/host hit
  shot(p, wid, hits, origin) {
    const w = W_BY_ID[wid]; if (!w || !p.alive) return;
    const now = performance.now() / 1000;
    if (!p.bot && now - p.lastShot < 60 / w.rpm * 0.7 && w.cat !== 'knife') return;  // faster than the gun can fire
    p.lastShot = now;
    if (w.cat === 'zeus') { if (!p.inv[6]) return; delete p.inv[6]; if (p.cur === 6) p.cur = 3; this.sendInv(p); }  // one charge
    const maxHits = (w.pellets || 1) * 2;
    for (const h of (hits || []).slice(0, maxHits)) {
      const v = this.players.get(h.id); if (!v || !v.alive) continue;
      const dist = Math.hypot(v.x - origin.x, v.z - origin.z);
      if (w.cat === 'knife' || w.cat === 'zeus') { if (dist > (w.range || 2) + 1.2) continue; }
      if (!p.bot && dist > 3 && !this.W.los({ x: origin.x, y: origin.y, z: origin.z }, { x: v.x, y: v.y + 1.2, z: v.z }) && !(h.pen < 1)) continue;
      let r;
      if (w.cat === 'knife') { const back = this.isBackstab(p, v); const base = h.heavy ? (back ? w.backstab[1] : w.heavy) : (back ? w.backstab[0] : w.dmg); r = damageFor({ ...w, dmg: base, rm: 1, headMult: 1 }, 0, 'chest', v.armor, v.helmet); }
      else r = damageFor(w, dist, h.group, v.armor, v.helmet, Math.max(0.1, Math.min(1, h.pen || 1)));
      v.armor = Math.max(0, v.armor - r.armor);
      this.damage(v, p, r.hp, wid, h.group, (h.pen || 1) < 1);
    }
  }
  isBackstab(a, v) { const ang = Math.atan2(a.x - v.x, a.z - v.z), face = v.yaw; let d = Math.abs(((ang - face + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return d < 1.0; }
  damage(v, by, amount, weapon, group, wallbang, silent) {
    if (!v.alive || amount <= 0) return;
    if (by && by.team === v.team && by !== v && weapon !== 'he' && weapon !== 'molotov' && weapon !== 'incendiary') return;  // no friendly fire from bullets
    const dealt = Math.min(v.hp, amount);
    v.hp -= amount;
    if (by && by !== v) by.dmgDealt.set(v.id, (by.dmgDealt.get(v.id) || 0) + dealt);
    const info = { id: v.id, hp: Math.max(0, Math.round(v.hp)), armor: Math.round(v.armor), from: by ? [by.x, by.z] : null, by: by ? by.id : null, dmg: Math.round(dealt), group };
    if (v.local) this.onLocal('hurt', info); else if (!v.bot) this.send('hurt', info, v.id);
    if (by && !by.bot && by !== v) { const m = { id: v.id, dmg: Math.round(dealt), group, kill: v.hp <= 0 }; if (by.local) this.onLocal('hitconfirm', m); else this.send('hitconfirm', m, by.id); }
    if (v.hp <= 0) this.kill(v, by, weapon, group === 'head', wallbang);
  }
  kill(v, by, weapon, head, wallbang) {
    v.alive = false; v.hp = 0; v.d++; v.defusing = false; v.plant = false;
    this.dropAll(v);
    for (const n of v.nades.splice(0)) if (n === 'he' || n === 'molotov' || n === 'incendiary' || n === 'smoke' || n === 'flash' || n === 'decoy') { /* dropped grenades vanish to keep it light */ }
    v.inv = {}; v.armor = 0; v.helmet = false; v.defuser = false;
    let assist = null;
    for (const p of this.players.values()) if (p !== by && p !== v && p.team !== v.team && (p.dmgDealt.get(v.id) || 0) >= 41) { assist = p; p.a++; p.score += 1; break; }
    if (by && by !== v) {
      if (by.team === v.team) { by.money = Math.max(0, by.money + ECON.teamKillPenalty); by.k--; by.score -= 2; }
      else {
        by.k++; by.score += 2; if (head) by.hs++;
        const w = W_BY_ID[weapon]; const reward = w ? w.reward : 300;
        by.money = Math.min(ECON.max, by.money + reward);
        this.roundKills.set(by.id, (this.roundKills.get(by.id) || 0) + 1);
        this.sendInv(by);
      }
    }
    this.event('kill', { killer: by ? by.name : '', kteam: by ? by.team : '', kid: by ? by.id : null, victim: v.name, vteam: v.team, vid: v.id, weapon, head, wallbang, assist: assist ? assist.name : '' });
    this.checkWin();
  }
  scoreboard() { return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.bot, k: p.k, a: p.a, d: p.d, mvp: p.mvp, score: p.score, hs: p.hs, money: p.money, alive: p.alive, ping: p.ping })); }
  // the snapshot everyone renders from (~20/s)
  snap() {
    return { ph: this.phase, tm: Math.max(0, this.timer).toFixed(1) * 1, r: this.round, sc: this.score,
      p: [...this.players.values()].map((p) => [p.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2), +p.pitch.toFixed(2), +p.crouch.toFixed(1), Math.max(0, Math.round(p.hp)), p.alive ? 1 : 0,
        (p.inv[p.cur] || {}).wid || 'knife', p.inv[5] ? 1 : 0, p.planting ? +(p.planting / BOMB.plant).toFixed(2) : 0, Math.round(p.armor), p.helmet ? 1 : 0, p.money]),
      b: this.bomb ? { s: this.bomb.state, x: this.bomb.x, y: this.bomb.y, z: this.bomb.z, t: this.bomb.timer != null ? +this.bomb.timer.toFixed(1) : null, d: this.bomb.dprog ? +(this.bomb.dprog / (this.bomb.kit ? BOMB.defuseKit : BOMB.defuse)).toFixed(2) : 0, site: this.bomb.site } : null };
  }
}
