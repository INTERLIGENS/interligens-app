import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { mmScore: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  getClientIp: () => "1.2.3.4",
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
  detectLocale: () => "en",
  RATE_LIMIT_PRESETS: { scan: { windowMs: 60_000, max: 30 } },
}));

import { POST } from "../route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/mobile/v1/mm/score", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mobile/v1/mm/score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOBILE_API_TOKEN = "mob_secret_xyz";
  });

  it("rejects missing auth with 401", async () => {
    const res = await POST(req({ tokenAddress: "x", chain: "SOLANA" }));
    expect(res.status).toBe(401);
  });

  it("rejects invalid chain with 400", async () => {
    const res = await POST(
      req({ tokenAddress: "TOK", chain: "XYZ" }, { "X-Mobile-Api-Token": "mob_secret_xyz" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing tokenAddress with 400", async () => {
    const res = await POST(
      req({ chain: "SOLANA" }, { "X-Mobile-Api-Token": "mob_secret_xyz" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns mmRisk: null when no cache exists", async () => {
    vi.mocked(prisma.mmScore.findUnique).mockResolvedValue(null);
    const res = await POST(
      req(
        { tokenAddress: "TOK1", chain: "SOLANA" },
        { "X-Mobile-Api-Token": "mob_secret_xyz" },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mmRisk).toBeNull();
    expect(body.tokenAddress).toBe("TOK1");
  });

  it("returns mmRisk: null when cache is older than 24h", async () => {
    const stale = new Date(Date.now() - 48 * 60 * 60 * 1000);
    vi.mocked(prisma.mmScore.findUnique).mockResolvedValue({
      displayScore: 70,
      band: "ORANGE",
      dominantDriver: "WASH_TRADING",
      computedAt: stale,
      breakdown: null,
    } as never);
    const res = await POST(
      req(
        { tokenAddress: "TOK1", chain: "SOLANA" },
        { "X-Mobile-Api-Token": "mob_secret_xyz" },
      ),
    );
    const body = await res.json();
    expect(body.mmRisk).toBeNull();
  });

  it("returns the mmRisk payload when cache is fresh", async () => {
    vi.mocked(prisma.mmScore.findUnique).mockResolvedValue({
      displayScore: 82,
      band: "RED",
      dominantDriver: "WASH_TRADING",
      computedAt: new Date(),
      breakdown: {
        overall: { disclaimer: "For informational use only." },
        registry: {
          entity: { slug: "dione-protocol", name: "Dione Protocol", status: "CONVICTED" },
        },
      },
    } as never);
    const res = await POST(
      req(
        { tokenAddress: "TOK1", chain: "SOLANA" },
        { "X-Mobile-Api-Token": "mob_secret_xyz" },
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mmRisk.displayScore).toBe(82);
    expect(body.mmRisk.band).toBe("RED");
    expect(body.mmRisk.entity.slug).toBe("dione-protocol");
    expect(body.mmRisk.disclaimer).toBe("For informational use only.");
  });
});
