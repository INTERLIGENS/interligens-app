// ─── BUILD 12 · S4 — PROJECTION, CONTAINMENT P0, CORPUS ADVERSE ────────────
//
// ██  Ce qui devra être VRAI APRÈS. Des critères, pas une intention.       ██
//
// S1 épingle ce que le produit fait aujourd'hui. Ce fichier écrit ce qu'il
// devra faire, sous une forme exécutable — pour que T1 code contre des
// critères et non contre un texte.
//
// ─── Pourquoi un témoin, et pourquoi il ne délègue à RIEN ─────────────────
//
// En BUILD 11, les mutants A1 et B4 ont cessé de mordre le jour où le défaut
// a été fermé : le témoin appelait `decide()`, donc il héritait du code qu'il
// servait à juger. Règle ratifiée depuis — un témoin doit être indépendant du
// code qu'il juge.
//
// `TEMOIN` ci-dessous n'appelle NI `decide()`, NI `derivePhantomWarning()`,
// NI `computeVerdict()`. Il implémente la table de projection ratifiée et
// rien d'autre. Il prouve que la batterie est SATISFIABLE ; il ne propose
// aucune architecture. T1 est libre d'implémenter autrement.
//
// AUCUN seuil n'est inventé. AUCUN score n'est défini.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// ═══ LE CONTRAT ══════════════════════════════════════════════════════════

type PreBuyLevel = "BLOCK" | "WARN" | "ALLOW";

type PreBuyVerdict =
  | "STOP" | "WAIT" | "VERIFY" | "NO_CRITICAL_SIGNAL" | "INSUFFICIENT_COVERAGE";

/** Un moteur non mesuré, et POURQUOI. Axe mesure uniquement. */
interface Manquant {
  engine: string;
  reason: "NOT_MEASURED" | "NOT_MEASURABLE" | "FAILURE" | "STALE" | "UNKNOWN"
        | "NOT_APPLICABLE" | "NOT_REQUESTED_BY_CONTRACT";
}

/** Les états de PUBLICATION. Ils ne décrivent aucun état de mesure. */
const PUBLICATION_ETATS = ["WITHHELD", "NOT_PUBLISHED"] as const;

/**
 * Ce que la projection reçoit. Le verdict N'EST PAS SEUL — c'est la
 * propriété centrale, et la forme de ce type la rend structurelle.
 */
interface DecisionAmont {
  verdict: PreBuyVerdict;
  /** Le contrat de mesure ATTENDUE est-il satisfait ? (cf. AA / BUILD 11.1) */
  expectedContractSatisfied: boolean;
  degraded: boolean;
  coverage: { expected: number; measured: number; missing: Manquant[] };
  /** Une résolution canonique a-t-elle abouti ? Une regex base58 ne suffit pas. */
  identityResolved: boolean;
}

interface Projection {
  level: PreBuyLevel;
  /** Le verdict D'ORIGINE, préservé. WAIT et VERIFY ne se confondent pas. */
  because: PreBuyVerdict;
  /** Ce qui n'a pas été mesuré, tel quel. Jamais aplati. */
  missing: Manquant[];
  degraded: boolean;
  /** La phrase de réassurance, ou `null`. Jamais émise sans support. */
  reassurance: string | null;
}

type Impl = (d: DecisionAmont) => Projection;

const REASSURANCE = "No major risk signals detected";

// ═══ LE TÉMOIN — indépendant, satisfiabilité seule ═══════════════════════

