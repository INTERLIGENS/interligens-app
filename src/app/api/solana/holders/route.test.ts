import { describe, it, expect, vi, beforeEach } from "vitest";
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// La source a changé : public-api.solscan.io est MORT (HTTP 404 vérifié le
// 2026-08-16). La route interroge désormais le RPC Solana via
// src/lib/token/holderConcentration.ts, qui fait QUATRE appels par mesure :
//
//   1. getTokenLargestAccounts  — les 20 plus gros comptes de tokens
//   2. getTokenSupply           — le dénominateur          (1 et 2 en parallèle)
//   3. getMultipleAccounts      — l'autorité de chaque compte de tokens
//   4. getMultipleAccounts      — le PROPRIÉTAIRE de chaque autorité
//
// Les étapes 3 et 4 sont ce qui distingue un portefeuille d'une courbe de
// bonding ou d'un pool. Sans elles, la concentration d'un token pump.fun mort
// approche 100 % sans qu'aucune personne ne détienne quoi que ce soit.
//
// Sans HELIUS_API_KEY, un seul point d'accès est essayé : le RPC public.
vi.stubEnv("HELIUS_API_KEY", "");

const SYSTEM = "11111111111111111111111111111111";
const PUMP_AMM = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";

function rpcOk(result: unknown) {
  return { ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result }) };
}

/**
 * Monte les 4 réponses pour un token dont les comptes sont décrits par
 * `holders` : montant + type de propriétaire.
 */
function mockToken(
  holders: Array<{ amount: number; owner: "wallet" | "program" | "absent" }>,
  supplyAmount: number,
) {
  const addresses = holders.map((_, i) => `tokenAcc${i}`);
  const owners = holders.map((_, i) => `owner${i}`);

  mockFetch
    .mockResolvedValueOnce(
      rpcOk({ value: holders.map((h, i) => ({ address: addresses[i], uiAmount: h.amount })) }),
    )
    .mockResolvedValueOnce(rpcOk({ value: { uiAmount: supplyAmount, amount: String(supplyAmount) } }))
    .mockResolvedValueOnce(
      rpcOk({ value: owners.map((o) => ({ data: { parsed: { info: { owner: o } } } })) }),
    )
    .mockResolvedValueOnce(
      rpcOk({
        value: holders.map((h) =>
          h.owner === "absent"
            ? null
            : { owner: h.owner === "wallet" ? SYSTEM : PUMP_AMM, executable: false },
        ),
      }),
    );
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
    mockToken(
      [
        { amount: 600_000, owner: "wallet" },
        { amount: 200_000, owner: "wallet" },
      ],
      1_000_000,
    );
    const json = await (await call()).json();
    expect(json.ok).toBe(true);
    expect(json.top10_pct).toBe(80);
    expect(json.holders_source).toBe("solana_public_rpc");
    expect(json.holders_counted).toBe(2);
    expect(json.program_held_pct).toBe(0);
  });

  // LE CORRECTIF CENTRAL. Le compte n°1 d'un token pump.fun mort est la courbe
  // de bonding : 99,9 % du supply, détenu par personne. Le compter ferait
  // sortir un verdict RED fondé sur un artefact de méthode.
  it("exclut la courbe de bonding et les pools du calcul", async () => {
    mockToken(
      [
        { amount: 998_000, owner: "program" }, // AMM pump.fun
        { amount: 1_000, owner: "wallet" },
        { amount: 1_000, owner: "wallet" },
      ],
      1_000_000,
    );
    const json = await (await call("MINTCURVE")).json();
    expect(json.ok).toBe(true);
    // 0,2 % entre de vraies mains, pas 100 %.
    expect(json.top10_pct).toBe(0.2);
    expect(json.program_held_pct).toBe(99.8);
    expect(json.holders_counted).toBe(2);
    expect(json.excluded_programs).toContain("pump.fun AMM");
  });

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
    mockFetch
      .mockResolvedValueOnce(rpcOk({ value: [{ address: "a", uiAmount: 100 }] }))
      .mockResolvedValueOnce(rpcOk({ value: { uiAmount: 0, amount: "0" } }));
    const json = await (await call("MINT0")).json();
    expect(json.ok).toBe(false);
    expect(json.reason).toContain("no_supply");
  });

  // Un propriétaire absent de la chaîne peut être une PDA jamais financée
  // comme un portefeuille vidé. Quand cette part suffit à faire franchir un
  // seuil, la conclusion dépendrait d'une hypothèse : on refuse.
  it("ok:FALSE quand un compte indéterminé enjambe un seuil", async () => {
    mockToken(
      [
        { amount: 550_000, owner: "wallet" }, // 55 % — sous le seuil de 60
        { amount: 300_000, owner: "absent" }, // pourrait le porter à 85 %
      ],
      1_000_000,
    );
    const json = await (await call("MINTAMBIG")).json();
    expect(json.ok).toBe(false);
    expect(json.reason).toContain("ambiguous");
  });

  // …mais on ne refuse PAS quand l'indétermination ne change rien.
  it("ok:true quand l'indétermination ne peut pas changer la conclusion", async () => {
    mockToken(
      [
        { amount: 990_000, owner: "program" },
        { amount: 5_000, owner: "wallet" },
        { amount: 5_000, owner: "absent" }, // 0,5 % : ne franchit aucun seuil
      ],
      1_000_000,
    );
    const json = await (await call("MINTSAFE")).json();
    expect(json.ok).toBe(true);
    expect(json.top10_pct).toBe(0.5);
  });

  it("rend top1_pct et top3_pct quand la donnée est disponible", async () => {
    mockToken(
      [
        { amount: 300_000, owner: "wallet" },
        { amount: 200_000, owner: "wallet" },
        { amount: 100_000, owner: "wallet" },
        { amount: 50_000, owner: "wallet" },
      ],
      1_000_000,
    );
    const json = await (await call("MINT3")).json();
    expect(json.top1_pct).toBe(30);
    expect(json.top3_pct).toBe(60);
    expect(json.top10_pct).toBe(65);
  });

  it("borne à 100 % plutôt que de publier un « top 10 = 103 % »", async () => {
    mockToken(
      [
        { amount: 600, owner: "wallet" },
        { amount: 600, owner: "wallet" },
      ],
      1_000,
    );
    const json = await (await call("MINTOVER")).json();
    expect(json.top10_pct).toBe(100);
  });
});
