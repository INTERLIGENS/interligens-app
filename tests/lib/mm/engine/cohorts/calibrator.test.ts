import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmAttribution: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
    mmCohortPercentile: {
      upsert: (...args: unknown[]) => upsert(...args),
    },
  },
}));

import {
  calibrateCohort,
  CALIBRATOR_METRICS,
  computePercentileBand,
  computePercentiles,
  percentile,
} from "@/lib/mm/engine/cohorts/calibrator";
import type { CalibratorInput } from "@/lib/mm/engine/types";

describe("percentile() helper", () => {
  it("interpolates between samples", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it("returns 0 on empty array", () => {
    expect(percentile([], 0.9)).toBe(0);
  });
});

describe("computePercentileBand", () => {
  it("returns a reasonable band on 100 samples", () => {
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    const band = computePercentileBand(xs);
    expect(band.p50).toBe(50.5);
    expect(band.p99).toBeCloseTo(99.01, 2);
  });

  it("ignores NaN and ±Infinity values", () => {
    const band = computePercentileBand([1, 2, Number.NaN, 3, Number.POSITIVE_INFINITY]);
    // With 3 valid samples (1,2,3), p99 interpolates between index 1 and 2
    // at fraction (n-1)*0.99 = 1.98 → 2 * 0.02 + 3 * 0.98 = 2.98.
    expect(band.p99).toBeCloseTo(2.98, 2);
  });
});

describe("computePercentiles across metrics", () => {
  it("computes all metrics provided on the inputs", () => {
    const inputs: CalibratorInput[] = [
      { tokenId: "A", chain: "SOLANA", activeWallets: [], metrics: { gini: 0.5, hhi: 1000 } },
      { tokenId: "B", chain: "SOLANA", activeWallets: [], metrics: { gini: 0.9, hhi: 3000 } },
    ];
    const bands = computePercentiles(inputs);
    expect(bands.gini.p99).toBeGreaterThan(0);
    expect(bands.hhi.p99).toBeGreaterThan(0);
  });
});

describe("calibrateCohort", () => {
  beforeEach(() => {
    findMany.mockReset();
    upsert.mockReset();
    upsert.mockResolvedValue({});
  });

  it("upserts one row per metric and reports sampleSize", async () => {
    findMany.mockResolvedValueOnce([]); // no flagged wallets
    const inputs: CalibratorInput[] = Array.from({ length: 20 }, (_, i) => ({
      tokenId: `T-${i}`,
      chain: "SOLANA",
      activeWallets: [`w-${i}`],
      metrics: {
        avgVolPerBuyer: 1_000 + i * 100,
        hhi: 500 + i * 50,
        gini: 0.3 + i * 0.01,
      },
    }));
    const r = await calibrateCohort("sol:small:fresh", inputs);
    expect(r.sampleSize).toBe(20);
    expect(r.excludedFlaggedCount).toBe(0);
    expect(r.metricsUpserted).toBe(CALIBRATOR_METRICS.length);
    expect(upsert).toHaveBeenCalledTimes(CALIBRATOR_METRICS.length);
  });

  it("excludes tokens with any flagged wallet (confidence ≥ 0.85)", async () => {
    findMany.mockResolvedValueOnce([{ walletAddress: "flagged-1" }]);
    const inputs: CalibratorInput[] = [
      {
        tokenId: "A",
        chain: "SOLANA",
        activeWallets: ["flagged-1", "normal"],
        metrics: { hhi: 9_999 },
      },
      {
        tokenId: "B",
        chain: "SOLANA",
        activeWallets: ["clean-1"],
        metrics: { hhi: 1_000 },
      },
    ];
    const r = await calibrateCohort("sol:micro:new", inputs, { dryRun: true });
    expect(r.excludedFlaggedCount).toBe(1);
    expect(r.sampleSize).toBe(1); // only B remains
  });

  it("dryRun mode does not touch the database", async () => {
    const r = await calibrateCohort(
      "sol:micro:new",
      [{ tokenId: "A", chain: "SOLANA", activeWallets: [], metrics: { hhi: 1_500 } }],
      { dryRun: true, flagged: new Set() },
    );
    expect(r.metricsUpserted).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("handles empty input gracefully", async () => {
    findMany.mockResolvedValueOnce([]);
    const r = await calibrateCohort("sol:micro:new", [], { dryRun: true });
    expect(r.sampleSize).toBe(0);
    for (const m of CALIBRATOR_METRICS) {
      expect(r.bands[m]).toEqual({ p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 });
    }
  });

  it("throws on empty cohortKey", async () => {
    await expect(
      calibrateCohort("", [], { dryRun: true }),
    ).rejects.toThrow(/cohortKey required/);
  });
});
