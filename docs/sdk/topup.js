// Top-ups for any STUMF game: they're donations to STUMF, who credits the in-game currency back. Two ways: in
// person (Cash App, credited by the owner) or crypto (SOL to STUMF's wallet, credited automatically: the payment
// carries the player's deposit code as its memo, STUMF sees it arrive and adds the coins).
import qrcode from './qrcode.js';

export function qrSvg(text, cell = 4) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: cell, margin: 3, scalable: true });
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// cfg.topup = { contact, cashtag, packs: [[usd, coins]...], coinsPerUsd, sol: { wallet, usd } }
// who: what to write in a Cash App note; code: the deposit code (null = not signed in: crypto still works as a donation)
export function topUp(cfg, { who = '', code = null, game = 'game', coins = 'coins' } = {}) {
  const T = cfg.topup || {}, packs = T.packs || [[2, 2500], [5, 7000], [10, 15000], [20, 35000]], sol = T.sol || {};
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(6,8,10,.82);display:grid;place-items:center;font:14px system-ui,sans-serif;color:#e9edf3';
  let tab = 'cash', pick = 1;
  const draw = () => {
    const crypto = !!sol.wallet;
    const usd = packs[pick][0], amt = sol.usd ? Math.ceil(usd / sol.usd * 10000) / 10000 : 0;
    const memo = code ? `${game}:${code}` : `${game}:donation`;
    const url = `solana:${sol.wallet}?amount=${amt}&memo=${encodeURIComponent(memo)}&label=${encodeURIComponent('STUMF')}&message=${encodeURIComponent((cfg.title || 'Game') + ' top-up')}`;
    m.innerHTML = `<div style="width:min(480px,94vw);max-height:92vh;overflow:auto;background:#1a1e24;border:1px solid #2e343d;border-radius:4px;padding:22px;text-align:center">
      <div style="display:flex;gap:2px;border-bottom:1px solid #2e343d;margin-bottom:16px">${[['cash', 'Cash App'], ...(crypto ? [['sol', 'Crypto (SOL)']] : [])].map(([k, n]) => `<button data-t="${k}" style="flex:1;border:0;background:none;color:${tab === k ? '#fff' : '#8d97a5'};padding:10px;font:800 12px system-ui;letter-spacing:.12em;text-transform:uppercase;border-bottom:3px solid ${tab === k ? '#f2a33a' : 'transparent'};cursor:pointer">${n}</button>`).join('')}</div>
      ${tab === 'cash' ? `<div style="width:84px;height:84px;margin:0 auto 12px;border-radius:20px;background:#00d64f;display:grid;place-items:center;font:900 52px system-ui;color:#fff">$</div>
        <div style="font:900 32px system-ui;letter-spacing:.06em">${esc((T.contact || 'Call AJ').toUpperCase())}</div><div style="font:800 20px system-ui;color:#00d64f;margin:4px 0 16px">${esc(T.cashtag || '')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${packs.map(([d, c]) => `<div style="border:1px solid #2e343d;background:#22272f;border-radius:3px;padding:12px"><div style="font:900 22px system-ui">$${d}</div><div style="color:#ffd45a;font-weight:700">${c.toLocaleString()} ${esc(coins)}</div></div>`).join('')}</div>
        <div style="color:#9aa4b2;font-size:12px;margin-top:12px">Put <b style="color:#fff">${esc(who || 'your player name')}</b> in the note. Added to your account by hand.</div>`
      : `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">${packs.map(([d, c], i) => `<button data-p="${i}" style="border:1px solid ${i === pick ? '#f2a33a' : '#2e343d'};background:#22272f;color:#fff;border-radius:3px;padding:8px 4px;cursor:pointer"><b>$${d}</b><br><span style="color:#ffd45a;font-size:11px">${c.toLocaleString()}</span></button>`).join('')}</div>
        <div style="background:#fff;border-radius:6px;padding:8px;width:240px;margin:0 auto">${qrSvg(url)}</div>
        <div style="margin:10px 0 4px;font-weight:800">${amt} SOL ≈ $${usd} → ${packs[pick][1].toLocaleString()} ${esc(coins)}</div>
        <a href="${esc(url)}" style="display:inline-block;margin:6px 0;padding:10px 18px;background:#ab9ff2;color:#1a1033;font-weight:800;border-radius:3px;text-decoration:none">Open in Phantom</a>
        <div style="color:#9aa4b2;font-size:12px;margin-top:6px">${code ? `Scan with Phantom (scan icon, top right). The payment carries your code <b style="color:#fff">${esc(code)}</b>, so STUMF credits your account automatically about a minute after it confirms. Any amount works at the same rate.` : 'Sign in first so STUMF knows whose account to credit. Without an account this is just a donation.'}</div>
        <div style="color:#6a7480;font-size:11px;margin-top:6px;word-break:break-all">${esc(sol.wallet)}</div>`}
      <button data-x style="margin-top:14px;border:0;background:#2b3442;color:#fff;padding:9px 18px;border-radius:3px;font-weight:700;cursor:pointer">Close</button></div>`;
    m.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tab = b.dataset.t; draw(); }));
    m.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { pick = +b.dataset.p; draw(); }));
    m.querySelector('[data-x]').onclick = () => m.remove();
  };
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  document.body.appendChild(m); draw();
  return m;
}
