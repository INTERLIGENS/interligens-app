import { describe, it, expect } from "vitest";
import {
  ageBucketOf,
  cohortKey,
  liquidityTierOf,
  parentCohortKey,
} from "@/lib/mm/engine/cohorts/cohortKey";
import { getCohortPercentilesSync } from "@/lib/mm/engine/cohorts/percentileCache";

describe("cohortKey", () => {
  it("encodes chain, liquidity tier and age bucket", () => {
    expect(cohortKey({ chain: "SOLANA", liquidityUsd: 50_000, ageDays: 3 })).toBe(
      "sol:micro:new",
    );
    expect(
      cohortKey({ chain: "ETHEREUM", liquidityUsd: 5_000_000, ageDays: 200 }),
    ).toBe("eth:mid:mature");
  });

  it("maps liquidity tiers at boundary values", () => {
    expect(liquidityTierOf(99_999)).toBe("micro");
    expect(liquidityTierOf(100_000)).toBe("small");
    expect(liquidityTierOf(999_999)).toBe("small");
    expect(liquidityTierOf(1_000_000)).toBe("mid");
    expect(liquidityTierOf(9_999_999)).toBe("mid");
    expect(liquidityTierOf(10_000_000)).toBe("large");
  });

  it("maps age buckets at boundary values", () => {
    expect(ageBucketOf(0)).toBe("new");
    expect(ageBucketOf(6)).toBe("new");
    expect(ageBucketOf(7)).toBe("fresh");
    expect(ageBucketOf(29)).toBe("fresh");
    expect(ageBucketOf(30)).toBe("established");
    expect(ageBucketOf(180)).toBe("mature");
  });

  it("parentCohortKey drops the most-specific segment", () => {
    expect(parentCohortKey("sol:micro:new")).toBe("sol:micro");
    expect(parentCohortKey("sol:micro")).toBe("sol");
    expect(parentCohortKey("sol")).toBeNull();
  });
});

describe("getCohortPercentilesSync (Phase 2 stub)", () => {
  it("returns a fully populated structure with known metrics", () => {
    const p = getCohortPercentilesSync("sol:micro:new");
    expect(p.sourceKind).toBe("stub");
    expect(p.metrics.avgVolPerBuyer.p99).toBeGreaterThan(0);
    expect(p.metrics.hhi.p99).toBeGreaterThan(0);
    expect(p.metrics.gini.p99).toBeGreaterThan(0);
    expect(p.schemaVersion).toBe(1);
  });

  it("scales avgVolPerBuyer by liquidity tier", () => {
    const micro = getCohortPercentilesSync("sol:micro:new");
    const large = getCohortPercentilesSync("sol:large:mature");
    expect(large.metrics.avgVolPerBuyer.p99).toBeGreaterThan(
      micro.metrics.avgVolPerBuyer.p99,
    );
  });
});
