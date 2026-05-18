import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.MOBILE_API_TOKEN = "test-mobile-token";

vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 })),
  rateLimitResponse: vi.fn(() => new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  detectLocale: vi.fn(() => "en"),
  RATE_LIMIT_PRESETS: { scan: { maxRequests: 100, windowMs: 60000 } },
}));
vi.mock("@/lib/tigerscore/adapter", () => ({
  computeTigerScoreFromScan: vi.fn(() => ({
    score: 20,
    tier: "GREEN",
    confidence: "high",
    drivers: [],
  })),
}));
vi.mock("@/lib/tigerscore/engine", () => ({
  computeTigerScore: vi.fn(() => ({ score: 20, tier: "GREEN", confidence: "high", drivers: [] })),
}));
vi.mock("@/lib/rpc", () => ({ rpcCall: vi.fn(async () => null) }));
vi.mock("@/lib/caseDb", () => ({ loadCaseByMint: vi.fn(() => null) }));
vi.mock("@/lib/marketProviders", () => ({
  getMarketSnapshot: vi.fn(async () => ({
    source: "dexscreener",
    url: null,
    pair_age_days: 10,
    liquidity_usd: 20000,
    fdv_usd: 500000,
    volume_24h_usd: 5000,
    cache_hit: false,
  })),
}));
vi.mock("@/lib/entities/knownBad", () => ({ isKnownBad: vi.fn(() => null) }));
vi.mock("@/lib/kol/alert", () => ({ buildKolAlertSafe: vi.fn(async () => ({ hasAlert: false, kols: [] })) }));
vi.mock("@/lib/kol/snapshots", () => ({ buildMobileScanSnapshot: vi.fn(async () => null) }));

const VALID_SOL = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";

function makeRequest(body: object, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) headers["X-Mobile-Api-Token"] = token;
  return new NextRequest("http://localhost/api/mobile/v1/scan", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function callScan(body: object, token?: string) {
  const { POST } = await import("./route");
  return POST(makeRequest(body, token));
}

describe("POST /api/mobile/v1/scan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without auth token", async () => {
    const res = await callScan({ address: VALID_SOL });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("returns 401 with wrong auth token", async () => {
    const res = await callScan({ address: VALID_SOL }, "wrong-token");
    expect(res.status).toBe(401);
  });

  it("returns 400 when address is missing", async () => {
    const res = await callScan({}, "test-mobile-token");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("address");
  });

  it("returns 400 for address too short", async () => {
    const res = await callScan({ address: "abc" }, "test-mobile-token");
    expect(res.status).toBe(400);
  });

  it("returns 200 for valid SOL address with auth", async () => {
    const res = await callScan({ address: VALID_SOL, chain: "SOL" }, "test-mobile-token");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("score");
    expect(body).toHaveProperty("tier");
    expect(body).toHaveProperty("riskLevel");
  });
});
