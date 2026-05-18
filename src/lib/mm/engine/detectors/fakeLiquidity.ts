// ─── Fake Liquidity Detector (core, Phase 9) ─────────────────────────────
// Pure function. No I/O.
//
// Detects MM desks running the same capital in circles to inflate
// DexScreener / Birdeye metrics. This is a CORE detector — no co-occurrence
// gate required, unlike Price Asymmetry / Post-Listing Pump.
//
// Four sub-signals:
//   • VOLUME_LIQUIDITY_MISMATCH — dailyVolumeUsd / totalLiquidityUsd ≥ 10
//     is HIGH (10× liquidity turnover per day is nearly always capital
//     looping), ≥ 5 is MEDIUM. Temporary hard-coded thresholds; Phase 3
//     cohort calibration will replace them with a per-(chain, tier) P99.
//   • LIQUIDITY_CONCENTRATION — the top LP controls > 80% of total LP, or
//     the top 3 control > 90%. Either is a classic sybil / single-operator
//     footprint.
//   • PHANTOM_VOLUME — fewer than 5 distinct wallets account for > 80% of
//     the volume AND total volume ≥ 500K USD. Dust-volume tokens are
//     excluded to avoid false positives on low-activity long-tails.
//   • POOL_FRAGMENTATION — > 10 pools on a microcap (totalLiquidityUsd
//     < 1M) is suspicious fragmentation designed to dilute detection.

import type {
  DetectorOutput,
  DetectorSignal,
  FakeLiquidityInput,
  Severity,
  WalletVolume,
} from "../types";
import { FAKE_LIQUIDITY_SUBSIGNAL_POINTS } from "../scoring/weights";

const DEFAULT_VOLUME_RATIO_HIGH = 10;
const DEFAULT_VOLUME_RATIO_MEDIUM = 5;
const DEFAULT_PHANTOM_VOLUME_MIN_USD = 500_000;
const DEFAULT_PHANTOM_TOP_N = 5;
const DEFAULT_PHANTOM_SHARE = 0.8;
const DEFAULT_LP_TOP1_SHARE = 0.8;
const DEFAULT_LP_TOP3_SHARE = 0.9;
const DEFAULT_MICROCAP_MAX = 1_000_000;
const DEFAULT_FRAGMENTATION_POOL_COUNT = 10;

const MAX_SCORE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────

function volumeRatio(volumeUsd: number, liquidityUsd: number): number {
  if (liquidityUsd <= 0) return 0;
  return volumeUsd / liquidityUsd;
}

function topShares(items: Array<{ usd: number }>): {
  top1: number;
  top3: number;
  total: number;
} {
  const total = items.reduce((s, v) => s + Math.max(0, v.usd), 0);
  if (total <= 0) return { top1: 0, top3: 0, total: 0 };
  const sorted = [...items].sort((a, b) => b.usd - a.usd);
  const top1 = Math.max(0, sorted[0]?.usd ?? 0);
  const top3 = sorted
    .slice(0, 3)
    .reduce((s, v) => s + Math.max(0, v.usd), 0);
  return { top1: top1 / total, top3: top3 / total, total };
}

function phantomVolumeMetrics(
  volumes: WalletVolume[],
  topN: number,
): { share: number; totalUsd: number; wallets: string[] } {
  const total = volumes.reduce((s, v) => s + Math.max(0, v.volumeUsd), 0);
  if (total <= 0 || volumes.length === 0) {
    return { share: 0, totalUsd: 0, wallets: [] };
  }
  const sorted = [...volumes].sort((a, b) => b.volumeUsd - a.volumeUsd);
  const top = sorted.slice(0, topN);
  const topSum = top.reduce((s, v) => s + Math.max(0, v.volumeUsd), 0);
  return {
    share: topSum / total,
    totalUsd: total,
    wallets: top.map((v) => v.wallet),
  };
}

// ─── Sub-signals ──────────────────────────────────────────────────────────

function volumeLiquidityMismatch(
  input: FakeLiquidityInput,
): DetectorSignal | null {
  const ratio = volumeRatio(input.dailyVolumeUsd, input.totalLiquidityUsd);
  const hi = input.volumeRatioHighThreshold ?? DEFAULT_VOLUME_RATIO_HIGH;
  const med = input.volumeRatioMediumThreshold ?? DEFAULT_VOLUME_RATIO_MEDIUM;
  if (ratio < med) return null;
  const severity: Severity = ratio >= hi ? "HIGH" : "MEDIUM";
  return {
    type: "VOLUME_LIQUIDITY_MISMATCH",
    severity,
    metric: ratio,
    baseline: med,
    description: `Daily volume ${input.dailyVolumeUsd.toFixed(0)} USD is ${ratio.toFixed(1)}× the declared liquidity ${input.totalLiquidityUsd.toFixed(0)} USD — capital likely looping.`,
    extra: {
      dailyVolumeUsd: input.dailyVolumeUsd,
      totalLiquidityUsd: input.totalLiquidityUsd,
      highThreshold: hi,
      mediumThreshold: med,
    },
  };
}

