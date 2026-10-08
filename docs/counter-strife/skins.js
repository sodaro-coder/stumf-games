// Cosmetics: weapon finishes, knives, agents (player models) and the crates they drop from. Every finish is painted
// procedurally from a recipe (no image files): a pattern, a palette, a seed, then wear scratches by the float.
// Rarity: Common, Uncommon, Rare, Epic, Legendary, Funny and Mythic (the two rarest, same odds). Mythic finishes and
// outfits glow and animate, and have their own inspect. Odds are shown on every crate. Crates open with coins earned in-game only.
import { WEAPONS } from './data.js';

export const RARITY = [  // index = tier; Funny and Mythic are the rarest
  { key: 'common', name: 'Common', color: '#b0c3d9', odds: 69.8, value: 20 },
  { key: 'uncommon', name: 'Uncommon', color: '#5ec65e', odds: 20, value: 60 },
  { key: 'rare', name: 'Rare', color: '#4b69ff', odds: 6.5, value: 200 },
  { key: 'epic', name: 'Epic', color: '#9b47ff', odds: 2.5, value: 700 },
  { key: 'legendary', name: 'Legendary', color: '#e4ae39', odds: 0.8, value: 2500 },
  { key: 'funny', name: 'Funny', color: '#ff4fd8', odds: 0.2, value: 6000 },
  { key: 'mythic', name: 'Mythic', color: '#ff2e4c', odds: 0.2, value: 6000 },
];
export const MYTHIC = 6;
export const isMythic = (it) => { const d = it && ITEM_BY_ID[it.def]; return !!d && d.tier === MYTHIC; };
export const WEARS = [  // float ranges
  { key: 'FN', name: 'Factory New', max: 0.07, mult: 1.5 }, { key: 'MW', name: 'Minimal Wear', max: 0.15, mult: 1.15 },
  { key: 'FT', name: 'Field-Tested', max: 0.38, mult: 1 }, { key: 'WW', name: 'Well-Worn', max: 0.45, mult: 0.85 },
  { key: 'BS', name: 'Battle-Scarred', max: 1, mult: 0.7 },
];
export const wearOf = (f) => WEARS.find((w) => f < w.max) || WEARS[4];

// ---- knives (★): classic shapes and joke shapes. model = the shape models.js builds ----
export const KNIVES = [
  { id: 'k_bayonet', name: '★ Pokey Stick', model: 'bayonet' }, { id: 'k_karambit', name: '★ Curvy Boi', model: 'karambit' },
  { id: 'k_butterfly', name: '★ Flippy Flappy', model: 'butterfly' }, { id: 'k_hotdog', name: '★ Hot Dog', model: 'hotdog', joke: true },
  { id: 'k_dildo', name: '★ Dildo Saber', model: 'dildo', joke: true }, { id: 'k_plunger', name: '★ Toilet Plunger', model: 'plunger', joke: true },
  { id: 'k_chicken', name: '★ Rubber Chicken', model: 'chicken', joke: true }, { id: 'k_baguette', name: '★ Le Baguette', model: 'baguette', joke: true },
  { id: 'k_fish', name: '★ Salmon Slapper', model: 'fish', joke: true }, { id: 'k_banana', name: '★ Banana Blade', model: 'banana', joke: true },
  { id: 'k_flip', name: '★ Flipper', model: 'default' }, { id: 'k_gut', name: '★ Gut Puncher', model: 'karambit' }, { id: 'k_hunts', name: '★ Huntsperson', model: 'bayonet' },
];

export const KNIFE_BY_ID = Object.fromEntries(KNIVES.map((k) => [k.id, k]));

// ---- agents (player models). look = the body recipe models.js builds ----
export const AGENTS = [
  { id: 'a_t_default', name: 'Desert Rebel', team: 'T', tier: -1, look: { body: '#7a6a4a', legs: '#4e4636', head: '#c89a74', hat: 'balaclava', hatColor: '#2c2a26' } },
  { id: 'a_ct_default', name: 'Task Force Gary', team: 'CT', tier: -1, look: { body: '#3c4e66', legs: '#2c3442', head: '#e0b896', hat: 'helmet', hatColor: '#2a3646' } },
  { id: 'a_t_ops', name: 'Sand Ops Specialist', team: 'T', tier: 2, look: { body: '#8a5a3a', legs: '#3a3026', head: '#b48264', hat: 'shemagh', hatColor: '#d8c6a0' } },
  { id: 'a_ct_swat', name: 'SWAT Sergeant Kevin', team: 'CT', tier: 2, look: { body: '#1e242c', legs: '#16191e', head: '#d8a888', hat: 'helmet', hatColor: '#111', visor: true } },
  { id: 'a_t_speedo', name: 'Speedo Steve', team: 'T', tier: 3, look: { body: '#e8b48e', legs: '#e8b48e', head: '#e8b48e', speedo: '#2246d8', hat: 'none', belly: true } },
  { id: 'a_ct_tighty', name: 'Tighty Whitey Tim', team: 'CT', tier: 3, look: { body: '#f0c8a8', legs: '#f0c8a8', head: '#f0c8a8', speedo: '#ffffff', hat: 'cap', hatColor: '#c22' } },
  { id: 'a_t_hotdog', name: 'Hot Dog Suit Guy', team: 'T', tier: 4, look: { body: '#c8462e', legs: '#e8b060', head: '#c8462e', hat: 'bun', hatColor: '#e8b060', mustard: true } },
  { id: 'a_ct_poo', name: 'Mr. Poo', team: 'CT', tier: 5, look: { body: '#6b4423', legs: '#5a381c', head: '#6b4423', hat: 'swirl', hatColor: '#6b4423', eyes: true } },
  { id: 'a_t_grandma', name: 'Grandma in Curlers', team: 'T', tier: 3, look: { body: '#e48ab4', legs: '#d8d0c0', head: '#e8c4a8', hat: 'curlers', hatColor: '#7ac8ff' } },
  { id: 'a_ct_pigeon', name: 'Agent Pigeon', team: 'CT', tier: 4, look: { body: '#8a8f9a', legs: '#e08a5a', head: '#6a7080', hat: 'beak', hatColor: '#e0a040', eyes: true } },
  { id: 'a_t_banana', name: 'Banana Bandit', team: 'T', tier: 2, look: { body: '#f2d33c', legs: '#d8b42a', head: '#f2d33c', hat: 'stem', hatColor: '#5a3a1a', eyes: true } },
  { id: 'a_ct_mime', name: 'Mime Negotiator', team: 'CT', tier: 2, look: { body: '#f4f4f4', legs: '#111', head: '#ffffff', hat: 'beret', hatColor: '#111', stripes: true } },
  // Mythic: glowing, animated outfits (energy veins crawl over the uniform)
  { id: 'a_t_reactor', name: 'Reactor Core Ronnie', team: 'T', tier: 6, look: { body: '#24302a', legs: '#1a201c', head: '#c89a74', hat: 'balaclava', hatColor: '#111', glow: '#5cff6a', glowT: 'circuit' } },
  { id: 'a_ct_plasma', name: 'Plasma Daddy', team: 'CT', tier: 6, look: { body: '#1c1f30', legs: '#14161f', head: '#e0b896', hat: 'helmet', hatColor: '#151826', glow: '#2ad8ff', glowT: 'hex' } },
  { id: 'a_t_lava', name: 'Hot Lava Larry', team: 'T', tier: 6, look: { body: '#2a1a14', legs: '#1c120e', head: '#b48264', hat: 'shemagh', hatColor: '#3a2418', glow: '#ff6a1a', glowT: 'web' } },
  { id: 'a_ct_void', name: 'Void Boi 9000', team: 'CT', tier: 6, look: { body: '#16121f', legs: '#0f0c16', head: '#d8a888', hat: 'helmet', hatColor: '#0f0c16', visor: true, glow: '#c04aff', glowT: 'galaxy' } },
];

