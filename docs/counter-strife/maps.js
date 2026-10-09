// The maps. Each is written on a 1 m grid with the builder in world.js: open() carves walkable floor, ramp() makes
// stairs, block()/stack() place crates, cars and low walls, house() makes a building with doors and windows.
// Layouts follow the routes and callouts of the classics they parody, so map knowledge carries over; geometry,
// art and jokes are original. North is -z.
import { MapBuilder } from './world.js';

// ---- Dust Two: Abbottabad (the classic desert bomb map's flow, a certain bearded hide-and-seek champion's compound)
function dust() {
  // heights follow the original's flow: T spawn sits high and everything runs downhill to the sites' approaches; A is
  // raised above CT spawn; Long and Mid slope; the tunnels are covered and lower tunnels dip under the T side.
  const B = new MapBuilder(126, 132, 7, 'sandwall', 'sand');
  B.open(58, 4, 82, 22, 0.6, 'sand');                 // CT spawn
  B.ramp(82, 10, 90, 20, 0.6, 2.0, 'x', 'concrete');  // CT ramp up to A
  B.open(90, 4, 116, 30, 2.0, 'sand');                // A site
  B.ramp(104, 36, 118, 84, 1.4, 0.4, 'z', 'sand');    // Long A: climbs gently towards A
  B.ramp(104, 30, 116, 36, 2.0, 1.4, 'z', 'sand');    // A ramp (long -> site)
  B.open(116, 24, 124, 44, -0.6, 'dirt');             // Pit (a drop off the end of long)
  B.ramp(118, 44, 124, 50, -0.6, 1.2, 'z', 'dirt');   // out of pit, back up to long
  B.open(108, 84, 112, 88, 0.4, 'concrete');          // Long doors
  B.open(100, 88, 122, 100, 0.5, 'sand');             // Outside long
  B.open(50, 100, 88, 128, 2.0, 'sand');              // T spawn (high ground)
  B.ramp(88, 100, 104, 108, 2.0, 0.5, 'x', 'sand');   // T ramp down to outside long
  B.ramp(62, 92, 76, 100, 1.0, 2.0, 'z', 'sand');     // Top mid: slopes down from T spawn
  B.ramp(62, 40, 74, 92, 0.0, 1.0, 'z', 'sand');      // Mid: keeps falling towards mid doors
  B.ramp(74, 56, 82, 62, 0.4, 1.6, 'x', 'concrete');  // stairs mid -> catwalk
  B.open(82, 30, 88, 62, 1.6, 'concrete');            // Catwalk / short
  B.open(88, 26, 92, 34, 1.8, 'concrete');            // Short -> A
  B.open(66, 36, 70, 40, 0, 'concrete');              // Mid doors
  B.ramp(54, 22, 82, 30, 0.6, 0.0, 'z', 'sand');      // CT mid, sloping down from CT spawn
  B.open(54, 30, 82, 36, 0, 'sand');
  B.open(36, 24, 54, 32, 0, 'sand');                  // B doors corridor
  B.open(32, 24, 36, 32, 0.15, 'concrete');           // B doors
  B.open(6, 4, 32, 36, 0.3, 'sand');                  // B site
  B.open(36, 8, 58, 14, 0.6, 'sand');                 // B window corridor from CT
  B.block(32, 9, 36, 12, 1.5, 'sandwall');            // B window (a sill you jump through)
  B.open(12, 36, 20, 44, 0.3, 'dirt');                // tunnel exit into B
  B.open(8, 44, 22, 84, 0.3, 'dirt');                 // Upper tunnels
  B.ramp(8, 84, 24, 96, 0.3, 1.0, 'z', 'sand');       // up the steps out of the tunnels
  B.open(8, 96, 24, 112, 1.0, 'sand');                // Outside tunnels
  B.ramp(24, 100, 50, 112, 1.0, 2.0, 'x', 'sand');    // T side of tunnels, up to T spawn
  B.ramp(22, 62, 28, 68, 0.3, -0.5, 'x', 'dirt');     // Lower tunnels: down from upper...
  B.open(28, 62, 58, 68, -0.5, 'dirt');
  B.ramp(58, 62, 62, 68, -0.5, 0.45, 'x', 'concrete'); // ...and up the stairs into mid
  // ceilings: covered tunnels (with a light well where lower meets upper), arches over the doorways
  B.roof(8, 46, 22, 58, 3.4, 'sandwall').roof(8, 68, 22, 84, 3.4, 'sandwall').roof(22, 62, 58, 68, 2.7, 'sandwall');
  B.roof(108, 84, 112, 88, 3.6, 'sandwall').roof(66, 36, 70, 40, 3.2, 'sandwall').roof(32, 24, 36, 32, 3.2, 'sandwall')
    .roof(32, 8, 36, 14, 3.4, 'sandwall').roof(88, 26, 92, 34, 4.6, 'sandwall');
  // cover
  B.stack(68, 60, 71, 63, 1.1, 'crate');                     // Xbox
  B.stack(92, 6, 100, 13, 1.0, 'wood');                      // A platform
  B.stack(104, 10, 107, 13, 1.1, 'crate'); B.stack(104, 10, 105, 11, 1.1, 'crate');  // default box + stack
  B.stack(100, 19, 102, 21, 1.1, 'crate');                   // triple
  B.stack(112, 4, 116, 8, 1.0, 'wood');                      // goose corner
  B.stack(106, 40, 109, 43, 1.4, 'cblue');                   // Blue (long)
  B.stack(112, 70, 116, 72, 1.3, 'darkwood');                // long corner cart
  B.stack(6, 4, 14, 10, 1.0, 'wood');                        // B back plat
  B.stack(18, 14, 21, 17, 1.1, 'crate'); B.stack(18, 14, 19, 15, 1.1, 'crate');  // B default
  B.stack(24, 6, 30, 9, 1.3, 'cred');                        // B car
  B.stack(10, 26, 12, 28, 1.1, 'crate');                     // B doors box
  B.stack(60, 112, 64, 115, 1.1, 'crate'); B.stack(76, 118, 79, 121, 1.1, 'crate');  // T spawn boxes
  B.stack(64, 26, 66, 28, 1.1, 'crate');                     // CT mid box
  B.stack(108, 26, 110, 28, 1.0, 'darkwood'); B.stack(96, 26, 98, 28, 1.0, 'darkwood');  // A barrels
  B.stack(24, 30, 27, 33, 1.1, 'crate');                     // B back site box
  // callouts
  B.zone('T Spawn', 50, 100, 88, 132).zone('T Ramp', 86, 100, 104, 108).zone('Outside Long', 100, 88, 124, 100).zone('Long Doors', 104, 82, 116, 88)
    .zone('Long A', 104, 36, 118, 82).zone('Pit', 116, 24, 124, 50).zone('A Ramp', 104, 30, 116, 36).zone('A Site', 90, 4, 116, 30).zone('Goose', 110, 4, 116, 9)
    .zone('CT Ramp', 82, 10, 90, 20).zone('CT Spawn', 58, 4, 82, 22).zone('Short A', 82, 26, 92, 36).zone('Catwalk', 82, 36, 88, 62).zone('Mid', 62, 40, 74, 92)
    .zone('Xbox', 66, 58, 74, 66).zone('Top Mid', 62, 92, 76, 104).zone('Mid Doors', 62, 34, 74, 40).zone('CT Mid', 54, 22, 82, 34)
    .zone('B Doors', 30, 22, 54, 34).zone('B Window', 30, 6, 58, 14).zone('B Site', 6, 4, 32, 36).zone('B Plat', 6, 4, 14, 10)
    .zone('Upper Tunnels', 8, 36, 22, 84).zone('Outside Tunnels', 8, 84, 50, 112).zone('Lower Tunnels', 22, 62, 62, 68);
  B.site('A', 92, 6, 114, 28).site('B', 8, 6, 30, 34);
  B.buyzone('T', 50, 104, 88, 128).buyzone('CT', 58, 6, 82, 22);
  for (let k = 0; k < 5; k++) { B.spawn('T', 60 + k * 4, 122, 0); B.spawn('CT', 64 + k * 3, 12, Math.PI); }
  B.duelSpawn('T', 68, 86, 0).duelSpawn('CT', 68, 46, Math.PI);
  // the jokes
  B.sign(63.5, 40.05, 2.6, 0, 'HIDE & SEEK\nWORLD CHAMPION\n2001 – 2011', 4, 1.6, '#1d3b24', '#f3e9b0');
  B.sign(70, 4.05, 3.2, 0, 'NO VISITORS\nNO PHONES • NO WI-FI\nNO NAVY', 4, 1.5, '#5a1f14', '#fff1d6');
  B.sign(10, 44.05, 2.7, 0, 'CAVE SWEET CAVE', 4, 1, '#3a2a1a', '#ffd98a');
  B.sign(104.05, 60, 3.4, Math.PI / 2, 'BEARD TRIM 50% OFF\n(also does back hair)', 3.5, 1.5, '#203a5a', '#fff');
  B.sign(6.05, 20, 2.7, Math.PI / 2, 'DIALYSIS MACHINE\nDO NOT UNPLUG\n(seriously)', 3.5, 1.4, '#eeeeee', '#b01818');
  B.sign(87.95, 46, 4.2, -Math.PI / 2, 'HOME VIDEOS\nVOL. 1 – 69\nmostly me watching myself on TV', 3.6, 1.5, '#111', '#e8e8e8');
  B.sign(45, 24.05, 2.6, 0, 'NO PEEING\nIN THE CAVE\n(looking at you, Gary)', 3.2, 1.4, '#efe6cf', '#3a2a1a');
  B.sign(121.95, 94, 3.1, -Math.PI / 2, 'EMPLOYEE OF THE MONTH\nOSAMA (posthumous)', 3.6, 1.3, '#273', '#fff');
  B.prop('goat', 96, 24, {}).prop('goat', 20, 92, {}).prop('palm', 56, 110, {}).prop('palm', 86, 124, {}).prop('palm', 100, 92, {})
    .prop('tv', 10, 18, { rot: Math.PI / 2 }).prop('barrel', 74, 30, {}).prop('barrel', 120, 96, {}).prop('palm', 30, 10, {});
  B.sky = 0x6f9fd8; B.fog = 0xd9cdb4; B.sunColor = 0xffeed2; B.amb = [0xc4d8f2, 0x9c7c54]; B.sunDir = [0.62, 0.66, 0.42]; B.sunI = 2.7; B.ambI = 1.15;
  return B;
}

