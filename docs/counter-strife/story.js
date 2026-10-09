// Story mode: "Operation Ballin' Out", an online co-op campaign for up to four players against AI enemies, across
// every map and ending on Dust. This file is the campaign itself, as data: the four characters (one of each per
// game), what difficulty changes, the chapters and missions (objectives, puzzles, cutscene lines, enemy waves, the
// weapons each character carries at that point) and the final boss. The mode's logic reads it; nothing here runs.
//
// Tone: crude, juvenile, roast-heavy. Nobody's jokes are about race or religion; the villain is a cartoon, his
// "terror" is a fart-gas doomsday device, and every character gets roasted equally.

// ---- the squad: one of each per game ---------------------------------------------------------------------------------
// guns: the weapon categories / ids each character may carry (pistols, grenades and items are open to everyone);
// ability: realistic gear and tactics, no superpowers. cd: seconds between uses; perLevel: uses per mission.
export const CHARACTERS = {
  wiener: {
    name: 'Sergeant Wiener', short: 'Wiener', role: 'Squad leader · heavy',
    look: { body: '#c8462e', legs: '#e8b060', head: '#c8462e', hat: 'bun', hatColor: '#e8b060', mustard: true },   // a cartoon hotdog of a man, in a bun
    bio: 'A cartoon hotdog in a bun who runs the squad like a drill instructor. Brutal, calculated, and enjoys pain a bit too much. Always has a plan, and the plan always hurts.',
    guns: { cats: ['heavy'], ids: [] },   // LMGs and shotguns
    ability: { id: 'mess_kit', name: 'Mess Kit', desc: 'Patches the squad up: everyone within 8 m heals 40% of their current health, up to 20 over their max.', cd: 45, heal: 0.4, overheal: 20, radius: 8 },
  },
  cancer: {
    name: 'Captain Cancer', short: 'Cancer', role: 'Close quarters · area denial',
    look: { body: '#d8e2e8', legs: '#d8e2e8', head: '#e8c4a8', hat: 'none', gown: true },   // bald, in a hospital gown
    bio: 'Bald, in a hospital gown, IV pole long since traded for an SMG. Has nothing to lose and says so constantly. Dark jokes, short temper, never misses a chance to correct Ricky.',
    guns: { cats: ['smg'], ids: [] },   // SMGs only
    ability: { id: 'cancer_nade', name: 'Cancer Nade', desc: 'One per mission: a canister of hospital-grade nasty. A lingering poison cloud that hurts and slows anyone standing in it.', perLevel: 1, dps: 9, radius: 4.5, dur: 9, slow: 0.6 },
  },
  ricky: {
    name: 'Recruit Ricky', short: 'Ricky', role: 'Rifleman',
    look: { body: '#7a3cc8', legs: '#1a1a1a', head: '#5a3a26', hat: 'cap', hatColor: '#e8c020', chains: true },   // skinny, middle-aged; loud rapper fit and jewellery
    bio: 'Skinny, middle-aged, dressed like he is about to drop a mixtape: purple fit, gold chains, cap sideways. Confident about everything, right about nothing. Wiener and Cancer correct him constantly.',
    guns: { cats: ['rifle'], ids: [], noZoom: true },   // assault rifles; his sidearm is fixed (below)
    sidearm: { id: 'glock', name: 'Glock-18C "Switch"', auto: true, laser: true, mag: 50, note: 'Full-auto switch, laser, drum mag. His only secondary, always.' },
    ability: null,
  },
  igor: {
    name: 'Igor The Sniper', short: 'Igor', role: 'Marksman',
    look: { body: '#4c5a3a', legs: '#3a4430', head: '#e0b896', hat: 'toque', hatColor: '#6a4a2a', ushanka: true },
    bio: 'Extremely, aggressively Soviet. Calls everyone comrade, distrusts anything that is not a bolt action, brags about winters nobody can verify.',
    guns: { cats: ['sniper'], ids: ['sg553', 'aug'] },   // snipers and big-scope rifles only
    ability: { id: 'russian_focus', name: 'Russian Focus', desc: 'For 15 seconds: zero recoil, rock-steady scope. "Is not cheat. Is discipline."', cd: 60, dur: 15 },
  },
};
export const SQUAD = ['wiener', 'cancer', 'ricky', 'igor'];

