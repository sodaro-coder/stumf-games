// Guns beyond the numbers in data.js: each gun's spray pattern (the same shape every spray, modelled on the classic
// patterns: the AK climbs, kicks right, sweeps left, then right again; the M4s are tighter; SMGs wobble; the big MGs
// swing wide), the attachments you unlock by levelling a gun up, and the level ladder. Attachments never change how a
// gun performs: optics only let you aim down sights (hold right click), muzzles are looks only, and the suppressor
// (Level 10 prestige) only makes the gun quieter.
import { W_BY_ID } from './data.js';

// ---- spray patterns: cumulative [right, up] per bullet, in "kick units" (scaled by the gun's kick) -----------------
const P = {
  ak47: [[0, 0], [0, 1], [0.1, 2.3], [-0.1, 3.8], [0.2, 5.4], [0.4, 6.9], [0.2, 8.1], [-0.3, 9], [-0.2, 9.7], [1.2, 10.1], [2.6, 10.3], [3.6, 10.6], [3.2, 10.9], [1.6, 11], [-0.5, 11.1],
    [-2.4, 11], [-4, 11.2], [-5.2, 11.4], [-5.6, 11.3], [-4.8, 11.5], [-3, 11.6], [-1, 11.4], [1, 11.5], [2.6, 11.8], [3.6, 11.6], [3, 11.9], [1.4, 12], [-0.6, 11.8], [-2, 12.1], [-2.6, 12]],
  m4a4: [[0, 0], [0, 1], [0, 2.2], [0.1, 3.5], [-0.1, 4.8], [0.1, 6], [0, 7], [-0.4, 7.8], [-0.9, 8.4], [-1.4, 8.8], [-1.2, 9.2], [-0.4, 9.5], [0.6, 9.7], [1.6, 9.9], [2.3, 10.2], [2.4, 10.4],
    [1.8, 10.5], [0.8, 10.7], [-0.4, 10.6], [-1.4, 10.8], [-2, 11], [-1.8, 11.1], [-1, 11.2], [0.2, 11.1], [1.2, 11.3], [1.8, 11.5], [1.6, 11.6], [0.8, 11.7], [-0.2, 11.6], [-1, 11.8]],
  galil: [[0, 0], [0, 1], [0.1, 2.1], [0, 3.2], [-0.2, 4.3], [0, 5.3], [0.3, 6.2], [0.5, 7], [0.2, 7.6], [-0.4, 8.1], [-1, 8.5], [-1.4, 8.8], [-1, 9.1], [-0.2, 9.3], [0.8, 9.5], [1.6, 9.7],
    [2, 9.9], [1.6, 10], [0.6, 10.1], [-0.6, 10.2], [-1.6, 10.4], [-2, 10.5], [-1.4, 10.6], [-0.4, 10.6], [0.8, 10.8], [1.6, 10.9], [1.8, 11], [1, 11.1], [0, 11.1], [-1, 11.2], [-1.6, 11.3], [-1.4, 11.4], [-0.6, 11.4], [0.4, 11.5], [1.2, 11.6]],
  famas: [[0, 0], [0, 1], [0.1, 2.1], [-0.1, 3.1], [0.2, 4.1], [0, 5], [-0.4, 5.8], [-0.9, 6.4], [-1.1, 6.9], [-0.6, 7.3], [0.2, 7.6], [1, 7.9], [1.5, 8.1], [1.3, 8.3], [0.5, 8.5], [-0.5, 8.6],
    [-1.3, 8.8], [-1.6, 9], [-1, 9.1], [0, 9.2], [1, 9.4], [1.5, 9.5], [1.1, 9.6], [0.3, 9.7], [-0.5, 9.8]],
  sg553: [[0, 0], [0, 1], [-0.1, 2.3], [-0.3, 3.6], [-0.5, 4.9], [-0.8, 6.1], [-1.2, 7.2], [-1.7, 8.1], [-2.2, 8.8], [-2.4, 9.4], [-2, 9.9], [-1, 10.2], [0.2, 10.4], [1.4, 10.6], [2.4, 10.8],
    [2.8, 11], [2.4, 11.2], [1.4, 11.3], [0.2, 11.4], [-1, 11.6], [-2, 11.8], [-2.4, 12], [-2, 12.1], [-1, 12.2], [0.2, 12.3], [1.2, 12.5], [2, 12.6], [2.2, 12.7], [1.6, 12.8], [0.6, 12.9]],
};
P.m4a1s = P.m4a4.map(([x, y]) => [x * 0.75, y * 0.92]);
P.aug = P.sg553.map(([x, y]) => [-x * 0.9, y * 0.95]);
// SMGs, MGs, pistols and the rest: built from a recipe (climb for n bullets, then side to side with the given swing)
function make(n, climb, swing, period, drift = 0, len = 30) {
  const out = []; let y = 0;
  for (let i = 0; i < len; i++) {
    y += i === 0 ? 0 : i < n ? climb : climb * 0.12;
    const x = i < n ? Math.sin(i * 1.7) * 0.15 : Math.sin((i - n) * Math.PI / period) * swing + (i - n) * drift;
    out.push([x, y]);
  }
  return out;
}
Object.assign(P, {
  mac10: make(6, 1.0, 2.6, 4, 0.05, 32), mp9: make(7, 1.0, 2.2, 4, -0.04, 32), mp7: make(7, 0.95, 1.8, 5, 0.03, 32), mp5: make(7, 0.95, 1.6, 5, -0.03, 32),
  ump: make(7, 1.1, 2.0, 5, 0.06, 32), p90: make(9, 0.85, 1.6, 7, 0.08, 52), bizon: make(8, 0.8, 1.6, 6, -0.04, 66),
  m249: make(9, 1.0, 4.5, 9, 0.02, 100), negev: make(12, 0.9, 5.5, 11, -0.02, 150),
  cz75: make(5, 1.0, 1.4, 3, 0.05, 14), glock: make(8, 0.9, 0.8, 4, 0.03, 22), dualies: make(8, 0.9, 1.0, 3, 0, 32),
});
export function recoilPattern(w, i) {
  const p = P[w.id];
  i = Math.max(0, Math.floor(Number.isFinite(i) ? i : 0));   // the spray count recovers smoothly between bursts: round it to a bullet
  let x, y;
  if (p) { const k = Math.min(i, p.length - 1); [x, y] = p[k]; if (i >= p.length) { const e = i - p.length + 1; x += Math.sin(e * 0.7) * 1.2; y += e * 0.05; } }
  else { y = Math.min(i, 9) * 1.0 + Math.max(0, i - 9) * 0.1; x = i > 8 ? Math.sin((i - 8) * 0.55) * 2.4 : Math.sin(i * 0.9) * 0.2; }
  return { x, y };   // kick units: right, up
}