// ---- Nuke Town 2069: two little houses across a cul-de-sac, bus in the middle, backyards for spawns ----------------
function nuke() {
  const B = new MapBuilder(72, 52, 6.5, 'fence', 'asphalt');
  B.open(2, 2, 70, 50, 0, 'asphalt');
  B.open(2, 2, 12, 50, 0, 'grass'); B.open(60, 2, 70, 50, 0, 'grass');   // backyards
  B.open(12, 2, 26, 12, 0, 'grass'); B.open(12, 38, 26, 50, 0, 'grass');  // west side yards
  B.open(46, 2, 60, 14, 0, 'grass'); B.open(46, 40, 60, 50, 0, 'grass');  // east side yards
  // the two-storey houses: downstairs is the yard half (back door, side door, kitchen), stairs lead up to the street
  // half, whose upstairs windows look down on the street and the bus, like the original's
  // green house (west)
  B.house(12, 12, 26, 38, 6, 'green', 'carpet', [
    [12, 28, 13, 31], [14, 37, 17, 38],                     // back door (yard), side door
    [14, 12, 17, 13, 1.0], [12, 16, 13, 19, 1.0]]);         // downstairs windows
  B.open(19, 13, 25, 37, 2.8, 'carpet');                    // upstairs (street side)
  B.block(19, 13, 20, 30, 6, 'green'); B.block(19, 34, 20, 37, 6, 'green');   // wall between the halves, landing at the stairs
  B.ramp(13, 30, 19, 34, 0, 2.8, 'x', 'darkwood');          // stairs
  B.block(25, 16, 26, 19, 3.8, 'green').roof(25, 16, 26, 19, 5.0, 'green').block(25, 23, 26, 27, 3.8, 'green').roof(25, 23, 26, 27, 5.0, 'green').block(25, 31, 26, 34, 3.8, 'green').roof(25, 31, 26, 34, 5.0, 'green');   // upstairs street windows
  B.block(21, 12, 24, 13, 3.8, 'green').roof(21, 12, 24, 13, 5.0, 'green').block(21, 37, 24, 38, 3.8, 'green').roof(21, 37, 24, 38, 5.0, 'green');  // upstairs side windows
  B.block(14, 21, 17, 23, 0.9, 'darkwood');                 // kitchen counter
  B.roof(14, 12, 17, 13, 2.3, 'green').roof(12, 16, 13, 19, 2.3, 'green').roof(12, 28, 13, 31, 2.3, 'green').roof(14, 37, 17, 38, 2.3, 'green');   // lintels
  B.stack(22, 20, 24, 22, 0.8, 'darkwood');                 // upstairs bed (cover by the window)
  // yellow house (east)
  B.house(46, 14, 60, 40, 6, 'yellow', 'tile', [
    [59, 20, 60, 23], [55, 14, 58, 15],
    [55, 39, 58, 40, 1.0], [59, 31, 60, 34, 1.0]]);
  B.open(47, 15, 53, 39, 2.8, 'tile');
  B.block(53, 15, 54, 30, 6, 'yellow'); B.block(53, 34, 54, 39, 6, 'yellow');
  B.ramp(54, 30, 59, 34, 0, 2.8, '-x', 'darkwood');
  B.block(46, 18, 47, 21, 3.8, 'yellow').roof(46, 18, 47, 21, 5.0, 'yellow').block(46, 25, 47, 29, 3.8, 'yellow').roof(46, 25, 47, 29, 5.0, 'yellow').block(46, 32, 47, 35, 3.8, 'yellow').roof(46, 32, 47, 35, 5.0, 'yellow');
  B.block(48, 14, 51, 15, 3.8, 'yellow').roof(48, 14, 51, 15, 5.0, 'yellow').block(48, 39, 51, 40, 3.8, 'yellow').roof(48, 39, 51, 40, 5.0, 'yellow');
  B.block(55, 24, 58, 26, 0.9, 'darkwood');
  B.roof(59, 20, 60, 23, 2.3, 'yellow').roof(55, 14, 58, 15, 2.3, 'yellow').roof(55, 39, 58, 40, 2.3, 'yellow').roof(59, 31, 60, 34, 2.3, 'yellow');
  B.stack(48, 30, 50, 32, 0.8, 'darkwood');
  // front-yard fences and the porches' roofs
  B.block(26, 13, 27, 18, 0.9, 'fence').block(26, 32, 27, 37, 0.9, 'fence').block(45, 15, 46, 20, 0.9, 'fence').block(45, 34, 46, 39, 0.9, 'fence');
  // street stuff
  B.block(33, 17, 38, 33, 3.0, 'bus');           // the bus
  B.block(28, 6, 31, 12, 1.8, 'cred');           // truck
  B.block(41, 38, 44, 44, 1.4, 'cblue');         // car
  B.block(29, 40, 31, 42, 1.0, 'crate'); B.block(40, 8, 42, 10, 1.0, 'crate');
  B.block(2, 20, 5, 22, 1.0, 'fence'); B.block(67, 28, 70, 30, 1.0, 'fence');  // backyard fences
  B.block(26, 24, 27, 27, 0.9, 'concrete'); B.block(45, 24, 46, 27, 0.9, 'concrete');  // planters
  B.zone('Green Backyard', 0, 0, 12, 52).zone('Yellow Backyard', 60, 0, 72, 52).zone('Green House', 12, 12, 26, 38).zone('Yellow House', 46, 14, 60, 40)
    .zone('Bus', 30, 16, 41, 34).zone('Truck', 26, 2, 34, 14).zone('North Street', 26, 2, 46, 16).zone('South Street', 26, 34, 46, 50)
    .zone('Green Garage Side', 12, 2, 26, 12).zone('Green Pool Side', 12, 38, 26, 50).zone('Yellow Garage Side', 46, 2, 60, 14).zone('Yellow Pool Side', 46, 40, 60, 50);
  B.zone('Green Upstairs', 19, 13, 25, 37).zone('Yellow Upstairs', 47, 15, 53, 39);   // later zones win
  B.site('A', 26, 2, 46, 14).site('B', 26, 36, 46, 50);
  B.buyzone('T', 2, 2, 12, 50).buyzone('CT', 60, 2, 70, 50);
  for (let k = 0; k < 5; k++) { B.spawn('T', 6, 14 + k * 6, -Math.PI / 2); B.spawn('CT', 65, 14 + k * 6, Math.PI / 2); }
  B.duelSpawn('T', 22, 6, -Math.PI / 2).duelSpawn('CT', 50, 46, Math.PI / 2);
  B.sign(36, 2.05, 3, 0, 'NUKE TOWN 2069\nPOPULATION: 69 (and dropping)', 6, 1.6, '#f6f0d8', '#c0281e');
  B.sign(35.5, 16.95, 2.2, Math.PI, 'SCHOOL BUS\nnext stop: the blast radius', 4.2, 0.9, '#1a1a1a', '#ffd23a');
  B.sign(2.05, 36, 2.4, Math.PI / 2, 'DO NOT EAT\nTHE GLOWING SNOW', 3.4, 1.4, '#e8f6e8', '#0b5e1c');
  B.sign(69.95, 12, 2.4, -Math.PI / 2, 'DUCK & COVER\nYOUR NUTS', 3.4, 1.2, '#fff4c2', '#7a1d0d');
  B.prop('dummy', 20, 34, {}).prop('dummy', 52, 22, {}).prop('dummy', 8, 44, {}).prop('dummy', 64, 6, {}).prop('duck', 36, 46, {})
    .prop('tree', 6, 6, {}).prop('tree', 66, 46, {}).prop('lamp', 27, 2.5, {}).prop('lamp', 45, 49, {});
  B.sky = 0x5f9be0; B.fog = 0xcfe2f4; B.sunColor = 0xfff6e6; B.amb = [0xd2e4fa, 0x6a7a52]; B.sunDir = [0.5, 0.72, -0.45]; B.sunI = 2.6; B.ambI = 1.15;
  return B;
}

