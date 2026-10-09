// Story mode: "Operation Ballin' Out", an online co-op campaign for up to four players against AI enemies, across
// every map plus three story-only ones, ending in Ballin' Arena. This file is the campaign itself, as data: the four characters (one of each per
// game), what difficulty changes, the chapters and missions (objectives, puzzles, cutscene lines, enemy waves, the
// weapons each character carries at that point) and the final boss. The mode's logic reads it; nothing here runs.
//
// Tone: crude, juvenile, roast-heavy on top, and underneath it a story about a father and a son. Nobody's jokes are about race or religion; the villain is a cartoon, his
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
    ability: { id: 'mess_kit', name: 'Combat Medic', desc: 'Every squadmate within 10 m back to full health. Learned at eleven years old, in a house on Mustard Street.', cd: 45, radius: 10, unlock: { mission: 'w5', obj: 6 } },
  },
  cancer: {
    name: 'Captain Cancer', short: 'Cancer', role: 'Close quarters · area denial',
    look: { body: '#d8e2e8', legs: '#d8e2e8', head: '#e8c4a8', hat: 'none', gown: true },   // bald, in a hospital gown
    bio: 'Bald, in a hospital gown, IV pole long since traded for an SMG. Has nothing to lose and says so constantly. Dark jokes, short temper, never misses a chance to correct Ricky.',
    guns: { cats: ['smg'], ids: [] },   // SMGs only
    ability: { id: 'cancer_nade', unlock: { mission: 'o1', obj: 3 }, name: 'Cancer Nade', desc: 'One per mission: a canister of hospital-grade nasty. A lingering poison cloud that hurts and slows anyone standing in it.', perLevel: 1, dps: 9, radius: 4.5, dur: 9, slow: 0.6 },
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
  // not one of the four: in the epilogue, whoever played Cancer plays the new recruit (story.js absent: ['cancer'])
  recruit: { name: 'New Recruit', short: 'Recruit', role: 'First day', look: { body: '#4a5a3a', legs: '#3a4430', head: '#d8a882', hat: 'cap', hatColor: '#4a5a3a' }, bio: 'First day on base. Wants an expresso.', guns: { cats: ['rifle'], ids: [] }, ability: null, extra: true },
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
  recruit: [['famas'], ['famas'], ['galil'], ['m4a4'], ['m4a4'], ['m4a4'], ['m4a4']],
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

// ---- one-on-one bosses (story_sim.js fatherTick / reaperTick) -------------------------------------------------------------
// vulnMul / armorMul: damage taken inside an opening (after a miss, a swing) and outside one. Telegraphs are drawn for
// every attack so each one can be read and dodged.
export const BOSSES = {
  father: { name: 'Dad', look: 'father', scale: 1.3, hp: 820, vulnMul: 2.4, armorMul: 0.4, swing: 24, charge: 32, bottle: 14,
    miss: ['Hold STILL, you little—', 'Get over here!', 'Don\'t you run from me!'], wall: ['*groans*', 'Damn it—', '...where\'d you go?'],
    phaseLines: [null, ['boss', 'You think you\'re a MAN now? Huh?'], ['boss', 'Your mother would be ashamed of you. ASHAMED.']],
    after: [['danny', '(The room is very quiet.)', { cam: 'wide', music: '' }], ['danny', 'Frankie...?', { cam: 'close' }], ['danny', 'Why did you do that?'], ['wiener', '(He looks at his little brother for a long time.)', { cam: 'close', hold: 1.6 }], ['wiener', 'Wiener\'s protect their own.', { cam: 'close', hold: 2.5 }]] },
  reaper: { name: 'The Reaper', look: 'reaper', scale: 1.45, hp: 1500, vulnMul: 1.0, armorMul: 0.08, reapFrac: 0.42, grasp: 26,
    phaseLines: [[['cancer', 'Okay. Okay. Every swing, it opens up. Hit it THEN.']], [['cancer', '(The lights die. It is not where it was a second ago.)'], ['cancer', 'Stop trying to see it coming, Dale. Just move.']], null],
    fall: [['cancer', '(The scythe catches him. He goes down.)', { cam: 'close', down: 'cancer', music: '', vision: 'dread_last' }], ['cancer', '(It stands over him. Patient. It has all the time in the world.)', { cam: 'boss', hold: 1.6 }], ['cancer', '(His chest rises. Falls. Rises.)', { cam: 'close', hold: 1.2 }], ['cancer', '...huh.'], ['cancer', 'Still here.', { hold: 0.8 }], ['cancer', '(He taps his chest twice.) Still ticking.', { fullhp: true, music: 'defiant', hold: 1 }]],
    end: [['cancer', '(The blow lands. It does not fall.)', { cam: 'wide', music: '' }], ['cancer', '(It lowers the scythe. It looks at him for a long, long time.)', { cam: 'boss', hold: 2.5 }], ['cancer', 'Yeah. I know.', { cam: 'close' }], ['cancer', 'Not today, though.', { hold: 1 }], ['cancer', '(When he looks up, the lobby is just a lobby.)', { bossEnd: true, vision: '', hold: 1.5 }]] },
};
// people only the story needs (looks for the character models: same fields as the agents' looks)
export const STORY_LOOKS = {
  wiener_young: { body: '#d0583a', legs: '#e8b868', head: '#d0583a', hat: 'bun', hatColor: '#ecc070' },
  wiener_little: { body: '#e06a48', legs: '#f0c47a', head: '#e06a48', hat: 'bun', hatColor: '#f2cc84' },
  father: { body: '#9a3426', legs: '#5a4a3a', head: '#9a3426', hat: 'bun', hatColor: '#b88a4a', belly: true },
  reaper: { body: '#0e0e10', legs: '#0e0e10', head: '#d6d2c6', hat: 'none' },
  doctor: { body: '#e8eef2', legs: '#7a90a8', head: '#8a5a3a', hat: 'none' },
  security: { body: '#34425e', legs: '#24242c', head: '#c89a74', hat: 'cap', hatColor: '#24304a' },
  suit: { body: '#1c1c20', legs: '#1c1c20', head: '#b8875e', hat: 'none' },
  winter_a: { body: '#d6dad6', legs: '#c4c8c4', head: '#d8b896', hat: 'helmet', hatColor: '#dcdedc' },
  winter_b: { body: '#c8d0c4', legs: '#b6beb2', head: '#caa486', hat: 'helmet', hatColor: '#a8b2a2' },
};

// ---- the campaign: 8 chapters, 27 levels ---------------------------------------------------------------------------------
// The plan behind all of this (arcs, inside jokes, clues, the twist) is in browserdev/STORY_KYSGO.md; it is kept out
// of the published game because it spoils everything.
//
// A level: { id, name, map?, tier, intro, objectives, cut: { in, out }, absent? }
//   map: overrides the chapter's map (story-only maps: barracks, barracks_night, hospital, stadium)
//   intro: the line on the black card while the level loads (the between-level transition)
//   absent: characters who are not in this level (their player plays someone else, see CHARACTERS.recruit)
// An objective: { kind, hint, ... , say, scene, done }
//   say: radio/banter lines played over gameplay when it starts (nobody stops)
//   scene: a short in-engine cutscene before it starts (everyone watches together; a checkpoint)
//   done: lines over gameplay when it is finished
// Kinds: reach, clear, defend, survive, collect, interact, defuse, escort, boss, and the story-only ones:
//   explore { points: [{ zone, label, say }] }  walk-and-talk: each point plays its lines when someone reaches it
//   stealth { zone, guards }  get there unseen; being spotted brings reinforcements (it never fails the mission)
//   revive { who }  a squadmate is down: hold USE on them while the enemy pushes
//   carry { who, zone }  that character carries the objective to the zone; everyone else keeps them alive
// Speakers: the four characters, 'boss', and the extra voices in SPEAKERS.
export const SPEAKERS = { command: 'Colonel Brisket (Command)', tape: 'Dale (on tape)', doctor: 'Dr. Adebayo', nurse: 'Nurse Kowalczyk', chef: 'The Chili Chef', captain: 'The Captain', bouncer: 'The Bouncer', recruit: 'New Recruit', squad: 'Everyone', credits: '', dad: 'Dad', danny: 'Danny', radio: 'Radio', enemy: 'Guard' };

export const CHAPTERS = [
  { id: 'c1', map: 'range', name: 'Wieners Protect Their Own', hub: 'Frank Wiener got back up. He has never once told anyone what it cost.', missions: [
    { id: 'm1', name: 'Reveille', map: 'barracks', tier: 0, intro: 'Fort Brisket. 0500. Somebody is already doing push-ups.',
      objectives: [
        { kind: 'explore', hint: 'Find your squad', points: [
          { zone: 'Bunks', label: 'Wiener', say: [['wiener', 'Thirty-nine. Forty. Forty-one.'], ['wiener', 'Don\'t ask what the number is for. Nobody asks. That\'s the rule.'], ['wiener', 'Sergeant Wiener. Yes, the costume is regulation. No, you may not touch the bun.'], ['wiener', 'One more rule. Wieners protect their own. You\'re all Wieners now. Don\'t make it weird.']] },
          { zone: 'Mess Hall', label: 'Ricky', say: [['ricky', 'Yo! You the new ones too? Recruit Ricky. Can I get an expresso around here?'], ['cancer', 'Espresso. There is no X. There has never been an X.'], ['ricky', 'You sure? Because I been saying it with the X for thirty-four years and nobody complained.'], ['cancer', 'I\'m complaining. I\'m complaining right now.'], ['ricky', 'Eight months clean and THIS is how I get treated.']] },
          { zone: 'Infirmary', label: 'Cancer', say: [['cancer', 'Captain Cancer. Yes, that\'s the callsign. Yes, I have it. Stage four, before you ask.'], ['ricky', 'Man, naming yourself after it is like getting your ex\'s name tattooed.'], ['cancer', 'It\'s more like a name tag, kid. Saves everybody the awkward question.'], ['cancer', 'Upside: I\'m the bravest man on this base. I\'ve got nothing to lose.']] },
          { zone: 'Watchtower', label: 'Igor', say: [['igor', 'Igor. Sniper. In my village, we train with one bullet. If you miss, you are the target.'], ['igor', 'I still carry the bullet. I do not fire it. Is for something important.'], ['ricky', 'What village?'], ['igor', '...one that had very long winters.']] },
        ] },
        { kind: 'interact', targets: 1, zone: 'Armory', hint: 'Draw your weapons from the armory', say: [['ricky', 'Do they got a Glock with the switch on it? I\'m asking for a friend. The friend is me.'], ['wiener', 'You get one Glock, Recruit. One. I\'ve read your file.']] },
        { kind: 'reach', zone: 'Parade Ground', hint: 'Fall in on the parade ground',
          scene: [['wiener', 'Listen up. You are the worst squad this base has ever assembled, and I picked every one of you personally.', { cam: 'wide' }], ['wiener', 'That\'s not a compliment. That\'s a confession.'], ['wiener', 'Recruit. You sure you want this? Last chance to walk away.'], ['ricky', 'Been waiting thirty-four years for this, Sarge. I ain\'t walking.'], ['cancer', 'Thirty-four years. You mean your whole life.'], ['ricky', '...yeah. Something like that.']] },
      ],
      cut: { in: [['command', 'Morning, Sergeant! Colonel Brisket, your new handler. You\'ll hear me in your ear, never see my face. Like a conscience, but useful.', { cam: 'wide' }], ['wiener', 'Copy, Command. What\'s that squeaking behind you?'], ['command', 'New office floors. Very shiny. Get your people up, Sergeant.']],
        out: [['command', 'Somebody\'s been leaving live rounds on the range. Go take a look. Probably nothing!'], ['wiener', 'Probably nothing. Squad, full kit.']] } },
    { id: 'm2', name: 'Orientation', tier: 0, intro: 'The range. Somebody has been leaving live rounds in the training dummies.',
      objectives: [
        { kind: 'reach', zone: 'Firing Line', hint: 'Get to the firing line', say: [['ricky', 'I\'m ready. I trained. I watched like four movies.'], ['cancer', '...which four?'], ['ricky', 'Just four. Old ones. Don\'t worry about it.'], ['cancer', 'I wasn\'t worried. I\'m never worried.']] },
        { kind: 'clear', zone: 'Lanes', count: 12, hint: 'Shoot the targets (they shoot back)', say: [['igor', 'Targets have rifles. Is new. I like it.'], ['wiener', 'Ricky! Stop firing from the hip like a music video!'], ['ricky', 'It\'s WORKING though!']] },
        { kind: 'interact', targets: 3, zone: 'Berm', hint: 'Reset the three target winches', done: [['wiener', 'Somebody wired those dummies the night before. Somebody with keys.'], ['igor', 'And this. A basketball. Signed "O.B.B."']] },
      ],
      cut: { in: [['wiener', 'Intel says the Ballin\' Brotherhood is building something big. Something that smells.', { cam: 'wide' }], ['igor', 'In my village, we train with one bullet. Today I bring many. Is special occasion.']],
        out: [['wiener', 'Osama bin Ballin. In MY range.'], ['command', 'Nothing but net, team! Take a breather. Range is clear now.'], ['cancer', 'He says that a lot. "Nothing but net."'], ['wiener', 'Command\'s a basketball fan. Lot of people are.']] } },
    { id: 'w3', name: 'Ambush', tier: 1, intro: 'Range is clear now, Command said.',
      objectives: [
        { kind: 'reach', zone: 'Firing Line', hint: 'Walk the range with your squad', say: [['ricky', 'Sarge, real talk. What do you do for fun?'], ['wiener', 'Push-ups.'], ['ricky', 'For FUN.'], ['wiener', 'Angry push-ups.'], ['cancer', 'He has one hobby. It\'s called yelling.'], ['igor', 'In my village, fun was illegal. We had it anyway. Quietly.']] },
        { kind: 'collect', item: 'live round', count: 3, hint: 'Pick up the live rounds on the range', say: [['cancer', 'Live rounds on a training range. Again.'], ['ricky', 'Maybe the range is haunted.'], ['cancer', 'Maybe you are.']] },
        { kind: 'interact', targets: 1, zone: 'Berm', hint: 'Check the berm',
          scene: [['igor', '(Igor stops. Listens.)', { cam: 'wide', music: '' }], ['igor', '...Wiener. The birds stopped.', { hold: 0.6 }], ['wiener', 'Everybody down. DOWN!', { sfx: 'explode', music: 'action' }]] },
        { kind: 'survive', time: 40, hint: 'AMBUSH: hold on', say: [['wiener', 'Contact everywhere! Stay on me! STAY ON ME!'], ['ricky', 'They coming out the GROUND, man!'], ['cancer', 'Frank, they\'re cutting us off—']] },
      ],
      cut: { in: [['command', 'Range is clear, team. Quick sweep and you\'re home for lunch.', { cam: 'wide' }]],
        out: [['wiener', 'Ricky! Cancer! Igor! ON ME!', { cam: 'wide' }], ['ricky', 'Sarge—! Get off me! GET OFF—', { capture: 'wiener' }], ['igor', '(A rifle butt. Igor goes down without a sound.)'], ['cancer', 'FRANK! Don\'t you dare come after—'],
          ['wiener', '(A round in the side. Another in the leg. He falls.)', { cam: 'pov_down', down: 'wiener', vision: 'dying', music: 'heartbeat' }], ['wiener', '(The rifle is right there. It is a mile away.)', { cam: 'pov_down' }], ['wiener', '(A truck pulls away. Three shapes in the back.)', { cam: 'pov_down', hold: 1.2 }],
          ['wiener', '...get... up...', { cam: 'pov_down' }], ['wiener', '(He can\'t.)', { cam: 'pov_down', hold: 1.6 }], ['wiener', '(His eyes close.)', { cam: 'pov_down', vision: 'black', hold: 1.6 }]] } },
    { id: 'w4', name: 'The House', map: 'wiener_house', tier: 0, featured: 'wiener', vision: 'flashback', music: '', intro: 'Thirty years earlier. The house on Mustard Street.',
      scale: { wiener: 0.66 }, look: { wiener: 'wiener_young' }, loadout: { wiener: { guns: [], noKnife: true } },
      actors: [{ id: 'danny', look: 'wiener_little', scale: 0.5, zone: 'Danny\'s Room', name: 'Danny' }],
      objectives: [
        { kind: 'explore', hint: '(walk the house)', points: [
          { zone: 'Kitchen', label: '', say: [['wiener', '(A bottle on the table. Three empties under it.)']] },
          { zone: 'Coat Hooks', label: '', say: [['wiener', '(Mom\'s coat is still on the hook.)']] },
          { zone: 'Living Room', label: '', say: [['wiener', '(The TV is on. Nobody is watching it.)']] },
        ] },
        { kind: 'reach', zone: 'Hallway', hint: '(the hallway)',
          scene: [['dad', '(Something heavy hits a wall upstairs. Then again.)', { cam: 'pov', look: 'Shadow Wall', shadow: 'beat', sfx: 'punch' }], ['dad', 'You think you can just— LOOK at me when I\'m talking to you!', { cam: 'pov', look: 'Shadow Wall', shadow: 'beat', sfx: 'punch' }],
            ['dad', '(A cry. Muffled. Then nothing.)', { cam: 'pov', look: 'Shadow Wall', shadow: 'beat', hold: 1 }],
            ['wiener', '(One year earlier.)', { place: ['wiener', 'Grave Side'], cam: 'grave', vision: 'memory', hold: 1.5 }], ['wiener', '(Nobody says anything at a funeral for a long time.)', { cam: 'grave', hold: 2 }], ['wiener', '(Frank holds his little brother\'s hand. Danny is holding a balloon he doesn\'t understand.)', { cam: 'grave', hold: 2 }],
            ['wiener', '(The headstone says MARGARET WIENER. LOVED HER BOYS.)', { cam: 'grave', hold: 2.5 }],
            ['dad', 'Frankie!? Where\'s your brother!?', { place: ['wiener', 'Hallway'], cam: 'pov', look: 'Shadow Wall', vision: 'flashback', shadow: 'beat', sfx: 'punch' }],
            ['danny', 'FRANKIE—', { cam: 'pov', look: 'Danny\'s Door', shadow: 'beat', sfx: 'punch' }], ['wiener', '(Danny. It\'s Danny in there.)', { cam: 'pov', look: 'Kitchen', hold: 1.2 }]] },
        { kind: 'interact', targets: 1, zone: 'Knife Block', hint: 'The knife on the counter', give: ['wiener', 'knife'], say: [['wiener', '(His hands are shaking. He picks it up anyway.)']] },
        { kind: 'boss', boss: 'father', zone: 'Danny\'s Room', hint: 'Save Danny',
          scene: [['wiener', '(He runs.)', { place: ['wiener', 'Shadow Wall'], cam: 'pov', look: 'Danny\'s Door', music: '', slowmo: [0.55, 3.2], sfx: 'heartbeat' }], ['dad', '(The door bursts open. Dad turns, slow, huge, swaying.)', { place: ['wiener', 'Danny Doorway', 'Danny\'s Room'], cam: 'boss' }], ['dad', '...the hell are you doing with that, boy?', { cam: 'boss' }], ['dad', 'You\'re just like her. You know that? JUST like her.', { cam: 'boss', music: 'dad' }]] },
      ],
      cut: { in: [['dad', '(A glass. Then just the bottle.)', { cam: 'pov', look: 'Shadow Wall', shadow: 'drink' }], ['dad', 'Ten years I gave that plant. Ten years. And she just... leaves me with them.', { cam: 'pov', look: 'Shadow Wall', shadow: 'drink' }], ['dad', '(The bottle hits the wall. Glass everywhere.)', { cam: 'pov', look: 'Shadow Wall', shadow: 'drink', sfx: 'glass', hold: 1.2 }]],
        out: [['danny', '(They sit on the porch steps until the sirens come. Neither of them lets go.)', { cam: 'wide', place: ['wiener', 'Porch'], walk: ['danny', 'Porch'], hold: 3 }]] } },
    { id: 'w5', name: 'Protect Their Own', tier: 1, featured: 'wiener', vision: 'dying', music: 'pulse', intro: 'Now.', loadout: { wiener: { guns: [], armor: false } },
      objectives: [
        { kind: 'interact', targets: 1, zone: 'Firing Line', hint: 'Get up. Get a rifle.', give: ['wiener', 'ak47'], done: [['wiener', '(He checks the magazine. He doesn\'t say anything.)']], music: 'pulse' },
        { kind: 'clear', zone: 'Lanes', count: 16, hint: 'Kill every one of them', music: 'action', vision: '' },
        { kind: 'rescue', who: 'ricky', zone: 'North Trailers', guards: 5, hint: 'Ricky is in the trailers', say: [['ricky', '(from inside a trailer) ...and THAT\'S why it\'s called Tapes From My Pops— wait. Is that—'], ['ricky', 'SARGE?']], done: [['ricky', 'They said you were dead, man. They SAID—'], ['wiener', 'Get a gun.']] },
        { kind: 'rescue', who: 'cancer', zone: 'Command', guards: 6, time: 75, hint: 'Cancer is in Command. They\'re gassing the room: 75 seconds', say: [['cancer', '(coughing, through the door) Frank? Frank, if that\'s you, the room\'s filling up. If it\'s not you, I\'m armed. I\'m not armed.']], done: [['cancer', 'You came back for me. Idiot.'], ['wiener', 'Get behind me.']] },
        { kind: 'rescue', who: 'igor', zone: 'Range Tower', guards: 6, hint: 'Igor is strung up in the range tower', say: [['igor', '(upside down) Comrade. I have been hanging here forty minutes. All my blood is in my hat.']], done: [['igor', 'You are bleeding very much, Wiener.'], ['wiener', 'Move.']] },
        { kind: 'reach', zone: 'CT Yard', hint: 'Get everyone to the yard', music: 'pulse' },
        { kind: 'ability', who: 'wiener', hint: 'COMBAT MEDIC: press G (SKILL on a phone, D-pad up on a controller) next to your squad',
          scene: [['ricky', '(They\'re all hurt. Ricky is holding his ribs. Cancer can barely stand.)', { cam: 'wide', music: 'tender' }], ['cancer', 'We need a medic, Frank. You need a medic.'], ['wiener', '(He looks at them. All three. Bleeding.)', { hold: 1.2 }], ['wiener', 'Not again.', { unlock: 'wiener' }]] },
      ],
      cut: { in: [['wiener', 'Wiener\'s protect their own.', { cam: 'pov_down', vision: 'dying', music: '' }], ['wiener', '(His eyes open.)', { cam: 'pov_down', hold: 1.2 }], ['wiener', '(He gets up.)', { cam: 'close', vision: '', music: 'pulse' }]],
        out: [['ricky', 'Okay so who taught the hot dog to do surgery?', { cam: 'wide', music: 'tender' }], ['cancer', 'He\'s a hot dog, Ricky. Everything about him is surgery.'], ['igor', 'Wiener. Where did you learn this?'], ['wiener', '(He doesn\'t answer. He\'s already checking their bandages again.)', { hold: 1.5 }], ['ricky', '...Sarge? You good?'], ['wiener', 'Squad. Back to base.']] } },
  ] },
  { id: 'c2', map: 'mansion', name: 'The Wrong House', hub: 'Two weeks later, clearing out his mother\'s closet, Ricky found a shoebox of letters and four old videotapes. Every letter was from the same man.', missions: [
    { id: 'r1', name: 'The Wrong House', tier: 2, featured: 'ricky', vision: 'night', music: '', intro: 'Ricky. Eight months before he enlisted.', loadout: { ricky: { guns: [], armor: false } }, enemyLook: 'suit',
      enemyNames: ['Big Sal', 'Little Sal', 'Tony Two-Times', 'Mikey Cufflinks', 'Paulie Napkins', 'Vinnie Valet', 'Jimmy Coat Check', 'Nicky Bones'],
      objectives: [
        { kind: 'explore', hint: 'Find something worth selling', points: [
          { zone: 'Foyer', label: '', say: [['ricky', '(whispering) Rich people always leave the window open. It\'s like a law.']] },
          { zone: 'Study', label: '', say: [['ricky', 'A watch. Ooh. A watch that costs more than my whole street. Hello, rent.'], ['ricky', 'Hello, rent AND the other thing.'], ['ricky', '(He stops smiling for a second. Then he puts it in his pocket.)']] },
        ] },
        { kind: 'stealth', zone: 'Gallery', guards: 4, hint: 'Somebody is home. Get to the gallery without being seen',
          scene: [['ricky', '(Voices downstairs. Lots of them.)', { cam: 'pov', look: 'Foyer', music: '' }], ['ricky', '(A guard walks past the door with a rifle the size of Ricky\'s apartment.)', { cam: 'pov', look: 'Foyer' }], ['ricky', '(whispering) Oh no. Oh no no no. This is Big Lou\'s house.'], ['ricky', 'I robbed Big Lou. I am robbing Big Lou. Present tense. Oh I\'m so dead.']] },
        { kind: 'interact', targets: 1, zone: 'Display Case', hint: 'The display case',
          scene: [['ricky', '(Under the glass: a Glock. Switch on the back. A laser. A drum mag.)', { cam: 'close' }], ['ricky', '(He picks it up like he\'s meeting someone.)', { give: ['ricky', 'glock_sw'] }], ['ricky', 'Okay. Okay okay okay. New plan.', { music: 'ricky' }]] },
        { kind: 'clear', zone: 'Ballroom', count: 6, hint: 'Fight through the ballroom', say: [['ricky', 'Excuse me! Pardon me! Just leaving!']] },
        { kind: 'clear', zone: 'Kitchen', count: 5, hint: 'Through the kitchen', say: [['ricky', 'Nice kitchen. Nice knives. Not today, knives.']] },
        { kind: 'clear', zone: 'Garage', count: 6, hint: 'Through the garage', say: [['ricky', 'Seven cars. SEVEN. Who needs seven cars? Big Lou, apparently.']] },
        { kind: 'reach', zone: 'Front Gate', hint: 'Out the front gate', say: [['ricky', 'Gate. Gate gate gate gate GATE.']] },
      ],
      cut: { in: [['ricky', '(A window. A rich house. Two in the morning.)', { cam: 'wide' }], ['ricky', 'In and out. Nobody gets hurt. Ricky gets paid.', { cam: 'close' }]],
        out: [['ricky', '(He steps into the street. The night is very quiet.)', { place: ['ricky', 'Street', 'Street End'], cam: 'wide', music: 'ricky' }], ['ricky', '(He tucks the Glock into his waistband.)', { cam: 'close' }], ['ricky', '(He lights a blunt.)', { smoke: 'ricky', cam: 'close' }], ['ricky', 'Normal Tuesday.', { smoke: 'ricky' }], ['ricky', '(And he walks.)', { walk: ['ricky', 'Street End'], cam: 'pull', hold: 4 }]] } },
  ] },
  { id: 'c3', map: 'town', name: 'Small Town, Big Problems', hub: 'Nine thousand bottle rockets, a pallet of expired chili, and Ricky with a phone.', missions: [
    { id: 'm5', name: 'Fireworks Stand', tier: 1, intro: 'Burnt Town. The Brotherhood paid cash for every firework in the county.',
      objectives: [
        { kind: 'reach', zone: 'stand', hint: 'Find the fireworks stand', say: [['igor', 'Ricky. Your dog tags. "Richard D. Johnson." D is for?'], ['ricky', 'Dangerous.'], ['igor', 'Really?'], ['ricky', 'D is for none of your business, comrade.'], ['cancer', '(very quietly) ...D.']] },
        { kind: 'clear', zone: 'square', count: 16, hint: 'Clear the town square' },
        { kind: 'collect', item: 'receipt', count: 4, hint: 'Find the Brotherhood\'s receipts', done: [['cancer', 'Chili. Rockets. And a deposit on a pot the size of a hot tub.']] },
      ],
      cut: { in: [['cancer', 'Brotherhood bought nine thousand bottle rockets and a pallet of expired chili. In cash.'], ['ricky', 'Man, that\'s just a Tuesday where I\'m from.']],
        out: [['igor', 'Chili and rockets. In my village this is called "dinner and dessert".'], ['command', 'The cook-off! That\'s where they\'re brewing it. Go, go, go!']] } },
    { id: 'm6', name: 'Chili Cook-Off', tier: 1, intro: 'The chili is the payload. The chef knows the recipe.',
      objectives: [
        { kind: 'interact', targets: 4, puzzle: 'valves', hint: 'Shut the four gas valves in the right order',
          say: [['ricky', '(humming) Hm hm hmmm, little biscuit, hm hm...'], ['cancer', 'Where did you hear that?'], ['ricky', 'Hear what?'], ['cancer', '...nothing. Valves. Do the valves.'], ['cancer', '(under his breath) ...little biscuit, go to sleep...']] },
        { kind: 'escort', npc: 'chef', zone: 'van', hint: 'Get the chef to the van alive' },
      ],
      cut: { in: [['wiener', 'The chili is the weapon. Ballin\' is fermenting it into gas. We extract the cook.']],
        out: [['ricky', 'He gave me a sample. It\'s actually fire though.'], ['cancer', 'Ricky, you just ate a chemical weapon.'], ['ricky', '...it\'s actually fire though.'], ['chef', 'He\'s not wrong. It\'s my best batch. That\'s the problem.']] } },
    { id: 'm7', name: 'Ricky\'s Bad Idea', tier: 2, intro: 'Ricky went live. Forty viewers. One of them was the enemy.',
      objectives: [
        { kind: 'survive', time: 140, hint: 'Survive: Ricky posted your location online', say: [['ricky', 'Shout out to the chat! Go stream my mixtape, Tapes From My Pops, link in bio!'], ['igor', 'Tapes From My Pops. Is terrible name.'], ['ricky', 'It\'s a GREAT name. It\'s personal.'], ['cancer', 'You make tapes about your father?'], ['ricky', 'About what he left behind. Shoot the guys, Cancer.']] },
        { kind: 'defuse', puzzle: 'wires', hint: 'Defuse the chili bomb' },
        { kind: 'reach', zone: 'bridge', hint: 'Get out of town' },
      ],
      cut: { in: [['ricky', 'Okay so I MIGHT have done a little livestream.'], ['wiener', 'You livestreamed a covert operation.'], ['ricky', 'Forty viewers, Sarge. Forty. That\'s my best one.']],
        out: [['wiener', 'Ricky. That livestream nearly got all of us killed.'], ['ricky', 'I know, Sarge.'], ['wiener', '...You also hot-wired that truck in nine seconds under fire.'], ['ricky', 'Eight. I counted.'], ['wiener', 'Don\'t push it.'], ['cancer', 'One of your forty viewers was Ballin\'. He left a comment: "see u at the crust".'], ['wiener', 'And another one. User "Brisket_Fan_1". Commented "nice."'], ['ricky', 'See? I got fans.']] } },
  ] },
  { id: 'c4', map: 'crust', name: 'Pizza Crust Massacre', hub: 'Pizza ovens hot enough to cook a city, and Igor starts paying attention.', missions: [
    { id: 'm8', name: 'Delivery Guys', tier: 2, intro: 'The Crust. Every order in the book is going to the same address.',
      objectives: [
        { kind: 'stealth', zone: 'kitchen', guards: 6, hint: 'Sneak into the kitchen (don\'t get spotted)', say: [['igor', 'We go in as pizza men. I have the hat.'], ['cancer', 'You have a hat. That\'s it. That\'s the disguise.']] },
        { kind: 'collect', item: 'order slip', count: 5, hint: 'Grab the order slips' },
        { kind: 'clear', zone: 'dining', count: 18, hint: 'Clear the dining room' },
      ],
      cut: { in: [['command', 'Light resistance at the Crust, team. In and out.']],
        out: [['wiener', 'Every order goes to a harbour. Extra large. Extra gas.'], ['wiener', 'And that was not light resistance.'], ['command', 'My mistake! Bad intel. Happens to the best of us.']] } },
    { id: 'm9', name: 'The Oven', tier: 2, intro: 'If the ovens hit nine hundred degrees, the gas goes up and takes the block with it.',
      objectives: [
        { kind: 'interact', targets: 3, puzzle: 'temps', hint: 'Set the three ovens in order',
          scene: [['ricky', 'What if we just... turn them off?'], ['wiener', 'Ricky. For once in your life. That\'s correct.'], ['ricky', 'I was right. Somebody write that down. Somebody write that DOWN.'], ['cancer', 'I\'ll get a pen. Mark the date. It may never happen again.']] },
        { kind: 'defend', zone: 'oven', time: 95, hint: 'Hold the oven room while it cools',
          scene: [['igor', 'Ricky. When Cancer is not here, you speak like professor. Big words. All correct.'], ['ricky', 'Man, I don\'t know what you heard.'], ['igor', 'I heard "unconscionable." Yesterday. To a vending machine.'], ['ricky', '...Igor. Please. Don\'t.'], ['igor', 'I say nothing. In my village, we keep each other\'s stories.']] },
      ],
      cut: { in: [['cancer', 'Nine hundred degrees and the block goes up. Supposedly.'], ['ricky', 'Supposably.'], ['cancer', 'SUPPOSEDLY. There\'s no B. Why would there be a B?']],
        out: [['ricky', 'I was right. Write it down.'], ['cancer', 'Wrote it down. "Ricky, once."'], ['ricky', 'When this is over I\'m opening a studio. Real one. Soundproof.'], ['cancer', 'When this is over. Everybody\'s got a "when this is over."'], ['ricky', 'What\'s yours?'], ['cancer', '...I had one. It had a boat in it.']] } },
    { id: 'm10', name: 'Topping Off', tier: 3, intro: 'From the roof you can see the harbour, and a ship with a very large head on it.',
      objectives: [
        { kind: 'clear', zone: 'roof', count: 18, hint: 'Clear the roof' },
        { kind: 'interact', targets: 1, hint: 'Call in the boat' },
        { kind: 'survive', time: 85, hint: 'Hold until the boat arrives', say: [['igor', 'From roof I see harbour. I see ship. On ship I see man with very large head.']] },
      ],
      cut: { in: [['wiener', 'Up top. We see where they\'re taking it.']],
        out: [['wiener', 'Next stop, the harbour. Everybody hydrate. Ricky, not with chili.'], ['command', 'Harbour\'s quiet, team. Light resistance.'], ['cancer', 'He said that last time.']] } },
  ] },
  { id: 'c5', map: 'ship', name: 'Ballin\' On a Boat', hub: 'Forty containers of gas, four old movies, and a handler who keeps getting it wrong.', missions: [
    { id: 'm11', name: 'Boarding Party', tier: 3, intro: 'Light resistance, said Command.',
      objectives: [
        { kind: 'reach', zone: 'deck', hint: 'Board the cargo ship' },
        { kind: 'clear', zone: 'deck', count: 18, hint: 'Take the deck', say: [['wiener', 'Light resistance. LIGHT RESISTANCE.'], ['cancer', 'That\'s twice. Three times is a pattern.']] },
        { kind: 'collect', item: 'manifest', count: 3, hint: 'Find the cargo manifests' },
      ],
      cut: { in: [['cancer', 'If I die out here, bury me at sea. Saves my family the hospital parking.'], ['ricky', 'You got family?'], ['cancer', 'Had. A long time ago. I left. That\'s the whole story.'], ['ricky', 'That\'s never the whole story.']],
        out: [['wiener', 'Forty containers of fermented chili. Headed for a yacht party.']] } },
    { id: 'm12', name: 'Container Maze', tier: 3, intro: 'A maze of steel boxes and one crane. Igor says he can drive it.',
      objectives: [
        { kind: 'interact', targets: 4, puzzle: 'crane', hint: 'Use the crane to clear a path (four moves, in order)', say: [['igor', 'I can drive crane. I drove tractor through blizzard for nine days. Uphill.'], ['ricky', 'Both ways?'], ['igor', 'Is a blizzard, Ricky. All ways.']] },
        { kind: 'escort', npc: 'captain', zone: 'bridge', hint: 'Get the captain to the bridge',
          scene: [['ricky', '"The moon don\'t need you to reach it, biscuit. It just needs you to look up."'], ['igor', 'What is this from?'], ['ricky', 'The Biscuit Who Wanted The Moon. Old movie. Dog Cop Three, Grandpa\'s Big Fish, Space Cowboy Christmas. I know all four by heart.'], ['wiener', '(looking at Cancer) ...'], ['cancer', 'I\'m going to check the stern.'], ['ricky', 'You okay, Cancer?'], ['cancer', 'Allergic to boats. Keep moving.']] },
      ],
      cut: { in: [['command', 'Captain\'s locked in the hold. Get him to the bridge and he\'ll steer you in.']],
        out: [['igor', 'Wiener. Command\'s calls. There is squeaking. Basketball shoes. I noticed weeks ago.'], ['wiener', 'WEEKS? And you didn\'t say?'], ['igor', 'I wanted to be sure. Information is dangerous when it is wrong.'], ['wiener', 'You tell me everything, Igor. That\'s how people stay alive.'], ['igor', '(quietly) ...Yes. That is how they stay alive.'], ['captain', 'They paid me to carry it. A man on the phone arranged it. Called himself "Coach".'], ['ricky', 'Igor drove that crane like my uncle drives. And my uncle don\'t have a license.']] } },
    { id: 'm13', name: 'Abandon Ship', tier: 4, intro: 'They rigged the hull. You have minutes.',
      objectives: [
        { kind: 'defuse', puzzle: 'wires', hint: 'Defuse the charge in the hold', say: [['wiener', 'Cancer, wires. Everyone else, make noise.'], ['cancer', 'Steady hands. Perks of nothing to lose.']] },
        { kind: 'survive', time: 110, hint: 'Hold the lifeboats' },
        { kind: 'reach', zone: 'lifeboat', hint: 'Get off the ship' },
      ],
      cut: { in: [['command', 'Uh oh. Explosives on the hull. Didn\'t see that one coming!']],
        out: [['cancer', 'Yacht party is tonight. Dress code: lethal.'], ['command', 'Black tie, team. Ballin\'s guests all wear black tie.'], ['wiener', 'How do you know the dress code before we do?'], ['command', 'I\'m Command, Sergeant. Command knows things!']] } },
  ] },
  { id: 'c6', map: 'yacht', name: 'Yacht Party Crashers', hub: 'The squad found the leak. They found it in the wrong pocket.', missions: [
    { id: 'm14', name: 'Plus Ones', tier: 4, intro: 'A superyacht, a guest list, and Ricky in his element.',
      objectives: [
        { kind: 'reach', zone: 'stern', hint: 'Get aboard' },
        { kind: 'collect', item: 'wristband', count: 4, hint: 'Steal four VIP wristbands' },
        { kind: 'interact', targets: 1, hint: 'Get past the bouncer', say: [['bouncer', 'Names?'], ['ricky', 'Ricky, Wiener, Cancer and Igor. We\'re a rap group.'], ['bouncer', 'What\'s the group called?'], ['ricky', 'Tapes From My Pops.'], ['bouncer', '...that\'s a terrible name. Go in.']] },
      ],
      cut: { in: [['ricky', 'Finally a mission in my element. Let me do the talking.'], ['cancer', 'Absolutely not.'], ['ricky', 'Trust me. I\'m a people person. Everybody loves me except you.'], ['cancer', 'I don\'t not love you. I just correct you.'], ['ricky', '(smiling) Yeah. I know.']],
        out: [['wiener', 'He let us in because you paid him two hundred dollars, Ricky.'], ['ricky', 'And because I\'m charming. Both. Write that down.']] } },
    { id: 'm15', name: 'Hot Tub Time Bomb', tier: 4, intro: 'There is a bomb in the hot tub. Igor volunteers.',
      objectives: [
        { kind: 'defuse', puzzle: 'wires', hint: 'Defuse the bomb in the hot tub', say: [['igor', 'In my country, water is always this temperature. But frozen.']] },
        { kind: 'clear', zone: 'deck', count: 20, hint: 'Clear the party deck',
          scene: [['wiener', 'Where\'s Cancer?'], ['igor', 'Lower deck. On a phone. Whispering.'], ['wiener', 'Who carries a phone on a covert op?'], ['ricky', 'Leave him alone, man. Maybe it\'s a doctor.'], ['wiener', 'At midnight? On Ballin\'s yacht?']] },
      ],
      cut: { in: [['command', 'Bomb in the hot tub, team! Classic Ballin\'.']],
        out: [['wiener', 'Guest list says Ballin\' left an hour ago. With the pot.'], ['cancer', '(arriving) What did I miss?'], ['wiener', 'You tell me. Where were you?'], ['cancer', 'Bathroom.'], ['wiener', 'For forty minutes.'], ['cancer', 'I\'m dying, Frank. It takes longer.']] } },
    { id: 'm16', name: 'Man Overboard', tier: 5, intro: 'They are coming from every side. Something in Cancer\'s gown is about to come out.',
      objectives: [
        { kind: 'survive', time: 130, hint: 'Hold the bridge against the Brotherhood', say: [['cancer', 'They\'re coming from every side. Good. Saves walking.']] },
        { kind: 'reach', zone: 'jetski', hint: 'Get to the jet skis',
          scene: [['igor', 'Cancer. Your gown. Something fell out.'], ['wiener', '...a Brotherhood keycard.'], ['cancer', 'That\'s not mine.'], ['wiener', 'Then whose is it?'], ['cancer', 'Frank. Look at me. It is not mine.'], ['wiener', 'Move. We talk on land.']] },
      ],
      cut: { in: [['command', 'Hold on, team. And, uh, keep an eye on each other. Just a hunch.']],
        out: [['wiener', 'Secret calls. Disappearing. And a Brotherhood keycard. Explain it.'], ['cancer', 'No.'], ['wiener', 'Then you\'re confined to barracks. Command\'s orders. Mine too.'], ['ricky', 'He didn\'t do it! You don\'t know him like I— he didn\'t DO it!'], ['igor', 'Ricky. How do you know him so well?'], ['ricky', '...'], ['cancer', 'Leave it, kid. Fine, Frank. Confine me. I\'ve got nothing to lose.'], ['ricky', 'Stop SAYING that.']] } },
  ] },
  { id: 'c7', map: 'hospital', name: 'One Week', hub: 'A week. He is going to spend it with them.', missions: [
    { id: 'o1', name: 'One Week', tier: 5, featured: 'cancer', vision: '', music: '', intro: 'St. Mercy Hospital. The appointment he never told anybody about.',
      loadout: { cancer: { guns: [], armor: false } }, speed: { cancer: 0.82 }, enemyLook: 'security', enemyNames: ['Security', 'Security', 'Night Security', 'Head of Security'],
      actors: [{ id: 'doctor', look: 'doctor', zone: 'Oncology', name: 'Dr. Adebayo' }],
      objectives: [
        { kind: 'reach', zone: 'Corridor', hint: 'Leave', say: [['nurse', '(intercom) Security to Oncology. Captain Mercer is not to leave the building. Orders from Command.'], ['cancer', 'Command. Of course it is.']] },
        { kind: 'reach', zone: 'Stairs', hint: 'The stairs out', say: [['nurse', '(intercom) ...and the cafeteria is serving meatloaf, which I would not.'], ['cancer', '(A man waxes the floor. A kid in a wheelchair races his dad. Somebody laughs at a joke in a break room.)']] },
        { kind: 'reach', zone: 'Records', hint: 'The stairwell is chained. Take the service corridor',
          scene: [['cancer', '(Chained. Of course it is.)', { cam: 'close' }], ['nurse', '(intercom) Stairwell B is closed. Please use the service corridor past Medical Records.'], ['cancer', 'Thanks, lady. Very helpful. Suspiciously helpful.']] },
        { kind: 'interact', targets: 1, zone: 'Records', hint: 'Search the back room',
          scene: [['cancer', '(A crate. Stencilled on the side: EXPERIMENTAL. CANCER-GAS. DO NOT INHALE.)', { cam: 'close', music: '' }], ['cancer', '(He looks at it for a long time.)', { hold: 1.5 }], ['cancer', '...you have GOT to be kidding me.', { unlock: 'cancer' }]] },
        { kind: 'clear', zone: 'Corridor', count: 3, hint: 'Three guards between you and the exit. Use the canisters (G)', give: ['cancer', 'p2000'], say: [['cancer', 'Breathe deep, boys. Doctor\'s orders.']], done: [['cancer', '(One of them dropped a pistol. He takes it.)']] },
        { kind: 'boss', boss: 'reaper', zone: 'Lobby Doors', hint: 'The exit',
          scene: [['cancer', '(The exit. Daylight under the doors.)', { place: ['cancer', 'Lobby Entry', 'Ambulance Bay'], cam: 'wide', music: '' }], ['cancer', '(The lights go out. One by one. From the far end of the lobby, toward him.)', { vision: 'dread', music: 'dread', hold: 1 }], ['cancer', '(Something is standing between him and the doors.)', { cam: 'boss', hold: 1.5 }], ['cancer', '...Yeah. I figured you\'d be early.', { cam: 'close' }]] },
        { kind: 'reach', zone: 'Ambulance Bay', hint: 'Go outside', vision: '', music: 'tender' },
      ],
      cut: { in: [['cancer', '(A waiting room. A birthday card on his knee. HAPPY 35TH.)', { cam: 'close' }], ['cancer', '(mumbling, writing) "Ricky. I have wanted to tell you something for thirty-four—" no.'], ['cancer', '(He tears it up. Takes out another card. He bought six.)'], ['cancer', '(under his breath) Next month. His birthday. Fishing trip. Booked the boat and everything.'],
        ['doctor', 'Mr. Mercer?', { place: ['cancer', 'Oncology'], cam: 'wide' }], ['doctor', 'It\'s spread to the liver and the lungs, Dale. I\'m so sorry.', { cam: 'close' }], ['doctor', 'We\'re looking at about a week.', { hold: 2.5 }], ['cancer', '(He doesn\'t say anything for a long time.)', { hold: 2 }],
        ['cancer', 'A week. Like... seven days.'], ['cancer', 'I\'ve got a thing next month. His birthday. Can I get a month? I\'ll take a month.'], ['doctor', 'I\'m so sorry.'], ['cancer', '(The doctor leaves. The machine beeps. The clock ticks. Out in the hall somebody laughs.)', { hold: 2.5 }], ['cancer', '(He looks at the door.)', { hold: 1.5 }], ['cancer', 'No. Not in here.']],
        out: [['cancer', '(Outside. Morning. A bus goes by. A pigeon is fighting a sandwich.)', { cam: 'wide', music: 'tender' }], ['cancer', '(Sun on a brick wall. Wind. Somebody\'s radio across the street.)', { hold: 2 }], ['cancer', 'Huh.'], ['cancer', 'Still scared. Still sick. Still got a week.'], ['cancer', 'Right now, though?', { hold: 1 }], ['cancer', 'Right now\'s actually pretty good.', { hold: 1 }], ['cancer', '(He taps his chest twice.) Still ticking.', { hold: 1.5 }]] } },
    { id: 'm18', name: 'Code Blue', tier: 5, intro: 'The squad finds him in the ambulance bay. So does the Brotherhood.',
      objectives: [
        { kind: 'defend', zone: 'Ward', time: 90, hint: 'Hold the ward: patients can\'t run', say: [['ricky', 'Nobody touches these people. NOBODY.'], ['igor', 'Ricky is angry. I like angry Ricky.']] },
        { kind: 'revive', who: 'cancer', hint: 'Cancer is down: hold USE on him',
          scene: [['cancer', '*collapses*'], ['ricky', 'No. No no no. Get up. GET UP. You don\'t get to do this here.'], ['wiener', 'Ricky, cover—'], ['ricky', 'I got him. I GOT him. Cover ME.']] },
        { kind: 'survive', time: 80, hint: 'Hold them off while Cancer gets up', done: [['cancer', '(tapping his chest twice) Still ticking.'], ['ricky', '(tapping his own chest twice) Still ticking.']] },
      ],
      cut: { in: [['ricky', '(A truck screeches into the ambulance bay.) CANCER! Yo! There he is!', { cam: 'wide' }], ['wiener', 'You walked out of confinement, Dale.'], ['cancer', 'I walked out of a hospital, Frank. Confinement was the warm-up.'], ['igor', 'You look terrible. More than usual.'], ['cancer', 'A week. That\'s what they gave me. One week.'], ['ricky', '...a week?', { hold: 1.2 }], ['command', 'Team! Brotherhood units inbound on St. Mercy. Leave Mercer. He\'s compromised.'], ['wiener', 'Command, you\'re breaking up.'], ['command', 'I\'m not breaking up.'], ['wiener', '*click*']],
        out: [['nurse', 'He\'s lost a lot of blood. He needs a transfusion. O negative, and we\'re out.']] } },
    { id: 'm19', name: 'O Negative', tier: 5, intro: 'O negative. The blood bank is on the other side of the Brotherhood.',
      objectives: [
        { kind: 'collect', item: 'blood bag', count: 3, hint: 'Get to the blood bank (three bags)',
          scene: [['ricky', 'Don\'t bother with the bank. Take mine. O negative.'], ['nurse', 'Are you sure?'], ['ricky', 'O negative. Same as—'], ['ricky', '...same as a lot of people. Just take it.'], ['cancer', '(eyes half open, staring at Ricky)'], ['wiener', 'Get the bags anyway. Ricky\'s only got the one body.']] },
        { kind: 'interact', targets: 1, zone: 'Ward', hint: 'Start the transfusion' },
        { kind: 'reach', zone: 'Roof', hint: 'Get to the roof for extraction' },
      ],
      cut: { in: [['wiener', 'Squad. Bags first, then the roof. And nobody dies in a hospital, it\'s embarrassing.']],
        out: [['wiener', 'Dale. I was wrong. I don\'t say that. I\'m saying it.'], ['wiener', 'Squad Six. Forty-one people. Every op planned with Command\'s intel. I\'ve suspected a leak for years. I picked the wrong man.'], ['cancer', 'You picked the right squad, Frank. You just aimed at the wrong guy.'], ['cancer', 'Here. Screenshot from Command\'s last video call. Look at his hand.'], ['igor', 'A championship ring. "O.B.B. Champions."'], ['wiener', 'Colonel Brisket.'], ['ricky', 'Pain is weakness leaving the body, right, Sarge?'], ['wiener', 'Not this one, Ricky. This one\'s staying.']] } },
  ] },
  { id: 'c8', map: 'nuke', name: 'Winters', hub: 'Command is the enemy, the squad has to keep pretending it doesn\'t know, and Igor will not look at the reactor.', missions: [
    { id: 'i1', name: 'Twelve Winters Ago', map: 'outpost', tier: 4, featured: 'igor', vision: 'blizzard', music: '', intro: 'Igor. Twelve winters ago.',
      loadout: { igor: { guns: ['ssg08', 'usp'], armor: false } }, sight: 3.2, botSight: 12, enemyLook: 'winter_a',
      enemyNames: ['Sentry', 'Patrol', 'Signals Officer', 'Sentry', 'Patrol', 'Duty Officer'],
      objectives: [
        { kind: 'intel', zone: 'Eastern Post', options: ['RED SEAL 0600', 'BLUE SEAL 0600', 'BLUE SEAL 1800'], answer: 'BLUE SEAL 0600', guards: 4, look: 'winter_b', hint: 'Swap the morning dispatch at the eastern post (read the clue)',
          say: [['igor', '(to himself) Eastern post. Their dispatches carry the blue seal. Morning run, six hundred.'], ['igor', 'In this snow they see three metres. I see everything. Go slow. Stay out of their faces.']],
          done: [['igor', 'One. Now their dispatch says the other side moved armour to the river. They did not. They will check. It will look true enough.']] },
        { kind: 'intel', zone: 'Radio Station', options: ['RELAY 3.31', 'RELAY 4.47', 'RELAY 4.43'], answer: 'RELAY 4.47', guards: 6, look: 'winter_a', hint: 'Swap the relay log at the radio station (read the clue)',
          say: [['igor', 'Radio station. Other side. Their night relay ends in seven. Find that log.'], ['igor', '(Two patrols cross here. Wait for the gap.)']],
          done: [['igor', 'Two. Now each side thinks the other is jamming its radios. Nobody trusts anybody. Good. Confusion is a door. I walk through it.']] },
        { kind: 'intel', zone: 'Command Bunker', options: ['FOLDER K-1: EXERCISE', 'FOLDER K-7: EXERCISE', 'FOLDER K-7: LOGISTICS'], answer: 'FOLDER K-7: EXERCISE', guards: 8, look: 'winter_b', hint: 'The command bunker: replace the K-7 folder (read the clue)',
          say: [['igor', 'Last one. The K-7 folder, the one marked EXERCISE. Mine says STRIKE. Swap it, and they believe the other side is about to hit first.'], ['igor', '(Every patrol is closing in. They know someone is here.)'], ['igor', '(quietly) Only a few days of confusion. Enough to cross the border. That is all.']],
          done: [['igor', 'Three. Done. Now I go.']] },
        { kind: 'reach', zone: 'Treeline', hint: 'Get out through the treeline', say: [['radio', '(On every radio, at once:) ...alert status raised... ...alert status raised...'], ['igor', 'Is only words on paper. Words on paper.']] },
      ],
      cut: { in: [['igor', '(A ridge. A blizzard. A man who has not moved for six hours.)', { cam: 'wide' }], ['radio', '(radio, one channel) Volk-1, report.', { cam: 'close' }], ['igor', 'Volk-1. Nothing moves.'], ['radio', '(radio, the other channel) Snowbird, report.'], ['igor', 'Snowbird. Nothing moves.'],
        ['radio', '(Both channels, one after the other:) We know, Snowbird. ...We know, Volk.', { hold: 1.5 }], ['igor', '(Engines. Dogs. Two armies, coming from both directions. For him.)', { hold: 1.5 }], ['igor', 'Then I make them busy with each other.']],
        out: [['igor', '(Treeline. He looks back once.)', { cam: 'wide', music: '' }], ['radio', '(radio) ...this is not an exercise... repeat, this is not...'], ['radio', '(radio, the other side) ...we have launches... we have launches...', { hold: 1 }], ['igor', '(The horizon goes white. Then it goes white again, somewhere else.)', { vision: 'nuke', hold: 3 }],
          ['radio', '(radio, a woman, civilian band) Mama? Mama, the lights went out, are you— can you hear—', { hold: 1.5 }], ['radio', '(radio) ...emergency broadcast... seek shelter... seek...', { hold: 1.5 }], ['igor', '(Static. On every channel. Everywhere.)', { hold: 3 }],
          ['igor', '(He looks at the bullet in his hand. The one he never fires.)', { cam: 'close', hold: 3 }], ['igor', 'It was only paper.', { hold: 3 }]] } },
    { id: 'm20', name: 'Clock In', tier: 5, intro: 'Brisket thinks you don\'t know. Let him keep thinking it.',
      objectives: [
        { kind: 'reach', zone: 'lobby', hint: 'Get inside the plant', say: [['command', 'Team! Great news, the pot\'s at the gas plant. Light resistance!'], ['wiener', 'Copy, Command. Light resistance. Sounds great.'], ['igor', '(whispering) He is very bad liar. We are very good liars now.']] },
        { kind: 'collect', item: 'badge', count: 3, hint: 'Find three employee badges' },
        { kind: 'interact', targets: 3, puzzle: 'keypad', hint: 'Open the reactor wing: terminals in order' },
      ],
      cut: { in: [['wiener', 'He\'s using the reactor to heat the chili. Weapons-grade. We act normal. Ricky, act normal.'], ['ricky', 'I\'m always normal.'], ['cancer', 'Expresso normal.'], ['ricky', 'See, now YOU said it with the X.'], ['cancer', 'I was testing you.']],
        out: [['igor', '(Igor stares into the reactor glow for too long.)', { cam: 'close' }], ['ricky', 'Igor? You good?'], ['igor', 'Reminds me of home.'], ['ricky', '...where IS home, man?'], ['igor', 'Nowhere, now.']] } },
    { id: 'm21', name: 'Meltdown Manager', tier: 5, intro: 'Five control rods, one control room, and a conversation Wiener has been putting off.',
      objectives: [
        { kind: 'interact', targets: 5, puzzle: 'rods', hint: 'Lower the control rods in order' },
        { kind: 'defend', zone: 'control', time: 130, hint: 'Hold the control room',
          scene: [['wiener', '(aside, to Cancer) Have you told him?'], ['cancer', 'Told him what? That I\'m dying? Everybody knows.'], ['wiener', 'Dale.'], ['cancer', '...no. Some things you only get to say once, Frank. I want to say it at the right time.'], ['wiener', 'You\'re running out of right times.'], ['cancer', 'I know. Believe me. I know.']] },
      ],
      cut: { in: [['cancer', 'Radiation\'s already doing my job for me. Let\'s go.']],
        out: [['wiener', 'Pot\'s gone. Loaded on a truck, heading for the vents.']] } },
    { id: 'm22', name: 'Exhaust Vent', tier: 6, intro: 'Through the vents to the loading dock. Brisket is about to stop pretending.',
      objectives: [
        { kind: 'clear', zone: 'vents', count: 20, hint: 'Clear the vent shafts' },
        { kind: 'survive', time: 110, hint: 'Hold the loading dock', say: [['command', '...you know, don\'t you, Sergeant.'], ['wiener', 'Nothing but net, Colonel.'], ['command', '(sneakers squeaking) Smart squad. Shame. Ballin\'s got a stadium full of people tomorrow night and a pot that\'ll cover all of them.']] },
        { kind: 'reach', zone: 'truck', hint: 'Get on the truck' },
      ],
      cut: { in: [['ricky', 'Real talk, if I don\'t make it, tell my mixtape I loved it.'], ['cancer', 'You\'re going to make it. That\'s an order.'], ['ricky', 'You\'re not my sergeant.'], ['cancer', 'No. I\'m not.']],
        out: [['command', 'Ballin\' Arena, tomorrow night. Sold out. See you there, team. I\'ll be courtside.'], ['wiener', 'The desert depot first. Then the arena.'], ['igor', 'Tomorrow, we end this. Tonight, we drink. Only water. I am joking. Not water.']] } },
  ] },
  { id: 'c9', map: 'dust', name: 'Dust To Dust', hub: 'Espresso.', missions: [
    { id: 'm23', name: 'Long A', tier: 6, intro: 'The Brotherhood\'s desert depot. The last thing between the squad and the arena.',
      objectives: [
        { kind: 'reach', zone: 'Long Doors', hint: 'Push Long A' },
        { kind: 'clear', zone: 'Long A', count: 22, hint: 'Clear Long', say: [['wiener', 'Everything hurts and I love it.'], ['cancer', 'Everything hurts and I\'m used to it.'], ['ricky', 'Nothing hurts and I\'m scared.'], ['igor', 'I feel nothing. Is good.']] },
        { kind: 'interact', targets: 2, zone: 'A Site', hint: 'Blow the depot doors' },
      ],
      cut: { in: [['wiener', 'Depot first. They\'ve got the stadium blueprints and the arming codes.']],
        out: [['cancer', 'The pot\'s got a dead-man trigger. Let go of it and it vents. It has to be carried into the arena\'s blast tank.'], ['igor', 'Through the gas?'], ['cancer', 'Through the gas.'], ['wiener', 'We camp here tonight. Arena at dusk.']] } },
    { id: 'm24', name: 'The Last Night', map: 'barracks_night', tier: 6, intro: 'One night. A fire. Nobody says what they are all thinking.',
      objectives: [
        { kind: 'explore', hint: 'Spend the night with your squad', points: [
          { zone: 'Watchtower', label: 'Igor', say: [['igor', 'The winters I talk about. There was only one.'], ['igor', 'I made it. Twelve years ago. With three pieces of paper.'], ['igor', 'My grandmother lived in a city with a very good bakery. I tell her stories so she is still somewhere.'], ['ricky', '...Igor.'], ['igor', 'You asked once what the bullet is for. It is for the day I am allowed to stop carrying it.'], ['ricky', 'Who decides that?'], ['igor', 'I thought God. Now I think maybe a friend.']] },
          { zone: 'Bunks', label: 'Ricky', say: [['ricky', 'This? Just a tape. Number four.'], ['ricky', 'I watched one, two and three so many times they\'re basically gray now.'], ['ricky', 'Never watched four. It\'s the last one. If I watch it, it\'s over.'], ['cancer', '(from the dark) Can I borrow your bag, kid? Need gum.'], ['ricky', 'Front pocket. Don\'t touch the tape.']] },
          { zone: 'Parade Ground', label: 'Wiener', say: [['wiener', 'Forty-one push-ups. One for each of Squad Six. I never got to say goodbye to any of them.'], ['wiener', 'If you get the chance to say goodbye, Ricky, you take it. You hear me? You take it.'], ['ricky', 'Why are you telling me?'], ['wiener', 'Because tomorrow is going to hurt. And that\'s the plan.']] },
          { zone: 'Mess Hall', label: 'Cancer', say: [['cancer', 'Couldn\'t sleep either?'], ['ricky', 'Nah.'], ['cancer', 'Ricky. There\'s something I should— there\'s something you should know about me.'], ['ricky', 'You don\'t gotta tell me anything tonight.'], ['cancer', '...okay. Tomorrow, then.'], ['ricky', 'Tomorrow.'], ['cancer', 'Go to sleep, little— go to sleep, Ricky.']] },
        ] },
        { kind: 'reach', zone: 'Bunks', hint: 'Get some sleep', say: [['igor', 'Goodnight, comrades.'], ['wiener', 'Goodnight, squad.'], ['ricky', 'Goodnight, y\'all.'], ['cancer', '...goodnight, kid.']] },
      ],
      cut: { in: [['wiener', 'Fire\'s going. Rations are terrible. Nobody\'s sleeping. Perfect night.']],
        out: [['cancer', '(alone, recording) ...is this thing on? Okay. Tape four. Sorry about the movie, kid. I needed the space.']] } },
    { id: 'm25', name: 'Ballin\' Arena', map: 'stadium', tier: 6, boss: true, intro: 'Ballin\' Arena. Sold out. Twenty thousand people and a pot of gas.',
      objectives: [
        { kind: 'clear', zone: 'Concourse', count: 18, hint: 'Clear the concourse' },
        { kind: 'boss', zone: 'Court', hint: 'Take down Osama bin Ballin',
          scene: [['boss', 'You fools! In one hour this pot of chili will gas the entire arena! Nobody will ever smell anything else again!'], ['wiener', 'Your chili is weak and so are you.'], ['command', '(courtside, squeaking) Should\'ve stayed benched, Captain.'], ['cancer', 'I\'ve been benched my whole life, Brisket. Watch me play.'], ['boss', 'Feel... the GOY-BEAM!']] },
        { kind: 'clear', zone: 'Court', count: 6, hint: 'Arrest Brisket\'s bodyguards', done: [['wiener', 'Colonel Brisket. You\'re under arrest. Forty-one counts.'], ['command', 'You can\'t stop it. Dead-man trigger. Somebody has to walk it into the tank. Through the gas. Good luck finding a volunteer.']] },
      ],
      cut: { in: [['wiener', 'Squad. Proud of you. Whatever happens in there.'], ['igor', 'Is like wedding speech. I hate it. Keep going.']],
        out: [['cancer', 'I\'ll take it.'], ['wiener', 'Dale—'], ['cancer', 'I\'m the only one here who\'s already dying. I\'ve got nothing to lose.'], ['ricky', 'You had me.'], ['cancer', '...what?'], ['ricky', 'You had ME. You always had me. Dad.'], ['cancer', '...how long?'], ['ricky', 'Since the first expresso.'], ['cancer', '(laughing and crying) You little— you knew. The whole time, you knew.'], ['ricky', 'It was the only way you\'d talk to me.'], ['wiener', 'Dale. Ten minutes in that gas. That\'s all you\'d have.'], ['cancer', 'Then cover me for ten minutes, Frank. That\'s the plan. The plan always hurts.']] } },
    { id: 'm26', name: 'The Walk', map: 'stadium', tier: 6, intro: 'Ten minutes.',
      objectives: [
        { kind: 'carry', who: 'cancer', zone: 'Blast Tank', hint: 'Get Cancer and the pot to the blast tank',
          say: [['cancer', 'Talk to me, kid. Keep me company.'], ['ricky', 'Remember Dog Cop Three? "A cop is just a dog with a badge, and a dog is just a cop with—"'], ['cancer', '"—better manners." You used to say it with a mouthful of cereal.'], ['ricky', 'You remember that?'], ['cancer', 'I remember all of it. I just wasn\'t there for any of it.']] },
        { kind: 'defend', zone: 'Blast Tank', time: 60, hint: 'Hold the line while he arms the tank',
          scene: [['cancer', 'I\'m in. Door\'s sealing. Gas is... yeah. It\'s gas.'], ['ricky', 'Dad, I can still get you out—'], ['cancer', 'No. Listen. I\'ve got a minute. Hold the door for me, son.'], ['wiener', 'Squad! You heard him! HOLD THE LINE!']] },
      ],
      cut: { in: [['wiener', 'Wieners protect their own.', { cam: 'close' }], ['cancer', 'I know, Frank. Let me protect mine.', { hold: 1 }], ['wiener', '(He can\'t heal this. He knows it. Everybody knows it.)', { hold: 1.5 }], ['wiener', 'Wiener to squad: nobody gets within ten metres of him. Nobody.'], ['igor', 'Cancer. Comrade. It is honour.']],
        out: [['cancer', '(radio) Tank\'s armed. Pot\'s contained. Arena\'s safe.'], ['cancer', 'Frank. Tell Frank... I owe him an expresso.'], ['ricky', '(crying) Espresso, Dad.'], ['cancer', '...somebody write that down.'], ['cancer', '(two taps on the mic)'], ['ricky', '(two taps on his chest) Still ticking.'], ['squad', '(static)']] } },
    { id: 'm27', name: 'Tape Four', map: 'barracks_night', tier: 6, absent: ['cancer'], intro: 'Fort Brisket, renamed. A week later.',
      objectives: [
        { kind: 'explore', hint: 'Walk the barracks', points: [
          { zone: 'Infirmary', label: 'His bunk', say: [['wiener', 'Gown\'s still on the hook. Nobody\'s moving it. That\'s an order.']] },
          { zone: 'Mess Hall', label: 'The coffee machine', say: [['igor', 'Somebody put sign on the machine. "ESPRESSO. There is no X." Is his handwriting.'], ['ricky', 'He did that the first week. I never said anything.']] },
          { zone: 'Watchtower', label: 'The watchtower', say: [['igor', 'He said to me, the last night: nobody carries a thing forever, comrade. Not even you.'], ['igor', 'One bullet. For something important. Now I know what.']] },
        ] },
        { kind: 'interact', targets: 1, zone: 'Bunks', hint: 'Play tape four',
          scene: [['tape', 'Is this thing on? Okay. Hi, Ricky. It\'s your dad. Sorry about the movie. Space Cowboy Christmas was a bad movie anyway.'], ['tape', 'You never once said "expresso" when you thought I couldn\'t hear you. I worked it out at the hospital. O negative. Same as me.'], ['tape', 'So I knew you knew. And I kept correcting you anyway. Because it was the best conversation of my life.'], ['tape', 'I left you four tapes because I was a coward. I\'m leaving you this one because you made me brave.'], ['tape', 'I\'ve got nothing to lose. That\'s what I kept saying. It was never true. Not since the first day.'], ['tape', 'Make the mixtape. Make it loud. Tapes From My Pops is a terrible name. Keep it.'], ['tape', 'Somebody write that down. I love you, son.'], ['tape', '(two taps on the microphone)']] },
        { kind: 'reach', zone: 'Parade Ground', hint: 'Fall in',
          scene: [['wiener', 'Forty-one.'], ['wiener', 'Forty-two.'], ['igor', '(fires one bullet into the sky)'], ['recruit', 'Sergeant? Is there anywhere to get an expresso on this base?'], ['ricky', 'It\'s espresso. There\'s no X. There has never been an X.'], ['ricky', '(tapping his chest twice) Mess hall. Come on. I\'ll show you.']] },
      ],
      cut: { in: [['wiener', 'New recruit arrives today. Ricky, you\'re on welcome duty.'], ['ricky', 'Yes, Sergeant.']],
        out: [['credits', 'TAPES FROM MY POPS'], ['credits', 'for Dale']] } },
  ] },
];
export const MISSIONS = CHAPTERS.flatMap((c, ci) => c.missions.map((m, mi) => ({ ...m, chapter: c.id, chapterIndex: ci, chapterName: c.name, map: m.map || c.map, last: mi === c.missions.length - 1, first: mi === 0 }))).map((m, i) => ({ ...m, index: i }));

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
