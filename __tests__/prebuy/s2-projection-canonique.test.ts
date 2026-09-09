// ─── BUILD 12 · S2 — LA CHAÎNE UNIQUE, ET SES NEUF MUTANTS ─────────────────
//
// ██  REFLEX est l'autorité. Tout le reste projette.                       ██
//
// Ce fichier juge l'IMPLÉMENTATION RÉELLE. Le témoin de T2 (s4-…) prouvait que
// la batterie était satisfiable ; celui-ci prouve qu'elle est satisfaite.
//
// La batterie ci-dessous est la sienne, portée sur `projectPreBuy` : mêmes
// critères, mêmes noms. Un critère relâché se verrait, puisque les deux
// fichiers coexistent dans la suite.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  canonicalPreBuyDecision,
  contratSatisfait,
  estDegrade,
  type DecisionCanonique,
  type ManqueMesure,
} from "@/lib/prebuy/canonicalDecision";
import { resolveTokenIdentity } from "@/lib/prebuy/identity";
import {
  projectPreBuy,
  toSwapTier,
  toPartnerVerdict,
  toPartnerRecommendation,
  buildPartnerReason,
  REASSURANCE,
  type PreBuyProjection,
} from "@/lib/prebuy/projection";
import { phantomFromProjection } from "@/lib/publicScore/schema";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const codeSeul = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

const PANNE: ManqueMesure[] = [{ engine: "tigerscore", reason: "FAILURE" }];
const HORS_CONTRAT: ManqueMesure[] = [
  { engine: "narrative", reason: "NOT_REQUESTED_BY_CONTRACT" },
  { engine: "recidivism", reason: "NOT_APPLICABLE" },
];

/** Une décision complète, avec des défauts sains. */
const d = (o: Partial<DecisionCanonique> & Pick<DecisionCanonique, "verdict">): DecisionCanonique => ({
  verdictSource: "REFLEX",
  expectedContractSatisfied: true,
  degraded: false,
  coverage: { expected: 4, expectedMeasured: 4, missing: [] },
  identityResolved: true,
  ...o,
});

type Impl = (x: DecisionCanonique) => PreBuyProjection;

// ═══ LA BATTERIE — celle de T2, sur le code réel ═════════════════════════

