// KYS:GO — Aim Trainer. A standalone practice range: precision / tracking / flick drills,
// any weapon, configurable targets, scored runs with personal bests in localStorage.
//
// Launched from the main menu (Menu.tab_aim -> h.aim(cfg)); owns its own renderer, scene,
// HUD and input until the player quits, then calls onExit() (the menu is re-shown).
import * as THREE from '../sdk/three.module.min.js';
import { WEAPONS, W_BY_ID } from './data.js';
import { makeGun, skinTexture } from './models.js';
import { itemInfo } from './skins.js';

export const AIM_PB_KEY = 'cs:aimpb:v1';
export function getAimPB() { try { return JSON.parse(localStorage.getItem(AIM_PB_KEY) || '{}'); } catch (e) { return {}; } }
function saveAimPB(pb) { try { localStorage.setItem(AIM_PB_KEY, JSON.stringify(pb)); } catch (e) { /* private mode */ } }
export const aimPBKey = (drill, wid, size) => `${drill}|${wid}|${size}`;

export const AIM_DRAINS = {
  precision: { name: 'Precision', icon: '🎯', desc: 'Static targets on the wall. Clear them all as fast as you can — every miss costs you.' },
  tracking: { name: 'Tracking', icon: '🛰️', desc: 'One target glides around the range. Keep your crosshair glued to it and hold fire.' },
  flick: { name: 'Flick', icon: '⚡', desc: 'Targets pop up for a split second. Snap to them and shoot before they vanish.' },
};
export const AIM_SIZES = { S: { name: 'Small', r: 0.11 }, M: { name: 'Medium', r: 0.17 }, L: { name: 'Large', r: 0.25 } };
export const AIM_SPEEDS = { slow: { name: 'Slow', v: 1.6 }, normal: { name: 'Normal', v: 2.8 }, fast: { name: 'Fast', v: 4.2 } };
export const AIM_PACES = { relaxed: { name: 'Relaxed', max: 1, life: 2.4 }, normal: { name: 'Normal', max: 2, life: 1.7 }, hectic: { name: 'Hectic', max: 3, life: 1.15 } };
export const AIM_DURS = [30, 60, 120];
export const aimWeapons = () => WEAPONS.filter((w) => ['pistol', 'smg', 'rifle', 'sniper', 'heavy'].includes(w.cat));
export const defaultAimCfg = () => ({ drill: 'precision', weapon: 'ak47', size: 'M', speed: 'normal', pace: 'normal', dur: 60, sens: 1.0 });

// ---- tiny synth: shots, hits, UI. No assets, no downloads -------------------------------------------
function makeAimAudio() {
  let ctx = null;
  const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; };
  const noiseBuf = (c) => { const b = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  let nb = null;
  function burst(dur, freq, vol, type = 'lowpass', slide = 0) {
    const c = ac(); if (!c) return; if (!nb) nb = noiseBuf(c);
    const t = c.currentTime, s = c.createBufferSource(); s.buffer = nb; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  function tone(freq, dur, vol, type = 'sine', slide = 0, delay = 0) {
    const c = ac(); if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const CATP = { pistol: 0, smg: 1, rifle: 2, heavy: 3, sniper: 4 };
  return {
    unlock() { ac(); },
    shot(cat, quiet) { const k = CATP[cat] || 0, v = quiet ? 0.10 : 0.22; burst(0.14 + k * 0.03, 2600 - k * 380, v, 'lowpass', -2200); tone(120 - k * 12, 0.09, v * 0.8, 'triangle', -60); },
    dry() { tone(1400, 0.03, 0.08, 'square'); },
    reload() { tone(500, 0.05, 0.10, 'square'); tone(700, 0.05, 0.10, 'square', 0, 0.16); tone(950, 0.06, 0.12, 'square', 0, 0.34); },
    hit() { tone(1180, 0.07, 0.14, 'sine'); },
    brk() { burst(0.16, 900, 0.20, 'bandpass', -500); tone(320, 0.12, 0.16, 'triangle', -180); },
    expire() { tone(220, 0.18, 0.10, 'sawtooth', -80); },
    count(final) { tone(final ? 880 : 440, final ? 0.28 : 0.12, 0.16, 'sine'); },
    ui() { tone(660, 0.05, 0.08, 'sine'); },
  };
}

// ---- range environment: a clean, bright indoor range -----------------------------------------------
function targetFaceTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#f4f2ec'; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
  x.fillStyle = '#d8362a'; x.beginPath(); x.arc(128, 128, 96, 0, 7); x.fill();
  x.fillStyle = '#f4f2ec'; x.beginPath(); x.arc(128, 128, 62, 0, 7); x.fill();
  x.fillStyle = '#d8362a'; x.beginPath(); x.arc(128, 128, 30, 0, 7); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 4; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.stroke();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function floorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#c9ced4'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(90,100,112,.28)'; x.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 8); t.anisotropy = 4; return t;
}
function buildRange(scene) {
  const solids = [];
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8ebef, roughness: 0.94, metalness: 0 });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.9, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 56), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -12); floor.receiveShadow = true; scene.add(floor); solids.push(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(70, 10), wallMat);
  back.position.set(0, 5, -14); scene.add(back); solids.push(back);
  const mkSide = (sx) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(56, 10), wallMat); w.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; w.position.set(sx * 22, 5, -12); scene.add(w); solids.push(w); };
  mkSide(1); mkSide(-1);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(70, 56), new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 9, -12); scene.add(ceil);
  // glowing ceiling panels: the "well-lit" part
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = -1; i <= 1; i++) for (let j = 0; j < 3; j++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.4), panelMat);
    p.rotation.x = Math.PI / 2; p.position.set(i * 9, 8.94, -6 - j * 8); scene.add(p);
  }
  // distance marker stripes on the floor (5m .. 20m from the shooter)
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0x3a7bd5 });
  const labelC = document.createElement('canvas'); labelC.width = 256; labelC.height = 64;
  for (let d = 5; d <= 10; d += 5) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.18), stripeMat);
    s.rotation.x = -Math.PI / 2; s.position.set(0, 0.012, 2 - d); scene.add(s);
    const lx = labelC.getContext('2d'); lx.clearRect(0, 0, 256, 64); lx.fillStyle = '#3a7bd5'; lx.font = 'bold 40px system-ui'; lx.textAlign = 'center'; lx.fillText(d + 'm', 128, 48);
    const lt = new THREE.CanvasTexture(labelC);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: lt, transparent: true }));
    lab.rotation.x = -Math.PI / 2; lab.position.set(3.6, 0.012, 2 - d); scene.add(lab);
  }
  // target wall frame: a dark backboard band so targets read clearly
  const board = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.4), new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.9 }));
  board.position.set(0, 2.6, -13.9); scene.add(board); solids.push(board);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa2ab, 1.15));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1); sun.position.set(6, 12, 6); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.45); fill.position.set(-6, 8, -18); scene.add(fill);
  scene.background = new THREE.Color(0x11141a); scene.fog = new THREE.Fog(0x11141a, 40, 90);
  return { solids, wallZ: -13.9 };
}

