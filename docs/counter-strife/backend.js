// The player's profile: coins, XP, inventory, equipped cosmetics, quests and stats.
// Without an account it lives in this browser. With the free Supabase account set up (config.backend), coins and
// items live on the server and every coin-changing action runs server-side (crates roll there, daily earning caps
// apply), so a player can't just edit their way to a knife. The public key in the config is meant to be public.
import { DEFAULT_ATT, gunLevel, attOK } from './guns.js';
import { CRATE_BY_ID, CRATES, rollCrate, itemInfo, newItem, ITEM_BY_ID, PASS, DEFAULT_EMOTES, EMOTE_BY_ID } from './skins.js';

const LS = 'cs:profile:v1', TOK = 'cs:session:v1';
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
export const levelOf = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
export const xpFor = (lvl) => (lvl - 1) ** 2 * 100;

// quests: picked fresh each day / week, tracked from match events
const QUEST_POOL = [
  { id: 'kills', text: 'Get {n} kills', n: [12, 40], coins: [120, 400], stat: 'k' }, { id: 'wins', text: 'Win {n} matches', n: [2, 6], coins: [180, 500], stat: 'win' },
  { id: 'hs', text: 'Get {n} headshot kills', n: [5, 20], coins: [140, 420], stat: 'hs' }, { id: 'plant', text: 'Plant the bomb {n} times', n: [2, 8], coins: [120, 350], stat: 'plant' },
  { id: 'defuse', text: 'Defuse the bomb {n} times', n: [1, 4], coins: [150, 400], stat: 'defuse' }, { id: 'pistol', text: 'Get {n} pistol kills', n: [5, 18], coins: [130, 380], stat: 'pistol' },
  { id: 'smg', text: 'Get {n} SMG kills', n: [4, 15], coins: [130, 360], stat: 'smg' }, { id: 'knife', text: 'Get {n} knife kill(s)', n: [1, 3], coins: [200, 450], stat: 'knife' },
  { id: 'rounds', text: 'Win {n} rounds', n: [10, 40], coins: [120, 380], stat: 'roundWin' }, { id: 'dmg', text: 'Deal {n} damage', n: [1500, 6000], coins: [120, 380], stat: 'dmg' },
  { id: 'mvp', text: 'Earn {n} MVPs', n: [3, 10], coins: [140, 400], stat: 'mvp' }, { id: 'nade', text: 'Get {n} grenade kills', n: [1, 4], coins: [180, 420], stat: 'nade' },
];
const dayKey = () => Math.floor(Date.now() / 86400000), weekKey = () => Math.floor((Date.now() / 86400000 + 3) / 7);
function makeQuests(key, weekly) {
  let s = key * 7919 + (weekly ? 13 : 1); const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pool = QUEST_POOL.slice(), out = [];
  for (let i = 0; i < (weekly ? 2 : 3); i++) { const q = pool.splice(Math.floor(r() * pool.length), 1)[0]; const k = weekly ? 1 : 0; out.push({ id: q.id + (weekly ? 'W' : 'D'), text: q.text.replace('{n}', q.n[k]), goal: q.n[k], coins: q.coins[k], stat: q.stat, prog: 0, claimed: false, weekly }); }
  return out;
}

const fresh = () => ({ guns: {}, name: '', coins: 500, xp: 0, inventory: [], equipped: { T: {}, CT: {} }, stats: { matches: 0, wins: 0, k: 0, d: 0, hs: 0, mvp: 0 }, quests: null, qday: 0, qweek: 0, lastDaily: 0, settings: {}, pass: [] });

