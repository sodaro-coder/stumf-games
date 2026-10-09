// Story mode on every screen (host and clients): cutscenes shot in-engine (a director camera cuts between the people
// talking), lines over gameplay, the objective tracker, the squad panel with ability cooldowns, the boss bar, the world
// markers (objective beacons, terminals with their puzzle numbers, the bomb, people to talk to), the Goy-Beam warning and
// beam, the boss's rocket balls, the black card between levels while the next one loads, and the chapter hub where the
// same party picks loadouts and readies up. It only draws what the host says; game.js forwards the events and calls
// tick() every frame, and shot() while a cutscene plays.
import * as THREE from '../sdk/three.module.min.js';
import { CHARACTERS, MISSIONS, CHAPTERS, SQUAD } from './story.js';

const COLORS = { headliner: '#d070ff', radio: '#a8b4bc', dad: '#c8a050', danny: '#f2b080', doctor: '#cfe0ea', nurse: '#cfe0ea', enemy: '#c8c8c8', wiener: '#e8613a', cancer: '#9ad0ff', ricky: '#c07aff', igor: '#8fd06a', recruit: '#d8d8a0', boss: '#ff3b3b', command: '#ffb04a', tape: '#9ad0ff', squad: '#ffffff' };
const VOICE = { headliner: [1.35, 0.9], radio: [0.85, 1.25], dad: [0.55, 0.92], danny: [1.7, 1.1], doctor: [0.95, 0.95], nurse: [1.15, 1.0], bouncer: [0.6, 1.0], boss: [0.6, 1.0], ricky: [1.2, 1.05], igor: [0.75, 0.95], cancer: [0.9, 0.95], tape: [0.88, 0.92], wiener: [0.8, 1.05], command: [1.0, 1.15], recruit: [1.25, 1.1] };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lineTime = (l) => 1.6 + String(l.text).length * 0.045 + ((l.o && l.o.hold) || 0);   // the same pace the host uses (story_sim.js scene())
const stage = (t) => /^\(.*\)$|^\*.*\*$/.test(String(t).trim());   // "(laughing)", "*coughs*": a stage direction, not spoken

