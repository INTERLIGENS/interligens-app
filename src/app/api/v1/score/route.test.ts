import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/publicScore/rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 })),
}));
vi.mock("@/lib/tigerscore/adapter", () => ({
  computeTigerScoreFromScan: vi.fn(() => ({
    score: 25,
    drivers: [{ id: "low_liquidity", label: "Low liquidity", severity: "medium", delta: 10 }],
  })),
}));
vi.mock("@/lib/tigerscore/engine", () => ({
  computeTigerScoreWithIntel: vi.fn(async () => ({
    score: 25,
    finalScore: 25,
    drivers: [],
    intelligence: null,
  })),
}));
vi.mock("@/lib/caseDb", () => ({ loadCaseByMint: vi.fn(() => null) }));
vi.mock("@/lib/marketProviders", () => ({
  getMarketSnapshot: vi.fn(async () => ({
    source: "dexscreener",
    url: null,
    pair_age_days: 30,
    liquidity_usd: 50000,
    fdv_usd: 1000000,
    volume_24h_usd: 10000,
    cache_hit: false,
  })),
}));
vi.mock("@/lib/entities/knownBad", () => ({ isKnownBadEvm: vi.fn(() => null) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tokenScanAggregate: {
      upsert: vi.fn(async () => ({ mint: "test", scanCount: 1 })),
    },
  },
}));

vi.stubGlobal("fetch", vi.fn(async () => ({
  ok: false,
  json: async () => ({}),
})));

const VALID_SOL_MINT = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";
const VALID_EVM = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

async function callScore(params: string) {
  const { GET } = await import("./route");
  const req = new NextRequest(`http://localhost/api/v1/score?${params}`);
  return GET(req);
}

describe("GET /api/v1/score", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for missing mint", async () => {
    const res = await callScore("");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_mint");
  });

  it("returns 400 for invalid address format", async () => {
    const res = await callScore("mint=not_a_valid_address!!!!");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_mint");
  });

  it("returns 200 with valid Solana mint", async () => {
    const res = await callScore(`mint=${VALID_SOL_MINT}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("score");
    expect(body).toHaveProperty("verdict");
    expect(body.api_version).toBe("v1");
    expect(["GREEN", "ORANGE", "RED"]).toContain(body.verdict);
  });

  it("returns 200 with valid EVM address", async () => {
    const res = await callScore(`mint=${VALID_EVM}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("score");
    expect(body.mint).toBe(VALID_EVM.toLowerCase());
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = await import("@/lib/publicScore/rateLimit");
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });
    const res = await callScore(`mint=${VALID_SOL_MINT}`);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limit_exceeded");
  });

  it("response has CORS headers", async () => {
    const res = await callScore(`mint=${VALID_SOL_MINT}`);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("OPTIONS returns 204", async () => {
    const { OPTIONS } = await import("./route");
    const res = await OPTIONS();
    expect(res.status).toBe(204);
  });
});