// ---- targets --------------------------------------------------------------------------------------
let _faceTex = null;
function makeTarget(radius) {
  if (!_faceTex) _faceTex = targetFaceTexture();
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, radius * 0.16, 28), new THREE.MeshStandardMaterial({ color: 0x23282e, roughness: 0.7, metalness: 0.2 }));
  rim.rotation.x = Math.PI / 2; g.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 28), new THREE.MeshStandardMaterial({ map: _faceTex, roughness: 0.85, metalness: 0 }));
  face.position.z = radius * 0.085; g.add(face);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.6, metalness: 0.5 }));
  pole.position.y = -0.5; g.add(pole);   // repositioned by placeTarget
  g.userData.face = face; g.userData.rim = rim;
  return g;
}
function placeTarget(g, x, y, wallZ) {
  g.position.set(x, y, wallZ + 0.06);
  const pole = g.children[2]; const len = Math.max(0.1, y);
  pole.scale.y = len; pole.position.y = -len / 2 - 0.02;
  g.scale.setScalar(0.01); g.userData.spawnA = 0;   // pop-in animation
}
const randPos = (spanX, minY, maxY) => ({ x: (Math.random() * 2 - 1) * spanX, y: minY + Math.random() * (maxY - minY) });

// ---- floating score popups (HTML) ------------------------------------------------------------------
function spawnPop(root, x, y, text, color) {
  const d = document.createElement('div'); d.className = 'aim-pop';
  d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.color = color || '#ffd24a';
  root.appendChild(d); setTimeout(() => d.remove(), 900);
}