function liquidityConcentration(
  input: FakeLiquidityInput,
): DetectorSignal | null {
  if (input.liquidityProviders.length === 0) return null;
  const shares = topShares(
    input.liquidityProviders.map((p) => ({ usd: p.liquidityUsd })),
  );
  if (shares.total <= 0) return null;
  if (shares.top1 > DEFAULT_LP_TOP1_SHARE) {
    return {
      type: "LIQUIDITY_CONCENTRATION",
      severity: "HIGH",
      metric: shares.top1,
      baseline: DEFAULT_LP_TOP1_SHARE,
      description: `Top-1 liquidity provider controls ${(shares.top1 * 100).toFixed(1)}% of the declared TVL.`,
      extra: {
        top1Share: shares.top1,
        top3Share: shares.top3,
        totalLiquidityUsd: shares.total,
      },
    };
  }
  if (shares.top3 > DEFAULT_LP_TOP3_SHARE) {
    return {
      type: "LIQUIDITY_CONCENTRATION",
      severity: "MEDIUM",
      metric: shares.top3,
      baseline: DEFAULT_LP_TOP3_SHARE,
      description: `Top-3 liquidity providers control ${(shares.top3 * 100).toFixed(1)}% of the declared TVL.`,
      extra: {
        top1Share: shares.top1,
        top3Share: shares.top3,
        totalLiquidityUsd: shares.total,
      },
    };
  }
  return null;
}

function phantomVolume(input: FakeLiquidityInput): DetectorSignal | null {
  const minUsd = input.phantomVolumeMinUsd ?? DEFAULT_PHANTOM_VOLUME_MIN_USD;
  const m = phantomVolumeMetrics(input.volumeByWallet, DEFAULT_PHANTOM_TOP_N);
  if (m.totalUsd < minUsd) return null;
  if (m.share < DEFAULT_PHANTOM_SHARE) return null;
  return {
    type: "PHANTOM_VOLUME",
    severity: "HIGH",
    metric: m.share,
    baseline: DEFAULT_PHANTOM_SHARE,
    description: `Top ${DEFAULT_PHANTOM_TOP_N} wallets drive ${(m.share * 100).toFixed(1)}% of the ${m.totalUsd.toFixed(0)} USD daily volume.`,
    extra: {
      totalVolumeUsd: m.totalUsd,
      topWallets: m.wallets,
      topN: DEFAULT_PHANTOM_TOP_N,
      minVolumeUsd: minUsd,
    },
  };
}

function poolFragmentation(input: FakeLiquidityInput): DetectorSignal | null {
  const microcapMax = input.microcapLiquidityMax ?? DEFAULT_MICROCAP_MAX;
  if (input.totalLiquidityUsd >= microcapMax) return null;
  if (input.poolCount <= DEFAULT_FRAGMENTATION_POOL_COUNT) return null;
  return {
    type: "POOL_FRAGMENTATION",
    severity: "MEDIUM",
    metric: input.poolCount,
    baseline: DEFAULT_FRAGMENTATION_POOL_COUNT,
    description: `${input.poolCount} active pools on a microcap (${input.totalLiquidityUsd.toFixed(0)} USD TVL) — unusual fragmentation.`,
    extra: {
      poolCount: input.poolCount,
      microcapMaxUsd: microcapMax,
    },
  };
}

// ─── Public entry point ──────────────────────────────────────────────────

export function runFakeLiquidityDetector(
  input: FakeLiquidityInput,
): DetectorOutput {
  const started = performance.now();
  const signals: DetectorSignal[] = [];
  let score = 0;

  const vlm = volumeLiquidityMismatch(input);
  if (vlm) {
    signals.push(vlm);
    score += FAKE_LIQUIDITY_SUBSIGNAL_POINTS.VOLUME_LIQUIDITY_MISMATCH;
  }

  const lc = liquidityConcentration(input);
  if (lc) {
    signals.push(lc);
    score += FAKE_LIQUIDITY_SUBSIGNAL_POINTS.LIQUIDITY_CONCENTRATION;
  }

  const pv = phantomVolume(input);
  if (pv) {
    signals.push(pv);
    score += FAKE_LIQUIDITY_SUBSIGNAL_POINTS.PHANTOM_VOLUME;
  }

  const pf = poolFragmentation(input);
  if (pf) {
    signals.push(pf);
    score += FAKE_LIQUIDITY_SUBSIGNAL_POINTS.POOL_FRAGMENTATION;
  }

  score = Math.min(score, MAX_SCORE);

  const volRatio = volumeRatio(input.dailyVolumeUsd, input.totalLiquidityUsd);
  const lpShares = topShares(
    input.liquidityProviders.map((p) => ({ usd: p.liquidityUsd })),
  );
  const phantomInfo = phantomVolumeMetrics(
    input.volumeByWallet,
    DEFAULT_PHANTOM_TOP_N,
  );

  return {
    detectorType: "FAKE_LIQUIDITY",
    score,
    maxScore: MAX_SCORE,
    signals,
    evidence: {
      tokenAddress: input.tokenAddress,
      chain: input.chain,
      volumeRatio: volRatio,
      totalLiquidityUsd: input.totalLiquidityUsd,
      dailyVolumeUsd: input.dailyVolumeUsd,
      liquidityTop1Share: lpShares.top1,
      liquidityTop3Share: lpShares.top3,
      phantomShareTop5: phantomInfo.share,
      phantomVolumeUsd: phantomInfo.totalUsd,
      poolCount: input.poolCount,
    },
    durationMs: Math.max(0, Math.round(performance.now() - started)),
  };
}
