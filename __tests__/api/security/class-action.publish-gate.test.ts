// cc-offline-49 — /api/kol/[handle]/class-action publish gate + evmAddress scrub
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolProfile: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/kol/[handle]/class-action/route";
import { NextRequest } from "next/server";

const mockFindFirst = vi.mocked(
  prisma.kolProfile.findFirst as unknown as (...a: unknown[]) => unknown,
);
const mockFindMany = vi.mocked(
  prisma.kolProfile.findMany as unknown as (...a: unknown[]) => unknown,
);

function req(): NextRequest {
  return new NextRequest(new Request("http://localhost/api/kol/x/class-action"));
}
const ctx = (h: string) => ({ params: Promise.resolve({ handle: h }) });

function subject() {
  return {
    handle: "publicguy", label: "promoter", platform: "twitter",
    evmAddress: "0xDEADBEEF", tier: "T1", verified: true,
    evidences: [{ amountUsd: 100 }], kolCases: [{ paidUsd: 50 }],
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/kol/[handle]/class-action — publish gate", () => {
  it("404s for a non-public subject and never loads co-defendants", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await GET(req(), ctx("draftguy"));
    expect(res.status).toBe(404);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("gates the subject on PUBLIC_KOL_FILTER (OR clause)", async () => {
    mockFindFirst.mockResolvedValue(subject());
    mockFindMany.mockResolvedValue([]);
    await GET(req(), ctx("publicguy"));
    const call = mockFindFirst.mock.calls[0]?.[0] as { where: any };
    expect(call.where.handle).toBe("publicguy");
    expect(Array.isArray(call.where.OR)).toBe(true);
  });

  it("200s for a published subject and omits evmAddress from the payload", async () => {
    mockFindFirst.mockResolvedValue(subject());
    mockFindMany.mockResolvedValue([]);
    const res = await GET(req(), ctx("publicguy"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.classAction.subject.handle).toBe("publicguy");
    expect(body.classAction.subject).not.toHaveProperty("evmAddress");
  });
});