// ---- the trainer ----------------------------------------------------------------------------------
export function startAimTrainer({ onExit, toast, profile, initial }) {
  const cfg = { ...defaultAimCfg(), ...(initial || {}) };
  const w = W_BY_ID[cfg.weapon] && ['pistol', 'smg', 'rifle', 'sniper', 'heavy'].includes(W_BY_ID[cfg.weapon].cat) ? W_BY_ID[cfg.weapon] : W_BY_ID.ak47;
  const audio = makeAimAudio();
  const root = document.createElement('div'); root.className = 'aim-root';
  root.innerHTML = `
    <div class="aim-hud">
      <div class="aim-top"><div class="aim-drill"></div><div class="aim-timer">--</div><div class="aim-scorebox"><div class="aim-score">0</div><div class="aim-acc"></div></div></div>
      <div class="aim-cross"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="dot"></i></div>
      <div class="aim-hitmark"><i></i><i></i><i></i><i></i></div>
      <div class="aim-ammo"><b>--</b><span></span></div>
      <div class="aim-hint">LMB fire · RMB aim · R reload · ESC pause</div>
      <div class="aim-feed"></div>
      <div class="aim-count"></div>
      <div class="aim-pause" style="display:none"><div class="aim-card"><h2>Paused</h2>
        <button class="aim-btn" data-p="resume">Resume</button>
        <button class="aim-btn alt" data-p="restart">Restart drill</button>
        <button class="aim-btn alt" data-p="quit">Quit to menu</button></div></div>
      <div class="aim-results" style="display:none"></div>
      <div class="aim-touch" style="display:none"><button data-t="fire">FIRE</button><button data-t="ads">ADS</button><button data-t="reload">RLD</button></div>
    </div>`;
  const css = document.createElement('style'); css.textContent = `
    .aim-root{position:fixed;inset:0;z-index:300;background:#000;font-family:system-ui,sans-serif;overflow:hidden}
    .aim-root canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
    .aim-hud{position:absolute;inset:0;pointer-events:none;color:#eef2f6;user-select:none;-webkit-user-select:none}
    .aim-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;padding:14px 20px}
    .aim-drill{font:700 15px system-ui;letter-spacing:.08em;text-transform:uppercase;color:#9fb4c8;text-shadow:0 2px 8px #000}
    .aim-timer{font:800 34px system-ui;text-shadow:0 2px 10px #000}
    .aim-timer.low{color:#ff5a4a}
    .aim-scorebox{text-align:right}.aim-score{font:800 30px system-ui;color:#ffd24a;text-shadow:0 2px 10px #000}
    .aim-acc{font:600 13px system-ui;color:#9fb4c8;text-shadow:0 2px 6px #000}
    .aim-cross{position:absolute;left:50%;top:50%;width:0;height:0;--gap:6px}
    .aim-cross i{position:absolute;background:#fff;box-shadow:0 0 4px #000}
    .aim-cross .t{left:-1px;top:calc(-1*var(--gap) - 8px);width:2px;height:8px}
    .aim-cross .b{left:-1px;top:var(--gap);width:2px;height:8px}
    .aim-cross .l{top:-1px;left:calc(-1*var(--gap) - 8px);height:2px;width:8px}
    .aim-cross .r{top:-1px;left:var(--gap);height:2px;width:8px}
    .aim-cross .dot{left:-1.5px;top:-1.5px;width:3px;height:3px;border-radius:50%}
    .aim-hitmark{position:absolute;left:50%;top:50%;opacity:0}
    .aim-hitmark i{position:absolute;width:2.5px;height:11px;background:#fff;box-shadow:0 0 6px #000}
    .aim-hitmark i:nth-child(1){transform:translate(-9px,-14px) rotate(-45deg)}
    .aim-hitmark i:nth-child(2){transform:translate(7px,-14px) rotate(45deg)}
    .aim-hitmark i:nth-child(3){transform:translate(-9px,3px) rotate(45deg)}
    .aim-hitmark i:nth-child(4){transform:translate(7px,3px) rotate(-45deg)}
    .aim-hitmark.show{animation:aimhm .22s ease-out}
    .aim-hitmark.kill i{background:#ff4a3a}
    @keyframes aimhm{0%{opacity:1;transform:scale(1.35)}100%{opacity:0;transform:scale(0.9)}}
    .aim-ammo{position:absolute;right:22px;bottom:20px;text-align:right;text-shadow:0 2px 8px #000}
    .aim-ammo b{font:800 34px system-ui}.aim-ammo b.low{color:#ff5a4a}
    .aim-ammo span{display:block;font:600 12px system-ui;color:#9fb4c8;letter-spacing:.06em}
    .aim-hint{position:absolute;left:22px;bottom:20px;font:500 12px system-ui;color:#8b98a6;text-shadow:0 2px 6px #000}
    .aim-feed{position:absolute;left:50%;top:58%;transform:translateX(-50%);text-align:center;font:700 15px system-ui;text-shadow:0 2px 6px #000}
    .aim-pop{position:absolute;transform:translate(-50%,-50%);font:800 18px system-ui;text-shadow:0 2px 8px #000;animation:aimpop .9s ease-out forwards;pointer-events:none}
    @keyframes aimpop{0%{opacity:0;margin-top:6px}15%{opacity:1}100%{opacity:0;margin-top:-34px}}
    .aim-count{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 120px system-ui;color:#fff;text-shadow:0 6px 40px #000}
    .aim-pause,.aim-results{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,10,14,.72);pointer-events:auto}
    .aim-card{background:#151b24;border:1px solid #2c3442;border-radius:12px;padding:28px 32px;min-width:320px;max-width:min(560px,92vw);max-height:88vh;overflow:auto;text-align:center}
    .aim-card h2{margin:0 0 6px;font:800 24px system-ui}
    .aim-card p{color:#9fb4c8;font-size:14px;margin:0 0 14px}
    .aim-btn{display:block;width:100%;margin:8px 0;padding:12px;background:#f2a33a;border:none;border-radius:8px;font:800 15px system-ui;color:#14100a;cursor:pointer}
    .aim-btn.alt{background:#232b36;color:#dfe6ee;border:1px solid #39434f}
    .aim-btn:hover{filter:brightness(1.12)}
    .aim-statgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0;text-align:left}
    .aim-stat{background:#0f141b;border:1px solid #242c37;border-radius:8px;padding:10px 12px}
    .aim-stat small{display:block;color:#8b98a6;font:600 11px system-ui;letter-spacing:.06em;text-transform:uppercase}
    .aim-stat b{font:800 20px system-ui}
    .aim-best{margin:10px 0;padding:10px;border-radius:8px;background:rgba(255,210,74,.08);border:1px solid #6b5a22;font:600 13px system-ui;color:#ffd24a}
    .aim-touch{position:absolute;right:14px;bottom:90px;display:flex;flex-direction:column;gap:10px;pointer-events:auto}
    .aim-touch button{width:74px;height:74px;border-radius:50%;border:2px solid #4a5665;background:rgba(20,26,34,.7);color:#fff;font:800 13px system-ui}
    .aim-touch button.on{background:#f2a33a;color:#14100a}`;
  root.appendChild(css); document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  let raf = 0, dead = false, listenersOn = false;   // declared early: cleanup() can run from the WebGL-failure path below

  // renderer / scene
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) { cleanup(); (toast || (() => {}))('WebGL unavailable'); onExit(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  root.insertBefore(renderer.domElement, root.firstChild);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 220);
  camera.position.set(0, 1.62, 2); scene.add(camera);
  const { solids, wallZ } = buildRange(scene);

  // viewmodel gun (player's equipped skin when available)
  let gun = null;
  try {
    let tex = null;
    if (profile && profile.loadoutFor) { const lo = profile.loadoutFor('CT'), sk = lo.skins && lo.skins[w.id]; if (sk) { const si = itemInfo(sk); if (si) tex = skinTexture(sk, si); } }
    gun = makeGun(w.id, tex, '#33445c', '#1e2126', true, null);
  } catch (e) { gun = null; }
  const small = w.cat === 'pistol';
  const gunBase = new THREE.Vector3(0.21, -0.235, -0.5), gunAds = new THREE.Vector3(0, -0.168, -0.34);
  if (gun) { gun.scale.setScalar(small ? 0.62 : 0.85); gun.position.copy(gunBase); camera.add(gun); }
  const muzzleV = new THREE.Vector3();

  // state
  const sizeR = (AIM_SIZES[cfg.size] || AIM_SIZES.M).r;
  const S = {
    phase: 'count', t: 0, countT: 0, dur: cfg.dur, elapsed: 0,
    yaw: 0, pitch: 0, sens: cfg.sens,
    ammo: w.mag, reloading: 0, lastShot: -9, bloom: 0, gunKick: 0, adsK: 0,
    triggerHeld: false, burstLeft: 0, mouseDown: false, rmb: false,
    shots: 0, hits: 0, kills: 0, streak: 0, bestStreak: 0, damage: 0,
    reacts: [], expired: 0, onTargetT: 0, cleared: 0, total: cfg.drill === 'precision' ? 24 : 0,
    targets: [], parts: [], tracers: [], decals: [],
    over: false, paused: false,
  };
  const isTouch = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
  if (isTouch) { $('.aim-touch').style.display = 'flex'; $('.aim-hint').textContent = 'Drag to look · FIRE to shoot'; }

  const drillEl = $('.aim-drill'), timerEl = $('.aim-timer'), scoreEl = $('.aim-score'), accEl = $('.aim-acc'),
    ammoEl = $('.aim-ammo b'), ammoName = $('.aim-ammo span'), crossEl = $('.aim-cross'), hitmarkEl = $('.aim-hitmark'),
    feedEl = $('.aim-feed'), countEl = $('.aim-count');
  drillEl.textContent = `${AIM_DRAINS[cfg.drill].icon} ${AIM_DRAINS[cfg.drill].name} · ${w.name}`;
  ammoName.textContent = w.name;
  const acc = () => S.shots ? S.hits / S.shots : 0;
  const hudCache = {};
  const setText = (el, key, txt) => { if (hudCache[key] !== txt) { hudCache[key] = txt; el.textContent = txt; } };
  function refreshHud() {
    const left = Math.max(0, S.dur - S.elapsed);
    setText(timerEl, 't', S.phase === 'count' ? 'GET READY' : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`);
    timerEl.classList.toggle('low', left < 10 && S.phase === 'run');
    setText(scoreEl, 's', score().toLocaleString());
    setText(accEl, 'a', S.shots ? `${Math.round(acc() * 100)}% acc · ${S.streak}🔥` : '—');
    setText(ammoEl, 'm', S.reloading > 0 ? '--' : String(S.ammo));
    ammoEl.classList.toggle('low', S.ammo <= Math.ceil(w.mag * 0.25));
    crossEl.style.setProperty('--gap', `${5 + (w.inacc[0] + S.bloom) * 900}px`);
  }
  function feed(t, ms = 1400) { feedEl.textContent = t; clearTimeout(feedEl._t); feedEl._t = setTimeout(() => { if (feedEl.textContent === t) feedEl.textContent = ''; }, ms); }
  function hitmark(kill) { hitmarkEl.classList.remove('show', 'kill'); void hitmarkEl.offsetWidth; if (kill) hitmarkEl.classList.add('kill'); hitmarkEl.classList.add('show'); }
  function score() {
    if (cfg.drill === 'precision') { const bonus = S.cleared >= S.total ? Math.max(0, (S.total * 1.5 - S.elapsed)) * 20 : 0; return Math.round(S.kills * 100 + bonus); }
    if (cfg.drill === 'tracking') return Math.round(S.damage + S.kills * 200);
    const spd = S.reacts.reduce((a, r) => a + Math.max(0, 1 - r.t / r.life) * 80, 0);
    return Math.max(0, Math.round(S.kills * 100 + spd - S.expired * 50));
  }

  // ---- drill setup ----------------------------------------------------------------------------------
  const ray = new THREE.Raycaster();
  const _fwd = new THREE.Vector3(), _dir = new THREE.Vector3(), _up = new THREE.Vector3(), _rt = new THREE.Vector3(), _hit = new THREE.Vector3();
  function spawnTarget(x, y, hp, life) {
    const g = makeTarget(sizeR); placeTarget(g, x, y, wallZ); scene.add(g);
    const t = { g, hp, maxHp: hp, alive: true, spawnT: S.elapsed, life: life || 0, dieT: 0, vx: 0, vy: 0, ph1: Math.random() * 7, ph2: Math.random() * 7, cx: x, cy: y };
    S.targets.push(t); return t;
  }
  function setupDrill() {
    for (const t of S.targets) scene.remove(t.g); S.targets.length = 0;
    if (cfg.drill === 'precision') { for (let i = 0; i < 8; i++) { const p = randPos(9, 0.8, 4.2); spawnTarget(p.x, p.y, 1); } }
    else if (cfg.drill === 'tracking') { const p = randPos(7, 1.2, 3.6); const t = spawnTarget(p.x, p.y, 120); t.cx = p.x; t.cy = p.y; }
    else { const pace = AIM_PACES[cfg.pace] || AIM_PACES.normal; for (let i = 0; i < pace.max; i++) flickSpawn(true); }
  }
  function flickSpawn(initial) {
    const pace = AIM_PACES[cfg.pace] || AIM_PACES.normal;
    const p = randPos(9, 0.8, 4.2);
    const t = spawnTarget(p.x, p.y, 1, pace.life * (initial ? 1.6 : 1));
    return t;
  }
  function killTarget(t, at) {
    t.alive = false; t.dieT = 0; S.kills++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
    audio.brk(); hitmark(true);
    burstParts(at, 0xd8362a, 14); burstParts(at, 0xf4f2ec, 8);
    if (cfg.drill === 'flick') { const r = S.elapsed - t.spawnT; S.reacts.push({ t: r, life: t.life }); }
    if (cfg.drill === 'precision') { S.cleared++; }
    const sp = worldToScreen(at); if (sp) spawnPop(root, sp.x, sp.y, '+100', '#ffd24a');
  }
  function worldToScreen(v) {
    _hit.copy(v).project(camera); if (_hit.z > 1) return null;
    return { x: (_hit.x * 0.5 + 0.5) * innerWidth, y: (-_hit.y * 0.5 + 0.5) * innerHeight };
  }

  // ---- particles / tracers / decals (pooled, cheap) ---------------------------------------------------
  const partGeo = new THREE.SphereGeometry(0.02, 6, 5);
  function burstParts(at, color, n) {
    for (let i = 0; i < n; i++) {
      if (S.parts.length > 160) { const p = S.parts.shift(); scene.remove(p.m); continue; }
      const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(at); scene.add(m);
      S.parts.push({ m, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3.5, vz: (Math.random() - 0.5) * 4, life: 0.55 + Math.random() * 0.3 });
    }
  }
  function tracer(from, to) {
    const g = new THREE.BufferGeometry().setFromPoints([from, to]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    scene.add(l); S.tracers.push({ l, life: 0.07 });
    if (S.tracers.length > 24) { const t = S.tracers.shift(); scene.remove(t.l); t.l.geometry.dispose(); }
  }
  function decal(at, n) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.03 + Math.random() * 0.03, 10), new THREE.MeshBasicMaterial({ color: 0x1c1f24, transparent: true, opacity: 0.85 }));
    m.position.copy(at).add(new THREE.Vector3(0, 0, 0.012)); if (n) m.lookAt(n);
    scene.add(m); S.decals.push({ m, life: 25 });
    if (S.decals.length > 60) { const d = S.decals.shift(); scene.remove(d.m); }
  }

  // ---- shooting ---------------------------------------------------------------------------------------
  function spreadNow() { return Math.min(0.09, w.inacc[0] + S.bloom); }
  function aimDir(out) {
    camera.getWorldDirection(_fwd);
    _up.set(0, 1, 0); _rt.crossVectors(_fwd, _up).normalize(); _up.crossVectors(_rt, _fwd).normalize();
    const s = spreadNow(), a = Math.random() * Math.PI * 2, r = s * Math.sqrt(Math.random());
    out.copy(_fwd).addScaledVector(_rt, Math.cos(a) * r).addScaledVector(_up, Math.sin(a) * r).normalize();
    return out;
  }
  function startReload() {
    if (S.reloading > 0 || S.ammo === w.mag || S.phase !== 'run') return;
    S.reloading = w.reload; audio.reload();
  }
  function fire() {
    if (S.phase !== 'run' || S.over || S.paused) return;
    if (S.reloading > 0) return;
    if (S.ammo <= 0) { audio.dry(); startReload(); return; }
    const now = S.t, interval = 60 / w.rpm;
    if (now - S.lastShot < interval * 0.98) return;
    S.lastShot = now; S.ammo--;
    const pellets = w.pellets || 1;
    audio.shot(w.cat, w.silenced);
    S.pitch += w.kick * (0.85 + Math.random() * 0.3); S.yaw += (Math.random() - 0.5) * w.kick * 0.7;
    S.bloom = Math.min(0.05, S.bloom + w.kick * 0.55); S.gunKick = 1;
    if (gun && gun.userData.flash) { gun.userData.flash.visible = true; clearTimeout(gun.userData._ft); gun.userData._ft = setTimeout(() => { try { gun.userData.flash.visible = false; } catch (e) {} }, 45); }
    if (gun) gun.userData.flash.getWorldPosition(muzzleV); else muzzleV.set(0.2, 1.5, 1.4);
    let anyHit = false, anyKill = false;
    for (let p = 0; p < pellets; p++) {
      S.shots++;
      aimDir(_dir);
      ray.set(camera.position, _dir); ray.far = 120;
      const meshes = []; for (const t of S.targets) if (t.alive) meshes.push(t.g);
      const th = ray.intersectObjects(meshes, true)[0];
      const sh = ray.intersectObjects(solids, false)[0];
      let end;
      if (th && (!sh || th.distance < sh.distance)) {
        let t = null, o = th.object;
        while (o) { t = S.targets.find((c) => c.alive && c.g === o); if (t) break; o = o.parent; }
        end = th.point; anyHit = true; S.hits++;
        const dmg = cfg.drill === 'tracking' ? w.dmg * 0.45 : 9999;
        if (t) {
          t.hp -= dmg; S.damage += Math.min(dmg, Math.max(0, t.hp + dmg));
          burstParts(th.point, 0xffe9a8, 4);
          if (t.hp <= 0) { killTarget(t, th.point); anyKill = true; }
          else { audio.hit(); hitmark(false); t.g.userData.face.material.emissive = new THREE.Color(0x662200); setTimeout(() => { try { t.g.userData.face.material.emissive = new THREE.Color(0x000000); } catch (e) {} }, 70); }
        }
      } else if (sh) {
        end = sh.point; burstParts(sh.point, 0xcfd6dd, 3); decal(sh.point, sh.face ? sh.point.clone().add(sh.face.normal) : null);
        S.streak = 0;
      } else { end = camera.position.clone().addScaledVector(_dir, 60); S.streak = 0; }
      if (muzzleV) tracer(muzzleV.clone(), end.clone());
    }
    if (!anyHit) S.streak = 0;
    if (S.ammo === 0) startReload();
    refreshHud();
  }

  // ---- results ----------------------------------------------------------------------------------------
  function fmtTime(s) { return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
  function endDrill(reason) {
    if (S.over) return; S.over = true; S.phase = 'done';
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
    audio.count(true);
    const key = aimPBKey(cfg.drill, w.id, cfg.size), pb = getAimPB(), prev = pb[key], sc = score();
    const isBest = !prev || sc > prev.score;
    if (isBest) { pb[key] = { score: sc, acc: Math.round(acc() * 100), date: Date.now() }; saveAimPB(pb); }
    const avgReact = S.reacts.length ? S.reacts.reduce((a, r) => a + r.t, 0) / S.reacts.length : 0;
    const drillStat = cfg.drill === 'precision'
      ? `<div class="aim-stat"><small>${S.cleared >= S.total ? 'Clear time' : 'Targets cleared'}</small><b>${S.cleared >= S.total ? fmtTime(S.elapsed) : `${S.cleared}/${S.total}`}</b></div>`
      : cfg.drill === 'tracking'
        ? `<div class="aim-stat"><small>Time on target</small><b>${S.elapsed ? Math.round(S.onTargetT / S.elapsed * 100) : 0}%</b></div><div class="aim-stat"><small>Damage dealt</small><b>${Math.round(S.damage).toLocaleString()}</b></div>`
        : `<div class="aim-stat"><small>Avg reaction</small><b>${S.reacts.length ? Math.round(avgReact * 1000) + 'ms' : '—'}</b></div><div class="aim-stat"><small>Expired</small><b>${S.expired}</b></div>`;
    const res = $('.aim-results');
    res.style.display = 'flex';
    res.innerHTML = `<div class="aim-card"><h2>${reason === 'clear' ? '🎯 Range cleared!' : '⏱️ Time!'}</h2>
      <p>${AIM_DRAINS[cfg.drill].name} · ${w.name} · ${AIM_SIZES[cfg.size].name} targets</p>
      ${isBest ? '<div class="aim-best">★ NEW PERSONAL BEST ★</div>' : prev ? `<div class="aim-best" style="border-color:#39434f;background:none;color:#9fb4c8">Personal best: ${prev.score.toLocaleString()} pts · ${prev.acc}% acc</div>` : ''}
      <div class="aim-statgrid">
        <div class="aim-stat"><small>Score</small><b style="color:#ffd24a">${sc.toLocaleString()}</b></div>
        <div class="aim-stat"><small>Accuracy</small><b>${Math.round(acc() * 100)}%</b></div>
        <div class="aim-stat"><small>Hits / Shots</small><b>${S.hits}/${S.shots}</b></div>
        <div class="aim-stat"><small>Best streak</small><b>${S.bestStreak}🔥</b></div>
        ${drillStat}
      </div>
      <button class="aim-btn" data-r="retry">↻ Run it back</button>
      <button class="aim-btn alt" data-r="setup">Change setup</button>
      <button class="aim-btn alt" data-r="quit">Back to menu</button></div>`;
    res.querySelector('[data-r="retry"]').onclick = () => { audio.ui(); restart(); };
    res.querySelector('[data-r="setup"]').onclick = () => { audio.ui(); cleanup(); onExit('aim'); };
    res.querySelector('[data-r="quit"]').onclick = () => { audio.ui(); cleanup(); onExit(); };
  }
  function restart() {
    $('.aim-results').style.display = 'none';
    Object.assign(S, { phase: 'count', countT: 0, elapsed: 0, ammo: w.mag, reloading: 0, lastShot: -9, bloom: 0, shots: 0, hits: 0, kills: 0, streak: 0, bestStreak: 0, damage: 0, reacts: [], expired: 0, onTargetT: 0, cleared: 0, over: false, paused: false });
    setupDrill(); lock();
  }

  // ---- input ------------------------------------------------------------------------------------------
  const lock = () => { try { const p = renderer.domElement.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { renderer.domElement.requestPointerLock(); } catch (e) {} }); } catch (e) { try { renderer.domElement.requestPointerLock(); } catch (e2) {} } };
  const onLockChange = () => {
    const locked = document.pointerLockElement === renderer.domElement;
    if (!locked && S.phase === 'run' && !S.over && !isTouch) {
      S.paused = true; $('.aim-pause').style.display = 'flex';
    }
  };
  const onMouseMove = (e) => {
    if (document.pointerLockElement !== renderer.domElement || S.paused) return;
    const k = 0.0022 * S.sens * (1 - S.adsK * 0.35);
    S.yaw -= e.movementX * k; S.pitch -= e.movementY * k;
    S.pitch = Math.max(-1.45, Math.min(1.45, S.pitch));
  };
  const onMouseDown = (e) => {
    audio.unlock();
    if (document.pointerLockElement !== renderer.domElement && !isTouch) { lock(); return; }
    if (e.button === 0) { S.mouseDown = true; if (!w.auto && S.phase === 'run') { fire(); if (w.burst) S.burstLeft = 2; } }
    if (e.button === 2) S.rmb = true;
  };
  const onMouseUp = (e) => { if (e.button === 0) S.mouseDown = false; if (e.button === 2) S.rmb = false; };
  const onKey = (e) => {
    if (e.code === 'KeyR') startReload();
    if (e.code === 'Escape' && S.over) { cleanup(); onExit(); }
  };
  const onCtx = (e) => e.preventDefault();
  const onResize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
  // touch: drag to look, buttons to fire/ads/reload
  let touchLook = null;
  const onTouchStart = (e) => {
    audio.unlock();
    for (const t of e.changedTouches) { if (t.target.closest && t.target.closest('.aim-touch')) continue; if (!touchLook) touchLook = { id: t.identifier, x: t.x ?? t.clientX, y: t.y ?? t.clientY }; }
  };
  const onTouchMove = (e) => {
    for (const t of e.changedTouches) {
      if (touchLook && t.identifier === touchLook.id) {
        const x = t.x ?? t.clientX, y = t.y ?? t.clientY;
        const k = 0.0042 * S.sens * (1 - S.adsK * 0.35);
        S.yaw -= (x - touchLook.x) * k; S.pitch -= (y - touchLook.y) * k;
        S.pitch = Math.max(-1.45, Math.min(1.45, S.pitch));
        touchLook.x = x; touchLook.y = y; e.preventDefault();
      }
    }
  };
  const onTouchEnd = (e) => { for (const t of e.changedTouches) if (touchLook && t.identifier === touchLook.id) touchLook = null; };
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKey);
  document.addEventListener('contextmenu', onCtx);
  addEventListener('resize', onResize);
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  listenersOn = true;
  root.querySelector('[data-t="fire"]').addEventListener('touchstart', (e) => { e.preventDefault(); S.mouseDown = true; if (!w.auto && S.phase === 'run') { fire(); if (w.burst) S.burstLeft = 2; } }, { passive: false });
  root.querySelector('[data-t="fire"]').addEventListener('touchend', () => { S.mouseDown = false; });
  const adsBtn = root.querySelector('[data-t="ads"]');
  adsBtn.addEventListener('touchstart', (e) => { e.preventDefault(); S.rmb = !S.rmb; adsBtn.classList.toggle('on', S.rmb); }, { passive: false });
  root.querySelector('[data-t="reload"]').addEventListener('touchstart', (e) => { e.preventDefault(); startReload(); }, { passive: false });
  root.querySelector('[data-p="resume"]').onclick = () => { audio.ui(); S.paused = false; $('.aim-pause').style.display = 'none'; lock(); };
  root.querySelector('[data-p="restart"]').onclick = () => { audio.ui(); S.paused = false; $('.aim-pause').style.display = 'none'; restart(); };
  root.querySelector('[data-p="quit"]').onclick = () => { audio.ui(); cleanup(); onExit(); };

  // ---- per-frame update ---------------------------------------------------------------------------------
  const clock = new THREE.Clock();
  const _sv = new THREE.Vector3(), _eul = new THREE.Euler(0, 0, 0, 'YXZ');
  function update(dt) {
    S.t += dt;
    // countdown
    if (S.phase === 'count') {
      S.countT += dt;
      const n = 3 - Math.floor(S.countT);
      if (n >= 1) { const txt = String(n); if (countEl.textContent !== txt) { countEl.textContent = txt; audio.count(false); } }
      else { countEl.textContent = ''; S.phase = 'run'; feed('GO!', 800); audio.count(true); }
      return;
    }
    if (S.phase !== 'run' || S.paused || S.over) return;
    S.elapsed += dt;
    const left = S.dur - S.elapsed;
    if (left <= 0) { endDrill('time'); return; }
    if (cfg.drill === 'precision' && S.cleared >= S.total) { endDrill('clear'); return; }
    // auto fire
    if (S.mouseDown && w.auto) fire();
    if (S.burstLeft > 0 && S.t - S.lastShot >= 60 / w.rpm) { S.burstLeft--; fire(); }
    // reload timer
    if (S.reloading > 0) { S.reloading -= dt; if (S.reloading <= 0) { S.ammo = w.mag; S.reloading = 0; refreshHud(); } }
    S.bloom = Math.max(0, S.bloom - dt * 0.06);
    S.gunKick = Math.max(0, S.gunKick - dt * 7);
    // ADS
    const adsWant = S.rmb ? 1 : 0;
    S.adsK += (adsWant - S.adsK) * Math.min(1, dt * 12);
    if (gun) {
      gun.position.lerpVectors(gunBase, gunAds, S.adsK * S.adsK);
      gun.position.z += S.gunKick * 0.07; gun.rotation.x = S.gunKick * 0.14 + (S.reloading > 0 ? 0.5 : 0);
      gun.position.y -= S.reloading > 0 ? 0.08 : 0;
    }
    const fovT = 75 - 22 * S.adsK;
    if (Math.abs(camera.fov - fovT) > 0.1) { camera.fov += (fovT - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
    camera.quaternion.setFromEuler(_eul.set(S.pitch, S.yaw, 0));
    updateDrill(dt);
    updateFx(dt);
    refreshHud();
  }
  function updateDrill(dt) {
    const speed = (AIM_SPEEDS[cfg.speed] || AIM_SPEEDS.normal).v;
    for (let i = S.targets.length - 1; i >= 0; i--) {
      const t = S.targets[i], g = t.g;
      if (t.spawnA < 1) { t.spawnA = Math.min(1, t.spawnA + dt * 5); g.scale.setScalar(0.2 + 0.8 * t.spawnA * t.spawnA); }
      if (!t.alive) {
        t.dieT += dt;
        const k = Math.max(0.01, 1 - t.dieT * 4); g.scale.setScalar(k);
        if (t.dieT > 0.3) {
          scene.remove(g); S.targets.splice(i, 1);
          if (cfg.drill === 'precision' && S.cleared + S.targets.filter((x) => x.alive).length < S.total) { const p = randPos(9, 0.8, 4.2); spawnTarget(p.x, p.y, 1); }
          if (cfg.drill === 'tracking') setTimeout(() => { if (!dead && S.phase === 'run' && !S.targets.some((x) => x.alive)) { const p = randPos(7, 1.2, 3.6); const nt = spawnTarget(p.x, p.y, 120); nt.cx = p.x; nt.cy = p.y; } }, 500);
          if (cfg.drill === 'flick') { const pace = AIM_PACES[cfg.pace] || AIM_PACES.normal; if (S.targets.filter((x) => x.alive).length < pace.max) flickSpawn(); }
        }
        continue;
      }
      if (cfg.drill === 'tracking') {
        t.ph1 += dt * speed * 0.55; t.ph2 += dt * speed * 0.34;
        g.position.x = Math.max(-10, Math.min(10, t.cx + Math.sin(t.ph1) * 6 + Math.sin(t.ph2 * 1.7) * 2.5));
        g.position.y = Math.max(0.7, Math.min(4.4, t.cy + Math.sin(t.ph2) * 1.4 + Math.cos(t.ph1 * 0.8) * 0.7));
        // time on target: crosshair ray (no spread) vs this target
        camera.getWorldDirection(_fwd); ray.set(camera.position, _fwd); ray.far = 120;
        if (ray.intersectObject(g, true).length) S.onTargetT += dt;
        const hpk = Math.max(0, t.hp / t.maxHp);
        g.userData.face.material.emissive = new THREE.Color(0x550000).multiplyScalar(1 - hpk);
        g.userData.face.scale.setScalar(0.35 + 0.65 * hpk);
      }
      if (cfg.drill === 'flick') {
        const age = S.elapsed - t.spawnT, k = age / t.life;
        if (k >= 1) {   // expired
          t.alive = false; t.dieT = 0; S.expired++; S.streak = 0; audio.expire();
          const sp = worldToScreen(g.position); if (sp) spawnPop(root, sp.x, sp.y, 'MISS', '#ff5a4a');
        } else if (k > 0.65) { g.scale.setScalar(1 + Math.sin(S.t * 30) * 0.06); }   // urgency pulse
      }
    }
  }
  function updateFx(dt) {
    for (let i = S.parts.length - 1; i >= 0; i--) { const p = S.parts[i]; p.life -= dt; p.vy -= 9 * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      p.m.material.opacity = Math.max(0, p.life * 2); p.m.scale.setScalar(Math.max(0.01, p.life * 2));
      if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); S.parts.splice(i, 1); } }
    for (let i = S.tracers.length - 1; i >= 0; i--) { const t = S.tracers[i]; t.life -= dt;
      t.l.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
      if (t.life <= 0) { scene.remove(t.l); t.l.geometry.dispose(); t.l.material.dispose(); S.tracers.splice(i, 1); } }
    for (const d of S.decals) d.life -= dt;
  }
  function loop() {
    if (dead) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    update(dt);
    renderer.render(scene, camera);
  }
  function cleanup() {
    dead = true; try { cancelAnimationFrame(raf); } catch (e) {}
    if (listenersOn) {   // never true on the early WebGL-failure path (handlers not yet initialized)
      listenersOn = false;
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('contextmenu', onCtx);
      removeEventListener('resize', onResize);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    }
    try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
    try { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } catch (e) {}
    if (root.parentNode) root.parentNode.removeChild(root);
    _faceTex = null;
  }
  setupDrill(); refreshHud(); loop();
  if (!isTouch) setTimeout(() => { if (!dead) lock(); }, 60);
  else feed('Tap FIRE to shoot', 2500);
}
