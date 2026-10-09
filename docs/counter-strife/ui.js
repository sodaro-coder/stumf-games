// Every screen: main menu (play, inventory, crates, market, quests, profile, settings), the lobby, the in-match HUD
// (health/armor, money, ammo, weapon slots, radar, round timer with team alive icons, kill feed, buy menu,
// scoreboard, chat, radio, spectating, scope, flash) and the end-of-match screen. Plain DOM, one stylesheet.
// Anything another player typed (names, chat) only ever goes in through textContent / esc().
import { WEAPONS, W_BY_ID, G_BY_ID, GEAR_BY_ID, BUY_MENU, MODES, BOT_LEVELS, RADIO, itemName, itemPrice, forTeam, RANKS, rankOf, RANKED_BOTS, PLACEMENTS } from './data.js';
import { CRATES, RARITY, crateOdds, itemInfo, paintSkin, AGENT_BY_ID, KNIFE_BY_ID, ITEM_BY_ID, PASS, PASS_TIERS, EMOTE_BY_ID } from './skins.js';
import { MAPS } from './maps.js';
import { thumb, stage, viewer } from './thumbs.js';
import { cardInto, cardImage, gradeBadge } from './cards.js';
import * as WAL from './wallet.js';
import { VOICE_PACKS } from './voices.js';
import { ATTACH, slotsFor, optionsFor, gunLevel, xpForLevel, GUN_MAX } from './guns.js';
import { topUp as sdkTopUp } from '../sdk/topup.js';

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
.cs-view{display:block;background:radial-gradient(ellipse at 50% 38%,#3a4352 0%,#1d232c 55%,#0d1015 100%);box-shadow:inset 0 0 0 1px #ffffff14,inset 0 -40px 60px #00000055}
.cs-reel{position:relative;height:150px;overflow:hidden;border-radius:10px;background:#0b0e13;border:1px solid var(--line)}
.cs-reel .strip{position:absolute;left:0;top:10px;display:flex;gap:8px;will-change:transform}
.cs-reel .cell{width:130px;height:130px;background:var(--bg2);border-radius:8px;padding:6px;border-bottom:4px solid}
.cs-reel .cell canvas{width:100%;height:80px}.cs-reel .cell div{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cs-reel .mark{position:absolute;left:50%;top:0;bottom:0;width:2px;background:#ffd45a;box-shadow:0 0 10px #ffd45a}
/* HUD */
.cs-hud{position:fixed;inset:0;z-index:20;pointer-events:none;font:700 16px "Segoe UI",system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000}
.cs-hud .stat,.cs-hud .ammo{background:linear-gradient(90deg,rgba(0,0,0,.55),rgba(0,0,0,.15));border-radius:2px;font-weight:700;letter-spacing:.02em}
.cs-hud .slot img{height:18px;vertical-align:middle;margin-right:6px;filter:drop-shadow(0 1px 1px #000)}
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
.cs-hud.touch canvas.radar{width:100px;height:100px}.cs-hud.touch .tl{left:calc(env(safe-area-inset-left,0px) + 8px);top:6px}
.cs-hud.touch .loc{font-size:11px}.cs-hud.touch .money{font-size:15px}.cs-hud.touch .buyic{display:none}.cs-hud.touch .slots{display:none}
.cs-hud.touch .bl{left:50%;bottom:6px;transform:translateX(-80%);gap:6px}.cs-hud.touch .stat{font-size:17px;min-width:58px;padding:2px 8px 2px 6px}.cs-hud.touch .stat .ic{font-size:13px}
.cs-hud.touch .br{right:auto;left:calc(50% + 74px);bottom:6px}.cs-hud.touch .ammo{font-size:22px}.cs-hud.touch .ammo small{font-size:12px}
.cs-hud.touch .feed{top:54px}.cs-hud.touch .kf{font-size:11px;padding:2px 6px}.cs-hud.touch .top{top:4px;transform:translateX(-50%) scale(.72);transform-origin:top center}
.cs-hud.touch .banner{font-size:18px;padding:6px 14px}.cs-hud.touch .center{top:16%}
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
.cs-scope.ret:before,.cs-scope.ret:after{display:none}
.cs-ads{position:fixed;inset:0;z-index:18;pointer-events:none;display:none}
.cs-ads .dot{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#ff2a2a;box-shadow:0 0 6px 2px rgba(255,40,40,.7)}
.cs-ads .holo{position:absolute;left:50%;top:50%;width:10vh;height:10vh;transform:translate(-50%,-50%);filter:drop-shadow(0 0 3px rgba(255,50,50,.8))}
.cs-ads.acog{background:radial-gradient(circle at 50% 50%,transparent 0,transparent 31vh,rgba(0,0,0,.55) 33vh,rgba(0,0,0,.94) 35vh)}
.cs-ads .chev{position:absolute;left:50%;top:50%;width:34vh;height:34vh;transform:translate(-50%,-50%)}
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

// the CS-style menu skin: slate panels, thin borders, uppercase condensed labels, rarity-glow item tiles
const MENU_CSS = `
.cs{font-family:"Segoe UI","Roboto","Helvetica Neue",Arial,sans-serif;letter-spacing:.01em}
.cs-menu{display:block;background:#14171c}
.cs-stage{position:absolute;inset:0;width:100%;height:100%;display:block}
.cs-vig{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(12,14,18,.92) 0,rgba(12,14,18,.55) 38%,rgba(12,14,18,0) 62%),linear-gradient(0deg,rgba(12,14,18,.85),rgba(12,14,18,0) 30%)}
.cs-topnav{position:absolute;left:0;right:0;top:0;height:60px;display:flex;align-items:stretch;background:linear-gradient(180deg,rgba(20,23,28,.97),rgba(20,23,28,.88));border-bottom:1px solid #2e343d;z-index:3}
.cs-brand{display:flex;align-items:center;padding:0 22px;font:900 24px "Segoe UI",system-ui;letter-spacing:.12em;border-right:1px solid #2e343d}.cs-brand i{color:#f2a33a;font-style:normal}
.cs-nav{display:flex}.cs-nav button{border:0;background:transparent;color:#8d97a5;padding:0 18px;font:700 12px "Segoe UI",system-ui;letter-spacing:.16em;text-transform:uppercase;display:flex;align-items:center;gap:8px;border-bottom:3px solid transparent}
.cs-nav button:hover{color:#e6eaf0;background:rgba(255,255,255,.03)}.cs-nav button.on{color:#fff;border-bottom-color:#f2a33a;background:rgba(242,163,58,.06)}
.cs-nav svg{width:18px;height:18px;fill:currentColor}
.cs-acct{margin-left:auto;display:flex;align-items:center;gap:10px;padding:0 14px}
.cs-rank{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;border:1px solid #2e343d;border-radius:3px;background:#1b1f25}
.cs-rank b{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 30%,#7ab8ff,#2a5aa8);font:800 13px system-ui;color:#fff}
.cs-rank .xp{width:84px;height:4px;background:#0d1015;border-radius:2px;overflow:hidden}.cs-rank .xp i{display:block;height:100%;background:#7ab8ff}
.cs-coinbox{font:700 15px system-ui;color:#ffd45a;padding:6px 12px;white-space:nowrap;border:1px solid #2e343d;border-radius:3px;background:#1b1f25}
.cs-ibtn{width:36px;height:36px;border:1px solid #2e343d;border-radius:3px;background:#1b1f25;color:#c8d0da}
.cs-page{position:absolute;top:60px;left:0;right:0;bottom:0;overflow:auto;padding:22px 26px;z-index:2}
.cs-page.solid{background:rgba(16,19,23,.96)}
.cs-home{display:grid;grid-template-columns:minmax(300px,420px) 1fr 320px;gap:22px;height:100%;pointer-events:none}.cs-home>*{pointer-events:auto}
.cs-hero h1{font:900 54px/1 "Segoe UI",system-ui;letter-spacing:.06em;margin:28px 0 6px}.cs-hero h1 i{color:#f2a33a;font-style:normal}
.cs-hero .sub{color:#9aa4b2;font-size:15px;margin-bottom:26px}
.cs-go{display:inline-flex;align-items:center;gap:12px;padding:16px 34px;border:0;border-radius:3px;background:linear-gradient(180deg,#76b13a,#4f8a22);color:#fff !important;font:900 20px "Segoe UI",system-ui;letter-spacing:.14em;box-shadow:0 6px 24px rgba(80,140,40,.35);cursor:pointer}
.cs-go:hover{filter:brightness(1.08)}.cs-go:disabled{filter:grayscale(1);opacity:.6}
.cs-panel2{background:rgba(22,26,32,.92);border:1px solid #2e343d;border-radius:3px;margin-bottom:12px}
.cs-panel2 h3{margin:0;padding:10px 14px;font:800 11px system-ui;letter-spacing:.18em;text-transform:uppercase;color:#8d97a5;border-bottom:1px solid #2e343d;background:rgba(255,255,255,.02)}
.cs-panel2 .bd{padding:12px 14px}
.cs-sec{font:800 11px system-ui;letter-spacing:.2em;text-transform:uppercase;color:#8d97a5;margin:18px 0 10px}
.cs-tabs{display:flex;gap:2px;border-bottom:1px solid #2e343d;margin-bottom:16px}.cs-tabs button{border:0;background:transparent;color:#8d97a5;padding:12px 18px;font:800 12px system-ui;letter-spacing:.14em;text-transform:uppercase;border-bottom:3px solid transparent}
.cs-tabs button.on{color:#fff;border-bottom-color:#f2a33a}
.cs-maps{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.cs-map{position:relative;border:1px solid #2e343d;border-radius:3px;overflow:hidden;cursor:pointer;background:#0f1216}
.cs-map canvas{display:block;width:100%;height:130px}.cs-map .nm{position:absolute;left:0;right:0;bottom:0;padding:22px 12px 9px;background:linear-gradient(0deg,rgba(0,0,0,.9),transparent);font:800 14px system-ui;letter-spacing:.06em}
.cs-map .nm small{display:block;font:600 11px system-ui;color:#9aa4b2;letter-spacing:.02em}.cs-map.on{outline:2px solid #f2a33a}.cs-map .ck{position:absolute;top:8px;right:8px;width:20px;height:20px;border-radius:2px;border:2px solid #fff8;background:#0008}.cs-map.on .ck{background:#f2a33a;border-color:#f2a33a}
.cs-seg{display:inline-flex;border:1px solid #2e343d;border-radius:3px;overflow:hidden}.cs-seg button{border:0;background:#1b1f25;color:#9aa4b2;padding:8px 14px;font:700 12px system-ui;letter-spacing:.08em}.cs-seg button.on{background:#f2a33a;color:#1a1206}
.cs-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:10px}
.cs-tile{position:relative;background:#1d2128;border:1px solid #2a3038;border-radius:2px;cursor:pointer;overflow:hidden;transition:transform .08s}
.cs-tile:hover{transform:translateY(-2px);border-color:#4a5462}
.cs-tile.mythic{border-color:var(--rc);animation:csMyth 2.4s ease-in-out infinite}.cs-tile.mythic .img{position:relative;overflow:hidden}
.cs-tile.mythic .img::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.22) 50%,transparent 65%);animation:csSweep 3s linear infinite;pointer-events:none}
@keyframes csMyth{0%,100%{box-shadow:0 0 6px 1px var(--rc)}50%{box-shadow:0 0 18px 5px var(--rc)}}@keyframes csSweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.cs-tile.mythic,.cs-tile.mythic .img::after{animation:none}}
.cs-tile .img{height:96px;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 60%,var(--rc,#4b69ff)33 0,transparent 70%),linear-gradient(180deg,#2a3039,#1d2128)}
.cs-tile canvas{width:100%;height:96px;display:block}
.cs-tile .tx{padding:7px 9px 9px;border-top:1px solid #2a3038}.cs-tile .w{font:600 11px system-ui;color:#9aa4b2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cs-tile .n{font:700 13px system-ui;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-tile .rb{position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--rc)}
.cs-tile .st{position:absolute;top:6px;left:7px;font:800 10px system-ui;color:#cf6a32;letter-spacing:.06em}.cs-tile .eq{position:absolute;top:6px;right:7px;font:800 10px system-ui;color:#f2a33a}
.cs-tile .pr{font:700 12px system-ui;color:#ffd45a;margin-top:2px}
.cs-case{position:relative;background:linear-gradient(180deg,#232831,#1a1e24);border:1px solid #2e343d;border-radius:2px;cursor:pointer;padding:12px;text-align:center}
.cs-case:hover{border-color:#f2a33a}.cs-case canvas{width:100%;height:110px;display:block}.cs-case b{display:block;font:800 13px system-ui;margin-top:6px;letter-spacing:.04em}.cs-case span{font:700 12px system-ui;color:#ffd45a}
.cs-modal{background:rgba(6,8,10,.82);backdrop-filter:blur(3px)}
.cs-modal>.cs-card{background:#1a1e24;border:1px solid #2e343d;border-radius:3px}
.cs-btn{border-radius:2px;letter-spacing:.08em;text-transform:uppercase;font-size:12px}
.cs-card{border-radius:3px;background:rgba(26,30,36,.94);border-color:#2e343d}
@media (max-width:900px){.cs-home{grid-template-columns:1fr}.cs-home .cs-side2{display:none}.cs-nav button span{display:none}.cs-brand{font-size:18px;padding:0 12px}}
@media (max-width:760px){
  .cs-topnav{height:50px}.cs-page{top:50px;bottom:calc(60px + env(safe-area-inset-bottom,0px));padding:14px 12px}
  .cs-nav{position:fixed;left:0;right:0;bottom:0;height:calc(60px + env(safe-area-inset-bottom,0px));padding-bottom:env(safe-area-inset-bottom,0px);background:#14171c;border-top:1px solid #2e343d;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;z-index:5;scrollbar-width:none}
  .cs-nav::-webkit-scrollbar{display:none}
  .cs-menu .cs-nav button{flex:0 0 66px;flex-direction:column;justify-content:center;gap:3px;padding:0;font-size:9px;letter-spacing:.04em;border-bottom:0;border-top:3px solid transparent}
  .cs-menu .cs-nav button span{display:block}.cs-menu .cs-nav button.on{border-top-color:#f2a33a}.cs-nav svg{width:20px;height:20px}
  .cs-rank,.cs-ibtn{display:none}.cs-acct{gap:6px;padding:0 8px}.cs-coinbox{padding:4px 8px;font-size:13px}
  .cs-tabs{overflow-x:auto;scrollbar-width:none}.cs-tabs button{flex:0 0 auto;padding:10px 12px}
  .cs-menu input,.cs-menu select{font-size:16px}
  .cs-hero h1{font-size:48px}.cs-go{width:100%}
  .cs-menu #pGo{position:fixed;left:12px;right:12px;bottom:calc(70px + env(safe-area-inset-bottom,0px));width:auto;z-index:6;box-shadow:0 6px 24px rgba(0,0,0,.6)}
  .cs-page{padding-bottom:80px}
}
@media (pointer:coarse) and (max-height:500px) and (min-width:761px){.cs-menu #pGo{position:fixed;right:16px;bottom:14px;width:220px;z-index:6;box-shadow:0 6px 24px rgba(0,0,0,.6)}.cs-topnav{height:50px}.cs-page{top:50px}}
.cs-acctf{flex-wrap:wrap}.cs-acctf input{flex:1 1 200px;min-width:0}
.cs-signup{margin-top:16px;max-width:380px;padding:14px;border:1px solid #f2a33a;border-radius:4px;background:rgba(242,163,58,.08)}
`;
export function injectCss() { if (document.getElementById('cs-css')) return; const s = document.createElement('style'); s.id = 'cs-css'; s.textContent = CSS + MENU_CSS; document.head.appendChild(s); }

// ---- item pictures: the finish painted inside the weapon's silhouette ----
const SIL = {  // rough side-on outlines per category, in a 100x40 box
  pistol: [[20, 12], [78, 12], [80, 20], [48, 20], [46, 34], [34, 34], [36, 20], [20, 20]],
  smg: [[8, 14], [80, 12], [92, 16], [80, 20], [56, 20], [54, 36], [46, 36], [46, 22], [30, 22], [26, 30], [8, 24]],
  rifle: [[2, 14], [36, 12], [92, 12], [98, 15], [70, 18], [60, 18], [58, 34], [50, 34], [50, 20], [40, 20], [34, 30], [24, 30], [26, 20], [2, 22]],
  sniper: [[2, 16], [30, 14], [36, 8], [62, 8], [64, 14], [98, 14], [98, 17], [56, 19], [52, 32], [44, 32], [44, 20], [30, 22], [2, 26]],
  heavy: [[2, 14], [30, 12], [96, 12], [96, 18], [60, 18], [56, 30], [46, 30], [46, 20], [30, 22], [2, 26]],
  knife: [[6, 22], [40, 18], [92, 16], [70, 26], [40, 26], [36, 30], [6, 30]],
};
// white weapon silhouettes for the kill feed and weapon slots (like the classic HUD icons)
const iconCache = new Map();
export function weaponIcon(wid) {
  if (iconCache.has(wid)) return iconCache.get(wid);
  const w = W_BY_ID[wid], c = document.createElement('canvas'); c.width = 96; c.height = 36; const g = c.getContext('2d');
  g.fillStyle = '#fff';
  if (G_BY_ID[wid]) { g.beginPath(); g.ellipse(48, 21, 9, 12, 0, 0, 7); g.fill(); g.fillRect(45, 4, 6, 6); }
  else if (wid === 'c4') { g.fillRect(28, 10, 40, 18); }
  else if (wid === 'bomb') { g.beginPath(); g.arc(48, 20, 13, 0, 7); g.fill(); }
  else {
    const sil = !w || w.cat === 'knife' ? SIL.knife : SIL[w.cat === 'smg' ? 'smg' : w.cat === 'sniper' ? 'sniper' : w.cat === 'heavy' ? 'heavy' : w.cat === 'rifle' ? 'rifle' : 'pistol'];
    const sc = w && w.cat === 'pistol' ? 0.62 : 1, ox = (96 - 96 * sc) / 2;
    g.beginPath(); sil.forEach(([x, y], k) => (k ? g.lineTo : g.moveTo).call(g, ox + x / 100 * 96 * sc, 2 + y / 40 * 32 * sc + (1 - sc) * 14)); g.closePath(); g.fill();
  }
  const url = c.toDataURL(); iconCache.set(wid, url); return url;
}
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
// today's prize pool: size, the stat it ranks by, time left, the top five and your standing; yesterday's payout
// copy text without the clipboard API (the kit's rules keep games away from device APIs): a selected text box + copy
function copyText(t) { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } a.remove(); return ok; }
const POOL_STAT = { kills: 'kills', mvps: 'MVPs', wins: 'wins' };
function poolCard(p) {
  if (!p) return '';
  const left = Math.max(0, new Date(p.ends) - Date.now()), h = Math.floor(left / 3.6e6), mn = Math.floor(left / 6e4) % 60, st = POOL_STAT[p.category] || p.category;
  const last = p.last && p.last.results ? p.last : null;
  return `<div class="cs-card" style="border:1px solid #f2a33a55;background:linear-gradient(135deg,#2a2112,#161a20)"><div class="cs-row"><b style="font-size:18px">🏆 Daily prize pool: 🪙 ${(+p.coins).toLocaleString()}</b><span style="flex:1"></span><span class="cs-chip">pays out at 11pm New York · ${h}h ${mn}m left</span></div>
    <div class="cs-mut cs-small" style="margin:6px 0">Today ranks by <b style="color:#fff">most ${esc(st)}</b> (kills → MVPs → wins, rotating daily). 1st 50% · 2nd 25% · 3rd 15% · everyone else who played shares 10%. Case spins and House purchases fill it.</div>
    <div class="cs-row" style="flex-wrap:wrap;gap:14px">${(p.top || []).map((t, k) => `<span>${['🥇', '🥈', '🥉', '4.', '5.'][k]} <b>${esc(t.name)}</b> <span class="cs-mut">${t.stat} ${esc(st)}</span></span>`).join('') || '<span class="cs-mut">Nobody has played yet today: be first.</span>'}</div>
    ${p.me ? `<div class="cs-small" style="margin-top:6px">You: <b>#${p.me.rank}</b> with ${p.me.stat} ${esc(st)} over ${p.me.matches} match${p.me.matches === 1 ? '' : 'es'}</div>` : '<div class="cs-small cs-mut" style="margin-top:6px">Play a match today to get a share.</div>'}
    ${last ? `<div class="cs-small cs-mut" style="margin-top:6px">Last payout (${esc(POOL_STAT[last.category] || last.category)}): 🪙 ${(+last.coins).toLocaleString()}${last.mine > 0 ? ` · <b style="color:#7ed957">you won 🪙 ${(+last.mine).toLocaleString()}</b>` : ''}${last.results[0] ? ` · winner ${esc(last.results[0].name)}` : ''}</div>` : ''}</div>`;
}
const itemCard = (item, extra = '', eqTag = '') => {
  const info = itemInfo(item); if (!info) return '';
  return `<div class="cs-tile${info.tier === 6 ? ' mythic' : ''}" data-uid="${esc(item.uid)}" style="--rc:${info.rarity.color}"><div class="img"><canvas width="320" height="160" data-draw="${esc(item.uid)}"></canvas></div>
    ${item.st ? '<span class="st">STATTRAK™</span>' : ''}${eqTag ? `<span class="eq">${esc(eqTag)}</span>` : item.listed ? '<span class="eq" style="color:#7ed957">LISTED</span>' : ''}
    <div class="tx"><div class="w">${esc(info.wpn)}${info.wear ? ' · ' + esc(info.wear.key) : ''}${gradeBadge(item)}</div><div class="n">${esc(info.finish)}</div>${extra ? `<div class="pr">${extra}</div>` : ''}</div><div class="rb"></div></div>`;
};
// draw every item picture in a container: the 3D render when available, the flat drawing meanwhile / otherwise
function paintAll(root, items) {
  root.querySelectorAll('canvas[data-draw]').forEach((c) => {
    const it = items.find((x) => x.uid === c.dataset.draw); if (!it) return;
    const ok = thumb(it, (url) => { const im = new Image(); im.onload = () => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); const k = Math.min(c.width / im.width, c.height / im.height); g.drawImage(im, (c.width - im.width * k) / 2, (c.height - im.height * k) / 2, im.width * k, im.height * k); }; im.src = url; });
    if (!ok) drawItem(c, it);
  });
}
const ICON = {  // nav icons (simple inline SVG paths)
  guns: 'M11 2h2v4h-2zM11 18h2v4h-2zM2 11h4v2H2zM18 11h4v2h-4zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  home: 'M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z', play: 'M7 4l13 8-13 8z', pass: 'M5 3h14v18l-7-4-7 4z', inv: 'M4 7h16v13H4zM8 7V4h8v3', crates: 'M3 8l9-5 9 5v8l-9 5-9-5zM12 13v8M3 8l9 5 9-5',
  market: 'M4 9l2-5h12l2 5zM5 9h14v11H5zM9 14h6', quests: 'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z', friends: 'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM1 21c0-4 3-7 7-7s7 3 7 7zM17 11a3 3 0 1 0 0-6M16 14c4 0 7 3 7 7h-6', admin: 'M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6z', profile: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM3 22c1-5 5-8 9-8s8 3 9 8z', settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 2h4l1 3 3 1 3-1 2 3-2 3 1 2-1 2 2 3-2 3-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-3 2-3-1-2 1-2-2-3 2-3 3 1 3-1z',
};
const svg = (k) => `<svg viewBox="0 0 24 24"><path d="${ICON[k]}"/></svg>`;
// sniper scope reticles (drawn over the scope view) and the aim-down-sights optics' reticles
const RS = (inner) => `<svg viewBox="-100 -100 200 200" style="position:absolute;left:50%;top:50%;width:68vh;height:68vh;transform:translate(-50%,-50%)">${inner}</svg>`;
const RETICLES = {
  duplex: RS('<path d="M-100 0H-22M22 0H100M0 -100V-22M0 22V100" stroke="#000" stroke-width="3"/><path d="M-22 0H22M0 -22V22" stroke="#000" stroke-width="0.8"/>'),
  mildot: RS('<path d="M-100 0H100M0 -100V100" stroke="#000" stroke-width="0.8"/>' + [-60, -45, -30, -15, 15, 30, 45, 60].map((k) => `<circle cx="${k}" cy="0" r="1.8"/><circle cx="0" cy="${k}" r="1.8"/>`).join('')),
  dotret: RS('<path d="M-100 0H-30M30 0H100M0 -100V-30M0 30V100" stroke="#000" stroke-width="2"/><circle r="2.4" fill="#ff2a2a"/>'),
  circle: RS('<circle r="22" fill="none" stroke="#000" stroke-width="1.2"/><path d="M-100 0H-22M22 0H100M0 -100V-22M0 22V100" stroke="#000" stroke-width="1"/><circle r="1" />'),
  chevret: RS('<path d="M-9 9L0 0L9 9" fill="none" stroke="#ff3a2a" stroke-width="1.6"/><path d="M0 14V100M-100 0H-40M40 0H100" stroke="#000" stroke-width="1.2"/>'),
  hotdog: RS('<ellipse rx="16" ry="5" fill="#d8a050"/><ellipse rx="18" ry="3" fill="#b8402a"/><path d="M-14 -1Q-10 -4 -6 -1T2 -1T10 -1" stroke="#f2d33c" fill="none" stroke-width="1.2"/><path d="M-100 0H-24M24 0H100M0 -100V-12M0 12V100" stroke="#000" stroke-width="1"/>'),
};
const ADS_RET = {
  reddot: '<div class="dot"></div>',
  holo: '<svg viewBox="-20 -20 40 40" class="holo"><circle r="13" fill="none" stroke="#ff3030" stroke-width="1.3"/><circle r="1.6" fill="#ff3030"/><path d="M0 -13V-9M0 13V9M-13 0H-9M13 0H9" stroke="#ff3030" stroke-width="1.3"/></svg>',
  acog: '<svg viewBox="-20 -20 40 40" class="chev"><path d="M-3.5 3L0 -0.5L3.5 3" fill="none" stroke="#ff3a2a" stroke-width="1"/><path d="M0 3.5V14M-12 0H-6M6 0H12" stroke="#111" stroke-width="0.6"/></svg>',
};
// a case drawn from its pull set's colours (a box with a stripe and the case's name)
function drawCase(c, crate) {
  const g = c.getContext('2d'), W = c.width, H = c.height, cols = [...new Set(crate.items.filter((i) => i.paint).map((i) => i.paint.c[0]))].slice(0, 3);
  const a = cols[0] || '#5a6a7a', b = cols[1] || '#2a3038';
  g.clearRect(0, 0, W, H);
  const x = W * 0.16, y = H * 0.18, w = W * 0.68, h = H * 0.66;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(W / 2, y + h + 6, w * 0.48, 7, 0, 0, 7); g.fill();
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, w, 4); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + h * 0.42, w, h * 0.16);
  g.fillStyle = cols[2] || '#f2a33a'; g.fillRect(x + w * 0.42, y + h * 0.36, w * 0.16, h * 0.28);
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
}

// ======================================================================================================================
// main menu
// ======================================================================================================================
export class Menu {
  constructor(cfg, profile, h) { this.cfg = cfg; this.P = profile; this.h = h; this.tab = 'home'; this.sel = { mode: '5v5', map: 'dust', bot: (() => { try { return matchMedia('(pointer: coarse)').matches ? 'easy' : 'normal'; } catch (e) { return 'normal'; } })(), host: 'bots' }; this.lobbies = []; }   // phones start on Easy bots
  show() {
    injectCss();
    this.root = document.createElement('div'); this.root.className = 'cs cs-menu';
    const title = esc(this.cfg.title || 'KYS:GO').replace(/[:-]/, (m) => `<i>${m}</i>`);
    this.root.innerHTML = `<canvas class="cs-stage"></canvas><div class="cs-vig"></div>
      <div class="cs-topnav"><div class="cs-brand">${title}</div><nav class="cs-nav">${[['home', 'Home'], ['play', 'Play'], ['inv', 'Inventory'], ['guns', 'Gunsmith'], ['crates', 'Cases'], ['pass', 'Pass'], ['market', 'Market'], ['friends', 'Friends'], ['quests', 'Quests'], ['profile', 'Profile'], ['settings', 'Settings'], ...(this.P.admin ? [['admin', 'Admin']] : [])]
        .map(([k, n]) => `<button data-tab="${k}">${svg(k)}<span>${n}</span></button>`).join('')}</nav>
        <div class="cs-acct"><button class="cs-coinbox" id="mTop" style="cursor:pointer;color:#7ed957">＋ TOP UP</button><span class="cs-coinbox" id="mCoins"></span><div class="cs-rank"><b id="mLvlN">1</b><div><div style="font:700 11px system-ui;color:#c8d0da" id="mName"></div><div class="xp"><i id="mXp"></i></div></div></div>
        <button class="cs-ibtn" id="mFull" title="Fullscreen (also makes Ctrl-crouch safe)">⛶</button></div></div>
      <div class="cs-page" id="mBody"></div>`;
    document.body.appendChild(this.root);
    this.root.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.tab; this.h.sound('tick'); this.render(); }));
    this.off = this.P.on(() => this.top());
    $('#mFull', this.root).onclick = () => { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen().then(() => navigator.keyboard && navigator.keyboard.lock && navigator.keyboard.lock().catch(() => {})).catch(() => {}); };
    this.adminShown = this.P.admin;
    this.stage = stage($('.cs-stage', this.root), this.stageLook());
    $('#mTop', this.root).onclick = () => this.topUp();
    this.render();
    this.P.daily().then((n) => n && this.h.toast(`Daily bonus: +${n} coins`));
  }
  // top-up (shared SDK): Cash App in person, or SOL to STUMF with the account's deposit code (credited automatically)
  topUp() { sdkTopUp(this.cfg, { who: this.P.tag ? `${this.P.d.name || 'Player'}#${this.P.tag}` : this.P.d.name, code: this.P.signedIn ? this.P.dep : null, game: 'kysgo', coins: 'coins' }); }
  stageLook() {  // the equipped T agent (else the default) holding the equipped AK skin's gun
    const lo = this.P.loadoutFor('T'), a = AGENT_BY_ID[lo.agent] || AGENT_BY_ID.a_t_default;
    return { look: a.look, team: a.team, wid: 'ak47' };
  }
  hide() { if (this.stage) this.stage.stop(); this.stage = null; if (this.root) this.root.remove(); this.root = null; if (this.off) this.off(); if (this.lb) { this.lb.close(); this.lb = null; } }
  top() {
    if (!this.root) return;
    const P = this.P, lv = P.level, need = lv ** 2 * 100, prev = (lv - 1) ** 2 * 100;
    $('#mLvlN', this.root).textContent = lv; $('#mXp', this.root).style.width = Math.round((P.d.xp - prev) / (need - prev) * 100) + '%';
    $('#mName', this.root).textContent = (P.d.name || 'Player') + (P.tag ? '#' + P.tag : '') + (P.signedIn ? (P.online ? ' ☁' : ' (offline)') : '');
    $('#mCoins', this.root).textContent = `🪙 ${P.d.coins.toLocaleString()}`;
  }
  render() {
    if (!this.root) return;
    this.top();
    this.root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    const B = $('#mBody', this.root);
    B.classList.toggle('solid', this.tab !== 'home');
    if (this.P.admin !== this.adminShown) { this.adminShown = this.P.admin; this.hide(); this.show(); return; }
    if (this.tab !== 'play' && this.tab !== 'home' && this.lb) { this.lb.close(); this.lb = null; }
    this['tab_' + this.tab](B);
  }
  // ---- HOME: the stage, a big GO, and the side panels ----
  // Download: install the game as an app on whatever this is. Android / PC (Chrome, Edge): one tap installs it (its own
  // icon, full screen, no browser bars); iPhone / iPad: Safari's Add to Home Screen; an Android APK when one is published
  downloadPanel() {
    const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1), android = /Android/.test(ua);
    const ip = window.__installPrompt, ov = document.createElement('div'); ov.className = 'cs'; ov.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(460px,92vw);max-height:90vh;overflow:auto;z-index:500;background:#15191f;border:1px solid #2a313b;border-radius:10px;padding:18px 20px;color:#e8ecf0;box-shadow:0 20px 60px rgba(0,0,0,.6);font-family:inherit';
    const step = (n, t) => `<div style="display:flex;gap:6px;align-items:flex-start;margin:7px 0"><b style="color:#ff9a3a;flex:0 0 22px">${n}.</b><span style="flex:1;min-width:0">${t}</span></div>`;
    ov.innerHTML = `<b style="font-size:20px">⬇ Get KYS:GO</b>
      ${ios ? `<div class="cs-small cs-mut" style="margin:6px 0 10px">On iPhone / iPad it installs from Safari as a full-screen app (Apple doesn't allow game downloads outside the App Store):</div>
        ${step(1, 'Open this page in <b>Safari</b>.')}${step(2, 'Tap <b>Share</b> (the square with the arrow).')}${step(3, 'Tap <b>Add to Home Screen</b>, then <b>Add</b>.')}${step(4, 'Open KYS:GO from the new icon: it runs full screen, turn the phone sideways.')}`
      : `<div class="cs-small cs-mut" style="margin:6px 0 10px">${android ? 'Installs as an app on your phone: its own icon, full screen, landscape.' : 'Installs as a desktop app: its own window and icon, no browser bars.'}</div>
        ${ip ? '<button class="cs-go" id="dlGo" style="width:100%">Install KYS:GO</button>' : android ? step(1, 'Open this page in <b>Chrome</b>.') + step(2, 'Tap <b>⋮</b> (top right) → <b>Install app</b> (or <b>Add to Home screen</b>).') + step(3, 'Open KYS:GO from the new icon.') : step(1, 'Open this page in <b>Chrome</b> or <b>Edge</b>.') + step(2, 'Click the <b>install icon</b> at the right of the address bar (or menu → <b>Install KYS:GO</b>).') + step(3, 'Launch it from your desktop / Start menu.')}
        ${android ? '<div id="dlApk" class="cs-small cs-mut" style="margin-top:10px"></div>' : ''}`}
      <div style="margin-top:14px;text-align:right"><button class="cs-btn alt" id="dlX">Close</button></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#dlX').onclick = () => ov.remove();
    const go = ov.querySelector('#dlGo'); if (go) go.onclick = async () => { try { ip.prompt(); const r = await ip.userChoice; if (r && r.outcome === 'accepted') { window.__installPrompt = null; ov.remove(); } } catch (e) { /* already used */ } };
    const apk = ov.querySelector('#dlApk');
    if (apk) fetch('kysgo.apk', { method: 'HEAD' }).then((r) => { if (r.ok) apk.innerHTML = 'Prefer an APK file? <a href="kysgo.apk" download style="color:var(--o)">Download kysgo.apk</a> (allow installs from your browser when Android asks).'; }).catch(() => {});
  }
  tab_home(B) {
    const P = this.P; P.ensureQuests();
    const q = P.d.quests.filter((x) => !x.weekly), featured = CRATES[(Math.floor(Date.now() / 86400000)) % (CRATES.length - 1)];
    const passReady = (Array.from({ length: P.level }, (_, i) => i + 1)).filter((t) => t <= 50 && !(P.d.pass || []).includes(t)).length;
    B.innerHTML = `<div class="cs-home"><div class="cs-hero"><h1>${esc(this.cfg.title || 'KYS:GO').replace(/[:-]/, (m) => `<i>${m}</i>`)}</h1><div class="sub">${esc(this.cfg.tagline || '')}</div>
        <button class="cs-go" id="hGo">▶ PLAY</button>
        ${matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ? '' : '<div><button class="cs-btn alt" id="hDl" style="margin-top:12px">⬇ Download</button></div>'}
        ${P.cloud && !P.signedIn ? '<div class="cs-signup"><b>Make a free account</b><div class="cs-small cs-mut" style="margin:4px 0 10px">Keep your skins and coins on every device, add friends, trade. Takes 20 seconds.</div><button class="cs-btn" id="hAcct" style="width:100%">Create account / Sign in</button></div>' : ''}
        <div class="cs-panel2" style="margin-top:26px;max-width:380px"><h3>Quick match</h3><div class="bd"><div class="cs-small cs-mut" id="hSel"></div></div></div></div><div></div>
      <div class="cs-side2"><div id="hPool"></div><div class="cs-panel2"><h3>Featured case</h3><div class="bd" style="text-align:center;cursor:pointer" id="hCase"><canvas width="240" height="120" style="width:100%"></canvas><b>${esc(featured.name)}</b><div class="cs-small cs-mut">${esc(featured.desc)}</div></div></div>
        <div class="cs-panel2"><h3>Daily quests</h3><div class="bd">${q.map((x) => `<div style="margin-bottom:9px"><div class="cs-row cs-small"><span>${esc(x.text)}</span><span style="flex:1"></span><span class="cs-coin">${x.claimed ? '✓' : '🪙 ' + x.coins}</span></div><div class="cs-bar" style="height:4px;margin-top:4px"><i style="width:${Math.round(x.prog / x.goal * 100)}%"></i></div></div>`).join('')}</div></div>
        <div class="cs-panel2"><h3>Free battle pass</h3><div class="bd cs-small">Level ${P.level} · ${passReady ? `<b style="color:#f2a33a">${passReady} reward${passReady > 1 ? 's' : ''} to claim</b>` : 'keep playing for the next reward'}</div></div></div></div>`;
    $('#hSel', B).textContent = `${MODES[this.sel.mode].name} · ${MAPS[this.sel.map].name} · bots ${BOT_LEVELS[this.sel.bot].name}`;
    P.poolStatus().then((p) => { const el = $('#hPool', B); if (el && p) el.innerHTML = poolCard(p); }).catch(() => {});
    $('#hGo', B).onclick = () => { this.tab = 'play'; this.render(); };
    const dl = $('#hDl', B); if (dl) dl.onclick = () => this.downloadPanel();
    const ha = $('#hAcct', B); if (ha) ha.onclick = () => { this.tab = 'profile'; this.render(); setTimeout(() => { const e = $('#aE', this.root); if (e) e.focus(); }, 50); };
    drawCase($('#hCase canvas', B), featured); $('#hCase', B).onclick = () => this.contents(featured.id);
  }
  // ---- PLAY: mode tabs, map tiles, bots, then GO ----
  tab_play(B) {
    const s = this.sel;
    B.innerHTML = `<div class="cs-tabs">${Object.entries(MODES).map(([k, m]) => `<button data-mode="${k}" class="${s.mode === k ? 'on' : ''}">${esc(m.name)}</button>`).join('')}</div>
      <div class="cs-small cs-mut" style="margin:-6px 0 14px">${MODES[s.mode].bomb ? 'Bomb defusal' : 'Combat only: no kill when time runs out = draw'} · first to ${MODES[s.mode].winTo} · bots fill empty slots</div>
      <div class="cs-maps">${Object.values(MAPS).map((m) => `<div class="cs-map ${s.map === m.id ? 'on' : ''}" data-map="${m.id}"><canvas width="440" height="260" data-mapprev="${m.id}"></canvas><span class="ck"></span><div class="nm">${esc(m.name)}<small>parody of ${esc(m.parody)}</small></div></div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:1fr 340px;gap:22px;margin-top:20px">
        <div><div class="cs-sec">Lobby</div><div class="cs-seg">${[['bots', 'Offline with bots'], ['pub', 'Host public'], ['priv', 'Host private'], ['ranked', '🏆 Ranked']].map(([k, n]) => `<button data-host="${k}" class="${s.host === k ? 'on' : ''}">${n}</button>`).join('')}</div>
          <div class="cs-sec">Bot difficulty</div><div class="cs-seg">${Object.entries(BOT_LEVELS).filter(([k, b]) => !b.hidden && (s.host !== 'ranked' || RANKED_BOTS.includes(k))).map(([k, b]) => `<button data-bot="${k}" class="${s.bot === k ? 'on' : ''}">${b.name}</button>`).join('')}</div>
          ${s.host === 'ranked' ? (() => { const rk = this.P.d.rank || { rr: 0, n: 0, w: 0 }, R = RANKS[rankOf(rk.rr)], nx = RANKS[rankOf(rk.rr) + 1];
            return `<div class="cs-panel2" style="margin-top:10px"><h3>Your rank</h3><div class="bd"><b style="color:${R.c};font-size:18px">${rk.n < PLACEMENTS ? 'Unranked' : esc(R.name)}</b>
              <div class="cs-small cs-mut">${rk.n < PLACEMENTS ? `Placement matches: ${rk.n}/${PLACEMENTS} (double rating swings)` : `${rk.rr} RR${nx ? ` · ${nx.rr - rk.rr} to ${esc(nx.name)}` : ' · top rank'}`} · ${rk.w} wins</div>
              <div class="cs-small cs-mut" style="margin-top:6px">Ranked rules: bots only on Normal or Hard, and one team must be all real players before it starts. Wins vs bot opponents count half. First time you reach a rank: 300 coins × its tier.${this.P.cloud && !this.P.signedIn ? ' <b>Sign in to save your rank.</b>' : ''}</div></div></div>`; })() : ''}
          <div style="margin-top:22px"><button class="cs-go" id="pGo">GO</button></div></div>
        <div><div class="cs-panel2"><h3>Join a friend</h3><div class="bd"><div class="cs-row"><input id="pCode" maxlength="5" placeholder="INVITE CODE" style="flex:1;text-transform:uppercase"><button class="cs-btn" id="pJoin">Join</button></div></div></div>
          <div class="cs-panel2"><h3>Open lobbies</h3><div class="bd" id="pList"><span class="cs-mut cs-small">Looking for lobbies…</span></div></div></div></div>`;
    B.querySelectorAll('[data-mode]').forEach((e) => (e.onclick = () => { s.mode = e.dataset.mode; this.render(); }));
    B.querySelectorAll('[data-map]').forEach((e) => (e.onclick = () => { s.map = e.dataset.map; this.render(); }));
    B.querySelectorAll('[data-bot]').forEach((e) => (e.onclick = () => { s.bot = e.dataset.bot; this.render(); }));
    B.querySelectorAll('[data-host]').forEach((e) => (e.onclick = () => { s.host = e.dataset.host; this.render(); }));
    B.querySelectorAll('canvas[data-mapprev]').forEach((c) => this.h.mapPreview(c, c.dataset.mapprev));
    $('#pGo', B).onclick = () => { const rkd = s.host === 'ranked'; if (rkd && !RANKED_BOTS.includes(s.bot)) s.bot = 'hard';
      this.h.play({ mode: s.mode, map: s.map, bot: s.bot, host: true, solo: s.host === 'bots', pub: s.host === 'pub' || rkd, ranked: rkd }); };
    const code = $('#pCode', B); const hash = location.hash.slice(1).toUpperCase(); if (/^[A-Z0-9]{5}$/.test(hash)) code.value = hash;
    $('#pJoin', B).onclick = () => { const c = code.value.trim().toUpperCase(); if (c.length === 5) this.h.play({ code: c, host: false }); };
    if (!this.lb) this.lb = this.h.lobbies((list) => { this.lobbies = list; const el = $('#pList', this.root); if (!el) return;
      el.innerHTML = list.length ? '' : '<span class="cs-mut cs-small">No open lobbies right now: host one!</span>';
      for (const l of list) { const r = document.createElement('div'); r.className = 'cs-row'; r.style.marginBottom = '8px'; r.innerHTML = '<div style="flex:1;min-width:0"><b class="n" style="display:block;font-size:13px"></b><span class="cs-mut cs-small m"></span></div><button class="cs-btn sm">Join</button>';
        $('.n', r).textContent = String(l.name || 'Lobby').slice(0, 30); $('.m', r).textContent = `${l.ranked ? '🏆 RANKED · ' : ''}${String(l.mode || '').slice(0, 4)} · ${(MAPS[l.map] || {}).short || ''} · ${l.players | 0}/${l.max | 0}`;
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
      <div class="cs-sec">${shown.length} items</div><div class="cs-tiles">${shown.slice().sort((a, b) => ((ITEM_BY_ID[b.def] || {}).tier - (ITEM_BY_ID[a.def] || {}).tier) || (b.t - a.t)).map((i) => itemCard(i, '', eq(i.uid))).join('') || '<div class="cs-mut">Nothing yet. Open cases with coins you earn by playing.</div>'}</div>`;
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
      <div class="cs-row" style="margin-top:8px"><button class="cs-btn sm" data-vw="3d">3D</button><button class="cs-btn alt sm" data-vw="card">Card</button><span style="flex:1"></span><button class="cs-btn alt sm" data-png style="display:none">Save card image</button></div>
      <div data-card style="display:none;padding:14px 0"></div>
      <canvas width="560" height="${info.kind === 'agent' ? 420 : 280}" class="cs-view" style="width:100%;height:${info.kind === 'agent' ? 'min(420px,52vh)' : 'min(280px,34vh)'};margin:10px 0;border-radius:10px"></canvas>
      <div class="cs-small cs-mut" style="text-align:center;margin:-6px 0 6px">drag to turn · scroll or pinch to zoom</div>
      <div class="cs-small cs-mut">${esc(info.rarity.name)}${info.wear ? ` · ${esc(info.wear.name)} · float ${it.float.toFixed(5)} · pattern ${it.seed}` : ''}${it.st ? ` · StatTrak™ kills: ${it.kills | 0}` : ''} · worth ~${info.value} coins</div>
      <div class="cs-row" style="margin-top:12px">${teams.map((t) => `<button class="cs-btn sm" data-eq="${t}">Equip ${t === 'T' ? 'Terrorist' : 'Counter-Terrorist'}</button>`).join('')}
        ${P.signedIn && (P.nftcfg || {}).on ? (it.nft ? '<span class="cs-chip">◎ NFT · vaulted</span>' : it.mint ? `<span class="cs-chip">◎ NFT ${esc(it.mint)}</span>` : '<button class="cs-btn alt sm" data-mint>◎ Mint as NFT</button>') : ''}
        <button class="cs-btn alt sm" data-sell>Sell instantly (${Math.round(info.value * 0.8)} coins)</button>
        ${P.signedIn ? (it.listed ? '<button class="cs-btn alt sm" data-unlist>Remove listing</button>' : '<input type="number" min="1" id="lp" placeholder="price" style="width:100px"><button class="cs-btn alt sm" data-list>List on market</button>') : ''}</div></div>`;
    document.body.appendChild(m);
    const v = viewer($('canvas', m), it); if (!v) drawItem($('canvas', m), it);
    const close = () => { if (v) v.stop(); m.remove(); };
    // 3D model or collector's card
    m.querySelectorAll('[data-vw]').forEach((b) => (b.onclick = () => {
      const card = b.dataset.vw === 'card';
      m.querySelectorAll('[data-vw]').forEach((x) => x.classList.toggle('alt', x !== b));
      $('canvas', m).style.display = card ? 'none' : ''; $('[data-card]', m).style.display = card ? '' : 'none'; $('[data-png]', m).style.display = card ? '' : 'none';
      const hint = $('canvas', m).nextElementSibling; if (hint) hint.style.display = card ? 'none' : '';
      if (card && !$('[data-card]', m).firstChild) cardInto($('[data-card]', m), it);
    }));
    const mb = $('[data-mint]', m); if (mb) mb.onclick = async () => {
      if (!P.wallet) { this.h.toast('Create your wallet first: Profile > Wallet'); return; }
      if (!confirm(`Mint ${info.label} as an NFT to your wallet? It stays yours to equip, but from then on it trades on-chain, not in the game market.`)) return;
      try {
        const c = await cardImage(it); if (!c) throw new Error('Could not draw the card');
        await P.uploadCard(uid, await new Promise((res) => c.toBlob(res, 'image/png')));
        const r = await P.mintNft(uid); this.h.toast('NFT ' + (r.status || 'queued') + ': it lands in your wallet shortly'); close(); this.render();
      } catch (e) { this.h.toast(e.message); }
    };
    $('[data-png]', m).onclick = async () => { const c = await cardImage(it); if (!c) return; const a = document.createElement('a'); a.download = info.label.replace(/[^\w-]+/g, '_') + '.png'; a.href = c.toDataURL('image/png'); a.click(); };
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
      <canvas width="420" height="420" class="cs-view" style="width:min(420px,100%);height:min(420px,52vh);display:block;margin:10px auto;border-radius:10px"></canvas>
      <div class="cs-mut cs-small">In a match press <b>T</b>, then 1-4. Everyone sees it; your camera pulls back while it plays.</div>
      <div class="cs-row" style="margin-top:10px">${[0, 1, 2, 3].map((k) => `<button class="cs-btn sm ${w[k] === info.weapon ? '' : 'alt'}" data-slot="${k}">Wheel ${k + 1}: ${esc((EMOTE_BY_ID[w[k]] || {}).name || 'empty')}</button>`).join('')}</div>
      <div class="cs-row" style="margin-top:8px"><button class="cs-btn alt sm" data-sell>Sell (${Math.round(info.value * 0.8)} coins)</button></div></div>`;
    document.body.appendChild(m);
    const lo = P.loadoutFor('T'), perf = AGENT_BY_ID[lo.agent] || AGENT_BY_ID.a_t_default;   // performed by your own outfit
    const v = viewer($('canvas', m), it, { performer: { look: perf.look, team: perf.team } }); if (!v) drawItem($('canvas', m), it);
    const rm0 = m.remove.bind(m); m.remove = () => { if (v) v.stop(); rm0(); };
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
    const list = CRATES.filter((c) => !c.hidden);
    B.innerHTML = `<div class="cs-row"><div class="cs-sec" style="margin:0">${list.length} cases</div><span style="flex:1"></span><span class="cs-mut cs-small">Opened with coins you earn by playing · odds shown on every case · no real money, ever</span></div>
      <div class="cs-tiles" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr));margin-top:12px">${list.map((c) => `<div class="cs-case" data-see="${c.id}"><canvas width="300" height="150"></canvas><b>${esc(c.name)}</b><span>🪙 ${c.price}</span></div>`).join('')}</div>`;
    B.querySelectorAll('[data-see]').forEach((e) => { drawCase($('canvas', e), CRATES.find((c) => c.id === e.dataset.see)); e.onclick = () => this.contents(e.dataset.see); });
  }
  contents(id) {
    const c = CRATES.find((x) => x.id === id), m = document.createElement('div'); m.className = 'cs cs-modal';
    const fake = c.items.slice().sort((a, b) => b.tier - a.tier).map((d, k) => ({ uid: 'c' + k, def: d.id, float: 0.06, seed: 7, st: false }));
    m.innerHTML = `<div class="cs-card" style="width:min(1040px,96vw);padding:0"><div class="cs-row" style="padding:14px 18px;border-bottom:1px solid #2e343d"><b style="font-size:18px;letter-spacing:.04em">${esc(c.name)}</b><span class="cs-mut cs-small">${esc(c.desc)}</span><span style="flex:1"></span><button class="cs-btn alt sm" data-x>✕</button></div>
      <div style="display:grid;grid-template-columns:240px 1fr;gap:18px;padding:18px"><div><canvas width="300" height="150" style="width:100%"></canvas>
        <div style="margin:10px 0">${crateOdds(c).map((o) => `<div class="cs-row cs-small" style="margin:3px 0"><i style="width:10px;height:10px;border-radius:2px;background:${o.color};display:inline-block"></i>${esc(o.name)}<span style="flex:1"></span>${o.pct < 1 ? o.pct.toFixed(2) : o.pct.toFixed(1)}%</div>`).join('')}</div>
        <button class="cs-go" style="width:100%;justify-content:center;font-size:16px;padding:12px" data-open>UNLOCK · 🪙 ${c.price}</button><div class="cs-small cs-mut" style="margin-top:8px">You have 🪙 ${this.P.d.coins.toLocaleString()}</div></div>
      <div style="max-height:62vh;overflow:auto"><div class="cs-tiles">${fake.map((i) => itemCard(i)).join('')}</div></div></div></div>`;
    document.body.appendChild(m); paintAll(m, fake); drawCase($('canvas', m), c);
    $('[data-x]', m).onclick = () => m.remove(); m.onclick = (e) => { if (e.target === m) m.remove(); };
    $('[data-open]', m).onclick = () => { m.remove(); this.openCrate(id); };
  }
  async openCrate(id) {
    const c = CRATES.find((x) => x.id === id);
    let item; try { item = await this.P.openCrate(id); } catch (e) { this.h.toast(e.message); return; }
    const m = document.createElement('div'); m.className = 'cs cs-modal';
    const N = 48, WIN = 40, filler = [];
    for (let k = 0; k < N; k++) { const pool = c.items.filter((i) => i.tier === (Math.random() < 0.8 ? Math.min(...c.items.map((x) => x.tier)) : c.items[Math.floor(Math.random() * c.items.length)].tier)); const d = pool[Math.floor(Math.random() * pool.length)] || c.items[0]; filler.push({ uid: 'f' + k, def: d.id, float: Math.random(), seed: k, st: false }); }
    filler[WIN] = item;
    m.innerHTML = `<div class="cs-card" style="width:min(760px,96vw)"><b>${esc(c.name)}</b><div class="cs-reel" style="margin-top:10px"><div class="strip">${filler.map((it) => { const inf = itemInfo(it); return `<div class="cell" style="border-color:${inf.rarity.color};background:radial-gradient(ellipse at 50% 45%,${inf.rarity.color}40,transparent 70%),#1d2128"><canvas width="260" height="160" data-draw="${esc(it.uid)}"></canvas><div>${esc(inf.wpn)}</div><div class="cs-mut">${esc(inf.finish)}</div></div>`; }).join('')}</div><div class="mark"></div></div>
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
      else { const inf = itemInfo(item); this.h.sound(inf.rarity.key === 'mythic' || inf.rarity.key === 'funny' || inf.rarity.key === 'legendary' || inf.rarity.key === 'epic' ? 'rare' : 'reveal');
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
    let m; try { m = await P.market(); } catch (e) { B.innerHTML = `<div class="cs-mut">Market unavailable: ${esc(e.message)}</div>`; return; }
    const meId = P.sess && P.sess.user && P.sess.user.id;
    const players = (m.players || []).map((l) => ({ uid: 'L' + l.id, def: l.def, float: l.float, seed: l.seed, st: l.st, lid: l.id, price: l.price, seller: l.seller_name, mine: l.seller === meId })).filter((i) => ITEM_BY_ID[i.def]);
    const house = (m.house || []).map((l) => ({ uid: 'H' + l.id, def: l.def, float: l.float, seed: l.seed, st: l.st, hid: l.id, price: l.price, seller: 'The House' })).filter((i) => ITEM_BY_ID[i.def]);
    const kinds = [['all', 'All'], ['skin', 'Skins'], ['knife', 'Knives'], ['agent', 'Outfits'], ['emote', 'Emotes']], f = this.mFilter || 'all';
    const pass = (i) => f === 'all' || ITEM_BY_ID[i.def].kind === f;
    const price = (i) => ` · <b style="color:#7ed957">🪙 ${i.price.toLocaleString()}</b>`;
    B.innerHTML = `${poolCard(m.pool)}
      <div class="cs-row" style="margin:14px 0 8px">${kinds.map(([k, n]) => `<button class="cs-btn sm ${k === f ? '' : 'alt'}" data-mf="${k}">${n}</button>`).join('')}</div>
      <div class="cs-sec">From players · ${players.filter(pass).length}</div>
      <div class="cs-mut cs-small" style="margin-bottom:8px">Prices set by players. 5% of each sale goes into today's prize pool.</div>
      <div class="cs-grid">${players.filter(pass).map((i) => itemCard(i, price(i) + (i.mine ? ' · <span class="cs-mut">yours</span>' : ''))).join('') || '<div class="cs-mut">Nothing listed by players right now: list something from your inventory.</div>'}</div>
      <div class="cs-sec" style="margin-top:18px">The House · ${house.filter(pass).length}</div>
      <div class="cs-mut cs-small" style="margin-bottom:8px">Always stocked, restocked every half hour. Priced by rarity, wear, how rare it is among players and how much it has been selling. Everything you spend here goes into today's prize pool.</div>
      <div class="cs-grid">${house.filter(pass).map((i) => itemCard(i, price(i))).join('')}</div>`;
    paintAll(B, players.concat(house));
    B.querySelectorAll('[data-mf]').forEach((b) => (b.onclick = () => { this.mFilter = b.dataset.mf; this.render(); }));
    B.querySelectorAll('[data-uid]').forEach((e) => (e.onclick = async () => {
      const it = players.find((x) => x.uid === e.dataset.uid) || house.find((x) => x.uid === e.dataset.uid); if (!it) return;
      if (it.mine) return this.h.toast('That one is yours (remove it from your inventory screen).');
      if (!confirm(`Buy ${itemInfo(it).label} from ${it.seller || 'a player'} for ${it.price.toLocaleString()} coins?`)) return;
      try { if (it.hid) await P.houseBuy(it.hid); else await P.buyListing(it.lid); this.h.toast('Bought!'); this.h.sound('reveal'); } catch (err) { this.h.toast(err.message); }
      this.render();
    }));
  }
  // ---- FRIENDS: add by Name#1234, accept, trade items and coins, send coins ----
  async tab_friends(B) {
    const P = this.P;
    if (!P.signedIn) { B.innerHTML = `<div class="cs-panel2"><h3>Friends</h3><div class="bd">Friends, trading and sending coins need an account. <button class="cs-btn sm" id="fGo">Sign in</button></div></div>`; $('#fGo', B).onclick = () => { this.tab = 'profile'; this.render(); }; return; }
    B.innerHTML = '<div class="cs-mut">Loading friends…</div>';
    let list = [], trades = [];
    try { [list, trades] = await Promise.all([P.friends(), P.trades()]); } catch (e) { B.innerHTML = `<div class="cs-mut">${esc(e.message)}</div>`; return; }
    const tile = (it) => itemCard({ ...it, uid: 'x' + it.uid });
    B.innerHTML = `<div style="display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:20px">
      <div><div class="cs-panel2"><h3>Add a friend</h3><div class="bd"><div class="cs-row"><input id="fAdd" placeholder="Username (or Name#1234)" style="flex:1"><button class="cs-btn" id="fAddGo">Add</button></div>
        <div class="cs-small cs-mut" style="margin-top:6px">You are <b style="color:#fff">${P.username ? '@' + esc(P.username) : esc(P.d.name || 'Player') + '#' + esc(P.tag || '')}</b>${P.username ? '' : ' · pick a username in Profile so friends can find you'}</div></div></div>
        <div class="cs-panel2"><h3>Friends (${list.filter((f) => f.state === 'accepted').length})</h3><div class="bd" id="fList">${list.map((f) => `<div class="cs-row" style="margin-bottom:8px"><div style="flex:1;min-width:0"><b>${esc(f.name)}</b><span class="cs-mut">${f.username ? ' @' + esc(f.username) : '#' + esc(f.tag)}</span><div class="cs-small cs-mut">${f.state === 'accepted' ? 'friend' : f.incoming ? 'wants to be friends' : 'request sent'}</div></div>
          ${f.state === 'accepted' ? `<button class="cs-btn sm" data-trade="${esc(f.id)}">Trade</button><button class="cs-btn alt sm" data-gift="${esc(f.id)}">Send coins</button>` : f.incoming ? `<button class="cs-btn sm" data-acc="${esc(f.id)}">Accept</button>` : ''}<button class="cs-btn alt sm" data-rm="${esc(f.id)}">✕</button></div>`).join('') || '<span class="cs-mut cs-small">No friends yet.</span>'}</div></div></div>
      <div><div class="cs-panel2"><h3>Open trades</h3><div class="bd">${trades.map((t) => `<div style="border-bottom:1px solid #2e343d;padding-bottom:10px;margin-bottom:10px"><div class="cs-row"><b>${t.mine ? 'You → ' + esc(t.to_name) : esc(t.from_name) + ' → you'}</b><span style="flex:1"></span>
          ${t.mine ? `<button class="cs-btn alt sm" data-tr="${t.id}" data-ok="0">Cancel</button>` : `<button class="cs-btn sm" data-tr="${t.id}" data-ok="1">Accept</button><button class="cs-btn alt sm" data-tr="${t.id}" data-ok="0">Decline</button>`}</div>
          <div class="cs-small cs-mut" style="margin:6px 0">${t.mine ? 'You give' : 'They give'}: ${t.give_coins ? '🪙 ' + t.give_coins : ''}</div><div class="cs-tiles">${t.give.map(tile).join('')}</div>
          <div class="cs-small cs-mut" style="margin:6px 0">${t.mine ? 'You get' : 'You give'}: ${t.want_coins ? '🪙 ' + t.want_coins : ''}</div><div class="cs-tiles">${t.want.map(tile).join('')}</div></div>`).join('') || '<span class="cs-mut cs-small">No open trades.</span>'}</div></div></div></div>`;
    paintAll(B, trades.flatMap((t) => [...t.give, ...t.want]).map((it) => ({ ...it, uid: 'x' + it.uid })));
    const act = async (fn, ok) => { try { const r = await fn(); this.h.toast(typeof r === 'string' ? r : ok); } catch (e) { this.h.toast(e.message); } this.render(); };
    $('#fAddGo', B).onclick = () => act(() => P.addFriend($('#fAdd', B).value.trim()), 'Request sent');
    B.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => act(() => P.acceptFriend(b.dataset.acc), 'Friends!')));
    B.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { if (confirm('Remove this friend?')) act(() => P.removeFriend(b.dataset.rm), 'Removed'); }));
    B.querySelectorAll('[data-gift]').forEach((b) => (b.onclick = () => { const n = +prompt('How many coins to send?', '100'); if (n > 0) act(() => P.giftCoins(b.dataset.gift, n), 'Sent'); }));
    B.querySelectorAll('[data-tr]').forEach((b) => (b.onclick = () => act(() => P.respondTrade(+b.dataset.tr, b.dataset.ok === '1'), 'Done')));
    B.querySelectorAll('[data-trade]').forEach((b) => (b.onclick = () => this.tradeWindow(list.find((f) => f.id === b.dataset.trade))));
  }
  async tradeWindow(friend) {
    const P = this.P; let theirs = [];
    try { theirs = await P.friendItems(friend.id); } catch (e) { this.h.toast(e.message); return; }
    const mine = P.d.inventory.filter((i) => !i.listed && ITEM_BY_ID[i.def] && ITEM_BY_ID[i.def].kind !== 'emote' || (!i.listed && ITEM_BY_ID[i.def]));
    const give = new Set(), want = new Set();
    const m = document.createElement('div'); m.className = 'cs cs-modal';
    const draw = () => {
      m.innerHTML = `<div class="cs-card" style="width:min(1100px,96vw);padding:0"><div class="cs-row" style="padding:14px 18px;border-bottom:1px solid #2e343d"><b style="font-size:17px">Trade with ${esc(friend.name)}#${esc(friend.tag)}</b><span style="flex:1"></span><button class="cs-btn alt sm" data-x>✕</button></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px"><div><div class="cs-sec" style="margin-top:0">You give (${give.size}) · coins <input id="gc" type="number" min="0" value="${m.gc || 0}" style="width:110px"></div><div class="cs-tiles" style="max-height:52vh;overflow:auto">${mine.map((i) => itemCard(i, '', give.has(i.uid) ? 'GIVING' : '')).join('')}</div></div>
          <div><div class="cs-sec" style="margin-top:0">You get (${want.size}) · coins <input id="wc" type="number" min="0" value="${m.wc || 0}" style="width:110px"></div><div class="cs-tiles" style="max-height:52vh;overflow:auto">${theirs.map((i) => itemCard({ ...i, uid: 't' + i.uid }, '', want.has(i.uid) ? 'WANT' : '')).join('') || '<span class="cs-mut cs-small">They have no tradable items.</span>'}</div></div></div>
        <div class="cs-row" style="padding:0 16px 16px"><span class="cs-mut cs-small">Both sides are checked again on the server when they accept.</span><span style="flex:1"></span><button class="cs-go" data-send style="padding:10px 26px;font-size:15px">SEND OFFER</button></div></div>`;
      paintAll(m, [...mine, ...theirs.map((i) => ({ ...i, uid: 't' + i.uid }))]);
      $('[data-x]', m).onclick = () => m.remove();
      $('#gc', m).oninput = (e) => (m.gc = +e.target.value); $('#wc', m).oninput = (e) => (m.wc = +e.target.value);
      m.querySelectorAll('[data-uid]').forEach((t) => (t.onclick = () => { const u = t.dataset.uid; if (u.startsWith('t')) { const r = u.slice(1); want.has(r) ? want.delete(r) : want.add(r); } else give.has(u) ? give.delete(u) : give.add(u); draw(); }));
      $('[data-send]', m).onclick = async () => { try { await P.offerTrade(friend.id, [...give], m.gc || 0, [...want], m.wc || 0); this.h.toast('Offer sent'); m.remove(); this.render(); } catch (e) { this.h.toast(e.message); } };
    };
    document.body.appendChild(m); draw();
  }
  // ---- ADMIN (only accounts the owner put in cs_admins; the server re-checks every call) ----
  async tab_admin(B) {
    const P = this.P; if (!P.admin) { B.innerHTML = ''; return; }
    const defs = Object.values(ITEM_BY_ID).filter((d) => d.kind !== 'emote' || true).sort((a, b) => b.tier - a.tier);
    const nc = P.nftcfg || { rpc: '', trees: [], canopy: 0, on: false };
    setTimeout(() => { const x = document.createElement('div'); x.className = 'cs-panel2'; x.style.marginTop = '14px';
      x.innerHTML = `<h3>NFT minting</h3><div class="bd"><div class="cs-small cs-mut">Compressed NFTs on Solana. The minter runs on STUMF (switched off there too until you fund it). RPC: a DAS-capable URL (a free Helius key works). Trees: the Merkle tree address(es) the minter created.</div>
        <div class="cs-row" style="margin-top:8px"><input id="nRpc" placeholder="RPC URL" style="flex:1" value="${esc(nc.rpc)}"></div>
        <div class="cs-row" style="margin-top:6px"><input id="nTrees" placeholder="Tree addresses, comma separated" style="flex:1" value="${esc((nc.trees || []).join(','))}"><input id="nCan" type="number" min="0" max="17" style="width:90px" value="${nc.canopy | 0}" title="canopy depth"></div>
        <div class="cs-row" style="margin-top:6px"><label class="cs-small"><input type="checkbox" id="nOn" ${nc.on ? 'checked' : ''}> Minting open to players</label><span style="flex:1"></span><button class="cs-btn sm" id="nSave">Save</button></div></div>`;
      B.appendChild(x);
      $('#nSave', x).onclick = async () => { try { await P.adminNftCfg({ rpc: $('#nRpc', x).value.trim(), trees: $('#nTrees', x).value.split(',').map((t) => t.trim()).filter(Boolean), canopy: +$('#nCan', x).value || 0, on: $('#nOn', x).checked }); await P.sync(); this.h.toast('Saved'); } catch (e) { this.h.toast(e.message); } };
    }, 0);
    B.innerHTML = `<div class="cs-panel2"><h3>Admin · give coins and items</h3><div class="bd">
      <div class="cs-row"><input id="aQ" placeholder="Search players by name" style="flex:1"><button class="cs-btn" id="aFind">Search</button></div><div id="aRes" style="margin-top:10px"></div>
      <div class="cs-row" style="margin-top:12px"><input id="aCoins" type="number" placeholder="Coins (+/-)" style="width:160px"><select id="aDef" style="flex:1"><option value="">(no item)</option>${defs.map((d) => `<option value="${esc(d.id)}">[${esc(RARITY[d.tier].name)}] ${esc(itemInfo({ def: d.id, float: 0, seed: 0 }).label)}</option>`).join('')}</select><input id="aN" type="number" value="1" min="1" max="100" style="width:80px"></div>
      <div class="cs-small cs-mut" style="margin-top:6px">Pick a player above, then Give. Every grant is logged on the server.</div>
      <div class="cs-row" style="margin-top:14px"><button class="cs-btn alt" id="aAll">Reset my inventory to one of everything</button></div></div></div>`;
    $('#aAll', B).onclick = async () => { if (!confirm('Delete everything in YOUR inventory and replace it with one of every item?')) return; try { const n = await P.adminCollection(); this.h.toast(`Inventory reset: ${n} items`); } catch (e) { this.h.toast(e.message); } };
    let target = null;
    $('#aFind', B).onclick = async () => {
      try { const list = await P.adminFind($('#aQ', B).value.trim()); const R = $('#aRes', B); R.innerHTML = '';
        for (const u of list) { const r = document.createElement('div'); r.className = 'cs-row'; r.style.margin = '4px 0'; r.innerHTML = '<span class="n" style="flex:1"></span><span class="cs-coin c"></span><button class="cs-btn sm">Give</button>';
          $('.n', r).textContent = `${u.name}#${u.tag} · level ${Math.floor(Math.sqrt(u.xp / 100)) + 1}`; $('.c', r).textContent = '🪙 ' + Number(u.coins).toLocaleString();
          $('button', r).onclick = async () => { target = u; try { const g = await P.adminGrant(u.id, +$('#aCoins', B).value || 0, $('#aDef', B).value, +$('#aN', B).value || 1); this.h.toast(`${u.name} now has 🪙 ${Number(g.coins).toLocaleString()}`); if (u.id === (P.sess && P.sess.user && P.sess.user.id)) P.sync(); $('#aFind', B).click(); } catch (e) { this.h.toast(e.message); } };
          R.appendChild(r); } } catch (e) { this.h.toast(e.message); }
    };
    $('#aFind', B).click();
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
  // ---- GUNSMITH: gun levels and attachments ----
  tab_guns(B) {
    const P = this.P, list = WEAPONS.filter((w) => slotsFor(w.id).length);
    const sel = W_BY_ID[this.gunSel] && slotsFor(this.gunSel).length ? this.gunSel : 'ak47';
    const lvlOf = (wid) => gunLevel(P.gun(wid).xp);
    const bar = (wid) => { const xp = P.gun(wid).xp, l = gunLevel(xp); if (l >= GUN_MAX) return 100; const a = xpForLevel(l), b = xpForLevel(l + 1); return Math.round((xp - a) / (b - a) * 100); };
    const cats = [['rifle', 'Rifles'], ['sniper', 'Snipers'], ['smg', 'SMGs'], ['heavy', 'Heavy'], ['pistol', 'Pistols']];
    const g = P.gun(sel), L = lvlOf(sel), slotName = { optic: 'Optic', muzzle: 'Muzzle', reticle: 'Scope reticle' };
    B.innerHTML = `<div style="display:grid;grid-template-columns:minmax(220px,300px) 1fr;gap:14px">
      <div class="cs-panel2" style="max-height:70vh;overflow:auto"><div class="bd">${cats.map(([c, n]) => `<div class="cs-h" style="margin-top:6px">${n}</div>` + list.filter((w) => w.cat === c).map((w) => `
        <div class="cs-card" data-gun="${w.id}" style="margin-bottom:6px;cursor:pointer;${w.id === sel ? 'outline:2px solid var(--acc,#e8a33a)' : ''}"><div class="cs-row"><img src="${weaponIcon(w.id)}" style="height:18px;opacity:.9"><b class="cs-small">${esc(w.name)}</b><span style="flex:1"></span><span class="cs-small">${lvlOf(w.id) >= GUN_MAX ? '★ ' : ''}Lv ${lvlOf(w.id)}</span></div>
        <div class="cs-bar" style="margin-top:6px"><i style="width:${bar(w.id)}%"></i></div></div>`).join('')).join('')}</div></div>
      <div class="cs-panel2"><div class="bd">
        <div class="cs-row"><img src="${weaponIcon(sel)}" style="height:42px"><div><h2 style="margin:0">${esc(W_BY_ID[sel].name)}</h2>
        <div class="cs-mut">Level ${L}${L >= GUN_MAX ? ' · <b style="color:#ffd23a">★ PRESTIGE</b>' : ` · ${g.xp} / ${xpForLevel(L + 1)} XP to level ${L + 1}`}</div></div></div>
        ${slotsFor(sel).map((slot) => `<div class="cs-h" style="margin-top:14px">${slotName[slot]}</div><div class="cs-row" style="flex-wrap:wrap;gap:8px">${optionsFor(sel, slot).map((o) => {
          const locked = L < o.lvl, on = g.att[slot] === o.id;
          return `<button class="cs-btn ${on ? '' : 'alt'} sm" data-att="${slot}:${o.id}" ${locked ? 'disabled' : ''} title="${locked ? 'Unlocks at level ' + o.lvl : ''}">${esc(o.name)}${locked ? ` <span class="cs-mut">· Lv ${o.lvl}</span>` : ''}</button>`;
        }).join('')}</div>`).join('')}
        <div class="cs-small cs-mut" style="margin-top:16px;line-height:1.5">Level a gun by playing with it: every point of damage, every kill (headshots more) and every round won while holding it.
          Attachments never change how a gun performs: an optic lets you <b>hold right click to aim down sights</b> (bullets go where the dot is; recoil moves your view, so pull down), muzzles are looks only,
          and the <b>Level 10 suppressor</b> only makes the gun quieter. Snipers choose their scope's reticle.</div>
      </div></div></div>`;
    B.querySelectorAll('[data-gun]').forEach((e) => (e.onclick = () => { this.gunSel = e.dataset.gun; this.h.sound('tick'); this.render(); }));
    B.querySelectorAll('[data-att]').forEach((e) => (e.onclick = async () => { const [slot, id] = e.dataset.att.split(':'); try { await P.gunEquip(sel, slot, id); this.h.sound('buy'); } catch (err) { this.h.toast(err.message); } this.render(); }));
  }
  // ---- PROFILE ----
  // ---- the player's Solana wallet (for item NFTs): created here, PIN-locked, export to Phantom / Jupiter ----
  async walletPanel(W) {
    const P = this.P, cfg = P.nftcfg || {}, short = (a) => a.slice(0, 4) + '…' + a.slice(-4);
    const head = '<div class="cs-row"><b style="font-size:16px">◎ Wallet</b><span class="cs-chip">Solana · for your item NFTs</span></div>';
    if (!P.signedIn) { W.innerHTML = head + '<div class="cs-mut cs-small" style="margin-top:6px">Sign in to get your own wallet for item NFTs.</div>'; return; }
    if (!(await WAL.walletSupported())) { W.innerHTML = head + '<div class="cs-mut cs-small" style="margin-top:6px">This browser can\'t create a Solana wallet (it needs Ed25519). Update it, or use Chrome / Safari / Firefox.</div>'; return; }
    const pinOk = (p) => /^\d{6,12}$/.test(p);
    if (!P.wallet) {
      W.innerHTML = head + `<div class="cs-mut cs-small" style="margin:6px 0">Your wallet is made on this device and locked with a PIN only you know. Only the locked copy is saved to your account (so it works on your other devices); without the PIN nobody can use it, including us. <b>Forget the PIN and the wallet is gone</b>, so export a backup.</div>
        <div class="cs-row"><input id="wP1" type="password" inputmode="numeric" placeholder="PIN (6-12 digits)" style="width:170px"><input id="wP2" type="password" inputmode="numeric" placeholder="PIN again" style="width:150px"><button class="cs-btn" id="wNew">Create wallet</button></div>`;
      $('#wNew', W).onclick = async () => {
        const p1 = $('#wP1', W).value, p2 = $('#wP2', W).value;
        if (!pinOk(p1)) return this.h.toast('PIN: 6 to 12 digits'); if (p1 !== p2) return this.h.toast('The PINs don\'t match');
        try { const kp = await WAL.newKeypair(); await P.saveWallet(await WAL.lock(kp, p1)); this.kp = kp; this.h.toast('Wallet created'); } catch (e) { this.h.toast(e.message); }
        this.walletPanel(W);
      };
      return;
    }
    const addr = P.wallet.address, kp = this.kp && this.kp.address === addr ? this.kp : null, net = cfg.rpc ? WAL.rpc(cfg.rpc) : null;
    W.innerHTML = head + `<div class="cs-row" style="margin-top:8px"><code style="font-size:12px;word-break:break-all">${esc(addr)}</code><button class="cs-btn alt sm" id="wCopy">Copy address</button><span class="cs-small cs-mut" id="wBal"></span></div>
      ${kp ? `<div class="cs-row" style="margin-top:8px"><button class="cs-btn alt sm" id="wExp">Export key</button><button class="cs-btn alt sm" id="wLock">Lock</button></div>
        <div id="wNft" style="margin-top:10px" class="cs-small cs-mut">${net ? 'Loading your NFTs…' : 'NFTs show here once the game\'s NFT network is set up.'}</div>`
      : `<div class="cs-row" style="margin-top:8px"><input id="wPin" type="password" inputmode="numeric" placeholder="PIN" style="width:150px"><button class="cs-btn" id="wOpen">Unlock</button></div>`}`;
    $('#wCopy', W).onclick = () => { copyText(addr) ? this.h.toast('Address copied') : prompt('Your address', addr); };
    if (net) net.balance(addr).then((b) => { const el = $('#wBal', W); if (el) el.textContent = b.toFixed(4) + ' SOL'; }).catch(() => {});
    if (!kp) { $('#wOpen', W).onclick = async () => { try { this.kp = await WAL.unlock(P.wallet.box, $('#wPin', W).value); } catch (e) { return this.h.toast(e.message); } this.walletPanel(W); }; return; }
    $('#wLock', W).onclick = () => { this.kp = null; this.walletPanel(W); };
    $('#wExp', W).onclick = async () => {
      const pin = prompt('Export your private key\n\nAnyone with this key owns everything in the wallet. Never share it or paste it into a website. In Phantom or Jupiter: Add / Import wallet > Import private key.\n\nEnter your PIN to show it:'); if (!pin) return;
      let k; try { k = await WAL.unlock(P.wallet.box, pin); } catch (e) { return this.h.toast(e.message); }
      const m = document.createElement('div'); m.className = 'cs cs-modal';
      m.innerHTML = `<div class="cs-card"><b>Private key (Phantom / Jupiter / Solflare format)</b><div class="cs-small" style="color:#ff8a7a;margin:6px 0">Keep it secret. Anyone with it controls this wallet.</div>
        <textarea readonly style="width:100%;height:84px;font:12px monospace">${esc(WAL.exportKey(k))}</textarea><div class="cs-row" style="margin-top:8px"><button class="cs-btn sm" data-c>Copy</button><button class="cs-btn alt sm" data-x>Done</button></div></div>`;
      document.body.appendChild(m);
      $('[data-c]', m).onclick = () => { const t = $('textarea', m); t.select(); if (document.execCommand('copy')) this.h.toast('Copied: paste it straight into your wallet app'); };
      $('[data-x]', m).onclick = () => m.remove();
    };
    if (!net) return;
    let list = []; try { list = (await net.nfts(addr)).filter((a) => !cfg.trees || !cfg.trees.length || cfg.trees.includes(a.compression && a.compression.tree)); } catch (e) { $('#wNft', W).textContent = 'Could not load NFTs: ' + e.message; return; }
    const N = $('#wNft', W); if (!N) return;
    N.className = '';
    N.innerHTML = `<div class="cs-row"><b>${list.length} NFT${list.length === 1 ? '' : 's'}</b><span style="flex:1"></span>${list.length ? '<input id="wTo" placeholder="Send to address (Phantom, Jupiter…)" style="width:280px"><button class="cs-btn alt sm" id="wAll">Send all</button>' : ''}</div>
      ${list.map((a) => `<div class="cs-row" style="margin-top:6px"><span style="flex:1">${esc((a.content && a.content.metadata && a.content.metadata.name) || a.id)}</span><button class="cs-btn sm" data-send="${esc(a.id)}">Send</button></div>`).join('') || '<div class="cs-mut cs-small">None yet. Mint an item from its window in your inventory.</div>'}`;
    const send = async (ids) => {
      const to = ($('#wTo', W).value || '').trim(); if (!to) return this.h.toast('Paste the address to send to');
      if (!confirm(`Send ${ids.length} NFT${ids.length === 1 ? '' : 's'} to ${short(to)}? This can't be undone.`)) return;
      let ok = 0; for (const id of ids) { try { await net.sendNft(this.kp, id, to, cfg.canopy || 0); ok++; } catch (e) { this.h.toast(e.message); break; } }
      this.h.toast(`Sent ${ok} of ${ids.length}`); setTimeout(() => this.walletPanel(W), 4000);
    };
    N.querySelectorAll('[data-send]').forEach((b) => (b.onclick = () => send([b.dataset.send])));
    const all = $('#wAll', W); if (all) all.onclick = () => send(list.map((a) => a.id));
  }
  tab_profile(B) {
    const P = this.P, s = P.d.stats;
    B.innerHTML = `<div class="cs-card" style="margin-bottom:12px" id="pfAcct"></div><div class="cs-card"><div class="cs-row"><b style="font-size:20px" id="pfN"></b><span class="cs-chip cs-lvl">Level ${P.level}</span></div>
      <div class="cs-row" style="margin-top:10px"><input id="pfName" maxlength="20" placeholder="Your name"><button class="cs-btn alt sm" id="pfSave">Save name</button></div>
      <div class="cs-row" style="margin-top:8px"><input id="pfUser" maxlength="16" placeholder="Username (friends add you by this)"><button class="cs-btn alt sm" id="pfUserSave">Save username</button></div>
      <div class="cs-grid" style="margin-top:12px">${[['Matches', s.matches], ['Wins', s.wins], ['Kills', s.k], ['Deaths', s.d], ['K/D', (s.k / Math.max(1, s.d)).toFixed(2)], ['Headshot %', Math.round(s.hs / Math.max(1, s.k) * 100) + '%'], ['MVPs', s.mvp]]
        .map(([n, v]) => `<div class="cs-card"><div class="cs-mut cs-small">${n}</div><b style="font-size:20px">${v}</b></div>`).join('')}</div></div>`;
    const wl = document.createElement('div'); wl.className = 'cs-card'; wl.style.marginTop = '12px'; B.appendChild(wl); this.walletPanel(wl);
    $('#pfN', B).textContent = P.d.name || 'Player'; $('#pfName', B).value = P.d.name || ''; $('#pfUser', B).value = P.username || '';
    $('#pfUserSave', B).onclick = async () => { try { const u = await P.setUsername($('#pfUser', B).value); this.h.toast('Username saved: @' + u); } catch (e) { this.h.toast(e.message); } this.render(); };
    $('#pfSave', B).onclick = async () => { try { const n = await P.setName($('#pfName', B).value); this.h.toast('Name saved: ' + n + (P.tag ? '#' + P.tag : '')); } catch (e) { this.h.toast(e.message); } this.render(); };
    const A = $('#pfAcct', B);
    if (!P.cloud) { A.innerHTML = '<b>Local profile</b><div class="cs-mut cs-small">Your coins and items are saved in this browser. (The game owner can switch on free accounts to sync across devices and trade.)</div>'; return; }
    if (P.signedIn) { A.innerHTML = `<b>Signed in</b> <span class="cs-mut cs-small">${P.online ? 'synced' : esc(P.err || 'offline')}</span><div class="cs-row" style="margin-top:8px"><button class="cs-btn alt sm" id="aSync">Sync now</button><button class="cs-btn alt sm" id="aOut">Sign out</button></div>`;
      $('#aSync', A).onclick = async () => { await P.sync(); this.render(); }; $('#aOut', A).onclick = () => { P.signOut(); this.render(); }; return; }
    A.innerHTML = `<b>Account</b><div class="cs-mut cs-small">Sync coins and items across devices, trade on the market.</div>
      <div class="cs-row cs-acctf" style="margin-top:8px"><input id="aN" maxlength="20" placeholder="player name" value="${esc(P.d.name || '')}" autocomplete="nickname"><input id="aE" type="email" inputmode="email" autocapitalize="off" placeholder="email" autocomplete="email"><input id="aP" type="password" placeholder="password (8+)" autocomplete="current-password"></div>
      <div class="cs-row" style="margin-top:8px"><button class="cs-btn sm" id="aIn">Sign in</button><button class="cs-btn alt sm" id="aUp">Create account</button></div><div class="cs-small cs-mut" id="aMsg" style="margin-top:6px"></div>`;
    const go = async (up) => { const e = $('#aE', A).value.trim(), p = $('#aP', A).value; const msg = $('#aMsg', A);
      try { if (up) { const nm = ($('#aN', A).value || '').replace(/[<>#]/g, '').trim().slice(0, 20); if (nm.length >= 2) { P.d.name = nm; P.changed(); } const r = await P.signUp(e, p, P.d.name); msg.textContent = r.access_token ? 'Account created.' : 'STUMF just emailed you a confirmation link. Open it and you\'re signed in.'; if (r.access_token) await P.sync(); } else await P.signIn(e, p); this.render(); } catch (err) { msg.textContent = err.message; } };
    $('#aIn', A).onclick = () => go(false); $('#aUp', A).onclick = () => go(true);
  }
  // ---- SETTINGS ----
  tab_settings(B) {
    const S = this.h.settings();
    const sl = (k, n, min, max, step) => `<label class="cs-card"><div class="cs-small cs-mut">${n}: <b id="v_${k}">${S[k]}</b></div><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${S[k]}" style="width:100%"></label>`;
    B.innerHTML = `<div class="cs-h">Mouse & view</div><div class="cs-grid">${sl('sens', 'Sensitivity', 0.2, 6, 0.05)}${sl('fov', 'Field of view', 70, 110, 1)}${sl('touchSens', 'Touch look speed (phones)', 0.3, 3, 0.05)}${sl('vol', 'Volume', 0, 1, 0.05)}</div>
      <div class="cs-h">Crosshair</div><div class="cs-grid">${sl('xSize', 'Size', 1, 20, 1)}${sl('xGap', 'Gap', -4, 12, 1)}${sl('xThick', 'Thickness', 1, 6, 1)}${sl('xOutline', 'Outline', 0, 1, 0.1)}
        <label class="cs-card"><div class="cs-small cs-mut">Colour</div><input type="color" data-k="xColor" value="${S.xColor}" style="width:100%;height:34px"></label>
        <label class="cs-card"><div class="cs-small cs-mut">Style</div><select data-k="xDyn"><option value="0">Static</option><option value="1">Dynamic</option></select></label>
        <label class="cs-card"><div class="cs-small cs-mut">Centre dot</div><select data-k="xDot"><option value="0">Off</option><option value="1">On</option></select></label>
        <div class="cs-card" style="display:grid;place-items:center;min-height:90px;background:#3a4a3a"><div class="cs-xh" style="position:relative;left:auto;top:auto;width:1px;height:1px" id="xPrev"></div></div></div>
      <div class="cs-h">Graphics</div><div class="cs-grid"><label class="cs-card"><div class="cs-small cs-mut">Quality</div><select data-k="quality"><option value="0">Auto (keeps 40+ fps)</option><option value="0.5">Potato (fastest)</option><option value="0.75">Low</option><option value="1">Medium</option><option value="1.5">High</option><option value="2">Ultra (4K, gaming PCs)</option></select></label>
        <label class="cs-card"><div class="cs-small cs-mut">Show FPS</div><select data-k="fps"><option value="0">Off</option><option value="1">On</option></select></label>
        <label class="cs-card"><div class="cs-small cs-mut">Crouch key (Ctrl+W can close the tab outside fullscreen)</div><select data-k="crouchKey"><option value="ctrl">Ctrl</option><option value="c">C (radio C off)</option></select></label>
        <label class="cs-card"><div class="cs-small cs-mut">Announcer voice</div><select data-k="voice"><option value="1">On</option><option value="0">Off</option></select></label>
        <label class="cs-card"><div class="cs-small cs-mut">Announcer</div><select data-k="voicePack">${Object.entries(VOICE_PACKS).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('')}</select> <button class="cs-btn alt sm" id="vTry" style="margin-top:6px">Hear it</button></label>
        <label class="cs-card"><div class="cs-small cs-mut">Gun hand</div><select data-k="hand"><option value="1">Right</option><option value="-1">Left</option></select></label>${this.P.admin ? '<label class="cs-card"><div class="cs-small cs-mut">Recoil help (admin only · same as phones)</div><select data-k="recoilHelp"><option value="0">Off</option><option value="1">On</option></select></label>' : ''}</div>
      <div class="cs-h">Keys</div><div class="cs-card cs-small cs-mut">WASD move · Shift sprint · Ctrl (or C) crouch · Z prone · Space jump · Mouse1 fire · Mouse2 scope / aim down sights (hold) · Q / E lean while aiming · R reload · E use / plant / defuse / pick up · G drop · B buy menu · 1-5 weapons · Q last weapon · Tab scoreboard · Y chat · U team chat · V X C radio · T emotes · F inspect · Esc menu</div>`;
    B.querySelectorAll('[data-k]').forEach((e) => { if (e.tagName === 'SELECT') e.value = String(S[e.dataset.k]); e.oninput = e.onchange = () => { const k = e.dataset.k; S[k] = e.type === 'color' || k === 'crouchKey' || k === 'voicePack' ? e.value : +e.value; const v = $('#v_' + k, B); if (v) v.textContent = S[k]; this.h.saveSettings(S); drawXh($('#xPrev', B), S, 0); }; });
    drawXh($('#xPrev', B), S, 0);
    $('#vTry', B).onclick = (e) => { e.preventDefault(); this.h.announce('planted'); };
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
    this.ads = document.createElement('div'); this.ads.className = 'cs-ads'; document.body.appendChild(this.ads);
    this.flash = document.createElement('div'); this.flash.className = 'cs-flash'; document.body.appendChild(this.flash);
    this.hurtEl = document.createElement('div'); this.hurtEl.className = 'cs-hurt'; document.body.appendChild(this.hurtEl);
    this.radar = $('canvas.radar', this.el); this.rg = this.radar.getContext('2d');
    this.q = (s) => $(s, this.el);
    this.last = {};
  }
  destroy() { for (const e of [this.el, this.scope, this.ads, this.flash, this.hurtEl, this.panel, this.radioEl, this.chatIn]) if (e) e.remove(); }
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
  setScope(on, ret = 'duplex') {
    this.scope.style.display = on ? 'block' : 'none';
    if (on && this.scopeRet !== ret) { this.scopeRet = ret; this.scope.className = 'cs-scope ret'; this.scope.innerHTML = RETICLES[ret] || RETICLES.duplex; }
  }
  // aiming down sights through an optic: the reticle sits at screen centre (the sight line is the view line)
  setAds(kind) {
    if (this.adsKind === kind) return; this.adsKind = kind;
    this.ads.style.display = kind ? 'block' : 'none'; this.ads.innerHTML = kind ? (ADS_RET[kind] || '') : ''; this.ads.className = 'cs-ads ' + (kind || '');
  }
  feed(e, mineId) {
    const box = this.q('.feed'), row = document.createElement('div'); row.className = 'kf' + (e.kid === mineId || e.vid === mineId ? ' mine' : '');
    const n = (t, team) => { const s = document.createElement('span'); s.textContent = t; s.style.color = team === 'CT' ? 'var(--ct)' : 'var(--tt)'; return s; };
    if (e.killer) row.appendChild(n(e.killer, e.kteam));
    if (e.assist) { const a = document.createElement('span'); a.textContent = '+ ' + e.assist; a.style.opacity = .8; row.appendChild(a); }
    const w = document.createElement('img'); w.className = 'wpn'; w.src = weaponIcon(W_BY_ID[e.weapon] || G_BY_ID[e.weapon] ? e.weapon : 'bomb'); w.title = itemName(e.weapon) || e.weapon; w.style.cssText = 'height:16px;padding:0 4px;opacity:.95'; row.appendChild(w);
    for (const [on, t] of [[e.wallbang, '⟂'], [e.head, '☠']]) if (on) { const x = document.createElement('span'); x.textContent = t; x.style.color = '#fff'; row.appendChild(x); }
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
      ${h.admin ? `<button class="cs-btn alt" data-rh>RECOIL HELP: ${h.S.recoilHelp ? 'ON' : 'OFF'}</button>` : ''}
      <button class="cs-btn alt" data-q>LEAVE MATCH</button></div>`;
    document.body.appendChild(p);
    $('[data-r]', p).onclick = h.resume; $('[data-q]', p).onclick = h.quit;
    const inv = $('[data-inv]', p); if (inv) inv.onclick = () => { const t = document.createElement('textarea'); t.value = h.invite; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* old browsers */ } t.remove(); inv.textContent = 'COPIED: ' + h.code; };
    $('[data-sens]', p).oninput = (e) => h.setSens(+e.target.value);
    const rh = $('[data-rh]', p); if (rh) rh.onclick = () => { h.setRecoilHelp(!h.S.recoilHelp); rh.textContent = 'RECOIL HELP: ' + (h.S.recoilHelp ? 'ON' : 'OFF'); };
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
