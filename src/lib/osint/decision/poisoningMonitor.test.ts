/**
 * src/lib/osint/decision/poisoningMonitor.test.ts
 * SPRINT A — détection de signalement coordonné (pure, read-only, injecté).
 */
import { describe, it, expect } from "vitest";
import { evaluatePoisoning, hexHamming } from "./poisoningMonitor";
import type { PriorSubmissionLite } from "./poisoningMonitor";
import { SourceTrustTier } from "../contracts";

const NOW = "2026-06-29T12:00:00.000Z";

function prior(over: Partial<PriorSubmissionLite> = {}): PriorSubmissionLite {
  return {
    imageSha256: "sha_" + Math.floor(over.ingestedAt ? 1 : 0),
    perceptualHash: "ffff0000ffff0000",
    kolHandle: "bkokoski",
    trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
    verified: false,
    ingestedAt: "2026-06-29T10:00:00.000Z",
    ...over,
  };
}

describe("evaluatePoisoning", () => {
  it("hexHamming counts differing bits, Infinity if incomparable", () => {
    expect(hexHamming("0000", "0000")).toBe(0);
    expect(hexHamming("0000", "000f")).toBe(4);
    expect(hexHamming("0000", null)).toBe(Number.POSITIVE_INFINITY);
    expect(hexHamming("0000", "00")).toBe(Number.POSITIVE_INFINITY);
  });

  it("3 anonymous similar unverified submits on same KOL → cluster flag, suppress boost", () => {
    const priors = [
      prior({ imageSha256: "s1", perceptualHash: "ffff0000ffff0000" }),
      prior({ imageSha256: "s2", perceptualHash: "ffff0000ffff0001" }), // 1 bit off
    ];
    const v = evaluatePoisoning({
      kolHandle: "bkokoski",
      perceptualHash: "ffff0000ffff0000",
      trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
      priorSubmissions: priors,
      now: NOW,
    });
    expect(v.cluster).toBe(true);
    expect(v.flag).toBe("possible_coordinated_reporting");
    expect(v.clusterSize).toBe(3);
    expect(v.suppressConfidenceBoost).toBe(true);
    expect(v.members).toEqual(["s1", "s2"]);
  });

  it("verified prior submissions do NOT feed the cluster", () => {
    const priors = [
      prior({ imageSha256: "s1", verified: true }),
      prior({ imageSha256: "s2", verified: true }),
    ];
    const v = evaluatePoisoning({
      kolHandle: "bkokoski",
      perceptualHash: "ffff0000ffff0000",
      trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
      priorSubmissions: priors,
      now: NOW,
    });
    expect(v.cluster).toBe(false);
    expect(v.suppressConfidenceBoost).toBe(false);
  });

  it("investigator-tier priors do NOT feed the cluster", () => {
    const priors = [
      prior({ imageSha256: "s1", trustTier: SourceTrustTier.INVESTIGATOR }),
      prior({ imageSha256: "s2", trustTier: SourceTrustTier.INVESTIGATOR }),
    ];
    const v = evaluatePoisoning({
      kolHandle: "bkokoski",
      perceptualHash: "ffff0000ffff0000",
      trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
      priorSubmissions: priors,
      now: NOW,
    });
    expect(v.cluster).toBe(false);
  });

  it("different KOL handle is not coordinated against this target", () => {
    const priors = [
      prior({ imageSha256: "s1", kolHandle: "someoneelse" }),
      prior({ imageSha256: "s2", kolHandle: "another" }),
    ];
    const v = evaluatePoisoning({
      kolHandle: "bkokoski",
      perceptualHash: "ffff0000ffff0000",
      trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
      priorSubmissions: priors,
      now: NOW,
    });
    expect(v.cluster).toBe(false);
  });

  it("dissimilar captures (large pHash distance) do not cluster", () => {
    const priors = [
      prior({ imageSha256: "s1", perceptualHash: "0000ffff0000ffff" }),
      prior({ imageSha256: "s2", perceptualHash: "0f0f0f0f0f0f0f0f" }),
    ];
    const v = evaluatePoisoning({
      kolHandle: "bkokoski",
      perceptualHash: "ffff0000ffff0000",
      trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
      priorSubmissions: priors,
      now: NOW,
    });
    expect(v.cluster).toBe(false);
  });

  it("submits outside the time window are excluded", () => {
    const priors = [
      prior({ imageSha256: "s1", ingestedAt: "2026-06-20T00:00:00.000Z" }),
      prior({ imageSha256: "s2", ingestedAt: "2026-06-19T00:00:00.000Z" }),
    ];
    const v = evaluatePoisoning({
      kolHandle: "bkokoski",
      perceptualHash: "ffff0000ffff0000",
      trustTier: SourceTrustTier.ANONYMOUS_RETAIL,
      priorSubmissions: priors,
      now: NOW,
      windowHours: 72,
    });
    expect(v.cluster).toBe(false);
  });
});
