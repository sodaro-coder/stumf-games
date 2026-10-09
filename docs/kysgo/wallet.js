// The in-game Solana wallet: where a player's item NFTs live. Created on the player's own device with the browser's
// built-in Ed25519 (no key ever leaves the device unencrypted): the secret is locked with a PIN the player picks
// (PBKDF2-SHA256, 310k rounds, AES-GCM) and only that encrypted blob is stored with their account, so it follows
// them to other devices and nobody, the game included, can use it without the PIN.
// It can show the address, list the player's KYS:GO NFTs, send them to another wallet (compressed NFTs: a Bubblegum
// transfer with the Merkle proof from the RPC's asset API), and export the key in the format Phantom / Jupiter /
// Solflare import (base58 of the 64-byte secret key).
// Network: cfg.solRpc must be an RPC URL that supports the DAS asset API (e.g. a free Helius key). No RPC: the wallet
// still works for creating, unlocking and exporting.

// ---- base58 (Bitcoin alphabet, as Solana uses) --------------------------------------------------------------------------
const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58enc(bytes) {
  let n = 0n; for (const b of bytes) n = n * 256n + BigInt(b);
  let s = ''; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b) break; s = '1' + s; }
  return s;
}
export function b58dec(str) {
  let n = 0n; for (const c of str) { const i = A.indexOf(c); if (i < 0) throw new Error('not base58'); n = n * 58n + BigInt(i); }
  const out = []; while (n > 0n) { out.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of str) { if (c !== '1') break; out.unshift(0); }
  return Uint8Array.from(out);
}
const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };
const sha256 = async (b) => new Uint8Array(await crypto.subtle.digest('SHA-256', b));
const u64 = (v) => { const o = new Uint8Array(8); let n = BigInt(v); for (let i = 0; i < 8; i++) { o[i] = Number(n & 255n); n >>= 8n; } return o; };
const u32 = (v) => { const o = new Uint8Array(4); new DataView(o.buffer).setUint32(0, v >>> 0, true); return o; };
const shortvec = (n) => { const o = []; for (;;) { let b = n & 0x7f; n >>= 7; if (n) { o.push(b | 0x80); } else { o.push(b); break; } } return Uint8Array.from(o); };

// ---- program addresses (PDA): sha256(seeds, bump, program, "ProgramDerivedAddress") that is NOT on the ed25519 curve --
const P = 2n ** 255n - 19n, Dc = (-121665n * inv(121666n)) % P;
function mpow(b, e) { let r = 1n; b %= P; if (b < 0n) b += P; while (e > 0n) { if (e & 1n) r = (r * b) % P; b = (b * b) % P; e >>= 1n; } return r; }
function inv(x) { return mpow(((x % P) + P) % P, P - 2n); }
export function onCurve(bytes) {
  const b = Uint8Array.from(bytes); b[31] &= 0x7f;
  let y = 0n; for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(b[i]);
  if (y >= P) return false;
  const y2 = (y * y) % P, u = (y2 - 1n + P) % P, v = (((Dc + P) % P) * y2 + 1n) % P;
  const x2 = (u * inv(v)) % P;
  return x2 === 0n || mpow(x2, (P - 1n) / 2n) === 1n;   // a square root exists: a point on the curve
}
export async function findPda(seeds, programId) {
  const pid = typeof programId === 'string' ? b58dec(programId) : programId, tag = new TextEncoder().encode('ProgramDerivedAddress');
  for (let bump = 255; bump >= 0; bump--) {
    const h = await sha256(cat(...seeds, Uint8Array.of(bump), pid, tag));
    if (!onCurve(h)) return [h, bump];
  }
  throw new Error('no program address');
}

// ---- keys ------------------------------------------------------------------------------------------------------------------
const PKCS8 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
export const walletSupported = async () => { try { await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign']); return true; } catch (e) { return false; } };
// a new keypair: { secret: 64 bytes (seed + public key, the format wallets import), pub: 32 bytes, address }
export async function newKeypair() {
  const k = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const seed = new Uint8Array(await crypto.subtle.exportKey('pkcs8', k.privateKey)).slice(-32), pub = new Uint8Array(await crypto.subtle.exportKey('raw', k.publicKey));
  return { secret: cat(seed, pub), pub, address: b58enc(pub) };
}
export async function keypairFromSecret(secret) {
  const seed = secret.slice(0, 32), key = await crypto.subtle.importKey('pkcs8', cat(PKCS8, seed), { name: 'Ed25519' }, true, ['sign']);
  const jwk = await crypto.subtle.exportKey('jwk', key), pub = b64u(jwk.x);
  if (secret.length === 64 && b58enc(secret.slice(32)) !== b58enc(pub)) throw new Error('this key does not match its public half');
  return { secret: cat(seed, pub), pub, address: b58enc(pub), key };
}
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
export async function sign(kp, msg) { const key = kp.key || (await keypairFromSecret(kp.secret)).key; return new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key, msg)); }
export const exportKey = (kp) => b58enc(kp.secret);   // paste into Phantom / Jupiter / Solflare: "Import private key"

// ---- the PIN lock ------------------------------------------------------------------------------------------------------------
const ROUNDS = 310000;
async function pinKey(pin, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ROUNDS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s) => Uint8Array.from(s.match(/../g) || [], (h) => parseInt(h, 16));
export async function lock(kp, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await pinKey(pin, salt), kp.secret));
  return { address: kp.address, enc: hex(enc), salt: hex(salt), iv: hex(iv), v: 1 };
}
export async function unlock(box, pin) {
  let secret;
  try { secret = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(box.iv) }, await pinKey(pin, unhex(box.salt)), unhex(box.enc))); }
  catch (e) { throw new Error('Wrong PIN'); }
  const kp = await keypairFromSecret(secret);
  if (kp.address !== box.address) throw new Error('Wallet does not match its address');
  return kp;
}

