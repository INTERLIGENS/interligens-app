import { describe, it, expect, vi, beforeEach } from "vitest";
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

async function call(mint = "TESTMINT123") {
  vi.resetModules();
  const { GET } = await import("./route");
  return GET(new Request("http://localhost/api/solana/holders?mint=" + mint));
}

describe("GET /api/solana/holders", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("ok:true with top10_pct when solscan responds", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ amount: 600000 }, { amount: 200000 }], total: 1000000 }),
    });
    const res = await call();
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.top10_pct).toBe(80);
    expect(json.holders_source).toBe("solscan");
  });

  it("ok:true top10_pct:null when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    const res = await call("MINT2");
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.top10_pct).toBeNull();
    expect(json.holders_source).toBe("unavailable");
  });

  it("returns top1_pct and top3_pct when data available", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ amount: 300000 }, { amount: 200000 }, { amount: 100000 }, { amount: 50000 }], total: 1000000 }),
    });
    const res = await call("MINT3");
    const json = await res.json();
    expect(json.top1_pct).toBe(30);
    expect(json.top3_pct).toBe(60);
  });
});
