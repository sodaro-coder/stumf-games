// Weather and time-of-day variants for any map (host picks; everyone in the lobby gets the same), and the falling
// rain / snow drawn around the camera (one draw call; skipped on Potato).
import * as THREE from '../sdk/three.module.min.js';

export const WEATHER = {
  day: { name: 'Day' },
  dusk: { name: 'Dusk', photo: 'sunset', sky: 0x9a7aa8, fog: 0xd8a888, sunColor: 0xffb070, amb: [0xb8a0c8, 0x6a4a3a], sunDir: [0.85, 0.28, 0.35], sunI: 1.9, ambI: 1.0 },
  night: { name: 'Night', photo: 'night', photoTint: [0.5, 0.6, 1.0], sky: 0x0b1230, fog: 0x141c34, sunColor: 0x9fb4ff, amb: [0x3a4a78, 0x14121a], sunDir: [0.3, 0.75, -0.4], sunI: 1.15, ambI: 1.0, fogNear: 8, fogFar: 70 },
  fog: { name: 'Fog', photo: 'misty', sky: 0xb8c0c8, fog: 0xc4ccd2, sunColor: 0xe0e6ee, amb: [0xd0d8e0, 0x80868c], sunI: 1.1, ambI: 1.5, fogNear: 4, fogFar: 34 },
  rain: { name: 'Rain', photo: 'overcast', sky: 0x7c8692, fog: 0x8c96a0, sunColor: 0xc8d2dc, amb: [0xa8b4c2, 0x50565c], sunI: 1.0, ambI: 1.35, fogNear: 6, fogFar: 55, wet: 4.2, precip: 'rain' },
  snow: { name: 'Snow', photo: 'overcast', sky: 0xc8ccd4, fog: 0xdfe4ea, sunColor: 0xe8eef8, amb: [0xd8e0ec, 0x8a90a0], sunI: 1.25, ambI: 1.5, fogNear: 6, fogFar: 60, precip: 'snow' },
};

// a map builder's lighting, changed to the chosen weather (geometry untouched: occlusion data stays valid)
export function applyWeather(B, key) {
  const w = WEATHER[key];
  if (!w || key === 'day') return B;
  for (const k of ['sky', 'fog', 'sunColor', 'amb', 'sunDir', 'sunI', 'ambI', 'fogNear', 'fogFar', 'photo', 'photoTint', 'wet']) if (w[k] != null) B[k] = w[k];
  B.precip = w.precip || null; B.weather = key;
  return B;
}

// rain streaks / snowflakes in a box that follows the camera
export class Precip {
  constructor(scene, kind, n = 2600) {
    this.kind = kind; this.n = kind === 'snow' ? Math.round(n * 0.7) : n; this.box = 22; this.h = 16;
    const seg = kind === 'rain' ? 2 : 1, pos = new Float32Array(this.n * seg * 3);
    this.p = new Float32Array(this.n * 3); this.v = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) { this.p[i * 3] = (Math.random() - 0.5) * this.box * 2; this.p[i * 3 + 1] = Math.random() * this.h; this.p[i * 3 + 2] = (Math.random() - 0.5) * this.box * 2; this.v[i] = kind === 'rain' ? 13 + Math.random() * 5 : 0.8 + Math.random() * 0.8; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mesh = kind === 'rain'
      ? new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.38, depthWrite: false }))
      : new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.85, depthWrite: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; scene.add(this.mesh); this.t = 0;
  }
  update(cam, dt) {
    const a = this.mesh.geometry.attributes.position.array, c = cam.position, B = this.box, rain = this.kind === 'rain';
    this.t += dt;
    for (let i = 0; i < this.n; i++) {
      const j = i * 3;
      this.p[j + 1] -= this.v[i] * dt;
      if (!rain) { this.p[j] += Math.sin(this.t * 0.9 + i) * 0.3 * dt; this.p[j + 2] += Math.cos(this.t * 0.7 + i * 1.3) * 0.3 * dt; }
      if (this.p[j + 1] < -2) { this.p[j + 1] += this.h; this.p[j] = (Math.random() - 0.5) * B * 2; this.p[j + 2] = (Math.random() - 0.5) * B * 2; }
      const x = c.x + this.p[j], y = c.y - 4 + this.p[j + 1], z = c.z + this.p[j + 2];
      if (rain) { const k = i * 6; a[k] = x; a[k + 1] = y; a[k + 2] = z; a[k + 3] = x + 0.03; a[k + 4] = y + 0.45; a[k + 5] = z; }
      else { a[j] = x; a[j + 1] = y; a[j + 2] = z; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
  dispose() { this.mesh.parent && this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