// ---- emotes (everyone in the match sees them; your camera pulls back to third person while it plays) ----
export const EMOTES = [
  { id: 'e_wave', name: 'Hey Bestie', anim: 'wave', tier: 0 }, { id: 'e_salute', name: 'Respectful Salute', anim: 'salute', tier: 0 },
  { id: 'e_dance', name: 'Dad Dance', anim: 'dance', tier: 1 }, { id: 'e_dab', name: 'Dab (2016 called)', anim: 'dab', tier: 1 },
  { id: 'e_cry', name: 'Ugly Cry', anim: 'cry', tier: 1 }, { id: 'e_flex', name: 'Gym Bro Flex', anim: 'flex', tier: 2 },
  { id: 'e_tpose', name: 'T-Pose Dominance', anim: 'tpose', tier: 2 }, { id: 'e_floss', name: 'Floss', anim: 'floss', tier: 2 },
  { id: 'e_chicken', name: 'Chicken Dance', anim: 'chicken', tier: 3 }, { id: 'e_worm', name: 'The Worm', anim: 'worm', tier: 4 },
  { id: 'e_fart', name: 'Crop Duster', anim: 'fart', tier: 5 }, { id: 'e_twerk', name: 'Twerk Attack', anim: 'twerk', tier: 5 },
];
export const EMOTE_BY_ID = Object.fromEntries(EMOTES.map((e) => [e.id, e]));
export const DEFAULT_EMOTES = ['e_wave', 'e_salute'];

// ---- finishes. paint = recipe; the same finish can exist on several weapons ----
const F = (name, paint) => ({ name, paint });
const SERIOUS = {
  milspec: [F('Sand Dune', { t: 'camo', c: ['#c8b07a', '#a48a58', '#e0cc98'] }), F('Night Ops', { t: 'camo', c: ['#2a2e36', '#41464f', '#1a1c20'] }),
    F('Forest Floor', { t: 'camo', c: ['#4a5a32', '#6a5434', '#2a3420'] }), F('Safety Orange', { t: 'solid', c: ['#e86a1a', '#1a1a1a'] }),
    F('Urban Grid', { t: 'checker', c: ['#8a8f98', '#5a5f68'] }), F('Blue Steel', { t: 'solid', c: ['#4a6a9a', '#2a3a5a'] })],
  restricted: [F('Tiger Tooth', { t: 'tiger', c: ['#e8a020', '#1a1208'] }), F('Hex Core', { t: 'hex', c: ['#1c2430', '#38c8ff'] }),
    F('Circuit Board', { t: 'circuit', c: ['#0e3a24', '#5cff9a'] }), F('Red Laminate', { t: 'marble', c: ['#9a2222', '#e8c8a0'] }),
    F('Damascus', { t: 'damascus', c: ['#8a8f98', '#3a3e46'] })],
  classified: [F('Neon Revolt', { t: 'geo', c: ['#ff2a6a', '#1a1a1a', '#2affd2'] }), F('Galaxy Brain', { t: 'galaxy', c: ['#120a2a', '#8a5aff', '#ffffff'] }),
    F('Hellfire', { t: 'flames', c: ['#1a0a06', '#ff5a1a', '#ffd23a'] })],
  covert: [F('Asii-Not-Mov', { t: 'geo', c: ['#f2f2f2', '#ff7a1a', '#1a1a1a'] }), F('Wyvern Lore', { t: 'scales', c: ['#2a6a3a', '#e8c040', '#0a1a10'] }),
    F('Fire Serpent-ish', { t: 'flames', c: ['#1a3a1a', '#e8a020', '#8a1a1a'] })],
};
const CRUDE = {
  milspec: [F('Skidmark', { t: 'smear', c: ['#f4f0e8', '#6b4423'] }), F('Fart Cloud', { t: 'clouds', c: ['#b8c870', '#8a9a40'] }),
    F('Tighty Whities', { t: 'solid', c: ['#f8f8f2', '#c8c8c0'] }), F('Granny Panties', { t: 'dots', c: ['#f4c4d4', '#ffffff'] }),
    F('Gas Station Sushi', { t: 'marble', c: ['#e88a6a', '#f4f0e0'] })],
  restricted: [F('Diarrhea Fade', { t: 'fade', c: ['#6b4423', '#a87a3a', '#e8c070'] }), F('BRRRRT', { t: 'text', c: ['#1a1a1a', '#ffd23a'], s: 'BRRRT' }),
    F('Hot Dog Water', { t: 'hotdogs', c: ['#f2d8a0', '#c8462e'] }), F('Pee Yellow', { t: 'fade', c: ['#f8f4a0', '#e8d040', '#c8a020'] })],
  classified: [F('Poop Emoji Party', { t: 'poops', c: ['#7ad0ff', '#6b4423'] }), F('Mom\'s Spaghetti', { t: 'smear', c: ['#e8d0a0', '#c8321e'] }),
    F('Thicc Boi', { t: 'text', c: ['#ff5ab4', '#ffffff'], s: 'THICC' })],
  covert: [F('Dong Doppler', { t: 'wave', c: ['#ff4ad2', '#7a2aff', '#2ad2ff'] }), F('Golden Shower', { t: 'fade', c: ['#fff3a0', '#e8b020', '#8a5a10'] })],
};
const NUKE = {
  milspec: [F('Glow Lawn', { t: 'camo', c: ['#7aff4a', '#3a8a2a', '#1a3a10'] }), F('Hazmat', { t: 'stripes', c: ['#f2d33c', '#1a1a1a'] }),
    F('Picket Fence', { t: 'stripes', c: ['#f4f4f0', '#c8c4b8'] })],
  restricted: [F('Fallout Fade', { t: 'fade', c: ['#1a3a10', '#7aff4a', '#e8ff9a'] }), F('Duck & Cover', { t: 'dots', c: ['#f2d33c', '#1a1a1a'] })],
  classified: [F('Half-Life Hex', { t: 'hex', c: ['#1a1a1a', '#7aff4a'] }), F('Mushroom Cloud', { t: 'clouds', c: ['#f4e0b0', '#c87a3a'] })],
  covert: [F('Chernobyl Sunset', { t: 'wave', c: ['#ff7a1a', '#ff2a6a', '#3a0a3a'] })],
};
const KNIFE_FINISHES = [F('Vanilla', { t: 'solid', c: ['#a8adb6', '#6a6e76'] }), F('Fade', { t: 'fade', c: ['#ffd23a', '#ff4ad2', '#7a2aff'] }),
  F('Doppler', { t: 'wave', c: ['#2a0a4a', '#d24aff', '#2ad2ff'] }), F('Tiger Tooth', { t: 'tiger', c: ['#e8a020', '#1a1208'] }),
  F('Crimson Web', { t: 'web', c: ['#8a1a1a', '#1a0a0a'] }), F('Marble Fade', { t: 'marble', c: ['#2a6aff', '#ffd23a'] })];

