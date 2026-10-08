// Tactical kit data: the arsenal, the economy, the match rules. Numbers follow the classic competitive 5v5 bomb game
// (prices, damage, armor penetration, fire rate, magazines, move speed, kill rewards); names are parodies.
// Distances are in metres: 1 classic "unit" = 0.0254 m, so speeds and ranges feel the same.

export const U = 0.0254;  // classic units -> metres

// cat: pistol | smg | heavy | rifle | sniper | knife | zeus | grenade | bomb
// team: T | CT | both. ap = armor penetration (share of damage that still reaches health through kevlar).
// rm = range modifier per 500 units. pen = wall penetration power. inacc = [standing, moving, jumping] spread (radians).
// kick = recoil per shot (radians of view climb), sway = sideways drift once the spray settles.
const W = (id, name, cat, team, price, dmg, ap, rpm, mag, reserve, reload, speed, reward, extra = {}) =>
  ({ id, name, cat, team, price, dmg, ap, rpm, mag, reserve, reload, speed, reward, rm: 0.9, pen: 1, headMult: 4, auto: false,
     inacc: [0.004, 0.03, 0.12], kick: 0.012, sway: 0.006, pellets: 1, ...extra });

export const WEAPONS = [
  // pistols (slot 2)
  W('glock', 'Glonk-18', 'pistol', 'T', 200, 30, 0.47, 400, 20, 120, 2.27, 240, 300, { rm: 0.85, inacc: [0.006, 0.02, 0.1], kick: 0.010, burst: true }),
  W('usp', 'USP-Shh', 'pistol', 'CT', 200, 35, 0.505, 352, 12, 24, 2.2, 240, 300, { rm: 0.99, inacc: [0.003, 0.02, 0.1], kick: 0.014, silenced: true }),
  W('p2000', 'P2Grand', 'pistol', 'CT', 200, 35, 0.505, 352, 13, 52, 2.2, 240, 300, { rm: 0.91, inacc: [0.004, 0.02, 0.1], kick: 0.014 }),
  W('dualies', 'Dual Burritos', 'pistol', 'both', 300, 38, 0.575, 500, 30, 120, 3.8, 240, 300, { rm: 0.79, inacc: [0.008, 0.025, 0.1], kick: 0.012 }),
  W('p250', 'P-250 Pancake', 'pistol', 'both', 300, 38, 0.64, 400, 13, 26, 2.2, 240, 300, { rm: 0.9, inacc: [0.006, 0.025, 0.1], kick: 0.018 }),
  W('tec9', 'Tec-Nein', 'pistol', 'T', 500, 33, 0.906, 500, 18, 90, 2.5, 240, 300, { rm: 0.83, inacc: [0.007, 0.012, 0.1], kick: 0.016 }),
  W('fiveseven', 'Five-Seven-Eleven', 'pistol', 'CT', 500, 32, 0.911, 400, 20, 100, 2.2, 240, 300, { rm: 0.81, inacc: [0.006, 0.02, 0.1], kick: 0.016 }),
  W('cz75', 'CZ75-Oops', 'pistol', 'both', 500, 31, 0.776, 600, 12, 12, 2.7, 240, 100, { rm: 0.85, auto: true, inacc: [0.008, 0.03, 0.1], kick: 0.016 }),
  W('deagle', 'Desert Beagle', 'pistol', 'both', 700, 63, 0.932, 267, 7, 35, 2.2, 230, 300, { rm: 0.81, pen: 2, inacc: [0.004, 0.06, 0.15], kick: 0.06 }),
  W('r8', 'Revolvo R8', 'pistol', 'both', 600, 86, 0.932, 120, 8, 8, 2.3, 220, 300, { rm: 0.94, pen: 2, prime: 0.4, inacc: [0.003, 0.06, 0.15], kick: 0.07 }),
  // smgs (slot 1)
  W('mac10', 'MAC-N-Cheese', 'smg', 'T', 1050, 29, 0.575, 800, 30, 100, 2.6, 240, 600, { rm: 0.8, auto: true, inacc: [0.012, 0.02, 0.1], kick: 0.009, sway: 0.008 }),
  W('mp9', 'MP-Fine', 'smg', 'CT', 1250, 26, 0.6, 857, 30, 120, 2.1, 240, 600, { rm: 0.87, auto: true, inacc: [0.011, 0.02, 0.1], kick: 0.009, sway: 0.007 }),
  W('mp7', 'MP-Heaven', 'smg', 'both', 1500, 29, 0.625, 750, 30, 120, 3.1, 220, 600, { rm: 0.85, auto: true, inacc: [0.009, 0.02, 0.1], kick: 0.008 }),
  W('mp5', 'MP5-Shh', 'smg', 'both', 1500, 27, 0.625, 750, 30, 120, 3.0, 235, 600, { rm: 0.85, auto: true, silenced: true, inacc: [0.009, 0.018, 0.1], kick: 0.008 }),
  W('ump', 'UMP-Plump', 'smg', 'both', 1200, 35, 0.65, 666, 25, 100, 3.5, 230, 600, { rm: 0.75, auto: true, inacc: [0.011, 0.022, 0.1], kick: 0.011 }),
  W('p90', 'P-Ninety Rush', 'smg', 'both', 2350, 26, 0.69, 857, 50, 100, 3.3, 230, 300, { rm: 0.86, auto: true, inacc: [0.012, 0.018, 0.1], kick: 0.007 }),
  W('bizon', 'PP-Bisonte', 'smg', 'both', 1400, 27, 0.575, 750, 64, 120, 2.4, 240, 600, { rm: 0.8, auto: true, inacc: [0.013, 0.022, 0.1], kick: 0.007 }),
  // heavy (slot 1)
  W('nova', 'Nova-caine', 'heavy', 'both', 1050, 26, 0.5, 68, 8, 32, 0.5, 220, 900, { rm: 0.7, pellets: 9, spread: 0.07, inacc: [0.03, 0.04, 0.1], kick: 0.05, shellReload: true }),
  W('xm1014', 'XM-Auto Shotty', 'heavy', 'both', 2000, 20, 0.8, 171, 7, 32, 0.45, 215, 600, { rm: 0.7, pellets: 6, spread: 0.065, auto: true, inacc: [0.03, 0.04, 0.1], kick: 0.04, shellReload: true }),
  W('sawedoff', 'Sawed-Off Granny', 'heavy', 'T', 1100, 32, 0.75, 71, 7, 32, 0.55, 210, 900, { rm: 0.45, pellets: 8, spread: 0.1, inacc: [0.04, 0.05, 0.1], kick: 0.06, shellReload: true }),
  W('mag7', 'MAG-7 Swag', 'heavy', 'CT', 1300, 30, 0.75, 71, 5, 32, 2.5, 225, 900, { rm: 0.45, pellets: 8, spread: 0.06, inacc: [0.03, 0.04, 0.1], kick: 0.06 }),
  W('m249', 'M249 Big Bertha', 'heavy', 'both', 5200, 32, 0.8, 750, 100, 200, 5.7, 195, 300, { rm: 0.97, pen: 2, auto: true, inacc: [0.02, 0.05, 0.15], kick: 0.010, sway: 0.01 }),
  W('negev', 'Ne-Gev Spray', 'heavy', 'both', 1700, 35, 0.71, 800, 150, 300, 5.7, 150, 300, { rm: 0.97, pen: 2, auto: true, inacc: [0.03, 0.05, 0.15], kick: 0.008, sway: 0.01 }),
  // rifles (slot 1)
  W('galil', 'Galilama', 'rifle', 'T', 1800, 30, 0.775, 666, 35, 90, 3.0, 215, 300, { rm: 0.98, pen: 2, auto: true, inacc: [0.005, 0.07, 0.2], kick: 0.011 }),
  W('famas', 'FAMOUS', 'rifle', 'CT', 2050, 30, 0.7, 666, 25, 90, 3.3, 220, 300, { rm: 0.96, pen: 2, auto: true, burst: true, inacc: [0.005, 0.07, 0.2], kick: 0.011 }),
  W('ak47', 'AK-69', 'rifle', 'T', 2700, 36, 0.775, 600, 30, 90, 2.5, 215, 300, { rm: 0.98, pen: 2, auto: true, inacc: [0.0045, 0.09, 0.25], kick: 0.016, sway: 0.008 }),
  W('m4a4', 'M4A4 Freedom Stick', 'rifle', 'CT', 3100, 33, 0.7, 666, 30, 90, 3.1, 225, 300, { rm: 0.97, pen: 2, auto: true, inacc: [0.004, 0.08, 0.25], kick: 0.013, sway: 0.007 }),
  W('m4a1s', 'M4A1-Shh', 'rifle', 'CT', 2900, 38, 0.7, 600, 20, 80, 3.1, 225, 300, { rm: 0.99, pen: 2, auto: true, silenced: true, inacc: [0.0035, 0.08, 0.25], kick: 0.011, sway: 0.006 }),
  W('sg553', 'Krieg-553', 'rifle', 'T', 3000, 30, 1.0, 545, 30, 90, 2.8, 210, 300, { rm: 0.98, pen: 2, auto: true, zoom: [45], inacc: [0.004, 0.09, 0.25], kick: 0.013 }),
  W('aug', 'AUGH', 'rifle', 'CT', 3300, 28, 0.9, 600, 30, 90, 3.8, 220, 300, { rm: 0.98, pen: 2, auto: true, zoom: [45], inacc: [0.004, 0.08, 0.25], kick: 0.011 }),
  // snipers (slot 1)
  W('ssg08', 'Scoutie', 'sniper', 'both', 1700, 88, 0.85, 48, 10, 90, 3.7, 230, 300, { rm: 0.98, pen: 2.5, zoom: [40, 15], inacc: [0.03, 0.12, 0.003], scopedInacc: 0.0015, kick: 0.05, jumpAccurate: true }),
  W('awp', 'A-Whoopee', 'sniper', 'both', 4750, 115, 0.975, 41, 5, 30, 3.7, 200, 100, { rm: 0.99, pen: 3, zoom: [40, 10], inacc: [0.06, 0.2, 0.4], scopedInacc: 0.0008, kick: 0.07, scopedSpeed: 100 }),
  W('g3sg1', 'G3-Autonoob', 'sniper', 'T', 5000, 80, 0.825, 240, 20, 90, 4.7, 215, 300, { rm: 0.98, pen: 2.5, auto: true, zoom: [40, 15], inacc: [0.04, 0.15, 0.3], scopedInacc: 0.002, kick: 0.03 }),
  W('scar20', 'SCAR-20 Autonoob', 'sniper', 'CT', 5000, 80, 0.825, 240, 20, 90, 3.1, 215, 300, { rm: 0.98, pen: 2.5, auto: true, zoom: [40, 15], inacc: [0.04, 0.15, 0.3], scopedInacc: 0.002, kick: 0.03 }),
  // knife, taser
  W('knife', 'Knife', 'knife', 'both', 0, 40, 0.85, 150, 0, 0, 0, 250, 1500, { range: 1.6, heavy: 65, backstab: [90, 180] }),
  W('zeus', 'Zap-27', 'zeus', 'both', 200, 500, 1.0, 30, 1, 0, 0, 220, 0, { range: 4.5, inacc: [0.01, 0.02, 0.05], kick: 0.02 }),
];

