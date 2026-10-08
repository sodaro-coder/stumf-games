// Every screen: main menu (play, inventory, crates, market, quests, profile, settings), the lobby, the in-match HUD
// (health/armor, money, ammo, weapon slots, radar, round timer with team alive icons, kill feed, buy menu,
// scoreboard, chat, radio, spectating, scope, flash) and the end-of-match screen. Plain DOM, one stylesheet.
// Anything another player typed (names, chat) only ever goes in through textContent / esc().
import { WEAPONS, W_BY_ID, G_BY_ID, GEAR_BY_ID, BUY_MENU, MODES, BOT_LEVELS, RADIO, itemName, itemPrice, forTeam } from './data.js';
import { CRATES, RARITY, crateOdds, itemInfo, paintSkin, AGENT_BY_ID, KNIFE_BY_ID, ITEM_BY_ID, PASS, PASS_TIERS, EMOTE_BY_ID } from './skins.js';
import { MAPS } from './maps.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const fmtT = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

const CSS = `
:root{--o:#f2a33a;--bg:rgba(12,15,20,.86);--bg2:rgba(26,31,40,.92);--line:#2c3442;--t:#e9edf3;--mut:#8f9aab;--ct:#5d9cec;--tt:#e0a83a;--good:#7ed957;--bad:#ff5a5a}
.cs{font:14px/1.35 "Segoe UI",system-ui,sans-serif;color:var(--t);-webkit-user-select:none;user-select:none}
.cs *{box-sizing:border-box}.cs button{font:inherit;color:inherit;cursor:pointer}
.cs-menu{position:fixed;inset:0;z-index:200;display:grid;grid-template-columns:76px 1fr;background:radial-gradient(1200px 700px at 70% 20%,#26303e,#0b0e13 70%)}
.cs-side{background:rgba(0,0,0,.45);display:flex;flex-direction:column;align-items:center;padding:12px 0;gap:6px;border-right:1px solid var(--line)}
.cs-side button{width:60px;height:56px;border:0;border-radius:10px;background:transparent;font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--mut);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.cs-side button b{font-size:20px;line-height:1}.cs-side button.on,.cs-side button:hover{background:rgba(242,163,58,.14);color:var(--o)}
.cs-main{display:flex;flex-direction:column;min-width:0}
.cs-top{display:flex;align-items:center;gap:14px;padding:10px 18px;background:rgba(0,0,0,.35);border-bottom:1px solid var(--line)}
.cs-logo{font:900 22px "Segoe UI",system-ui;letter-spacing:.06em}.cs-logo i{color:var(--o);font-style:normal}
.cs-top .sp{flex:1}.cs-chip{padding:5px 10px;border-radius:999px;background:var(--bg2);border:1px solid var(--line);font-weight:700;white-space:nowrap}
.cs-coin{color:#ffd45a}.cs-lvl{color:#9fd0ff}
.cs-body{flex:1;overflow:auto;padding:18px}
.cs-h{font:800 13px system-ui;letter-spacing:.14em;color:var(--mut);margin:16px 0 8px;text-transform:uppercase}
.cs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.cs-card{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:12px;position:relative}
.cs-card.sel{border-color:var(--o);box-shadow:0 0 0 1px var(--o) inset}
.cs-card.click{cursor:pointer}.cs-card.click:hover{border-color:#4a5568}
.cs-btn{padding:10px 16px;border-radius:8px;border:0;background:var(--o);color:#1a1206 !important;font-weight:800;letter-spacing:.03em}
.cs-btn.alt{background:#2b3442;color:var(--t) !important}.cs-btn.sm{padding:6px 10px;font-size:12px}.cs-btn:disabled{opacity:.45;cursor:default}
.cs-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cs input,.cs select{background:#0d1117;border:1px solid var(--line);color:var(--t);border-radius:8px;padding:9px 10px;font:inherit}
.cs-mut{color:var(--mut)}.cs-small{font-size:12px}
.cs-rar{height:4px;border-radius:2px;margin-top:6px}
.cs-item canvas{width:100%;height:auto;display:block;border-radius:6px;background:#11161e}
.cs-item .n{font-weight:700;font-size:12px;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-item .w{font-size:11px;color:var(--mut)}
.cs-tag{position:absolute;top:8px;right:8px;font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;background:#000a}
.cs-bar{height:8px;background:#0d1117;border-radius:4px;overflow:hidden}.cs-bar i{display:block;height:100%;background:var(--o)}
.cs-modal{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.7);display:grid;place-items:center}
.cs-modal>.cs-card{width:min(640px,94vw);max-height:90vh;overflow:auto}
.cs-reel{position:relative;height:150px;overflow:hidden;border-radius:10px;background:#0b0e13;border:1px solid var(--line)}
.cs-reel .strip{position:absolute;left:0;top:10px;display:flex;gap:8px;will-change:transform}
.cs-reel .cell{width:130px;height:130px;background:var(--bg2);border-radius:8px;padding:6px;border-bottom:4px solid}
.cs-reel .cell canvas{width:100%;height:80px}.cs-reel .cell div{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cs-reel .mark{position:absolute;left:50%;top:0;bottom:0;width:2px;background:#ffd45a;box-shadow:0 0 10px #ffd45a}
/* HUD */
.cs-hud{position:fixed;inset:0;z-index:20;pointer-events:none;font:700 16px "Segoe UI",system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000}
.cs-hud .bl{position:absolute;left:14px;bottom:12px;display:flex;gap:16px;align-items:flex-end}
.cs-hud .stat{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.35);padding:4px 12px 4px 8px;border-radius:4px;font-size:28px;min-width:110px}
.cs-hud .stat small{font-size:12px;opacity:.8}.cs-hud .stat .ic{font-size:20px;opacity:.9}
.cs-hud .stat.low{color:#ff6a5a}
.cs-hud .br{position:absolute;right:14px;bottom:12px;text-align:right}
.cs-hud .ammo{font-size:32px;background:rgba(0,0,0,.35);padding:2px 12px;border-radius:4px;display:inline-block}.cs-hud .ammo small{font-size:16px;opacity:.75}
.cs-hud .slots{margin-bottom:8px;display:flex;flex-direction:column;align-items:flex-end;gap:3px}
.cs-hud .slot{font-size:13px;padding:2px 8px;border-radius:3px;background:rgba(0,0,0,.25);opacity:.55}.cs-hud .slot.on{opacity:1;background:rgba(242,163,58,.35)}
.cs-hud .slot b{color:var(--o);margin-right:6px}
.cs-hud .tl{position:absolute;left:12px;top:12px}
.cs-hud canvas.radar{width:190px;height:190px;border-radius:6px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.12);display:block}
.cs-hud .loc{font-size:13px;margin-top:4px;color:#d8e0ea}.cs-hud .money{font-size:20px;color:#7ed957;margin-top:2px}.cs-hud .money.minus{color:#ff6a5a}
.cs-hud .buyic{font-size:12px;color:#ffd45a;margin-top:2px}
.cs-hud .top{position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px}
.cs-hud .team{display:flex;gap:3px}.cs-hud .team i{width:16px;height:22px;border-radius:3px;display:block}
.cs-hud .team i.dead{opacity:.25}
.cs-hud .scoreb{font-size:22px;min-width:34px;text-align:center;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.45)}
.cs-hud .timer{font-size:22px;background:rgba(0,0,0,.55);padding:2px 12px;border-radius:4px;min-width:74px;text-align:center}
.cs-hud .timer.bomb{color:#ff4a3a;animation:csblink 1s infinite}
@keyframes csblink{50%{opacity:.35}}
.cs-hud .feed{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.cs-hud .kf{font-size:13px;padding:4px 8px;background:rgba(0,0,0,.55);border-radius:3px;display:flex;gap:6px;align-items:center}
.cs-hud .kf.mine{border:2px solid #d33}.cs-hud .kf .wpn{color:#ddd;font-size:11px;padding:0 4px}
.cs-hud .center{position:absolute;left:0;right:0;top:22%;text-align:center}
.cs-hud .banner{display:inline-block;padding:10px 24px;background:rgba(0,0,0,.6);border-radius:4px;font-size:26px;letter-spacing:.04em}
.cs-hud .banner small{display:block;font-size:14px;opacity:.85}
.cs-hud .prog{position:absolute;left:50%;top:62%;transform:translateX(-50%);width:260px;text-align:center;font-size:13px}
.cs-hud .prog .cs-bar{height:10px;margin-top:4px}
.cs-hud .hint{position:absolute;left:50%;bottom:110px;transform:translateX(-50%);font-size:14px;background:rgba(0,0,0,.45);padding:4px 10px;border-radius:4px}
.cs-hud .spec{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);font-size:16px;background:rgba(0,0,0,.55);padding:6px 16px;border-radius:4px}
.cs-hud .chat{position:absolute;left:14px;bottom:120px;width:min(420px,60vw);font-size:13px;display:flex;flex-direction:column;gap:2px}
.cs-hud .chat div{background:rgba(0,0,0,.35);padding:2px 6px;border-radius:3px}
.cs-hud .dmgdir{position:absolute;left:50%;top:50%;width:180px;height:180px;margin:-90px;border-radius:50%;border-top:6px solid rgba(255,40,40,.8);opacity:0;transition:opacity .5s}
.cs-xh{position:absolute;left:50%;top:50%;width:0;height:0}.cs-xh i{position:absolute;background:var(--xc,#5f5);box-shadow:0 0 0 1px rgba(0,0,0,var(--xo,.6))}
.cs-scope{position:fixed;inset:0;z-index:19;pointer-events:none;display:none;background:radial-gradient(circle at 50% 50%,transparent 0,transparent 34vh,#000 34.2vh)}
.cs-scope:before,.cs-scope:after{content:"";position:absolute;background:#000}.cs-scope:before{left:0;right:0;top:50%;height:1px}.cs-scope:after{top:0;bottom:0;left:50%;width:1px}
.cs-flash{position:fixed;inset:0;z-index:25;background:#fff;pointer-events:none;opacity:0}
.cs-hurt{position:fixed;inset:0;z-index:18;pointer-events:none;background:radial-gradient(transparent 55%,rgba(200,0,0,.55));opacity:0;transition:opacity .25s}
.cs-panel{position:fixed;z-index:120;left:50%;top:50%;transform:translate(-50%,-50%);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px;pointer-events:auto;max-width:96vw;max-height:92vh;overflow:auto}
.cs-buy{width:min(900px,96vw)}.cs-buy .cats{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.cs-buy .cat h4{margin:0 0 6px;font-size:12px;letter-spacing:.1em;color:var(--mut);text-transform:uppercase}
.cs-buy .it{display:flex;justify-content:space-between;gap:6px;width:100%;text-align:left;background:var(--bg2);border:1px solid var(--line);border-radius:6px;padding:6px 8px;margin-bottom:4px;font-size:12px}
.cs-buy .it:hover{border-color:var(--o)}.cs-buy .it.no{opacity:.4}.cs-buy .it .p{color:#7ed957}.cs-buy .it .k{color:var(--o);margin-right:4px}
.cs-sb{width:min(860px,96vw)}.cs-sb table{width:100%;border-collapse:collapse;font-size:13px}.cs-sb td,.cs-sb th{padding:5px 8px;text-align:left}
.cs-sb tr.CT td{background:rgba(93,156,236,.12)}.cs-sb tr.T td{background:rgba(224,168,58,.12)}.cs-sb tr.dead td{opacity:.5}.cs-sb tr.me td{background:rgba(255,255,255,.1)}
.cs-sb .hist{display:flex;gap:2px;margin:8px 0}.cs-sb .hist i{width:14px;height:14px;border-radius:2px;display:block;font-size:9px;text-align:center;font-style:normal}
.cs-radio{position:fixed;left:14px;top:40%;z-index:121;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;font-size:13px}
.cs-chatin{position:fixed;left:14px;bottom:90px;z-index:122;width:min(420px,80vw)}
@media (max-width:700px){.cs-menu{grid-template-columns:1fr;grid-template-rows:1fr auto}.cs-side{flex-direction:row;order:2;justify-content:space-around;padding:4px}.cs-side button{width:52px;height:48px}
 .cs-hud canvas.radar{width:120px;height:120px}.cs-buy .cats{grid-template-columns:repeat(2,1fr)}.cs-hud .stat{font-size:20px;min-width:80px}.cs-hud .ammo{font-size:22px}}
`;

