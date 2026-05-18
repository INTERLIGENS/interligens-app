import { describe, it, expect, vi, beforeEach } from "vitest";

const scoreSnapshotCreate = vi.fn();
const scoreSnapshotFindFirst = vi.fn();
const scoreSnapshotFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scoreSnapshot: {
      create: (...args: unknown[]) => scoreSnapshotCreate(...args),
      findFirst: (...args: unknown[]) => scoreSnapshotFindFirst(...args),
      findMany: (...args: unknown[]) => scoreSnapshotFindMany(...args),
    },
  },
}));

import {
  snapshotScore,
  getLatestSnapshot,
  listSnapshots,
  topReasons,
  TIGERSCORE_ENGINE_VERSION,
} from "@/lib/tigerscore/versioning";
import type { TigerDriver } from "@/lib/tigerscore/engine";
import type { ProvenanceData } from "@/lib/tigerscore/provenance";

const DRIVERS: TigerDriver[] = [
  { id: "a", label: "A", severity: "critical", delta: 70, why: "crit" },
  { id: "b", label: "B", severity: "low", delta: 5, why: "low" },
  { id: "c", label: "C", severity: "high", delta: 35, why: "high" },
  { id: "d", label: "D", severity: "med", delta: 15, why: "med" },
];

const PROV: ProvenanceData = {
  engineVersion: "1.0.0",
  drivers: [],
  coverage: { chain: "SOL", rpcDown: false, rpcFallbackUsed: false },
  builtAt: new Date().toISOString(),
};

describe("topReasons", () => {
  it("sorts by severity then absolute delta and caps at 5", () => {
    const many: TigerDriver[] = [
      ...DRIVERS,
      { id: "e", label: "E", severity: "high", delta: 50, why: "" },
      { id: "f", label: "F", severity: "med", delta: 20, why: "" },
      { id: "g", label: "G", severity: "low", delta: 3, why: "" },
    ];
    const out = topReasons(many);
    expect(out).toHaveLength(5);
    expect(out[0].severity).toBe("critical");
    // The two high drivers come next, ordered by absolute delta desc
    expect(out[1].id).toBe("e");
    expect(out[2].id).toBe("c");
  });
});

describe("snapshotScore", () => {
  beforeEach(() => {
    scoreSnapshotCreate.mockReset();
  });

  it("persists a row with the normalised entityValue and clamped score", async () => {
    scoreSnapshotCreate.mockResolvedValue({
      id: "snap-1",
      entityType: "token",
      entityValue: "abc123",
      chain: "SOL",
      score: 95,
      tier: "RED",
      confidenceLevel: "High",
      version: TIGERSCORE_ENGINE_VERSION,
      topReasons: DRIVERS,
      provenanceData: PROV,
      governedStatus: null,
      createdAt: new Date(),
    });

    const r = await snapshotScore({
      entityType: "token",
      entityValue: "ABC123", // should be lowercased for token
      chain: "SOL",
      result: { score: 150, tier: "RED", drivers: DRIVERS },
      confidenceLevel: "High",
      provenance: PROV,
    });

    expect(r.entityValue).toBe("abc123");
    const args = scoreSnapshotCreate.mock.calls[0][0];
    expect(args.data.score).toBe(100); // clamped
    expect(args.data.tier).toBe("RED");
    expect(args.data.version).toBe(TIGERSCORE_ENGINE_VERSION);
    expect(args.data.entityValue).toBe("abc123");
  });

  it("accepts a custom version override", async () => {
    scoreSnapshotCreate.mockResolvedValue({
      id: "snap-2",
      entityType: "wallet",
      entityValue: "0xabc",
      chain: "ETH",
      score: 50,
      tier: "ORANGE",
      confidenceLevel: "Medium",
      version: "99.9.9",
      topReasons: [],
      provenanceData: PROV,
      governedStatus: null,
      createdAt: new Date(),
    });
    const r = await snapshotScore({
      entityType: "wallet",
      entityValue: "0xABC",
      chain: "ETH",
      result: { score: 50, tier: "ORANGE", drivers: [] },
      confidenceLevel: "Medium",
      provenance: PROV,
      version: "99.9.9",
    });
    expect(r.version).toBe("99.9.9");
  });
});

describe("getLatestSnapshot", () => {
  it("returns the latest snapshot for the normalised entity", async () => {
    scoreSnapshotFindFirst.mockResolvedValue({
      id: "snap-latest",
      entityType: "token",
      entityValue: "xyz",
      chain: "SOL",
      score: 72,
      tier: "RED",
      confidenceLevel: "Medium",
      version: "1.0.0",
      topReasons: [],
      provenanceData: PROV,
      governedStatus: null,
      createdAt: new Date(),
    });
    const r = await getLatestSnapshot("token", "XYZ");
    expect(r?.id).toBe("snap-latest");
    expect(scoreSnapshotFindFirst.mock.calls[0][0].where).toEqual({
      entityType: "token",
      entityValue: "xyz",
    });
  });

  it("returns null when nothing persisted", async () => {
    scoreSnapshotFindFirst.mockResolvedValue(null);
    const r = await getLatestSnapshot("token", "nope");
    expect(r).toBeNull();
  });
});

describe("listSnapshots", () => {
  it("clamps the limit parameter between 1 and 200", async () => {
    scoreSnapshotFindMany.mockResolvedValue([]);
    await listSnapshots("token", "xyz", 999);
    expect(scoreSnapshotFindMany.mock.calls[0][0].take).toBe(200);
    await listSnapshots("token", "xyz", 0);
    expect(scoreSnapshotFindMany.mock.calls[1][0].take).toBe(1);
  });
});
