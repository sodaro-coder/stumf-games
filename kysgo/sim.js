// The rules. Movement and shot tracing are shared by everyone (players predict locally, bots run on the host); the
// Match runs only on the host (or alone in solo play): rounds, economy, the bomb, damage, grenades, drops, buying.
import { PHYS, ECON, BOMB, MODES, ARMS, W_BY_ID, G_BY_ID, GEAR_BY_ID, MAX_GRENADES, slotOf, forTeam, itemPrice, damageFor, U, LEAN } from './data.js';

// ---- movement (classic ground accel/friction, air strafing, jumping, crouching, stepping up ledges) ---------------
// movement lives in controller.js (Source/Quake kinematic controller, CS:GO cvars); re-exported for existing callers
export { moveStep } from './controller.js';
// hitscan, hitboxes, spread and recoil live in weapons.js (allocation free); re-exported for existing callers
export { traceShot, hitboxes, spreadOf, recoilAt, aimDir, TraceResult, RecoilState } from './weapons.js';
export { LEAN };
export const eyeHeight = (p) => { const e = PHYS.eye - (PHYS.eye - PHYS.crouchEye) * p.crouch; return e + (PHYS.proneEye - e) * (p.prone || 0); };
export const speedOf = (p) => Math.hypot(p.vx, p.vz);

// ---- hitboxes and shot tracing -----------------------------------------------------------------------------------
// leaning (aimed in, Q / E): the head and chest really move sideways, so you show only what you peek with
export const leanOff = (p, f = 1) => { const l = (p.lean || 0) * LEAN * f; return { x: Math.cos(p.yaw || 0) * l, z: -Math.sin(p.yaw || 0) * l }; };
export const eyePos = (p) => { const o = leanOff(p); return { x: p.x + o.x, y: p.y + eyeHeight(p) - Math.abs(p.lean || 0) * 0.05, z: p.z + o.z }; };

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
const ZED = ['Rotting Randy', 'Gutless Gus', 'Moldy Marge', 'Jawless Jim', 'Crusty Carl', 'Leaky Lou', 'Smelly Shelly', 'No-Brain Brian', 'Ghoul Gary', 'Putrid Pam', 'Stiff Steve', 'Oozing Ozzy'];