// ---- Shitment: the tiny container yard. Everything is close. Everyone is angry. ----------------------------------
function ship() {
  const B = new MapBuilder(40, 40, 6, 'metal', 'concrete');
  B.open(2, 2, 38, 38, 0, 'concrete');
  const C = [[6, 8, 12, 11, 'cred'], [17, 5, 20, 12, 'cblue'], [28, 8, 34, 11, 'cgreen'], [6, 18, 9, 25, 'corange'], [16, 18, 24, 21, 'cblue'],
    [31, 15, 34, 22, 'cred'], [6, 29, 12, 32, 'cgreen'], [20, 28, 23, 35, 'corange'], [28, 29, 34, 32, 'cblue']];
  for (const [x0, z0, x1, z1, m] of C) B.block(x0, z0, x1, z1, 2.6, m);
  for (const [x0, z0, x1, z1, m] of [C[0], C[2], C[6], C[8]]) B.block(x0, z0, x1, z1, 5.2, m);   // corner stacks, two high like the original
  for (const [x, z] of [[13, 14], [25, 24], [12, 25], [27, 14], [15, 33], [26, 5], [3, 16], [36, 24], [19, 24]]) B.block(x, z, x + 1, z + 1, 1.0, 'crate');
  B.block(14, 14, 15, 15, 2.0, 'crate');
  B.block(2, 2, 4, 4, 2.4, 'potty'); B.block(36, 36, 38, 38, 2.4, 'potty');
  B.zone('North', 2, 2, 38, 7).zone('South', 2, 33, 38, 38).zone('West Lane', 2, 7, 6, 33).zone('East Lane', 34, 7, 38, 33).zone('Center', 12, 12, 28, 28);
  B.site('A', 3, 12, 15, 18).site('B', 25, 22, 37, 28);
  B.buyzone('T', 2, 33, 38, 38).buyzone('CT', 2, 2, 38, 7);
  for (let k = 0; k < 5; k++) { B.spawn('T', 8 + k * 6, 36, 0); B.spawn('CT', 8 + k * 6, 4, Math.PI); }
  B.duelSpawn('T', 4, 35, 0).duelSpawn('CT', 36, 5, Math.PI);
  B.sign(9, 7.95, 1.6, Math.PI, 'CONTENTS: 40,000\nRUBBER CHICKENS', 4.5, 1.2, '#f0e6c8', '#401010');
  B.sign(18.5, 12.05, 1.6, 0, 'FRAGILE:\nGRANDMA\'S ASHES', 2.6, 1.1, '#fff', '#b01818');
  B.sign(31, 32.05, 1.6, 0, 'CONTENTS:\nUNFLUSHABLE', 4.5, 1.1, '#3b2a1a', '#ffd98a');
  B.sign(3, 4.05, 1.8, 0, 'OCCUPIED\nsince 2019', 1.8, 0.9, '#d22', '#fff');
  B.sign(37, 35.95, 1.8, Math.PI, 'OUT OF ORDER\ndon\'t ask', 1.8, 0.9, '#222', '#fd3');
  B.sign(20, 2.05, 3.2, 0, 'SHITMENT\nyou will respawn in 0.2 seconds', 8, 1.4, '#20262e', '#f0f4f8');
  B.prop('lamp', 2.5, 20, {}).prop('lamp', 37.5, 20, {}).prop('barrel', 24, 10, {}).prop('barrel', 10, 27, {});
  B.sky = 0x7a8aa0; B.fog = 0x9aa4b2; B.sunColor = 0xeef2fa; B.amb = [0xd6e0ee, 0x5a5a60]; B.sunDir = [0.45, 0.8, 0.5]; B.sunI = 1.5; B.ambI = 1.6;
  return B;
}

// ---- Burnt Town: crossroads around a smoking crater, a bank, a saloon, a diner and a fire station ---------------
function town() {
  const B = new MapBuilder(64, 64, 6, 'brick', 'asphalt');
  B.open(2, 2, 62, 62, 0, 'asphalt');
  B.open(2, 2, 24, 24, 0, 'dirt'); B.open(40, 2, 62, 24, 0, 'dirt'); B.open(2, 40, 24, 62, 0, 'dirt'); B.open(40, 40, 62, 62, 0, 'dirt');
  B.lava(29, 29, 35, 35);                                    // the crater
  B.block(28, 28, 29, 36, 0.6, 'rock'); B.block(35, 28, 36, 36, 0.6, 'rock'); B.open(28, 31, 29, 33, 0, 'asphalt'); B.open(35, 31, 36, 33, 0, 'asphalt');
  // Bank (NW, site A): vault downstairs; stairs to an upstairs strip whose windows watch the west and north roads
  B.house(4, 4, 22, 22, 7, 'brick', 'tile', [[21, 10, 22, 14], [4, 8, 5, 11, 1.1], [8, 4, 11, 5, 1.1], [21, 5, 22, 8, 1.1]]);
  B.block(7, 7, 13, 8, 7, 'metal'); B.block(12, 7, 13, 11, 7, 'metal'); B.open(12, 9, 13, 10, 0, 'tile');  // vault
  B.block(6, 13, 12, 14, 1.1, 'darkwood');                  // teller counter
  B.open(5, 17, 21, 21, 3.0, 'wood');                       // upstairs
  B.block(5, 16, 16, 17, 7, 'brick'); B.block(20, 16, 21, 17, 7, 'brick');
  B.ramp(16, 11, 20, 17, 0, 3.0, 'z', 'darkwood');          // stairs
  B.block(7, 21, 10, 22, 3.9, 'brick').roof(7, 21, 10, 22, 5.2, 'brick').block(13, 21, 17, 22, 3.9, 'brick').roof(13, 21, 17, 22, 5.2, 'brick')
    .block(21, 17, 22, 20, 3.9, 'brick').roof(21, 17, 22, 20, 5.2, 'brick');   // upstairs windows
  B.roof(21, 10, 22, 14, 2.4, 'brick').roof(4, 8, 5, 11, 2.3, 'brick').roof(8, 4, 11, 5, 2.3, 'brick').roof(21, 5, 22, 8, 2.3, 'brick');
  // Saloon (NE, site B): bar downstairs, stairs up to the rooms and out onto a balcony over the crossroads
  B.house(42, 4, 60, 22, 7, 'darkwood', 'wood', [[42, 10, 43, 14], [50, 4, 53, 5], [59, 8, 60, 11, 1.1]]);
  B.block(45, 7, 53, 8, 1.1, 'darkwood'); B.block(52, 8, 53, 10, 1.1, 'darkwood');   // the bar
  B.block(46, 12, 47, 13, 0.8, 'wood'); B.block(48, 14, 49, 15, 0.8, 'wood');       // tables
  B.open(43, 17, 59, 21, 3.0, 'wood');                      // upstairs rooms
  B.block(43, 16, 52, 17, 7, 'darkwood'); B.block(56, 16, 59, 17, 7, 'darkwood');
  B.ramp(52, 11, 56, 17, 0, 3.0, 'z', 'darkwood');
  B.open(49, 21, 53, 22, 3.0, 'wood');                      // door out to the balcony
  B.open(44, 22, 58, 24, 3.0, 'wood'); B.block(44, 24, 58, 25, 4.0, 'darkwood');      // balcony + railing (cover)
  B.block(59, 17, 60, 20, 3.9, 'darkwood').roof(59, 17, 60, 20, 5.2, 'darkwood');
  B.roof(42, 10, 43, 14, 2.4, 'darkwood').roof(50, 4, 53, 5, 2.4, 'darkwood').roof(49, 21, 53, 22, 5.2, 'darkwood').roof(44, 22, 58, 25, 5.6, 'darkwood');   // porch roof over the balcony
  // Diner (SW) and Fire station (SE)
  B.house(4, 42, 22, 60, 4, 'plaster', 'tile', [[21, 48, 22, 52], [12, 42, 16, 43], [4, 50, 5, 53, 1.1]]);
  B.block(8, 46, 16, 47, 1.0, 'cred');
  B.house(42, 42, 60, 60, 4.5, 'brick', 'concrete', [[42, 48, 43, 54], [48, 42, 54, 43], [59, 50, 60, 53, 1.1]]);
  B.block(47, 49, 55, 54, 2.2, 'cred');                     // fire truck
  // the road blocks (the bus that never comes)
  B.block(27, 2, 37, 5, 2.6, 'bus'); B.block(27, 59, 37, 62, 2.6, 'bus');
  B.block(2, 28, 5, 36, 1.4, 'cblue'); B.block(59, 28, 62, 36, 1.4, 'cred');
  B.block(29, 44, 35, 47, 2.6, 'bus'); B.block(30, 17, 34, 20, 2.2, 'cred');  // wrecks breaking the long road sightline
  B.block(25, 40, 27, 41, 1.2, 'rock'); B.block(37, 23, 39, 24, 1.2, 'rock');
  B.block(25, 12, 26, 14, 1.0, 'crate'); B.block(38, 46, 39, 48, 1.0, 'crate'); B.block(30, 40, 32, 41, 1.0, 'crate'); B.block(31, 22, 33, 23, 1.0, 'crate');
  B.zone('Bank', 4, 4, 22, 22).zone('Vault', 7, 7, 13, 11).zone('Saloon', 42, 4, 60, 22).zone('Diner', 4, 42, 22, 60).zone('Fire Station', 42, 42, 60, 60)
    .zone('Crater', 27, 27, 37, 37).zone('North Road', 24, 2, 40, 27).zone('South Road', 24, 37, 40, 62).zone('West Road', 2, 24, 27, 40).zone('East Road', 37, 24, 62, 40);
  B.zone('Bank Upstairs', 5, 16, 21, 21).zone('Saloon Upstairs', 43, 16, 59, 21).zone('Balcony', 44, 21, 58, 25);
  B.site('A', 5, 5, 21, 16).site('B', 43, 5, 59, 16);
  B.buyzone('T', 24, 52, 40, 59).buyzone('CT', 24, 5, 40, 12);
  for (let k = 0; k < 5; k++) { B.spawn('T', 26 + k * 3, 55, 0); B.spawn('CT', 26 + k * 3, 8, Math.PI); }
  B.duelSpawn('T', 32, 50, 0).duelSpawn('CT', 32, 14, Math.PI);
  B.sign(22.05, 6.5, 2.8, Math.PI / 2, 'BANK OF BURNT TOWN\nyour money is ash', 3.6, 1.2, '#2a2a2a', '#f2d36b');
  B.sign(41.95, 6.5, 2.8, -Math.PI / 2, 'SALOON\ndrinks so strong\nyou\'ll grow perks', 3.6, 1.4, '#3a1f12', '#ffd98a');
  B.sign(22.05, 45, 2.8, Math.PI / 2, 'DINER\nTHICC-NOG • SPEEDY SQUIRTS\nDOUBLE TAP DANCE', 3.8, 1.4, '#a11', '#fff');
  B.sign(41.95, 45.5, 3, -Math.PI / 2, 'FIRE STATION\n(currently on fire)', 3.6, 1.2, '#b32', '#fff');
  B.sign(32, 5.05, 1.5, 0, 'BUS DEPOT\nnext bus: never', 4, 1, '#1a1a1a', '#ffd23a');
  B.sign(36.05, 30, 0.3, Math.PI / 2, 'HOT TUB (do not)', 1.6, 0.5, '#222', '#f60');
  B.prop('lamp', 25, 25, {}).prop('lamp', 39, 39, {}).prop('lamp', 39, 25, {}).prop('lamp', 25, 39, {}).prop('barrel', 26, 45, {}).prop('barrel', 38, 18, {})
    .prop('tree', 3, 26, {}).prop('tree', 61, 38, {});
  B.sky = 0x46405a; B.fog = 0x6a4a44; B.sunColor = 0xffa860; B.amb = [0xb8a8c0, 0x4a3430]; B.sunDir = [0.75, 0.38, 0.3]; B.sunI = 2.4; B.ambI = 1.0;
  return B;
}

