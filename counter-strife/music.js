// Story score, synthesised live (no audio files): a few moods the campaign switches between. Each mood is a loop of
// drums, bass and chords scheduled a little ahead of time on the Web Audio clock; switching crossfades. '' is silence,
// which the story uses on purpose for its worst moments.
//   heartbeat  a slow, muffled double thump (dying)
//   pulse      a low kick and a sub drone that waits (Wiener getting up)
//   action     driving kick, snare and a distorted bass ostinato (the killing spree, the ambush)
//   ricky      a lazy boom-bap beat with electric-piano chords (the walk)
//   tender     slow pad chords, no drums
//   dread      a low drone, a dissonant high whine, a far-off toll (the Reaper, the blizzard)
//   defiant    the tender chords over a steady kick: not triumph, just still standing
//   dad        an unsteady lurching bass, out of step (the father)
const MOODS = {
  heartbeat: { bpm: 52, steps: 4, kick: [1, 0, 0.6, 0], sub: 41, subVol: 0.15 },
  pulse: { bpm: 70, steps: 8, kick: [1, 0, 0, 0, 0.7, 0, 0, 0], sub: 41, subVol: 0.22, bass: [41, 0, 0, 0, 41, 0, 0, 0] },
  action: { bpm: 138, steps: 16, kick: [1, 0, 0, 0, 1, 0, 0, 0.5, 1, 0, 0, 0, 1, 0, 0.6, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.4], hat: 0.3, bass: [41, 41, 0, 41, 44, 0, 41, 0, 39, 39, 0, 39, 46, 0, 44, 0], dist: true },
  ricky: { bpm: 84, steps: 16, kick: [1, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 1, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: 0.18, swing: 0.12, chords: [[60, 63, 67, 70], [58, 62, 65, 68]], chordEvery: 16, keys: true },
  tender: { bpm: 60, steps: 8, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 60]], chordEvery: 8, pad: true },
  dread: { bpm: 40, steps: 8, drone: [33, 34], whine: 0.04, toll: [1, 0, 0, 0, 0, 0, 0, 0] },
  defiant: { bpm: 72, steps: 8, kick: [1, 0, 0, 0, 1, 0, 0, 0], chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], chordEvery: 8, pad: true },
  dad: { bpm: 96, steps: 12, kick: [1, 0, 0, 0, 0.8, 0, 0, 0, 0, 1, 0, 0], bass: [36, 0, 0, 37, 0, 0, 36, 0, 0, 34, 0, 0], drunk: 0.05 },
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function makeMusic(audio) {
  let cur = '', bus = null, next = 0, step = 0, timer = 0, chord = 0;
  const ctx = () => audio.ctx && audio.ctx();
  function stopBus(b) { if (!b) return; const c = ctx(); try { b.gain.cancelScheduledValues(c.currentTime); b.gain.setTargetAtTime(0, c.currentTime, 0.6); setTimeout(() => { try { b.disconnect(); } catch (e) { /* gone */ } }, 3000); } catch (e) { /* closed */ } }
  function voice(c, out, type, f, t, dur, vol, attack = 0.005) {
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function noise(c, out, t, dur, vol, freq, type) {
    const len = Math.ceil(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t);
  }
  function tick() {
    const c = ctx(); if (!c || !cur || !bus) return;
    const M = MOODS[cur], spb = 60 / M.bpm / 4;   // seconds per 16th
    while (next < c.currentTime + 0.25) {
      const i = step % M.steps, t = next + (M.swing && i % 2 ? spb * M.swing : 0) + (M.drunk ? (Math.random() - 0.5) * M.drunk : 0);
      if (M.kick && M.kick[i]) { const o = voice(c, bus, 'sine', 120, t, 0.32, 0.55 * M.kick[i]); o.frequency.exponentialRampToValueAtTime(cur === 'heartbeat' ? 38 : 44, t + 0.18); }
      if (M.snare && M.snare[i]) { noise(c, bus, t, 0.16, 0.22 * M.snare[i], 1800, 'bandpass'); voice(c, bus, 'triangle', 190, t, 0.1, 0.1); }
      if (M.hat && i % 2 === 0) noise(c, bus, t, 0.04, M.hat * 0.3, 8000, 'highpass');
      if (M.bass && M.bass[i]) { const o = voice(c, bus, M.dist ? 'sawtooth' : 'triangle', hz(M.bass[i]), t, spb * 1.8, M.dist ? 0.1 : 0.16); void o; }
      if (M.sub && i === 0) voice(c, bus, 'sine', hz(M.sub), t, spb * M.steps * 0.95, M.subVol, 0.4);
      if (M.chords && i % M.chordEvery === 0) { const ch = M.chords[chord++ % M.chords.length], len = spb * M.chordEvery * 1.05; for (const n of ch) voice(c, bus, M.keys ? 'sine' : 'triangle', hz(n), t, len, M.keys ? 0.05 : 0.04, M.pad ? 0.8 : 0.01); }
      if (M.drone && i === 0) for (const n of M.drone) voice(c, bus, 'sawtooth', hz(n), t, spb * M.steps * 1.02, 0.035, 1.2);
      if (M.whine && i === 0) voice(c, bus, 'sine', hz(88) * (1 + Math.random() * 0.01), t, spb * M.steps, M.whine, 2);
      if (M.toll && M.toll[i]) { voice(c, bus, 'sine', hz(45), t, 4, 0.12, 0.01); voice(c, bus, 'sine', hz(57.3), t, 3, 0.05, 0.01); }
      next += spb; step++;
    }
  }
  return {
    get mood() { return cur; },
    set(mood) {
      mood = MOODS[mood] ? mood : '';
      if (mood === cur) return;
      const c = ctx(); stopBus(bus); bus = null; cur = mood;
      if (!mood || !c) return;
      bus = c.createGain(); bus.gain.value = 0.0001; bus.connect(audio.bus()); bus.gain.setTargetAtTime(0.55, c.currentTime, 0.8);
      next = c.currentTime + 0.05; step = 0; chord = 0;
      if (!timer) timer = setInterval(tick, 90);
    },
    stop() { stopBus(bus); bus = null; cur = ''; if (timer) { clearInterval(timer); timer = 0; } },
  };
}
