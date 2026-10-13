// KYS:GO (tactical kit): menus, then a match. The host's browser runs the Match + Bots (solo play is a host
// with no peers); everyone simulates their own movement and shooting locally and the host settles damage, money,
// rounds and the bomb, then sends 20 snapshots a second. Rendering is one merged mesh per material plus simple
// box-built players, so it holds 60 fps on weak integrated graphics.
import * as THREE from '../sdk/three.module.min.js';
import { WEAPONS, W_BY_ID, G_BY_ID, MODES, PHYS, BOMB, U, slotOf, itemName, forTeam, RANKS, rankOf, RANKED_BOTS, PLACEMENTS, BOT_LEVELS } from './data.js';
import { buildWorld, LIGHT } from './world.js';
import { GraphicsSettingsManager, DynamicShadows, markCaster } from './graphics.js';
import { PVSCuller, decodePVS, mapHash } from './pvs.js';
import { PVS_DATA } from './pvs_data.js';
import { MAPS } from './maps.js';
import { mobileControls } from './mobile.js';
import { gamepadControls } from './gamepad.js';
import { Match, moveStep, traceShot, eyeHeight, eyePos, leanOff, LEAN, spreadOf, recoilAt, nadeStep, speedOf, aimDir } from './sim.js';
import { Bots, botNames } from './bots.js';
import { StoryMatch } from './story_sim.js';
import { storyClient } from './story_client.js';
import { makeMusic } from './music.js';
import { MISSIONS, CHAPTERS, CHARACTERS, SQUAD, BOSS, STORY_LOOKS } from './story.js';
// the boss in a match: a giant in a basketball jersey and a gold cap
const BOSS_LOOK = { body: BOSS.model.jersey, legs: BOSS.model.trim, head: '#a8805e', hat: 'cap', hatColor: BOSS.model.trim };
import { Profile } from './backend.js';
import { Menu, Hud, injectCss, esc, weaponIcon } from './ui.js';
import { releaseThumbs } from './thumbs.js';
import { line, sfxFor, hasLine } from './voices.js';
import { Particles, textPop, skyDome, funnyKey, inspectStyle, INSPECT_SOUND, applyInspect, KILL_FX } from './fx.js';
import { itemInfo, AGENT_BY_ID, AGENTS, ITEM_BY_ID, EMOTE_BY_ID, skinSound, isMythic } from './skins.js';
import { ATTACH, XP_RULES, gunLevel, unlocksAt } from './guns.js';
import { loadChars, charsReady, makeSoldier, poseSoldier, soldierEvent, setGear } from './chars.js';
import { setTpGun, makePlayer, posePlayer, makeGun, makeFingerGun, makeKnife, makeGrenade, makeBomb, makeProp, skinTexture, lam, basic, setModelQuality, animateGlow, flareGlow } from './models.js';

const SET_KEY = 'cs:settings:v1';
// story mode: Ricky's sidearm, a full-auto Glock with a drum mag (story_sim.js hands it out with sw: true)
const GLOCK_SW = { ...W_BY_ID.glock, name: 'Glock-18C "Switch"', auto: true, rpm: 1100, mag: 50, reserve: 150, burst: false };
export const STORY_KEY = 'cs:story:v1';
export const storyProgress = () => { try { return Object.assign({ unlocked: 0, best: {}, chars: {} }, JSON.parse(localStorage.getItem(STORY_KEY) || '{}')); } catch (e) { return { unlocked: 0, best: {}, chars: {} }; } };
const saveStory = (s) => { try { localStorage.setItem(STORY_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } };
// sun, sky light, fog and sky for a map (shared by the match and the menu's map pictures)
function dressScene(sc, B, shadows, clouds = true, skySize = 2048) {
  for (const l of sc.children.filter((c) => c.isLight)) sc.remove(l);
  const dir = B.sunDir || [0.6, 0.7, 0.4], L = Math.hypot(...dir), d = dir.map((v) => v / L), fog = B.fog || 0xaaaaaa;
  sc.background = new THREE.Color(fog); sc.fog = new THREE.Fog(fog, B.fogNear || 70, B.fogFar || 260);
  sc.add(new THREE.HemisphereLight((B.amb || [])[0] || 0xffffff, (B.amb || [])[1] || 0x555555, B.ambI || 1.1));
  const sun = new THREE.DirectionalLight(B.sunColor || 0xffffff, B.sunI || 2.4); sun.position.set(d[0] * 90, d[1] * 90, d[2] * 90); sc.add(sun);
  if (shadows) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const c = sun.shadow.camera; c.left = c.bottom = -24; c.right = c.top = 24; c.near = 1; c.far = 220; sun.shadow.bias = -0.0008; sc.add(sun.target); }
  const sky = skyDome(sc, fog, B.sky || 0x6f9fd8, d, B.sunColor || 0xffffff, clouds, B.photo ? { name: B.photo, size: skySize, tint: B.photoTint } : null);
  return { sun, sky, dir: d };
}
const DEF_SET = { voicePack: 'classic', crouchKey: 'ctrl', voice: 1, sens: 1.6, fov: 90, vol: 0.6, xSize: 5, xGap: 0, xThick: 2, xOutline: 0.6, xColor: '#55ff55', xDyn: 0, xDot: 0, quality: 0, fps: 0, hand: 1, recoilHelp: 0, touchSens: 1, bright: 1 };
const loadSet = () => { try { return Object.assign({}, DEF_SET, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { return { ...DEF_SET }; } };
const saveSet = (s) => { try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } };
// which sound a shot makes: a joke skin's own sound, else the gun's (knives: hit or miss)
const shotSound = (wid, skin, hit) => {
  if (wid === 'knife') return skinSound(skin, hit ? 'hit' : 'miss') || (hit ? 'stab' : 'knife');
  return skinSound(skin, 'fire') || wid;
};
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// ---- positional synth sound (no audio files: every sound is generated, so nothing is copied) -------------------------
// Each gun has its own recipe (crack, body, low thump, length, tail) so they're told apart by ear the way you learn
// guns in the classic game; distance muffles and adds an echo tail. Joke skins swap in their own sounds.
const GUN_SND = {  // [crack Hz, body Hz, thump Hz, length s, loudness, tail]
  glock: [3600, 1900, 180, 0.12, 0.7, 0.2], usp: [0, 900, 120, 0.09, 0.35, 0.05], p2000: [3300, 1700, 170, 0.13, 0.75, 0.2], dualies: [3500, 1800, 170, 0.12, 0.75, 0.2],
  p250: [3200, 1600, 160, 0.14, 0.8, 0.22], tec9: [3800, 2000, 190, 0.11, 0.75, 0.2], fiveseven: [4200, 2300, 200, 0.12, 0.75, 0.22], cz75: [3700, 1900, 180, 0.11, 0.7, 0.2],
  deagle: [2600, 900, 90, 0.32, 1.25, 0.6], r8: [2400, 850, 80, 0.36, 1.3, 0.65],
  mac10: [4000, 2100, 160, 0.08, 0.7, 0.15], mp9: [4300, 2300, 170, 0.08, 0.7, 0.15], mp7: [3900, 2000, 150, 0.09, 0.75, 0.18], mp5: [0, 1100, 120, 0.08, 0.4, 0.06],
  ump: [3000, 1400, 120, 0.12, 0.85, 0.22], p90: [4500, 2500, 180, 0.07, 0.7, 0.14], bizon: [3800, 1800, 150, 0.09, 0.7, 0.16],
  nova: [2000, 700, 70, 0.4, 1.3, 0.6], xm1014: [2200, 800, 80, 0.32, 1.2, 0.5], sawedoff: [1800, 650, 65, 0.42, 1.35, 0.6], mag7: [2100, 750, 70, 0.38, 1.3, 0.55],
  m249: [2600, 1100, 90, 0.16, 1.05, 0.35], negev: [2800, 1200, 100, 0.13, 1.0, 0.3],
  galil: [2900, 1300, 110, 0.15, 0.95, 0.35], famas: [3100, 1400, 120, 0.14, 0.9, 0.32], ak47: [2500, 1000, 85, 0.2, 1.15, 0.45], m4a4: [3200, 1500, 110, 0.15, 1.0, 0.38],
  m4a1s: [0, 1000, 110, 0.1, 0.45, 0.08], sg553: [2800, 1200, 100, 0.17, 1.05, 0.4], aug: [3000, 1300, 105, 0.16, 1.0, 0.38],
  ssg08: [3400, 1500, 90, 0.3, 1.1, 0.7], awp: [2200, 700, 55, 0.55, 1.5, 1.1], g3sg1: [2600, 1000, 80, 0.26, 1.15, 0.6], scar20: [2700, 1050, 85, 0.25, 1.15, 0.6],
  zeus: null, knife: null,
};
const STEP_SND = { metal: [1800, 0.07, 'clank'], cred: [1500, 0.06, 'clank'], cblue: [1500, 0.06, 'clank'], cgreen: [1500, 0.06, 'clank'], corange: [1500, 0.06, 'clank'], bus: [1600, 0.06, 'clank'],
  wood: [600, 0.06, 'knock'], crate: [650, 0.06, 'knock'], darkwood: [550, 0.06, 'knock'], fence: [700, 0.05, 'knock'], roof: [600, 0.05, 'knock'],
  sand: [900, 0.07, 'soft'], dirt: [700, 0.07, 'soft'], grass: [800, 0.08, 'soft'], carpet: [500, 0.05, 'soft'] };
function makeAudio(getVol) {
  let ctx = null, master = null, verb = null, mlp = null;
  const ensure = () => {
    if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); master = ctx.createGain(); mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 20000; master.connect(mlp); mlp.connect(ctx.destination);   // mlp: the world goes muffled (dying, memories)
      // a cheap echo for far shots: a feedback delay through a lowpass
      verb = ctx.createDelay(1); verb.delayTime.value = 0.13; const fb = ctx.createGain(); fb.gain.value = 0.35; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      verb.connect(lp); lp.connect(fb); fb.connect(verb); lp.connect(master); }
    if (ctx.state === 'suspended') ctx.resume(); master.gain.value = getVol(); return ctx; };
  addEventListener('pointerdown', ensure); addEventListener('keydown', ensure);
  let noiseBuf = null;
  const noise = () => { if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s; };
  let far = 0;  // 0 near .. 1 far (set by at())
  const out = (pan, wet = 0) => { const g = ctx.createGain(); let n = g; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 - far * 15000; g.connect(lp);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; lp.connect(p); p.connect(master); if (wet) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w); w.connect(verb); } } else lp.connect(master);
    return n; };
  const burst = (dur, freq, vol, pan, q = 0.7, type = 'lowpass', delay = 0, wet = 0) => { const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + delay; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(out(pan, wet)); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.05); };
  const tone = (type, f0, f1, dur, vol, pan, delay = 0, wet = 0, vib = 0) => { const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib; lg.gain.setValueAtTime(f0 * 0.35, t); lg.gain.exponentialRampToValueAtTime(1, t + dur); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(out(pan, wet)); o.start(t); o.stop(t + dur + 0.05); };
  const gun = (r, v, p) => { const [crack, body, thump, len, loud, tail] = r, V = v * loud;
    if (crack) burst(0.025, crack, V * 0.9, p, 0.8, 'highpass');
    burst(len, body, V, p, 0.9, 'lowpass', 0, tail * (0.3 + far));
    tone('sine', thump * 2.2, thump, len * 0.9, V * 0.55, p);
    if (tail > 0.3) burst(tail, body * 0.6, V * 0.25 * (0.4 + far), p, 0.5, 'lowpass', len * 0.6, 0.4); };
  // a vowel from a buzzing source through moving formant filters: cheap speech-like noises with no audio files
  const vox = (delay, dur, f0a, f0b, fm, vol, pan) => {
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(), dst = out(pan);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0a, t); o.frequency.exponentialRampToValueAtTime(f0b, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    fm.forEach(([a, b], i) => { const f = ctx.createBiquadFilter(), fg = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 9; f.frequency.setValueAtTime(a, t); f.frequency.exponentialRampToValueAtTime(b, t + dur * 0.8); fg.gain.value = [1, 0.7, 0.35][i] || 0.3; o.connect(f); f.connect(fg); fg.connect(g); });
    g.connect(dst); o.start(t); o.stop(t + dur + 0.05);
  };
  const wub = (v, p) => {   // a dubstep wobble: a low saw through a lowpass swept by an LFO
    const t = ctx.currentTime, o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    o.type = o2.type = 'sawtooth'; o.frequency.value = 55; o2.frequency.value = 55.6; f.type = 'lowpass'; f.Q.value = 12; f.frequency.value = 500; l.frequency.value = 6; lg.gain.value = 420;
    l.connect(lg); lg.connect(f.frequency); o.connect(f); o2.connect(f); f.connect(g); g.gain.setValueAtTime(v * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1); g.connect(out(p));
    [o, o2, l].forEach((x) => { x.start(t); x.stop(t + 1.15); });
  };
  const SND = {
    // story sounds
    glass: (v, p) => { burst(0.25, 5200, v * 0.5, p, 2, 'highpass'); for (let k = 0; k < 5; k++) tone('triangle', 2400 + k * 700, 1800 + k * 600, 0.12, v * 0.08, p, k * 0.03); },
    punch: (v, p) => { burst(0.12, 300, v * 0.9, p, 0.8); tone('sine', 110, 50, 0.16, v * 0.6, p); },
    heartbeat: (v) => { tone('sine', 70, 40, 0.18, v * 0.7, 0); tone('sine', 66, 38, 0.16, v * 0.5, 0, 0.26); },
    pickup: (v, p) => { tone('triangle', 660, 990, 0.09, v * 0.25, p); tone('triangle', 990, 1320, 0.1, v * 0.2, p, 0.07); },
    heal: (v) => { for (let k = 0; k < 4; k++) tone('sine', 523 * Math.pow(1.26, k), 523 * Math.pow(1.26, k), 0.5, v * 0.12, 0, k * 0.07); burst(0.4, 3000, v * 0.12, 0, 0.6, 'bandpass'); },
    unlock: (v) => { for (let k = 0; k < 5; k++) tone('triangle', 392 * Math.pow(1.19, k), 392 * Math.pow(1.19, k), 0.4, v * 0.14, 0, k * 0.09); },
    wind: (v) => burst(1.6, 700, v * 0.25, 0, 0.5, 'bandpass'),
    step: (v, p, m) => { const [f, d, k] = STEP_SND[m] || [1100, 0.05, 'hard']; burst(d, f, v * (k === 'soft' ? 0.35 : 0.45), p, k === 'clank' ? 6 : 1.2, k === 'clank' ? 'bandpass' : 'lowpass'); if (k === 'clank') tone('triangle', f * 1.3, f, 0.08, v * 0.12, p); if (k === 'knock') tone('sine', 180, 120, 0.06, v * 0.25, p); },
    land: (v, p) => { burst(0.1, 500, v * 0.55, p); tone('sine', 120, 60, 0.1, v * 0.3, p); },
    knife: (v, p) => burst(0.13, 5200, v * 0.4, p, 2, 'highpass'), stab: (v, p) => { burst(0.08, 2400, v * 0.6, p, 1); tone('sine', 300, 120, 0.08, v * 0.3, p); },
    zeus: (v, p) => { tone('sawtooth', 1800, 200, 0.35, v * 0.35, p, 0, 0, 40); burst(0.3, 6000, v * 0.4, p, 1, 'highpass'); },
    pin: (v) => { tone('triangle', 2400, 3100, 0.04, v * 0.22, 0); burst(0.03, 5200, v * 0.25, 0, 3, 'highpass'); },   // the pin and spoon
    hit: (v) => { burst(0.05, 1800, v * 0.8, 0, 1.5, 'bandpass'); tone('sine', 240, 110, 0.07, v * 0.5, 0); tone('square', 1900, 1700, 0.025, v * 0.22, 0); },   // the body-hit thud with a clear tick on top
    head: (v) => { tone('square', 2600, 2400, 0.05, v * 0.25, 0); tone('sine', 4200, 3900, 0.14, v * 0.2, 0); burst(0.05, 3000, v * 0.3, 0, 3, 'bandpass'); },
    armor: (v) => { tone('triangle', 1500, 1200, 0.06, v * 0.25, 0); burst(0.04, 2500, v * 0.3, 0, 4, 'bandpass'); },
    hurt: (v) => { burst(0.12, 900, v * 0.6, 0); tone('sine', 160, 90, 0.12, v * 0.3, 0); },
    magout: (v, p) => { tone('square', 900, 700, 0.025, v * 0.18, p); burst(0.03, 2500, v * 0.25, p, 3, 'bandpass'); },
    magin: (v, p) => { tone('square', 700, 500, 0.03, v * 0.2, p); burst(0.04, 1800, v * 0.3, p, 3, 'bandpass', 0.03); },
    bolt: (v, p) => { burst(0.05, 3000, v * 0.3, p, 2, 'bandpass'); tone('square', 1200, 900, 0.02, v * 0.15, p, 0.06); burst(0.05, 2200, v * 0.3, p, 2, 'bandpass', 0.09); },
    shell: (v, p) => { burst(0.05, 1500, v * 0.3, p, 2, 'bandpass'); tone('triangle', 500, 400, 0.04, v * 0.2, p, 0.04); },
    empty: (v) => tone('square', 1800, 1800, 0.02, v * 0.2, 0), deploy: (v) => { burst(0.05, 2500, v * 0.2, 0, 2, 'bandpass'); tone('square', 500, 650, 0.03, v * 0.12, 0, 0.04); },
    beep: (v, p) => tone('square', 1900, 1900, 0.07, v * 0.25, p), planted: (v) => { for (let k = 0; k < 4; k++) tone('square', 1900, 1900, 0.05, v * 0.2, 0, k * 0.1); },
    plantbeep: (v) => tone('square', 1400, 1400, 0.04, v * 0.15, 0), defusing: (v) => burst(0.06, 2600, v * 0.25, 0, 3, 'bandpass'),
    defused: (v) => { tone('sine', 700, 1400, 0.4, v * 0.35, 0); }, explode: (v, p) => { burst(2.2, 380, v * 1.9, p, 0.5, 'lowpass', 0, 0.6); tone('sine', 65, 22, 1.6, v * 0.9, p); burst(0.3, 3000, v * 0.6, p, 0.5, 'highpass'); },
    he: (v, p) => { burst(1.1, 600, v * 1.5, p, 0.6, 'lowpass', 0, 0.5); tone('sine', 85, 28, 0.8, v * 0.7, p); burst(0.08, 4000, v * 0.5, p, 0.5, 'highpass'); },
    flash: (v, p) => { burst(0.2, 5000, v * 0.9, p, 1, 'highpass'); burst(0.25, 900, v * 0.7, p); }, ring: (v) => tone('sine', 3300, 3200, 3, v * 0.1, 0),
    smoke: (v, p) => burst(1.8, 800, v * 0.45, p, 0.4), fire: (v, p) => { burst(0.9, 1600, v * 0.55, p); burst(0.2, 3000, v * 0.4, p, 1, 'highpass'); }, bounce: (v, p) => { tone('square', 700, 500, 0.03, v * 0.25, p); burst(0.03, 2000, v * 0.2, p, 2, 'bandpass'); },
    buy: (v) => { tone('square', 700, 700, 0.04, v * 0.2, 0); tone('square', 1050, 1050, 0.05, v * 0.2, 0, 0.05); }, round: (v) => { tone('triangle', 440, 440, 0.12, v * 0.25, 0); tone('triangle', 660, 660, 0.18, v * 0.25, 0, 0.13); },
    win: (v) => [523, 659, 784, 1046].forEach((f, k) => tone('triangle', f, f, 0.22, v * 0.22, 0, k * 0.12)), lose: (v) => [392, 330, 262].forEach((f, k) => tone('triangle', f, f * 0.98, 0.25, v * 0.22, 0, k * 0.15)),
    tick: (v) => tone('square', 2400, 2400, 0.012, v * 0.15, 0), reveal: (v) => [660, 880].forEach((f, k) => tone('triangle', f, f, 0.2, v * 0.3, 0, k * 0.1)),
    rare: (v) => [523, 659, 784, 1046, 1318].forEach((f, k) => tone('triangle', f, f, 0.3, v * 0.35, 0, k * 0.09)), radio: (v) => { burst(0.08, 3000, v * 0.2, 0, 3, 'bandpass'); tone('square', 1200, 1200, 0.03, v * 0.15, 0); },
    // ---- the joke skins ----
    wetslap: (v, p) => { burst(0.11, 1100, v * 1.0, p, 1.8, 'bandpass'); tone('sine', 190, 55, 0.14, v * 0.7, p); burst(0.09, 700, v * 0.6, p, 1.4, 'bandpass', 0.04); burst(0.16, 2600, v * 0.35, p, 3, 'bandpass', 0.06); tone('sine', 420, 140, 0.09, v * 0.25, p, 0.05, 0, 40); burst(0.06, 4200, v * 0.2, p, 4, 'bandpass', 0.12); },
    doing: (v, p) => { tone('sine', 140, 300, 0.9, v * 0.55, p, 0, 0, 26); tone('triangle', 280, 600, 0.7, v * 0.18, p, 0.02, 0, 26); burst(0.07, 900, v * 0.35, p, 1.6, 'bandpass'); },
    squelch: (v, p) => { burst(0.13, 800 + Math.random() * 500, v * 0.7, p, 2.2, 'bandpass'); burst(0.1, 2600, v * 0.3, p, 3.5, 'bandpass', 0.05); tone('sine', 260, 90, 0.11, v * 0.3, p, 0.02, 0, 30); },
    pewpew: (v, p) => { const r = 0.92 + Math.random() * 0.16; burst(0.018, 900, v * 0.5, p, 1.2, 'bandpass'); vox(0.012, 0.2, 230 * r, 150 * r, [[320, 360], [2300, 850], [2900, 2400]], v * 0.9, p); },   // a guy going "pew!"
    airhorn: (v, p) => { [[0, 0.16], [0.21, 0.11], [0.36, 0.62]].forEach(([d, l]) => [466, 554, 698].forEach((f) => tone('sawtooth', f, f * 0.985, l, v * 0.16, p, d))); },
    hitmarker: (v) => { tone('square', 3200, 3000, 0.02, v * 0.25, 0); burst(0.03, 6000, v * 0.4, 0, 2, 'highpass'); },
    wow: (v, p) => vox(0, 0.62, 190, 130, [[750, 420], [1150, 800], [2600, 2500]], v * 0.8, p),
    wub: (v, p) => wub(v, p),
    fart: (v, p) => { const f = 70 + Math.random() * 50; tone('sawtooth', f * 1.3, f, 0.5, v * 0.45, p, 0, 0, 28); burst(0.45, 300, v * 0.35, p, 2, 'lowpass'); },
    squirt: (v, p) => { burst(0.35, 3200, v * 0.55, p, 1.5, 'bandpass'); burst(0.25, 5000, v * 0.3, p, 1, 'highpass', 0.05); },
    boing: (v, p) => tone('sine', 120, 380, 0.5, v * 0.5, p, 0, 0, 16),
    squeak: (v, p) => { tone('sawtooth', 900, 1700, 0.18, v * 0.3, p, 0, 0, 30); tone('sawtooth', 1700, 700, 0.25, v * 0.3, p, 0.17, 0, 30); },
    squish: (v, p) => { burst(0.15, 600, v * 0.7, p, 2, 'lowpass'); tone('sine', 220, 70, 0.15, v * 0.4, p); },
    fwoop: (v, p) => { tone('sine', 250, 950, 0.18, v * 0.5, p); burst(0.12, 1200, v * 0.4, p, 2, 'bandpass', 0.1); },
    crunch: (v, p) => { for (let k = 0; k < 4; k++) burst(0.03, 2500 + k * 300, v * 0.45, p, 2, 'bandpass', k * 0.03); },
    flop: (v, p) => { burst(0.12, 800, v * 0.8, p, 1.4, 'bandpass'); tone('sine', 130, 60, 0.12, v * 0.5, p); burst(0.08, 500, v * 0.4, p, 1, 'lowpass', 0.07); },
    whoosh: (v, p) => burst(0.2, 1800, v * 0.35, p, 1.5, 'bandpass'),
    ricochet: (v, p) => { tone('sine', 3400 + Math.random() * 800, 1400, 0.28, v * 0.16, p, 0, 0, 18); burst(0.04, 5000, v * 0.2, p, 2, 'highpass'); },
    shimmer: (v, p) => { [880, 1320, 1760, 2640, 1980].forEach((f, k) => tone('sine', f, f * 1.01, 0.9 - k * 0.1, v * 0.16, p, k * 0.07)); tone('sine', 110, 55, 1.2, v * 0.35, p); burst(0.6, 6000, v * 0.12, p, 1, 'highpass', 0.05); },
  };
  // the announcer and radio voice: the browser's own text-to-speech (works offline with system voices)
  // Each speaker keeps one English system voice (picked by name, so the squad sound different from each other and from
  // the announcer). A story line ('scene') cuts off whatever was playing; the announcer and radio only speak when no
  // scene line is talking, and queue behind each other instead of cutting each other off.
  let voices = [], sceneTalk = 0;
  const loadVoices = () => { try { const all = speechSynthesis.getVoices(); const en = all.filter((v) => /^en[-_]/i.test(v.lang) || /^en$/i.test(v.lang)); voices = en.length ? en : all; } catch (e) { voices = []; } };
  try { if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; setInterval(() => { try { if (speechSynthesis.speaking && speechSynthesis.paused) speechSynthesis.resume(); } catch (e) { /* gone */ } }, 4000); } } catch (e) { /* no speech */ }
  const voiceFor = (who) => { if (!voices.length) loadVoices(); if (!voices.length) return null; let h = 7; for (const c of String(who || 'announcer')) h = (h * 31 + c.charCodeAt(0)) >>> 0; const pref = voices.filter((v) => /Google|Microsoft|Daniel|Alex|Samantha|Fred|Arthur|Aaron|Karen/i.test(v.name)); const pool = pref.length >= 2 ? pref : voices; return pool[h % pool.length]; };
  // recorded voices (voicebuild.py: a neural voice per character): every scripted line has a real recording in vo/;
  // the browser's text-to-speech is only the fallback (players' typed radio chat, or before the index has loaded)
  let VO = null, voNode = null, voUntil = 0;
  const voBufs = new Map();
  try { fetch('vo/index.json').then((r) => (r.ok ? r.json() : null)).then((d) => { VO = d; }).catch(() => {}); } catch (e) { /* offline */ }
  const voGet = (id) => { if (!voBufs.has(id)) voBufs.set(id, fetch('vo/' + id + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? ctx.decodeAudioData(b) : null)).catch(() => null)); return voBufs.get(id); };
  const voSay = (text, o) => {
    const id = VO && VO[(o.who || 'announcer:classic') + '|' + text]; if (!id || !ensure()) return false;
    const scene = !!o.scene, now = performance.now();
    if (!scene && (now < voUntil || now < sceneTalk)) return true;   // someone is talking: the line is skipped (it was recorded, so never robot-voiced)
    if (scene) { try { if (voNode) voNode.stop(); } catch (e) { /* ended */ } try { speechSynthesis.cancel(); } catch (e) { /* none */ } }
    voUntil = now + 400 + text.length * 60;   // until the clip reports its real length
    voGet(id).then((buf) => {
      if (!buf) return;
      const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buf; g.gain.value = 1.25;   // master already carries the volume setting
      src.connect(g); g.connect(master); src.start(); voNode = src;
      voUntil = performance.now() + buf.duration * 1000 + 150; if (scene) sceneTalk = voUntil;
    });
    return true;
  };
  const say = (text, pitch = 0.75, rate = 1.05, o = {}) => { try {
    if (getVol() <= 0 || !text) return;
    if (voSay(text, o)) return;
    if (!window.speechSynthesis) return;
    const scene = !!o.scene; if (!scene && (performance.now() < sceneTalk || (speechSynthesis.speaking && o.noQueue))) return;
    const u = new SpeechSynthesisUtterance(text); u.volume = Math.min(1, getVol() * 1.3); u.pitch = pitch; u.rate = rate; const v = voiceFor(o.who); if (v) u.voice = v;
    if (scene) { speechSynthesis.cancel(); sceneTalk = performance.now() + 900 + text.length * 70; }
    speechSynthesis.speak(u);
  } catch (e) { /* no voices */ } };
  return {
    play(name, vol = 1, pan = 0, extra) { if (!ensure()) return; far = 0; try { if (GUN_SND[name]) gun(GUN_SND[name], vol, pan); else if (SND[name]) SND[name](vol, Math.max(-1, Math.min(1, pan)), extra); } catch (e) { /* audio busy */ } },
    at(name, x, y, z, cam, range = 60, extra) {  // positional: volume by distance, pan by angle, muffled when far
      if (!ensure()) return;
      const dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dy(y, cam), dz); if (d > range) return;
      const side = Math.sin(Math.atan2(-dx, -dz) - cam.rotation.y);
      far = Math.min(1, d / range);
      try { const v = Math.max(0.05, 1 - d / range) ** 1.3, p = Math.max(-1, Math.min(1, -side * 0.8)); if (GUN_SND[name]) gun(GUN_SND[name], v, p); else if (SND[name]) SND[name](v, p, extra); } catch (e) { /* audio busy */ }
      far = 0;
    },
    say,
    ctx: () => ensure(), bus: () => (ensure(), master),
    muffle(k) { if (!ensure()) return; mlp.frequency.setTargetAtTime(20000 * Math.pow(0.012, Math.max(0, Math.min(1, k))), ctx.currentTime, 0.35); },   // 0 clear .. 1 underwater
    selfTest() { if (!ensure()) return ['no audio']; const bad = []; for (const [k, f] of Object.entries(SND)) { try { f(0.001, 0, 'metal'); } catch (e) { bad.push(k + ': ' + e.message); } } for (const [k, r] of Object.entries(GUN_SND)) if (r) { try { gun(r, 0.001, 0); } catch (e) { bad.push(k + ': ' + e.message); } } return bad; },
  };
}
const dy = (y, cam) => y - cam.position.y;