// Mythic gun finishes: one per case. A dark base with neon veins that glow, pulse and crawl along the gun.
// glow = the light colour, g = the vein pattern that moves (any paint pattern, drawn bright-on-black)
const M = (name, t, c, glow, g) => ({ name, paint: { t, c, glow, g: g || t } });
const MYTHIC_FIN = {
  sand: M('Nuclear Swamp Ass', 'circuit', ['#0c1410', '#1f3a24'], '#6aff5a'), toilet: M('Radioactive Shart', 'smear', ['#120d08', '#3a2a14'], '#a8ff2a', 'circuit'),
  nuke: M('Chernobyl Nutsack', 'hex', ['#0a1408', '#18301a'], '#7aff4a'), dust2: M('Sand In My Crack', 'flames', ['#140c06', '#3a2410', '#5a3414'], '#ffb02a', 'web'),
  neon: M('Rave Boner', 'geo', ['#0a0614', '#2a0a3a', '#0a2a3a'], '#ff2ad2', 'wave'), farm: M('Glowing Cow Pie', 'camo', ['#140e08', '#2a1c10', '#1c140a'], '#ffd23a', 'circuit'),
  ocean: M('Bioluminescent Booty', 'wave', ['#020a14', '#06182a', '#0a2440'], '#2affe0', 'web'), gamer: M('RGB Hemorrhoids', 'circuit', ['#08080c', '#14141e'], '#2aff6a', 'circuit'),
  space: M('Uranus Glow', 'galaxy', ['#05030f', '#1a0a3a', '#ffffff'], '#b04aff', 'galaxy'), jungle: M('Monkey Fling Neon', 'tiger', ['#0a1406', '#020402'], '#9aff2a', 'tiger'),
  winter: M('Yellow Snow Reactor', 'marble', ['#0a1018', '#1a2a3a'], '#f8ff4a', 'web'), candy: M('Sugar Shits', 'dots', ['#140a14', '#3a1a3a'], '#ff6ad2', 'hex'),
  military: M('Night Vision Wedgie', 'camo', ['#060a06', '#0e160e', '#0a120a'], '#4aff4a', 'circuit'), gas: M('Truck Stop Toilet Glow', 'stripes', ['#0e0a08', '#1e1610'], '#ff8a2a', 'wave'),
  retro: M('Lava Lamp Lube', 'wave', ['#14060a', '#2a0a14', '#3a1a06'], '#ff4a8a', 'web'), spooky: M('Ecto-Snot', 'web', ['#060a08', '#0a1a10'], '#6aff9a', 'web'),
  royal: M('Royal Flush (Literally)', 'damascus', ['#0e0a14', '#2a1a3a'], '#ffd24a', 'damascus'), toxic: M('Glowing Booger', 'smear', ['#081006', '#1a3a10'], '#a8ff2a', 'hex'),
  office: M('Printer Ink Diarrhea', 'smear', ['#06080e', '#101830'], '#4a8aff', 'circuit'), fastfood: M('Radioactive Nugget', 'dots', ['#140c04', '#2a1a08'], '#ffb02a', 'hex'),
  beach: M('Jellyfish Pee', 'wave', ['#04101a', '#082030', '#0a2a3a'], '#4affff', 'wave'), metal: M('Face Melter Deluxe', 'flames', ['#0a0404', '#3a0a06', '#6a1a0a'], '#ff3a1a', 'flames'),
  dino: M('Raptor Dookie Plasma', 'scales', ['#0a0e06', '#1a2a0e', '#050805'], '#c8ff3a', 'scales'), clown: M('Clown Fart Rave', 'geo', ['#0a0a12', '#2a0a14', '#0a1a2a'], '#ff3a3a', 'wave'),
};
const MYTHIC_GUNS = ['ak47', 'm4a4', 'awp', 'deagle', 'm4a1s', 'usp', 'glock', 'p90'];