function batterie(impl: Impl): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // ── 1 · LA TABLE ─────────────────────────────────────────────────────
  dit(impl(d({ verdict: "STOP" })).level === "BLOCK", "T1 STOP→BLOCK");
  dit(impl(d({ verdict: "WAIT" })).level === "WARN", "T2 WAIT→WARN");
  dit(impl(d({ verdict: "VERIFY" })).level === "WARN", "T3 VERIFY→WARN");
  dit(impl(d({ verdict: "INSUFFICIENT_COVERAGE" })).level === "WARN", "T4 IC→WARN");
  dit(impl(d({ verdict: "NO_CRITICAL_SIGNAL" })).level === "ALLOW", "T5 NCS-soutenu→ALLOW");
  dit(
    impl(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true })).level === "WARN" &&
    impl(d({ verdict: "NO_CRITICAL_SIGNAL", expectedContractSatisfied: false })).level === "WARN",
    "T6 NCS-degrade→WARN",
  );

  // ── 2 · LA PROPRIÉTÉ CENTRALE ────────────────────────────────────────
  const memeVerdict = [
    impl(d({ verdict: "NO_CRITICAL_SIGNAL" })).level,
    impl(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true })).level,
  ];
  dit(memeVerdict[0] !== memeVerdict[1], "P1 projection-du-verdict-seul");

  // ── 3 · WAIT ET VERIFY ───────────────────────────────────────────────
  const w = impl(d({ verdict: "WAIT" }));
  const vf = impl(d({ verdict: "VERIFY" }));
  dit(w.level === vf.level, "P2 WAIT-VERIFY-niveaux-divergents");
  dit(w.because === "WAIT" && vf.because === "VERIFY", "P3 WAIT-VERIFY-confondus");

  // ── 4 · LES 7 PROPRIÉTÉS DU CONTAINMENT ──────────────────────────────
  dit(
    [
      impl(d({ verdict: "INSUFFICIENT_COVERAGE" })),
      impl(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true, coverage: { expected: 4, expectedMeasured: 3, missing: PANNE } })),
      impl(d({ verdict: "NO_CRITICAL_SIGNAL", expectedContractSatisfied: false })),
    ].every((r) => r.level !== "ALLOW"),
    "C1 absence→ALLOW",
  );
  dit(
    impl(d({ verdict: "TOTALEMENT_INCONNU" as DecisionCanonique["verdict"] })).level !== "ALLOW",
    "C2 defaut-permissif",
  );
  dit(
    impl(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true, coverage: { expected: 4, expectedMeasured: 0, missing: PANNE } })).level !== "ALLOW",
    "C3 ALLOW-sur-panne",
  );
  dit(
    impl(d({ verdict: "STOP", degraded: true, coverage: { expected: 4, expectedMeasured: 1, missing: PANNE } })).level === "BLOCK",
    "C4 BLOCK-efface-par-panne-soeur",
  );
  const preserve = impl(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true, coverage: { expected: 4, expectedMeasured: 3, missing: PANNE } }));
  dit(preserve.missing.length === 1 && preserve.missing[0].reason === "FAILURE", "C5 mesure-non-preservee");
  dit(preserve.degraded === true, "C5b degraded-non-transporte");
  dit(
    impl(d({ verdict: "NO_CRITICAL_SIGNAL" })).reassurance === REASSURANCE &&
    [
      impl(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true })),
      impl(d({ verdict: "NO_CRITICAL_SIGNAL", expectedContractSatisfied: false })),
      impl(d({ verdict: "INSUFFICIENT_COVERAGE" })),
      impl(d({ verdict: "STOP" })),
    ].every((r) => r.reassurance === null),
    "C6 reassurance-non-soutenue",
  );
  dit(!/\d/.test(JSON.stringify(impl(d({ verdict: "WAIT" })))), "C7 nombre-dans-la-projection");

  // ── 5 · IDENTITÉ ─────────────────────────────────────────────────────
  dit(
    impl(d({ verdict: "NO_CRITICAL_SIGNAL", identityResolved: false })).level !== "ALLOW",
    "I1 identite-non-resolue→ALLOW",
  );
  dit(
    impl(d({ verdict: "STOP", identityResolved: false })).level !== "ALLOW",
    "I2 identite-non-resolue-sur-STOP",
  );

  // ── 6 · SUR-CORRECTIONS ──────────────────────────────────────────────
  const horsContrat = impl(d({
    verdict: "NO_CRITICAL_SIGNAL",
    coverage: { expected: 4, expectedMeasured: 4, missing: HORS_CONTRAT },
  }));
  dit(horsContrat.level === "ALLOW", "S1 fausse-degradation-sur-NOT_APPLICABLE");
  dit(horsContrat.missing.length === 2, "S2 manquants-hors-contrat-effaces");
  dit(
    horsContrat.missing.every((m) => !["WITHHELD", "NOT_PUBLISHED"].includes(m.reason)),
    "S3 publication-sur-axe-mesure",
  );
  dit(impl(d({ verdict: "STOP" })).level === "BLOCK", "S4 STOP-supprime");

  return v;
}

describe("S2/0 — l'implémentation RÉELLE satisfait la batterie de T2", () => {
  it("`projectPreBuy` passe les 20 critères", () => {
    expect(batterie(projectPreBuy)).toEqual([]);
  });
});

// ═══ LES NEUF MUTANTS EXIGÉS ═════════════════════════════════════════════

