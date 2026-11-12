// Calibers: what each gun really fires, for the bullet's flight (muzzle velocity: drop and travel time), the spent case
// it throws out (size, metal, which way, whether it throws one at all) and what the round does to a body (gore class).
// Numbers are the real cartridges' (bullet mass g in grams - a 12 ga load is its nine 00 buckshot pellets together -,
// velocity in m/s, case diameter and length in metres).
export const CAL = {
  '9mm':     { z: 25, g: 8.0, v: 360, dia: 0.0099, len: 0.019, neck: 0, metal: 'brass', gore: 'pistol' },
  '.357sig': { z: 25, g: 8.1, v: 430, dia: 0.0108, len: 0.0218, neck: 1, metal: 'nickel', gore: 'pistol' },
  '5.7':     { z: 25, g: 2.0, v: 650, dia: 0.0079, len: 0.0287, neck: 1, metal: 'brass', gore: 'pistol' },
  '.45':     { z: 25, g: 14.9, v: 260, dia: 0.012, len: 0.0228, neck: 0, metal: 'brass', gore: 'pistol' },
  '.50AE':   { z: 25, g: 19.4, v: 470, dia: 0.0139, len: 0.0328, neck: 0, metal: 'brass', gore: 'magnum' },
  '.357':    { z: 25, g: 10.2, v: 440, dia: 0.0096, len: 0.033, neck: 0, metal: 'brass', gore: 'magnum', noEject: true },   // a revolver keeps its cases
  '12ga':    { z: 25, g: 31.9, v: 400, dia: 0.0203, len: 0.07, neck: 0, metal: 'shell', gore: 'shotgun' },
  '5.56':    { z: 50, g: 4.0, v: 940, dia: 0.0096, len: 0.0447, neck: 1, metal: 'brass', gore: 'rifle' },
  '7.62x39': { z: 50, g: 7.9, v: 715, dia: 0.0113, len: 0.0386, neck: 1, metal: 'steel', gore: 'rifle' },   // the AK's lacquered steel case
  '7.62x51': { z: 100, g: 9.5, v: 830, dia: 0.0119, len: 0.0512, neck: 1, metal: 'brass', gore: 'sniper' },
  '.338':    { z: 100, g: 16.2, v: 900, dia: 0.0149, len: 0.0693, neck: 1, metal: 'brass', gore: 'sniper' },
};
const OF = { glock: '9mm', usp: '9mm', p2000: '9mm', dualies: '9mm', cz75: '9mm', tec9: '9mm', mp9: '9mm', mp5: '9mm', bizon: '9mm', mp7: '5.7',
  p250: '.357sig', fiveseven: '5.7', p90: '5.7', mac10: '.45', ump: '.45', deagle: '.50AE', r8: '.357',
  nova: '12ga', xm1014: '12ga', sawedoff: '12ga', mag7: '12ga',
  galil: '5.56', famas: '5.56', m4a4: '5.56', m4a1s: '5.56', sg553: '5.56', aug: '5.56', m249: '5.56', negev: '5.56',
  ak47: '7.62x39', ssg08: '7.62x51', g3sg1: '7.62x51', scar20: '7.62x51', awp: '.338' };
export const calOf = (wid) => CAL[OF[wid]] || null;
export const calName = (wid) => OF[wid] || '';
// metres a round falls over a distance (flat fire, no drag): 1/2 g t^2 with t = d / v
export const dropAt = (cal, d) => (cal ? 0.5 * 9.81 * (d / cal.v) * (d / cal.v) : 0);
// Sights are zeroed (z, metres): the barrel points a touch up so the round crosses the line of sight at the zero, the
// way real guns are set: pistols, SMGs and shotguns at 25 m, rifles at 50 m (the 50/200 m battle zero), the .308 and
// .338 at 100 m. Where the round lands against the crosshair at a distance (metres, + is high):
//   9 mm: +6 mm at 12 m, 0 at 25 m, -9 cm at 60 m;  5.56: +3 mm at 25 m, 0 at 50 m, -4 cm at 120 m;  .338: 0 at 100 m
export const holdover = (cal, d) => (cal ? d * dropAt(cal, cal.z) / cal.z - dropAt(cal, d) : 0);
// the bore's tilt below the line of sight, per metre, at a distance (what the trace bends the shot by): low past the zero, high before it
export const tiltAt = (cal, d) => (cal ? dropAt(cal, d) / Math.max(1, d) - dropAt(cal, cal.z) / cal.z : 0);
// how long a round takes to get there (no drag): what the tracer shows
export const flightTime = (cal, d) => (cal ? d / cal.v : 0);
// the gore a round does at a distance: 'pistol' (a small entry wound, it bleeds and drips), 'rifle' (entry and a
// larger exit, a heavy spray; up close it can take a hand, an arm or the jaw), 'shotgun' (close: pieces blown off;
// mid: a cluster of wounds; far: pellet marks), 'sniper' (a .338 or .308 takes limbs and heads off)
export function goreOf(wid, dist) {
  const c = calOf(wid); if (!c) return { cls: 'none', k: 0 };
  if (c.gore === 'shotgun') return { cls: 'shotgun', k: dist < 4 ? 2 : dist < 10 ? 1 : 0 };
  if (c.gore === 'rifle') return { cls: 'rifle', k: dist < 8 ? 2 : dist < 25 ? 1 : 0.6 };
  return { cls: c.gore, k: 1 };
}
// what a round pushes a body with, in kg m/s (mass x velocity at the muzzle): a 9 mm ~2.9, 5.56 ~3.8, 7.62x39 ~5.6,
// .50 AE ~9, 12 ga buckshot ~13 (all pellets; fewer hit as they spread), .338 ~15. On an 80 kg body even the biggest is
// a fraction of a metre per second: people drop because they are hurt, not because the bullet threw them.
export function momentum(wid, dist = 0) {
  const c = calOf(wid); if (!c) return 0; let p = c.g / 1000 * c.v;
  if (c.gore === 'shotgun') p *= dist < 4 ? 1 : dist < 10 ? 0.55 : 0.25;
  return p;
}
