import { describe, it, expect } from "vitest";
import {
  computeBehaviorDrivenScore,
  ENGINE_CAPS,
} from "@/lib/mm/engine/scoring/behaviorDrivenScore";
import type { DetectorOutput } from "@/lib/mm/engine/types";

function det(
  type: DetectorOutput["detectorType"],
  score: number,
  high = false,
): DetectorOutput {
  return {
    detectorType: type,
    score,
    maxScore: 100,
    signals: high
      ? [{ type: "X", severity: "HIGH" }]
      : score > 0
        ? [{ type: "X", severity: "MEDIUM" }]
        : [],
    evidence: {},
    durationMs: 0,
  };
}

describe("computeBehaviorDrivenScore aggregation", () => {
  it("sums detector scores when no caps fire", () => {
    const out = computeBehaviorDrivenScore({
      detectors: {
        washTrading: det("WASH_TRADING", 30, true),
        cluster: det("CLUSTER_COORDINATION", 25, true),
        concentration: det("CONCENTRATION_ABNORMALITY", 20, true),
      },
      walletAgeDays: 30,
      confidence: "high",
      coverage: "high",
    });
    expect(out.rawScore).toBe(75);
    expect(out.score).toBe(75);
    expect(out.capsApplied).toEqual([]);
  });

  it("enforces the 90 engine ceiling even with inflated inputs", () => {
    const out = computeBehaviorDrivenScore({
      detectors: {
        washTrading: det("WASH_TRADING", 60, true),
        cluster: det("CLUSTER_COORDINATION", 25, true),
        concentration: det("CONCENTRATION_ABNORMALITY", 20, true),
      },
      walletAgeDays: 30,
      confidence: "high",
      coverage: "high",
    });
    expect(out.rawScore).toBe(105);
    expect(out.score).toBe(ENGINE_CAPS.PATTERN_ENGINE_HARD_CEILING);
    expect(out.capsApplied).toContain(
      `engine_hard_ceiling:${ENGINE_CAPS.PATTERN_ENGINE_HARD_CEILING}`,
    );
  });

  it("caps at 39 when fewer than 2 core detectors emit a HIGH signal", () => {
    const out = computeBehaviorDrivenScore({
      detectors: {
        washTrading: det("WASH_TRADING", 25, true),
        cluster: det("CLUSTER_COORDINATION", 20, false),
        concentration: det("CONCENTRATION_ABNORMALITY", 15, false),
      },
      walletAgeDays: 30,
      confidence: "medium",
      coverage: "medium",
    });
    expect(out.rawScore).toBe(60);
    expect(out.score).toBe(ENGINE_CAPS.CAP_LESS_THAN_2_CORE);
    expect(out.capsApplied.some((c) => c.startsWith("cap_less_than_2_core"))).toBe(true);
  });

  it("caps at 59 when wallet age < 7 days even with all detectors firing", () => {
    const out = computeBehaviorDrivenScore({
      detectors: {
        washTrading: det("WASH_TRADING", 30, true),
        cluster: det("CLUSTER_COORDINATION", 25, true),
        concentration: det("CONCENTRATION_ABNORMALITY", 20, true),
      },
      walletAgeDays: 3,
      confidence: "high",
      coverage: "high",
    });
    expect(out.score).toBe(ENGINE_CAPS.CAP_WALLET_LT_7D);
    expect(out.capsApplied.some((c) => c.startsWith("cap_wallet_age_lt_7d"))).toBe(true);
  });

  it("caps at 49 when coverage is low", () => {
    const out = computeBehaviorDrivenScore({
      detectors: {
        washTrading: det("WASH_TRADING", 30, true),
        cluster: det("CLUSTER_COORDINATION", 25, true),
        concentration: det("CONCENTRATION_ABNORMALITY", 20, true),
      },
      walletAgeDays: 200,
      confidence: "high",
      coverage: "low",
    });
    expect(out.score).toBe(ENGINE_CAPS.CAP_COVERAGE_LOW);
  });

  it("returns 0 when no detectors ran", () => {
    const out = computeBehaviorDrivenScore({
      detectors: {
        washTrading: null,
        cluster: null,
        concentration: null,
      },
    });
    expect(out.rawScore).toBe(0);
    expect(out.score).toBe(0);
  });
});
