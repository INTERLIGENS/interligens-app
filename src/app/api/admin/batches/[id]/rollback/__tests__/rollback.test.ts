import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingestionBatch: { findUnique: vi.fn(), update: vi.fn() },
    addressLabel: { findMany: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/security/auth", () => ({
  checkAuth: async () => ({ authorized: true }),
}));

vi.mock("@/lib/vault/vaultLookup", () => ({
  rebuildCacheForAddresses: vi.fn(),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function makeReq() {
  return new NextRequest("http://localhost/api/admin/batches/b1/rollback", { method: "POST" });
}

describe("Rollback batch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rollback batch approved", async () => {
    vi.mocked(prisma.ingestionBatch.findUnique).mockResolvedValue({ id: "b1", status: "approved" } as never);
    vi.mocked(prisma.addressLabel.findMany).mockResolvedValue([
      { chain: "ethereum", address: "0xabc" }
    ] as never);
    vi.mocked(prisma.addressLabel.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.ingestionBatch.update).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const res = await POST(makeReq(), { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rolledBack).toBe(true);
    expect(prisma.addressLabel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
  });

  it("409 si batch pas approved", async () => {
    vi.mocked(prisma.ingestionBatch.findUnique).mockResolvedValue({ id: "b1", status: "pending" } as never);
    const res = await POST(makeReq(), { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(409);
  });

  it("404 si batch inexistant", async () => {
    vi.mocked(prisma.ingestionBatch.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq(), { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(404);
  });
});