const TEMOIN: Impl = (d) => {
  const base: Omit<Projection, "level" | "reassurance"> = {
    because: d.verdict,
    missing: d.coverage.missing,
    degraded: d.degraded,
  };

  // Identité non résolue ⇒ fail closed. Jamais ALLOW.
  if (!d.identityResolved) return { ...base, level: "WARN", reassurance: null };

  switch (d.verdict) {
    case "STOP":
      return { ...base, level: "BLOCK", reassurance: null };
    case "WAIT":
    case "VERIFY":
    case "INSUFFICIENT_COVERAGE":
      return { ...base, level: "WARN", reassurance: null };
    case "NO_CRITICAL_SIGNAL": {
      const soutenu = d.expectedContractSatisfied && !d.degraded;
      return soutenu
        ? { ...base, level: "ALLOW", reassurance: REASSURANCE }
        : { ...base, level: "WARN", reassurance: null };
    }
    default:
      // Un verdict que la table ne connaît pas n'est pas un contrat
      // satisfait. Il retombe donc là où retombe toute décision non
      // soutenue — WARN — et jamais sur le niveau permissif.
      //
      // Sans ce `default`, le témoin rendait `undefined` : ni permissif ni
      // utilisable. Trouvé par le critère C2, qui a mordu son propre témoin.
      return { ...base, level: "WARN", reassurance: null };
  }
};

// ═══ FABRIQUES ═══════════════════════════════════════════════════════════

const d = (o: Partial<DecisionAmont> & Pick<DecisionAmont, "verdict">): DecisionAmont => ({
  expectedContractSatisfied: true,
  degraded: false,
  coverage: { expected: 4, measured: 4, missing: [] },
  identityResolved: true,
  ...o,
});

const PANNE: Manquant[] = [{ engine: "tigerscore", reason: "FAILURE" }];
const HORS_CONTRAT: Manquant[] = [
  { engine: "narrative", reason: "NOT_REQUESTED_BY_CONTRACT" },
  { engine: "recidivism", reason: "NOT_APPLICABLE" },
];

// ═══ LA BATTERIE ═════════════════════════════════════════════════════════

function batterie(impl: Impl): string[] {
  const v: string[] = [];
  const dit = (ok: boolean, c: string) => { if (!ok) v.push(c); };

  // ── 1 · LA TABLE DE PROJECTION ───────────────────────────────────────
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
  // Deux décisions au MÊME verdict et d'état de mesure différent ne peuvent
  // pas projeter pareil. Une fonction du seul verdict échoue ici par
  // construction — c'est exactement ce que fait `derivePhantomWarning`.
  const memeVerdict = [
    impl(d({ verdict: "NO_CRITICAL_SIGNAL" })).level,
    impl(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true })).level,
  ];
  dit(memeVerdict[0] !== memeVerdict[1], "P1 projection-du-verdict-seul");

  // ── 3 · WAIT ET VERIFY : PROJETÉS PAREIL, PAS DEVENUS PAREILS ────────
  const w = impl(d({ verdict: "WAIT" }));
  const vf = impl(d({ verdict: "VERIFY" }));
  dit(w.level === vf.level, "P2 WAIT-VERIFY-niveaux-divergents");
  dit(w.because === "WAIT" && vf.because === "VERIFY", "P3 WAIT-VERIFY-confondus");

  // ── 4 · LES 7 PROPRIÉTÉS DU CONTAINMENT P0 ───────────────────────────
  // C1 — erreur / absence / non concluant ne produit jamais ALLOW
  dit(
    [
      impl(d({ verdict: "INSUFFICIENT_COVERAGE" })),
      impl(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true, coverage: { expected: 4, measured: 3, missing: PANNE } })),
      impl(d({ verdict: "NO_CRITICAL_SIGNAL", expectedContractSatisfied: false })),
    ].every((r) => r.level !== "ALLOW"),
    "C1 absence→ALLOW",
  );
  // C2 — pas de niveau permissif par défaut : un verdict inconnu ne passe pas
  dit(
    impl(d({ verdict: "TOTALEMENT_INCONNU" as PreBuyVerdict })).level !== "ALLOW",
    "C2 defaut-permissif",
  );
  // C3 — pas de ALLOW sur panne
  dit(
    impl(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true, coverage: { expected: 4, measured: 0, missing: PANNE } })).level !== "ALLOW",
    "C3 ALLOW-sur-panne",
  );
  // C4 — un BLOCK mesuré survit à l'échec de la branche sœur
  dit(
    impl(d({ verdict: "STOP", degraded: true, coverage: { expected: 4, measured: 1, missing: PANNE } })).level === "BLOCK",
    "C4 BLOCK-efface-par-panne-soeur",
  );
  // C5 — l'information de mesure est PRÉSERVÉE, pas seulement présente
  const preserve = impl(d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true, coverage: { expected: 4, measured: 3, missing: PANNE } }));
  dit(preserve.missing.length === 1 && preserve.missing[0].reason === "FAILURE", "C5 mesure-non-preservee");
  dit(preserve.degraded === true, "C5b degraded-non-transporte");
  // C6 — la phrase de réassurance n'est émise que si la mesure la soutient
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
  // C7 — aucun score, aucun seuil : la projection est une fonction d'états
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
  // Une capacité NON APPLICABLE ne fabrique pas de dégradation.
  const horsContrat = impl(d({
    verdict: "NO_CRITICAL_SIGNAL",
    coverage: { expected: 4, measured: 4, missing: HORS_CONTRAT },
  }));
  dit(horsContrat.level === "ALLOW", "S1 fausse-degradation-sur-NOT_APPLICABLE");
  dit(horsContrat.missing.length === 2, "S2 manquants-hors-contrat-effaces");
  // Un état de PUBLICATION ne peut pas se poser sur l'axe mesure.
  dit(
    horsContrat.missing.every((m) => !(PUBLICATION_ETATS as readonly string[]).includes(m.reason)),
    "S3 publication-sur-axe-mesure",
  );
  // Un STOP légitime n'est pas supprimé par excès de prudence.
  dit(impl(d({ verdict: "STOP" })).level === "BLOCK", "S4 STOP-supprime");

  return v;
}

