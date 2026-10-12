// ---- P2P voice chat ------------------------------------------------------------
// Runs on the SAME WebRTC peer connections as the game data channel (the sdk
// signals them over nostr), so no voice server is needed. Audio is Opus.
//
// Policy, by design:
//   - Voice is OFF until you turn it on (Settings -> Voice chat, or hold PTT).
//   - Strangers are MUTED by default. Friends (account friends list, matched by
//     display name) are heard automatically. Unmute anyone from the scoreboard.
//   - Push-to-talk only: your mic is live only while you hold the key.
//   - Echo cancellation + noise suppression are always requested.

const VC_LS_MUTE = 'kysgo:vc-muted';  // peerIds you explicitly muted
const VC_LS_HEAR = 'kysgo:vc-hear';   // peerIds you explicitly unmuted
const VC_LS_MODE = 'kysgo:vc-mode';   // 'all' | 'friends' | 'none'

const Voice = (() => {
  let sess = null, room = null, O = {};
  let micStream = null, micTrack = null;
  let wanted = false;        // user wants voice on (setting)
  let enabled = false;       // mic permission granted, track live
  let permBusy = false;      // permission modal / getUserMedia in flight
  let talking = false;       // PTT held right now
  let hearMode = 'friends';  // 'all' | 'friends' | 'none'
  let muteSet = new Set();   // explicitly muted peerIds (persisted)
  let hearSet = new Set();   // explicitly unmuted peerIds (persisted)
  let friendNames = new Set();// lowercased friend display names
  let addedTo = new Set();   // peerIds our mic track was added to
  let remotes = new Map();   // peerId -> {el, analyser, data, stream, speaking, level, name}
  let actx = null;           // AudioContext for voice-activity detection
  let vadTimer = 0, micAnalyser = null, micData = null, micLevel = 0;
  let vol = 0.6;
  let prevTrackCb = null, prevJoin = null, prevLeave = null;
  const changeCbs = new Set();
  const emit = () => { for (const cb of changeCbs) try { cb(); } catch (e) { /* ui */ } };

  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const loadSets = () => {
    try { muteSet = new Set(JSON.parse(lsGet(VC_LS_MUTE, '[]'))); } catch (e) { muteSet = new Set(); }
    try { hearSet = new Set(JSON.parse(lsGet(VC_LS_HEAR, '[]'))); } catch (e) { hearSet = new Set(); }
    hearMode = lsGet(VC_LS_MODE, 'friends');
    if (!['all', 'friends', 'none'].includes(hearMode)) hearMode = 'friends';
  };
  const saveSets = () => { lsSet(VC_LS_MUTE, JSON.stringify([...muteSet])); lsSet(VC_LS_HEAR, JSON.stringify([...hearSet])); lsSet(VC_LS_MODE, hearMode); };

  const peerName = (pid) => { try { return (sess && sess.names && sess.names.get(pid)) || 'Player'; } catch (e) { return 'Player'; } };
  const isFriendPeer = (pid) => { const n = String(peerName(pid) || '').toLowerCase().trim(); return !!n && friendNames.has(n); };

  // -- hear policy: strangers muted by default --------------------------------
  function audible(pid) {
    if (muteSet.has(pid)) return false;
    if (hearSet.has(pid)) return true;
    if (hearMode === 'all') return true;
    if (hearMode === 'none') return false;
    return isFriendPeer(pid);   // 'friends': friends auto-heard, strangers muted
  }
  function applyHear(pid) {
    const r = remotes.get(pid); if (!r) return;
    r.el.volume = audible(pid) ? vol : 0;
    r.muted = !audible(pid);
  }
  function applyAllHear() { for (const pid of remotes.keys()) applyHear(pid); emit(); }

  function toggleMute(pid) {
    if (audible(pid)) { muteSet.add(pid); hearSet.delete(pid); }
    else { hearSet.add(pid); muteSet.delete(pid); }
    saveSets(); applyHear(pid); emit();
  }
  function setHearMode(m) {
    if (!['all', 'friends', 'none'].includes(m)) return;
    hearMode = m; saveSets(); applyAllHear();
  }

  // -- voice activity detection -------------------------------------------------
  function ensureCtx() {
    if (actx) return actx;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    actx = new A();
    return actx;
  }
  function rmsOf(analyser, data) {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / data.length);
  }
  function startVad() {
    if (vadTimer) return;
    vadTimer = setInterval(() => {
      let changed = false;
      for (const [pid, r] of remotes) {
        if (!r.analyser) continue;
        const lv = rmsOf(r.analyser, r.data);
        r.level = lv < 0.012 ? r.level * 0.4 + lv * 0.6 : r.level * 0.7 + lv * 0.3;  // fast decay into silence
        const sp = r.level > 0.025 ? true : r.level < 0.012 ? false : r.speaking;  // hysteresis
        if (sp !== r.speaking) { r.speaking = sp; changed = true; }
      }
      if (micAnalyser && micStream) micLevel = micLevel * 0.7 + rmsOf(micAnalyser, micData) * 0.3;
      if (changed) emit();
    }, 140);
  }

  // -- remote peers -------------------------------------------------------------
  function onRemoteTrack(track, stream, peerId) {
    if (!peerId || (sess && peerId === sess.id)) return;
    let r = remotes.get(peerId);
    if (!r) {
      const el = document.createElement('audio');
      el.style.display = 'none';
      el.autoplay = true;
      document.body.appendChild(el);
      r = { el, analyser: null, data: null, stream: null, speaking: false, level: 0, muted: true };
      remotes.set(peerId, r);
    }
    r.stream = stream;
    try { r.el.srcObject = stream; const p = r.el.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not ready */ }
    try {
      const cx = ensureCtx();
      if (cx && !r.analyser) {
        const src = cx.createMediaStreamSource(stream);
        r.analyser = cx.createAnalyser(); r.analyser.fftSize = 512;
        r.data = new Uint8Array(r.analyser.fftSize);
        src.connect(r.analyser);   // analyser only: audio still plays via the <audio> element
        startVad();
      }
    } catch (e) { /* VAD unavailable, audio still plays */ }
    applyHear(peerId);
    emit();
  }
  function onPeerJoin(peerId) { maybeAddTrack(peerId); }
  function onPeerLeave(peerId) {
    addedTo.delete(peerId);
    const r = remotes.get(peerId);
    if (r) { try { r.el.pause(); r.el.srcObject = null; r.el.remove(); } catch (e) {} remotes.delete(peerId); emit(); }
  }

  // -- outgoing mic ---------------------------------------------------------------
  function maybeAddTrack(peerId) {
    if (!enabled || !micTrack || !room || !peerId || (sess && peerId === sess.id) || addedTo.has(peerId)) return;
    try { room.addTrack(micTrack, micStream, { target: peerId }); addedTo.add(peerId); }
    catch (e) { /* peer not ready yet; they get it on rejoin */ }
  }
  function addTrackToAll() {
    if (!room || !sess) return;
    let peers = [];
    try { peers = room.getPeers().map(([pid]) => pid); } catch (e) { return; }
    for (const pid of peers) maybeAddTrack(pid);
  }

  function permissionModal() {
    return new Promise((resolve) => {
      const m = document.createElement('div'); m.className = 'cs cs-modal'; m.style.zIndex = 500;
      m.innerHTML = `<div class="cs-card" style="max-width:440px"><div class="cs-row"><b style="font-size:17px">🎤 Enable voice chat?</b></div>
        <div class="cs-small" style="margin:10px 0;line-height:1.5">KYS:GO will use your <b>microphone</b> so teammates can hear you.
        <br><br>· <b>Push-to-talk</b>: your mic is live <b>only</b> while you hold the talk key.
        <br>· <b>Strangers are muted by default</b> — unmute anyone from the scoreboard (hold Tab).
        <br>· Voice goes <b>directly to players</b> over the game connection. No voice server, nothing recorded.
        <br>· Echo cancellation and noise suppression are on.</div>
        <div class="cs-row" style="margin-top:12px"><button class="cs-btn" data-ok>Enable microphone</button><span style="flex:1"></span><button class="cs-btn alt" data-no>Not now</button></div></div>`;
      document.body.appendChild(m);
      const done = (v) => { m.remove(); resolve(v); };
      m.querySelector('[data-ok]').onclick = () => done(true);
      m.querySelector('[data-no]').onclick = () => done(false);
      m.onclick = (e) => { if (e.target === m) done(false); };
    });
  }

  async function requestMic() {
    if (enabled || permBusy) return enabled;
    permBusy = true;
    try {
      const ok = await permissionModal();
      if (!ok) return false;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { (O.toast || (() => {}))('Voice chat needs a browser with microphone support'); return false; }
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      micTrack = micStream.getAudioTracks()[0] || null;
      if (micTrack) micTrack.enabled = false;   // PTT: live only while held
      try {
        const cx = ensureCtx();
        if (cx) { const src = cx.createMediaStreamSource(micStream); micAnalyser = cx.createAnalyser(); micAnalyser.fftSize = 512; micData = new Uint8Array(512); src.connect(micAnalyser); startVad(); }
      } catch (e) { /* mic meter unavailable */ }
      enabled = true;
      addTrackToAll();
      (O.toast || (() => {}))('🎤 Voice chat on — hold ' + (O.pttLabel || 'your talk key') + ' to talk');
      emit();
      return true;
    } catch (e) {
      const msg = /NotAllowed|denied|Permission/i.test(String((e && e.name) || '') + String((e && e.message) || ''))
        ? 'Microphone blocked — allow it in the address bar (🔒 icon), then try again'
        : 'Could not open the microphone: ' + ((e && e.message) || e);
      (O.toast || (() => {}))(msg);
      return false;
    } finally { permBusy = false; }
  }

  function stopMic() {
    talking = false;
    try {
      if (room && micTrack) for (const pid of [...addedTo]) { try { room.removeTrack(micTrack, { target: pid }); } catch (e) {} }
    } catch (e) {}
    addedTo.clear();
    if (micStream) { try { micStream.getTracks().forEach((t) => t.stop()); } catch (e) {} }
    micStream = null; micTrack = null; micAnalyser = null; micData = null; enabled = false;
    emit();
  }

  // -- public API -------------------------------------------------------------------
  function attach(session, opts = {}) {
    detach();
    loadSets();
    sess = session; O = opts || {};
    if (O.vol != null) vol = O.vol;
    if (!sess || !sess.room) return false;
    room = sess.room;
    // wrap (don't clobber) the sdk handlers
    prevTrackCb = room.onPeerTrack || null;
    room.onPeerTrack = (track, stream, peerId, meta) => { onRemoteTrack(track, stream, peerId); if (prevTrackCb) try { prevTrackCb(track, stream, peerId, meta); } catch (e) {} };
    prevJoin = room.onPeerJoin || null;
    room.onPeerJoin = (peer) => { try { if (prevJoin) prevJoin(peer); } catch (e) {} onPeerJoin(peer); };
    prevLeave = room.onPeerLeave || null;
    room.onPeerLeave = (peer) => { try { if (prevLeave) prevLeave(peer); } catch (e) {} onPeerLeave(peer); };
    if (wanted && enabled) addTrackToAll();
    // account friends -> auto-hear (matched by display name; best effort)
    if (O.getFriends) {
      Promise.resolve().then(() => O.getFriends()).then((list) => {
        const names = new Set();
        for (const f of (Array.isArray(list) ? list : [])) {
          const n = typeof f === 'string' ? f : (f && (f.name || f.handle || f.username || f.display_name));
          if (n) names.add(String(n).toLowerCase().trim());
        }
        friendNames = names;
        applyAllHear();
      }).catch(() => {});
    }
    return true;
  }

  function detach() {
    stopMic();
    for (const [, r] of remotes) { try { r.el.pause(); r.el.srcObject = null; r.el.remove(); } catch (e) {} }
    remotes.clear();
    if (room) {
      try { if (prevTrackCb !== undefined) room.onPeerTrack = prevTrackCb; } catch (e) {}
      try { if (prevJoin !== undefined) room.onPeerJoin = prevJoin; } catch (e) {}
      try { if (prevLeave !== undefined) room.onPeerLeave = prevLeave; } catch (e) {}
    }
    if (vadTimer) { clearInterval(vadTimer); vadTimer = 0; }
    try { if (actx && actx.close) actx.close(); } catch (e) {}
    actx = null; micAnalyser = null;
    sess = null; room = null; friendNames = new Set();
    prevTrackCb = prevJoin = prevLeave = null;
    emit();
  }

  // user toggled voice in settings. fromGesture=true means we may ask for the mic now.
  async function setWanted(on, fromGesture) {
    wanted = !!on;
    if (!wanted) { stopMic(); return false; }
    if (enabled) return true;
    if (fromGesture) return requestMic();
    return false;   // mic will be requested on first PTT press
  }

  function setTalking(held) {
    if (held && wanted && !enabled && !permBusy && sess) requestMic();  // first PTT press asks
    if (!!held === talking) return;
    talking = !!held;
    if (micTrack) micTrack.enabled = talking && enabled;
    emit();
  }

  return {
    attach, detach, setWanted, setTalking, toggleMute, setHearMode,
    onChange(cb) { changeCbs.add(cb); return () => changeCbs.delete(cb); },
    isWanted: () => wanted,
    isEnabled: () => enabled,
    isTalking: () => talking && enabled,
    micLevel: () => micLevel,
    getHearMode: () => hearMode,
    setVol(v) { vol = Math.max(0, Math.min(1, +v || 0)); applyAllHear(); },
    isMuted: (pid) => !audible(pid),
    mutedMap() { const o = {}; for (const pid of remotes.keys()) if (!audible(pid)) o[pid] = 1; return o; },
    speakingMap() { const o = {}; for (const [pid, r] of remotes) if (r.speaking) o[pid] = 1; return o; },
    speakers() {
      const out = [];
      for (const [pid, r] of remotes) if (r.speaking) out.push({ id: pid, name: peerName(pid), muted: !audible(pid) });
      return out;
    },
    // live mic level meter for the settings "test microphone" button
    async micTest(el) {
      const ok = await requestMic();
      if (!ok || !el) return false;
      el.innerHTML = '<div class="cs-small cs-mut">Speak now…</div><div class="cs-bar" style="margin-top:6px"><i style="width:0%"></i></div>';
      const bar = el.querySelector('i');
      const iv = setInterval(() => {
        if (!document.body.contains(el)) { clearInterval(iv); return; }
        if (bar) bar.style.width = Math.round(Math.min(1, micLevel * 4) * 100) + '%';
      }, 100);
      setTimeout(() => { clearInterval(iv); if (document.body.contains(el)) el.innerHTML = '<div class="cs-small cs-mut">Mic ' + (micLevel > 0.005 ? 'is working ✓' : 'seems quiet — check your input device') + '</div>'; }, 6000);
      return true;
    },
  };
})();

export { Voice };
