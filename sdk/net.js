// STUMF BrowserDev multiplayer: peer-to-peer (WebRTC) with free public matchmaking (Nostr relays, or WebTorrent
// trackers as a fallback). No server to pay for, unlimited lobbies: whoever hosts a lobby runs the match in their
// browser; everyone else connects straight to them. If the host leaves, the remaining player with the lowest id
// takes over from the last state. Messages are small and rate-limited by the game (snapshots ~15/s).
import { joinNostr, joinTorrent, selfId } from './p2p.min.js';

const APP = 'stumf-games-v1';
const join = (strategy, room) => (strategy === 'torrent' ? joinTorrent : joinNostr)({ appId: APP }, room);
const code5 = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// the lobby browser: hosts announce their lobbies here every 2 s; entries vanish 8 s after the last announcement
export function lobbyBrowser(gameId, onList, strategy = 'nostr') {
  const room = join(strategy, gameId + '/lobby');
  const ann = room.makeAction('ann');
  const lobbies = new Map();
  ann.onMessage = (a, meta) => { if (a && typeof a.code === 'string' && a.code.length <= 8) { lobbies.set(a.code, { ...a, peer: meta && meta.peerId, t: Date.now() }); emit(); } };
  const emit = () => { const now = Date.now(); for (const [k, v] of lobbies) if (now - v.t > 8000) lobbies.delete(k); onList([...lobbies.values()].sort((a, b) => b.t - a.t)); };
  const iv = setInterval(emit, 2000);
  let mine = null, annIv = 0;
  return {
    announce(info) { mine = info; clearInterval(annIv); const go = () => { if (mine) ann.send(mine); }; go(); annIv = setInterval(go, 2000); room.onPeerJoin = () => go(); },
    update(patch) { if (mine) Object.assign(mine, patch); },
    stopAnnouncing() { mine = null; clearInterval(annIv); },
    close() { clearInterval(iv); clearInterval(annIv); room.leave(); },
  };
}

// one match. host: runs the simulation, receives inputs, broadcasts snapshots. clients: send inputs, apply snapshots.
export function session(gameId, { code, host = false, name = 'Player', strategy = 'nostr' } = {}) {
  code = (code || code5()).toUpperCase();
  const room = join(strategy, gameId + '/' + code);
  const act = room.makeAction('m');
  const send = (data, to) => act.send(data, to ? { target: to } : undefined);
  const handlers = new Map(), names = new Map([[selfId, name]]);
  let hostId = host ? selfId : null;
  const s = {
    code, id: selfId, get isHost() { return hostId === selfId; }, get hostId() { return hostId; },
    peers: () => Object.keys(room.getPeers()),
    names,
    on(type, fn) { handlers.set(type, fn); return s; },
    send(type, data, to) { send({ t: type, d: data }, to); },
    toHost(type, data) { if (hostId && hostId !== selfId) send({ t: type, d: data }, hostId); else fire(type, data, selfId); },
    leave() { room.leave(); },
  };
  const fire = (t, d, peer) => { const h = handlers.get(t); if (h) h(d, peer); };
  act.onMessage = (m, meta) => {
    const peer = meta && meta.peerId;
    if (!m || typeof m.t !== 'string') return;
    if (m.t === '_hello') { if (!hostId || m.d.host) hostId = m.d.host || hostId; names.set(peer, String(m.d.name || 'Player').slice(0, 20)); fire('_roster', null, peer); return; }
    fire(m.t, m.d, peer);
  };
  room.onPeerJoin = (peer) => { send({ t: '_hello', d: { host: s.isHost ? selfId : null, name } }, peer); fire('_join', null, peer); };
  room.onPeerLeave = (peer) => {
    names.delete(peer);
    if (peer === hostId) {  // host migration: everyone picks the same new host
      hostId = [selfId, ...s.peers()].sort()[0];
      fire('_host', hostId, peer);
    }
    fire('_leave', null, peer);
  };
  return s;
}

// snapshot interpolation helper for clients: buffer the host's snapshots and render ~100 ms in the past
export class Interp {
  constructor(delayMs = 100) { this.buf = []; this.delay = delayMs; }
  push(snap) { snap._t = performance.now(); this.buf.push(snap); if (this.buf.length > 30) this.buf.shift(); }
  // returns [a, b, t] so the game can lerp positions between two snapshots
  sample() {
    const t = performance.now() - this.delay, b = this.buf;
    if (!b.length) return null;
    for (let i = b.length - 1; i > 0; i--) if (b[i - 1]._t <= t) return [b[i - 1], b[i], Math.min(1, (t - b[i - 1]._t) / Math.max(1, b[i]._t - b[i - 1]._t))];
    return [b[0], b[0], 0];
  }
}

