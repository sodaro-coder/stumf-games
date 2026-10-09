// Story mode on every screen (host and clients): the cutscene dialogue, the objective tracker, the squad panel with
// ability cooldowns, the boss bar, the world markers (objective beacons, terminals with their puzzle numbers, the
// bomb), the Goy-Beam's red warning line and beam, the boss's rocket balls, and the mission-complete screen.
// It only draws what the host's story state says; game.js forwards the events and calls tick() every frame.
import * as THREE from '../sdk/three.module.min.js';
import { CHARACTERS, MISSIONS } from './story.js';

const COLORS = { wiener: '#e8613a', cancer: '#9ad0ff', ricky: '#c07aff', igor: '#8fd06a', boss: '#ff3b3b' };
const KEY_HINT = { mess_kit: 'Mess Kit', cancer_nade: 'Cancer Nade', russian_focus: 'Russian Focus' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function storyClient({ scene, myId, audio, onNext, onQuit, onCutEnd, isHost }) {
  const css = document.createElement('style');
  css.textContent = `.sc-ui{position:fixed;inset:0;pointer-events:none;z-index:40;font-family:system-ui,sans-serif;color:#fff}
  .sc-obj{position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);top:62px;max-width:min(330px,40vw);background:linear-gradient(90deg,#0000,#000a 30%);padding:8px 12px 8px 26px;text-align:right;border-right:3px solid #f2a33a}
  .sc-obj b{display:block;font-size:11px;letter-spacing:.14em;color:#f2a33a;text-transform:uppercase}.sc-obj span{font-size:15px;font-weight:700;text-shadow:0 1px 3px #000}.sc-obj i{display:block;font-style:normal;font-size:12px;color:#cfd6df;margin-top:2px}
  .sc-squad{position:absolute;left:calc(env(safe-area-inset-left,0px) + 12px);bottom:84px;display:flex;flex-direction:column;gap:4px}
  .sc-m{display:flex;align-items:center;gap:6px;background:#000a;border-left:3px solid var(--c);padding:3px 8px 3px 6px;font-size:12px;min-width:150px}.sc-m.dead{opacity:.45}
  .sc-m em{font-style:normal;font-weight:800;flex:1}.sc-m .bar{width:56px;height:5px;background:#333;border-radius:3px;overflow:hidden}.sc-m .bar i{display:block;height:100%;background:var(--c)}
  .sc-m small{color:#f2a33a;font-weight:800;min-width:30px;text-align:right}
  .sc-boss{position:absolute;left:50%;top:58px;transform:translateX(-50%);width:min(560px,70vw);text-align:center;display:none}.sc-boss b{font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#ffd0d0;text-shadow:0 0 8px #f00}
  .sc-boss div{height:12px;background:#300;border:1px solid #f55;border-radius:6px;overflow:hidden;margin-top:4px}.sc-boss div i{display:block;height:100%;background:linear-gradient(90deg,#ff2e2e,#ff9a3c);transition:width .2s}
  .sc-cut{position:absolute;inset:0;display:none;pointer-events:auto}.sc-cut:before,.sc-cut:after{content:'';position:absolute;left:0;right:0;height:11vh;background:#000}.sc-cut:before{top:0}.sc-cut:after{bottom:0}
  .sc-line{position:absolute;left:50%;bottom:14vh;transform:translateX(-50%);width:min(760px,88vw);background:#0b0d12e8;border:1px solid #ffffff22;border-radius:12px;padding:14px 18px;box-shadow:0 10px 40px #000a}
  .sc-line b{display:block;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--c);margin-bottom:4px}.sc-line p{margin:0;font-size:18px;line-height:1.35}.sc-line small{position:absolute;right:14px;bottom:8px;color:#8d97a5;font-size:11px}
  .sc-title{position:absolute;left:0;right:0;top:15vh;text-align:center;font:900 30px system-ui;letter-spacing:.08em;text-shadow:0 2px 12px #000}
  .sc-bark{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);background:#000b;border-radius:8px;padding:6px 12px;font-size:14px;opacity:0;transition:opacity .25s}.sc-bark b{color:var(--c)}
  .sc-end{position:absolute;inset:0;background:#05070bdd;display:none;place-items:center;pointer-events:auto}.sc-end>div{text-align:center}.sc-end h1{font:900 46px system-ui;margin:0;color:#f2a33a;letter-spacing:.06em}
  .sc-end button{margin:16px 6px 0;padding:12px 22px;border-radius:8px;border:0;font:800 14px system-ui;letter-spacing:.1em;cursor:pointer;background:#f2a33a;color:#111}.sc-end button.alt{background:#2a3140;color:#fff}
  .sc-focus{position:absolute;inset:0;box-shadow:inset 0 0 120px #8fd06a55;display:none}
  body.sc-cutting .kc-t{visibility:hidden}.sc-cut,.sc-end{z-index:50}
  @media (max-height:520px){.sc-obj{top:44px;padding:4px 10px 4px 20px}.sc-obj span{font-size:13px}.sc-squad{bottom:auto;top:96px;left:auto;right:calc(env(safe-area-inset-right,0px) + 12px);gap:2px}.sc-m{min-width:118px;font-size:10px;padding:1px 6px}.sc-m .bar{width:40px}.sc-line p{font-size:15px}.sc-title{font-size:18px;top:13vh}.sc-line{bottom:13vh;padding:10px 14px}}`;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.className = 'sc-ui'; ui.style.zIndex = 46;   // over the phone controls (45)
  ui.innerHTML = `<div class="sc-focus"></div><div class="sc-obj"><b></b><span></span><i></i></div><div class="sc-squad"></div><div class="sc-boss"><b></b><div><i></i></div></div>
    <div class="sc-bark"></div><div class="sc-cut"><div class="sc-title"></div><div class="sc-line"><b></b><p></p><small>tap / Space / A to skip</small></div></div>
    <div class="sc-end"><div><h1>MISSION COMPLETE</h1><div class="sc-endsub"></div><div><button data-next>NEXT MISSION</button><button class="alt" data-quit>MENU</button></div></div></div>`;
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
  const MARK_COL = { goal: 0x3cff8a, area: 0xff4a4a, hold: 0x3c9aff, item: 0xffd23a, terminal: 0x40e0ff, bomb: 0xff3030, target: 0xff2a6a };
  function marker(m) {
    const g = new THREE.Group(), col = MARK_COL[m.kind] || 0xffffff;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    pillar.position.y = 20; g.add(pillar);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(m.kind === 'hold' || m.kind === 'area' ? 6 : 0.9, 0.05, 6, 48), new THREE.MeshBasicMaterial({ color: col })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    let core = null;
    if (m.kind === 'item') { core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: col })); core.position.y = 1; g.add(core); }
    if (m.kind === 'terminal' || m.kind === 'bomb') { core = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.4), new THREE.MeshStandardMaterial({ color: m.kind === 'bomb' ? 0x3a2a1a : 0x2a3440, emissive: col, emissiveIntensity: 0.25, metalness: 0.4, roughness: 0.5 })); core.position.y = 0.55; g.add(core); }
    const tag = label(m.kind === 'terminal' && /^\d+$/.test(m.label) ? '# ' + m.label : m.label || '', '#' + col.toString(16).padStart(6, '0')); tag.position.y = 2.4; g.add(tag);
    g.userData = { pillar, ring, core, tag }; return g;
  }
  let S = null, cutQ = [], cutT = 0, barkT = 0, focusT = 0, ended = false, groundAt = () => 0;
  function showLine() {
    const l = cutQ[0]; document.body.classList.toggle('sc-cutting', !!l); if (!l) { $('.sc-cut').style.display = 'none'; return; }
    $('.sc-cut').style.display = 'block'; $('.sc-line').style.setProperty('--c', COLORS[l.who] || '#fff');
    $('.sc-line b').textContent = l.name; $('.sc-line p').textContent = l.text; cutT = 1.6 + l.text.length * 0.045;
    if (audio && audio.say) audio.say(l.text, l.who === 'boss' ? 0.6 : l.who === 'ricky' ? 1.25 : l.who === 'igor' ? 0.75 : l.who === 'cancer' ? 0.9 : 0.85, 1.05);
  }
  const skip = () => { if (!cutQ.length) return; cutQ.shift(); if (!cutQ.length) { $('.sc-title').textContent = ''; if (onCutEnd) onCutEnd(); } showLine(); };   // the host skipping to the end starts the mission for everyone
  $('.sc-cut').addEventListener('pointerdown', skip);
  addEventListener('keydown', (e) => { if (cutQ.length && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) skip(); });
  $('[data-next]').onclick = () => onNext && onNext(); $('[data-quit]').onclick = () => onQuit && onQuit();
  function render() {
    if (!S) return;
    $('.sc-obj b').textContent = `Objective ${Math.min(S.obj + 1, S.n)} / ${S.n}`; $('.sc-obj span').textContent = S.hint || '';
    $('.sc-obj i').textContent = S.need ? (S.kind === 'defend' || S.kind === 'survive' ? `${Math.max(0, S.need - S.have)}s left` : S.kind === 'defuse' ? `${Math.round(((S.markers[0] || {}).prog || 0) * 100)}% · hold USE` : `${S.have} / ${S.need}`) + (S.next ? ` · next: #${S.next}` : '') : '';
    $('.sc-squad').innerHTML = (S.chars || []).map((c) => { const C = CHARACTERS[c.char], ab = C.ability; return `<div class="sc-m${c.alive ? '' : ' dead'}" style="--c:${COLORS[c.char]}"><em>${esc(C.short)}${c.id === myId ? ' (you)' : c.bot ? '' : ''}</em><span class="bar"><i style="width:${Math.max(0, Math.min(100, c.hp / (c.max || 100) * 100))}%"></i></span><small>${ab ? (ab.id === 'cancer_nade' ? (c.nade ? 'G' : '–') : c.cd ? c.cd + 's' : 'G') : ''}</small></div>`; }).join('');
    const b = S.boss; $('.sc-boss').style.display = b ? 'block' : 'none';
    if (b) { $('.sc-boss b').textContent = 'Osama bin Ballin'; $('.sc-boss i').style.width = Math.max(0, b.hp / b.max * 100) + '%'; }
    const keep = new Set();
    for (const m of S.markers || []) {
      keep.add(m.id); let o = markerObjs.get(m.id); if (!o) { o = marker(m); grp.add(o); markerObjs.set(m.id, o); }
      o.position.set(m.x, groundAt(m.x, m.z), m.z); o.visible = !m.done;
    }
    for (const [id, o] of markerObjs) if (!keep.has(id)) { grp.remove(o); markerObjs.delete(id); }
  }
  return {
    onEvent(type, data) {
      if (type === 'cut') { cutQ = (data.lines || []).slice(); $('.sc-title').textContent = data.title || ''; showLine(); }
      if (type === 'story') { S = data; render(); }
      if (type === 'obj' && audio) audio.play('radio');
      if (type === 'bark') { const el = $('.sc-bark'); el.style.setProperty('--c', COLORS[data.who] || '#fff'); el.innerHTML = `<b>${esc(data.name)}:</b> ${esc(data.text)}`; el.style.opacity = 1; barkT = 3.2; }
      if (type === 'focus') { focusT = data.dur || 15; $('.sc-focus').style.display = 'block'; }
      if (type === 'storyEnd') {
        ended = true; const next = MISSIONS[data.mission + 1];
        $('.sc-end').style.display = 'grid'; $('.sc-endsub').textContent = `${MISSIONS[data.mission].name} · ${data.kills} Brotherhood members benched` + (next ? '' : ' · THE END');
        $('[data-next]').style.display = isHost && next ? '' : 'none'; if (!isHost) $('[data-next]').parentElement.insertAdjacentHTML('beforeend', '<div style="margin-top:10px;color:#8d97a5">waiting for the host…</div>');
      }
    },
    get cutscene() { return cutQ.length > 0; },
    skip,
    get focus() { return focusT > 0; },
    tick(dt, ga, now) {
      groundAt = ga || groundAt;
      if (cutQ.length) { cutT -= dt; if (cutT <= 0) skip(); }
      if (barkT > 0) { barkT -= dt; if (barkT <= 0) $('.sc-bark').style.opacity = 0; }
      if (focusT > 0) { focusT -= dt; if (focusT <= 0) $('.sc-focus').style.display = 'none'; }
      for (const o of markerObjs.values()) { const u = o.userData; u.ring.rotation.z += dt * 0.8; if (u.core) u.core.rotation.y += dt * 1.5; u.pillar.material.opacity = 0.12 + Math.sin(now * 3) * 0.05; }
      // the Goy-Beam: a thin pulsing warning line while it charges, then a thick blinding beam
      const bm = S && S.beam;
      if (bm) {
        const len = bm.len, w = bm.warn ? 0.06 + (1 - Math.min(1, bm.t / 2)) * 0.12 : bm.w * 2, y = groundAt(bm.x, bm.z) + 2.6;
        beam.visible = true; beam.scale.set(w, w, len); beam.position.set(bm.x + bm.dx * len / 2, y, bm.z + bm.dz * len / 2); beam.rotation.set(0, Math.atan2(bm.dx, bm.dz), 0);
        beamMat.opacity = bm.warn ? 0.35 + Math.sin(now * 30) * 0.25 : 0.95; beamMat.color.set(bm.warn ? 0xff2020 : 0xfff0f0);
      } else beam.visible = false;
      const bl = (S && S.balls) || [];
      while (balls.length < bl.length) { const m = new THREE.Mesh(ballGeo, ballMat); grp.add(m); balls.push(m); }
      balls.forEach((m, i) => { m.visible = i < bl.length; if (m.visible) m.position.set(bl[i][0], bl[i][1], bl[i][2]); });
    },
    dispose() { document.body.classList.remove('sc-cutting'); scene.remove(grp); ui.remove(); css.remove(); },
  };
}
