import { describe, it, expect } from "vitest";
import {
  applyMmCapToTigerScore,
} from "@/lib/mm/integration/tigerScoreAdapter";
import type { MmRiskAssessment } from "@/lib/mm/adapter/types";

const ENV_ON: Record<string, string | undefined> = { MM_INTEGRATION_LIVE: "true" };
const ENV_OFF: Record<string, string | undefined> = {};

function mk(
  overrides: {
    displayScore?: number;
    confidence?: "low" | "medium" | "high";
    coverage?: "low" | "medium" | "high";
    staleness?: "fresh" | "aging" | "stale";
    entity?: boolean;
  } = {},
): MmRiskAssessment {
  return {
    registry: {
      entity: overrides.entity === false
        ? null
        : {
            id: "e-1",
            slug: "gotbit",
            name: "Gotbit",
            status: "CONVICTED",
            riskBand: "RED",
            jurisdiction: "US",
            workflow: "PUBLISHED",
            defaultScore: overrides.displayScore ?? 95,
          },
      attribution: null,
      registryDrivenScore: overrides.displayScore ?? 95,
    },
    engine: {
      behaviorDrivenScore: 0,
      rawBehaviorScore: 0,
      confidence: overrides.confidence ?? "high",
      coverage: overrides.coverage ?? "high",
      signals: [],
      detectorBreakdown: {
        washTrading: null,
        cluster: null,
        concentration: null,
        fakeLiquidity: null,
        priceAsymmetry: null,
        postListingPump: null,
      },
      capsApplied: [],
      coOccurrence: { admitted: [], gatedOut: [] },
      cohortKey: null,
      cohortPercentiles: null,
    },
    overall: {
      displayScore: overrides.displayScore ?? 95,
      band: "RED",
      dominantDriver: "REGISTRY",
      displayReason: "ENTITY_CONVICTED_ATTRIBUTED",
      disclaimer: "",
      freshness: {
        computedAt: "2026-04-17T00:00:00.000Z",
        ageMinutes: 10,
        staleness: overrides.staleness ?? "fresh",
      },
    },
    subjectType: "TOKEN",
    subjectId: "mint-1",
    chain: "SOLANA",
    scanRunId: "run-1",
    schemaVersion: 1,
    computedAt: "2026-04-17T00:00:00.000Z",
    source: "compute",
  };
}

describe("applyMmCapToTigerScore — feature flag off", () => {
  it("returns the tiger score untouched when the flag is off", () => {
    const r = applyMmCapToTigerScore(85, mk({ displayScore: 95 }), { env: ENV_OFF });
    expect(r.adjustedScore).toBe(85);
    expect(r.capApplied).toBe(false);
    expect(r.capReason).toBe("flag_off");
    expect(r.evidence).toBeNull();
  });
});

describe("applyMmCapToTigerScore — cap rules (spec §11.2)", () => {
  it("caps to 30 for displayScore ≥ 90 with high confidence and non-low coverage", () => {
    const r = applyMmCapToTigerScore(
      85,
      mk({ displayScore: 95, confidence: "high", coverage: "high" }),
      { env: ENV_ON },
    );
    expect(r.adjustedScore).toBe(30);
    expect(r.capApplied).toBe(true);
    expect(r.capReason).toContain("cap_30");
    expect(r.evidence?.priority).toBe("CRITICAL");
  });

  it("caps to 50 for displayScore 70-89 with high confidence", () => {
    const r = applyMmCapToTigerScore(
      80,
      mk({ displayScore: 78, confidence: "high" }),
      { env: ENV_ON },
    );
    expect(r.adjustedScore).toBe(50);
    expect(r.capReason).toContain("cap_50");
  });

  it("applies a -10 penalty for displayScore 40-69 at medium+ confidence", () => {
    const r = applyMmCapToTigerScore(
      55,
      mk({ displayScore: 55, confidence: "medium" }),
      { env: ENV_ON },
    );
    expect(r.adjustedScore).toBe(45);
    expect(r.capReason).toContain("penalty_minus_10");
  });

  it("emits INFO-only evidence when displayScore is in 20-39 band", () => {
    const r = applyMmCapToTigerScore(
      80,
      mk({ displayScore: 30, confidence: "high" }),
      { env: ENV_ON },
    );
    expect(r.adjustedScore).toBe(80);
    expect(r.capApplied).toBe(false);
    expect(r.evidence?.priority).toBe("INFO");
  });

  it("never caps when coverage=low, even for a severe displayScore", () => {
    const r = applyMmCapToTigerScore(
      80,
      mk({ displayScore: 95, confidence: "high", coverage: "low" }),
      { env: ENV_ON },
    );
    expect(r.capApplied).toBe(false);
    expect(r.capReason).toBe("coverage_low_info_only");
    expect(r.evidence?.priority).toBe("INFO");
  });

  it("never caps when confidence=low", () => {
    const r = applyMmCapToTigerScore(
      80,
      mk({ displayScore: 95, confidence: "low", coverage: "high" }),
      { env: ENV_ON },
    );
    expect(r.capApplied).toBe(false);
    expect(r.capReason).toBe("confidence_low_info_only");
  });

  it("attenuates the cap by 50% when staleness=stale", () => {
    // Original cap would take 85 → 30. Half-attenuated → 30 + (85-30)*0.5 = 57
    const r = applyMmCapToTigerScore(
      85,
      mk({ displayScore: 95, confidence: "high", staleness: "stale" }),
      { env: ENV_ON },
    );
    expect(r.adjustedScore).toBeGreaterThan(30);
    expect(r.adjustedScore).toBeLessThan(85);
    expect(r.disclaimer).toContain("atténué");
    expect(r.capReason).toContain("stale_attenuated");
  });

  it("halves a -10 penalty when staleness=stale", () => {
    // Penalty -10 becomes -5 when stale: 55 → 50
    const r = applyMmCapToTigerScore(
      55,
      mk({ displayScore: 50, confidence: "medium", staleness: "stale" }),
      { env: ENV_ON },
    );
    expect(r.adjustedScore).toBe(50);
    expect(r.disclaimer).toContain("atténué");
  });

  it("emits INFO evidence when the current score is already below the cap", () => {
    const r = applyMmCapToTigerScore(
      20,
      mk({ displayScore: 95, confidence: "high" }),
      { env: ENV_ON },
    );
    expect(r.adjustedScore).toBe(20);
    expect(r.capApplied).toBe(false);
    expect(r.capReason).toBe("already_below_cap");
  });

  it("converts a triggered cap to INFO when overridden=true", () => {
    const r = applyMmCapToTigerScore(
      85,
      mk({ displayScore: 95, confidence: "high" }),
      { env: ENV_ON, overridden: true },
    );
    expect(r.capApplied).toBe(false);
    expect(r.capReason).toBe("admin_override");
    expect(r.adjustedScore).toBe(85);
    expect(r.evidence?.priority).toBe("INFO");
  });

  it("clamps negative / non-finite tiger scores to [0,100]", () => {
    const neg = applyMmCapToTigerScore(-10, mk(), { env: ENV_ON });
    expect(neg.adjustedScore).toBeGreaterThanOrEqual(0);
    const nan = applyMmCapToTigerScore(Number.NaN, mk(), { env: ENV_ON });
    expect(nan.adjustedScore).toBe(0);
  });
});