export function injectCss() { if (document.getElementById('cs-css')) return; const s = document.createElement('style'); s.id = 'cs-css'; s.textContent = CSS; document.head.appendChild(s); }

// ---- item pictures: the finish painted inside the weapon's silhouette ----
const SIL = {  // rough side-on outlines per category, in a 100x40 box
  pistol: [[20, 12], [78, 12], [80, 20], [48, 20], [46, 34], [34, 34], [36, 20], [20, 20]],
  smg: [[8, 14], [80, 12], [92, 16], [80, 20], [56, 20], [54, 36], [46, 36], [46, 22], [30, 22], [26, 30], [8, 24]],
  rifle: [[2, 14], [36, 12], [92, 12], [98, 15], [70, 18], [60, 18], [58, 34], [50, 34], [50, 20], [40, 20], [34, 30], [24, 30], [26, 20], [2, 22]],
  sniper: [[2, 16], [30, 14], [36, 8], [62, 8], [64, 14], [98, 14], [98, 17], [56, 19], [52, 32], [44, 32], [44, 20], [30, 22], [2, 26]],
  heavy: [[2, 14], [30, 12], [96, 12], [96, 18], [60, 18], [56, 30], [46, 30], [46, 20], [30, 22], [2, 26]],
  knife: [[6, 22], [40, 18], [92, 16], [70, 26], [40, 26], [36, 30], [6, 30]],
};
export function drawItem(canvas, item) {
  const info = itemInfo(item); const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  if (!info) return canvas;
  if (info.kind === 'emote') {
    const e = EMOTE_BY_ID[info.weapon] || {}, cx = W / 2, s = H / 100;
    g.fillStyle = '#1c2533'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f2a33a'; g.lineWidth = 5 * s; g.lineCap = 'round';
    const arms = { wave: [[-20, -10], [22, -38]], dance: [[-24, -30], [24, 6]], dab: [[-26, -20], [18, -20]], tpose: [[-34, 0], [34, 0]], floss: [[-26, 14], [-6, 14]], chicken: [[-14, -6], [14, -6]],
      fart: [[-18, 14], [18, 14]], worm: [[-30, 10], [30, 10]], salute: [[-16, 16], [8, -26]], flex: [[-22, -24], [22, -24]], cry: [[-8, -30], [8, -30]], twerk: [[-20, 18], [20, 18]] }[e.anim] || [[-18, 14], [18, 14]];
    g.beginPath(); g.arc(cx, 22 * s, 9 * s, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(cx, 31 * s); g.lineTo(cx, 62 * s); g.moveTo(cx, 62 * s); g.lineTo(cx - 14 * s, 92 * s); g.moveTo(cx, 62 * s); g.lineTo(cx + 14 * s, 92 * s);
    for (const [ax, ay] of arms) { g.moveTo(cx, 40 * s); g.lineTo(cx + ax * s, 40 * s + ay * s); } g.stroke();
    if (e.anim === 'fart') { g.fillStyle = '#9ac84a99'; g.beginPath(); g.arc(cx + 22 * s, 70 * s, 12 * s, 0, 7); g.fill(); }
    return canvas;
  }
  if (info.kind === 'agent') {
    const a = AGENT_BY_ID[info.weapon], L = a.look, cx = W / 2, s = H / 100;
    g.fillStyle = L.legs; g.fillRect(cx - 14 * s, 58 * s, 11 * s, 36 * s); g.fillRect(cx + 3 * s, 58 * s, 11 * s, 36 * s);
    g.fillStyle = L.body; g.fillRect(cx - 20 * s, 26 * s, 40 * s, 36 * s); g.fillRect(cx - 30 * s, 28 * s, 9 * s, 28 * s); g.fillRect(cx + 21 * s, 28 * s, 9 * s, 28 * s);
    if (L.speedo) { g.fillStyle = L.speedo; g.fillRect(cx - 20 * s, 54 * s, 40 * s, 9 * s); }
    g.fillStyle = L.head; g.fillRect(cx - 12 * s, 4 * s, 24 * s, 22 * s);
    g.fillStyle = L.hatColor || '#333'; if (L.hat && L.hat !== 'none') g.fillRect(cx - 13 * s, 2 * s, 26 * s, 7 * s);
    return canvas;
  }
  const w = W_BY_ID[info.weapon];
  const sil = info.kind === 'knife' ? SIL.knife : SIL[w ? (w.cat === 'smg' ? 'smg' : w.cat === 'sniper' ? 'sniper' : w.cat === 'heavy' ? 'heavy' : w.cat === 'rifle' ? 'rifle' : 'pistol') : 'rifle'];
  const pat = document.createElement('canvas'); pat.width = 128; pat.height = 48; paintSkin(pat, info.paint, item.seed, item.float);
  g.save(); g.beginPath(); sil.forEach(([x, y], k) => (k ? g.lineTo : g.moveTo).call(g, x / 100 * W, y / 40 * H)); g.closePath();
  g.fillStyle = '#222'; g.fill(); g.clip(); g.drawImage(pat, 0, 0, W, H); g.restore();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; g.beginPath(); sil.forEach(([x, y], k) => (k ? g.lineTo : g.moveTo).call(g, x / 100 * W, y / 40 * H)); g.closePath(); g.stroke();
  return canvas;
}
const itemCard = (item, extra = '') => {
  const info = itemInfo(item); if (!info) return '';
  return `<div class="cs-card cs-item click" data-uid="${esc(item.uid)}"><canvas width="200" height="80" data-draw="${esc(item.uid)}"></canvas>
    ${item.st ? '<span class="cs-tag" style="color:#cf6a32">ST™</span>' : ''}${item.listed ? '<span class="cs-tag" style="top:28px;color:#7ed957">listed</span>' : ''}
    <div class="n">${esc(info.wpn)} | ${esc(info.finish)}</div><div class="w">${info.wear ? esc(info.wear.name) : 'Agent'} · ${info.value} coins${extra}</div>
    <div class="cs-rar" style="background:${info.rarity.color}"></div></div>`;
};
const paintAll = (root, items) => root.querySelectorAll('canvas[data-draw]').forEach((c) => { const it = items.find((x) => x.uid === c.dataset.draw); if (it) drawItem(c, it); });

// ======================================================================================================================
// main menu
// ======================================================================================================================
export class Menu {
  constructor(cfg, profile, h) { this.cfg = cfg; this.P = profile; this.h = h; this.tab = 'play'; this.sel = { mode: '5v5', map: 'dust', bot: 'normal' }; this.lobbies = []; }
  show() {
    injectCss();
    this.root = document.createElement('div'); this.root.className = 'cs cs-menu';
    this.root.innerHTML = `<nav class="cs-side">${[['play', '▶', 'PLAY'], ['pass', '🎖', 'PASS'], ['inv', '🎒', 'INVENTORY'], ['crates', '📦', 'CRATES'], ['market', '🏪', 'MARKET'], ['quests', '★', 'QUESTS'], ['profile', '👤', 'PROFILE'], ['settings', '⚙', 'SETTINGS']]
      .map(([k, i, n]) => `<button data-tab="${k}"><b>${i}</b>${n}</button>`).join('')}</nav>
      <div class="cs-main"><div class="cs-top"><div class="cs-logo">COUNTER<i>-</i>STRIFE</div><span class="cs-mut cs-small">Global Offensive Smell</span><div class="sp"></div>
      <span class="cs-chip cs-lvl" id="mLvl"></span><span class="cs-chip cs-coin" id="mCoins"></span><span class="cs-chip" id="mAcct"></span></div><div class="cs-body" id="mBody"></div></div>`;
    document.body.appendChild(this.root);
    this.root.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.tab; this.render(); }));
    this.off = this.P.on(() => this.top());
    this.render();
    this.P.daily().then((n) => n && this.h.toast(`Daily bonus: +${n} coins`));
  }
  hide() { if (this.root) this.root.remove(); this.root = null; if (this.off) this.off(); if (this.lb) { this.lb.close(); this.lb = null; } }
  top() {
    if (!this.root) return;
    const P = this.P, lv = P.level, need = (lv) ** 2 * 100, prev = (lv - 1) ** 2 * 100;
    $('#mLvl', this.root).textContent = `LVL ${lv} · ${Math.round((P.d.xp - prev) / (need - prev) * 100)}%`;
    $('#mCoins', this.root).textContent = `🪙 ${P.d.coins.toLocaleString()}`;
    $('#mAcct', this.root).textContent = P.signedIn ? (P.online ? '☁ ' + (P.d.name || 'online') : '☁ offline') : (P.cloud ? 'Sign in' : 'Local profile');
  }
  render() {
    if (!this.root) return;
    this.top();
    this.root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    const B = $('#mBody', this.root);
    if (this.tab !== 'play' && this.lb) { this.lb.close(); this.lb = null; }
    this['tab_' + this.tab](B);
  }
  // ---- PLAY ----
  tab_play(B) {
    const s = this.sel;
    B.innerHTML = `<div class="cs-h">Mode</div><div class="cs-grid">${Object.entries(MODES).map(([k, m]) => `<div class="cs-card click ${s.mode === k ? 'sel' : ''}" data-mode="${k}"><b style="font-size:18px">${k}</b><div class="cs-mut cs-small">${esc(m.name)} · ${m.bomb ? 'bomb defusal' : 'combat only, no kill = draw'} · first to ${m.winTo}</div></div>`).join('')}</div>
      <div class="cs-h">Map</div><div class="cs-grid">${Object.values(MAPS).map((m) => `<div class="cs-card click ${s.map === m.id ? 'sel' : ''}" data-map="${m.id}"><canvas width="170" height="110" data-mapprev="${m.id}" style="width:100%;border-radius:6px;background:#0b0e13"></canvas><b>${esc(m.name)}</b><div class="cs-mut cs-small">parody of ${esc(m.parody)}</div></div>`).join('')}</div>
      <div class="cs-h">Bots fill empty slots</div><div class="cs-row">${Object.entries(BOT_LEVELS).map(([k, b]) => `<button class="cs-btn ${s.bot === k ? '' : 'alt'} sm" data-bot="${k}">${b.name}</button>`).join('')}</div>
      <div class="cs-row" style="margin-top:18px"><button class="cs-btn" id="pSolo">PLAY WITH BOTS</button><button class="cs-btn alt" id="pHost">HOST PUBLIC LOBBY</button><button class="cs-btn alt" id="pPriv">HOST PRIVATE</button>
        <input id="pCode" maxlength="5" placeholder="Invite code" style="width:120px;text-transform:uppercase"><button class="cs-btn alt" id="pJoin">JOIN</button></div>
      <div class="cs-h">Open lobbies</div><div id="pList" class="cs-mut">Looking for lobbies…</div>
      <div class="cs-mut cs-small" style="margin-top:14px">Multiplayer is peer-to-peer and free: the host's browser runs the match and bots fill the empty slots. Share the invite link or code.</div>`;
    B.querySelectorAll('[data-mode]').forEach((e) => (e.onclick = () => { s.mode = e.dataset.mode; this.render(); }));
    B.querySelectorAll('[data-map]').forEach((e) => (e.onclick = () => { s.map = e.dataset.map; this.render(); }));
    B.querySelectorAll('[data-bot]').forEach((e) => (e.onclick = () => { s.bot = e.dataset.bot; this.render(); }));
    B.querySelectorAll('canvas[data-mapprev]').forEach((c) => this.h.mapPreview(c, c.dataset.mapprev));
    $('#pSolo', B).onclick = () => this.h.play({ ...s, host: true, solo: true });
    $('#pHost', B).onclick = () => this.h.play({ ...s, host: true, pub: true });
    $('#pPriv', B).onclick = () => this.h.play({ ...s, host: true, pub: false });
    const code = $('#pCode', B); const hash = location.hash.slice(1).toUpperCase(); if (/^[A-Z0-9]{5}$/.test(hash)) code.value = hash;
    $('#pJoin', B).onclick = () => { const c = code.value.trim().toUpperCase(); if (c.length === 5) this.h.play({ code: c, host: false }); };
    if (!this.lb) this.lb = this.h.lobbies((list) => { this.lobbies = list; const el = $('#pList', this.root); if (!el) return;
      el.innerHTML = list.length ? '' : 'No open lobbies right now: host one!';
      for (const l of list) { const r = document.createElement('div'); r.className = 'cs-card'; r.style.marginBottom = '6px'; r.innerHTML = '<div class="cs-row"><b class="n"></b><span class="cs-mut m"></span><span style="flex:1"></span><button class="cs-btn sm">JOIN</button></div>';
        $('.n', r).textContent = String(l.name || 'Lobby').slice(0, 30); $('.m', r).textContent = `${String(l.mode || '').slice(0, 4)} · ${(MAPS[l.map] || {}).short || ''} · ${l.players | 0}/${l.max | 0}`;
        $('button', r).onclick = () => this.h.play({ code: l.code, host: false }); el.appendChild(r); } });
  }
  // ---- INVENTORY ----
  tab_inv(B) {
    const P = this.P, items = P.d.inventory, f = this.invFilter || 'all';
    const kinds = { all: 'All', skin: 'Weapons', knife: 'Knives ★', agent: 'Agents', emote: 'Emotes' };
    const shown = items.filter((i) => f === 'all' || (ITEM_BY_ID[i.def] || {}).kind === f);
    const eq = (uid) => ['T', 'CT'].filter((t) => Object.values(P.d.equipped[t] || {}).includes(uid)).join('+');
    B.innerHTML = `<div class="cs-row">${Object.entries(kinds).map(([k, n]) => `<button class="cs-btn sm ${f === k ? '' : 'alt'}" data-f="${k}">${n}</button>`).join('')}<span style="flex:1"></span>
      <label class="cs-small cs-mut">CT pistol <select id="iPist"><option value="usp">USP-Shh</option><option value="p2000">P2Grand</option></select></label>
      <label class="cs-small cs-mut">CT rifle <select id="iRif"><option value="m4a4">M4A4 Freedom Stick</option><option value="m4a1s">M4A1-Shh</option></select></label></div>
      <div class="cs-h">${shown.length} items</div><div class="cs-grid">${shown.map((i) => itemCard(i, eq(i.uid) ? ` · <b style="color:var(--o)">${eq(i.uid)}</b>` : '')).join('') || '<div class="cs-mut">Nothing yet. Open crates with coins you earn by playing.</div>'}</div>`;
    paintAll(B, items);
    B.querySelectorAll('[data-f]').forEach((e) => (e.onclick = () => { this.invFilter = e.dataset.f; this.render(); }));
    const ps = $('#iPist', B), rs = $('#iRif', B); ps.value = P.d.settings.ctPistol || 'usp'; rs.value = P.d.settings.ctRifle || 'm4a4';
    ps.onchange = () => { P.d.settings.ctPistol = ps.value; P.changed(); }; rs.onchange = () => { P.d.settings.ctRifle = rs.value; P.changed(); };
    B.querySelectorAll('[data-uid]').forEach((e) => (e.onclick = () => this.itemModal(e.dataset.uid)));
  }
  itemModal(uid) {
    const P = this.P, it = P.d.inventory.find((x) => x.uid === uid); if (!it) return;
    const info = itemInfo(it), m = document.createElement('div'); m.className = 'cs cs-modal';
    if (info.kind === 'emote') return this.emoteModal(it, info);
    const slotKey = info.kind === 'agent' ? 'agent' : info.kind === 'knife' ? 'knife' : info.weapon;
    const teams = info.kind === 'agent' ? [AGENT_BY_ID[info.weapon].team] : info.kind === 'knife' ? ['T', 'CT'] : ['T', 'CT'].filter((t) => forTeam(info.weapon, t));
    m.innerHTML = `<div class="cs-card"><div class="cs-row"><b style="font-size:18px;color:${info.rarity.color}">${esc(info.label)}</b><span style="flex:1"></span><button class="cs-btn alt sm" data-x>✕</button></div>
      <canvas width="560" height="224" style="width:100%;margin:10px 0;border-radius:8px;background:#0b0e13"></canvas>
      <div class="cs-small cs-mut">${esc(info.rarity.name)}${info.wear ? ` · ${esc(info.wear.name)} · float ${it.float.toFixed(5)} · pattern ${it.seed}` : ''}${it.st ? ` · StatTrak™ kills: ${it.kills | 0}` : ''} · worth ~${info.value} coins</div>
      <div class="cs-row" style="margin-top:12px">${teams.map((t) => `<button class="cs-btn sm" data-eq="${t}">Equip ${t === 'T' ? 'Terrorist' : 'Counter-Terrorist'}</button>`).join('')}
        <button class="cs-btn alt sm" data-sell>Sell instantly (${Math.round(info.value * 0.8)} coins)</button>
        ${P.signedIn ? (it.listed ? '<button class="cs-btn alt sm" data-unlist>Remove listing</button>' : '<input type="number" min="1" id="lp" placeholder="price" style="width:100px"><button class="cs-btn alt sm" data-list>List on market</button>') : ''}</div></div>`;
    document.body.appendChild(m);
    drawItem($('canvas', m), it);
    const close = () => m.remove();
    m.onclick = (e) => { if (e.target === m) close(); };
    $('[data-x]', m).onclick = close;
    m.querySelectorAll('[data-eq]').forEach((b) => (b.onclick = () => { P.equip(b.dataset.eq, slotKey, uid); this.h.toast('Equipped'); close(); this.render(); }));
    $('[data-sell]', m).onclick = async () => { if (!confirm('Sell ' + info.label + '?')) return; try { await P.sell(uid); this.h.toast('Sold'); } catch (e) { this.h.toast(e.message); } close(); this.render(); };
    const lb = $('[data-list]', m); if (lb) lb.onclick = async () => { const p = +$('#lp', m).value; if (!(p > 0)) return; try { await P.listItem(uid, p); this.h.toast('Listed'); } catch (e) { this.h.toast(e.message); } close(); this.render(); };
    const ub = $('[data-unlist]', m); if (ub) ub.onclick = async () => { try { await P.unlistItem(uid); } catch (e) { this.h.toast(e.message); } close(); this.render(); };
  }
  emoteModal(it, info) {
    const P = this.P, m = document.createElement('div'), w = P.wheel(); m.className = 'cs cs-modal';
    m.innerHTML = `<div class="cs-card"><div class="cs-row"><b style="font-size:18px">${esc(info.finish)}</b><span style="flex:1"></span><button class="cs-btn alt sm" data-x>✕</button></div>
      <canvas width="300" height="200" style="width:240px;display:block;margin:10px auto;border-radius:8px"></canvas>
      <div class="cs-mut cs-small">In a match press <b>T</b>, then 1-4. Everyone sees it; your camera pulls back while it plays.</div>
      <div class="cs-row" style="margin-top:10px">${[0, 1, 2, 3].map((k) => `<button class="cs-btn sm ${w[k] === info.weapon ? '' : 'alt'}" data-slot="${k}">Wheel ${k + 1}: ${esc((EMOTE_BY_ID[w[k]] || {}).name || 'empty')}</button>`).join('')}</div>
      <div class="cs-row" style="margin-top:8px"><button class="cs-btn alt sm" data-sell>Sell (${Math.round(info.value * 0.8)} coins)</button></div></div>`;
    document.body.appendChild(m); drawItem($('canvas', m), it);
    $('[data-x]', m).onclick = () => m.remove(); m.onclick = (e) => { if (e.target === m) m.remove(); };
    m.querySelectorAll('[data-slot]').forEach((b) => (b.onclick = () => { P.setWheel(+b.dataset.slot, info.weapon); this.h.toast('On your emote wheel'); m.remove(); }));
    $('[data-sell]', m).onclick = async () => { if (!confirm('Sell ' + info.finish + '?')) return; try { await P.sell(it.uid); } catch (e) { this.h.toast(e.message); } m.remove(); this.render(); };
  }
  // ---- FREE BATTLE PASS ----
  tab_pass(B) {
    const P = this.P, lv = P.level, got = new Set(P.d.pass || []);
    const prev = (lv - 1) ** 2 * 100, need = lv ** 2 * 100;
    const fake = PASS.tiers.map((t) => ({ uid: 'p' + t.tier, def: t.def, float: 0.05, seed: t.tier * 37, st: false }));
    const ready = PASS.tiers.filter((t) => t.tier <= lv && !got.has(t.tier)).length;
    B.innerHTML = `<div class="cs-card"><div class="cs-row"><b style="font-size:20px">🎖 FREE BATTLE PASS</b><span class="cs-chip">100% free · no premium track · nothing to buy</span><span style="flex:1"></span>
        ${ready ? `<button class="cs-btn" id="pAll">CLAIM ALL (${ready})</button>` : ''}</div>
      <div class="cs-mut cs-small" style="margin:6px 0">Every level you reach with XP unlocks a reward: weapon skins, emotes, outfits, and two knives (level 25 and 50). XP comes from playing: kills, rounds, wins, quests.</div>
      <div class="cs-row"><b>Level ${lv}</b><div class="cs-bar" style="flex:1"><i style="width:${Math.round((P.d.xp - prev) / (need - prev) * 100)}%"></i></div><span class="cs-mut cs-small">${P.d.xp - prev} / ${need - prev} XP</span></div></div>
      <div class="cs-grid" style="margin-top:12px">${PASS.tiers.map((t, k) => { const info = itemInfo(fake[k]); const st = got.has(t.tier) ? 'claimed' : t.tier <= lv ? 'ready' : 'locked';
        return `<div class="cs-card cs-item" style="${st === 'locked' ? 'opacity:.55' : ''}"><span class="cs-tag">LV ${t.tier}</span><canvas width="200" height="80" data-draw="${fake[k].uid}"></canvas>
          <div class="n">${esc(info.wpn)} | ${esc(info.finish)}</div><div class="w">${esc(info.kind === 'skin' ? 'Weapon skin' : info.kind === 'knife' ? '★ Knife' : info.kind === 'agent' ? 'Outfit' : 'Emote')}</div>
          <div class="cs-rar" style="background:${info.rarity.color}"></div>
          <div style="margin-top:6px">${st === 'ready' ? `<button class="cs-btn sm" data-claim="${t.tier}">CLAIM</button>` : `<span class="cs-mut cs-small">${st === 'claimed' ? '✓ claimed' : '🔒 level ' + t.tier}</span>`}</div></div>`; }).join('')}</div>`;
    paintAll(B, fake);
    const claim = async (t) => { try { const it = await P.claimPass(t); return it; } catch (e) { this.h.toast(e.message); return null; } };
    B.querySelectorAll('[data-claim]').forEach((b) => (b.onclick = async () => { b.disabled = true; const it = await claim(+b.dataset.claim); if (it) { this.h.sound('reveal'); this.h.toast('Unlocked: ' + itemInfo(it).label); } this.render(); }));
    const all = $('#pAll', B); if (all) all.onclick = async () => { all.disabled = true; for (const t of PASS.tiers) if (t.tier <= lv && !(P.d.pass || []).includes(t.tier)) await claim(t.tier); this.h.sound('rare'); this.render(); };
  }
  // ---- CRATES ----
  tab_crates(B) {
    B.innerHTML = `<div class="cs-mut">Crates open with coins you earn by playing: wins, rounds, kills, quests, daily bonus, level-ups. No real money, ever.</div>
      <div class="cs-grid" style="margin-top:12px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${CRATES.map((c) => `<div class="cs-card"><b style="font-size:17px">📦 ${esc(c.name)}</b><div class="cs-mut cs-small">${esc(c.desc)}</div>
        <div class="cs-small" style="margin:8px 0">${crateOdds(c).map((o) => `<div class="cs-row"><i style="width:10px;height:10px;border-radius:2px;background:${o.color};display:inline-block"></i>${esc(o.name)}<span style="flex:1"></span>${o.pct.toFixed(2)}%</div>`).join('')}</div>
        <div class="cs-row"><button class="cs-btn" data-open="${c.id}">OPEN · 🪙 ${c.price}</button><button class="cs-btn alt sm" data-see="${c.id}">Contents</button></div></div>`).join('')}</div>`;
    B.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => this.openCrate(b.dataset.open)));
    B.querySelectorAll('[data-see]').forEach((b) => (b.onclick = () => this.contents(b.dataset.see)));
  }
  contents(id) {
    const c = CRATES.find((x) => x.id === id), m = document.createElement('div'); m.className = 'cs cs-modal';
    const fake = c.items.map((d, k) => ({ uid: 'c' + k, def: d.id, float: 0.1, seed: 7, st: false }));
    m.innerHTML = `<div class="cs-card" style="width:min(900px,96vw)"><div class="cs-row"><b>${esc(c.name)}</b><span style="flex:1"></span><button class="cs-btn alt sm" data-x>✕</button></div><div class="cs-grid" style="margin-top:10px">${fake.map((i) => itemCard(i)).join('')}</div></div>`;
    document.body.appendChild(m); paintAll(m, fake); $('[data-x]', m).onclick = () => m.remove(); m.onclick = (e) => { if (e.target === m) m.remove(); };
  }
  async openCrate(id) {
    const c = CRATES.find((x) => x.id === id);
    let item; try { item = await this.P.openCrate(id); } catch (e) { this.h.toast(e.message); return; }
    const m = document.createElement('div'); m.className = 'cs cs-modal';
    const N = 48, WIN = 40, filler = [];
    for (let k = 0; k < N; k++) { const pool = c.items.filter((i) => i.tier === (Math.random() < 0.8 ? Math.min(...c.items.map((x) => x.tier)) : c.items[Math.floor(Math.random() * c.items.length)].tier)); const d = pool[Math.floor(Math.random() * pool.length)] || c.items[0]; filler.push({ uid: 'f' + k, def: d.id, float: Math.random(), seed: k, st: false }); }
    filler[WIN] = item;
    m.innerHTML = `<div class="cs-card" style="width:min(760px,96vw)"><b>${esc(c.name)}</b><div class="cs-reel" style="margin-top:10px"><div class="strip">${filler.map((it) => { const inf = itemInfo(it); return `<div class="cell" style="border-color:${inf.rarity.color}"><canvas width="130" height="80" data-draw="${esc(it.uid)}"></canvas><div>${esc(inf.wpn)}</div><div class="cs-mut">${esc(inf.finish)}</div></div>`; }).join('')}</div><div class="mark"></div></div>
      <div id="won" style="margin-top:12px;min-height:60px"></div></div>`;
    document.body.appendChild(m); paintAll(m, filler);
    const strip = $('.strip', m), reel = $('.cs-reel', m), cell = 138, target = WIN * cell - reel.clientWidth / 2 + 65 + (Math.random() - 0.5) * 100;
    let t0 = performance.now(); const dur = 5200; this.h.sound('tick');
    let lastCell = -1;
    const anim = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4), x = target * e;
      strip.style.transform = `translateX(${-x}px)`;
      const ci = Math.floor((x + reel.clientWidth / 2) / cell); if (ci !== lastCell) { lastCell = ci; this.h.sound('tick'); }
      if (k < 1) requestAnimationFrame(anim);
      else { const inf = itemInfo(item); this.h.sound(inf.rarity.key === 'gold' || inf.rarity.key === 'covert' ? 'rare' : 'reveal');
        $('#won', m).innerHTML = `<div class="cs-row"><b style="font-size:20px;color:${inf.rarity.color}">${esc(inf.label)}</b></div><div class="cs-mut cs-small">${esc(inf.rarity.name)}${inf.wear ? ' · ' + esc(inf.wear.name) + ' · float ' + item.float.toFixed(4) : ''}</div>
          <div class="cs-row" style="margin-top:10px"><button class="cs-btn" data-again>OPEN ANOTHER · 🪙 ${c.price}</button><button class="cs-btn alt" data-x>DONE</button></div>`;
        $('[data-x]', m).onclick = () => { m.remove(); this.render(); }; $('[data-again]', m).onclick = () => { m.remove(); this.openCrate(id); }; }
    };
    requestAnimationFrame(anim);
  }
  // ---- MARKET ----
  async tab_market(B) {
    const P = this.P;
    if (!P.cloud) { B.innerHTML = `<div class="cs-card"><b>Player market needs accounts</b><div class="cs-mut" style="margin-top:6px">This copy of the game runs with local profiles only. You can still sell items instantly from your inventory (80% of their value). The owner can switch on free accounts (Supabase) to enable trading between players.</div></div>`; return; }
    if (!P.signedIn) { B.innerHTML = `<div class="cs-card"><b>Sign in to trade</b><div class="cs-mut" style="margin:6px 0">Buy and sell skins with other players for coins (5% market fee).</div><button class="cs-btn" id="mGo">Sign in / create account</button></div>`; $('#mGo', B).onclick = () => { this.tab = 'profile'; this.render(); }; return; }
    B.innerHTML = '<div class="cs-mut">Loading the market…</div>';
    let list = []; try { list = await P.listings(); } catch (e) { B.innerHTML = `<div class="cs-mut">Market unavailable: ${esc(e.message)}</div>`; return; }
    const items = list.map((l) => ({ uid: 'L' + l.id, def: l.def, float: l.float, seed: l.seed, st: l.st, lid: l.id, price: l.price, seller: l.seller_name, mine: l.seller === (P.sess && P.sess.user && P.sess.user.id) })).filter((i) => ITEM_BY_ID[i.def]);
    B.innerHTML = `<div class="cs-row"><b>${items.length} listings</b><span class="cs-mut cs-small">Prices are set by players. 5% of each sale is burned as a fee.</span></div>
      <div class="cs-grid" style="margin-top:10px">${items.map((i) => itemCard(i, ` · <b style="color:#7ed957">🪙 ${i.price}</b>`).replace('cs-card cs-item click', 'cs-card cs-item click') ).join('') || '<div class="cs-mut">Nothing listed yet.</div>'}</div>`;
    paintAll(B, items);
    B.querySelectorAll('[data-uid]').forEach((e) => (e.onclick = async () => {
      const it = items.find((x) => x.uid === e.dataset.uid); if (!it) return;
      if (it.mine) return this.h.toast('That one is yours (remove it from your inventory screen).');
      if (!confirm(`Buy ${itemInfo(it).label} from ${it.seller || 'a player'} for ${it.price} coins?`)) return;
      try { await P.buyListing(it.lid); this.h.toast('Bought!'); } catch (err) { this.h.toast(err.message); }
      this.render();
    }));
  }
  // ---- QUESTS ----
  tab_quests(B) {
    const P = this.P; P.ensureQuests();
    const row = (q) => `<div class="cs-card" style="margin-bottom:8px"><div class="cs-row"><b>${esc(q.text)}</b><span class="cs-mut cs-small">${q.weekly ? 'weekly' : 'daily'}</span><span style="flex:1"></span><span class="cs-coin">🪙 ${q.coins}</span>
      ${q.claimed ? '<span class="cs-mut">claimed</span>' : `<button class="cs-btn sm" data-claim="${esc(q.id)}" ${q.prog >= q.goal ? '' : 'disabled'}>CLAIM</button>`}</div>
      <div class="cs-bar" style="margin-top:8px"><i style="width:${Math.round(q.prog / q.goal * 100)}%"></i></div><div class="cs-small cs-mut" style="margin-top:4px">${q.prog} / ${q.goal}</div></div>`;
    B.innerHTML = `<div class="cs-h">Daily</div>${P.d.quests.filter((q) => !q.weekly).map(row).join('')}<div class="cs-h">Weekly</div>${P.d.quests.filter((q) => q.weekly).map(row).join('')}
      <div class="cs-mut cs-small">New daily quests every day (UTC). Matches against bots count, at half the coins.</div>`;
    B.querySelectorAll('[data-claim]').forEach((b) => (b.onclick = async () => { const n = await P.claimQuest(b.dataset.claim); this.h.toast(n ? `+${n} coins` : 'Daily coin limit reached'); this.render(); }));
  }
  // ---- PROFILE ----
  tab_profile(B) {
    const P = this.P, s = P.d.stats;
    B.innerHTML = `<div class="cs-card"><div class="cs-row"><b style="font-size:20px" id="pfN"></b><span class="cs-chip cs-lvl">Level ${P.level}</span></div>
      <div class="cs-row" style="margin-top:10px"><input id="pfName" maxlength="20" placeholder="Your name"><button class="cs-btn alt sm" id="pfSave">Save name</button></div>
      <div class="cs-grid" style="margin-top:12px">${[['Matches', s.matches], ['Wins', s.wins], ['Kills', s.k], ['Deaths', s.d], ['K/D', (s.k / Math.max(1, s.d)).toFixed(2)], ['Headshot %', Math.round(s.hs / Math.max(1, s.k) * 100) + '%'], ['MVPs', s.mvp]]
        .map(([n, v]) => `<div class="cs-card"><div class="cs-mut cs-small">${n}</div><b style="font-size:20px">${v}</b></div>`).join('')}</div></div>
      <div class="cs-card" style="margin-top:12px" id="pfAcct"></div>`;
    $('#pfN', B).textContent = P.d.name || 'Player'; $('#pfName', B).value = P.d.name || '';
    $('#pfSave', B).onclick = () => { P.d.name = $('#pfName', B).value.trim().slice(0, 20); P.changed(); this.render(); };
    const A = $('#pfAcct', B);
    if (!P.cloud) { A.innerHTML = '<b>Local profile</b><div class="cs-mut cs-small">Your coins and items are saved in this browser. (The game owner can switch on free accounts to sync across devices and trade.)</div>'; return; }
    if (P.signedIn) { A.innerHTML = `<b>Signed in</b> <span class="cs-mut cs-small">${P.online ? 'synced' : esc(P.err || 'offline')}</span><div class="cs-row" style="margin-top:8px"><button class="cs-btn alt sm" id="aSync">Sync now</button><button class="cs-btn alt sm" id="aOut">Sign out</button></div>`;
      $('#aSync', A).onclick = async () => { await P.sync(); this.render(); }; $('#aOut', A).onclick = () => { P.signOut(); this.render(); }; return; }
    A.innerHTML = `<b>Account</b><div class="cs-mut cs-small">Sync coins and items across devices, trade on the market.</div>
      <div class="cs-row" style="margin-top:8px"><input id="aE" type="email" placeholder="email" autocomplete="email"><input id="aP" type="password" placeholder="password (8+)" autocomplete="current-password"></div>
      <div class="cs-row" style="margin-top:8px"><button class="cs-btn sm" id="aIn">Sign in</button><button class="cs-btn alt sm" id="aUp">Create account</button></div><div class="cs-small cs-mut" id="aMsg" style="margin-top:6px"></div>`;
    const go = async (up) => { const e = $('#aE', A).value.trim(), p = $('#aP', A).value; const msg = $('#aMsg', A);
      try { if (up) { const r = await P.signUp(e, p, P.d.name); msg.textContent = r.access_token ? 'Account created.' : 'Check your email to confirm, then sign in.'; if (r.access_token) await P.sync(); } else await P.signIn(e, p); this.render(); } catch (err) { msg.textContent = err.message; } };
    $('#aIn', A).onclick = () => go(false); $('#aUp', A).onclick = () => go(true);
  }
  // ---- SETTINGS ----
  tab_settings(B) {
    const S = this.h.settings();
    const sl = (k, n, min, max, step) => `<label class="cs-card"><div class="cs-small cs-mut">${n}: <b id="v_${k}">${S[k]}</b></div><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${S[k]}" style="width:100%"></label>`;
    B.innerHTML = `<div class="cs-h">Mouse & view</div><div class="cs-grid">${sl('sens', 'Sensitivity', 0.2, 6, 0.05)}${sl('fov', 'Field of view', 70, 110, 1)}${sl('vol', 'Volume', 0, 1, 0.05)}</div>
      <div class="cs-h">Crosshair</div><div class="cs-grid">${sl('xSize', 'Size', 1, 20, 1)}${sl('xGap', 'Gap', -4, 12, 1)}${sl('xThick', 'Thickness', 1, 6, 1)}${sl('xOutline', 'Outline', 0, 1, 0.1)}
        <label class="cs-card"><div class="cs-small cs-mut">Colour</div><input type="color" data-k="xColor" value="${S.xColor}" style="width:100%;height:34px"></label>
        <label class="cs-card"><div class="cs-small cs-mut">Style</div><select data-k="xDyn"><option value="0">Static</option><option value="1">Dynamic</option></select></label>
        <label class="cs-card"><div class="cs-small cs-mut">Centre dot</div><select data-k="xDot"><option value="0">Off</option><option value="1">On</option></select></label>
        <div class="cs-card" style="display:grid;place-items:center;min-height:90px;background:#3a4a3a"><div style="position:relative;width:1px;height:1px" id="xPrev"></div></div></div>
      <div class="cs-h">Graphics</div><div class="cs-grid"><label class="cs-card"><div class="cs-small cs-mut">Quality</div><select data-k="quality"><option value="0.5">Potato (fastest)</option><option value="0.75">Low</option><option value="1">Medium</option><option value="1.5">High</option></select></label>
        <label class="cs-card"><div class="cs-small cs-mut">Show FPS</div><select data-k="fps"><option value="0">Off</option><option value="1">On</option></select></label>
        <label class="cs-card"><div class="cs-small cs-mut">Gun hand</div><select data-k="hand"><option value="1">Right</option><option value="-1">Left</option></select></label></div>
      <div class="cs-h">Keys</div><div class="cs-card cs-small cs-mut">WASD move · Shift walk · Ctrl crouch · Space jump · Mouse1 fire · Mouse2 scope / alt fire · R reload · E use / plant / defuse / pick up · G drop · B buy menu · 1-5 weapons · Q last weapon · Tab scoreboard · Y chat · U team chat · Z X C radio · T emotes · F inspect · Esc menu</div>`;
    B.querySelectorAll('[data-k]').forEach((e) => { if (e.tagName === 'SELECT') e.value = String(S[e.dataset.k]); e.oninput = e.onchange = () => { const k = e.dataset.k; S[k] = e.type === 'color' ? e.value : +e.value; const v = $('#v_' + k, B); if (v) v.textContent = S[k]; this.h.saveSettings(S); drawXh($('#xPrev', B), S, 0); }; });
    drawXh($('#xPrev', B), S, 0);
  }
}

