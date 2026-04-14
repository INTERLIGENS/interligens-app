/**
 * Wash-trade detector.
 *
 * Given a flat list of recent transfers on a target address (or its
 * associated token), returns a washScore 0..100 based on how concentrated
 * the activity is across a small set of counterparties.
 *
 * Pure and deterministic. No network, no DB. Upstream code is responsible
 * for feeding it the transfer sample.
 */

export interface WashTransfer {
  /** Counterparty address (the side that is NOT the target). */
  counterparty: string;
  /** Amount in token units — exact unit does not matter, only the ratio does. */
  amount: number;
  /** Block / tx time. Used only to compute the time window for the sample. */
  timestamp: number;
}

export interface WashResult {
  washScore: number; // 0..100
  sampleSize: number;
  uniqueCounterparties: number;
  topCounterpartyShare: number; // 0..1 — share of the biggest counterparty
  top3Share: number; // 0..1 — share of the top 3
  reasons: string[];
}

const MIN_SAMPLE = 20;

function normalize(counterparty: string): string {
  const t = counterparty.trim();
  if (t.startsWith("0x") && t.length === 42) return t.toLowerCase();
  return t;
}

/**
 * Compute a washScore between 0 and 100 from a sample of transfers.
 *
 * Intuition:
 *   - unique/sample low (few counterparties, many tx)       → high score
 *   - top1 share very high (one partner dominates volume)   → high score
 *   - top3 share high (small clique dominates volume)       → medium-high
 *   - sample too small to be meaningful                      → capped at 30
 */
export function computeWashScore(transfers: WashTransfer[]): WashResult {
  const reasons: string[] = [];
  const sampleSize = transfers.length;

  if (sampleSize === 0) {
    return {
      washScore: 0,
      sampleSize: 0,
      uniqueCounterparties: 0,
      topCounterpartyShare: 0,
      top3Share: 0,
      reasons: ["no_transfers"],
    };
  }

  const volumeByCp = new Map<string, number>();
  const txByCp = new Map<string, number>();
  let totalVolume = 0;

  for (const t of transfers) {
    if (!t.counterparty || !Number.isFinite(t.amount) || t.amount <= 0) continue;
    const k = normalize(t.counterparty);
    volumeByCp.set(k, (volumeByCp.get(k) ?? 0) + t.amount);
    txByCp.set(k, (txByCp.get(k) ?? 0) + 1);
    totalVolume += t.amount;
  }

  const uniqueCounterparties = volumeByCp.size;
  if (totalVolume === 0 || uniqueCounterparties === 0) {
    return {
      washScore: 0,
      sampleSize,
      uniqueCounterparties: 0,
      topCounterpartyShare: 0,
      top3Share: 0,
      reasons: ["zero_volume"],
    };
  }

  const ranked = Array.from(volumeByCp.entries())
    .map(([cp, v]) => ({ cp, v, share: v / totalVolume }))
    .sort((a, b) => b.v - a.v);

  const topCounterpartyShare = ranked[0]?.share ?? 0;
  const top3Share = ranked.slice(0, 3).reduce((s, r) => s + r.share, 0);
  const uniqueRatio = uniqueCounterparties / sampleSize;

  let score = 0;

  // Signal 1 — concentration at the top.
  if (topCounterpartyShare >= 0.7) {
    score += 50;
    reasons.push(`top1_share_${(topCounterpartyShare * 100).toFixed(0)}pct`);
  } else if (topCounterpartyShare >= 0.45) {
    score += 30;
    reasons.push(`top1_share_${(topCounterpartyShare * 100).toFixed(0)}pct`);
  } else if (topCounterpartyShare >= 0.25) {
    score += 15;
    reasons.push(`top1_share_${(topCounterpartyShare * 100).toFixed(0)}pct`);
  }

  // Signal 2 — top-3 clique.
  if (top3Share >= 0.9) {
    score += 25;
    reasons.push(`top3_clique_${(top3Share * 100).toFixed(0)}pct`);
  } else if (top3Share >= 0.75) {
    score += 15;
    reasons.push(`top3_clique_${(top3Share * 100).toFixed(0)}pct`);
  }

  // Signal 3 — low uniqueness vs sample (many tx, few partners).
  if (uniqueRatio <= 0.1) {
    score += 25;
    reasons.push(`unique_ratio_${(uniqueRatio * 100).toFixed(0)}pct`);
  } else if (uniqueRatio <= 0.25) {
    score += 15;
    reasons.push(`unique_ratio_${(uniqueRatio * 100).toFixed(0)}pct`);
  }

  // Small-sample cap — we need at least MIN_SAMPLE transfers before we are
  // willing to call something "manipulated"; below that, cap at 30.
  if (sampleSize < MIN_SAMPLE) {
    score = Math.min(score, 30);
    reasons.push(`small_sample_${sampleSize}`);
  }

  return {
    washScore: Math.max(0, Math.min(100, Math.round(score))),
    sampleSize,
    uniqueCounterparties,
    topCounterpartyShare,
    top3Share,
    reasons,
  };
}
