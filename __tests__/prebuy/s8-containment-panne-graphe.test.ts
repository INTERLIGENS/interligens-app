// ─── BUILD 12 · S8 — CONTAINMENT DU 200 MENTEUR, TÉMOIN COMPORTEMENTAL ────
//
// ██  INVARIANT : PROVIDER/DATA FAILURE != MEASURED ABSENCE.               ██
//
//   lookup réussi + aucune lignée   →  NONE / MESURÉ
//   panne provider / accès données  →  NON MESURÉ / DÉGRADÉ
//
// Le corpus de T2 (`s8-200-menteur-et-autorite-non-exercee.test.ts`, axe T)
// exige la PROPRIÉTÉ sur la paire (producteur, consommateur), par
// transcription, et il admet DEUX voies de correction sans en imposer aucune.
// Ce fichier-ci est l'autre moitié : il exécute la ROUTE RÉELLE et lit les
// nombres servis. Les deux ensemble couvrent la propriété et son effet.
//
// ─── Ce que ce témoin a mesuré AVANT le correctif, le 2026-09-10 ──────────
//
//   S1  200 + overall_status NONE + error   3/3 · degraded false · ALLOW
//   S2  500                                 2/3 · scam_lineage FAILURE · true
//   S3  200 + overall_status NONE, sans error   3/3 · degraded false
//
// S1 et S3 rendaient un objet `coverage` IDENTIQUE AU CARACTÈRE PRÈS. C'est
// le défaut : le contrat servi ne pouvait pas distinguer « mesuré, aucune
// lignée » de « jamais mesuré », et servait ALLOW dans les deux cas.
//
// S3 EST LA GATE DE SUR-CORRECTION, et elle prime : une lignée réellement
// mesurée à NONE — l'état de production réel, `GraphCase` vide — doit RESTER
// mesurée. Si S3 bascule, le correctif a refabriqué la dégradation permanente
// que BUILD 11.1 a fermée, et il est faux.
//
// ⚠ PORTÉE ANNONCÉE. Marché, holders, intel et prisma sont doublés. Ce qui
// est RÉEL : la route elle-même, `canonicalDecision`, `projection`, `schema`
// et l'adaptateur TigerScore. Le témoin prouve le mécanisme sur le code de
// production, jamais un trafic de production.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DecisionCanonique } from "@/lib/prebuy/canonicalDecision";

let captee: DecisionCanonique | null = null;

vi.mock("@/lib/prebuy/projection", async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    projectPreBuy: (d: DecisionCanonique) => {
      captee = d;
      return real.projectPreBuy(d);
    },
  };
});
vi.mock("@/lib/caseDb", () => ({ loadCaseByMint: () => null }));
vi.mock("@/lib/marketProviders", () => ({
  getMarketSnapshot: async () => ({
    data_unavailable: false,
    url: "https://dexscreener.com/solana/x",
    cache_hit: false,
    source: "dexscreener",
    pair_age_days: 120,
    liquidity_usd: 500_000,
    fdv_usd: 9_000_000,
    volume_24h_usd: 100_000,
  }),
}));
vi.mock("@/lib/token/holderConcentration", () => ({
  // L'état MESURÉ en production le 2026-09-09 : holders indisponible des deux
  // côtés (filtre Helius trop large, 429 sur le RPC public). Il est HORS du
  // dénominateur attendu — ruling S5 — donc il ne doit dégrader nulle part.
  fetchTop10HolderPct: async () => ({
    available: false,
    reason: "RPC_429",
    source: null,
    top10Pct: null,
  }),
}));
vi.mock("@/lib/tigerscore/engine", async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    computeTigerScoreWithIntel: async () => ({
      finalScore: 12,
      score: 12,
      drivers: [],
      intelligence: null,
    }),
  };
});
vi.mock("@/lib/intelligence/sanctionCoverage", () => ({
  readIntelligenceCoverage: async () => ({
    negativeConclusive: true,
    expected: [],
    measured: [],
    stale: [],
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { tokenScanAggregate: { upsert: async () => ({ scanCount: 1 }) } },
}));
vi.mock("@/lib/entities/knownBad", () => ({ isKnownBadEvm: () => null }));
vi.mock("@/lib/prebuy/canonicalTokenIdentity", () => ({
  probeCanonicalTokenIdentity: async () => ({ attested: false }),
  PREBUY_EVM_CHAINS: ["ETH"],
}));

const MINT = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";

async function servir(graphe: { status: number; corps: unknown }) {
  captee = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      if (String(url).includes("/api/scan/solana/graph")) {
        return new Response(JSON.stringify(graphe.corps), {
          status: graphe.status,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ result: null }), { status: 200 }); // helius
    }),
  );
  const { GET } = await import("@/app/api/v1/score/route");
  const res = await GET(
    new Request(`http://localhost:3100/api/v1/score?mint=${MINT}`) as never,
  );
  return { corps: await res.json(), decision: captee! };
}