const pick = (list, n, seed) => { const a = list.slice(); let s = seed; const out = []; while (out.length < n && a.length) { s = (s * 9301 + 49297) % 233280; out.push(a.splice(Math.floor(s / 233280 * a.length), 1)[0]); } return out; };
const GUNS = WEAPONS.filter((w) => w.cat !== 'knife' && w.cat !== 'zeus').map((w) => w.id);
const STAR_GUNS = ['ak47', 'm4a4', 'awp', 'deagle', 'm4a1s', 'usp', 'glock', 'p90', 'ssg08', 'mac10'];
// The first three cases (their item ids must never change: players own them). Old tiers map onto the new ladder.
const OLD_TIER = { milspec: 0, restricted: 1, classified: 2, covert: 3 };
function makeCrate(id, name, desc, theme, seed, knives, price) {
  const items = [];
  ['milspec', 'restricted', 'classified', 'covert'].forEach((key, k) => {
    const fins = theme[key] || [];
    const guns = pick(GUNS, fins.length, seed + k * 31);
    fins.forEach((f, j) => items.push({ id: `${id}:${guns[j]}:${f.name}`, kind: 'skin', weapon: guns[j], finish: f.name, paint: f.paint, tier: OLD_TIER[key] }));
  });
  for (const k of knives) for (const f of KNIFE_FINISHES) items.push({ id: `${id}:${k}:${f.name}`, kind: 'knife', weapon: k, finish: f.name, paint: f.paint, tier: KNIFE_BY_ID[k].joke ? 5 : 4 });
  return { id, name, desc, price, items };
}
// The other cases: a theme = palette + 15 finish names (5 Common, 4 Uncommon, 3 Rare, 2 Epic, 1 Legendary gun),
// two classic knives (Legendary) and a joke knife (Funny). Ids are crate:weapon:finish, fixed forever once shipped.
const PAT = [['camo', 'solid', 'checker', 'stripes', 'dots'], ['tiger', 'hex', 'circuit', 'marble', 'damascus'], ['geo', 'galaxy', 'flames', 'scales', 'web'], ['fade', 'wave'], ['wave']];
function themedCrate(n, id, name, desc, pal, names, knives, joke, price = 250) {
  const items = [], counts = [5, 4, 3, 2, 1];
  let k = 0;
  counts.forEach((c, tier) => {
    const pool = tier >= 3 ? STAR_GUNS : GUNS, guns = pick(pool, c, 101 + n * 17 + tier * 7);
    for (let j = 0; j < c; j++, k++) {
      const t = PAT[tier][(j + n) % PAT[tier].length], c0 = pal[(j + tier) % pal.length], c1 = pal[(j + tier + 1) % pal.length], c2 = pal[(j + tier + 2) % pal.length];
      items.push({ id: `${id}:${guns[j]}:${names[k]}`, kind: 'skin', weapon: guns[j], finish: names[k], paint: { t, c: tier >= 3 ? [c0, c1, c2] : [c0, c1, c2] }, tier });
    }
  });
  const kf = [F('Vanilla', { t: 'solid', c: ['#a8adb6', '#6a6e76'] }), F(names[15] || 'Case Hardened', { t: 'fade', c: [pal[0], pal[1], pal[2]] }), F(names[16] || 'Night Shift', { t: 'web', c: [pal[3] || pal[0], '#111111'] })];
  for (const kn of knives) for (const f of kf) items.push({ id: `${id}:${kn}:${f.name}`, kind: 'knife', weapon: kn, finish: f.name, paint: f.paint, tier: 4 });
  for (const f of kf.slice(1)) items.push({ id: `${id}:${joke}:${f.name}`, kind: 'knife', weapon: joke, finish: f.name, paint: f.paint, tier: 5 });
  return { id, name, desc, price, items };
}
const THEMES = [
  ['dust2', 'Abbottabad Case', 'Sand, sun and a guy hiding in a closet.', ['#d8b878', '#8a6a3a', '#2a2018', '#f2e2b8'],
    ['Dune Buggy', 'Goat Herder', 'Courtyard', 'Compound Wall', 'Dialysis Beige', 'VHS Tape', 'Cave Painting', 'Long A', 'Mid Doors', 'Hide & Seek', 'Last Known Address', 'Satellite Dish', 'Navy Night', 'Hiding Spot', 'Most Wanted', 'Desert Heat', 'Closet Dark'], ['k_bayonet', 'k_flip'], 'k_chicken'],
  ['neon', 'Neon Nightmare Case', 'Too bright to look at directly.', ['#ff2a6a', '#2affd2', '#7a2aff', '#0a0a1a'],
    ['Glowstick', 'Rave Leftovers', 'Club Bathroom', 'Laser Tag', 'Arcade Carpet', 'Synthwave', 'Pixel Burn', 'VHS Glitch', 'Night Drive', 'Cyber Shrimp', 'Overclocked', 'Retina Damage', 'Neon Genesis', 'Afterparty', 'Blacklight Poster', 'Electric Fade', 'Static'], ['k_karambit', 'k_butterfly'], 'k_dildo'],
  ['farm', 'Barnyard Case', 'Smells like the farm.', ['#8a5a2a', '#e8c040', '#4a8a3a', '#c8462e'],
    ['Hay Bale', 'Pig Pen', 'Muddy Boots', 'Red Barn', 'Corn Field', 'Tractor Pull', 'Moo Point', 'Chicken Coop', 'Scarecrow', 'Hen Party', 'County Fair', 'Prize Pumpkin', 'Cow Tipper', 'Golden Egg', 'Farmers Only', 'Butter Churn', 'Manure Glaze'], ['k_gut', 'k_hunts'], 'k_chicken'],
  ['ocean', 'Deep Sea Case', 'Wet, salty, possibly haunted.', ['#0a3a6a', '#2ad2ff', '#e8f4ff', '#0a1a2a'],
    ['Tide Pool', 'Kelp Forest', 'Shipwreck', 'Barnacle', 'Sea Foam', 'Riptide', 'Anglerfish', 'Coral Bleach', 'Jellyfish', 'Kraken Ink', 'Abyssal', 'Moby Dick', 'Davy Jones', 'Mermaid Scales', 'Poseidon', 'Low Tide', 'Ink Cloud'], ['k_bayonet', 'k_karambit'], 'k_fish'],
  ['gamer', 'Gamer Moment Case', 'Sponsored by energy drinks.', ['#2aff6a', '#1a1a1a', '#ff2ad2', '#2a6aff'],
    ['RGB Keyboard', 'Cheeto Dust', 'Rage Quit', 'Mountain Dew', 'Lag Spike', 'Ping 999', 'Ranked Anxiety', 'Smurf Account', 'Tryhard', 'Sweatband', 'Clutch or Kick', 'Headset Hair', 'Diamond Hands', 'Uninstalled', 'Main Character', 'Gamer Fuel', 'Touch Grass'], ['k_flip', 'k_butterfly'], 'k_banana'],
  ['space', 'Orbital Case', 'One small step for man, one giant drop rate.', ['#0a0a2a', '#8a5aff', '#ffffff', '#ff7a1a'],
    ['Moon Dust', 'Space Junk', 'Launch Pad', 'Zero G', 'Freeze Dried', 'Nebula', 'Asteroid Belt', 'Red Planet', 'Black Hole', 'Supernova', 'Event Horizon', 'Alien Probe', 'Big Bang', 'Light Year', 'Cosmic Brain', 'Star Fade', 'Dark Matter'], ['k_karambit', 'k_gut'], 'k_dildo'],
  ['jungle', 'Jungle Rot Case', 'Humid. Very humid.', ['#2a5a1a', '#8ac83a', '#5a3a1a', '#e8d040'],
    ['Leaf Litter', 'Swamp Gas', 'Monkey Business', 'Vine Swing', 'Mosquito Bite', 'Python', 'Rainforest', 'Poison Dart', 'Temple Run', 'Jaguar', 'Lost Idol', 'Golden Temple', 'Apex Predator', 'Canopy', 'El Dorado', 'Jungle Fade', 'Shade'], ['k_hunts', 'k_bayonet'], 'k_banana'],
  ['winter', 'Frostbite Case', 'Lick the flagpole. We dare you.', ['#e8f4ff', '#8ac8ff', '#2a4a7a', '#ffffff'],
    ['Snowplow', 'Slush', 'Ice Fishing', 'Sleet', 'Igloo', 'Frost Bite', 'Avalanche', 'Polar Vortex', 'Yeti', 'Blizzard', 'Black Ice', 'Northern Lights', 'Absolute Zero', 'Frozen Over', 'Ice Queen', 'Glacier', 'Polar Night'], ['k_flip', 'k_karambit'], 'k_fish'],
  ['candy', 'Sugar Rush Case', 'Dentists hate this case.', ['#ff8ad2', '#8ad2ff', '#fff28a', '#ff4a4a'],
    ['Bubblegum', 'Cotton Candy', 'Gummy Bear', 'Rock Candy', 'Sprinkles', 'Jawbreaker', 'Sour Patch', 'Candy Cane', 'Jelly Bean', 'Sugar Crash', 'Rotten Tooth', 'Gingerbread', 'Diabetes', 'Lollipop', 'Willy\'s Factory', 'Candy Fade', 'Licorice'], ['k_butterfly', 'k_gut'], 'k_hotdog'],
  ['military', 'Surplus Store Case', 'Bought it at a garage sale.', ['#4a5a32', '#6a5434', '#2a2a22', '#c8b07a'],
    ['Olive Drab', 'MRE', 'Boot Camp', 'Sandbag', 'Field Jacket', 'Ammo Crate', 'Dog Tags', 'Night Vision', 'Kevlar', 'Drill Sergeant', 'Desert Storm', 'Purple Heart', 'Five Star', 'Classified Intel', 'Medal of Honor', 'Gunmetal', 'Blackout'], ['k_bayonet', 'k_hunts'], 'k_plunger'],
  ['gas', 'Gas Station Case', 'Found behind the hot dog roller.', ['#e8402a', '#f2d33c', '#2a6aff', '#f4f4f0'],
    ['Slushie Brain', 'Scratch Ticket', 'Beef Jerky', 'Pump 4', 'Air Freshener', 'Roller Grill', 'Lottery Loser', 'Truck Stop', 'Energy Shot', 'Lot Lizard', 'Midnight Burrito', 'Gas Leak', 'Premium Unleaded', 'Bathroom Key', 'Ultimate Shift', 'Fuel Fade', 'Oil Slick'], ['k_flip', 'k_gut'], 'k_hotdog'],
  ['retro', 'Retro Rewind Case', 'Be kind, rewind.', ['#ff7a1a', '#ffd23a', '#2a8aff', '#3a1a4a'],
    ['Shag Carpet', 'Lava Lamp', 'Cassette', 'Floppy Disk', 'Wood Panel', 'Disco Ball', 'Mixtape', 'Mullet', 'Dial-Up', 'Roller Rink', 'Boombox', 'Tamagotchi', 'Y2K Panic', 'Blockbuster', 'Totally Radical', 'Sunset Fade', 'Rewind'], ['k_karambit', 'k_bayonet'], 'k_baguette'],
  ['spooky', 'Spooky Scary Case', 'Skeletons sold separately.', ['#ff7a1a', '#1a1a1a', '#8a2aff', '#e8f0d0'],
    ['Pumpkin Spice', 'Cobweb', 'Graveyard Shift', 'Candy Corn', 'Bat Cave', 'Ectoplasm', 'Haunted Doll', 'Witch Brew', 'Full Moon', 'Possessed', 'Poltergeist', 'Bone Daddy', 'Grim Reaper', 'Sleep Paralysis', 'The Final Boss', 'Ghost Fade', 'Midnight'], ['k_gut', 'k_butterfly'], 'k_banana'],
  ['royal', 'Royal Tea Case', 'Pinkies up, peasants.', ['#8a1a3a', '#e4ae39', '#1a1a4a', '#f4f0e0'],
    ['Crumpet', 'Corgi', 'Tea Stain', 'Velvet Rope', 'Fancy Napkin', 'Crown Jewels', 'Monocle', 'Ballroom', 'Royal Flush', 'Throne Room', 'Off With Their Heads', 'Gold Leaf', 'Divine Right', 'Peasant Tax', 'King Of Kings', 'Royal Fade', 'Tower Dark'], ['k_butterfly', 'k_flip'], 'k_baguette'],
  ['toxic', 'Toxic Waste Case', 'Do not lick. Do not inhale. Do not.', ['#8aff2a', '#1a1a1a', '#f2d33c', '#4a2a6a'],
    ['Sludge', 'Barrel Drum', 'Hazard Tape', 'Sewer Rat', 'Ooze', 'Mutagen', 'Chem Spill', 'Radioactive', 'Glow Worm', 'Acid Rain', 'Biohazard', 'Swamp Thing', 'Meltdown', 'Patient Zero', 'Toxic Avenger', 'Slime Fade', 'Fume'], ['k_hunts', 'k_karambit'], 'k_plunger'],
  ['office', 'Corporate Synergy Case', 'Per my last email.', ['#5a6a7a', '#e8e8e8', '#2a6aff', '#c8402a'],
    ['Cubicle', 'Stapler', 'Casual Friday', 'Fax Machine', 'TPS Report', 'Coffee Stain', 'Team Building', 'Reply All', 'Micromanager', 'Synergy', 'Quarterly Loss', 'Golden Parachute', 'Hostile Takeover', 'Unpaid Overtime', 'CEO Bonus', 'Spreadsheet Fade', 'Burnout'], ['k_flip', 'k_bayonet'], 'k_chicken'],
  ['fastfood', 'Drive-Thru Case', 'Would you like fries with that?', ['#e8402a', '#f2d33c', '#8a5a2a', '#ffffff'],
    ['Ketchup Packet', 'Soggy Fries', 'Grease Trap', 'Kids Meal', 'Napkin Dispenser', 'Secret Sauce', 'Milkshake Machine', 'Drive-Thru', 'Value Menu', 'Triple Stack', 'Heart Attack', 'Golden Arches-ish', 'Supersized', 'Ice Cream Machine Broke', 'Employee Of The Month', 'Grease Fade', 'Fryer Oil'], ['k_gut', 'k_flip'], 'k_hotdog'],
  ['beach', 'Spring Break Case', 'Sunscreen not included.', ['#2ad2ff', '#f2d8a0', '#ff8a6a', '#ffffff'],
    ['Sandcastle', 'Sunburn', 'Flip Flop', 'Beach Towel', 'Seagull Theft', 'Tiki Bar', 'Coconut', 'Surf\'s Up', 'Jet Ski', 'Lifeguard', 'Tan Lines', 'Boardwalk', 'Shark Week', 'Paradise', 'Spring Breaker', 'Sunset Fade', 'Riptide'], ['k_butterfly', 'k_hunts'], 'k_fish'],
  ['metal', 'Heavy Metal Case', 'Turn it up to eleven.', ['#1a1a1a', '#c8c8c8', '#c8321e', '#5a5a5a'],
    ['Mosh Pit', 'Leather Jacket', 'Spiked Collar', 'Power Chord', 'Roadie', 'Headbanger', 'Guitar Solo', 'Amp Feedback', 'Pyro', 'Black Sabbath-ish', 'Iron Maiden-ish', 'Encore', 'Face Melter', 'Wall Of Death', 'Rock God', 'Chrome', 'Blackened'], ['k_karambit', 'k_hunts'], 'k_dildo'],
  ['dino', 'Jurassic Junk Case', 'Life, uh, finds a way.', ['#4a6a2a', '#c8a050', '#8a2a1a', '#2a2a1a'],
    ['Fossil', 'Amber', 'Tar Pit', 'Egg Shell', 'Ferns', 'Raptor Claw', 'Meteor Strike', 'Volcano', 'Pterodactyl', 'T-Rex Arms', 'Extinction Event', 'Bone Dry', 'Apex Fossil', 'Jurassic Spark', 'Dino Nuggets', 'Amber Fade', 'Tar'], ['k_gut', 'k_bayonet'], 'k_chicken'],
  ['clown', 'Clown College Case', 'Honk honk.', ['#ff4a4a', '#f2d33c', '#2a8aff', '#ffffff'],
    ['Big Shoes', 'Balloon Animal', 'Seltzer', 'Juggler', 'Rubber Nose', 'Face Paint', 'Pie In The Face', 'Unicycle', 'Circus Peanut', 'Clown Car', 'Creepy Smile', 'Big Top', 'Honk Honk', 'Ringmaster', 'Certified Clown', 'Confetti Fade', 'Greasepaint'], ['k_butterfly', 'k_karambit'], 'k_dildo'],
];
// joke finishes that come with their own sounds (everything else sounds like the base gun)
const FINGER_GUN = { id: 'toilet:deagle:Finger Gun', kind: 'skin', weapon: 'deagle', finish: 'Finger Gun', paint: { t: 'text', c: ['#f2c8a0', '#c8462e'], s: 'PEW' }, tier: 5 };
export const SKIN_SOUNDS = {  // by finish name (guns) or knife model: which sound plays on fire / hit / miss
  'Finger Gun': { fire: 'pewpew' }, 'BRRRT': { fire: 'fart' }, 'Fart Cloud': { fire: 'fart' }, 'Golden Shower': { fire: 'squirt' }, 'Hot Dog Water': { fire: 'squirt' },
  'Thicc Boi': { fire: 'boing' }, 'Poop Emoji Party': { fire: 'fart' }, 'Dong Doppler': { fire: 'boing' },
  dildo: { hit: 'wetslap', miss: 'doing' }, hotdog: { hit: 'squish', miss: 'whoosh' }, plunger: { hit: 'fwoop', miss: 'whoosh' }, chicken: { hit: 'squeak', miss: 'squeak' },
  baguette: { hit: 'crunch', miss: 'whoosh' }, fish: { hit: 'flop', miss: 'whoosh' }, banana: { hit: 'squish', miss: 'boing' },
};
export function skinSound(skin, what) {
  const d = skin && ITEM_BY_ID[skin.def]; if (!d) return null;
  const k = d.kind === 'knife' ? (KNIFE_BY_ID[d.weapon] || {}).model : d.finish;
  return (SKIN_SOUNDS[k] || {})[what] || null;
}

