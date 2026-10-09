// Story mode on every screen (host and clients): cutscenes shot in-engine (a director camera cuts between the people
// talking), lines over gameplay, the objective tracker, the squad panel with ability cooldowns, the boss bar, the world
// markers (objective beacons, terminals with their puzzle numbers, the bomb, people to talk to), the Goy-Beam warning and
// beam, the boss's rocket balls, the black card between levels while the next one loads, and the chapter hub where the
// same party picks loadouts and readies up. It only draws what the host says; game.js forwards the events and calls
// tick() every frame, and shot() while a cutscene plays.
import * as THREE from '../sdk/three.module.min.js';
import { CHARACTERS, MISSIONS, CHAPTERS, SQUAD } from './story.js';

const COLORS = { wiener: '#e8613a', cancer: '#9ad0ff', ricky: '#c07aff', igor: '#8fd06a', recruit: '#d8d8a0', boss: '#ff3b3b', command: '#ffb04a', tape: '#9ad0ff', squad: '#ffffff' };
const VOICE = { boss: [0.6, 1.0], ricky: [1.2, 1.05], igor: [0.75, 0.95], cancer: [0.9, 0.95], tape: [0.88, 0.92], wiener: [0.8, 1.05], command: [1.0, 1.15], recruit: [1.25, 1.1] };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lineTime = (l) => 1.6 + String(l.text).length * 0.045;   // the same pace the host uses (story_sim.js scene())
const stage = (t) => /^\(.*\)$|^\*.*\*$/.test(String(t).trim());   // "(laughing)", "*coughs*": a stage direction, not spoken

