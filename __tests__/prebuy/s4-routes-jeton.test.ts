// ─── S4 · LE JETON SERVI PAR LES TROIS ROUTES, VERROUILLÉ ──────────────────
//
// ██  Troisième fois que je cherche ce mutant AVANT de merger.             ██
//
// Après câblage, muter `toPartnerVerdict(projection, intelligenceCoverage)` en
// `toPartnerVerdict(projection)` laissait 5698 tests VERTS. C'est #354, puis
// S3.2, puis ici : un contrat servi que rien n'exige. Le réflexe est acquis —
// on mute la route AVANT de la livrer, pas après.
//
// ─── Ce que ce fichier exige ──────────────────────────────────────────────
//
//   1. couverture incomplète → `verdict` cesse d'être `SAFE`
//   2. la RECOMMANDATION ne bouge pas — ALLOW reste ALLOW
//   3. couverture complète → `SAFE` revient (la sur-correction)
//   4. la prose partenaire suit la même règle
//
// ─── Trou de preuve déclaré ───────────────────────────────────────────────
//
// Les trois routes sont prouvées PAR LE MÉCANISME, jamais en production :
// `PARTNER_API_KEY` est vide dans `.env.local`, et un 401 n'est jamais une
// mesure. Ce fichier exécute les handlers avec une clé de test ; il ne prouve
// pas ce que la production renvoie.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const COMPLETE = {
  expected: ["ofac", "scamsniffer"],
  consultedMeasured: ["ofac", "scamsniffer"],
  notConsulted: [],
  declaredNotArmed: [],
  denominator: 2,
  state: "COMPLETE",
  negativeConclusive: true,
};
const INCOMPLETE = {
  ...COMPLETE,
  consultedMeasured: ["ofac"],
  notConsulted: [{ source: "scamsniffer", reason: "STALE" }],
  state: "PARTIAL",
  negativeConclusive: false,
};

const couvertureMock = vi.fn();
vi.mock("@/lib/intelligence/sanctionCoverage", async (orig) => {
  const reel = await orig<typeof import("@/lib/intelligence/sanctionCoverage")>();
  return { ...reel, readIntelligenceCoverage: (...a: unknown[]) => couvertureMock(...a) };
});

// Un jeton propre : aucun signal, identité résolue → projection ALLOW.
vi.mock("@/lib/tigerscore/engine", () => ({
  computeTigerScoreWithIntel: vi.fn().mockResolvedValue({
    finalScore: 0,
    finalTier: "GREEN",
    score: 0,
    tier: "GREEN",
    drivers: [],
    confidence: "High",
    intelligence: null,
  }),
}));
// L'identité canonique passe par une sonde RÉSEAU (`resolveToken`). En test
// elle échoue, la projection retombe sur WARN, et les deux cas de couverture
// rendraient WARNING — le test « incomplète → pas SAFE » passerait alors POUR
// LA MAUVAISE RAISON. C'est ce que le contrôle de sur-correction a attrapé.
vi.mock("@/lib/prebuy/canonicalTokenIdentity", async (orig) => {
  const reel = await orig<typeof import("@/lib/prebuy/canonicalTokenIdentity")>();
  return {
    ...reel,
    probeCanonicalTokenIdentity: vi.fn(async () => ({
      attested: true,
      chain: "ETH",
      address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      refusal: null,
    })),
  };
});

vi.mock("@/lib/entities/knownBad", () => ({ isKnownBadEvm: vi.fn().mockReturnValue(null) }));
vi.mock("@/lib/caseDb", () => ({ loadCaseByMint: vi.fn().mockReturnValue(null) }));
vi.mock("@/lib/marketProviders", () => ({
  // `url` non nul et `data_unavailable` faux : c'est ce qui atteste
  // `market_pair` sur le chemin SOL. Avec `url: null`, l'identité SOL n'était
  // pas résolue et le chemin retombait sur WARN — les deux cas de couverture
  // rendaient WARNING, et le test n'aurait rien discriminé.
  getMarketSnapshot: vi.fn().mockResolvedValue({
    url: "https://dexscreener.com/solana/paire-de-test",
    source: "dexscreener", liquidity_usd: 1_000_000,
    volume_24h_usd: 50_000, fdv_usd: 2_000_000, pair_age_days: 400,
    cache_hit: false, data_unavailable: false,
  }),
}));
vi.mock("@/lib/tigerscore/adapter", () => ({
  computeTigerScoreFromScan: vi.fn().mockReturnValue({
    score: 0, tier: "GREEN", drivers: [], confidence: "High",
    evidence: [], meta: { version: "p1", chain: "SOL" },
  }),
}));