export class Match {
  constructor({ W, mode, mapId, botLevel = 'normal', send, rng = Math.random, onLocal }) {
    this.W = W; this.mode = mode; this.M = MODES[mode]; this.mapId = mapId; this.botLevel = botLevel;
    this.send = send || (() => {}); this.rng = rng; this.onLocal = onLocal || (() => {});
    this.players = new Map(); this.score = { T: 0, CT: 0 }; this.round = 0; this.phase = 'warmup'; this.timer = 0; this.lossStreak = { T: 1, CT: 1 };
    this.bomb = null; this.nades = []; this.effects = []; this.drops = []; this.history = []; this.nid = 1; this.firstRound = true; this.over = null;
    this.swapped = false; this.roundKills = new Map();
    this.kind = this.M.kind || 'rounds'; this.wave = 0; this.kz = new Map();
  }
  get respawns() { return this.kind === 'dm' || this.kind === 'arms'; }
  // ---- roster ----
  add(id, info) {
    const teamCount = (t) => [...this.players.values()].filter((p) => p.team === t).length;
    const team = (this.kind === 'zombies' || this.kind === 'kz') && !info.bot ? 'CT' : info.team || (teamCount('T') <= teamCount('CT') ? 'T' : 'CT');
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
  broadcastRoster() { this.rosterVer = (this.rosterVer || 0) + 1; this.send('roster', [...this.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.bot, agent: p.agent, knife: p.knife, att: ((p.loadout || {})[p.team] || {}).att || null, look: p.lookAs || null }))); }

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
    if (p.forceCur) { msg.cur = p.cur; p.forceCur = false; }
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
    if (this.kind === 'dm') { if (slotOf(item) === 1 || slotOf(item) === 2) p.dmGun = Object.assign(p.dmGun || {}, { [slotOf(item)]: item }); p.money = ECON.max; }
    this.sendInv(p);
    return '';
  }
  canBuy(p) {
    if (this.kind === 'arms' || this.kind === 'retake' || this.kind === 'kz') return false;
    if (this.kind === 'dm') return p.alive;   // deathmatch: buy anywhere, any time
    if (this.kind === 'zombies') return p.team === 'CT' && this.phase === 'freeze';   // between waves, anywhere
    return (this.phase === 'freeze' || (this.phase === 'live' && this.M.round - this.timer < this.M.buyTime)) && this.W.inRect(this.W.B.buy[p.team], p.x, p.z);
  }

  // ---- rounds ----
  start() { this.phase = 'freeze'; this.newRound(true); }
  spawn(p) {
    if (this.respawns && this.phase === 'live') return this.spawnSafe(p);
    if (this.kind === 'retake' && p.team === 'T' && this.retakeSite) return this.spawnAt(p, this.W.randomIn(this.retakeSite), Math.PI);
    if (this.kind === 'zombies' && p.team === 'T') return this.spawnAt(p, this.W.randomIn(this.W.B.buy.T), 0, 100 + 35 * Math.max(0, this.wave - 1));
    const pts = (this.M.size === 1 ? this.W.B.duel[p.team] : null) || this.W.B.spawns[p.team];
    const same = [...this.players.values()].filter((q) => q.team === p.team);
    const k = Math.max(0, same.indexOf(p));
    const [x, z, yaw] = pts[k % pts.length];
    p.x = x + (k >= pts.length ? 0.8 : 0); p.z = z; p.y = this.W.groundAt(p.x, p.z, 10); p.yaw = yaw; p.pitch = 0; p.vx = p.vy = p.vz = 0; p.crouch = 0;
    p.alive = true; p.hp = 100;
    if (p.local) this.onLocal('spawn', { x: p.x, y: p.y, z: p.z, yaw }); else if (!p.bot) this.send('spawn', { x: p.x, y: p.y, z: p.z, yaw }, p.id);
  }
  // a respawn spot well away from living enemies (deathmatch / arms race)
  spawnSafe(p) {
    const all = [...this.W.B.spawns.T, ...this.W.B.spawns.CT, ...((this.W.B.duel || {}).T || []), ...((this.W.B.duel || {}).CT || [])];
    const foes = [...this.players.values()].filter((q) => q.alive && q.team !== p.team && q !== p);
    let best = all[0], bd = -1;
    for (let k = 0; k < 8; k++) {
      const c = all[Math.floor(this.rng() * all.length)];
      const d = foes.length ? Math.min(...foes.map((q) => Math.hypot(q.x - c[0], q.z - c[1]))) : 99;
      if (d > bd) { bd = d; best = c; }
    }
    this.spawnAt(p, [best[0] + (this.rng() - 0.5), best[1] + (this.rng() - 0.5)], best[2] || 0);
    this.loadout(p);
  }
  spawnAt(p, xz, yaw, hp = 100) {
    p.x = xz[0]; p.z = xz[1]; p.y = this.W.groundAt(p.x, p.z, 10); p.yaw = yaw; p.pitch = 0; p.vx = p.vy = p.vz = 0; p.crouch = 0;
    p.alive = true; p.hp = hp; p.maxHp = hp;
    if (p.local) this.onLocal('spawn', { x: p.x, y: p.y, z: p.z, yaw }); else if (!p.bot) this.send('spawn', { x: p.x, y: p.y, z: p.z, yaw }, p.id);
  }
  // what a (re)spawning player carries in the modes that hand out weapons
  loadout(p) {
    if (this.kind === 'dm') {
      p.inv = { 3: { wid: 'knife' } }; this.give(p, (p.dmGun && p.dmGun[2]) || this.defaultPistol(p.team, p));
      this.give(p, (p.dmGun && p.dmGun[1]) || (p.team === 'T' ? 'ak47' : 'm4a1s')); p.armor = 100; p.helmet = true; p.money = ECON.max; p.cur = 1;
    } else if (this.kind === 'arms') this.armsGive(p);
    else if (this.kind === 'retake') {
      const r = this.rng(), rifle = p.team === 'T' ? (r < 0.15 ? 'awp' : r < 0.6 ? 'ak47' : 'galil') : (r < 0.15 ? 'awp' : r < 0.6 ? 'm4a1s' : 'famas');
      p.inv = { 3: { wid: 'knife' } }; this.give(p, this.defaultPistol(p.team, p)); this.give(p, rifle);
      p.armor = 100; p.helmet = true; p.defuser = p.team === 'CT' && this.rng() < 0.5; p.nades = [];
      for (const n of ['flash', 'smoke', 'he', p.team === 'T' ? 'molotov' : 'incendiary']) if (this.rng() < 0.45 && p.nades.length < 2) p.nades.push(n);
      p.cur = 1;
    } else if (this.kind === 'zombies' && p.team === 'T') { p.inv = { 3: { wid: 'knife' } }; p.cur = 3; p.armor = 0; p.zombie = true; }
    else if (this.kind === 'kz') { p.inv = { 3: { wid: 'knife' } }; this.give(p, 'usp'); p.cur = 3; }
    p.forceCur = true; this.sendInv(p);
  }
  armsGive(p) {
    const wid = ARMS[Math.min(p.lvl || 0, ARMS.length - 1)];
    p.inv = { 3: { wid: 'knife' } }; p.nades = [];
    if (wid !== 'knife') { this.give(p, wid); p.cur = slotOf(wid); } else p.cur = 3;
    p.armor = 100; p.helmet = false; p.forceCur = true; this.sendInv(p);
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
    if (this.kind === 'retake') this.retakeSetup();
    else if (this.M.bomb) { const ts = [...this.players.values()].filter((p) => p.team === 'T'); if (ts.length) { const c = ts[Math.floor(this.rng() * ts.length)]; c.inv[5] = { wid: 'c4' }; } }
    if (this.kind !== 'rounds' && this.kind !== 'retake') for (const p of this.players.values()) this.loadout(p);
    if (this.kind === 'zombies') this.zombieWave();
    if (this.M.size === 1 && this.round === 1) for (const p of this.players.values()) p.money = 800;
    for (const p of this.players.values()) this.sendInv(p);
    this.phase = 'freeze'; this.timer = this.M.freeze;
    this.event('round', { n: this.round, phase: 'freeze', score: this.score });
  }
  // retakes: the bomb is already down on a random site, Ts spawn on it, everyone gets a loadout
  retakeSetup() {
    const sites = Object.keys(this.W.B.sites), key = sites[Math.floor(this.rng() * sites.length)] || 'A', r = this.W.B.sites[key];
    this.retakeSite = r;
    const [x, z] = this.W.randomIn([r[0] + 2, r[1] + 2, r[2] - 2, r[3] - 2]);
    this.bomb = { state: 'planted', x, y: this.W.groundAt(x, z, 10), z, timer: BOMB.timer, planter: null, site: key, defuser: null, dprog: 0 };
    for (const p of this.players.values()) { if (p.team === 'T') this.spawnAt(p, this.W.randomIn(r), Math.PI); this.loadout(p); }
    this.send('bomb', this.bomb); this.onLocal('bomb', this.bomb);
    this.event('banner', { text: `Retake ${key}`, sub: 'The bomb is planted. CTs: retake and defuse. Ts: hold it.' });
  }
  // zombies: a fresh wave of shambling dead (bots on T), bigger and tougher each time; the living are revived
  zombieWave() {
    this.wave++;
    const want = Math.min(12, 3 + this.wave * 2);
    for (const [id, p] of [...this.players]) if (p.team === 'T' && p.bot) this.players.delete(id);
    for (let k = 0; k < want; k++) { const id = 'zed' + (this.nid++); const z = this.add(id, { name: ZED[(this.wave + k) % ZED.length], bot: true, team: 'T' }); z.lookAs = 'zombie_' + 'abc'[k % 3]; }
    for (const p of this.players.values()) if (p.team === 'T') { this.spawn(p); this.loadout(p); }
    this.broadcastRoster();
    this.event('banner', { text: `Wave ${this.wave}`, sub: `${want} of them. Buy now, they're coming.` });
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
    if (this.score.T >= W2 || this.score.CT >= W2 || total >= (this.M.max || this.M.half * 2)) {
      this.phase = 'over'; this.timer = 12;
      const w = this.score.T > this.score.CT ? 'T' : this.score.CT > this.score.T ? 'CT' : null;
      this.over = { winner: w };
      this.event('matchEnd', { winner: w, score: this.score, players: this.scoreboard() });
    }
  }
  event(type, data) { this.send('ev', { type, data }); this.onLocal('ev', { type, data }); }
  checkWin() {
    if (this.phase !== 'live' && this.phase !== 'planted') return;
    if (this.respawns || this.kind === 'kz') return;
    if (this.kind === 'zombies') {
      const humans = [...this.players.values()].filter((p) => p.team === 'CT');
      if (humans.length && !humans.some((p) => p.alive)) { this.score.T = this.wave; this.finish('T'); this.event('banner', { text: `Overrun on wave ${this.wave}`, sub: `You survived ${this.wave - 1} wave${this.wave === 2 ? '' : 's'}` }); return; }
      if (![...this.players.values()].some((p) => p.team === 'T' && p.alive)) {   // wave cleared: revive, cash, short break, next wave
        this.score.CT = this.wave;
        for (const p of humans) { p.money = Math.min(ECON.max, p.money + 800 + 200 * this.wave); if (!p.alive) { this.spawn(p); this.give(p, this.defaultPistol('CT', p)); } this.sendInv(p); }
        this.event('banner', { text: `Wave ${this.wave} cleared`, sub: 'Buy up. The next one is bigger.' });
        this.phase = 'freeze'; this.timer = this.M.freeze; this.zombieWave();
        this.event('round', { n: this.wave, phase: 'freeze', score: this.score });
      }
      return;
    }
    const alive = (t) => [...this.players.values()].some((p) => p.team === t && p.alive);
    if (!alive('CT') && alive('T')) return this.endRound('T', 'elim');
    if (!alive('T') && alive('CT') && !(this.bomb && (this.bomb.state === 'planted' || this.bomb.state === 'exploded'))) return this.endRound('CT', 'elim');
    if (!alive('T') && !alive('CT')) return this.endRound(this.bomb && this.bomb.state === 'planted' ? 'T' : 'CT', 'elim');
  }
  tick(dt) {
    this.timer -= dt;
    if (this.phase === 'freeze' && this.timer <= 0) {
      this.phase = this.kind === 'retake' && this.bomb ? 'planted' : 'live'; this.timer = this.M.round; this.event('round', { n: this.round, phase: 'live', score: this.score });
    }
    else if (this.phase === 'live' && this.timer <= 0) {
      if (this.respawns) this.finish(this.score.T > this.score.CT ? 'T' : this.score.CT > this.score.T ? 'CT' : null);
      else if (!this.M.bomb) this.endRound(null, 'time'); else this.endRound('CT', 'time');
    } else if (this.phase === 'planted') {
      const b = this.bomb; b.timer -= dt;
      if (b.defuser) {
        const d = this.players.get(b.defuser);
        if (!d || !d.alive || Math.hypot(d.x - b.x, d.z - b.z) > 1.8 || !d.defusing) { b.defuser = null; b.dprog = 0; this.send('bomb', this.bomb); this.onLocal('bomb', this.bomb); }
        else { b.dprog += dt; if (b.dprog >= (d.defuser ? BOMB.defuseKit : BOMB.defuse) && b.timer > 0) { b.state = 'defused'; d.money = Math.min(ECON.max, d.money + ECON.defuseReward); d.score += 2; this.send('bomb', b); this.onLocal('bomb', b); this.event('sound', { s: 'defused', x: b.x, z: b.z }); this.endRound('CT', 'defuse'); } }
      }
      if (b.state === 'planted' && b.timer <= 0) {
        b.state = 'exploded'; this.send('bomb', b); this.onLocal('bomb', b);
        this.endRound('T', 'bomb');   // first: the blast killing the planter must not hand CT an elimination win
        for (const p of this.players.values()) if (p.alive) { const dist = Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z); if (dist < BOMB.radius) { const dmg = BOMB.dmg * Math.exp(-((dist / (BOMB.radius / 3)) ** 2)); this.damage(p, null, Math.round(dmg * (p.armor ? 0.5 : 1)), 'bomb', 'chest', false); } }
        this.event('explode', { x: b.x, y: b.y, z: b.z, r: BOMB.radius });
      }
    } else if (this.phase === 'end' && this.timer <= 0) this.newRound();
    else if (this.phase === 'over' && this.timer <= 0) { this.phase = 'done'; this.event('done', {}); }
    if (this.respawns && this.phase === 'live') { const now = performance.now() / 1000; for (const p of this.players.values()) if (!p.alive && p.respawnAt && now >= p.respawnAt) { p.respawnAt = 0; this.spawnSafe(p); } }
    if (this.kind === 'kz') this.kzTick();
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
  // ---- climb (KZ): start pad, checkpoints, finish pad; falling resets you to your last checkpoint ----
  kzTick() {
    const K = this.W.B.kz; if (!K) return;
    const now = performance.now() / 1000;
    for (const p of this.players.values()) {
      if (!p.alive || p.bot) continue;
      const s = this.kz.get(p.id) || { cp: -1, t0: 0, run: false, best: 0 };
      if (this.W.inRect(K.start, p.x, p.z) && p.onGround) { s.cp = -1; s.run = false; }
      else if (!s.run && s.cp === -1 && !this.W.inRect(K.start, p.x, p.z)) { s.run = true; s.t0 = now; this.kzSay(p, 'Timer started', ''); }
      K.cps.forEach((r, i) => { if (s.run && i > s.cp && this.W.inRect(r, p.x, p.z)) { s.cp = i; this.kzSay(p, `Checkpoint ${i + 1}/${K.cps.length}`, (now - s.t0).toFixed(2) + ' s'); } });
      if (s.run && this.W.inRect(K.finish, p.x, p.z)) {
        const t = now - s.t0; s.run = false; const pb = !s.best || t < s.best; if (pb) s.best = t;
        this.kzSay(p, pb ? 'NEW BEST' : 'Finished', `${t.toFixed(2)} s${s.best ? ' · best ' + s.best.toFixed(2) + ' s' : ''}`);
        this.event('kz', { id: p.id, name: p.name, t: +t.toFixed(3), best: +s.best.toFixed(3) });
        this.spawnAt(p, this.W.randomIn(K.start), K.yaw || 0);
      }
      if (p.y < (K.floor != null ? K.floor : -2)) {   // fell: back to the last checkpoint (or the start)
        const r = s.cp >= 0 ? K.cps[s.cp] : K.start;
        this.spawnAt(p, [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2], K.yaw || 0); if (s.cp < 0) s.run = false;
      }
      this.kz.set(p.id, s);
    }
  }
  kzSay(p, text, sub) { const m = { type: 'banner', data: { text, sub } }; if (p.local) this.onLocal('ev', m); else this.send('ev', m, p.id); }
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
    if (this.onDamaged && by && by !== v) this.onDamaged(v, by);   // bots turn on whoever shot them
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
    if (this.respawns && this.phase === 'live') v.respawnAt = performance.now() / 1000 + (this.M.respawn || 2);
    if (this.kind === 'dm' && by && by !== v && by.team !== v.team) { this.score[by.team]++; if (this.score[by.team] >= (this.M.killsTo || 50)) this.finish(by.team); }
    if (this.kind === 'arms' && by && by !== v && by.team !== v.team) {
      if (ARMS[by.lvl || 0] === 'knife' && weapon === 'knife') this.finish(by.team, by);
      else if (weapon !== 'knife' || ARMS[by.lvl || 0] === 'knife') { by.lvl = Math.min(ARMS.length - 1, (by.lvl || 0) + 1); by.score += 1; if (by.alive) this.armsGive(by); }
      else if (weapon === 'knife') { v.lvl = Math.max(0, (v.lvl || 0) - 1); by.lvl = Math.min(ARMS.length - 1, (by.lvl || 0) + 1); if (by.alive) this.armsGive(by); }   // knifed: you go down a gun
      this.score[by.team] = Math.max(...[...this.players.values()].filter((q) => q.team === by.team).map((q) => q.lvl || 0));
    }
    this.event('kill', { fx: by && this.killFx ? this.killFx(by, weapon) : null, killer: by ? by.name : '', kteam: by ? by.team : '', kid: by ? by.id : null, victim: v.name, vteam: v.team, vid: v.id, weapon, head, wallbang, assist: assist ? assist.name : '' });
    this.checkWin();
  }
  // a match decided by a target (kills / the last gun) rather than rounds
  finish(team, who) {
    if (this.phase === 'over' || this.phase === 'done') return;
    this.phase = 'over'; this.timer = 12; this.over = { winner: team };
    this.event('roundEnd', { winner: team, reason: 'elim', text: who ? `${who.name} finished the ladder` : !team ? 'Draw' : (team === 'T' ? 'Terrorists Win' : 'Counter-Terrorists Win'), mvp: who ? who.name : '', score: this.score, history: this.history });
    this.event('matchEnd', { winner: team, score: this.score, players: this.scoreboard() });
  }
  scoreboard() { return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.bot, k: p.k, a: p.a, d: p.d, mvp: p.mvp, score: p.score, hs: p.hs, money: p.money, alive: p.alive, ping: p.ping })); }
  // the snapshot everyone renders from (~20/s)
  snap() {
    return { ph: this.phase, tm: Math.max(0, this.timer).toFixed(1) * 1, r: this.round, sc: this.score,
      p: [...this.players.values()].map((p) => [p.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2), +p.pitch.toFixed(2), +p.crouch.toFixed(1), Math.max(0, Math.round(p.hp)), p.alive ? 1 : 0,
        (p.inv[p.cur] || {}).wid || 'knife', p.inv[5] ? 1 : 0, p.planting ? +(p.planting / BOMB.plant).toFixed(2) : 0, Math.round(p.armor), p.helmet ? 1 : 0, p.money, +(p.lean || 0).toFixed(2), +(p.prone || 0).toFixed(1), p.reloading ? 1 : 0]),
      b: this.bomb ? { s: this.bomb.state, x: this.bomb.x, y: this.bomb.y, z: this.bomb.z, t: this.bomb.timer != null ? +this.bomb.timer.toFixed(1) : null, d: this.bomb.dprog ? +(this.bomb.dprog / (this.bomb.kit ? BOMB.defuseKit : BOMB.defuse)).toFixed(2) : 0, site: this.bomb.site } : null };
  }
}
