// src/lib/vault/__tests__/vaultLookup.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    riskSummaryCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    addressLabel: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { vaultLookup } from "../vaultLookup";
import { prisma } from "@/lib/prisma";

const KENT_LABEL = {
  chain: "ethereum",
  address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  labelType: "airdrop_target",
  label: "kent_unclaimed_airdrop_list",
  confidence: "low",
  sourceName: "wearekent_",
  sourceUrl: null,
  evidence: "eth=1.5",
  entityName: null,
  visibility: "internal_only",
};

describe("vaultLookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne match=false si aucun label", async () => {
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("not found"));
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await vaultLookup("ethereum", "0x000000000000000000000000000000000000dead");
    expect(result.match).toBe(false);
    expect(result.categories).toHaveLength(0);
  });

  it("retourne match=true avec categories pour adresse connue", async () => {
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("not found"));
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([KENT_LABEL]);
    (prisma.riskSummaryCache.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await vaultLookup("ethereum", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(result.match).toBe(true);
    expect(result.categories).toContain("airdrop_target");
  });

  it("severity=info pour airdrop_target", async () => {
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error());
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([KENT_LABEL]);
    (prisma.riskSummaryCache.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await vaultLookup("ethereum", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(result.severity).toBe("info");
  });

  it("severity=danger pour scam", async () => {
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error());
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...KENT_LABEL, labelType: "scam", confidence: "high" }
    ]);
    (prisma.riskSummaryCache.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await vaultLookup("ethereum", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(result.severity).toBe("danger");
    expect(result.confidence).toBe("high");
  });

  it("utilise le cache si disponible", async () => {
    const cached = { match: true, categories: ["whale"], severity: "info", confidence: "medium" };
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      summary: JSON.stringify(cached),
    });
    const result = await vaultLookup("ethereum", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(result.match).toBe(true);
    expect(prisma.addressLabel.findMany).not.toHaveBeenCalled();
  });

  it("ne retourne jamais entityName", async () => {
    (prisma.riskSummaryCache.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error());
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...KENT_LABEL, entityName: "SECRET_ENTITY" }
    ]);
    (prisma.riskSummaryCache.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const result = await vaultLookup("ethereum", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    expect(JSON.stringify(result)).not.toContain("SECRET_ENTITY");
    expect(JSON.stringify(result)).not.toContain("entityName");
  });
});
