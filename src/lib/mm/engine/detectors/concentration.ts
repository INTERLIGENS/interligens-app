// ─── Concentration Abnormality Detector (core, spec §7.3) ─────────────────
// Pure function. No I/O.
//
// Three sub-signals, each worth a fixed number of points, capped at 20:
//   • TOPN_DOMINATES    — top-N wallets control ≥ threshold of total volume
//   • GINI_HIGH         — Gini coefficient ≥ 0.85
//   • HHI_ABOVE_2500    — Herfindahl-Hirschman Index ≥ 2500
//
// All three metrics are scale-invariant and deterministic.

import type {
  ConcentrationInput,
  DetectorOutput,
  DetectorSignal,
  WalletVolume,
} from "../types";
import { CONCENTRATION_SUBSIGNAL_POINTS } from "../scoring/weights";

const DEFAULT_HHI_THRESHOLD = 2_500;
const DEFAULT_TOPN_SHARE_THRESHOLD = 0.6;
const DEFAULT_TOPN = 3;
const GINI_HIGH_THRESHOLD = 0.85;

// ─── Math primitives ───────────────────────────────────────────────────────

/**
 * HHI is defined on percentage market shares (0–100) and ranges from 0 to
 * 10000. A monopolist (100% share) has HHI=10000. US DOJ treats HHI > 2500
 * as a highly concentrated market.
 */
export function hhi(volumes: WalletVolume[]): number {
  const total = volumes.reduce((s, v) => s + Math.max(0, v.volumeUsd), 0);
  if (total <= 0) return 0;
  let sum = 0;
  for (const v of volumes) {
    const shareHundredths = (Math.max(0, v.volumeUsd) / total) * 100;
    sum += shareHundredths * shareHundredths;
  }
  return sum;
}

/**
 * Gini coefficient on non-negative volumes. Uses the mean-absolute-difference
 * formulation:
 *   G = (Σ|xi - xj|) / (2 * n^2 * mean)
 * Range [0, 1 - 1/n] for n non-zero samples. Returns 0 when all equal.
 */
export function gini(volumes: WalletVolume[]): number {
  const xs = volumes
    .map((v) => Math.max(0, v.volumeUsd))
    .filter((v) => Number.isFinite(v));
  const n = xs.length;
  if (n === 0) return 0;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  if (mean === 0) return 0;
  xs.sort((a, b) => a - b);
  // Efficient form: G = (2 * Σ(i * xi) - (n + 1) * Σxi) / (n * Σxi)
  // with i = 1..n (1-indexed).
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i + 1) * xs[i];
  }
  const totalSum = xs.reduce((s, x) => s + x, 0);
  return (2 * numerator) / (n * totalSum) - (n + 1) / n;
}

export function topNShare(
  volumes: WalletVolume[],
  topN = DEFAULT_TOPN,
): { share: number; topWallets: string[]; totalUsd: number } {
  const total = volumes.reduce((s, v) => s + Math.max(0, v.volumeUsd), 0);
  if (total <= 0 || volumes.length === 0) {
    return { share: 0, topWallets: [], totalUsd: 0 };
  }
  const sorted = [...volumes].sort((a, b) => b.volumeUsd - a.volumeUsd);
  const top = sorted.slice(0, topN);
  const sumTop = top.reduce((s, v) => s + Math.max(0, v.volumeUsd), 0);
  return {
    share: sumTop / total,
    topWallets: top.map((v) => v.wallet),
    totalUsd: total,
  };
}

// ─── Public entry point ────────────────────────────────────────────────────

export function runConcentrationDetector(
  input: ConcentrationInput,
): DetectorOutput {
  const started = performance.now();

  // Cohort percentiles (Phase 3) take precedence over explicit overrides.
  const cohortHhi = input.percentiles?.metrics?.hhi?.p99;
  const cohortTop = input.percentiles?.metrics?.top3Share?.p99;
  const cohortGini = input.percentiles?.metrics?.gini?.p99;

  const hhiThreshold = input.hhiThreshold ?? cohortHhi ?? DEFAULT_HHI_THRESHOLD;
  const topNThreshold =
    input.topNShareThreshold ?? cohortTop ?? DEFAULT_TOPN_SHARE_THRESHOLD;
  const giniThreshold =
    input.giniThreshold ?? cohortGini ?? GINI_HIGH_THRESHOLD;
  const topN = input.topN ?? DEFAULT_TOPN;

  const signals: DetectorSignal[] = [];
  let score = 0;

  const top = topNShare(input.walletVolumes, topN);
  const gi = gini(input.walletVolumes);
  const h = hhi(input.walletVolumes);

  if (top.share >= topNThreshold) {
    signals.push({
      type: "TOPN_DOMINATES",
      severity: top.share >= 0.8 ? "HIGH" : "MEDIUM",
      metric: top.share,
      baseline: topNThreshold,
      description: `Top ${topN} wallets account for ${(top.share * 100).toFixed(1)}% of volume.`,
      extra: { topWallets: top.topWallets, totalUsd: top.totalUsd },
    });
    score += CONCENTRATION_SUBSIGNAL_POINTS.TOPN_DOMINATES;
  }

  if (gi >= giniThreshold) {
    signals.push({
      type: "GINI_HIGH",
      severity: gi >= 0.95 ? "HIGH" : "MEDIUM",
      metric: gi,
      baseline: giniThreshold,
      description: `Gini coefficient ${gi.toFixed(3)} indicates an extremely skewed distribution.`,
    });
    score += CONCENTRATION_SUBSIGNAL_POINTS.GINI_HIGH;
  }

  if (h >= hhiThreshold) {
    signals.push({
      type: "HHI_ABOVE_2500",
      severity: h >= 5_000 ? "HIGH" : "MEDIUM",
      metric: h,
      baseline: hhiThreshold,
      description: `HHI ${h.toFixed(0)} exceeds the applied baseline.`,
    });
    score += CONCENTRATION_SUBSIGNAL_POINTS.HHI_ABOVE_2500;
  }

  const maxScore = 20;
  score = Math.min(score, maxScore);

  return {
    detectorType: "CONCENTRATION_ABNORMALITY",
    score,
    maxScore,
    signals,
    evidence: {
      tokenId: input.tokenId,
      chain: input.chain,
      walletCount: input.walletVolumes.length,
      totalVolumeUsd: top.totalUsd,
      topN,
      topNShare: top.share,
      topWallets: top.topWallets,
      gini: gi,
      hhi: h,
      thresholds: {
        hhi: hhiThreshold,
        topN: topNThreshold,
        gini: giniThreshold,
      },
      cohortKey: input.percentiles?.cohortKey ?? null,
      thresholdSource: input.percentiles ? "cohort_p99" : "hardcoded",
    },
    durationMs: Math.max(0, Math.round(performance.now() - started)),
  };
}
