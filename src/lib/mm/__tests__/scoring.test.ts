import { describe, it, expect } from "vitest";
import {
  computeRegistryDrivenScore,
  registryConfidenceFor,
} from "@/lib/mm/registry/scoring";

const conv = { status: "CONVICTED" as const, defaultScore: 95 };
const charged = { status: "CHARGED" as const, defaultScore: 82 };
const documented = { status: "DOCUMENTED" as const, defaultScore: 60 };
const observed = { status: "OBSERVED" as const, defaultScore: 0 };

const courtHigh = {
  attributionMethod: "COURT_FILING" as const,
  confidence: 0.95,
  revokedAt: null,
};

describe("computeRegistryDrivenScore", () => {
  it("returns 0 with no entity or attribution", () => {
    expect(computeRegistryDrivenScore({ entity: null, attribution: null })).toBe(0);
    expect(computeRegistryDrivenScore({ entity: conv, attribution: null })).toBe(0);
  });

  it("returns 0 when attribution is revoked", () => {
    const revoked = { ...courtHigh, revokedAt: new Date() };
    expect(computeRegistryDrivenScore({ entity: conv, attribution: revoked })).toBe(0);
  });

  it("returns 0 when confidence below status threshold", () => {
    const low = { ...courtHigh, confidence: 0.7 };
    expect(computeRegistryDrivenScore({ entity: conv, attribution: low })).toBe(0);
  });

  it("clamps CONVICTED default to its 90-100 range", () => {
    expect(
      computeRegistryDrivenScore({
        entity: { status: "CONVICTED", defaultScore: 200 },
        attribution: courtHigh,
      }),
    ).toBe(100);
    expect(
      computeRegistryDrivenScore({
        entity: { status: "CONVICTED", defaultScore: 50 },
        attribution: courtHigh,
      }),
    ).toBe(90);
  });

  it("returns defaultScore inside range", () => {
    expect(computeRegistryDrivenScore({ entity: charged, attribution: courtHigh })).toBe(
      82,
    );
    expect(
      computeRegistryDrivenScore({ entity: documented, attribution: courtHigh }),
    ).toBe(60);
  });

  it("caps INFERRED_CLUSTER contribution to 70 even on CONVICTED", () => {
    const inferred = {
      attributionMethod: "INFERRED_CLUSTER" as const,
      confidence: 0.7,
      revokedAt: null,
    };
    expect(computeRegistryDrivenScore({ entity: conv, attribution: inferred })).toBe(0);
    // raise confidence to pass the CONVICTED 0.9 threshold — still capped at 70
    const inferredEdge = { ...inferred, confidence: 0.9 };
    expect(
      computeRegistryDrivenScore({ entity: conv, attribution: inferredEdge }),
    ).toBe(70);
  });

  it("OBSERVED contributes 0 even with high confidence", () => {
    expect(computeRegistryDrivenScore({ entity: observed, attribution: courtHigh })).toBe(
      0,
    );
  });
});

describe("registryConfidenceFor", () => {
  it("CONVICTED + confidence 0.95 → high", () => {
    expect(registryConfidenceFor({ entity: conv, attribution: courtHigh })).toBe("high");
  });

  it("DOCUMENTED + 0.8 → medium", () => {
    expect(
      registryConfidenceFor({
        entity: documented,
        attribution: { ...courtHigh, confidence: 0.8 },
      }),
    ).toBe("medium");
  });

  it("OBSERVED → low regardless", () => {
    expect(registryConfidenceFor({ entity: observed, attribution: courtHigh })).toBe(
      "low",
    );
  });

  it("no attribution → low", () => {
    expect(registryConfidenceFor({ entity: conv, attribution: null })).toBe("low");
  });
});
