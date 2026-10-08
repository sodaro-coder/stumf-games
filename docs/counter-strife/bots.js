// Bots (run on the host). They buy like players do, split between bomb sites, take routes on the nav grid, hold
// angles, react to what they see and hear, plant, defuse, pick up the bomb and trade. Difficulty (picked by the
// host) sets reaction time, aim error, turn speed, headshot chance and spray control.
import { W_BY_ID, BOT_LEVELS, PHYS, BOMB } from './data.js';
import { moveStep, traceShot, eyeHeight, spreadOf, recoilAt, speedOf } from './sim.js';

const NAMES = ['Gassy Gary', 'Moist Mike', 'Butt Crack Barry', 'Stinky Pete', 'Diarrhea Dan', 'Skidmark Steve', 'Big Lenny', 'Booger', 'Lil Nugget', 'Sweaty Steve', 'Toilet Tom', 'Wet Willy', 'Bubba', 'Ur Mom', 'Dwayne', 'Pickle', 'Noodle', 'Chungus'];
export const botNames = (seed = 0) => NAMES.slice(seed % NAMES.length).concat(NAMES.slice(0, seed % NAMES.length));

const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export class Bots {
  constructor(match) {
    this.m = match; this.brain = new Map(); this.plan = null; this.thinkT = 0;
    match.onDamaged = (v, by) => { if (!v.bot) return; const b = this.B(v); b.hitBy = { id: by.id, x: by.x, z: by.z, t: 2 }; if (!b.target) { const want = Math.atan2(-(by.x - v.x), -(by.z - v.z)); v.yaw += angDiff(v.yaw, want) * 0.5; } };
  }
  B(p) { let b = this.brain.get(p.id); if (!b) this.brain.set(p.id, (b = { path: null, pi: 0, goal: null, target: null, react: 0, seen: 0, spray: 0, cd: 0, stuck: 0, lx: 0, lz: 0, hold: null, bought: -1, wait: 0, aiming: false, blind: 0, burst: 0, strafe: 1, strafeT: 0, heard: null, lastPath: 0 })); return b; }
  lvl() { return BOT_LEVELS[this.m.botLevel] || BOT_LEVELS.normal; }

  // ---- buying ----
  buy(p) {
    const m = this.m, b = this.B(p); if (b.bought === m.round) return; b.bought = m.round;
    const T = p.team === 'T', money = () => p.money, try_ = (it) => m.buy(p, it) === '';
    const pistolRound = m.round === 1 || m.round === m.M.half + 1;
    if (pistolRound) { if (money() >= 650 && Math.random() < 0.6) try_('vest'); else if (money() >= 300) try_('p250'); if (money() >= 200 && Math.random() < 0.5) try_('flash'); return; }
    const rifle = T ? 'ak47' : (Math.random() < 0.5 ? 'm4a4' : 'm4a1s');
    const sniper = [...m.players.values()].filter((q) => q.bot && q.team === p.team).sort((a, c) => (a.id < c.id ? -1 : 1))[0] === p;
    if (!p.inv[1] || p.inv[1].wid === 'mac10' || p.inv[1].wid === 'mp9') {
      if (sniper && money() >= 5800 && Math.random() < 0.6) try_('awp');
      else if (money() >= (T ? 3700 : 4100)) try_(rifle);
      else if (money() >= 2800 && Math.random() < 0.5) try_(T ? 'galil' : 'famas');
      else if (money() >= 2000 && Math.random() < 0.4) try_(T ? 'mac10' : 'mp9');
    }
    if (p.inv[1] && money() >= 1000) try_('vesthelm'); else if (p.inv[1] && money() >= 650) try_('vest');
    if (!T && money() >= 400 && Math.random() < 0.6) try_('defuser');
    for (const n of ['flash', 'smoke', 'he', T ? 'molotov' : 'incendiary']) if (money() >= 600 && Math.random() < 0.55) try_(n);
    if (!p.inv[1] && money() >= 700 && Math.random() < 0.3) try_('deagle');
  }

  // ---- plan for the round (shared by the team) ----
  newRound() {
    const sites = Object.keys(this.m.W.B.sites).filter((s) => !this.m.M.bombSite || s === this.m.M.bombSite);
    this.plan = { site: sites[Math.floor(Math.random() * sites.length)] || 'A', rush: Math.random() < 0.35, ctSplit: {} };
    let k = 0; for (const p of this.m.players.values()) if (p.bot && p.team === 'CT') this.plan.ctSplit[p.id] = sites[(k++) % sites.length];
    for (const b of this.brain.values()) { b.path = null; b.goal = null; b.target = null; b.hold = null; b.wait = Math.random() * (this.plan.rush ? 1 : 8); }
  }

  tick(dt) {
    const m = this.m; if (m.phase === 'warmup' || m.phase === 'done') return;
    if (m.phase === 'freeze' && this.plannedRound !== m.round) { this.plannedRound = m.round; this.newRound(); }
    this.thinkT -= dt; const think = this.thinkT <= 0; if (think) this.thinkT = 0.1;
    for (const p of m.players.values()) if (p.bot) this.step(p, dt, think);
  }

  visible(p, q) {
    const W = this.m.W, a = { x: p.x, y: p.y + eyeHeight(p), z: p.z }, t = { x: q.x, y: q.y + 1.3 - q.crouch * 0.4, z: q.z };
    if (!W.los(a, t)) return false;
    for (const e of this.m.effects) if (e.type === 'smoke') {  // segment-sphere: smokes block sight
      const dx = t.x - a.x, dz = t.z - a.z, L2 = dx * dx + dz * dz, u = Math.max(0, Math.min(1, ((e.x - a.x) * dx + (e.z - a.z) * dz) / (L2 || 1)));
      if (Math.hypot(a.x + dx * u - e.x, a.z + dz * u - e.z) < e.r * 0.9) return false;
    }
    return true;
  }

  step(p, dt, think) {
    const m = this.m, W = m.W, b = this.B(p), L = this.lvl();
    if (!p.alive) { p.plant = false; p.defusing = false; return; }
    if (m.phase === 'freeze') { this.buy(p); p.vx = p.vz = 0; return; }
    if (m.phase === 'end' || m.phase === 'over') { this.walkTo(p, b, null, dt); return; }
    b.blind = Math.max(0, b.blind - dt); b.cd -= dt;
    const wSlot = p.inv[1] ? 1 : p.inv[2] ? 2 : 3; if (p.cur !== wSlot && !(p.cur === 5 && p.plant && !b.target)) p.cur = wSlot;
    const it = p.inv[p.cur], w = W_BY_ID[(it || {}).wid] || W_BY_ID.knife;
    // ---- perception ----
    if (think) {
      let best = null, bd = 1e9;
      if (b.blind <= 0) for (const q of m.players.values()) {
        if (!q.alive || q.team === p.team) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        const off = Math.abs(angDiff(p.yaw, Math.atan2(-dx, -dz)));
        const fov = off < 1.15 || d < 4 || (b.heard && Math.hypot(b.heard.x - q.x, b.heard.z - q.z) < 6) || (b.hitBy && b.hitBy.id === q.id);
        if (fov && d < 90 && d < bd && this.visible(p, q)) { best = q; bd = d; b.bestOff = off; }
      }
      if (best && (!b.target || b.target !== best.id)) {   // reacting takes longer for someone at the edge of your view
        b.target = best.id; b.react = L.react * (0.7 + Math.random() * 0.6) + (b.seen > 0 ? 0 : 0.1) + Math.max(0, (b.bestOff || 0) - 0.4) * 0.35; b.spray = 0; b.settle = 0;
      }
      if (!best && b.target) { const q = m.players.get(b.target); b.lastSeen = q ? { x: q.x, z: q.z, t: 3 } : null; b.target = null; }
      if (best) b.seen = 0.5; else b.seen -= 0.1;
    }
    if (b.hitBy && (b.hitBy.t -= dt) <= 0) b.hitBy = null;
    const tgt = b.target ? m.players.get(b.target) : null;
    // ---- combat ----
    if (tgt && tgt.alive) {
      const eye = { x: p.x, y: p.y + eyeHeight(p), z: p.z };
      const head = Math.random() < L.head;
      const aimY = tgt.y + (head ? 1.68 : 1.25) * (1 - tgt.crouch * 0.28);
      const dx = tgt.x - eye.x, dz = tgt.z - eye.z, dy = aimY - eye.y, d = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(-dx, -dz), wantPitch = Math.atan2(dy, d);
      const turn = L.turn * dt;
      const ey = angDiff(p.yaw, wantYaw); p.yaw += Math.max(-turn, Math.min(turn, ey));
      p.pitch += Math.max(-turn, Math.min(turn, wantPitch - p.pitch));
      b.react -= dt; b.settle = (b.settle || 0) + dt;
      // strafe peek / stop to shoot
      b.strafeT -= dt; if (b.strafeT <= 0) { b.strafeT = 0.3 + Math.random() * 0.6; b.strafe = -b.strafe; }
      const precise = w.cat === 'rifle' || w.cat === 'sniper' || w.cat === 'pistol';
      const stopToShoot = precise && L.spray > 0.6 && b.react <= 0;
      const inp = { f: w.cat === 'knife' ? 1 : 0, s: stopToShoot ? 0 : b.strafe * (w.cat === 'knife' ? 0.3 : 0.6), jump: false, crouch: L.spray > 0.8 && b.spray > 4 && w.cat !== 'sniper', walk: false };
      if (w.cat === 'knife' && d > 1.4) { this.walkTo(p, b, [tgt.x, tgt.z], dt, true); }
      else if (d > 22 && w.cat !== 'sniper' && !stopToShoot) { b.aiming = true; this.objectives(p, b, dt); b.aiming = false; }  // far away: keep pushing while shooting
      else moveStep(W, p, inp, dt, w.speed * 0.0254);
      const onTarget = Math.abs(ey) < 0.06 + 0.4 / Math.max(d, 1);
      if (b.react <= 0 && onTarget && b.cd <= 0 && it) {
        if (w.cat === 'knife') { if (d < 1.6) { m.shot(p, 'knife', [{ id: tgt.id, group: 'chest', pen: 1 }], eye); b.cd = 0.5; } }
        else if (p.nades.includes('he') && d > 8 && d < 26 && b.heRound !== m.round && Math.random() < 0.02) { b.heRound = m.round; this.throwAt(p, 'he', tgt.x, tgt.z); b.cd = 0.8; }
        else if (it.ammo > 0) {
          this.fire(p, b, w, it, eye, L);
        } else if (!b.reloading) { b.reloading = w.reload; }
      }
    } else {
      b.spray = 0;
      // ---- objectives ----
      this.objectives(p, b, dt);
      if (think && it && it.ammo < (W_BY_ID[it.wid] || {}).mag * 0.4 && !b.reloading && it.reserve > 0) b.reloading = (W_BY_ID[it.wid] || {}).reload || 2;
    }
    p.reloading = b.reloading > 0;
    if (b.reloading) { b.reloading -= dt; if (b.reloading <= 0) { b.reloading = 0; const ww = W_BY_ID[(p.inv[p.cur] || {}).wid]; const i2 = p.inv[p.cur]; if (ww && i2) { const take = Math.min(ww.mag - i2.ammo, i2.reserve); i2.ammo += take; i2.reserve -= take; } } }
  }

  fire(p, b, w, it, eye, L) {
    const m = this.m;
    if (b.reloading) return;
    if (!w.auto && b.spray > 0 && b.cd > -0.12) return;
    const burstLen = w.auto ? Math.round(L.burst * (0.6 + Math.random() * 0.8)) : 1;
    if (b.spray >= burstLen) { b.spray = 0; b.cd = 0.25 + Math.random() * 0.25; return; }
    it.ammo--; b.cd = 60 / w.rpm; b.spray++;
    const scoped = !!w.zoom;
    const rc = recoilAt(w, b.spray - 1), comp = L.spray;
    const settle = 1 + 1.6 * Math.exp(-(b.settle || 0) / 0.45), moving = Math.min(1, speedOf(p) / 2.5);
    const sp = spreadOf(w, p, scoped, b.spray) + L.aimErr * (0.4 + Math.random()) * settle * (1 + moving * 0.8);
    const players = [...m.players.values()];
    const hitsAll = [];
    for (let k = 0; k < (w.pellets || 1); k++) {
      const yaw = p.yaw + rc.side * (1 - comp) + (Math.random() - 0.5) * (sp + (w.spread || 0)), pitch = p.pitch + rc.up * (1 - comp) + (Math.random() - 0.5) * (sp + (w.spread || 0));
      const d = { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
      const tr = traceShot(m.W, players, p.id, eye, d, w);
      hitsAll.push(...tr.hits);
      if (k === 0) this.heard(eye.x, eye.z, p);
      if (k === 0) m.send('fire', { id: p.id, wid: w.id, o: [eye.x, eye.y, eye.z], e: tr.end ? [tr.end.x, tr.end.y, tr.end.z] : null }), m.onLocal('fire', { id: p.id, wid: w.id, o: [eye.x, eye.y, eye.z], e: tr.end ? [tr.end.x, tr.end.y, tr.end.z] : null });
    }
    if (hitsAll.length) m.shot(p, w.id, hitsAll, eye);
  }

  objectives(p, b, dt) {
    const m = this.m, W = m.W, plan = this.plan || { site: 'A' };
    p.plant = false; p.defusing = false;
    const bomb = m.bomb;
    if (b.lastSeen && b.lastSeen.t > 0) { b.lastSeen.t -= dt; if (b.lastSeen.t > 0 && !(m.M.bomb && p.team === 'T' && p.inv[5])) { this.walkTo(p, b, [b.lastSeen.x, b.lastSeen.z], dt); return; } }
    if (!m.M.bomb) { const e = [...m.players.values()].find((q) => q.alive && q.team !== p.team); if (e) this.walkTo(p, b, [e.x, e.z], dt); return; }
    if (p.team === 'T') {
      if (bomb && bomb.state === 'dropped') { const nearest = [...m.players.values()].filter((q) => q.alive && q.team === 'T').sort((a, c) => Math.hypot(a.x - bomb.x, a.z - bomb.z) - Math.hypot(c.x - bomb.x, c.z - bomb.z))[0]; if (nearest === p) return this.walkTo(p, b, [bomb.x, bomb.z], dt); }
      if (bomb && bomb.state === 'planted') {   // post-plant: hold near the bomb, watching where the CTs come from
        if (!b.hold || b.holdFor !== 'post') { b.hold = W.randomIn([bomb.x - 7, bomb.z - 7, bomb.x + 7, bomb.z + 7]); b.holdFor = 'post'; }
        if (Math.hypot(p.x - b.hold[0], p.z - b.hold[1]) < 1.2) {
          const cs = W.B.spawns.CT[0], toCT = Math.atan2(-(cs[0] - p.x), -(cs[1] - p.z)), toBomb = Math.atan2(-(bomb.x - p.x), -(bomb.z - p.z));
          const look = Math.sin(performance.now() / 1700 + p.x) > 0 ? toCT : toBomb;
          p.yaw += angDiff(p.yaw, look + Math.sin(performance.now() / 900 + p.z) * 0.5) * Math.min(1, dt * 3); moveStep(W, p, { f: 0, s: 0, crouch: false }, dt, 6); return;
        }
        return this.walkTo(p, b, b.hold, dt);
      }
      if ((b.wait -= dt) > (p.inv[5] && !plan.rush ? -4 : 0)) return;  // the bomb carrier lets the team go first
      const site = W.B.sites[plan.site];
      if (p.inv[5]) {
        if (W.siteAt(p.x, p.z) === plan.site && m.siteOk(p)) { p.vx *= 0.5; p.vz *= 0.5; p.cur = 5; p.plant = true; moveStep(W, p, { f: 0, s: 0 }, dt, 6); return; }
        if (!b.goal || b.goalFor !== 'plant') { b.goal = W.randomIn([site[0] + 2, site[1] + 2, site[2] - 2, site[3] - 2]); b.goalFor = 'plant'; }
        return this.walkTo(p, b, b.goal, dt);
      }
      if (!b.goal || b.goalFor !== 'site') { b.goal = W.randomIn(site); b.goalFor = 'site'; }
      const sc = [(site[0] + site[2]) / 2, (site[1] + site[3]) / 2], ds = Math.hypot(sc[0] - p.x, sc[1] - p.z);
      if (b.utilRound !== m.round && ds < 24 && ds > 9) { b.utilRound = m.round; for (const t of ['smoke', 'flash', 'molotov']) if (p.nades.includes(t) && Math.random() < 0.7) { this.throwAt(p, t, sc[0] + (Math.random() - 0.5) * 6, sc[1] + (Math.random() - 0.5) * 6); break; } }
      return this.walkTo(p, b, b.goal, dt);
    }
    // CT
    if (bomb && bomb.state === 'planted') {
      const d = Math.hypot(p.x - bomb.x, p.z - bomb.z);
      if (d < 1.2) { p.defusing = true; p.vx = p.vz = 0; return; }
      return this.walkTo(p, b, [bomb.x, bomb.z], dt);
    }
    const mySite = (plan.ctSplit || {})[p.id] || 'A', site = W.B.sites[mySite];
    if (!b.hold || b.holdFor !== mySite) { b.hold = W.randomIn(site); b.holdFor = mySite; }
    if (Math.hypot(p.x - b.hold[0], p.z - b.hold[1]) < 1.2) { // hold the angle towards the T side
      const ts = W.B.spawns.T[0]; const want = Math.atan2(-(ts[0] - p.x), -(ts[1] - p.z));
      p.yaw += angDiff(p.yaw, want + Math.sin(performance.now() / 1500 + p.x) * 0.6) * Math.min(1, dt * 2); moveStep(W, p, { f: 0, s: 0 }, dt, 6); return;
    }
    this.walkTo(p, b, b.hold, dt);
  }

  walkTo(p, b, goal, dt, noLook) {
    const W = this.m.W;
    if (!goal) { moveStep(W, p, { f: 0, s: 0 }, dt, 6); return; }
    const now = performance.now();
    if (!b.path || !b.pathGoal || Math.hypot(b.pathGoal[0] - goal[0], b.pathGoal[1] - goal[1]) > 2 || (b.stuck > 1.2 && now - b.lastPath > 800)) {
      b.path = W.path(p.x, p.z, goal[0], goal[1]) || [[goal[0], goal[1]]]; b.pi = 0; b.pathGoal = goal.slice(); b.lastPath = now; b.stuck = 0;
    }
    let tgt = b.path[Math.min(b.pi, b.path.length - 1)];
    if (Math.hypot(tgt[0] - p.x, tgt[1] - p.z) < 0.6 && b.pi < b.path.length - 1) { b.pi++; tgt = b.path[b.pi]; }
    const dx = tgt[0] - p.x, dz = tgt[1] - p.z, dist = Math.hypot(dx, dz);
    if (dist < 0.4 && b.pi >= b.path.length - 1) { moveStep(W, p, { f: 0, s: 0 }, dt, 6); return; }
    const want = Math.atan2(-dx, -dz);
    if (!noLook && !b.aiming) { p.yaw += angDiff(p.yaw, want) * Math.min(1, dt * 7); p.pitch *= 0.9; }
    const rel = angDiff(p.yaw, want);
    const w = W_BY_ID[(p.inv[p.cur] || {}).wid || 'knife'] || { speed: 250 };
    const before = [p.x, p.z];
    moveStep(W, p, { f: Math.cos(rel), s: -Math.sin(rel), jump: b.stuck > 0.8 && Math.random() < 0.05, crouch: false, walk: false }, dt, w.speed * 0.0254);
    const moved = Math.hypot(p.x - before[0], p.z - before[1]);
    b.stuck = moved < 0.5 * dt ? b.stuck + dt : Math.max(0, b.stuck - dt);
  }

  // lob a grenade so it lands near (tx, tz): 45° throw, speed from the distance
  throwAt(p, type, tx, tz) {
    const i = p.nades.indexOf(type); if (i < 0) return false;
    const dx = tx - p.x, dz = tz - p.z, D = Math.max(2, Math.hypot(dx, dz)), g = 20.3, v = Math.min(19, Math.sqrt(g * D * 0.9)), h = v / Math.SQRT2;
    const ex = { x: p.x + dx / D * 0.4, y: p.y + 1.5, z: p.z + dz / D * 0.4 };
    this.m.throwNade(p, type, ex, { x: dx / D * h, y: h, z: dz / D * h });
    return true;
  }
  heard(x, z, by, range = 30) { for (const p of this.m.players.values()) if (p.bot && p.alive && by && by.team !== p.team && Math.hypot(p.x - x, p.z - z) < range) { const b = this.B(p); b.heard = { x, z }; if (!b.target) { const want = Math.atan2(-(x - p.x), -(z - p.z)); p.yaw += angDiff(p.yaw, want) * 0.6; } } }
  flashed(id, secs) { const b = this.brain.get(id); if (b) b.blind = Math.max(b.blind, secs); }
}
export { speedOf, PHYS, BOMB };
