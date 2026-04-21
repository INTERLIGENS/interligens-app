import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock setup ───────────────────────────────────────────────────────────
// We mock prisma, the registry accessors, and the scan-run persistence layer
// so that the adapter runs entirely in-memory and deterministic.

const mmScoreFindUnique = vi.fn();
const mmScoreUpsert = vi.fn();
const mmCohortPercentileFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmScore: {
      findUnique: (...args: unknown[]) => mmScoreFindUnique(...args),
      upsert: (...args: unknown[]) => mmScoreUpsert(...args),
      findFirst: vi.fn(async () => null),
    },
    mmCohortPercentile: {
      findMany: (...args: unknown[]) => mmCohortPercentileFindMany(...args),
    },
  },
}));

const lookupAttribution = vi.fn();
vi.mock("@/lib/mm/registry/attributions", () => ({
  lookupAttribution: (...args: unknown[]) => lookupAttribution(...args),
  MIN_CONFIDENCE_AUTO: 0.85,
  MIN_CONFIDENCE_REVIEW: 0.7,
  INFERRED_CLUSTER_CAP: 0.7,
}));

const findEntityBySlug = vi.fn();
const findEntityById = vi.fn();
vi.mock("@/lib/mm/registry/entities", () => ({
  findEntityBySlug: (...args: unknown[]) => findEntityBySlug(...args),
  findEntityById: (...args: unknown[]) => findEntityById(...args),
}));

const persistScanRun = vi.fn();
vi.mock("@/lib/mm/engine/scanRun/persist", () => ({
  persistScanRun: (...args: unknown[]) => persistScanRun(...args),
}));

import { computeMmRiskAssessment } from "@/lib/mm/adapter/riskAssessment";
import { washPattern, concentratedToken } from "../fixtures/generate";

const HIGH_CONV_ATTR = {
  id: "attr-1",
  walletAddress: "0xabc",
  chain: "ETHEREUM" as const,
  attributionMethod: "COURT_FILING" as const,
  confidence: 0.95,
  evidenceRefs: [],
  reviewerUserId: "seed-system",
  reviewedAt: new Date("2026-04-15T10:00:00.000Z"),
  challengedAt: null,
  challengeReason: null,
  revokedAt: null,
  revokedReason: null,
  createdAt: new Date("2026-04-15T10:00:00.000Z"),
  mmEntityId: "ent-1",
  mmEntity: {
    id: "ent-1",
    slug: "gotbit",
    name: "Gotbit",
    status: "CONVICTED" as const,
    riskBand: "RED" as const,
    jurisdiction: "US",
    workflow: "PUBLISHED",
    defaultScore: 95,
  },
};

