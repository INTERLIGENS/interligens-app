import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

async function callRoute() {
  const { GET } = await import("./route");
  return GET();
}

describe("GET /api/market/tickers", () => {
  beforeEach(() => { vi.resetModules(); mockFetch.mockReset(); });

  it("ok:true with btc/eth/sol when CoinGecko responds", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        bitcoin:  { usd: 85000, usd_24h_change: 1.2 },
        ethereum: { usd: 3200,  usd_24h_change: 0.8 },
        solana:   { usd: 180,   usd_24h_change: -0.5 },
      }),
    });
    const res = await callRoute();
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.btc.price_usd).toBe(85000);
    expect(json.eth.price_usd).toBe(3200);
    expect(json.sol.price_usd).toBe(180);
    expect(json.fetched_at).toBeDefined();
  });

  it("ok:false + status 200 when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const res = await callRoute();
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(res.status).toBe(200);
  });
});
