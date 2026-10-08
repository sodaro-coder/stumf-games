// Realistic animated soldiers: a Mixamo character with Mixamo motion-captured animations (idle, walk/run in every
// direction, crouch, jump, fire, reload, throw, hit, death, dance), packed by STUMF into chars.json + chars.bin and
// rebuilt here without any loader library. Each player gets its own bones and animation mixer; the mesh, textures and
// clips are shared. The upper body bends with the player's aim, the gun sits in the right hand, and agents' joke
// headgear rides on the head bone.
import * as THREE from '../sdk/three.module.min.js';
import { litPatch } from './world.js';
import { glowMask, glowify } from './models.js';

let D = null, P = null;
export function loadChars() {
  if (!P) P = Promise.all([fetch('chars.json').then((r) => (r.ok ? r.json() : null)), fetch('chars.bin').then((r) => (r.ok ? r.arrayBuffer() : null))])
    .then(([j, b]) => { D = j && b ? build(j, b) : null; return D; }).catch(() => null);
  return P;
}
export const charsReady = () => !!D;

const UPPER = /Spine|Neck|Head|Shoulder|Arm|Hand/;   // bones an upper-body overlay (fire, reload, throw, hit) may move
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
function material(team, tint, hq, glow) {
  const key = `${team}|${tint || ''}|${hq}|${glow ? glow.glow + glow.t : ''}`;
  if (D.mats.has(key)) return D.mats.get(key);
  const res = hq ? 1024 : 512;
  const m = new THREE.MeshLambertMaterial({ map: texture(`soldier_${team === 'CT' ? 'ct' : 't'}_${res}.jpg`), normalMap: hq ? texture(`soldier_n_${res}.jpg`) : null });
  if (tint) m.color.set(tint).lerp(new THREE.Color(1, 1, 1), glow ? 0.15 : 0.35);
  if (glow) glowify(m, glowMask({ t: glow.t, glow: glow.glow }, 3), 0.9);
  litPatch(m, 'dyn'); D.mats.set(key, m); return m;
}