// ---- Crust: the tiny desert oil yard. An oil tower in the middle you fight over, a tin shack, pipes, containers --------
function crust() {
  const B = new MapBuilder(48, 48, 6, 'metal', 'sand');
  B.open(2, 2, 46, 46, 0, 'sand');
  B.open(14, 18, 34, 30, 0, 'dirt');
  // the tower: a deck at 3 m (rails all round), a crow's nest at 5 m, ramps up the east side and a steep ladder west
  B.open(20, 20, 28, 28, 3.0, 'metal');
  B.ramp(28, 22, 34, 25, 0, 3.0, '-x', 'metal');
  B.ramp(14, 23, 20, 25, 0, 3.0, 'x', 'metal');
  B.open(23, 20, 27, 23, 5.0, 'metal'); B.ramp(23, 23, 27, 27, 5.0, 3.0, 'z', 'metal');
  B.block(20, 19, 28, 20, 4.0, 'metal').block(20, 28, 28, 29, 4.0, 'metal').block(19, 19, 20, 23, 4.0, 'metal').block(19, 25, 20, 29, 4.0, 'metal')
    .block(28, 19, 29, 22, 4.0, 'metal').block(28, 25, 29, 29, 4.0, 'metal');           // rails (gaps where the ramps land)
  B.block(23, 19, 27, 20, 6.0, 'metal');                                                  // crow's nest rail
  B.roof(22, 20, 28, 24, 7.2, 'metal');                                                   // tin roof over the top
  // the shack (A) and the container yard (B)
  B.house(18, 3, 30, 11, 3.2, 'metal', 'wood', [[18, 6, 19, 9], [29, 6, 30, 9], [23, 10, 26, 11], [20, 3, 23, 4, 1.1], [26, 3, 29, 4, 1.1]]);
  B.block(20, 5, 23, 6, 1.0, 'darkwood').block(25, 8, 28, 9, 0.9, 'crate');
  B.roof(18, 6, 19, 9, 2.3, 'metal').roof(29, 6, 30, 9, 2.3, 'metal').roof(23, 10, 26, 11, 2.3, 'metal');
  B.block(18, 39, 24, 42, 2.6, 'cgreen').block(26, 41, 30, 44, 2.6, 'corange').block(18, 39, 24, 42, 5.2, 'cgreen');
  B.block(27, 36, 29, 38, 1.1, 'crate').block(16, 44, 18, 46, 1.1, 'crate');
  // pipes, sand piles, junk
  B.block(4, 15, 14, 16, 1.0, 'metal').block(34, 31, 44, 32, 1.0, 'metal').block(10, 30, 11, 38, 1.0, 'metal').block(36, 12, 37, 20, 1.0, 'metal');
  B.ramp(36, 38, 42, 41, 0, 1.0, 'x', 'sand'); B.open(42, 38, 45, 41, 1.0, 'sand');
  B.block(6, 6, 8, 8, 1.1, 'crate').block(40, 6, 44, 8, 2.6, 'cred').block(32, 14, 34, 16, 1.1, 'crate').block(12, 34, 14, 36, 1.1, 'crate');
  B.zone('West Yard', 2, 2, 14, 46).zone('East Yard', 34, 2, 46, 46).zone('Pipes', 2, 28, 14, 40).zone('Shack', 18, 3, 30, 11).zone('Containers', 16, 36, 32, 46)
    .zone('Under the Tower', 14, 18, 34, 30).zone('Tower', 19, 19, 29, 29).zone("Crow's Nest", 23, 20, 27, 23);
  B.site('A', 19, 4, 29, 10).site('B', 16, 36, 32, 45);
  B.buyzone('T', 2, 14, 9, 34).buyzone('CT', 39, 14, 46, 34);
  for (let k = 0; k < 5; k++) { B.spawn('T', 5, 16 + k * 4, -Math.PI / 2); B.spawn('CT', 43, 16 + k * 4, Math.PI / 2); }
  B.duelSpawn('T', 8, 24, -Math.PI / 2).duelSpawn('CT', 40, 24, Math.PI / 2);
  B.sign(24, 3.05, 2.2, 0, 'CRUST OIL CO.\n0 days without a fart', 4, 1.2, '#2a1f14', '#f2d36b');
  B.sign(30.05, 26, 3.2, Math.PI / 2, 'NO CLIMBING\n(everyone climbs)', 3, 1, '#fff', '#b01818');
  B.sign(29.95, 7.5, 2.2, -Math.PI / 2, 'OUTHOUSE →\n(it\'s the whole shack)', 3, 1, '#3a2a1a', '#ffd98a');
  B.prop('barrel', 33, 9, {}).prop('barrel', 15, 33, {}).prop('barrel', 35, 35, {}).prop('lamp', 16, 18, {}).prop('lamp', 32, 30, {});
  B.sky = 0x86a8cc; B.fog = 0xd6c4a0; B.sunColor = 0xffe6c0; B.amb = [0xc4d0e0, 0x8a7050]; B.sunDir = [0.5, 0.62, 0.6]; B.sunI = 2.6; B.ambI = 1.1;
  return B;
}

// ---- Hijacked: Yacht Rock. A rich guy's superyacht: stern lounge and drained pool, the deckhouse with the bar, the
// bridge up top, a hot tub on the bow. Fall off and the sharks get you.
function yacht() {
  const B = new MapBuilder(80, 30, 7, 'fence', 'wood');
  B.water(0, 0, 80, 30);
  B.open(6, 7, 72, 23, 2.0, 'wood'); B.open(72, 10, 76, 20, 2.0, 'wood'); B.open(76, 13, 78, 17, 2.0, 'wood');   // hull, tapering to the bow
  // rails: every deck cell that touches the water becomes a white rail
  const W = B.w, edge = [];
  for (let z = 1; z < B.d - 1; z++) for (let x = 1; x < W - 1; x++) { const i = z * W + x; if (B.flag[i] === 2 && [i - 1, i + 1, i - W, i + W].some((j) => B.flag[j] === 3)) edge.push([x, z]); }
  for (const [x, z] of edge) B.block(x, z, x + 1, z + 1, 3.1, 'fence');
  // deckhouse (A): the bar inside, doors fore and aft, windows down both sides
  B.house(26, 10, 46, 20, 5.2, 'fence', 'carpet', [[26, 13, 27, 17], [45, 13, 46, 17], [30, 10, 34, 11, 3.1], [38, 10, 42, 11, 3.1], [30, 19, 34, 20, 3.1], [38, 19, 42, 20, 3.1]], 2.0);
  B.block(30, 12, 36, 13, 3.1, 'darkwood').block(38, 16, 43, 17, 2.6, 'carpet');
  for (const [a, b2, c, d] of [[26, 13, 27, 17], [45, 13, 46, 17]]) B.roof(a, b2, c, d, 4.4, 'fence');
  for (const [a, b2, c, d] of [[30, 10, 34, 11], [38, 10, 42, 11], [30, 19, 34, 20], [38, 19, 42, 20]]) B.roof(a, b2, c, d, 4.3, 'fence');
  // the bridge, up two flights of stairs
  B.open(48, 11, 56, 19, 5.0, 'wood');
  B.block(48, 10, 56, 11, 6.0, 'fence').block(47, 11, 48, 19, 6.0, 'fence').block(56, 11, 57, 13, 6.0, 'fence').block(56, 17, 57, 19, 6.0, 'fence');
  B.block(52, 12, 55, 13, 6.0, 'darkwood');                                                // the helm
  B.ramp(50, 19, 56, 21, 2.0, 5.0, '-x', 'wood'); B.ramp(50, 9, 56, 11, 2.0, 5.0, '-x', 'wood');
  B.roof(48, 11, 57, 19, 8.0, 'fence');
  // stern: drained pool (sunken cover), bar, loungers
  B.open(10, 12, 16, 18, 1.0, 'tile'); B.ramp(16, 13, 18, 17, 1.0, 2.0, 'x', 'tile');
  B.block(18, 8, 22, 9, 3.1, 'darkwood').block(8, 20, 12, 21, 2.5, 'carpet').block(20, 20, 24, 21, 2.5, 'carpet');
  // bow: hot tub (cover), deck boxes
  B.block(62, 13, 66, 17, 2.8, 'tile').block(63, 14, 65, 16, 2.6, 'cblue');
  B.block(58, 9, 60, 11, 3.0, 'crate').block(68, 18, 70, 20, 3.0, 'crate').block(58, 19, 60, 21, 3.0, 'crate');
  B.zone('Stern', 6, 7, 24, 23).zone('Pool', 10, 12, 18, 18).zone('Port Side', 24, 7, 58, 10).zone('Starboard Side', 24, 20, 58, 23)
    .zone('Deckhouse', 26, 10, 46, 20).zone('Bridge', 47, 10, 57, 21).zone('Bow', 58, 7, 72, 23).zone('Hot Tub', 61, 12, 67, 18).zone('Bow Tip', 72, 10, 78, 20);
  B.site('A', 27, 11, 45, 19).site('B', 58, 8, 71, 22);
  B.buyzone('T', 6, 8, 16, 22).buyzone('CT', 70, 10, 78, 20);
  for (let k = 0; k < 5; k++) { B.spawn('T', 9, 10 + k * 2.5, -Math.PI / 2); B.spawn('CT', 73.5, 11 + k * 2, Math.PI / 2); }
  B.duelSpawn('T', 22, 15, -Math.PI / 2).duelSpawn('CT', 60, 15, Math.PI / 2);
  B.sign(36, 10.05, 3.6, Math.PI, 'SUGAR DADDY II\nno shirt, no shoes, no problem', 5, 1.1, '#f4f0e8', '#1a3a6a');
  B.sign(46.05, 15, 4.6, Math.PI / 2, 'CAPTAIN ONLY\n(the captain is a dog)', 3, 1, '#1a3a6a', '#fff');
  B.sign(62, 12.95, 3.4, 0, 'HOT TUB\n0% chlorine 100% pee', 3, 0.9, '#2a6aff', '#fff');
  B.prop('lamp', 25, 8, {}).prop('lamp', 25, 22, {}).prop('palm', 9, 21, {}).prop('duck', 13, 15, {});
  B.sky = 0x5aa0e8; B.fog = 0xbcd8f0; B.sunColor = 0xfff4e0; B.amb = [0xcfe4fa, 0x4a7a9a]; B.sunDir = [0.55, 0.7, -0.4]; B.sunI = 2.7; B.ambI = 1.2;
  return B;
}

