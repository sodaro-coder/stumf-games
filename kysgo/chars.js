// Realistic animated soldiers: a Mixamo character with Mixamo motion-captured animations (idle, walk/run in every
// direction, crouch, jump, fire, reload, throw, hit, death, dance), packed by STUMF into chars.json + chars.bin and
// rebuilt here without any loader library. Each player gets its own bones and animation mixer; the mesh, textures and
// clips are shared. The upper body bends with the player's aim, the gun sits in the right hand, and agents' joke
// headgear rides on the head bone.
import * as THREE from '../sdk/three.module.min.js';
import { litPatch } from './world.js';
import { glowMask, glowify, gunSurface } from './models.js';

let D = null, P = null;
export function loadChars() {
  if (!P) P = Promise.all([fetch('chars.json').then((r) => (r.ok ? r.json() : null)), fetch('chars.bin').then((r) => (r.ok ? r.arrayBuffer() : null))])
    .then(([j, b]) => { D = j && b ? build(j, b) : null; return D; }).catch(() => null);
  return P;
}
export const charsReady = () => !!D;

const UPPER = /Spine|Neck|Head|Shoulder|Arm|Hand/;
const LEANF = -0.14;   // negative about the rig's right (+x) tips the chest forward   // radians of forward lean for an armed stance (spread over the three spine bones)   // bones an upper-body overlay (fire, reload, throw, hit) may move
function build(j, bin) {
  const c = j.characters[0];
  const meshes = c.meshes.map((m) => {
    const g = new THREE.BufferGeometry(), n = m.count;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, m.position, n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(bin, m.normal, n * 3), 3, true));
    if (m.uv >= 0) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(bin, m.uv, n * 2), 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(bin, m.skinIndex, n * 4), 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(bin, m.skinWeight, n * 4), 4, true));
    g.setIndex(new THREE.BufferAttribute(m.index32 ? new Uint32Array(bin, m.index, m.indexCount) : new Uint16Array(bin, m.index, m.indexCount), 1));
    const inv = new Float32Array(bin, m.inverses, m.joints.length * 16), inverses = m.joints.map((_, k) => new THREE.Matrix4().fromArray(inv, k * 16));
    return { g, inverses, joints: m.joints, bind: new THREE.Matrix4().fromArray(m.bindMatrix), name: m.name };
  });
  const clips = {};
  for (const cl of c.clips) {
    const times = new Float32Array(cl.n); for (let k = 0; k < cl.n; k++) times[k] = k / cl.fps;
    const tracks = [];
    for (const t of cl.tracks) {
      const bone = c.bones[t.b].n;
      if (t.k === 'q') { const q = new Int16Array(bin, t.o, cl.n * 4), v = new Float32Array(cl.n * 4); for (let i = 0; i < v.length; i++) v[i] = q[i] / 32767; tracks.push(new THREE.QuaternionKeyframeTrack(bone + '.quaternion', times, v)); }
      else tracks.push(new THREE.VectorKeyframeTrack(bone + '.position', times, new Float32Array(bin, t.o, cl.n * 3)));
    }
    clips[cl.name] = new THREE.AnimationClip(cl.name, cl.dur, tracks);
    clips[cl.name].loop = cl.loop;
  }
  for (const k of ['fire', 'reload', 'throw', 'hit']) {   // upper-body versions: the legs keep walking underneath
    const src = clips[k]; if (!src) continue;
    clips[k + 'Up'] = new THREE.AnimationClip(k + 'Up', src.duration, src.tracks.filter((t) => UPPER.test(t.name.split('.')[0])));
  }
  return { c, meshes, clips, tex: new Map(), mats: new Map() };
}

function texture(name) {
  if (D.tex.has(name)) return D.tex.get(name);
  const t = new THREE.TextureLoader().load(name); t.colorSpace = name.includes('_n_') ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.flipY = false;
  D.tex.set(name, t); return t;
}
// one material per (team, tint, quality, glow); tint = an agent's colour washed over the uniform; glow = a Mythic
// outfit's energy veins, which crawl over the uniform and pulse
function material(team, tint, hq, glow, costume = null) {
  const key = `${team}|${tint || ''}|${hq}|${glow ? glow.glow + glow.t : ''}|${costume ? costume.key : ''}`;
  if (D.mats.has(key)) return D.mats.get(key);
  const res = hq ? 1024 : 512;
  const m = new THREE.MeshLambertMaterial({ map: texture(`soldier_${team === 'CT' ? 'ct' : 't'}_${res}.jpg`), normalMap: hq ? texture(`soldier_n_${res}.jpg`) : null });
  if (tint && !costume) m.color.set(tint).lerp(new THREE.Color(1, 1, 1), glow ? 0.15 : 0.35);
  if (glow) glowify(m, glowMask({ t: glow.t, glow: glow.glow }, 3), 0.9);
  litPatch(m, 'dyn');
  if (costume) dye(m, costume);
  D.mats.set(key, m); return m;
}