describe("S2/1 — mutants de projection", () => {
  const cas: Array<[string, Impl, string]> = [
    [
      "la projection lit le VERDICT SEUL, sans état de mesure",
      (x) => ({
        ...projectPreBuy(x),
        level: x.verdict === "STOP" ? "BLOCK" : x.verdict === "NO_CRITICAL_SIGNAL" ? "ALLOW" : "WARN",
        reassurance: x.verdict === "NO_CRITICAL_SIGNAL" ? REASSURANCE : null,
      }),
      "P1 projection-du-verdict-seul",
    ],
    [
      "NO_CRITICAL_SIGNAL dégradé projette ALLOW",
      (x) => (x.verdict === "NO_CRITICAL_SIGNAL"
        ? { ...projectPreBuy(x), level: "ALLOW", reassurance: REASSURANCE }
        : projectPreBuy(x)),
      "T6 NCS-degrade→WARN",
    ],
    [
      "une identité non résolue est traitée comme résolue",
      (x) => projectPreBuy({ ...x, identityResolved: true }),
      "I1 identite-non-resolue→ALLOW",
    ],
    [
      "SUR-CORRECTION — tout projette WARN, y compris un NCS pleinement mesuré",
      (x) => ({ ...projectPreBuy(x), level: "WARN", reassurance: null }),
      "T1 STOP→BLOCK",
    ],
    [
      "SUR-CORRECTION — un STOP légitime est dégradé en WARN",
      (x) => (x.verdict === "STOP" ? { ...projectPreBuy(x), level: "WARN" } : projectPreBuy(x)),
      "T1 STOP→BLOCK",
    ],
    [
      "WAIT et VERIFY sont CONFONDUS en interne",
      (x) => ({ ...projectPreBuy(x), because: x.verdict === "VERIFY" ? "WAIT" : x.verdict }),
      "P3 WAIT-VERIFY-confondus",
    ],
  ];

  for (const [nom, impl, critere] of cas) {
    it(`MORD — ${nom}`, () => {
      const violes = batterie(impl);
      expect(violes, `mutant SURVIVANT = preuve manquante — ${nom}`).not.toEqual([]);
      expect(violes, `tué, mais pas par ${critere}`).toContain(critere);
    });
  }
});

// ═══ MUTANT — computeVerdict redevient une autorité ══════════════════════

describe("S2/2 — computeVerdict n'est plus une autorité de risque", () => {
  const CODE = codeSeul(lire("src/lib/publicScore/computeVerdict.ts"));

  it("MORD — la table de seuils a disparu du fichier", () => {
    // Le mutant est la restauration de `function toVerdict(score)`. Il ne peut
    // pas coexister avec ces assertions.
    expect(CODE).not.toContain("function toVerdict");
    expect(CODE).not.toMatch(/score >= 70/);
    expect(CODE).not.toMatch(/score >= 35/);
  });

  it("le verdict est PROJETÉ, pas calculé", () => {
    expect(CODE).toContain("toSwapTier(m.projection)");
    expect(CODE).toContain("canonicalPreBuyDecision(");
    expect(CODE).toContain("projectPreBuy(");
  });

  it("aucune des quatre surfaces ne rejoue la table", () => {
    // Les quatre copies mesurées avant migration. Aucune ne doit subsister.
    for (const p of [
      "src/app/api/v1/score/route.ts",
      "src/app/api/partner/v1/transaction-check/route.ts",
      "src/app/api/partner/v1/score-lite/route.ts",
      "src/app/api/partner/v1/batch-score/route.ts",
    ]) {
      const code = codeSeul(lire(p));
      expect(code, p).not.toMatch(/>= 70\s*\?|if \(score >= 70\)/);
      expect(code, p).not.toMatch(/>= 35\s*\?|if \(score >= 35\)/);
      expect(code, p).not.toMatch(/if \(score >= 40\)/);
    }
  });

  it("les bornes vivent à UN SEUL endroit, et y sont nommées", () => {
    const canon = codeSeul(lire("src/lib/prebuy/canonicalDecision.ts"));
    expect(canon).toContain("export const SEUIL_CRITIQUE = 70");
    expect(canon).toContain("export const SEUIL_ELEVE = 35");
    // Le 40 était la duplication elle-même. Il ne revient pas.
    expect(canon).not.toContain("40");
  });
});

// ═══ MUTANT — la bande 35–39 ═════════════════════════════════════════════