export function storyClient({ scene, myId, audio, onSkip, isHost, canvas, onDirect, music }) {
  const css = document.createElement('style');
  css.textContent = `.sc-ui{position:fixed;inset:0;pointer-events:none;z-index:46;font-family:system-ui,sans-serif;color:#fff}
  .sc-obj{position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);top:62px;max-width:min(330px,40vw);background:linear-gradient(90deg,#0000,#000a 30%);padding:8px 12px 8px 26px;text-align:right;border-right:3px solid #f2a33a}
  .sc-obj b{display:block;font-size:11px;letter-spacing:.14em;color:#f2a33a;text-transform:uppercase}.sc-obj span{font-size:15px;font-weight:700;text-shadow:0 1px 3px #000}.sc-obj i{display:block;font-style:normal;font-size:12px;color:#cfd6df;margin-top:2px}
  .sc-squad{position:absolute;left:calc(env(safe-area-inset-left,0px) + 12px);bottom:84px;display:flex;flex-direction:column;gap:4px}
  .sc-m{display:flex;align-items:center;gap:6px;background:#000a;border-left:3px solid var(--c);padding:3px 8px 3px 6px;font-size:12px;min-width:150px}.sc-m.dead{opacity:.45}
  .sc-m em{font-style:normal;font-weight:800;flex:1}.sc-m .bar{width:56px;height:5px;background:#333;border-radius:3px;overflow:hidden}.sc-m .bar i{display:block;height:100%;background:var(--c)}
  .sc-m small{color:#f2a33a;font-weight:800;min-width:30px;text-align:right}
  .sc-boss{position:absolute;left:50%;top:58px;transform:translateX(-50%);width:min(560px,70vw);text-align:center;display:none}.sc-boss b{font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#ffd0d0;text-shadow:0 0 8px #f00}
  .sc-boss div{height:12px;background:#300;border:1px solid #f55;border-radius:6px;overflow:hidden;margin-top:4px}.sc-boss div i{display:block;height:100%;background:linear-gradient(90deg,#ff2e2e,#ff9a3c);transition:width .2s}
  .sc-cut{position:absolute;inset:0;display:none;pointer-events:auto;z-index:50}.sc-cut:before,.sc-cut:after{content:'';position:absolute;left:0;right:0;height:11vh;background:#000}.sc-cut:before{top:0}.sc-cut:after{bottom:0}
  .sc-line{position:absolute;left:50%;bottom:14vh;transform:translateX(-50%);width:min(760px,88vw);text-align:center;text-shadow:0 2px 6px #000,0 0 18px #000}
  .sc-line b{display:block;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--c);margin-bottom:4px}.sc-line p{margin:0;font-size:21px;line-height:1.35}.sc-line p.dir{font-style:italic;color:#c8ccd4;font-size:18px}.sc-line p.credits{font:900 34px system-ui;letter-spacing:.14em}
  .sc-skip{position:absolute;right:16px;bottom:calc(11vh + 10px);color:#8d97a5;font-size:12px}
  .sc-title{position:absolute;left:0;right:0;top:15vh;text-align:center;font:900 30px system-ui;letter-spacing:.08em;text-shadow:0 2px 12px #000}
  .sc-talk{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);width:min(680px,86vw);text-align:center;font-size:16px;opacity:0;transition:opacity .25s;text-shadow:0 1px 4px #000,0 0 12px #000}.sc-talk b{color:var(--c)}
  .sc-bark{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);background:#000b;border-radius:8px;padding:5px 12px;font-size:13px;opacity:0;transition:opacity .25s}.sc-bark b{color:var(--c)}
  .sc-card{position:absolute;inset:0;background:#05070b;display:none;place-items:center;pointer-events:auto;z-index:60;transition:opacity .6s}.sc-card>div{text-align:center;max-width:min(720px,88vw)}
  .sc-card small{display:block;color:#f2a33a;letter-spacing:.24em;font-size:12px;text-transform:uppercase}.sc-card h1{font:900 40px system-ui;margin:10px 0;letter-spacing:.04em}.sc-card p{color:#c8ccd4;font-size:18px;font-style:italic;margin:0 0 18px}
  .sc-card em{display:block;color:#5a6270;font-size:12px;font-style:normal}.sc-card .rw{color:#7ed957;font-size:13px;margin-top:8px}
  .sc-hub{position:absolute;inset:0;background:#05070bf2;display:none;place-items:center;pointer-events:auto;z-index:60;overflow:auto}.sc-hub>div{width:min(640px,92vw);margin:20px auto}
  .sc-hub h2{margin:0 0 4px;font:900 28px system-ui}.sc-hub .p{display:flex;align-items:center;gap:10px;background:#141922;border-left:3px solid var(--c);padding:8px 12px;margin:6px 0}
  .sc-hub .p b{flex:1}.sc-hub .p span{font-size:12px;color:#8d97a5}.sc-hub .ok{color:#7ed957;font-weight:800}
  .sc-hub button{margin:6px 6px 0 0;padding:10px 16px;border-radius:8px;border:0;font:800 13px system-ui;letter-spacing:.08em;cursor:pointer;background:#2a3140;color:#fff}.sc-hub button.go{background:#f2a33a;color:#111}.sc-hub button.on{background:#7ed957;color:#111}
  .sc-hub .chars button{background:#1b2028;border:1px solid #2e343d}.sc-hub .chars button.sel{border-color:#f2a33a;color:#f2a33a}.sc-hub .chars button:disabled{opacity:.35}
  .sc-focus{position:absolute;inset:0;box-shadow:inset 0 0 120px #8fd06a55;display:none}
  .sc-vis{position:absolute;inset:0;pointer-events:none;transition:background .8s,box-shadow .8s,opacity .8s;opacity:0}
  .sc-watch{position:absolute;left:50%;top:14px;transform:translateX(-50%);background:#000b;border:1px solid #ffffff22;border-radius:8px;padding:6px 14px;font-size:13px;display:none;z-index:52}
  .sc-unlock{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);background:#0b0d12f2;border:2px solid #7ed957;border-radius:14px;padding:18px 26px;text-align:center;display:none;z-index:55;box-shadow:0 0 60px #7ed95744}
  .sc-unlock b{display:block;color:#7ed957;letter-spacing:.2em;font-size:12px}.sc-unlock h2{margin:6px 0;font:900 30px system-ui}.sc-unlock p{margin:0;color:#c8ccd4;font-size:14px}.sc-unlock kbd{display:inline-block;background:#2a3140;border-radius:5px;padding:2px 8px;margin:0 3px;font:800 13px system-ui;color:#fff}
  .sc-boss em{display:block;font-style:normal;font-weight:900;color:#7ed957;font-size:12px;letter-spacing:.2em;height:14px}
  body.sc-cutting .kc-t,body.sc-cutting .cs-hud,body.sc-cutting .sc-squad,body.sc-cutting .sc-obj,body.sc-cutting .sc-boss{visibility:hidden}
  @media (max-height:520px){.sc-obj{top:44px;padding:4px 10px 4px 20px}.sc-obj span{font-size:13px}.sc-squad{bottom:auto;top:96px;left:auto;right:calc(env(safe-area-inset-right,0px) + 12px);gap:2px}.sc-m{min-width:118px;font-size:10px;padding:1px 6px}.sc-m .bar{width:40px}
    .sc-line p{font-size:16px}.sc-title{font-size:18px;top:13vh}.sc-line{bottom:13vh}.sc-talk{bottom:96px;font-size:13px}.sc-card h1{font-size:26px}.sc-card p{font-size:15px}}`;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.className = 'sc-ui';
  ui.innerHTML = `<div class="sc-vis"></div><div class="sc-watch"></div><div class="sc-unlock"></div><div class="sc-focus"></div><div class="sc-obj"><b></b><span></span><i></i></div><div class="sc-squad"></div><div class="sc-boss"><b></b><div><i></i></div><em></em></div>
    <div class="sc-talk"></div><div class="sc-bark"></div><div class="sc-cut"><div class="sc-title"></div><div class="sc-line"><b></b><p></p></div><div class="sc-skip">tap / Space / A: skip</div></div>
    <div class="sc-card"><div><small></small><h1></h1><p></p><em></em><div class="rw"></div></div></div><div class="sc-hub"></div>`;
  document.body.appendChild(ui);
  const $ = (s) => ui.querySelector(s);

  // ---- 3D: markers, beam, balls ----
  const grp = new THREE.Group(); scene.add(grp);
  queueMicrotask(() => { grp.add(snow); grp.add(shadowMesh); });
  const markerObjs = new Map();
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), beamMat); beam.visible = false; grp.add(beam);
  const ballGeo = new THREE.SphereGeometry(0.28, 14, 10), ballMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a }), balls = [];
  const label = (text, col) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.font = '900 34px system-ui'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#000'; g.fillStyle = col; g.strokeText(text, 128, 44); g.fillText(text, 128, 44);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(2.2, 0.55, 1); s.renderOrder = 9; return s;
  };
  const MARK_COL = { goal: 0x3cff8a, area: 0xff4a4a, hold: 0x3c9aff, item: 0xffd23a, terminal: 0x40e0ff, bomb: 0xff3030, target: 0xff2a6a, talk: 0xffffff, revive: 0x7ed957 };
  function marker(m) {
    const g = new THREE.Group(), col = MARK_COL[m.kind] || 0xffffff, talk = m.kind === 'talk';
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(talk ? 0.2 : 0.35, talk ? 0.2 : 0.35, talk ? 6 : 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    pillar.position.y = talk ? 3 : 20; g.add(pillar);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(m.kind === 'hold' || m.kind === 'area' ? 6 : 0.9, 0.05, 6, 48), new THREE.MeshBasicMaterial({ color: col })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    let core = null;
    if (m.kind === 'item') { core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: col })); core.position.y = 1; g.add(core); }
    if (m.kind === 'terminal' || m.kind === 'bomb') { core = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.4), new THREE.MeshStandardMaterial({ color: m.kind === 'bomb' ? 0x3a2a1a : 0x2a3440, emissive: col, emissiveIntensity: 0.25, metalness: 0.4, roughness: 0.5 })); core.position.y = 0.55; g.add(core); }
    const tag = label(m.kind === 'terminal' && /^\d+$/.test(m.label) ? '# ' + m.label : m.label || '', '#' + col.toString(16).padStart(6, '0')); tag.position.y = talk ? 2.3 : 2.4; g.add(tag);
    g.userData = { pillar, ring, core, tag }; return g;
  }

  // ---- the world this level is on: zone centres and named marks (cameras, shadows) ----
  let W = null;
  const zoneAt = (name) => { if (!W || name == null) return null; if (Array.isArray(name)) return { x: name[0], y: groundAt(name[0], name[1]), z: name[1] }; const mk = (W.B.marks || {})[name]; if (mk) return { x: mk[0], y: mk[1], z: mk[2], rot: mk[3] }; const z = W.B.zones.find((q) => q[0] === name); return z ? { x: (z[1] + z[3]) / 2, y: groundAt((z[1] + z[3]) / 2, (z[2] + z[4]) / 2), z: (z[2] + z[4]) / 2 } : null; };
  // ---- the screen's mood: colour, vignette and how muffled the world sounds ----
  const VIS = {
    '': { f: '', bg: '', o: 0, m: 0 },
    flashback: { f: 'sepia(.55) saturate(1.25) contrast(1.06) brightness(.97)', bg: 'radial-gradient(ellipse at center, transparent 45%, #2a1408cc 100%)', o: 1, m: 0.45 },
    memory: { f: 'sepia(.25) brightness(1.18) contrast(.88) saturate(.7) blur(.6px)', bg: 'radial-gradient(ellipse at center, #ffffff22 30%, #fff8e8aa 100%)', o: 1, m: 0.6 },
    dying: { f: 'grayscale(.75) blur(1.6px) contrast(1.1) brightness(.85)', bg: 'radial-gradient(ellipse at center, transparent 30%, #3a0000ee 100%)', o: 1, m: 0.8 },
    black: { f: 'brightness(0)', bg: '#000', o: 1, m: 0.9 },
    dread: { f: 'saturate(.35) contrast(1.15) brightness(.82) hue-rotate(-8deg)', bg: 'radial-gradient(ellipse at center, transparent 40%, #000a14cc 100%)', o: 1, m: 0.25 },
    dread_dark: { f: 'saturate(.2) contrast(1.25) brightness(.55)', bg: 'radial-gradient(ellipse at center, transparent 25%, #000000f0 95%)', o: 1, m: 0.35 },
    dread_last: { f: 'saturate(.5) contrast(1.1) brightness(.7) sepia(.2)', bg: 'radial-gradient(ellipse at center, #ffd8a011 20%, #000000e8 95%)', o: 1, m: 0.3 },
    night: { f: 'saturate(.85) brightness(.95) hue-rotate(6deg)', bg: 'radial-gradient(ellipse at center, transparent 55%, #00061888 100%)', o: 1, m: 0 },
    blizzard: { f: 'contrast(.9) brightness(1.05) saturate(.7)', bg: 'radial-gradient(ellipse at center, #ffffff10 30%, #eef3f8b0 100%)', o: 1, m: 0.15 },
    nuke: { f: 'sepia(.4) saturate(1.6) brightness(1.15) contrast(1.2) hue-rotate(-12deg)', bg: 'radial-gradient(ellipse at 50% 90%, #ffb04866 0%, #3a100088 100%)', o: 1, m: 0.5 },
  };
  let visNow = null;
  function vision(mode) {
    mode = VIS[mode] ? mode : ''; if (mode === visNow) return; visNow = mode; const v = VIS[mode];
    if (canvas) { canvas.style.transition = 'filter .9s'; canvas.style.filter = v.f; }
    const el = $('.sc-vis'); el.style.background = v.bg; el.style.opacity = v.o;
    if (audio && audio.muffle) audio.muffle(v.m);
    snow.visible = mode === 'blizzard';
    if (mode === 'nuke') { const f = document.createElement('div'); f.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:1;transition:opacity 2.5s'; ui.appendChild(f); setTimeout(() => { f.style.opacity = 0; }, 80); setTimeout(() => f.remove(), 2800); if (audio) audio.play('he', 0.4); }
  }
  // snowfall around the camera (the blizzard)
  const snowGeo = new THREE.BufferGeometry(), SN = 1400, snowPos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { snowPos[i * 3] = (Math.random() - 0.5) * 40; snowPos[i * 3 + 1] = Math.random() * 14; snowPos[i * 3 + 2] = (Math.random() - 0.5) * 40; }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false })); snow.visible = false; snow.frustumCulled = false;
  // a shadow on a wall: someone big, drinking or swinging, seen from the hallway
  const shadowTex = (pose) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 384; const g = c.getContext('2d'); g.fillStyle = '#000';
    g.beginPath(); g.ellipse(128, 70, 46, 60, 0, 0, 7); g.fill();                 // the bun-shaped head
    g.beginPath(); g.ellipse(128, 230, 78, 140, 0, 0, 7); g.fill();               // the body
    g.save(); g.translate(170, 150); g.rotate(pose === 'drink' ? -2.3 : -1.0); g.fillRect(-14, 0, 28, 120); g.restore();   // the arm: raised with a bottle, or back to swing
    if (pose === 'drink') { g.fillRect(150, 30, 18, 60); } else { g.beginPath(); g.ellipse(250, 90, 22, 20, 0, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); return t;
  };
  const shadows = { drink: null, beat: null };
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); shadowMesh.visible = false;
  let shadowPose = '', shadowT = 0;
  function showShadow(pose) {
    if (!pose) { shadowMesh.visible = false; shadowPose = ''; return; }
    const mk = zoneAt('Shadow Wall'); if (!mk) return;
    if (!shadows[pose]) shadows[pose] = shadowTex(pose);
    shadowMesh.material.map = shadows[pose]; shadowMesh.material.needsUpdate = true; shadowMesh.material.opacity = 0.62;
    shadowMesh.position.set(mk.x, mk.y, mk.z); shadowMesh.rotation.set(0, mk.rot || 0, 0); shadowMesh.visible = true; shadowPose = pose; shadowT = 0;
  }
  // telegraphs: where a boss attack is about to land
  const teleMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }), teles = [];
  function teleMesh(t) {
    let geo;
    if (t.k === 'circle') geo = new THREE.CircleGeometry(t.r, 32);
    else if (t.k === 'arc') geo = new THREE.CircleGeometry(t.r, 24, Math.PI / 2 - t.a / 2, t.a);
    else geo = new THREE.PlaneGeometry(t.w * 2, t.r);
    const m = new THREE.Mesh(geo, teleMat.clone()); m.rotation.x = -Math.PI / 2; m.renderOrder = 3; return m;
  }
  // a heal: a green ring that spreads from Wiener
  const rings = [];
  // ---- state ----
  let camRef = null;
  let S = null, cutQ = [], cutT = 0, cutAll = [], cutT0 = 0, talkQ = [], talkT = 0, barkT = 0, focusT = 0, groundAt = () => 0, lineIdx = 0, shotT = 0;
  const say = (l) => { if (!stage(l.text) && l.who !== 'credits' && audio && audio.say) { const v = VOICE[l.who] || [1, 1]; audio.say(String(l.text).replace(/\([^)]*\)|\*[^*]*\*/g, ''), v[0], v[1]); } };
  function showLine() {
    const l = cutQ[0]; document.body.classList.toggle('sc-cutting', !!l);
    if (!l) { $('.sc-cut').style.display = 'none'; return; }
    $('.sc-cut').style.display = 'block'; $('.sc-line').style.setProperty('--c', COLORS[l.who] || '#fff');
    $('.sc-line b').textContent = stage(l.text) || l.who === 'credits' ? '' : l.name; const p = $('.sc-line p'); p.textContent = l.text; p.className = l.who === 'credits' ? 'credits' : stage(l.text) ? 'dir' : '';
    cutT = lineTime(l); lineIdx++; shotT = 0; say(l);
    const o = l.o; if (o) {   // the line's stage directions, on this screen
      if (o.vision != null) vision(o.vision); if (o.music != null && music) music.set(o.music); if (o.sfx && audio) audio.play(o.sfx, 0.9);
      if ('shadow' in o) showShadow(o.shadow); else if (shadowPose && !o.shadow) showShadow('');
      if (onDirect && (o.place || o.walk || o.slowmo || o.smoke || o.down)) onDirect(o, zoneAt);
    } else if (shadowPose) showShadow('');
    if (lineIdx > 1) $('.sc-title').textContent = '';   // the title sits on the opening shot only
  }
  // a skipped scene still leaves the world where it would have ended: the lasting directions of the unplayed lines
  // (the look, the score, where people stand) happen at once; the momentary ones (sounds, slow motion) are dropped
  const flushCut = () => {
    for (const l of cutQ.slice(1)) { const o = l.o; if (!o) continue;
      if (o.vision != null) vision(o.vision); if (o.music != null && music) music.set(o.music);
      const at = o.place || o.walk; if (onDirect && at) onDirect({ place: at }, zoneAt);
    }
  };
  const endCut = () => { showShadow(''); cutQ = []; $('.sc-title').textContent = ''; showLine(); };
  const next = () => { if (!cutQ.length) return; cutQ.shift(); if (!cutQ.length) $('.sc-title').textContent = ''; showLine(); };
  // asking to skip: everyone playing has to agree (solo: instant); the host then ends the scene for everyone
  const askSkip = () => { if (!cutQ.length) return; if (onSkip) onSkip(); else endCut(); };
  $('.sc-cut').addEventListener('pointerdown', askSkip);
  const onKey = (e) => { if (cutQ.length && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) askSkip(); };
  addEventListener('keydown', onKey);
  function nextTalk() {
    const l = talkQ.shift(), el = $('.sc-talk');
    if (!l) { el.style.opacity = 0; talkT = 0; return; }
    el.style.setProperty('--c', COLORS[l.who] || '#fff'); el.innerHTML = stage(l.text) ? `<i>${esc(l.text)}</i>` : `<b>${esc(l.name)}:</b> ${esc(l.text)}`; el.style.opacity = 1;
    talkT = lineTime(l) + 0.3; say(l);
  }
  function render() {
    if (!S) return;
    $('.sc-obj b').textContent = `Objective ${Math.min(S.obj + 1, S.n)} / ${S.n}`; $('.sc-obj span').textContent = S.hint || '';
    const pct = (k) => `${Math.round(((S.markers[k] || {}).prog || 0) * 100)}%`;
    const tl = S.kind === 'defend' || S.kind === 'survive' ? `${Math.max(0, S.need - S.have)}s left` : S.kind === 'defuse' ? `${pct(0)} · hold USE` : S.kind === 'revive' ? `${pct(0)} · hold USE on them` : ['stealth', 'carry', 'reach'].includes(S.kind) ? '' : `${S.have} / ${S.need}`;
    $('.sc-obj i').textContent = (S.need ? tl : '') + (S.next ? ` · next: #${S.next}` : '');
    $('.sc-squad').innerHTML = (S.chars || []).map((c) => { const C = CHARACTERS[c.char] || CHARACTERS.ricky, ab = C.ability; return `<div class="sc-m${c.alive ? '' : ' dead'}" style="--c:${COLORS[c.char] || '#fff'}"><em>${esc(C.short)}${c.id === myId ? ' (you)' : ''}</em><span class="bar"><i style="width:${Math.max(0, Math.min(100, c.hp / (c.max || 100) * 100))}%"></i></span><small>${ab ? (c.lock ? '🔒' : ab.id === 'cancer_nade' ? (c.nade ? 'G' : '–') : c.cd ? c.cd + 's' : 'G') : ''}</small></div>`; }).join('');
    const b = S.boss; $('.sc-boss').style.display = b ? 'block' : 'none';
    if (b) { $('.sc-boss b').textContent = b.name || 'Osama bin Ballin'; $('.sc-boss i').style.width = Math.max(0, b.hp / b.max * 100) + '%'; $('.sc-boss em').textContent = S.vuln ? 'OPEN: HIT IT NOW' : ''; }
    // the banner only while this player is out of it, not once they're back in
    const f = S.featured, w = $('.sc-watch'); if (f && f.id && f.id !== myId && !(S.chars || []).some((c) => c.id === myId)) { w.textContent = `You're watching ${(CHARACTERS[f.char] || {}).short || ''}'s story`; w.style.display = 'block'; } else w.style.display = 'none';
    if (!cutQ.length) { if (S.vision != null) vision(S.vision); if (S.music != null && music) music.set(S.music); }
    const keep = new Set();
    for (const m of S.markers || []) {
      keep.add(m.id); let o = markerObjs.get(m.id);
      if (!o || o.userData.key !== m.kind + m.label) { if (o) grp.remove(o); o = marker(m); o.userData.key = m.kind + m.label; grp.add(o); markerObjs.set(m.id, o); }
      o.position.set(m.x, groundAt(m.x, m.z), m.z); o.visible = !m.done;
    }
    for (const [id, o] of markerObjs) if (!keep.has(id)) { grp.remove(o); markerObjs.delete(id); }
  }

  // ---- the director: where the camera goes while a scene plays ----
  // close-ups on whoever is talking (alternating sides, a slow push in), an over-the-shoulder two-shot every few lines,
  // a high establishing orbit under the title; voices with no body here (Command on the radio, the tape) get the wide.
  const cam = { p: new THREE.Vector3(), l: new THREE.Vector3(), init: false };
  function shot(now, posOf) {
    const l = cutQ[0]; if (!l) { cam.init = false; return null; }
    const chars = (S && S.chars) || [], squad = chars.map((c) => posOf(c.id)).filter(Boolean);
    const avg = (k) => (squad.length ? squad.reduce((s, p) => s + p[k], 0) / squad.length : 0), cx = avg('x'), cy = avg('y'), cz = avg('z');
    const who = l.who === 'boss' ? (S && S.boss ? posOf(S.boss.id) : null) : (() => { const c = chars.find((q) => q.char === l.who && q.alive); return c ? posOf(c.id) : null; })();
    const title = !!$('.sc-title').textContent && lineIdx <= 1;   // cleared after the first line
    const cam1 = l.o && l.o.cam, me = posOf(myId);
    if (cam1 === 'pov' || cam1 === 'pov_down') {   // through the eyes (a child in a hallway; a man on the ground)
      const lk = zoneAt(l.o.look) || (me ? { x: me.x - Math.sin(me.yaw || 0) * 4, y: me.y, z: me.z - Math.cos(me.yaw || 0) * 4 } : null);
      if (!me || !lk) return null;
      return { pov: true, down: cam1 === 'pov_down', look: new THREE.Vector3(lk.x, (lk.y || 0) + (cam1 === 'pov_down' ? 3.5 : 1.4), lk.z), shake: cam1 === 'pov_down' ? 0.02 : 0.006 };
    }
    let p, look;
    const bossP = S && S.boss ? posOf(S.boss.id) : null, actor = (k) => { const a = ((S && S.actors) || []).find((q) => q.who === k); return a ? posOf(a.id) : null; };
    const who2 = who || actor(l.who);
    if (cam1 === 'grave') {   // the headstone, low and still
      const g = zoneAt('Grave'); if (!g) return null;
      p = new THREE.Vector3(g.x + 1.6, g.y + 0.9, g.z + 3.4); look = new THREE.Vector3(g.x, g.y + 0.6, g.z - 0.2);
    } else if (cam1 === 'boss' && bossP) {   // looking up at them
      const s2 = bossP.scale || 1, fx = -Math.sin(bossP.yaw || 0), fz = -Math.cos(bossP.yaw || 0);
      p = new THREE.Vector3(bossP.x + fx * 3.2 * s2, bossP.y + 0.9, bossP.z + fz * 3.2 * s2); look = new THREE.Vector3(bossP.x, bossP.y + 1.5 * s2, bossP.z);
    } else if (cam1 === 'pull' && who2) {   // behind and above, pulling away as they walk off
      const k = Math.min(1, shotT / 6), back = 3 + k * 9, up = 1.8 + k * 5, fx = -Math.sin(who2.yaw || 0), fz = -Math.cos(who2.yaw || 0);
      p = new THREE.Vector3(who2.x - fx * back, who2.y + up, who2.z - fz * back); look = new THREE.Vector3(who2.x + fx * 2, who2.y + 1.2, who2.z + fz * 2);
      if (!cam.init || shotT < 0.05) { cam.p.copy(p); cam.l.copy(look); cam.init = true; } else { cam.p.lerp(p, 0.02); cam.l.lerp(look, 0.05); } return { pos: cam.p, look: cam.l };
    } else if (cam1 === 'close' && who2) {
      const s2 = who2.scale || 1, fx = -Math.sin(who2.yaw || 0), fz = -Math.cos(who2.yaw || 0), d = (1.7 - Math.min(0.3, shotT * 0.04)) * s2, side = 0.45 * s2;
      p = new THREE.Vector3(who2.x + fx * d + fz * side, who2.y + 1.6 * s2, who2.z + fz * d - fx * side); look = new THREE.Vector3(who2.x, who2.y + 1.5 * s2, who2.z);
    }
    if (p) { if (!cam.init || shotT < 0.05) { cam.p.copy(p); cam.l.copy(look); cam.init = true; } else { cam.p.lerp(p, 0.04); cam.l.lerp(look, 0.08); } return { pos: cam.p, look: cam.l }; }
    if (title || cam1 === 'wide' || !who || stage(l.text) || /^\(radio\)/.test(l.text)) {   // radio voices: the squad listening, not a face   // establishing or wide: a slow orbit around the squad
      const r = title ? 11 : 6.5, h = title ? 6 : 2.6, a = now * (title ? 0.12 : 0.08) + lineIdx * 0.9;
      p = new THREE.Vector3(cx + Math.sin(a) * r, cy + h, cz + Math.cos(a) * r); look = new THREE.Vector3(cx, cy + 1.2, cz);
    } else if (lineIdx % 4 === 0 && squad.length > 1) {   // over the speaker's shoulder, towards the rest of the squad
      const dx = cx - who.x, dz = cz - who.z, L = Math.hypot(dx, dz) || 1;
      p = new THREE.Vector3(who.x - dx / L * 2.4 + dz / L * 0.9, who.y + 2.0, who.z - dz / L * 2.4 - dx / L * 0.9); look = new THREE.Vector3(cx, cy + 1.3, cz);
    } else {   // close-up: in front of the speaker's face, a little to one side, pushing in slowly
      const s = who.scale || 1, side = (lineIdx % 2 ? 0.55 : -0.55) * s, fx = -Math.sin(who.yaw || 0), fz = -Math.cos(who.yaw || 0), d = (1.9 - Math.min(0.35, shotT * 0.05)) * s;
      p = new THREE.Vector3(who.x + fx * d + fz * side, who.y + 1.62 * s, who.z + fz * d - fx * side); look = new THREE.Vector3(who.x, who.y + 1.55 * s, who.z);
    }
    if (!cam.init || shotT < 0.05) { cam.p.copy(p); cam.l.copy(look); cam.init = true; }   // a hard cut on every new line
    else { cam.p.lerp(p, 0.04); cam.l.lerp(look, 0.08); }
    return { pos: cam.p, look: cam.l };
  }

  const card = (small, h1, p, em, rw) => { const c = $('.sc-card'); $('.sc-card small').textContent = small || ''; $('.sc-card h1').textContent = h1 || ''; $('.sc-card p').textContent = p || ''; $('.sc-card em').textContent = em || ''; $('.sc-card .rw').textContent = rw || ''; c.style.display = 'grid'; c.style.opacity = 1; };
  return {
    onEvent(type, data) {
      if (type === 'cut') { $('.sc-unlock').style.display = 'none'; cutAll = (data.lines || []).slice(); cutQ = cutAll.slice(); cutT0 = performance.now(); lineIdx = 0; $('.sc-title').textContent = data.title || ''; $('.sc-skip').textContent = 'tap / Space / A: skip'; talkQ = []; talkT = 0; $('.sc-talk').style.opacity = 0; showLine(); }
      if (type === 'cutSkip') { flushCut(); endCut(); }
      if (type === 'skipVotes') $('.sc-skip').textContent = `skip: ${data.n} of ${data.need} want to skip`;
      if (type === 'talk') { talkQ.push(...(data.lines || [])); if (talkT <= 0) nextTalk(); }
      if (type === 'story') { S = data; render(); }
      if (type === 'obj' && audio) audio.play('radio');
      if (type === 'bark' && !talkT) { const el = $('.sc-bark'); el.style.setProperty('--c', COLORS[data.who] || '#fff'); el.innerHTML = `<b>${esc(data.name)}:</b> ${esc(data.text)}`; el.style.opacity = 1; barkT = 3.2; }
      if (type === 'focus') { focusT = data.dur || 15; $('.sc-focus').style.display = 'block'; }
      if (type === 'heal') { const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.6, 40), new THREE.MeshBasicMaterial({ color: 0x7ed957, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(data.x, data.y + 0.08, data.z); grp.add(m); rings.push({ m, t: 0, r: data.r || 10 }); if (audio) audio.play('heal', 0.9); }
      if (type === 'unlock') { const C = CHARACTERS[data.char] || {}, A = C.ability || {}, el = $('.sc-unlock'); el.innerHTML = `<b>ABILITY UNLOCKED</b><h2>${esc(A.name || '')}</h2><p>${esc(A.desc || '')}</p><p style="margin-top:8px"><kbd>G</kbd> keyboard · <kbd>SKILL</kbd> phone · <kbd>D-pad ↑</kbd> controller</p>`; el.style.display = 'block'; if (audio) audio.play('unlock', 0.9); setTimeout(() => { el.style.display = 'none'; }, 7000); }
    },
    get cutscene() { return cutQ.length > 0; },
    get melee() { return !!(S && S.melee); },
    get mine() { return S && S.chars ? S.chars.find((c) => c.id === myId) : null; },
    get focus() { return focusT > 0; },
    skip: askSkip,
    shot,
    // between levels: a black card with where you are going while the next level loads behind it
    transition(mi, status, reward) { const m = MISSIONS[mi]; if (!m) return; card(`Chapter ${m.chapterIndex + 1} · ${m.chapterName}`, m.name, m.intro || '', status || 'loading…', reward || ''); },
    status(t) { $('.sc-card em').textContent = t; },
    reward(t) { $('.sc-card .rw').textContent = t || ''; },
    hideCard() { const c = $('.sc-card'); c.style.opacity = 0; setTimeout(() => { if (c.style.opacity === '0') c.style.display = 'none'; }, 650); },
    chapterCard(ci, reward) { const c = CHAPTERS[ci]; if (!c) return; card(`Chapter ${ci + 1} complete`, c.name, c.hub || '', '', reward || ''); },
    finalCard(reward) { card('Operation Ballin\' Out', 'Tapes From My Pops', 'for Dale', 'thanks for playing', reward || ''); },
    // the chapter hub: the same party between chapters. Pick a character, change your loadout, ready up.
    hub(st) {
      const h = $('.sc-hub'); if (!st) { h.style.display = 'none'; h.innerHTML = ''; return; }
      const done = st.chapter >= CHAPTERS.length, c = CHAPTERS[st.chapter] || {}, me = (st.party || []).find((p) => p.id === myId) || {}, taken = new Set((st.party || []).filter((p) => p.id !== myId).map((p) => p.char));
      const all = (st.party || []).every((p) => p.ready);
      h.innerHTML = `<div><small style="color:#f2a33a;letter-spacing:.2em">${done ? 'CAMPAIGN COMPLETE' : 'NEXT: CHAPTER ' + (st.chapter + 1)}</small><h2>${esc(done ? 'Operation Ballin\' Out' : c.name)}</h2>
        <div style="color:#8d97a5;margin-bottom:10px">${esc(done ? 'Replay any chapter from the Story tab.' : c.tease || c.hub || '')}</div>
        ${(st.party || []).map((p) => `<div class="p" style="--c:${COLORS[p.char] || '#fff'}"><b>${esc(p.name)}</b><span>${esc((CHARACTERS[p.char] || {}).short || '')}</span>${p.ready ? '<span class="ok">READY</span>' : '<span>not ready</span>'}</div>`).join('')}
        <div style="margin-top:10px;color:#8d97a5;font-size:12px">Characters nobody picks are played by AI squadmates.</div>
        <div class="chars" style="margin-top:6px">${SQUAD.map((k) => `<button data-ch="${k}" class="${me.char === k ? 'sel' : ''}" ${taken.has(k) ? 'disabled' : ''}>${esc(CHARACTERS[k].short)}</button>`).join('')}</div>
        <div style="margin-top:8px">${done ? '' : `<button data-ready class="${me.ready ? 'on' : ''}">${me.ready ? 'READY ✓' : 'READY UP'}</button>`}<button data-load>LOADOUT</button>
          ${isHost && !done ? `<button class="go" data-start>START CHAPTER ${st.chapter + 1}${all ? '' : ' (not everyone is ready)'}</button>` : ''}<button data-leave>${isHost ? 'END SESSION' : 'LEAVE PARTY'}</button></div>
        ${isHost ? '' : '<div style="margin-top:8px;color:#8d97a5;font-size:12px">The host starts the next chapter.</div>'}</div>`;
      h.style.display = 'grid';
      h.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => st.on.char(b.dataset.ch)));
      const r = h.querySelector('[data-ready]'); if (r) r.onclick = () => st.on.ready(!me.ready);
      h.querySelector('[data-load]').onclick = () => st.on.loadout();
      const s = h.querySelector('[data-start]'); if (s) s.onclick = () => st.on.start();
      h.querySelector('[data-leave]').onclick = () => st.on.leave();
    },
    get hubOpen() { return $('.sc-hub').style.display === 'grid'; },
    // a fresh level: forget the last one's markers, boss and lines
    setWorld(w) { W = w; },
    setCamera(c) { camRef = c; },
    reset() { showShadow(''); for (const e of teles) grp.remove(e.m); teles.length = 0; S = null; cutQ = []; talkQ = []; talkT = 0; showLine(); $('.sc-talk').style.opacity = 0; for (const o of markerObjs.values()) grp.remove(o); markerObjs.clear(); beam.visible = false; balls.forEach((m) => { m.visible = false; }); $('.sc-boss').style.display = 'none'; for (const k of ['.sc-obj span', '.sc-obj b', '.sc-obj i']) $(k).textContent = ''; $('.sc-squad').innerHTML = ''; },
    tick(dt, ga, now) {
      groundAt = ga || groundAt;
      if (cutQ.length) {   // paced by the clock since the scene arrived (not by frames), so every screen shows the same line
        shotT += dt; const el = (performance.now() - cutT0) / 1000; let acc = 0, idx = cutAll.length;
        for (let i = 0; i < cutAll.length; i++) { acc += lineTime(cutAll[i]); if (el < acc) { idx = i; break; } }
        const cur = cutAll.length - cutQ.length;
        if (idx >= cutAll.length) endCut(); else if (idx > cur) { cutQ = cutAll.slice(idx); if (idx > 0) $('.sc-title').textContent = ''; showLine(); }
      }
      if (talkT > 0) { talkT -= dt; if (talkT <= 0) nextTalk(); }
      if (barkT > 0) { barkT -= dt; if (barkT <= 0) $('.sc-bark').style.opacity = 0; }
      if (focusT > 0) { focusT -= dt; if (focusT <= 0) $('.sc-focus').style.display = 'none'; }
      for (const o of markerObjs.values()) { const u = o.userData; u.ring.rotation.z += dt * 0.8; if (u.core) u.core.rotation.y += dt * 1.5; u.pillar.material.opacity = 0.12 + Math.sin(now * 3) * 0.05; }
      const bm = S && S.beam;   // the Goy-Beam: a thin pulsing warning line while it charges, then a thick blinding beam
      if (bm) {
        const len = bm.len, w = bm.warn ? 0.06 + (1 - Math.min(1, bm.t / 2)) * 0.12 : bm.w * 2, y = groundAt(bm.x, bm.z) + 2.6;
        beam.visible = true; beam.scale.set(w, w, len); beam.position.set(bm.x + bm.dx * len / 2, y, bm.z + bm.dz * len / 2); beam.rotation.set(0, Math.atan2(bm.dx, bm.dz), 0);
        beamMat.opacity = bm.warn ? 0.35 + Math.sin(now * 30) * 0.25 : 0.95; beamMat.color.set(bm.warn ? 0xff2020 : 0xfff0f0);
      } else beam.visible = false;
      const tl = (S && S.tele) || [];   // boss telegraphs: red where it's about to hit, brighter as it gets close
      while (teles.length > tl.length) grp.remove(teles.pop().m);
      tl.forEach((t, i) => {
        const key = t.k + t.r + t.a + t.w; let e = teles[i];
        if (!e || e.key !== key) { if (e) grp.remove(e.m); e = teles[i] = { m: teleMesh(t), key }; grp.add(e.m); }
        const y = groundAt(t.x, t.z) + 0.06; e.m.position.set(t.x, y, t.z);
        if (t.k === 'arc') e.m.rotation.set(-Math.PI / 2, 0, Math.atan2(t.dx, t.dz) - Math.PI / 2 + Math.PI);
        if (t.k === 'line') { e.m.rotation.set(-Math.PI / 2, 0, -Math.atan2(t.dx, t.dz)); e.m.position.set(t.x + t.dx * t.r / 2, y, t.z + t.dz * t.r / 2); }
        e.m.material.opacity = t.warn ? 0.22 + 0.25 * Math.abs(Math.sin(now * (t.t < 0.4 ? 26 : 9))) : 0.5;
      });
      for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const k = r.t / 0.9; r.m.scale.setScalar(1 + k * r.r * 1.6); r.m.material.opacity = 0.8 * (1 - k); if (k >= 1) { grp.remove(r.m); rings.splice(i, 1); } }
      if (snow.visible && camRef) { const a = snowGeo.attributes.position.array; for (let i = 0; i < SN; i++) { a[i * 3 + 1] -= dt * (2.2 + (i % 5) * 0.3); a[i * 3] += dt * 3.2; if (a[i * 3 + 1] < 0) { a[i * 3 + 1] = 14; a[i * 3] = (Math.random() - 0.5) * 40; a[i * 3 + 2] = (Math.random() - 0.5) * 40; } if (a[i * 3] > 20) a[i * 3] -= 40; } snowGeo.attributes.position.needsUpdate = true; snow.position.set(camRef.position.x, camRef.position.y - 6, camRef.position.z); }
      if (shadowMesh.visible) { shadowT += dt; shadowMesh.rotation.z = shadowPose === 'beat' ? Math.sin(shadowT * 7) * 0.12 : Math.sin(shadowT * 1.3) * 0.05; shadowMesh.scale.setScalar(1 + Math.sin(shadowT * (shadowPose === 'beat' ? 7 : 1.3)) * 0.04); }
      const bl = (S && S.balls) || [];
      while (balls.length < bl.length) { const m = new THREE.Mesh(ballGeo, ballMat); grp.add(m); balls.push(m); }
      balls.forEach((m, i) => { m.visible = i < bl.length; if (m.visible) m.position.set(bl[i][0], bl[i][1], bl[i][2]); });
    },
    dispose() { vision(''); if (music) music.stop(); document.body.classList.remove('sc-cutting'); removeEventListener('keydown', onKey); scene.remove(grp); ui.remove(); css.remove(); },
  };
}
