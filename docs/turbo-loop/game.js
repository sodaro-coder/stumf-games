// Kit: 3D arcade racer (three.js). A closed track generated from a seed (smooth spline), arcade car physics with
// drift and boost, AI rivals following the racing line, laps, positions and a minimap. Multiplayer: every player
// drives their own car (pose ~15/s, interpolated) on the same track; AI rivals fill the grid.
import * as THREE from '../sdk/three.module.min.js';

export default function start({ cfg, E, N, session, name }) {
  const C = cfg.game, P = cfg.palette, me = session ? session.id : 'solo';
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(P.sky); scene.fog = new THREE.Fog(P.sky, 60, 420);
  const cam = new THREE.PerspectiveCamera(70, 1, 0.5, 900);
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  const gov = E.qualityGovernor((s) => renderer.setPixelRatio(s), { max: 1, min: 0.5 });
  const fps = E.fpsMeter();
  E.touchControls(['fire', 'aim', 'alt']);  // fire = gas, aim = brake, alt = boost
  scene.add(new THREE.HemisphereLight(0xffffff, P.grass, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(100, 200, 50); scene.add(sun);
  const T = (c, o, rep) => { const t = new THREE.CanvasTexture(E.tex.pixel(c, o)); t.magFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  // ---- track: a seeded closed spline ----
  const r = E.rng(cfg.seed || 11), N0 = C.track.points, R0 = C.track.radius, pts = [];
  for (let i = 0; i < N0; i++) { const a = i / N0 * Math.PI * 2, rr = R0 * (0.6 + r() * 0.6); pts.push(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr)); }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const SEG = 600, line = curve.getSpacedPoints(SEG), Wd = C.track.width;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(R0 * 5, R0 * 5), new THREE.MeshLambertMaterial({ map: T(hex(P.grass), { pattern: 'grass', seed: 3 }, [R0 / 3, R0 / 3]) }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  const pos = [], uv = [], idx = [];
  let dist = 0;
  for (let i = 0; i <= SEG; i++) {
    const p = line[i % SEG], n = line[(i + 1) % SEG], t = new THREE.Vector3().subVectors(n, p).normalize(), side = new THREE.Vector3(-t.z, 0, t.x);
    const a = p.clone().addScaledVector(side, Wd / 2), b = p.clone().addScaledVector(side, -Wd / 2);
    pos.push(a.x, 0.01, a.z, b.x, 0.01, b.z); uv.push(0, dist / 6, 1, dist / 6); dist += p.distanceTo(n);
    if (i < SEG) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  const roadTex = T(hex(P.road), { pattern: 'stripes', stripe: P.stripe, seed: 4 });
  scene.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide })));
  const trackLen = dist;
  // scenery: trees and posts (instanced: one draw call each)
  const treeG = new THREE.ConeGeometry(2.2, 6, 6), tree = new THREE.InstancedMesh(treeG, new THREE.MeshLambertMaterial({ color: P.trees }), C.track.trees), mtx = new THREE.Matrix4();
  for (let i = 0; i < C.track.trees; i++) { const p = line[Math.floor(r() * SEG)], off = (Wd / 2 + 6 + r() * 40) * (r() < 0.5 ? -1 : 1), t = new THREE.Vector3().subVectors(line[(line.indexOf(p) + 1) % SEG], p).normalize(); mtx.makeTranslation(p.x - t.z * off, 3, p.z + t.x * off); tree.setMatrixAt(i, mtx); }
  scene.add(tree);
  const nearest = (x, z, hint = 0) => {  // index of the closest centre-line point (local search around a hint)
    let best = hint, bd = 1e18;
    for (let k = -40; k <= 40; k++) { const i = (hint + k + SEG) % SEG, p = line[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return [best, Math.sqrt(bd)];
  };

  // ---- cars ----
  const carMesh = (color) => {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 4), new THREE.MeshLambertMaterial({ color })); body.position.y = 0.55;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.8), new THREE.MeshLambertMaterial({ color: P.glass })); cab.position.set(0, 1.05, -0.2);
    const wg = new THREE.BoxGeometry(0.35, 0.7, 0.7), wm = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const [x, z] of [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]]) { const w = new THREE.Mesh(wg, wm); w.position.set(x, 0.35, z); g.add(w); }
    g.add(body, cab); scene.add(g); return g;
  };
  const start0 = line[0], dir0 = new THREE.Vector3().subVectors(line[1], line[0]).normalize(), yaw0 = Math.atan2(dir0.x, dir0.z);
  const mkCar = (i, color, ai) => { const side = new THREE.Vector3(-dir0.z, 0, dir0.x); const row = Math.floor(i / 2), col = i % 2 ? 1 : -1;
    const p = start0.clone().addScaledVector(dir0, -6 - row * 7).addScaledVector(side, col * Wd / 4);
    return { g: carMesh(color), x: p.x, z: p.z, yaw: yaw0, speed: 0, seg: 0, lap: 0, progress: 0, ai, boost: C.car.boost, skill: 0.85 + Math.random() * 0.15, done: false, finish: 0 }; };
  const self = mkCar(0, P.car, false); self.name = name;
  const rivals = []; for (let i = 0; i < C.race.ai; i++) rivals.push(mkCar(i + 1, P.rivals[i % P.rivals.length], true));
  const others = new Map();

  const drive = (c, throttle, brake, steer, boost, dt) => {
    const K = C.car, [seg, off] = nearest(c.x, c.z, c.seg); const onRoad = off < Wd / 2 + 0.5;
    const max = (onRoad ? K.top : K.top * K.grassSlow) * (boost && c.boost > 0 ? K.boostMult : 1);
    if (boost && c.boost > 0) c.boost = Math.max(0, c.boost - dt); else c.boost = Math.min(K.boost, c.boost + dt * 0.15);
    c.speed += (throttle * K.accel - brake * K.brake) * dt; c.speed -= c.speed * (onRoad ? K.drag : K.drag * 3) * dt;
    c.speed = E.clamp(c.speed, -K.top * 0.3, max);
    const grip = Math.min(1, Math.abs(c.speed) / 12);
    c.yaw -= steer * K.steer * grip * dt * Math.sign(c.speed || 1);
    c.x += Math.sin(c.yaw) * c.speed * dt; c.z += Math.cos(c.yaw) * c.speed * dt;
    // lap counting: progress along the line, wrap at the finish
    const prev = c.seg; c.seg = seg;
    if (prev > SEG * 0.9 && seg < SEG * 0.1) { c.lap++; if (c === self) { E.sfx.play('pickup'); if (c.lap >= C.race.laps && !c.done) { c.done = true; c.finish = raceT; banner(cfg.text.finish.replace('{p}', place()).replace('{t}', raceT.toFixed(1))); session && session.send('fin', [name, raceT]); } } }
    if (prev < SEG * 0.1 && seg > SEG * 0.9) c.lap--;
    c.progress = c.lap * SEG + seg;
  };
  const place = () => 1 + [...rivals, ...others.values()].filter((o) => o.progress > self.progress).length;

  // ---- HUD + minimap ----
  const hud = E.el(`<div style="position:fixed;inset:0;pointer-events:none;color:${P.text};font:800 18px system-ui;text-shadow:0 2px 5px #000;z-index:20">
    <div id="pos" style="position:absolute;right:18px;top:12px;font-size:34px"></div><div id="lap" style="position:absolute;left:18px;top:12px"></div>
    <div id="spd" style="position:absolute;right:18px;bottom:16px;font-size:30px"></div><div id="bst" style="position:absolute;right:18px;bottom:56px;width:150px;height:8px;border-radius:4px;background:#0006"><i style="display:block;height:100%;border-radius:4px;background:${P.boost}"></i></div>
    <div id="mid" style="position:absolute;top:34%;left:0;right:0;text-align:center;font:900 44px system-ui;color:${P.accent};opacity:0;transition:opacity .4s"></div>
    <canvas id="mm" width="160" height="160" style="position:absolute;left:14px;bottom:14px;border-radius:50%;background:#0007"></canvas></div>`);
  const $ = (id) => hud.querySelector('#' + id), mm = $('mm').getContext('2d');
  const banner = (t, ms = 2200) => { const m = $('mid'); m.textContent = t; m.style.opacity = 1; setTimeout(() => (m.style.opacity = 0), ms); };
  const ext = R0 * 1.4;
  const drawMap = () => {
    mm.clearRect(0, 0, 160, 160); mm.strokeStyle = P.road; mm.lineWidth = 5; mm.beginPath();
    line.forEach((p, i) => { const x = 80 + p.x / ext * 75, y = 80 + p.z / ext * 75; i ? mm.lineTo(x, y) : mm.moveTo(x, y); }); mm.closePath(); mm.stroke();
    const dot = (c, col, rr) => { mm.fillStyle = col; mm.beginPath(); mm.arc(80 + c.x / ext * 75, 80 + c.z / ext * 75, rr, 0, 7); mm.fill(); };
    rivals.forEach((c) => dot(c, '#ccc', 3)); others.forEach((c) => dot(c, P.ally, 3.5)); dot(self, P.car, 4.5);
  };

  if (session) {
    session.on('car', (d, peer) => { let o = others.get(peer); if (!o) others.set(peer, (o = { g: carMesh(P.ally), x: d[0], z: d[1], yaw: d[2], tx: d[0], tz: d[1], tyaw: d[2], progress: 0 })); o.tx = d[0]; o.tz = d[1]; o.tyaw = d[2]; o.progress = d[3]; });
    session.on('_leave', (_, peer) => { const o = others.get(peer); if (o) scene.remove(o.g); others.delete(peer); });
    session.on('fin', (d) => banner(`${d[0]}: ${(+d[1]).toFixed(1)} s`, 1600));
  }

  let raceT = -3, netT = 0, beep = 3;
  banner('3', 900);
  E.loop((dt) => {
    raceT += dt;
    if (raceT < 0) { const n = Math.ceil(-raceT); if (n < beep) { beep = n; banner(String(n), 800); E.sfx.play('click'); } return; }
    if (beep > 0) { beep = 0; banner(cfg.text.go, 900); E.sfx.play('pickup'); }
    const m = E.input.move();
    const gas = Math.max(m.y, E.input.button('fire') ? 1 : 0), brk = Math.max(-m.y, E.input.button('aim') ? 1 : 0);
    drive(self, self.done ? 0 : gas, brk, m.x, E.input.button('alt') || E.input.down('Space'), dt);
    for (const c of rivals) {  // AI: aim at a point ahead on the racing line, slow for sharp turns
      const ahead = line[(c.seg + 12) % SEG], want = Math.atan2(ahead.x - c.x, ahead.z - c.z); let d = want - c.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const sharp = Math.abs(d) > 0.35; drive(c, c.done ? 0 : sharp ? 0.55 : c.skill, sharp && c.speed > C.car.top * 0.7 ? 0.4 : 0, E.clamp(-d * 2.2, -1, 1), false, dt);
      if (c.lap >= C.race.laps) c.done = true;
    }
    // car-to-car bumps
    const all = [self, ...rivals];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const a = all[i], b = all[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < 2.4 && d > 0) { const push = (2.4 - d) / 2; a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push; a.speed *= 0.97; b.speed *= 0.97; } }
    for (const o of others.values()) { o.x = E.lerp(o.x, o.tx, 0.3); o.z = E.lerp(o.z, o.tz, 0.3); o.yaw = o.tyaw; }
    netT += dt; if (session && netT > 1 / 15) { netT = 0; session.send('car', [+self.x.toFixed(2), +self.z.toFixed(2), +self.yaw.toFixed(3), self.progress]); }
  }, (_, dt) => {
    gov(dt); fps(dt);
    for (const c of [self, ...rivals, ...others.values()]) { c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.yaw; }
    const back = 9 + Math.abs(self.speed) * 0.06;
    cam.position.lerp(new THREE.Vector3(self.x - Math.sin(self.yaw) * back, 4 + Math.abs(self.speed) * 0.02, self.z - Math.cos(self.yaw) * back), 0.15);
    cam.lookAt(self.x + Math.sin(self.yaw) * 6, 1, self.z + Math.cos(self.yaw) * 6);
    cam.fov = 70 + Math.abs(self.speed) * 0.25; cam.updateProjectionMatrix();
    $('pos').textContent = `${place()}/${1 + rivals.length + others.size}`;
    $('lap').textContent = `${cfg.text.lap} ${Math.min(C.race.laps, Math.max(1, self.lap + 1))}/${C.race.laps} · ${Math.max(0, raceT).toFixed(1)} s` + (session ? ` · code ${session.code}` : '');
    $('spd').textContent = `${Math.round(Math.abs(self.speed) * 3.6)} km/h`;
    $('bst').firstChild.style.width = (self.boost / C.car.boost * 100) + '%';
    drawMap();
    renderer.render(scene, cam);
  });
}