describe("computeMmRiskAssessment", () => {
  beforeEach(() => {
    mmScoreFindUnique.mockReset();
    mmScoreUpsert.mockReset();
    mmScoreUpsert.mockResolvedValue({});
    mmCohortPercentileFindMany.mockReset();
    mmCohortPercentileFindMany.mockResolvedValue([]);
    lookupAttribution.mockReset();
    findEntityBySlug.mockReset();
    findEntityById.mockReset();
    persistScanRun.mockReset();
    persistScanRun.mockResolvedValue({ id: "run-persisted-1" });
  });

  // Registry-only, MIXED, and ENTITY-subject tests are intentionally skipped
  // on this release surface: the Registry sub-module is excluded, and the
  // adapter always returns registryDrivenScore=0 / entity=null. See
  // src/lib/mm/adapter/riskAssessment.ts (loadRegistryComponent).

  it("BEHAVIORAL-only wallet → dominantDriver BEHAVIORAL", async () => {
    mmScoreFindUnique.mockResolvedValue(null);
    lookupAttribution.mockResolvedValue(null);
    const r = await computeMmRiskAssessment({
      subjectType: "WALLET",
      subjectId: "0xnone",
      chain: "ETHEREUM",
      walletAgeDays: 90,
      washTrading: washPattern({ pairCount: 10, volumeUsd: 100_000 }),
      concentration: concentratedToken({ wallets: 20, topDominance: 0.95 }),
    });
    expect(r.registry.entity).toBeNull();
    expect(r.registry.registryDrivenScore).toBe(0);
    expect(r.engine.behaviorDrivenScore).toBeGreaterThan(0);
    expect(r.overall.dominantDriver).toBe("BEHAVIORAL");
  });

  it("NO_SIGNAL when nothing fires on either path", async () => {
    mmScoreFindUnique.mockResolvedValue(null);
    lookupAttribution.mockResolvedValue(null);
    const r = await computeMmRiskAssessment({
      subjectType: "WALLET",
      subjectId: "0xquiet",
      chain: "ETHEREUM",
    });
    expect(r.overall.dominantDriver).toBe("NONE");
    expect(r.overall.displayReason).toBe("NO_SIGNAL");
    expect(r.overall.band).toBe("GREEN");
    expect(r.overall.displayScore).toBe(0);
  });

  it("returns source=cache when MmScore is fresh", async () => {
    const cachedAt = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    mmScoreFindUnique.mockResolvedValue({
      subjectType: "WALLET",
      subjectId: "0xcached",
      chain: "ETHEREUM",
      computedAt: cachedAt,
      breakdown: {
        registry: { entity: null, attribution: null, registryDrivenScore: 0 },
        engine: {
          behaviorDrivenScore: 50,
          rawBehaviorScore: 50,
          confidence: "medium",
          coverage: "medium",
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
          displayScore: 50,
          band: "ORANGE",
          dominantDriver: "BEHAVIORAL",
          displayReason: "BEHAVIORAL_PATTERN_MEDIUM",
          disclaimer: "old string",
          freshness: {
            computedAt: cachedAt.toISOString(),
            ageMinutes: 0,
            staleness: "fresh",
          },
        },
        subjectType: "WALLET",
        subjectId: "0xcached",
        chain: "ETHEREUM",
        scanRunId: "run-old",
        schemaVersion: 1,
        computedAt: cachedAt.toISOString(),
        source: "compute",
      },
    });
    const r = await computeMmRiskAssessment({
      subjectType: "WALLET",
      subjectId: "0xcached",
      chain: "ETHEREUM",
      useCache: true,
      maxAgeHours: 6,
    });
    expect(r.source).toBe("cache");
    expect(persistScanRun).not.toHaveBeenCalled();
    expect(r.overall.freshness.ageMinutes).toBeGreaterThanOrEqual(59);
  });

  it("ignores stale cache beyond maxAgeHours", async () => {
    const cachedAt = new Date(Date.now() - 30 * 60 * 60 * 1000); // 30h ago
    mmScoreFindUnique.mockResolvedValue({
      computedAt: cachedAt,
      breakdown: { overall: {}, subjectType: "WALLET" },
    });
    lookupAttribution.mockResolvedValue(null);
    const r = await computeMmRiskAssessment({
      subjectType: "WALLET",
      subjectId: "0xstale",
      chain: "ETHEREUM",
      useCache: true,
      maxAgeHours: 6,
    });
    expect(r.source).toBe("compute");
  });

  it("useCache=false forces a recompute even when cache exists", async () => {
    mmScoreFindUnique.mockResolvedValue({
      computedAt: new Date(),
      breakdown: { overall: {}, subjectType: "WALLET" },
    });
    lookupAttribution.mockResolvedValue(null);
    const r = await computeMmRiskAssessment({
      subjectType: "WALLET",
      subjectId: "0xforce",
      chain: "ETHEREUM",
      useCache: false,
    });
    expect(r.source).toBe("compute");
    expect(mmScoreFindUnique).not.toHaveBeenCalled();
  });

  it("persistScanRun failure does not break the response", async () => {
    mmScoreFindUnique.mockResolvedValue(null);
    lookupAttribution.mockResolvedValue(null);
    persistScanRun.mockRejectedValue(new Error("db boom"));
    const r = await computeMmRiskAssessment({
      subjectType: "WALLET",
      subjectId: "0xresilient",
      chain: "ETHEREUM",
    });
    expect(r.source).toBe("compute");
    expect(r.scanRunId).toMatch(/^transient_/);
  });

  it("upserts into MmScore when persist=true (default)", async () => {
    mmScoreFindUnique.mockResolvedValue(null);
    lookupAttribution.mockResolvedValue(HIGH_CONV_ATTR);
    await computeMmRiskAssessment({
      subjectType: "WALLET",
      subjectId: "0xabc",
      chain: "ETHEREUM",
    });
    expect(mmScoreUpsert).toHaveBeenCalledTimes(1);
  });
});