describe("S2/3 — verdict et action ne peuvent plus diverger", () => {
  const decisionPour = (score: number) =>
    canonicalPreBuyDecision({
      score,
      measurement: { expected: 2, expectedMeasured: 2, missing: [] },
      identity: resolveTokenIdentity({
        syntacticallyValid: true,
        attestations: [{ source: "casefile", attests: true }],
      }),
    });

  it("MORD — sur TOUT le domaine 0–100, verdict et recommandation s'accordent", () => {
    // Le défaut : `toVerdict` basculait à 35, `toRecommendation` à 40. Dans la
    // bande 35–39 une seule réponse portait `WARNING` + `ALLOW`.
    const accord: Record<string, string> = { SAFE: "ALLOW", WARNING: "WARN", AVOID: "BLOCK" };
    const divergents: number[] = [];
    for (let s = 0; s <= 100; s++) {
      const p = projectPreBuy(decisionPour(s));
      if (accord[toPartnerVerdict(p)] !== toPartnerRecommendation(p)) divergents.push(s);
    }
    expect(divergents).toEqual([]);
  });

  it("la bande 35–39 est WARNING + WARN, pas WARNING + ALLOW", () => {
    for (const s of [35, 36, 37, 38, 39]) {
      const p = projectPreBuy(decisionPour(s));
      expect(toPartnerVerdict(p), `score ${s}`).toBe("WARNING");
      expect(toPartnerRecommendation(p), `score ${s}`).toBe("WARN");
    }
  });

  it("et les deux bords du domaine ne bougent pas", () => {
    expect(toPartnerVerdict(projectPreBuy(decisionPour(0)))).toBe("SAFE");
    expect(toPartnerVerdict(projectPreBuy(decisionPour(34)))).toBe("SAFE");
    expect(toPartnerVerdict(projectPreBuy(decisionPour(70)))).toBe("AVOID");
    expect(toPartnerVerdict(projectPreBuy(decisionPour(100)))).toBe("AVOID");
  });
});

// ═══ MUTANT — buildReason sans mesure ════════════════════════════════════

describe("S2/4 — la phrase partenaire n'est émise que si la mesure la soutient", () => {
  const soutenue = projectPreBuy(d({ verdict: "NO_CRITICAL_SIGNAL" }));
  const nonSoutenue = projectPreBuy(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true }));

  it("MORD — sans support, « no critical risk signals detected » n'apparaît pas", () => {
    expect(buildPartnerReason(nonSoutenue, 12, 0)).not.toContain("no critical risk signals detected");
    expect(buildPartnerReason(nonSoutenue, 12, 0)).toContain("unverified, not safe");
  });

  it("avec support, elle apparaît — la sur-correction serait de ne plus jamais la dire", () => {
    expect(buildPartnerReason(soutenue, 12, 0)).toContain("no critical risk signals detected");
  });

  it("le préfixe `Score N/100 — ` est conservé au caractère près", () => {
    expect(buildPartnerReason(soutenue, 12, 0)).toMatch(/^Score 12\/100 — /);
    expect(buildPartnerReason(nonSoutenue, 12, 0)).toMatch(/^Score 12\/100 — /);
  });

  it("la signature ne reçoit plus (score, signalsCount) seuls", () => {
    // Premier paramètre : la projection, donc verdict + état de mesure.
    //
    // S4 — le `?` de TypeScript est effacé à l'exécution : `Function.length`
    // compte le quatrième paramètre, et il vaut désormais 4. Je l'avais écrit
    // l'inverse ; mesuré, c'est 4.
    //
    // Un nombre ne dit de toute façon PAS quels paramètres : `(score,
    // signalsCount, x, y)` vaudrait 4 aussi. C'est la SIGNATURE qui porte la
    // propriété, et elle exige la projection EN PREMIER.
    expect(buildPartnerReason.length).toBe(4);
    const src = lire("src/lib/prebuy/projection.ts");
    expect(src).toMatch(
      /export function buildPartnerReason\(\s*p: PreBuyProjection,\s*score: number,\s*signalsCount: number,/,
    );
  });
});

// ═══ MUTANT — le schéma partenaire ═══════════════════════════════════════

