// ============================================================================
// KYS:GO — Colorblind accessibility modes
// Okabe-Ito-inspired colorblind-safe palettes for the three common deficiencies:
//   deuteranopia (red-green, ~5% of men), protanopia (red-blind, ~1% of men),
//   tritanopia (blue-yellow, rare).
// Loaded before game.js/ui.js (see index.html); exposes window.__CB__.
// Team colors, radar dots, nametags, bomb icons, hitmarkers, and damage
// numbers all route through these palettes. CSS-driven colors (--ct/--tt,
// hitmarker head/kill) are overridden with body[data-cb] selectors.
// ============================================================================

const CB_MODES = {
  none: {
    ct: '#5d9cec', t: '#e0a83a', tagCT: '#9cc4ff', tagT: '#ffd27a',
    bombPlanted: '#ff3a2a', bombCarried: '#ffd45a', site: '#ff6a4a',
    hmHead: '#ffd54a', hmKill: '#ff3b3b',
    dmgHead: '#ff4b4b', dmgArmor: '#5ec8ff', dmgBody: '#ffffff',
  },
  deuteranopia: {   // red-green: sky blue vs orange (Okabe-Ito), alerts go magenta
    ct: '#56B4E9', t: '#E69F00', tagCT: '#8fc7ef', tagT: '#E69F00',
    bombPlanted: '#FF2E88', bombCarried: '#F0E442', site: '#FF2E88',
    hmHead: '#F0E442', hmKill: '#FF2E88',
    dmgHead: '#FF2E88', dmgArmor: '#56B4E9', dmgBody: '#ffffff',
  },
  protanopia: {     // red-blind: blue vs yellow, alerts go magenta
    ct: '#0072B2', t: '#F0E442', tagCT: '#7ec8ff', tagT: '#F0E442',
    bombPlanted: '#FF2E88', bombCarried: '#F0E442', site: '#FF2E88',
    hmHead: '#F0E442', hmKill: '#FF2E88',
    dmgHead: '#FF2E88', dmgArmor: '#56B4E9', dmgBody: '#ffffff',
  },
  tritanopia: {     // blue-yellow: default blue-vs-gold is the confused pair,
    ct: '#56B4E9', t: '#D55E00', tagCT: '#9cc4ff', tagT: '#eda15e',  // so swap T to vermillion (red is preserved)
    bombPlanted: '#ff3a2a', bombCarried: '#ffd45a', site: '#ff6a4a',
    hmHead: '#ffd54a', hmKill: '#ff3b3b',
    dmgHead: '#ff4b4b', dmgArmor: '#5ec8ff', dmgBody: '#ffffff',
  },
};

let cbMode = 'none';
const cbPal = () => CB_MODES[cbMode] || CB_MODES.none;

function cbSet(mode) {
  cbMode = CB_MODES[mode] ? mode : 'none';
  try {
    if (cbMode === 'none') document.body.removeAttribute('data-cb');
    else document.body.setAttribute('data-cb', cbMode);
  } catch (e) { /* non-DOM test harness */ }
}

window.__CB__ = {
  modes: CB_MODES,
  mode: () => cbMode,
  set: cbSet,
  swatch: (m) => CB_MODES[m] || CB_MODES.none,
  team: (t) => cbPal()[t === 'CT' ? 'ct' : 't'],
  tag: (t) => cbPal()[t === 'CT' ? 'tagCT' : 'tagT'],
  bomb: (s) => cbPal()[s === 'planted' ? 'bombPlanted' : 'bombCarried'],
  site: () => cbPal().site,
  dmg: (head, armored) => (head ? cbPal().dmgHead : armored ? cbPal().dmgArmor : cbPal().dmgBody),
  hm: (kind) => (kind === 'kill' ? cbPal().hmKill : kind === 'head' ? cbPal().hmHead : '#ffffff'),
};

// CSS overrides for var-driven colors (--ct/--tt feed scoreboard, HUD scores,
// chat names, killfeed) and the hitmarker head/kill classes in ui.js injectCss.
// body[data-cb="x"] (0,1,1) outranks :root (0,1,0), so these always win.
try {
  const css = Object.keys(CB_MODES).filter((m) => m !== 'none').map((m) => {
    const p = CB_MODES[m];
    return `body[data-cb="${m}"]{--ct:${p.ct};--tt:${p.t}}` +
      `body[data-cb="${m}"] .cs-hm.head i{background:${p.hmHead}}` +
      `body[data-cb="${m}"] .cs-hm.kill i{background:${p.hmKill}}`;
  }).join('\n');
  const st = document.createElement('style');
  st.id = 'cb-css';
  st.textContent = css;
  document.head.appendChild(st);
} catch (e) { /* non-DOM test harness */ }
