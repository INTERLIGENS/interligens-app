import { describe, it, expect, vi, beforeEach } from "vitest";

// Prisma must be mocked before the percentileCache module is imported, so
// that the module picks up our stub instead of the real client.
const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmCohortPercentile: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

// Import after the mock is in place.
import {
  getPercentiles,
  hardcodedPercentiles,
} from "@/lib/mm/engine/cohorts/percentileCache";

const row = (cohortKey: string, metric: string, sample: number, p99 = 999) => ({
  cohortKey,
  metricName: metric,
  schemaVersion: 1,
  p50: 10,
  p75: 20,
  p90: 50,
  p95: 100,
  p99,
  sampleSize: sample,
});

describe("getPercentiles", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("returns sourceKind=db when exact cohort has enough samples", async () => {
    findMany.mockResolvedValueOnce([
      row("sol:micro:new", "hhi", 500, 5_500),
      row("sol:micro:new", "gini", 500, 0.95),
    ]);
    const p = await getPercentiles("sol:micro:new");
    expect(p.sourceKind).toBe("db");
    expect(p.resolvedFromCohortKey).toBe("sol:micro:new");
    expect(p.metrics.hhi.p99).toBe(5_500);
    expect(p.sampleSize).toBe(500);
  });

  it("falls back to the parent cohort when exact is under-populated", async () => {
    // Exact cohort returns rows but under the min sample threshold
    findMany
      .mockResolvedValueOnce([row("sol:micro:new", "hhi", 10)])
      // Parent sol:micro has plenty of samples
      .mockResolvedValueOnce([row("sol:micro", "hhi", 300, 4_200)]);
    const p = await getPercentiles("sol:micro:new");
    expect(p.sourceKind).toBe("parent");
    expect(p.resolvedFromCohortKey).toBe("sol:micro");
    expect(p.metrics.hhi.p99).toBe(4_200);
  });

  it("walks all the way up to chain before giving up", async () => {
    // sol:micro:new empty, sol:micro empty, sol has data
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row("sol", "hhi", 1_000, 3_000)]);
    const p = await getPercentiles("sol:micro:new");
    expect(p.sourceKind).toBe("parent");
    expect(p.resolvedFromCohortKey).toBe("sol");
  });

  it("returns sourceKind=stub when nothing in DB", async () => {
    findMany.mockResolvedValue([]);
    const p = await getPercentiles("sol:micro:new");
    expect(p.sourceKind).toBe("stub");
    expect(p.sampleSize).toBe(0);
    expect(p.metrics.hhi.p99).toBeGreaterThan(0);
  });

  it("respects useDatabase=false and returns stub directly", async () => {
    findMany.mockResolvedValue([row("sol:micro:new", "hhi", 1_000)]);
    const p = await getPercentiles("sol:micro:new", undefined, {
      useDatabase: false,
    });
    expect(p.sourceKind).toBe("stub");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("applies custom minSampleSize", async () => {
    findMany
      .mockResolvedValueOnce([row("sol:micro:new", "hhi", 50)])
      .mockResolvedValueOnce([]);
    const p = await getPercentiles("sol:micro:new", undefined, {
      minSampleSize: 10,
    });
    expect(p.sourceKind).toBe("db"); // 50 ≥ 10
  });
});

describe("hardcodedPercentiles", () => {
  it("scales avgVolPerBuyer with liquidity tier", () => {
    const micro = hardcodedPercentiles("sol:micro:new");
    const large = hardcodedPercentiles("sol:large:mature");
    expect(large.metrics.avgVolPerBuyer.p99).toBeGreaterThan(
      micro.metrics.avgVolPerBuyer.p99,
    );
  });

  it("leaves unitless metrics (gini, ratios, shares) unscaled", () => {
    const micro = hardcodedPercentiles("sol:micro:new");
    const large = hardcodedPercentiles("sol:large:mature");
    expect(large.metrics.gini.p99).toBe(micro.metrics.gini.p99);
    expect(large.metrics.mirroredRatio.p99).toBe(micro.metrics.mirroredRatio.p99);
  });
});