describe("S2/5 — le contrat partner/v1 ne change ni de forme ni de domaine", () => {
  const R = (p: string) => lire(`src/app/api/partner/v1/${p}/route.ts`);

  /**
   * L'alias EXACT, terminateur compris.
   *
   * `toContain` seul ne mordait pas : `"AVOID"` reste contenu dans
   * `"AVOID" | "UNKNOWN"`, donc un jeton AJOUTÉ au domaine passait. Mesuré par
   * le mutant M8a, qui a survécu. Un test faux ment dans les deux sens.
   */
  const alias = (src: string, nom: string): string | null => {
    const m = src.match(new RegExp(`^type ${nom} = (.+);$`, "m"));
    return m ? m[1] : null;
  };

  it("MORD — les domaines de valeurs sont intacts, `SAFE` compris et RIEN de plus", () => {
    for (const p of ["transaction-check", "score-lite", "batch-score"]) {
      expect(alias(R(p), "Verdict"), p).toBe('"SAFE" | "WARNING" | "AVOID"');
    }
    expect(alias(R("transaction-check"), "Recommendation")).toBe('"ALLOW" | "WARN" | "BLOCK"');
    for (const p of ["score-lite", "batch-score"]) {
      expect(alias(R(p), "Tier"), p).toBe('"GREEN" | "ORANGE" | "RED"');
    }
  });

  /**
   * Les clés de l'OBJET DE RÉPONSE, pas du fichier.
   *
   * Chercher `verdict_to` n'importe où dans la source ne mordait pas non plus :
   * le nom survit dans un type ou un commentaire même après avoir été retiré
   * du payload. Mesuré par le mutant M8b, qui a survécu.
   */
  const clesReponse = (src: string): string[] => {
    const i = src.indexOf("NextResponse.json(\n    {");
    const debut = i >= 0 ? i : src.indexOf("const payload");
    const bloc = src.slice(debut, src.indexOf("}", src.indexOf("powered_by", debut)));
    // `key: valeur` ET la forme abrégée `key,` — les deux sont des clés du
    // payload, et n'en reconnaître qu'une en manquerait la moitié.
    return [...bloc.matchAll(/^\s{4,6}([a-z_]+)[,:]/gm)].map((m) => m[1]);
  };

  it("MORD — les 8 clés de transaction-check sont dans le PAYLOAD", () => {
    const cles = clesReponse(R("transaction-check"));
    for (const k of ["recommendation", "reason", "score_to", "score_from",
                     "verdict_to", "chain", "version", "powered_by"]) {
      expect(cles, k).toContain(k);
    }
  });

  it("MORD — les 9 clés de score-lite sont dans le PAYLOAD", () => {
    const cles = clesReponse(R("score-lite"));
    for (const k of ["address", "score", "verdict", "tier", "signals_count",
                     "cache_hit", "as_of", "version", "powered_by"]) {
      expect(cles, k).toContain(k);
    }
  });

  it("`SAFE` reste ÉMISSIBLE — le retirer casserait des partenaires", () => {
    const p = projectPreBuy(d({ verdict: "NO_CRITICAL_SIGNAL" }));
    expect(toPartnerVerdict(p)).toBe("SAFE");
    expect(toSwapTier(p)).toBe("GREEN");
  });

  it("mais plus sur le seul score : la CONDITION a changé, pas le jeton", () => {
    const p = projectPreBuy(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true }));
    expect(toPartnerVerdict(p)).toBe("WARNING");
  });
});

// ═══ IDENTITÉ GOUVERNÉE ══════════════════════════════════════════════════

describe("S2/6 — identité", () => {
  it("une forme valide sans autorité ne résout pas", () => {
    expect(resolveTokenIdentity({ syntacticallyValid: true, attestations: [] })).toEqual({
      resolved: false,
      reason: "NO_AUTHORITY",
    });
  });

  it("une forme invalide non plus, et pour une autre raison", () => {
    expect(
      resolveTokenIdentity({
        syntacticallyValid: false,
        attestations: [{ source: "casefile", attests: true }],
      }),
    ).toEqual({ resolved: false, reason: "SYNTAX" });
  });

  it("MORD — un symbole ne fait PAS autorité, même en affirmant connaître la cible", () => {
    for (const faux of ["symbol", "ticker", "name", "cashtag"]) {
      const r = resolveTokenIdentity({
        syntacticallyValid: true,
        attestations: [{ source: faux, attests: true }],
      });
      expect(r.resolved, faux).toBe(false);
    }
  });

  it("une autorité qui n'atteste pas ne compte pas non plus", () => {
    const r = resolveTokenIdentity({
      syntacticallyValid: true,
      attestations: [{ source: "casefile", attests: false }],
    });
    expect(r.resolved).toBe(false);
  });

  it("une seule autorité suffit, et elle est nommée", () => {
    const r = resolveTokenIdentity({
      syntacticallyValid: true,
      attestations: [
        { source: "market_pair", attests: true },
        { source: "symbol", attests: true },
      ],
    });
    expect(r).toEqual({ resolved: true, authorities: ["market_pair"] });
  });

  it("« 1 » quarante-quatre fois : syntaxiquement valide, jamais résolu", () => {
    // Le cas exact du corpus S1 de T2.
    const decision = canonicalPreBuyDecision({
      score: 0,
      measurement: { expected: 2, expectedMeasured: 2, missing: [] },
      identity: resolveTokenIdentity({ syntacticallyValid: true, attestations: [] }),
    });
    const p = projectPreBuy(decision);
    expect(p.level).toBe("WARN");
    expect(p.reassurance).toBeNull();
    expect(phantomFromProjection(p).disclaimer).toMatch(/could not be resolved/i);
  });
});

