// Counter-Strife (tactical kit): menus, then a match. The host's browser runs the Match + Bots (solo play is a host
// with no peers); everyone simulates their own movement and shooting locally and the host settles damage, money,
// rounds and the bomb, then sends 20 snapshots a second. Rendering is one merged mesh per material plus simple
// box-built players, so it holds 60 fps on weak integrated graphics.
import * as THREE from '../sdk/three.module.min.js';
import { WEAPONS, W_BY_ID, G_BY_ID, MODES, PHYS, BOMB, U, slotOf, itemName, forTeam } from './data.js';
import { buildWorld } from './world.js';
import { MAPS } from './maps.js';
import { Match, moveStep, traceShot, eyeHeight, spreadOf, recoilAt, nadeStep, speedOf } from './sim.js';
import { Bots, botNames } from './bots.js';
import { Profile } from './backend.js';
import { Menu, Hud, injectCss, esc } from './ui.js';
import { itemInfo, AGENT_BY_ID, AGENTS, ITEM_BY_ID, EMOTE_BY_ID } from './skins.js';
import { makePlayer, posePlayer, makeGun, makeKnife, makeGrenade, makeBomb, makeProp, skinTexture, lam, basic } from './models.js';

const SET_KEY = 'cs:settings:v1';
const DEF_SET = { sens: 1.6, fov: 90, vol: 0.6, xSize: 5, xGap: 0, xThick: 2, xOutline: 0.6, xColor: '#55ff55', xDyn: 0, xDot: 0, quality: 1, fps: 0, hand: 1 };
const loadSet = () => { try { return Object.assign({}, DEF_SET, JSON.parse(localStorage.getItem(SET_KEY) || '{}')); } catch (e) { return { ...DEF_SET }; } };
const saveSet = (s) => { try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } };
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// ---- positional synth sound (no audio files) ----------------------------------------------------------------------
function makeAudio(getVol) {
  let ctx = null, master = null;
  const ensure = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); master = ctx.createGain(); master.connect(ctx.destination); } if (ctx.state === 'suspended') ctx.resume(); master.gain.value = getVol(); return ctx; };
  addEventListener('pointerdown', ensure); addEventListener('keydown', ensure);
  let noiseBuf = null;
  const noise = () => { if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s; };
  const out = (vol, pan) => { const g = ctx.createGain(); g.gain.value = vol; let n = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master); return n; };
  const burst = (dur, freq, vol, pan, q = 0.7, type = 'lowpass') => { const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(out(1, pan)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); };
  const tone = (type, f0, f1, dur, vol, pan, delay = 0) => { const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(out(1, pan)); o.start(t); o.stop(t + dur + 0.05); };
  const SND = {
    pistol: (v, p) => { burst(0.14, 3200, v, p); tone('square', 300, 80, 0.06, v * 0.25, p); }, rifle: (v, p) => { burst(0.18, 2200, v * 1.1, p); tone('sawtooth', 160, 50, 0.1, v * 0.35, p); },
    smg: (v, p) => { burst(0.1, 2800, v * 0.9, p); }, heavy: (v, p) => { burst(0.3, 1100, v * 1.2, p); tone('sawtooth', 120, 35, 0.2, v * 0.4, p); },
    sniper: (v, p) => { burst(0.45, 1500, v * 1.3, p); tone('sawtooth', 90, 30, 0.35, v * 0.5, p); burst(0.6, 500, v * 0.4, p); }, silenced: (v, p) => { burst(0.08, 1200, v * 0.5, p, 2); },
    zeus: (v, p) => { tone('square', 1800, 200, 0.3, v * 0.4, p); burst(0.3, 6000, v * 0.4, p, 1, 'highpass'); }, knife: (v, p) => { burst(0.12, 5000, v * 0.4, p, 2, 'highpass'); },
    step: (v, p) => { burst(0.05, 700, v * 0.35, p, 1); }, land: (v, p) => burst(0.09, 500, v * 0.5, p),
    hit: (v) => tone('triangle', 1400, 900, 0.05, v * 0.25, 0), head: (v) => { tone('square', 2400, 1800, 0.08, v * 0.35, 0); tone('sine', 3600, 3000, 0.12, v * 0.2, 0); },
    hurt: (v) => burst(0.12, 900, v * 0.6, 0), reload: (v, p) => { tone('square', 900, 700, 0.03, v * 0.2, p); tone('square', 600, 500, 0.04, v * 0.2, p, 0.25); }, empty: (v) => tone('square', 1800, 1800, 0.02, v * 0.2, 0),
    beep: (v, p) => tone('sine', 2100, 2100, 0.09, v * 0.5, p), planted: (v) => { tone('sine', 900, 900, 0.15, v * 0.5, 0); tone('sine', 1200, 1200, 0.15, v * 0.5, 0, 0.18); },
    defused: (v) => { tone('sine', 700, 1400, 0.4, v * 0.4, 0); }, explode: (v, p) => { burst(1.6, 400, v * 1.8, p); tone('sine', 70, 25, 1.4, v * 0.9, p); },
    he: (v, p) => { burst(0.9, 600, v * 1.5, p); tone('sine', 90, 30, 0.7, v * 0.7, p); }, flash: (v, p) => { burst(0.25, 5000, v, p, 1, 'highpass'); tone('sine', 3200, 3000, 2.5, v * 0.15, 0); },
    smoke: (v, p) => burst(1.4, 900, v * 0.5, p, 0.5), fire: (v, p) => burst(0.8, 1600, v * 0.6, p), bounce: (v, p) => tone('square', 700, 500, 0.03, v * 0.3, p),
    buy: (v) => { tone('square', 700, 700, 0.04, v * 0.2, 0); tone('square', 1050, 1050, 0.05, v * 0.2, 0, 0.05); }, round: (v) => { tone('sine', 440, 440, 0.12, v * 0.3, 0); tone('sine', 660, 660, 0.18, v * 0.3, 0, 0.13); },
    win: (v) => [523, 659, 784, 1046].forEach((f, k) => tone('triangle', f, f, 0.2, v * 0.25, 0, k * 0.12)), lose: (v) => [392, 330, 262].forEach((f, k) => tone('triangle', f, f * 0.98, 0.25, v * 0.25, 0, k * 0.15)),
    tick: (v) => tone('square', 2400, 2400, 0.012, v * 0.15, 0), reveal: (v) => [660, 880].forEach((f, k) => tone('triangle', f, f, 0.2, v * 0.3, 0, k * 0.1)),
    rare: (v) => [523, 659, 784, 1046, 1318].forEach((f, k) => tone('triangle', f, f, 0.3, v * 0.35, 0, k * 0.09)), radio: (v) => { burst(0.08, 3000, v * 0.2, 0, 3, 'bandpass'); tone('square', 1200, 1200, 0.03, v * 0.15, 0); },
    deploy: (v) => tone('square', 400, 600, 0.04, v * 0.15, 0),
  };
  return {
    play(name, vol = 1, pan = 0) { if (!ensure() || !SND[name]) return; try { SND[name](vol, Math.max(-1, Math.min(1, pan))); } catch (e) { /* audio busy */ } },
    at(name, x, y, z, cam, range = 60) {  // positional: volume by distance, pan by angle
      const dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dy(y, cam), dz); if (d > range) return;
      const yaw = cam.rotation.y, side = Math.sin(Math.atan2(-dx, -dz) - yaw);
      this.play(name, Math.max(0.05, 1 - d / range) ** 1.4, -side * 0.8);
    },
  };
}
const dy = (y, cam) => y - cam.position.y;