// ---- costumes: the soldier re-dyed per body region -----------------------------------------------------------------
// The uniform photo keeps every seam, scratch and fold; only its colours change. Regions come from the model's rest
// pose (centimetres, z up, front +y): head, torso, arms, hips, legs. Armour plates and the undersuit stay told apart
// (plates take the colour, the suit a darker cut of it), bare-skin costumes smooth the armour detail out to skin, and
// a few outfits add a pattern: the mime's stripes, the hotdog's mustard squiggle, the cone's reflective bands.
const SKINNY = (L) => L.body === L.head || !!L.speedo || !!L.bikini;
export function costumeOf(L) {
  if (!L || L.plain || L.model === 'log') return null;
  const skin = SKINNY(L), c = (v, d) => new THREE.Color(v || d);
  const cs = {
    head: c(L.head, '#c89a74'), torso: c(L.body), arms: c(L.arms || L.body), hips: c(L.speedo || L.bikini || L.hips || L.legs), legs: c(L.legs),
    skin: skin ? 1 : 0, speedo: L.speedo || L.bikini ? 1 : 0, bikini: L.bikini ? 1 : 0, stripes: L.stripes ? 1 : 0, mustard: L.mustard ? 1 : 0, bands: L.hat === 'cone' ? 1 : 0, belly: L.belly ? 1 : 0,
  };
  cs.key = [L.head, L.body, L.legs, L.speedo, L.stripes, L.mustard, L.hat, L.belly, L.bikini].join(',');
  return cs;
}
function dye(m, cs) {
  m.color.set(1, 1, 1);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    Object.assign(sh.uniforms, { cHead: { value: cs.head }, cTorso: { value: cs.torso }, cArms: { value: cs.arms }, cHips: { value: cs.hips }, cLegs: { value: cs.legs },
      cFlags: { value: new THREE.Vector4(cs.skin, cs.stripes, cs.mustard, cs.bands) }, cFlags2: { value: new THREE.Vector4(cs.speedo, cs.belly, cs.bikini || 0, 0) } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;\nuniform vec3 cHead; uniform vec3 cTorso; uniform vec3 cArms; uniform vec3 cHips; uniform vec3 cLegs; uniform vec4 cFlags; uniform vec4 cFlags2;')
      .replace('#include <map_fragment>', `#include <map_fragment>
	{
		vec3 tx = diffuseColor.rgb; float lum = dot(tx, vec3(0.299, 0.587, 0.114));
		float plate = smoothstep(0.07, 0.2, lum), z = vRest.z, ax = abs(vRest.x);
		vec3 c = cTorso; float skinR = cFlags.x;
		if (z > 152.0) { c = cHead; skinR = 1.0; }
		else if (ax > 20.0 && z > 96.0) c = cArms;
		else if (z < 90.0) c = cLegs;
		else if (z < 106.0) { c = cHips; if (cFlags2.x > 0.5) skinR = 0.0; }
		if (cFlags.y > 0.5 && z > 96.0 && z < 152.0 && ax < 20.0 && fract(z / 11.0) < 0.5) c = vec3(0.05);   // mime stripes
		if (cFlags.w > 0.5 && ((z > 112.0 && z < 120.0) || (z > 128.0 && z < 136.0))) c = vec3(0.92, 0.94, 0.9);   // reflective cone bands
		if (cFlags.z > 0.5 && vRest.y > 4.0 && z > 92.0 && z < 150.0 && abs(vRest.x - sin(z * 0.55) * 7.0) < 2.2) c = vec3(0.95, 0.72, 0.05);   // mustard
		if (cFlags2.z > 0.5 && z > 124.0 && z < 135.0 && ax < 17.0) { c = cHips; skinR = 0.0; }   // a bikini top
		c = max(c, vec3(0.05));   // near-black outfits still show their folds and plates
		// plates take the colour with the photo's light and scratches; the undersuit a darker, matte cut of it
		float detail = plate > 0.5 ? clamp(lum / 0.36, 0.35, 1.35) : clamp(0.55 + lum * 9.0, 0.5, 1.2);
		vec3 dyed = c * mix(0.42 * detail, detail, plate);
		vec3 bare = c * mix(0.88, 1.06, smoothstep(0.0, 0.4, lum));   // skin: the armour detail smoothed away
		diffuseColor.rgb = mix(dyed, bare, skinR);
	}`);
  };
  const k0 = m.customProgramCacheKey;
  m.customProgramCacheKey = () => k0() + '|costume';
  return m;
}

// clip speeds (metres per second at timeScale 1) for matching the feet to the ground speed
const SPEED = { walk: 1.0, walkBack: 1.1, walkLeft: 1.4, walkRight: 0.75, run: 3.1, runBack: 2.7, runLeft: 2.8, runRight: 3.2, crouchWalk: 0.6 };
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3(), _fw = new THREE.Vector3(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
export function makeSoldier(look, team, hq = true) {
  // the default T / CT agents are the plain soldier in their team's uniform; every costume shows: its colours, its headgear
  const L = look || {}, plainAgent = !!L.plain;
  const tint = plainAgent && !L.glow ? null : L.body;
  const g = new THREE.Group(), holder = new THREE.Group(); holder.rotation.y = 0; g.add(holder);   // the converted rig already faces -z, like the game's players (measured: the support hand is in front at -z)
  const c = D.c, root = new THREE.Group();
  root.position.fromArray(c.root.t); root.quaternion.fromArray(c.root.q); root.scale.fromArray(c.root.s); holder.add(root);
  const bones = c.bones.map((b) => { const o = new THREE.Bone(); o.name = b.n; o.position.fromArray(b.t); o.quaternion.fromArray(b.q); o.scale.fromArray(b.s); return o; });
  c.bones.forEach((b, i) => { if (b.p >= 0) bones[b.p].add(bones[i]); else root.add(bones[i]); });
  const mat = material(team, tint, hq, L.glow ? { glow: L.glow, t: L.glowT || 'circuit' } : null, costumeOf(L));
  if (L.model !== 'log') for (const m of D.meshes) {
    const sm = new THREE.SkinnedMesh(m.g, mat); sm.frustumCulled = false; root.add(sm);
    sm.bind(new THREE.Skeleton(m.joints.map((i) => bones[i]), m.inverses), m.bind);
  }
  const byName = Object.fromEntries(bones.map((b) => [b.name.replace('mixamorig', ''), b]));
  if (L.model === 'log') { g.updateMatrixWorld(true); logBody(byName, hq); }
  const mixer = new THREE.AnimationMixer(root), act = {};
  for (const [k, clip] of Object.entries(D.clips)) { const a = mixer.clipAction(clip); a.setLoop(clip.loop ? THREE.LoopRepeat : THREE.LoopOnce); if (!clip.loop) a.clampWhenFinished = true; act[k] = a; }
  act.idle.play();
  const tpGun = new THREE.Group(); g.add(tpGun);
  const head = new THREE.Group(); g.add(head);
  hat(head, L);
  // the gear you bought, worn on top of the uniform: a plate carrier with its pouches, a ballistic helmet
  const chest = new THREE.Group(); chest.visible = false; g.add(chest);
  const vest = gearMesh(vestParts(team)); chest.add(vest);
  const bomb = L.bombvest ? gearMesh(bombVestParts()) : null; if (bomb) { chest.add(bomb); chest.visible = true; }
  const helm = gearMesh(helmetParts(team)); helm.visible = false; head.add(helm);
  const r = { soldier: true, g, holder, root, bones: byName, mixer, act, base: 'idle', tpGun, head, chest, helm, vest, bomb, tpKey: '', over: null, t: 0, dieDone: false };
  // where the head and hand sit relative to their bones at rest: lets props follow the animated bones
  g.updateMatrixWorld(true);
  r.headCorr = byName.Head.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(g.getWorldQuaternion(new THREE.Quaternion()));
  r.chestCorr = byName.Spine2.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(g.getWorldQuaternion(new THREE.Quaternion()));
  return r;
}
// swap the looping base animation with a short cross-fade
function base(r, name, scale = 1) {
  const a = r.act[name]; if (!a) return;
  a.timeScale = scale;
  if (r.base === name) return;
  const prev = r.act[r.base];
  a.reset().setEffectiveWeight(1).play(); if (prev) prev.crossFadeTo(a, 0.22, false);
  r.base = name;
}
export function soldierEvent(r, kind) {   // one-shot upper-body moves: 'fire' | 'reload' | 'throw' | 'hit'
  if (kind === 'reload') r.reloadT = 1.6;   // the left hand leaves the gun to swap the mag
  const a = r.act[kind + 'Up']; if (!a || r.dead) return;
  const speed = { fire: 1.6, reload: 1.1, throw: 2.2, hit: 1.4 }[kind] || 1;
  a.reset(); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = false; a.timeScale = speed; a.setEffectiveWeight(kind === 'fire' ? 2 : 3); a.play();
}
// two-bone IK in world space: bend upper -> lower -> end so the end reaches target, the elbow towards pole
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _t4 = new THREE.Vector3(), _t5 = new THREE.Vector3(), _t6 = new THREE.Vector3();
const _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3(), _ia = new THREE.Vector3(), _ib = new THREE.Vector3(), _ic = new THREE.Vector3(), _ie = new THREE.Vector3(), _id = new THREE.Vector3(), _in = new THREE.Vector3(), _iq = new THREE.Quaternion(), _iw = new THREE.Quaternion(), _ip = new THREE.Quaternion();
function rotateWorld(b, from, to) {   // turn bone b so the world direction `from` becomes `to`
  _iq.setFromUnitVectors(from, to); b.getWorldQuaternion(_iw); b.parent.getWorldQuaternion(_ip).invert();
  b.quaternion.copy(_ip.multiply(_iq.multiply(_iw))); b.updateMatrixWorld(true);
}
function ik2(upper, lower, end, target, pole) {
  if (!upper || !lower || !end) return;
  upper.getWorldPosition(_ia); lower.getWorldPosition(_ib); end.getWorldPosition(_ic);
  const la = _ia.distanceTo(_ib), lb = _ib.distanceTo(_ic);
  _id.copy(target).sub(_ia); const dist = Math.min(Math.max(_id.length(), Math.abs(la - lb) + 1e-3), la + lb - 1e-3); _id.normalize();
  const cosA = (la * la + dist * dist - lb * lb) / (2 * la * dist), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _in.copy(pole).sub(_ia); _in.addScaledVector(_id, -_in.dot(_id)); if (_in.lengthSq() < 1e-8) _in.set(0, -1, 0); _in.normalize();
  _ie.copy(_ia).addScaledVector(_id, la * cosA).addScaledVector(_in, la * sinA);   // where the elbow should be
  rotateWorld(upper, _k1.copy(_ib).sub(_ia).normalize(), _k2.copy(_ie).sub(_ia).normalize());
  lower.getWorldPosition(_ib); end.getWorldPosition(_ic);
  rotateWorld(lower, _k1.copy(_ic).sub(_ib).normalize(), _k2.copy(target).sub(_ib).normalize());
}
// rotate a bone about a world-space axis (works whatever the bone's own axes are)
function turnWorld(b, axis, ang) {
  b.parent.getWorldQuaternion(_q); _ax.copy(axis).applyQuaternion(_q.invert()).normalize();
  b.quaternion.premultiply(_q2.setFromAxisAngle(_ax, ang)); b.updateMatrixWorld(true);
}
// per frame: pick the base animation from how the player moves, then aim, gun and props
export function poseSoldier(r, { dt = 1 / 60, vx = 0, vz = 0, vy = 0, yaw = 0, crouch = 0, pitch = 0, dead = 0, emote = null, lean = 0, prone = 0, rest = 0 }) {
  r.t += dt;
  if (dead) {
    if (!r.dead) { r.dead = true; for (const a of Object.values(r.act)) a.stop(); const d = r.act.die; d.reset(); d.setLoop(THREE.LoopOnce); d.clampWhenFinished = true; d.play(); r.base = 'die'; }
  } else {
    if (r.dead) { r.dead = false; r.act.die.stop(); r.base = ''; base(r, 'idle'); }
    const sp = Math.hypot(vx, vz), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const f = -(vx * sy) - vz * cy, side = vx * cy - vz * sy;   // speed along where they face, and to their right
    if (r.rootS) r.root.scale.copy(r.rootS); else r.rootS = r.root.scale.clone();   // emotes may squash the whole body: reset first
    if (emote) {
      const a = emote.anim, BASE = { dance: 'dance', floss: 'dance', chicken: 'dance', griddy: 'run', twerk: 'crouch', sit: 'crouch', zombie: 'walk', tbag: Math.floor(r.t * 5) % 2 ? 'crouch' : 'idle', lmao: 'crouch' };
      base(r, BASE[a] || 'idle', a === 'chicken' ? 1.3 : a === 'griddy' ? 1.7 : a === 'zombie' ? 0.45 : 1);
      if (a === 'tbag') { const ac = r.act[r.base]; if (ac) ac.time = 0.5; }
    }
    else if (Math.abs(vy) > 2.2) base(r, 'jump');
    else if (crouch > 0.5) { if (sp > 0.3) base(r, 'crouchWalk', Math.min(1.6, sp / SPEED.crouchWalk)); else base(r, 'crouch'); }
    else if (sp < 0.35) base(r, 'idle');
    else {
      const run = sp > 3.4, ax = Math.abs(f) >= Math.abs(side) * 0.8;
      const name = ax ? (f >= 0 ? (run ? 'run' : 'walk') : (run ? 'runBack' : 'walkBack')) : (side > 0 ? (run ? 'runRight' : 'walkRight') : (run ? 'runLeft' : 'walkLeft'));
      base(r, name, Math.max(0.6, Math.min(1.7, sp / SPEED[name])));
    }
  }
  r.mixer.update(dt);
  r.g.updateMatrixWorld(true);
  const B = r.bones;
  if (!r.dead) {
    // aim: bend the spine and head with the pitch; procedural emotes on top of the idle pose
    _v.set(1, 0, 0).applyQuaternion(r.g.getWorldQuaternion(_q2.identity()));   // the character's right
    const p = Math.max(-1.2, Math.min(1.2, pitch)) + crouch * 0.15;
    if (!emote) for (const n of ['Spine', 'Spine1', 'Spine2']) if (B[n]) turnWorld(B[n], _v, p * 0.27);
    if (B.Head) turnWorld(B.Head, _v, p * 0.15);
    if (rest && !emote) { if (B.Spine2) turnWorld(B.Spine2, _v, 0.03); if (B.Head) turnWorld(B.Head, _v, 0.03); }   // at rest: stand tall, chin up
    if (lean && !emote) {   // leaning (Q / E while aimed in): the spine rolls about the facing direction
      _fw.set(0, 0, -1).applyQuaternion(r.g.getWorldQuaternion(_q2.identity()));
      for (const n of ['Spine', 'Spine1', 'Spine2']) if (B[n]) turnWorld(B[n], _fw, lean * 0.2);
      if (B.Head) turnWorld(B.Head, _fw, -lean * 0.12);
    }
    if (emote) emotePose(r, emote, _v);
  }
  // the gun: shouldered for rifles, held out in both hands for pistols, pointing where the player aims. The animation
  // drives legs, hips and spine; the arms are then solved onto the gun (right hand on the grip, left on the foregrip),
  // so every soldier really holds their weapon whatever the clip underneath is doing.
  const hand = B.RightHand, tg = r.tpGun, gm = tg.children[0];
  if (hand && gm) {
    tg.visible = !emote && !r.dead;
    const cat = (tg.userData || {}).cat || 'rifle', armed = !emote && !r.dead && B.RightArm && B.LeftArm;
    // ready stance: between shots the muzzle rests a little low (rifles at low ready, pistols at a compressed ready),
    // snapping level the moment they fire (r.flashT is set on every shot) and easing back down after a second
    r.aimK = (r.flashT || 0) > 0 ? 1 : Math.max(0, (r.aimK || 0) - dt * 0.8);
    const low = (cat === 'pistol' ? 0.2 : cat === 'sniper' ? 0.1 : 0.16) * (1 - r.aimK) * (1 - prone);
    const ap = Math.max(-1.2, Math.min(1.2, pitch)) - low + prone * Math.PI / 2 * 0.94;   // prone: the body lies forward, the gun still points ahead
    if (armed && rest && !['pistol', 'zeus', 'knife', 'grenade', 'c4'].includes(cat)) {
      // at rest (menus, showcases): the relaxed two-handed low ready. The rifle lies across the body at the belt, muzzle
      // to the left and a little down; right hand on the grip by the right hip, left hand under the handguard, elbows
      // bent and tucked down by the sides.
      const q = r.g.getWorldQuaternion(_q2.identity()), rt = _t5.set(1, 0, 0).applyQuaternion(q).clone(), fw = _fw.set(0, 0, -1).applyQuaternion(q).clone(), up = new THREE.Vector3(0, 1, 0);
      const hips = B.Hips.getWorldPosition(new THREE.Vector3());
      const grip = hips.clone().addScaledVector(rt, 0.12).addScaledVector(fw, 0.22).addScaledVector(up, -0.02);
      const dir = new THREE.Vector3().addScaledVector(rt, -0.84).addScaledVector(fw, 0.42).addScaledVector(up, -0.34).normalize();
      ik2(B.RightArm, B.RightForeArm, B.RightHand, grip, B.RightArm.getWorldPosition(new THREE.Vector3()).addScaledVector(up, -0.7).addScaledVector(rt, 0.3).addScaledVector(fw, -0.45));
      const rh = B.RightHand.getWorldPosition(_t1);
      if (B.RightHandMiddle1) rh.lerp(B.RightHandMiddle1.getWorldPosition(_t2), 0.55);
      const zA = _t4.copy(dir).negate(), yA = _v.set(0, 1, 0).addScaledVector(zA, -zA.y).normalize(), xA = _t2.crossVectors(yA, zA);
      _m.makeBasis(xA, yA, zA); _q.setFromRotationMatrix(_m);
      r.g.getWorldQuaternion(_q2).invert(); tg.quaternion.copy(_q2.multiply(_q));
      tg.position.copy(rh); r.g.worldToLocal(tg.position);
      if (gm.userData.grip) gm.position.copy(gm.userData.grip).multiply(gm.scale).negate();
      tg.updateMatrixWorld(true);
      const fore = rh.clone().addScaledVector(dir, 0.36).addScaledVector(yA, -0.035);
      ik2(B.LeftArm, B.LeftForeArm, B.LeftHand, fore, B.LeftArm.getWorldPosition(new THREE.Vector3()).addScaledVector(up, -0.7).addScaledVector(rt, -0.35).addScaledVector(fw, -0.3));
    } else if (armed && cat !== 'knife' && cat !== 'grenade' && cat !== 'c4') {
      // The clips are a rifle set: the hands already hold an (invisible) rifle in a natural, motion-captured pose. So the
      // gun follows the hands, not the other way round: the grip sits in the right palm and the barrel runs out through
      // the left hand. Aiming up and down bends the upper spine until that hand line points where the player aims, so
      // the arms never have to be twisted onto the gun.
      const pistol = cat === 'pistol', rt = _t5.set(1, 0, 0).applyQuaternion(r.g.getWorldQuaternion(_q2.identity()));
      if (!prone) for (const [n, a] of [['Spine', LEANF * 0.4], ['Spine1', LEANF * 0.35], ['Spine2', LEANF * 0.25]]) if (B[n]) turnWorld(B[n], rt, a);
      const palm = (h, f, out) => { h.getWorldPosition(out); if (f) out.lerp(f.getWorldPosition(_t6), 0.55); return out; };
      for (let pass = 0; pass < 2; pass++) {   // two small passes: bend the spine, re-read the hands
        const rh = palm(B.RightHand, B.RightHandMiddle1, _t1), lh = palm(B.LeftHand, B.LeftHandMiddle1, _t2), d = _t3.copy(lh).sub(rh);
        if (d.lengthSq() < 0.01) break;
        const cur = Math.atan2(d.y, Math.hypot(d.x, d.z)), want = ap * (pistol ? 0.9 : 1), delta = Math.max(-0.9, Math.min(0.9, want - cur));
        if (Math.abs(delta) < 0.01) break;
        for (const [n, k] of [['Spine', 0.2], ['Spine1', 0.35], ['Spine2', 0.45]]) if (B[n]) turnWorld(B[n], rt, delta * k);
      }
      const rh = palm(B.RightHand, B.RightHandMiddle1, _t1), lh = palm(B.LeftHand, B.LeftHandMiddle1, _t2);
      const dir = _t3.copy(lh).sub(rh);
      if (dir.lengthSq() < 0.01) dir.set(0, Math.sin(ap), -Math.cos(ap)).applyQuaternion(r.g.getWorldQuaternion(_q2.identity()));
      dir.normalize();
      // the gun's frame in world space: barrel (-z) along the hand line, up as close to world up as the barrel allows
      const zA = _t4.copy(dir).negate(), yA = _v.set(0, 1, 0).addScaledVector(zA, -zA.y).normalize(), xA = _fw.crossVectors(yA, zA);
      _m.makeBasis(xA, yA, zA); _q.setFromRotationMatrix(_m);
      r.g.getWorldQuaternion(_q2).invert(); tg.quaternion.copy(_q2.multiply(_q));
      tg.position.copy(rh); r.g.worldToLocal(tg.position);
      if (gm.userData.grip) gm.position.copy(gm.userData.grip).multiply(gm.scale).negate();
      tg.updateMatrixWorld(true);
      if (pistol) {   // two-handed pistol: the support hand comes back from where the rifle's handguard would be onto the grip
        const sup = tg.localToWorld(_t2.set(-0.045, -0.035, 0.01)), D = _t4.set(0, -1, 0);
        ik2(B.LeftArm, B.LeftForeArm, B.LeftHand, sup, _t5.copy(B.LeftArm.getWorldPosition(_t6)).addScaledVector(D, 0.6).addScaledVector(rt, -0.35));
      } else if (r.reloadT > 0 && B.Hips) {   // reload: the left hand drops to the mag pouch and brings a fresh one up
        const k = 1 - r.reloadT / 1.6, out = Math.sin(Math.min(1, k * 1.25) * Math.PI), pouch = B.Hips.getWorldPosition(_t6).addScaledVector(rt, -0.18).add(_t4.set(0, 0.05, 0));
        ik2(B.LeftArm, B.LeftForeArm, B.LeftHand, _t5.copy(lh).lerp(pouch, out), _t1.copy(B.LeftArm.getWorldPosition(_t1)).add(_t4.set(0, -0.6, 0)));
      }
    } else {   // knife, grenade, bomb: carried in the right hand as animated
      hand.getWorldPosition(_v); r.g.worldToLocal(_v);
      tg.position.copy(_v); tg.rotation.set(ap, 0, 0, 'YXZ');
      if (gm.userData.grip) gm.position.copy(gm.userData.grip).multiply(gm.scale).negate();
    }
  }
  if (r.reloadT > 0) r.reloadT -= dt;
  // head props follow the head bone
  if (B.Spine2 && r.chest.visible) {   // the vest rides the upper spine
    B.Spine2.getWorldPosition(_v); r.g.worldToLocal(_v); r.chest.position.copy(_v);
    B.Spine2.getWorldQuaternion(_q).multiply(r.chestCorr); r.g.getWorldQuaternion(_q2).invert(); r.chest.quaternion.copy(_q2.multiply(_q));
  }
  if (B.Head && r.head.children.length) {
    B.Head.getWorldPosition(_v); r.g.worldToLocal(_v); r.head.position.copy(_v).add(new THREE.Vector3(0, -0.12, 0));
    B.Head.getWorldQuaternion(_q).multiply(r.headCorr); r.g.getWorldQuaternion(_q2).invert(); r.head.quaternion.copy(_q2.multiply(_q));
  }
}
// emotes the clips don't cover: a few big readable poses built from world-axis bone turns
function emotePose(r, e, rightIn) {
  // the poses were authored when the model stood turned round: keep their axes (forward = the body's front, "right" = its left side)
  const right = rightIn.clone().negate(), B = r.bones, t = e.t, s = Math.sin, up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3().crossVectors(up, right).negate();
  switch (e.anim) {
    case 'wave': turnWorld(B.RightArm, fwd, -2.3); turnWorld(B.RightForeArm, fwd, -0.6 + s(t * 10) * 0.5); break;
    case 'salute': turnWorld(B.RightArm, fwd, -1.7); turnWorld(B.RightForeArm, up, 2.2); break;
    case 'flex': turnWorld(B.LeftArm, fwd, 1.5); turnWorld(B.RightArm, fwd, -1.5); turnWorld(B.LeftForeArm, fwd, 1.6 + s(t * 6) * 0.15); turnWorld(B.RightForeArm, fwd, -1.6 - s(t * 6) * 0.15); break;
    case 'tpose': for (const a of Object.values(r.act)) a.stop(); r.base = ''; break;
    case 'dab': turnWorld(B.LeftArm, fwd, 2.2); turnWorld(B.RightArm, fwd, -0.6); turnWorld(B.RightForeArm, up, 2); turnWorld(B.Head, right, 0.6); break;
    case 'cry': turnWorld(B.LeftArm, right, -1.9); turnWorld(B.RightArm, right, -1.9); turnWorld(B.LeftForeArm, right, -1.6); turnWorld(B.RightForeArm, right, -1.6); turnWorld(B.Head, right, 0.5 + s(t * 14) * 0.08); break;
    case 'fart': turnWorld(B.Spine, right, 0.6); turnWorld(B.Head, right, -0.4); break;
    case 'worm': turnWorld(B.Hips, right, -1.35 - s(t * 7) * 0.2); break;
    case 'twerk': {   // on purpose like a cheap phone-filter twerk: choppy 7 fps, the whole body squashing, random glitch twitches
      const q = Math.floor(t * 7) / 7, b = s(q * 31);
      turnWorld(B.Spine, right, 0.95); turnWorld(B.Spine1, right, 0.25); turnWorld(B.Hips, right, -0.3 + b * 0.38); turnWorld(B.Hips, up, s(q * 13) * 0.25);
      turnWorld(B.LeftArm, right, -1.1); turnWorld(B.RightArm, right, -1.1); turnWorld(B.LeftForeArm, right, -0.4); turnWorld(B.RightForeArm, right, -0.4);
      r.root.scale.set(r.rootS.x * (1 - b * 0.07), r.rootS.y * (1 + b * 0.13), r.rootS.z * (1 - b * 0.07));
      if ((t % 1.7) < 0.14) turnWorld(B.Head, up, Math.PI);   // the filter glitches: head spins round for a frame or two
      if ((t % 2.3) < 0.1) r.root.scale.multiplyScalar(1.25);
      break;
    }
    case 'griddy': turnWorld(B.LeftArm, right, -1.2 + s(t * 11) * 0.7); turnWorld(B.RightArm, right, -1.2 - s(t * 11) * 0.7); turnWorld(B.Spine, right, 0.35); turnWorld(B.Head, right, s(t * 22) * 0.12); break;
    case 'headbang': turnWorld(B.Spine2, right, 0.25 + s(t * 15) * 0.3); turnWorld(B.Head, right, 0.3 + s(t * 15) * 0.5); turnWorld(B.RightArm, fwd, -2.2); turnWorld(B.RightForeArm, up, 1.4); break;   // devil horns up
    case 'heli': turnWorld(B.LeftArm, fwd, 1.4); turnWorld(B.RightArm, fwd, -1.4); turnWorld(B.Spine, up, (t * 14) % (Math.PI * 2)); break;
    case 'clap': { const c2 = Math.max(0, s(t * 2.6)); turnWorld(B.LeftArm, right, -1.3); turnWorld(B.RightArm, right, -1.3); turnWorld(B.LeftArm, up, -0.6 + c2 * 0.55); turnWorld(B.RightArm, up, 0.6 - c2 * 0.55); break; }
    case 'zombie': turnWorld(B.LeftArm, right, -1.5); turnWorld(B.RightArm, right, -1.5); turnWorld(B.Head, fwd, 0.5 + s(t * 2) * 0.15); turnWorld(B.Spine, fwd, s(t * 3) * 0.12); break;
    case 'sit': turnWorld(B.Hips, right, 0.5); turnWorld(B.Spine, right, -0.3); turnWorld(B.LeftArm, right, -0.7); turnWorld(B.RightArm, right, -0.7); turnWorld(B.Head, up, s(t * 0.8) * 0.4); break;
    case 'lmao': turnWorld(B.Hips, fwd, (t * 5) % (Math.PI * 2)); turnWorld(B.Spine, right, 0.8); turnWorld(B.LeftArm, right, -1.6); turnWorld(B.RightArm, right, -1.6); turnWorld(B.Head, right, s(t * 18) * 0.2); break;
    default: break;
  }
}

// Tung Tung Tung Sahur: an original brainrot character riding the soldier's skeleton. A bark-covered log for a body with a
// wide-eyed face, stick arms and legs, and a baseball bat slung on its back. Parts hang off the bones, so every
// animation (walk, run, crouch, die, emotes) moves it, janky stick limbs and all.
let logMats = null;
function logBody(B, hq) {
  if (!logMats) {
    const bark = hq ? new THREE.MeshStandardMaterial({ color: '#7a5030', roughness: 0.9, metalness: 0 }) : new THREE.MeshLambertMaterial({ color: '#7a5030' });
    if (hq) gunSurface(bark, 'gwood', { tile: 4, albedo: 1.4, normal: 1.6 });
    const end = new THREE.MeshLambertMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#d8b07a'; x.fillRect(0, 0, 128, 128);
      for (let r = 6; r < 64; r += 5 + Math.random() * 3) { x.strokeStyle = `rgba(120,80,40,${0.25 + Math.random() * 0.3})`; x.lineWidth = 1.5; x.beginPath(); x.arc(64 + Math.random() * 2, 64 + Math.random() * 2, r, 0, 7); x.stroke(); }
      x.strokeStyle = '#6a4424'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 61, 0, 7); x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() });
    logMats = { bark, end, white: new THREE.MeshLambertMaterial({ color: '#f6f2ea' }), black: new THREE.MeshBasicMaterial({ color: '#0a0806' }), stick: bark, bat: hq ? new THREE.MeshStandardMaterial({ color: '#c8a070', roughness: 0.45 }) : new THREE.MeshLambertMaterial({ color: '#c8a070' }) };
    for (const m of [logMats.end, logMats.white]) litPatch(m, 'dyn');
    if (!hq) litPatch(logMats.bark, 'dyn');
  }
  const M = logMats, wp = (b) => b.getWorldPosition(new THREE.Vector3());
  const add = (bone, mesh) => { if (bone) bone.attach(mesh); };
  const between = (a, b, r, mat, ext = 0) => {   // a stick from bone a to bone b (world space at rest), hung on a
    if (!a || !b) return; const pa = wp(a), pb = wp(b), d = pb.clone().sub(pa), L = d.length() + ext;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, L, 8), mat); m.position.copy(pa).addScaledVector(d.normalize(), L / 2 - ext / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); add(a, m);
  };
  // the log: from the hips to well above the head, ends showing growth rings
  const hip = wp(B.Hips), top = wp(B.Head).add(new THREE.Vector3(0, 0.28, 0)), H = top.y - hip.y + 0.12;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.215, H, 18, 1, true), M.bark); body.position.set(hip.x, hip.y - 0.12 + H / 2, hip.z); add(B.Spine, body);
  for (const [y, rx] of [[hip.y - 0.12 + H, -Math.PI / 2], [hip.y - 0.12, Math.PI / 2]]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18), M.end); e.position.set(hip.x, y, hip.z); e.rotation.x = rx; add(B.Spine, e); }
  for (let k = 0; k < 3; k++) { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.bark); kn.scale.set(1, 0.6, 0.5); kn.position.set(hip.x + (k - 1) * 0.12, hip.y + 0.2 + k * 0.22, hip.z + 0.19 * (k === 1 ? -1 : 1)); add(B.Spine, kn); }   // knots
  // the face, on the front (players face -z)
  const hd = wp(B.Head), fz = -0.2;
  for (const sd of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 10), M.white); eye.scale.set(1, 1.25, 0.6); eye.position.set(hd.x + sd * 0.075, hd.y + 0.08, hd.z + fz); add(B.Spine2 || B.Spine, eye);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), M.black); pu.position.set(hd.x + sd * 0.07, hd.y + 0.075, hd.z + fz - 0.035); add(B.Spine2 || B.Spine, pu);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.016, 0.02), M.black); brow.position.set(hd.x + sd * 0.075, hd.y + 0.17, hd.z + fz - 0.01); brow.rotation.z = sd * 0.35; add(B.Spine2 || B.Spine, brow);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI), M.black); mouth.position.set(hd.x, hd.y - 0.06, hd.z + fz - 0.005); mouth.rotation.z = Math.PI; add(B.Spine2 || B.Spine, mouth);
  // stick limbs and stubby hands/feet
  for (const s of ['Left', 'Right']) {
    between(B[s + 'Arm'], B[s + 'ForeArm'], 0.026, M.stick, 0.02); between(B[s + 'ForeArm'], B[s + 'Hand'], 0.022, M.stick, 0.02);
    between(B[s + 'UpLeg'], B[s + 'Leg'], 0.034, M.stick, 0.02); between(B[s + 'Leg'], B[s + 'Foot'], 0.03, M.stick, 0.02);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), M.stick); hand.position.copy(wp(B[s + 'Hand'])); add(B[s + 'Hand'], hand);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.16), M.stick); foot.position.copy(wp(B[s + 'Foot'])).add(new THREE.Vector3(0, -0.03, -0.04)); add(B[s + 'Foot'], foot);
  }
  // the bat, slung across the back
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.016, 0.8, 12), M.bat); bat.position.set(hd.x - 0.05, hd.y - 0.35, hd.z + 0.25); bat.rotation.z = 0.7; add(B.Spine1 || B.Spine, bat);
}