// ═══ LA DÉCISION CANONIQUE ═══════════════════════════════════════════════

describe("S2/7 — l'autorité, et son ordre", () => {
  const idOk = resolveTokenIdentity({
    syntacticallyValid: true,
    attestations: [{ source: "casefile", attests: true }],
  });
  const m = { expected: 2, expectedMeasured: 2, missing: [] };

  it("REFLEX prime : quand il a tranché, aucune borne n'est consultée", () => {
    const r = canonicalPreBuyDecision({ reflexVerdict: "WAIT", score: 95, measurement: m, identity: idOk });
    expect(r.verdict).toBe("WAIT");
    expect(r.verdictSource).toBe("REFLEX");
  });

  it("sans REFLEX, le score legacy décide — et le dit", () => {
    const r = canonicalPreBuyDecision({ score: 95, measurement: m, identity: idOk });
    expect(r.verdict).toBe("STOP");
    expect(r.verdictSource).toBe("LEGACY_SCORE");
  });

  it("aucune mesure du tout → INSUFFICIENT_COVERAGE, jamais un verdict fabriqué", () => {
    expect(
      canonicalPreBuyDecision({ score: null, measurement: m, identity: idOk }).verdict,
    ).toBe("INSUFFICIENT_COVERAGE");
    expect(
      canonicalPreBuyDecision({
        score: 0,
        measurement: { expected: 3, expectedMeasured: 0, missing: PANNE },
        identity: idOk,
      }).verdict,
    ).toBe("INSUFFICIENT_COVERAGE");
  });

  it("`expected === 0` n'est pas une couverture parfaite", () => {
    expect(contratSatisfait({ expected: 0, expectedMeasured: 0, missing: [] })).toBe(false);
    expect(contratSatisfait({ expected: 2, expectedMeasured: 2, missing: [] })).toBe(true);
  });

  it("SUR-CORRECTION — un manquant HORS CONTRAT ne dégrade pas", () => {
    expect(estDegrade({ expected: 4, expectedMeasured: 4, missing: HORS_CONTRAT })).toBe(false);
    expect(estDegrade({ expected: 4, expectedMeasured: 4, missing: PANNE })).toBe(true);
  });
});

// ═══ ALLOW RESTE ATTEIGNABLE — le contrôle positif ═══════════════════════
//
// Sans ce test, la migration entière pourrait n'être qu'un WARN permanent, et
// tous les autres critères passeraient quand même. Avertir toujours ne vaut
// pas mieux qu'autoriser toujours.