const CRATE_LIST = [
  makeCrate('sand', 'Sandstorm Case', 'Serious finishes for serious sweats.', SERIOUS, 7, ['k_bayonet', 'k_karambit', 'k_butterfly'], 250),
  (() => { const c = makeCrate('toilet', 'Toilet Humor Case', 'Crude finishes and the dumbest knives ever made. Some skins have their own sounds.', CRUDE, 13, ['k_hotdog', 'k_dildo', 'k_plunger', 'k_chicken'], 250); c.items.push(FINGER_GUN); return c; })(),
  makeCrate('nuke', 'Nuclear Family Case', 'Glowing, radioactive, family friendly.', NUKE, 21, ['k_baguette', 'k_fish', 'k_banana'], 300),
  ...THEMES.map((t, n) => themedCrate(n, ...t, 250 + (n % 4) * 25)),
  { id: 'agents', name: 'Fashion Disaster Case', desc: 'Player models nobody asked for.', price: 350,
    items: AGENTS.filter((a) => a.tier >= 0).map((a) => ({ id: 'agents:' + a.id, kind: 'agent', weapon: a.id, finish: a.name, tier: a.tier })) },
];
CRATE_LIST.forEach((c, n) => { const f = MYTHIC_FIN[c.id]; if (f) { const gun = MYTHIC_GUNS[n % MYTHIC_GUNS.length]; c.items.push({ id: `${c.id}:${gun}:${f.name}`, kind: 'skin', weapon: gun, finish: f.name, paint: f.paint, tier: MYTHIC }); } });
export const CRATES = CRATE_LIST;
// ---- the free battle pass: one reward per level, earned only with XP from playing (nothing to buy, ever) ----
const PASS_FINISHES = [F('Participation Trophy', { t: 'solid', c: ['#c8a040', '#8a6a20'] }), F('Grass Toucher', { t: 'camo', c: ['#5aa040', '#3a7a2a', '#8ad060'] }),
  F('Mom\'s Basement', { t: 'checker', c: ['#4a3a6a', '#2a2040'] }), F('Gamer Fuel', { t: 'fade', c: ['#2aff6a', '#2a6aff', '#ff2ad2'] }),
  F('Sweaty Palms', { t: 'smear', c: ['#e8e0c8', '#8ac8ff'] }), F('No Life', { t: 'galaxy', c: ['#0a0a1a', '#ff4a8a', '#ffffff'] }),
  F('Touch Grass Pro', { t: 'tiger', c: ['#6ad040', '#1a3a10'] }), F('Hall of Shame', { t: 'text', c: ['#1a1a1a', '#ff4a4a'], s: 'NOOB' }),
  F('Certified Clown', { t: 'dots', c: ['#ff4a4a', '#ffffff'] }), F('Rainbow Road Rage', { t: 'wave', c: ['#ff2a2a', '#ffd23a', '#2aff6a', '#2a8aff', '#d22aff'] })];