export const GRENADES = [
  { id: 'he', name: 'Boom Ball (HE)', price: 300, team: 'both', max: 1, dmg: 98, radius: 350 * U, fuse: 1.6 },
  { id: 'flash', name: 'Flashbang', price: 200, team: 'both', max: 2, fuse: 1.6 },
  { id: 'smoke', name: 'Smoke', price: 300, team: 'both', max: 1, fuse: 1.6, last: 18, radius: 144 * U },
  { id: 'molotov', name: 'Molotov Cocktail', price: 400, team: 'T', max: 1, fuse: 2.0, last: 7, radius: 120 * U, dps: 40 },
  { id: 'incendiary', name: 'Spicy Grenade', price: 600, team: 'CT', max: 1, fuse: 2.0, last: 7, radius: 120 * U, dps: 40 },
  { id: 'decoy', name: 'Decoy (fake pew pew)', price: 50, team: 'both', max: 1, fuse: 2.0, last: 15 },
];
export const MAX_GRENADES = 4;

export const GEAR = [
  { id: 'vest', name: 'Kevlar Vest', price: 650 },
  { id: 'vesthelm', name: 'Kevlar + Helmet', price: 1000 },
  { id: 'defuser', name: 'Defuse Kit', price: 400, team: 'CT' },
];