// ======================================================================================================================
// the match renderer, with fallbacks: the best settings first, then plainer ones (no MSAA, default GPU, then whatever the
// browser will give even on a slow or blocklisted GPU), so the game starts wherever WebGL exists at all
function makeRenderer(P) {
  const tries = [{ antialias: P.msaa > 0, powerPreference: 'high-performance' }, { antialias: false, powerPreference: 'default' },
    { antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, depth: true, stencil: false }];
  for (const o of tries) { try { const r = new THREE.WebGLRenderer(o); if (r.getContext()) return r; } catch (e) { /* next */ } }
  return null;
}
function webglHelp() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:999;display:grid;place-items:center;background:#0b0e13;color:#eef;font:16px system-ui;padding:24px;text-align:center';
  d.innerHTML = '<div style="max-width:560px"><h2 style="margin:0 0 12px">KYS:GO couldn\'t start 3D graphics</h2><p>Your browser didn\'t give the game a WebGL graphics context. Usually one of these fixes it:</p>' +
    '<ol style="text-align:left;line-height:1.6"><li>Reload the page (Ctrl+F5).</li><li>Close other tabs with games, maps or 3D in them.</li>' +
    '<li>Chrome / Edge: Settings → System → turn on <b>Use graphics acceleration when available</b>, then restart the browser.</li>' +
    '<li>Update your graphics driver or browser.</li></ol><button id="whelp" style="margin-top:14px;padding:10px 18px;border:0;border-radius:8px;background:#f2a33a;font-weight:800">Try again</button></div>';
  document.body.appendChild(d); d.querySelector('#whelp').onclick = () => location.reload();
}
export default function start({ cfg, E, N, smoke }) {
  injectCss();
  // installable app (Android / PC: Chrome or Edge install it; iPhone: Add to Home Screen): manifest, icon, offline cache
  if (!smoke) {
    try { if (!document.querySelector('link[rel=manifest]')) { const l = document.createElement('link'); l.rel = 'manifest'; l.href = 'manifest.json'; document.head.appendChild(l);
      const a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = 'icon_192.png'; document.head.appendChild(a);
      const m = document.createElement('meta'); m.name = 'apple-mobile-web-app-capable'; m.content = 'yes'; document.head.appendChild(m); } } catch (e) { /* no head */ }
    try { if (navigator.serviceWorker && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* not supported */ }
    addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });
  }
  let S = loadSet();
  const profile = new Profile(cfg);
  if (profile.signedIn) profile.sync();
  const audio = makeAudio(() => S.vol);
  const toast = (t) => { const d = document.createElement('div'); d.className = 'cs'; d.textContent = t; d.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:400;background:#151b24;border:1px solid #2c3442;padding:10px 16px;border-radius:8px;font-weight:700'; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); };
  if (profile.justConfirmed) setTimeout(() => toast('Email confirmed. You\'re signed in.'), 900);
  // map tiles: a real 3D shot of the map (rendered once, cached), the flat plan meanwhile or without WebGL
  const mapShots = new Map();
  let shotR = null, shotIdle = 0;
  const mapShot = (id) => {
    if (mapShots.has(id)) return mapShots.get(id);
    try {
      if (!shotR) { shotR = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); shotR.setPixelRatio(1); shotR.setSize(440, 260, false); }
      const sc = new THREE.Scene(), Wd = buildWorld(E, MAPS[id], sc, 1, { bakeK: 2, aniso: 4 }), B = Wd.B;
      dressScene(sc, B, false);
      for (const pr of B.props) Wd.group.add(makeProp({ ...pr, y: Wd.H(Math.floor(pr.x), Math.floor(pr.z)) }));
      const site = Object.values(B.sites)[0] || [0, 0, B.w, B.d], tx = (site[0] + site[2]) / 2, tz = (site[1] + site[3]) / 2;
      const cam = new THREE.PerspectiveCamera(48, 440 / 260, 0.5, 400), span = Math.max(B.w, B.d);
      cam.position.set(tx + span * 0.32, span * 0.42, tz + span * 0.42); cam.lookAt(tx, 0, tz);
      shotR.render(sc, cam);
      const url = shotR.domElement.toDataURL('image/jpeg', 0.85);
      Wd.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      mapShots.set(id, url); clearTimeout(shotIdle); shotIdle = setTimeout(() => { try { if (shotR) { shotR.dispose(); shotR.forceContextLoss(); } } catch (e) { /* gone */ } shotR = null; }, 4000);   // give the context back when idle
      return url;
    } catch (e) { try { if (shotR) shotR.dispose(); } catch (e2) { /* gone */ } shotR = null; return null; }   // not cached: tried again next time
  };
  const mapPreview = (c, id) => {
    flatPreview(c, id);
    setTimeout(() => { const url = mapShot(id); if (!url || !c.isConnected) return; const im = new Image(); im.onload = () => c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); im.src = url; }, 30);
  };
  const flatPreview = (c, id) => {
    const B = MAPS[id].build(), g = c.getContext('2d'), sx = c.width / B.w, sz = c.height / B.d, s = Math.min(sx, sz);
    g.fillStyle = '#0b0e13'; g.fillRect(0, 0, c.width, c.height);
    const ox = (c.width - B.w * s) / 2, oz = (c.height - B.d * s) / 2;
    for (let z = 0; z < B.d; z++) for (let x = 0; x < B.w; x++) { const i = z * B.w + x; if (B.flag[i] === 2 || B.flag[i] === 3) { g.fillStyle = B.flag[i] === 3 ? '#c43' : `hsl(35,${20 + B.h[i] * 5}%,${44 + B.h[i] * 6}%)`; g.fillRect(ox + x * s, oz + z * s, Math.ceil(s), Math.ceil(s)); } }
    g.fillStyle = '#ff6a4a'; g.font = 'bold 13px system-ui'; for (const [n, r] of Object.entries(B.sites)) g.fillText(n, ox + (r[0] + r[2]) / 2 * s - 4, oz + (r[1] + r[3]) / 2 * s + 4);
  };
  let menu = null;
  const showMenu = () => { menu = new Menu(cfg, profile, { play: (o) => { menu.hide(); runMatch(o); }, lobbies: (fn) => N.lobbyBrowser(cfg.id, fn), toast, sound: (n) => audio.play(n), mapPreview, settings: () => S, saveSettings: (s) => { S = s; saveSet(s); }, announce: (k) => { const l = line(S.voicePack, k); audio.say(l.text, l.pitch, l.rate, { who: 'announcer:' + S.voicePack }); } }); menu.show(); gamepadControls(E.input, { playing: () => false }); };
  if (smoke) { let m = 'dust'; try { const q = new URLSearchParams(location.search).get('map'); if (MAPS[q]) m = q; } catch (e) { /* no page */ } runMatch({ mode: '5v5', map: m, bot: 'normal', host: true, solo: true, smoke: true }); }
  else showMenu();

  // ====================================================================================================================
  function runMatch(opt) {
    const solo = !!opt.solo, isHost = !!opt.host;
    const myName = (profile.d.name || localStorage.getItem('bd:name') || 'Player' + Math.floor(Math.random() * 900 + 100)).slice(0, 20);
    let session = null, lobby = null, myId = 'me';
    if (!solo) {
      session = N.session(cfg.id, { code: opt.code, host: isHost, name: myName });
      myId = session.id;
      history.replaceState(null, '', '#' + session.code);
      if (isHost && opt.pub) { lobby = N.lobbyBrowser(cfg.id, () => {}); lobby.announce({ code: session.code, name: (opt.ranked ? 'RANKED · ' : '') + myName + "'s lobby", players: 1, max: MODES[opt.mode].size * 2, mode: opt.mode, map: opt.map, ranked: !!opt.ranked }); }
    }
    const loadout = { T: profile.loadoutFor('T'), CT: profile.loadoutFor('CT') };
    const myAtt = (wid) => ((loadout[me.team] || {}).att || {})[wid] || null;
    const rosterAtt = (id, wid) => { const r = st.roster.get(id); return (r && r.att && r.att[wid]) || null; };
    const supSound = (w) => (w.cat === 'pistol' ? 'usp' : 'm4a1s');
    // gun XP earned this match (damage, kills, round wins with each gun), saved at the end
    const gunXP = {}; let gunXPSaved = false;
    const addXp = (wid, n) => { const w = W_BY_ID[wid]; if (!w || w.cat === 'knife' || n <= 0) return; gunXP[wid] = (gunXP[wid] || 0) + n; };
    const saveGunXp = async () => { if (gunXPSaved) return []; gunXPSaved = true; try { return await profile.gunXp(gunXP); } catch (e) { return []; } };
    // recoil help: the admin's account only (checked on the server at sign-in). It cuts recoil to about a third. In an
    // online match everyone is told it's on, in chat, when you join: no secret advantage over friends.
    const touchPlayer = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
    // recoil help: phones always (thumbs vs a mouse); on PC only the admin account, switched in Settings or the pause menu
    const rhK = () => (touchPlayer || (typeof pad !== 'undefined' && pad.active) || (S.recoilHelp && profile.admin) ? 0.4 : 1);
    const story = opt.story || null;   // co-op story mission: { mission, diff, host: character }
    if (story) { opt.mode = 'story'; opt.map = (MISSIONS[story.mission] || MISSIONS[0]).map; }
    const hello = { char: story ? story.host : (() => { try { return localStorage.getItem('cs:story:char') || undefined; } catch (e) { return undefined; } })(), name: myName, loadout, agent: { T: loadout.T.agent, CT: loadout.CT.agent }, knife: { T: loadout.T.knife, CT: loadout.CT.knife } };

    // ---- renderer & scene ----
    // graphics: one GraphicsSettingsManager decides every switch (graphics.js). A fixed tier, or Auto (setting 0): start
    // from what this device managed before (or a guess from its cores/memory), then step down whenever it can't hold
    // ~40 fps even at reduced resolution. Remembered per device.
    const gfx = new GraphicsSettingsManager(S.quality), AUTO = gfx.auto;
    let Q = gfx.q, P = gfx.p;
    setModelQuality(P.hqModels ? 1 : 0.75);
    if (P.chars) loadChars();
    // free every other WebGL context first (menu backdrop, map and item pictures): browsers cap how many can exist
    try { if (shotR) { shotR.dispose(); shotR.forceContextLoss(); shotR = null; } } catch (e) { shotR = null; }
    try { releaseThumbs(); } catch (e) { /* none */ }
    const renderer = makeRenderer(P);
    if (!renderer) { webglHelp(); return; }
    gfx.probe(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
    document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(74, 1, 0.05, 400); cam.rotation.order = 'YXZ'; scene.add(cam);
    const vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10), vmScene = new THREE.Scene();
    const vmHemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1.2), vmSun = new THREE.DirectionalLight(0xffffff, 1.6); vmSun.position.set(1, 2, 1);
    const vmFill = new THREE.DirectionalLight(0xfff2e0, 0.5); vmFill.position.set(-0.3, 0.6, 1);   // soft fill from the viewer's side: the gun always reads, like any shooter's viewmodel
    vmScene.add(vmHemi, vmSun, vmFill);
    // a knife slash leaves a quick bright arc across the view (a stab: a short streak straight ahead)
    const slashMesh = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.47, 28, 1, Math.PI * 0.18, Math.PI * 0.64), new THREE.MeshBasicMaterial({ color: 0xdfe8f0, transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    slashMesh.position.set(0, -0.08, -0.55); slashMesh.renderOrder = 9; vmScene.add(slashMesh); let slashT = 0;
    const slashFx = (dir) => { slashT = 0.16; slashMesh.rotation.set(dir ? 0 : Math.PI / 2, 0, dir ? (dir > 0 ? -0.35 : Math.PI + 0.35) : 0); slashMesh.scale.set(dir ? 1 : 0.35, 1, 1); };
    // the final look (Medium and up, graphics.js decides what's in it): the frame is drawn in HDR (2x MSAA on Medium,
    // 4x on High), then ONE composite pass does all of it: screen-space ambient occlusion from the depth buffer (High),
    // a soft bloom on the brightest things (muzzle flashes, the sun, glowing skins), ACES filmic tone mapping, a gentle
    // contrast/colour grade (cool shadows, warm highlights), a vignette and fine film grain. Low and Potato skip it and
    // draw straight to the screen with no post-processing at all.
    const post = { rt: null, w: 0, h: 0 };
    const POST_FS = `uniform sampler2D tex; uniform sampler2D vmTex; uniform sampler2D depthTex; uniform vec2 res; uniform float time; uniform float exposure; uniform float ads; uniform vec3 camNF; varying vec2 vUv;
        vec3 comp(vec2 p) { vec4 v = texture2D(vmTex, p); return texture2D(tex, p).rgb * (1.0 - v.a) + v.rgb; }   // world + the gun layer (premultiplied)
        vec3 aces(vec3 c) { const mat3 i = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
          const mat3 o = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
          c = i * c; vec3 a = c * (c + 0.0245786) - 0.000090537, b = c * (0.983729 * c + 0.4329510) + 0.238081; return clamp(o * (a / b), 0.0, 1.0); }
        vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        #if defined(SSAO) || defined(SSR)
        float lin(vec2 p) { float z = texture2D(depthTex, p).r * 2.0 - 1.0; return 2.0 * camNF.x * camNF.y / (camNF.y + camNF.x - z * (camNF.y - camNF.x)); }
        // 8 taps on a rotated ring sized to ~0.45 m in the world: neighbours nearer than this pixel (within range) occlude it
        float ssao() {
          float z = lin(vUv); if (z > 60.0) return 1.0;
          float rad = 0.45 * res.y / (2.0 * camNF.z * z), rot = fract(sin(dot(vUv * res, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832, o = 0.0;
          rad = clamp(rad, 2.0, 40.0);
          for (int k = 0; k < 8; k++) { float a = float(k) * 0.7854 + rot, r = rad * (0.35 + 0.65 * fract(float(k) * 0.618 + 0.3));
            float d = z - lin(vUv + vec2(cos(a), sin(a)) * r / res); o += step(0.04, d) * (1.0 - smoothstep(0.35, 1.2, d)); }
          return 1.0 - o / 8.0 * 0.6;
        }
        #endif
        #ifdef SSR
        // screen-space reflections: smooth surfaces (alpha < 1 in the frame, from the world's roughness maps) reflect
        // what is already on screen. A ray marched in view space from each glossy pixel, tested against the depth
        // buffer; rougher surfaces scatter the ray (blurrier, weaker reflections); faded at the screen edges, with
        // distance along the ray and by Fresnel (grazing angles reflect most), times the map's wetness.
        uniform float ssrK; uniform vec3 upV;
        vec3 vpos(vec2 p) { float z = lin(p); vec2 nd = p * 2.0 - 1.0; return vec3(nd.x * camNF.z * (res.x / res.y) * z, nd.y * camNF.z * z, -z); }
        vec3 ssr(vec3 base, float gloss) {
          float z = lin(vUv); if (z > 50.0) return base;
          vec2 px = 1.0 / res; vec3 P = vpos(vUv), N = normalize(cross(vpos(vUv + vec2(px.x, 0.0)) - P, vpos(vUv + vec2(0.0, px.y)) - P));
          vec3 V = normalize(P); float up = dot(N, upV);
          if (up < -0.2 || (up < 0.6 && gloss < 0.55)) return base;   // floors readily, walls only when really polished, never ceilings
          float j = fract(sin(dot(vUv * res, vec2(12.9898, 78.233)) + time * 7.0) * 43758.5453), rough = 1.0 - sqrt(gloss);
          vec3 jit = vec3(j, fract(j * 7.13), fract(j * 3.71)) - 0.5;
          vec3 R = normalize(reflect(V, normalize(N + jit * rough * 0.35)));
          float st = 0.12 + z * 0.012; vec3 Q = P + N * 0.02 + R * st * j;
          for (int i = 0; i < SSR_STEPS; i++) {
            Q += R * st; st *= 1.12;
            if (Q.z > -0.06) break;
            vec2 uv = vec2(Q.x / (-Q.z * camNF.z * res.x / res.y), Q.y / (-Q.z * camNF.z)) * 0.5 + 0.5;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
            float d = -Q.z - lin(uv);
            if (d > 0.0 && d < st * 1.6 + 0.15) {
              vec3 hc = texture2D(tex, uv).rgb;
              float edge = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x) * smoothstep(0.0, 0.12, uv.y) * smoothstep(1.0, 0.88, uv.y);
              float fres = 0.06 + 0.94 * pow(1.0 - max(dot(-V, N), 0.0), 4.0), fade = 1.0 - float(i) / float(SSR_STEPS);
              return mix(base, hc * mix(vec3(1.0), base / max(dot(base, vec3(0.33)), 0.05) * 0.33, 0.25), clamp(ssrK * gloss * fres * edge * fade * 1.6, 0.0, 0.8));
            }
          }
          return base;
        }
        #endif
        void main() {
          vec4 g = texture2D(vmTex, vUv);
          if (ads > 0.01) {   // aimed in: the gun body goes soft (depth of field) around a sharp sight picture, like R6
            float r = ads * smoothstep(0.05, 0.28, length((vUv - 0.5) * vec2(res.x / res.y, 1.0)));
            if (r > 0.01) { vec4 b = vec4(0.0); float j = fract(sin(dot(vUv * res, vec2(39.3468, 11.135))) * 43758.5453) * 6.2832;
              for (int k = 0; k < 12; k++) { float a = float(k) * 0.5236 + j; b += texture2D(vmTex, vUv + vec2(cos(a), sin(a)) / res * (1.5 + r * (2.0 + float(k) * 0.9))); } g = mix(g, b / 12.0, min(1.0, r * 1.6)); }
          }
          vec4 w4 = texture2D(tex, vUv); vec3 wc = w4.rgb;
          #ifdef SSAO
          wc *= ssao();
          #endif
          #ifdef SSR
          { float gloss = clamp((1.0 - w4.a) / 0.98, 0.0, 1.0); if (gloss > 0.06 && ssrK > 0.0) wc = ssr(wc, gloss); }
          #endif
          vec3 c = wc * (1.0 - g.a) + g.rgb;
          #ifdef BLOOM
          { vec3 bl = vec3(0.0);
            float rot = fract(sin(dot(vUv * res, vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;   // per-pixel rotation: a soft halo, not a ring of dots
            for (int k = 0; k < BLOOM_TAPS; k++) { float a = float(k) * 6.2832 / float(BLOOM_TAPS) + rot; vec2 o = vec2(cos(a), sin(a)) / res; float rr = 2.0 + float(k) * 13.0 / float(BLOOM_TAPS);
              bl += max(comp(vUv + o * rr) - 0.9, 0.0) * (1.0 - float(k) * 0.7 / float(BLOOM_TAPS)); }
            c += bl * 0.6 / float(BLOOM_TAPS); }
          #endif
          c = aces(c * exposure / 0.6);
          #ifdef GRADE
          c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);                                   // contrast
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, 1.08);   // a touch more colour
          c += (1.0 - l) * vec3(-0.012, 0.0, 0.018) + l * vec3(0.016, 0.006, -0.012);   // cool shadows, warm highlights
          vec2 q = vUv - 0.5; c *= 1.0 - 0.32 * pow(length(q * vec2(1.25, 1.0)) * 1.3, 2.4);   // vignette
          c += (fract(sin(dot(vUv * res + time * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.007;   // grain
          #endif
          gl_FragColor = vec4(srgb(clamp(c, 0.0, 1.0)), 1.0);
        }`;
    post.mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, vmTex: { value: null }, depthTex: { value: null }, res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, exposure: { value: 1.08 }, ads: { value: 0 }, camNF: { value: new THREE.Vector3(0.05, 400, 1) }, ssrK: { value: 1 }, upV: { value: new THREE.Vector3(0, 1, 0) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: POST_FS, defines: gfx.postDefines(), depthTest: false, depthWrite: false,
    });
    post.scene = new THREE.Scene(); post.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post.mat); post.quad.frustumCulled = false; post.scene.add(post.quad);
    post.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // the HDR pass needs float render targets; many Android GPUs can't render to them, so check rather than assume
    const postOn = () => gfx.postOn;
    // if the phone's GPU gives up (context lost), drop to Potato and restart instead of leaving a black screen
    renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (smoke) return; try { S.quality = 0.5; saveSet(S); localStorage.setItem('cs:autoq', '0.5'); } catch (er) { /* private mode */ } toast('Graphics crashed on this device: restarting on Potato'); setTimeout(() => location.reload(), 1500); });
    const postTarget = () => {
      const v = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(1, v.x | 0), h = Math.max(1, v.y | 0);
      if (!post.rt || post.w !== w || post.h !== h) {
        if (post.rt) { if (post.rt.depthTexture) post.rt.depthTexture.dispose(); post.rt.dispose(); post.vt.dispose(); }
        post.rt = new THREE.WebGLRenderTarget(w, h, gfx.targetOpts(w, h, true)); post.vt = new THREE.WebGLRenderTarget(w, h, gfx.targetOpts(w, h, false));
        post.mat.uniforms.depthTex.value = post.rt.depthTexture || null;
        post.w = w; post.h = h; post.mat.uniforms.res.value.set(w, h);
      }
      return post.rt;
    };
    // tier switches that live outside the map: post defines and target, models, the dynamic player shadows
    let dsh = null;
    const applyTier = () => {
      Q = gfx.q; P = gfx.p; setModelQuality(P.hqModels ? 1 : 0.75);
      post.mat.defines = gfx.postDefines(); post.mat.needsUpdate = true; post.w = 0;
      if (dsh) { dsh.dispose(); dsh = null; }
      if (P.shadows && renderer.capabilities.isWebGL2) dsh = new DynamicShadows(P.shadows);
    };
    applyTier();
    const resize = () => { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = vmCam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); vmCam.updateProjectionMatrix(); };
    addEventListener('resize', resize); resize();
    renderer.autoClear = false;
    let scale = gfx.pixelBand(devicePixelRatio || 1).start;
    const mkGov = () => { const b = gfx.pixelBand(devicePixelRatio || 1); return E.qualityGovernor((s) => { if (window.__lockPR) return; scale = s; renderer.setPixelRatio(s); }, { start: b.start, max: b.max, min: b.min, targetMs: b.targetMs }); };
    let govMin = gfx.pixelBand(devicePixelRatio || 1).min;
    let gov = mkGov(), perfSum = 0, perfN = 0;
    // Auto: still under ~40 fps at the lowest resolution step -> one preset down (the map is rebuilt lighter)
    const autoCheck = (dt) => {
      if (!AUTO || !W || uiOpen || dt > 0.5) return;
      perfSum += dt; perfN++; if (perfSum < 4) return;
      const avg = perfSum / perfN; perfSum = 0; perfN = 0;
      if (avg > 1 / 40 && scale <= govMin + 0.06 && gfx.stepDown()) {
        applyTier(); buildMap(mapId); vmKey = ''; setViewModel(); govMin = gfx.pixelBand(devicePixelRatio || 1).min; gov = mkGov();
        toast('Graphics: ' + gfx.name + ' to keep it smooth');
      } else if (avg < 1 / 75 && scale >= gfx.pixelBand(devicePixelRatio || 1).start - 0.01) gfx.rememberHeadroom();   // headroom: next match one step up
    };
    const fpsM = S.fps ? E.fpsMeter() : () => {};
    const hud = new Hud(S);

    let culler = null, lobbyPanel = null, sunLight = null, sky = null, parts = null, sunDir = [0.6, 0.7, 0.4];
    let W = null, mode = opt.mode, mapId = opt.map, botLevel = opt.bot || 'normal', match = null, bots = null, ended = false, started = false;
    // ranked: bots only on Normal or Hard, real players fill one team first, and that team must be all real to start
    let ranked = !!opt.ranked; if (ranked && !RANKED_BOTS.includes(botLevel)) botLevel = 'hard';
    const rankedReady = () => { if (!match) return false; const n = MODES[mode].size; return [...match.players.values()].filter((q) => !q.bot && q.team === 'T').length >= n || [...match.players.values()].filter((q) => !q.bot && q.team === 'CT').length >= n; };
    // ---- the campaign (story mode) ------------------------------------------------------------------------------------
    // One session for the whole campaign. A level ends -> everyone banks their rewards once -> a black card with the next
    // level's line while it loads behind it -> gameplay starts when every player has loaded (or after 25 s). The last
    // level of a chapter ends on the chapter hub: the same party picks characters and loadouts and readies up; the host
    // starts the next chapter. Every checkpoint is saved on the host, so a crash or a quit resumes from there.
    let SC = null;
    const storyUI = () => { if (!SC) { hud.el.classList.add('story'); SC = storyClient({ scene, myId, audio, isHost, onSkip: () => toHost('skipVote', 1), canvas: renderer.domElement, music: makeMusic(audio), onDirect: storyDirect }); SC.setCamera(cam); if (W) SC.setWorld(W); } return SC; };
    // a scene's staging for this player's own character (the host moves the AI ones): stand here, walk there, slow down
    let slowT = 0, slowK = 1;
    function storyDirect(o, zoneAt) {
      const mine = myChar(), at = (z) => zoneAt(z);   // (where a scene puts this player is the host's call: see onTp)
      if (o.walk && o.walk[0] === mine) { const p = at(o.walk[1]); if (p) me.walkTo = [p.x, p.z]; }
      if (o.slowmo) { slowK = o.slowmo[0]; slowT = o.slowmo[1]; }
      if (o.smoke) { const who = o.smoke === mine ? me : [...st.players.values()].find((q) => (st.roster.get(q.id) || {}).char === o.smoke); if (who && parts) for (let k = 0; k < 6; k++) setTimeout(() => parts.smoke(who.x - Math.sin(who.yaw || 0) * 0.3, who.y + 1.75, who.z - Math.cos(who.yaw || 0) * 0.3, { n: 2, color: '#cfcfcf', size: 0.12, life: 2.2, rise: 0.35, alpha: 0.5 }), k * 450); }
    }
    const mineStory = () => (SC && SC.mine) || {};
    const CAMP_KEY = 'cs:story:camp', CLAIM_KEY = 'cs:story:claimed';
    const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
    const camp = { runId: story ? (story.runId || Math.random().toString(36).slice(2, 10)) : '', mission: story ? story.mission | 0 : -1, diff: story ? story.diff || 'normal' : 'normal', phase: story ? 'level' : '', party: new Map(), ready: new Set(), info: new Map(), ended: -1, hubChapter: 0 };
    let campHold = false;   // a card or the hub is up: no game input
    const storyHold = () => campHold || !!(SC && SC.cutscene);
    const myChar = () => ((match && match.players.get(myId)) || st.roster.get(myId) || {}).char || (story && story.host) || 'ricky';
    const saveCamp = (mi, obj) => { if (isHost && story) lsSet(CAMP_KEY, { runId: camp.runId, mission: mi, obj: obj | 0, diff: camp.diff, char: myChar(), t: Date.now() }); };
    // each player banks their own reward for a level exactly once per run (a duplicate event or a replayed run can't pay twice)
    async function bankLevel(d) {
      const key = `${d.runId || camp.runId}:${d.mission}`, claimed = lsGet(CLAIM_KEY, []);
      if (claimed.includes(key)) return 'rewards already collected';
      claimed.push(key); lsSet(CLAIM_KEY, claimed.slice(-300));
      const sp = storyProgress(), ch = myChar();
      if (isHost) sp.unlocked = Math.max(sp.unlocked, d.mission + 1);   // the host keeps the campaign progress
      sp.best[d.mission] = Math.max(sp.best[d.mission] || 0, ({ easy: 1, normal: 2, hard: 3 })[d.diff] || 1);
      sp.chars[ch] = (sp.chars[ch] || 0) + 1; saveStory(sp);   // everyone keeps their own character's history
      let res = null; try { res = await profile.matchDone({ ...stats, win: 1, draw: false, rounds: 1, botsOnly: true }); } catch (e) { /* offline: saved locally */ }
      gunXPSaved = false; await saveGunXp(); for (const k of Object.keys(gunXP)) delete gunXP[k]; gunXPSaved = false;
      for (const k of Object.keys(stats)) stats[k] = 0;
      return res ? `+${res.coins} coins · +${res.xp} XP` : 'rewards saved';
    }
    async function levelEnd(d) {
      if (camp.ended === d.mission) return; camp.ended = d.mission;
      campHold = true; try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { /* not locked */ }
      const m = MISSIONS[d.mission] || {}, nxt = MISSIONS[d.mission + 1];
      if (!d.chapterEnd && nxt) storyUI().transition(d.mission + 1, 'saving…'); else if (nxt) storyUI().chapterCard(m.chapterIndex); else storyUI().finalCard();
      audio.play('win');
      const rw = await bankLevel(d); SC.reward(rw);
      if (!isHost) return;   // the host moves everyone on
      saveCamp(nxt ? d.mission + 1 : d.mission, 0);
      if (!d.chapterEnd && nxt) setTimeout(() => goLevel(d.mission + 1), 1600);
      else setTimeout(() => openHub(nxt ? nxt.chapterIndex : CHAPTERS.length), nxt ? 5500 : 9000);
    }
    function resetLevel() {   // the last level's leftovers: other players' bodies, smoke, drops, decals, grenades in the air
      for (const [id, r] of rigs) { if (id === myId) continue; scene.remove(r.g); if (r.blob) scene.remove(r.blob); rigs.delete(id); }
      st.players.clear(); st.bomb = null; onFx([]); onDrops([]);
      for (const d of decals) fx.remove(d); decals.length = 0;
      for (const [id, f] of flying) { fx.remove(f.m); flying.delete(id); }
      if (SC) SC.reset();
    }
    const hostInfo = () => { loadout.T = profile.loadoutFor('T'); loadout.CT = profile.loadoutFor('CT'); return { ...hello, loadout: sanitizeLoadout(loadout), agent: sanitizeAgent({ T: loadout.T.agent, CT: loadout.CT.agent }), knife: sanitizeKnife({ T: loadout.T.knife, CT: loadout.CT.knife }) }; };
    function goLevel(mi) {   // host: the next level, same session, same squad
      const m = MISSIONS[mi]; if (!m || !isHost) return;
      camp.mission = mi; camp.phase = 'loading'; campHold = true; camp.ended = -1;
      send('camp', { phase: 'transition', mission: mi, runId: camp.runId });
      storyUI().transition(mi, 'loading…'); SC.hub(null);
      setTimeout(() => {
        const people = [...match.players.values()].filter((p) => !p.bot).map((p) => ({ id: p.id, char: (camp.party.get(p.id) || {}).char || (p.char === 'recruit' ? null : p.char) }));
        try { if (mapId !== m.map) buildMap(m.map); } catch (e) { toast('Could not build ' + m.name + ': ' + (e.message || e)); }
        resetLevel();
        const old = match, mine = people.find((p) => p.id === myId) || {};
        match = new StoryMatch({ W, mode, mapId, botLevel, send: (t, d, to) => { if (session) session.send(t, d, to); }, onLocal: local }, { mission: mi, diff: camp.diff, host: mine.char || myChar(), runId: camp.runId, obj: camp.resumeObj || 0 });
        camp.resumeObj = 0; match.hostId = myId; match.killFx = old.killFx; bots = new Bots(match);
        const mp = match.add(myId, hostInfo()); mp.local = true; me.team = mp.team;
        for (const p of people) if (p.id !== myId) match.add(p.id, { ...(camp.info.get(p.id) || { name: 'Player' }), char: p.char || undefined });
        camp.party.clear();
        send('camp', { phase: 'load', mission: mi, map: m.map, runId: camp.runId });
        camp.ready = new Set([myId]);
        const t0 = performance.now(), need = () => [...match.players.values()].filter((p) => !p.bot).map((p) => p.id);
        const wait = setInterval(() => {
          const ids = need(), n = ids.filter((id) => camp.ready.has(id)).length;
          SC.status(n < ids.length ? `waiting for the squad to load (${n}/${ids.length})…` : 'everyone is here');
          if (n >= ids.length || performance.now() - t0 > 25000) { clearInterval(wait); startLevel(); }
        }, 250);
      }, 900);
    }
    function startLevel() {
      camp.phase = 'level'; campHold = false; started = true;
      saveCamp(camp.mission, match.startObj || 0);
      match.start(); send('lobby', { mode, map: mapId, bot: botLevel, started: true, ranked });
      send('camp', { phase: 'go', mission: camp.mission }); SC.hideCard(); SC.hub(null); if (!smoke) lock();
    }
    // ---- the chapter hub (between chapters, same party) ----
    function openHub(ci) {
      camp.phase = 'hub'; camp.hubChapter = ci; campHold = true;
      const taken = new Set();
      camp.party = new Map([...match.players.values()].filter((p) => !p.bot).map((p) => {
        let c = p.char && p.char !== 'recruit' && !taken.has(p.char) ? p.char : SQUAD.find((k) => !taken.has(k)); taken.add(c);
        return [p.id, { id: p.id, name: ((camp.info.get(p.id) || {}).name || (p.id === myId ? myName : 'Player')), char: c, ready: false }];
      }));
      broadcastHub();
    }
    function broadcastHub() { const d = { phase: 'hub', chapter: camp.hubChapter, party: [...camp.party.values()] }; send('camp', d); renderHub(d); }
    function renderHub(d) {
      campHold = true; try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { /* not locked */ }
      storyUI().hideCard();
      SC.hub({ ...d, on: { char: (c) => campAct({ char: c }), ready: (r) => campAct({ ready: r }), loadout: openLoadout, start: hubStart, leave: () => quit() } });
    }
    const campAct = (a) => { if (isHost) hubAct(myId, a); else toHost('campHub', a); };
    function hubAct(id, a) {
      const p = camp.party.get(id); if (!p || !a || typeof a !== 'object') return;
      if (a.char && SQUAD.includes(a.char) && ![...camp.party.values()].some((q) => q !== p && q.char === a.char)) { p.char = a.char; p.ready = false; }
      if ('ready' in a) p.ready = !!a.ready;
      broadcastHub();
    }
    function hubStart() { if (!isHost || camp.phase !== 'hub') return; const mi = MISSIONS.findIndex((m) => m.chapterIndex === camp.hubChapter); if (mi >= 0) goLevel(mi); }
    // change your loadout without leaving the party: the inventory over the hub, then back
    let loadMenu = null;
    function openLoadout() {
      if (loadMenu) return; SC.hub(null);
      loadMenu = new Menu(cfg, profile, { play: () => {}, lobbies: () => ({ close() {}, announce() {}, update() {} }), toast, sound: (n) => audio.play(n), mapPreview, settings: () => S, saveSettings: (v) => { S = v; saveSet(v); }, announce: () => {},
        back: () => { loadMenu.hide(); loadMenu = null; const info = hostInfo(); if (isHost) camp.info.set(myId, info); else toHost('loadout', { loadout: info.loadout, agent: info.agent, knife: info.knife }); if (camp.phase === 'hub') renderHub({ phase: 'hub', chapter: camp.hubChapter, party: [...camp.party.values()] }); } });
      loadMenu.tab = 'inv'; loadMenu.show();
    }
    // a client: what the host says the campaign is doing
    function onCamp(d) {
      if (!d || typeof d !== 'object') return;
      storyUI();
      if (d.runId) camp.runId = d.runId;
      if (d.phase === 'transition') { camp.phase = 'loading'; campHold = true; SC.transition(d.mission, 'loading…'); SC.hub(null); try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { /* not locked */ } }
      if (d.phase === 'load') {
        camp.phase = 'loading'; campHold = true; camp.mission = d.mission | 0; camp.ended = -1; SC.transition(d.mission, 'loading…'); SC.hub(null);
        try { if (!MAPS[d.map]) throw new Error('unknown map'); if (mapId !== d.map) buildMap(d.map); resetLevel(); toHost('campReady', d.mission); SC.status('loaded · waiting for the squad…'); }
        catch (e) { d.tries = (d.tries || 0) + 1; if (d.tries < 3) { SC.status('loading failed, retrying…'); setTimeout(() => onCamp(d), 1500); } else { toast('Could not load the level'); quit(); } }
      }
      if (d.mission != null && d.phase !== 'hub') camp.mission = d.mission | 0;
      if (d.phase === 'go') { camp.phase = 'level'; campHold = false; SC.hideCard(); SC.hub(null); lock(); }
      if (d.phase === 'hub') { camp.phase = 'hub'; camp.hubChapter = d.chapter; camp.party = new Map((d.party || []).map((p) => [p.id, p])); renderHub(d); }
    }
    // someone joins (or comes back) mid-campaign: catch them up on where the squad is
    function campWelcome(peer) {
      if (camp.phase === 'hub') { if (!camp.party.has(peer)) { const taken = new Set([...camp.party.values()].map((p) => p.char)); camp.party.set(peer, { id: peer, name: (camp.info.get(peer) || {}).name || 'Player', char: SQUAD.find((k) => !taken.has(k)) || 'ricky', ready: false }); } broadcastHub(); }
      else if (camp.phase === 'loading') send('camp', { phase: 'load', mission: camp.mission, map: mapId, runId: camp.runId }, peer);
      else if (match && match.push) { send('camp', { phase: 'go', mission: camp.mission, runId: camp.runId }, peer); match.push(true); }
    }
    const st = { phase: 'warmup', timer: 0, round: 0, score: { T: 0, CT: 0 }, bomb: null, effects: [], drops: [], history: [], roster: new Map(), players: new Map() };
    const stats = { k: 0, d: 0, a: 0, hs: 0, mvp: 0, plant: 0, defuse: 0, pistol: 0, smg: 0, knife: 0, nade: 0, roundWin: 0, dmg: 0 };

    // ---- the local player ----
    const me = { id: myId, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: 0, onGround: true, alive: false, team: 'T', hp: 100, armor: 0, helmet: false, money: 0,
      inv: {}, nades: [], cur: 2, last: 1, nadeSel: 0, cd: 0, reload: 0, deploy: 0, spray: 0, sprayT: 0, punch: 0, scoped: 0, ads: 0, burst: false, burstLeft: 0, flash: 0, defuser: false, inspect: 0, knifeSwing: 0, stepT: 0, wasGround: true, lean: 0, leanWant: 0, prone: 0, proneWant: false };

    // ---- world ----
    // what shiny things reflect (Medium and up): this map's own sky, horizon haze, sunlit ground and the sun, blurred
    // into a tiny environment map once per map. Gun metal, knives, scopes and brass pick it up like real metal.
    let envRT = null;
    function setEnv(B) {
      const es = new THREE.Scene(), sd = new THREE.Vector3(...(B.sunDir || [0.6, 0.7, 0.4])).normalize();
      es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
        uniforms: { sky: { value: new THREE.Color(B.sky || 0x88aadd) }, fog: { value: new THREE.Color(B.fog || 0xccccbb) }, gnd: { value: new THREE.Color((B.amb || [])[1] || 0x776655) },
          sun: { value: new THREE.Color(B.sunColor || 0xffffff).multiplyScalar(B.sunI || 2.4) }, sd: { value: sd },
          photo: { value: (sky && sky.userData.photo) || null }, photoOn: { value: sky && sky.userData.photo ? 1 : 0 }, tint: { value: new THREE.Color(...(B.photoTint || [1, 1, 1])) } },
        vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 sky; uniform vec3 fog; uniform vec3 gnd; uniform vec3 sun; uniform vec3 sd; uniform sampler2D photo; uniform float photoOn; uniform vec3 tint; varying vec3 vD;
          void main() { float y = vD.y; vec3 c = y > 0.0 ? mix(fog * 1.1, sky, pow(y, 0.6)) : mix(fog * 0.8, gnd * 1.3, min(1.0, -y * 3.0));
            if (photoOn > 0.5 && y > 0.0) c = mix(fog, texture2D(photo, vec2(fract((atan(vD.z, vD.x) - atan(sd.z, sd.x)) / 6.2831853 + 0.5), asin(y) / 1.5707963)).rgb * tint, smoothstep(0.0, 0.15, y));
            c = mix(vec3(dot(c, vec3(0.3, 0.55, 0.15))), c, 0.4);   // reflections in rough metal read greyer than the sky itself
            c += sun * (pow(max(dot(vD, sd), 0.0), 600.0) * 20.0 + pow(max(dot(vD, sd), 0.0), 8.0) * 0.25); gl_FragColor = vec4(c, 1.0); }` })));
      const pm = new THREE.PMREMGenerator(renderer);
      if (envRT) envRT.dispose();
      envRT = pm.fromScene(es, 0.02); pm.dispose();
      scene.environment = envRT.texture; vmScene.environment = envRT.texture;
      es.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    function buildMap(id) {
      if (W) { scene.remove(W.group); W.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
      mapId = id; W = buildWorld(E, MAPS[id], scene, Q, { ...gfx.worldOpts(), dynShadows: dsh ? P.shadows.cascades.length : 0 });
      const B = W.B;
      if (sky) { scene.remove(sky); sky = null; }
      const lit = dressScene(scene, B, false, P.clouds, Q >= 1 ? 2048 : 1024); sunLight = lit.sun; sky = lit.sky; sunDir = lit.dir;
      sky.userData.onPhoto = () => { if (envRT) setEnv(B); };   // reflections pick up the real sky once it's in
      vmHemi.color.set(B.amb[0]); vmHemi.groundColor.set(B.amb[1]); vmSun.color.set(B.sunColor);
      if (P.env) setEnv(B);
      // occlusion culling: the map's precompiled visibility set, if it was compiled from this exact map (pvs.js)
      culler = null;
      const pd = PVS_DATA[id];
      if (pd && pd.hash === mapHash(B)) {
        culler = new PVSCuller(decodePVS(pd), B);
        for (const c of W.chunks) { const bb = c.geometry.boundingBox; culler.addBox(c, bb.min.x, bb.min.z, bb.max.x, bb.max.z); }
      }
      W.spinners = []; for (const p of B.props) { const m = makeProp({ ...p, y: W.H(Math.floor(p.x), Math.floor(p.z)) }); W.group.add(m); if (culler) culler.add(m, p.x, p.z); if (m.userData.spin) W.spinners.push(m.userData.spin); }
      if (!parts) parts = new Particles(scene, (x, z) => (W ? W.groundAt(x, z, 60) : 0));
      hud.radarBase(W);
      if (SC) SC.setWorld(W);
    }

    // ---- remote players (rigs) ----
    const rigs = new Map();
    // a soft dark patch under each player (contact shadow), cheap on every setting
    const blobGeo = new THREE.PlaneGeometry(1, 1), blobMat = new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    function rigFor(id) {
      const r0 = rigs.get(id), info = st.roster.get(id) || {}, team = info.team || 'T';
      const agentId = (info.agent || {})[team] || (team === 'T' ? 'a_t_default' : 'a_ct_default');
      const useS = charsReady();   // the realistic animated soldier on every quality (11k triangles); the simple rig only while it loads
      const role = info.look && STORY_LOOKS[info.look] ? 'look:' + info.look : info.boss === 'ballin' || info.boss === true ? 'boss' : info.char && CHARACTERS[info.char] ? info.char : '';   // story mode: squad characters, story people, the boss
      const rs = info.scale || (role === 'boss' ? BOSS.model.scale : 1);
      const key = agentId + team + (useS ? 'S' : '') + role + rs;
      if (r0 && r0.key === key) return r0;
      if (r0) { scene.remove(r0.g); if (r0.blob) scene.remove(r0.blob); }
      const a = AGENT_BY_ID[agentId] || AGENT_BY_ID[team === 'T' ? 'a_t_default' : 'a_ct_default'];
      const look = role.startsWith('look:') ? STORY_LOOKS[info.look] : role === 'boss' ? BOSS_LOOK : role ? CHARACTERS[role].look : a.look;
      const r = useS ? makeSoldier(look, team, P.hqModels) : makePlayer(look, team);
      if (rs !== 1) r.g.scale.setScalar(rs);
      markCaster(r.g);   // drawn into the dynamic player-shadow map (Medium and up)
      r.blob = new THREE.Mesh(blobGeo, blobMat); r.blob.rotation.x = -Math.PI / 2; r.blob.renderOrder = 1; scene.add(r.blob); r.key = key; r.x = 0; r.y = 0; r.z = 0; r.t = Math.random() * 10; scene.add(r.g); rigs.set(id, r);
      if (id !== myId) {  // teammates' names float over their heads
        const c = document.createElement('canvas'); c.width = 256; c.height = 48; const g = c.getContext('2d');
        g.font = 'bold 28px system-ui,sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.8)'; g.fillStyle = team === 'CT' ? '#9cc4ff' : '#ffd27a';
        const nm = String(info.name || '').slice(0, 18); g.strokeText(nm, 128, 34); g.fillText(nm, 128, 34);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
        sp.scale.set(1.3, 0.25, 1); sp.position.y = 2.15; sp.renderOrder = 5; r.g.add(sp); r.tag = sp;
      }
      return r;
    }

    // ---- first-person view model ----
    let lastMelee = false;
    let vm = null, vmKey = '', vmSunK = 1, vmProbeK = 1; const vmProbe = [1, 1, 1];
    function setViewModel() {
      const it = me.cur === 4 ? { wid: me.nades[me.nadeSel] } : me.inv[me.cur];
      const wid = it ? it.wid : null;
      const team = me.team, info = st.roster.get(myId) || {};
      const lo = loadout[team] || {}; const knife = mode === 'story' ? null : lo.knife;   // the story is played in issue kit: no skins, no costumes
      const att = wid ? myAtt(wid) : null;
      const key = `${wid}|${SC && SC.melee ? 'saber' : ''}|${it && it.skin ? it.skin.uid : ''}|${team}|${knife ? knife.uid : ''}|${att ? (att.optic || '') + (att.muzzle || '') : ''}`;
      if (key === vmKey) return; vmKey = key;
      if (vm) vmScene.remove(vm);
      const sleeve = team === 'T' ? '#5e5440' : '#33445c', glove = team === 'T' ? '#2c2824' : '#1e2126';
      if (!wid) { vm = null; return; }
      if (wid === 'knife' && SC && SC.melee) vm = makeKnife('k_dildo', null, sleeve, glove);   // all anyone was allowed to keep
      else if (wid === 'knife') { const ki = knife ? itemInfo({ ...knife }) : null; vm = makeKnife(ki ? ki.weapon : null, knife && ki && !/:Vanilla$/.test(knife.def) ? skinTexture(knife, ki) : null, sleeve, glove); }   // Vanilla keeps the knife's own colours
      else if (G_BY_ID[wid]) { vm = makeGrenade(wid, sleeve, glove, true); vm.scale.setScalar(1.25); }
      else if (wid === 'c4') { vm = makeBomb(sleeve, glove, true); vm.scale.setScalar(0.9); }
      else if (it.skin && /:Finger Gun$/.test(it.skin.def)) vm = makeFingerGun(sleeve);   // the Finger Gun is literally a finger gun
      else { const sk = it.skin, si = sk ? itemInfo(sk) : null; vm = makeGun(wid, sk && si ? skinTexture(sk, si) : null, sleeve, glove, true, att); }
      const small = (W_BY_ID[wid] || {}).cat === 'pistol' || wid === 'zeus';
      vm.userData.base = small ? new THREE.Vector3(0.17 * S.hand, -0.16, -0.44) : new THREE.Vector3(0.19 * S.hand, -0.2, -0.46); vm.userData.ry = (small ? 0.28 : 0.16) * S.hand; vm.scale.multiplyScalar(small ? 0.62 : 0.85);
      vm.position.copy(vm.userData.base); vmScene.add(vm);
      me.deploy = wid === 'knife' ? 0.25 : G_BY_ID[wid] ? 0.35 : (W_BY_ID[wid] || {}).cat === 'pistol' ? 0.35 : (W_BY_ID[wid] || {}).cat === 'sniper' ? 0.7 : 0.5;   // quick draws: fast-paced, R6-like me.scoped = 0; audio.play('deploy');
    }

    // ---- reload animations: tilt the gun, drop the mag, bring a fresh one up, seat it, rack it -----------------------
    const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const _rv = new THREE.Vector3(), _rv2 = new THREE.Vector3();
    const EYE_RELIEF = { reddot: 0.15, holo: 0.16, acog: 0.12, iron: 0.34 };   // how far the sight sits in front of your eye when aimed in (metres)
    // every gun reloads its own way: how far it tilts, where the old mag goes, and how (and whether) it is charged.
    // charge: 'pull' (AR charging handle), 'side' (AK bolt on the right), 'slap' (the HK slap), 'bolt' (bolt-action),
    // 'slide' (pistol slide release), 'none'. Rounds left in the gun (a tactical reload) means no charge at all.
    const RSTYLE = {
      ak47: { tilt: 0.3, rock: 0.35, charge: 'side' }, galil: { tilt: 0.32, rock: 0.3, charge: 'side' },
      m4a4: { tilt: 0.42, charge: 'pull' }, m4a1s: { tilt: 0.42, charge: 'pull' }, scar20: { tilt: 0.4, charge: 'pull' }, sg553: { tilt: 0.4, charge: 'side' },
      famas: { tilt: 0.22, pitch: -0.25, charge: 'pull' }, aug: { tilt: 0.24, pitch: -0.3, charge: 'side' },
      mp5: { tilt: 0.36, charge: 'slap' }, ump: { tilt: 0.36, charge: 'slap' }, g3sg1: { tilt: 0.38, charge: 'slap' },
      mp7: { tilt: 0.3, charge: 'pull' }, mp9: { tilt: 0.3, charge: 'pull' }, mac10: { tilt: 0.45, flick: true, charge: 'pull' }, tec9: { tilt: 0.4, flick: true, charge: 'slide' },
      bizon: { tilt: 0.3, charge: 'side' }, p90: { tilt: 0.2, pitch: 0.25, top: true, charge: 'side' },
      ssg08: { tilt: 0.35, charge: 'bolt' }, awp: { tilt: 0.38, charge: 'bolt' },
      m249: { tilt: 0.55, cover: true, charge: 'none' }, negev: { tilt: 0.55, cover: true, charge: 'none' },
      deagle: { tilt: 0.38, charge: 'slide', heavy: true }, r8: { tilt: 0.7, cyl: true, charge: 'none' }, dualies: { tilt: 0.3, charge: 'slide', dual: true },
      mag7: { tilt: 0.4, charge: 'none' },
    };
    const reloadStyle = (id) => RSTYLE[id] || ((W_BY_ID[id] || {}).cat === 'pistol' ? { tilt: 0.25, charge: 'slide' } : { tilt: 0.42, charge: 'pull' });
    function reloadPose(vm, w, k) {
      const ud = vm.userData, arm = ud.leftArm, mg = ud.magGroup;
      if (k < 0 || !w) { arm.position.set(0, 0, 0); arm.rotation.set(0, 0, 0); if (mg) { mg.position.set(0, 0, 0); mg.rotation.set(0, 0, 0); mg.visible = true; } if (arm.userData.shell) arm.userData.shell.visible = false; return; }
      const hand = ud.leftHand;
      if (w.shellReload) {   // one shell per cycle: the hand dips for a shell and thumbs it into the loading port
        const c = Math.sin(k * Math.PI), dip = Math.sin(k * Math.PI * 2);
        vm.rotation.z += 0.35 * c; vm.rotation.x += 0.1 * c;
        arm.position.set(0.02 * c, -0.08 * Math.max(0, dip) + 0.03 * c, 0.03 * c); if (arm.userData.shell) arm.userData.shell.visible = k > 0.15 && k < 0.6;
        return;
      }
      const S = reloadStyle(w.id), pistol = w.cat === 'pistol', tilt = sm(0, 0.14, k) * (1 - sm(0.82, 1, k)), rack = me.reloadEmpty && S.charge !== 'none';
      vm.rotation.z += S.tilt * tilt; vm.rotation.x += (0.12 + (S.pitch || 0)) * tilt; vm.position.y -= 0.025 * tilt;
      if (S.rock) vm.rotation.x += S.rock * Math.sin(Math.PI * sm(0.36, 0.62, k)) * 0.35;   // an AK mag rocks in front-first
      if (S.flick) vm.rotation.z += 0.35 * Math.exp(-Math.pow((k - 0.2) / 0.05, 2));       // flick the empty out
      if (S.cover) { vm.rotation.z += 0.18 * Math.sin(Math.PI * sm(0.05, 0.9, k)); vm.position.x -= 0.02 * tilt; }
      if (S.cyl) { vm.rotation.z += 0.3 * tilt; vm.rotation.x -= 0.25 * Math.exp(-Math.pow((k - 0.3) / 0.06, 2)); }   // swing out, tip up to drop the empties
      if (S.dual) vm.position.y -= 0.03 * tilt;
      const atMag = _rv.copy(ud.magPos).add(_rv2.set(0, -0.03, 0.02)), below = ud.magPos.clone().add(S.top ? _rv2.set(0.06, 0.3, 0.05) : S.cover ? _rv2.set(0.12, -0.3, 0.1) : _rv2.set(0.05, -0.38, 0.12));
      let tgt;
      if (k < 0.12) tgt = hand.clone().lerp(atMag, sm(0, 0.12, k));
      else if (k < 0.3) tgt = atMag.clone().lerp(below, sm(0.12, 0.3, k));
      else if (k < 0.36) tgt = below.clone();
      else if (k < 0.6) tgt = below.clone().lerp(atMag, sm(0.36, 0.6, k));
      else if (k < 0.7 || !rack || S.charge === 'slide') tgt = atMag.clone().lerp(hand, sm(0.6, 0.78, k));
      else {   // charging it: each kind of gun has its own handle in its own place and its own motion
        const ch = S.charge === 'pull' && ud.charge ? ud.charge.clone() : S.charge === 'side' ? ud.magPos.clone().add(_rv2.set(0.07, 0.08, 0.02)) : S.charge === 'slap' ? ud.magPos.clone().add(_rv2.set(-0.02, 0.09, -0.13)) : S.charge === 'bolt' ? ud.magPos.clone().add(_rv2.set(0.07, 0.06, 0.13)) : (ud.charge ? ud.charge.clone() : ud.magPos.clone().add(_rv2.set(0, 0.08, 0.1)));
        const p1 = S.charge === 'slap' ? ch.clone().add(_rv2.set(0, 0, 0.05)) : S.charge === 'bolt' ? ch.clone().add(_rv2.set(0, 0.04, 0)) : ch.clone().add(_rv2.set(0, 0, 0.07));
        const p2 = S.charge === 'slap' ? ch.clone().add(_rv2.set(0, -0.05, 0.05)) : S.charge === 'bolt' ? p1.clone().add(_rv2.set(0, 0, 0.1)) : p1;
        tgt = k < 0.76 ? atMag.clone().lerp(ch, sm(0.7, 0.76, k)) : k < 0.82 ? ch.clone().lerp(p1, sm(0.76, 0.81, k)) : k < 0.88 ? p1.clone().lerp(p2, sm(0.82, 0.86, k)) : (S.charge === 'bolt' ? p2.clone().lerp(ch, sm(0.88, 0.93, k)).lerp(hand, sm(0.93, 0.99, k)) : p2.clone().lerp(hand, sm(0.88, 0.98, k)));
        if (S.charge === 'bolt') vm.rotation.z -= 0.25 * Math.sin(Math.PI * sm(0.72, 0.98, k));   // the rifle rolls in toward the bolt hand
      }
      arm.position.copy(tgt).sub(hand);
      if (mg) {   // the old mag falls away; the fresh one rides up in the hand and seats with a click
        if (k < 0.12) mg.position.set(0, 0, 0);
        else if (k < 0.34) { const f = sm(0.12, 0.3, k); mg.position.set(0.03 * f, -0.36 * f, 0.1 * f); mg.rotation.set(0.5 * f, 0, 0.3 * f); mg.visible = k < 0.3; }
        else if (k < 0.6) { mg.visible = true; mg.position.copy(tgt).sub(atMag); mg.rotation.set(0.2 * (1 - sm(0.36, 0.6, k)), 0, 0); }
        else { mg.position.set(0, 0, 0); mg.rotation.set(0, 0, 0); mg.visible = true; }
      }
      const jolt = Math.exp(-Math.pow((k - 0.61) / 0.02, 2)) * (S.heavy ? 0.02 : 0.012) + (!rack ? 0 : S.charge === 'slide' ? Math.exp(-Math.pow((k - 0.72) / 0.02, 2)) * 0.025 : S.charge === 'slap' ? Math.exp(-Math.pow((k - 0.84) / 0.015, 2)) * 0.03 : Math.exp(-Math.pow((k - 0.85) / 0.025, 2)) * 0.02);   // the mag seats, then the action slams home
      vm.position.z += jolt;
    }

    // ---- effects: tracers, impacts, smokes, fires, grenades in flight, drops, bomb ----
    const fx = new THREE.Group(); scene.add(fx);
    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.6 });
    const tracers = [];
    const tracer = (a, b) => { if (tracers.length > 24) { const t = tracers.shift(); fx.remove(t.l); t.l.geometry.dispose(); } const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]); const l = new THREE.Line(g, tracerMat); fx.add(l); tracers.push({ l, t: 0.05 }); };
    // spent brass: flies out of the ejection port, tumbles, bounces and tinkles, then lies there a while
    const brassGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 6), shellGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.06, 7), casings = [];
    const brassMat = lam('#c8a048'), shellMat = lam('#b8221e');
    function ejectCasing(o, rx, rz, ax, az, shell) {
      let c = casings.length > 40 ? casings.shift() : null;
      if (!c) c = { m: new THREE.Mesh(shell ? shellGeo : brassGeo, shell ? shellMat : brassMat) };
      c.m.geometry = shell ? shellGeo : brassGeo; c.m.material = shell ? shellMat : brassMat;
      c.m.position.set(o.x + rx * 0.16 + ax * 0.32, o.y - 0.08, o.z + rz * 0.16 + az * 0.32); c.m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      c.v = new THREE.Vector3(rx * (1.6 + Math.random()) - ax * 0.3, 1.6 + Math.random() * 0.8, rz * (1.6 + Math.random()) - az * 0.3); c.spin = 18 + Math.random() * 10; c.t = 0; c.bounced = 0;
      fx.add(c.m); casings.push(c);
    }
    function stepCasings(dt) {
      for (let i = casings.length - 1; i >= 0; i--) {
        const c = casings[i]; c.t += dt;
        if (c.t > 8) { fx.remove(c.m); casings.splice(i, 1); continue; }
        if (c.bounced > 2) continue;
        c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.spin * dt; c.m.rotation.z += c.spin * 0.7 * dt;
        const g = W ? W.groundAt(c.m.position.x, c.m.position.z, c.m.position.y + 0.3) : 0;
        if (c.m.position.y < g + 0.005) { c.m.position.y = g + 0.005; if (c.v.y < -0.6) { c.v.y *= -0.35; c.v.x *= 0.5; c.v.z *= 0.5; c.spin *= 0.5; c.bounced++; if (c.bounced === 1) audio.at('shell', c.m.position.x, c.m.position.y, c.m.position.z, cam, 14); } else { c.bounced = 3; c.m.rotation.set(Math.PI / 2, Math.random() * 6, 0); } }
      }
    }
    // what a bullet throws up depends on what it hit
    const IMPACT = { metal: { colors: ['#fff3c0', '#ffd27a', '#ffffff'], n: 8, speed: 3.2, up: 0.3, size: 0.012, life: 0.22 }, cred: 'metal', cblue: 'metal', cgreen: 'metal', corange: 'metal', bus: 'metal', potty: 'metal',
      wood: { colors: ['#8a5a2a', '#c89a5a', '#5a3a1a'], n: 6, speed: 1.8, up: 0.6, size: 0.018, life: 0.6 }, crate: 'wood', darkwood: 'wood', fence: 'wood',
      sand: { colors: ['#d8c49a', '#c8b07a', '#e8d8b0'], n: 5, speed: 1.0, up: 0.9, size: 0.016, life: 0.7 }, dirt: 'sand', grass: 'sand',
      concrete: { colors: ['#9a9a96', '#c8c8c0', '#6a6a66'], n: 6, speed: 1.6, up: 0.7, size: 0.018, life: 0.6 } };
    const impactFx = (m) => { let e = IMPACT[m] || IMPACT.concrete; if (typeof e === 'string') e = IMPACT[e]; return e; };
    const decalGeo = new THREE.PlaneGeometry(0.12, 0.12), decalMat = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const decals = [];
    const decal = (p, d) => {   // bullet holes: a ring of 60 meshes, the oldest reused (no allocation once it's full)
      const m = decals.length >= 60 ? decals.shift() : new THREE.Mesh(decalGeo, decalMat);
      m.position.set(p.x - d.x * 0.01, p.y - d.y * 0.01, p.z - d.z * 0.01); m.lookAt(p.x - d.x, p.y - d.y, p.z - d.z);
      if (!m.parent) fx.add(m); decals.push(m);
    };
    const puffMat = new THREE.MeshBasicMaterial({ color: 0xaa1111, transparent: true, opacity: 0.9 }); const puffGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18), puffs = [];
    const puff = (x, y, z, col) => { const m = new THREE.Mesh(puffGeo, col ? basic(col) : puffMat); m.position.set(x, y, z); fx.add(m); puffs.push({ m, t: 0.25 }); };
    const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(210,210,210,1)'); gr.addColorStop(0.6, 'rgba(190,190,190,.85)'); gr.addColorStop(1, 'rgba(180,180,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const fireTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 40, 2, 32, 40, 30); gr.addColorStop(0, 'rgba(255,240,140,1)'); gr.addColorStop(0.5, 'rgba(255,120,20,.8)'); gr.addColorStop(1, 'rgba(200,40,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const effectObjs = new Map();
    function syncEffects() {
      const keep = new Set();
      for (const e of st.effects) {
        const k = `${e.type}:${e.x.toFixed(1)}:${e.z.toFixed(1)}`; keep.add(k);
        if (effectObjs.has(k)) continue;
        const g = new THREE.Group();
        if (e.type === 'smoke') { const mat = new THREE.SpriteMaterial({ map: smokeTex, color: 0xc8c8c8, depthWrite: false }); for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(mat); const a = i * 2.4, r = (i % 4) / 4 * e.r * 0.75; s.position.set(Math.cos(a) * r, 0.9 + (i % 3) * 0.9, Math.sin(a) * r); s.scale.setScalar(e.r * 1.25); g.add(s); } }
        if (e.type === 'poison') { const mat = new THREE.SpriteMaterial({ map: smokeTex, color: e.hurtsSquad ? 0x9a8a3a : 0x6aff5a, transparent: true, opacity: 0.55, depthWrite: false }); for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(mat); const a = i * 2.4, r = (i % 4) / 4 * e.r * 0.8; s.position.set(Math.cos(a) * r, 0.5 + (i % 3) * 0.6, Math.sin(a) * r); s.scale.setScalar(e.r * 0.9); g.add(s); } }
        if (e.type === 'fire') { const mat = new THREE.SpriteMaterial({ map: fireTex, depthWrite: false, blending: THREE.AdditiveBlending }); for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(mat); const a = i * 2.1, r = (i % 3) / 3 * e.r; s.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r); s.scale.setScalar(1.1); g.add(s); } }
        g.position.set(e.x, e.y, e.z); fx.add(g); effectObjs.set(k, g);
      }
      for (const [k, g] of effectObjs) if (!keep.has(k)) { fx.remove(g); effectObjs.delete(k); }
    }
    const flying = new Map();  // grenades in flight (visual)
    const dropObjs = new Map();
    function syncDrops() {
      const keep = new Set();
      for (const d of st.drops) { keep.add(d.id); if (dropObjs.has(d.id)) continue; const sk = d.skin, si = sk ? itemInfo(sk) : null; const m = makeGun(d.wid, sk && si ? skinTexture(sk, si) : null, undefined, undefined, false); m.rotation.set(0, Math.random() * 6, Math.PI / 2); m.position.set(d.x, d.y + 0.04, d.z); fx.add(m); dropObjs.set(d.id, m); }
      for (const [k, m] of dropObjs) if (!keep.has(k)) { fx.remove(m); dropObjs.delete(k); }
    }
    const bombObj = makeBomb(); bombObj.visible = false; scene.add(bombObj);
    let bombBeep = 0;

    // ---- inputs ----
    const keys = new Set(), pressed = new Set();
    let mouseBtn = [false, false, false], mdx = 0, mdy = 0, locked = false, uiOpen = null, showSb = false;
    const onKey = (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.code === 'Tab' || e.code === 'Space' || (e.ctrlKey && /Key[WSDAEQRTFGB]/.test(e.code))) e.preventDefault();
      if (e.repeat) return; keys.add(e.code); pressed.add(e.code);
    };
    const onKeyUp = (e) => keys.delete(e.code);
    addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp);
    addEventListener('blur', () => { keys.clear(); mouseBtn = [false, false, false]; });
    const onMove = (e) => { if (locked) { mdx += e.movementX; mdy += e.movementY; } };
    const onDown = (e) => { if (!locked && !uiOpen && !E.input.touch.active) { lock(); return; } mouseBtn[e.button] = true; pressed.add('M' + e.button); };
    const onUp = (e) => { mouseBtn[e.button] = false; };
    addEventListener('mousemove', onMove); renderer.domElement.addEventListener('mousedown', onDown); addEventListener('mouseup', onUp);
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { if (locked) pressed.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp'); }, { passive: true });
    const onLock = () => { locked = document.pointerLockElement === renderer.domElement; if (!locked && !uiOpen && !ended && !smoke && !campHold && !loadMenu) openPause(); };   // the story hub / cards free the mouse on purpose
    document.addEventListener('pointerlockchange', onLock);
    // raw mouse where the browser supports it (no OS acceleration, lower latency), else the plain lock
    const lock = () => { try { let r = null; try { r = renderer.domElement.requestPointerLock({ unadjustedMovement: true }); } catch (e1) { r = null; } if (r && r.catch) r = r.catch(() => renderer.domElement.requestPointerLock()); else if (!r && !document.pointerLockElement) r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed yet */ } if (navigator.keyboard && navigator.keyboard.lock && document.fullscreenElement) navigator.keyboard.lock(['ControlLeft', 'KeyW', 'Tab']).catch(() => {}); };
    let mob = null; try { if (matchMedia('(pointer: coarse)').matches) mob = mobileControls(E.input); } catch (e) { /* no touch */ }
    if (mob && story) document.querySelectorAll('.kc-t b').forEach((b) => { if (b.textContent === 'BUY') b.textContent = 'SKILL'; });   // nothing to buy in a mission: that button is the ability
    // controllers (consoles, TVs, PCs with a pad): drive the match while playing, the menus otherwise
    const pad = gamepadControls(E.input, { playing: () => started && !uiOpen && !ended && !hud.chatIn && !campHold && !loadMenu, sens: () => S.touchSens || 1 });
    if (mob) { hud.el.classList.add('touch'); mob.setSens(S.touchSens || 1); }
    let mobShown = true;
    const kd = (c) => keys.has(c), kp = (c) => pressed.has(c);

    // ---- networking ----
    const send = (t, d, to) => { if (session) session.send(t, d, to); };
    const toHost = (t, d) => { if (isHost) hostRecv(t, d, myId); else if (session) session.toHost(t, d); };
    // host: messages from peers
    function hostRecv(t, d, peer) {
      if (!match) return;
      const p = match.players.get(peer);
      if (t === 'hello') {
        if (p) return;
        const info = d && typeof d === 'object' ? d : {};
        const clean = { char: SQUAD.includes(info.char) ? info.char : undefined, name: String(info.name || 'Player').slice(0, 20), loadout: sanitizeLoadout(info.loadout), agent: sanitizeAgent(info.agent), knife: sanitizeKnife(info.knife) };
        if (ranked && !started) { const n = MODES[mode].size, onT = [...match.players.values()].filter((q) => !q.bot && q.team === 'T').length; clean.team = onT < n ? 'T' : 'CT'; }
        if (started && mode !== 'story') {  // replace a bot on the team that needs a human most
          const humans = (tm) => [...match.players.values()].filter((q) => q.team === tm && !q.bot).length;
          const team = humans('T') <= humans('CT') ? 'T' : 'CT';
          const bot = [...match.players.values()].find((q) => q.bot && q.team === team) || [...match.players.values()].find((q) => q.bot);
          if (bot) { match.remove(bot.id); clean.team = bot.team; }
        }
        if (mode === 'story') { camp.info.set(peer, clean); const hp = camp.party.get(peer); if (hp) clean.char = hp.char; }
        match.add(peer, clean);
        send('lobby', { mode, map: mapId, bot: botLevel, started, ranked }, peer);
        if (mode === 'story' && started) campWelcome(peer);
        if (lobby) lobby.update({ players: [...match.players.values()].filter((q) => !q.bot).length });
        return;
      }
      if (!p && !(t === 'campReady' || t === 'campHub' || t === 'loadout')) return;
      if (t === 'ability') { if (match.ability) match.ability(p); return; }
      if (t === 'skipVote') { if (match.skipVote) match.skipVote(p); return; }
      if (t === 'campReady') { if (d === camp.mission) camp.ready.add(peer); return; }
      if (t === 'campHub') { if (camp.phase === 'hub') hubAct(peer, d); return; }
      if (t === 'loadout' && d && typeof d === 'object') { const o = camp.info.get(peer) || {}; camp.info.set(peer, { ...o, loadout: sanitizeLoadout(d.loadout), agent: sanitizeAgent(d.agent), knife: sanitizeKnife(d.knife) }); return; }
      if (t === 'pose' && Array.isArray(d) && d.length >= 8) {
        const [x, y, z, yaw, pitch, cr, fl, cur] = d.map(Number);
        if (![x, y, z, yaw, pitch, cr].every(Number.isFinite)) return;
        if (p.tpAt && (Math.hypot(x - p.tpAt[0], z - p.tpAt[1]) < 4 || (match.clock || 0) - p.tpAt[2] > 5)) p.tpAt = null;   // a scene moved them: wait for a report from the new spot
        if (p.alive && !p.tpAt) { const jump = Math.hypot(x - p.x, z - p.z); if (jump < 4 || !p.seen) { p.x = x; p.y = y; p.z = z; } p.seen = true; }
        p.yaw = yaw; p.pitch = Math.max(-1.6, Math.min(1.6, pitch)); p.crouch = Math.max(0, Math.min(1, cr)); p.plant = !!(fl & 1); p.defusing = !!(fl & 2);
        p.lean = Number.isFinite(+d[8]) ? Math.max(-1, Math.min(1, +d[8])) : 0; p.prone = Number.isFinite(+d[9]) ? Math.max(0, Math.min(1, +d[9])) : 0;
        if ([1, 2, 3, 4, 5, 6].includes(cur) && (p.inv[cur] || cur === 4)) p.cur = cur; p.onGround = !!(fl & 4); p.reloading = !!(fl & 8); p.vx = 0; p.vz = 0;
        return;
      }
      if (t === 'shot' && d && typeof d === 'object') {
        const w = W_BY_ID[d.w]; if (!w || !p.alive) return;
        const owned = Object.values(p.inv).some((i) => i && i.wid === d.w); if (!owned) return;
        const o = Array.isArray(d.o) ? { x: +d.o[0], y: +d.o[1], z: +d.o[2] } : { x: p.x, y: p.y + 1.6, z: p.z };
        if (Math.hypot(o.x - p.x, o.z - p.z) > 2) return;
        const hits = (Array.isArray(d.h) ? d.h : []).filter((h) => h && typeof h.id === 'string' && ['head', 'chest', 'stomach', 'legs'].includes(h.group)).map((h) => ({ id: h.id, group: h.group, pen: Math.max(0.1, Math.min(1, +h.pen || 1)), heavy: !!h.heavy }));
        match.shot(p, d.w, hits, o);
        const held = d.w === 'knife' ? ((p.knife || {})[p.team]) : (Object.values(p.inv).find((i) => i && i.wid === d.w) || {}).skin;
        const sup = !!d.sup && (rosterAtt(peer, d.w) || {}).muzzle === 'suppressor';
        const fireMsg = { id: peer, wid: d.w, o: [o.x, o.y, o.z], e: Array.isArray(d.e) ? d.e.slice(0, 3).map(Number) : null, s: sup ? supSound(w) : d.w === 'knife' && match.mission && match.mission.melee ? (hits.length ? 'wetslap' : 'doing') : shotSound(d.w, held, hits.length > 0 || !!d.wh), sup: sup ? 1 : 0 };
        send('fire', fireMsg); onFire(fireMsg); if (bots) bots.heard(o.x, o.z, p, sup ? 12 : 30);
        return;
      }
      if (t === 'buy' && typeof d === 'string') { const r = match.buy(p, d); if (r && peer === myId) toast(r); else if (r) send('toast', r, peer); return; }
      if (t === 'nade' && d && typeof d === 'object' && G_BY_ID[d.type]) { const pos = d.pos || {}, vel = d.vel || {}; if ([pos.x, pos.y, pos.z, vel.x, vel.y, vel.z].every((v) => Number.isFinite(+v)) && Math.hypot(+vel.x, +vel.y, +vel.z) < 30) match.throwNade(p, d.type, { x: +pos.x, y: +pos.y, z: +pos.z }, { x: +vel.x, y: +vel.y, z: +vel.z }); return; }
      if (t === 'pickup') { pickupFor(p, +d); return; }
      if (t === 'drop' && [1, 2].includes(+d) && p.inv[+d] && p.alive) { const it = p.inv[+d]; delete p.inv[+d]; if (Number.isFinite(+it.ammo)) match.dropItem(p, it, 1.2); match.sendInv(p); return; }
      if (t === 'dropc4' && p.inv[5] && p.alive) { delete p.inv[5]; match.bomb = { state: 'dropped', x: p.x - Math.sin(p.yaw) * 1.2, y: p.y, z: p.z - Math.cos(p.yaw) * 1.2 }; match.bomb.y = W.groundAt(match.bomb.x, match.bomb.z, p.y + 1); send('bomb', match.bomb); onBomb(match.bomb); match.sendInv(p); return; }
      if (t === 'ammo' && d && typeof d === 'object') { for (const s of [1, 2]) if (p.inv[s] && d[s] && p.inv[s].wid === d[s][0]) { p.inv[s].ammo = Math.max(0, Math.min(+d[s][1] || 0, 999)); p.inv[s].reserve = Math.max(0, Math.min(+d[s][2] || 0, 999)); } return; }
      if (t === 'chat' && d && typeof d.text === 'string') { const m = { name: p.name, team: p.team, text: d.text.slice(0, 120), teamOnly: !!d.team, id: peer }; for (const q of match.players.values()) if (!q.bot && (!m.teamOnly || q.team === p.team)) { if (q.local) onChat(m); else send('chat', m, q.id); } return; }
      if (t === 'emote' && typeof d === 'string' && EMOTE_BY_ID[d] && p.alive) { const ev = { type: 'emote', data: { id: peer, e: d } }; send('ev', ev); onEvent(ev); return; }
    }
    const sanitizeSkin = (s) => (s && typeof s === 'object' && ITEM_BY_ID[s.def] ? { def: s.def, float: Math.max(0, Math.min(1, +s.float || 0)), seed: (+s.seed | 0) % 1000, st: !!s.st, uid: String(s.uid || '').slice(0, 40) } : null);
    function sanitizeLoadout(l) { const out = {}; for (const t of ['T', 'CT']) { const x = (l && l[t]) || {}; const skins = {}; for (const [k, v] of Object.entries(x.skins || {}).slice(0, 50)) if (W_BY_ID[k]) { const s = sanitizeSkin(v); if (s && ITEM_BY_ID[s.def].weapon === k) skins[k] = s; } const att = {}; for (const [k, v] of Object.entries(x.att || {}).slice(0, 50)) if (W_BY_ID[k] && v && typeof v === 'object') { const a = {}; for (const slot of ['optic', 'muzzle', 'reticle']) if (ATTACH[v[slot]] && ATTACH[v[slot]].slot === slot) a[slot] = v[slot]; if (Object.keys(a).length) att[k] = a; }
      out[t] = { skins, att, ctPistol: x.ctPistol === 'p2000' ? 'p2000' : 'usp' }; } return out; }
    const agentOk = (id, team) => AGENT_BY_ID[id] && (AGENT_BY_ID[id].team === team || AGENT_BY_ID[id].team === 'any');
    const sanitizeAgent = (a) => ({ T: a && agentOk(a.T, 'T') ? a.T : null, CT: a && agentOk(a.CT, 'CT') ? a.CT : null });
    const sanitizeKnife = (k) => ({ T: sanitizeSkin(k && k.T), CT: sanitizeSkin(k && k.CT) });
    function pickupFor(p, id) {
      if (!p.alive) return;
      const k = match.drops.findIndex((d) => d.id === id); if (k < 0) return;
      const d = match.drops[k]; if (Math.hypot(d.x - p.x, d.z - p.z) > 1.8) return;
      const s = slotOf(d.wid); const had = p.inv[s];
      match.drops.splice(k, 1);
      if (had) match.dropItem(p, had, 0.4);
      p.inv[s] = { wid: d.wid, ammo: d.ammo, reserve: d.reserve, skin: d.skin, fresh: false, picked: true }; p.cur = s;
      send('drops', match.drops); onDrops(match.drops); match.sendInv(p);
    }

    // ---- receiving (everyone; the host calls these directly) ----
    function onInv(m) {
      const was = me.inv;
      me.inv = {}; for (const s of [1, 2, 3, 5, 6]) if (m.inv[s]) {
        const it = m.inv[s], old = was[s];
        me.inv[s] = { ...it };
        if (s <= 2 && old && old.wid === it.wid && !it.fresh && !it.picked) { me.inv[s].ammo = old.ammo; me.inv[s].reserve = old.reserve; }
      }
      me.nades = m.nades || []; me.money = m.money; me.armor = m.armor; me.helmet = m.helmet; me.defuser = m.defuser;
      if (me.respawned || (!me.inv[me.cur] && !(me.cur === 4 && me.nades.length))) { me.cur = me.inv[1] ? 1 : me.inv[2] ? 2 : 3; if (me.inv[me.cur]) me.respawned = false; }
      if (me.nadeSel >= me.nades.length) me.nadeSel = 0;
      if (hud.panelRender && hud.panel && hud.panel.dataset.k === 'buy') hud.panelRender();
      setViewModel();
    }
    function onTp(m) { if (!m || ![m.x, m.y, m.z].every(Number.isFinite)) return; me.x = m.x; me.y = m.y; me.z = m.z; me.vx = me.vy = me.vz = 0; me.walkTo = null; if (Number.isFinite(m.yaw)) { me.yaw = m.yaw; me.pitch = 0; } }   // a story scene puts this player somewhere
    function onSpawn(m) { dmgFrom.clear(); dmgTo.clear(); me.x = m.x; me.y = m.y; me.z = m.z; me.yaw = m.yaw; me.pitch = 0; me.vx = me.vy = me.vz = 0; me.alive = true; me.hp = 100; me.flash = 0; me.spray = 0; me.scoped = 0; specTarget = null; me.respawned = true; }
    function onHurt(m) {
      me.hp = m.hp; me.armor = m.armor; audio.play('hurt'); if (m.by) dmgFrom.set(m.by, (dmgFrom.get(m.by) || 0) + (m.dmg | 0));
      const ang = m.from ? angDiff(me.yaw, Math.atan2(-(m.from[0] - me.x), -(m.from[1] - me.z))) : null;
      hud.hurt(ang != null ? -ang : null); me.punch += 0.03;
      if (m.hp <= 0) me.alive = false;
    }
    const dmgFrom = new Map(), dmgTo = new Map();
    function onHitConfirm(m) { { const r = rigs.get(m.id); if (r && r.soldier) soldierEvent(r, 'hit'); } if (me.lastGun && performance.now() - (me.lastShotAt || 0) < 600) addXp(me.lastGun, (m.dmg | 0) * XP_RULES.dmg); audio.play(m.group === 'head' ? 'head' : 'hit', 1.25); if (hud.hitmark) hud.hitmark(m.group === 'head' ? 'head' : ''); stats.dmg += m.dmg | 0; dmgTo.set(m.id, (dmgTo.get(m.id) || 0) + (m.dmg | 0)); }
    function onFire(m) {
      if (m.id === myId) return;
      const w = W_BY_ID[m.wid] || {}; const snd = typeof m.s === 'string' ? m.s : shotSound(m.wid, null, false);
      audio.at(snd, m.o[0], m.o[1], m.o[2], cam, w.silenced || m.sup ? 25 : w.cat === 'knife' ? 12 : 110);
      if (m.e && w.cat !== 'knife') { tracer(m.o, m.e); if (parts) parts.emit(m.e[0], m.e[1], m.e[2], { n: 3, colors: ['#8a8070', '#ffd27a'], speed: 1.2, up: 0.5, size: 0.03, life: 0.35 }); }
      if (m.id === specId && W_BY_ID[m.wid] && W_BY_ID[m.wid].cat !== 'knife') { specKick = Math.min(specKick + (W_BY_ID[m.wid].kick || 0.02) * 0.9, 0.09); specFlashT = 0.045; }
      const r = rigs.get(m.id); if (r) { r.flashT = 0.05; if (r.soldier && W_BY_ID[m.wid] && W_BY_ID[m.wid].cat !== 'knife') soldierEvent(r, 'fire'); }
    }
    function onBomb(b) { st.bomb = b ? { s: b.state, x: b.x, y: b.y, z: b.z, t: b.timer, site: b.site } : null; }
    function onDrops(d) { st.drops = d || []; syncDrops(); }
    function onFx(list) { st.effects = list || []; syncEffects(); }
    function onNade(n) { { const r = rigs.get(n.owner); if (r && r.soldier) soldierEvent(r, 'throw'); } const m = makeGrenade(n.type); m.position.set(n.x, n.y, n.z); fx.add(m); flying.set(n.id, { n: { ...n }, m }); audio.at('bounce', n.x, n.y, n.z, cam, 20); }
    function onChat(m) { hud.chat(m.name, m.team, m.text, m.teamOnly); audio.play('radio'); if (m.text.startsWith('📻 ') && S.voice) audio.say(m.text.slice(3), 1.0, 1.05, { who: 'radio' + m.name }); }
    function announce(key) { if (!S.voice) return; const l = line(S.voicePack, key); if (l.text) audio.say(l.text, l.pitch, l.rate, { who: 'announcer:' + S.voicePack, noQueue: true }); sfxFor(S.voicePack, key).forEach((n, i) => setTimeout(() => audio.play(n, 0.8), i * 160)); }
    // kill / death / flash call-outs (packs that have them, e.g. MLG 420): soundboard effects first, then the line
    let mkN = 0, mkT = 0, mkR = -1, flashSaid = 0, firstDone = -1;
    function announceEv(key) { if (!S.voice || !hasLine(S.voicePack, key)) return; announce(key); }
    let specTarget = null, specNext = false;
    // spectating: you see through their eyes like a player would, their gun in their hands (attachments too), their
    // aim smoothed the way a person's view moves, flashes and kick when they fire
    let svm = null, svmKey = '', specYaw = 0, specPitch = 0, specKick = 0, specFlashT = 0, specBob = 0, specId = null;
    function specViewModel(p) {
      const wid = p.wid || 'knife', key = p.id + '|' + wid + '|' + p.team;
      if (key === svmKey) return; svmKey = key;
      if (svm) vmScene.remove(svm);
      const sleeve = p.team === 'T' ? '#5e5440' : '#33445c', glove = p.team === 'T' ? '#2c2824' : '#1e2126';
      if (wid === 'knife') svm = makeKnife(null, null, sleeve, glove);
      else if (G_BY_ID[wid]) { svm = makeGrenade(wid, sleeve, glove, true); svm.scale.setScalar(1.25); }
      else if (wid === 'c4') { svm = makeBomb(sleeve, glove, true); svm.scale.setScalar(0.9); }
      else svm = makeGun(wid, null, sleeve, glove, true, rosterAtt(p.id, wid));
      const small = (W_BY_ID[wid] || {}).cat === 'pistol' || wid === 'zeus';
      svm.userData.base = small ? new THREE.Vector3(0.17, -0.16, -0.44) : new THREE.Vector3(0.19, -0.2, -0.46); svm.userData.ry = small ? 0.28 : 0.16; svm.scale.multiplyScalar(small ? 0.62 : 0.85);
      vmScene.add(svm);
    }
    function onEvent({ type, data }) {
      if (type === 'round') {
        st.round = data.n; st.score = data.score;
        if (data.phase === 'freeze' && mode !== 'story') { hud.banner(`Round ${data.n}`, MODES[mode].bomb ? (me.team === 'T' ? 'Plant the bomb or eliminate the enemy' : 'Defend the bomb sites') : 'Eliminate the enemy', 2500); audio.play('round'); }
        if (data.phase === 'live') { hud.banner('', ''); audio.play('radio'); announce('go'); if (uiOpen === 'buy' && !canBuy()) closeBuy(); }
      }
      if (type === 'roundEnd') {
        st.score = data.score; st.history = data.history || st.history;
        hud.banner(data.text, data.mvp ? `MVP: ${data.mvp}` : '', 4500);
        audio.play(data.winner && data.winner === me.team ? 'win' : 'lose'); setTimeout(() => announce(!data.winner ? 'draw' : data.winner === 'T' ? 'twin' : 'ctwin'), 400);
        if (data.winner === me.team) { stats.roundWin++; if (me.lastGun) addXp(me.lastGun, XP_RULES.win); }
        if (data.mvp && data.mvp === myName) stats.mvp++;
      }
      if (type === 'banner') hud.banner(data.text, data.sub || '', 3000);
      if (type === 'kill') {
        hud.feed(data, myId);
        if (data.kid === myId && data.vteam !== me.team) {
          const now = performance.now(); mkN = now - mkT < 4500 && mkR === st.round ? mkN + 1 : 1; mkT = now; mkR = st.round;
          const w2 = W_BY_ID[data.weapon] || {}, foes = [...st.players.values()].filter((q) => q.team && q.team !== me.team).length;
          const ev = mkN >= 5 || (foes >= 3 && mkN >= foes) ? 'ace' : mkN === 4 ? 'quad' : mkN === 3 ? 'triple' : mkN === 2 ? 'double'
            : w2.cat === 'sniper' && w2.zoom && !me.lastScoped ? 'noscope' : data.wallbang ? 'wallbang' : data.weapon === 'knife' ? 'knife' : data.head ? 'headshot' : firstDone !== st.round ? 'first' : null;
          firstDone = st.round; if (ev) announceEv(ev);
        }
        if (data.kid === myId && data.vteam !== me.team) { if (hud.hitmark) hud.hitmark('kill'); addXp(data.weapon, XP_RULES.kill + (data.head ? XP_RULES.head : 0)); stats.k++; if (data.head) stats.hs++; const w = W_BY_ID[data.weapon]; if (w && w.cat === 'pistol') stats.pistol++; if (w && w.cat === 'smg') stats.smg++; if (data.weapon === 'knife') stats.knife++; if (G_BY_ID[data.weapon]) stats.nade++; bumpStatTrak(data.weapon); }
        if (data.vid === myId) {
          stats.d++; me.alive = false; firstDone = st.round; setTimeout(() => announceEv('died'), 300);
          const k = data.kid ? st.players.get(data.kid) : null, took = data.kid ? (dmgFrom.get(data.kid) || 0) : 0, gave = data.kid ? (dmgTo.get(data.kid) || 0) : 0;
          hud.banner('You died', data.killer ? `${data.killer} · ${itemName(data.weapon)}${data.head ? ' · headshot' : ''}${k ? ` · they had ${Math.max(0, k.hp | 0)} HP` : ''} · you dealt ${gave}, took ${took}` : '', 4000);
        }
        if (data.assist === myName) stats.a++;
        const r = rigs.get(data.vid); if (r) { r.dieT = 0.001; const kp2 = data.kid === myId ? me : st.players.get(data.kid), vp = st.players.get(data.vid); if (kp2 && vp) { const dx = vp.x - kp2.x, dz = vp.z - kp2.z, L = Math.hypot(dx, dz) || 1; r.fall = { x: dx / L, z: dz / L, side: Math.random() < 0.5 ? -1 : 1 }; } }
        const fxd = data.fx && KILL_FX[data.fx], vp2 = data.vid === myId ? me : st.players.get(data.vid);
        if (fxd && vp2) { if (parts) parts.emit(vp2.x, vp2.y + 1.2, vp2.z, { n: fxd.n, colors: fxd.colors, speed: fxd.speed, up: 1, size: 0.06, life: 1.4, g: fxd.g ?? 1 }); if (fxd.text) textPop(scene, vp2.x, vp2.y + 2.2, vp2.z, fxd.text, fxd.textColor); audio.at(fxd.sound, vp2.x, vp2.y, vp2.z, cam, 40); }
      }
      if (type === 'planted') { hud.banner('The bomb has been planted', `Site ${data.site}`, 3000); audio.play('planted'); announce('planted'); if (data.by === myName) stats.plant++; }
      if (type === 'glitter' && parts) { for (let k = 0; k < 3; k++) parts.emit(data.x, data.y, data.z, { n: 40, colors: ['#ff4ad2', '#ffd23a', '#5af0ff', '#ffffff', '#b040ff'], speed: 4.5, up: 2.5, size: 0.05, life: 1.6 }); audio.at('doing', data.x, data.y, data.z, cam, 30); }   // a vest goes off: confetti
      if (type === 'sound' && data.s !== 'defused' && data.s) audio.at(data.s, data.x || me.x, me.y + 1, data.z || me.z, cam, 45);
      if (type === 'sound' && data.s === 'defused') { audio.play('defused'); announce('defused'); hud.banner('The bomb has been defused', '', 3000); const b = match ? match.bomb : null; if (b && b.defuser === myId) stats.defuse++; if (!match && st.bomb && Math.hypot(st.bomb.x - me.x, st.bomb.z - me.z) < 2) stats.defuse++; }
      if (type === 'explode') { audio.at('explode', data.x, data.y, data.z, cam, 200); me.flash = Math.max(me.flash, Math.hypot(data.x - me.x, data.z - me.z) < data.r * 1.5 ? 1.2 : 0.4); camShake = 1.2; }
      if (type === 'nadefx') {
        const f = flying.get([...flying.keys()].find((k) => flying.get(k).n.owner === data.owner && flying.get(k).n.type === data.type)); if (f) { fx.remove(f.m); flying.delete(f.n.id); }
        audio.at(data.type === 'he' ? 'he' : data.type === 'flash' ? 'flash' : data.type === 'smoke' ? 'smoke' : data.type === 'decoy' ? 'bounce' : 'fire', data.x, data.y, data.z, cam, 120);
        if (data.type === 'he') { puff(data.x, data.y + 0.3, data.z, '#ffaa33'); camShake = Math.max(camShake, 0.5); }
        if (data.type === 'flash') flashBy(data);
      }
      if (type === 'emote' && data && EMOTE_BY_ID[data.e]) {
        const em = EMOTE_BY_ID[data.e], dur = em.anim === 'worm' || em.anim === 'dance' || em.anim === 'floss' ? 4 : 3;
        if (data.id === myId) { if (me.alive) me.emote = { anim: em.anim, t: 0, dur }; }
        else { const r = rigs.get(data.id); if (r) r.emote = { anim: em.anim, t: 0, dur }; }
        const p = data.id === myId ? me : st.players.get(data.id);
        if (em.anim === 'fart' && p) { setTimeout(() => { puff(p.x, p.y + 0.9, p.z, '#9ac84a'); puff(p.x + 0.3, p.y + 0.8, p.z + 0.2, '#8ab83a'); audio.at('smoke', p.x, p.y, p.z, cam, 30); }, 600); }
      }
      if (type === 'matchEnd') finish(data);
      if (['cut', 'cutSkip', 'skipVotes', 'talk', 'story', 'obj', 'bark', 'focus'].includes(type)) storyUI().onEvent(type, data);
      if (type === 'storyEnd') levelEnd(data);
      if (type === 'checkpoint' && isHost) saveCamp(data.mission, data.obj);
      if (['heal', 'unlock'].includes(type)) storyUI().onEvent(type, data);
      if (type === 'toast' && data && data.text) toast(String(data.text).slice(0, 120));
      if (type === 'done') {}
    }
    function flashBy(d) {
      // local player
      if (me.alive) {
        const eye = { x: me.x, y: me.y + eyeHeight(me), z: me.z }, p = { x: d.x, y: d.y + 0.2, z: d.z }, dist = Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z);
        if (dist < 40 && W.los(eye, p) && !smokeBetween(eye, p)) {
          const facing = Math.abs(angDiff(me.yaw, Math.atan2(-(p.x - eye.x), -(p.z - eye.z))));
          const k = facing < 0.9 ? 1 : facing < 1.8 ? 0.55 : 0.2;
          me.flash = Math.max(me.flash, (4.8 * k) * Math.max(0.25, 1 - dist / 40));
          if (me.flash > 2.2 && performance.now() - flashSaid > 4000) { flashSaid = performance.now(); announceEv('flashed'); }
        }
      }
      if (match && bots) for (const q of match.players.values()) if (q.bot && q.alive) { const e = { x: q.x, y: q.y + 1.6, z: q.z }, p = { x: d.x, y: d.y + 0.2, z: d.z }, dist = Math.hypot(p.x - e.x, p.z - e.z); if (dist < 30 && W.los(e, p)) { const facing = Math.abs(angDiff(q.yaw, Math.atan2(-(p.x - e.x), -(p.z - e.z)))); bots.flashed(q.id, (facing < 1 ? 3.5 : 1.2) * (1 - dist / 30)); } }
    }
    const smokeBetween = (a, t) => st.effects.some((e) => { if (e.type !== 'smoke') return false; const dx = t.x - a.x, dz = t.z - a.z, L2 = dx * dx + dz * dz, u = Math.max(0, Math.min(1, ((e.x - a.x) * dx + (e.z - a.z) * dz) / (L2 || 1))); return Math.hypot(a.x + dx * u - e.x, a.z + dz * u - e.z) < e.r * 0.85; });
    function bumpStatTrak(wid) {
      const it = wid === 'knife' ? (loadout[me.team] || {}).knife : (me.inv[1] && me.inv[1].wid === wid ? me.inv[1].skin : me.inv[2] && me.inv[2].wid === wid ? me.inv[2].skin : null);
      if (!it || !it.st || !it.uid) return;
      const inv = profile.d.inventory.find((x) => x.uid === it.uid); if (inv) { inv.kills = (inv.kills | 0) + 1; if (!profile.signedIn) profile.changed(); }
    }

    // host-local dispatch (the Match calls this for the host's own player and for broadcast-to-self)
    function local(type, d) {
      if (type === 'inv') onInv(d); else if (type === 'spawn') onSpawn(d); else if (type === 'tp') onTp(d); else if (type === 'hurt') onHurt(d); else if (type === 'hitconfirm') onHitConfirm(d);
      else if (type === 'ev') onEvent(d); else if (type === 'fire') onFire(d); else if (type === 'bomb') onBomb(d); else if (type === 'drops') onDrops(d); else if (type === 'fx') onFx(d); else if (type === 'nade') onNade(d);
    }

    // ---- set up as host or client ----
    if (isHost) {
      buildMap(mapId);
      const margs = { W, mode, mapId, botLevel, send: (t, d, to) => { if (session) session.send(t, d, to); }, onLocal: local };
      match = story ? new StoryMatch(margs, { ...story, runId: camp.runId }) : new Match(margs); match.hostId = myId;
      bots = new Bots(match);
      match.killFx = (by, weapon) => funnyKey(weapon === 'knife' ? (by.knife || {})[by.team] : (Object.values(by.inv).find((i) => i && i.wid === weapon) || {}).skin);
      const mp = match.add(myId, { ...hello, ...(ranked ? { team: 'T' } : {}), loadout: sanitizeLoadout(loadout), agent: sanitizeAgent(hello.agent), knife: sanitizeKnife(hello.knife) });
      mp.local = true; me.team = mp.team; match.spawn(mp); match.sendInv(mp);
      if (session) {
        session.on('_join', () => {});
        for (const t of ['hello', 'pose', 'shot', 'buy', 'nade', 'pickup', 'drop', 'dropc4', 'ammo', 'chat', 'emote', 'ability', 'skipVote', 'campReady', 'campHub', 'loadout']) session.on(t, (d, peer) => hostRecv(t, d, peer));
        session.on('_leave', (_, peer) => { if (camp.party.delete(peer) && camp.phase === 'hub') broadcastHub(); camp.ready.delete(peer); if (match) { match.remove(peer); const r = rigs.get(peer); if (r) { scene.remove(r.g); if (r.blob) scene.remove(r.blob); rigs.delete(peer); } if (lobby) lobby.update({ players: [...match.players.values()].filter((q) => !q.bot).length }); } });
      }
      if (solo) startMatch(); else showLobbyPanel();
    } else {
      hud.banner('Joining…', 'connecting to the host', 0);
      session.on('lobby', (d, peer) => {
        if (peer !== session.hostId || !d || !MODES[d.mode] || !MAPS[d.map]) return;
        mode = d.mode; botLevel = d.bot; ranked = !!d.ranked; if (!W || mapId !== d.map) buildMap(d.map);
        started = !!d.started; hud.banner(started ? '' : 'Waiting for the host to start', `${MODES[mode].name} · ${MAPS[mapId].name}`, started ? 1 : 0);
      });
      const msgTypes = { inv: onInv, spawn: onSpawn, tp: onTp, hurt: onHurt, hitconfirm: onHitConfirm, ev: onEvent, fire: onFire, bomb: onBomb, drops: onDrops, fx: onFx, nade: onNade, chat: onChat, toast: (t) => toast(String(t).slice(0, 80)), camp: onCamp };
      for (const [k, fn] of Object.entries(msgTypes)) session.on(k, (d, peer) => { if (peer === session.hostId) fn(d); });
      session.on('roster', (list, peer) => { if (peer === session.hostId && Array.isArray(list)) setRoster(list); });
      session.on('snap', (s, peer) => { if (peer === session.hostId) applySnap(s); });
      session.on('_host', () => { if (!ended) { toast('The host left: match over'); quit(); } });
      session.on('_roster', () => {});
      const sayHello = () => { if (session.hostId) session.toHost('hello', hello); };
      session.on('_join', (_, peer) => { if (peer === session.hostId) sayHello(); });
      setTimeout(sayHello, 1500); setTimeout(sayHello, 4000);
      setTimeout(() => { if (!W) { toast('Could not reach that lobby'); quit(); } }, 20000);
    }

    function setRoster(list) { st.roster = new Map(list.map((r) => [r.id, r])); const mine = st.roster.get(myId); if (mine) { if (mine.team !== me.team) { me.team = mine.team; vmKey = ''; setViewModel(); } } for (const [id, r] of rigs) if (!st.roster.has(id) && id !== myId) { scene.remove(r.g); if (r.blob) scene.remove(r.blob); rigs.delete(id); } }
    function applySnap(s) {
      st.phase = s.ph; st.timer = s.tm; st.round = s.r; st.score = s.sc;
      for (const a of s.p) {
        const [id, x, y, z, yaw, pitch, crouch, hp, alive, wid, c4, plant, armor, helmet, money, lean, prone, rl] = a;
        if (id === myId) { me.hp = hp; if (me.alive && !alive) me.alive = false; me.armor = armor; me.helmet = !!helmet; me.money = money; me.planting = plant; continue; }
        let p = st.players.get(id); if (!p) st.players.set(id, (p = { id, x, y, z, tx: x, ty: y, tz: z }));
        if (Math.hypot(x - p.x, z - p.z) > 4) { p.x = x; p.y = y; p.z = z; }
        p.tx = x; p.ty = y; p.tz = z; p.tyaw = yaw; p.tpitch = pitch; p.tcrouch = crouch; if (p.yaw == null) { p.yaw = yaw; p.pitch = pitch; p.crouch = crouch; } p.lean = +lean || 0; p.prone = +prone || 0; p.rl = !!rl; p.hp = hp; p.alive = !!alive; p.wid = wid; p.c4 = c4; p.planting = plant; p.armor = armor; p.helmet = !!helmet; p.money = money; p.team = (st.roster.get(id) || {}).team; p.scale = (st.roster.get(id) || {}).scale || 1;
      }
      for (const id of [...st.players.keys()]) if (!s.p.some((a) => a[0] === id)) st.players.delete(id);
      if (s.b) st.bomb = { s: s.b.s, x: s.b.x, y: s.b.y, z: s.b.z, t: s.b.t, d: s.b.d, site: s.b.site }; else if (st.bomb && st.bomb.s !== 'exploded' && st.bomb.s !== 'defused') st.bomb = null;
    }

    function showLobbyPanel() {
      lobbyPanel = document.createElement('div'); lobbyPanel.className = 'cs cs-panel'; lobbyPanel.style.top = '30%';
      const draw = () => {
        if (!lobbyPanel) return;
        const list = [...match.players.values()].filter((p) => !p.bot);
        lobbyPanel.innerHTML = `<div style="min-width:min(440px,90vw)"><b style="font-size:18px">${esc(MODES[mode].name)} · ${esc(MAPS[mapId].name)}</b>
          <div class="cs-mut cs-small" style="margin:4px 0 10px">${ranked ? '<b style="color:#ffd84a">RANKED</b> · ' : ''}Invite code <b style="color:var(--o);font-size:16px">${esc(session.code)}</b> · bots (${esc((BOT_LEVELS[botLevel] || {}).name || botLevel)}) fill empty slots</div>
          ${ranked && !rankedReady() ? `<div class="cs-small" style="color:#ffb04a;margin-bottom:8px">Ranked starts when one team is all real players: ${[...match.players.values()].filter((q) => !q.bot && q.team === 'T').length}/${MODES[mode].size} on T. Share the invite code.</div>` : ''}
          ${list.map((p) => `<div class="cs-row"><span style="color:${p.team === 'CT' ? 'var(--ct)' : 'var(--tt)'}">●</span> ${esc(p.name)} <span class="cs-mut cs-small">${p.team}</span></div>`).join('')}
          <div class="cs-row" style="margin-top:12px"><button class="cs-btn" data-s>START MATCH</button><button class="cs-btn alt" data-c>COPY INVITE LINK</button><button class="cs-btn alt" data-q>LEAVE</button></div></div>`;
        const sb = lobbyPanel.querySelector('[data-s]'); if (ranked && !rankedReady()) { sb.disabled = true; sb.style.opacity = 0.45; }
        sb.onclick = () => { if (ranked && !rankedReady()) return; lobbyPanel.remove(); lobbyPanel = null; startMatch(); };
        lobbyPanel.querySelector('[data-c]').onclick = (e) => { const t = document.createElement('textarea'); t.value = location.origin + location.pathname + '#' + session.code; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (er) { /* old browser */ } t.remove(); e.target.textContent = 'COPIED'; };
        lobbyPanel.querySelector('[data-q]').onclick = quit;
      };
      document.body.appendChild(lobbyPanel); draw(); lobbyPanel.iv = setInterval(draw, 1000); uiOpen = 'lobby';
      const obs = setInterval(() => { if (!lobbyPanel) { clearInterval(obs); uiOpen = null; } }, 300);
    }
    function startMatch() {
      if (lobbyPanel) { clearInterval(lobbyPanel.iv); lobbyPanel.remove(); lobbyPanel = null; }
      uiOpen = null; started = true;
      if (mode !== 'story') match.fillBots(botNames(Math.floor(Math.random() * 18)));
      else { storyUI().transition(camp.mission, ''); setTimeout(() => SC.hideCard(), 2600); saveCamp(camp.mission, match.startObj || 0); }
      match.start(); send('lobby', { mode, map: mapId, bot: botLevel, started: true, ranked });
      if (lobby) lobby.update({ players: [...match.players.values()].filter((q) => !q.bot).length });
    }

    // ---- local actions ----
    const curWeapon = () => { if (me.cur === 4) return null; const it = me.inv[me.cur]; return it ? (it.sw ? GLOCK_SW : W_BY_ID[it.wid]) : null; };
    const canBuy = () => { if (mode === 'story') return false; const b = W && W.B.buy[me.team]; const M = MODES[mode]; return me.alive && b && W.inRect(b, me.x, me.z) && (st.phase === 'freeze' || (st.phase === 'live' && M.round - st.timer < M.buyTime) || (match && match.canBuy(match.players.get(myId)))); };
    function openBuy() {
      if (!canBuy()) { toast(me.alive ? 'You can only buy in your spawn during buy time' : 'Dead players can\'t buy'); return; }
      uiOpen = 'buy'; document.exitPointerLock && document.exitPointerLock();
      hud.buyMenu(true, () => ({ team: me.team, money: me.money, ctRifle: (loadout.CT || {}).ctRifle || profile.d.settings.ctRifle, ctPistol: profile.d.settings.ctPistol,
        owned: new Set([...Object.values(me.inv).map((i) => i && i.wid), ...me.nades, ...(me.armor >= 100 && me.helmet ? ['vesthelm', 'vest'] : me.armor >= 100 ? ['vest'] : []), ...(me.defuser ? ['defuser'] : [])]),
        buy: (it) => { toHost('buy', it); audio.play('buy'); }, close: closeBuy }));
    }
    function closeBuy() { hud.buyMenu(false); uiOpen = null; if (!smoke) lock(); }
    function openPause() {
      if (ended) return; uiOpen = 'pause';
      hud.pauseMenu(true, { info: `${MODES[mode].name} · ${MAPS[mapId].name}${session ? ' · code ' + session.code : ''}`, S, invite: session ? location.origin + location.pathname + '#' + session.code : '', code: session ? session.code : '',
        resume: () => { hud.pauseMenu(false); uiOpen = null; lock(); }, quit, setSens: (v) => { S.sens = v; saveSet(S); }, admin: !!profile.admin && !touchPlayer, setRecoilHelp: (on) => { S.recoilHelp = on ? 1 : 0; saveSet(S); } });
    }
    // who a shot can hit: the live players, gathered into one reused array (no per-shot allocation)
    const SHOT_LIST = [], SHOT_DIR = { x: 0, y: 0, z: 0 }, REC_A = { up: 0, side: 0 }, REC_B = { up: 0, side: 0 };
    const shotTargets = () => { SHOT_LIST.length = 0; for (const p of st.players.values()) if (p.alive) SHOT_LIST.push(p); return SHOT_LIST; };
    function fire(alt) {
      const it = me.inv[me.cur], w = curWeapon();
      if (me.cur === 4) return throwNade(alt);
      if (me.cur === 5) return;
      if (!w || !it || me.cd > 0 || me.deploy > 0 || me.reload > 0) return;
      if (w.cat === 'knife') return knife(alt);
      if (it.ammo <= 0) { audio.play('empty'); me.cd = 0.2; if (it.reserve > 0) startReload(); return; }
      it.ammo--; me.cd = 60 / w.rpm; if (w.prime) me.cd += w.prime * 0.5;
      const eye = eyePos(me);
      const adsOn = me.ads > 0.6, n0 = me.spray;
      const adsSpread = () => { const [st0, mv, jp] = w.inacc || [0.005, 0.03, 0.1]; return st0 * 0.25 + (me.onGround ? 0 : jp) + Math.max(0, speedOf(me) / (w.speed * U) - 0.34) * mv * 0.5; };
      const RH = rhK(), rc = { up: 0, side: 0 },   // recoil moves your view (below), so bullets always go where the crosshair is
        sp = (adsOn ? adsSpread() : spreadOf(w, me, me.scoped > 0, me.spray)) * (me.flash > 1 ? 1.3 : 1);
      me.shotK = 1; me.shotRoll = Math.random() - 0.5;
      if (w.cat !== 'knife' && w.cat !== 'zeus' && !w.shellReload) { const fx2 = -Math.sin(me.yaw), fz2 = -Math.cos(me.yaw); ejectCasing({ x: eye.x + fx2 * 0.2, y: eye.y - 0.04, z: eye.z + fz2 * 0.2 }, Math.cos(me.yaw) * S.hand, -Math.sin(me.yaw) * S.hand, fx2, fz2, false); }
      if (parts && w.cat !== 'knife' && w.cat !== 'zeus' && Math.random() < 0.5) { const fx2 = -Math.sin(me.yaw) * Math.cos(me.pitch), fy2 = Math.sin(me.pitch), fz2 = -Math.cos(me.yaw) * Math.cos(me.pitch); parts.smoke(eye.x + fx2 * 1.0 + Math.cos(me.yaw) * 0.12 * S.hand, eye.y + fy2 * 1.0 - 0.08, eye.z + fz2 * 1.0 - Math.sin(me.yaw) * 0.12 * S.hand, { size: 0.12, life: 0.8, alpha: 0.3 }); }   // a wisp of muzzle smoke
      me.spray++; me.sprayT = 0.4 + 60 / w.rpm; me.lastGun = w.id; me.lastShotAt = performance.now(); me.lastScoped = me.scoped > 0;
      if (w.zoom && me.scoped && w.cat === 'sniper') me.unscopeAfterShot = true;
      const players = shotTargets();
      const hits = []; let end = null;
      for (let k = 0; k < (w.pellets || 1); k++) {
        const r1 = (Math.random() - 0.5) * 2, r2 = (Math.random() - 0.5) * 2, spr = sp + (w.spread || 0) * (w.pellets > 1 ? 1 : 0);
        const d = aimDir(me.yaw + rc.side + r1 * spr, me.pitch + rc.up + r2 * spr, SHOT_DIR);
        const tr = traceShot(W, players, myId, eye, d, w);   // pooled result: keep copies of what outlives this pellet
        for (const h of tr.hits) hits.push({ id: h.id, group: h.group, dist: h.dist, pen: h.pen });
        if (!end && tr.end) end = { x: tr.end.x, y: tr.end.y, z: tr.end.z };
        for (const h of tr.hits) { const p = st.players.get(h.id); if (p) puff(p.x, p.y + (h.group === 'head' ? 1.7 : 1.2), p.z); }
        if (tr.wallHits[0]) { decal(tr.wallHits[0], d); const hp = tr.wallHits[0], mn = W.matName(hp.m), e = impactFx(mn); if (parts) { parts.emit(hp.x - d.x * 0.05, hp.y - d.y * 0.05, hp.z - d.z * 0.05, e); if (e !== IMPACT.metal) parts.smoke(hp.x - d.x * 0.1, hp.y - d.y * 0.1, hp.z - d.z * 0.1, { n: 2, color: e.colors[0], size: e === IMPACT.sand ? 0.22 : 0.14, life: 1.1, rise: 0.15, alpha: 0.55 }); } if (e === IMPACT.metal && Math.random() < 0.35) audio.at('ricochet', hp.x, hp.y, hp.z, cam, 30); }
        for (const h of tr.hits) { const p = st.players.get(h.id); if (p && parts) parts.emit(p.x, p.y + (h.group === 'head' ? 1.7 : 1.2), p.z, { n: 6, colors: ['#8a0a0a', '#c01a1a'], speed: 1.5, up: 0.4, size: 0.04, life: 0.5 }); }
      }
      { // the crosshair follows recoil, always: each shot climbs your actual view along the gun's pattern (pull down to
        // control it). Hip fire kicks a little harder than aimed in.
        const a = recoilAt(w, n0 + 1, REC_A), b = recoilAt(w, n0, REC_B), kv = adsOn ? 0.62 : 0.78, ks = adsOn ? 0.55 : 0.7;
        const FK = SC && SC.focus ? 0 : 1; me.pitch = Math.min(1.55, me.pitch + (a.up - b.up) * kv * RH * FK); me.yaw += (a.side - b.side) * ks * RH * FK; camKick = Math.min(camKick + w.kick * (adsOn ? 0.3 : 0.45), adsOn ? 0.05 : 0.08);
      }
      const sup = (myAtt(w.id) || {}).muzzle === 'suppressor';
      if (w.cat === 'zeus') for (const h of hits) h.group = 'chest';
      if (w.cat === 'zeus') { const zr = w.range || 4.5; for (let i = hits.length - 1; i >= 0; i--) if (hits[i].dist > zr) hits.splice(i, 1); }
      toHost('shot', { w: w.id, h: hits.map((h) => ({ id: h.id, group: h.group, pen: +h.pen.toFixed(2) })), o: [eye.x, eye.y, eye.z], e: end ? [end.x, end.y, end.z] : null, sup: sup ? 1 : 0 });
      if (end && w.cat !== 'zeus') tracer([eye.x + Math.cos(me.yaw) * 0.15 * S.hand, eye.y - 0.1, eye.z - Math.sin(me.yaw) * 0.15 * S.hand], [end.x, end.y, end.z]);
      audio.play(sup ? supSound(w) : shotSound(w.id, it.skin, false), sup ? 0.45 : 0.8);
      if (parts && w.cat !== 'zeus') { const rx = Math.cos(me.yaw), rz = -Math.sin(me.yaw), fx2 = -Math.sin(me.yaw), fz2 = -Math.cos(me.yaw); parts.emit(eye.x + rx * 0.18 * S.hand + fx2 * 0.35, eye.y - 0.12, eye.z + rz * 0.18 * S.hand + fz2 * 0.35, { n: 1, colors: [w.pellets > 1 ? '#c8321e' : '#d4a640'], speed: 2.2, up: 0.9, size: w.cat === 'sniper' ? 0.05 : 0.035, life: 1.2, dir: { x: rx * S.hand, y: 0.3, z: rz * S.hand } }); }
      if (vm && vm.userData.flash) { vm.userData.flash.visible = true; vm.userData.flash.rotation.z = Math.random() * 6.3; vm.userData.flash.scale.setScalar(0.8 + Math.random() * 0.5); flashT = 0.04; }
      if (it.ammo === 0 && it.reserve > 0) setTimeout(() => { if (me.inv[me.cur] === it && it.ammo === 0) startReload(); }, 250);
    }
    function knife(heavy) {
      me.cd = heavy ? 1.0 : 0.42; me.knifeSwing = heavy ? 0.36 : 0.25; me.knifeHeavy = !!heavy; me.knifeDir = heavy ? 0 : -(me.knifeDir || 1);   // slashes alternate sides; the heavy one is a straight stab
      if (slashFx) slashFx(heavy ? 0 : me.knifeDir);
      const eye = { x: me.x, y: me.y + eyeHeight(me), z: me.z };
      // the blade sweeps an arc in front of you (a stab is a narrow lunge): the closest body anywhere on that arc is hit
      const fan = heavy ? [-0.08, 0, 0.08] : [-0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42], reach = heavy ? 2.0 : 2.3;
      let h = null, hd = Infinity, wallAny = false;
      for (const a of fan) {
        const yw = me.yaw + a * (heavy ? 1 : me.knifeDir), d = { x: -Math.sin(yw) * Math.cos(me.pitch), y: Math.sin(me.pitch), z: -Math.cos(yw) * Math.cos(me.pitch) };
        const tr = traceShot(W, shotTargets(), myId, eye, d, W_BY_ID.knife, reach), t = tr.hits[0];
        if (t) { const p = st.players.get(t.id), dd = p ? Math.hypot(p.x - me.x, p.z - me.z) + Math.abs(a) : 9; if (dd < hd) { hd = dd; h = t; } } else if (tr.wallHits.length) wallAny = true;
      }
      if (h) { const p = st.players.get(h.id); if (p) { puff(p.x, p.y + 1.2, p.z); if (parts) parts.emit(p.x, p.y + 1.2, p.z, { n: 10, colors: ['#8a0d0d', '#5a0505'], speed: 2.2, up: 0.8, size: 0.035, life: 0.5 }); } }
      const wall = !h && wallAny;
      audio.play(SC && SC.melee ? (h ? 'wetslap' : 'doing') : shotSound('knife', (loadout[me.team] || {}).knife, !!h || wall), 0.7);
      toHost('shot', { w: 'knife', h: h ? [{ id: h.id, group: 'chest', pen: 1, heavy: !!heavy }] : [], o: [eye.x, eye.y, eye.z], e: null, wh: wall });
    }
    function throwNade(lob) {
      const type = me.nades[me.nadeSel]; if (!type || me.cd > 0 || me.deploy > 0) return;
      const eye = { x: me.x, y: me.y + eyeHeight(me), z: me.z }, pitch = me.pitch + 0.08;
      const d = { x: -Math.sin(me.yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(me.yaw) * Math.cos(pitch) };
      const sp = lob ? 8 : 17.5;
      const vel = { x: d.x * sp + me.vx, y: d.y * sp + (lob ? 3 : 1.5) + Math.max(0, me.vy) * 0.8, z: d.z * sp + me.vz };
      const pos = { x: eye.x + d.x * 0.3, y: eye.y - 0.05, z: eye.z + d.z * 0.3 };
      toHost('nade', { type, pos, vel }); me.cd = 0.8; audio.play('pin', 0.8);
      // the arm follows through before the hand comes back empty: each kind is thrown its own way
      me.throwK = 0.42; me.throwStyle = lob ? 'under' : ({ he: 'over', flash: 'flick', smoke: 'lob', molotov: 'hurl', incendiary: 'hurl', decoy: 'under' })[type] || 'over';
      me.nades.splice(me.nadeSel, 1); me.nadeSel = 0;
      setTimeout(() => { me.throwK = 0; if (me.cur !== 4 || !me.nades.length) { if (!me.nades.length && me.cur === 4) me.cur = me.last && me.inv[me.last] ? me.last : me.inv[1] ? 1 : me.inv[2] ? 2 : 3; } setViewModel(); }, 420);
    }
    function startReload() {
      const it = me.inv[me.cur], w = curWeapon(); if (!it || !w || w.cat === 'knife' || w.cat === 'zeus' || me.reload > 0 || it.ammo >= w.mag || it.reserve <= 0) return;
      me.reload = w.reload; me.scoped = 0; me.reloadEmpty = it.ammo === 0;   // a tactical reload (rounds left) skips the rack
      if (w.shellReload) audio.play('shell', 0.6);
      else {
        const it0 = it, st = reloadStyle(w.id), at = (f, n, v = 0.6) => setTimeout(() => { if (me.inv[me.cur] === it0 && me.reload > 0) audio.play(n, v); }, w.reload * f * 1000);
        if (st.cover) { at(0.08, 'bolt', 0.4); at(0.22, 'magout'); at(0.55, 'magin'); at(0.72, 'bolt', 0.5); }   // belt-fed: cover up, box off, box on, belt, cover shut
        else if (st.cyl) { at(0.1, 'bolt', 0.35); at(0.3, 'shell', 0.5); at(0.6, 'magin', 0.5); at(0.8, 'bolt', 0.4); }   // a revolver: swing out, punch the empties, speed-loader, snap it shut
        else { audio.play('magout', 0.6); at(0.6, 'magin'); if (me.reloadEmpty && st.charge !== 'none') at(st.charge === 'bolt' ? 0.8 : 0.85, 'bolt'); }
      }
    }
    function switchTo(slot) {
      me.adsToggle = false;
      if (slot === 4) { if (!me.nades.length) return; if (me.cur === 4) me.nadeSel = (me.nadeSel + 1) % me.nades.length; else { me.last = me.cur; me.cur = 4; } me.reload = 0; setViewModel(); return; }
      if (slot === 3 && (me.cur === 3 || me.cur === 6) && me.inv[6]) slot = me.cur === 3 ? 6 : 3;  // 3 again: knife <-> taser
      if (!me.inv[slot] || slot === me.cur) return;
      me.last = me.cur; me.cur = slot; me.reload = 0; me.spray = 0; setViewModel();
    }
    function sendAmmo() { const a = {}; for (const s of [1, 2]) if (me.inv[s] && me.inv[s].wid) a[s] = [me.inv[s].wid, me.inv[s].ammo, me.inv[s].reserve]; toHost('ammo', a); }
    function nearestDrop() { let best = null, bd = 1.8; for (const d of st.drops) { const dist = Math.hypot(d.x - me.x, d.z - me.z); if (dist < bd) { bd = dist; best = d; } } return best; }

    // the host's simulation step: the local player's state into the Match, bots, rules, the render mirror, snapshots
    let lastSim = performance.now();
    let hostRosterVer = -1;
    function simHost(dt) {
        lastSim = performance.now();
        const mp = match.players.get(myId);
        if (mp) { mp.x = me.x; mp.y = me.y; mp.z = me.z; mp.yaw = me.yaw; mp.pitch = me.pitch; mp.crouch = me.crouch; mp.lean = me.lean; mp.prone = me.prone || 0; mp.reloading = me.reload > 0; mp.onGround = me.onGround; mp.vx = me.vx; mp.vz = me.vz;
          mp.cur = me.cur === 4 ? 4 : me.cur; mp.plant = me.cur === 5 && me.alive && (mouseBtn[0] || kd('KeyE') || E.input.touch.buttons.has('use')); mp.defusing = me.alive && ((kd('KeyE') && me.ads < 0.5) || E.input.touch.buttons.has('use')) && ((st.bomb && st.bomb.s === 'planted') || mode === 'story') && me.team === 'CT';
          for (const s of [1, 2]) if (mp.inv[s] && me.inv[s] && mp.inv[s].wid === me.inv[s].wid) { mp.inv[s].ammo = me.inv[s].ammo; mp.inv[s].reserve = me.inv[s].reserve; } }
        if (bots) bots.tick(dt);
        match.tick(dt);
        // mirror for rendering
        st.phase = match.phase; st.timer = match.timer; st.round = match.round; st.score = match.score;
        if (match.bomb) { const b = match.bomb; st.bomb = { s: b.state, x: b.x, y: b.y, z: b.z, t: b.timer, d: b.dprog ? b.dprog / (b.kit ? BOMB.defuseKit : BOMB.defuse) : 0, site: b.site }; } else if (st.bomb && st.bomb.s !== 'exploded' && st.bomb.s !== 'defused') st.bomb = null;
        st.history = match.history;
        for (const p of match.players.values()) {
          if (p.id === myId) { me.hp = p.hp; me.alive = p.alive; me.money = p.money; me.armor = p.armor; me.helmet = p.helmet; me.planting = p.planting ? p.planting / BOMB.plant : 0; if (p.team !== me.team) { me.team = p.team; vmKey = ''; setViewModel(); } continue; }
          let q = st.players.get(p.id); if (!q) st.players.set(p.id, (q = { id: p.id }));
          Object.assign(q, { x: p.x, y: p.y, z: p.z, tx: p.x, ty: p.y, tz: p.z, yaw: p.yaw, pitch: p.pitch, crouch: p.crouch, hp: p.hp, alive: p.alive, wid: (p.inv[p.cur] || {}).wid || 'knife', c4: !!p.inv[5], planting: p.planting ? p.planting / BOMB.plant : 0, team: p.team, money: p.money, scale: p.scale || 1, armor: p.armor, helmet: !!p.helmet });
        }
        for (const id of [...st.players.keys()]) if (!match.players.has(id)) st.players.delete(id);
        if (st.roster.size !== match.players.size || (match.rosterVer || 0) !== hostRosterVer || [...match.players.values()].some((p) => (st.roster.get(p.id) || {}).team !== p.team)) { hostRosterVer = match.rosterVer || 0; setRoster([...match.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.bot, agent: p.agent, knife: p.knife, att: ((p.loadout || {})[p.team] || {}).att || null, char: p.squad ? p.char : null, boss: p.boss ? p.bossKey || 'ballin' : null, look: p.lookAs || null, scale: p.scale || 1 }))); }
        netT += dt;
        if (session && netT >= 0.05) { netT = 0; session.send('snap', match.snap()); }
    }
    // hidden or minimised tabs pause animation frames; a worker's timer keeps the host's match running for everyone
    let hiddenTick = null;
    if (isHost && !solo && typeof Worker !== 'undefined') {
      try {
        const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'], { type: 'text/javascript' }));
        hiddenTick = new Worker(url); let last = performance.now();
        hiddenTick.onmessage = () => { const now = performance.now(); let dt = Math.min(0.25, (now - last) / 1000); last = now; if (now - lastSim < 120 || !match || ended) return;  // frames stalled (hidden / minimised tab)
          dt = Math.min(0.25, (now - lastSim) / 1000); while (dt > 0) { const step = Math.min(dt, 1 / 60); simHost(step); dt -= step; } };
      } catch (e) { hiddenTick = null; }
    }
    // ---- loop ----
    let lookDX = 0, lookDY = 0, netT = 0, hudT = 0, radarT = 0, flashT = 0, camKick = 0, camShake = 0, viewY = 0, bob = 0, ammoT = 0, sbT = 0, timeAlive = 0;
    let radioOpen = null;
    const loopH = E.loop((dt) => {
      if (slowT > 0) { slowT -= dt; dt *= slowK; }   // the story's slow-motion beats
      if (!W) return;
      timeAlive += dt;
      // ---- host simulation (a background timer takes over while the host's tab is hidden) ----
      if (match) simHost(dt);
      if (SC) {
        SC.tick(dt, (x, z) => W.groundAt(x, z, 60), performance.now() / 1000);
        const aBtn = E.input.touch.buttons.has('jump'); if (SC.cutscene && aBtn && !SC.aWas) SC.skip(); SC.aWas = aBtn;   // controller A skips a line
      }
      if (!match) {
        for (const p of st.players.values()) {   // between network updates everything glides: position, facing, aim and crouch
          const k = Math.min(1, dt * 14); p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k;
          if (p.tyaw != null) { let dy = p.tyaw - p.yaw; dy -= Math.round(dy / (Math.PI * 2)) * Math.PI * 2; const ka = Math.min(1, dt * 18); p.yaw += dy * ka; p.pitch += (p.tpitch - p.pitch) * ka; p.crouch += (p.tcrouch - p.crouch) * Math.min(1, dt * 12); }
        }
        netT += dt; ammoT += dt;
        if (session && netT >= 1 / 30) { netT = 0; const fl = (me.cur === 5 && (mouseBtn[0] || kd('KeyE')) ? 1 : 0) | (((kd('KeyE') && me.ads < 0.5) || E.input.touch.buttons.has('use')) && me.team === 'CT' ? 2 : 0) | (me.onGround ? 4 : 0) | (me.reload > 0 ? 8 : 0);
          session.toHost('pose', [+me.x.toFixed(2), +me.y.toFixed(2), +me.z.toFixed(2), +me.yaw.toFixed(3), +me.pitch.toFixed(3), +me.crouch.toFixed(2), fl, me.cur, +me.lean.toFixed(2), +(me.prone || 0).toFixed(2)]); }
        if (ammoT > 1) { ammoT = 0; sendAmmo(); }
      }

      // ---- local input ----
      const typing = !!hud.chatIn;
      const frozen = st.phase === 'freeze' || storyHold();
      let lk = { dx: mdx, dy: mdy }; mdx = mdy = 0;
      lk.dx += E.input.touch.look.dx; lk.dy += E.input.touch.look.dy; E.input.touch.look.dx = E.input.touch.look.dy = 0;
      const adsOptic = vm && vm.userData && curWeapon() && !curWeapon().zoom ? (vm.userData.optic && vm.userData.sight ? vm.userData.optic : vm.userData.iron ? 'iron' : null) : null;   // every gun aims down sights: its optic, or its iron sights
      const adsZoom = 1 + ((ATTACH[adsOptic] || {}).zoom - 1 || 0) * me.ads;
      const zoomK = (me.scoped ? (curWeapon() && curWeapon().zoom ? curWeapon().zoom[me.scoped - 1] / S.fov : 1) : 1) / adsZoom;
      const sens = S.sens * 0.022 * Math.PI / 180 * zoomK;
      // phones: light aim assist (thumbs vs a mouse): the view slows over an enemy and, while you shoot or aim, eases onto them
      let assist = null;
      if ((touchPlayer || pad.active) && me.alive && !uiOpen && W) {   // aim assist: phones and controllers
        const eye = eyePos(me); let best = 0.13;
        for (const p of st.players.values()) {
          if (!p.alive || p.team === me.team || p.id === myId) continue;
          const ty = p.y + (p.prone > 0.6 ? 0.3 : 1.25 - (p.crouch || 0) * 0.35), dx = p.x - eye.x, dz = p.z - eye.z, dist = Math.hypot(dx, dz); if (dist > 40) continue;
          const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(ty - eye.y, dist);
          let dy = yaw - me.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const off = Math.hypot(dy, pitch - me.pitch);
          if (off < best && W.los(eye, { x: p.x, y: ty, z: p.z })) { best = off; assist = { dy, dp: pitch - me.pitch }; }
        }
      }
      const slow = assist ? 0.55 : 1;
      if (!uiOpen && me.alive && !storyHold()) { me.yaw -= lk.dx * sens * slow; me.pitch = Math.max(-1.55, Math.min(1.55, me.pitch - lk.dy * sens * slow)); }
      if (assist && (E.input.touch.buttons.has('fire') || me.ads > 0.5)) { const k = Math.min(1, dt * 2.2); me.yaw += assist.dy * k; me.pitch += assist.dp * k * 0.6; }
      lookDX = Math.max(-40, Math.min(40, lk.dx * sens * 60)); lookDY = Math.max(-40, Math.min(40, lk.dy * sens * 60));
      if (radioOpen) { for (let k = 1; k <= 6; k++) if (kp('Digit' + k)) { hud.radioPick(k - 1); radioOpen = null; } if (kp('Digit0') || kp('Escape')) { hud.radio(null); hud.emoteWheel(null); radioOpen = null; } }
      if (!typing && !uiOpen && !radioOpen && !storyHold()) {
        if (me.alive) {
          for (let k = 1; k <= 5; k++) if (kp('Digit' + k)) switchTo(k);
          const leaning = me.ads > 0.5;   // aimed in with an optic (never snipers): Q / E lean left / right, toggled like R6
          if (leaning && kp('KeyQ')) me.leanWant = me.leanWant === -1 ? 0 : -1;
          else if (leaning && kp('KeyE')) me.leanWant = me.leanWant === 1 ? 0 : 1;
          else if (kp('KeyQ')) switchTo(me.last || 1);
          if (kp('WheelDown') || kp('WheelUp')) { const order = [1, 2, 3, 4, 5].filter((s) => s === 4 ? me.nades.length : me.inv[s]); const i = order.indexOf(me.cur); switchTo(order[(i + (kp('WheelDown') ? 1 : order.length - 1)) % order.length]); }
          if (kp('KeyR') || E.input.touch.tapped.has('reload')) startReload();
          if (kp('KeyZ') || E.input.touch.tapped.has('prone')) me.proneWant = !me.proneWant;   // Z: go prone / get up
          const tt = E.input.touch.tapped;
          if (tt.has('swap')) { const order = [1, 2, 3].filter((k) => me.inv[k]); const i = order.indexOf(me.cur); switchTo(order[(i + 1) % order.length]); }
          if (tt.has('nade')) switchTo(4);
          if (tt.has('menu')) openPause();
          if (leaning && tt.has('leanL')) me.leanWant = me.leanWant === -1 ? 0 : -1;
          if (leaning && tt.has('leanR')) me.leanWant = me.leanWant === 1 ? 0 : 1;
          if (tt.has('alt') && adsOptic) me.adsToggle = !me.adsToggle;
          if (kp('KeyF') || E.input.touch.tapped.has('inspect')) { me.inspect = 2.2; const held = me.cur === 3 ? (loadout[me.team] || {}).knife : (me.inv[me.cur] || {}).skin; me.inspectStyle = inspectStyle(funnyKey(held)) || (isMythic(held) ? 'mythic' : null); if (me.inspectStyle === 'mythic') { flareGlow(1); me.inspectGlow = ((itemInfo(held) || {}).paint || {}).glow || '#ff2e4c'; } if (me.inspectStyle) audio.play(INSPECT_SOUND[me.inspectStyle] || 'boing', 0.7); }
          if (mode === 'story' && (kp('KeyG') || E.input.touch.tapped.has('ability') || E.input.touch.tapped.has('buy'))) toHost('ability', 1);
          else if (kp('KeyG')) { if (me.cur === 5 && me.inv[5]) { toHost('dropc4', 1); } else if (me.cur === 1 || me.cur === 2) { sendAmmo(); toHost('drop', me.cur); } }
          if (!leaning && (kp('KeyE') || E.input.touch.tapped.has('use'))) { const d = nearestDrop(); if (d && !(st.bomb && st.bomb.s === 'planted' && me.team === 'CT' && Math.hypot(st.bomb.x - me.x, st.bomb.z - me.z) < 2)) { sendAmmo(); toHost('pickup', d.id); } }
          const w = curWeapon();
          if (kp('M2') || E.input.touch.tapped.has('alt')) {
            if (w && w.zoom) { me.scoped = (me.scoped + 1) % (w.zoom.length + 1); audio.play('tick'); }
            else if (w && w.cat === 'knife') fire(true);
            else if (me.cur === 4) fire(true);
            else if (w && w.burst && !adsOptic) { me.burst = !me.burst; toast(me.burst ? 'Burst fire' : 'Automatic / semi'); }
          }
          if (kp('KeyX') && w && w.burst) { me.burst = !me.burst; toast(me.burst ? 'Burst fire' : 'Automatic / semi'); }
          const firing = mouseBtn[0] || E.input.touch.buttons.has('fire');
          if (firing && !frozen) {
            if (me.cur === 4) { if (kp('M0') || E.input.touch.tapped.has('fire')) fire(false); }
            else if (w && (w.auto && !me.burst || kp('M0') || E.input.touch.tapped.has('fire'))) { if (me.burst && kp('M0')) me.burstLeft = 3; fire(false); }
          }
          if (me.burstLeft > 0 && me.cd <= 0) { me.burstLeft--; fire(false); }
        }
        if (mode !== 'story' && (kp('KeyB') || E.input.touch.tapped.has('buy'))) openBuy();
        if (kp('KeyY')) hud.chatInput(false, (t) => toHost('chat', { text: t, team: false }));
        if (kp('KeyU')) hud.chatInput(true, (t) => toHost('chat', { text: t, team: true }));
        if (kp('KeyT') && me.alive) { radioOpen = 'emote'; hud.emoteWheel(profile.wheel().map((id) => EMOTE_BY_ID[id]).filter(Boolean), (e) => toHost('emote', e.id)); }
        for (const k of S.crouchKey === 'c' ? ['v', 'x'] : ['v', 'x', 'c']) if (kp('Key' + k.toUpperCase()) && !kd('ControlLeft')) { radioOpen = k; hud.radio(k, me.team, (t) => toHost('chat', { text: '📻 ' + t, team: true })); }
      } else if (uiOpen === 'buy') {
        if (kp('KeyB') || kp('Escape')) closeBuy();
        if (!canBuy()) closeBuy();
      }
      showSb = kd('Tab') || E.input.touch.buttons.has('score');
      if (mob) { const sh = !uiOpen && !ended; if (sh !== mobShown) { mobShown = sh; mob.show(sh); } mob.setAiming(me.ads > 0.5); }
      // movement (frozen in freeze time)
      { const wantAds = !!adsOptic && me.alive && !uiOpen && me.reload <= 0 && me.deploy <= 0 && !me.emote && (mouseBtn[2] || me.adsToggle); if (!wantAds && !mouseBtn[2] && (me.reload > 0 || !adsOptic || !me.alive)) me.adsToggle = false; me.ads += ((wantAds ? 1 : 0) - me.ads) * Math.min(1, dt * 12); if (!adsOptic) me.ads = 0;
        // lean: only while aimed in; never through a wall (the eye stops short of whatever is beside you)
        if (me.ads < 0.3 || !me.alive) me.leanWant = 0;
        let want = me.leanWant;
        if (want && W) { const sgn = Math.sign(want), o = { x: me.x, y: me.y + eyeHeight(me), z: me.z }, dr = { x: Math.cos(me.yaw) * sgn, y: 0, z: -Math.sin(me.yaw) * sgn }, hit = W.ray(o, dr, LEAN + 0.2, 0); if (hit) want = sgn * Math.max(0, Math.min(1, (hit.t - 0.2) / LEAN)); }
        me.lean += (want - me.lean) * Math.min(1, dt * 9); if (Math.abs(me.lean) < 0.002) me.lean = 0; }
      const w0 = curWeapon(), wspeed = (w0 ? (me.scoped && w0.scopedSpeed ? w0.scopedSpeed : w0.speed) : 245) * U * (1 - 0.2 * me.ads) * (mineStory().speed || 1);
      const mv = typing || uiOpen === 'pause' ? { x: 0, y: 0 } : (() => { let x = (kd('KeyD') ? 1 : 0) - (kd('KeyA') ? 1 : 0), y = (kd('KeyW') ? 1 : 0) - (kd('KeyS') ? 1 : 0); if (E.input.touch.active && (E.input.touch.move.x || E.input.touch.move.y)) { x = E.input.touch.move.x; y = E.input.touch.move.y; } return { x, y }; })();
      if (me.emote) { me.emote.t += dt; if (me.emote.t > me.emote.dur || !me.alive || mv.x || mv.y || mouseBtn[0] || kd('Space')) me.emote = null; }
      if (me.alive) {
        const inp = { f: frozen ? 0 : mv.y, s: frozen ? 0 : mv.x, jump: !frozen && !typing && (kd('Space') || E.input.touch.buttons.has('jump')), crouch: !typing && !me.proneWant && (S.crouchKey === 'c' ? kd('KeyC') : (kd('ControlLeft') || kd('ControlRight'))) || E.input.touch.buttons.has('crouch'), prone: !!me.proneWant, sprint: !typing && (kd('ShiftLeft') || kd('ShiftRight') || E.input.touch.buttons.has('sprint')) && me.ads < 0.3 };
        if (inp.jump && me.proneWant) { me.proneWant = false; inp.jump = false; }   // jump gets you up
        if (me.walkTo) { const dx = me.walkTo[0] - me.x, dz = me.walkTo[1] - me.z; if (Math.hypot(dx, dz) < 0.4 || !(SC && SC.cutscene)) me.walkTo = null; else { me.yaw = Math.atan2(-dx, -dz); inp.f = 1; inp.s = 0; inp.walk = true; } }   // a scene walking you somewhere
        const wasG = me.onGround;
        moveStep(W, me, inp, dt, wspeed);
        if (!wasG && me.onGround && me.wasAir > 0.25) { audio.play('land', 0.5); me.landK = Math.min(1.2, me.wasAir * 1.6); }
        me.wasAir = me.onGround ? 0 : (me.wasAir || 0) + dt;
        const spd = speedOf(me);
        if (me.onGround && spd > 3 && !inp.crouch && !me.prone) { me.stepT -= dt * spd / 3.3; if (me.stepT <= 0) { me.stepT = 1; audio.play('step', me.sprinting ? 0.75 : 0.5, 0, W.matName(W.mat[W.idx(Math.floor(me.x), Math.floor(me.z))])); } }
        bob += spd * dt * 1.9;
        if (W.lavaAt(me.x, me.z) && me.y < 0.2 && !match) { /* host applies lava damage */ }
      }
      me.cd -= dt; me.deploy = Math.max(0, me.deploy - dt); me.punch = Math.max(0, me.punch - dt * 0.35 - me.punch * dt * 4); camKick = Math.max(0, camKick - dt * (0.5 + camKick * 8));
      me.sprayT -= dt; if (me.sprayT <= 0 && me.spray > 0) { me.spray = Math.max(0, me.spray - dt * 18); }
      if (me.reload > 0) {
        me.reload -= dt; const it = me.inv[me.cur], w = curWeapon();
        if (me.reload <= 0 && it && w) {
          if (w.shellReload) { if (it.reserve > 0 && it.ammo < w.mag) { it.ammo++; it.reserve--; if (it.ammo < w.mag && it.reserve > 0) { me.reload = w.reload; audio.play('shell', 0.6); } } }
          else { const take = Math.min(w.mag - it.ammo, it.reserve); it.ammo += take; it.reserve -= take; }
        }
        if (w && w.shellReload && mouseBtn[0] && it && it.ammo > 0) me.reload = 0;
      }
      if (me.unscopeAfterShot && me.cd > 0) { me.scoped = 0; me.unscopeAfterShot = false; me.rescope = true; }
      if (me.rescope && me.cd <= 0) { me.rescope = false; }
      me.flash = Math.max(0, me.flash - dt);
      me.inspect = Math.max(0, me.inspect - dt); me.knifeSwing = Math.max(0, me.knifeSwing - dt); me.throwK = Math.max(0, (me.throwK || 0) - dt); slashT = Math.max(0, slashT - dt); slashMesh.material.opacity = slashT > 0 ? Math.sin(slashT / 0.16 * Math.PI) * 0.55 : 0; slashMesh.visible = slashT > 0;
      if (flashT > 0) { flashT -= dt; if (flashT <= 0 && vm && vm.userData.flash) vm.userData.flash.visible = false; }
      if (!me.alive && (pressed.has('M0') || E.input.touch.tapped.has('fire'))) specNext = true;
      pressed.clear(); E.input.touch.tapped.clear();   // a tap counts once, however many logic steps this frame runs

      // grenades in flight (visual)
      for (const [id, f] of flying) { nadeStep(W, f.n, dt); f.m.position.set(f.n.x, f.n.y + 0.06, f.n.z); f.m.rotation.x += dt * 8; f.n.age += dt; if (f.n.age > 8) { fx.remove(f.m); flying.delete(id); } }
      for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].t -= dt; if (tracers[i].t <= 0) { fx.remove(tracers[i].l); tracers[i].l.geometry.dispose(); tracers.splice(i, 1); } }
      for (let i = puffs.length - 1; i >= 0; i--) { puffs[i].t -= dt; puffs[i].m.scale.setScalar(1 + (0.25 - puffs[i].t) * 6); if (puffs[i].t <= 0) { fx.remove(puffs[i].m); puffs.splice(i, 1); } }
      // bomb beeps
      if (st.bomb && st.bomb.s === 'planted' && st.bomb.t != null) { bombBeep -= dt; const rate = Math.max(0.12, Math.min(1, st.bomb.t / 30)); if (bombBeep <= 0) { bombBeep = rate; audio.at('beep', st.bomb.x, st.bomb.y, st.bomb.z, cam, 50); } }
    }, (alpha, dt) => {
      if (!W) return;
      gov(dt); fpsM(dt); autoCheck(dt);
      // ---- camera: own eyes, or spectate a teammate ----
      const lo = leanOff(me); let viewYaw = me.yaw, viewPitch = me.pitch + me.punch * 0.35 + camKick, ex = me.x + lo.x, ey = me.y + eyeHeight(me) * (mineStory().scale || 1) - Math.abs(me.lean) * 0.05, ez = me.z + lo.z, viewRoll = -me.lean * 0.2;
      let spectating = null;
      if (!me.alive && (st.phase !== 'warmup')) {
        const mates = [...st.players.values()].filter((p) => p.alive && p.team === me.team && !String(p.id).startsWith('actor_'));   // not the story's bystanders
        if (mates.length) { if (!specTarget || !mates.find((p) => p.id === specTarget)) specTarget = mates[0].id; if (specNext) { specNext = false; const i = mates.findIndex((p) => p.id === specTarget); specTarget = mates[(i + 1) % mates.length].id; } const p = st.players.get(specTarget); spectating = p;
          if (specId !== p.id) { specId = p.id; specYaw = p.yaw || 0; specPitch = p.pitch || 0; svmKey = ''; }
          let dy = (p.yaw || 0) - specYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const k = Math.min(1, dt * 14);
          specYaw += dy * k; specPitch += ((p.pitch || 0) - specPitch) * k; specKick = Math.max(0, specKick - dt * 0.35);
          const lo2 = leanOff({ yaw: specYaw, lean: p.lean || 0 }); ex = p.x + lo2.x; ey = p.y + eyeHeight({ crouch: p.crouch || 0, prone: p.prone || 0 }); ez = p.z + lo2.z;
          viewYaw = specYaw; viewPitch = specPitch + specKick; viewRoll = -(p.lean || 0) * 0.2; }
        else { viewPitch = -0.5; ey = me.y + 3.5; }
      }
      viewY += (ey - viewY) * Math.min(1, dt * 18); if (Math.abs(ey - viewY) > 1.5) viewY = ey;
      const shake = camShake > 0 ? (Math.random() - 0.5) * camShake * 0.05 : 0; camShake = Math.max(0, camShake - dt * 2);
      cam.position.set(ex, viewY + (spectating ? 0 : Math.sin(bob * 2) * 0.012), ez); cam.rotation.set(viewPitch + shake, viewYaw + shake, viewRoll);
      if (!spectating) { specId = null; if (svm) svm.visible = false; }
      else {   // the spectated player's viewmodel
        specViewModel(spectating);
        const r = rigs.get(spectating.id), sp = r ? Math.hypot(r.vx || 0, r.vz || 0) : 0; specBob += sp * dt * 1.9;
        const b = svm.userData.base; svm.visible = !!spectating.alive;
        svm.position.set(b.x + Math.sin(specBob) * 0.008 * Math.min(1, sp / 4), b.y + Math.abs(Math.cos(specBob)) * 0.006 * Math.min(1, sp / 4) - (spectating.crouch || 0) * 0.01, b.z + specKick * 1.4);
        svm.rotation.set(specKick * 2, svm.userData.ry || 0, 0);
        specFlashT -= dt; if (svm.userData.flash) { svm.userData.flash.visible = specFlashT > 0; if (specFlashT > 0) svm.userData.flash.rotation.z = Math.random() * 6.3; }
      }
      const w = curWeapon();
      const zoomFov = me.scoped && w && w.zoom ? w.zoom[me.scoped - 1] : S.fov / (1 + (((ATTACH[vm && vm.userData && vm.userData.optic] || {}).zoom || 1) - 1) * me.ads);
      const vfov = 2 * Math.atan(Math.tan(zoomFov * Math.PI / 360) * 0.75) * 180 / Math.PI;  // horizontal 4:3 -> vertical
      if (Math.abs(cam.fov - vfov) > 0.01) { cam.fov = vfov; cam.updateProjectionMatrix(); }
      // ---- players ----
      const now = performance.now() / 1000;
      for (const p of st.players.values()) {
        const r = rigFor(p.id); r.g.visible = p.alive || (r.dieT != null && r.dieT < 3);
        if (!p.alive && r.dieT == null) r.dieT = 0.001;
        if (p.alive) r.dieT = null; else r.dieT += dt;
        const sp = Math.hypot(p.x - r.x, p.z - r.z) / Math.max(dt, 1e-3), kv = Math.min(1, dt * 10);
        r.vx = (r.vx || 0) + ((p.x - r.x) / Math.max(dt, 1e-3) - (r.vx || 0)) * kv; r.vz = (r.vz || 0) + ((p.z - r.z) / Math.max(dt, 1e-3) - (r.vz || 0)) * kv; r.vy = (r.vy || 0) + ((p.y - (r.y || p.y)) / Math.max(dt, 1e-3) - (r.vy || 0)) * kv;
        r.x = p.x; r.z = p.z; r.y = p.y;
        { const pr = p.prone || 0; r.g.position.set(p.x + Math.sin(p.yaw) * 0.85 * pr, p.y + pr * 0.14, p.z + Math.cos(p.yaw) * 0.85 * pr); }   // feet behind the hitbox centre when lying r.g.rotation.order = 'YXZ'; r.g.rotation.y = p.yaw; r.g.rotation.x = r.dieT ? 0 : -(p.prone || 0) * Math.PI / 2 * 0.94;   // prone: lie forward
        setTpGun(r, SC && SC.melee && (p.wid || 'knife') === 'knife' ? (p.team === 'T' ? 'fists' : 'knife:dildo') : p.wid || 'knife', rosterAtt(p.id, p.wid));   // the club: sabers versus slaps
        if (r.tag) { const dT = Math.hypot(p.x - cam.position.x, p.z - cam.position.z); r.tag.visible = p.alive && p.team === me.team && !(spectating && p.id === spectating.id) && !(SC && SC.cutscene) && dT > 3.5; if (r.tag.visible) { const k = Math.min(1.6, Math.max(0.55, dT / 12)); r.tag.scale.set(1.3 * k, 0.25 * k, 1); } }   // tags stay readable far off and out of your face up close   // no name tags in a cutscene's shots
        r.t += dt;
        if (p.alive && sp > 3.6 && !(spectating && p.id === spectating.id)) { r.stepT = (r.stepT || 0) - dt * sp / 3.3; if (r.stepT <= 0) { r.stepT = 1; audio.at('step', p.x, p.y, p.z, cam, 28, W.matName(W.mat[W.idx(Math.floor(p.x), Math.floor(p.z))])); } }
        if (r.emote) { r.emote.t += dt; if (r.emote.t > r.emote.dur || sp > 0.5 || !p.alive) r.emote = null; }
        if (r.soldier && p.rl && !r.wasRl) soldierEvent(r, 'reload'); r.wasRl = !!p.rl;
        if (r.soldier) setGear(r, p.armor || 0, p.helmet);
        if (r.soldier) poseSoldier(r, { dt, vx: Math.abs(r.vx) < 12 ? r.vx : 0, vz: Math.abs(r.vz) < 12 ? r.vz : 0, vy: r.vy, yaw: p.yaw, crouch: p.crouch || 0, pitch: p.pitch || 0, dead: r.dieT ? 1 : 0, emote: r.emote, lean: p.lean || 0, prone: p.prone || 0 });
        else posePlayer(r, { speed: Math.min(sp, 7), t: r.t, crouch: p.crouch || 0, pitch: p.pitch || 0, dead: r.dieT ? Math.min(1, r.dieT * 3) : 0, emote: r.emote });
        if (!r.soldier && r.torso && p.lean) r.torso.rotation.z -= p.lean * 0.35;
        if (r.blob) { r.blob.visible = r.g.visible; const gy = W.groundAt(p.x, p.z, p.y + 0.1); r.blob.position.set(p.x, gy + 0.02, p.z); const k = Math.max(0.2, 1 - (p.y - gy) * 0.8); r.blob.scale.setScalar(0.95 * k); }
        { const gf = r.tpGun.children[0]; if (gf && gf.userData.flash) { r.flashT = (r.flashT || 0) - dt; gf.userData.flash.visible = r.flashT > 0; if (r.flashT > 0) gf.userData.flash.rotation.z = Math.random() * 6.3; } }
        if (r.dieT && r.fall && !r.soldier) { const k = Math.min(1, r.dieT * 3); r.g.position.x += r.fall.x * 0.5 * k; r.g.position.z += r.fall.z * 0.5 * k; r.g.rotation.z = r.fall.side * 0.35 * k; r.g.rotation.y = Math.atan2(-r.fall.x, -r.fall.z) + Math.PI; }
        if (spectating && p.id === spectating.id) { r.g.visible = false; if (r.blob) r.blob.visible = false; }
        if (culler && r.g.visible && !culler.visibleAt(p.x, p.z)) { r.g.visible = false; if (r.blob) r.blob.visible = false; }   // behind solid walls: not drawn
      }
      // own body while emoting: camera swings out in front, you see yourself
      // story cutscenes: the director's camera, and your own body in the shot like everyone else's
      const cine = SC && SC.cutscene && W ? SC.shot(now, (id) => { if (id === myId) return me.alive ? { x: me.x, y: me.y, z: me.z, yaw: me.yaw } : null; const p = st.players.get(id); return p && p.alive ? { x: p.x, y: p.y, z: p.z, yaw: p.yaw, scale: p.scale || 1 } : null; }) : null;
      const povShot = cine && cine.pov;
      const selfRig = me.emote || (cine && !povShot) || rigs.has(myId) ? rigFor(myId) : null;
      if (selfRig) {
        selfRig.g.visible = (!!me.emote || (!!cine && !povShot)) && me.alive; if (selfRig.blob) selfRig.blob.visible = selfRig.g.visible;
        if (cine && !povShot && !me.emote && me.alive) { selfRig.t += dt; selfRig.g.position.set(me.x, me.y, me.z); selfRig.g.rotation.y = me.yaw; setTpGun(selfRig, (curWeapon() || {}).id || 'knife', null); if (selfRig.soldier) setGear(selfRig, me.armor || 0, me.helmet); if (selfRig.soldier) poseSoldier(selfRig, { dt, vx: 0, vz: 0, vy: 0, yaw: me.yaw, crouch: 0, pitch: 0, rest: 1 }); else posePlayer(selfRig, { speed: 0, t: selfRig.t, crouch: 0, pitch: 0 }); }
        if (me.emote) {
          selfRig.t += dt; selfRig.g.position.set(me.x, me.y, me.z); selfRig.g.rotation.y = me.yaw;
          if (selfRig.soldier) setGear(selfRig, me.armor || 0, me.helmet); if (selfRig.soldier) poseSoldier(selfRig, { dt, yaw: me.yaw, emote: me.emote }); else posePlayer(selfRig, { t: selfRig.t, emote: me.emote });
          const k = Math.min(1, me.emote.t * 2.5, (me.emote.dur - me.emote.t) * 2.5), ang = me.yaw + 0.5;   // out in front, slightly to the side: you see your own face
          let dist = 3.2 * k;
          const o = { x: me.x, y: me.y + 1.5, z: me.z }, d = { x: -Math.sin(ang), y: 0.18, z: -Math.cos(ang) }, L = Math.hypot(d.x, d.y, d.z); d.x /= L; d.y /= L; d.z /= L;
          const hit = W.ray(o, d, dist); if (hit) dist = Math.max(0.3, hit.t - 0.3);
          cam.position.set(o.x + d.x * dist, o.y + d.y * dist, o.z + d.z * dist); cam.lookAt(me.x, me.y + 1.2, me.z);
        }
      }
      if (povShot) {   // through your own eyes: a child in a hallway, a man on the ground
        const sc2 = mineStory().scale || 1, h = cine.down ? 0.28 : eyeHeight(me) * sc2, sh = cine.shake || 0;
        cam.position.set(me.x + (Math.random() - 0.5) * sh, me.y + h + (Math.random() - 0.5) * sh, me.z + (Math.random() - 0.5) * sh); cam.up.set(cine.down ? 0.25 : 0, 1, 0); cam.lookAt(cine.look); cam.up.set(0, 1, 0);
        if (Math.abs(cam.fov - 62) > 0.01) { cam.fov = 62; cam.updateProjectionMatrix(); }
      } else if (cine) {   // keep the camera out of walls: pull it in towards whoever it's looking at
        const lk2 = cine.look, dx = cine.pos.x - lk2.x, dy = cine.pos.y - lk2.y, dz = cine.pos.z - lk2.z, L = Math.hypot(dx, dy, dz) || 1;
        const hit = W.ray({ x: lk2.x, y: lk2.y, z: lk2.z }, { x: dx / L, y: dy / L, z: dz / L }, L), k = hit ? Math.max(0.15, (hit.t - 0.25) / L) : 1;
        cam.position.set(lk2.x + dx * k, lk2.y + dy * k, lk2.z + dz * k); cam.up.set(0, 1, 0); cam.lookAt(lk2.x, lk2.y, lk2.z);
        if (Math.abs(cam.fov - 50) > 0.01) { cam.fov = 50; cam.updateProjectionMatrix(); }
      }
      // bomb
      const b = st.bomb; bombObj.visible = !!b && (b.s === 'planted' || b.s === 'dropped');
      if (bombObj.visible) { bombObj.position.set(b.x, b.y + 0.02, b.z); bombObj.userData.led.visible = b.s !== 'planted' || (now * (1 + (40 - (b.t || 40)) / 8)) % 1 < 0.5; }
      // ---- view model ----
      if (vm) {
        vm.visible = me.alive && !(me.scoped && w && w.zoom) && !spectating && !me.emote && !cine && !(me.ads > 0.9 && ['acog', 'reddot', 'holo'].includes(vm.userData.optic));   // aimed through an optic: you look through the glass, not at the gun
        const base = vm.userData.base, sp = speedOf(me);
        const animReload = !!(vm.userData.leftArm && (vm.userData.magGroup || (w && w.shellReload)));
        const dep = me.deploy > 0 ? me.deploy * 0.5 : 0, rel = me.reload > 0 && !animReload ? 0.12 : 0;
        vm.position.set(base.x + Math.sin(bob) * 0.008 * Math.min(1, sp / 4), base.y + Math.abs(Math.cos(bob)) * 0.006 * Math.min(1, sp / 4) - dep - rel - me.crouch * 0.01, base.z + camKick * 1.4);
        vm.rotation.set(rel * 2 + camKick * 2, (vm.userData.ry || 0) + (me.inspect > 0 ? Math.sin((2.2 - me.inspect) / 2.2 * Math.PI) * 1.2 : 0), me.inspect > 0 ? Math.sin((2.2 - me.inspect) / 2.2 * Math.PI) * 0.5 : 0);
        if (me.throwK > 0) {   // a throw: wind up, then release; the grenade leaves the hand at the snap
          const tk = 1 - me.throwK / 0.42, wind = Math.sin(Math.min(1, tk / 0.35) * Math.PI / 2) * (1 - sm(0.35, 0.55, tk)), go = sm(0.35, 0.6, tk) * (1 - sm(0.75, 1, tk));
          const S = me.throwStyle;
          if (S === 'over') { vm.position.y += wind * 0.12 - go * 0.1; vm.position.z += wind * 0.12 - go * 0.25; vm.rotation.x += wind * 0.9 - go * 1.2; }
          else if (S === 'hurl') { vm.position.y += wind * 0.15 - go * 0.08; vm.position.x += wind * 0.06; vm.position.z += wind * 0.16 - go * 0.3; vm.rotation.x += wind * 1.1 - go * 1.4; vm.rotation.z += go * 0.6; }   // a bottle: a big overhand heave
          else if (S === 'flick') { vm.position.x += wind * 0.1 - go * 0.12; vm.position.z -= go * 0.2; vm.rotation.y += wind * 0.8 - go * 0.9; vm.rotation.z -= go * 0.5; }   // a quick sidearm pop around the corner
          else if (S === 'lob') { vm.position.y -= wind * 0.08 - go * 0.14; vm.position.z += wind * 0.06 - go * 0.22; vm.rotation.x -= wind * 0.5 - go * 0.9; }   // a smoke goes up in a high arc
          else { vm.position.y -= wind * 0.14 - go * 0.06; vm.position.z += wind * 0.05 - go * 0.2; vm.rotation.x -= wind * 0.7 - go * 0.6; }   // underhand
          vm.visible = vm.visible && tk < 0.55;
        }
        if (me.knifeSwing > 0) {   // the blade: a slash sweeps across from one side to the other, a stab lunges straight in
          const kd = me.knifeHeavy ? 0.36 : 0.25, kp = 1 - me.knifeSwing / kd, ka = Math.sin(kp * Math.PI), dir = me.knifeDir || 1;
          if (me.knifeHeavy) { vm.position.z -= ka * 0.15; vm.position.y += ka * 0.03; vm.rotation.x -= ka * 0.22; }
          else { const sw = kp * 2 - 1; vm.position.x += dir * sw * 0.17 * ka; vm.position.z -= ka * 0.09; vm.rotation.y += dir * sw * 0.9 * ka; vm.rotation.z += dir * 0.75 * ka; vm.rotation.x -= ka * 0.2; }
        }
        me.sprintK = (me.sprintK || 0) + ((me.sprinting ? 1 : 0) - (me.sprintK || 0)) * Math.min(1, dt * 10);
        { // the feel of holding a real gun: it lags behind your aim, breathes, tilts as you strafe, dips when you land,
          // and each shot kicks it back and up with a little roll before it settles
          const F = me.vmF || (me.vmF = { x: 0, y: 0, vx: 0, vy: 0, t: 0 }), aim = 1 - 0.75 * me.ads;
          for (const [a, k] of [['x', -lookDX], ['y', lookDY]]) { F['v' + a] += (k * 0.6 - 90 * F[a] - 14 * F['v' + a]) * dt; F[a] += F['v' + a] * dt; F[a] = Math.max(-1.2, Math.min(1.2, F[a])); }
          F.t += dt; const br = Math.sin(F.t * 1.7), still = 1 - Math.min(1, sp / 2);
          const side = (me.vx * Math.cos(me.yaw) - me.vz * Math.sin(me.yaw)) / 6;
          me.landK = Math.max(0, (me.landK || 0) - dt * 3); me.shotK = Math.max(0, (me.shotK || 0) - dt * 14);
          vm.position.x += F.x * 0.012 * aim; vm.position.y += (F.y * 0.01 + br * 0.0016 * still) * aim - me.landK * 0.035 * Math.sin(Math.min(1, me.landK) * Math.PI);
          vm.position.z += me.shotK * 0.022;
          vm.rotation.y += F.x * 0.05 * aim; vm.rotation.x += (F.y * 0.035 + br * 0.004 * still) * aim + me.shotK * 0.05;
          vm.rotation.z += (F.x * 0.06 - Math.max(-1, Math.min(1, side)) * 0.07) * aim + me.shotK * (me.shotRoll || 0) * 0.05;
        }
        if (me.sprintK > 0.01) { vm.rotation.x -= 0.32 * me.sprintK; vm.rotation.y += 0.45 * me.sprintK * S.hand; vm.position.y -= 0.035 * me.sprintK; vm.position.x -= 0.03 * me.sprintK * S.hand; }   // gun lowered while sprinting
        if (vm.userData.sc == null) vm.userData.sc = vm.scale.x;
        vm.scale.setScalar(vm.userData.sc);
        if (me.inspect > 0 && me.inspectStyle) applyInspect(vm, me.inspectStyle, (2.2 - me.inspect) / 2.2);
        if (me.inspect > 0 && me.inspectStyle === 'mythic' && parts && Math.random() < dt * 22) {   // Mythic: sparks fly off the gun
          const f = 0.55 + Math.random() * 0.3, sx = (Math.random() - 0.3) * 0.3, cy = Math.cos(me.yaw), sy = Math.sin(me.yaw);
          parts.emit(cam.position.x - sy * f + cy * sx, cam.position.y - 0.18 + Math.random() * 0.1, cam.position.z - cy * f - sy * sx, { n: 3, colors: [me.inspectGlow, '#ffffff'], speed: 0.6, up: 0.5, size: 0.012, life: 0.5 });
        }
        const ud = vm.userData;
        if (animReload) reloadPose(vm, w, me.reload > 0 && w ? 1 - me.reload / w.reload : -1);
        if (ud.flop) {   // floppy: each joint is a damped spring kicked by turning, walking, swinging and stroking
          const F = ud.flopS || (ud.flopS = { x: 0, y: 0, vx: 0, vy: 0 }), stroking = me.inspect > 0 && me.inspectStyle === 'stroke';
          const kick = { x: -lookDY * 0.9 + Math.cos(bob * 2) * 0.6 * Math.min(1, sp / 4) + (me.knifeSwing > 0 ? 9 : 0) + (stroking ? Math.sin(me.inspect * 22) * 7 : 0), y: lookDX * 0.9 };
          for (const a of ['x', 'y']) { F['v' + a] += (kick[a] - 55 * F[a] - 3.2 * F['v' + a]) * dt; F[a] += F['v' + a] * dt; F[a] = Math.max(-0.7, Math.min(0.7, F[a])); }
          ud.flop.forEach((j, i) => { j.rotation.x = F.x * (0.25 + i * 0.12) - 0.04 * i; j.rotation.y = F.y * (0.25 + i * 0.12); });
          if (ud.strokeHand) {
            ud.strokeHand.visible = stroking;
            if (stroking) { const k = Math.sin(me.inspect * 11); ud.strokeHand.position.z = -0.11 + k * 0.09; ud.strokeHand.rotation.z = k * 0.15; if ((ud.lastK || 0) * k < 0 && k > 0) audio.play('squelch', 0.6); ud.lastK = k; }
          }
        }
        if (me.ads > 0.001 && (vm.userData.sight || vm.userData.iron)) {   // aim down sights: bring the sight line onto the view line
          const sc = vm.userData.sc, sg = vm.userData.sight || vm.userData.iron, k = me.ads, pistolV = (W_BY_ID[(curWeapon() || {}).id] || {}).cat === 'pistol';
          const relief = vm.userData.optic ? (EYE_RELIEF[vm.userData.optic] || 0.2) : pistolV ? 0.42 : EYE_RELIEF.iron;
          vm.position.lerp(new THREE.Vector3(-sg.x * sc, -sg.y * sc, -relief - sg.z * sc + camKick * 0.6), k);
          vm.rotation.set(vm.rotation.x * (1 - k) + camKick * 0.8 * k, vm.rotation.y * (1 - k), vm.rotation.z * (1 - k));
          const arc = Math.sin(k * Math.PI);   // R6-style: the gun rolls in and dips slightly on its way up to the eye, then settles dead level
          vm.rotation.z += arc * 0.16 * S.hand; vm.position.y -= arc * 0.014; vm.position.x += arc * 0.01 * S.hand;
        }
      }
      if (parts) parts.tick(dt);
      stepCasings(dt);
      if (W) {   // first-person arms catch the sun only when you stand in it (from the same baked shadows as the map)
        const sv = W.sunAt(cam.position.x, cam.position.y - 0.25, cam.position.z); vmSunK += (sv - vmSunK) * Math.min(1, dt * 8);
        W.probeAt(cam.position.x, cam.position.z, vmProbe); vmProbeK += ((vmProbe[0] + vmProbe[1] + vmProbe[2]) / 3 - vmProbeK) * Math.min(1, dt * 6);   // the light probes: arms darken deep indoors
        vmSun.intensity = (W.B.sunI || 2.4) * 0.75 * vmSunK; vmHemi.intensity = (W.B.ambI || 1.1) * 1.4 * vmProbeK; vmFill.intensity = (W.B.ambI || 1.1) * (0.35 + 0.3 * (1 - vmSunK)) + (W.B.sunI || 2.4) * 0.12 * vmSunK;
        const yw = cam.rotation.y, lx = sunDir[0], lz = sunDir[2], c = Math.cos(-yw), s2 = Math.sin(-yw); vmSun.position.set(lx * c + lz * s2, sunDir[1], -lx * s2 + lz * c);
      }
      if (W) W.sortChunks(cam);
      if (culler) culler.update(cam.position, (x, z) => W.groundAt(x, z, cam.position.y));
      if (dsh && W) dsh.update(renderer, scene, cam, LIGHT.sunDir.value);
      if (sky) { sky.position.set(cam.position.x, 0, cam.position.z); if (sky.userData.drift) sky.userData.drift.x += dt * 0.0015; }
      // ---- draw ----
      for (const sp of W.spinners || []) sp.rotation.y += dt * 0.5;   // mirror balls
      animateGlow(now, dt);   // Mythic finishes and outfits: pulsing, crawling veins
      if (postOn()) {
        const rt = postTarget(); renderer.setRenderTarget(rt);
        renderer.clear(); renderer.render(scene, cam);
        post.mat.uniforms.camNF.value.set(cam.near, cam.far, Math.tan(cam.fov * Math.PI / 360));
        post.mat.uniforms.exposure.value = 1.08 * (S.bright || 1);   // the player's brightness setting
        post.mat.uniforms.upV.value.set(0, 1, 0).transformDirection(cam.matrixWorldInverse); post.mat.uniforms.ssrK.value = W && W.B && W.B.wet != null ? W.B.wet : 2.2;   // how wet this map is (rain, polish)
        renderer.setRenderTarget(post.vt); const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(); renderer.setClearColor(0x000000, 0); renderer.clear();
        if ((vm && vm.visible) || (svm && svm.visible)) renderer.render(vmScene, vmCam);
        renderer.setClearColor(cc, ca);
        renderer.setRenderTarget(null); post.mat.uniforms.tex.value = rt.texture; post.mat.uniforms.vmTex.value = post.vt.texture; post.mat.uniforms.ads.value = vm && vm.visible ? me.ads : 0; post.mat.uniforms.time.value = (post.mat.uniforms.time.value + dt) % 100; renderer.render(post.scene, post.cam);
      } else { renderer.toneMappingExposure = 1.08 * (S.bright || 1); renderer.clear(); renderer.render(scene, cam); renderer.clearDepth(); if ((vm && vm.visible) || (svm && svm.visible)) renderer.render(vmScene, vmCam); }
      // ---- HUD (throttled) ----
      hudT += dt; radarT += dt;
      hud.flashAmt(me.flash > 1.5 ? 1 : me.flash / 1.5);
      hud.setScope(me.alive && me.scoped > 0 && w && w.zoom, (w && myAtt(w.id) && myAtt(w.id).reticle) || 'duplex');
      hud.setAds(me.alive && me.ads > 0.85 && vm && vm.userData && ['acog', 'reddot', 'holo'].includes(vm.userData.optic) ? vm.userData.optic : null);   // every optic: the sight picture fills the view
      const spreadPx = (w ? spreadOf(w, me, me.scoped > 0, me.spray) : 0) * 600;
      hud.xh(spreadPx, me.alive && !(me.scoped && w && w.zoom) && !uiOpen && me.ads < 0.3);
      if (hudT > 0.066) {
        hudT = 0;
        const hpShown = spectating ? spectating.hp : me.hp;
        hud.vitals(hpShown, spectating ? (spectating.armor || 0) : me.armor, me.helmet);
        hud.money(me.money, canBuy());
        const it = me.inv[me.cur];
        const ammoTxt = spectating ? `${esc(itemName(spectating.wid || 'knife'))}` : me.cur === 4 ? `${esc(itemName(me.nades[me.nadeSel] || ''))}` : w && w.cat !== 'knife' && it ? `${it.ammo}<small> / ${it.reserve}</small>` : '';
        if (SC && SC.melee !== lastMelee) { lastMelee = SC.melee; setViewModel(); }   // the club's sabers swap in as soon as the level says so
        const slotHtml = [1, 2, 3, 6, 4, 5].map((s) => s === 4 ? (me.nades.length ? `<div class="slot ${me.cur === 4 ? 'on' : ''}"><b>4</b>${me.nades.map((n) => `<img src="${weaponIcon(n)}">`).join('')}</div>` : '') : me.inv[s] ? `<div class="slot ${me.cur === s ? 'on' : ''}"><b>${s === 6 ? 3 : s}</b><img src="${weaponIcon(s === 5 ? 'c4' : me.inv[s].wid)}">${esc(s === 5 ? 'C4 Bomb' : s === 6 ? 'Zap-27' : s === 3 && SC && SC.melee ? 'Dildo Saber' : s === 3 && mode !== 'story' && (loadout[me.team] || {}).knife ? (itemInfo((loadout[me.team] || {}).knife) || {}).wpn || 'Knife' : itemName(me.inv[s].wid))}</div>` : '').join('');
        hud.ammo(ammoTxt, me.alive ? slotHtml : '');
        hud.loc(W.zoneAt(me.x, me.z));
        const teams = { T: [], CT: [] };
        teams[me.team].push(me.alive);
        for (const p of st.players.values()) if (teams[p.team]) teams[p.team].push(p.alive);
        hud.timer(st.timer, st.bomb && st.bomb.s === 'planted', st.score, teams, me.team);
        // progress bars + hints
        const planting = me.planting || 0;
        if (planting > 0) hud.progress('Planting the bomb…', planting);
        else if (st.bomb && st.bomb.s === 'planted' && st.bomb.d > 0) hud.progress(me.team === 'CT' ? 'Defusing…' : 'The bomb is being defused!', st.bomb.d);
        else hud.progress(null);
        let hint = '';
        if (st.phase === 'freeze' && mode !== 'story') hint = `Buy time · ${Math.ceil(st.timer)}s · ${mob ? 'tap BUY' : 'press B'}`;
        else if (me.alive && me.inv[5] && W.siteAt(me.x, me.z) && (!MODES[mode].bombSite || MODES[mode].bombSite === W.siteAt(me.x, me.z))) hint = me.cur === 5 ? 'Hold fire or E to plant' : 'Press 5 to take out the bomb';
        else if (me.alive && me.team === 'CT' && st.bomb && st.bomb.s === 'planted' && Math.hypot(st.bomb.x - me.x, st.bomb.z - me.z) < 1.8) hint = `Hold E to defuse${me.defuser ? ' (kit: 5s)' : ' (10s)'}`;
        else { const d = me.alive && nearestDrop(); if (d) hint = `E: pick up ${itemName(d.wid)}`; }
        if (match && !started && session) hint = 'Lobby: start the match from the panel';
        hud.hint(hint);
        hud.spec(spectating ? `Spectating ${(st.roster.get(spectating.id) || {}).name || ''} · ${itemName(spectating.wid) || ''} · ${mob ? 'tap' : 'click'} for next` : !me.alive && st.phase !== 'warmup' ? 'You are dead' : '');
      }
      if (radarT > 0.1) {
        radarT = 0;
        const list = [{ x: me.x, z: me.z, team: me.team, alive: me.alive }];
        for (const p of st.players.values()) { if (p.team === me.team) list.push(p); else if (p.alive && W.los({ x: me.x, y: me.y + 1.6, z: me.z }, { x: p.x, y: p.y + 1.3, z: p.z }) && !smokeBetween({ x: me.x, z: me.z }, p)) list.push({ ...p, spotted: true }); }
        hud.drawRadar(spectating ? { x: spectating.x, z: spectating.z, yaw: spectating.yaw } : me, list, st.bomb ? { s: st.bomb.s, x: st.bomb.x, z: st.bomb.z } : null);
      }
      sbT += dt;
      if (showSb && sbT > 0.25) {
        sbT = 0;
        const rows = match ? match.scoreboard() : [...st.roster.values()].map((r) => { const p = st.players.get(r.id) || {}; return { id: r.id, name: r.name, team: r.team, bot: r.bot, k: r.k || 0, a: 0, d: 0, mvp: 0, score: 0, money: p.money || 0, alive: r.id === myId ? me.alive : p.alive }; });
        hud.scoreboard(true, { players: rows, me: myId, myTeam: me.team, score: st.score, round: st.round, history: st.history, title: `${MODES[mode].name} · ${MAPS[mapId].name}` });
      } else if (!showSb) hud.scoreboard(false);
    });

    // ---- the end ----
    async function finish(d) {
      if (ended) return; ended = true;
      document.exitPointerLock && document.exitPointerLock();
      const won = d.winner === me.team, draw = !d.winner;
      const mine = (d.players || []).find((p) => p.id === myId) || { k: stats.k, d: stats.d, a: stats.a, mvp: stats.mvp, hs: stats.hs };
      const set = hud.endScreen({ title: draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT', score: d.score, me: mine }, quit);
      audio.play(won ? 'win' : 'lose');
      const humans = match ? [...match.players.values()].filter((p) => !p.bot).length : st.roster.size ? [...st.roster.values()].filter((r) => !r.bot).length : 1;
      const res = await profile.matchDone({ ...stats, k: mine.k, d: mine.d, hs: mine.hs, mvp: mine.mvp, win: won ? 1 : 0, draw, rounds: st.round, botsOnly: humans <= 1 });
      const ups = await saveGunXp();
      const lv = ups.filter((u) => u.to > u.from).map((u) => `${W_BY_ID[u.wid].name} → Lv ${u.to}${u.to >= 10 ? ' ★ PRESTIGE (suppressor)' : ''}${unlocksAt(u.wid, u.to).length ? ' (new: ' + unlocksAt(u.wid, u.to).join(', ') + ')' : ''}`);
      let rk = '';
      if (ranked && !smoke) {   // the Rank Rating result (worked out on the server for accounts)
        const enemy = won ? null : null, vsBots = match ? [...match.players.values()].some((q) => q.bot && q.team !== me.team) : true; void enemy;
        const r = await profile.rankedDone({ win: !!won, draw, k: mine.k, d: mine.d, vsBots });
        if (r && !r.error) { const R = RANKS[r.tier] || RANKS[0], pl = r.n <= PLACEMENTS;
          rk = ` · RANKED ${r.delta >= 0 ? '+' : ''}${r.delta} RR → ${pl ? `placement ${r.n}/${PLACEMENTS}` : R.name + ' (' + r.rr + ' RR)'}${r.up && !pl ? ' · RANK UP!' : ''}${r.pay ? ' · +' + r.pay + ' coins' : ''}`;
          if (r.up && !pl) toast('🏆 RANK UP: ' + R.name); }
        else if (r && r.error) rk = ' · ranked result not saved: ' + r.error;
      }
      set(`+${res.coins} coins · +${res.xp} XP${res.coins === 0 && profile.signedIn ? ' (daily coin limit reached)' : ''}${lv.length ? ' · ' + lv.join(' · ') : ''}${rk}`);
    }
    function quit(next) {
      ended = true; saveGunXp();
      try { loopH.stop(); } catch (e) { /* already stopped */ }
      if (hiddenTick) hiddenTick.terminate();
      try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { /* not locked */ }
      if (mob) mob.destroy(); removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('mousemove', onMove); removeEventListener('mouseup', onUp); removeEventListener('resize', resize);
      document.removeEventListener('pointerlockchange', onLock);
      if (session) session.leave(); if (lobby) lobby.close();
      if (lobbyPanel) { clearInterval(lobbyPanel.iv); lobbyPanel.remove(); }
      if (SC) { SC.dispose(); SC = null; }
      hud.destroy(); renderer.dispose(); renderer.domElement.remove();
      document.querySelectorAll('.bd-stick,.bd-btns,.bd-look').forEach((e) => e.remove());
      history.replaceState(null, '', location.pathname);
      if (next && (next.story || next.code)) runMatch(next); else if (!smoke) showMenu();
    }
    window.__cs = { audio, me, st, scene, cam, renderer, mouseBtn, gfx, get SC() { return SC; }, camp, get mapId() { return mapId; }, get culler() { return culler; }, get dsh() { return dsh; }, set dsh(v) { dsh = v; }, get W() { return W; }, get match() { return match; }, get parts() { return parts; }, hud, switchTo, fire: (alt) => fire(!!alt), post, get ui() { return uiOpen; }, get locked() { return locked; } }; if (smoke) { me.alive = true; window.__csSmoke = window.__cs; }
  }
}
