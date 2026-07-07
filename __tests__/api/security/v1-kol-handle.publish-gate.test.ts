// cc-offline-49 — /api/v1/kol/[handle] publish gate + internal-field scrub
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { kolProfile: { findFirst: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/v1/kol/[handle]/route";
import { NextRequest } from "next/server";

const mockFindFirst = vi.mocked(
  prisma.kolProfile.findFirst as unknown as (...a: unknown[]) => unknown,
);

function req(): NextRequest {
  return new NextRequest(new Request("http://localhost/api/v1/kol/x"));
}
const ctx = (h: string) => ({ params: Promise.resolve({ handle: h }) });

// A published profile that (deliberately) still carries every internal field,
// so we can assert the response mapping scrubs them.
function publishedKol() {
  return {
    id: "k1", handle: "publicguy", platform: "twitter", displayName: "Public Guy",
    label: "promoter", riskFlag: "high", confidence: "confirmed", status: "active",
    tier: "T1", rugCount: 3, followerCount: 1000, verified: true,
    notes: "INTERNAL analyst notes", tags: ["a"], bio: "INTERNAL bio", pricePerPost: 500,
    evmAddress: "0xDEADBEEF", exitDate: null, exitNarrative: "INTERNAL exit narrative",
    exitPostUrl: null, totalDocumented: 42, totalScammed: 99,
    evidences: [{ id: "e1", type: "onchain", label: "x", rawJson: { secret: true } }],
    kolCases: [{ id: "c1", caseId: "CASE", role: "promoter", paidUsd: 10, confidenceLevel: "confirmed", methodologyRef: "M-1" }],
    _count: { evidences: 1, kolCases: 1 },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/v1/kol/[handle] — publish gate", () => {
  it("404s for a draft / non-public handle (findFirst returns null)", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await GET(req(), ctx("draftguy"));
    expect(res.status).toBe(404);
    expect((await res.json()).found).toBe(false);
  });

  it("applies PUBLIC_KOL_FILTER (OR gate) in the where clause", async () => {
    mockFindFirst.mockResolvedValue(publishedKol());
    await GET(req(), ctx("publicguy"));
    const call = mockFindFirst.mock.calls[0]?.[0] as { where: any };
    expect(call.where.handle).toBe("publicguy");
    expect(Array.isArray(call.where.OR)).toBe(true);
    expect(call.where.OR).toEqual([
      { publishStatus: "published" },
      { publishable: true, publishStatus: "draft" },
    ]);
  });

  it("does NOT select internal relation fields (rawJson / methodologyRef / confidenceLevel)", async () => {
    mockFindFirst.mockResolvedValue(publishedKol());
    await GET(req(), ctx("publicguy"));
    const call = mockFindFirst.mock.calls[0]?.[0] as { include: any };
    expect(call.include.evidences.select.rawJson).toBeUndefined();
    expect(call.include.kolCases.select.methodologyRef).toBeUndefined();
    expect(call.include.kolCases.select.confidenceLevel).toBeUndefined();
  });

  it("200s for a published handle and scrubs internal top-level fields", async () => {
    mockFindFirst.mockResolvedValue(publishedKol());
    const res = await GET(req(), ctx("publicguy"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.kol.handle).toBe("publicguy");
    // scrubbed
    expect(body.kol.notes).toBeUndefined();
    expect(body.kol.bio).toBeUndefined();
    expect(body.kol.evmAddress).toBeUndefined();
    expect(body.kol.exitNarrative).toBeUndefined();
    // still present (public)
    expect(body.kol.tier).toBe("T1");
    expect(body.kol.rugCount).toBe(3);
  });
});