// ---- difficulty -------------------------------------------------------------------------------------------------------
// Real players always get 1.5x health and take reduced headshot damage. Difficulty then scales the enemies' brains
// (reaction, aim, head aim; from data.js BOT_LEVELS), their numbers, health and damage, the boss and the beam warning,
// checkpoints, and the ammo and health lying around.
export const STORY_DIFF = {
  easy: { name: 'Beginner', bot: 'easy', hpMult: 1.5, hsTaken: 2.0, enemyCount: 0.7, enemyHp: 0.8, enemyDmg: 0.6, bossHp: 0.65, beamWarn: 2.6, minions: 0.6, pickups: 1.5, revive: 6, checkpoints: 'every objective' },
  normal: { name: 'Played CS:GO', bot: 'normal', hpMult: 1.5, hsTaken: 2.4, enemyCount: 1, enemyHp: 1, enemyDmg: 0.85, bossHp: 1, beamWarn: 2.0, minions: 1, pickups: 1, revive: 9, checkpoints: 'every objective' },
  hard: { name: 'Real Shoota', bot: 'hard', hpMult: 1.5, hsTaken: 3.0, enemyCount: 1.35, enemyHp: 1.2, enemyDmg: 1.1, bossHp: 1.5, beamWarn: 2.0, minions: 1.5, pickups: 0.7, revive: 14, checkpoints: 'every second objective' },
};
export const HS_NORMAL = 4;   // the PvP headshot multiplier (for comparison: story players take hsTaken instead)

// ---- weapons over the campaign ------------------------------------------------------------------------------------------
// Each character's loadout changes every 2-3 missions (by "tier"), on top of what they unlock and customise themselves
// (gun levels and attachments carry over from multiplayer and keep growing here).
export const ARSENAL = {
  wiener: [['nova', 'sawedoff'], ['xm1014', 'nova'], ['mag7', 'm249'], ['xm1014', 'm249'], ['negev', 'xm1014'], ['negev', 'm249'], ['negev', 'xm1014']],
  cancer: [['mac10', 'mp9'], ['mp9', 'ump'], ['mp7', 'mp5'], ['ump', 'p90'], ['p90', 'mp7'], ['bizon', 'p90'], ['p90', 'mp5']],
  ricky: [['galil', 'famas'], ['famas', 'galil'], ['ak47', 'm4a4'], ['m4a1s', 'ak47'], ['ak47', 'm4a4'], ['m4a4', 'ak47'], ['ak47', 'm4a1s']],
  igor: [['ssg08'], ['ssg08', 'sg553'], ['aug', 'ssg08'], ['awp', 'sg553'], ['scar20', 'awp'], ['g3sg1', 'awp'], ['awp', 'scar20']],
};

// ---- the boss ----------------------------------------------------------------------------------------------------------
export const BOSS = {
  id: 'ballin', name: 'Osama bin Ballin', title: 'Leader of the Ballin\' Brotherhood',
  // an extra-large flat-shaded cartoon (construction-paper style): huge head, tiny legs, basketball jersey, gold
  // sneakers, a beard you could lose a grenade in
  model: { scale: 2.6, style: 'paper', jersey: '#e8e8e0', trim: '#c8a020', beard: '#2a2420', sneakers: '#e8c020' },
  hp: 9000,   // x STORY_DIFF.bossHp, and +35% per extra player
  phases: [
    { at: 1.0, name: 'Warm-up', attacks: ['dunk', 'rocket_ball', 'minions'] },
    { at: 0.66, name: 'Full Court Press', attacks: ['dunk', 'rocket_ball', 'goy_beam', 'minions'] },
    { at: 0.33, name: 'Overtime', attacks: ['goy_beam', 'triple_ball', 'fart_bomb', 'minions'], speed: 1.25 },
  ],
  attacks: {
    dunk: { name: 'Slam Dunk', desc: 'Leaps at the furthest player and slams the ground: a shockwave ring. Jump it.', dmg: 35, radius: 6, cd: 9 },
    rocket_ball: { name: 'Rocket Ball', desc: 'Lobs a flaming basketball that bounces twice and explodes.', dmg: 45, radius: 3.5, cd: 6 },
    triple_ball: { name: 'And-One', desc: 'Three rocket balls at once, fanned out.', dmg: 40, radius: 3, cd: 8 },
    fart_bomb: { name: 'Gas Station', desc: 'Squats, strains, releases. A green cloud spreads from him; stay out.', dps: 12, radius: 7, dur: 6, cd: 18 },
    minions: { name: 'Call the Bench', desc: 'Whistles; foot soldiers run in from the edges.', count: 4, cd: 22 },
    // the signature move. Sweeps a 2-second red warning laser along a line from his eyes, then fires: anyone in front
    // of it loses HALF OF THEIR FULL HEALTH. Easy to escape: the warning is long and the beam only covers a narrow
    // strip, so a sidestep or any cover saves you. Hitting him in the face while he charges staggers him and cancels it.
    goy_beam: { name: 'Goy-Beam', desc: 'A 2 s red warning laser, then a beam that takes half of your full health. Sidestep or get behind cover.', warn: 2.0, width: 1.4, length: 60, dmgFrac: 0.5, cd: 14, cancelOnHeadDmg: 600 },
  },
};

