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

export const MAPS = {
  dust: { id: 'dust', name: 'Dust Two: Abbottabad', short: 'Abbottabad', parody: 'the classic desert bomb map', build: dust, modes: ['1v1', '2v2', '3v3', '5v5'] },
  nuke: { id: 'nuke', name: 'Nuke Town 2069', short: 'Nuke Town', parody: 'the little nuclear test town', build: nuke, modes: ['1v1', '2v2', '3v3', '5v5'] },
  ship: { id: 'ship', name: 'Shitment', short: 'Shitment', parody: 'the tiny container yard', build: ship, modes: ['1v1', '2v2', '3v3', '5v5'] },
  town: { id: 'town', name: 'Burnt Town', short: 'Burnt Town', parody: 'the zombie crossroads town', build: town, modes: ['1v1', '2v2', '3v3', '5v5'] },
};