export class Profile {
  constructor(cfg) {
    this.cfg = cfg; this.cloud = !!(cfg.backend && cfg.backend.url && cfg.backend.anonKey);
    this.d = Object.assign(fresh(), lsGet(LS, {}));
    this.sess = lsGet(TOK, null); this.listeners = new Set(); this.online = false;
    // back from the confirmation email: the link carries the new session in the address (#access_token=...)
    try {
      const h = new URLSearchParams(location.hash.slice(1));
      if (this.cloud && h.get('access_token') && h.get('refresh_token')) {
        this.sess = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600 }; lsSet(TOK, this.sess);
        this.justConfirmed = h.get('type') === 'signup'; history.replaceState(null, '', location.pathname + location.search);
      }
    } catch (e) { /* no address bar (tests) */ }
    this.ensureQuests();
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed() { lsSet(LS, this.d); for (const f of this.listeners) try { f(this); } catch (e) { /* ui gone */ } }
  get level() { return levelOf(this.d.xp); }
  ensureQuests() {
    if (this.d.qday !== dayKey() || !this.d.quests) { const keep = (this.d.quests || []).filter((q) => q.weekly && this.d.qweek === weekKey()); this.d.quests = [...makeQuests(dayKey(), false), ...(keep.length ? keep : makeQuests(weekKey(), true))]; this.d.qday = dayKey(); this.d.qweek = weekKey(); }
  }
  // ---- server (Supabase REST, no library) ----
  async req(path, body, method = 'POST', auth = true) {
    const b = this.cfg.backend, h = { apikey: b.anonKey, 'Content-Type': 'application/json' };
    if (auth && this.sess) h.Authorization = 'Bearer ' + this.sess.access_token;
    const r = await fetch(b.url.replace(/\/$/, '') + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = { message: txt }; }
    if (r.status === 401 && auth && this.sess && this.sess.refresh_token && !path.includes('/auth/')) { if (await this.refresh()) return this.req(path, body, method, auth); }
    if (!r.ok) throw new Error((j && (j.msg || j.message || j.error_description || j.error)) || 'HTTP ' + r.status);
    return j;
  }
  async refresh() { try { const j = await this.req('/auth/v1/token?grant_type=refresh_token', { refresh_token: this.sess.refresh_token }, 'POST', false); this.sess = j; lsSet(TOK, j); return true; } catch (e) { this.sess = null; lsSet(TOK, null); return false; } }
  async signUp(email, password, name) { const j = await this.req('/auth/v1/signup?redirect_to=' + encodeURIComponent(location.href.split('#')[0]), { email, password, data: { name } }, 'POST', false); if (j.access_token) { this.sess = j; lsSet(TOK, j); } return j; }
  async signIn(email, password) { const j = await this.req('/auth/v1/token?grant_type=password', { email, password }, 'POST', false); this.sess = j; lsSet(TOK, j); await this.sync(); return j; }
  signOut() { this.sess = null; lsSet(TOK, null); this.online = false; this.changed(); }
  get signedIn() { return this.cloud && !!this.sess; }
  rpc(fn, args = {}) { return this.req('/rest/v1/rpc/' + fn, args); }
  async sync() {
    if (!this.signedIn) return false;
    try {
      const p = await this.rpc('cs_profile', { p_name: this.d.name || 'Player' });
      this.d.coins = p.coins; this.d.xp = p.xp; this.d.equipped = p.equipped || this.d.equipped; this.d.stats = Object.assign(this.d.stats, p.stats || {});
      if (p.name) this.d.name = p.name;
      this.d.pass = Array.isArray(p.pass) ? p.pass : []; if (p.guns && typeof p.guns === 'object') this.d.guns = p.guns;
      this.tag = p.tag || null; this.admin = !!p.admin; this.dep = p.dep || null;
      this.d.inventory = (p.items || []).map((i) => ({ uid: i.uid, def: i.def, float: i.float, st: i.st, seed: i.seed, kills: i.kills || 0, t: Date.parse(i.created) || 0, listed: i.listed || null }));
      this.online = true; this.changed(); return true;
    } catch (e) { this.online = false; this.err = String(e.message || e); return false; }
  }
  // ---- coins & items ----
  async reward(kind, coins, xp, detail = {}) {
    if (this.signedIn) { try { const r = await this.rpc('cs_reward', { p_kind: kind, p_coins: Math.round(coins), p_xp: Math.round(xp), p_detail: detail }); this.d.coins = r.coins; this.d.xp = r.xp; this.changed(); return r.granted; } catch (e) { this.err = String(e.message || e); return 0; } }
    const lvl = this.level; this.d.coins += Math.round(coins); this.d.xp += Math.round(xp);
    if (this.level > lvl) this.d.coins += 200 * (this.level - lvl);
    this.changed(); return Math.round(coins);
  }
  async openCrate(id) {
    const c = CRATE_BY_ID[id]; if (!c) throw new Error('no such crate');
    if (this.d.coins < c.price) throw new Error('Not enough coins');
    if (this.signedIn) { const it = await this.rpc('cs_open_crate', { p_crate: id }); const item = { uid: it.uid, def: it.def, float: it.float, st: it.st, seed: it.seed, kills: 0, t: Date.now() }; this.d.coins = it.coins; this.d.inventory.unshift(item); this.changed(); return item; }
    const item = rollCrate(c); this.d.coins -= c.price; this.d.inventory.unshift(item); this.changed(); return item;
  }
  async sell(uid) {
    const it = this.d.inventory.find((x) => x.uid === uid); if (!it) return 0;
    if (this.signedIn) { const r = await this.rpc('cs_sell', { p_uid: uid }); this.d.coins = r.coins; } else this.d.coins += Math.round(itemInfo(it).value * 0.8);
    this.d.inventory = this.d.inventory.filter((x) => x.uid !== uid); this.unequip(uid); this.changed(); return 1;
  }
  async listings() { if (!this.signedIn) return []; return this.req('/rest/v1/cs_listings?select=*&order=created.desc&limit=200', null, 'GET'); }
  async listItem(uid, price) { await this.rpc('cs_list', { p_uid: uid, p_price: Math.round(price) }); await this.sync(); }
  async unlistItem(uid) { await this.rpc('cs_unlist', { p_uid: uid }); await this.sync(); }
  async buyListing(id) { await this.rpc('cs_buy', { p_listing: id }); await this.sync(); }
  // ---- friends, trades, gifts (accounts only; every check runs on the server) ----
  async setName(n) {
    n = String(n || '').replace(/[<>#]/g, '').trim().slice(0, 20);
    if (n.length < 2) throw new Error('Names need 2+ characters');
    if (this.signedIn) {
      try { await this.rpc('cs_set_name', { p_name: n }); } catch (e) {
        if (/function|schema cache|404/i.test(String(e.message))) throw new Error('The game database needs its update before names can change (STUMF does it when its Supabase access token is in Settings).');
        throw e;
      }
    }
    this.d.name = n; this.changed(); return n;
  }
  friends() { return this.rpc('cs_friends_list'); }
  addFriend(handle) { return this.rpc('cs_friend_request', { p_handle: handle }); }
  acceptFriend(id) { return this.rpc('cs_friend_accept', { p_id: id }); }
  removeFriend(id) { return this.rpc('cs_friend_remove', { p_id: id }); }
  friendItems(id) { return this.rpc('cs_friend_items', { p_id: id }); }
  async giftCoins(id, n) { const c = await this.rpc('cs_gift_coins', { p_to: id, p_amount: Math.round(n) }); this.d.coins = c; this.changed(); return c; }
  offerTrade(to, give, giveCoins, want, wantCoins) { return this.rpc('cs_trade_offer', { p_to: to, p_give: give, p_give_coins: Math.round(giveCoins || 0), p_want: want, p_want_coins: Math.round(wantCoins || 0) }); }
  trades() { return this.rpc('cs_trades_list'); }
  async respondTrade(id, ok) { const r = await this.rpc('cs_trade_respond', { p_id: id, p_accept: !!ok }); await this.sync(); return r; }
  adminFind(q) { return this.rpc('cs_admin_find', { p_q: q || '' }); }
  adminGrant(id, coins, def, count) { return this.rpc('cs_admin_grant', { p_id: id, p_coins: Math.round(coins || 0), p_def: def || null, p_count: Math.round(count || 1) }); }
  // ---- loadout ----
  equip(team, slotKey, uid) { this.d.equipped[team] = this.d.equipped[team] || {}; this.d.equipped[team][slotKey] = uid; this.saveEquip(); }
  unequip(uid) { for (const t of ['T', 'CT']) for (const k in this.d.equipped[t] || {}) if (this.d.equipped[t][k] === uid) delete this.d.equipped[t][k]; this.saveEquip(); }
  saveEquip() { this.changed(); if (this.signedIn) this.rpc('cs_equip', { p_equipped: this.d.equipped }).catch(() => {}); }
  // what this player brings into a match for a team: {wid: skin, knife: {...}, agent: id}
  loadoutFor(team) {
    const eq = this.d.equipped[team] || {}, out = { skins: {}, knife: null, agent: null, ctPistol: this.d.settings.ctPistol || 'usp', ctRifle: this.d.settings.ctRifle || 'm4a4' };
    for (const [k, uid] of Object.entries(eq)) {
      if (k === 'emotes') continue;
      const it = this.d.inventory.find((x) => x.uid === uid); if (!it) continue;
      const d = ITEM_BY_ID[it.def]; if (!d) continue;
      const s = { def: it.def, float: it.float, seed: it.seed, st: it.st, uid: it.uid, kills: it.kills };
      if (d.kind === 'agent') out.agent = d.weapon; else if (d.kind === 'knife') out.knife = s; else if (d.kind === 'skin') out.skins[d.weapon] = s;
    }
    out.att = {}; for (const [wid, g] of Object.entries(this.d.guns || {})) if (g && g.att && wid !== '_day') { const a = {}; for (const [slot, id] of Object.entries(g.att)) if (attOK(wid, slot, id, g.xp | 0) && id !== DEFAULT_ATT[slot]) a[slot] = id; if (Object.keys(a).length) out.att[wid] = a; }
    return out;
  }
  // ---- gun levels and attachments (XP from damage, kills and round wins; attachments unlock by level) ----
  gun(wid) { const g = (this.d.guns || {})[wid] || {}; return { xp: g.xp | 0, att: { ...DEFAULT_ATT, ...(g.att || {}) } }; }
  async gunXp(gains) {
    const clean = {}; for (const [k, v] of Object.entries(gains || {})) if (/^[a-z0-9]{2,12}$/.test(k) && v > 0) clean[k] = Math.min(3000, Math.round(v));
    if (!Object.keys(clean).length) return [];
    const before = Object.fromEntries(Object.keys(clean).map((k) => [k, gunLevel(this.gun(k).xp)]));
    if (this.signedIn) { try { this.d.guns = await this.rpc('cs_gun_xp', { p_gains: clean }); } catch (e) { this.err = String(e.message || e); return []; } }
    else { this.d.guns = this.d.guns || {}; for (const [k, v] of Object.entries(clean)) { const g = this.d.guns[k] = this.d.guns[k] || {}; g.xp = (g.xp | 0) + v; } }
    this.changed();
    return Object.keys(clean).map((k) => ({ wid: k, xp: clean[k], from: before[k], to: gunLevel(this.gun(k).xp) }));
  }
  async gunEquip(wid, slot, id) {
    if (!attOK(wid, slot, id, this.gun(wid).xp)) throw new Error('Level that gun up first');
    if (this.signedIn) this.d.guns = await this.rpc('cs_gun_equip', { p_wid: wid, p_slot: slot, p_att: id });
    else { this.d.guns = this.d.guns || {}; const g = this.d.guns[wid] = this.d.guns[wid] || {}; g.att = { ...(g.att || {}), [slot]: id }; }
    this.changed();
  }
  // ---- the free battle pass (a reward per level; claimed once) ----
  passTier(t) { return PASS.tiers[t - 1]; }
  async claimPass(t) {
    if (this.level < t) throw new Error(`Reach level ${t} first`);
    if ((this.d.pass || []).includes(t)) throw new Error('Already claimed');
    const tier = this.passTier(t); if (!tier) throw new Error('No such tier');
    let item;
    if (this.signedIn) { const it = await this.rpc('cs_claim_pass', { p_tier: t }); item = { uid: it.uid, def: it.def, float: it.float, st: false, seed: it.seed, kills: 0, t: Date.now() }; }
    else { const k = ITEM_BY_ID[tier.def].kind; item = newItem(tier.def, k === 'agent' || k === 'emote' ? 0 : Math.random() * 0.38, false, Math.floor(Math.random() * 1000)); }
    this.d.pass = [...(this.d.pass || []), t]; this.d.inventory.unshift(item); this.changed(); return item;
  }
  // emotes: two everyone has, plus any unlocked; up to 4 on the wheel
  ownedEmotes() { return [...new Set([...DEFAULT_EMOTES, ...this.d.inventory.map((i) => ITEM_BY_ID[i.def]).filter((d) => d && d.kind === 'emote').map((d) => d.weapon)])]; }
  wheel() { const own = this.ownedEmotes(), w = (this.d.equipped.emotes || []).filter((e) => own.includes(e)); for (const e of own) if (w.length < 4 && !w.includes(e)) w.push(e); return w.slice(0, 4); }
  setWheel(slot, id) { const w = this.wheel(); const at = w.indexOf(id); if (at >= 0) w[at] = w[slot]; w[slot] = id; this.d.equipped.emotes = w.filter((x) => EMOTE_BY_ID[x]); this.saveEquip(); }
  // ---- stats & quests after a match ----
  async matchDone(r) {
    const s = this.d.stats; s.matches++; if (r.win) s.wins++; s.k += r.k; s.d += r.d; s.hs += r.hs; s.mvp += r.mvp;
    for (const q of this.d.quests) if (!q.claimed) q.prog = Math.min(q.goal, q.prog + (r[q.stat] || 0));
    const coins = Math.min(600, (r.win ? 300 : r.draw ? 150 : 100) + r.k * 10 + r.roundWin * 20 + r.mvp * 25) * (r.botsOnly ? 0.5 : 1);
    const xp = 100 + r.k * 15 + r.roundWin * 20 + (r.win ? 150 : 0);
    const got = await this.reward('match', coins, xp, { k: r.k, d: r.d, win: !!r.win, rounds: r.rounds });
    this.changed(); return { coins: got, xp };
  }
  async claimQuest(id) { const q = this.d.quests.find((x) => x.id === id); if (!q || q.claimed || q.prog < q.goal) return 0; q.claimed = true; const got = await this.reward('quest', q.coins, q.coins / 2, { q: id }); this.changed(); return got; }
  async daily() { if (this.d.lastDaily === dayKey()) return 0; this.d.lastDaily = dayKey(); return this.reward('daily', 100, 50, {}); }
  give(def) { this.d.inventory.unshift(newItem(def, Math.random() * 0.5, false, Math.floor(Math.random() * 1000))); this.changed(); }
}
export { CRATES };
