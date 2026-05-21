import { describe, test, expect } from "vitest";
import { computeTriage } from "../triage";

describe("Casefile triage — V1", () => {
  test("never returns C in primary", () => {
    const cases = [
      {
        cexTouchpointDetected: [{}],
        amountEur: 100_000,
        obfuscationBreakpointCandidate: false,
      },
      { cexTouchpointDetected: [{}], amountEur: 50_000 },
      { cexTouchpointDetected: [{}], amountEur: 5_000 },
      { cexTouchpointDetected: [], amountEur: 0 },
    ];
    for (const draft of cases) {
      const r = computeTriage(draft);
      // Type-level guarantee already excludes C, but assert at runtime too.
      expect(r.primary).not.toBe("C");
      expect(["A", "B", "E"]).toContain(r.primary);
    }
  });

  test("A when no CEX touchpoint and obfuscation breakpoint present", () => {
    const r = computeTriage({
      cexTouchpointDetected: [],
      obfuscationBreakpointCandidate: true,
    });
    expect(r.primary).toBe("A");
  });

  test("B (low-value) when CEX touchpoint and amount < 5000", () => {
    const r = computeTriage({
      cexTouchpointDetected: [{}],
      amountEur: 100,
    });
    expect(r.primary).toBe("B");
    expect(r.potentialCivilReviewFlag).toBe(false);
  });

  test("potentialCivilReviewFlag is set when CEX + amount >= 5000", () => {
    const r = computeTriage({
      cexTouchpointDetected: [{}],
      amountEur: 50_000,
    });
    expect(r.potentialCivilReviewFlag).toBe(true);
    expect(r.primary).toBe("B");
    expect(r.potentialCivilReviewDescription).toBeDefined();
  });

  test("clusterFlag is additive and never replaces primary", () => {
    const r = computeTriage(
      { cexTouchpointDetected: [{}], amountEur: 1_000 },
      5,
    );
    expect(r.primary).toBe("B");
    expect(r.clusterFlag).toBe(true);
    expect(r.clusterFlagDescription).toContain("5");
  });

  test("clusterFlag stays false below threshold", () => {
    const r = computeTriage(
      { cexTouchpointDetected: [], obfuscationBreakpointCandidate: true },
      1,
    );
    expect(r.clusterFlag).toBe(false);
  });

  test("E when no CEX and no obfuscation breakpoint", () => {
    const r = computeTriage({
      cexTouchpointDetected: [],
      obfuscationBreakpointCandidate: false,
    });
    expect(r.primary).toBe("E");
  });
});
