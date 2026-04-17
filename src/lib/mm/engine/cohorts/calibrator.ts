// ─── Cohort calibrator (spec §7.6) ────────────────────────────────────────
// Computes percentiles per (cohortKey, metric) from a batch of per-token
// metrics and persists them to MmCohortPercentile. Tokens whose active
// wallets include a high-confidence Registry attribution are excluded from
// the sample to avoid contaminating the baseline.
//
// The percentile math is a pure function (computePercentiles). Database I/O
// is confined to the exclusion lookup and the upsert loop.

import { prisma } from "@/lib/prisma";
import type {
  CalibratorInput,
  CalibratorMetric,
  CalibratorResult,
  PercentileBand,
} from "../types";

const SCHEMA_VERSION = 1;
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

export const CALIBRATOR_METRICS: CalibratorMetric[] = [
  "avgVolPerBuyer",
  "roundTripsPerDay",
  "mirroredRatio",
  "clusterSize",
  "top3Share",
  "gini",
  "hhi",
];

// ─── Pure percentile helpers ──────────────────────────────────────────────

export function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function computePercentileBand(values: number[]): PercentileBand {
  const clean = values
    .filter((v) => typeof v === "number" && Number.isFinite(v))
    .slice()
    .sort((a, b) => a - b);
  return {
    p50: percentile(clean, 0.5),
    p75: percentile(clean, 0.75),
    p90: percentile(clean, 0.9),
    p95: percentile(clean, 0.95),
    p99: percentile(clean, 0.99),
  };
}

export function computePercentiles(
  inputs: CalibratorInput[],
  metrics: CalibratorMetric[] = CALIBRATOR_METRICS,
): Record<CalibratorMetric, PercentileBand> {
  const out = {} as Record<CalibratorMetric, PercentileBand>;
  for (const metric of metrics) {
    const values: number[] = [];
    for (const input of inputs) {
      const v = input.metrics[metric];
      if (typeof v === "number" && Number.isFinite(v)) values.push(v);
    }
    out[metric] = computePercentileBand(values);
  }
  return out;
}

// ─── Flagged-wallet exclusion ─────────────────────────────────────────────

export async function flaggedWallets(
  allWallets: string[],
): Promise<Set<string>> {
  if (allWallets.length === 0) return new Set();
  const attributions = await prisma.mmAttribution.findMany({
    where: {
      walletAddress: { in: Array.from(new Set(allWallets)) },
      revokedAt: null,
      confidence: { gte: HIGH_CONFIDENCE_THRESHOLD },
    },
    select: { walletAddress: true },
  });
  return new Set(attributions.map((a) => a.walletAddress));
}

function excludeFlagged(
  inputs: CalibratorInput[],
  flagged: Set<string>,
): { kept: CalibratorInput[]; excludedCount: number } {
  if (flagged.size === 0) return { kept: inputs, excludedCount: 0 };
  const kept: CalibratorInput[] = [];
  let excluded = 0;
  for (const i of inputs) {
    const hit = i.activeWallets.some((w) => flagged.has(w));
    if (hit) excluded += 1;
    else kept.push(i);
  }
  return { kept, excludedCount: excluded };
}

// ─── Public entry point ───────────────────────────────────────────────────

export interface CalibrateCohortOptions {
  metrics?: CalibratorMetric[];
  /**
   * If true, skip persistence and return the computed bands only. Useful for
   * tests and dry-runs.
   */
  dryRun?: boolean;
  /**
   * Optional pre-computed flagged-wallet set — lets tests control exclusion
   * without hitting the database.
   */
  flagged?: Set<string>;
}

export async function calibrateCohort(
  cohortKey: string,
  inputs: CalibratorInput[],
  opts?: CalibrateCohortOptions,
): Promise<CalibratorResult> {
  if (!cohortKey.trim()) throw new Error("calibrateCohort: cohortKey required");
  const metrics = opts?.metrics ?? CALIBRATOR_METRICS;

  const allWallets = inputs.flatMap((i) => i.activeWallets);
  // The DB lookup happens even in dryRun so that calibration numbers match
  // what would be persisted. Callers that must stay fully offline can pass
  // `flagged` explicitly (that path wins).
  const flagged = opts?.flagged ?? (await flaggedWallets(allWallets));
  const { kept, excludedCount } = excludeFlagged(inputs, flagged);

  const bands = computePercentiles(kept, metrics) as Record<
    CalibratorMetric,
    PercentileBand
  >;

  if (opts?.dryRun) {
    return {
      cohortKey,
      metricsUpserted: 0,
      sampleSize: kept.length,
      excludedFlaggedCount: excludedCount,
      bands,
    };
  }

  let upserted = 0;
  for (const metric of metrics) {
    const band = bands[metric];
    await prisma.mmCohortPercentile.upsert({
      where: {
        cohortKey_metricName_schemaVersion: {
          cohortKey,
          metricName: metric,
          schemaVersion: SCHEMA_VERSION,
        },
      },
      update: {
        p50: band.p50,
        p75: band.p75,
        p90: band.p90,
        p95: band.p95,
        p99: band.p99,
        sampleSize: kept.length,
        excludedFlaggedCount: excludedCount,
        computedAt: new Date(),
      },
      create: {
        cohortKey,
        metricName: metric,
        schemaVersion: SCHEMA_VERSION,
        p50: band.p50,
        p75: band.p75,
        p90: band.p90,
        p95: band.p95,
        p99: band.p99,
        sampleSize: kept.length,
        excludedFlaggedCount: excludedCount,
      },
    });
    upserted += 1;
  }

  return {
    cohortKey,
    metricsUpserted: upserted,
    sampleSize: kept.length,
    excludedFlaggedCount: excludedCount,
    bands,
  };
}