// the shared lobby screen: play solo, host (public or private) or join (from the list or with a code / invite link)
export function lobbyUI(gameId, title, { maxPlayers = 8, onStart, strategy = 'nostr' }) {
  const css = document.createElement('style');
  css.textContent = `.bd-lobby{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,#1b2433,#07090d);color:#eef;font:15px system-ui}
  .bd-card{width:min(560px,92vw);background:rgba(10,14,20,.85);border:1px solid #2c3a50;border-radius:16px;padding:22px}
  .bd-card h1{margin:0 0 4px;font:900 30px system-ui;letter-spacing:.02em}.bd-card .sub{opacity:.7;margin-bottom:14px}
  .bd-row{display:flex;gap:8px;margin:8px 0;flex-wrap:wrap}.bd-row input{flex:1;min-width:120px;padding:11px;border-radius:10px;border:1px solid #33445c;background:#0b1018;color:#fff;font:15px system-ui}
  .bd-b{padding:11px 16px;border-radius:10px;border:0;background:#2f7cf6;color:#fff;font:700 15px system-ui;cursor:pointer}.bd-b.alt{background:#253246}
  .bd-list{max-height:220px;overflow:auto;margin-top:8px}.bd-l{display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border-radius:10px;background:#111926;margin-top:6px}
  .bd-note{font-size:12px;opacity:.6;margin-top:10px}`;
  document.head.appendChild(css);
  const name0 = localStorage.getItem('bd:name') || 'Player' + Math.floor(Math.random() * 900 + 100);
  const root = document.createElement('div'); root.className = 'bd-lobby';
  root.innerHTML = `<div class="bd-card"><h1></h1><div class="sub">Play solo, host a lobby, or join one.</div>
    <div class="bd-row"><input id="bdName" maxlength="20" placeholder="Your name"></div>
    <div class="bd-row"><button class="bd-b" id="bdSolo">Play solo</button><button class="bd-b alt" id="bdHost">Host public lobby</button><button class="bd-b alt" id="bdPriv">Host private</button></div>
    <div class="bd-row"><input id="bdCode" maxlength="5" placeholder="Invite code"><button class="bd-b alt" id="bdJoin">Join</button></div>
    <div class="bd-list" id="bdList"><div class="bd-note">Looking for open lobbies…</div></div>
    <div class="bd-note">Multiplayer is peer-to-peer: the host's browser runs the match. Free, no account, works on most home connections.</div></div>`;
  root.querySelector('h1').textContent = title;
  document.body.appendChild(root);
  const $ = (id) => root.querySelector('#' + id);
  $('bdName').value = name0;
  const nm = () => { const v = ($('bdName').value || 'Player').slice(0, 20); localStorage.setItem('bd:name', v); return v; };
  const lb = lobbyBrowser(gameId, (list) => {
    const box = $('bdList');
    box.innerHTML = list.length ? '' : '<div class="bd-note">No open lobbies right now: host one!</div>';
    for (const l of list) {
      const row = document.createElement('div'); row.className = 'bd-l';
      row.innerHTML = `<span><b></b> · <span class="n"></span></span><button class="bd-b">Join</button>`;
      row.querySelector('b').textContent = String(l.name || 'Lobby').slice(0, 30);
      row.querySelector('.n').textContent = `${l.players | 0}/${l.max | 0}`;
      row.querySelector('button').onclick = () => start({ code: l.code, host: false });
      box.appendChild(row);
    }
  }, strategy);
  const start = ({ code, host, solo, priv }) => {
    const name = nm();
    root.remove();
    if (solo) { lb.close(); onStart(null, { name, solo: true }); return; }
    const s = session(gameId, { code, host, name, strategy });
    if (host && !priv) { lb.announce({ code: s.code, name: name + "'s lobby", players: 1, max: maxPlayers }); s.on('_roster', () => lb.update({ players: 1 + s.peers().length })); } else lb.close();
    history.replaceState(null, '', '#' + s.code);
    onStart(s, { name, lobby: lb });
  };
  $('bdSolo').onclick = () => start({ solo: true });
  $('bdHost').onclick = () => start({ host: true });
  $('bdPriv').onclick = () => start({ host: true, priv: true });
  $('bdJoin').onclick = () => { const c = $('bdCode').value.trim().toUpperCase(); if (c.length === 5) start({ code: c, host: false }); };
  const hash = location.hash.slice(1).toUpperCase();  // invite link: game/#CODE
  if (/^[A-Z0-9]{5}$/.test(hash)) $('bdCode').value = hash;
}