// joke agents keep their signature headgear, worn over the soldier's helmet (local origin = the head bone)
let hatMat = null;
function hat(head, L) {
  if (!hatMat) hatMat = litPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), 'dyn');
  const c = L.hatColor || '#333', parts = [];
  const add = (geo, col, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(new THREE.Euler(rx, ry, rz)), _s.set(sx, sy, sz)));
    const n = geo.attributes.position.count, cc = new THREE.Color(col), arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) arr.set([cc.r, cc.g, cc.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); parts.push(geo.index ? geo.toNonIndexed() : geo);
  };
  switch (L.hat) {
    case 'bun': add(new THREE.CapsuleGeometry(0.075, 0.24, 3, 8), c, -0.14, 0.14, 0, 0, 0, 0.1, 1, 1, 0.8); add(new THREE.CapsuleGeometry(0.075, 0.24, 3, 8), c, 0.14, 0.14, 0, 0, 0, -0.1, 1, 1, 0.8); break;
    case 'swirl': for (let k = 0; k < 3; k++) add(new THREE.TorusGeometry(0.11 - k * 0.028, 0.048 - k * 0.009, 6, 14), c, 0, 0.3 + k * 0.07, 0, Math.PI / 2); add(new THREE.ConeGeometry(0.035, 0.09, 8), c, 0.01, 0.52, 0); break;
    case 'curlers': for (let k = 0; k < 5; k++) add(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 8), c, -0.09 + k * 0.045, 0.3, 0.01 - (k % 2) * 0.04, Math.PI / 2); break;
    case 'beak': add(new THREE.ConeGeometry(0.045, 0.16, 8), c, 0, 0.13, -0.17, -Math.PI / 2); break;
    case 'stem': add(new THREE.CylinderGeometry(0.016, 0.022, 0.12, 6), c, 0.01, 0.33, 0, 0, 0, -0.2); break;
    case 'mullet': add(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), c, 0, 0.2, 0.01); add(new THREE.BoxGeometry(0.2, 0.2, 0.06), c, 0, 0.05, 0.12); break;   // business up front, party in the back
    case 'headset': add(new THREE.TorusGeometry(0.135, 0.014, 6, 16, Math.PI), c, 0, 0.18, 0); for (const sd of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 12), c, sd * 0.135, 0.13, 0, 0, 0, Math.PI / 2); add(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), c, -0.11, 0.08, -0.08, 0.9, 0, 0); break;
    case 'toque': add(new THREE.CylinderGeometry(0.115, 0.1, 0.12, 14), c, 0, 0.3, 0); add(new THREE.SphereGeometry(0.14, 14, 9), c, 0, 0.4, 0, 0, 0, 0, 1, 0.6, 1); break;   // tall chef's hat
    case 'bob': add(new THREE.SphereGeometry(0.15, 14, 10), c, 0, 0.16, 0.025, 0, 0, 0, 1.05, 1, 1.05); add(new THREE.BoxGeometry(0.2, 0.05, 0.06), c, 0.03, 0.24, -0.11, 0, 0, -0.25); break;   // can I speak to your manager
    case 'dunce': add(new THREE.ConeGeometry(0.125, 0.52, 16), c, 0, 0.47, 0.01); add(new THREE.TorusGeometry(0.122, 0.018, 6, 18), '#e8b820', 0, 0.22, 0.01, Math.PI / 2);   // hazmat hood visor + a dunce cap; purely cosmetic (hitboxes are fixed boxes in weapons.js)
      add(new THREE.BoxGeometry(0.2, 0.09, 0.03), '#1c2a30', 0, 0.14, -0.155); break;
    case 'cone': add(new THREE.ConeGeometry(0.11, 0.32, 14), c, 0, 0.38, 0); add(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 14), '#ffffff', 0, 0.36, 0); add(new THREE.BoxGeometry(0.26, 0.02, 0.26), c, 0, 0.22, 0); break;
    case 'beret': add(new THREE.SphereGeometry(0.14, 14, 8), c, 0.02, 0.29, 0, 0, 0, 0.18, 1.12, 0.32, 1.1); break;
    case 'shemagh': if (L.plain) break; add(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), c, 0, 0.17, 0.005, 0, 0, 0, 1.04, 1, 1.06); add(new THREE.BoxGeometry(0.25, 0.085, 0.07), c, 0, 0.075, -0.115); add(new THREE.BoxGeometry(0.13, 0.2, 0.03), c, 0.02, 0.0, 0.13, 0.25, 0, 0.1); break;   // head wrap, face cloth, tail down the back
    case 'helmet': if (L.plain) break; add(new THREE.SphereGeometry(0.155, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), c, 0, 0.17, 0.01, 0, 0, 0, 1.06, 0.92, 1.12); add(new THREE.CylinderGeometry(0.165, 0.17, 0.03, 16), c, 0, 0.17, 0.01, 0, 0, 0, 1, 1, 1.08);
      if (L.visor) add(new THREE.BoxGeometry(0.23, 0.07, 0.025), '#0e1014', 0, 0.13, -0.16, 0.12); break;
    case 'cap': add(new THREE.SphereGeometry(0.135, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), c, 0, 0.22, 0); add(new THREE.CylinderGeometry(0.1, 0.1, 0.014, 14), c, 0, 0.26, -0.11, 0, 0, 0, 1.05, 1, 1.1); break;
    default: break;
  }
  if (L.eyes) for (const sd of [-1, 1]) { add(new THREE.SphereGeometry(0.04, 10, 7), '#ffffff', sd * 0.05, 0.15, -0.13); add(new THREE.SphereGeometry(0.019, 8, 5), '#111111', sd * 0.05, 0.15, -0.168); }
  if (!parts.length) return;
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { p.computeVertexNormals(); const k = p.attributes.position.count; pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); col.set(p.attributes.color.array, o * 3); o += k; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  head.add(new THREE.Mesh(g, hatMat));
  if (L.hat === 'dunce') head.add(betaTag());
}
// "BETA" on the front of the dunce cap
let betaMat = null;
function betaTag() {
  if (!betaMat) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const x = cv.getContext('2d');
    x.fillStyle = '#f4f0e6'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#c81e1e'; x.font = '900 46px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BETA', 64, 34);
    betaMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, side: THREE.DoubleSide });
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.085), betaMat);
  m.position.set(0, 0.35, -0.098); m.rotation.order = 'YXZ'; m.rotation.set(-0.235, Math.PI, 0);   // faces forward (-z), leaning back with the cone
  return m;
}

