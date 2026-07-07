// cc-offline-49 — /api/kol/[handle]/cashout publish gate
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ findFirst: vi.fn(), disconnect: vi.fn() }));

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(function () {
    return {
      kolProfile: { findFirst: h.findFirst },
      $disconnect: h.disconnect,
    };
  }),
}));
vi.mock("@/lib/kol/pricing", () => ({
  getPriceAtDate: vi.fn().mockResolvedValue({ price: 0 }),
}));

import { GET } from "@/app/api/kol/[handle]/cashout/route";
import { NextRequest } from "next/server";

function req(query = ""): NextRequest {
  return new NextRequest(new Request("http://localhost/api/kol/x/cashout" + query));
}
const ctx = (handle: string) => ({ params: Promise.resolve({ handle }) });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/kol/[handle]/cashout — publish gate", () => {
  it("404s for a non-public handle (findFirst returns null)", async () => {
    h.findFirst.mockResolvedValue(null);
    const res = await GET(req(), ctx("draftguy"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("KOL not found");
  });

  it("gates on PUBLIC_KOL_FILTER (OR clause)", async () => {
    h.findFirst.mockResolvedValue({ handle: "publicguy", kolWallets: [] });
    await GET(req(), ctx("publicguy"));
    const call = h.findFirst.mock.calls[0]?.[0] as { where: any };
    expect(call.where.handle).toBe("publicguy");
    expect(Array.isArray(call.where.OR)).toBe(true);
  });

  it("behaves normally for a published handle (no ca → found:false, 200)", async () => {
    h.findFirst.mockResolvedValue({ handle: "publicguy", kolWallets: [] });
    const res = await GET(req(), ctx("publicguy"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
    expect(body.reason).toBe("No token CA provided");
  });
});