// ---- transactions (legacy message format) ----------------------------------------------------------------------------------
// ix: { program: address, keys: [{ pubkey: address, signer, writable }], data: Uint8Array }
export function compileMessage(payer, ixs, blockhash) {
  const metas = new Map(), add = (k, s, w) => { const m = metas.get(k) || { s: false, w: false }; m.s = m.s || s; m.w = m.w || w; metas.set(k, m); };
  add(payer, true, true);
  for (const ix of ixs) { for (const k of ix.keys) add(k.pubkey, !!k.signer, !!k.writable); add(ix.program, false, false); }
  // within each group accounts are sorted by their raw bytes, exactly as Solana's own compiler does
  const raw = new Map([...metas.keys()].map((k) => [k, b58dec(k)])), cmp = (x, y) => { const a2 = raw.get(x), b2 = raw.get(y); for (let i = 0; i < 32; i++) if (a2[i] !== b2[i]) return a2[i] - b2[i]; return 0; };
  const all = [...metas.entries()], order = (s, w) => all.filter(([k, m]) => m.s === s && m.w === w).map(([k]) => k).sort(cmp);
  const keys = [payer, ...order(true, true).filter((k) => k !== payer), ...order(true, false), ...order(false, true), ...order(false, false)];
  const nSig = all.filter(([, m]) => m.s).length, nRoSig = order(true, false).length, nRo = order(false, false).length;
  const idx = (k) => keys.indexOf(k);
  const ixBytes = ixs.map((ix) => cat(Uint8Array.of(idx(ix.program)), shortvec(ix.keys.length), Uint8Array.from(ix.keys.map((k) => idx(k.pubkey))), shortvec(ix.data.length), ix.data));
  return { bytes: cat(Uint8Array.of(nSig, nRoSig, nRo), shortvec(keys.length), ...keys.map(b58dec), b58dec(blockhash), shortvec(ixs.length), ...ixBytes), nSig };
}
export async function signTx(kp, ixs, blockhash) {
  const m = compileMessage(kp.address, ixs, blockhash);
  if (m.nSig !== 1) throw new Error('only the wallet signs here');
  const sig = await sign(kp, m.bytes);
  return { tx: cat(shortvec(1), sig, m.bytes), sig: b58enc(sig) };
}

// ---- compressed NFT transfer (Metaplex Bubblegum) ---------------------------------------------------------------------------
export const BUBBLEGUM = 'BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY', NOOP = 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV',
  COMPRESSION = 'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK', SYSTEM = '11111111111111111111111111111111';
const TRANSFER = Uint8Array.from([163, 52, 200, 231, 140, 3, 69, 186]);   // anchor discriminator: sha256("global:transfer")[0..8]
// asset: the RPC's getAsset result; proof: its getAssetProof result
export async function transferIx(owner, to, asset, proof, canopy = 0) {
  const tree = proof.tree_id, [auth] = await findPda([b58dec(tree)], BUBBLEGUM), c = asset.compression;
  const delegate = (asset.ownership && asset.ownership.delegate) || owner;
  const keys = [
    { pubkey: b58enc(auth) }, { pubkey: owner, signer: true }, { pubkey: delegate }, { pubkey: to }, { pubkey: tree, writable: true },
    { pubkey: NOOP }, { pubkey: COMPRESSION }, { pubkey: SYSTEM },
    ...proof.proof.slice(0, proof.proof.length - canopy).map((p) => ({ pubkey: p })),
  ];
  const data = cat(TRANSFER, b58dec(proof.root), b58dec(c.data_hash), b58dec(c.creator_hash), u64(c.leaf_id), u32(c.leaf_id));
  return { program: BUBBLEGUM, keys, data };
}

// ---- RPC ---------------------------------------------------------------------------------------------------------------------
export function rpc(url) {
  let id = 0;
  const call = async (method, params) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
    const j = await r.json(); if (j.error) throw new Error(j.error.message || 'RPC error'); return j.result;
  };
  return {
    call,
    balance: async (addr) => ((await call('getBalance', [addr])).value || 0) / 1e9,
    // the wallet's KYS:GO NFTs (only this game's collection is shown)
    nfts: async (addr, collection) => {
      const r = await call('getAssetsByOwner', { ownerAddress: addr, page: 1, limit: 1000 });
      return (r.items || []).filter((a) => !collection || (a.grouping || []).some((g) => g.group_key === 'collection' && g.group_value === collection));
    },
    // send one compressed NFT to another address; returns the transaction signature
    sendNft: async (kp, assetId, to, canopy = 0) => {
      b58dec(to); if (b58dec(to).length !== 32) throw new Error('That is not a Solana address');
      const [asset, proof] = await Promise.all([call('getAsset', { id: assetId }), call('getAssetProof', { id: assetId })]);
      if (!asset.compression || !asset.compression.compressed) throw new Error('Only the game\'s compressed NFTs can be sent from here');
      if (asset.ownership.owner !== kp.address) throw new Error('This wallet does not own that NFT');
      const ix = await transferIx(kp.address, to, asset, proof, canopy), bh = (await call('getLatestBlockhash', [{ commitment: 'finalized' }])).value.blockhash;
      const { tx } = await signTx(kp, [ix], bh);
      return call('sendTransaction', [btoa(String.fromCharCode(...tx)), { encoding: 'base64', preflightCommitment: 'confirmed' }]);
    },
  };
}