// ---- Shooting Strange: the army firing range. Shooting lanes with pop-up targets down the middle, the range tower,
// trailers and sandbag bunkers, the command building and the motor pool garage.
function range() {
  const B = new MapBuilder(72, 52, 6, 'concrete', 'dirt');
  B.open(2, 2, 70, 50, 0, 'dirt');
  B.open(18, 19, 58, 33, 0, 'grass');                                                     // the lanes
  for (const z of [22, 25, 28, 31]) { B.block(22, z, 34, z + 1, 1.2, 'concrete'); B.block(38, z, 50, z + 1, 1.2, 'concrete'); }   // lane dividers (gaps to cross)
  B.block(58, 17, 60, 35, 2.6, 'dirt');                                                   // the berm the targets stand in front of
  B.block(14, 19, 18, 20, 1.0, 'darkwood').block(14, 32, 18, 33, 1.0, 'darkwood').block(15, 23, 17, 24, 0.9, 'wood').block(15, 28, 17, 29, 0.9, 'wood');
  B.roof(13, 18, 18, 34, 3.0, 'roof');                                                    // firing-line shelter
  // range tower (west): stairs up to a glassed lookout over the lanes
  B.house(4, 21, 11, 31, 6.5, 'plaster', 'concrete', [[4, 24, 5, 27], [6, 21, 9, 22, 1.1]]);
  B.open(8, 22, 10, 30, 3.0, 'concrete'); B.ramp(5, 27, 8, 30, 0, 3.0, 'x', 'darkwood'); B.block(7, 22, 8, 27, 6.5, 'plaster');
  B.block(10, 22, 11, 25, 4.0, 'plaster').roof(10, 22, 11, 25, 5.4, 'plaster').block(10, 27, 11, 30, 4.0, 'plaster').roof(10, 27, 11, 30, 5.4, 'plaster');
  B.roof(4, 24, 5, 27, 2.3, 'plaster').roof(6, 21, 9, 22, 2.3, 'plaster');
  // command building (A) and motor pool (B)
  B.house(48, 4, 66, 14, 3.6, 'plaster', 'tile', [[48, 7, 49, 11], [55, 13, 59, 14], [65, 7, 66, 10], [51, 4, 54, 5, 1.1], [60, 4, 63, 5, 1.1]]);
  B.block(51, 7, 56, 8, 1.0, 'darkwood').block(59, 8, 62, 11, 0.9, 'darkwood');
  B.roof(48, 7, 49, 11, 2.4, 'plaster').roof(55, 13, 59, 14, 2.4, 'plaster').roof(65, 7, 66, 10, 2.4, 'plaster');
  B.house(48, 38, 66, 48, 4.5, 'metal', 'concrete', [[52, 38, 60, 39], [48, 42, 49, 45], [65, 41, 66, 44]]);
  B.block(54, 41, 60, 45, 2.2, 'cgreen').block(50, 45, 52, 47, 1.1, 'crate');            // army truck
  B.roof(52, 38, 60, 39, 3.6, 'metal');
  // trailers, bunkers, crates
  B.block(22, 6, 28, 9, 2.6, 'plaster').block(22, 43, 28, 46, 2.6, 'plaster');
  B.block(30, 8, 36, 9, 1.2, 'concrete').block(30, 42, 36, 43, 1.2, 'concrete').block(40, 12, 41, 16, 1.2, 'concrete').block(40, 36, 41, 40, 1.2, 'concrete');
  B.block(16, 10, 18, 12, 1.1, 'crate').block(16, 40, 18, 42, 1.1, 'crate').block(44, 24, 46, 28, 1.1, 'crate').block(62, 22, 64, 24, 1.1, 'crate').block(62, 28, 64, 30, 1.1, 'crate');
  B.zone('Spawn West', 2, 2, 14, 50).zone('North Trailers', 18, 2, 46, 17).zone('South Trailers', 18, 35, 46, 50).zone('Firing Line', 13, 18, 18, 34)
    .zone('Lanes', 18, 19, 58, 33).zone('Berm', 58, 17, 62, 35).zone('Range Tower', 4, 21, 11, 31).zone('Command', 48, 4, 66, 14).zone('Motor Pool', 48, 38, 66, 48).zone('CT Yard', 62, 15, 70, 37);
  B.site('A', 49, 5, 65, 13).site('B', 49, 39, 65, 47);
  B.buyzone('T', 2, 2, 12, 18).buyzone('CT', 64, 16, 70, 36);
  for (let k = 0; k < 5; k++) { B.spawn('T', 5 + (k % 3) * 2.5, 6 + Math.floor(k / 3) * 5, -Math.PI / 2); B.spawn('CT', 67, 18 + k * 4, Math.PI / 2); }
  B.duelSpawn('T', 16, 26, -Math.PI / 2).duelSpawn('CT', 62, 26, Math.PI / 2);
  B.sign(36, 33.05, 1.4, 0, 'LANE 69\nnice', 2.2, 0.8, '#1d3b24', '#f3e9b0');
  B.sign(57, 4.05, 2.6, 0, 'RANGE COMMAND\nknock first, I\'m on the toilet', 4, 1.1, '#2a3a2a', '#fff');
  B.sign(56, 38.05, 3.8, 0, 'MOTOR POOL\nno farting in the tanks', 4, 1, '#3a3a2a', '#ffd23a');
  B.sign(11.05, 26, 4.8, Math.PI / 2, 'RANGE IS HOT\n(so is my mom)', 3, 1, '#b01818', '#fff');
  for (const z of [20.5, 23.5, 26.5, 29.5, 32]) B.prop('dummy', 56, z, {});
  B.prop('tree', 4, 44, {}).prop('tree', 68, 6, {}).prop('tree', 30, 48, {}).prop('lamp', 46, 20, {}).prop('lamp', 46, 32, {}).prop('barrel', 20, 14, {}).prop('barrel', 47, 36, {});
  B.sky = 0x6a9ad8; B.fog = 0xc8d4c0; B.sunColor = 0xfff0d8; B.amb = [0xc8daf0, 0x6a6a4a]; B.sunDir = [-0.5, 0.68, 0.5]; B.sunI = 2.5; B.ambI = 1.15;
  return B;
}

// ======================================================================================================================
// Story-only maps (story mode never plays them in multiplayer: MAPS[id].story). Built for walk-and-talk scenes,
// a hospital siege and the finale; zone names are the ones story.js points at.
// ======================================================================================================================