// ---- bought gear: kevlar (a plate carrier) and a helmet, shown only while the player has them ----
export function setGear(r, armor, helmet) { if (!r || !r.chest) return; r.vest.visible = armor > 0; r.chest.visible = armor > 0 || !!r.bomb; r.helm.visible = !!helmet && armor > 0; }
let gearMat = null;
function rbox(w, h, d, rad = 0.012) {   // a box with rounded edges (pads and plates aren't sharp)
  const sh = new THREE.Shape(), x = w / 2 - rad, y = h / 2 - rad;
  sh.moveTo(-x, -h / 2); sh.lineTo(x, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -y); sh.lineTo(w / 2, y); sh.quadraticCurveTo(w / 2, h / 2, x, h / 2);
  sh.lineTo(-x, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, y); sh.lineTo(-w / 2, -y); sh.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.002, d - rad * 2), bevelEnabled: true, bevelThickness: rad, bevelSize: rad * 0.8, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -(d - rad * 2) / 2); return g;
}
function gearMesh(parts) {
  if (!gearMat) gearMat = litPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), 'dyn');
  let n = 0; const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p)); for (const p of flat) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const p of flat) { if (!p.attributes.normal) p.computeVertexNormals(); const k = p.attributes.position.count; pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); col.set(p.attributes.color.array, o * 3); o += k; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, gearMat); m.castShadow = true; return m;
}
function painted(geo, col, x, y, z, rx = 0, ry = 0, rz = 0) {
  geo.applyMatrix4(_m.compose(_v.set(x, y, z), _q.setFromEuler(new THREE.Euler(rx, ry, rz)), _s.set(1, 1, 1)));
  const n = geo.attributes.position.count, c = new THREE.Color(col), arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = 0.92 + ((i * 7919) % 17) / 170; arr.set([c.r * k, c.g * k, c.b * k], i * 3); }   // a little unevenness: worn fabric, not plastic
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return geo;
}
const GEAR = { T: { cloth: '#7d6d50', dark: '#4e4433', strap: '#3a3226', metal: '#2a2a28' }, CT: { cloth: '#3f4a3a', dark: '#2a3127', strap: '#22281f', metal: '#1e2124' } };
// local frame: the upper spine bone, rig facing -z; y up
function vestParts(team) {
  const C = GEAR[team] || GEAR.CT, P = [];
  P.push(painted(rbox(0.3, 0.33, 0.05, 0.018), C.cloth, 0, 0.0, -0.14));            // front plate bag
  P.push(painted(rbox(0.3, 0.34, 0.05, 0.018), C.cloth, 0, 0.0, 0.135));            // back plate bag
  for (const sd of [-1, 1]) {
    P.push(painted(rbox(0.05, 0.19, 0.24, 0.012), C.dark, sd * 0.165, -0.06, 0));   // cummerbund
    P.push(painted(rbox(0.065, 0.025, 0.29, 0.01), C.strap, sd * 0.1, 0.17, 0));    // shoulder straps
    P.push(painted(rbox(0.07, 0.06, 0.05, 0.01), C.dark, sd * 0.13, 0.14, -0.15));  // shoulder pads
  }
  for (const x of [-0.085, 0, 0.085]) {                                              // three rifle mags up front
    P.push(painted(rbox(0.075, 0.115, 0.055, 0.012), C.cloth, x, -0.09, -0.185));
    P.push(painted(rbox(0.078, 0.025, 0.06, 0.008), C.dark, x, -0.025, -0.186));     // the flap
  }
  P.push(painted(rbox(0.2, 0.07, 0.03, 0.01), C.dark, 0, 0.085, -0.172));            // admin pouch
  for (let k = 0; k < 4; k++) P.push(painted(rbox(0.27, 0.008, 0.006, 0.002), C.strap, 0, -0.14 + k * 0.03, -0.167 + (k < 3 ? -0.0 : 0)));   // MOLLE webbing rows
  P.push(painted(rbox(0.07, 0.15, 0.05, 0.012), C.dark, -0.09, 0.02, 0.18));         // radio on the back
  P.push(painted(new THREE.CylinderGeometry(0.005, 0.005, 0.22, 5), C.metal, -0.1, 0.17, 0.19));   // its antenna
  P.push(painted(rbox(0.11, 0.08, 0.04, 0.01), C.cloth, 0.07, -0.08, 0.175));        // hydration / GP pouch
  return P;
}
// local frame: the head bone, the same as the joke hats
function helmetParts(team) {
  const C = GEAR[team] || GEAR.CT, P = [];
  P.push(painted(new THREE.SphereGeometry(0.162, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.47), C.cloth, 0, 0.165, 0.012));   // the shell (high cut over the ears)
  P.push(painted(new THREE.TorusGeometry(0.16, 0.009, 5, 28), C.dark, 0, 0.17, 0.012, Math.PI / 2));                      // edge trim
  for (const sd of [-1, 1]) P.push(painted(rbox(0.012, 0.035, 0.12, 0.004), C.metal, sd * 0.158, 0.2, 0.01, 0, 0, sd * 0.15));   // side rails
  P.push(painted(rbox(0.05, 0.035, 0.02, 0.006), C.metal, 0, 0.28, -0.135, -0.5));   // NVG shroud
  P.push(painted(rbox(0.07, 0.03, 0.03, 0.006), C.strap, 0, 0.27, 0.15, 0.4));       // counterweight pouch
  P.push(painted(new THREE.TorusGeometry(0.118, 0.006, 4, 16, Math.PI), C.strap, 0, 0.12, 0.0, 0, Math.PI / 2, Math.PI));   // chin strap
  return P;
}
// a suicide vest, the cartoon kind: sticks of dynamite on a harness, wires everywhere, a timer with a red light
function bombVestParts() {
  const P = [];
  for (const sd of [-1, 1]) P.push(painted(rbox(0.045, 0.02, 0.29, 0.006), '#1a1a1a', sd * 0.09, 0.15, 0));   // harness straps
  P.push(painted(rbox(0.36, 0.05, 0.27, 0.01), '#222222', 0, -0.13, 0));                                      // the belt
  for (let k = 0; k < 6; k++) { const x = -0.125 + k * 0.05;
    P.push(painted(new THREE.CylinderGeometry(0.022, 0.022, 0.17, 10), '#c0281e', x, -0.02, -0.15));
    P.push(painted(new THREE.CylinderGeometry(0.023, 0.023, 0.012, 10), '#e8d8b0', x, 0.065, -0.15)); }       // paper ends
  P.push(painted(rbox(0.3, 0.02, 0.02, 0.005), '#3a3a3a', 0, 0.02, -0.17));                                   // tape round the sticks
  P.push(painted(rbox(0.09, 0.06, 0.03, 0.006), '#2a2a2a', 0.0, 0.1, -0.165));                                // the timer
  P.push(painted(rbox(0.06, 0.025, 0.006, 0.002), '#ff2010', 0.0, 0.1, -0.182));                              // its red display
  for (const [c, x] of [['#2a6aff', -0.07], ['#ffd020', 0.07], ['#ff3030', 0.03]]) P.push(painted(new THREE.TorusGeometry(0.05, 0.004, 4, 10, Math.PI), c, x, 0.07, -0.168, 0, 0, Math.PI / 2));
  return P;
}
