import { describe, it, expect } from "vitest";
import {
  buildMmEvidence,
  priorityFor,
} from "@/lib/mm/integration/evidence";
import type { MmRiskAssessment } from "@/lib/mm/adapter/types";
import type { MmStatus } from "@/lib/mm/types";

function mkAssessment(
  overrides: {
    entityStatus?: MmStatus | null;
    entityName?: string;
    entitySlug?: string;
    displayScore?: number;
    confidence?: "low" | "medium" | "high";
    coverage?: "low" | "medium" | "high";
    dominantDriver?: string;
    staleness?: "fresh" | "aging" | "stale";
  } = {},
): MmRiskAssessment {
  const entity =
    overrides.entityStatus === null
      ? null
      : {
          id: "e-1",
          slug: overrides.entitySlug ?? "gotbit",
          name: overrides.entityName ?? "Gotbit",
          status: (overrides.entityStatus ?? "CONVICTED") as MmStatus,
          riskBand: "RED" as const,
          jurisdiction: "US",
          workflow: "PUBLISHED",
          defaultScore: 95,
        };
  return {
    registry: {
      entity,
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
      dominantDriver: (overrides.dominantDriver ?? "REGISTRY") as
        | "REGISTRY"
        | "BEHAVIORAL"
        | "MIXED"
        | "NONE",
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

describe("priorityFor", () => {
  it("collapses to INFO when coverage=low or confidence=low", () => {
    expect(priorityFor(95, "low", "high")).toBe("INFO");
    expect(priorityFor(95, "high", "low")).toBe("INFO");
  });
  it("maps displayScore bands to priorities", () => {
    expect(priorityFor(95, "high", "high")).toBe("CRITICAL");
    expect(priorityFor(75, "high", "high")).toBe("HIGH");
    expect(priorityFor(50, "high", "high")).toBe("MEDIUM");
    expect(priorityFor(10, "high", "high")).toBe("INFO");
  });
});

describe("buildMmEvidence wording matrix", () => {
  const statuses: MmStatus[] = [
    "CONVICTED",
    "CHARGED",
    "SETTLED",
    "INVESTIGATED",
    "DOCUMENTED",
    "OBSERVED",
  ];
  const expectedFragment: Record<MmStatus, string> = {
    CONVICTED: "condamnée",
    CHARGED: "inculpée",
    SETTLED: "règlement",
    INVESTIGATED: "sous enquête",
    DOCUMENTED: "documentée",
    OBSERVED: "mentionnée",
  };

  for (const s of statuses) {
    it(`uses the ${s} wording when the registry resolves an entity`, () => {
      const e = buildMmEvidence({
        assessment: mkAssessment({ entityStatus: s, entityName: "ACME" }),
        scoreImpact: -20,
      });
      expect(e.claim).toContain("ACME");
      expect(e.claim.toLowerCase()).toContain(expectedFragment[s].toLowerCase());
      expect(e.badge).toBe("MM_FLAG");
      expect(e.source).toBe("INTERLIGENS_MM_TRACKER");
      expect(e.evidenceUrl).toBe("/mm/gotbit");
    });
  }

  it("falls back to a behavioral-only claim when no entity is attached", () => {
    const e = buildMmEvidence({
      assessment: mkAssessment({
        entityStatus: null,
        dominantDriver: "BEHAVIORAL",
        displayScore: 78,
      }),
      scoreImpact: -30,
    });
    expect(e.claim.toLowerCase()).toContain("sans attribution");
    expect(e.evidenceUrl).toBe("/mm");
  });

  it("propagates MM metadata fields on the evidence object", () => {
    const e = buildMmEvidence({
      assessment: mkAssessment({
        displayScore: 72,
        confidence: "medium",
        coverage: "medium",
        staleness: "aging",
      }),
      scoreImpact: -10,
    });
    expect(e.mmDisplayScore).toBe(72);
    expect(e.mmConfidence).toBe("medium");
    expect(e.mmCoverage).toBe("medium");
    expect(e.freshness).toBe("aging");
    expect(e.scoreImpact).toBe(-10);
  });
});