// ---- Fort Brisket: the squad's barracks (Reveille, The Last Night, Tape Four) ---------------------------------------
function barracks(night = false) {
  const B = new MapBuilder(64, 54, 6, 'concrete', 'dirt');
  B.open(2, 2, 62, 52, 0, 'dirt');
  B.open(20, 17, 44, 37, 0, 'asphalt');                                                   // parade ground
  B.open(30, 2, 34, 17, 0, 'concrete').open(30, 37, 34, 52, 0, 'concrete').open(2, 25, 20, 29, 0, 'concrete').open(44, 25, 62, 29, 0, 'concrete');   // paths
  B.house(4, 4, 18, 16, 3.4, 'plaster', 'wood', [[10, 15, 13, 16]]);                        // bunks
  B.block(5, 5, 7, 8, 0.6, 'darkwood').block(5, 10, 7, 13, 0.6, 'darkwood').block(15, 5, 17, 8, 0.6, 'darkwood').block(15, 10, 17, 13, 0.6, 'darkwood');   // bunk beds
  B.roof(4, 4, 18, 16, 3.4, 'roof').roof(10, 15, 13, 16, 2.4, 'plaster');
  B.house(46, 4, 60, 16, 3.4, 'plaster', 'tile', [[50, 15, 54, 16]]);                       // mess hall
  B.block(49, 7, 57, 8, 0.8, 'darkwood').block(49, 11, 57, 12, 0.8, 'darkwood').block(58, 5, 59, 7, 1.2, 'metal');   // tables and the coffee machine
  B.roof(46, 4, 60, 16, 3.4, 'roof').roof(50, 15, 54, 16, 2.4, 'plaster');
  B.house(4, 38, 18, 50, 3.4, 'plaster', 'tile', [[10, 38, 13, 39]]);                       // infirmary
  B.block(5, 45, 8, 47, 0.7, 'trim').block(14, 45, 17, 47, 0.7, 'trim');
  B.roof(4, 38, 18, 50, 3.4, 'roof').roof(10, 38, 13, 39, 2.4, 'plaster');
  B.house(46, 38, 60, 50, 3.6, 'metal', 'concrete', [[50, 38, 54, 39]]);                    // armory
  B.block(47, 46, 59, 49, 1.6, 'crate');
  B.roof(46, 38, 60, 50, 3.6, 'metal').roof(50, 38, 54, 39, 2.6, 'metal');
  B.ramp(36, 42, 40, 50, 0, 3.2, 'x', 'darkwood'); B.open(40, 42, 44, 50, 3.2, 'wood');     // watchtower: steps up to a lookout
  B.block(44, 42, 45, 50, 4.2, 'wood').block(40, 41, 45, 42, 4.2, 'wood').block(40, 50, 45, 51, 4.2, 'wood');
  B.block(24, 20, 26, 22, 1.1, 'crate').block(38, 32, 40, 34, 1.1, 'crate').block(22, 33, 24, 35, 0.8, 'darkwood');
  B.zone('Bunks', 4, 4, 18, 17).zone('Mess Hall', 46, 4, 60, 17).zone('Infirmary', 4, 37, 18, 50).zone('Armory', 46, 37, 60, 50)
    .zone('Watchtower', 36, 41, 45, 51).zone('Parade Ground', 20, 17, 44, 37);
  B.site('A', 46, 4, 60, 16).site('B', 46, 38, 60, 50);
  B.buyzone('T', 2, 25, 8, 29).buyzone('CT', 26, 24, 38, 30);
  for (let k = 0; k < 5; k++) { B.spawn('CT', 27 + k * 2.5, 27, 0); B.spawn('T', 3 + (k % 2) * 2, 20 + k * 3, Math.PI / 2); }
  for (let k = 0; k < 3; k++) B.spawn('T', 60, 20 + k * 6, -Math.PI / 2);
  B.duelSpawn('T', 22, 27, -Math.PI / 2).duelSpawn('CT', 42, 27, Math.PI / 2);
  B.sign(32, 2.05, 3.2, 0, 'FORT BRISKET\nhome of nobody important', 5, 1.4, '#2a3a2a', '#f3e9b0');
  B.sign(58.05, 6, 2.0, -Math.PI / 2, 'ESPRESSO.\nThere is no X.', 1.6, 0.8, '#f4f0e6', '#b01818');   // his handwriting, from the first week
  B.sign(11.5, 16.05, 2.8, 0, 'BUNKS\nlights out 2200', 3, 0.8, '#3a2a1a', '#fff');
  B.sign(11.5, 37.95, 2.8, Math.PI, 'INFIRMARY', 3, 0.7, '#eeeeee', '#b01818');
  B.sign(52, 37.95, 3.0, Math.PI, 'ARMORY\nsign out every gun\n(Ricky: ONE glock)', 3.4, 1.1, '#2a2a2a', '#ffd23a');
  B.prop('lamp', 20, 17, {}).prop('lamp', 44, 37, {}).prop('lamp', 20, 37, {}).prop('lamp', 44, 17, {}).prop('tree', 4, 22, {}).prop('tree', 60, 32, {}).prop('tree', 26, 50, {})
    .prop('barrel', 25, 40, {}).prop('barrel', 47, 20, {}).prop('tv', 8, 9, {});
  if (night) { B.sky = 0x0b1230; B.fog = 0x141c34; B.sunColor = 0x9fb4ff; B.amb = [0x3a4a78, 0x14121a]; B.sunDir = [0.3, 0.75, -0.4]; B.sunI = 1.25; B.ambI = 1.05; }
  else { B.sky = 0xf0b878; B.fog = 0xe8c8a0; B.sunColor = 0xffd8a8; B.amb = [0xf0d0b0, 0x6a5a4a]; B.sunDir = [-0.7, 0.35, 0.3]; B.sunI = 2.2; B.ambI = 1.1; }   // dawn
  return B;
}

// ---- St. Mercy Hospital (chapter 6) -----------------------------------------------------------------------------------
function hospital() {
  const B = new MapBuilder(70, 58, 6, 'plaster', 'tile');
  B.open(2, 2, 68, 56, 0, 'tile');
  B.open(24, 50, 46, 56, 0, 'asphalt');                                                    // ambulance bay out front
  const wall = (x0, z0, x1, z1) => B.block(x0, z0, x1, z1, 3.6, 'plaster');
  // north wing: chapel, nursery, oncology, records; doors onto the main corridor (z 26-30)
  wall(2, 25, 8, 26); wall(11, 25, 18, 26); wall(16, 2, 18, 25);
  wall(18, 25, 23, 26); wall(26, 25, 34, 26); wall(32, 2, 34, 25);
  wall(34, 25, 39, 26); wall(42, 25, 50, 26); wall(50, 2, 52, 25);
  wall(52, 25, 57, 26); wall(60, 25, 68, 26);
  B.block(18, 10, 32, 11, 1.3, 'fence');                                                     // nursery window (waist-high glass rail)
  B.block(4, 6, 6, 18, 0.5, 'darkwood').block(9, 6, 11, 18, 0.5, 'darkwood').block(5, 3, 15, 4, 1.0, 'darkwood');   // chapel pews and altar
  B.block(36, 4, 40, 6, 0.8, 'darkwood').block(44, 14, 48, 16, 0.5, 'carpet');               // oncology: the doctor's desk, a sofa
  B.block(54, 4, 66, 6, 2.2, 'metal').block(54, 10, 66, 12, 2.2, 'metal').block(54, 16, 66, 18, 2.2, 'metal');   // records shelves
  // south wing: the ward, the lobby, the blood bank, the stairs to the roof
  wall(2, 30, 8, 31); wall(11, 30, 22, 31); wall(22, 30, 24, 50);
  wall(24, 30, 31, 31); wall(39, 30, 46, 31); wall(46, 31, 48, 50);
  wall(48, 30, 53, 31); wall(56, 30, 68, 31); wall(48, 42, 60, 43);
  for (let k = 0; k < 4; k++) { B.block(4, 33 + k * 4, 7, 35 + k * 4, 0.7, 'trim'); B.block(16, 33 + k * 4, 19, 35 + k * 4, 0.7, 'trim'); }   // ward beds
  B.block(30, 36, 40, 38, 1.1, 'darkwood');                                                  // reception desk
  B.block(50, 33, 52, 41, 1.6, 'metal').block(64, 33, 66, 41, 1.6, 'metal');                 // blood bank fridges
  wall(24, 50, 31, 51); wall(39, 50, 46, 51);                                                // front wall with the entrance
  B.ramp(48, 44, 60, 52, 0, 4.2, 'x', 'concrete'); B.open(60, 43, 68, 56, 4.2, 'concrete');   // stairs up to the roof
  B.block(60, 43, 68, 44, 5.2, 'concrete').block(67, 44, 68, 56, 5.2, 'concrete');
  B.roof(2, 2, 68, 30, 3.6, 'tile').roof(2, 31, 48, 50, 3.6, 'tile').roof(48, 31, 68, 42, 3.6, 'tile');
  B.zone('Chapel', 2, 2, 16, 25).zone('Nursery', 18, 2, 32, 25).zone('Oncology', 34, 2, 50, 25).zone('Records', 52, 2, 68, 25)
    .zone('Corridor', 2, 26, 68, 30).zone('Ward', 2, 31, 22, 50).zone('Lobby', 24, 31, 46, 50).zone('Blood Bank', 48, 31, 68, 42)
    .zone('Stairs', 48, 43, 60, 56).zone('Roof', 60, 44, 68, 56).zone('Ambulance Bay', 24, 51, 46, 56).zone('Lobby Entry', 33, 31.5, 37, 33).zone('Lobby Doors', 32, 43, 38, 46);
  B.site('A', 52, 2, 68, 25).site('B', 2, 31, 22, 50);
  B.buyzone('T', 2, 26, 8, 30).buyzone('CT', 28, 40, 42, 50);
  for (let k = 0; k < 5; k++) { B.spawn('CT', 29 + k * 3, 46, 0); B.spawn('T', 4 + k * 13, 28, 0); }
  B.spawn('T', 8, 12, 0).spawn('T', 60, 8, 0).spawn('T', 12, 45, 0).spawn('T', 58, 36, 0);
  B.duelSpawn('T', 10, 28, -Math.PI / 2).duelSpawn('CT', 60, 28, Math.PI / 2);
  B.sign(35, 55.95, 4.4, Math.PI, 'ST. MERCY HOSPITAL', 6, 1.2, '#ffffff', '#1a4a8a');
  B.sign(35, 50.95, 2.9, Math.PI, 'VISITING HOURS 9 - 5\n(not for hot dogs)', 3.4, 0.9, '#eeeeee', '#1a4a8a');
  B.sign(9.5, 25.95, 2.9, Math.PI, 'CHAPEL\nall faiths welcome', 3, 0.9, '#3a2a4a', '#f3e9b0');
  B.sign(24.5, 25.95, 2.9, Math.PI, 'NURSERY\nquiet please', 3, 0.9, '#f4d8e8', '#5a2a4a');
  B.sign(40.5, 25.95, 2.9, Math.PI, 'ONCOLOGY', 3, 0.7, '#e8f0f4', '#1a4a8a');
  B.sign(58.5, 25.95, 2.9, Math.PI, 'MEDICAL RECORDS\nstaff only', 3, 0.9, '#2a2a2a', '#fff');
  B.sign(54.5, 30.05, 2.9, 0, 'BLOOD DRIVE\nO NEGATIVE NEEDED', 3.4, 0.9, '#b01818', '#fff');
  B.prop('lamp', 26, 54, {}).prop('lamp', 44, 54, {}).prop('tv', 36, 34, {}).prop('palm', 25, 33, {}).prop('palm', 45, 33, {}).prop('barrel', 66, 54, {});
  B.sky = 0x8ab0d8; B.fog = 0xd8e0e8; B.sunColor = 0xfff8f0; B.amb = [0xe8f0ff, 0x8a8a90]; B.sunDir = [0.4, 0.8, 0.3]; B.sunI = 2.0; B.ambI = 1.35;
  return B;
}