const PASS_GUNS = ['glock', 'usp', 'ak47', 'm4a4', 'awp', 'deagle', 'mp9', 'mac10', 'p90', 'galil', 'famas', 'nova', 'ump', 'ssg08', 'p250', 'm4a1s', 'sg553', 'aug', 'tec9', 'fiveseven'];
const PASS_AGENTS = ['a_t_banana', 'a_ct_mime', 'a_t_speedo', 'a_ct_tighty', 'a_t_grandma', 'a_ct_pigeon', 'a_t_hotdog', 'a_ct_poo'];
export const PASS_TIERS = 50;
export const PASS = (() => {
  const items = [], tiers = [];
  let g = 0, f = 0, a = 0, e = 0;
  const emotes = EMOTES.filter((x) => !DEFAULT_EMOTES.includes(x.id));
  for (let t = 1; t <= PASS_TIERS; t++) {
    let it;
    if (t === PASS_TIERS) it = { id: 'pass:k_dildo:Gold Plated', kind: 'knife', weapon: 'k_dildo', finish: 'Gold Plated', paint: { t: 'fade', c: ['#fff3a0', '#e8b020', '#8a5a10'] }, tier: 5 };
    else if (t === 25) it = { id: 'pass:k_hotdog:Ballpark Special', kind: 'knife', weapon: 'k_hotdog', finish: 'Ballpark Special', paint: { t: 'hotdogs', c: ['#f2d8a0', '#c8462e'] }, tier: 5 };
    else if (t % 5 === 0 && a < PASS_AGENTS.length) { const id = PASS_AGENTS[a++]; it = { id: 'pass:' + id, kind: 'agent', weapon: id, finish: (AGENTS.find((x) => x.id === id) || {}).name, tier: (AGENTS.find((x) => x.id === id) || {}).tier || 2 }; }
    else if (t % 3 === 0 && e < emotes.length) { const em = emotes[e++]; it = { id: 'pass:' + em.id, kind: 'emote', weapon: em.id, finish: em.name, tier: em.tier }; }
    else { const fin = PASS_FINISHES[f++ % PASS_FINISHES.length], gun = PASS_GUNS[g++ % PASS_GUNS.length]; it = { id: `pass:${gun}:${fin.name}`, kind: 'skin', weapon: gun, finish: fin.name, paint: fin.paint, tier: Math.min(4, Math.floor(t / 10)) }; }
    it.id = `pass${t}:` + it.id.slice(5);  // unique per tier
    items.push(it); tiers.push({ tier: t, def: it.id });
  }
  return { id: 'pass', name: 'Free Battle Pass', price: 0, items, tiers, hidden: true };
})();
for (const em of EMOTES) if (!PASS.items.find((i) => i.weapon === em.id)) PASS.items.push({ id: 'pass:' + em.id, kind: 'emote', weapon: em.id, finish: em.name, tier: em.tier });
export const CRATE_BY_ID = Object.fromEntries(CRATES.map((c) => [c.id, c]));
export const ITEM_BY_ID = Object.fromEntries([...CRATES, PASS].flatMap((c) => c.items.map((i) => [i.id, i])));
export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

