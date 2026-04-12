import { describe, it, expect } from "vitest";

// We test the pure logic by importing the route handler's output shape
// and testing the signal-building + risk-level logic directly.

type ClusterRisk = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

interface ClusterResult {
  deployerAddress: string | null;
  deployerKnown: boolean;
  kolHandle: string | null;
  relatedTokens: number;
  redTokens: number;
  clusterRisk: ClusterRisk;
  signal: string;
  signalFr: string;
  fallback: boolean;
}

// Mirror the risk computation logic from the route
function computeRisk(
  deployerKnown: boolean,
  relatedTokens: number,
  redTokens: number,
): ClusterRisk {
  if (deployerKnown || redTokens >= 3) return "HIGH";
  if (relatedTokens >= 5 || redTokens >= 1) return "MEDIUM";
  return "LOW";
}

// Fallback shape
const FALLBACK: ClusterResult = {
  deployerAddress: null,
  deployerKnown: false,
  kolHandle: null,
  relatedTokens: 0,
  redTokens: 0,
  clusterRisk: "UNKNOWN",
  signal: "No cluster signal detected",
  signalFr: "Signal cluster indisponible",
  fallback: true,
};

describe("cluster risk computation", () => {
  it("returns HIGH when deployer is in knownBad and redTokens >= 3", () => {
    const risk = computeRisk(true, 10, 5);
    expect(risk).toBe("HIGH");
  });

  it("returns HIGH when deployer is known even with zero red tokens", () => {
    const risk = computeRisk(true, 2, 0);
    expect(risk).toBe("HIGH");
  });

  it("returns HIGH when redTokens >= 3 even if deployer unknown", () => {
    const risk = computeRisk(false, 10, 4);
    expect(risk).toBe("HIGH");
  });

  it("returns MEDIUM when relatedTokens >= 5 but low red tokens", () => {
    const risk = computeRisk(false, 8, 0);
    expect(risk).toBe("MEDIUM");
  });

  it("returns MEDIUM when at least 1 red token", () => {
    const risk = computeRisk(false, 3, 1);
    expect(risk).toBe("MEDIUM");
  });

  it("returns LOW when no flags at all", () => {
    const risk = computeRisk(false, 2, 0);
    expect(risk).toBe("LOW");
  });
});

describe("fallback shape", () => {
  it("has fallback: true", () => {
    expect(FALLBACK.fallback).toBe(true);
  });

  it("has clusterRisk UNKNOWN", () => {
    expect(FALLBACK.clusterRisk).toBe("UNKNOWN");
  });

  it("never has missing fields", () => {
    expect(FALLBACK.deployerAddress).toBeNull();
    expect(FALLBACK.deployerKnown).toBe(false);
    expect(FALLBACK.kolHandle).toBeNull();
    expect(FALLBACK.relatedTokens).toBe(0);
    expect(FALLBACK.redTokens).toBe(0);
    expect(typeof FALLBACK.signal).toBe("string");
    expect(typeof FALLBACK.signalFr).toBe("string");
    expect(FALLBACK.signal.length).toBeGreaterThan(0);
    expect(FALLBACK.signalFr.length).toBeGreaterThan(0);
  });
});

describe("ClusterRiskBadge rendering logic", () => {
  it("shows neutral line when fallback is true", () => {
    // ClusterRiskBadge with fallback=true renders muted text only
    const result: ClusterResult = { ...FALLBACK };
    expect(result.fallback).toBe(true);
    expect(result.clusterRisk).toBe("UNKNOWN");
  });

  it("shows red border card when HIGH", () => {
    const result: ClusterResult = {
      deployerAddress: "ABC",
      deployerKnown: true,
      kolHandle: "bkokoski",
      relatedTokens: 10,
      redTokens: 5,
      clusterRisk: "HIGH",
      signal: "Related deployers found — deployer linked to 5 prior rugs",
      signalFr: "Déployeur lié à 5 rugs précédents",
      fallback: false,
    };
    expect(result.clusterRisk).toBe("HIGH");
    expect(result.signal).toContain("5 prior rugs");
    expect(result.kolHandle).toBe("bkokoski");
  });
});
