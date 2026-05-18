import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/publicScore/rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60000 })),
}));
vi.mock("@/lib/caseDb", () => ({ loadCaseByMint: vi.fn(() => null) }));

const DEX_RESPONSE = {
  baseToken: { name: "Test Token", symbol: "TEST" },
  info: { imageUrl: "https://example.com/logo.png" },
  priceUsd: "0.001",
  marketCap: 500000,
  volume: { h24: 10000 },
  liquidity: { usd: 50000 },
  pairCreatedAt: Date.now() - 30 * 86_400_000,
};

vi.stubGlobal("fetch", vi.fn(async (url: string) => {
  if (String(url).includes("dexscreener")) {
    return { ok: true, json: async () => [DEX_RESPONSE] };
  }
  if (String(url).includes("helius")) {
    return {
      ok: true,
      json: async () => ([{
        onChainMetadata: { metadata: { data: { name: "Test", symbol: "TST" } } },
        offChainMetadata: { metadata: { image: "https://example.com/logo.png" } },
      }]),
    };
  }
  return { ok: false, json: async () => ({}) };
}));

const VALID_SOL = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";
const VALID_EVM = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const VALID_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

async function callScanContext(params: string) {
  const { GET } = await import("./route");
  const req = new NextRequest(`http://localhost/api/v1/scan-context?${params}`);
  return GET(req);
}

describe("GET /api/v1/scan-context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when target is missing", async () => {
    const res = await callScanContext("");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("target required");
  });

  it("returns 400 for unrecognised address format", async () => {
    const res = await callScanContext("target=not_an_address");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unrecognised address format");
  });

  it("returns 200 with valid Solana address", async () => {
    const res = await callScanContext(`target=${VALID_SOL}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chain).toBe("SOL");
    expect(body).toHaveProperty("entityType");
    expect(body).toHaveProperty("confidence");
  });

  it("returns 200 with valid EVM address", async () => {
    const res = await callScanContext(`target=${VALID_EVM}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chain).toBe("ETH");
    expect(body.target).toBe(VALID_EVM);
  });

  it("returns 200 with TRON address (low confidence, no market data)", async () => {
    const res = await callScanContext(`target=${VALID_TRON}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chain).toBe("TRON");
    expect(body.confidence).toBe("low");
    expect(body.marketData).toBeNull();
  });

  it("returns 429 when rate limited", async () => {
    const { checkRateLimit } = await import("@/lib/publicScore/rateLimit");
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });
    const res = await callScanContext(`target=${VALID_SOL}`);
    expect(res.status).toBe(429);
  });

  it("includes Cache-Control header for fresh token", async () => {
    const freshAddress = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
    const res = await callScanContext(`target=${freshAddress}`);
    expect(res.status).toBe(200);
    const header = res.headers.get("Cache-Control") ?? res.headers.get("X-Cache");
    expect(header).toBeTruthy();
  });
});
