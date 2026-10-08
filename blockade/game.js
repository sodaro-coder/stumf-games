// Kit: 3D first-person wave shooter (three.js). Procedural arena (pixel textures from the palette), pooled enemies
// that chase the nearest player, hitscan weapons with recoil and muzzle flash, waves, health pickups, co-op.
// Host-authoritative enemies; each player moves their own body (sent ~15/s) and reports hits to the host.
import * as THREE from '../sdk/three.module.min.js';

export default function start({ cfg, E, N, session, name }) {
  const C = cfg.game, P = cfg.palette, me = session ? session.id : 'solo', isHost = () => !session || session.isHost;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(P.sky); scene.fog = new THREE.Fog(P.sky, 20, C.arena.size * 0.9);
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 400); scene.add(cam);
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  const gov = E.qualityGovernor((s) => renderer.setPixelRatio(s), { max: 1, min: 0.5 });
  const fps = E.fpsMeter();
  E.touchControls(['fire', 'jump', 'reload', 'alt']);
  scene.add(new THREE.HemisphereLight(P.skyLight, P.ground, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(30, 60, 20); scene.add(sun);
  const T = (c, o) => { const t = new THREE.CanvasTexture(E.tex.pixel(c, o)); t.magFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  // ---- arena: floor, walls, cover blocks (one merged box list; AABB collisions) ----
  const S = C.arena.size, rnd = E.rng(cfg.seed || 3), boxes = [];
  const floorTex = T(hex(P.ground), { pattern: C.arena.floorPattern || 'planks', seed: 2 }); floorTex.repeat.set(S / 4, S / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshLambertMaterial({ map: floorTex })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wallMat = new THREE.MeshLambertMaterial({ map: T(hex(P.wall), { pattern: C.arena.wallPattern || 'bricks', seed: 4 }) });
  const addBox = (x, z, w, d, h, mat) => {
    const geo = new THREE.BoxGeometry(w, h, d); const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / 2, uv.getY(i) * h / 2);  // world-scale pixels
    const m = new THREE.Mesh(geo, mat); m.position.set(x, h / 2, z); scene.add(m); boxes.push({ x: x - w / 2, z: z - d / 2, w, d, h });
  };
  [[0, -S / 2, S, 1], [0, S / 2, S, 1], [-S / 2, 0, 1, S], [S / 2, 0, 1, S]].forEach(([x, z, w, d]) => addBox(x, z, w, d, 6, wallMat));
  const coverMat = new THREE.MeshLambertMaterial({ map: T(hex(P.cover), { pattern: 'planks', seed: 9 }) });
  for (let i = 0; i < C.arena.cover; i++) { const w = 2 + rnd() * 6, d = 2 + rnd() * 6, x = (rnd() - 0.5) * (S - 16), z = (rnd() - 0.5) * (S - 16); if (Math.hypot(x, z) > 8) addBox(x, z, w, d, 1.5 + rnd() * 3, coverMat); }
  const blocked = (x, z, r, y = 0) => boxes.some((b) => x + r > b.x && x - r < b.x + b.w && z + r > b.z && z - r < b.z + b.d && y < b.h);
  const rayBox = (o, d, b, maxT) => {  // slab test against an axis-aligned box
    let t0 = 0, t1 = maxT;
    for (const [oo, dd, lo, hi] of [[o.x, d.x, b.x0, b.x1], [o.y, d.y, b.y0, b.y1], [o.z, d.z, b.z0, b.z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return -1; continue; }
      let a = (lo - oo) / dd, c = (hi - oo) / dd; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return -1;
    }
    return t0;
  };

  // ---- enemies: blocky creatures, pooled meshes ----
  const enemyGeo = { body: new THREE.BoxGeometry(0.9, 1.2, 0.6), head: new THREE.BoxGeometry(0.6, 0.6, 0.6), eye: new THREE.BoxGeometry(0.4, 0.1, 0.05) };
  const mats = C.enemies.map((t) => new THREE.MeshLambertMaterial({ color: t.color }));
  const eyeMat = new THREE.MeshBasicMaterial({ color: P.eyes });
  const mkEnemy = () => { const g = new THREE.Group(); const b = new THREE.Mesh(enemyGeo.body, mats[0]); b.position.y = 1.0; const h = new THREE.Mesh(enemyGeo.head, mats[0]); h.position.y = 1.9; const e = new THREE.Mesh(enemyGeo.eye, eyeMat); e.position.set(0, 1.95, -0.31); g.add(b, h, e); g.visible = false; scene.add(g); return { g, b, h, x: 0, z: 0, hp: 0, type: 0, cd: 0, id: 0, scale: 1 }; };
  const enemies = new E.Pool(mkEnemy, 40);
  let enemyId = 0;

  // ---- players ----
  const others = new Map();  // id -> {g, x, z, yaw, name, tx, tz}
  const mkAvatar = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.5), new THREE.MeshLambertMaterial({ color: P.ally })); b.position.y = 0.8; const h = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), new THREE.MeshLambertMaterial({ color: P.allyHead })); h.position.y = 1.9; g.add(b, h); scene.add(g); return g; };
  const self = { x: 0, z: 0, y: 0, vy: 0, yaw: 0, pitch: 0, hp: C.player.hp, dead: 0, score: 0, weapon: 0, ammo: C.weapons.map((w) => w.mag), reserve: C.weapons.map((w) => w.reserve), cd: 0, reload: 0, recoil: 0 };
  const sim = { wave: 0, left: 0, spawnT: 0, hp: new Map() };  // host: wave state; hp per player id

  // ---- weapon view model ----
  const gun = new THREE.Group(); const gunMat = new THREE.MeshLambertMaterial({ color: P.gun });
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.8), gunMat); const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.12), gunMat); grip.position.set(0, -0.15, 0.2);
  const flash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: 0xffd27a })); flash.position.z = -0.5; flash.visible = false;
  gun.add(barrel, grip, flash); gun.position.set(0.32, -0.3, -0.6); cam.add(gun);
  const flashLight = new THREE.PointLight(0xffc070, 0, 8); cam.add(flashLight);

  // ---- HUD ----
  const hud = E.el(`<div style="position:fixed;inset:0;pointer-events:none;color:${P.text};font:700 16px system-ui;text-shadow:0 2px 4px #000;z-index:20">
    <div id="xh" style="position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px;border:2px solid ${P.text};border-radius:50%;opacity:.8"></div>
    <div id="hm" style="position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px;border:3px solid ${P.accent};transform:rotate(45deg);opacity:0"></div>
    <div id="tl" style="position:absolute;left:16px;bottom:16px;font-size:20px"></div><div id="tr" style="position:absolute;right:16px;bottom:16px;text-align:right;font-size:22px"></div>
    <div id="tc" style="position:absolute;top:12px;left:0;right:0;text-align:center"></div>
    <div id="dmg" style="position:absolute;inset:0;background:radial-gradient(transparent 50%, ${P.accent});opacity:0"></div>
    <div id="mid" style="position:absolute;top:36%;left:0;right:0;text-align:center;font:900 42px system-ui;color:${P.accent};opacity:0;transition:opacity .4s"></div>
    <div id="click" style="position:absolute;top:60%;left:0;right:0;text-align:center;font-size:15px;opacity:.85">Click to play · WASD move · mouse aim · click fire · R reload · 1-${C.weapons.length} / Q switch · Space jump</div></div>`);
  const $ = (id) => hud.querySelector('#' + id);
  const banner = (t) => { const m = $('mid'); m.textContent = t; m.style.opacity = 1; setTimeout(() => (m.style.opacity = 0), 1800); };
  renderer.domElement.addEventListener('click', () => { E.input.lock(renderer.domElement); $('click').style.display = 'none'; });
  if (E.input.touch.active) $('click').style.display = 'none';

  // ---- host: waves + enemy AI ----
  const players = () => { const out = [{ id: me, x: self.x, z: self.z, dead: self.dead > 0 }]; for (const [id, o] of others) out.push({ id, x: o.tx, z: o.tz, dead: o.dead }); return out; };
  const nextWave = () => { sim.wave++; sim.left = Math.round((C.waves.start + C.waves.growth * (sim.wave - 1)) * (1 + 0.5 * others.size)); send('wave', sim.wave); onWave(sim.wave); };
  const onWave = (n) => banner(cfg.text.wave.replace('{n}', n));
  const spawn = () => {
    const unlocked = C.enemies.map((t, i) => [t, i]).filter(([t]) => (t.from || 1) <= sim.wave); const [t, ti] = unlocked[Math.floor(Math.random() * unlocked.length)];
    const e = enemies.get(); const a = Math.random() * Math.PI * 2, r = S / 2 - 3;
    e.x = Math.cos(a) * r; e.z = Math.sin(a) * r; e.type = ti; e.hp = t.hp * (1 + C.waves.hpGrowth * (sim.wave - 1)); e.cd = 0; e.id = ++enemyId; e.scale = t.scale || 1;
  };
  const hostStep = (dt) => {
    if (!sim.wave) nextWave();
    sim.spawnT -= dt;
    if (sim.left > 0 && sim.spawnT <= 0 && enemies.live.length < C.waves.maxAlive) { spawn(); sim.left--; sim.spawnT = Math.max(0.25, C.waves.spawnGap * Math.pow(0.94, sim.wave)); }
    if (sim.left === 0 && !enemies.live.some((e) => e.alive)) nextWave();
    const ps = players().filter((p) => !p.dead);
    enemies.each((e) => {
      const t = C.enemies[e.type]; let best = null, bd = 1e9;
      for (const p of ps) { const d = (p.x - e.x) ** 2 + (p.z - e.z) ** 2; if (d < bd) { bd = d; best = p; } }
      if (!best) return;
      const d = Math.sqrt(bd) || 1, ux = (best.x - e.x) / d, uz = (best.z - e.z) / d, sp = t.speed * dt;
      if (!blocked(e.x + ux * sp, e.z, 0.4)) e.x += ux * sp; else e.z += Math.sign(uz || 1) * sp;
      if (!blocked(e.x, e.z + uz * sp, 0.4)) e.z += uz * sp; else e.x += Math.sign(ux || 1) * sp;
      e.cd -= dt;
      if (d < 1.4 * e.scale && e.cd <= 0) { e.cd = 1; if (best.id === me) hurt(t.damage); else session && session.send('hurt', t.damage, best.id); }
    });
    enemies.sweep((e) => (e.g.visible = false));
  };
  const killEnemy = (id, by) => {
    const e = enemies.live.find((x) => x.alive && x.id === id); if (!e) return;
    enemies.release(e); e.g.visible = false;
    if (Math.random() < C.pickupChance) send('pickup', [e.x, e.z]), spawnPickup(e.x, e.z);
    send('kill', [id, by]); credit(by, C.enemies[e.type].score);
  };
  const credit = (by, pts) => { if (by === me) self.score += pts; else session && session.send('score', pts, by); };
  const damageEnemy = (id, dmg, by) => {
    const e = enemies.live.find((x) => x.alive && x.id === id); if (!e) return;
    e.hp -= dmg; if (e.hp <= 0) killEnemy(id, by);
  };

  // ---- pickups (health) ----
  const pickups = [];
  const pickGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5), pickMat = new THREE.MeshBasicMaterial({ color: P.good });
  const spawnPickup = (x, z) => { const m = new THREE.Mesh(pickGeo, pickMat); m.position.set(x, 0.6, z); scene.add(m); pickups.push({ m, t: 15 }); };

  // ---- self ----
  const hurt = (n) => { if (self.dead > 0) return; self.hp -= n; E.sfx.play('hurt'); $('dmg').style.opacity = 0.7; setTimeout(() => ($('dmg').style.opacity = 0), 160); if (self.hp <= 0) { self.dead = C.player.respawn; banner(cfg.text.down); } };
  const fire = () => {
    const w = C.weapons[self.weapon];
    if (self.cd > 0 || self.reload > 0 || self.dead > 0) return;
    if (self.ammo[self.weapon] <= 0) { reload(); return; }
    self.ammo[self.weapon]--; self.cd = 60 / w.rpm; self.recoil = Math.min(self.recoil + w.recoil, 0.25);
    E.sfx.play(w.heavy ? 'heavy' : 'shot'); flash.visible = true; flashLight.intensity = 3; setTimeout(() => { flash.visible = false; flashLight.intensity = 0; }, 40);
    const o = cam.getWorldPosition(new THREE.Vector3());
    for (let p = 0; p < (w.pellets || 1); p++) {
      const d = new THREE.Vector3((Math.random() - 0.5) * w.spread, (Math.random() - 0.5) * w.spread, -1).applyQuaternion(cam.quaternion).normalize();
      let wallT = w.range; for (const b of boxes) { const t = rayBox(o, d, { x0: b.x, x1: b.x + b.w, y0: 0, y1: b.h, z0: b.z, z1: b.z + b.d }, w.range); if (t >= 0 && t < wallT) wallT = t; }
      let best = null, bt = wallT, head = false;
      enemies.each((e) => {
        const s = e.scale, tb = rayBox(o, d, { x0: e.x - 0.45 * s, x1: e.x + 0.45 * s, y0: 0, y1: 1.6 * s, z0: e.z - 0.35 * s, z1: e.z + 0.35 * s }, bt);
        const th = rayBox(o, d, { x0: e.x - 0.3 * s, x1: e.x + 0.3 * s, y0: 1.6 * s, y1: 2.2 * s, z0: e.z - 0.3 * s, z1: e.z + 0.3 * s }, bt);
        if (th >= 0 && th < bt) { bt = th; best = e; head = true; } else if (tb >= 0 && tb < bt) { bt = tb; best = e; head = false; }
      });
      if (best) {
        const dmg = w.damage * (head ? w.headMult : 1); E.sfx.play('hit'); const hm = $('hm'); hm.style.opacity = 1; setTimeout(() => (hm.style.opacity = 0), 90);
        if (isHost()) damageEnemy(best.id, dmg, me); else session.toHost('hit', [best.id, dmg]);
      }
    }
  };
  const reload = () => { const w = C.weapons[self.weapon]; if (self.reload > 0 || self.ammo[self.weapon] >= w.mag || self.reserve[self.weapon] <= 0) return; self.reload = w.reload; };

  // ---- networking ----
  const send = (t, d, to) => session && session.send(t, d, to);
  if (session) {
    session.on('pose', (d, peer) => { let o = others.get(peer); if (!o) others.set(peer, (o = { g: mkAvatar(), x: d[0], z: d[1], tx: d[0], tz: d[1], yaw: 0, dead: false })); o.tx = d[0]; o.tz = d[1]; o.yaw = d[2]; o.dead = !!d[3]; o.g.visible = !o.dead; });
    session.on('_leave', (_, peer) => { const o = others.get(peer); if (o) scene.remove(o.g); others.delete(peer); });
    session.on('hit', (d, peer) => { if (isHost() && Array.isArray(d)) damageEnemy(d[0] | 0, Math.min(+d[1] || 0, 5000), peer); });
    session.on('hurt', (n) => hurt(+n || 0));
    session.on('score', (n) => (self.score += +n || 0));
    session.on('wave', (n) => { sim.wave = n | 0; onWave(sim.wave); });
    session.on('kill', (d) => { const e = enemies.live.find((x) => x.alive && x.id === d[0]); if (e && !isHost()) { enemies.release(e); e.g.visible = false; } });
    session.on('pickup', (d) => spawnPickup(d[0], d[1]));
    session.on('en', (list) => {  // host's enemy positions (clients only)
      if (isHost()) return;
      const seen = new Set();
      for (const [id, x, z, type] of list) {
        seen.add(id); let e = enemies.live.find((q) => q.alive && q.id === id);
        if (!e) { e = enemies.get(); e.id = id; e.x = x; e.z = z; e.type = type; e.scale = C.enemies[type].scale || 1; }
        e.tx = x; e.tz = z;
      }
      enemies.each((e) => { if (!seen.has(e.id)) { enemies.release(e); e.g.visible = false; } });
      enemies.sweep((e) => (e.g.visible = false));
    });
  }

  // ---- loop ----
  let netT = 0, bob = 0;
  E.loop((dt) => {
    const lk = E.input.look(); self.yaw -= lk.dx * 0.0022; self.pitch = E.clamp(self.pitch - lk.dy * 0.0022, -1.45, 1.45);
    if (self.dead > 0) { self.dead -= dt; if (self.dead <= 0) { self.hp = C.player.hp; self.x = self.z = 0; } }
    else {
      const m = E.input.move(), sp = C.player.speed * (E.input.button('alt') ? 1.4 : 1) * dt;
      const fx = -Math.sin(self.yaw), fz = -Math.cos(self.yaw), rx = Math.cos(self.yaw), rz = -Math.sin(self.yaw);
      const dx = (fx * m.y + rx * m.x) * sp, dz = (fz * m.y + rz * m.x) * sp;
      if (!blocked(self.x + dx, self.z, 0.4, self.y + 0.1)) self.x += dx; if (!blocked(self.x, self.z + dz, 0.4, self.y + 0.1)) self.z += dz;
      if (E.input.tapped('jump') && self.y <= 0.001) { self.vy = 6.5; E.sfx.play('jump'); }
      self.vy -= 18 * dt; self.y = Math.max(0, self.y + self.vy * dt); if (self.y === 0) self.vy = 0;
      bob += (Math.abs(m.x) + Math.abs(m.y)) * dt * 10;
      for (let k = 0; k < C.weapons.length; k++) if (E.input.pressed('Digit' + (k + 1))) { self.weapon = k; self.reload = 0; }
      if (E.input.tapped('alt') && E.input.touch.active || E.input.pressed('KeyQ') || E.input.mouse.wheel) { self.weapon = (self.weapon + 1) % C.weapons.length; self.reload = 0; }
      if (E.input.tapped('reload')) reload();
      const w = C.weapons[self.weapon];
      if (E.input.button('fire') && (w.auto || E.input.tapped('fire') || E.input.touch.buttons.has('fire'))) fire();
    }
    self.cd -= dt; self.recoil = Math.max(0, self.recoil - dt * 1.5);
    if (self.reload > 0) { self.reload -= dt; if (self.reload <= 0) { const w = C.weapons[self.weapon], take = Math.min(w.mag - self.ammo[self.weapon], self.reserve[self.weapon]); self.ammo[self.weapon] += take; self.reserve[self.weapon] -= take; } }
    for (let i = pickups.length - 1; i >= 0; i--) { const p = pickups[i]; p.t -= dt; p.m.rotation.y += dt * 2; if ((p.m.position.x - self.x) ** 2 + (p.m.position.z - self.z) ** 2 < 1.2) { self.hp = Math.min(C.player.hp, self.hp + 35); E.sfx.play('pickup'); p.t = 0; } if (p.t <= 0) { scene.remove(p.m); pickups.splice(i, 1); } }
    if (isHost()) hostStep(dt); else enemies.each((e) => { if (e.tx !== undefined) { e.x = E.lerp(e.x, e.tx, 0.25); e.z = E.lerp(e.z, e.tz, 0.25); } });
    for (const o of others.values()) { o.x = E.lerp(o.x, o.tx, 0.25); o.z = E.lerp(o.z, o.tz, 0.25); o.g.position.set(o.x, 0, o.z); o.g.rotation.y = o.yaw; }
    netT += dt;
    if (session && netT > 1 / 15) {
      netT = 0; session.send('pose', [+self.x.toFixed(2), +self.z.toFixed(2), +self.yaw.toFixed(2), self.dead > 0 ? 1 : 0]);
      if (isHost()) session.send('en', enemies.live.filter((e) => e.alive).map((e) => [e.id, +e.x.toFixed(2), +e.z.toFixed(2), e.type]));
    }
  }, (_, dt) => {
    gov(dt); fps(dt);
    cam.position.set(self.x, 1.65 + self.y + Math.sin(bob) * 0.04, self.z);
    cam.rotation.set(self.pitch + self.recoil, self.yaw, 0, 'YXZ');
    gun.position.set(0.32, -0.3 + Math.sin(bob * 2) * 0.01 - (self.reload > 0 ? 0.25 : 0), -0.6 + self.recoil * 0.6);
    enemies.each((e) => { const t = C.enemies[e.type]; e.g.visible = true; e.g.position.set(e.x, 0, e.z); e.g.scale.setScalar(e.scale); e.b.material = e.h.material = mats[e.type]; e.g.rotation.y = Math.atan2(self.x - e.x, self.z - e.z) + Math.PI; e.b.position.y = 1.0 + Math.abs(Math.sin(performance.now() / 160 + e.id)) * 0.08 * t.speed / 3; });
    const w = C.weapons[self.weapon];
    $('tl').textContent = `❤ ${Math.max(0, Math.round(self.hp))}   ${self.score} pts`;
    $('tr').textContent = `${w.name}  ${self.ammo[self.weapon]} / ${self.reserve[self.weapon]}${self.reload > 0 ? '  ' + cfg.text.reloading : ''}`;
    $('tc').textContent = `${cfg.text.wave.replace('{n}', sim.wave)}` + (session ? ` · ${1 + others.size} players · code ${session.code}` : '');
    renderer.render(scene, cam);
  });
}
