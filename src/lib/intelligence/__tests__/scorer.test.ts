import { describe, it, expect } from "vitest";
import {
  computeIntelligenceScore,
  type ObservationInput,
} from "../scorer";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeObs(overrides: Partial<ObservationInput> & { sourceSlug: string }): ObservationInput {
  return {
    ims: 50,
    ics: 0.5,
    riskClass: "HIGH",
    listIsActive: true,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("computeIntelligenceScore", () => {
  it("returns base score when no observations", () => {
    const result = computeIntelligenceScore([], 42);
    expect(result.adjustedScore).toBe(42);
    expect(result.rawDelta).toBe(0);
    expect(result.contributingSources).toEqual([]);
  });

  // ── Floor rule ──────────────────────────────────────────────────────────

  describe("floor 15 on sanction match", () => {
    it("applies floor 15 when OFAC match and base score < 15", () => {
      const obs = [makeObs({ sourceSlug: "ofac", riskClass: "SANCTION", ims: 100 })];
      const result = computeIntelligenceScore(obs, 5);
      expect(result.adjustedScore).toBe(15);
      expect(result.floorApplied).toBe(true);
      expect(result.hasSanction).toBe(true);
    });

    it("applies floor 15 when AMF match", () => {
      const obs = [makeObs({ sourceSlug: "amf", riskClass: "SANCTION", ims: 80 })];
      const result = computeIntelligenceScore(obs, 3);
      expect(result.adjustedScore).toBe(15);
      expect(result.floorApplied).toBe(true);
    });

    it("applies floor 15 when FCA match", () => {
      const obs = [makeObs({ sourceSlug: "fca", riskClass: "SANCTION", ims: 80 })];
      const result = computeIntelligenceScore(obs, 0);
      expect(result.adjustedScore).toBe(15);
      expect(result.floorApplied).toBe(true);
    });

    it("does NOT apply floor when no sanction", () => {
      const obs = [makeObs({ sourceSlug: "goplus", riskClass: "HIGH", ims: 80 })];
      const result = computeIntelligenceScore(obs, 5);
      expect(result.floorApplied).toBe(false);
    });

    it("does NOT apply floor when base score >= 15", () => {
      const obs = [makeObs({ sourceSlug: "ofac", riskClass: "SANCTION", ims: 100 })];
      const result = computeIntelligenceScore(obs, 50);
      expect(result.floorApplied).toBe(false);
      expect(result.adjustedScore).toBeGreaterThanOrEqual(50);
    });
  });

  // ── Ceiling rule ────────────────────────────────────────────────────────

  describe("ceiling 72 when IMS > 20 and ICS > 0.40", () => {
    it("caps score at 72 when conditions met", () => {
      const obs = [
        makeObs({ sourceSlug: "ofac", riskClass: "SANCTION", ims: 100, ics: 0.95 }),
        makeObs({ sourceSlug: "scamsniffer", riskClass: "HIGH", ims: 80, ics: 0.50 }),
      ];
      // High base + delta → would exceed 72
      const result = computeIntelligenceScore(obs, 80);
      expect(result.adjustedScore).toBeLessThanOrEqual(72);
      expect(result.ceilingApplied).toBe(true);
    });

    it("does NOT cap when IMS <= 20", () => {
      const obs = [makeObs({ sourceSlug: "goplus", ims: 10, ics: 0.50 })];
      const result = computeIntelligenceScore(obs, 80);
      expect(result.ceilingApplied).toBe(false);
    });

    it("does NOT cap when ICS <= 0.40", () => {
      const obs = [makeObs({ sourceSlug: "goplus", ims: 50, ics: 0.30 })];
      const result = computeIntelligenceScore(obs, 80);
      expect(result.ceilingApplied).toBe(false);
    });
  });

  // ── Dedup rule ──────────────────────────────────────────────────────────

  describe("dedup: goplus + scamsniffer + forta → winner max IMS", () => {
    it("only counts the highest IMS from tech group", () => {
      const obs = [
        makeObs({ sourceSlug: "goplus", ims: 30, ics: 0.3 }),
        makeObs({ sourceSlug: "scamsniffer", ims: 80, ics: 0.5 }),
        makeObs({ sourceSlug: "forta", ims: 50, ics: 0.4 }),
      ];
      const result = computeIntelligenceScore(obs, 40);
      expect(result.techWinner).toBe("scamsniffer");
      // Only 1 tech source contributes
      const techContributions = result.breakdown.filter(
        (b) => ["goplus", "scamsniffer", "forta"].includes(b.slug)
      );
      expect(techContributions).toHaveLength(1);
      expect(techContributions[0].slug).toBe("scamsniffer");
    });
  });

  // ── Stacking rule ─────────────────────────────────────────────────────

  describe("stacking: AMF + FCA + OFAC all contribute", () => {
    it("stacks all regulatory sources", () => {
      const obs = [
        makeObs({ sourceSlug: "ofac", riskClass: "SANCTION", ims: 100, ics: 0.95 }),
        makeObs({ sourceSlug: "amf", riskClass: "SANCTION", ims: 80, ics: 0.90 }),
        makeObs({ sourceSlug: "fca", riskClass: "SANCTION", ims: 80, ics: 0.85 }),
      ];
      const result = computeIntelligenceScore(obs, 50);
      expect(result.contributingSources).toContain("ofac");
      expect(result.contributingSources).toContain("amf");
      expect(result.contributingSources).toContain("fca");
      expect(result.breakdown).toHaveLength(3);
    });
  });

  // ── Hard-cap 0.20 ─────────────────────────────────────────────────────

  describe("intelligence weight hard-cap 0.20", () => {
    it("caps delta at 20% of base score", () => {
      const obs = [
        makeObs({ sourceSlug: "ofac", riskClass: "SANCTION", ims: 100, ics: 0.95 }),
      ];
      const result = computeIntelligenceScore(obs, 50);
      // Max delta = 50 * 0.20 = 10
      expect(result.cappedDelta).toBeLessThanOrEqual(10);
    });
  });

  // ── Inactive observations ─────────────────────────────────────────────

  it("ignores inactive observations", () => {
    const obs = [
      makeObs({ sourceSlug: "ofac", riskClass: "SANCTION", ims: 100, listIsActive: false }),
    ];
    const result = computeIntelligenceScore(obs, 50);
    expect(result.adjustedScore).toBe(50);
    expect(result.hasSanction).toBe(false);
  });

  // ── Score clamping ────────────────────────────────────────────────────

  it("clamps score to [0, 100]", () => {
    const obs = [makeObs({ sourceSlug: "ofac", riskClass: "SANCTION", ims: 100, ics: 0.2 })];
    const result = computeIntelligenceScore(obs, 99);
    expect(result.adjustedScore).toBeLessThanOrEqual(100);
    expect(result.adjustedScore).toBeGreaterThanOrEqual(0);
  });
});
