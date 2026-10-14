// Map editor and community maps. A custom map is plain data (a list of builder steps on a 1 m grid, like the hand-made
// maps in maps.js), so it is tiny to save, share and send to friends in a lobby. No free text ends up in the world (no
// signs), and every number is clamped, so a map from someone else can't break the game.
import { MapBuilder, MAT_LIST, MATS } from './world.js';
import { MAPS } from './maps.js';

export const EDIT_MATS = ['sand', 'concrete', 'asphalt', 'grass', 'dirt', 'tile', 'carpet', 'wood', 'darkwood', 'metal', 'brick', 'sandwall', 'plaster', 'rock', 'snow',
  'crate', 'cred', 'cblue', 'cgreen', 'corange', 'yellow', 'green', 'fence', 'roof'].filter((m) => MAT_LIST.includes(m));
export const SKIES = {
  day: { sky: 0x6f9fd8, fog: 0xd9cdb4, sunColor: 0xffeed2, amb: [0xc4d8f2, 0x9c7c54], sunDir: [0.62, 0.66, 0.42], sunI: 2.7, ambI: 1.15, photo: 'day' },
  noon: { sky: 0x5f9be0, fog: 0xcfe2f4, sunColor: 0xfff6e6, amb: [0xd2e4fa, 0x6a7a52], sunDir: [0.5, 0.72, -0.45], sunI: 2.6, ambI: 1.15, photo: 'noon' },
  overcast: { sky: 0x7a8aa0, fog: 0x9aa4b2, sunColor: 0xeef2fa, amb: [0xd6e0ee, 0x5a5a60], sunDir: [0.45, 0.8, 0.5], sunI: 1.5, ambI: 1.6, photo: 'overcast' },
  dusk: { sky: 0x46405a, fog: 0x6a4a44, sunColor: 0xffa860, amb: [0xb8a8c0, 0x4a3430], sunDir: [0.75, 0.38, 0.3], sunI: 2.5, ambI: 1.3, photo: 'dusk' },
};
export const TOOLS = [
  ['open', 'Floor', 'Walkable ground at a height'], ['ramp', 'Ramp / stairs', 'Drag from the low end to the high end'], ['block', 'Wall', 'Solid wall from the ground up'],
  ['stack', 'Crate / cover', 'Adds a box on top of what is there'], ['roof', 'Roof', 'A ceiling over an area'], ['water', 'Water', 'Shallow water'],
  ['spawnT', 'T spawn', 'Click to place (up to 10)'], ['spawnCT', 'CT spawn', 'Click to place (up to 10)'], ['siteA', 'Bomb site A', ''], ['siteB', 'Bomb site B', ''],
  ['buyT', 'T buy zone', ''], ['buyCT', 'CT buy zone', ''],
];
const OPN = { open: 2, ramp: 4, block: 2, stack: 2, roof: 2, water: 0 };   // numbers after the rectangle
const num = (v, lo, hi, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const rect = (r, w, d) => { const a = (r || []).map(Number); if (a.length < 4 || a.some((x) => !Number.isFinite(x))) return null;
  const x0 = Math.max(0, Math.min(a[0], a[2])), x1 = Math.min(w, Math.max(a[0], a[2])), z0 = Math.max(0, Math.min(a[1], a[3])), z1 = Math.min(d, Math.max(a[1], a[3]));
  return x1 > x0 && z1 > z0 ? [Math.round(x0), Math.round(z0), Math.round(x1), Math.round(z1)] : null; };

// a clean copy of any map definition (from the editor, local storage, a friend's lobby or the community list)
export function cleanDef(raw) {
  const d0 = raw || {}, w = Math.round(num(d0.w, 24, 96, 48)), d = Math.round(num(d0.d, 24, 96, 48));
  const mat = (m, f) => (EDIT_MATS.includes(m) ? m : f);
  const def = { v: 1, name: String(d0.name || 'Untitled').replace(/[^\p{L}\p{N} '!?.&-]/gu, '').trim().slice(0, 28) || 'Untitled', author: String(d0.author || '').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 20),
    w, d, wallH: num(d0.wallH, 3, 9, 6), wallMat: mat(d0.wallMat, 'sandwall'), floorMat: mat(d0.floorMat, 'sand'), sky: SKIES[d0.sky] ? d0.sky : 'day',
    ops: [], spawns: { T: [], CT: [] }, sites: {}, buy: {} };
  for (const o of (Array.isArray(d0.ops) ? d0.ops : []).slice(0, 600)) {
    if (!Array.isArray(o) || !(o[0] in OPN)) continue;
    const r = rect(o.slice(1, 5), w, d); if (!r) continue;
    const k = o[0], rest = o.slice(5);
    if (k === 'ramp') def.ops.push([k, ...r, num(rest[0], -2, 8), num(rest[1], -2, 8), rest[2] === 'z' ? 'z' : 'x', mat(rest[3], def.floorMat)]);
    else if (k === 'water') def.ops.push([k, ...r]);
    else def.ops.push([k, ...r, num(rest[0], k === 'open' ? -2 : 0.2, k === 'roof' ? 12 : 9, 0), mat(rest[1], k === 'open' ? def.floorMat : k === 'roof' ? 'roof' : k === 'stack' ? 'crate' : def.wallMat)]);
  }
  for (const t of ['T', 'CT']) for (const s of ((d0.spawns || {})[t] || []).slice(0, 10)) if (Array.isArray(s)) def.spawns[t].push([num(s[0], 1, w - 1), num(s[1], 1, d - 1), num(s[2], -7, 7)]);
  for (const n of ['A', 'B']) { const r = rect((d0.sites || {})[n], w, d); if (r) def.sites[n] = r; }
  for (const t of ['T', 'CT']) { const r = rect((d0.buy || {})[t], w, d); if (r) def.buy[t] = r; }
  return def;
}

// the MapBuilder for a definition (the same builder the hand-made maps use)
export function buildCustom(raw) {
  const def = cleanDef(raw), B = new MapBuilder(def.w, def.d, def.wallH, def.wallMat, def.floorMat);
  for (const o of def.ops) {
    const [k, x0, z0, x1, z1, ...a] = o;
    if (k === 'ramp') B.ramp(x0, z0, x1, z1, a[0], a[1], a[2], a[3]);
    else if (k === 'water') B.water(x0, z0, x1, z1);
    else if (k === 'roof') B.roof(x0, z0, x1, z1, Math.max(a[0], 2.6), a[1]);
    else B[k](x0, z0, x1, z1, a[0], a[1]);
  }
  const open = (x, z) => { const i = Math.floor(z) * B.w + Math.floor(x); return x >= 1 && z >= 1 && x < B.w - 1 && z < B.d - 1 && B.flag[i] === 2; };
  // spawns: as placed; else on open ground inside the buy zone; else the far ends of the map
  for (const [t, yaw] of [['T', 0], ['CT', Math.PI]]) {
    let sp = def.spawns[t].filter(([x, z]) => open(x, z));
    if (sp.length < 2) {
      const r = def.buy[t] || (t === 'T' ? [1, Math.floor(B.d * 0.7), B.w - 1, B.d - 1] : [1, 1, B.w - 1, Math.ceil(B.d * 0.3)]);
      const cells = []; for (let z = r[1]; z < r[3]; z++) for (let x = r[0]; x < r[2]; x++) if (open(x + 0.5, z + 0.5)) cells.push([x + 0.5, z + 0.5]);
      cells.sort((a, b) => (t === 'T' ? b[1] - a[1] : a[1] - b[1]));   // the deepest rows first, then spread across them
      const band = cells.slice(0, Math.max(6, Math.ceil(cells.length * 0.35))).sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < 6 && band.length; k++) { const c = band[Math.min(band.length - 1, Math.round((k + 0.5) / 6 * (band.length - 1)))]; if (!sp.some(([x, z]) => Math.hypot(x - c[0], z - c[1]) < 1.5)) sp.push([c[0], c[1], yaw]); }
    }
    for (const [x, z, y] of sp) B.spawn(t, x, z, y);
    if (sp[0]) B.duelSpawn(t, sp[0][0], sp[0][1], sp[0][2]);
    const r = def.buy[t] || (sp[0] && [Math.floor(sp[0][0]) - 4, Math.floor(sp[0][1]) - 4, Math.floor(sp[0][0]) + 5, Math.floor(sp[0][1]) + 5]);
    if (r) { B.buyzone(t, r[0], r[1], r[2], r[3]); B.zone(t + ' Spawn', r[0], r[1], r[2], r[3]); }
  }
  for (const [n, r] of Object.entries(def.sites)) { B.site(n, ...r); B.zone(n + ' Site', ...r); }
  B.zone(def.name, 0, 0, B.w, B.d);
  Object.assign(B, { ...SKIES[def.sky], amb: [...SKIES[def.sky].amb], sunDir: [...SKIES[def.sky].sunDir] });
  return B;
}

// what a map can host: everything needs spawns for both teams; bomb modes need both sites
export function checkDef(raw) {
  const def = cleanDef(raw), B = buildCustom(def), problems = [];
  let open = 0; for (let i = 0; i < B.flag.length; i++) if (B.flag[i] === 2) open++;
  if (open < 120) problems.push('Paint more floor: the map needs at least 120 m² of ground');
  if (B.spawns.T.length < 2 || B.spawns.CT.length < 2) problems.push('Both teams need somewhere to spawn: place spawns or buy zones on floor');
  const bomb = !!(def.sites.A && def.sites.B);
  return { ok: !problems.length, problems, modes: problems.length ? [] : ['dm', 'arms', 'zombies', '1v1', '2v2', ...(bomb ? ['3v3', '5v5', 'retake'] : [])], bomb };
}

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
// adds the map to MAPS (so the map picker, lobbies and the game load it like any other) and returns its id
export function registerCustom(raw, extra = {}) {
  const def = cleanDef(raw), id = 'c_' + hash(JSON.stringify(def)), chk = checkDef(def);
  if (!chk.ok) throw new Error(chk.problems[0]);
  MAPS[id] = { id, name: '🛠 ' + def.name, short: def.name, parody: def.author ? 'a community map by ' + def.author : 'your own map', build: () => buildCustom(def), modes: chk.modes, custom: true, def, ...extra };
  return id;
}

// this device's maps
const LS = 'kysgo_maps_v1';
export function localMaps() { try { return (JSON.parse(localStorage.getItem(LS) || '[]') || []).map(cleanDef); } catch (e) { return []; } }
export function saveLocal(def) {
  const all = localMaps().filter((m) => m.name !== def.name); all.unshift(cleanDef(def));
  try { localStorage.setItem(LS, JSON.stringify(all.slice(0, 24))); } catch (e) { return false; }
  return true;
}
export function deleteLocal(name) { try { localStorage.setItem(LS, JSON.stringify(localMaps().filter((m) => m.name !== name))); } catch (e) { /* private mode */ } }
export function registerLocal() { for (const d of localMaps()) try { registerCustom(d); } catch (e) { /* unfinished map */ } }

export function newDef(w = 48, d = 48) {
  return cleanDef({ name: 'My map', w, d, wallH: 6, wallMat: 'sandwall', floorMat: 'sand', ops: [['open', 2, 2, w - 2, d - 2, 0, 'sand']] });
}

// ---- the editor: a top-down grid you paint rectangles on ----------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export class MapEditor {
  // h: { toast(text), test(def), publish(def) -> Promise, close() }
  constructor(h, def) {
    this.h = h; this.def = cleanDef(def || newDef()); this.tool = 'open'; this.hgt = 0; this.h1 = 1.5; this.mat = this.def.floorMat; this.undo = []; this.drag = null;
    this.el = document.createElement('div'); this.el.className = 'cs cs-modal cs-mapedit';
    this.el.innerHTML = `<div class="cs-card" style="width:min(1180px,96vw);max-width:96vw;display:grid;grid-template-columns:250px 1fr;gap:14px;padding:14px">
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
        <b style="font-size:17px">🛠 Map editor</b>
        <label>Name<input data-f="name" maxlength="28" style="width:100%"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px" data-tools>${TOOLS.map(([k, n, t]) => `<button class="cs-btn alt sm" data-tool="${k}" title="${esc(t)}">${esc(n)}</button>`).join('')}</div>
        <label>Height (m) <input type="number" data-f="hgt" step="0.1" min="-2" max="9" style="width:70px"></label>
        <label data-only="ramp">Ramp top (m) <input type="number" data-f="h1" step="0.1" min="-2" max="8" style="width:70px"></label>
        <label>Material <select data-f="mat">${EDIT_MATS.map((m) => `<option value="${m}">${m}</option>`).join('')}</select></label>
        <details><summary>Map settings</summary>
          <label>Size <select data-f="size">${[32, 40, 48, 64, 80, 96].map((n) => `<option value="${n}">${n} × ${n} m</option>`).join('')}</select></label>
          <label>Walls <select data-f="wallMat">${EDIT_MATS.map((m) => `<option value="${m}">${m}</option>`).join('')}</select></label>
          <label>Wall height <input type="number" data-f="wallH" min="3" max="9" step="0.5" style="width:70px"></label>
          <label>Sky <select data-f="sky">${Object.keys(SKIES).map((k) => `<option value="${k}">${k}</option>`).join('')}</select></label></details>
        <div class="cs-small cs-mut" data-status></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:auto"><button class="cs-btn sm" data-a="undo">Undo</button><button class="cs-btn sm" data-a="save">Save</button>
          <button class="cs-btn sm" data-a="test">▶ Test with bots</button><button class="cs-btn sm" data-a="publish">🌍 Publish</button><button class="cs-btn alt sm" data-a="close">Close</button></div>
      </div>
      <div style="position:relative;display:grid;place-items:center;min-height:60vh;background:#0b0e13;border-radius:6px;touch-action:none"><canvas data-c style="max-width:100%;max-height:78vh;cursor:crosshair"></canvas></div></div>`;
    document.body.appendChild(this.el);
    this.c = this.el.querySelector('[data-c]'); this.g = this.c.getContext('2d');
    const f = (k) => this.el.querySelector(`[data-f="${k}"]`);
    f('name').value = this.def.name; f('hgt').value = this.hgt; f('h1').value = this.h1; f('mat').value = this.mat; f('size').value = String(this.def.w); f('wallMat').value = this.def.wallMat; f('wallH').value = this.def.wallH; f('sky').value = this.def.sky;
    f('name').oninput = (e) => { this.def.name = e.target.value; };
    f('hgt').oninput = (e) => { this.hgt = num(e.target.value, -2, 9, 0); };
    f('h1').oninput = (e) => { this.h1 = num(e.target.value, -2, 8, 1.5); };
    f('mat').onchange = (e) => { this.mat = e.target.value; };
    f('size').onchange = (e) => { this.push(); const n = +e.target.value; this.def = cleanDef({ ...this.def, w: n, d: n }); this.draw(); };
    f('wallMat').onchange = (e) => { this.push(); this.def.wallMat = e.target.value; this.draw(); };
    f('wallH').onchange = (e) => { this.push(); this.def.wallH = num(e.target.value, 3, 9, 6); this.draw(); };
    f('sky').onchange = (e) => { this.def.sky = e.target.value; };
    this.el.querySelectorAll('[data-tool]').forEach((b) => (b.onclick = () => this.setTool(b.dataset.tool)));
    this.el.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => this.act(b.dataset.a)));
    const cell = (e) => { const r = this.c.getBoundingClientRect(), s = r.width / this.def.w; return [Math.max(0, Math.min(this.def.w, (e.clientX - r.left) / s)), Math.max(0, Math.min(this.def.d, (e.clientY - r.top) / s))]; };
    this.c.addEventListener('pointerdown', (e) => { e.preventDefault(); try { this.c.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } const p = cell(e); this.drag = { a: p, b: p }; this.draw(); });
    this.c.addEventListener('pointermove', (e) => { if (this.drag) { this.drag.b = cell(e); this.draw(); } });
    this.c.addEventListener('pointerup', (e) => { if (!this.drag) return; this.drag.b = cell(e); this.apply(this.drag); this.drag = null; this.draw(); });
    this.onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); this.act('undo'); } if (e.code === 'Escape') this.act('close'); };
    addEventListener('keydown', this.onKey);
    this.setTool('open');
  }
  setTool(k) {
    this.tool = k; this.el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('alt', b.dataset.tool !== k));
    this.el.querySelector('[data-only="ramp"]').style.display = k === 'ramp' ? '' : 'none';
    const mf = this.el.querySelector('[data-f="mat"]');
    if (k === 'block') mf.value = this.mat = this.def.wallMat; else if (k === 'stack') mf.value = this.mat = 'crate'; else if (k === 'roof') mf.value = this.mat = 'roof'; else if (k === 'open' || k === 'ramp') mf.value = this.mat = this.def.floorMat;
    if (k === 'stack' && !(this.hgt > 0)) { this.hgt = 1.1; this.el.querySelector('[data-f="hgt"]').value = 1.1; }
    if (k === 'block' && !(this.hgt > 0)) { this.hgt = this.def.wallH; this.el.querySelector('[data-f="hgt"]').value = this.hgt; }
    if (k === 'roof') { this.hgt = Math.max(this.hgt, 3.2); this.el.querySelector('[data-f="hgt"]').value = this.hgt; }
    this.draw();
  }
  push() { this.undo.push(JSON.stringify(this.def)); if (this.undo.length > 80) this.undo.shift(); }
  apply({ a, b }) {
    const t = this.tool, x0 = Math.floor(Math.min(a[0], b[0])), z0 = Math.floor(Math.min(a[1], b[1])), x1 = Math.ceil(Math.max(a[0], b[0])) || x0 + 1, z1 = Math.ceil(Math.max(a[1], b[1])) || z0 + 1;
    const R = [x0, z0, Math.max(x1, x0 + 1), Math.max(z1, z0 + 1)];
    this.push();
    if (t === 'spawnT' || t === 'spawnCT') { const team = t.slice(5), L = this.def.spawns[team]; L.push([+b[0].toFixed(1), +b[1].toFixed(1), team === 'T' ? 0 : Math.PI]); if (L.length > 10) L.shift(); }
    else if (t === 'siteA' || t === 'siteB') this.def.sites[t.slice(4)] = R;
    else if (t === 'buyT' || t === 'buyCT') this.def.buy[t.slice(3)] = R;
    else if (t === 'ramp') { const dx = Math.abs(b[0] - a[0]), dz = Math.abs(b[1] - a[1]), dir = dx >= dz ? 'x' : 'z', up = dir === 'x' ? b[0] >= a[0] : b[1] >= a[1];
      this.def.ops.push(['ramp', ...R, up ? this.hgt : this.h1, up ? this.h1 : this.hgt, dir, this.mat]); }
    else if (t === 'water') this.def.ops.push(['water', ...R]);
    else this.def.ops.push([t, ...R, this.hgt, this.mat]);
    if (this.def.ops.length > 600) { this.def.ops.shift(); this.h.toast('A map can have 600 pieces: the oldest one was merged away'); }
    this.def = cleanDef(this.def);
  }
  draw() {
    const def = this.def, B = buildCustom(def), s = Math.max(4, Math.floor(Math.min(1100, innerWidth * 0.68) / def.w)), g = this.g;
    if (this.c.width !== def.w * s) { this.c.width = def.w * s; this.c.height = def.d * s; }
    for (let z = 0; z < B.d; z++) for (let x = 0; x < B.w; x++) {
      const i = z * B.w + x, h = B.h[i], m = MATS[MAT_LIST[B.mat[i]]] || { c: [128, 128, 128] }, open = B.flag[i] === 2 || B.rid[i] >= 0, wet = B.flag[i] === 3;
      const k = open ? 0.55 + Math.max(-0.2, Math.min(0.45, h * 0.07)) : 0.2 + Math.min(0.12, h * 0.015);
      g.fillStyle = wet ? '#2a6f95' : `rgb(${m.c[0] * k | 0},${m.c[1] * k | 0},${m.c[2] * k | 0})`; g.fillRect(x * s, z * s, s, s);
      if (B.rid[i] >= 0) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x * s, z * s + s * 0.4, s, s * 0.2); }
    }
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x <= def.w; x += 4) { g.moveTo(x * s + 0.5, 0); g.lineTo(x * s + 0.5, def.d * s); }
    for (let z = 0; z <= def.d; z += 4) { g.moveTo(0, z * s + 0.5); g.lineTo(def.w * s, z * s + 0.5); } g.stroke();
    g.setLineDash([4, 3]); g.strokeStyle = 'rgba(255,255,255,.5)';
    for (const o of def.ops) if (o[0] === 'roof') g.strokeRect(o[1] * s, o[2] * s, (o[3] - o[1]) * s, (o[4] - o[2]) * s);
    g.setLineDash([]);
    const box = (r, col, label) => { if (!r) return; g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(r[0] * s + 1, r[1] * s + 1, (r[2] - r[0]) * s - 2, (r[3] - r[1]) * s - 2); g.fillStyle = col; g.font = `bold ${Math.max(11, s * 1.6)}px system-ui`; g.fillText(label, r[0] * s + 5, r[1] * s + Math.max(13, s * 1.8)); };
    box(def.sites.A, '#ff5a3c', 'A'); box(def.sites.B, '#ff5a3c', 'B'); box(def.buy.T, '#e7b94a', 'T buy'); box(def.buy.CT, '#5aa0ff', 'CT buy');
    for (const [t, col] of [['T', '#e7b94a'], ['CT', '#5aa0ff']]) for (const [x, z] of B.spawns[t]) { g.fillStyle = col; g.beginPath(); g.arc(x * s, z * s, Math.max(3, s * 0.45), 0, 7); g.fill(); }
    if (this.drag) { const { a, b } = this.drag; g.strokeStyle = '#fff'; g.lineWidth = 2; g.setLineDash([5, 4]); g.strokeRect(Math.floor(Math.min(a[0], b[0])) * s, Math.floor(Math.min(a[1], b[1])) * s, (Math.ceil(Math.max(a[0], b[0])) - Math.floor(Math.min(a[0], b[0]))) * s, (Math.ceil(Math.max(a[1], b[1])) - Math.floor(Math.min(a[1], b[1]))) * s); g.setLineDash([]); }
    const chk = checkDef(def), st = this.el.querySelector('[data-status]');
    st.innerHTML = chk.ok ? `✅ Playable: ${chk.bomb ? 'all modes' : 'deathmatch, arms race, zombies, duels (add sites A and B for bomb modes)'} · ${def.ops.length} pieces` : '⚠️ ' + esc(chk.problems.join(' · '));
  }
  act(a) {
    if (a === 'undo') { const u = this.undo.pop(); if (u) { this.def = cleanDef(JSON.parse(u)); this.draw(); } return; }
    if (a === 'close') { removeEventListener('keydown', this.onKey); this.el.remove(); this.h.close && this.h.close(); return; }
    const chk = checkDef(this.def);
    if (a === 'save') { this.h.toast(saveLocal(this.def) ? `Saved "${this.def.name}" on this device` : 'Could not save (storage full or private mode)'); try { registerCustom(this.def); } catch (e) { /* unfinished */ } return; }
    if (!chk.ok) { this.h.toast(chk.problems[0]); return; }
    if (a === 'test') { saveLocal(this.def); removeEventListener('keydown', this.onKey); this.el.remove(); this.h.test(this.def); return; }
    if (a === 'publish') { saveLocal(this.def); Promise.resolve(this.h.publish(this.def)).then((r) => this.h.toast(r && r.error ? r.error : '🌍 Published! Anyone can find it in Community maps')).catch((e) => this.h.toast(String(e.message || e))); }
  }
}