// ---- attachments -------------------------------------------------------------------------------------------------
// slot: optic | muzzle | reticle. lvl: the gun level that unlocks it. zoom: aim-down-sights magnification.
export const ATTACH = {
  iron: { slot: 'optic', name: 'Iron sights', lvl: 1, zoom: 1.1 },
  reddot: { slot: 'optic', name: 'Red Dot', lvl: 2, zoom: 1.15, reticle: 'dot' },
  holo: { slot: 'optic', name: 'Holographic', lvl: 4, zoom: 1.15, reticle: 'holo' },
  acog: { slot: 'optic', name: 'ACOG', lvl: 6, zoom: 1.4, reticle: 'chevron' },
  standard: { slot: 'muzzle', name: 'Standard', lvl: 1 },
  comp: { slot: 'muzzle', name: 'Compensator', lvl: 3 },
  flashhider: { slot: 'muzzle', name: 'Flash Hider', lvl: 5 },
  brake: { slot: 'muzzle', name: 'Muzzle Brake', lvl: 7 },
  shroud: { slot: 'muzzle', name: 'Long Shroud', lvl: 9 },
  suppressor: { slot: 'muzzle', name: 'Suppressor', lvl: 10, quiet: true },
  duplex: { slot: 'reticle', name: 'Duplex', lvl: 1 },
  mildot: { slot: 'reticle', name: 'Mil-Dot', lvl: 2 },
  dotret: { slot: 'reticle', name: 'Red Dot', lvl: 4 },
  circle: { slot: 'reticle', name: 'Circle', lvl: 6 },
  chevret: { slot: 'reticle', name: 'Chevron', lvl: 8 },
  hotdog: { slot: 'reticle', name: 'Hot Dog (lol)', lvl: 9 },
};
export const DEFAULT_ATT = { optic: 'iron', muzzle: 'standard', reticle: 'duplex' };
// which slots a gun has: scoped guns pick a reticle, built-in suppressors keep theirs (no muzzle slot)
export function slotsFor(wid) {
  const w = W_BY_ID[wid]; if (!w || ['knife', 'zeus', 'grenade', 'bomb'].includes(w.cat)) return [];
  const s = [];
  s.push(w.zoom ? 'reticle' : 'optic');
  if (!w.silenced) s.push('muzzle');
  return s;
}
export const optionsFor = (wid, slot) => Object.entries(ATTACH).filter(([, a]) => a.slot === slot && slotsFor(wid).includes(slot)).map(([id, a]) => ({ id, ...a }));

// ---- levels: XP from damage, kills and round wins with the gun. Level 10 = prestige ---------------------------------
export const GUN_MAX = 10;
export const xpForLevel = (l) => 150 * l * (l - 1);   // L2 300, L3 900, L5 3000, L10 13500
export function gunLevel(xp) { let l = 1; while (l < GUN_MAX && (xp || 0) >= xpForLevel(l + 1)) l++; return l; }
export const XP_RULES = { dmg: 1, kill: 100, head: 40, win: 50 };   // per HP of damage, per kill, extra per headshot kill, per round won holding it
export function unlocksAt(wid, lvl) { return Object.entries(ATTACH).filter(([, a]) => a.lvl === lvl && slotsFor(wid).includes(a.slot)).map(([id, a]) => a.name || id); }
export function attOK(wid, slot, id, xp) { const a = ATTACH[id]; return !!a && a.slot === slot && slotsFor(wid).includes(slot) && gunLevel(xp) >= a.lvl; }