const manque = (d: DecisionCanonique, moteur: string) =>
  d.coverage.missing.find((m) => m.engine === moteur);

beforeEach(() => vi.resetModules());

describe("S8/v1 — une panne d'accès aux données n'est pas une absence mesurée", () => {
  it("S1 · le corps porteur d'un champ `error` ne compte plus comme une mesure", async () => {
    // La forme exacte que le `catch` du graph route servait en 200. Elle reste
    // couverte APRÈS le correctif producteur : deux autres routes internes
    // servent encore cette forme, et la ceinture consommateur les vise.
    const { decision } = await servir({
      status: 200,
      corps: { clusters: [], related_projects: [], overall_status: "NONE", error: "connection refused" },
    });
    expect(decision.coverage.expected).toBe(3);
    expect(decision.coverage.expectedMeasured).toBe(2);
    expect(manque(decision, "scam_lineage")).toEqual({
      engine: "scam_lineage",
      reason: "FAILURE",
    });
    expect(decision.degraded).toBe(true);
    expect(decision.expectedContractSatisfied).toBe(false);
  });

  it("S2 · un statut non-2xx dégrade — le cas que BUILD 10 · P0 couvrait déjà", async () => {
    const { decision } = await servir({ status: 500, corps: { error: "connection refused" } });
    expect(decision.coverage.expectedMeasured).toBe(2);
    expect(manque(decision, "scam_lineage")?.reason).toBe("FAILURE");
    expect(decision.degraded).toBe(true);
  });

  it("S2b · et c'est ce que le PRODUCTEUR sert désormais sur panne", async () => {
    // Ancre sur le correctif côté producteur : le `catch` ne rend plus 200, et
    // le corps d'erreur ne porte plus de valeur de lignée — pas même la valeur
    // neutre. Une panne ne porte aucune lignée.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/api/scan/solana/graph/route.ts", "utf8");
    // Le CODE seul : le commentaire du correctif cite `overall_status` pour
    // dire ce qu'il retire, et une ancre lexicale ne doit pas lire la prose.
    const code = src
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    const bloc = code.slice(code.indexOf("} catch (e: any) {"));
    expect(bloc).toContain("status: 500");
    expect(bloc).not.toContain("overall_status");
  });
});

describe("S8/v2 — GATE DE SUR-CORRECTION : une mesure réelle reste une mesure", () => {
  it("S3 · lookup abouti, aucune lignée — l'état prod réel, `GraphCase` vide", async () => {
    const { decision } = await servir({
      status: 200,
      corps: { clusters: [], related_projects: [], overall_status: "NONE", source: "no_data" },
    });
    expect(decision.coverage.expectedMeasured).toBe(3);
    expect(decision.coverage.expected).toBe(3);
    expect(manque(decision, "scam_lineage")).toBeUndefined();
    expect(decision.degraded).toBe(false);
    expect(decision.expectedContractSatisfied).toBe(true);
  });

  it("S3b · et la réponse servie reste ALLOW — pas de dégradation permanente", async () => {
    const { corps } = await servir({
      status: 200,
      corps: { clusters: [], related_projects: [], overall_status: "NONE", source: "no_data" },
    });
    expect(corps.phantom_warning_level).toBe("ALLOW");
  });

  it("S4 · une lignée RÉELLE reste servie, et elle reste mesurée", async () => {
    // La méthodologie de lignée n'est pas touchée par ce containment : un
    // CONFIRMED continue de remonter, et il compte au numérateur.
    const { decision } = await servir({
      status: 200,
      corps: { clusters: [{ id: "c0" }], related_projects: [], overall_status: "CONFIRMED" },
    });
    expect(decision.coverage.expectedMeasured).toBe(3);
    expect(decision.degraded).toBe(false);
    expect(decision.verdict).toBe("STOP");
  });
});

describe("S8/v3 — S1 et S3 ne sont plus indiscernables", () => {
  it("les deux objets `coverage` DIFFÈRENT — c'était le défaut", async () => {
    const panne = await servir({
      status: 200,
      corps: { overall_status: "NONE", error: "connection refused" },
    });
    const mesure = await servir({
      status: 200,
      corps: { overall_status: "NONE", source: "no_data" },
    });
    expect(JSON.stringify(panne.decision.coverage)).not.toBe(
      JSON.stringify(mesure.decision.coverage),
    );
    // Et holders reste HORS dénominateur des deux côtés — ruling S5 non défait.
    for (const d of [panne.decision, mesure.decision]) {
      expect(manque(d, "holders")?.reason).toBe("NOT_REQUESTED_BY_CONTRACT");
      expect(d.coverage.expected).toBe(3);
    }
  });
});
