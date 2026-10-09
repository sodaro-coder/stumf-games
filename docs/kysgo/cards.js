// Trading cards: every item can be viewed as a graded collector's card (and that card is what an NFT of the item
// shows). The grade works like a slab-grading company's, under the game's own "KSA" (KYS Slab Authority) label:
// below Epic is ungraded, Epic 8-9, Legendary 9 (rarely 10), Funny and Mythic always 10. The card shows the item's 3D
// render, name, rarity, wear, the date its current owner got it and which owner they are, all inside an animated
// outline in the rarity's colour (brighter and faster for higher grades).
import { itemInfo, RARITY } from './skins.js';
import { thumb } from './thumbs.js';

export const GRADE_NAME = { 10: 'GEM MINT', 9: 'MINT', 8: 'NM-MT' };
// a stable 32-bit hash of the item's id: the certificate number, and the offline grade roll
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// the grade: the server's when the item lives in an account, else the same rules rolled from the item's id
export function gradeOf(item, info = itemInfo(item)) {
  if (!info) return null;
  if (item.grade != null) return item.grade;
  const t = info.tier, r = (hash(String(item.uid || item.def)) % 1000) / 1000;
  return t === 3 ? (r < 0.7 ? 8 : 9) : t === 4 ? (r < 0.12 ? 10 : 9) : t >= 5 ? 10 : null;
}
export const certOf = (item) => String(hash('cert:' + (item.uid || item.def)) % 100000000).padStart(8, '0');
const day = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'unknown');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// the card styles, added once: the outline is a rotating conic gradient behind the card, masked to a ring
let styled = false;
function style() {
  if (styled) return; styled = true;
  const css = document.createElement('style');
  css.textContent = `@property --cs-a{syntax:'<angle>';inherits:false;initial-value:0deg}
  .cs-tc{position:relative;width:min(300px,78vw);aspect-ratio:5/7;border-radius:16px;padding:5px;margin:0 auto;isolation:isolate;
    background:conic-gradient(from var(--cs-a),var(--c1),var(--c2),var(--c1),var(--c3),var(--c1));animation:cs-spin var(--sp,6s) linear infinite;box-shadow:0 0 var(--glow,12px) var(--c1)}
  @keyframes cs-spin{to{--cs-a:360deg}}
  .cs-tc.pulse{animation:cs-spin var(--sp,6s) linear infinite,cs-pulse 1.6s ease-in-out infinite}
  @keyframes cs-pulse{50%{box-shadow:0 0 calc(var(--glow,12px)*2.2) var(--c2)}}
  .cs-tc .in{height:100%;border-radius:12px;background:linear-gradient(160deg,#20252e,#0f1217 60%,#191d24);display:flex;flex-direction:column;overflow:hidden;color:#e8ecf2;font-family:system-ui,sans-serif}
  .cs-tc .slab{margin:8px 8px 0;border-radius:6px;background:linear-gradient(180deg,#f4f4f2,#d9dcdf);color:#111;display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:6px 8px;font-size:10px;line-height:1.25}
  .cs-tc .slab b{font-size:11px}.cs-tc .slab .g{grid-row:1/4;grid-column:2;text-align:center;align-self:center;border-left:2px solid var(--c1);padding-left:8px}
  .cs-tc .slab .g i{display:block;font-style:normal;font-weight:900;font-size:26px;line-height:1;color:var(--c1);text-shadow:0 0 1px #000}
  .cs-tc .slab .g s{text-decoration:none;font-size:8px;font-weight:800;letter-spacing:.06em}
  .cs-tc .art{flex:1;margin:8px;border-radius:8px;background:radial-gradient(ellipse at 50% 40%,color-mix(in srgb,var(--c1) 35%,#2a313c),#0d1015 75%);display:grid;place-items:center;overflow:hidden;position:relative}
  .cs-tc .art img{max-width:94%;max-height:94%;filter:drop-shadow(0 6px 10px #000a)}
  .cs-tc .art .holo{position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,#ffffff22 45%,transparent 60%);background-size:250% 100%;animation:cs-holo 4s ease-in-out infinite;mix-blend-mode:screen}
  @keyframes cs-holo{0%,100%{background-position:100% 0}50%{background-position:0 0}}
  .cs-tc .nm{margin:0 10px;font-weight:900;font-size:15px;line-height:1.15}.cs-tc .nm span{display:block;font-size:11px;font-weight:700;color:var(--c1);letter-spacing:.05em;text-transform:uppercase}
  .cs-tc .meta{margin:6px 10px 10px;display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;font-size:10px;color:#a9b2bf}.cs-tc .meta b{color:#e8ecf2;font-weight:700}
  .cs-tcb{display:inline-block;margin-left:4px;padding:1px 5px;border-radius:4px;font:800 9px system-ui;color:#111;background:var(--c1)}`;
  document.head.appendChild(css);
}
// colours and motion for a rarity + grade
function look(info, grade) {
  const c = RARITY[info.tier].color;
  if (info.tier === 6) return { c1: c, c2: '#1a0006', c3: '#ff9a3c', sp: '2.4s', glow: '18px', pulse: true };       // Mythic: blood red and ember
  if (info.tier === 5) return { c1: c, c2: '#5ef0ff', c3: '#ffe95e', sp: '2.8s', glow: '18px', pulse: true };       // Funny: candy rainbow
  if (grade === 10) return { c1: c, c2: '#fff6c8', c3: '#ffffff', sp: '3.2s', glow: '16px', pulse: true };          // a Legendary 10: gold flash
  if (grade === 9) return { c1: c, c2: '#ffffff', c3: c, sp: '4.5s', glow: '12px' };
  if (grade === 8) return { c1: c, c2: '#cfd6e0', c3: c, sp: '6s', glow: '9px' };
  return { c1: c, c2: '#3a414c', c3: c, sp: '9s', glow: '5px' };                                                     // ungraded
}
// a small grade badge for inventory tiles
export function gradeBadge(item) {
  const info = itemInfo(item), g = gradeOf(item, info); if (!g) return '';
  return `<span class="cs-tcb" style="--c1:${RARITY[info.tier].color}">KSA ${g}</span>`;
}
// fill an element with the card for an item. Returns the element.
export function cardInto(el, item) {
  style();
  const info = itemInfo(item); if (!info) return el;
  const g = gradeOf(item, info), L = look(info, g), wear = info.wear ? `${info.wear.name} · ${(+item.float || 0).toFixed(4)}` : info.kind === 'agent' ? 'Outfit' : info.kind === 'emote' ? 'Emote' : '';
  el.innerHTML = `<div class="cs-tc${L.pulse ? ' pulse' : ''}" style="--c1:${L.c1};--c2:${L.c2};--c3:${L.c3};--sp:${L.sp};--glow:${L.glow}"><div class="in">
    <div class="slab"><b>KYS:GO ${new Date().getFullYear()}</b><span>${esc(info.wpn)} · ${esc(info.rarity.name)}${item.st ? ' · StatTrak™' : ''}</span><span>Cert #${certOf(item)}</span>
      <div class="g">${g ? `<s>KSA</s><i>${g}</i><s>${GRADE_NAME[g]}</s>` : '<s>KSA</s><i style="font-size:13px">—</i><s>UNGRADED</s>'}</div></div>
    <div class="art"><img alt=""><div class="holo"></div></div>
    <div class="nm"><span>${esc(info.rarity.name)}</span>${esc(info.finish)}</div>
    <div class="meta"><span>Obtained <b>${esc(day(item.acquired || item.t))}</b></span><span>Owner <b>#${item.owners || 1}</b></span><span>${esc(wear)}</span><span>${info.wear && item.seed != null ? `Pattern <b>${item.seed}</b>` : ''}</span></div></div></div>`;
  const img = el.querySelector('img');
  thumb(item, (url) => { img.src = url; });
  return el;
}
// the card as a picture (600 x 840 PNG): what an NFT of the item displays. Drawn on a canvas from the same data.
export function cardImage(item) {
  return new Promise((res) => {
    const info = itemInfo(item); if (!info) return res(null);
    const g = gradeOf(item, info), L = look(info, g), W = 600, H = 840, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const rr = (a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
    const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, L.c1); gr.addColorStop(0.5, L.c2); gr.addColorStop(1, L.c3); x.fillStyle = gr; rr(0, 0, W, H, 32); x.fill();
    const bg = x.createLinearGradient(0, 0, W * 0.4, H); bg.addColorStop(0, '#20252e'); bg.addColorStop(0.6, '#0f1217'); bg.addColorStop(1, '#191d24'); x.fillStyle = bg; rr(10, 10, W - 20, H - 20, 24); x.fill();
    x.fillStyle = '#eceeef'; rr(26, 26, W - 52, 110, 12); x.fill();
    x.fillStyle = '#111'; x.font = '800 22px system-ui,sans-serif'; x.fillText(`KYS:GO ${new Date().getFullYear()}`, 44, 62);
    x.font = '600 19px system-ui,sans-serif'; x.fillText(`${info.wpn} · ${info.rarity.name}${item.st ? ' · StatTrak' : ''}`.slice(0, 40), 44, 90); x.fillText(`Cert #${certOf(item)}`, 44, 116);
    x.fillStyle = L.c1; x.fillRect(W - 150, 40, 4, 82);
    x.textAlign = 'center'; x.fillStyle = '#111'; x.font = '800 14px system-ui'; x.fillText('KSA', W - 84, 52);
    x.fillStyle = L.c1; x.font = '900 52px system-ui'; x.fillText(g ? String(g) : '—', W - 84, 102); x.fillStyle = '#111'; x.font = '800 12px system-ui'; x.fillText(g ? GRADE_NAME[g] : 'UNGRADED', W - 84, 124); x.textAlign = 'left';
    const ag = x.createRadialGradient(W / 2, 340, 20, W / 2, 380, 300); ag.addColorStop(0, L.c1 + '66'); ag.addColorStop(1, '#0d1015'); x.fillStyle = ag; rr(26, 152, W - 52, 450, 16); x.fill();
    x.fillStyle = L.c1; x.font = '800 20px system-ui'; x.fillText(info.rarity.name.toUpperCase(), 40, 646);
    x.fillStyle = '#fff'; x.font = '900 34px system-ui'; x.fillText(String(info.finish).slice(0, 26), 40, 688);
    x.fillStyle = '#a9b2bf'; x.font = '500 20px system-ui';
    x.fillText(`Obtained ${day(item.acquired || item.t)}`, 40, 740); x.fillText(`Owner #${item.owners || 1}`, 360, 740);
    if (info.wear) { x.fillText(`${info.wear.name} · ${(+item.float || 0).toFixed(4)}`, 40, 776); x.fillText(`Pattern ${item.seed}`, 360, 776); }
    thumb(item, (url) => { const im = new Image(); im.onload = () => { const k = Math.min((W - 80) / im.width, 420 / im.height); x.drawImage(im, (W - im.width * k) / 2, 160 + (440 - im.height * k) / 2, im.width * k, im.height * k); res(c); }; im.onerror = () => res(c); im.src = url; }) || res(c);
  });
}
