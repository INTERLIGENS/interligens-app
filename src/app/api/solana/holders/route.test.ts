import { describe, it, expect, vi, beforeEach } from "vitest";
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// La source a changé : public-api.solscan.io est MORT (HTTP 404 vérifié le
// 2026-08-16). La route interroge désormais le RPC Solana —
// getTokenLargestAccounts + getTokenSupply, via
// src/lib/token/holderConcentration.ts. Sans HELIUS_API_KEY, un seul point
// d'accès est essayé : le RPC public. Chaque tentative fait DEUX appels, en
// parallèle (Promise.all) : largest puis supply dans l'ordre de résolution.
vi.stubEnv("HELIUS_API_KEY", "");

function rpcOk(result: unknown) {
  return { ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result }) };
}
function largest(...uiAmounts: number[]) {
  return rpcOk({ value: uiAmounts.map((uiAmount) => ({ uiAmount, address: "acc" })) });
}
function supply(uiAmount: number) {
  return rpcOk({ value: { uiAmount, amount: String(uiAmount), decimals: 0 } });
}

async function call(mint = "TESTMINT123") {
  vi.resetModules();
  const { GET } = await import("./route");
  return GET(new Request("http://localhost/api/solana/holders?mint=" + mint));
}

describe("GET /api/solana/holders", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("ok:true avec top10_pct quand le RPC répond", async () => {
    mockFetch.mockResolvedValueOnce(largest(600000, 200000)).mockResolvedValueOnce(supply(1000000));
    const json = await (await call()).json();
    expect(json.ok).toBe(true);
    expect(json.top10_pct).toBe(80);
    expect(json.holders_source).toBe("solana_public_rpc");
    expect(json.holders_counted).toBe(2);
  });

  // LE CORRECTIF. Avant, cette route rendait `ok: true` sur une panne TOTALE,
  // avec `holders_source: "unavailable"`. Un consommateur testant `if (res.ok)`
  // en concluait que tout allait bien. Un drapeau de succès qui ment est pire
  // qu'une absence de drapeau.
  it("ok:FALSE quand le fournisseur est en panne", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));
    const json = await (await call("MINT2")).json();
    expect(json.ok).toBe(false);
    expect(json.top10_pct).toBeNull();
    expect(json.holders_source).toBe("unavailable");
    expect(json.reason).toContain("timeout");
  });

  // Un 429 rend un corps JSON d'erreur : sans vérifier res.ok, `.result` serait
  // `undefined` et passerait pour « ce token n'a aucun détenteur ». C'est le
  // défaut exact du client Helius de proceeds.ts:38-47.
  it("ok:FALSE sur un 429, jamais « aucun détenteur »", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: {} }) });
    const json = await (await call("MINT429")).json();
    expect(json.ok).toBe(false);
    expect(json.top10_pct).toBeNull();
    expect(json.reason).toContain("429");
  });

  it("ok:FALSE quand la supply est nulle — pas de division qui rendrait 0 ou NaN", async () => {
    mockFetch.mockResolvedValueOnce(largest(100)).mockResolvedValueOnce(supply(0));
    const json = await (await call("MINT0")).json();
    expect(json.ok).toBe(false);
    expect(json.reason).toContain("no_supply");
  });

  it("rend top1_pct et top3_pct quand la donnée est disponible", async () => {
    mockFetch
      .mockResolvedValueOnce(largest(300000, 200000, 100000, 50000))
      .mockResolvedValueOnce(supply(1000000));
    const json = await (await call("MINT3")).json();
    expect(json.top1_pct).toBe(30);
    expect(json.top3_pct).toBe(60);
    expect(json.top10_pct).toBe(65);
  });

  it("borne à 100 % plutôt que de publier un « top 10 = 103 % »", async () => {
    mockFetch.mockResolvedValueOnce(largest(600, 600)).mockResolvedValueOnce(supply(1000));
    const json = await (await call("MINTOVER")).json();
    expect(json.top10_pct).toBe(100);
  });
});