vi.mock("@/lib/publicScore/rateLimit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 99, resetIn: 60 }),
  getClientIp: () => "127.0.0.1",
  corsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/caseDb", () => ({ loadCaseByMint: vi.fn(() => null) }));
vi.mock("@/lib/marketProviders", () => ({ getMarketSnapshot: vi.fn() }));
vi.mock("@/lib/entities/knownBad", () => ({ isKnownBadEvm: vi.fn(() => null) }));
vi.mock("@/lib/intelligence", () => ({
  lookupValue: vi.fn(async () => ({
    ims: 0, ics: 0, matchCount: 0, hasSanction: false,
    topRiskClass: null, matchBasis: null, sourceSlug: null,
    externalUrl: null, winner: null,
  })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { tokenScanAggregate: { upsert: vi.fn(async () => ({ communityScans: 1 })) } },
}));
// S3 — le contrôle positif exige une couverture COMPLÈTE : la phrase
// rassurante ne s'émet plus sur un périmètre incomplet, et sans base le
// lecteur tombe sur son cas fail-closed.
vi.mock("@/lib/intelligence/sanctionCoverage", async (orig) => {
  const reel = await orig<typeof import("@/lib/intelligence/sanctionCoverage")>();
  return {
    ...reel,
    readIntelligenceCoverage: vi.fn(async () => ({
      expected: ["ofac", "scamsniffer"],
      consultedMeasured: ["ofac", "scamsniffer"],
      notConsulted: [],
      declaredNotArmed: [],
      denominator: 2,
      state: "COMPLETE",
      negativeConclusive: true,
    })),
  };
});

vi.mock("@/lib/prebuy/canonicalTokenIdentity", async (orig) => {
  const reel = await orig<typeof import("@/lib/prebuy/canonicalTokenIdentity")>();
  return { ...reel, probeCanonicalTokenIdentity: vi.fn() };
});

import { getMarketSnapshot } from "@/lib/marketProviders";
import { probeCanonicalTokenIdentity } from "@/lib/prebuy/canonicalTokenIdentity";
import { GET as scoreGET } from "@/app/api/v1/score/route";
import { NextRequest } from "next/server";

const mockMarket = vi.mocked(getMarketSnapshot);
const mockProbe = vi.mocked(probeCanonicalTokenIdentity);
const originalFetch = globalThis.fetch;

describe("S2/8 — CONTRÔLE POSITIF : ALLOW reste atteignable de bout en bout", () => {
  beforeEach(() => {
    mockMarket.mockResolvedValue({
      liquidity_usd: 50_000_000,
      pair_age_days: 1200,
      fdv_usd: 50_000_000_000,
      volume_24h_usd: 200_000_000,
      url: "https://dex.example/usdc",
      source: "dexscreener",
      cache_hit: false,
      data_unavailable: false,
    } as Awaited<ReturnType<typeof getMarketSnapshot>>);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("un mint résolu, marché et lignée mesurés → ALLOW + la phrase rassurante", async () => {
    // Le graphe répond, donc `scam_lineage` est MESURÉ. C'est le régime réel
    // de production, mesuré le 2026-09-09 : /api/scan/solana/graph rend 200.
    globalThis.fetch = vi.fn(async (u: RequestInfo | URL) =>
      String(u).includes("/graph")
        ? new Response(JSON.stringify({ overall_status: "NONE" }), { status: 200 })
        : new Response(JSON.stringify({}), { status: 404 }),
    ) as unknown as typeof fetch;

    const res = await scoreGET(
      new NextRequest("https://x.test/api/v1/score?mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.phantom_warning_level).toBe("ALLOW");
    expect(body.phantom_disclaimer).toBe("No major risk signals detected.");
    expect(body.verdict).toBe("GREEN");
  });

  it("AL — un contrat EVM dont l'identité canonique est ATTESTÉE sort ALLOW", async () => {
    // Preuve que la ROUTE consomme l'attestation. Sans elle, un mutant qui
    // retirait `canonical_token_resolution` de la liste d'attestations
    // survivait : rien n'exerçait le chemin EVM de la route.
    mockProbe.mockResolvedValue({ attested: true, chain: "ETH", address: "0x", refusal: null });
    const res = await scoreGET(
      new NextRequest("https://x.test/api/v1/score?mint=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
    );
    const body = await res.json();
    expect(body.phantom_warning_level).toBe("ALLOW");
    expect(body.verdict).toBe("GREEN");
  });

  it("AL — le MÊME contrat, identité NON attestée → WARN, jamais ALLOW", async () => {
    // Discriminant apparié : une seule variable change, l'attestation.
    mockProbe.mockResolvedValue({
      attested: false, chain: null, address: null, refusal: "NOT_RESOLVED",
    });
    const res = await scoreGET(
      new NextRequest("https://x.test/api/v1/score?mint=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
    );
    const body = await res.json();
    expect(body.phantom_warning_level).toBe("WARN");
    expect(body.phantom_disclaimer).toMatch(/could not be resolved/i);
  });

  it("le MÊME mint, graphe injoignable → WARN, et la cause est dite", async () => {
    // Discriminant apparié : une seule chose change, la mesurabilité de la
    // lignée. Le verdict de risque est identique ; le niveau ne l'est pas.
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({}), { status: 500 }),
    ) as unknown as typeof fetch;

    const res = await scoreGET(
      new NextRequest("https://x.test/api/v1/score?mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    );
    const body = await res.json();
    expect(body.phantom_warning_level).toBe("WARN");
    expect(body.phantom_disclaimer).toMatch(/expected checks did not complete/i);
    expect(body.phantom_disclaimer).not.toContain("No major risk signals detected.");
  });
});
