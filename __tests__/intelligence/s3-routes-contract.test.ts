// ─── S3 · LE CONTRAT DES QUATRE ROUTES, VERROUILLÉ ─────────────────────────
//
// ██  Un mutant qui ne mord pas est une preuve manquante, et je le dis.     ██
//
// ─── Pourquoi ce fichier existe ───────────────────────────────────────────
//
// Après le merge du câblage, j'ai annoncé « 4 mutants, 4 mordent ». C'était
// vrai pour trois d'entre eux et FAUX pour le quatrième. Mesuré :
//
//   J'ai retiré `intelligence_coverage` ENTIÈREMENT de
//   src/app/api/partner/v1/score-lite/route.ts, puis lancé la suite complète.
//   Résultat : 421 fichiers, 5596 tests, TOUS VERTS.
//
// Le mutant survit. Le snapshot d'anti-régression verrouillait bien le champ,
// mais UNIQUEMENT sur /api/v1/score — 20 occurrences, une seule route. Les
// trois routes partenaires portaient le champ sans que rien ne l'exige.
//
// C'est le défaut le plus discret de la famille : le contrat EXISTAIT en
// production, et rien n'empêchait un refactor de le retirer en silence. Un
// champ servi mais non verrouillé n'est pas un contrat — c'est une
// coïncidence qui tient jusqu'au prochain commit.
//
// ─── Ce que ce fichier juge, et ce qu'il ne juge pas ──────────────────────
//
// Il juge la PRÉSENCE et la FORME du champ dans la charge utile réellement
// rendue par chaque route. Il ne juge pas la sémantique de la couverture —
// s3-coverage-semantics.test.ts s'en charge, et dupliquer serait créer une
// seconde autorité qui divergerait.
//
// Il vit dans __tests__/ et non sous la route : le préfixe ^src/app/api/ est
// gelé, et ouvrir une fenêtre de garde pour poser un test serait payer un
// risque de périmètre pour un fichier qu'aucune route ne charge.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Les coutures base, mockées comme le fait déjà le corpus partenaire ────
//
// La lecture de couverture fait un aller-retour base : 2905 ms à froid, ~300 ms
// ensuite. Sans mock, ce fichier taperait la vraie production et deviendrait
// instable. On rend une couverture COMPLÈTE — le cas où la phrase rassurante
// est légitime, donc le cas le moins complaisant pour un test de présence.

const COUVERTURE = {
  expected: ["ofac", "scamsniffer"],
  consultedMeasured: ["ofac", "scamsniffer"],
  notConsulted: [],
  declaredNotArmed: [
    { source: "amf", reason: "NOT_MEASURED" },
    { source: "fca", reason: "NOT_MEASURED" },
    { source: "forta", reason: "NOT_MEASURED" },
    { source: "goplus", reason: "NOT_MEASURED" },
  ],
  denominator: 2,
  state: "COMPLETE",
  negativeConclusive: true,
} as const;

vi.mock("@/lib/intelligence/sanctionCoverage", async (orig) => {
  const reel = await orig<typeof import("@/lib/intelligence/sanctionCoverage")>();
  return { ...reel, readIntelligenceCoverage: vi.fn(async () => COUVERTURE) };
});

vi.mock("@/lib/tigerscore/engine", () => ({
  computeTigerScoreWithIntel: vi.fn().mockResolvedValue({
    finalScore: 85,
    finalTier: "RED",
    score: 85,
    tier: "RED",
    drivers: [{ id: "s1", label: "Signal 1", severity: "high", delta: 35, why: "test" }],
    confidence: "Medium",
    intelligence: null,
  }),
}));

vi.mock("@/lib/entities/knownBad", () => ({ isKnownBadEvm: vi.fn().mockReturnValue(null) }));
vi.mock("@/lib/caseDb", () => ({ loadCaseByMint: vi.fn().mockReturnValue(null) }));

vi.mock("@/lib/marketProviders", () => ({
  getMarketSnapshot: vi.fn().mockResolvedValue({
    url: null,
    source: "dexscreener",
    liquidity_usd: null,
    volume_24h_usd: null,
    fdv_usd: null,
    pair_age_days: null,
    cache_hit: false,
  }),
}));

vi.mock("@/lib/tigerscore/adapter", () => ({
  computeTigerScoreFromScan: vi.fn().mockReturnValue({
    score: 0,
    tier: "GREEN",
    drivers: [],
    confidence: "Low",
    evidence: [],
    meta: { version: "p1", chain: "SOL" },
  }),
}));

const CLE = "test-partner-key-abc123";
const EVM = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