const CLE = "test-partner-key-s4";
const EVM = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

beforeEach(() => {
  process.env.PARTNER_API_KEY = CLE;
  vi.resetModules();
  couvertureMock.mockReset();
});
afterEach(() => delete process.env.PARTNER_API_KEY);

function req(url: string, opts: { method?: string; body?: unknown } = {}) {
  return new NextRequest(url, {
    method: opts.method ?? "GET",
    headers: { "x-partner-key": CLE },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

/**
 * Les trois routes, et où lire le jeton dans chacune. `batch-score` le porte
 * par item — le jeton EST une propriété de l'adresse, contrairement à la
 * couverture qui décrit les collecteurs.
 */
const ROUTES = [
  {
    nom: "score-lite",
    servir: async () => {
      const { GET } = await import("@/app/api/partner/v1/score-lite/route");
      return GET(req(`http://localhost/api/partner/v1/score-lite?address=${EVM}`));
    },
    jeton: (b: Record<string, unknown>) => b.verdict,
    reco: (b: Record<string, unknown>) => b.recommendation,
  },
  {
    nom: "transaction-check",
    servir: async () => {
      const { POST } = await import("@/app/api/partner/v1/transaction-check/route");
      return POST(req("http://localhost/api/partner/v1/transaction-check", { method: "POST", body: { to: EVM } }));
    },
    jeton: (b: Record<string, unknown>) => (b.to as Record<string, unknown> | undefined)?.verdict ?? b.verdict_to,
    reco: (b: Record<string, unknown>) => b.recommendation,
  },
  {
    nom: "batch-score",
    servir: async () => {
      const { POST } = await import("@/app/api/partner/v1/batch-score/route");
      return POST(req("http://localhost/api/partner/v1/batch-score", { method: "POST", body: { addresses: [EVM] } }));
    },
    jeton: (b: Record<string, unknown>) => ((b.results as Record<string, unknown>[])?.[0])?.verdict,
    reco: (b: Record<string, unknown>) => ((b.results as Record<string, unknown>[])?.[0])?.recommendation,
  },
] as const;

describe("S4/R — le jeton servi obéit à la couverture", () => {
  for (const r of ROUTES) {
    it(`MUTANT — ${r.nom} : couverture INCOMPLÈTE → le jeton n'affirme plus`, async () => {
      couvertureMock.mockResolvedValue(INCOMPLETE);
      const res = await r.servir();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(r.jeton(body), `${r.nom} affirme SAFE sur périmètre incomplet`).not.toBe("SAFE");
      expect(r.jeton(body)).toBe("WARNING");
    });

    it(`██ SUR-CORRECTION — ${r.nom} : couverture COMPLÈTE → le jeton revient`, async () => {
      // Le troisième piège. Un WARNING permanent livré par contrat à des
      // partenaires qui consomment ce jeton est le même défaut sous un autre
      // signe.
      couvertureMock.mockResolvedValue(COMPLETE);
      const body = await (await r.servir()).json();
      expect(r.jeton(body), `${r.nom} ne rend plus jamais SAFE`).toBe("SAFE");
    });

    it(`██ MUTANT — ${r.nom} : ALLOW reste ALLOW, quelle que soit la couverture`, async () => {
      // L'incomplétude interdit une affirmation ; elle ne convertit pas un
      // risque jeton en risque. Si la recommandation bougeait, on aurait
      // converti une lacune de mesure en danger.
      for (const c of [COMPLETE, INCOMPLETE]) {
        couvertureMock.mockResolvedValue(c);
        const body = await (await r.servir()).json();
        const reco = r.reco(body);
        if (reco !== undefined) {
          expect(reco, `${r.nom} : la recommandation a bougé avec la couverture`).toBe("ALLOW");
        }
      }
    });
  }

  it("██ MUTANT — transaction-check : le chemin SOL AUSSI", async () => {
    // ⚠ Le mutant U3 a SURVÉCU à ma première batterie : `transaction-check`
    // porte DEUX sites d'émission du jeton — un pour SOL (:156), un pour EVM
    // (:203) — et je n'exerçais que le second. C'est exactement le défaut
    // mesuré au tour AL, où la route n'exerçait qu'un seul chemin.
    const SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const { POST } = await import("@/app/api/partner/v1/transaction-check/route");
    couvertureMock.mockResolvedValue(INCOMPLETE);
    const degrade = await (
      await POST(req("http://localhost/api/partner/v1/transaction-check", { method: "POST", body: { to: SOL, chain: "sol" } }))
    ).json();
    const jetonDegrade = (degrade.to as Record<string, unknown> | undefined)?.verdict ?? degrade.verdict_to;
    expect(jetonDegrade, "le chemin SOL affirme SAFE sur périmètre incomplet").not.toBe("SAFE");

    vi.resetModules();
    couvertureMock.mockResolvedValue(COMPLETE);
    const { POST: P2 } = await import("@/app/api/partner/v1/transaction-check/route");
    const propre = await (
      await P2(req("http://localhost/api/partner/v1/transaction-check", { method: "POST", body: { to: SOL, chain: "sol" } }))
    ).json();
    const jetonPropre = (propre.to as Record<string, unknown> | undefined)?.verdict ?? propre.verdict_to;
    // SUR-CORRECTION : le chemin SOL retrouve son jeton sur couverture complète.
    expect(jetonPropre).toBe("SAFE");
    // Et les deux cas DIFFÈRENT — sinon ce test ne discriminerait rien.
    expect(jetonPropre).not.toBe(jetonDegrade);
  });

  it("MUTANT — transaction-check : la PROSE suit la même règle que le jeton", async () => {
    const { POST } = await import("@/app/api/partner/v1/transaction-check/route");
    couvertureMock.mockResolvedValue(INCOMPLETE);
    const degrade = await (
      await POST(req("http://localhost/api/partner/v1/transaction-check", { method: "POST", body: { to: EVM } }))
    ).json();
    expect(degrade.reason).not.toContain("no critical risk signals detected");
    expect(degrade.reason).toContain("part of the declared coverage was not verified");
    // Et elle ne NOMME aucune source — la prose ne devient pas un oracle.
    for (const s of ["ofac", "scamsniffer", "amf", "fca"]) {
      expect(String(degrade.reason).toLowerCase()).not.toContain(s);
    }

    vi.resetModules();
    couvertureMock.mockResolvedValue(COMPLETE);
    const { POST: P2 } = await import("@/app/api/partner/v1/transaction-check/route");
    const propre = await (
      await P2(req("http://localhost/api/partner/v1/transaction-check", { method: "POST", body: { to: EVM } }))
    ).json();
    expect(propre.reason).toContain("no critical risk signals detected");
  });

  it("MUTANT — batch-score lit la couverture UNE fois, pas une fois par item", async () => {
    // Elle décrit l'état des collecteurs, pas une adresse. Une lecture par
    // item coûterait un aller-retour base par élément (~300 ms chacun, mesuré
    // en S3) et la ferait passer pour une propriété de l'adresse.
    couvertureMock.mockResolvedValue(COMPLETE);
    const { POST } = await import("@/app/api/partner/v1/batch-score/route");
    const res = await POST(
      req("http://localhost/api/partner/v1/batch-score", {
        method: "POST",
        body: { addresses: [EVM, EVM, EVM] },
      }),
    );
    const body = await res.json();
    expect(body.results).toHaveLength(3);
    expect(couvertureMock, "la couverture est relue par item").toHaveBeenCalledTimes(1);
  });
});