export function storyClient({ scene, myId, audio, onSkip, isHost }) {
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
  body.sc-cutting .kc-t,body.sc-cutting .cs-hud,body.sc-cutting .sc-squad,body.sc-cutting .sc-obj,body.sc-cutting .sc-boss{visibility:hidden}
  @media (max-height:520px){.sc-obj{top:44px;padding:4px 10px 4px 20px}.sc-obj span{font-size:13px}.sc-squad{bottom:auto;top:96px;left:auto;right:calc(env(safe-area-inset-right,0px) + 12px);gap:2px}.sc-m{min-width:118px;font-size:10px;padding:1px 6px}.sc-m .bar{width:40px}
    .sc-line p{font-size:16px}.sc-title{font-size:18px;top:13vh}.sc-line{bottom:13vh}.sc-talk{bottom:96px;font-size:13px}.sc-card h1{font-size:26px}.sc-card p{font-size:15px}}`;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.className = 'sc-ui';
  ui.innerHTML = `<div class="sc-focus"></div><div class="sc-obj"><b></b><span></span><i></i></div><div class="sc-squad"></div><div class="sc-boss"><b></b><div><i></i></div></div>
    <div class="sc-talk"></div><div class="sc-bark"></div><div class="sc-cut"><div class="sc-title"></div><div class="sc-line"><b></b><p></p></div><div class="sc-skip">tap / Space / A: skip</div></div>
    <div class="sc-card"><div><small></small><h1></h1><p></p><em></em><div class="rw"></div></div></div><div class="sc-hub"></div>`;
  document.body.appendChild(ui);
  const $ = (s) => ui.querySelector(s);

  // ---- 3D: markers, beam, balls ----
  const grp = new THREE.Group(); scene.add(grp);
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

  // ---- state ----
  let S = null, cutQ = [], cutT = 0, cutAll = [], cutT0 = 0, talkQ = [], talkT = 0, barkT = 0, focusT = 0, groundAt = () => 0, lineIdx = 0, shotT = 0;
  const say = (l) => { if (!stage(l.text) && l.who !== 'credits' && audio && audio.say) { const v = VOICE[l.who] || [1, 1]; audio.say(String(l.text).replace(/\([^)]*\)|\*[^*]*\*/g, ''), v[0], v[1]); } };
  function showLine() {
    const l = cutQ[0]; document.body.classList.toggle('sc-cutting', !!l);
    if (!l) { $('.sc-cut').style.display = 'none'; return; }
    $('.sc-cut').style.display = 'block'; $('.sc-line').style.setProperty('--c', COLORS[l.who] || '#fff');
    $('.sc-line b').textContent = stage(l.text) || l.who === 'credits' ? '' : l.name; const p = $('.sc-line p'); p.textContent = l.text; p.className = l.who === 'credits' ? 'credits' : stage(l.text) ? 'dir' : '';
    cutT = lineTime(l); lineIdx++; shotT = 0; say(l);
    if (lineIdx > 1) $('.sc-title').textContent = '';   // the title sits on the opening shot only
  }
  const endCut = () => { cutQ = []; $('.sc-title').textContent = ''; showLine(); };
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
    $('.sc-squad').innerHTML = (S.chars || []).map((c) => { const C = CHARACTERS[c.char] || CHARACTERS.ricky, ab = C.ability; return `<div class="sc-m${c.alive ? '' : ' dead'}" style="--c:${COLORS[c.char] || '#fff'}"><em>${esc(C.short)}${c.id === myId ? ' (you)' : ''}</em><span class="bar"><i style="width:${Math.max(0, Math.min(100, c.hp / (c.max || 100) * 100))}%"></i></span><small>${ab ? (ab.id === 'cancer_nade' ? (c.nade ? 'G' : '–') : c.cd ? c.cd + 's' : 'G') : ''}</small></div>`; }).join('');
    const b = S.boss; $('.sc-boss').style.display = b ? 'block' : 'none';
    if (b) { $('.sc-boss b').textContent = 'Osama bin Ballin'; $('.sc-boss i').style.width = Math.max(0, b.hp / b.max * 100) + '%'; }
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
    let p, look;
    if (title || !who || stage(l.text) || /^\(radio\)/.test(l.text)) {   // radio voices: the squad listening, not a face   // establishing or wide: a slow orbit around the squad
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
      if (type === 'cut') { cutAll = (data.lines || []).slice(); cutQ = cutAll.slice(); cutT0 = performance.now(); lineIdx = 0; $('.sc-title').textContent = data.title || ''; $('.sc-skip').textContent = 'tap / Space / A: skip'; talkQ = []; talkT = 0; $('.sc-talk').style.opacity = 0; showLine(); }
      if (type === 'cutSkip') endCut();
      if (type === 'skipVotes') $('.sc-skip').textContent = `skip: ${data.n} of ${data.need} want to skip`;
      if (type === 'talk') { talkQ.push(...(data.lines || [])); if (talkT <= 0) nextTalk(); }
      if (type === 'story') { S = data; render(); }
      if (type === 'obj' && audio) audio.play('radio');
      if (type === 'bark' && !talkT) { const el = $('.sc-bark'); el.style.setProperty('--c', COLORS[data.who] || '#fff'); el.innerHTML = `<b>${esc(data.name)}:</b> ${esc(data.text)}`; el.style.opacity = 1; barkT = 3.2; }
      if (type === 'focus') { focusT = data.dur || 15; $('.sc-focus').style.display = 'block'; }
    },
    get cutscene() { return cutQ.length > 0; },
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
        <div style="color:#8d97a5;margin-bottom:10px">${esc(done ? 'Replay any chapter from the Story tab.' : c.hub || '')}</div>
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
    reset() { S = null; cutQ = []; talkQ = []; talkT = 0; showLine(); $('.sc-talk').style.opacity = 0; for (const o of markerObjs.values()) grp.remove(o); markerObjs.clear(); beam.visible = false; balls.forEach((m) => { m.visible = false; }); $('.sc-boss').style.display = 'none'; for (const k of ['.sc-obj span', '.sc-obj b', '.sc-obj i']) $(k).textContent = ''; $('.sc-squad').innerHTML = ''; },
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
      const bl = (S && S.balls) || [];
      while (balls.length < bl.length) { const m = new THREE.Mesh(ballGeo, ballMat); grp.add(m); balls.push(m); }
      balls.forEach((m, i) => { m.visible = i < bl.length; if (m.visible) m.position.set(bl[i][0], bl[i][1], bl[i][2]); });
    },
    dispose() { document.body.classList.remove('sc-cutting'); removeEventListener('keydown', onKey); scene.remove(grp); ui.remove(); css.remove(); },
  };
}