// ═══ SATISFIABILITÉ ══════════════════════════════════════════════════════

describe("S4/0 — la batterie est satisfiable", () => {
  it("le TÉMOIN passe tous les critères", () => {
    expect(batterie(TEMOIN)).toEqual([]);
  });

  it("le TÉMOIN ne délègue à AUCUN code jugé", () => {
    // La règle née de A1/B4 : un témoin qui appelle le code qu'il juge cesse
    // de muter le jour où ce code change.
    const src = readFileSync("__tests__/prebuy/s4-projection-et-corpus-adverse.test.ts", "utf8");
    const temoin = src.slice(src.indexOf("const TEMOIN"), src.indexOf("// ═══ FABRIQUES"));
    for (const interdit of ["decide(", "derivePhantomWarning(", "computeVerdict(", "preSwapScan("]) {
      expect(temoin, `le témoin appelle ${interdit}`).not.toContain(interdit);
    }
  });
});

// ═══ MUTANTS ═════════════════════════════════════════════════════════════

interface Mutant { nom: string; critere: string; impl: Impl }

const MUTANTS: Mutant[] = [
  {
    nom: "la projection ne lit QUE le verdict (le derivePhantomWarning actuel)",
    critere: "P1 projection-du-verdict-seul",
    impl: (x) => ({
      ...TEMOIN(x),
      level: x.verdict === "STOP" ? "BLOCK" : x.verdict === "NO_CRITICAL_SIGNAL" ? "ALLOW" : "WARN",
      reassurance: x.verdict === "NO_CRITICAL_SIGNAL" ? REASSURANCE : null,
    }),
  },
  {
    nom: "WAIT et VERIFY sont CONFONDUS en interne, pas seulement projetés pareil",
    critere: "P3 WAIT-VERIFY-confondus",
    impl: (x) => ({ ...TEMOIN(x), because: (x.verdict === "VERIFY" ? "WAIT" : x.verdict) }),
  },
  {
    nom: "INSUFFICIENT_COVERAGE devient permissif",
    critere: "T4 IC→WARN",
    impl: (x) => (x.verdict === "INSUFFICIENT_COVERAGE"
      ? { ...TEMOIN(x), level: "ALLOW", reassurance: REASSURANCE } : TEMOIN(x)),
  },
  {
    nom: "NO_CRITICAL_SIGNAL dégradé repasse en ALLOW",
    critere: "T6 NCS-degrade→WARN",
    impl: (x) => (x.verdict === "NO_CRITICAL_SIGNAL"
      ? { ...TEMOIN(x), level: "ALLOW", reassurance: REASSURANCE } : TEMOIN(x)),
  },
  {
    nom: "un verdict inconnu retombe sur le niveau permissif",
    critere: "C2 defaut-permissif",
    impl: (x) => {
      const r = TEMOIN(x);
      return ["STOP", "WAIT", "VERIFY", "NO_CRITICAL_SIGNAL", "INSUFFICIENT_COVERAGE"]
        .includes(x.verdict) ? r : { ...r, level: "ALLOW", reassurance: REASSURANCE };
    },
  },
  {
    nom: "un BLOCK mesuré est effacé par la panne d'une branche sœur",
    critere: "C4 BLOCK-efface-par-panne-soeur",
    impl: (x) => (x.degraded ? { ...TEMOIN(x), level: "WARN" } : TEMOIN(x)),
  },
  {
    nom: "la cause du manque est aplatie en UNKNOWN",
    critere: "C5 mesure-non-preservee",
    impl: (x) => ({
      ...TEMOIN(x),
      missing: TEMOIN(x).missing.map((m) => ({ ...m, reason: "UNKNOWN" as const })),
    }),
  },
  {
    nom: "`degraded` cesse d'être transporté jusqu'au consommateur",
    critere: "C5b degraded-non-transporte",
    impl: (x) => ({ ...TEMOIN(x), degraded: false }),
  },
  {
    nom: "la phrase de réassurance est émise sans mesure qui la soutienne",
    critere: "C6 reassurance-non-soutenue",
    impl: (x) => ({ ...TEMOIN(x), reassurance: REASSURANCE }),
  },
  {
    nom: "un seuil numérique réapparaît dans la projection",
    critere: "C7 nombre-dans-la-projection",
    impl: (x) => ({ ...TEMOIN(x), because: `${x.verdict}@70` as PreBuyVerdict }),
  },
  {
    nom: "une identité non résolue est traitée comme résolue",
    critere: "I1 identite-non-resolue→ALLOW",
    impl: (x) => TEMOIN({ ...x, identityResolved: true }),
  },
  {
    nom: "SUR-CORRECTION — NOT_APPLICABLE fabrique une dégradation",
    critere: "S1 fausse-degradation-sur-NOT_APPLICABLE",
    impl: (x) => (x.coverage.missing.length > 0
      ? { ...TEMOIN(x), level: "WARN", reassurance: null } : TEMOIN(x)),
  },
  {
    nom: "SUR-CORRECTION — les manquants hors contrat sont effacés de la sortie",
    critere: "S2 manquants-hors-contrat-effaces",
    impl: (x) => ({
      ...TEMOIN(x),
      missing: TEMOIN(x).missing.filter((m) => m.reason === "FAILURE"),
    }),
  },
  {
    nom: "SUR-CORRECTION — un état de PUBLICATION est posé sur l'axe mesure",
    critere: "S3 publication-sur-axe-mesure",
    impl: (x) => ({
      ...TEMOIN(x),
      missing: TEMOIN(x).missing.map((m) => ({ ...m, reason: "WITHHELD" as Manquant["reason"] })),
    }),
  },
  {
    nom: "SUR-CORRECTION — un STOP légitime est supprimé au profit d'un WARN",
    critere: "S4 STOP-supprime",
    impl: (x) => (x.verdict === "STOP" ? { ...TEMOIN(x), level: "WARN" } : TEMOIN(x)),
  },
];