export const BUY_MENU = [  // the buy menu's categories, in order (team-specific items are filtered at runtime)
  { key: 'pistol', name: 'Pistols', items: ['glock', 'usp', 'p2000', 'dualies', 'p250', 'tec9', 'fiveseven', 'cz75', 'deagle', 'r8'] },
  { key: 'heavy', name: 'Heavy', items: ['nova', 'xm1014', 'sawedoff', 'mag7', 'm249', 'negev'] },
  { key: 'smg', name: 'SMGs', items: ['mac10', 'mp9', 'mp7', 'mp5', 'ump', 'p90', 'bizon'] },
  { key: 'rifle', name: 'Rifles', items: ['galil', 'famas', 'ak47', 'm4a4', 'm4a1s', 'sg553', 'aug', 'ssg08', 'awp', 'g3sg1', 'scar20'] },
  { key: 'gear', name: 'Gear', items: ['vest', 'vesthelm', 'defuser', 'zeus'] },
  { key: 'grenade', name: 'Grenades', items: ['molotov', 'incendiary', 'decoy', 'flash', 'smoke', 'he'] },
];

export const W_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
export const G_BY_ID = Object.fromEntries(GRENADES.map((g) => [g.id, g]));
export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g]));
export const itemPrice = (id) => (W_BY_ID[id] || G_BY_ID[id] || GEAR_BY_ID[id] || {}).price || 0;
export const itemName = (id) => (W_BY_ID[id] || G_BY_ID[id] || GEAR_BY_ID[id] || { name: id }).name;
export const slotOf = (id) => {
  const w = W_BY_ID[id]; if (!w) return G_BY_ID[id] ? 4 : id === 'c4' ? 5 : 0;
  return w.cat === 'pistol' ? 2 : w.cat === 'knife' ? 3 : w.cat === 'zeus' ? 6 : 1;  // the taser sits next to the knife (press 3 twice)
};
export const forTeam = (item, team) => { const x = W_BY_ID[item] || G_BY_ID[item] || GEAR_BY_ID[item]; return !!x && (!x.team || x.team === 'both' || x.team === team); };

