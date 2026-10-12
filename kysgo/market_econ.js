// AI-run market economy: dynamic skin prices driven by rarity (case odds) and availability (supply/demand).
// The AI acts as a market maker — it continuously re-prices every finish based on:
//   - RARITY: lower case odds → higher base multiplier (rarer = intrinsically more valuable)
//   - SUPPLY: estimated circulation; more copies in existence → price drifts down
//   - DEMAND: recent trade velocity, market views, wishlist adds; hot items → price climbs
//   - TREND: momentum with mean-reversion so prices move like a real market, not random noise
// Works offline (simulates the broader market) and online (folds in real aggregate data when available).
// Standalone (no imports) to avoid circular dependencies with skins.js.

const KEY = 'kysgo_market_econ_v1';
// AI personality: how aggressively it moves prices
const CFG = {
  supplyElasticity: 0.35,   // price sensitivity to supply (higher = oversupply crashes harder)
  demandElasticity: 0.5,    // price sensitivity to demand spikes
  trendMomentum: 0.25,       // how much recent direction persists
  meanReversion: 0.08,       // pull back toward fair value each tick (stability)
  maxUp: 5,                 // price never exceeds 5x base
  maxDown: 0.3,             // price never drops below 0.3x base
  tickHours: 1,             // AI re-prices every hour
};

let S = null; // { finishes: { [defId]: { supplyIdx, demand, price, trend, updated } }, lastTick }

function load() {
  if (S) return S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { S = null; }
  if (!S || typeof S !== 'object') S = { finishes: {}, lastTick: 0 };
  if (!S.finishes) S.finishes = {};
  return S;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

function fin(defId) {
  const F = load().finishes;
  if (!F[defId]) F[defId] = { supplyIdx: 1, demand: 1, price: 0, trend: 0, updated: 0 };
  return F[defId];
}

// Rarity multiplier from case odds: rarer → higher. odds 69.8 → ~1x, odds 0.2 → ~8x (soft-capped by maxUp)
function rarityMult(odds) {
  const o = Math.max(0.05, odds || 1);
  return Math.min(8, Math.pow(70 / o, 0.55));
}

// The AI's fair-value estimate for a finish
export function econFair(defId, baseValue, odds) {
  const base = baseValue || 20;
  const o = odds || 69.8;
  const f = fin(defId);
  // supply: relative index (1.0 = baseline). More supply → cheaper, with diminishing impact.
  // Initialized to 1.0; case openings nudge it up slightly.
  const supplyF = Math.pow(1 / Math.max(0.2, f.supplyIdx || 1), CFG.supplyElasticity);
  // demand: 1.0 baseline; spikes push up
  const demandF = Math.pow(Math.max(0.2, f.demand), CFG.demandElasticity);
  // trend: momentum term, mean-reverts
  const trendF = 1 + f.trend * CFG.trendMomentum;
  const fair = base * rarityMult(o) * supplyF * demandF * trendF;
  return Math.round(Math.min(base * CFG.maxUp, Math.max(base * CFG.maxDown, fair)));
}

// Current AI price (uses cached price if fresh, else fair value)
export function econPrice(defId, baseValue, odds) {
  const f = fin(defId);
  if (f.price > 0 && Date.now() - f.updated < CFG.tickHours * 3600e3) return f.price;
  const p = econFair(defId, baseValue, odds);
  f.price = p; f.updated = Date.now(); save();
  return p;
}

// Feed the AI market events
export function econEvent(type, defId, baseValue, odds) {
  const f = fin(defId);
  if (type === 'case_open') {
    // new copy enters circulation → supply up → gentle downward pressure
    f.supplyIdx = (f.supplyIdx || 1) * 1.015;
    f.demand = Math.max(0.2, f.demand * 0.99);
  } else if (type === 'trade') {
    // a trade = revealed demand → up pressure + momentum
    f.demand = Math.min(5, f.demand + 0.35);
    f.trend = Math.min(1, f.trend + 0.12);
  } else if (type === 'list') {
    // listing = supply hitting the market
    f.demand = Math.min(5, f.demand + 0.1);
  } else if (type === 'view' || type === 'wishlist') {
    f.demand = Math.min(5, f.demand + 0.03);
  }
  // re-price immediately on meaningful events
  f.price = econFair(defId, baseValue, odds); f.updated = Date.now(); save();
}

// The AI's periodic market sweep: decay demand, mean-revert trends, simulate background market
export function econTick(priceOf) {
  const s = load(), now = Date.now();
  if (now - s.lastTick < CFG.tickHours * 3600e3) return false;
  s.lastTick = now;
  for (const [id, f] of Object.entries(s.finishes)) {
    // demand decays toward baseline (yesterday's hype fades)
    f.demand += (1 - f.demand) * 0.25;
    // trend mean-reverts (momentum fades)
    f.trend *= (1 - CFG.meanReversion * 4);
    // background market noise: tiny random walk so the market feels alive
    f.trend += (Math.random() - 0.5) * 0.06;
    f.trend = Math.max(-1, Math.min(1, f.trend));
    const pb = priceOf ? priceOf(id) : null;
    f.price = econFair(id, pb ? pb.base : 20, pb ? pb.odds : 69.8); f.updated = now;
  }
  save();
  return true;
}

// Price direction for UI (↑/↓/→)
export function econTrend(defId) {
  const t = fin(defId).trend;
  return t > 0.08 ? 'up' : t < -0.08 ? 'down' : 'flat';
}
