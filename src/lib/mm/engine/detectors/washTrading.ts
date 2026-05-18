// ─── Wash Trading Detector (core, spec §7.1) ───────────────────────────────
// Pure function. No I/O.
//
// Three sub-signals:
//   • CONCENTRATION — avg volume per unique buyer is abnormally high AND
//     unique buyer count is small (temporary hard-coded thresholds in Phase 2;
//     will be replaced by P99 cohort calibration in Phase 3).
//   • ROUND_TRIP   — A→B→A within ≤100 blocks, i.e. funds coming back to
//     the origin wallet through an intermediate.
//   • MIRRORED     — within a 1h window, total buy volume ≈ total sell volume
//     (ratio ≥ 0.85) for the same cluster or globally when no cluster map.

import type {
  DetectorOutput,
  DetectorSignal,
  RoundTrip,
  Severity,
  WashTradeTx,
  WashTradingInput,
} from "../types";
import { WASH_TRADING_SUBSIGNAL_POINTS } from "../scoring/weights";

// ─── Temporary thresholds (Phase 3 replaces with cohort P99) ──────────────
export const TEMP_THRESHOLDS = {
  CONCENTRATION_AVG_VOL_PER_BUYER: 50_000,
  CONCENTRATION_MAX_UNIQUE_BUYERS: 20,
  ROUND_TRIP_BLOCK_WINDOW: 100,
  MIRRORED_WINDOW_SECONDS: 60 * 60, // 1h
  MIRRORED_RATIO: 0.85,
} as const;

// ─── CONCENTRATION sub-signal ──────────────────────────────────────────────

interface ConcentrationResult {
  triggered: boolean;
  avgVolPerBuyer: number;
  uniqueBuyers: number;
  totalVolumeUsd: number;
  thresholdUsed: number;
  thresholdSource: "cohort_p99" | "hardcoded";
  signal?: DetectorSignal;
}

export function detectConcentration(
  txs: WashTradeTx[],
  percentiles?: import("../types").CohortPercentiles,
): ConcentrationResult {
  const buyers = new Set<string>();
  let totalVolumeUsd = 0;
  for (const tx of txs) {
    if (tx.side === "BUY") {
      buyers.add(tx.buyer);
      totalVolumeUsd += tx.volumeUsd;
    }
  }
  const uniqueBuyers = buyers.size;
  const avgVolPerBuyer = uniqueBuyers > 0 ? totalVolumeUsd / uniqueBuyers : 0;

  const cohortP99 = percentiles?.metrics?.avgVolPerBuyer?.p99;
  const useCohort = typeof cohortP99 === "number" && cohortP99 > 0;
  const threshold = useCohort
    ? cohortP99
    : TEMP_THRESHOLDS.CONCENTRATION_AVG_VOL_PER_BUYER;
  const thresholdSource: "cohort_p99" | "hardcoded" = useCohort
    ? "cohort_p99"
    : "hardcoded";

  const triggered =
    uniqueBuyers > 0 &&
    avgVolPerBuyer > threshold &&
    uniqueBuyers < TEMP_THRESHOLDS.CONCENTRATION_MAX_UNIQUE_BUYERS;

  if (!triggered) {
    return {
      triggered: false,
      avgVolPerBuyer,
      uniqueBuyers,
      totalVolumeUsd,
      thresholdUsed: threshold,
      thresholdSource,
    };
  }

  return {
    triggered: true,
    avgVolPerBuyer,
    uniqueBuyers,
    totalVolumeUsd,
    thresholdUsed: threshold,
    thresholdSource,
    signal: {
      type: "CONCENTRATION_ABOVE_THRESHOLD",
      severity: "HIGH",
      metric: avgVolPerBuyer,
      baseline: threshold,
      description: `Volume/buyer ratio ${avgVolPerBuyer.toFixed(0)} USD on ${uniqueBuyers} unique buyers (baseline ${thresholdSource}).`,
      extra: {
        uniqueBuyers,
        totalVolumeUsd,
        maxUniqueBuyers: TEMP_THRESHOLDS.CONCENTRATION_MAX_UNIQUE_BUYERS,
        thresholdSource,
      },
    },
  };
}