// ---- Ballin' Arena: the finale --------------------------------------------------------------------------------------
function stadium() {
  const B = new MapBuilder(90, 72, 9, 'concrete', 'concrete');
  B.open(2, 2, 88, 70, 0, 'concrete');                                                      // the concourse ring
  B.open(30, 22, 60, 48, 0, 'wood');                                                        // the court
  B.ramp(30, 12, 60, 22, 0, 3.2, '-z', 'cred').ramp(30, 48, 60, 58, 0, 3.2, 'z', 'cred');   // bleachers, rising away from the court
  B.ramp(18, 22, 30, 48, 0, 3.2, '-x', 'cblue').ramp(60, 22, 72, 48, 0, 3.2, 'x', 'cblue');
  B.block(30, 11, 60, 12, 4.6, 'concrete').block(30, 58, 60, 59, 4.6, 'concrete').block(17, 22, 18, 48, 4.6, 'concrete').block(72, 22, 73, 48, 4.6, 'concrete');   // backs of the stands
  B.block(31, 34, 32, 36, 3.4, 'metal').block(58, 34, 59, 36, 3.4, 'metal');                // the hoops
  B.block(42, 33, 48, 37, 0.9, 'yellow');                                                   // the pot's stand at centre court
  B.house(38, 2, 52, 9, 4.2, 'metal', 'metal', [[43, 8, 47, 9]]); B.roof(38, 2, 52, 9, 4.2, 'metal').roof(43, 8, 47, 9, 3.0, 'metal');   // the blast tank
  B.block(8, 8, 12, 12, 1.1, 'crate').block(78, 8, 82, 12, 1.1, 'crate').block(8, 60, 12, 64, 1.1, 'crate').block(78, 60, 82, 64, 1.1, 'crate');
  B.block(20, 4, 26, 6, 1.2, 'corange').block(64, 4, 70, 6, 1.2, 'corange').block(20, 66, 26, 68, 1.2, 'corange').block(64, 66, 70, 68, 1.2, 'corange');   // concession stands
  B.zone('Court', 30, 22, 60, 48).zone('Concourse', 2, 2, 88, 70).zone('North Stands', 30, 12, 60, 22).zone('South Stands', 30, 48, 60, 58)
    .zone('West Stands', 18, 22, 30, 48).zone('East Stands', 60, 22, 72, 48).zone('Blast Tank', 38, 2, 52, 10).zone('Tunnel', 38, 62, 52, 70);
  B.site('A', 38, 2, 52, 10).site('B', 30, 22, 60, 48);
  B.buyzone('T', 2, 2, 10, 10).buyzone('CT', 38, 62, 52, 70);
  for (let k = 0; k < 5; k++) { B.spawn('CT', 40 + k * 2.5, 66, 0); B.spawn('T', 6 + k * 18, 3, Math.PI); }
  B.spawn('T', 4, 36, -Math.PI / 2).spawn('T', 86, 36, Math.PI / 2).spawn('T', 10, 66, 0).spawn('T', 80, 66, 0);
  B.duelSpawn('T', 45, 26, Math.PI).duelSpawn('CT', 45, 44, 0);
  B.sign(45, 70 - 0.05, 5.5, Math.PI, 'BALLIN\' ARENA\ntonight: SOLD OUT', 8, 2, '#1a1a2a', '#ffd23a');
  B.sign(45, 11.95, 6.0, Math.PI, 'HOME OF THE BROTHERHOOD\nno outside chili', 8, 1.6, '#c8a020', '#1a1a1a');
  B.sign(45, 9.05, 3.2, 0, 'BLAST TANK\nauthorised personnel only', 4, 1, '#b01818', '#fff');
  B.prop('lamp', 6, 30, {}).prop('lamp', 84, 30, {}).prop('lamp', 6, 44, {}).prop('lamp', 84, 44, {}).prop('tv', 45, 60, {});
  B.sky = 0x241a3a; B.fog = 0x3a2a4a; B.sunColor = 0xffc890; B.amb = [0x8a70b0, 0x302030]; B.sunDir = [-0.5, 0.45, 0.4]; B.sunI = 1.8; B.ambI = 1.0;   // dusk
  return B;
}

// ---- 14 Mustard Street: the house Frank Wiener grew up in (a memory: warm light, too quiet) -----------------------------
function wienerHouse() {
  const B = new MapBuilder(42, 40, 5, 'brick', 'grass');
  B.open(2, 2, 40, 38, 0, 'grass');
  B.house(4, 10, 30, 28, 3.0, 'plaster', 'wood', [[29, 18, 30, 21], [8, 10, 10, 11]]);   // front door (east) onto the porch, back door (north) to the yard
  const wall = (x0, z0, x1, z1) => B.block(x0, z0, x1, z1, 3.0, 'plaster');
  wall(4, 18, 8, 19); wall(10, 18, 18, 19); wall(20, 18, 30, 19);                       // kitchen and living room / hallway (doors at x 8-10 and 18-20)
  wall(13, 10, 14, 18);                                                                 // kitchen | living room
  wall(4, 21, 8, 22); wall(10, 21, 16, 22); wall(18, 21, 24, 22); wall(26, 21, 30, 22); // hallway / bedrooms (doors 8-10, 16-18, 24-26)
  wall(13, 22, 14, 28); wall(21, 22, 22, 28);
  B.block(6, 13, 10, 15, 0.8, 'darkwood');                                              // the kitchen table, bottles on it
  B.block(10, 11, 13, 12, 0.95, 'trim').block(5, 11, 8, 12, 0.95, 'trim');             // counters (the knife block on the right one)
  B.block(16, 11, 21, 13, 0.6, 'carpet').block(26, 11, 29, 12, 1.0, 'darkwood');        // the couch, a cabinet
  B.block(5, 25, 8, 27, 0.55, 'cblue').block(10, 26, 12, 27, 0.4, 'crate');              // Danny's bed, his toy box
  B.block(15, 25, 20, 27, 0.6, 'cred');                                                 // their parents' bed
  B.block(27, 18, 28, 18.5, 1.8, 'cred');                                               // her coat on the hook
  B.roof(4, 10, 30, 28, 3.0, 'roof').roof(29, 18, 30, 21, 2.3, 'plaster').roof(8, 10, 10, 11, 2.3, 'plaster');
  B.open(30, 15, 38, 24, 0.25, 'wood');                                                 // the porch
  B.block(11, 4, 13, 5, 0.25, 'rock');                                                  // her grave, in the yard
  B.zone('Kitchen', 4, 10, 13, 18).zone('Living Room', 14, 10, 30, 18).zone('Hallway', 4, 19, 30, 21).zone('Danny\'s Room', 4, 22, 13, 28).zone('Master Bedroom', 14, 22, 21, 28)
    .zone('Bathroom', 22, 22, 30, 28).zone('Porch', 30, 15, 38, 24).zone('Grave', 8, 3, 16, 8).zone('Yard', 2, 2, 40, 9).zone('Coat Hooks', 25, 19, 29, 21).zone('Knife Block', 10, 12, 13, 13)
    .zone('Danny\'s Door', 8, 20, 10, 22).zone('Shadow Wall', 10, 19, 13, 21).zone('Grave Side', 14, 5, 15.5, 6.5).zone('Danny Doorway', 8.3, 22.4, 9.7, 23.2);
  B.mark('Shadow Wall', 11.5, 1.5, 21.95, Math.PI).mark('Kitchen Wall', 4.05, 1.6, 14, Math.PI / 2).mark('Grave', 12, 0.8, 5.2, 0);
  B.site('A', 4, 22, 13, 28).site('B', 14, 10, 30, 18);
  B.buyzone('T', 14, 22, 21, 28).buyzone('CT', 14, 10, 30, 18);
  for (let k = 0; k < 4; k++) { B.spawn('CT', 18 + k * 2, 15, Math.PI / 2); B.spawn('T', 16 + k, 24, 0); }
  B.duelSpawn('T', 17, 24, 0).duelSpawn('CT', 20, 15, Math.PI);
  B.sign(12, 5.05, 0.8, 0, 'MARGARET WIENER\n1961 - 1997\nloved her boys', 1.4, 0.8, '#8c8c88', '#262626');
  B.sign(4.05, 15, 2.0, Math.PI / 2, 'FRANKIE + DANNY\n(height chart)', 1.6, 0.8, '#efe6d0', '#5a3a2a');
  B.sign(29.95, 14, 2.2, -Math.PI / 2, '14 MUSTARD ST', 1.8, 0.5, '#2a2a2a', '#e8c070');
  B.prop('tv', 24, 13, {}).prop('lamp', 34, 20, {}).prop('tree', 36, 6, {}).prop('tree', 3, 34, {}).prop('barrel', 18, 6, {});
  B.sky = 0x1c1626; B.fog = 0x2a2030; B.sunColor = 0xffb070; B.amb = [0xffb878, 0x3a2418]; B.sunDir = [0.5, 0.5, 0.3]; B.sunI = 1.2; B.ambI = 1.15; B.fogNear = 20; B.fogFar = 90;
  return B;
}

