import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingestionBatch: { findUnique: vi.fn(), update: vi.fn() },
    rawDocument: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/security/auth", () => ({
  checkAuth: async () => ({ authorized: true }),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function makeReq() {
  return new NextRequest("http://localhost/api/admin/batches/b1/reject", { method: "POST" });
}

describe("Reject batch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejette un batch pending", async () => {
    vi.mocked(prisma.ingestionBatch.findUnique).mockResolvedValue({ id: "b1", status: "pending" } as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);
    const res = await POST(makeReq(), { params: { id: "b1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rejected).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("409 si batch déjà approved", async () => {
    vi.mocked(prisma.ingestionBatch.findUnique).mockResolvedValue({ id: "b1", status: "approved" } as never);
    const res = await POST(makeReq(), { params: { id: "b1" } });
    expect(res.status).toBe(409);
  });

  it("404 si batch inexistant", async () => {
    vi.mocked(prisma.ingestionBatch.findUnique).mockResolvedValue(null);
    const res = await POST(makeReq(), { params: { id: "x" } });
    expect(res.status).toBe(404);
  });
});