// ======================================================================================================================
export default function start({ cfg, E, N, smoke }) {
  injectCss();
  let S = loadSet();
  const profile = new Profile(cfg);
  if (profile.signedIn) profile.sync();
  const audio = makeAudio(() => S.vol);
  const toast = (t) => { const d = document.createElement('div'); d.className = 'cs'; d.textContent = t; d.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:400;background:#151b24;border:1px solid #2c3442;padding:10px 16px;border-radius:8px;font-weight:700'; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); };
  const mapPreview = (c, id) => {
    const B = MAPS[id].build(), g = c.getContext('2d'), sx = c.width / B.w, sz = c.height / B.d, s = Math.min(sx, sz);
    g.fillStyle = '#0b0e13'; g.fillRect(0, 0, c.width, c.height);
    const ox = (c.width - B.w * s) / 2, oz = (c.height - B.d * s) / 2;
    for (let z = 0; z < B.d; z++) for (let x = 0; x < B.w; x++) { const i = z * B.w + x; if (B.flag[i] === 2 || B.flag[i] === 3) { g.fillStyle = B.flag[i] === 3 ? '#c43' : `hsl(35,${20 + B.h[i] * 5}%,${44 + B.h[i] * 6}%)`; g.fillRect(ox + x * s, oz + z * s, Math.ceil(s), Math.ceil(s)); } }
    g.fillStyle = '#ff6a4a'; g.font = 'bold 13px system-ui'; for (const [n, r] of Object.entries(B.sites)) g.fillText(n, ox + (r[0] + r[2]) / 2 * s - 4, oz + (r[1] + r[3]) / 2 * s + 4);
  };
  let menu = null;
  const showMenu = () => { menu = new Menu(cfg, profile, { play: (o) => { menu.hide(); runMatch(o); }, lobbies: (fn) => N.lobbyBrowser(cfg.id, fn), toast, sound: (n) => audio.play(n), mapPreview, settings: () => S, saveSettings: (s) => { S = s; saveSet(s); } }); menu.show(); };
  if (smoke) runMatch({ mode: '5v5', map: 'dust', bot: 'normal', host: true, solo: true, smoke: true });
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
      if (isHost && opt.pub) { lobby = N.lobbyBrowser(cfg.id, () => {}); lobby.announce({ code: session.code, name: myName + "'s lobby", players: 1, max: MODES[opt.mode].size * 2, mode: opt.mode, map: opt.map }); }
    }
    const loadout = { T: profile.loadoutFor('T'), CT: profile.loadoutFor('CT') };
    const hello = { name: myName, loadout, agent: { T: loadout.T.agent, CT: loadout.CT.agent }, knife: { T: loadout.T.knife, CT: loadout.CT.knife } };

    // ---- renderer & scene ----
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
    document.body.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(74, 1, 0.05, 400); cam.rotation.order = 'YXZ'; scene.add(cam);
    const vmCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10), vmScene = new THREE.Scene();
    vmScene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.25)); const vmSun = new THREE.DirectionalLight(0xffffff, 0.7); vmSun.position.set(1, 2, 1); vmScene.add(vmSun);
    const resize = () => { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = vmCam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); vmCam.updateProjectionMatrix(); };
    addEventListener('resize', resize); resize();
    renderer.autoClear = false;
    let scale = Math.min(1, devicePixelRatio || 1) * S.quality;
    const gov = E.qualityGovernor((s) => { scale = s; renderer.setPixelRatio(s); }, { start: Math.min(devicePixelRatio || 1, 1) * S.quality, max: Math.min(1.5, (devicePixelRatio || 1) * S.quality), min: 0.4 });
    const fpsM = S.fps ? E.fpsMeter() : () => {};
    const hud = new Hud(S);

    let lobbyPanel = null;
    let W = null, mode = opt.mode, mapId = opt.map, botLevel = opt.bot || 'normal', match = null, bots = null, ended = false, started = false;
    const st = { phase: 'warmup', timer: 0, round: 0, score: { T: 0, CT: 0 }, bomb: null, effects: [], drops: [], history: [], roster: new Map(), players: new Map() };
    const stats = { k: 0, d: 0, a: 0, hs: 0, mvp: 0, plant: 0, defuse: 0, pistol: 0, smg: 0, knife: 0, nade: 0, roundWin: 0, dmg: 0 };

    // ---- the local player ----
    const me = { id: myId, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, crouch: 0, onGround: true, alive: false, team: 'T', hp: 100, armor: 0, helmet: false, money: 0,
      inv: {}, nades: [], cur: 2, last: 1, nadeSel: 0, cd: 0, reload: 0, deploy: 0, spray: 0, sprayT: 0, punch: 0, scoped: 0, burst: false, burstLeft: 0, flash: 0, defuser: false, inspect: 0, knifeSwing: 0, stepT: 0, wasGround: true };

    // ---- world ----
    function buildMap(id) {
      if (W) { scene.remove(W.group); W.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
      mapId = id; W = buildWorld(E, MAPS[id], scene, S.quality);
      const B = W.B;
      scene.background = new THREE.Color(B.sky || 0x9ab); scene.fog = new THREE.Fog(B.fog || 0xaaaaaa, 40, 160);
      for (const l of scene.children.filter((c) => c.isLight)) scene.remove(l);
      scene.add(new THREE.HemisphereLight((B.amb || [])[0] || 0xffffff, (B.amb || [])[1] || 0x555555, 1.05));
      const sun = new THREE.DirectionalLight(B.sunColor || 0xffffff, 0.75); sun.position.set(40, 80, 25); scene.add(sun);
      for (const p of B.props) { const m = makeProp({ ...p, y: W.H(Math.floor(p.x), Math.floor(p.z)) }); W.group.add(m); }
      hud.radarBase(W);
    }

    // ---- remote players (rigs) ----
    const rigs = new Map();
    function rigFor(id) {
      const r0 = rigs.get(id), info = st.roster.get(id) || {}, team = info.team || 'T';
      const agentId = (info.agent || {})[team] || (team === 'T' ? 'a_t_default' : 'a_ct_default');
      const key = agentId + team;
      if (r0 && r0.key === key) return r0;
      if (r0) scene.remove(r0.g);
      const a = AGENT_BY_ID[agentId] || AGENT_BY_ID[team === 'T' ? 'a_t_default' : 'a_ct_default'];
      const r = makePlayer(a.look, team); r.key = key; r.x = 0; r.y = 0; r.z = 0; r.t = Math.random() * 10; scene.add(r.g); rigs.set(id, r);
      return r;
    }

    // ---- first-person view model ----
    let vm = null, vmKey = '';
    function setViewModel() {
      const it = me.cur === 4 ? { wid: me.nades[me.nadeSel] } : me.inv[me.cur];
      const wid = it ? it.wid : null;
      const team = me.team, info = st.roster.get(myId) || {};
      const lo = loadout[team] || {}; const knife = lo.knife;
      const key = `${wid}|${it && it.skin ? it.skin.uid : ''}|${team}|${knife ? knife.uid : ''}`;
      if (key === vmKey) return; vmKey = key;
      if (vm) vmScene.remove(vm);
      const sleeve = team === 'T' ? '#6a5a3a' : '#3c4e66';
      if (!wid) { vm = null; return; }
      if (wid === 'knife') { const ki = knife ? itemInfo({ ...knife }) : null; vm = makeKnife(ki ? ki.weapon : null, knife && ki ? skinTexture(knife, ki) : null, sleeve); }
      else if (G_BY_ID[wid]) { vm = makeGrenade(wid); vm.scale.setScalar(1.6); }
      else if (wid === 'c4') { vm = makeBomb(); vm.scale.setScalar(0.9); }
      else { const sk = it.skin, si = sk ? itemInfo(sk) : null; vm = makeGun(wid, sk && si ? skinTexture(sk, si) : null, sleeve); }
      vm.userData.base = new THREE.Vector3(0.19 * S.hand, -0.2, -0.46); vm.userData.ry = 0.16 * S.hand; vm.scale.multiplyScalar(0.85);
      vm.position.copy(vm.userData.base); vmScene.add(vm);
      me.deploy = wid === 'knife' ? 0.4 : G_BY_ID[wid] ? 0.5 : (W_BY_ID[wid] || {}).cat === 'pistol' ? 0.6 : 0.9; me.scoped = 0; audio.play('deploy');
    }

    // ---- effects: tracers, impacts, smokes, fires, grenades in flight, drops, bomb ----
    const fx = new THREE.Group(); scene.add(fx);
    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.6 });
    const tracers = [];
    const tracer = (a, b) => { if (tracers.length > 24) { const t = tracers.shift(); fx.remove(t.l); t.l.geometry.dispose(); } const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]); const l = new THREE.Line(g, tracerMat); fx.add(l); tracers.push({ l, t: 0.05 }); };
    const decalGeo = new THREE.PlaneGeometry(0.12, 0.12), decalMat = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const decals = [];
    const decal = (p, d) => { const m = new THREE.Mesh(decalGeo, decalMat); m.position.set(p.x - d.x * 0.01, p.y - d.y * 0.01, p.z - d.z * 0.01); m.lookAt(p.x - d.x, p.y - d.y, p.z - d.z); fx.add(m); decals.push(m); if (decals.length > 60) fx.remove(decals.shift()); };
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
        if (e.type === 'fire') { const mat = new THREE.SpriteMaterial({ map: fireTex, depthWrite: false, blending: THREE.AdditiveBlending }); for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(mat); const a = i * 2.1, r = (i % 3) / 3 * e.r; s.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r); s.scale.setScalar(1.1); g.add(s); } }
        g.position.set(e.x, e.y, e.z); fx.add(g); effectObjs.set(k, g);
      }
      for (const [k, g] of effectObjs) if (!keep.has(k)) { fx.remove(g); effectObjs.delete(k); }
    }
    const flying = new Map();  // grenades in flight (visual)
    const dropObjs = new Map();
    function syncDrops() {
      const keep = new Set();
      for (const d of st.drops) { keep.add(d.id); if (dropObjs.has(d.id)) continue; const sk = d.skin, si = sk ? itemInfo(sk) : null; const m = makeGun(d.wid, sk && si ? skinTexture(sk, si) : null); m.children.slice(-3).forEach((c) => { if (c.material && c.geometry.parameters && c.geometry.parameters.depth > 0.3) c.visible = false; }); m.rotation.set(0, Math.random() * 6, Math.PI / 2); m.position.set(d.x, d.y + 0.05, d.z); fx.add(m); dropObjs.set(d.id, m); }
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
    const onLock = () => { locked = document.pointerLockElement === renderer.domElement; if (!locked && !uiOpen && !ended && !smoke) openPause(); };
    document.addEventListener('pointerlockchange', onLock);
    const lock = () => { try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed yet */ } if (navigator.keyboard && navigator.keyboard.lock && document.fullscreenElement) navigator.keyboard.lock(['ControlLeft', 'KeyW', 'Tab']).catch(() => {}); };
    E.touchControls(['fire', 'jump', 'reload', 'use', 'alt']);
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
        const clean = { name: String(info.name || 'Player').slice(0, 20), loadout: sanitizeLoadout(info.loadout), agent: sanitizeAgent(info.agent), knife: sanitizeKnife(info.knife) };
        if (started) {  // replace a bot on the team that needs a human most
          const humans = (tm) => [...match.players.values()].filter((q) => q.team === tm && !q.bot).length;
          const team = humans('T') <= humans('CT') ? 'T' : 'CT';
          const bot = [...match.players.values()].find((q) => q.bot && q.team === team) || [...match.players.values()].find((q) => q.bot);
          if (bot) { match.remove(bot.id); clean.team = bot.team; }
        }
        match.add(peer, clean);
        send('lobby', { mode, map: mapId, bot: botLevel, started }, peer);
        if (lobby) lobby.update({ players: [...match.players.values()].filter((q) => !q.bot).length });
        return;
      }
      if (!p) return;
      if (t === 'pose' && Array.isArray(d) && d.length >= 8) {
        const [x, y, z, yaw, pitch, cr, fl, cur] = d.map(Number);
        if (![x, y, z, yaw, pitch, cr].every(Number.isFinite)) return;
        if (p.alive) { const jump = Math.hypot(x - p.x, z - p.z); if (jump < 4 || !p.seen) { p.x = x; p.y = y; p.z = z; } p.seen = true; }
        p.yaw = yaw; p.pitch = Math.max(-1.6, Math.min(1.6, pitch)); p.crouch = Math.max(0, Math.min(1, cr)); p.plant = !!(fl & 1); p.defusing = !!(fl & 2);
        if ([1, 2, 3, 4, 5, 6].includes(cur) && (p.inv[cur] || cur === 4)) p.cur = cur; p.onGround = !!(fl & 4); p.vx = 0; p.vz = 0;
        return;
      }
      if (t === 'shot' && d && typeof d === 'object') {
        const w = W_BY_ID[d.w]; if (!w || !p.alive) return;
        const owned = Object.values(p.inv).some((i) => i && i.wid === d.w); if (!owned) return;
        const o = Array.isArray(d.o) ? { x: +d.o[0], y: +d.o[1], z: +d.o[2] } : { x: p.x, y: p.y + 1.6, z: p.z };
        if (Math.hypot(o.x - p.x, o.z - p.z) > 2) return;
        const hits = (Array.isArray(d.h) ? d.h : []).filter((h) => h && typeof h.id === 'string' && ['head', 'chest', 'stomach', 'legs'].includes(h.group)).map((h) => ({ id: h.id, group: h.group, pen: Math.max(0.1, Math.min(1, +h.pen || 1)), heavy: !!h.heavy }));
        match.shot(p, d.w, hits, o);
        const fireMsg = { id: peer, wid: d.w, o: [o.x, o.y, o.z], e: Array.isArray(d.e) ? d.e.slice(0, 3).map(Number) : null };
        send('fire', fireMsg); onFire(fireMsg); if (bots) bots.heard(o.x, o.z, p);
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
    function sanitizeLoadout(l) { const out = {}; for (const t of ['T', 'CT']) { const x = (l && l[t]) || {}; const skins = {}; for (const [k, v] of Object.entries(x.skins || {}).slice(0, 50)) if (W_BY_ID[k]) { const s = sanitizeSkin(v); if (s && ITEM_BY_ID[s.def].weapon === k) skins[k] = s; } out[t] = { skins, ctPistol: x.ctPistol === 'p2000' ? 'p2000' : 'usp' }; } return out; }
    const sanitizeAgent = (a) => ({ T: a && AGENT_BY_ID[a.T] && AGENT_BY_ID[a.T].team === 'T' ? a.T : null, CT: a && AGENT_BY_ID[a.CT] && AGENT_BY_ID[a.CT].team === 'CT' ? a.CT : null });
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
    function onSpawn(m) { me.x = m.x; me.y = m.y; me.z = m.z; me.yaw = m.yaw; me.pitch = 0; me.vx = me.vy = me.vz = 0; me.alive = true; me.hp = 100; me.flash = 0; me.spray = 0; me.scoped = 0; specTarget = null; me.respawned = true; }
    function onHurt(m) {
      me.hp = m.hp; me.armor = m.armor; audio.play('hurt');
      const ang = m.from ? angDiff(me.yaw, Math.atan2(-(m.from[0] - me.x), -(m.from[1] - me.z))) : null;
      hud.hurt(ang != null ? -ang : null); me.punch += 0.03;
      if (m.hp <= 0) me.alive = false;
    }
    function onHitConfirm(m) { audio.play(m.group === 'head' ? 'head' : 'hit'); stats.dmg += m.dmg | 0; }
    function onFire(m) {
      if (m.id === myId) return;
      const w = W_BY_ID[m.wid] || {}; const snd = w.silenced ? 'silenced' : w.cat === 'sniper' ? 'sniper' : w.cat === 'heavy' ? 'heavy' : w.cat === 'smg' ? 'smg' : w.cat === 'knife' ? 'knife' : w.cat === 'zeus' ? 'zeus' : w.cat === 'pistol' ? 'pistol' : 'rifle';
      audio.at(snd, m.o[0], m.o[1], m.o[2], cam, w.silenced ? 25 : 110);
      if (m.e && w.cat !== 'knife') { tracer(m.o, m.e); }
      const r = rigs.get(m.id); if (r) r.flashT = 0.05;
    }
    function onBomb(b) { st.bomb = b ? { s: b.state, x: b.x, y: b.y, z: b.z, t: b.timer, site: b.site } : null; }
    function onDrops(d) { st.drops = d || []; syncDrops(); }
    function onFx(list) { st.effects = list || []; syncEffects(); }
    function onNade(n) { const m = makeGrenade(n.type); m.position.set(n.x, n.y, n.z); fx.add(m); flying.set(n.id, { n: { ...n }, m }); audio.at('bounce', n.x, n.y, n.z, cam, 20); }
    function onChat(m) { hud.chat(m.name, m.team, m.text, m.teamOnly); audio.play('radio'); }
    let specTarget = null, specNext = false;
    function onEvent({ type, data }) {
      if (type === 'round') {
        st.round = data.n; st.score = data.score;
        if (data.phase === 'freeze') { hud.banner(`Round ${data.n}`, MODES[mode].bomb ? (me.team === 'T' ? 'Plant the bomb or eliminate the enemy' : 'Defend the bomb sites') : 'Eliminate the enemy', 2500); audio.play('round'); }
        if (data.phase === 'live') { hud.banner('', ''); audio.play('radio'); if (uiOpen === 'buy' && !canBuy()) closeBuy(); }
      }
      if (type === 'roundEnd') {
        st.score = data.score; st.history = data.history || st.history;
        hud.banner(data.text, data.mvp ? `MVP: ${data.mvp}` : '', 4500);
        audio.play(data.winner && data.winner === me.team ? 'win' : 'lose');
        if (data.winner === me.team) stats.roundWin++;
        if (data.mvp && data.mvp === myName) stats.mvp++;
      }
      if (type === 'banner') hud.banner(data.text, data.sub || '', 3000);
      if (type === 'kill') {
        hud.feed(data, myId);
        if (data.kid === myId && data.vteam !== me.team) { stats.k++; if (data.head) stats.hs++; const w = W_BY_ID[data.weapon]; if (w && w.cat === 'pistol') stats.pistol++; if (w && w.cat === 'smg') stats.smg++; if (data.weapon === 'knife') stats.knife++; if (G_BY_ID[data.weapon]) stats.nade++; bumpStatTrak(data.weapon); }
        if (data.vid === myId) { stats.d++; me.alive = false; hud.banner('You died', data.killer ? `Killed by ${data.killer}` : '', 2500); }
        if (data.assist === myName) stats.a++;
        const r = rigs.get(data.vid); if (r) r.dieT = 0.001;
      }
      if (type === 'planted') { hud.banner('The bomb has been planted', `Site ${data.site}`, 3000); audio.play('planted'); if (data.by === myName) stats.plant++; }
      if (type === 'sound' && data.s === 'defused') { audio.play('defused'); hud.banner('The bomb has been defused', '', 3000); const b = match ? match.bomb : null; if (b && b.defuser === myId) stats.defuse++; if (!match && st.bomb && Math.hypot(st.bomb.x - me.x, st.bomb.z - me.z) < 2) stats.defuse++; }
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
      if (type === 'inv') onInv(d); else if (type === 'spawn') onSpawn(d); else if (type === 'hurt') onHurt(d); else if (type === 'hitconfirm') onHitConfirm(d);
      else if (type === 'ev') onEvent(d); else if (type === 'fire') onFire(d); else if (type === 'bomb') onBomb(d); else if (type === 'drops') onDrops(d); else if (type === 'fx') onFx(d); else if (type === 'nade') onNade(d);
    }

    // ---- set up as host or client ----
    if (isHost) {
      buildMap(mapId);
      match = new Match({ W, mode, mapId, botLevel, send: (t, d, to) => { if (session) session.send(t, d, to); }, onLocal: local });
      bots = new Bots(match);
      const mp = match.add(myId, { ...hello, loadout: sanitizeLoadout(loadout), agent: sanitizeAgent(hello.agent), knife: sanitizeKnife(hello.knife) });
      mp.local = true; me.team = mp.team; match.spawn(mp); match.sendInv(mp);
      if (session) {
        session.on('_join', () => {});
        for (const t of ['hello', 'pose', 'shot', 'buy', 'nade', 'pickup', 'drop', 'dropc4', 'ammo', 'chat', 'emote']) session.on(t, (d, peer) => hostRecv(t, d, peer));
        session.on('_leave', (_, peer) => { if (match) { match.remove(peer); const r = rigs.get(peer); if (r) { scene.remove(r.g); rigs.delete(peer); } if (lobby) lobby.update({ players: [...match.players.values()].filter((q) => !q.bot).length }); } });
      }
      if (solo) startMatch(); else showLobbyPanel();
    } else {
      hud.banner('Joining…', 'connecting to the host', 0);
      session.on('lobby', (d, peer) => {
        if (peer !== session.hostId || !d || !MODES[d.mode] || !MAPS[d.map]) return;
        mode = d.mode; botLevel = d.bot; if (!W || mapId !== d.map) buildMap(d.map);
        started = !!d.started; hud.banner(started ? '' : 'Waiting for the host to start', `${MODES[mode].name} · ${MAPS[mapId].name}`, started ? 1 : 0);
      });
      const msgTypes = { inv: onInv, spawn: onSpawn, hurt: onHurt, hitconfirm: onHitConfirm, ev: onEvent, fire: onFire, bomb: onBomb, drops: onDrops, fx: onFx, nade: onNade, chat: onChat, toast: (t) => toast(String(t).slice(0, 80)) };
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

    function setRoster(list) { st.roster = new Map(list.map((r) => [r.id, r])); const mine = st.roster.get(myId); if (mine) { if (mine.team !== me.team) { me.team = mine.team; vmKey = ''; setViewModel(); } } for (const [id, r] of rigs) if (!st.roster.has(id) && id !== myId) { scene.remove(r.g); rigs.delete(id); } }
    function applySnap(s) {
      st.phase = s.ph; st.timer = s.tm; st.round = s.r; st.score = s.sc;
      for (const a of s.p) {
        const [id, x, y, z, yaw, pitch, crouch, hp, alive, wid, c4, plant, armor, helmet, money] = a;
        if (id === myId) { me.hp = hp; if (me.alive && !alive) me.alive = false; me.armor = armor; me.helmet = !!helmet; me.money = money; me.planting = plant; continue; }
        let p = st.players.get(id); if (!p) st.players.set(id, (p = { id, x, y, z, tx: x, ty: y, tz: z }));
        if (Math.hypot(x - p.x, z - p.z) > 4) { p.x = x; p.y = y; p.z = z; }
        p.tx = x; p.ty = y; p.tz = z; p.yaw = yaw; p.pitch = pitch; p.crouch = crouch; p.hp = hp; p.alive = !!alive; p.wid = wid; p.c4 = c4; p.planting = plant; p.armor = armor; p.money = money; p.team = (st.roster.get(id) || {}).team;
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
          <div class="cs-mut cs-small" style="margin:4px 0 10px">Invite code <b style="color:var(--o);font-size:16px">${esc(session.code)}</b> · bots (${esc(botLevel)}) fill empty slots</div>
          ${list.map((p) => `<div class="cs-row"><span style="color:${p.team === 'CT' ? 'var(--ct)' : 'var(--tt)'}">●</span> ${esc(p.name)} <span class="cs-mut cs-small">${p.team}</span></div>`).join('')}
          <div class="cs-row" style="margin-top:12px"><button class="cs-btn" data-s>START MATCH</button><button class="cs-btn alt" data-c>COPY INVITE LINK</button><button class="cs-btn alt" data-q>LEAVE</button></div></div>`;
        lobbyPanel.querySelector('[data-s]').onclick = () => { lobbyPanel.remove(); lobbyPanel = null; startMatch(); };
        lobbyPanel.querySelector('[data-c]').onclick = (e) => { const t = document.createElement('textarea'); t.value = location.origin + location.pathname + '#' + session.code; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (er) { /* old browser */ } t.remove(); e.target.textContent = 'COPIED'; };
        lobbyPanel.querySelector('[data-q]').onclick = quit;
      };
      document.body.appendChild(lobbyPanel); draw(); lobbyPanel.iv = setInterval(draw, 1000); uiOpen = 'lobby';
      const obs = setInterval(() => { if (!lobbyPanel) { clearInterval(obs); uiOpen = null; } }, 300);
    }
    function startMatch() {
      if (lobbyPanel) { clearInterval(lobbyPanel.iv); lobbyPanel.remove(); lobbyPanel = null; }
      uiOpen = null; started = true;
      match.fillBots(botNames(Math.floor(Math.random() * 18)));
      match.start(); send('lobby', { mode, map: mapId, bot: botLevel, started: true });
      if (lobby) lobby.update({ players: [...match.players.values()].filter((q) => !q.bot).length });
    }

    // ---- local actions ----
    const curWeapon = () => { if (me.cur === 4) return null; const it = me.inv[me.cur]; return it ? W_BY_ID[it.wid] : null; };
    const canBuy = () => { const b = W && W.B.buy[me.team]; const M = MODES[mode]; return me.alive && b && W.inRect(b, me.x, me.z) && (st.phase === 'freeze' || (st.phase === 'live' && M.round - st.timer < M.buyTime) || (match && match.canBuy(match.players.get(myId)))); };
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
        resume: () => { hud.pauseMenu(false); uiOpen = null; lock(); }, quit, setSens: (v) => { S.sens = v; saveSet(S); } });
    }
    function fire(alt) {
      const it = me.inv[me.cur], w = curWeapon();
      if (me.cur === 4) return throwNade(alt);
      if (me.cur === 5) return;
      if (!w || !it || me.cd > 0 || me.deploy > 0 || me.reload > 0) return;
      if (w.cat === 'knife') return knife(alt);
      if (it.ammo <= 0) { audio.play('empty'); me.cd = 0.2; if (it.reserve > 0) startReload(); return; }
      it.ammo--; me.cd = 60 / w.rpm; if (w.prime) me.cd += w.prime * 0.5;
      const eye = { x: me.x, y: me.y + eyeHeight(me), z: me.z };
      const rc = recoilAt(w, me.spray), sp = spreadOf(w, me, me.scoped > 0, me.spray) * (me.flash > 1 ? 1.3 : 1);
      me.spray++; me.sprayT = 0.4 + 60 / w.rpm;
      if (w.zoom && me.scoped && w.cat === 'sniper') me.unscopeAfterShot = true;
      const players = [...st.players.values()].filter((p) => p.alive).map((p) => ({ id: p.id, alive: true, x: p.x, y: p.y, z: p.z, crouch: p.crouch || 0 }));
      const hits = []; let end = null;
      for (let k = 0; k < (w.pellets || 1); k++) {
        const r1 = (Math.random() - 0.5) * 2, r2 = (Math.random() - 0.5) * 2, spr = sp + (w.spread || 0) * (w.pellets > 1 ? 1 : 0);
        const yaw = me.yaw + rc.side + r1 * spr, pitch = me.pitch + me.punch * 0.5 + rc.up + r2 * spr;
        const d = { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
        const tr = traceShot(W, players, myId, eye, d, w);
        hits.push(...tr.hits); if (!end) end = tr.end;
        for (const h of tr.hits) { const p = st.players.get(h.id); if (p) puff(p.x, p.y + (h.group === 'head' ? 1.7 : 1.2), p.z); }
        if (tr.wallHits[0]) decal(tr.wallHits[0], d);
      }
      me.punch += w.kick * 0.6; camKick = Math.min(camKick + w.kick * 0.8, 0.12);
      if (w.cat === 'zeus') for (const h of hits) h.group = 'chest';
      if (w.cat === 'zeus') { const zr = w.range || 4.5; for (let i = hits.length - 1; i >= 0; i--) if (hits[i].dist > zr) hits.splice(i, 1); }
      toHost('shot', { w: w.id, h: hits.map((h) => ({ id: h.id, group: h.group, pen: +h.pen.toFixed(2) })), o: [eye.x, eye.y, eye.z], e: end ? [end.x, end.y, end.z] : null });
      if (end && w.cat !== 'zeus') tracer([eye.x + Math.cos(me.yaw) * 0.15 * S.hand, eye.y - 0.1, eye.z - Math.sin(me.yaw) * 0.15 * S.hand], [end.x, end.y, end.z]);
      const snd = w.silenced ? 'silenced' : w.cat === 'sniper' ? 'sniper' : w.cat === 'heavy' ? 'heavy' : w.cat === 'smg' ? 'smg' : w.cat === 'zeus' ? 'zeus' : w.cat === 'pistol' ? 'pistol' : 'rifle';
      audio.play(snd, 0.8);
      if (vm && vm.userData.flash) { vm.userData.flash.visible = true; flashT = 0.04; }
      if (it.ammo === 0 && it.reserve > 0) setTimeout(() => { if (me.inv[me.cur] === it && it.ammo === 0) startReload(); }, 250);
    }
    function knife(heavy) {
      me.cd = heavy ? 1.1 : 0.45; me.knifeSwing = 0.25; audio.play('knife', 0.6);
      const eye = { x: me.x, y: me.y + eyeHeight(me), z: me.z }, d = { x: -Math.sin(me.yaw) * Math.cos(me.pitch), y: Math.sin(me.pitch), z: -Math.cos(me.yaw) * Math.cos(me.pitch) };
      const players = [...st.players.values()].filter((p) => p.alive).map((p) => ({ id: p.id, alive: true, x: p.x, y: p.y, z: p.z, crouch: p.crouch || 0 }));
      const tr = traceShot(W, players, myId, eye, d, W_BY_ID.knife, heavy ? 1.5 : 1.9);
      const h = tr.hits[0]; if (h) { const p = st.players.get(h.id); if (p) puff(p.x, p.y + 1.2, p.z); }
      toHost('shot', { w: 'knife', h: h ? [{ id: h.id, group: 'chest', pen: 1, heavy: !!heavy }] : [], o: [eye.x, eye.y, eye.z], e: null });
    }
    function throwNade(lob) {
      const type = me.nades[me.nadeSel]; if (!type || me.cd > 0 || me.deploy > 0) return;
      const eye = { x: me.x, y: me.y + eyeHeight(me), z: me.z }, pitch = me.pitch + 0.08;
      const d = { x: -Math.sin(me.yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(me.yaw) * Math.cos(pitch) };
      const sp = lob ? 8 : 17.5;
      const vel = { x: d.x * sp + me.vx, y: d.y * sp + (lob ? 3 : 1.5) + Math.max(0, me.vy) * 0.8, z: d.z * sp + me.vz };
      const pos = { x: eye.x + d.x * 0.3, y: eye.y - 0.05, z: eye.z + d.z * 0.3 };
      toHost('nade', { type, pos, vel }); me.cd = 0.8;
      me.nades.splice(me.nadeSel, 1); me.nadeSel = 0;
      if (!me.nades.length) { me.cur = me.last && me.inv[me.last] ? me.last : me.inv[1] ? 1 : me.inv[2] ? 2 : 3; }
      setViewModel();
    }
    function startReload() {
      const it = me.inv[me.cur], w = curWeapon(); if (!it || !w || w.cat === 'knife' || w.cat === 'zeus' || me.reload > 0 || it.ammo >= w.mag || it.reserve <= 0) return;
      me.reload = w.shellReload ? w.reload : w.reload; me.scoped = 0; audio.play('reload', 0.6);
    }
    function switchTo(slot) {
      if (slot === 4) { if (!me.nades.length) return; if (me.cur === 4) me.nadeSel = (me.nadeSel + 1) % me.nades.length; else { me.last = me.cur; me.cur = 4; } me.reload = 0; setViewModel(); return; }
      if (slot === 3 && (me.cur === 3 || me.cur === 6) && me.inv[6]) slot = me.cur === 3 ? 6 : 3;  // 3 again: knife <-> taser
      if (!me.inv[slot] || slot === me.cur) return;
      me.last = me.cur; me.cur = slot; me.reload = 0; me.spray = 0; setViewModel();
    }
    function sendAmmo() { const a = {}; for (const s of [1, 2]) if (me.inv[s] && me.inv[s].wid) a[s] = [me.inv[s].wid, me.inv[s].ammo, me.inv[s].reserve]; toHost('ammo', a); }
    function nearestDrop() { let best = null, bd = 1.8; for (const d of st.drops) { const dist = Math.hypot(d.x - me.x, d.z - me.z); if (dist < bd) { bd = dist; best = d; } } return best; }

    // ---- loop ----
    let netT = 0, hudT = 0, radarT = 0, flashT = 0, camKick = 0, camShake = 0, viewY = 0, bob = 0, ammoT = 0, sbT = 0, timeAlive = 0;
    let radioOpen = null;
    const loopH = E.loop((dt) => {
      if (!W) return;
      timeAlive += dt;
      // ---- host simulation ----
      if (match) {
        const mp = match.players.get(myId);
        if (mp) { mp.x = me.x; mp.y = me.y; mp.z = me.z; mp.yaw = me.yaw; mp.pitch = me.pitch; mp.crouch = me.crouch; mp.onGround = me.onGround; mp.vx = me.vx; mp.vz = me.vz;
          mp.cur = me.cur === 4 ? 4 : me.cur; mp.plant = me.cur === 5 && me.alive && (mouseBtn[0] || kd('KeyE') || E.input.touch.buttons.has('use')); mp.defusing = me.alive && (kd('KeyE') || E.input.touch.buttons.has('use')) && st.bomb && st.bomb.s === 'planted' && me.team === 'CT';
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
          Object.assign(q, { x: p.x, y: p.y, z: p.z, tx: p.x, ty: p.y, tz: p.z, yaw: p.yaw, pitch: p.pitch, crouch: p.crouch, hp: p.hp, alive: p.alive, wid: (p.inv[p.cur] || {}).wid || 'knife', c4: !!p.inv[5], planting: p.planting ? p.planting / BOMB.plant : 0, team: p.team, money: p.money });
        }
        for (const id of [...st.players.keys()]) if (!match.players.has(id)) st.players.delete(id);
        if (st.roster.size !== match.players.size || [...match.players.values()].some((p) => (st.roster.get(p.id) || {}).team !== p.team)) setRoster([...match.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, bot: p.bot, agent: p.agent, knife: p.knife })));
        netT += dt;
        if (session && netT >= 0.05) { netT = 0; session.send('snap', match.snap()); }
      } else {
        for (const p of st.players.values()) { const k = Math.min(1, dt * 14); p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k; }
        netT += dt; ammoT += dt;
        if (session && netT >= 1 / 30) { netT = 0; const fl = (me.cur === 5 && (mouseBtn[0] || kd('KeyE')) ? 1 : 0) | ((kd('KeyE') || E.input.touch.buttons.has('use')) && me.team === 'CT' ? 2 : 0) | (me.onGround ? 4 : 0);
          session.toHost('pose', [+me.x.toFixed(2), +me.y.toFixed(2), +me.z.toFixed(2), +me.yaw.toFixed(3), +me.pitch.toFixed(3), +me.crouch.toFixed(2), fl, me.cur]); }
        if (ammoT > 1) { ammoT = 0; sendAmmo(); }
      }

      // ---- local input ----
      const typing = !!hud.chatIn;
      const frozen = st.phase === 'freeze';
      let lk = { dx: mdx, dy: mdy }; mdx = mdy = 0;
      lk.dx += E.input.touch.look.dx; lk.dy += E.input.touch.look.dy; E.input.touch.look.dx = E.input.touch.look.dy = 0;
      const zoomK = me.scoped ? (curWeapon() && curWeapon().zoom ? curWeapon().zoom[me.scoped - 1] / S.fov : 1) : 1;
      const sens = S.sens * 0.022 * Math.PI / 180 * zoomK;
      if (!uiOpen && me.alive) { me.yaw -= lk.dx * sens; me.pitch = Math.max(-1.55, Math.min(1.55, me.pitch - lk.dy * sens)); }
      if (radioOpen) { for (let k = 1; k <= 6; k++) if (kp('Digit' + k)) { hud.radioPick(k - 1); radioOpen = null; } if (kp('Digit0') || kp('Escape')) { hud.radio(null); hud.emoteWheel(null); radioOpen = null; } }
      if (!typing && !uiOpen && !radioOpen) {
        if (me.alive) {
          for (let k = 1; k <= 5; k++) if (kp('Digit' + k)) switchTo(k);
          if (kp('KeyQ')) switchTo(me.last || 1);
          if (kp('WheelDown') || kp('WheelUp')) { const order = [1, 2, 3, 4, 5].filter((s) => s === 4 ? me.nades.length : me.inv[s]); const i = order.indexOf(me.cur); switchTo(order[(i + (kp('WheelDown') ? 1 : order.length - 1)) % order.length]); }
          if (kp('KeyR') || E.input.touch.tapped.has('reload')) startReload();
          if (kp('KeyF')) me.inspect = 2.2;
          if (kp('KeyG')) { if (me.cur === 5 && me.inv[5]) { toHost('dropc4', 1); } else if (me.cur === 1 || me.cur === 2) { sendAmmo(); toHost('drop', me.cur); } }
          if (kp('KeyE') || E.input.touch.tapped.has('use')) { const d = nearestDrop(); if (d && !(st.bomb && st.bomb.s === 'planted' && me.team === 'CT' && Math.hypot(st.bomb.x - me.x, st.bomb.z - me.z) < 2)) { sendAmmo(); toHost('pickup', d.id); } }
          const w = curWeapon();
          if (kp('M2') || E.input.touch.tapped.has('alt')) {
            if (w && w.zoom) { me.scoped = (me.scoped + 1) % (w.zoom.length + 1); audio.play('tick'); }
            else if (w && w.cat === 'knife') fire(true);
            else if (me.cur === 4) fire(true);
            else if (w && w.burst) { me.burst = !me.burst; toast(me.burst ? 'Burst fire' : 'Automatic / semi'); }
          }
          const firing = mouseBtn[0] || E.input.touch.buttons.has('fire');
          if (firing && !frozen) {
            if (me.cur === 4) { if (kp('M0') || E.input.touch.tapped.has('fire')) fire(false); }
            else if (w && (w.auto && !me.burst || kp('M0') || E.input.touch.tapped.has('fire'))) { if (me.burst && kp('M0')) me.burstLeft = 3; fire(false); }
          }
          if (me.burstLeft > 0 && me.cd <= 0) { me.burstLeft--; fire(false); }
        }
        if (kp('KeyB')) openBuy();
        if (kp('KeyY')) hud.chatInput(false, (t) => toHost('chat', { text: t, team: false }));
        if (kp('KeyU')) hud.chatInput(true, (t) => toHost('chat', { text: t, team: true }));
        if (kp('KeyT') && me.alive) { radioOpen = 'emote'; hud.emoteWheel(profile.wheel().map((id) => EMOTE_BY_ID[id]).filter(Boolean), (e) => toHost('emote', e.id)); }
        for (const k of ['z', 'x', 'c']) if (kp('Key' + k.toUpperCase()) && !kd('ControlLeft')) { radioOpen = k; hud.radio(k, me.team, (t) => toHost('chat', { text: '📻 ' + t, team: true })); }
      } else if (uiOpen === 'buy') {
        if (kp('KeyB') || kp('Escape')) closeBuy();
        if (!canBuy()) closeBuy();
      }
      showSb = kd('Tab');
      // movement (frozen in freeze time)
      const w0 = curWeapon(), wspeed = (w0 ? (me.scoped && w0.scopedSpeed ? w0.scopedSpeed : w0.speed) : 245) * U;
      const mv = typing || uiOpen === 'pause' ? { x: 0, y: 0 } : (() => { let x = (kd('KeyD') ? 1 : 0) - (kd('KeyA') ? 1 : 0), y = (kd('KeyW') ? 1 : 0) - (kd('KeyS') ? 1 : 0); if (E.input.touch.active && (E.input.touch.move.x || E.input.touch.move.y)) { x = E.input.touch.move.x; y = E.input.touch.move.y; } return { x, y }; })();
      if (me.emote) { me.emote.t += dt; if (me.emote.t > me.emote.dur || !me.alive || mv.x || mv.y || mouseBtn[0] || kd('Space')) me.emote = null; }
      if (me.alive) {
        const inp = { f: frozen ? 0 : mv.y, s: frozen ? 0 : mv.x, jump: !frozen && !typing && (kd('Space') || E.input.touch.buttons.has('jump')), crouch: !typing && (kd('ControlLeft') || kd('ControlRight')), walk: !typing && (kd('ShiftLeft') || kd('ShiftRight')) };
        const wasG = me.onGround;
        moveStep(W, me, inp, dt, wspeed);
        if (!wasG && me.onGround && me.wasAir > 0.25) audio.play('land', 0.5);
        me.wasAir = me.onGround ? 0 : (me.wasAir || 0) + dt;
        const spd = speedOf(me);
        if (me.onGround && spd > 3 && !inp.walk && !inp.crouch) { me.stepT -= dt * spd / 3.3; if (me.stepT <= 0) { me.stepT = 1; audio.play('step', 0.5); } }
        bob += spd * dt * 1.9;
        if (W.lavaAt(me.x, me.z) && me.y < 0.2 && !match) { /* host applies lava damage */ }
      }
      me.cd -= dt; me.deploy = Math.max(0, me.deploy - dt); me.punch = Math.max(0, me.punch - dt * 0.35 - me.punch * dt * 4); camKick = Math.max(0, camKick - dt * (0.5 + camKick * 8));
      me.sprayT -= dt; if (me.sprayT <= 0 && me.spray > 0) { me.spray = Math.max(0, me.spray - dt * 18); }
      if (me.reload > 0) {
        me.reload -= dt; const it = me.inv[me.cur], w = curWeapon();
        if (me.reload <= 0 && it && w) {
          if (w.shellReload) { if (it.reserve > 0 && it.ammo < w.mag) { it.ammo++; it.reserve--; if (it.ammo < w.mag && it.reserve > 0) me.reload = w.reload; } }
          else { const take = Math.min(w.mag - it.ammo, it.reserve); it.ammo += take; it.reserve -= take; }
        }
        if (w && w.shellReload && mouseBtn[0] && it && it.ammo > 0) me.reload = 0;
      }
      if (me.unscopeAfterShot && me.cd > 0) { me.scoped = 0; me.unscopeAfterShot = false; me.rescope = true; }
      if (me.rescope && me.cd <= 0) { me.rescope = false; }
      me.flash = Math.max(0, me.flash - dt);
      me.inspect = Math.max(0, me.inspect - dt); me.knifeSwing = Math.max(0, me.knifeSwing - dt);
      if (flashT > 0) { flashT -= dt; if (flashT <= 0 && vm && vm.userData.flash) vm.userData.flash.visible = false; }
      if (!me.alive && pressed.has('M0')) specNext = true;
      pressed.clear();

      // grenades in flight (visual)
      for (const [id, f] of flying) { nadeStep(W, f.n, dt); f.m.position.set(f.n.x, f.n.y + 0.06, f.n.z); f.m.rotation.x += dt * 8; f.n.age += dt; if (f.n.age > 8) { fx.remove(f.m); flying.delete(id); } }
      for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].t -= dt; if (tracers[i].t <= 0) { fx.remove(tracers[i].l); tracers[i].l.geometry.dispose(); tracers.splice(i, 1); } }
      for (let i = puffs.length - 1; i >= 0; i--) { puffs[i].t -= dt; puffs[i].m.scale.setScalar(1 + (0.25 - puffs[i].t) * 6); if (puffs[i].t <= 0) { fx.remove(puffs[i].m); puffs.splice(i, 1); } }
      // bomb beeps
      if (st.bomb && st.bomb.s === 'planted' && st.bomb.t != null) { bombBeep -= dt; const rate = Math.max(0.12, Math.min(1, st.bomb.t / 30)); if (bombBeep <= 0) { bombBeep = rate; audio.at('beep', st.bomb.x, st.bomb.y, st.bomb.z, cam, 50); } }
    }, (alpha, dt) => {
      if (!W) return;
      gov(dt); fpsM(dt);
      // ---- camera: own eyes, or spectate a teammate ----
      let viewYaw = me.yaw, viewPitch = me.pitch + me.punch * 0.35 + camKick, ex = me.x, ey = me.y + eyeHeight(me), ez = me.z;
      let spectating = null;
      if (!me.alive && (st.phase !== 'warmup')) {
        const mates = [...st.players.values()].filter((p) => p.alive && p.team === me.team);
        if (mates.length) { if (!specTarget || !mates.find((p) => p.id === specTarget)) specTarget = mates[0].id; if (specNext) { specNext = false; const i = mates.findIndex((p) => p.id === specTarget); specTarget = mates[(i + 1) % mates.length].id; } const p = st.players.get(specTarget); spectating = p; ex = p.x; ey = p.y + 1.62 - (p.crouch || 0) * 0.46; ez = p.z; viewYaw = p.yaw; viewPitch = p.pitch; }
        else { viewPitch = -0.5; ey = me.y + 3.5; }
      }
      viewY += (ey - viewY) * Math.min(1, dt * 18); if (Math.abs(ey - viewY) > 1.5) viewY = ey;
      const shake = camShake > 0 ? (Math.random() - 0.5) * camShake * 0.05 : 0; camShake = Math.max(0, camShake - dt * 2);
      cam.position.set(ex, viewY + (spectating ? 0 : Math.sin(bob * 2) * 0.012), ez); cam.rotation.set(viewPitch + shake, viewYaw + shake, 0);
      const w = curWeapon();
      const zoomFov = me.scoped && w && w.zoom ? w.zoom[me.scoped - 1] : S.fov;
      const vfov = 2 * Math.atan(Math.tan(zoomFov * Math.PI / 360) * 0.75) * 180 / Math.PI;  // horizontal 4:3 -> vertical
      if (Math.abs(cam.fov - vfov) > 0.01) { cam.fov = vfov; cam.updateProjectionMatrix(); }
      // ---- players ----
      const now = performance.now() / 1000;
      for (const p of st.players.values()) {
        const r = rigFor(p.id); r.g.visible = p.alive || (r.dieT != null && r.dieT < 3);
        if (!p.alive && r.dieT == null) r.dieT = 0.001;
        if (p.alive) r.dieT = null; else r.dieT += dt;
        const sp = Math.hypot(p.x - r.x, p.z - r.z) / Math.max(dt, 1e-3); r.x = p.x; r.z = p.z;
        r.g.position.set(p.x, p.y, p.z); r.g.rotation.y = p.yaw;
        r.t += dt;
        if (r.emote) { r.emote.t += dt; if (r.emote.t > r.emote.dur || sp > 0.5 || !p.alive) r.emote = null; }
        posePlayer(r, { speed: Math.min(sp, 7), t: r.t, crouch: p.crouch || 0, pitch: p.pitch || 0, dead: r.dieT ? Math.min(1, r.dieT * 3) : 0, emote: r.emote });
        if (spectating && p.id === spectating.id) r.g.visible = false;
      }
      // own body while emoting: camera swings out in front, you see yourself
      const selfRig = me.emote || rigs.has(myId) ? rigFor(myId) : null;
      if (selfRig) {
        selfRig.g.visible = !!me.emote && me.alive;
        if (me.emote) {
          selfRig.t += dt; selfRig.g.position.set(me.x, me.y, me.z); selfRig.g.rotation.y = me.yaw;
          posePlayer(selfRig, { t: selfRig.t, emote: me.emote });
          const k = Math.min(1, me.emote.t * 2.5, (me.emote.dur - me.emote.t) * 2.5), ang = me.yaw + Math.PI + 0.5;
          let dist = 3.2 * k;
          const o = { x: me.x, y: me.y + 1.5, z: me.z }, d = { x: -Math.sin(ang), y: 0.18, z: -Math.cos(ang) }, L = Math.hypot(d.x, d.y, d.z); d.x /= L; d.y /= L; d.z /= L;
          const hit = W.ray(o, d, dist); if (hit) dist = Math.max(0.3, hit.t - 0.3);
          cam.position.set(o.x + d.x * dist, o.y + d.y * dist, o.z + d.z * dist); cam.lookAt(me.x, me.y + 1.2, me.z);
        }
      }
      // bomb
      const b = st.bomb; bombObj.visible = !!b && (b.s === 'planted' || b.s === 'dropped');
      if (bombObj.visible) { bombObj.position.set(b.x, b.y + 0.02, b.z); bombObj.userData.led.visible = b.s !== 'planted' || (now * (1 + (40 - (b.t || 40)) / 8)) % 1 < 0.5; }
      // ---- view model ----
      if (vm) {
        vm.visible = me.alive && !(me.scoped && w && w.zoom) && !spectating && !me.emote;
        const base = vm.userData.base, sp = speedOf(me);
        const dep = me.deploy > 0 ? me.deploy * 0.5 : 0, rel = me.reload > 0 ? 0.12 : 0;
        vm.position.set(base.x + Math.sin(bob) * 0.008 * Math.min(1, sp / 4), base.y + Math.abs(Math.cos(bob)) * 0.006 * Math.min(1, sp / 4) - dep - rel - me.crouch * 0.01, base.z + camKick * 1.4 + (me.knifeSwing > 0 ? -Math.sin(me.knifeSwing / 0.25 * Math.PI) * 0.12 : 0));
        vm.rotation.set(rel * 2 + camKick * 2 + (me.knifeSwing > 0 ? -Math.sin(me.knifeSwing / 0.25 * Math.PI) * 0.6 : 0), (vm.userData.ry || 0) + (me.inspect > 0 ? Math.sin((2.2 - me.inspect) / 2.2 * Math.PI) * 1.2 : 0), me.inspect > 0 ? Math.sin((2.2 - me.inspect) / 2.2 * Math.PI) * 0.5 : 0);
        vm.position.x *= 1;
      }
      // ---- draw ----
      renderer.clear(); renderer.render(scene, cam); renderer.clearDepth(); if (vm && vm.visible) renderer.render(vmScene, vmCam);
      // ---- HUD (throttled) ----
      hudT += dt; radarT += dt;
      hud.flashAmt(me.flash > 1.5 ? 1 : me.flash / 1.5);
      hud.setScope(me.alive && me.scoped > 0 && w && w.zoom);
      const spreadPx = (w ? spreadOf(w, me, me.scoped > 0, me.spray) : 0) * 600;
      hud.xh(spreadPx, me.alive && !(me.scoped && w && w.zoom) && !uiOpen);
      if (hudT > 0.066) {
        hudT = 0;
        const hpShown = spectating ? spectating.hp : me.hp;
        hud.vitals(hpShown, spectating ? (spectating.armor || 0) : me.armor, me.helmet);
        hud.money(me.money, canBuy());
        const it = me.inv[me.cur];
        const ammoTxt = me.cur === 4 ? `${esc(itemName(me.nades[me.nadeSel] || ''))}` : w && w.cat !== 'knife' && it ? `${it.ammo}<small> / ${it.reserve}</small>` : '';
        const slotHtml = [1, 2, 3, 6, 4, 5].map((s) => s === 4 ? (me.nades.length ? `<div class="slot ${me.cur === 4 ? 'on' : ''}"><b>4</b>${me.nades.map((n) => esc(itemName(n).split(' ')[0])).join(' · ')}</div>` : '') : me.inv[s] ? `<div class="slot ${me.cur === s ? 'on' : ''}"><b>${s === 6 ? 3 : s}</b>${esc(s === 5 ? 'C4 Bomb' : s === 6 ? 'Zap-27' : s === 3 && (loadout[me.team] || {}).knife ? (itemInfo((loadout[me.team] || {}).knife) || {}).wpn || 'Knife' : itemName(me.inv[s].wid))}</div>` : '').join('');
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
        if (st.phase === 'freeze') hint = `Buy time · ${Math.ceil(st.timer)}s · press B`;
        else if (me.alive && me.inv[5] && W.siteAt(me.x, me.z) && (!MODES[mode].bombSite || MODES[mode].bombSite === W.siteAt(me.x, me.z))) hint = me.cur === 5 ? 'Hold fire or E to plant' : 'Press 5 to take out the bomb';
        else if (me.alive && me.team === 'CT' && st.bomb && st.bomb.s === 'planted' && Math.hypot(st.bomb.x - me.x, st.bomb.z - me.z) < 1.8) hint = `Hold E to defuse${me.defuser ? ' (kit: 5s)' : ' (10s)'}`;
        else { const d = me.alive && nearestDrop(); if (d) hint = `E: pick up ${itemName(d.wid)}`; }
        if (match && !started && session) hint = 'Lobby: start the match from the panel';
        hud.hint(hint);
        hud.spec(spectating ? `Spectating ${(st.roster.get(spectating.id) || {}).name || ''} · click for next` : !me.alive && st.phase !== 'warmup' ? 'You are dead' : '');
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
      set(`+${res.coins} coins · +${res.xp} XP${res.coins === 0 && profile.signedIn ? ' (daily coin limit reached)' : ''}`);
    }
    function quit() {
      ended = true;
      try { loopH.stop(); } catch (e) { /* already stopped */ }
      try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { /* not locked */ }
      removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('mousemove', onMove); removeEventListener('mouseup', onUp); removeEventListener('resize', resize);
      document.removeEventListener('pointerlockchange', onLock);
      if (session) session.leave(); if (lobby) lobby.close();
      if (lobbyPanel) { clearInterval(lobbyPanel.iv); lobbyPanel.remove(); }
      hud.destroy(); renderer.dispose(); renderer.domElement.remove();
      document.querySelectorAll('.bd-stick,.bd-btns,.bd-look').forEach((e) => e.remove());
      history.replaceState(null, '', location.pathname);
      if (!smoke) showMenu();
    }
    window.__cs = { me, st, get match() { return match; }, hud, switchTo }; if (smoke) { me.alive = true; window.__csSmoke = window.__cs; }
  }
}
