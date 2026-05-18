import { describe, it, expect, vi, beforeEach } from "vitest";

const mmScoreFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mmScore: {
      findUnique: (...args: unknown[]) => mmScoreFindUnique(...args),
    },
  },
}));

import { hookMmIntoTigerScore } from "@/lib/mm/integration/hook";
import type { MmRiskAssessment } from "@/lib/mm/adapter/types";

const silentLogger = () => {};

const ENV_ON: Record<string, string | undefined> = { MM_INTEGRATION_LIVE: "true" };
const ENV_OFF: Record<string, string | undefined> = {};

function mkSnapshot(
  overrides: { displayScore?: number; confidence?: "low" | "medium" | "high" } = {},
): MmRiskAssessment {
  return {
    registry: {
      entity: {
        id: "e-1",
        slug: "gotbit",
        name: "Gotbit",
        status: "CONVICTED",
        riskBand: "RED",
        jurisdiction: "US",
        workflow: "PUBLISHED",
        defaultScore: 95,
      },
      attribution: null,
      registryDrivenScore: overrides.displayScore ?? 95,
    },
    engine: {
      behaviorDrivenScore: 0,
      rawBehaviorScore: 0,
      confidence: overrides.confidence ?? "high",
      coverage: "high",
      signals: [],
      detectorBreakdown: {
        washTrading: null,
        cluster: null,
        concentration: null,
        fakeLiquidity: null,
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
      dominantDriver: "REGISTRY",
      displayReason: "ENTITY_CONVICTED_ATTRIBUTED",
      disclaimer: "",
      freshness: {
        computedAt: "2026-04-17T00:00:00.000Z",
        ageMinutes: 10,
        staleness: "fresh",
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

const NOW = new Date("2026-04-17T00:15:00.000Z").getTime();

describe("hookMmIntoTigerScore", () => {
  beforeEach(() => {
    mmScoreFindUnique.mockReset();
  });

  it("returns the score untouched and reason=flag_off when the flag is disabled", async () => {
    const r = await hookMmIntoTigerScore("mint-1", "SOLANA", 85, {
      env: ENV_OFF,
      logger: silentLogger,
    });
    expect(r.mmApplied).toBe(false);
    expect(r.reason).toBe("flag_off");
    expect(r.score).toBe(85);
    expect(mmScoreFindUnique).not.toHaveBeenCalled();
  });

  it("returns reason=no_mm_data when the cache is empty", async () => {
    mmScoreFindUnique.mockResolvedValue(null);
    const r = await hookMmIntoTigerScore("mint-1", "SOLANA", 85, {
      env: ENV_ON,
      logger: silentLogger,
    });
    expect(r.reason).toBe("no_mm_data");
    expect(r.score).toBe(85);
  });

  it("applies the cap on a cache hit with severe displayScore", async () => {
    mmScoreFindUnique.mockResolvedValue({
      computedAt: new Date("2026-04-17T00:00:00.000Z"),
      breakdown: mkSnapshot({ displayScore: 95 }),
    });
    const r = await hookMmIntoTigerScore("mint-1", "SOLANA", 85, {
      env: ENV_ON,
      nowMs: NOW,
      logger: silentLogger,
    });
    expect(r.reason).toBe("mm_cap_applied");
    expect(r.mmApplied).toBe(true);
    expect(r.score).toBeLessThan(85);
    expect(r.originalScore).toBe(85);
    expect(r.evidence?.badge).toBe("MM_FLAG");
  });

  it("returns mm_info_only when displayScore is in the informational band", async () => {
    mmScoreFindUnique.mockResolvedValue({
      computedAt: new Date("2026-04-17T00:00:00.000Z"),
      breakdown: mkSnapshot({ displayScore: 25 }),
    });
    const r = await hookMmIntoTigerScore("mint-1", "SOLANA", 85, {
      env: ENV_ON,
      nowMs: NOW,
      logger: silentLogger,
    });
    expect(r.reason).toBe("mm_info_only");
    expect(r.mmApplied).toBe(false);
    expect(r.score).toBe(85);
    expect(r.evidence?.priority).toBe("INFO");
  });

  it("honors an admin override list — cap is demoted to info", async () => {
    mmScoreFindUnique.mockResolvedValue({
      computedAt: new Date("2026-04-17T00:00:00.000Z"),
      breakdown: mkSnapshot({ displayScore: 95 }),
    });
    const r = await hookMmIntoTigerScore("mint-1", "SOLANA", 85, {
      env: {
        ...ENV_ON,
        MM_OVERRIDE_TOKENS: "mint-1:SOLANA",
      },
      nowMs: NOW,
      logger: silentLogger,
    });
    expect(r.mmApplied).toBe(false);
    expect(r.reason).toBe("mm_info_only");
    expect(r.capReason).toBe("admin_override");
    expect(r.score).toBe(85);
  });

  it("returns mm_error when the cache breakdown is malformed", async () => {
    mmScoreFindUnique.mockResolvedValue({
      computedAt: new Date(),
      breakdown: { garbage: true },
    });
    const r = await hookMmIntoTigerScore("mint-1", "SOLANA", 85, {
      env: ENV_ON,
      logger: silentLogger,
    });
    expect(r.reason).toBe("mm_error");
    expect(r.score).toBe(85);
  });

  it("returns mm_error when the Prisma call throws", async () => {
    mmScoreFindUnique.mockRejectedValue(new Error("db boom"));
    const r = await hookMmIntoTigerScore("mint-1", "SOLANA", 85, {
      env: ENV_ON,
      logger: silentLogger,
    });
    expect(r.reason).toBe("mm_error");
    expect(r.score).toBe(85);
    expect(r.capReason).toBe("cache_lookup_failed");
  });

  it("logs a structured line when the cap is applied", async () => {
    const logs: Record<string, unknown>[] = [];
    mmScoreFindUnique.mockResolvedValue({
      computedAt: new Date("2026-04-17T00:00:00.000Z"),
      breakdown: mkSnapshot({ displayScore: 95 }),
    });
    await hookMmIntoTigerScore("mint-1", "SOLANA", 85, {
      env: ENV_ON,
      nowMs: NOW,
      logger: (line) => logs.push(line),
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toMatchObject({
      source: "mm_hook",
      action: "apply_cap",
      capApplied: true,
    });
  });
});
