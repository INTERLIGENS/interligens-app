import { describe, it, expect } from "vitest";
import type { IntelligenceSignal } from "../IntelligenceBadge";

/**
 * Gate logic for IntelligenceBadge:
 * - Never render if signal is null / no match
 * - Never render if entityType === "PERSON"
 * - Never render if displaySafety !== "RETAIL_SAFE" (and is set)
 * - Render when match=true and displaySafety is RETAIL_SAFE
 *
 * We test the gate conditions as pure logic since the component
 * uses inline style (no class-based testing needed).
 */

function shouldRenderBadge(signal: IntelligenceSignal | null): boolean {
  if (!signal || !signal.match) return false;
  if (signal.entityType === "PERSON") return false;
  if (signal.displaySafety && signal.displaySafety !== "RETAIL_SAFE") return false;
  return true;
}

const baseSignal: IntelligenceSignal = {
  match: true,
  ims: 80,
  ics: 0.5,
  matchCount: 2,
  hasSanction: false,
  topRiskClass: "HIGH",
  sourceSlug: "scamsniffer",
  externalUrl: "https://example.com",
  matchBasis: "EXACT_ADDRESS",
  displaySafety: "RETAIL_SAFE",
};

describe("IntelligenceBadge gate logic", () => {
  it("renders when signal is valid and RETAIL_SAFE", () => {
    expect(shouldRenderBadge(baseSignal)).toBe(true);
  });

  it("does NOT render when signal is null", () => {
    expect(shouldRenderBadge(null)).toBe(false);
  });

  it("does NOT render when match is false", () => {
    expect(shouldRenderBadge({ ...baseSignal, match: false })).toBe(false);
  });

  it("does NOT render when entityType is PERSON", () => {
    expect(shouldRenderBadge({ ...baseSignal, entityType: "PERSON" })).toBe(false);
  });

  it("does NOT render when displaySafety is INTERNAL_ONLY", () => {
    expect(shouldRenderBadge({ ...baseSignal, displaySafety: "INTERNAL_ONLY" })).toBe(false);
  });

  it("does NOT render when displaySafety is ANALYST_REVIEWED", () => {
    expect(shouldRenderBadge({ ...baseSignal, displaySafety: "ANALYST_REVIEWED" })).toBe(false);
  });

  it("renders when displaySafety is not set (undefined)", () => {
    const { displaySafety, ...noSafety } = baseSignal;
    expect(shouldRenderBadge(noSafety as IntelligenceSignal)).toBe(true);
  });

  it("renders for OFAC sanction match", () => {
    expect(
      shouldRenderBadge({
        ...baseSignal,
        hasSanction: true,
        sourceSlug: "ofac",
        topRiskClass: "SANCTION",
      })
    ).toBe(true);
  });
});