// the odds a crate actually uses (tiers that exist in it, renormalised): shown before opening
export function crateOdds(crate) {
  const tiers = [...new Set(crate.items.map((i) => i.tier))].sort((a, b) => a - b);
  const tot = tiers.reduce((s, t) => s + RARITY[t].odds, 0);
  return tiers.map((t) => ({ tier: t, name: RARITY[t].name, color: RARITY[t].color, pct: RARITY[t].odds / tot * 100 }));
}
// roll one item: tier by odds, item uniformly within the tier, float 0..1 (agents have no wear), 10% StatTrak on guns/knives
export function rollCrate(crate, rnd = Math.random) {
  const odds = crateOdds(crate); let r = rnd() * 100, tier = odds[odds.length - 1].tier;
  for (const o of odds) { if (r < o.pct) { tier = o.tier; break; } r -= o.pct; }
  const pool = crate.items.filter((i) => i.tier === tier), def = pool[Math.floor(rnd() * pool.length)];
  return newItem(def.id, def.kind === 'agent' ? 0 : rnd(), def.kind !== 'agent' && rnd() < 0.1, Math.floor(rnd() * 1000));
}
let uidN = 0;
export const newItem = (def, float, st, seed) => ({ uid: Date.now().toString(36) + (uidN++).toString(36) + Math.floor(Math.random() * 1e6).toString(36), def, float: +float.toFixed(5), st: !!st, seed, kills: 0, t: Date.now() });
export function itemInfo(it) {
  const d = ITEM_BY_ID[it.def]; if (!d) return null;
  const wpn = d.kind === 'skin' ? (WEAPONS.find((w) => w.id === d.weapon) || {}).name : d.kind === 'knife' ? KNIFE_BY_ID[d.weapon].name : d.kind === 'emote' ? 'Emote' : 'Agent';
  const wear = d.kind === 'agent' || d.kind === 'emote' ? null : wearOf(it.float);
  const value = Math.round(RARITY[d.tier].value * (wear ? wear.mult : 1) * (it.st ? 2 : 1) * (d.kind === 'agent' ? 1.5 : d.kind === 'emote' ? 0.8 : 1));
  return { ...d, wpn, wear, value, rarity: RARITY[d.tier], label: (it.st ? 'StatTrak™ ' : '') + `${wpn} | ${d.finish}` };
}