// clip speeds (metres per second at timeScale 1) for matching the feet to the ground speed
const SPEED = { walk: 1.0, walkBack: 1.1, walkLeft: 1.4, walkRight: 0.75, run: 3.1, runBack: 2.7, runLeft: 2.8, runRight: 3.2, crouchWalk: 0.6 };
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3(), _fw = new THREE.Vector3(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
export function makeSoldier(look, team, hq = true) {
  const L = look || {}, plainAgent = !L.speedo && !L.mustard && !L.eyes && !L.stripes && !['bun', 'swirl', 'curlers', 'beak', 'stem', 'beret', 'cap'].includes(L.hat);
  const tint = plainAgent && !L.glow ? null : L.body;
  const g = new THREE.Group(), holder = new THREE.Group(); holder.rotation.y = Math.PI; g.add(holder);   // Mixamo faces +z; the game's players face -z
  const c = D.c, root = new THREE.Group();
  root.position.fromArray(c.root.t); root.quaternion.fromArray(c.root.q); root.scale.fromArray(c.root.s); holder.add(root);
  const bones = c.bones.map((b) => { const o = new THREE.Bone(); o.name = b.n; o.position.fromArray(b.t); o.quaternion.fromArray(b.q); o.scale.fromArray(b.s); return o; });
  c.bones.forEach((b, i) => { if (b.p >= 0) bones[b.p].add(bones[i]); else root.add(bones[i]); });
  const mat = material(team, tint, hq, L.glow ? { glow: L.glow, t: L.glowT || 'circuit' } : null);
  for (const m of D.meshes) {
    const sm = new THREE.SkinnedMesh(m.g, mat); sm.frustumCulled = false; root.add(sm);
    sm.bind(new THREE.Skeleton(m.joints.map((i) => bones[i]), m.inverses), m.bind);
  }
  const byName = Object.fromEntries(bones.map((b) => [b.name.replace('mixamorig', ''), b]));
  const mixer = new THREE.AnimationMixer(root), act = {};
  for (const [k, clip] of Object.entries(D.clips)) { const a = mixer.clipAction(clip); a.setLoop(clip.loop ? THREE.LoopRepeat : THREE.LoopOnce); if (!clip.loop) a.clampWhenFinished = true; act[k] = a; }
  act.idle.play();
  const tpGun = new THREE.Group(); g.add(tpGun);
  const head = new THREE.Group(); g.add(head);
  hat(head, L);
  const r = { soldier: true, g, holder, root, bones: byName, mixer, act, base: 'idle', tpGun, head, tpKey: '', over: null, t: 0, dieDone: false };
  // where the head and hand sit relative to their bones at rest: lets props follow the animated bones
  g.updateMatrixWorld(true);
  r.headCorr = byName.Head.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(g.getWorldQuaternion(new THREE.Quaternion()));
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
export function poseSoldier(r, { dt = 1 / 60, vx = 0, vz = 0, vy = 0, yaw = 0, crouch = 0, pitch = 0, dead = 0, emote = null, lean = 0 }) {
  r.t += dt;
  if (dead) {
    if (!r.dead) { r.dead = true; for (const a of Object.values(r.act)) a.stop(); const d = r.act.die; d.reset(); d.setLoop(THREE.LoopOnce); d.clampWhenFinished = true; d.play(); r.base = 'die'; }
  } else {
    if (r.dead) { r.dead = false; r.act.die.stop(); r.base = ''; base(r, 'idle'); }
    const sp = Math.hypot(vx, vz), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const f = -(vx * sy) - vz * cy, side = vx * cy - vz * sy;   // speed along where they face, and to their right
    if (emote) base(r, ['dance', 'floss', 'chicken', 'twerk'].includes(emote.anim) ? 'dance' : 'idle', emote.anim === 'twerk' ? 1.6 : emote.anim === 'chicken' ? 1.3 : 1);
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
    const ap = Math.max(-1.2, Math.min(1.2, pitch));
    if (armed && cat !== 'knife' && cat !== 'grenade' && cat !== 'c4') {
      { // square the chest to the aim: the shoulder line should run along the rig's right (keep ~20 degrees of rifle stance)
        const L = B.LeftArm.getWorldPosition(_t1), Rs = B.RightArm.getWorldPosition(_t2), sl = _t3.copy(Rs).sub(L); sl.y = 0;
        const want = _t4.set(1, 0, 0).applyQuaternion(r.g.getWorldQuaternion(_q2.identity())); want.y = 0;
        if (sl.lengthSq() > 1e-6) { sl.normalize(); want.normalize(); let ang = Math.atan2(sl.x * want.z - sl.z * want.x, sl.dot(want)); ang = -(ang - (cat === 'pistol' ? 0 : 0.35));
          const up = _t5.set(0, 1, 0); for (const n of ['Spine', 'Spine1', 'Spine2']) if (B[n]) turnWorld(B[n], up, ang / 3); }
      }
      // aim frame in the rig's own space: forward is -z, pitched up/down about the shoulders
      const pistol = cat === 'pistol', S = B.RightArm.getWorldPosition(_v); r.g.worldToLocal(S);
      const cp = Math.cos(ap), sp = Math.sin(ap), fwd = _fw.set(0, sp, -cp);
      const reachF = pistol ? 0.42 : 0.2, drop = pistol ? 0.1 : 0.12, inX = pistol ? -0.13 : -0.04;
      tg.position.set(S.x + inX, S.y - drop * cp, S.z).addScaledVector(fwd, reachF);
      tg.rotation.set(ap, 0, 0, 'YXZ');
      if (gm.userData.grip) gm.position.copy(gm.userData.grip).multiply(gm.scale).negate();
      tg.updateMatrixWorld(true);
      const gripW = tg.localToWorld(_t1.set(0, 0, 0)), fore = gm.userData.fore;
      const foreW = fore ? gm.localToWorld(_t2.copy(fore)) : tg.localToWorld(_t2.set(-0.035, -0.03, 0.02));
      const R = _t3.set(1, 0, 0).applyQuaternion(r.g.getWorldQuaternion(_q2.identity())), D = _t4.set(0, -1, 0);
      if (!(r.reloadT > 0)) ik2(B.LeftArm, B.LeftForeArm, B.LeftHand, foreW, _t5.copy(B.LeftArm.getWorldPosition(_t6)).addScaledVector(D, 0.6).addScaledVector(R, -0.35));
      ik2(B.RightArm, B.RightForeArm, B.RightHand, gripW, _t5.copy(B.RightArm.getWorldPosition(_t6)).addScaledVector(D, 0.6).addScaledVector(R, 0.45));
    } else {   // knife, grenade, bomb: carried in the right hand as animated
      hand.getWorldPosition(_v); r.g.worldToLocal(_v);
      tg.position.copy(_v); tg.rotation.set(ap, 0, 0, 'YXZ');
      if (gm.userData.grip) gm.position.copy(gm.userData.grip).multiply(gm.scale).negate();
    }
  }
  if (r.reloadT > 0) r.reloadT -= dt;
  // head props follow the head bone
  if (B.Head && r.head.children.length) {
    B.Head.getWorldPosition(_v); r.g.worldToLocal(_v); r.head.position.copy(_v).add(new THREE.Vector3(0, -0.12, 0));
    B.Head.getWorldQuaternion(_q).multiply(r.headCorr); r.g.getWorldQuaternion(_q2).invert(); r.head.quaternion.copy(_q2.multiply(_q));
  }
}
// emotes the clips don't cover: a few big readable poses built from world-axis bone turns
function emotePose(r, e, right) {
  const B = r.bones, t = e.t, s = Math.sin, up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3().crossVectors(up, right).negate();
  switch (e.anim) {
    case 'wave': turnWorld(B.RightArm, fwd, -2.3); turnWorld(B.RightForeArm, fwd, -0.6 + s(t * 10) * 0.5); break;
    case 'salute': turnWorld(B.RightArm, fwd, -1.7); turnWorld(B.RightForeArm, up, 2.2); break;
    case 'flex': turnWorld(B.LeftArm, fwd, 1.5); turnWorld(B.RightArm, fwd, -1.5); turnWorld(B.LeftForeArm, fwd, 1.6 + s(t * 6) * 0.15); turnWorld(B.RightForeArm, fwd, -1.6 - s(t * 6) * 0.15); break;
    case 'tpose': for (const a of Object.values(r.act)) a.stop(); r.base = ''; break;
    case 'dab': turnWorld(B.LeftArm, fwd, 2.2); turnWorld(B.RightArm, fwd, -0.6); turnWorld(B.RightForeArm, up, 2); turnWorld(B.Head, right, 0.6); break;
    case 'cry': turnWorld(B.LeftArm, right, -1.9); turnWorld(B.RightArm, right, -1.9); turnWorld(B.LeftForeArm, right, -1.6); turnWorld(B.RightForeArm, right, -1.6); turnWorld(B.Head, right, 0.5 + s(t * 14) * 0.08); break;
    case 'fart': turnWorld(B.Spine, right, 0.6); turnWorld(B.Head, right, -0.4); break;
    case 'worm': turnWorld(B.Hips, right, -1.35 - s(t * 7) * 0.2); break;
    default: break;
  }
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
    case 'beret': add(new THREE.SphereGeometry(0.14, 14, 8), c, 0.02, 0.29, 0, 0, 0, 0.18, 1.12, 0.32, 1.1); break;
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
}