export function drawXh(box, S, spread) {
  if (!box) return;
  const gap = S.xGap + 4 + (S.xDyn ? spread : 0), len = S.xSize, th = S.xThick;
  box.style.setProperty('--xc', S.xColor); box.style.setProperty('--xo', S.xOutline);
  box.innerHTML = `<i style="left:${gap}px;top:${-th / 2}px;width:${len}px;height:${th}px"></i><i style="left:${-gap - len}px;top:${-th / 2}px;width:${len}px;height:${th}px"></i>
    <i style="top:${gap}px;left:${-th / 2}px;width:${th}px;height:${len}px"></i><i style="top:${-gap - len}px;left:${-th / 2}px;width:${th}px;height:${len}px"></i>${S.xDot ? `<i style="left:${-th / 2}px;top:${-th / 2}px;width:${th}px;height:${th}px"></i>` : ''}`;
}

// ======================================================================================================================
// in-match HUD
// ======================================================================================================================
export class Hud {
  constructor(settings) {
    injectCss(); this.S = settings;
    this.el = document.createElement('div'); this.el.className = 'cs cs-hud';
    this.el.innerHTML = `<div class="tl"><canvas class="radar" width="190" height="190"></canvas><div class="loc"></div><div class="money"></div><div class="buyic"></div></div>
      <div class="top"><div class="team" id="hT"></div><div class="scoreb" id="hsT" style="color:var(--tt)">0</div><div class="timer" id="hTime">0:00</div><div class="scoreb" id="hsCT" style="color:var(--ct)">0</div><div class="team" id="hCT"></div></div>
      <div class="feed"></div><div class="center"></div><div class="prog" style="display:none"><span></span><div class="cs-bar"><i></i></div></div><div class="hint" style="display:none"></div>
      <div class="chat"></div><div class="spec" style="display:none"></div><div class="dmgdir"></div>
      <div class="bl"><div class="stat" id="hHp"><span class="ic">✚</span><span>100</span></div><div class="stat" id="hAr"><span class="ic">⛨</span><span>0</span></div></div>
      <div class="br"><div class="slots"></div><div class="ammo"></div></div><div class="cs-xh"></div>`;
    document.body.appendChild(this.el);
    this.scope = document.createElement('div'); this.scope.className = 'cs-scope'; document.body.appendChild(this.scope);
    this.flash = document.createElement('div'); this.flash.className = 'cs-flash'; document.body.appendChild(this.flash);
    this.hurtEl = document.createElement('div'); this.hurtEl.className = 'cs-hurt'; document.body.appendChild(this.hurtEl);
    this.radar = $('canvas.radar', this.el); this.rg = this.radar.getContext('2d');
    this.q = (s) => $(s, this.el);
    this.last = {};
  }
  destroy() { for (const e of [this.el, this.scope, this.flash, this.hurtEl, this.panel, this.radioEl, this.chatIn]) if (e) e.remove(); }
  set(k, sel, v, prop = 'textContent') { if (this.last[k] === v) return; this.last[k] = v; const e = this.q(sel); if (e) e[prop] = v; }
  vitals(hp, armor, helmet) {
    this.set('hp', '#hHp span:last-child', String(Math.max(0, Math.round(hp)))); this.q('#hHp').classList.toggle('low', hp <= 20);
    this.set('ar', '#hAr span:last-child', String(Math.round(armor))); this.set('arIc', '#hAr .ic', helmet ? '⛑' : '⛨');
  }
  money(m, canBuy) { this.set('money', '.money', '$' + m); this.set('buy', '.buyic', canBuy ? '🛒 Buy menu: B' : ''); }
  ammo(txt, slots) { this.set('ammo', '.ammo', txt, 'innerHTML'); this.set('slots', '.slots', slots, 'innerHTML'); }
  loc(n) { this.set('loc', '.loc', n || ''); }
  timer(t, bomb, score, teams, myTeam) {
    this.set('time', '#hTime', bomb ? '💣' : fmtT(t)); this.q('#hTime').classList.toggle('bomb', !!bomb);
    this.set('sT', '#hsT', String(score.T)); this.set('sCT', '#hsCT', String(score.CT));
    const icons = (list, col) => list.map((a) => `<i style="background:${col}" class="${a ? '' : 'dead'}"></i>`).join('');
    this.set('tT', '#hT', icons(teams.T, 'var(--tt)'), 'innerHTML'); this.set('tCT', '#hCT', icons(teams.CT, 'var(--ct)'), 'innerHTML');
  }
  xh(spread, show) { const b = this.q('.cs-xh'); b.style.display = show ? '' : 'none'; const k = Math.round(spread); if (this.last.xs === k && this.last.xS === this.S) return; this.last.xs = k; drawXh(b, this.S, k); }
  setScope(on) { this.scope.style.display = on ? 'block' : 'none'; }
  feed(e, mineId) {
    const box = this.q('.feed'), row = document.createElement('div'); row.className = 'kf' + (e.kid === mineId || e.vid === mineId ? ' mine' : '');
    const n = (t, team) => { const s = document.createElement('span'); s.textContent = t; s.style.color = team === 'CT' ? 'var(--ct)' : 'var(--tt)'; return s; };
    if (e.killer) row.appendChild(n(e.killer, e.kteam));
    if (e.assist) { const a = document.createElement('span'); a.textContent = '+ ' + e.assist; a.style.opacity = .8; row.appendChild(a); }
    const w = document.createElement('span'); w.className = 'wpn'; w.textContent = `[${itemName(e.weapon) || e.weapon}]${e.wallbang ? ' ⟂' : ''}${e.head ? ' ☠' : ''}`; row.appendChild(w);
    row.appendChild(n(e.victim, e.vteam));
    box.appendChild(row); while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => row.remove(), 7000);
  }
  banner(text, sub = '', ms = 3000) { const c = this.q('.center'); c.innerHTML = ''; if (!text) return; const b = document.createElement('div'); b.className = 'banner'; b.textContent = text; if (sub) { const s = document.createElement('small'); s.textContent = sub; b.appendChild(s); } c.appendChild(b); clearTimeout(this.bt); if (ms) this.bt = setTimeout(() => { c.innerHTML = ''; }, ms); }
  progress(label, frac) { const p = this.q('.prog'); if (label == null) { p.style.display = 'none'; return; } p.style.display = ''; $('span', p).textContent = label; $('i', p).style.width = Math.round(frac * 100) + '%'; }
  hint(t) { const h = this.q('.hint'); h.style.display = t ? '' : 'none'; if (t) h.textContent = t; }
  spec(t) { const h = this.q('.spec'); h.style.display = t ? '' : 'none'; if (t) h.textContent = t; }
  chat(name, team, text, teamOnly) { const box = this.q('.chat'), d = document.createElement('div'); const n = document.createElement('b'); n.textContent = (teamOnly ? '(Team) ' : '') + name + ': '; n.style.color = team === 'CT' ? 'var(--ct)' : 'var(--tt)'; d.appendChild(n); d.appendChild(document.createTextNode(text)); box.appendChild(d); while (box.children.length > 6) box.firstChild.remove(); setTimeout(() => d.remove(), 9000); }
  hurt(angle) { this.hurtEl.style.opacity = 1; setTimeout(() => (this.hurtEl.style.opacity = 0), 200); if (angle != null) { const d = this.q('.dmgdir'); d.style.transform = `rotate(${angle}rad)`; d.style.opacity = 1; clearTimeout(this.dt); this.dt = setTimeout(() => (d.style.opacity = 0), 700); } }
  flashAmt(a) { this.flash.style.opacity = Math.max(0, Math.min(1, a)); }
  // ---- radar ----
  radarBase(W) {
    const c = document.createElement('canvas'); c.width = W.w * 2; c.height = W.d * 2; const g = c.getContext('2d');
    for (let z = 0; z < W.d; z++) for (let x = 0; x < W.w; x++) { const i = z * W.w + x, open = W.flag[i] === 2 || W.flag[i] === 3; const h = W.h[i];
      g.fillStyle = W.flag[i] === 3 ? '#a33' : open ? `rgb(${120 + h * 20},${118 + h * 20},${108 + h * 18})` : h < 3 ? '#4a4d52' : '#1c1f24'; g.fillRect(x * 2, z * 2, 2, 2); }
    g.font = 'bold 18px system-ui'; g.fillStyle = '#ff6a4a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [n, r] of Object.entries(W.B.sites)) g.fillText(n, (r[0] + r[2]), (r[1] + r[3]));
    this.base = c; this.W = W;
  }
  drawRadar(me, list, bomb) {
    const g = this.rg, R = 190, scale = 2 * 1.7;
    g.clearRect(0, 0, R, R); g.save(); g.beginPath(); g.rect(0, 0, R, R); g.clip();
    g.translate(R / 2, R / 2); g.rotate(me.yaw); g.scale(scale / 2, scale / 2); g.translate(-me.x * 2, -me.z * 2);
    g.globalAlpha = 0.85; g.drawImage(this.base, 0, 0); g.globalAlpha = 1;
    const dot = (x, z, col, r = 5) => { g.fillStyle = col; g.beginPath(); g.arc(x * 2, z * 2, r, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); };
    for (const p of list) if (p.alive) dot(p.x, p.z, p.team === 'CT' ? '#5d9cec' : '#e0a83a', p.spotted ? 4 : 4);
    if (bomb) { g.fillStyle = bomb.s === 'planted' ? '#ff3a2a' : '#ffd45a'; g.fillRect(bomb.x * 2 - 4, bomb.z * 2 - 4, 8, 8); }
    g.restore();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(R / 2, R / 2 - 7); g.lineTo(R / 2 - 5, R / 2 + 5); g.lineTo(R / 2 + 5, R / 2 + 5); g.fill();
  }
  // ---- buy menu ----
  buyMenu(open, ctx) {
    if (!open) { if (this.panel && this.panel.dataset.k === 'buy') { this.panel.remove(); this.panel = null; } return; }
    if (this.panel) this.panel.remove();
    const p = document.createElement('div'); p.className = 'cs cs-panel cs-buy'; p.dataset.k = 'buy'; this.panel = p;
    const render = () => {
      const { team, money, owned, ctRifle, ctPistol } = ctx();
      let n = 0;
      p.innerHTML = `<div class="cs-row" style="margin-bottom:10px"><b style="font-size:18px">BUY MENU</b><span class="cs-mut">${team === 'T' ? 'Terrorists' : 'Counter-Terrorists'}</span><span style="flex:1"></span><b style="color:#7ed957;font-size:18px">$${money}</b><button class="cs-btn alt sm" data-close>✕</button></div>
        <div class="cats">${BUY_MENU.map((cat, ci) => `<div class="cat"><h4>${ci + 1} · ${esc(cat.name)}</h4>${cat.items.filter((i) => forTeam(i, team)).filter((i) => !(team === 'CT' && ((i === 'm4a4' && ctRifle === 'm4a1s') || (i === 'm4a1s' && ctRifle !== 'm4a1s') || (i === 'usp' && ctPistol === 'p2000') || (i === 'p2000' && ctPistol !== 'p2000'))))
          .map((i, k) => { n++; const price = itemPrice(i); return `<button class="it ${money < price ? 'no' : ''} ${owned.has(i) ? 'no' : ''}" data-buy="${i}"><span><span class="k">${k + 1}</span>${esc(itemName(i))}</span><span class="p">$${price}</span></button>`; }).join('')}</div>`).join('')}</div>
        <div class="cs-mut cs-small" style="margin-top:8px">Click to buy · or press the category number then the item number · B / Esc to close</div>`;
      p.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => ctx().buy(b.dataset.buy)));
      $('[data-close]', p).onclick = () => ctx().close();
    };
    render(); this.panelRender = render;
    document.body.appendChild(p);
  }
  // ---- scoreboard ----
  scoreboard(show, d) {
    if (!show) { if (this.panel && this.panel.dataset.k === 'sb') { this.panel.remove(); this.panel = null; } return; }
    if (!this.panel || this.panel.dataset.k !== 'sb') { if (this.panel) this.panel.remove(); this.panel = document.createElement('div'); this.panel.className = 'cs cs-panel cs-sb'; this.panel.dataset.k = 'sb'; document.body.appendChild(this.panel); }
    const rows = (team) => d.players.filter((p) => p.team === team).sort((a, b) => b.score - a.score).map((p) => `<tr class="${team} ${p.alive ? '' : 'dead'} ${p.id === d.me ? 'me' : ''}"><td>${p.bot ? '🤖 ' : ''}${esc(p.name)}</td><td>${d.myTeam === team ? '$' + p.money : ''}</td><td>${p.k}</td><td>${p.a}</td><td>${p.d}</td><td>${p.mvp ? '★' + p.mvp : ''}</td><td>${p.score}</td><td>${p.bot ? 'BOT' : (p.ping | 0)}</td></tr>`).join('');
    const hist = (d.history || []).map((h) => `<i style="background:${h.w === 'T' ? 'var(--tt)' : h.w === 'CT' ? 'var(--ct)' : '#555'}" title="${esc(h.r)}">${h.r === 'bomb' ? '💥' : h.r === 'defuse' ? '✂' : h.r === 'time' ? '⏱' : ''}</i>`).join('');
    this.panel.innerHTML = `<div class="cs-row"><b>${esc(d.title)}</b><span style="flex:1"></span><span>Round ${d.round}</span></div><div class="hist">${hist}</div>
      <table><tr class="cs-mut"><th>Counter-Terrorists · ${d.score.CT}</th><th>Money</th><th>K</th><th>A</th><th>D</th><th>MVP</th><th>Score</th><th>Ping</th></tr>${rows('CT')}
      <tr class="cs-mut"><th>Terrorists · ${d.score.T}</th><th></th><th></th><th></th><th></th><th></th><th></th><th></th></tr>${rows('T')}</table>`;
  }
  radio(open, team, onPick) {
    if (this.radioEl) { this.radioEl.remove(); this.radioEl = null; }
    if (!open) return;
    const r = document.createElement('div'); r.className = 'cs cs-radio'; r.innerHTML = RADIO[open].map((t, k) => `<div><b style="color:var(--o)">${k + 1}</b> ${esc(t)}</div>`).join('') + '<div class="cs-mut cs-small">0 / Esc: close</div>';
    document.body.appendChild(r); this.radioEl = r; this.radioPick = (k) => { const t = RADIO[open][k]; if (t) onPick(t); this.radio(null); };
  }
  emoteWheel(list, onPick) {
    if (this.radioEl) { this.radioEl.remove(); this.radioEl = null; }
    if (!list) return;
    const r = document.createElement('div'); r.className = 'cs cs-radio'; r.innerHTML = '<b>EMOTES</b>' + list.map((e, k) => `<div><b style="color:var(--o)">${k + 1}</b> ${esc(e.name)}</div>`).join('') + '<div class="cs-mut cs-small">0 / Esc: close · unlock more in the free pass</div>';
    document.body.appendChild(r); this.radioEl = r; this.radioPick = (k) => { const e = list[k]; if (e) onPick(e); this.emoteWheel(null); };
  }
  chatInput(teamOnly, onSend) {
    if (this.chatIn) this.chatIn.remove();
    const i = document.createElement('input'); i.className = 'cs cs-chatin'; i.maxLength = 120; i.placeholder = teamOnly ? 'Say to team…' : 'Say to all…';
    i.style.cssText += ';background:#0d1117;border:1px solid #2c3442;color:#fff;border-radius:6px;padding:8px';
    document.body.appendChild(i); this.chatIn = i; setTimeout(() => i.focus(), 0);
    i.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') { const t = i.value.trim(); if (t) onSend(t, teamOnly); i.remove(); this.chatIn = null; } if (e.key === 'Escape') { i.remove(); this.chatIn = null; } };
  }
  pauseMenu(open, h) {
    if (this.panel && this.panel.dataset.k === 'pause') { this.panel.remove(); this.panel = null; }
    if (!open) return;
    const p = document.createElement('div'); p.className = 'cs cs-panel'; p.dataset.k = 'pause'; this.panel = p;
    p.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;min-width:260px"><b style="font-size:18px">PAUSED</b><div class="cs-mut cs-small">${esc(h.info)}</div>
      <button class="cs-btn" data-r>RESUME</button>${h.invite ? `<button class="cs-btn alt" data-inv>COPY INVITE LINK</button>` : ''}
      <label class="cs-small cs-mut">Sensitivity <input type="range" min="0.2" max="6" step="0.05" value="${h.S.sens}" data-sens style="width:100%"></label>
      <button class="cs-btn alt" data-q>LEAVE MATCH</button></div>`;
    document.body.appendChild(p);
    $('[data-r]', p).onclick = h.resume; $('[data-q]', p).onclick = h.quit;
    const inv = $('[data-inv]', p); if (inv) inv.onclick = () => { const t = document.createElement('textarea'); t.value = h.invite; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* old browsers */ } t.remove(); inv.textContent = 'COPIED: ' + h.code; };
    $('[data-sens]', p).oninput = (e) => h.setSens(+e.target.value);
  }
  endScreen(d, onDone) {
    if (this.panel) this.panel.remove();
    const p = document.createElement('div'); p.className = 'cs cs-panel'; p.dataset.k = 'end'; this.panel = p;
    p.innerHTML = `<div style="min-width:min(520px,90vw)"><b style="font-size:24px">${esc(d.title)}</b><div style="font-size:20px;margin:6px 0">T ${d.score.T} : ${d.score.CT} CT</div>
      <div class="cs-grid" style="margin:10px 0">${[['Kills', d.me.k], ['Deaths', d.me.d], ['Assists', d.me.a], ['MVPs', d.me.mvp], ['HS', d.me.hs]].map(([n, v]) => `<div class="cs-card"><div class="cs-mut cs-small">${n}</div><b style="font-size:20px">${v}</b></div>`).join('')}</div>
      <div id="eRew" class="cs-coin" style="font-size:18px">Adding up your rewards…</div><div class="cs-row" style="margin-top:12px"><button class="cs-btn" data-d>CONTINUE</button></div></div>`;
    document.body.appendChild(p); $('[data-d]', p).onclick = onDone;
    return (txt) => { const e = $('#eRew', p); if (e) e.textContent = txt; };
  }
}
export { WEAPONS, G_BY_ID, GEAR_BY_ID, KNIFE_BY_ID };