// ---- painting: recipe -> canvas (deterministic by seed), then wear ----
// scale: the canvas is scale x the 64x32 design size (the game paints at 4-8x for crisp detail)
export function paintSkin(canvas, paint, seed = 1, float = 0.1, scale = 0) {
  const g = canvas.getContext('2d'), sc = scale || canvas.width / 64 || 1, W = canvas.width / sc, H = canvas.height / sc;
  g.setTransform(sc, 0, 0, sc, 0, 0);
  let s = (seed * 2654435761) >>> 0; const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const c = paint.c;
  g.fillStyle = c[0]; g.fillRect(0, 0, W, H);
  const blob = (x, y, rr, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rr, rr * (0.5 + r()), r() * 3, 0, 7); g.fill(); };
  switch (paint.t) {
    case 'camo': for (let i = 0; i < 26; i++) blob(r() * W, r() * H, 4 + r() * 10, c[1 + (i % 2)] || c[1]); break;
    case 'solid': g.fillStyle = c[1]; g.fillRect(0, H * 0.75, W, H * 0.25); break;
    case 'checker': for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) if (((x + y) / 8) % 2) { g.fillStyle = c[1]; g.fillRect(x, y, 8, 8); } break;
    case 'stripes': g.fillStyle = c[1]; for (let x = -H; x < W; x += 12) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 6, H); g.lineTo(x + 6 + H, 0); g.lineTo(x + H, 0); g.fill(); } break;
    case 'tiger': g.fillStyle = c[1]; for (let i = 0; i < 14; i++) { const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (r() - 0.5) * 20, H / 2, x + (r() - 0.5) * 10, H); g.lineWidth = 2 + r() * 3; g.strokeStyle = c[1]; g.stroke(); } break;
    case 'hex': g.strokeStyle = c[1]; g.lineWidth = 1.5; for (let y = 0; y < H + 8; y += 7) for (let x = 0; x < W + 8; x += 8) { const ox = (y / 7) % 2 ? 4 : 0; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(x + ox + Math.cos(a) * 4, y + Math.sin(a) * 4); } g.closePath(); g.stroke(); } break;
    case 'circuit': g.strokeStyle = c[1]; g.lineWidth = 1; for (let i = 0; i < 30; i++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { if (r() < 0.5) x += (r() - 0.5) * 24; else y += (r() - 0.5) * 24; g.lineTo(x, y); } g.stroke(); g.fillStyle = c[1]; g.fillRect(x - 1, y - 1, 3, 3); } break;
    case 'marble': for (let i = 0; i < 40; i++) { g.strokeStyle = c[1] + (r() < 0.5 ? '88' : 'cc'); g.lineWidth = 0.5 + r() * 2; g.beginPath(); let x = r() * W, y = r() * H; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 20; y += (r() - 0.5) * 10; g.lineTo(x, y); } g.stroke(); } break;
    case 'damascus': g.strokeStyle = c[1]; for (let y = 0; y < H; y += 3) { g.beginPath(); for (let x = 0; x <= W; x += 2) g.lineTo(x, y + Math.sin(x / 6 + y / 4 + seed) * 2.5); g.stroke(); } break;
    case 'geo': { g.fillStyle = c[1]; for (let i = 0; i < 6; i++) { const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 10 + r() * 14, 0); g.lineTo(x - 6 + r() * 10, H); g.lineTo(x - 16, H); g.fill(); } g.fillStyle = c[2]; for (let i = 0; i < 5; i++) g.fillRect(r() * W, r() * H, 6 + r() * 16, 2 + r() * 3); break; }
    case 'galaxy': { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, c[0]); gr.addColorStop(0.5, c[1]); gr.addColorStop(1, c[0]); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = c[2]; for (let i = 0; i < 60; i++) g.fillRect(r() * W, r() * H, r() < 0.9 ? 1 : 2, r() < 0.9 ? 1 : 2); break; }
    case 'flames': for (let i = 0; i < 18; i++) { const x = r() * W, hh = H * (0.4 + r() * 0.6); g.fillStyle = i % 2 ? c[1] : c[2]; g.beginPath(); g.moveTo(x - 6, H); g.quadraticCurveTo(x - 4, H - hh / 2, x + (r() - 0.5) * 6, H - hh); g.quadraticCurveTo(x + 4, H - hh / 2, x + 6, H); g.fill(); } break;
    case 'scales': g.strokeStyle = c[2]; g.fillStyle = c[1]; for (let y = 0; y < H + 6; y += 5) for (let x = 0; x < W + 6; x += 6) { g.beginPath(); g.arc(x + ((y / 5) % 2 ? 3 : 0), y, 3, 0, Math.PI); if (r() < 0.15) g.fill(); g.stroke(); } break;
    case 'fade': case 'wave': { const gr = g.createLinearGradient(0, 0, W, paint.t === 'wave' ? H : 0); c.forEach((col, k) => gr.addColorStop(k / (c.length - 1), col)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      if (paint.t === 'wave') { g.strokeStyle = 'rgba(255,255,255,.25)'; for (let k = 0; k < 6; k++) { g.beginPath(); for (let x = 0; x <= W; x += 2) g.lineTo(x, H * (k + 0.5) / 6 + Math.sin(x / 7 + seed + k) * 3); g.stroke(); } } break; }
    case 'smear': g.strokeStyle = c[1]; g.lineCap = 'round'; for (let i = 0; i < 9; i++) { g.lineWidth = 2 + r() * 5; g.beginPath(); const x = r() * W, y = r() * H; g.moveTo(x, y); g.quadraticCurveTo(x + 10, y + (r() - 0.5) * 8, x + 14 + r() * 20, y + (r() - 0.5) * 6); g.stroke(); } break;
    case 'clouds': for (let i = 0; i < 18; i++) { const x = r() * W, y = r() * H; for (let k = 0; k < 3; k++) { g.fillStyle = c[1] + 'aa'; g.beginPath(); g.arc(x + k * 4, y + (k % 2) * 2, 3 + r() * 3, 0, 7); g.fill(); } } break;
    case 'dots': g.fillStyle = c[1]; for (let y = 3; y < H; y += 8) for (let x = 3 + ((y / 8) % 2) * 4; x < W; x += 8) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); } break;
    case 'web': g.strokeStyle = c[1]; g.lineWidth = 1; { const cx = W * r(), cy = H * r(); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * W, cy + Math.sin(a) * W); g.stroke(); } for (let rr = 5; rr < W; rr += 6) { g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.stroke(); } } break;
    case 'text': g.fillStyle = c[1]; g.font = `900 ${Math.max(7, H / 4)}px system-ui,sans-serif`; for (let y = H / 4; y < H + 4; y += H / 4) for (let x = ((y / (H / 4)) % 2) * -10; x < W; x += g.measureText(paint.s + ' ').width) g.fillText(paint.s, x, y); break;
    case 'hotdogs': for (let i = 0; i < 10; i++) { const x = r() * W, y = r() * H; g.fillStyle = c[0] === '#f2d8a0' ? '#d8a050' : c[0]; g.fillRect(x - 5, y - 2, 10, 4); g.fillStyle = c[1]; g.fillRect(x - 6, y - 1, 12, 2); g.fillStyle = '#f2d33c'; g.fillRect(x - 4, y - 0.5, 8, 0.8); } break;
    case 'poops': for (let i = 0; i < 9; i++) { const x = r() * W, y = r() * H; g.fillStyle = c[1]; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x, y - k * 2.5, 5 - k * 1.4, 2, 0, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.fillRect(x - 2, y - 3, 1, 1); g.fillRect(x + 1, y - 3, 1, 1); } break;
    default: break;
  }
  const px = 1 / sc;   // one real pixel
  if (!paint.mask) {
    // detail: metallic flake in the bright finishes, a hairline lacquer edge on pattern shapes, brushed grain, and a
    // clear-coat sheen (light along the top, darker underneath) so the finish reads as paint on a curved gun
    if (['fade', 'wave', 'galaxy', 'marble', 'damascus'].includes(paint.t)) for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.12})`; g.fillRect(r() * W, r() * H, px * (1 + r() * 2), px * (1 + r() * 2)); }
    for (let y = 0; y < H; y += px * 2) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.015 + r() * 0.02})`; g.fillRect(0, y, W, px); }
    const sh = g.createLinearGradient(0, 0, 0, H); sh.addColorStop(0, 'rgba(255,255,255,.16)'); sh.addColorStop(0.3, 'rgba(255,255,255,.03)'); sh.addColorStop(0.62, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.22)');
    g.fillStyle = sh; g.fillRect(0, 0, W, H);
    // panel seams and screws, like a real receiver
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = px * 1.5; for (const x of [W * 0.28, W * 0.52, W * 0.74]) { g.beginPath(); g.moveTo(x, H * 0.12); g.lineTo(x, H * 0.88); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.35)'; for (const [x, y] of [[0.3, 0.2], [0.3, 0.8], [0.54, 0.5], [0.76, 0.25]]) { g.beginPath(); g.arc(W * x, H * y, px * 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.18)'; for (const [x, y] of [[0.3, 0.2], [0.3, 0.8], [0.54, 0.5], [0.76, 0.25]]) g.fillRect(W * x - px, H * y - px * 2, px * 2, px);
  }
  // wear: scratches, chips down to the metal and grime, all growing with the float (fine lines at full resolution)
  const n = Math.floor(float * 220 * Math.min(4, sc));
  for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.55 ? 'rgba(210,210,215,.45)' : 'rgba(30,25,20,.4)'; const x = r() * W, y = r() * H, len = 1 + r() * 4 * float; g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.6); g.fillRect(0, 0, len, Math.max(px, 0.5 * px * sc / 2)); g.restore(); }
  if (float > 0.15) for (let i = 0; i < float * 40; i++) { const e = r() < 0.5 ? r() * H * 0.12 : H - r() * H * 0.12; g.fillStyle = 'rgba(150,150,155,.55)'; g.beginPath(); g.ellipse(r() * W, e, px * (2 + r() * 6), px * (1 + r() * 3), r() * 3, 0, 7); g.fill(); }   // edge chips
  if (float > 0.38) { g.fillStyle = `rgba(60,50,40,${(float - 0.38) * 0.5})`; g.fillRect(0, 0, W, H); }
  g.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}