describe("S4/1 — chaque mutant mord, et sur la propriété visée", () => {
  for (const m of MUTANTS) {
    it(`MORD — ${m.nom}`, () => {
      const violes = batterie(m.impl);
      expect(violes, `mutant SURVIVANT = preuve manquante — ${m.nom}`).not.toEqual([]);
      expect(violes, `tué, mais pas par ${m.critere}`).toContain(m.critere);
    });
  }

  it("les 15 mutants sont déclarés, sans doublon de critère", () => {
    expect(MUTANTS).toHaveLength(15);
    expect(new Set(MUTANTS.map((x) => x.critere)).size).toBe(15);
  });
});

// ═══ RÉTROCOMPATIBILITÉ PARTENAIRE ═══════════════════════════════════════
//
// Les trois routes sont GELÉES et frappent la base : on épingle leur CONTRAT
// depuis le source. Ce qui doit survivre est la FORME et le DOMAINE DE
// VALEURS — pas la condition d'émission, qui est précisément ce que la
// migration change.

const R = (p: string) => readFileSync(`src/app/api/partner/v1/${p}/route.ts`, "utf8");

describe("S4/2 — le contrat partner/v1 ne casse pas", () => {
  it("transaction-check : les 8 clés de réponse, à l'identique", () => {
    const src = R("transaction-check");
    for (const k of ["recommendation", "reason", "score_to", "score_from",
                     "verdict_to", "chain", "version", "powered_by"]) {
      expect(src, `clé absente : ${k}`).toMatch(new RegExp(`\\b${k}[,:]`));
    }
    expect(src).toContain('version: "v1"');
    expect(src).toContain('powered_by: "INTERLIGENS"');
  });

  it("score-lite : les 9 clés de réponse, à l'identique", () => {
    const src = R("score-lite");
    for (const k of ["address", "score", "verdict", "tier", "signals_count",
                     "cache_hit", "as_of", "version", "powered_by"]) {
      expect(src, `clé absente : ${k}`).toMatch(new RegExp(`\\b${k}[,:]`));
    }
  });

  it("batch-score : item nominal et item en erreur", () => {
    const src = R("batch-score");
    for (const k of ["address", "score", "verdict", "tier"]) {
      expect(src).toMatch(new RegExp(`\\b${k}[,:]`));
    }
    expect(src).toContain('error: err instanceof Error && err.message === "timeout"');
  });

  it("les DOMAINES DE VALEURS restent inchangés — `SAFE` compris", () => {
    // `SAFE` est dans le contrat externe. BUILD 12 interdit de PRÉSENTER
    // NO_CRITICAL_SIGNAL comme sûr — ce n'est pas la même chose que retirer
    // la valeur du domaine. Le jeton reste ; ce qui change, c'est QUAND il
    // est émis. Le supprimer casserait des partenaires.
    for (const p of ["transaction-check", "score-lite", "batch-score"]) {
      expect(R(p), p).toContain('type Verdict = "SAFE" | "WARNING" | "AVOID"');
    }
    expect(R("transaction-check")).toContain('type Recommendation = "ALLOW" | "WARN" | "BLOCK"');
    for (const p of ["score-lite", "batch-score"]) {
      expect(R(p), p).toContain('type Tier = "GREEN" | "ORANGE" | "RED"');
    }
  });

  it("CONSTAT LEGACY — verdict et recommendation divergent par construction", () => {
    // `toVerdict` bascule à 35, `toRecommendation` à 40. Dans la bande
    // 35–39, la même réponse porte `verdict_to: "WARNING"` ET
    // `recommendation: "ALLOW"`. Épinglé comme observé, non prescrit : la
    // migration devra décider si elle reproduit cette divergence.
    const src = R("transaction-check");
    expect(src).toContain("if (score >= 35) return \"WARNING\"");
    expect(src).toContain("if (score >= 40) return \"WARN\"");
  });

  it("ANTI-RÉGRESSION — la phrase consomme la PROJECTION, pas le seul score", () => {
    // ─── RETOURNÉ le 2026-09-09, fermé par BUILD 12 phase 2 ────────────
    //
    // Sa version d'origine épinglait le défaut : « la phrase de réassurance
    // est construite sur le SEUL score », et exigeait la présence de
    // `function buildReason(score: number, signalsCount: number)` dans la
    // route. Cette fonction n'existe plus.
    //
    // Elle a été remplacée par `buildPartnerReason(projection, score,
    // signalsCount)` dans src/lib/prebuy/projection.ts : le PREMIER argument
    // est la projection, donc l'état de mesure. Le score reste, mais il ne
    // décide plus seul de la clause rassurante.
    //
    // Une assertion qui pin un défaut a une date de péremption ; une
    // anti-régression n'en a pas. C'est la QUATRIÈME de la journée à
    // retourner — le motif est régulier, pas accidentel.
    const src = R("transaction-check");
    // ██ Le défaut ne peut pas revenir : la fonction qui le portait est
    //    nommément interdite dans la route.
    expect(src).not.toContain("function buildReason(score: number, signalsCount: number)");
    // ██ Et la phrase est produite par l'autorité qui reçoit la projection.
    expect(src).toContain("buildPartnerReason(");
    const proj = readFileSync("src/lib/prebuy/projection.ts", "utf8");
    expect(proj).toContain("no critical risk signals detected");
    // La signature EXIGE la projection en premier argument — un refactor qui
    // la retirerait ferait rougir ici avant de servir quoi que ce soit.
    expect(proj).toMatch(
      /export function buildPartnerReason\(\s*p: PreBuyProjection,\s*score: number,\s*signalsCount: number,?\s*\)/,
    );
  });
});

