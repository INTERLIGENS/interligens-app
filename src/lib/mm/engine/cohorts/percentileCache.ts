// ─── Percentile cache (spec §7.6) ─────────────────────────────────────────
// Resolves cohort percentiles with a 3-step fallback chain:
//   1. Exact cohort in MmCohortPercentile with sampleSize ≥ minSample
//   2. Parent cohort (chain:tier:age → chain:tier → chain)
//   3. Hard-coded Phase 2 baseline (last resort)
//
// All reads are async. The hard-coded fallback preserves Phase 2 behaviour
// when a fresh database has no calibrated rows yet.

import { prisma } from "@/lib/prisma";
import type {
  CohortPercentiles,
  PercentileBand,
} from "../types";
import { parentCohortKey } from "./cohortKey";

const SCHEMA_VERSION = 1;
const MIN_SAMPLE_SIZE = 100;

// ─── Hard-coded fallback (copied from Phase 2 stub) ───────────────────────
// These values are deliberately coarse; they only apply when the Phase 3
// calibrator has not yet populated MmCohortPercentile for any ancestor cohort.

const HARDCODED_BANDS: Record<string, PercentileBand> = {
  avgVolPerBuyer: { p50: 1_500, p75: 4_000, p90: 12_000, p95: 25_000, p99: 80_000 },
  roundTripsPerDay: { p50: 0, p75: 1, p90: 3, p95: 6, p99: 15 },
  uniqueBuyersPerDay: { p50: 120, p75: 350, p90: 900, p95: 1_800, p99: 5_000 },
  mirroredRatio: { p50: 0.3, p75: 0.5, p90: 0.7, p95: 0.8, p99: 0.9 },
  clusterSize: { p50: 2, p75: 3, p90: 5, p95: 7, p99: 12 },
  top3Share: { p50: 0.25, p75: 0.4, p90: 0.55, p95: 0.65, p99: 0.8 },
  gini: { p50: 0.55, p75: 0.7, p90: 0.82, p95: 0.88, p99: 0.95 },
  hhi: { p50: 400, p75: 900, p90: 1_800, p95: 2_600, p99: 5_000 },
};

const LIQUIDITY_FACTOR: Record<string, number> = {
  micro: 0.5,
  small: 1.0,
  mid: 1.5,
  large: 2.5,
};

function scaleBand(base: PercentileBand, factor: number): PercentileBand {
  return {
    p50: base.p50 * factor,
    p75: base.p75 * factor,
    p90: base.p90 * factor,
    p95: base.p95 * factor,
    p99: base.p99 * factor,
  };
}

function hardcodedBands(cohortKey: string): Record<string, PercentileBand> {
  const tier = cohortKey.split(":")[1] ?? "small";
  const factor = LIQUIDITY_FACTOR[tier] ?? 1.0;
  const out: Record<string, PercentileBand> = {};
  for (const [k, v] of Object.entries(HARDCODED_BANDS)) {
    // Gini and ratios are unitless; do not scale by liquidity.
    out[k] = k === "gini" || k === "mirroredRatio" || k === "top3Share"
      ? v
      : scaleBand(v, factor);
  }
  return out;
}

export function hardcodedPercentiles(cohortKey: string): CohortPercentiles {
  return {
    cohortKey,
    metrics: hardcodedBands(cohortKey),
    sampleSize: 0,
    schemaVersion: SCHEMA_VERSION,
    sourceKind: "stub",
  };
}

// ─── Synchronous sync accessor (kept for Phase 2 call-sites) ──────────────

export function getCohortPercentilesSync(cohortKey: string): CohortPercentiles {
  return hardcodedPercentiles(cohortKey);
}

// ─── Async resolver (Phase 3) ─────────────────────────────────────────────

async function readCohortFromDb(
  key: string,
): Promise<{ bands: Record<string, PercentileBand>; sampleSize: number } | null> {
  const rows = await prisma.mmCohortPercentile.findMany({
    where: { cohortKey: key, schemaVersion: SCHEMA_VERSION },
  });
  if (rows.length === 0) return null;
  const bands: Record<string, PercentileBand> = {};
  let sampleSize = 0;
  for (const r of rows) {
    bands[r.metricName] = {
      p50: r.p50,
      p75: r.p75,
      p90: r.p90,
      p95: r.p95,
      p99: r.p99,
    };
    if (r.sampleSize > sampleSize) sampleSize = r.sampleSize;
  }
  return { bands, sampleSize };
}

export interface GetPercentilesOptions {
  /**
   * Override MIN_SAMPLE_SIZE for tests.
   */
  minSampleSize?: number;
  /**
   * Allow the resolver to call the database. Defaults to true. Set to false
   * in unit tests that must stay offline.
   */
  useDatabase?: boolean;
}

export async function getPercentiles(
  cohortKey: string,
  _metricName?: string,
  opts?: GetPercentilesOptions,
): Promise<CohortPercentiles> {
  const useDb = opts?.useDatabase ?? true;
  const minSample = opts?.minSampleSize ?? MIN_SAMPLE_SIZE;

  if (useDb) {
    // Try the exact cohort first, then walk up the fallback chain until we
    // find a row with enough samples.
    let cursor: string | null = cohortKey;
    const chain: string[] = [];
    while (cursor) {
      chain.push(cursor);
      const hit = await readCohortFromDb(cursor);
      if (hit && hit.sampleSize >= minSample) {
        return {
          cohortKey,
          metrics: hit.bands,
          sampleSize: hit.sampleSize,
          schemaVersion: SCHEMA_VERSION,
          sourceKind: cursor === cohortKey ? "db" : "parent",
          resolvedFromCohortKey: cursor,
        };
      }
      cursor = parentCohortKey(cursor);
    }
  }

  // Last-resort hard-coded fallback. The detectors stay fully operational
  // even on a freshly migrated database.
  return hardcodedPercentiles(cohortKey);
}

/**
 * Phase 2-compat helper kept alive so existing call-sites do not break.
 * Delegates to the new async resolver with DB access enabled.
 */
export async function getCohortPercentiles(
  cohortKey: string,
): Promise<CohortPercentiles> {
  return getPercentiles(cohortKey);
}