function req(url: string, opts: { method?: string; body?: unknown } = {}): NextRequest {
  return new NextRequest(url, {
    method: opts.method ?? "GET",
    headers: { "x-partner-key": CLE },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

/**
 * La FORME attendue, une seule fois. Chaque route la vérifie sur SA charge
 * utile — c'est le nom de la clé qui diffère d'une route à l'autre, pas le
 * contenu.
 *
 * Sur les routes partenaires la clé est `intelligence_coverage` : leur charge
 * utile est en snake_case strict (`risk_score`, `verdict_to`). Sur
 * /api/v1/score elle est `intelligenceCoverage` : cette charge utile est déjà
 * mixte et porte `communityScans`. Chaque route suit sa propre convention
 * plutôt qu'une convention importée — et ce test épingle ce choix, pour qu'il
 * soit délibéré et non subi.
 */
function verifierLaForme(cov: unknown, ou: string) {
  expect(cov, `${ou} ne porte AUCUNE couverture`).toBeDefined();
  const c = cov as Record<string, unknown>;
  for (const clef of [
    "expected",
    "consultedMeasured",
    "notConsulted",
    "declaredNotArmed",
    "denominator",
    "state",
    "negativeConclusive",
  ]) {
    expect(c, `${ou} : clef \`${clef}\` absente`).toHaveProperty(clef);
  }
  // Le champ qui décide, et son type. Un `negativeConclusive` absent ou non
  // booléen rendrait le reste décoratif.
  expect(typeof c.negativeConclusive, `${ou} : negativeConclusive non booléen`).toBe("boolean");
  // Les jamais armées sont NOMMÉES, pas comptées : c'est la distinction que
  // toute la fenêtre S3 sert à rendre lisible.
  expect(Array.isArray(c.declaredNotArmed), `${ou} : declaredNotArmed n'est pas une liste`).toBe(true);
  expect(c.expected, `${ou} : le dénominateur n'est pas le périmètre déclaré`).not.toContain("amf");
}

beforeEach(() => {
  process.env.PARTNER_API_KEY = CLE;
  vi.resetModules();
});
afterEach(() => {
  delete process.env.PARTNER_API_KEY;
});

// ═══ LES TROIS ROUTES PARTENAIRES — celles que rien ne verrouillait ══════

describe("S3/R — le contrat partenaire porte la couverture", () => {
  it("MUTANT — `score-lite` la porte (le mutant qui SURVIVAIT)", async () => {
    // Retirer `intelligence_coverage` de cette route laissait 5596 tests
    // verts. C'est exactement ce cas-là qui est fermé ici.
    const { GET } = await import("@/app/api/partner/v1/score-lite/route");
    const res = await GET(req(`http://localhost/api/partner/v1/score-lite?address=${EVM}`));
    expect(res.status).toBe(200);
    verifierLaForme((await res.json()).intelligence_coverage, "score-lite");
  });

  it("MUTANT — `transaction-check` la porte", async () => {
    const { POST } = await import("@/app/api/partner/v1/transaction-check/route");
    const res = await POST(
      req("http://localhost/api/partner/v1/transaction-check", {
        method: "POST",
        body: { to: EVM },
      }),
    );
    expect(res.status).toBe(200);
    verifierLaForme((await res.json()).intelligence_coverage, "transaction-check");
  });

  it("MUTANT — `batch-score` la porte UNE fois, au niveau du lot", async () => {
    const { POST } = await import("@/app/api/partner/v1/batch-score/route");
    const res = await POST(
      req("http://localhost/api/partner/v1/batch-score", {
        method: "POST",
        body: { addresses: [EVM] },
      }),
    );
    expect(res.status).toBe(200);
    const corps = await res.json();
    verifierLaForme(corps.intelligence_coverage, "batch-score");
  });

  it("MUTANT — `batch-score` ne la répète PAS par item", async () => {
    // La couverture décrit l'état des collecteurs, pas une adresse. La
    // répéter par item la ferait passer pour une propriété de l'adresse —
    // exactement la confusion que toute la fenêtre S3 corrige.
    const { POST } = await import("@/app/api/partner/v1/batch-score/route");
    const res = await POST(
      req("http://localhost/api/partner/v1/batch-score", {
        method: "POST",
        body: { addresses: [EVM] },
      }),
    );
    const corps = await res.json();
    const items: unknown[] = corps.results ?? corps.scores ?? corps.items ?? [];
    expect(items.length, "aucun item — le test ne jugerait rien").toBeGreaterThan(0);
    for (const item of items) {
      expect(item, "un item porte la couverture, comme si elle était une propriété de l'adresse")
        .not.toHaveProperty("intelligence_coverage");
      expect(item).not.toHaveProperty("intelligenceCoverage");
    }
  });
});

// ═══ LA ROUTE PUBLIQUE — déjà verrouillée par le snapshot, redite ici ════

describe("S3/R — la route publique porte la couverture, EVM et SOL", () => {
  // Le snapshot d'anti-régression la verrouille déjà (20 occurrences). On la
  // reprend quand même : le snapshot juge une CHARGE UTILE entière et se
  // régénère d'un `-u` distrait ; ce test-ci juge la propriété, et un `-u` ne
  // le fait pas taire.

  it("MUTANT — le chemin EVM porte `intelligenceCoverage`", async () => {
    const { GET } = await import("@/app/api/v1/score/route");
    const res = await GET(new NextRequest(`http://localhost/api/v1/score?mint=${EVM}`));
    expect(res.status).toBe(200);
    verifierLaForme((await res.json()).intelligenceCoverage, "v1/score EVM");
  });

  it("MUTANT — le chemin SOL la porte AUSSI", async () => {
    // Les deux chemins ont été câblés séparément dans le même fichier. Rien
    // ne garantit qu'ils restent d'accord : c'est précisément le défaut mesuré
    // sur l'adaptateur EVM au tour AL, où la route n'exerçait qu'un chemin.
    const { GET } = await import("@/app/api/v1/score/route");
    const SOL = "So11111111111111111111111111111111111111112";
    const res = await GET(new NextRequest(`http://localhost/api/v1/score?mint=${SOL}`));
    expect(res.status).toBe(200);
    verifierLaForme((await res.json()).intelligenceCoverage, "v1/score SOL");
  });
});
