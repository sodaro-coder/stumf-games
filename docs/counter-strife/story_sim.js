// Story mode on the host: one mission of "Operation Ballin' Out" (story.js) played as a co-op PvE match. The squad
// (real players first, AI squadmates fill the four characters) is CT; the Ballin' Brotherhood is T, spawned in waves
// by the mission's objectives. Everything is host-authoritative like a normal match, so co-op uses the same netcode:
// the host broadcasts the story state (objective, markers, timers, boss) as an event and clients draw it.
import { Match, moveStep } from './sim.js';
import { W_BY_ID, MODES } from './data.js';
import { CHARACTERS, SQUAD, STORY_DIFF, ARSENAL, MISSIONS, BOSS, BOSSES, BARKS, SPEAKERS } from './story.js';

const ENEMY_GUNS = [['glock', 'mac10'], ['mac10', 'galil'], ['galil', 'ak47', 'mp9'], ['ak47', 'galil', 'p90'], ['ak47', 'm4a4', 'p90'], ['ak47', 'm4a4', 'ssg08'], ['ak47', 'awp', 'm4a1s']];
const ENEMY_NAMES = ['Brother Dribbles', 'Crossover Carl', 'Airball Ahmed', 'Benchwarmer Bob', 'Free Throw Frank', 'Layup Larry', 'Turnover Tony', 'Brick Brian', 'Double Dribble Dave', 'Technical Foul Ted', 'Shot Clock Steve', 'Rebound Ron'];
export const GLOCK_SWITCH = { mag: 50, reserve: 150 };
const H1 = (m, v) => m.humans().some((h) => h !== v && Math.hypot(h.x - v.x, h.z - v.z) < 2.2);   // a real player is already reviving them
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export class StoryMatch extends Match {
  // story: { mission: index into MISSIONS, diff: 'easy' | 'normal' | 'hard', host: character id the host picked }
  constructor(args, story) {
    super({ ...args, mode: 'story' });
    this.mission = MISSIONS[story.mission] || MISSIONS[0]; this.mi = story.mission | 0;
    this.diff = STORY_DIFF[story.diff] || STORY_DIFF.normal; this.diffKey = STORY_DIFF[story.diff] ? story.diff : 'normal';
    this.botLevel = this.diff.bot; this.wantChar = story.host || 'wiener';
    this.obj = -1; this.state = null; this.markers = []; this.enemies = new Set(); this.npc = null; this.boss = null; this.beams = []; this.balls = [];
    this.cutT = 0; this.failT = 0; this.result = null; this.eid = 1; this.waveT = 0; this.alarm = 0; this.lastSend = 0; this.zoneCache = new Map();
    this.abilityT = new Map(); this.nadeUsed = new Set(); this.focusT = new Map(); this.kills = 0;
    this.startObj = Math.max(0, story.obj | 0); this.runId = story.runId || ''; this.absent = new Set(this.mission.absent || []);
    this.sceneT = 0; this.skipVotes = new Set(); this.paused = false; this.talkQ = 0;
    this.featured = this.mission.featured || null; this.featuredId = null;   // a character's own story: one player plays, the squad watches
    this.sightRange = this.mission.botSight || 0; this.vision = this.mission.vision || ''; this.music = this.mission.music || ''; this.dirs = []; this.sceneClock = 0; this.slowT = 0; this.slowK = 1; this.tele = []; this.healed = 0;
  }
  // permanent unlocks follow campaign progress, so they survive deaths, checkpoints, restarts and saves by construction
  unlocked(c) {
    const A = (CHARACTERS[c] || {}).ability; if (!A) return false; if (!A.unlock) return true;
    const ui = MISSIONS.findIndex((m) => m.id === A.unlock.mission); if (ui < 0) return true;
    return this.mi > ui || (this.mi === ui && (this.unlockedNow.has(c) || this.obj > (A.unlock.obj | 0)));   // granted inside its level by a scene, or already past that point
  }
  get unlockedNow() { return this._un || (this._un = new Set()); }
  get squadChars() { return SQUAD.filter((c) => !this.absent.has(c)); }
  // ---- the squad ----
  add(id, info) {
    const p = super.add(id, { ...info, team: info.team || 'CT' });
    if (p.team === 'CT') {
      if (!p.char) {   // real players take the character they asked for if it is free, else the next free one
        const taken = new Set([...this.players.values()].filter((q) => q !== p && q.char && !(q.bot && q.squad)).map((q) => q.char));   // AI squadmates step aside for a human
        let want = !p.bot && id === this.hostId ? this.wantChar : info.char;
        if (want && this.absent.has(want)) want = 'recruit';
        const free = this.squadChars.concat(this.absent.size ? ['recruit'] : []);   // a level without Cancer: his player is the new recruit
        p.char = want && !taken.has(want) && free.includes(want) ? want : free.find((c) => !taken.has(c)) || 'ricky';
        // a human taking a character an AI squadmate had: the AI one steps out
        for (const q of [...this.players.values()]) if (q !== p && q.bot && q.squad && q.char === p.char) this.players.delete(q.id);
      }
      p.squad = true; p.name = p.bot ? CHARACTERS[p.char].name : `${info.name || 'Player'} (${CHARACTERS[p.char].short})`;
      if (this.featuredId && !p.bot && p.id !== this.featuredId) { p.spectator = true; p.alive = false; }   // joined during someone's story: watch it
      p.maxHp = p.bot ? 100 : Math.round(100 * this.diff.hpMult);   // real players: 1.5x health
      this.broadcastRoster();
    }
    return p;
  }
  // AI squadmates for every character no human plays
  fillSquad() {
    if (this.featured && !this.mission.allies) return;
    const have = new Set([...this.players.values()].filter((p) => p.squad).map((p) => p.char));
    for (const c of this.squadChars) if (!have.has(c)) this.add('mate_' + c, { name: CHARACTERS[c].name, bot: true, team: 'CT', char: c });
  }
  loadout(p) {
    const tier = Math.min(6, this.mission.tier | 0), C = CHARACTERS[p.char];
    const ar = ARSENAL[p.char] || ARSENAL.ricky, guns = ar[tier] || ar[0];
    p.inv = { 3: { wid: 'knife' } };
    const prim = W_BY_ID[guns[0]]; if (prim) p.inv[1] = { wid: prim.id, ammo: prim.mag, reserve: prim.reserve * 2, skin: this.skinFor(p, prim.id), fresh: true };
    if (C.sidearm) p.inv[2] = { wid: 'glock', ammo: GLOCK_SWITCH.mag, reserve: GLOCK_SWITCH.reserve, sw: true, fresh: true };
    else { const pid = tier >= 4 ? 'deagle' : tier >= 2 ? 'fiveseven' : 'p2000', pw = W_BY_ID[pid]; p.inv[2] = { wid: pid, ammo: pw.mag, reserve: pw.reserve, skin: this.skinFor(p, pid), fresh: true }; }
    p.nades = ['he', 'flash']; p.armor = 100; p.helmet = true; p.cur = 1; p.money = 0;
    const L = (this.mission.loadout || {})[p.char];   // a level's own kit: a kitchen knife, the Switch and nothing else, a hospital gown...
    if (L) {
      p.inv = L.noKnife ? {} : { 3: { wid: 'knife' } }; p.nades = []; p.cur = L.noKnife ? 0 : 3;
      for (const w of L.guns || []) { if (w === 'glock_sw') { p.inv[2] = { wid: 'glock', ammo: GLOCK_SWITCH.mag, reserve: GLOCK_SWITCH.reserve, sw: true, fresh: true }; p.cur = 2; } else { const ww = W_BY_ID[w]; if (ww) { const sl = ww.cat === 'pistol' ? 2 : 1; p.inv[sl] = { wid: w, ammo: ww.mag, reserve: ww.reserve * 2, fresh: true }; p.cur = Math.min(p.cur, sl); } } }
      p.nades = (L.nades || []).slice(); p.armor = L.armor ? 100 : 0; p.helmet = !!L.armor;
    }
    for (const k of ['scale', 'look', 'speed']) { const v = (this.mission[k] || {})[p.char]; if (k === 'scale') p.scale = v || 1; if (k === 'look') p.lookAs = v || null; if (k === 'speed') p.speedMul = v || 1; }
    this.sendInv(p);
  }
  give2(p, w) { if (!p) return; if (w === 'knife') { p.inv[3] = { wid: 'knife' }; p.cur = 3; } else if (w === 'glock_sw') p.inv[2] = { wid: 'glock', ammo: GLOCK_SWITCH.mag, reserve: GLOCK_SWITCH.reserve, sw: true, fresh: true }; else if (W_BY_ID[w]) { const ww = W_BY_ID[w], sl = ww.cat === 'pistol' ? 2 : 1; p.inv[sl] = { wid: w, ammo: ww.mag, reserve: ww.reserve * 2, fresh: true }; p.cur = sl; } else if (['he', 'flash', 'smoke', 'molotov'].includes(w)) p.nades.push(w); this.sendInv(p); }
  spawn(p) {
    if (p.team === 'T' && p.spawnAt) {   // enemies appear where their wave says
      p.x = p.spawnAt[0]; p.z = p.spawnAt[1]; p.y = this.W.groundAt(p.x, p.z, 10); p.yaw = p.spawnAt[2] || 0; p.pitch = 0; p.vx = p.vy = p.vz = 0; p.crouch = 0; p.alive = true; p.hp = p.maxHp || 100;
      return;
    }
    super.spawn(p);
    if (p.squad) p.hp = p.maxHp || 100;
    if (p.spectator) { p.alive = false; p.hp = 0; }
  }
  canBuy() { return false; }
  // a player who drops out: their character carries on as an AI squadmate (they can come back and take it over)
  remove(id) { const p = this.players.get(id); const was = p && p.squad && !p.bot; super.remove(id); this.skipVotes.delete(id); if (was && this.phase !== 'warmup') { this.fillSquad(); for (const q of this.players.values()) if (q.squad && q.bot && !q.inv[1]) { this.spawn(q); this.loadout(q); const h = this.humans()[0]; if (h) { q.x = h.x + 1; q.z = h.z + 1; q.y = this.W.groundAt(q.x, q.z, h.y + 1); } } } }
  // the roster also says who plays which character and which one is the boss (clients dress the models from it)
  broadcastRoster() { this.rosterVer = (this.rosterVer || 0) + 1; this.send('roster', [...this.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.bot, agent: p.agent, knife: p.knife, att: null, char: p.squad ? p.char : null, boss: p.boss ? p.bossKey || 'ballin' : null, look: p.lookAs || null, scale: p.scale || 1 }))); }
  // the switch Glock fires far faster than a stock one: let its shots past the fire-rate check
  shot(p, wid, hits, origin) { if (wid === 'glock' && p.inv[2] && p.inv[2].sw) p.lastShot = 0; super.shot(p, wid, hits, origin); }
  // ---- flow: one long "round": a cutscene, then the objectives in order; everyone down = retry the objective ----
  start() {
    if (this.featured) {   // the human who plays this character plays it; if nobody does, the host takes it for this level
      const hs = [...this.players.values()].filter((p) => p.squad && !p.bot);
      let f = hs.find((p) => p.char === this.featured) || hs.find((p) => p.id === this.hostId) || hs[0];
      if (f) { if (f.char !== this.featured) { f.homeChar = f.char; f.char = this.featured; } this.featuredId = f.id; f.spectator = false; }
      for (const q of [...this.players.values()]) if (q.squad && q !== f) { if (q.bot) this.players.delete(q.id); else q.spectator = true; }
      if (f) f.name = f.name.replace(/\(.*\)$/, `(${CHARACTERS[this.featured].short})`);
    }
    this.fillSquad();
    for (const a of this.mission.actors || []) {   // people the story needs who aren't fighting: Danny, the doctor
      const q = this.add('actor_' + a.id, { name: a.name || a.id, bot: true, team: 'CT' }); q.squad = false; q.char = null; q.name = a.name || a.id; q.actorId = a.id; q.passive = true; q.lookAs = a.look; q.scale = a.scale || 1; q.npc = true;
      const pt = this.zonePt(a.zone, 91); q.spawnAt = null; q.x = pt[0]; q.z = pt[1]; q.y = this.W.groundAt(pt[0], pt[1], 10); q.alive = true; q.hp = 9999; q.maxHp = 9999; q.inv = {}; q.cur = 0; q.scripted = true;
    }
    this.round = 1; this.phase = 'freeze'; this.timer = 9999;
    for (const p of this.players.values()) if (p.squad) { this.spawn(p); this.loadout(p); }
    this.broadcastRoster();
    this.cutT = this.startObj > 0 ? 0.5 : this.cut('in');
    this.event('round', { n: 1, phase: 'freeze', score: this.score });
    this.push(true);
  }
  newRound() { /* no rounds in a mission */ }
  endRound() { /* missions end through objectives */ }
  checkWin() {
    if (this.phase !== 'live' || this.result) return;
    const squad = [...this.players.values()].filter((p) => p.squad && !p.spectator);
    if (squad.some((p) => !p.bot) && !squad.some((p) => !p.bot && p.alive) && !this.failT) {   // every real player down
      this.failT = 4; this.event('banner', { text: 'SQUAD DOWN', sub: 'back to the last checkpoint…' });
    }
  }
  cut(which) {
    const raw = (this.mission.cut || {})[which] || [];
    if (!raw.length) return 0;
    return this.scene(raw, which === 'in' ? `${this.mission.chapterName}: ${this.mission.name}` : '', which);
  }
  lines(raw) { return raw.map(([who, text, o]) => ({ who, name: who === 'boss' ? (this.boss && BOSSES[this.boss.bossKey] ? BOSSES[this.boss.bossKey].name : BOSS.name) : (CHARACTERS[who] || {}).name || SPEAKERS[who] || who, text, o: o || null })); }
  // a scene everyone watches together (the host keeps the clock; the clients pace the lines the same way)
  scene(raw, title = '', which = 'scene') {
    this.flushDirs();   // whatever the last scene still had to do happens before this one starts
    const lines = this.lines(raw); this.skipVotes.clear();
    this.event('cut', { lines, title, which });
    let acc = 0; this.dirs = lines.map((l) => { const d = { t: acc, o: l.o, who: l.who }; acc += 1.6 + l.text.length * 0.045 + ((l.o && l.o.hold) || 0); return d; }).filter((d) => d.o); this.sceneClock = 0;
    const t = Math.min(120, 1.5 + acc);
    if (which === 'scene') this.sceneT = t;
    return t;
  }
  // stage directions inside a scene, run by the host at the moment their line plays (clients do the camera, the screen
  // and the sound themselves from the same lines)
  direct(dt) {
    this.sceneClock += dt;
    while (this.dirs.length && this.dirs[0].t <= this.sceneClock) this.doDir(this.dirs.shift().o);
  }
  // a skipped scene: its lasting directions all happen now (walks become places), the momentary ones are dropped
  flushDirs() { for (const d of this.dirs.splice(0)) { const o = { ...d.o }; delete o.slowmo; delete o.sfx; delete o.smoke; if (o.walk) { o.place = o.walk; delete o.walk; } this.doDir(o); } }
  doDir(o) {
    if (o.vision != null) { this.vision = o.vision; this.push(true); }
    if (o.music != null) { this.music = o.music; this.push(true); }
    if (o.slowmo) { this.slowK = o.slowmo[0]; this.slowT = o.slowmo[1]; }
    if (o.capture) {   // the ambush: everyone but the featured character is taken
      for (const q of [...this.players.values()]) if (q.squad && q.char !== o.capture) { if (q.bot) this.players.delete(q.id); else { q.spectator = true; q.alive = false; } }
      this.broadcastRoster(); this.push(true);
    }
    if (o.down) { const q = [...this.players.values()].find((p) => p.squad && p.char === o.down && p.alive); if (q) { q.hp = 1; q.downed = true; } }
    if (o.unlock) { this.unlockedNow.add(o.unlock); this.event('unlock', { char: o.unlock }); this.push(true); }
    if (o.give) { const q = [...this.players.values()].find((p) => p.squad && p.alive && p.char === o.give[0]); this.give2(q, o.give[1]); }
    if (o.fullhp) for (const q of this.players.values()) if (q.squad && q.alive) { q.hp = q.maxHp || 100; q.downed = false; if (q.local) this.onLocal('hurt', { id: q.id, hp: q.hp, armor: q.armor, heal: true }); else if (!q.bot) this.send('hurt', { id: q.id, hp: q.hp, armor: q.armor, heal: true }, q.id); }
    if (o.bossEnd && this.boss) { const b = this.boss; this.players.delete(b.id); this.enemies.delete(b.id); this.boss = null; this.tele = []; this.event('boss', null); this.broadcastRoster(); if (this.state) this.state.have = 1; }
    if (o.walk) for (const q of this.players.values()) if (q.bot && ((q.squad && o.walk[0] === q.char) || q.actorId === o.walk[0])) q.walkTo = Array.isArray(o.walk[1]) ? o.walk[1] : this.zonePt(o.walk[1], 77);
    if (o.place) for (const q of this.players.values()) if ((q.squad && o.place[0] === q.char) || q.actorId === o.place[0]) { const pt = this.zonePt(o.place[1], 78); q.x = pt[0]; q.z = pt[1]; q.y = this.W.groundAt(pt[0], pt[1], 10); q.seen = false; if (o.place[2]) { const f = this.zonePt(o.place[2], 79); q.yaw = Math.atan2(-(f[0] - q.x), -(f[1] - q.z)); }
      if (!q.bot) {   // a real player is told where they now stand; their older position reports are ignored until one arrives from here
        q.tpAt = [q.x, q.z, this.clock || 0]; const m = { x: q.x, y: q.y, z: q.z, yaw: o.place[2] ? q.yaw : null };
        if (q.local) this.onLocal('tp', m); else this.send('tp', m, q.id);
      }
    }
  }
  // lines over gameplay: nobody stops
  talk(raw) { if (raw && raw.length) this.event('talk', { lines: this.lines(raw) }); }
  // everyone who is playing asks to skip: the scene ends for everyone at once
  skipVote(p) {
    if (!p || p.bot || (this.cutT <= 0 && this.sceneT <= 0 && !(this.result && this.endT > 1))) return;
    this.skipVotes.add(p.id);
    const need = this.humans().length || 1, n = [...this.skipVotes].filter((id) => { const q = this.players.get(id); return q && !q.bot; }).length;
    this.event('skipVotes', { n, need });
    if (n >= need) { this.skipVotes.clear(); if (this.cutT > 0) this.cutT = 0.01; this.sceneT = 0; this.flushDirs(); if (this.result) this.endT = Math.min(this.endT, 0.6); this.event('cutSkip', {}); }
  }
  // where a story place name lands on this map: a named zone (hashed, so the same name always means the same place)
  zonePt(name, salt = 0) {
    const zs = this.W.B.zones.length ? this.W.B.zones : [['all', 2, 2, this.W.w - 2, this.W.d - 2]];
    const key = name + '|' + salt;
    if (!this.zoneCache.has(key)) { const z = zs.find((q) => q[0].toLowerCase() === String(name).toLowerCase()) || zs[hash(String(name)) % zs.length]; this.zoneCache.set(key, this.W.randomIn([z[1], z[2], z[3], z[4]], () => ((hash(key + this.zoneCache.size) % 1000) / 1000))); }
    return this.zoneCache.get(key);
  }
  farFrom(pt, minD = 18) {   // an enemy spawn point out of the squad's sight, preferring the T side
    const cands = [...this.W.B.spawns.T, ...this.W.B.zones.map((z) => [(z[1] + z[3]) / 2, (z[2] + z[4]) / 2])];
    const squad = [...this.players.values()].filter((p) => p.squad && p.alive);
    for (let k = 0; k < 12; k++) {
      const c = cands[Math.floor(this.rng() * cands.length)], q = this.W.randomIn([c[0] - 3, c[1] - 3, c[0] + 3, c[1] + 3]);
      if (squad.every((s) => Math.hypot(s.x - q[0], s.z - q[1]) > minD) && squad.every((s) => !this.W.los({ x: s.x, y: s.y + 1.6, z: s.z }, { x: q[0], y: this.W.groundAt(q[0], q[1], 10) + 1.4, z: q[1] }))) return q;
    }
    const c = this.W.B.spawns.T[0]; return [c[0], c[1]];
  }
  enemy(at, opts = {}) {
    const id = 'en' + this.eid++, tier = Math.min(6, this.mission.tier | 0), guns = ENEMY_GUNS[tier];
    const names = this.mission.enemyNames || ENEMY_NAMES;
    const p = this.add(id, { name: opts.name || names[this.eid % names.length], bot: true, team: 'T' });
    p.lookAs = opts.look || this.mission.enemyLook || null;
    p.maxHp = Math.round((opts.hp || 100) * this.diff.enemyHp); p.spawnAt = [at[0], at[1], 0];
    this.spawn(p);
    const wid = opts.wid || guns[Math.floor(this.rng() * guns.length)], w = W_BY_ID[wid];
    p.inv = { 3: { wid: 'knife' }, [w.cat === 'pistol' ? 2 : 1]: { wid, ammo: w.mag, reserve: w.reserve * 3 } }; p.cur = w.cat === 'pistol' ? 2 : 1;
    if (this.rng() < 0.3) p.nades = ['he']; p.armor = tier >= 2 ? 100 : 0; p.helmet = tier >= 4;
    p.guard = opts.guard || null; this.enemies.add(id);
    return p;
  }
  wave(n, at) { const k = Math.max(1, Math.round(n * this.diff.enemyCount)); for (let i = 0; i < k; i++) { const pt = at || this.farFrom(null); this.enemy(this.W.randomIn([pt[0] - 2.5, pt[1] - 2.5, pt[0] + 2.5, pt[1] + 2.5])); } }
  // bots: enemies with a guard post hold it until they spot someone; squad AI stays with the humans or the NPC goal
  botGoal(p) {
    if (p === this.npc) { const lead = this.nearestHuman(p); return lead ? [lead.x, lead.z] : null; }
    if (p.downed) return 'hold';
    if (p.carrying && this.state && this.state.pt) return this.state.pt;
    if (p.squad && p.bot && this.state && this.state.kind === 'revive' && this.state.who !== p.id) { const v = this.players.get(this.state.who); if (v && v.alive && !H1(this, v)) return Math.hypot(v.x - p.x, v.z - p.z) > 1.2 ? [v.x, v.z] : 'hold'; }
    if (p.team === 'T' && p.passive && p.guard) return 'hold';
    if (p.team === 'T' && p.guard) return Math.hypot(p.x - p.guard[0], p.z - p.guard[1]) > 3 ? p.guard : 'hold';
    if (p.squad && p.bot) {
      const lead = this.nearestHuman(p); if (!lead) return null;
      if (Math.hypot(lead.x - p.x, lead.z - p.z) > 6) return [lead.x + Math.sin(hash(p.id)) * 2, lead.z + Math.cos(hash(p.id)) * 2];
      return 'hold';
    }
    return null;
  }
  // the squad member playing a character, alive and next to the squad (an AI one that was down gets back up now)
  ensureChar(c) {
    let p = [...this.players.values()].find((q) => q.squad && q.char === c);
    if (!p) return this.humans()[0] || null;
    if (!p.alive) { this.spawn(p); this.loadout(p); p.reviveAt = 0; const h = this.humans().find((q) => q !== p); if (h) { p.x = h.x + 1.2; p.z = h.z + 1.2; p.y = this.W.groundAt(p.x, p.z, h.y + 1); } }
    return p;
  }
  nearestHuman(p) { let best = null, bd = Infinity; for (const q of this.players.values()) if (q.squad && !q.bot && q.alive) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } } return best; }
  humans() { return [...this.players.values()].filter((p) => p.squad && !p.bot && p.alive); }
  // ---- objectives ----
  begin(i) {
    this.obj = i; const o = this.mission.objectives[i]; this.markers = []; this.alarm = 0;
    if (!o) return this.complete();
    const st = this.state = { kind: o.kind, hint: o.hint, t: 0, need: 0, have: 0, order: null };
    const place = o.zone || o.npc || o.item || o.kind;
    switch (o.kind) {
      case 'reach': { const pt = this.zonePt(place, i); this.markers.push({ id: 'goal', x: pt[0], z: pt[1], kind: 'goal', label: o.hint }); break; }
      case 'clear': {
        const pt = this.zonePt(place, i), n = Math.round((o.count || 10) * this.diff.enemyCount);
        for (let k = 0; k < n; k++) { let q = null; for (let j = 0; j < 8 && (!q || this.humans().some((h) => Math.hypot(h.x - q[0], h.z - q[1]) < 10)); j++) q = this.W.randomIn([pt[0] - 9, pt[1] - 9, pt[0] + 9, pt[1] + 9]); this.enemy(q, { guard: q }); }
        st.need = n; st.ids = new Set([...this.enemies].slice(-n)); this.markers.push({ id: 'area', x: pt[0], z: pt[1], kind: 'area', label: 'Clear' });
        break;
      }
      case 'defend': case 'survive': {
        st.need = o.time || 90;
        if (o.kind === 'defend') { const pt = this.zonePt(place, i); st.pt = pt; this.markers.push({ id: 'hold', x: pt[0], z: pt[1], kind: 'hold', label: 'Hold' }); }
        this.waveT = 4; break;
      }
      case 'collect': {
        st.need = o.count || 3;
        for (let k = 0; k < st.need; k++) { const z = this.W.B.zones[(hash(o.item + k + this.mi) % Math.max(1, this.W.B.zones.length))]; const q = z ? this.W.randomIn([z[1], z[2], z[3], z[4]]) : this.zonePt(o.item, k); this.markers.push({ id: 'c' + k, x: q[0], z: q[1], kind: 'item', label: o.item }); }
        this.wave(3); break;
      }
      case 'interact': {
        st.need = o.targets || 1; st.prog = 0;
        // the puzzle: the terminals carry shuffled numbers and must be worked in order; a wrong one sets off an alarm
        const order = Array.from({ length: st.need }, (_, k) => k + 1).sort(() => this.rng() - 0.5);
        for (let k = 0; k < st.need; k++) { const q = this.zonePt(place + k, i * 10 + k); this.markers.push({ id: 't' + k, x: q[0], z: q[1], kind: 'terminal', label: o.puzzle ? String(order[k]) : 'USE', n: o.puzzle ? order[k] : 0, prog: 0 }); }
        st.next = 1; st.puzzle = !!o.puzzle; this.wave(2); break;
      }
      case 'defuse': { const q = this.zonePt('bomb' + this.mi, i); this.markers.push({ id: 'bomb', x: q[0], z: q[1], kind: 'bomb', label: 'Defuse', prog: 0 }); st.need = 7; this.waveT = 6; break; }
      case 'escort': {
        const s = this.humans()[0] || [...this.players.values()].find((p) => p.squad);
        this.npc = this.add('npc', { name: o.npc === 'chef' ? 'The Chili Chef' : 'The Captain', bot: true, team: 'CT' });
        this.npc.squad = false; this.npc.passive = true; this.npc.maxHp = 200; this.npc.spawnAt = null; this.npc.x = s.x + 1; this.npc.z = s.z + 1; this.npc.y = s.y; this.npc.alive = true; this.npc.hp = 200; this.npc.inv = { 3: { wid: 'knife' } }; this.npc.cur = 3;
        const pt = this.zonePt(place, i); this.markers.push({ id: 'goal', x: pt[0], z: pt[1], kind: 'goal', label: 'Extraction' }); this.waveT = 5; break;
      }
      case 'boss': this.spawnBoss(this.zonePt(o.zone || 'boss', i), o.boss || 'ballin'); break;
      case 'rescue': {   // a captured squadmate: get to them and hold USE; they're back in the fight (a real player gets control back)
        const q = this.zonePt(o.zone || 'cell' + i, i); st.pt = q; st.need = 2.2; st.who = o.who; st.limit = o.time || 0;
        this.markers.push({ id: 'cell', x: q[0], z: q[1], kind: 'revive', label: (CHARACTERS[o.who] || {}).short || 'Rescue', prog: 0 });
        const n = Math.round((o.guards || 4) * this.diff.enemyCount); for (let k = 0; k < n; k++) { let g = null; for (let j = 0; j < 8 && (!g || this.humans().some((h) => Math.hypot(h.x - g[0], h.z - g[1]) < 9)); j++) g = this.W.randomIn([q[0] - 8, q[1] - 8, q[0] + 8, q[1] + 8]); this.enemy(g, { guard: g, look: this.mission.enemyLook }); }
        break;
      }
      case 'intel': {   // Igor's swap: several files at one desk, one is the right one to replace (the clue says which)
        const q = this.zonePt(o.zone, i); st.pt = q; st.answer = o.answer; st.need = 1;
        (o.options || []).forEach((lab, k) => this.markers.push({ id: 'i' + k, x: q[0] + (k - (o.options.length - 1) / 2) * 1.6, z: q[1], kind: 'terminal', label: lab, opt: lab, prog: 0 }));
        const n = o.guards | 0, H = this.humans();
        for (let k = 0; k < n; k++) { let g = null; for (let j = 0; j < 10 && (!g || H.some((h) => Math.hypot(h.x - g[0], h.z - g[1]) < 12)); j++) g = this.W.randomIn([q[0] - 12, q[1] - 12, q[0] + 12, q[1] + 12]); const e = this.enemy(g, { guard: g, look: o.look || this.mission.enemyLook }); e.passive = true; e.yaw = this.rng() * 6.28; st.guards = (st.guards || []).concat(e.id); }
        st.spotted = false; st.lookT = 0; st.sight = o.sight || this.mission.sight || 16; break;
      }
      case 'ability': {   // the tutorial: use it for real, on people who need it
        st.need = 1; st.who = o.who; this.healed = 0;
        for (const q of this.players.values()) if (q.squad && q.alive && q.char !== o.who) { q.hp = Math.round((q.maxHp || 100) * 0.35); if (q.local) this.onLocal('hurt', { id: q.id, hp: q.hp, armor: q.armor }); else if (!q.bot) this.send('hurt', { id: q.id, hp: q.hp, armor: q.armor }, q.id); }
        break;
      }
      case 'explore': {   // walk and talk: every point plays its lines when somebody gets there
        (o.points || []).forEach((pt, k) => { const q = this.zonePt(pt.zone || 'talk' + k, i * 10 + k); this.markers.push({ id: 'p' + k, x: q[0], z: q[1], kind: 'talk', label: pt.label || '', say: pt.say }); });
        st.need = this.markers.length; break;
      }
      case 'stealth': {   // guards that only open fire once someone is spotted (or shoots one of them)
        const pt = this.zonePt(place, i); st.pt = pt; this.markers.push({ id: 'goal', x: pt[0], z: pt[1], kind: 'goal', label: 'Get here unseen' });
        const n = Math.round((o.guards || 5) * this.diff.enemyCount), H = this.humans();
        for (let k = 0; k < n; k++) {
          let q = null; for (let j = 0; j < 10 && (!q || H.some((h) => Math.hypot(h.x - q[0], h.z - q[1]) < 14)); j++) q = this.W.randomIn([pt[0] - 14, pt[1] - 14, pt[0] + 14, pt[1] + 14]);
          const e = this.enemy(q, { guard: q }); e.passive = true; e.yaw = this.rng() * Math.PI * 2; st.guards = (st.guards || []).concat(e.id);
        }
        st.spotted = false; st.lookT = 0; break;
      }
      case 'revive': {   // a squadmate is down: hold USE on them while the enemy pushes
        const who = this.ensureChar(o.who);
        st.who = who ? who.id : null; if (who) { who.downed = true; if (who.bot) who.passive = true; }
        st.need = 3.2; this.markers.push({ id: 'rev', x: who ? who.x : 0, z: who ? who.z : 0, kind: 'revive', label: 'Hold USE', prog: 0 }); this.waveT = 2; break;
      }
      case 'carry': {   // one character carries the objective to the zone; everyone else keeps them alive
        const who = this.ensureChar(o.who);
        st.who = who ? who.id : null; if (who) { who.carrying = true; if (who.bot) who.passive = true; }
        const pt = this.zonePt(place, i); st.pt = pt; this.markers.push({ id: 'goal', x: pt[0], z: pt[1], kind: 'goal', label: o.hint }, { id: 'carrier', x: who ? who.x : 0, z: who ? who.z : 0, kind: 'item', label: (CHARACTERS[o.who] || {}).short || 'Carrier' });
        this.waveT = 3; break;
      }
      default: break;
    }
    if (o.music != null) this.music = o.music; if (o.vision != null) this.vision = o.vision;
    if (i > 0) this.event('checkpoint', { mission: this.mi, obj: i, runId: this.runId });   // the host saves here: a wipe or a reload resumes from this objective
    this.event('obj', { i, n: this.mission.objectives.length, hint: o.hint, kind: o.kind });
    if (o.scene && !this.replay) this.scene(o.scene); else if (this.replay) this.replay = false;
    this.talk(o.say);
    this.push(true);
  }
  complete() {
    if (this.result) return;
    this.result = { win: true }; this.phase = 'end';
    const t = this.cut('out');
    this.endT = t + 3;
    this.event('banner', { text: 'MISSION COMPLETE', sub: this.mission.name });
    this.push(true);
  }
  // back to the start of the current objective: the squad respawns, the enemies of this stage reset
  retry() {
    this.failT = 0;
    for (const id of this.enemies) this.players.delete(id); this.enemies.clear();
    if (this.npc) { this.players.delete(this.npc.id); this.npc = null; }
    if (this.boss) { this.players.delete(this.boss.id); this.boss = null; }
    for (const p of this.players.values()) { p.downed = false; p.carrying = false; if (p.squad) { this.spawn(p); this.loadout(p); p.passive = false; } }
    this.broadcastRoster();
    this.replay = true; this.begin(this.obj);
  }
  // ---- abilities (asked for by players; AI squadmates use theirs when it makes sense) ----
  ability(p) {
    if (!p || !p.alive || !p.squad || this.phase !== 'live') return;
    const A = (CHARACTERS[p.char] || {}).ability; if (!A) return;
    if (!this.unlocked(p.char)) { const m = { type: 'toast', data: { text: `${A.name} is locked until ${(CHARACTERS[p.char] || {}).short}'s story unlocks it` } }; if (p.local) this.onLocal('ev', m); else if (!p.bot) this.send('ev', m, p.id); return; }
    const now = this.clock || 0;
    if (A.id === 'mess_kit') {   // Combat Medic: every squadmate in reach back to full health
      if ((this.abilityT.get(p.id) || 0) > now) return;
      let n = 0;
      for (const q of this.players.values()) if (q.alive && (q.squad || q === this.npc) && Math.hypot(q.x - p.x, q.z - p.z) <= A.radius) {
        if (q !== p && q.hp < (q.maxHp || 100)) n++;
        q.hp = q.maxHp || 100; if (q.local) this.onLocal('hurt', { id: q.id, hp: q.hp, armor: q.armor, heal: true }); else if (!q.bot) this.send('hurt', { id: q.id, hp: q.hp, armor: q.armor, heal: true }, q.id);
      }
      this.healed += n; this.abilityT.set(p.id, now + A.cd); this.bark(p, 'ability'); this.event('heal', { id: p.id, x: p.x, y: p.y, z: p.z, r: A.radius, n });
    } else if (A.id === 'cancer_nade') {
      const boss = this.state && this.state.kind === 'boss';
      if (boss) { if ((this.abilityT.get(p.id) || 0) > now) return; this.abilityT.set(p.id, now + 9); }   // against the Reaper it comes back every 9 s
      else { if (this.nadeUsed.has(p.id + '|' + this.obj)) return; this.nadeUsed.add(p.id + '|' + this.obj); }
      p.nades.push('smoke');   // the canister is extra: it never costs the player a grenade slot
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      this.throwNade(p, 'smoke', { x: p.x, y: p.y + 1.5, z: p.z }, { x: fx * 11, y: 4, z: fz * 11 });
      const n = this.nades[this.nades.length - 1]; if (n) n.poison = A;
      this.bark(p, 'ability');
    } else if (A.id === 'russian_focus') {
      if ((this.abilityT.get(p.id) || 0) > now) return;
      this.abilityT.set(p.id, now + A.cd); this.focusT.set(p.id, now + A.dur);
      if (p.local) this.onLocal('ev', { type: 'focus', data: { dur: A.dur } }); else if (!p.bot) this.send('ev', { type: 'focus', data: { dur: A.dur } }, p.id);
      this.bark(p, 'ability');
    }
    this.push(true);
  }
  // stealth blown: every guard wakes up and a few more come running (the objective carries on)
  alarm2() { const st = this.state; if (!st || st.spotted) return; st.spotted = true; this.event('banner', { text: 'SPOTTED', sub: 'they know you\'re here' }); for (const id of st.guards || []) { const e = this.players.get(id); if (e) { e.passive = false; e.guard = null; } } this.wave(2); this.push(true); }
  bark(p, what) { const l = (BARKS[p.char] || {})[what]; if (l && l.length) this.event('bark', { who: p.char, name: CHARACTERS[p.char].short, text: l[Math.floor(this.rng() * l.length)] }); }
  detonate(n) {
    if (n.poison) {   // Captain Cancer's canister: a green cloud that hurts and slows the Brotherhood only
      const e = { type: 'poison', x: n.x, y: n.y, z: n.z, r: n.poison.radius, t: n.poison.dur, dps: n.poison.dps, owner: n.owner };
      this.effects.push(e); this.send('fx', this.effects); this.onLocal('fx', this.effects); return;
    }
    super.detonate(n);
  }
  // ---- damage: difficulty scales what the Brotherhood deals; real players take softer headshots ----
  damage(v, by, amount, weapon, group, wallbang, silent) {
    if (v.team === 'T' && v.guard && by && by.team !== 'T') { v.guard = null; if (v.passive) this.alarm2(); }   // shot at: leave the post and hunt
    if (v.squad || v === this.npc) {
      if (by && by.team === 'T') amount *= this.diff.enemyDmg;
      if (by && by.boss && W_BY_ID[weapon]) amount *= 0.3;   // his Negev is for show: the dunk, the balls and the beam are what hurt
      if (group === 'head' && !v.bot) amount *= this.diff.hsTaken / 4;
    }
    if (v === this.boss && group === 'head' && this.boss.beam && this.boss.beam.charge) { this.boss.beam.stagger = (this.boss.beam.stagger || 0) + amount; }
    if (v === this.boss && this.sceneT > 0) return;   // nobody lands a hit on it while a scene plays
    if (v === this.boss && v.bossKey && v.bossKey !== 'ballin') {   // the father and the Reaper: hits land properly only in an opening
      const B = BOSSES[v.bossKey]; amount *= v.vuln > 0 ? B.vulnMul : B.armorMul;
      if (v.bossKey === 'reaper' && !v.fell && v.hp - amount <= v.maxHp * 0.25) { amount = Math.max(0, v.hp - v.maxHp * 0.25); this.reaperFall(); }   // it always wins once first
      else if (v.bossKey === 'reaper' && v.fell && v.hp - amount <= 0) { amount = 0; this.reaperEnd(); }
    }
    if (v.squad && v.downed && this.sceneT > 0) return;   // nobody dies during a scene
    super.damage(v, by, amount, weapon, group, wallbang, silent);
    if (v.hp <= 0 && v.team === 'T') this.kills++;
  }
  kill(v, by, weapon, head, wallbang) {
    super.kill(v, by, weapon, head, wallbang);
    if (v.squad && v.bot) v.reviveAt = (this.clock || 0) + this.diff.revive;   // AI squadmates get back up
    if (v === this.npc) { this.event('banner', { text: 'ESCORT DOWN', sub: 'back to the last checkpoint…' }); this.failT = 3; }
    if (this.state && this.state.who === v.id && (v.carrying || v.downed) && this.phase === 'live') { this.event('banner', { text: `${(CHARACTERS[v.char] || {}).short || 'They'} went down`, sub: 'back to the last checkpoint…' }); this.failT = 3; }
    if (by && by.squad && !by.bot && !this.featured && this.rng() < 0.18) this.bark(by, 'kill');
    if (v === this.boss) { this.boss = null; this.tele = []; this.event('boss', null); if (this.state) this.state.have = 1; const B = BOSSES[v.bossKey]; if (B && B.after) this.scene(B.after); }
  }
  // ---- the boss: Osama bin Ballin ----
  spawnBoss(at, key = 'ballin') {
    if (key !== 'ballin') {   // one-on-one bosses: scripted movement and attacks, no gun
      const B = BOSSES[key], hp = Math.round(B.hp * this.diff.bossHp);
      const b = this.enemy(at, { name: B.name, hp: hp / this.diff.enemyHp, wid: 'glock', look: B.look });
      b.inv = { 3: { wid: 'knife' } }; b.cur = 3; b.nades = [];
      b.boss = true; b.bossKey = key; b.scripted = true; b.passive = true; b.scale = B.scale; b.maxHp = hp; b.hp = hp; b.armor = 0; b.vuln = 0; b.act = null; b.cdT = 2; b.phase = 0; this.boss = b;
      this.broadcastRoster(); this.event('boss', { id: b.id, name: B.name, hp, max: hp }); return;
    }
    const n = Math.max(1, this.humans().length), hp = Math.round(BOSS.hp * this.diff.bossHp * (1 + 0.35 * (n - 1)));
    const b = this.enemy(at, { name: BOSS.name, hp: hp / this.diff.enemyHp, wid: 'negev' });
    b.boss = true; b.scale = BOSS.model.scale; b.maxHp = hp; b.hp = hp; b.armor = 100; this.boss = b; this.broadcastRoster(); b.cd = { dunk: 6, rocket_ball: 3, triple_ball: 8, fart_bomb: 14, minions: 10, goy_beam: 8 };
    this.event('boss', { id: b.id, name: BOSS.name, hp, max: hp });
  }
  bossTick(dt) {
    const b = this.boss; if (!b || !b.alive) return;
    if (b.bossKey === 'father') return this.fatherTick(b, dt);
    if (b.bossKey === 'reaper') return this.reaperTick(b, dt);
    const frac = b.hp / b.maxHp, ph = BOSS.phases.filter((p) => frac <= p.at).pop() || BOSS.phases[0], A = BOSS.attacks, speed = ph.speed || 1;
    for (const k of Object.keys(b.cd)) b.cd[k] -= dt * speed;
    const targets = this.humans().concat([...this.players.values()].filter((p) => p.squad && p.bot && p.alive)); if (!targets.length) return;
    const far = targets.slice().sort((a, c) => Math.hypot(c.x - b.x, c.z - b.z) - Math.hypot(a.x - b.x, a.z - b.z))[0];
    // the Goy-Beam: a 2 s red warning line toward a player, then the beam: half of full health to anyone in front
    if (b.beam) {
      const bm = b.beam; bm.t -= dt;
      if (bm.stagger >= A.goy_beam.cancelOnHeadDmg) { this.event('bark', { who: 'boss', name: 'Ballin', text: 'MY EYES! MY BEAUTIFUL EYES!' }); b.beam = null; this.push(true); return; }
      if (bm.t <= 0 && bm.charge) {
        bm.charge = false; bm.t = 0.35; bm.fire = true;
        for (const p of this.players.values()) {
          if (!p.alive || p.team === 'T') continue;
          const dx = p.x - bm.x, dz = p.z - bm.z, along = dx * bm.dx + dz * bm.dz, across = Math.abs(dx * bm.dz - dz * bm.dx);
          if (along > 0 && along < A.goy_beam.length && across < A.goy_beam.width && this.W.los({ x: bm.x, y: b.y + 2.6, z: bm.z }, { x: p.x, y: p.y + 1.2, z: p.z })) this.damage(p, b, (p.maxHp || 100) * A.goy_beam.dmgFrac / (this.diff.enemyDmg || 1), 'goy_beam', 'chest', false);
        }
        this.push(true);
      } else if (bm.t <= 0) { b.beam = null; this.push(true); }
      return;
    }
    if (ph.attacks.includes('goy_beam') && b.cd.goy_beam <= 0) {
      const d = Math.hypot(far.x - b.x, far.z - b.z) || 1;
      b.beam = { x: b.x, z: b.z, dx: (far.x - b.x) / d, dz: (far.z - b.z) / d, t: this.diff.beamWarn, charge: true, stagger: 0 }; b.cd.goy_beam = A.goy_beam.cd;
      b.yaw = Math.atan2(-(far.x - b.x), -(far.z - b.z));
      this.event('bark', { who: 'boss', name: 'Ballin', text: 'Feel the GOY-BEAM!' }); this.push(true); return;
    }
    if (ph.attacks.includes('minions') && b.cd.minions <= 0) { b.cd.minions = A.minions.cd; this.wave(Math.round(A.minions.count * this.diff.minions)); this.event('bark', { who: 'boss', name: 'Ballin', text: 'Get off the bench, boys!' }); }
    if (ph.attacks.includes('dunk') && b.cd.dunk <= 0) {   // leap at the furthest player: a shockwave ring (jump it)
      b.cd.dunk = A.dunk.cd; const tx = far.x, tz = far.z; b.x = tx + 1.5; b.z = tz + 1.5; b.y = this.W.groundAt(b.x, b.z, 20);
      for (const p of this.players.values()) if (p.alive && p.team !== 'T' && Math.hypot(p.x - b.x, p.z - b.z) < A.dunk.radius && p.onGround !== false && p.vy <= 0.5) this.damage(p, b, A.dunk.dmg, 'dunk', 'legs', false);
      this.event('explode', { x: b.x, y: b.y, z: b.z, r: A.dunk.radius, quake: true });
    }
    const ball = (aim, spread = 0) => { const dx = aim.x - b.x + spread, dz = aim.z - b.z, d = Math.hypot(dx, dz) || 1, v = Math.min(18, 6 + d * 0.6); this.balls.push({ x: b.x, y: b.y + 3.2, z: b.z, vx: dx / d * v, vy: 7, vz: dz / d * v, bounces: 0, age: 0, dmg: A.rocket_ball.dmg, r: A.rocket_ball.radius }); };
    if (ph.attacks.includes('triple_ball') && b.cd.triple_ball <= 0) { b.cd.triple_ball = A.triple_ball.cd; for (const s of [-4, 0, 4]) ball(far, s); }
    else if (ph.attacks.includes('rocket_ball') && b.cd.rocket_ball <= 0) { b.cd.rocket_ball = A.rocket_ball.cd; ball(far); }
    if (ph.attacks.includes('fart_bomb') && b.cd.fart_bomb <= 0) { b.cd.fart_bomb = A.fart_bomb.cd; this.effects.push({ type: 'poison', x: b.x, y: b.y, z: b.z, r: A.fart_bomb.radius, t: A.fart_bomb.dur, dps: A.fart_bomb.dps, owner: b.id, hurtsSquad: true }); this.send('fx', this.effects); this.onLocal('fx', this.effects); this.event('bark', { who: 'boss', name: 'Ballin', text: 'Gas station is OPEN.' }); }
  }
  // a rescued squadmate is back: a real player gets their character and control back where the cell was; otherwise the AI one
  freeChar(c, at) {
    let q = [...this.players.values()].find((p) => p.squad && !p.bot && p.spectator && (p.homeChar || p.char) === c);
    if (q) { q.spectator = false; if (q.homeChar) { q.char = q.homeChar; q.homeChar = null; } if (q.char === this.featured) q.char = c; }
    else { this.add('mate_' + c, { name: CHARACTERS[c].name, bot: true, team: 'CT', char: c }); q = this.players.get('mate_' + c); }
    if (!q) return;
    this.spawn(q); this.loadout(q); q.hp = Math.round((q.maxHp || 100) * 0.5);
    q.x = at.x + 0.6; q.z = at.z + 0.6; q.y = this.W.groundAt(q.x, q.z, 10);
    if (q.local) this.onLocal('spawn', { x: q.x, y: q.y, z: q.z, yaw: q.yaw }); else if (!q.bot) this.send('spawn', { x: q.x, y: q.y, z: q.z, yaw: q.yaw }, q.id);
    if (q.local) this.onLocal('hurt', { id: q.id, hp: q.hp, armor: q.armor }); else if (!q.bot) this.send('hurt', { id: q.id, hp: q.hp, armor: q.armor }, q.id);
    this.broadcastRoster(); this.push(true);
  }
  // ---- one-on-one bosses: shared helpers ----
  bossFoe(b) { let best = null, bd = Infinity; for (const p of this.players.values()) if (p.squad && p.alive && !p.spectator) { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd) { bd = d; best = p; } } return best; }
  bossMove(b, tx, tz, speed, dt) {   // walk toward a point through the real collision (no wall-clipping)
    const want = Math.atan2(-(tx - b.x), -(tz - b.z)); let d = want - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); b.yaw += d * Math.min(1, dt * 6);
    moveStep(this.W, b, { f: Math.cos(d) > 0.3 ? 1 : 0.3, s: 0 }, dt, speed);
  }
  bossHit(b, shape, dmg, why) {   // everything inside the telegraphed shape takes the hit; returns whether anyone did
    let hit = false;
    for (const p of this.players.values()) {
      if (!p.squad || !p.alive || p.spectator) continue;
      const dx = p.x - shape.x, dz = p.z - shape.z, d = Math.hypot(dx, dz);
      let inside = false;
      if (shape.k === 'circle') inside = d < shape.r;
      else if (shape.k === 'arc') { let a = Math.atan2(dx, dz) - Math.atan2(shape.dx, shape.dz); a = Math.atan2(Math.sin(a), Math.cos(a)); inside = d < shape.r && Math.abs(a) < shape.a / 2; }
      else if (shape.k === 'line') { const along = dx * shape.dx + dz * shape.dz, across = Math.abs(dx * shape.dz - dz * shape.dx); inside = along > -0.5 && along < shape.r && across < shape.w; }
      if (inside) { hit = true; this.damage(p, b, typeof dmg === 'function' ? dmg(p) : dmg, why, 'chest', false); }
    }
    return hit;
  }
  // ---- Frank's father: big, drunk, fast when he commits, helpless when he misses ----
  fatherTick(b, dt) {
    const B = BOSSES.father, foe = this.bossFoe(b); if (!foe) return;
    const frac = b.hp / b.maxHp, ph = frac < 0.3 ? 2 : frac < 0.65 ? 1 : 0, sp = [1, 1.18, 1.32][ph];
    if (ph !== b.phase) { b.phase = ph; const l = B.phaseLines[ph]; if (l) this.talk([l]); }
    b.vuln = Math.max(0, b.vuln - dt); b.cdT -= dt * sp;
    const d = Math.hypot(foe.x - b.x, foe.z - b.z), dx = (foe.x - b.x) / (d || 1), dz = (foe.z - b.z) / (d || 1);
    const a = b.act;
    if (b.vuln > 0) { b.vx = b.vz = 0; this.tele = []; return; }   // stumbling: free hits
    if (!a) {
      if (b.cdT <= 0 && d < 2.8) { b.act = { k: 'swing', t: 0.75 / sp, sh: { k: 'arc', x: b.x, z: b.z, dx, dz, r: 3.0, a: 1.9 } }; b.cdT = 1.6; b.yaw = Math.atan2(-dx, -dz); }
      else if (b.cdT <= 0 && d > 6 && this.rng() < 0.6) { b.act = { k: 'charge', t: 0.9 / sp, sh: { k: 'line', x: b.x, z: b.z, dx, dz, r: Math.min(14, d + 3), w: 1.1 } }; b.cdT = 2.6; b.yaw = Math.atan2(-dx, -dz); }
      else if (b.cdT <= 0 && d > 4) { b.cdT = 2.2; this.balls.push({ x: b.x, y: b.y + 2.4, z: b.z, vx: dx * Math.min(14, 5 + d * 0.7), vy: 5.5, vz: dz * Math.min(14, 5 + d * 0.7), bounces: 1, age: 0, dmg: B.bottle * this.diff.enemyDmg, r: 1.6, kind: 'bottle' }); this.event('sound', { s: 'bounce', x: b.x, z: b.z }); }
      else this.bossMove(b, foe.x, foe.z, 3.2 * sp, dt);
      this.tele = a ? [a.sh] : [];
    }
    if (b.act) {
      const A = b.act; A.t -= dt; this.tele = [{ ...A.sh, t: Math.max(0, A.t), warn: A.k !== 'run' }];
      if (A.t <= 0 && A.k === 'swing') { const hit = this.bossHit(b, A.sh, B.swing, 'fists'); b.act = null; this.tele = []; if (!hit) { b.vuln = 1.8; this.talk([['boss', B.miss[Math.floor(this.rng() * B.miss.length)]]]); } }
      else if (A.t <= 0 && A.k === 'charge') { b.act = { k: 'run', t: 0.75, sh: A.sh, hit: false }; }
      else if (A.k === 'run') {
        const sx = b.x, sz = b.z; moveStep(this.W, b, { f: 1, s: 0 }, dt, 13); b.yaw = Math.atan2(-A.sh.dx, -A.sh.dz);
        if (!A.hit) { const near = [...this.players.values()].find((p) => p.squad && p.alive && !p.spectator && Math.hypot(p.x - b.x, p.z - b.z) < 1.3); if (near) { A.hit = true; this.damage(near, b, B.charge, 'charge', 'chest', false); } }
        const moved = Math.hypot(b.x - sx, b.z - sz);
        if (A.t <= 0 || moved < 0.02) { b.act = null; this.tele = []; b.vuln = A.hit ? 0.6 : 2.6; if (!A.hit) this.talk([['boss', B.wall[Math.floor(this.rng() * B.wall.length)]]]); }   // into a wall: dazed
      }
    }
  }
  // ---- the Reaper: slow, certain, and only open after it swings ----
  reaperTick(b, dt) {
    const B = BOSSES.reaper, foe = this.bossFoe(b); if (!foe) return;
    const frac = b.hp / b.maxHp, ph = b.fell ? 2 : frac < 0.6 ? 1 : 0;
    if (ph !== b.phase) { b.phase = ph; this.vision = ['dread', 'dread_dark', 'dread_last'][ph]; this.music = ['dread', 'dread', 'defiant'][ph]; const l = B.phaseLines[ph]; if (l) this.talk(l); this.push(true); }
    if (this.sceneT > 0) return;
    const sp = [1, 1.2, 1.45][ph]; b.vuln = Math.max(0, b.vuln - dt); b.cdT -= dt * sp;
    const d = Math.hypot(foe.x - b.x, foe.z - b.z), dx = (foe.x - b.x) / (d || 1), dz = (foe.z - b.z) / (d || 1);
    if (!b.act) {
      if (b.cdT <= 0 && d < 4.2) { b.act = { k: 'reap', t: 1.1 / sp, sh: { k: 'arc', x: b.x, z: b.z, dx, dz, r: 4.6, a: 2.8 } }; b.cdT = 1.4; b.yaw = Math.atan2(-dx, -dz); }
      else if (b.cdT <= 0 && this.rng() < 0.5) { b.act = { k: 'grasp', t: 1.3 / sp, sh: { k: 'circle', x: foe.x, z: foe.z, r: 2.3 } }; b.cdT = 2.0; }   // hands from the floor where you stand: keep moving
      else if (b.cdT <= 0 && ph >= 1 && this.rng() < 0.35) {   // it is simply behind you now
        const bx = foe.x + Math.sin(foe.yaw) * 2.4, bz = foe.z + Math.cos(foe.yaw) * 2.4; if (this.W.groundAt(bx, bz, foe.y + 1) < foe.y + 0.8) { b.x = bx; b.z = bz; b.y = this.W.groundAt(bx, bz, foe.y + 1); }
        b.cdT = 1.0; this.event('sound', { s: 'smoke', x: b.x, z: b.z });
      } else if (b.vuln <= 0) this.bossMove(b, foe.x, foe.z, 2.1 * sp, dt);
      this.tele = [];
    } else {
      const A = b.act; A.t -= dt; this.tele = [{ ...A.sh, t: Math.max(0, A.t), warn: true }];
      if (A.t <= 0) {
        if (A.k === 'reap') { this.bossHit(b, A.sh, (p) => (p.maxHp || 100) * B.reapFrac, 'scythe'); b.vuln = 2.2; }   // after a swing it is open
        if (A.k === 'grasp') { this.bossHit(b, A.sh, B.grasp, 'hands'); b.vuln = ph === 2 ? 1.2 : 0.8; }
        b.act = null; this.tele = [];
      }
    }
  }
  reaperFall() {   // the Reaper wins, for a moment
    const b = this.boss; if (!b || b.fell) return; b.fell = true; b.act = null; this.tele = []; b.vuln = 0;
    this.scene(BOSSES.reaper.fall);
  }
  reaperEnd() {   // the last blow: it does not die. It lowers the scythe.
    const b = this.boss; if (!b || b.ending) return; b.ending = true; b.act = null; this.tele = []; b.vuln = 0;
    this.scene(BOSSES.reaper.end);
  }
  ballTick(dt) {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const n = this.balls[i]; n.age += dt; n.vy -= 12 * dt; n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt;
      const g = this.W.groundAt(n.x, n.z, n.y + 0.5);
      if (n.y <= g) { n.y = g; n.vy = Math.abs(n.vy) * 0.55; n.bounces++; }
      if (n.bounces >= 2 || n.age > 4) {
        this.balls.splice(i, 1);
        for (const p of this.players.values()) if (p.alive && p.team !== 'T') { const d = Math.hypot(p.x - n.x, p.y - n.y, p.z - n.z); if (d < n.r) this.damage(p, this.boss, n.dmg * (1 - d / n.r * 0.6), 'rocket_ball', 'chest', false); }
        if (n.kind === 'bottle') this.event('sound', { s: 'glass', x: n.x, z: n.z }); else this.event('explode', { x: n.x, y: n.y, z: n.z, r: n.r });
      }
    }
  }
  // ---- per tick ----
  tick(dt) {
    this.clock = (this.clock || 0) + dt;
    if (this.cutT > 0) { this.cutT -= dt; if (this.cutT <= 0 && this.phase === 'freeze') { this.phase = 'live'; this.timer = 99999; this.event('round', { n: 1, phase: 'live', score: this.score }); this.begin(this.startObj); } }
    if (this.phase === 'freeze' && this.cutT <= 0 && this.obj < 0) { this.phase = 'live'; this.timer = 99999; this.event('round', { n: 1, phase: 'live', score: this.score }); this.begin(this.startObj); }
    if (this.slowT > 0) { this.slowT -= dt; dt *= this.slowK; }
    if (this.cutT > 0 || this.sceneT > 0 || this.dirs.length) this.direct(dt);
    for (const q of this.players.values()) if (q.walkTo) { const d = Math.hypot(q.walkTo[0] - q.x, q.walkTo[1] - q.z); if (d < 0.4) q.walkTo = null; else { q.yaw = Math.atan2(-(q.walkTo[0] - q.x), -(q.walkTo[1] - q.z)); moveStep(this.W, q, { f: 1, s: 0, walk: true }, dt, 2.2); } }
    if (this.sceneT > 0) { this.sceneT -= dt; this.paused = true; for (const p of this.players.values()) if (p.bot && !p.walkTo) { p.vx = p.vz = 0; } this.clockPush(); return; }
    this.paused = this.cutT > 0 && this.phase === 'freeze';
    super.tick(dt);
    if (this.result) { this.endT -= dt; if (this.endT <= 0 && this.phase !== 'done') { this.phase = 'done'; this.event('storyEnd', { win: true, mission: this.mi, diff: this.diffKey, kills: this.kills, chapterEnd: !!this.mission.last, runId: this.runId }); this.event('done', {}); } return; }
    if (this.phase !== 'live') return;
    if (this.failT > 0) { this.failT -= dt; if (this.failT <= 0) this.retry(); return; }
    for (const e of this.effects) if (e.type === 'poison') for (const p of this.players.values()) {   // poison clouds
      if (!p.alive || Math.hypot(p.x - e.x, p.z - e.z) > e.r) continue;
      if (e.hurtsSquad ? p.team === 'T' : p.team !== 'T') continue;
      p.poisonAcc = (p.poisonAcc || 0) + dt; if (p.poisonAcc >= 0.5) { p.poisonAcc = 0; this.damage(p, this.players.get(e.owner), e.dps * 0.5, e.hurtsSquad ? 'fart' : 'cancer_nade', 'chest', false, true); }
      p.vx *= 0.9; p.vz *= 0.9;
    }
    // dead enemies are cleared away after a moment (keeps the host light)
    for (const id of [...this.enemies]) { const p = this.players.get(id); if (!p) { this.enemies.delete(id); continue; } if (!p.alive) { p.goneT = (p.goneT || 0) + dt; if (p.goneT > 4) { this.players.delete(id); this.enemies.delete(id); this.dirtyRoster = true; } } }
    if (this.dirtyRoster) { this.dirtyRoster = false; this.broadcastRoster(); }
    // AI squadmates get back up next to a living human
    for (const p of this.players.values()) if (p.squad && p.bot && !p.alive && p.reviveAt && this.clock >= p.reviveAt) {
      p.reviveAt = 0; const h = this.humans()[0]; this.spawn(p); this.loadout(p);
      if (h) { p.x = h.x + Math.sin(hash(p.id)) * 1.5; p.z = h.z + Math.cos(hash(p.id)) * 1.5; p.y = this.W.groundAt(p.x, p.z, h.y + 1); }
    }
    // AI squadmates use their abilities
    for (const p of this.players.values()) if (p.squad && p.bot && p.alive) {
      if (p.char === 'wiener' && this.humans().some((h) => h.hp < 60 && Math.hypot(h.x - p.x, h.z - p.z) < 8)) this.ability(p);
      if (p.char === 'igor' && this.boss) this.ability(p);
    }
    const st = this.state, o = this.mission.objectives[this.obj]; if (!st || !o) return;
    st.t += dt;
    const H = this.humans(), near = (m, r) => H.find((h) => Math.hypot(h.x - m.x, h.z - m.z) < r);
    let done = false;
    switch (o.kind) {
      case 'reach': done = !!near(this.markers[0], 4); break;
      case 'clear': {
        st.have = [...st.ids].filter((id) => { const p = this.players.get(id); return !p || !p.alive; }).length; done = st.have >= st.need;
        // the last few (or everyone, after a minute and a half) stop guarding and come looking for the squad
        if (st.need - st.have <= Math.max(2, st.need * 0.3) || st.t > 90) for (const id of st.ids) { const p = this.players.get(id); if (p && p.guard) p.guard = null; }
        // stragglers get marked on everyone's screen; one that still can't be found after four minutes has fled
        const left = [...st.ids].map((id) => this.players.get(id)).filter((p) => p && p.alive);
        if (st.have !== st.lastHave) { st.lastHave = st.have; st.lastKill = st.t; }
        if (left.length && (left.length <= 2 ? st.t > 60 : st.t > 150)) { this.markers = this.markers.filter((m) => m.kind !== 'target').concat(left.slice(0, 4).map((p) => ({ id: 'x' + p.id, x: p.x, z: p.z, kind: 'target', label: left.length <= 2 ? 'Last one' : 'Enemy' }))); if (st.t - (st.lastKill || 0) > 75 && st.t > 200) for (const p of left) this.kill(p, null, 'world', false, false); }
        break;
      }
      case 'defend': case 'survive': {
        const holding = o.kind === 'survive' || !!near({ x: st.pt[0], z: st.pt[1] }, 7);
        if (holding) st.have = Math.min(st.need, st.have + dt);
        this.waveT -= dt; if (this.waveT <= 0) { this.waveT = Math.max(9, 18 - this.mission.tier); if (this.enemies.size < 14) this.wave(3 + (this.mission.tier >> 1)); }
        done = st.have >= st.need; break;
      }
      case 'collect': for (const m of this.markers) if (!m.done && near(m, 1.6)) { m.done = true; st.have++; this.event('sound', { s: 'pickup', x: m.x, z: m.z }); this.push(true); } done = st.have >= st.need; break;
      case 'interact': {
        for (const m of this.markers) {
          if (m.done) continue;
          const user = H.find((h) => h.defusing && Math.hypot(h.x - m.x, h.z - m.z) < 1.8);
          if (!user) { if (m.prog) { m.prog = Math.max(0, m.prog - dt); } continue; }
          if (st.puzzle && m.n !== st.next) {   // wrong one: an alarm and a few guards come running
            if (this.alarm <= 0) { this.alarm = 6; this.event('banner', { text: 'WRONG ORDER', sub: `start with ${st.next}` }); this.wave(2); for (const q of this.markers) q.prog = 0; this.push(true); }
            continue;
          }
          m.prog = Math.min(1, m.prog + dt / 1.6); if (m.prog >= 1) { m.done = true; st.have++; st.next++; this.event('sound', { s: 'pickup', x: m.x, z: m.z }); }
          this.push();
        }
        this.alarm -= dt; done = st.have >= st.need; break;
      }
      case 'defuse': {
        const m = this.markers[0], user = H.find((h) => h.defusing && Math.hypot(h.x - m.x, h.z - m.z) < 1.8);
        if (user) m.prog = Math.min(1, m.prog + dt / st.need); else m.prog = Math.max(Math.floor(m.prog * 4) / 4, m.prog - dt * 0.05);   // progress sticks at each quarter
        this.waveT -= dt; if (this.waveT <= 0) { this.waveT = 14; if (this.enemies.size < 10) this.wave(2 + (this.mission.tier >> 2)); }
        this.push(); done = m.prog >= 1; break;
      }
      case 'escort': { this.waveT -= dt; if (this.waveT <= 0) { this.waveT = 16; if (this.enemies.size < 10) this.wave(2); } done = !!this.npc && this.npc.alive && Math.hypot(this.npc.x - this.markers[0].x, this.npc.z - this.markers[0].z) < 4.5; if (done) { this.players.delete(this.npc.id); this.npc = null; this.broadcastRoster(); } break; }
      case 'boss': this.bossTick(dt); this.ballTick(dt); done = !this.boss && st.have > 0; break;
      case 'rescue': {
        const m = this.markers[0], user = H.find((h) => h.defusing && Math.hypot(h.x - m.x, h.z - m.z) < 2);
        if (user) st.have = Math.min(st.need, st.have + dt); else st.have = Math.max(0, st.have - dt * 0.5);
        m.prog = st.have / st.need; if (st.limit && st.t > st.limit && !this.failT) { this.event('banner', { text: 'TOO LATE', sub: 'back to the last checkpoint…' }); this.failT = 3; }
        this.push(); done = st.have >= st.need;
        if (done) this.freeChar(st.who, m);
        break;
      }
      case 'intel': {
        if (!st.spotted && (st.lookT -= dt) <= 0) {   // the blizzard: guards only see a few metres
          st.lookT = 0.25;
          for (const id of st.guards || []) { const e = this.players.get(id); if (!e || !e.alive || !e.passive) continue;
            for (const h of H) { const ddx = h.x - e.x, ddz = h.z - e.z, d = Math.hypot(ddx, ddz); let off = Math.atan2(-ddx, -ddz) - e.yaw; off = Math.atan2(Math.sin(off), Math.cos(off));
              if (d < 1.4 || (d < st.sight && Math.abs(off) < 1.1 && this.W.los({ x: e.x, y: e.y + 1.6, z: e.z }, { x: h.x, y: h.y + 1.2, z: h.z }))) { this.alarm2(); break; }
              if (d < st.sight * 1.6 && Math.abs(off) < 1.1) { e.yaw += off * 0.5; if (!e.sus) { e.sus = true; this.event('sound', { s: 'radio', x: e.x, z: e.z }); this.event('bark', { who: 'enemy', name: 'Guard', text: '...hello? Who\'s there?' }); } } else e.sus = false; }   // a guard turning toward a noise: the warning
            if (st.spotted) break;
            e.yaw += Math.sin((this.clock || 0) * 0.5 + (hash(id) % 9)) * 0.1;   // they turn their heads in the wind
          }
        }
        for (const m of this.markers) {
          if (m.done) continue;
          const user = H.find((h) => h.defusing && Math.hypot(h.x - m.x, h.z - m.z) < 1.4);
          if (!user) { m.prog = Math.max(0, m.prog - dt); continue; }
          m.prog = Math.min(1, m.prog + dt / 1.8);
          if (m.prog >= 1) {
            if (m.opt === st.answer) { m.done = true; st.have = 1; this.event('sound', { s: 'pickup', x: m.x, z: m.z }); }
            else { m.prog = 0; this.event('banner', { text: 'WRONG FILE', sub: 'it doesn\'t match the clue' }); this.alarm2(); }
          }
        }
        this.push(); done = st.have >= st.need; break;
      }
      case 'ability': done = this.healed > 0; break;
      case 'explore': for (const m of this.markers) if (!m.done && near(m, 3.2)) { m.done = true; st.have++; this.talk(m.say); this.push(true); } done = st.have >= st.need; break;
      case 'stealth': {
        if (!st.spotted && (st.lookT -= dt) <= 0) {   // a guard spots anyone in front of them, in the open, within 16 m
          st.lookT = 0.25;
          for (const id of st.guards || []) { const e = this.players.get(id); if (!e || !e.alive || !e.passive) continue;
            for (const h of H) { const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz); if (d > 16) continue;
              let off = Math.atan2(-dx, -dz) - e.yaw; off = Math.atan2(Math.sin(off), Math.cos(off));
              if ((Math.abs(off) < 1.0 || d < 3) && this.W.los({ x: e.x, y: e.y + 1.6, z: e.z }, { x: h.x, y: h.y + 1.2, z: h.z })) { this.alarm2(); break; } }
            if (st.spotted) break;
            e.yaw += Math.sin(this.clock * 0.7 + hash(id) % 7) * dt * 0.6;   // guards look around
          }
        }
        done = !!near(this.markers[0], 4); break;
      }
      case 'revive': {
        const v = this.players.get(st.who), m = this.markers[0];
        if (!v || !v.alive) { done = true; break; }
        m.x = v.x; m.z = v.z; v.vx = v.vz = 0;
        const user = H.find((h) => h !== v && h.defusing && Math.hypot(h.x - v.x, h.z - v.z) < 2), medic = [...this.players.values()].find((q) => q.squad && q.bot && q.alive && q !== v && Math.hypot(q.x - v.x, q.z - v.z) < 2);
        if (user || medic) st.have = Math.min(st.need, st.have + dt * (user ? 1 : 0.5)); else st.have = Math.max(0, st.have - dt * 0.3);
        m.prog = st.have / st.need;
        this.waveT -= dt; if (this.waveT <= 0) { this.waveT = 10; if (this.enemies.size < 12) this.wave(3); }
        this.push(); done = st.have >= st.need; if (done) { v.downed = false; v.passive = false; v.hp = Math.max(v.hp, 60); }
        break;
      }
      case 'carry': {
        const c = this.players.get(st.who), m = this.markers[1];
        if (!c || !c.alive) break;   // kill() sends everyone back to the checkpoint
        m.x = c.x; m.z = c.z;
        this.waveT -= dt; if (this.waveT <= 0) { this.waveT = Math.max(8, 14 - this.mission.tier); if (this.enemies.size < 14) this.wave(3); }
        this.push(); done = Math.hypot(c.x - st.pt[0], c.z - st.pt[1]) < 4;
        if (done) { c.carrying = false; c.passive = false; }
        break;
      }
      default: done = true;
    }
    if (done) {
      if (o.give) { const q = [...this.players.values()].find((p) => p.squad && p.alive && p.char === o.give[0]); this.give2(q, o.give[1]); }
      this.event('banner', { text: 'OBJECTIVE COMPLETE', sub: o.hint }); this.talk(o.done); this.begin(this.obj + 1); return;
    }
    if (this.clock - this.lastSend > 0.5) this.push();
  }
  clockPush() { if ((this.clock || 0) - this.lastSend > 1) this.push(true); }
  // the story state every client draws: objective text and progress, markers, beam warning, rocket balls, boss bar
  push(force) {
    if (!force && this.clock - this.lastSend < 0.25) return;
    this.lastSend = this.clock || 0;
    const st = this.state, o = st && this.mission.objectives[this.obj];
    const b = this.boss, bm = b && b.beam;
    this.event('story', {
      mission: this.mi, obj: this.obj, n: this.mission.objectives.length, hint: o ? o.hint : '', kind: o ? o.kind : '', have: st ? Math.floor(st.have) : 0, need: st ? Math.round(st.need) : 0,
      next: st && st.puzzle ? st.next : 0,
      markers: this.markers.map((m) => ({ id: m.id, x: +m.x.toFixed(2), z: +m.z.toFixed(2), kind: m.kind, label: m.label, done: !!m.done, prog: +(m.prog || 0).toFixed(2) })),
      boss: b ? { id: b.id, hp: Math.max(0, Math.round(b.hp)), max: b.maxHp, name: b.bossKey && BOSSES[b.bossKey] ? BOSSES[b.bossKey].name : BOSS.name } : null,
      beam: bm ? { x: bm.x, z: bm.z, dx: bm.dx, dz: bm.dz, len: BOSS.attacks.goy_beam.length, w: BOSS.attacks.goy_beam.width, warn: !!bm.charge, t: +bm.t.toFixed(2) } : null,
      balls: this.balls.map((n) => [+n.x.toFixed(1), +n.y.toFixed(1), +n.z.toFixed(1)]),
      chars: [...this.players.values()].filter((p) => p.squad && !p.spectator).map((p) => ({ id: p.id, char: p.char, hp: Math.round(p.hp), max: p.maxHp, alive: p.alive, bot: p.bot, cd: Math.max(0, Math.round((this.abilityT.get(p.id) || 0) - (this.clock || 0))), nade: !this.nadeUsed.has(p.id + '|' + this.obj) || (this.state && this.state.kind === 'boss'), lock: !this.unlocked(p.char), speed: p.speedMul || 1, scale: p.scale || 1, down: !!p.downed })),
      featured: this.featured ? { char: this.featured, id: this.featuredId } : null, actors: [...this.players.values()].filter((p) => p.actorId).map((p) => ({ id: p.id, who: p.actorId })), vision: this.vision, music: this.music,
      tele: this.tele.map((t) => ({ k: t.k, x: +t.x.toFixed(2), z: +t.z.toFixed(2), r: t.r, a: t.a || 0, w: t.w || 0, dx: t.dx || 0, dz: t.dz || 0, t: +(t.t || 0).toFixed(2), warn: !!t.warn })), vuln: this.boss ? this.boss.vuln > 0 : false,
      result: this.result,
    });
  }
}
