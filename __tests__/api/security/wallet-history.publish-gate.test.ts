// cc-offline-49 T2 — /api/kol/[handle]/wallet-history publish gate.
// Non-public handle -> valid masked-empty structure (no crash, no Helius call).
// Public handle -> gate passes, route proceeds unchanged.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kolProfile: { findFirst: vi.fn() },
    kolWallet: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/kol/[handle]/wallet-history/route";
import { NextRequest } from "next/server";

const mockProfile = vi.mocked(prisma.kolProfile.findFirst as unknown as (...a: unknown[]) => unknown);
const mockWallets = vi.mocked(prisma.kolWallet.findMany as unknown as (...a: unknown[]) => unknown);

function req(): NextRequest {
  return new NextRequest(new Request("http://localhost/api/kol/x/wallet-history"));
}
const ctx = (h: string) => ({ params: Promise.resolve({ handle: h }) });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/kol/[handle]/wallet-history — publish gate", () => {
  it("returns a valid masked-empty structure for a non-public handle (no crash, no wallet query)", async () => {
    mockProfile.mockResolvedValue(null);
    const res = await GET(req(), ctx("draftguy"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Shape the frontend WalletHistorySection expects: tokens is an array, no error field.
    expect(Array.isArray(body.tokens)).toBe(true);
    expect(body.tokens).toEqual([]);
    expect(body.wallets).toEqual([]);
    expect(body.masked).toBe(true);
    expect(body.error).toBeUndefined();
    // Never touches on-chain wallet data for a non-public handle.
    expect(mockWallets).not.toHaveBeenCalled();
  });

  it("gates on PUBLIC_KOL_FILTER (OR clause)", async () => {
    mockProfile.mockResolvedValue(null);
    await GET(req(), ctx("draftguy"));
    const call = mockProfile.mock.calls[0]?.[0] as { where: any };
    expect(call.where.handle).toBe("draftguy");
    expect(Array.isArray(call.where.OR)).toBe(true);
  });

  it("lets a PUBLISHED handle through the gate (proceeds to normal path)", async () => {
    mockProfile.mockResolvedValue({ id: "k1" });
    vi.stubEnv("HELIUS_API_KEY", ""); // force the pre-existing 'not configured' branch — no network
    const res = await GET(req(), ctx("pubguy"));
    const body = await res.json();
    // NOT the masked path — gate passed and the route ran its normal logic.
    expect(body.masked).toBeUndefined();
    expect(res.status).toBe(503);
    expect(body.error).toContain("HELIUS_API_KEY");
    vi.unstubAllEnvs();
  });
});
