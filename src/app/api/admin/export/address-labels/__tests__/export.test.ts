import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    addressLabel: { count: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/security/auth", () => ({
  checkAuth: async () => ({ authorized: true }),
}));

import { GET } from "../route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function makeReq(qs = "") {
  return new NextRequest(`http://localhost/api/admin/export/address-labels${qs}`);
}

describe("Export address-labels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne JSON sans entityName par défaut", async () => {
    vi.mocked(prisma.addressLabel.count).mockResolvedValue(2);
    vi.mocked(prisma.addressLabel.findMany).mockResolvedValue([
      { address: "0xabc", chain: "ethereum", labelType: "scam", label: "scam",
        confidence: "high", sourceUrl: null, visibility: "internal_only",
        license: null, tosRisk: "high", firstSeenAt: null, lastSeenAt: null, createdAt: new Date() },
    ] as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    const res = await GET(makeReq("?format=json"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows[0]).not.toHaveProperty("entityName");
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it("413 si trop de rows", async () => {
    vi.mocked(prisma.addressLabel.count).mockResolvedValue(999999);
    const res = await GET(makeReq());
    expect(res.status).toBe(413);
  });
});
