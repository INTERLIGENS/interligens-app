import { describe, it, expect } from "vitest";
import {
  classifyDisplayReason,
  classifyDominantDriver,
} from "@/lib/mm/adapter/displayReason";
import type {
  AttributionSummary,
} from "@/lib/mm/adapter/types";

const attrHigh: AttributionSummary = {
  id: "a1",
  confidence: 0.95,
  method: "COURT_FILING",
  attributedAt: new Date().toISOString(),
  reviewerUserId: null,
};
const attrMed: AttributionSummary = { ...attrHigh, confidence: 0.8 };

describe("classifyDominantDriver", () => {
  it("returns NONE when both scores are effectively zero", () => {
    expect(classifyDominantDriver(0, 0)).toBe("NONE");
    expect(classifyDominantDriver(0, 15)).toBe("NONE");
  });
  it("returns BEHAVIORAL when only behavioral is non-trivial", () => {
    expect(classifyDominantDriver(0, 40)).toBe("BEHAVIORAL");
  });
  it("returns REGISTRY when only registry is non-zero (behavioral < 20)", () => {
    expect(classifyDominantDriver(90, 10)).toBe("REGISTRY");
  });
  it("returns MIXED when scores are close", () => {
    expect(classifyDominantDriver(55, 50)).toBe("MIXED");
  });
  it("returns the dominant when separation ≥ 15", () => {
    expect(classifyDominantDriver(90, 40)).toBe("REGISTRY");
    expect(classifyDominantDriver(30, 70)).toBe("BEHAVIORAL");
  });
});

describe("classifyDisplayReason", () => {
  it("NO_SIGNAL when driver is NONE", () => {
    expect(
      classifyDisplayReason({
        registryDrivenScore: 0,
        behaviorDrivenScore: 5,
        confidence: "low",
        attribution: null,
        entityStatus: null,
        dominantDriver: "NONE",
      }),
    ).toBe("NO_SIGNAL");
  });

  it("MIXED_REGISTRY_AND_PATTERN for MIXED driver", () => {
    expect(
      classifyDisplayReason({
        registryDrivenScore: 60,
        behaviorDrivenScore: 55,
        confidence: "medium",
        attribution: attrMed,
        entityStatus: "DOCUMENTED",
        dominantDriver: "MIXED",
      }),
    ).toBe("MIXED_REGISTRY_AND_PATTERN");
  });

  it("ENTITY_CONVICTED_ATTRIBUTED for CONVICTED + confidence ≥ 0.9", () => {
    expect(
      classifyDisplayReason({
        registryDrivenScore: 95,
        behaviorDrivenScore: 10,
        confidence: "high",
        attribution: attrHigh,
        entityStatus: "CONVICTED",
        dominantDriver: "REGISTRY",
      }),
    ).toBe("ENTITY_CONVICTED_ATTRIBUTED");
  });

  it("ENTITY_DOCUMENTED_ATTRIBUTED for lower-tier Registry contributions", () => {
    expect(
      classifyDisplayReason({
        registryDrivenScore: 60,
        behaviorDrivenScore: 10,
        confidence: "medium",
        attribution: attrMed,
        entityStatus: "DOCUMENTED",
        dominantDriver: "REGISTRY",
      }),
    ).toBe("ENTITY_DOCUMENTED_ATTRIBUTED");
  });

  it("BEHAVIORAL_PATTERN_HIGH for high confidence + behavioral ≥ 60", () => {
    expect(
      classifyDisplayReason({
        registryDrivenScore: 0,
        behaviorDrivenScore: 75,
        confidence: "high",
        attribution: null,
        entityStatus: null,
        dominantDriver: "BEHAVIORAL",
      }),
    ).toBe("BEHAVIORAL_PATTERN_HIGH");
  });

  it("BEHAVIORAL_PATTERN_MEDIUM for medium confidence + behavioral 40-59", () => {
    expect(
      classifyDisplayReason({
        registryDrivenScore: 0,
        behaviorDrivenScore: 50,
        confidence: "medium",
        attribution: null,
        entityStatus: null,
        dominantDriver: "BEHAVIORAL",
      }),
    ).toBe("BEHAVIORAL_PATTERN_MEDIUM");
  });

  it("BEHAVIORAL_INSUFFICIENT when behavioral < 40 or confidence low", () => {
    expect(
      classifyDisplayReason({
        registryDrivenScore: 0,
        behaviorDrivenScore: 35,
        confidence: "low",
        attribution: null,
        entityStatus: null,
        dominantDriver: "BEHAVIORAL",
      }),
    ).toBe("BEHAVIORAL_INSUFFICIENT");
  });
});
