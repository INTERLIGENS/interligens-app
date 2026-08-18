// cc-offline-49 — /api/laundry/[handle] publish gate
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolProfile: { findFirst: vi.fn() },
    laundryTrail: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/laundry/[handle]/route";
import { NextRequest } from "next/server";

const mockProfile = vi.mocked(
  prisma.kolProfile.findFirst as unknown as (...a: unknown[]) => unknown,
);
const mockTrail = vi.mocked(
  prisma.laundryTrail.findFirst as unknown as (...a: unknown[]) => unknown,
);

function req(): NextRequest {
  return new NextRequest(new Request("http://localhost/api/laundry/x"));
}
const ctx = (h: string) => ({ params: Promise.resolve({ handle: h }) });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/laundry/[handle] — publish gate", () => {
  it("404s for a non-public handle and never queries the trail", async () => {
    mockProfile.mockResolvedValue(null);
    const res = await GET(req(), ctx("draftguy"));
    expect(res.status).toBe(404);
    expect(await res.json()).toBeNull();
    expect(mockTrail).not.toHaveBeenCalled();
  });

  it("gates on PUBLIC_KOL_FILTER (OR clause)", async () => {
    mockProfile.mockResolvedValue({ id: "k1" });
    mockTrail.mockResolvedValue(null);
    await GET(req(), ctx("publicguy"));
    const call = mockProfile.mock.calls[0]?.[0] as { where: any };
    expect(call.where.handle).toBe("publicguy");
    expect(Array.isArray(call.where.OR)).toBe(true);
  });

  it("returns the trail unchanged for a published handle", async () => {
    mockProfile.mockResolvedValue({ id: "k1" });
    // `publication: "published"` — sans lui, la route filtrée par
    // MIGRATION_laundry_publication_v1 rendrait `null` : un état absent NE
    // PUBLIE PAS (fail-closed, src/lib/laundry/publicationGate.ts).
    // Cette ligne encode le changement de doctrine, elle ne le contourne pas.
    const trail = { id: "t1", kolHandle: "publicguy", publication: "published", signals: [] };
    mockTrail.mockResolvedValue(trail);
    const res = await GET(req(), ctx("publicguy"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(trail);
  });
});
