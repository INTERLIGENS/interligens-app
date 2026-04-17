import { describe, it, expect } from "vitest";
import {
  computeConfidence,
  hasHighSignal,
} from "@/lib/mm/engine/scoring/confidence";
import type { DetectorOutput } from "@/lib/mm/engine/types";

function det(score: number, severities: Array<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">): DetectorOutput {
  return {
    detectorType: "WASH_TRADING",
    score,
    maxScore: 30,
    signals: severities.map((s) => ({ type: "X", severity: s })),
    evidence: {},
    durationMs: 0,
  };
}

describe("hasHighSignal", () => {
  it("returns true only if at least one HIGH signal", () => {
    expect(hasHighSignal(det(10, ["MEDIUM"]))).toBe(false);
    expect(hasHighSignal(det(10, ["HIGH"]))).toBe(true);
    expect(hasHighSignal(null)).toBe(false);
  });
});

describe("computeConfidence", () => {
  it("3 core HIGH → high", () => {
    expect(
      computeConfidence([
        det(30, ["HIGH"]),
        det(25, ["HIGH"]),
        det(20, ["HIGH"]),
      ]),
    ).toBe("high");
  });

  it("2 core HIGH → medium", () => {
    expect(
      computeConfidence([
        det(30, ["HIGH"]),
        det(25, ["HIGH"]),
        det(20, ["MEDIUM"]),
      ]),
    ).toBe("medium");
  });

  it("1 core HIGH → low", () => {
    expect(computeConfidence([det(30, ["HIGH"]), null, null])).toBe("low");
  });

  it("no signals at all → low", () => {
    expect(computeConfidence([null, null, null])).toBe("low");
  });
});
