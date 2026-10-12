// Match reconnect: when a player drops (crash, network blip, accidental close) the host keeps
// their slot reserved for a few minutes, and the menu offers a one-tap "Rejoin match".
//
// How it works:
//  - every browser gets a stable reconnect token (localStorage, created once)
//  - clients send it in their `hello` so the host can bind it to their match slot
//  - while connected, the client keeps a rejoin record (sessionStorage: room code, name, mode,
//    map, token) so a page reload still knows which match to rejoin
//  - the host, on `_leave` of a real player, stashes their player object instead of forgetting it
//  - a rejoining `hello` with a matching token restores the player (team, K/D, money, loadout)
//    under the new peer id instead of treating them as a fresh joiner
//  - expired slots / unreachable lobbies degrade gracefully to a normal fresh join or a toast

export const REJOIN_KEY = 'cs:rejoin:v1';
export const RTOK_KEY = 'cs:rtok:v1';
export const SLOT_TTL = 180000;   // host reserves a disconnected player's slot: 3 minutes
export const RECORD_TTL = 600000; // menu shows "Rejoin match" for 10 minutes after a disconnect

const rnd = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

// stable per-browser id, so the host recognises a reconnecting player (the P2P peer id is random per page load)
export function playerToken() {
  try {
    let t = localStorage.getItem(RTOK_KEY);
    if (!t || t.length < 8) { t = 'p' + rnd(15); localStorage.setItem(RTOK_KEY, t); }
    return t;
  } catch (e) { return 'p' + rnd(15); }  // private mode: best-effort, won't match after reload
}

export function saveRejoin(rec) {
  try { sessionStorage.setItem(REJOIN_KEY, JSON.stringify({ ...rec, t: Date.now() })); } catch (e) { /* private mode */ }
}

// fresh rejoin record, or null (missing / stale / malformed)
export function loadRejoin() {
  try {
    const r = JSON.parse(sessionStorage.getItem(REJOIN_KEY) || 'null');
    if (!r || typeof r !== 'object' || typeof r.code !== 'string' || r.code.length !== 5) return null;
    if (!r.t || Date.now() - r.t > RECORD_TTL) { clearRejoin(); return null; }
    return r;
  } catch (e) { return null; }
}

export function clearRejoin() {
  try { sessionStorage.removeItem(REJOIN_KEY); } catch (e) { /* private mode */ }
}

// host-side: Map rtok -> { p, until, campInfo, party }. Swept lazily.
export function sweepSlots(slots, now = Date.now()) {
  for (const [k, v] of slots) if (!v || v.until <= now) slots.delete(k);
}

export function sanitizeToken(t) {
  return typeof t === 'string' ? t.replace(/[^A-Za-z0-9]/g, '').slice(0, 32) : '';
}
