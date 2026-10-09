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
export const SPEAKERS = { command: 'Colonel Brisket (Command)', tape: 'Dale (on tape)', doctor: 'Dr. Adebayo', nurse: 'Nurse Kowalczyk', chef: 'The Chili Chef', captain: 'The Captain', bouncer: 'The Bouncer', recruit: 'New Recruit', squad: 'Everyone', credits: '' };

export const CHAPTERS = [
  { id: 'c1', map: 'range', name: 'Boot Camp Is For Losers', hub: 'Four strangers, one hot dog, and a leak somewhere above them.', missions: [
    { id: 'm1', name: 'Reveille', map: 'barracks', tier: 0, intro: 'Fort Brisket. 0500. Somebody is already doing push-ups.',
      objectives: [
        { kind: 'explore', hint: 'Find your squad', points: [
          { zone: 'Bunks', label: 'Wiener', say: [['wiener', 'Thirty-nine. Forty. Forty-one.'], ['wiener', 'Don\'t ask what the number is for. Nobody asks. That\'s the rule.'], ['wiener', 'Sergeant Wiener. Yes, the costume is regulation. No, you may not touch the bun.']] },
          { zone: 'Mess Hall', label: 'Ricky', say: [['ricky', 'Yo! You the new ones too? Recruit Ricky. Can I get an expresso around here?'], ['cancer', 'Espresso. There is no X. There has never been an X.'], ['ricky', 'You sure? Because I been saying it with the X for thirty-four years and nobody complained.'], ['cancer', 'I\'m complaining. I\'m complaining right now.']] },
          { zone: 'Infirmary', label: 'Cancer', say: [['cancer', 'Captain Cancer. Yes, that\'s the callsign. Yes, I have it. Stage four, before you ask.'], ['cancer', 'Upside: I\'m the bravest man on this base. I\'ve got nothing to lose.'], ['cancer', 'Downside: the gown. It does not close in the back. Walk in front of me.']] },
          { zone: 'Watchtower', label: 'Igor', say: [['igor', 'Igor. Sniper. In my village, we train with one bullet. If you miss, you are the target.'], ['igor', 'I still carry the bullet. I do not fire it. Is for something important.'], ['ricky', 'Like what?'], ['igor', 'When I know, you will be first to hear it. Second. Bullet will be first.']] },
        ] },
        { kind: 'interact', targets: 1, zone: 'Armory', hint: 'Draw your weapons from the armory', say: [['ricky', 'Do they got a Glock with the switch on it? I\'m asking for a friend. The friend is me.']] },
        { kind: 'reach', zone: 'Parade Ground', hint: 'Fall in on the parade ground',
          scene: [['wiener', 'Listen up. You are the worst squad this base has ever assembled, and I picked every one of you personally.'], ['wiener', 'That\'s not a compliment. That\'s a confession.'], ['wiener', 'Recruit. You sure you want this? Last chance to walk away.'], ['ricky', 'Been waiting thirty-four years for this, Sarge. I ain\'t walking.'], ['cancer', 'Thirty-four years. You mean your whole life.'], ['ricky', '...yeah. Something like that.']] },
      ],
      cut: { in: [['command', 'Morning, Sergeant! Colonel Brisket, your new handler. You\'ll hear me in your ear, never see my face. Like a conscience, but useful.'], ['wiener', 'Copy, Command. What\'s that squeaking behind you?'], ['command', 'New office floors. Very shiny. Get your people up, Sergeant.']],
        out: [['command', 'Bad news, team. Live rounds turned up in the training dummies. Somebody on this base is talking to the Ballin\' Brotherhood.'], ['wiener', 'A leak.'], ['command', 'Find it. Range, oh-six-hundred. Have fun out there!']] } },
    { id: 'm2', name: 'Orientation', tier: 0, intro: 'The range. The targets were rigged. Somebody wants this squad gone before it starts.',
      objectives: [
        { kind: 'reach', zone: 'Firing Line', hint: 'Get to the firing line', say: [['ricky', 'I\'m ready. I trained. I watched like four movies.'], ['cancer', '...which four?'], ['ricky', 'Just four. Old ones. Don\'t worry about it.'], ['cancer', 'I wasn\'t worried. I\'m never worried.']] },
        { kind: 'clear', zone: 'Lanes', count: 12, hint: 'Shoot the targets (they shoot back)', say: [['igor', 'Targets have rifles. Is new. I like it.']] },
        { kind: 'interact', targets: 3, zone: 'Berm', hint: 'Reset the three target winches', done: [['wiener', 'Somebody wired those dummies the night before. Somebody with keys.']] },
      ],
      cut: { in: [['wiener', 'Listen up, maggots. Intel says the Ballin\' Brotherhood is building something big. Something that smells.'], ['igor', 'In my village, we train with one bullet. Today I bring many. Is special occasion.']],
        out: [['cancer', 'Whoever rigged the range had a keycard. Three of them are missing.'], ['command', 'Three keycards? Nothing but net, team. Go get \'em.'], ['wiener', '...nothing but net?'], ['command', 'Figure of speech, Sergeant!']] } },
    { id: 'm3', name: 'The Mole Hunt', tier: 0, intro: 'Three missing keycards. One locked armoury. Somebody inside is helping.',
      objectives: [
        { kind: 'collect', item: 'keycard', count: 3, hint: 'Find the three range keycards', say: [['cancer', 'Ricky, you go with Igor. So somebody can read.'], ['ricky', 'I can read. I read the back of the Doritos bag every day.'], ['igor', 'He can read. I hear him. When he thinks nobody is listening, he reads very well.'], ['ricky', 'Igor. Focus on your keycard, man.']] },
        { kind: 'interact', targets: 3, puzzle: 'keypad', zone: 'Command', hint: 'Open the armoury: the terminals in order' },
        { kind: 'clear', zone: 'Command', count: 14, hint: 'Clear the armoury' },
      ],
      cut: { in: [['wiener', 'Three keycards, three of you. I\'ll watch the door. Pain is weakness leaving the body, and I want to watch it leave.']],
        out: [['igor', 'The traitor is gone. He left only this: a basketball. Signed "O.B.B."'], ['wiener', 'Osama bin Ballin.'], ['command', 'Great work! The mole\'s long gone, so let\'s not dwell. Hold the range tower, they\'re coming for it next.'], ['cancer', 'How does he know that?'], ['wiener', 'He\'s Command. Command knows things.']] } },
    { id: 'm4', name: 'Live Fire', tier: 1, intro: 'They are coming for the range. Hold it until the chopper lands.',
      objectives: [
        { kind: 'defend', zone: 'Range Tower', time: 110, hint: 'Hold the range tower', say: [['wiener', 'Hold it! Pain is weakness leaving the body!'], ['cancer', 'Mine left years ago. Took the hair with it.']] },
        { kind: 'survive', time: 80, hint: 'Survive until the chopper lands',
          scene: [['cancer', '*coughs* ...I\'m fine. Keep shooting.'], ['ricky', 'Here. Water. Drink it.'], ['cancer', 'I said I\'m fine.'], ['ricky', 'And I said drink it, old man.'], ['cancer', '...thank you.'], ['igor', '(quietly) Nobody else saw him cough. Only Ricky.']] },
        { kind: 'reach', zone: 'CT Yard', hint: 'Get on the chopper' },
      ],
      cut: { in: [['command', 'Brotherhood\'s hitting the range to cover their escape. Chopper\'s ten minutes out. Hang in there, team!']],
        out: [['ricky', 'Where we going, Sarge?'], ['wiener', 'Somewhere they sell fireworks and nobody asks questions.'], ['cancer', '(tapping his chest twice) Still ticking.'], ['ricky', 'What\'s that?'], ['cancer', 'Habit. Means the heart\'s still going. Don\'t read into it.']] } },
  ] },
  { id: 'c2', map: 'town', name: 'Small Town, Big Problems', hub: 'Nine thousand bottle rockets, a pallet of expired chili, and Ricky with a phone.', missions: [
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
        out: [['cancer', 'One of your forty viewers was Ballin\'. He left a comment: "see u at the crust".'], ['wiener', 'And another one. User "Brisket_Fan_1". Commented "nice."'], ['ricky', 'See? I got fans.']] } },
  ] },
  { id: 'c3', map: 'crust', name: 'Pizza Crust Massacre', hub: 'Pizza ovens hot enough to cook a city, and Igor starts paying attention.', missions: [
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
        out: [['ricky', 'I was right. Write it down.'], ['cancer', 'Wrote it down. "Ricky, once."']] } },
    { id: 'm10', name: 'Topping Off', tier: 3, intro: 'From the roof you can see the harbour, and a ship with a very large head on it.',
      objectives: [
        { kind: 'clear', zone: 'roof', count: 18, hint: 'Clear the roof' },
        { kind: 'interact', targets: 1, hint: 'Call in the boat' },
        { kind: 'survive', time: 85, hint: 'Hold until the boat arrives', say: [['igor', 'From roof I see harbour. I see ship. On ship I see man with very large head.']] },
      ],
      cut: { in: [['wiener', 'Up top. We see where they\'re taking it.']],
        out: [['wiener', 'Next stop, the harbour. Everybody hydrate. Ricky, not with chili.'], ['command', 'Harbour\'s quiet, team. Light resistance.'], ['cancer', 'He said that last time.']] } },
  ] },
  { id: 'c4', map: 'ship', name: 'Ballin\' On a Boat', hub: 'Forty containers of gas, four old movies, and a handler who keeps getting it wrong.', missions: [
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
        out: [['captain', 'They paid me to carry it. A man on the phone arranged it. Called himself "Coach".'], ['ricky', 'Igor drove that crane like my uncle drives. And my uncle don\'t have a license.']] } },
    { id: 'm13', name: 'Abandon Ship', tier: 4, intro: 'They rigged the hull. You have minutes.',
      objectives: [
        { kind: 'defuse', puzzle: 'wires', hint: 'Defuse the charge in the hold', say: [['wiener', 'Cancer, wires. Everyone else, make noise.'], ['cancer', 'Steady hands. Perks of nothing to lose.']] },
        { kind: 'survive', time: 110, hint: 'Hold the lifeboats' },
        { kind: 'reach', zone: 'lifeboat', hint: 'Get off the ship' },
      ],
      cut: { in: [['command', 'Uh oh. Explosives on the hull. Didn\'t see that one coming!']],
        out: [['cancer', 'Yacht party is tonight. Dress code: lethal.'], ['command', 'Black tie, team. Ballin\'s guests all wear black tie.'], ['wiener', 'How do you know the dress code before we do?'], ['command', 'I\'m Command, Sergeant. Command knows things!']] } },
  ] },
  { id: 'c5', map: 'yacht', name: 'Yacht Party Crashers', hub: 'The squad found the leak. They found it in the wrong pocket.', missions: [
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
  { id: 'c6', map: 'hospital', name: 'St. Mercy', hub: 'Weeks, not months. A ring on a video call. And a squad that says sorry.', missions: [
    { id: 'm17', name: 'Visiting Hours', tier: 5, intro: 'St. Mercy Hospital. Cancer has an appointment. Wiener says he doesn\'t go anywhere alone.',
      objectives: [
        { kind: 'reach', zone: 'Lobby', hint: 'Escort Cancer to St. Mercy', say: [['cancer', 'Confined to barracks, and you take me to the hospital. Generous.'], ['wiener', 'You go nowhere without us. That\'s the deal.']] },
        { kind: 'explore', hint: 'Wait for Cancer (look around)', points: [
          { zone: 'Chapel', label: 'Chapel', say: [['igor', 'My grandmother lit candles. For everybody. Even people she hated. "Hate is heavy, Igor. Candles are light."'], ['igor', 'I am lighting one. Do not tell anybody.']] },
          { zone: 'Nursery', label: 'Nursery', say: [['ricky', 'Look at \'em. Tiny. I was a big baby, you know.'], ['cancer', 'You look like a nine-pounder.'], ['ricky', '(quietly) Nine pounds, four ounces.'], ['cancer', '...'], ['cancer', 'Big baby.']] },
          { zone: 'Oncology', label: 'Oncology', say: [['doctor', '...I\'m sorry, Dale. It\'s spread. We\'re talking weeks now. Not months.'], ['cancer', 'Weeks is fine. I only need one more.'], ['wiener', '(outside the door, silent)']] },
        ] },
        { kind: 'stealth', zone: 'Records', guards: 5, hint: 'Get to the records room unseen: Cancer wants to show you something', say: [['cancer', 'You want to know about the calls? Records room. Come on.']] },
        { kind: 'interact', targets: 1, zone: 'Records', hint: 'Open Cancer\'s file',
          done: [['cancer', 'Every call was this place. Hospice. Arrangements. Nobody wants to hear that on a yacht.'], ['wiener', '...and the keycard?'], ['cancer', 'Planted. By somebody who wants me benched. Think about who\'s been saying "bench him", Frank.']] },
      ],
      cut: { in: [['nurse', 'Mr. Mercer? Dr. Adebayo will see you now. You brought... friends. In costumes.'], ['cancer', 'One costume. The others just dress like that.']],
        out: [['command', 'Team! Brotherhood units heading for St. Mercy. Get Cancer out of there. Actually, leave him. He\'s compromised.'], ['wiener', 'Negative, Command. Nobody gets left.'], ['cancer', '(alarms) And there it is.']] } },
    { id: 'm18', name: 'Code Blue', tier: 5, intro: 'The Brotherhood is in the hospital. They are here for Cancer.',
      objectives: [
        { kind: 'defend', zone: 'Ward', time: 90, hint: 'Hold the ward: patients can\'t run', say: [['ricky', 'Nobody touches these people. NOBODY.'], ['igor', 'Ricky is angry. I like angry Ricky.']] },
        { kind: 'revive', who: 'cancer', hint: 'Cancer is down: hold USE on him',
          scene: [['cancer', '*collapses*'], ['ricky', 'No. No no no. Get up. GET UP. You don\'t get to do this here.'], ['wiener', 'Ricky, cover—'], ['ricky', 'I got him. I GOT him. Cover ME.']] },
        { kind: 'survive', time: 80, hint: 'Hold them off while Cancer gets up', done: [['cancer', '(tapping his chest twice) Still ticking.'], ['ricky', '(tapping his own chest twice) Still ticking.']] },
      ],
      cut: { in: [['command', 'They\'re in the building, team. Last chance to leave him.'], ['wiener', 'Command, you\'re breaking up.'], ['command', 'I\'m not breaking up.'], ['wiener', '*click*']],
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
  { id: 'c7', map: 'nuke', name: 'Nuclear Gas Plant', hub: 'Command is the enemy, and the squad has to keep pretending it doesn\'t know.', missions: [
    { id: 'm20', name: 'Clock In', tier: 5, intro: 'Brisket thinks you don\'t know. Let him keep thinking it.',
      objectives: [
        { kind: 'reach', zone: 'lobby', hint: 'Get inside the plant', say: [['command', 'Team! Great news, the pot\'s at the gas plant. Light resistance!'], ['wiener', 'Copy, Command. Light resistance. Sounds great.'], ['igor', '(whispering) He is very bad liar. We are very good liars now.']] },
        { kind: 'collect', item: 'badge', count: 3, hint: 'Find three employee badges' },
        { kind: 'interact', targets: 3, puzzle: 'keypad', hint: 'Open the reactor wing: terminals in order' },
      ],
      cut: { in: [['wiener', 'He\'s using the reactor to heat the chili. Weapons-grade. We act normal. Ricky, act normal.'], ['ricky', 'I\'m always normal.'], ['cancer', 'Expresso normal.'], ['ricky', 'See, now YOU said it with the X.'], ['cancer', 'I was testing you.']],
        out: [['igor', 'Reactor reminds me of home. Glowing. Warm. Slightly illegal.']] } },
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
  { id: 'c8', map: 'dust', name: 'Dust To Dust', hub: 'Espresso.', missions: [
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
          { zone: 'Watchtower', label: 'Igor', say: [['igor', 'I lied. About winters. Some of them.'], ['igor', 'My grandmother raised me. She died when I was nine. Every story I tell, she told me first.'], ['igor', 'If I stop telling them, she is gone for real. So I tell them. Loudly. Too often.'], ['ricky', 'They\'re good stories, Igor.'], ['igor', 'They are hers. Now they are a little bit yours.']] },
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
      cut: { in: [['wiener', 'Wiener to squad: nobody gets within ten metres of him. Nobody.'], ['igor', 'Cancer. Comrade. It is honour.']],
        out: [['cancer', '(radio) Tank\'s armed. Pot\'s contained. Arena\'s safe.'], ['cancer', 'Frank. Tell Frank... I owe him an expresso.'], ['ricky', '(crying) Espresso, Dad.'], ['cancer', '...somebody write that down.'], ['cancer', '(two taps on the mic)'], ['ricky', '(two taps on his chest) Still ticking.'], ['squad', '(static)']] } },
    { id: 'm27', name: 'Tape Four', map: 'barracks_night', tier: 6, absent: ['cancer'], intro: 'Fort Brisket, renamed. A week later.',
      objectives: [
        { kind: 'explore', hint: 'Walk the barracks', points: [
          { zone: 'Infirmary', label: 'His bunk', say: [['wiener', 'Gown\'s still on the hook. Nobody\'s moving it. That\'s an order.']] },
          { zone: 'Mess Hall', label: 'The coffee machine', say: [['igor', 'Somebody put sign on the machine. "ESPRESSO. There is no X." Is his handwriting.'], ['ricky', 'He did that the first week. I never said anything.']] },
          { zone: 'Watchtower', label: 'The watchtower', say: [['igor', 'One bullet. For something important. Now I know what.']] },
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