// ─── ROUND_TRIP sub-signal ─────────────────────────────────────────────────

/**
 * Walk the transaction stream (sorted by block ascending) and search for
 * A → X → A patterns where both legs are within `window` blocks of each
 * other and X is a distinct intermediate wallet. A round-trip means funds
 * leave wallet A and come back to A after being passed through X.
 *
 * We treat each tx as an edge (seller → buyer). A round-trip is detected
 * when we find a tx (A→X), then later a tx (X→A) both within the window.
 */
export function findRoundTrips(
  txs: WashTradeTx[],
  window: number = TEMP_THRESHOLDS.ROUND_TRIP_BLOCK_WINDOW,
): RoundTrip[] {
  if (txs.length < 2) return [];
  const sorted = [...txs].sort((a, b) => a.block - b.block);
  const trips: RoundTrip[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const leg1 = sorted[i];
    if (leg1.seller === leg1.buyer) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const leg2 = sorted[j];
      if (leg2.block - leg1.block > window) break;
      if (
        leg1.seller === leg2.buyer &&
        leg1.buyer === leg2.seller &&
        leg1.buyer !== leg1.seller
      ) {
        const key = `${leg1.seller}|${leg1.buyer}|${leg1.block}|${leg2.block}`;
        if (seen.has(key)) continue;
        seen.add(key);
        trips.push({
          origin: leg1.seller,
          via: leg1.buyer,
          firstBlock: leg1.block,
          lastBlock: leg2.block,
          hops: [leg1.seller, leg1.buyer, leg2.buyer],
        });
      }
    }
  }
  return trips;
}

function roundTripSignal(trips: RoundTrip[]): DetectorSignal | null {
  if (trips.length === 0) return null;
  const severity: Severity = trips.length >= 5 ? "HIGH" : trips.length >= 2 ? "MEDIUM" : "LOW";
  return {
    type: "ROUND_TRIP",
    severity,
    metric: trips.length,
    description: `${trips.length} A→B→A round-trip(s) within block window.`,
    extra: {
      trips: trips.slice(0, 10),
      truncated: trips.length > 10,
    },
  };
}

// ─── MIRRORED sub-signal ───────────────────────────────────────────────────

interface MirroredResult {
  ratio: number;
  buyUsd: number;
  sellUsd: number;
  windowStart: number;
  windowEnd: number;
  clusterKey?: string;
}

/**
 * Sliding window that returns the strongest ratio observed over any
 * `windowSeconds` slice. If clusterMap is provided, aggregates per cluster
 * and returns the worst cluster; otherwise aggregates globally.
 */
export function detectMirrored(
  txs: WashTradeTx[],
  windowSeconds: number = TEMP_THRESHOLDS.MIRRORED_WINDOW_SECONDS,
  clusterMap?: Map<string, string>,
): MirroredResult | null {
  if (txs.length === 0) return null;

  const byKey = new Map<string, WashTradeTx[]>();
  for (const tx of txs) {
    const bucket = clusterMap
      ? clusterMap.get(tx.buyer) ?? clusterMap.get(tx.seller) ?? "__global__"
      : "__global__";
    const arr = byKey.get(bucket) ?? [];
    arr.push(tx);
    byKey.set(bucket, arr);
  }

  let best: MirroredResult | null = null;
  for (const [key, group] of byKey) {
    group.sort((a, b) => a.timestamp - b.timestamp);
    let left = 0;
    let buyUsd = 0;
    let sellUsd = 0;
    for (let right = 0; right < group.length; right++) {
      const tx = group[right];
      if (tx.side === "BUY") buyUsd += tx.volumeUsd;
      else sellUsd += tx.volumeUsd;
      while (group[right].timestamp - group[left].timestamp > windowSeconds) {
        const out = group[left];
        if (out.side === "BUY") buyUsd -= out.volumeUsd;
        else sellUsd -= out.volumeUsd;
        left += 1;
      }
      const smaller = Math.min(buyUsd, sellUsd);
      const larger = Math.max(buyUsd, sellUsd);
      if (larger <= 0) continue;
      const ratio = smaller / larger;
      if (!best || ratio > best.ratio) {
        best = {
          ratio,
          buyUsd,
          sellUsd,
          windowStart: group[left].timestamp,
          windowEnd: group[right].timestamp,
          clusterKey: key === "__global__" ? undefined : key,
        };
      }
    }
  }
  return best;
}

