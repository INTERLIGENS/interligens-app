import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks fetch AVANT tout import du module ──
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { getMarketSnapshot } from "../marketProviders";

function dexOk(mint = "X") {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve([{
      chainId: "solana",
      pairAddress: "POOL_DEX_" + mint,
      dexId: "raydium",
      url: "https://dexscreener.com/test",
      priceUsd: "0.00042",
      liquidity: { usd: 50000 },
      volume: { h24: 12000 },
      fdv: 800000,
      pairCreatedAt: Date.now() - 10 * 86400000,
    }]),
  });
}

function dexEmpty() {
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
}

function geckoOk() {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      data: [{
        attributes: {
          address: "POOL_GECKO",
          base_token_price_usd: "0.00042",
          reserve_in_usd: "50000",
          volume_usd: { h24: "12000" },
          fdv_usd: "800000",
          pool_created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
        relationships: { dex: { data: { id: "orca" } } },
      }],
    }),
  });
}

// Mints uniques pour isoler le cache
let mintCounter = 0;
function freshMint() { return `TEST_MINT_${Date.now()}_${mintCounter++}`; }

describe("marketProviders", () => {
  beforeEach(() => mockFetch.mockReset());

  it("fallback: DexScreener vide => GeckoTerminal choisi", async () => {
    mockFetch
      .mockImplementationOnce(dexEmpty)   // DexScreener → vide
      .mockImplementationOnce(geckoOk);   // GeckoTerminal → ok

    const snap = await getMarketSnapshot("solana", freshMint());
    expect(snap.source).toBe("geckoterminal");
    expect(snap.data_unavailable).toBe(false);
    expect(snap.price).toBeGreaterThan(0);
  });

  it("cache: 2 appels successifs => 2ème est cache_hit=true", async () => {
    mockFetch.mockImplementation(dexOk);

    const mint = freshMint();
    const first = await getMarketSnapshot("solana", mint);
    expect(first.cache_hit).toBe(false);

    const second = await getMarketSnapshot("solana", mint);
    expect(second.cache_hit).toBe(true);
    // fetch appelé 1 seule fois (cache pour le 2ème)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