// ═══ CORPUS ADVERSE — les neuf familles ══════════════════════════════════

describe("S4/3 — corpus adverse", () => {
  const cas: Array<[string, DecisionAmont, (r: Projection) => void]> = [
    ["substitution d'identité ne passe pas",
      d({ verdict: "NO_CRITICAL_SIGNAL", identityResolved: false }),
      (r) => { expect(r.level).not.toBe("ALLOW"); expect(r.reassurance).toBeNull(); }],
    ["une ambiguïté de ticker ne devient jamais une identité canonique",
      d({ verdict: "NO_CRITICAL_SIGNAL", identityResolved: false, expectedContractSatisfied: false }),
      (r) => expect(r.level).toBe("WARN")],
    ["une panne provider ne devient jamais une absence propre",
      d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true,
          coverage: { expected: 4, measured: 3, missing: PANNE } }),
      (r) => { expect(r.missing[0].reason).toBe("FAILURE"); expect(r.level).toBe("WARN"); }],
    ["zéro mesure ne devient jamais de la réassurance",
      d({ verdict: "INSUFFICIENT_COVERAGE", degraded: true,
          coverage: { expected: 4, measured: 0, missing: PANNE } }),
      (r) => { expect(r.level).toBe("WARN"); expect(r.reassurance).toBeNull(); }],
    ["NO_CRITICAL_SIGNAL ne devient jamais « safe » sans support",
      d({ verdict: "NO_CRITICAL_SIGNAL", expectedContractSatisfied: false }),
      (r) => expect(r.reassurance).toBeNull()],
    ["verdict et explication ne divergent pas",
      d({ verdict: "WAIT" }),
      (r) => { expect(r.because).toBe("WAIT"); expect(r.level).toBe("WARN"); }],
    ["une couverture attendue partielle reste visible",
      d({ verdict: "NO_CRITICAL_SIGNAL", degraded: true,
          coverage: { expected: 4, measured: 2, missing: PANNE } }),
      (r) => { expect(r.missing).toHaveLength(1); expect(r.degraded).toBe(true); }],
    ["une capacité NON APPLICABLE ne crée pas de fausse dégradation",
      d({ verdict: "NO_CRITICAL_SIGNAL",
          coverage: { expected: 4, measured: 4, missing: HORS_CONTRAT } }),
      (r) => { expect(r.level).toBe("ALLOW"); expect(r.degraded).toBe(false); }],
  ];

  for (const [nom, entree, verif] of cas) {
    it(nom, () => verif(TEMOIN(entree)));
  }

  it("NON EXERÇABLE — une preuve retirée ne regagne pas d'autorité", () => {
    // La neuvième famille ne peut pas être exercée sur cette verticale, et
    // c'est un constat, pas un trou : aucune gate de publication n'est
    // appelée sur le chemin pré-achat, et ni `PreSwapScanResult` ni
    // `PublicScoreResponse` ne portent d'état de publication.
    //
    // Ce qui EST épinglable, et l'est : les jetons de publication ne
    // doivent jamais apparaître sur l'axe mesure.
    const r = TEMOIN(d({
      verdict: "NO_CRITICAL_SIGNAL",
      coverage: { expected: 4, measured: 3, missing: PANNE },
    }));
    for (const p of PUBLICATION_ETATS) {
      expect(r.missing.map((m) => m.reason)).not.toContain(p);
    }
  });
});