function mirroredSignal(
  mirrored: MirroredResult | null,
  thresholdOverride?: number,
): DetectorSignal | null {
  if (!mirrored) return null;
  const threshold = thresholdOverride ?? TEMP_THRESHOLDS.MIRRORED_RATIO;
  if (mirrored.ratio < threshold) return null;
  const severity: Severity = mirrored.ratio >= 0.95 ? "HIGH" : "MEDIUM";
  return {
    type: "MIRRORED",
    severity,
    metric: mirrored.ratio,
    baseline: threshold,
    description: `Mirrored buy/sell volumes at ratio ${mirrored.ratio.toFixed(2)} within 1h window.`,
    extra: {
      buyUsd: mirrored.buyUsd,
      sellUsd: mirrored.sellUsd,
      windowStart: mirrored.windowStart,
      windowEnd: mirrored.windowEnd,
      clusterKey: mirrored.clusterKey ?? null,
    },
  };
}

// ─── Public entry point ────────────────────────────────────────────────────

export function runWashTradingDetector(input: WashTradingInput): DetectorOutput {
  const started = performance.now();

  const txs = input.txs;
  const signals: DetectorSignal[] = [];
  let score = 0;

  const concentration = detectConcentration(txs, input.percentiles);
  if (concentration.signal) {
    signals.push(concentration.signal);
    score += WASH_TRADING_SUBSIGNAL_POINTS.CONCENTRATION;
  }

  const trips = findRoundTrips(
    txs,
    input.roundTripBlockWindow ?? TEMP_THRESHOLDS.ROUND_TRIP_BLOCK_WINDOW,
  );
  const rtSignal = roundTripSignal(trips);
  if (rtSignal) {
    signals.push(rtSignal);
    score += WASH_TRADING_SUBSIGNAL_POINTS.ROUND_TRIP;
  }

  const mirrored = detectMirrored(
    txs,
    input.mirroredWindowSeconds ?? TEMP_THRESHOLDS.MIRRORED_WINDOW_SECONDS,
    input.clusterMap,
  );
  const mirroredThreshold = input.percentiles?.metrics?.mirroredRatio?.p99;
  const mSignal = mirroredSignal(mirrored, mirroredThreshold);
  if (mSignal) {
    signals.push(mSignal);
    score += WASH_TRADING_SUBSIGNAL_POINTS.MIRRORED;
  }

  const maxScore = 30;
  score = Math.min(score, maxScore);

  return {
    detectorType: "WASH_TRADING",
    score,
    maxScore,
    signals,
    evidence: {
      tokenId: input.tokenId,
      chain: input.chain,
      txCount: txs.length,
      uniqueBuyers: concentration.uniqueBuyers,
      avgVolPerBuyer: concentration.avgVolPerBuyer,
      totalVolumeUsd: concentration.totalVolumeUsd,
      roundTripCount: trips.length,
      mirroredRatio: mirrored?.ratio ?? null,
      thresholdSource: concentration.thresholdSource,
      thresholdUsed: concentration.thresholdUsed,
      cohortKey: input.percentiles?.cohortKey ?? null,
    },
    durationMs: Math.max(0, Math.round(performance.now() - started)),
  };
}
