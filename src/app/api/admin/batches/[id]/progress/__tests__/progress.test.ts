import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingestionBatch: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/security/auth", () => ({
  checkAuth: async () => ({ authorized: true }),
}));

import { GET } from "../route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function makeReq() {
  return new NextRequest("http://localhost/api/admin/batches/b1/progress");
}

describe("Progress endpoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne pct correct", async () => {
    vi.mocked(prisma.ingestionBatch.findUnique).mockResolvedValue({
      status: "processing", processedRows: 50, totalRows: 100,
      processingStartedAt: new Date(), processingEndedAt: null, errorMessage: null,
    } as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pct).toBe(50);
    expect(body.status).toBe("processing");
  });

  it("404 si batch inexistant", async () => {
    vi.mocked(prisma.ingestionBatch.findUnique).mockResolvedValue(null);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(404);
  });
});