// ---- the campaign: 7 chapters x 3 missions, ~10-12 minutes each (~4 hours) -----------------------------------------------
// objective kinds: reach (get everyone to a zone), clear (kill everything in a zone), defend (hold a zone for t s),
// collect (pick up n items), interact (hold USE on things in order), defuse (bomb with a wire puzzle), escort (keep
// an NPC alive to a zone), survive (waves for t s), boss. puzzle: a self-contained mini-game on the objective.
// cut: cutscene lines [speaker, text] before (in) and after (out). tier: weapon tier from ARSENAL.
export const CHAPTERS = [
  { id: 'c1', map: 'range', name: 'Boot Camp Is For Losers', missions: [
    { id: 'm1', name: 'Orientation', tier: 0, objectives: [{ kind: 'reach', zone: 'lane1', hint: 'Get to the firing line' }, { kind: 'clear', zone: 'lane1', enemies: 'dummies', count: 12, hint: 'Shoot the targets (they shoot back)' }, { kind: 'interact', targets: 3, hint: 'Reset the three target winches' }],
      cut: { in: [['wiener', 'Listen up, maggots. Intel says the Ballin\' Brotherhood is building something big. Something that smells.'], ['ricky', 'Sarge, I been training my whole life for this. I watched like four movies.'], ['cancer', 'Four movies. I have had longer chemo sessions than your attention span.'], ['igor', 'In my village, we train with one bullet. If you miss, you are the target.']],
        out: [['wiener', 'The targets were rigged with live rounds. Somebody inside the base is Brotherhood.'], ['ricky', 'I KNEW that target was looking at me funny.']] } },
    { id: 'm2', name: 'The Mole Hunt', tier: 0, objectives: [{ kind: 'collect', item: 'keycard', count: 3, hint: 'Find the three range keycards' }, { kind: 'interact', targets: 1, puzzle: 'keypad', hint: 'Open the armoury (the code is on the keycards)' }, { kind: 'clear', zone: 'armoury', count: 14, hint: 'Clear the armoury' }],
      cut: { in: [['cancer', 'Three keycards. Split up. Ricky, you go with Igor so somebody can read.'], ['ricky', 'I can read. I read the back of the Doritos bag every day.']], out: [['igor', 'The traitor is gone. He left only this: a basketball, signed "O.B.B."'], ['wiener', 'Osama bin Ballin. Pack your bags. We fly at dawn.']] } },
    { id: 'm3', name: 'Live Fire Exercise', tier: 1, objectives: [{ kind: 'defend', zone: 'tower', time: 120, hint: 'Hold the control tower' }, { kind: 'survive', time: 90, hint: 'Survive until the chopper lands' }, { kind: 'reach', zone: 'helipad', hint: 'Get on the chopper' }],
      cut: { in: [['wiener', 'They are hitting the range to cover his escape. Hold the tower. Pain is weakness leaving the body, and I want ALL of it to leave.']], out: [['ricky', 'Where we going, Sarge?'], ['wiener', 'Somewhere they sell fireworks and nobody asks questions.']] } },
  ] },
  { id: 'c2', map: 'town', name: 'Small Town, Big Problems', missions: [
    { id: 'm4', name: 'Fireworks Stand', tier: 1, objectives: [{ kind: 'reach', zone: 'stand', hint: 'Find the fireworks stand' }, { kind: 'clear', zone: 'square', count: 16, hint: 'Clear the town square' }, { kind: 'collect', item: 'receipt', count: 4, hint: 'Find the Brotherhood\'s receipts' }],
      cut: { in: [['cancer', 'Brotherhood bought nine thousand bottle rockets and a pallet of expired chili. In cash.'], ['ricky', 'Man, that\'s just a Tuesday where I\'m from.']], out: [['igor', 'Chili and rockets. In Soviet Union this is called "dinner and dessert".']] } },
    { id: 'm5', name: 'Chili Cook-Off', tier: 1, objectives: [{ kind: 'interact', targets: 4, puzzle: 'valves', hint: 'Shut the four gas valves in the right order' }, { kind: 'escort', npc: 'chef', zone: 'van', hint: 'Get the chef to the van alive' }],
      cut: { in: [['wiener', 'The chili is the payload. Ballin\' is fermenting it into a weapon. The cook knows the recipe. We extract the cook.']], out: [['ricky', 'He gave me a sample, it\'s actually fire though.'], ['cancer', 'Ricky, you just ate a chemical weapon.'], ['ricky', '...it\'s actually fire though.']] } },
    { id: 'm6', name: 'Ricky\'s Bad Idea', tier: 2, objectives: [{ kind: 'survive', time: 150, hint: 'Survive: Ricky posted your location on social media' }, { kind: 'defuse', puzzle: 'wires', hint: 'Defuse the chili bomb' }, { kind: 'reach', zone: 'bridge', hint: 'Get out of town' }],
      cut: { in: [['ricky', 'Okay so I MIGHT have done a little livestream.'], ['wiener', 'You livestreamed a covert operation.'], ['ricky', 'Forty viewers, Sarge. Forty. That\'s my best one.']], out: [['cancer', 'One of your forty viewers was Ballin\'. He left a comment: "see u at the crust".']] } },
  ] },
  { id: 'c3', map: 'crust', name: 'Pizza Crust Massacre', missions: [
    { id: 'm7', name: 'Delivery Guys', tier: 2, objectives: [{ kind: 'reach', zone: 'kitchen', hint: 'Sneak into the kitchen' }, { kind: 'collect', item: 'order', count: 5, hint: 'Grab the order slips' }, { kind: 'clear', zone: 'dining', count: 18, hint: 'Clear the dining room' }],
      cut: { in: [['igor', 'We go in as pizza men. I have the hat.'], ['cancer', 'You have a hat. That\'s it. That\'s the disguise.']], out: [['wiener', 'Every order is to the same address: a harbour. Extra large. Extra gas.']] } },
    { id: 'm8', name: 'The Oven', tier: 2, objectives: [{ kind: 'interact', targets: 3, puzzle: 'temps', hint: 'Set the three ovens to the right temperatures' }, { kind: 'defend', zone: 'oven', time: 100, hint: 'Hold the oven room while it cools' }],
      cut: { in: [['cancer', 'If those ovens hit 900 degrees the gas goes up and takes the block with it.'], ['ricky', 'What if we just... turn them off?'], ['wiener', 'Ricky. For once in your life. That\'s correct.']], out: [['ricky', 'I was right. Write that down. Somebody write that down.']] } },
    { id: 'm9', name: 'Topping Off', tier: 3, objectives: [{ kind: 'clear', zone: 'roof', count: 20, hint: 'Clear the roof' }, { kind: 'interact', targets: 1, hint: 'Call in the boat' }, { kind: 'survive', time: 90, hint: 'Hold until the boat arrives' }],
      cut: { in: [['igor', 'From roof I see harbour. I see ship. On ship, I see man with very large head.']], out: [['wiener', 'Next stop, the harbour. Everybody hydrate. Ricky, not with chili.']] } },
  ] },
  { id: 'c4', map: 'ship', name: 'Ballin\' On a Boat', missions: [
    { id: 'm10', name: 'Boarding Party', tier: 3, objectives: [{ kind: 'reach', zone: 'deck', hint: 'Board the cargo ship' }, { kind: 'clear', zone: 'deck', count: 18, hint: 'Take the deck' }, { kind: 'collect', item: 'manifest', count: 3, hint: 'Find the cargo manifests' }],
      cut: { in: [['cancer', 'If I die out here, bury me at sea. Saves my family the hospital parking.']], out: [['wiener', 'Forty containers of fermented chili. Headed for a yacht party.']] } },
    { id: 'm11', name: 'Container Maze', tier: 3, objectives: [{ kind: 'interact', targets: 4, puzzle: 'crane', hint: 'Use the crane to clear a path (four moves)' }, { kind: 'escort', npc: 'captain', zone: 'bridge', hint: 'Get the captain to the bridge' }],
      cut: { in: [['igor', 'I can drive crane. I drove tractor through blizzard for nine days. Uphill.']], out: [['ricky', 'Igor drove that crane like my uncle drives, and my uncle don\'t have a license.']] } },
    { id: 'm12', name: 'Abandon Ship', tier: 4, objectives: [{ kind: 'defuse', puzzle: 'wires', hint: 'Defuse the charge in the hold' }, { kind: 'survive', time: 120, hint: 'Hold the lifeboats' }, { kind: 'reach', zone: 'lifeboat', hint: 'Get off the ship' }],
      cut: { in: [['wiener', 'They rigged the hull. We have minutes. Cancer, wires. Everyone else, make noise.']], out: [['cancer', 'Yacht party is tonight. Dress code: lethal.']] } },
  ] },
  { id: 'c5', map: 'yacht', name: 'Yacht Party Crashers', missions: [
    { id: 'm13', name: 'Plus Ones', tier: 4, objectives: [{ kind: 'reach', zone: 'stern', hint: 'Get aboard' }, { kind: 'collect', item: 'invite', count: 4, hint: 'Steal four VIP wristbands' }, { kind: 'interact', targets: 1, hint: 'Get past the bouncer' }],
      cut: { in: [['ricky', 'Finally a mission in my element. Let me do the talking.'], ['cancer', 'Absolutely not.']], out: [['ricky', 'See? I told him I was a rapper and he let us in.'], ['wiener', 'He let us in because you paid him two hundred dollars.']] } },
    { id: 'm14', name: 'Hot Tub Time Bomb', tier: 4, objectives: [{ kind: 'defuse', puzzle: 'wires', hint: 'Defuse the bomb in the hot tub' }, { kind: 'clear', zone: 'deck', count: 22, hint: 'Clear the party deck' }],
      cut: { in: [['igor', 'Bomb is in hot tub. I go in. In my country, water is always this temperature, but frozen.']], out: [['wiener', 'Guest list says Ballin\' left for the nuclear plant an hour ago. With the big pot.']] } },
    { id: 'm15', name: 'Man Overboard', tier: 5, objectives: [{ kind: 'survive', time: 150, hint: 'Hold the bridge against the Brotherhood' }, { kind: 'reach', zone: 'jetski', hint: 'Steal the jet skis' }],
      cut: { in: [['cancer', 'They\'re coming from every side. Good. Saves walking.']], out: [['ricky', 'I can\'t swim, by the way.'], ['wiener', 'You\'re on a jet ski, Ricky.'], ['ricky', 'And I\'m nervous about it.']] } },
  ] },
  { id: 'c6', map: 'nuke', name: 'Nuclear Gas Plant', missions: [
    { id: 'm16', name: 'Clock In', tier: 5, objectives: [{ kind: 'reach', zone: 'lobby', hint: 'Get inside the plant' }, { kind: 'collect', item: 'badge', count: 3, hint: 'Find three employee badges' }, { kind: 'interact', targets: 1, puzzle: 'keypad', hint: 'Open the reactor wing' }],
      cut: { in: [['wiener', 'He\'s using the reactor to heat the chili. Weapons-grade. The cloud would cover three states.']], out: [['igor', 'Reactor reminds me of home. Glowing. Warm. Slightly illegal.']] } },
    { id: 'm17', name: 'Meltdown Manager', tier: 5, objectives: [{ kind: 'interact', targets: 5, puzzle: 'rods', hint: 'Lower the control rods (match the gauges)' }, { kind: 'defend', zone: 'control', time: 150, hint: 'Hold the control room' }],
      cut: { in: [['cancer', 'Radiation\'s already doing my job for me. Let\'s go.']], out: [['wiener', 'The pot\'s gone. Ballin\' took it to the desert. Dust. It ends there.']] } },
    { id: 'm18', name: 'Exhaust Vent', tier: 6, objectives: [{ kind: 'clear', zone: 'vents', count: 24, hint: 'Clear the vent shafts' }, { kind: 'survive', time: 120, hint: 'Hold the loading dock' }, { kind: 'reach', zone: 'truck', hint: 'Get on the truck' }],
      cut: { in: [['ricky', 'Real talk, if I don\'t make it, tell my mixtape I loved it.']], out: [['igor', 'Tomorrow, we end this. Tonight, we drink. Only water. I am joking. Not water.']] } },
  ] },
  { id: 'c7', map: 'dust', name: 'Dust To Dust', missions: [
    { id: 'm19', name: 'Long A', tier: 6, objectives: [{ kind: 'reach', zone: 'long', hint: 'Push Long A' }, { kind: 'clear', zone: 'long', count: 26, hint: 'Clear Long' }, { kind: 'interact', targets: 2, hint: 'Blow the double doors' }],
      cut: { in: [['wiener', 'This is it. Everything hurts and I love it.'], ['cancer', 'Everything hurts and I\'m used to it.'], ['ricky', 'Nothing hurts and I\'m scared.'], ['igor', 'I feel nothing. Is good.']], out: [['wiener', 'Mid is crawling. He\'s at B. With the pot.']] } },
    { id: 'm20', name: 'Mid To B', tier: 6, objectives: [{ kind: 'defend', zone: 'mid', time: 120, hint: 'Hold Mid' }, { kind: 'collect', item: 'fuse', count: 3, hint: 'Grab three fuses for the B doors' }, { kind: 'interact', targets: 1, puzzle: 'fuses', hint: 'Power the B doors' }],
      cut: { in: [['igor', 'Mid is mine. Nobody crosses. Not even bird.']], out: [['ricky', 'The doors are open. Why is the ground shaking?'], ['cancer', 'That\'s him. Walking.']] } },
    { id: 'm21', name: 'Ballin\' Out', tier: 6, boss: true, objectives: [{ kind: 'boss', zone: 'b_site', hint: 'Take down Osama bin Ballin' }, { kind: 'defuse', puzzle: 'wires', hint: 'Defuse the doomsday chili pot' }],
      cut: { in: [['boss', 'You fools! In one hour this pot of chili will gas the entire world! Nobody will ever smell anything else again!'], ['wiener', 'Your chili is weak and so are you.'], ['boss', 'Feel... the GOY-BEAM!']],
        out: [['boss', 'Nooo... my beautiful... chili...'], ['ricky', 'Yo, can I keep his shoes?'], ['wiener', 'Squad. Proud of you. Mostly. Ricky, give the shoes back.'], ['igor', 'Tonight we celebrate. In Soviet style. Quietly. With much vodka.'], ['cancer', 'Same time next year. If I\'m alive.']] } },
  ] },
];
export const MISSIONS = CHAPTERS.flatMap((c, ci) => c.missions.map((m, mi) => ({ ...m, chapter: c.id, chapterName: c.name, map: c.map, index: ci * 3 + mi })));

