// Sprays: a tag you leave on the wall you're looking at (N in game, once per round). Unlocked by level; drawn here
// on a canvas, nothing downloaded. Original designs.
const txt = (s, col, bg, font = 'bold 150px Impact, sans-serif', rot = -0.12) => (g) => {
  if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill(); }
  g.save(); g.translate(128, 136); g.rotate(rot); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = '#111'; g.strokeText(s, 0, 0); g.fillStyle = col; g.fillText(s, 0, 0); g.restore();
};
const drip = (g, col) => { g.fillStyle = col; for (let k = 0; k < 7; k++) { const x = 40 + k * 28 + Math.sin(k * 7) * 8, h = 20 + ((k * 37) % 50); g.fillRect(x, 170, 6, h); g.beginPath(); g.arc(x + 3, 170 + h, 5, 0, 7); g.fill(); } };
export const SPRAYS = [
  { id: 'gg', name: 'GG', lv: 1, draw: txt('GG', '#5cff6a') },
  { id: 'ez', name: 'EZ', lv: 1, draw: (g) => { txt('EZ', '#ffd23a')(g); drip(g, '#ffd23a'); } },
  { id: 'l', name: 'Take the L', lv: 1, draw: txt('L', '#ff4a4a', null, 'bold 210px Impact, sans-serif', 0) },
  { id: 'poo', name: 'Fresh Drop', lv: 3, draw: (g) => { g.fillStyle = '#6a3e1e'; for (const [y, r] of [[190, 70], [130, 52], [80, 34]]) { g.beginPath(); g.ellipse(128, y, r, r * 0.6, 0, 0, 7); g.fill(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(108, 130, 12, 0, 7); g.arc(148, 130, 12, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(110, 132, 6, 0, 7); g.arc(150, 132, 6, 0, 7); g.fill(); } },
  { id: 'noob', name: 'NOOB', lv: 5, draw: txt('NOOB', '#4ab0ff', null, 'bold 78px Impact, sans-serif') },
  { id: 'skull', name: 'Dome Collector', lv: 8, draw: (g) => { g.fillStyle = '#eee'; g.beginPath(); g.arc(128, 110, 72, 0, 7); g.fill(); g.fillRect(88, 150, 80, 50); g.fillStyle = '#111'; g.beginPath(); g.arc(100, 110, 20, 0, 7); g.arc(156, 110, 20, 0, 7); g.fill(); g.beginPath(); g.moveTo(128, 130); g.lineTo(118, 150); g.lineTo(138, 150); g.fill(); for (let k = 0; k < 4; k++) g.fillRect(96 + k * 20, 175, 8, 25); } },
  { id: 'nice', name: 'Nice.', lv: 12, draw: (g) => { txt('NICE', '#ff6ad2', '#2a0a2a', 'bold 96px Impact, sans-serif')(g); } },
  { id: 'clown', name: 'Honk Honk', lv: 16, draw: (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 90, 0, 7); g.fill(); g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(128, 136, 22, 0, 7); g.fill(); g.lineWidth = 10; g.strokeStyle = '#ff2a2a'; g.beginPath(); g.arc(128, 150, 50, 0.2, Math.PI - 0.2); g.stroke(); g.fillStyle = '#2a8aff'; g.beginPath(); g.arc(98, 108, 10, 0, 7); g.arc(158, 108, 10, 0, 7); g.fill(); g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(60, 70, 34, 0, 7); g.arc(196, 70, 34, 0, 7); g.fill(); } },
  { id: 'crown', name: 'Ratio King', lv: 20, draw: (g) => { g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(40, 190); g.lineTo(40, 90); g.lineTo(84, 140); g.lineTo(128, 60); g.lineTo(172, 140); g.lineTo(216, 90); g.lineTo(216, 190); g.fill(); g.lineWidth = 8; g.strokeStyle = '#111'; g.stroke(); txt('RATIO', '#111', null, 'bold 40px Impact, sans-serif', 0)(g); } },
  { id: 'cope', name: 'Cope & Seethe', lv: 25, draw: (g) => { txt('COPE', '#ffffff', '#c8301e', 'bold 86px Impact, sans-serif')(g); drip(g, '#c8301e'); } },
];
export const SPRAY_BY_ID = Object.fromEntries(SPRAYS.map((s) => [s.id, s]));
export const sprayCanvas = (id) => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); (SPRAY_BY_ID[id] || SPRAYS[0]).draw(g); return c; };
