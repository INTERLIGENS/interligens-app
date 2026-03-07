import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingestionBatch: { update: vi.fn(), findUnique: vi.fn() },
    addressLabel: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/vault/vaultLookup", () => ({
  rebuildCacheForAddresses: vi.fn(),
}));

import { runApproveJob } from "../approveJob";
import { prisma } from "@/lib/prisma";

const makeRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    chain: "ethereum", address: `0x${i.toString().padStart(40,"0")}`,
    labelType: "scam", label: "test", sourceName: "test",
  }));

describe("approveJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approuve un batch avec 3 lignes", async () => {
    vi.mocked(prisma.ingestionBatch.findUnique).mockResolvedValue({
      id: "b1", rawDocuments: [{ content: JSON.stringify(makeRows(3)) }],
    } as never);
    vi.mocked(prisma.ingestionBatch.update).mockResolvedValue({} as never);
    vi.mocked(prisma.addressLabel.upsert).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await runApproveJob("b1");

    expect(prisma.addressLabel.upsert).toHaveBeenCalledTimes(3);
    const calls = vi.mocked(prisma.ingestionBatch.update).mock.calls;
    const finalCall = calls[calls.length - 1][0];
    expect(finalCall.data.status).toBe("approved");
    expect(finalCall.data.processedRows).toBe(3);
  });

  it("passe en failed si batch inexistant", async () => {
    vi.mocked(prisma.ingestionBatch.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.ingestionBatch.update).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    await expect(runApproveJob("bad")).rejects.toThrow("Batch not found");
    expect(prisma.ingestionBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) })
    );
  });
});