// the economy
export const ECON = {
  start: 800, max: 16000,
  winElim: 3250, winBomb: 3500, winDefuse: 3500, winTime: 3250,
  lossBonus: [1400, 1900, 2400, 2900, 3400],
  plantedLossBonus: 800, plantReward: 300, defuseReward: 300,
  teamKillPenalty: -300,
};

// match modes. bomb: false = straight combat (round timer running out with both alive is a draw)
export const MODES = {
  '1v1': { name: '1v1 Duel', size: 1, bomb: false, winTo: 9, half: 8, freeze: 5, round: 75, buyTime: 15, start: 800 },
  '2v2': { name: '2v2 Wingmen', size: 2, bomb: true, winTo: 9, half: 8, freeze: 10, round: 90, buyTime: 20, bombSite: 'A' },
  '3v3': { name: '3v3 Trios', size: 3, bomb: true, winTo: 13, half: 12, freeze: 12, round: 105, buyTime: 20 },
  '5v5': { name: '5v5 Competitive', size: 5, bomb: true, winTo: 16, half: 15, freeze: 15, round: 115, buyTime: 20 },
};
export const BOMB = { timer: 40, plant: 3.2, defuse: 10, defuseKit: 5, radius: 500 * U, dmg: 500 };

// player physics (classic numbers in metres)
export const PHYS = {
  speed: 250 * U, walk: 0.52, crouch: 0.34, accel: 5.5, friction: 5.2, stop: 80 * U, airAccel: 12,
  gravity: 800 * U, jump: 301.993 * U, height: 72 * U, crouchHeight: 54 * U, eye: 64 * U, crouchEye: 46 * U, radius: 16 * U, step: 18 * U,
  hp: 100,
};

// bot difficulty, picked by the host
export const BOT_LEVELS = {
  easy: { name: 'Easy', react: 0.75, aimErr: 0.09, turn: 3.5, head: 0.05, spray: 0.4, burst: 4 },
  normal: { name: 'Normal', react: 0.45, aimErr: 0.05, turn: 6, head: 0.14, spray: 0.65, burst: 6 },
  hard: { name: 'Hard', react: 0.28, aimErr: 0.028, turn: 9, head: 0.28, spray: 0.85, burst: 8 },
  expert: { name: 'Expert', react: 0.17, aimErr: 0.015, turn: 14, head: 0.45, spray: 0.95, burst: 10 },
};

export const RADIO = {
  z: ['Go go go!', 'Fall back!', 'Stick together!', 'Hold this position.', 'Follow me.', 'Taking fire, need help!'],
  x: ['Roger that.', 'Negative.', 'Enemy spotted.', 'Need backup.', 'Sector clear.', "I'm in position."],
  c: ['Affirmative.', 'Enemy down.', 'Report in.', 'Bomb spotted!', 'Thanks!', 'Nice shot!'],
};

// damage a hit does, after distance falloff, hit group and armor (the classic formula)
export function damageFor(w, dist, group, armor, helmet, penLeft = 1) {
  let d = w.dmg * Math.pow(w.rm, dist / U / 500) * penLeft;
  const mult = group === 'head' ? w.headMult : group === 'stomach' ? 1.25 : group === 'legs' ? 0.75 : 1;
  d *= mult;
  let toArmor = 0;
  const armored = armor > 0 && (group !== 'legs') && (group !== 'head' || helmet);
  if (armored) {
    const hp = d * w.ap; toArmor = (d - hp) * 0.5;
    if (toArmor > armor) { const over = toArmor - armor; toArmor = armor; d = hp + over * 2; } else d = hp;
  }
  return { hp: Math.max(1, Math.floor(d)), armor: Math.floor(toArmor) };
}