// ---- Big Lou's place: Ricky picked the wrong house -----------------------------------------------------------------
function mansion() {
  const B = new MapBuilder(72, 58, 6, 'brick', 'grass');
  B.open(2, 2, 70, 56, 0, 'grass');
  B.open(2, 46, 70, 56, 0, 'asphalt');                                                   // the street
  B.house(10, 4, 62, 32, 4.0, 'plaster', 'tile', [[16, 4, 19, 5, 1.0], [52, 31, 58, 32]]); // a window round the back (Ricky's way in), the garage door out front
  const wall = (x0, z0, x1, z1) => B.block(x0, z0, x1, z1, 4.0, 'plaster');
  wall(10, 16, 16, 17); wall(19, 16, 26, 17);                                           // study | gallery (door 16-19)
  wall(26, 4, 27, 22); wall(26, 25, 27, 32);                                            // gallery | foyer & ballroom (door z 22-25)
  wall(27, 20, 33, 21); wall(36, 20, 46, 21);                                           // ballroom | foyer (door x 33-36)
  wall(46, 4, 47, 8); wall(46, 11, 47, 32);                                             // ballroom | kitchen & garage (door z 8-11)
  wall(47, 16, 51, 17); wall(54, 16, 62, 17);                                           // kitchen | garage (door x 51-54)
  B.block(12, 7, 16, 9, 0.8, 'darkwood').block(20, 6, 24, 8, 1.1, 'darkwood');           // study desk, bookcase
  B.block(14, 22, 18, 23, 1.2, 'metal');                                                // the display case
  B.block(31, 8, 34, 11, 0.8, 'darkwood').block(38, 8, 41, 11, 0.8, 'darkwood').block(31, 14, 34, 17, 0.8, 'darkwood').block(38, 14, 41, 17, 0.8, 'darkwood');   // ballroom tables
  B.block(50, 8, 58, 10, 0.95, 'trim').block(56, 12, 61, 14, 0.95, 'trim');              // kitchen island, counter
  B.block(49, 19, 53, 25, 1.4, 'cblue').block(56, 19, 60, 25, 1.4, 'cred');              // two of the seven cars
  B.block(30, 36, 40, 38, 1.0, 'green').block(48, 36, 58, 38, 1.0, 'green').block(14, 38, 24, 40, 1.0, 'green');   // garden hedges
  B.block(2, 44, 30, 45, 2.2, 'brick').block(40, 44, 70, 45, 2.2, 'brick');              // the wall along the street, gate at 30-40
  B.roof(10, 4, 62, 32, 4.0, 'roof').roof(52, 31, 58, 32, 3.0, 'plaster').roof(16, 4, 19, 5, 3.2, 'plaster');
  B.zone('Study', 10, 4, 26, 16).zone('Gallery', 10, 17, 26, 32).zone('Display Case', 13, 21, 19, 25).zone('Foyer', 27, 21, 46, 32).zone('Ballroom', 27, 4, 46, 20)
    .zone('Kitchen', 47, 4, 62, 16).zone('Garage', 47, 17, 62, 32).zone('Garden', 2, 32, 70, 44).zone('Front Gate', 30, 42, 40, 47).zone('Street', 2, 46, 70, 56).zone('Street End', 2, 47, 10, 55);
  B.site('A', 27, 4, 46, 20).site('B', 47, 17, 62, 32);
  B.buyzone('T', 47, 4, 62, 16).buyzone('CT', 10, 4, 26, 16);
  for (let k = 0; k < 4; k++) { B.spawn('CT', 13 + k * 2, 12, Math.PI); B.spawn('T', 34 + k * 3, 26, 0); }
  B.spawn('T', 55, 6, 0).spawn('T', 54, 28, 0).spawn('T', 60, 40, 0);
  B.duelSpawn('T', 40, 12, Math.PI / 2).duelSpawn('CT', 14, 10, -Math.PI / 2);
  B.sign(36.5, 32.05, 3.4, 0, 'THE MARRONE RESIDENCE\nno solicitors (seriously)', 5, 1.2, '#1c1c20', '#d8b060');
  B.sign(16, 21.95, 2.4, Math.PI, 'NOT FOR SALE', 2.4, 0.6, '#1c1c20', '#d8b060');
  B.prop('lamp', 30, 46, {}).prop('lamp', 40, 46, {}).prop('lamp', 10, 50, {}).prop('lamp', 60, 50, {}).prop('tree', 6, 36, {}).prop('tree', 66, 38, {}).prop('palm', 26, 34, {}).prop('palm', 44, 34, {}).prop('tv', 36, 28, {});
  B.sky = 0x0a0e1e; B.fog = 0x10142a; B.sunColor = 0x9aaeff; B.amb = [0x46507a, 0x16121a]; B.sunDir = [0.4, 0.7, 0.3]; B.sunI = 1.1; B.ambI = 1.0; B.fogNear = 30; B.fogFar = 150;
  return B;
}

// ---- the outpost in the blizzard (Igor, twelve winters ago) ---------------------------------------------------------
function outpost() {
  const B = new MapBuilder(92, 82, 6, 'rock', 'snow');
  B.open(2, 2, 90, 80, 0, 'snow');
  B.ramp(36, 2, 56, 10, 1.6, 0.4, 'z', 'snow');                                          // the ridge Igor starts on
  for (const [x, z, w, d] of [[22, 14, 4, 3], [76, 30, 3, 5], [40, 30, 5, 3], [10, 48, 4, 4], [70, 70, 5, 3], [30, 60, 3, 4], [84, 12, 3, 3]]) B.block(x, z, x + w, z + d, 1.6, 'rock');   // boulders
  B.house(62, 10, 72, 20, 3.0, 'darkwood', 'wood', [[62, 14, 63, 16]]); B.roof(62, 10, 72, 20, 3.0, 'roof').roof(62, 14, 63, 16, 2.2, 'darkwood');   // the eastern post
  B.house(20, 32, 32, 42, 3.0, 'metal', 'concrete', [[25, 41, 28, 42]]); B.roof(20, 32, 32, 42, 3.0, 'metal').roof(25, 41, 28, 42, 2.2, 'metal');     // the radio station
  B.block(33, 34, 34, 35, 9, 'metal');                                                   // the mast
  B.house(52, 54, 66, 64, 2.8, 'concrete', 'concrete', [[52, 58, 53, 61], [58, 63, 61, 64]]); B.roof(52, 54, 66, 64, 2.8, 'concrete').roof(52, 58, 53, 61, 2.2, 'concrete').roof(58, 63, 61, 64, 2.2, 'concrete');   // the bunker
  B.block(64, 21, 67, 23, 1.1, 'crate').block(18, 43, 21, 45, 1.1, 'crate').block(48, 58, 51, 60, 1.2, 'cgreen');   // supply crates, a truck
  B.zone('Ridge', 36, 2, 56, 10).zone('Eastern Post', 62, 10, 72, 20).zone('Radio Station', 20, 32, 32, 42).zone('Command Bunker', 52, 54, 66, 64).zone('Treeline', 2, 66, 16, 80)
    .zone('Valley', 20, 12, 60, 50).zone('Road', 40, 60, 52, 80);
  B.site('A', 62, 10, 72, 20).site('B', 52, 54, 66, 64);
  B.buyzone('T', 70, 70, 88, 80).buyzone('CT', 38, 2, 54, 8);
  for (let k = 0; k < 4; k++) { B.spawn('CT', 42 + k * 2, 5, Math.PI); B.spawn('T', 74 + k * 3, 74, 0); }
  B.spawn('T', 8, 30, 0).spawn('T', 86, 44, 0).spawn('T', 44, 78, 0);
  B.duelSpawn('T', 46, 40, 0).duelSpawn('CT', 46, 8, Math.PI);
  for (const [x, z] of [[4, 68], [8, 72], [12, 76], [5, 76], [14, 68], [10, 70], [86, 60], [80, 64], [88, 70], [18, 22], [70, 40], [36, 70]]) B.prop('tree', x, z, {});
  B.sign(66.95, 15, 2.2, Math.PI / 2, 'POST 7', 1.4, 0.5, '#3a3a2a', '#e8e8e0');
  B.sky = 0xc8ccd4; B.fog = 0xdfe4ea; B.sunColor = 0xe8eef8; B.amb = [0xd8e0ec, 0x8a90a0]; B.sunDir = [0.2, 0.8, 0.3]; B.sunI = 1.3; B.ambI = 1.45; B.fogNear = 6; B.fogFar = 62;
  return B;
}

export const MAPS = {
  dust: { id: 'dust', name: 'Dust Two: Abbottabad', short: 'Abbottabad', parody: 'the classic desert bomb map', build: dust, modes: ['1v1', '2v2', '3v3', '5v5'] },
  nuke: { id: 'nuke', name: 'Nuke Town 2069', short: 'Nuke Town', parody: 'the little nuclear test town', build: nuke, modes: ['1v1', '2v2', '3v3', '5v5'] },
  ship: { id: 'ship', name: 'Shitment', short: 'Shitment', parody: 'the tiny container yard', build: ship, modes: ['1v1', '2v2', '3v3', '5v5'] },
  town: { id: 'town', name: 'Burnt Town', short: 'Burnt Town', parody: 'the zombie crossroads town', build: town, modes: ['1v1', '2v2', '3v3', '5v5'] },
  crust: { id: 'crust', name: 'Crust', short: 'Crust', parody: 'the tiny desert oil yard', build: crust, modes: ['1v1', '2v2', '3v3', '5v5'] },
  yacht: { id: 'yacht', name: 'Hijacked: Yacht Rock', short: 'Yacht Rock', parody: 'the hijacked superyacht', build: yacht, modes: ['1v1', '2v2', '3v3', '5v5'] },
  range: { id: 'range', name: 'Shooting Strange', short: 'Shooting Strange', parody: 'the army firing range', build: range, modes: ['1v1', '2v2', '3v3', '5v5'] },
  // story mode only (never in the map list, lobbies or bots matches)
  barracks: { id: 'barracks', name: 'Fort Brisket', short: 'Fort Brisket', parody: 'story mode', build: () => barracks(false), modes: [], story: true },
  barracks_night: { id: 'barracks_night', name: 'Fort Brisket (night)', short: 'Fort Brisket', parody: 'story mode', build: () => barracks(true), modes: [], story: true },
  hospital: { id: 'hospital', name: 'St. Mercy Hospital', short: 'St. Mercy', parody: 'story mode', build: hospital, modes: [], story: true },
  stadium: { id: 'stadium', name: 'Ballin\' Arena', short: 'Ballin\' Arena', parody: 'story mode', build: stadium, modes: [], story: true },
  wiener_house: { id: 'wiener_house', name: '14 Mustard Street', short: 'Mustard Street', parody: 'story mode', build: wienerHouse, modes: [], story: true },
  mansion: { id: 'mansion', name: 'The Marrone Residence', short: 'Big Lou\'s', parody: 'story mode', build: mansion, modes: [], story: true },
  outpost: { id: 'outpost', name: 'Post 7', short: 'Post 7', parody: 'story mode', build: outpost, modes: [], story: true },
};
