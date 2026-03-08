import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    addressLabel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
  },
}));

import { upsertRows } from "../dedup";
import { prisma } from "@/lib/prisma";
import type { NormalizedRow } from "../types";

const ROW: NormalizedRow = {
  chain: "ethereum",
  address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  labelType: "airdrop_target",
  label: "kent_unclaimed_airdrop_list",
  confidence: "low",
  sourceName: "wearekent_",
  sourceUrl: "https://docs.google.com/spreadsheets/d/TEST",
  evidence: "eth=1.2, usd=3000",
  visibility: "internal_only",
  tosRisk: "low",
};

describe("upsertRows dedup logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée un nouveau label si inexistant", async () => {
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.addressLabel.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const result = await upsertRows([ROW], "batch-1");
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(prisma.addressLabel.createMany).toHaveBeenCalledOnce();
  });

  it("met à jour un label existant (merge evidence)", async () => {
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
      ...ROW,
      id: "existing",
      evidence: "eth=1.0",
    }]);
    (prisma.addressLabel.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing" });

    const result = await upsertRows([ROW], "batch-1");
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);

    const updateCall = (prisma.addressLabel.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // evidence doit contenir les deux parties
    expect(updateCall.data.evidence).toContain("eth=1.0");
    expect(updateCall.data.evidence).toContain("eth=1.2");
  });

  it("ne duplique pas l'evidence si identique", async () => {
    (prisma.addressLabel.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
      ...ROW,
      id: "existing",
      evidence: "eth=1.2, usd=3000",
    }]);
    (prisma.addressLabel.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing" });

    await upsertRows([ROW], "batch-1");
    const updateCall = (prisma.addressLabel.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Evidence ne doit pas être doublé
    const occ = (updateCall.data.evidence.match(/eth=1\.2/g) ?? []).length;
    expect(occ).toBe(1);
  });
});