// ---- banter: random combat lines (when something happens) -------------------------------------------------------------
export const BARKS = {
  wiener: { kill: ['Pain builds character. That one had none.', 'Next!', 'That felt GOOD. Do it again.'], hurt: ['Harder!', 'Is that all you got?', 'Ow. Again.'], ability: ['Chow time, ladies!', 'Mess kit! Bite down!'] },
  cancer: { kill: ['Terminal.', 'You got the diagnosis.', 'Stage four, buddy.'], hurt: ['I\'ve had worse. This week.', 'Tickles, compared to chemo.'], ability: ['Breathe deep!', 'Fresh from the oncology ward!'] },
  ricky: { kill: ['Bop!', 'Switch go brrr!', 'That\'s going in the mixtape.', 'Laser said so.'], hurt: ['My chains!', 'Not the fit, not the fit!'], ability: [] },
  igor: { kill: ['One shot. Like grandmother taught.', 'Is too easy, comrade.', 'Back to the gulag with you.'], hurt: ['Is only flesh.', 'Bah! Mosquito.'], ability: ['Russian Focus.', 'Breathe in. Is discipline.'] },
  corrections: [   // Wiener and Cancer roasting Ricky after he says something dumb
    ['ricky', 'Grenades are just guns that stopped trying.', 'cancer', 'That\'s not how anything works.'],
    ['ricky', 'If we\'re losing, the respawn button is right there.', 'wiener', 'It\'s real life, Ricky. There is no respawn.'],
    ['ricky', 'Reloading makes the gun stronger.', 'cancer', 'It makes it have bullets, Ricky.'],
    ['ricky', 'Is a sniper just a shy rifle?', 'igor', 'Comrade. I will pretend I did not hear.'],
    ['ricky', 'Smoke grenades are for hiding from your problems.', 'wiener', 'Correct, but for once that IS the tactic.'],
  ],
};
