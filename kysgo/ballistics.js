// Calibers: what each gun really fires, for the bullet's flight (muzzle velocity: drop and travel time), the spent case
// it throws out (size, metal, which way, whether it throws one at all) and what the round does to a body (gore class).
// Numbers are the real cartridges' (velocity in m/s, case diameter and length in metres).
export const CAL = {
  '9mm':     { v: 360, dia: 0.0099, len: 0.019, neck: 0, metal: 'brass', gore: 'pistol' },
  '.357sig': { v: 430, dia: 0.0108, len: 0.0218, neck: 1, metal: 'nickel', gore: 'pistol' },
  '5.7':     { v: 650, dia: 0.0079, len: 0.0287, neck: 1, metal: 'brass', gore: 'pistol' },
  '.45':     { v: 260, dia: 0.012, len: 0.0228, neck: 0, metal: 'brass', gore: 'pistol' },
  '.50AE':   { v: 470, dia: 0.0139, len: 0.0328, neck: 0, metal: 'brass', gore: 'magnum' },
  '.357':    { v: 440, dia: 0.0096, len: 0.033, neck: 0, metal: 'brass', gore: 'magnum', noEject: true },   // a revolver keeps its cases
  '12ga':    { v: 400, dia: 0.0203, len: 0.07, neck: 0, metal: 'shell', gore: 'shotgun' },
  '5.56':    { v: 940, dia: 0.0096, len: 0.0447, neck: 1, metal: 'brass', gore: 'rifle' },
  '7.62x39': { v: 715, dia: 0.0113, len: 0.0386, neck: 1, metal: 'steel', gore: 'rifle' },   // the AK's lacquered steel case
  '7.62x51': { v: 830, dia: 0.0119, len: 0.0512, neck: 1, metal: 'brass', gore: 'sniper' },
  '.338':    { v: 900, dia: 0.0149, len: 0.0693, neck: 1, metal: 'brass', gore: 'sniper' },
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
// the gore a round does at a distance: 'pistol' (a small entry wound, it bleeds and drips), 'rifle' (entry and a
// larger exit, a heavy spray; up close it can take a hand, an arm or the jaw), 'shotgun' (close: pieces blown off;
// mid: a cluster of wounds; far: pellet marks), 'sniper' (a .338 or .308 takes limbs and heads off)
export function goreOf(wid, dist) {
  const c = calOf(wid); if (!c) return { cls: 'none', k: 0 };
  if (c.gore === 'shotgun') return { cls: 'shotgun', k: dist < 4 ? 2 : dist < 10 ? 1 : 0 };
  if (c.gore === 'rifle') return { cls: 'rifle', k: dist < 8 ? 2 : dist < 25 ? 1 : 0.6 };
  return { cls: c.gore, k: 1 };
}
