import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

async function callRoute() {
  const { GET } = await import("./route");
  return GET();
}

describe("GET /api/market/btc", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it("ok:true + fields when CoinGecko responds", async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ bitcoin: { usd: 85000, usd_24h_change: 2.5 } }),
    });
    const res = await callRoute();
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.price_usd).toBe(85000);
    expect(json.change_24h_pct).toBe(2.5);
    expect(json.fetched_at).toBeDefined();
  });

  it("ok:false when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const res = await callRoute();
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(res.status).toBe(200);
  });
});
