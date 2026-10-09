// Announcer packs: the browser's own text-to-speech with a pitch/speed and a script per character. Archetypes,
// not impressions of real people.
export const VOICE_PACKS = {
  tween: { name: 'Toxic 13-Year-Old', pitch: 1.35, rate: 1.3, go: ["Bro I'm literally gonna carry you noobs.", 'Go go go, stop being bots!', "Don't be trash this round."],
    planted: ['Bomb planted. Get rekt.', "Bomb's down, cry about it."], defused: ['Bro defused it. So sweaty.', 'Defused. Ok sweatlord.'],
    twin: ['Terrorists win. Get destroyed, losers.', 'T win. Uninstall.'], ctwin: ['CT wins. Ur all trash.', 'CT wins. Ez. Go cry to ur mom.'], draw: ['A draw? Ur all bots.'] },
  classic: { name: 'Classic Announcer', pitch: 0.75, rate: 1.05, go: ['Go go go!', "Let's go!"], planted: ['Bomb has been planted.'], defused: ['Bomb has been defused.'],
    twin: ['Terrorists win.'], ctwin: ['Counter-Terrorists win.'], draw: ['Round draw.'] },
  drill: { name: 'Drill Sergeant', pitch: 0.55, rate: 1.25, go: ['MOVE MOVE MOVE, MAGGOTS!', 'GET OUT THERE AND EARN YOUR LUNCH!'], planted: ['THE BOMB IS IN! I SAID THE BOMB IS IN!'],
    defused: ['BOMB DEFUSED. NOW DROP AND GIVE ME TWENTY!'], twin: ['TERRORISTS WIN. PATHETIC, COUNTER-TERRORISTS!'], ctwin: ['COUNTER-TERRORISTS WIN. DO NOT GET COCKY!'], draw: ['A DRAW? YOU ARE ALL ON LATRINE DUTY!'] },
  trailer: { name: 'Movie Trailer Guy', pitch: 0.2, rate: 0.85, go: ['In a world... where nobody checks the corners.'], planted: ['This summer... the bomb... has been planted.'],
    defused: ['One hero. One pair of pliers. Bomb defused.'], twin: ['The Terrorists... win. Rated R.'], ctwin: ['The Counter-Terrorists... win. Coming soon to a server near you.'], draw: ['Nobody wins. Directed by nobody.'] },
  pirate: { name: 'Pirate Captain', pitch: 0.7, rate: 1.0, go: ['Arr, hoist the sails, ye scallywags!'], planted: ["The powder keg be planted, matey!"], defused: ['The keg be defused! Blast it all!'],
    twin: ['The Terrorists plunder the round! Yo ho ho!'], ctwin: ['The navy wins! Walk the plank, Terrorists!'], draw: ["Nobody gets the treasure. Arr."] },
  robot: { name: 'Malfunctioning Robot', pitch: 0.1, rate: 0.9, go: ['ROUND. START. BEEP. BOOP.'], planted: ['EXPLOSIVE DEVICE. ARMED. I AM NOT. WORRIED.'], defused: ['DEVICE. DISARMED. DISAPPOINTING.'],
    twin: ['TERRORIST VICTORY. COMPUTING. SADNESS.'], ctwin: ['COUNTER TERRORIST VICTORY. DOES. NOT. COMPUTE.'], draw: ['ERROR. NOBODY. WON.'] },
  sports: { name: 'Overexcited Sportscaster', pitch: 1.05, rate: 1.35, go: ["AND THEY'RE OFF!"], planted: ['HE PLANTS IT! WHAT A PLAY! THE CROWD GOES WILD!'], defused: ['DEFUSED! UNBELIEVABLE SCENES HERE TONIGHT!'],
    twin: ['TERRORISTS TAKE THE ROUND! WHAT A GAME!'], ctwin: ['COUNTER-TERRORISTS WIN IT! INCREDIBLE!'], draw: ['A DRAW! NOBODY SAW THAT COMING!'] },
  grandma: { name: 'Sweet Grandma', pitch: 1.55, rate: 0.8, go: ['Go on, sweetie, have fun out there.'], planted: ['Oh dear, someone left a bomb on the carpet.'], defused: ["Oh good, the nice young man fixed the bomb."],
    twin: ['The naughty boys won, dear.'], ctwin: ['The police won. Cookies for everyone!'], draw: ["Nobody won? That's nice, dear."] },
  surfer: { name: 'Surfer Dude', pitch: 0.9, rate: 0.95, go: ['Duuude. Paddle out, bro.'], planted: ["Whoa, bomb's planted. Gnarly."], defused: ['Bomb defused, bro. Totally tubular.'],
    twin: ['Terrorists win. Radical, I guess.'], ctwin: ['Counter-Terrorists win. Hang ten, my dudes.'], draw: ['Nobody won, bro. Chill.'] },
  chipmunk: { name: 'Caffeinated Chipmunk', pitch: 2, rate: 1.5, go: ["Let's go let's go let's go!"], planted: ['Bomb bomb bomb! It is planted!'], defused: ['Yay! No more bomb!'],
    twin: ['Terrorists win! Wheee!'], ctwin: ['Counter-Terrorists win! Yippee!'], draw: ['Nobody won! Again again!'] },
  butler: { name: 'Posh Butler', pitch: 0.8, rate: 0.92, go: ['Your round has begun, sir.'], planted: ['Pardon the interruption. A bomb has been planted.'], defused: ['The explosive has been seen to, sir.'],
    twin: ['The Terrorists have won, regrettably.'], ctwin: ['The Counter-Terrorists prevail. Splendid.'], draw: ['A draw. How very dull.'] },
};
// event lines (kills, deaths, flashes) and the soundboard effects that go with them: only these two packs have them
Object.assign(VOICE_PACKS, {
  mlg: { name: 'MLG 420 Announcer', pitch: 1.2, rate: 1.25, go: ['GET REKT SCRUBS, ROUND START!', 'Four twenty blaze it, go go go!', 'Quickscope or go home!'],
    planted: ['BOMB PLANTED! GET SHREKT!', 'Bomb is down, just like your K D!'], defused: ['DEFUSED! GET REKT!', 'Defused by a certified pro gamer!'],
    twin: ['Terrorists win! REKT!', 'T win! Absolutely destroyed!'], ctwin: ['CT win! Get noscoped!', 'CT win! Sit down, scrubs!'], draw: ['A draw? Lame. Get gud.'],
    headshot: ['MOM, GET THE CAMERA!', 'HEADSHOT! MOM, GET THE CAMERA!'], double: ['Oh baby, a double!', 'DOUBLE KILL!'], triple: ['OH BABY, A TRIPLE!', 'OH BABY A TRIPLE!'],
    quad: ['QUAD KILL! OH MY GOD!'], ace: ['ACE! ACE! OH MY GOD! SHREKT!'], noscope: ['NOOOO SCOPE! GET REKT!', 'Three sixty no scope! Oh my god!'],
    wallbang: ['WALLBANG! Through the wall, son!'], knife: ['KNIFED! Absolutely humiliated!'], first: ['FIRST BLOOD! Get rekt!'],
    died: ['How the fuck did he not die? What the fuck?!', 'What the fuck?! How?!', 'Bro, that was lag, what the fuck!'],
    flashed: ["I'm flashed! I'm fucking flashed!", "I can't see! I'm flashed, I'm flashed!"],
    sfx: { headshot: ['hitmarker', 'airhorn'], double: ['hitmarker', 'airhorn'], triple: ['airhorn', 'wow'], quad: ['airhorn', 'wub'], ace: ['airhorn', 'wub', 'wow'], noscope: ['hitmarker', 'airhorn', 'wow'],
      wallbang: ['hitmarker', 'hitmarker'], knife: ['wow'], first: ['airhorn'], died: ['wub'], flashed: ['ring'], planted: ['airhorn'], twin: ['airhorn'], ctwin: ['airhorn'] } },
  og: { name: 'West Coast OG', pitch: 0.62, rate: 0.82, go: ["Aight. Let's get it, real smooth.", 'Easy now. Roll out, nephew.'], planted: ["Bomb's down. Ain't no thing."], defused: ['Defused, real smooth. Respect.'],
    twin: ['Terrorists took it. Cool, cool.'], ctwin: ['Counter-Terrorists got it. That is a fact.'], draw: ['Nobody won. Pass the snacks.'],
    headshot: ['Ooh. Right in the dome.'], double: ['Two for two. Smooth like butter.'], triple: ["Three in a row? Now that's lit."], quad: ['Four? Somebody call your mama.'],
    ace: ['Whole team, gone. Legendary.'], noscope: ['No scope? Smooth operator.'], wallbang: ['Through the wall. Cold, man.'], knife: ["Knifed him? That's cold, nephew."], first: ['First one down. Easy.'],
    died: ['Dang, they got you. Breathe, nephew.'], flashed: ["Whoa. Too bright, can't see nothin'."], sfx: { headshot: ['hitmarker'], triple: ['wow'], ace: ['airhorn'] } },
});
export const sfxFor = (pack, key) => ((VOICE_PACKS[pack] || {}).sfx || {})[key] || [];
export const hasLine = (pack, key) => !!(VOICE_PACKS[pack] || {})[key];
export function line(pack, key) { const p = VOICE_PACKS[pack] || VOICE_PACKS.classic, l = p[key] || VOICE_PACKS.classic[key] || ['']; return { text: l[Math.floor(Math.random() * l.length)], pitch: p.pitch, rate: p.rate }; }
