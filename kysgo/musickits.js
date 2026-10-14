// Music kits: a ~5 s anthem everyone hears when you're the round MVP. Synthesised on the spot (no audio files);
// unlocked by level, picked in Settings. Original tunes.
export const KITS = [
  { id: 'default', name: 'Stock Bangers', lv: 1, bpm: 128, wave: 'square', lead: [72, 0, 76, 79, 0, 76, 79, 84], bass: [48, 48, 55, 55, 52, 52, 55, 55], kick: 0x88 },
  { id: 'toilet', name: 'Porcelain Throne', lv: 2, bpm: 96, wave: 'triangle', lead: [67, 0, 64, 0, 60, 62, 64, 0], bass: [36, 0, 43, 0, 41, 0, 43, 0], kick: 0x99 },
  { id: 'clown', name: 'Honk If You\'re Horny', lv: 4, bpm: 150, wave: 'square', lead: [76, 77, 76, 72, 74, 76, 72, 0], bass: [48, 52, 55, 52, 50, 53, 57, 53], kick: 0xaa },
  { id: 'dirge', name: 'Sad Trombone Supremacy', lv: 6, bpm: 70, wave: 'sawtooth', lead: [67, 66, 65, 0, 64, 0, 0, 0], bass: [43, 0, 42, 0, 41, 0, 40, 0], kick: 0x80 },
  { id: 'eurobeat', name: 'Initial Diarrhea', lv: 9, bpm: 156, wave: 'sawtooth', lead: [69, 72, 76, 72, 77, 76, 72, 69], bass: [45, 57, 45, 57, 41, 53, 43, 55], kick: 0xff },
  { id: 'lofi', name: 'Beats to Get Clapped To', lv: 13, bpm: 80, wave: 'sine', lead: [74, 0, 72, 69, 0, 67, 69, 0], bass: [38, 0, 0, 45, 0, 0, 43, 0], kick: 0x92 },
  { id: 'metal', name: 'Teabag Thrash', lv: 18, bpm: 180, wave: 'sawtooth', lead: [64, 64, 67, 64, 70, 69, 67, 64], bass: [40, 40, 40, 43, 40, 40, 46, 45], kick: 0xff },
  { id: 'anthem', name: 'Main Character Syndrome', lv: 24, bpm: 110, wave: 'square', lead: [72, 76, 79, 84, 83, 79, 76, 79], bass: [48, 48, 53, 53, 55, 55, 52, 52], kick: 0x88 },
];
export const KIT_BY_ID = Object.fromEntries(KITS.map((k) => [k.id, k]));
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// plays a kit through the game's audio bus (two bars of the 8-step pattern)
export function playKit(audio, id, vol = 0.5) {
  const k = KIT_BY_ID[id] || KITS[0], c = audio.ctx(); if (!c) return;
  const out = c.createGain(); out.gain.value = vol; out.connect(audio.bus());
  const step = 60 / k.bpm / 2, t0 = c.currentTime + 0.05;
  const note = (type, f, t, dur, v) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); };
  for (let bar = 0; bar < 2; bar++) for (let s = 0; s < 8; s++) {
    const t = t0 + (bar * 8 + s) * step;
    if (k.lead[s]) note(k.wave, hz(k.lead[s] + (bar ? 0 : 0)), t, step * 0.9, 0.12);
    if (k.bass[s]) note('triangle', hz(k.bass[s]), t, step * 0.95, 0.22);
    if (k.kick & (1 << (7 - s))) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2); }
  }
  setTimeout(() => { try { out.disconnect(); } catch (e) { /* gone */ } }, (16 * step + 1) * 1000);
}
