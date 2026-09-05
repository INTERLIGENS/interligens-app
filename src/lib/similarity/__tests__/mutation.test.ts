// --- BUILD 7 / S2 — LA PREUVE PAR MUTATION --------------------------------
//
// ██ CE QUE CE FICHIER DÉMONTRE ██
//
// Chaque invariant de R2 a ICI un MUTANT : une sortie de comparaison
// PARFAITEMENT BIEN FORMÉE — types corrects, champs remplis, verdict du
// vocabulaire fermé — et fausse d'une seule façon. Chaque mutant est construit
// pour violer EXACTEMENT UN invariant et satisfaire tous les autres : retirer
// la garde correspondante rend ce test-là, et aucun autre, silencieux.
//
// C'est la différence entre un invariant qui tient et un invariant qui tient
// PAR OMISSION. Avant ce fichier, on pouvait supprimer n'importe quelle règle
// du comparateur sans qu'un seul test rougisse : le comparateur ne produit
// jamais lui-même de sortie fautive, donc rien ne l'aurait attrapé.
//
// Chaque bloc vérifie DEUX choses :
//   1. le mutant est REFUSÉ, avec la classe d'erreur de son invariant ;
//   2. le comparateur RÉEL, sur les mêmes entrées, rend le bon verdict sans
//      lever — sinon la garde serait « vraie » pour la mauvaise raison.

import { describe, expect, it } from "vitest";
import {
  AbsenceBecameFindingError,
  CensoredNegativeError,
  EmptyObservationError,
  ExperimentalLaunderedError,
  ForbiddenConclusionError,
  MethodMismatchNotFlaggedError,
  NatureUpRankError,
  StateCollapseError,
  UnattributableComparisonError,
  assertComparisonInvariants,
  assertNoAggregateScore,
  buildFeatureObservation,
  compareFeature,
  completeCoverage,
  type ComparisonResult,
  type ComparisonSources,
  type FeatureCoverage,
  type FeatureObservation,
} from "..";

const COMPLETE = completeCoverage({ source: "test" });
const CENSORED: FeatureCoverage = {
  complete: false,
  censoredBy: "plafond de pages atteint",
  upstream: {},
};
const EV = [{ kind: "tx_signature", refs: ["sig-1"] }];
const W = { windowSeconds: 60 };
const EXIT_METHOD = { methodRef: null, ruleVersion: "coordinated-exit@v1", parameters: W };

function venue(value: string, coverage: FeatureCoverage = COMPLETE): FeatureObservation {
  return buildFeatureObservation({
    featureKey: "exit.demonstrated_venue",
    state: "OBSERVED",
    value: { kind: "CATEGORICAL", value },
    method: EXIT_METHOD,
    coverage,
    evidence: EV,
  });
}

function materiality(): FeatureObservation {
  return buildFeatureObservation({
    featureKey: "exit.materiality",
    state: "NOT_MEASURABLE",
    stateReason: "solde antérieur non démontrable depuis les transactions collectées",
    method: EXIT_METHOD,
    coverage: COMPLETE,
  });
}

function span(value: number): FeatureObservation {
  return buildFeatureObservation({
    featureKey: "temporal.exit_cluster_span_seconds",
    state: "OBSERVED",
    value: { kind: "ORDINAL", value, unit: "seconds" },
    method: EXIT_METHOD,
    coverage: COMPLETE,
    evidence: EV,
  });
}

function cluster(windowSeconds: number): FeatureObservation {
  return buildFeatureObservation({
    featureKey: "exit.cluster_category",
    state: "OBSERVED",
    value: { kind: "CATEGORICAL", value: "NARROW_WINDOW_CLUSTER" },
    method: { methodRef: null, ruleVersion: "coordinated-exit@v1", parameters: { windowSeconds } },
    coverage: COMPLETE,
    evidence: EV,
  });
}

function front(values: string[]): FeatureObservation {
  return buildFeatureObservation({
    featureKey: "preshill.front_run_wallets",
    state: "OBSERVED",
    value: { kind: "SET", values },
    method: {
      methodRef: null,
      ruleVersion: "pre-shill/front-run@v1",
      parameters: { minOccasions: 3, minDistinctKols: 2, preWindowSeconds: 600 },
    },
    coverage: COMPLETE,
    evidence: [{ kind: "occasion_id", refs: ["occ-1"] }],
  });
}

function funders(values: string[], coverage: FeatureCoverage = COMPLETE): FeatureObservation {
  return buildFeatureObservation({
    featureKey: "funding.shared_funder_addresses",
    state: "OBSERVED",
    value: { kind: "SET", values },
    method: { methodRef: null, ruleVersion: "funding-graph/shared-funder@v1", parameters: {} },
    coverage,
    evidence: EV,
  });
}

/** Les entrées telles que le comparateur les a reçues. Le contrôle les relit :
 *  un mutant ne peut donc pas se rendre cohérent en réécrivant aussi la source. */
function sources(
  left: FeatureObservation | null,
  right: FeatureObservation | null,
): ComparisonSources {
  return { leftSubjectRef: "CASE-A", rightSubjectRef: "CASE-B", left, right };
}
const L = (o: FeatureObservation | null) => ({ subjectRef: "CASE-A", observation: o });
const R = (o: FeatureObservation | null) => ({ subjectRef: "CASE-B", observation: o });

const check = (m: ComparisonResult, s: ComparisonSources) =>
  assertComparisonInvariants(m, s, "mutant");

// ══════════════════════════════════════════════════════════════════════════

describe("MUTANT 1 · INV-1 — les cinq états ne fusionnent pas", () => {
  const left = materiality();
  const right = materiality();
  const real = compareFeature("exit.materiality", L(left), R(right));

  it("le comparateur réel rend NOT_COMPARABLE en nommant NOT_MEASURABLE", () => {
    expect(real.verdict).toBe("NOT_COMPARABLE");
    expect(real.basis.reason).toContain("NOT_MEASURABLE");
  });

  it("REFUSE un NOT_MEASURABLE transcrit en NOT_OBSERVED", () => {
    // La fusion tentante : « les deux sont vides, appelons ça pareil ». Elle
    // ferait passer « la grandeur ne se mesure pas » pour « on a regardé et il
    // n'y avait rien » — deux affirmations différentes sur le monde.
    const mutant: ComparisonResult = {
      ...real,
      basis: { ...real.basis, left: { ...real.basis.left, state: "NOT_OBSERVED" } },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(StateCollapseError);
  });

  it("REFUSE un état non observé qui transporte quand même une valeur", () => {
    const mutant: ComparisonResult = {
      ...real,
      basis: {
        ...real.basis,
        left: { ...real.basis.left, value: { kind: "ORDINAL", value: 0, unit: "pre_exit_balance_share" } },
      },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(StateCollapseError);
  });

  it("REFUSE un motif générique qui ne nomme pas les états", () => {
    const mutant: ComparisonResult = {
      ...real,
      basis: { ...real.basis, reason: "les deux sujets ne sont pas comparables ici." },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(StateCollapseError);
  });
});

describe("MUTANT 2 · INV-2 — l'absence ne devient jamais un constat", () => {
  const left = venue("RAYDIUM");
  const right = buildFeatureObservation({
    featureKey: "exit.demonstrated_venue",
    state: "NOT_OBSERVED",
    stateReason: "aucun venue unanime dans le groupe",
    method: EXIT_METHOD,
    coverage: COMPLETE,
  });
  const real = compareFeature("exit.demonstrated_venue", L(left), R(right));

  it("le comparateur réel s'abstient", () => {
    expect(real.verdict).toBe("NOT_COMPARABLE");
    expect(real.basis.reasonCode).toBe("SIDE_NOT_OBSERVABLE");
  });

  it("REFUSE « l'un a RAYDIUM, l'autre rien, donc ils DIFFÈRENT »", () => {
    const mutant: ComparisonResult = {
      ...real,
      verdict: "DIFFERENT",
      basis: { ...real.basis, reasonCode: "VALUE_DIFFERS" },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(AbsenceBecameFindingError);
  });

  it("REFUSE aussi « les deux n'ont rien, donc ils se RESSEMBLENT »", () => {
    const both = compareFeature("exit.demonstrated_venue", L(right), R(right));
    const mutant: ComparisonResult = {
      ...both,
      verdict: "MATCH",
      basis: { ...both.basis, reasonCode: "EQUAL_VALUE" },
    };
    expect(() => check(mutant, sources(right, right))).toThrow(AbsenceBecameFindingError);
  });
});

describe("MUTANT 3 · INV-3 — une observation doit affirmer quelque chose", () => {
  const left = funders(["F1"]);
  const right = funders(["F1"]);
  const real = compareFeature("funding.shared_funder_addresses", L(left), R(right));

  it("le comparateur réel rend MATCH sur un identifiant réellement partagé", () => {
    expect(real.verdict).toBe("MATCH");
  });

  it("REFUSE un ensemble VIDE présenté comme une valeur observée", () => {
    // Deux ensembles vides se compareraient identiques : « aucun bailleur
    // commun des deux côtés » deviendrait une ressemblance.
    const mutant: ComparisonResult = {
      ...real,
      basis: {
        ...real.basis,
        left: { ...real.basis.left, value: { kind: "SET", values: [] } },
      },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(EmptyObservationError);
  });
});

describe("MUTANT 4 · INV-4 — la censure ne fabrique pas de différence", () => {
  const left = venue("RAYDIUM");
  const right = venue("ORCA", CENSORED);
  const real = compareFeature("exit.demonstrated_venue", L(left), R(right));

  it("le comparateur réel retire le négatif", () => {
    expect(real.verdict).toBe("NOT_COMPARABLE");
    expect(real.basis.reasonCode).toBe("COVERAGE_CENSORED_NEGATIVE_WITHHELD");
  });

  it("REFUSE une DIFFÉRENCE affirmée sous couverture bornée", () => {
    const mutant: ComparisonResult = {
      ...real,
      verdict: "DIFFERENT",
      basis: { ...real.basis, reasonCode: "VALUE_DIFFERS" },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(CensoredNegativeError);
  });

  it("REFUSE un résultat censuré qui ne se déclare pas PLANCHER", () => {
    const mutant: ComparisonResult = {
      ...real,
      basis: { ...real.basis, resultIsFloor: false },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(CensoredNegativeError);
  });
});

describe("MUTANT 5 · INV-5 — l'expérimental ne se blanchit pas", () => {
  const left = front(["W1"]);
  const right = front(["W1"]);
  const real = compareFeature("preshill.front_run_wallets", L(left), R(right));

  it("le comparateur réel porte le drapeau et sa réserve", () => {
    expect(real.basis.experimental).toBe(true);
    expect(real.reservations.some((r) => r.startsWith("EXPERIMENTAL INPUT"))).toBe(true);
  });

  it("REFUSE un résultat PRE-SHILL présenté comme canonique", () => {
    const mutant: ComparisonResult = {
      ...real,
      basis: { ...real.basis, experimental: false },
      reservations: real.reservations.filter((r) => !r.startsWith("EXPERIMENTAL INPUT")),
    };
    expect(() => check(mutant, sources(left, right))).toThrow(ExperimentalLaunderedError);
  });

  it("REFUSE le drapeau conservé mais la réserve retirée", () => {
    const mutant: ComparisonResult = {
      ...real,
      reservations: real.reservations.filter((r) => !r.startsWith("EXPERIMENTAL INPUT")),
    };
    expect(() => check(mutant, sources(left, right))).toThrow(ExperimentalLaunderedError);
  });
});

describe("MUTANT 6 · INV-6 — la nature ne remonte pas l'échelle", () => {
  const left = cluster(60);
  const right = cluster(60);
  const real = compareFeature("exit.cluster_category", L(left), R(right));

  it("le comparateur réel rend une INFERENCE, comme le registre le déclare", () => {
    expect(real.verdict).toBe("MATCH");
    expect(real.resultNature).toBe("INFERENCE");
  });

  it("REFUSE une INFERENCE promue PRIMARY_OBSERVATION dans le résultat", () => {
    const mutant: ComparisonResult = { ...real, resultNature: "PRIMARY_OBSERVATION" };
    expect(() => check(mutant, sources(left, right))).toThrow(NatureUpRankError);
  });

  it("REFUSE un côté requalifié contre le registre", () => {
    const mutant: ComparisonResult = {
      ...real,
      basis: { ...real.basis, left: { ...real.basis.left, nature: "PRIMARY_OBSERVATION" } },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(NatureUpRankError);
  });

  it("REFUSE une nature posée sur un côté MISSING", () => {
    const withMissing = compareFeature("exit.cluster_category", L(left), R(null));
    expect(withMissing.resultNature).toBeNull();
    const mutant: ComparisonResult = {
      ...withMissing,
      resultNature: "INFERENCE",
      basis: {
        ...withMissing.basis,
        right: { ...withMissing.basis.right, nature: "INFERENCE" },
      },
    };
    expect(() => check(mutant, sources(left, null))).toThrow(NatureUpRankError);
  });
});

describe("MUTANT 7 · INV-7 — chaque comparaison est attribuable", () => {
  const left = venue("RAYDIUM");
  const right = venue("RAYDIUM");
  const real = compareFeature("exit.demonstrated_venue", L(left), R(right));

  it("le comparateur réel expose la preuve des deux côtés", () => {
    expect(real.basis.left.evidence[0].refs).toEqual(["sig-1"]);
    expect(real.basis.right.evidence[0].refs).toEqual(["sig-1"]);
  });

  it("REFUSE un verdict sans preuve opposable", () => {
    const mutant: ComparisonResult = {
      ...real,
      basis: { ...real.basis, left: { ...real.basis.left, evidence: [] } },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(UnattributableComparisonError);
  });

  it("REFUSE une référence de méthode qui ne résout sur aucun artefact gelé", () => {
    // Grammaticalement valide, et pourtant un mensonge : elle ne mène nulle part.
    const fake = { methodRef: "invented-methodology/qualify@v1", ruleVersion: "x@v1", parameters: W };
    const mutant: ComparisonResult = {
      ...real,
      basis: {
        ...real.basis,
        left: { ...real.basis.left, method: fake },
        right: { ...real.basis.right, method: fake },
      },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(UnattributableComparisonError);
  });

  it("REFUSE l'absence d'un paramètre de méthode exigé par le registre", () => {
    const noWindow = { methodRef: null, ruleVersion: "coordinated-exit@v1", parameters: {} };
    const mutant: ComparisonResult = {
      ...real,
      basis: {
        ...real.basis,
        left: { ...real.basis.left, method: noWindow },
        right: { ...real.basis.right, method: noWindow },
      },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(UnattributableComparisonError);
  });
});

describe("MUTANT 8 · INV-8 — vocabulaire fermé, aucun score, aucun seuil", () => {
  const left = venue("RAYDIUM");
  const right = venue("RAYDIUM");
  const real = compareFeature("exit.demonstrated_venue", L(left), R(right));

  it("REFUSE un motif qui conclut au lieu de décrire", () => {
    const mutant: ComparisonResult = {
      ...real,
      basis: {
        ...real.basis,
        reason: "meme lieu d execution des deux cotes : signe de coordination entre les deux affaires.",
      },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(ForbiddenConclusionError);
  });

  it("REFUSE un couple (verdict, motif) hors vocabulaire", () => {
    const mutant: ComparisonResult = {
      ...real,
      verdict: "MATCH",
      basis: { ...real.basis, reasonCode: "SET_OVERLAP_PARTIAL" },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(ForbiddenConclusionError);
  });

  it("REFUSE toute clé d'agrégat ajoutée à la sortie", () => {
    // Le geste exact que ce build interdit : réduire des features hétérogènes
    // à un nombre. Il faudrait des poids, et des poids sont un verdict déguisé.
    expect(() => assertNoAggregateScore({ ...real, similarityScore: 0.83 }, "mutant")).toThrow(
      ForbiddenConclusionError,
    );
    expect(() =>
      assertNoAggregateScore({ ...real, basis: { ...real.basis, confidence: "high" } }, "mutant"),
    ).toThrow(ForbiddenConclusionError);
  });

  it("REFUSE qu'une GRANDEUR soit jugée sans seuil ratifié", () => {
    const l = span(191);
    const r = span(185);
    const ordinal = compareFeature("temporal.exit_cluster_span_seconds", L(l), R(r));
    expect(ordinal.verdict).toBe("NOT_COMPARABLE");

    const mutant: ComparisonResult = {
      ...ordinal,
      verdict: "DIFFERENT",
      basis: { ...ordinal.basis, reasonCode: "VALUE_DIFFERS" },
    };
    expect(() => check(mutant, sources(l, r))).toThrow(ForbiddenConclusionError);

    // Et l'égalité fortuite ne vaut pas davantage.
    const same = compareFeature("temporal.exit_cluster_span_seconds", L(span(191)), R(span(191)));
    const mutant2: ComparisonResult = {
      ...same,
      verdict: "MATCH",
      basis: { ...same.basis, reasonCode: "EQUAL_VALUE" },
    };
    expect(() => check(mutant2, sources(span(191), span(191)))).toThrow(ForbiddenConclusionError);
  });
});

describe("MUTANT 9 · INV-9 — deux méthodes différentes ne se comparent pas", () => {
  const left = cluster(60);
  const right = cluster(600);
  const real = compareFeature("exit.cluster_category", L(left), R(right));

  it("le comparateur réel refuse, alors que les VALEURS sont identiques", () => {
    expect(real.basis.left.value).toEqual(real.basis.right.value);
    expect(real.verdict).toBe("NOT_COMPARABLE");
    expect(real.basis.reasonCode).toBe("METHOD_MISMATCH");
  });

  it("REFUSE un MATCH obtenu en ignorant la fenêtre de mesure", () => {
    const mutant: ComparisonResult = {
      ...real,
      verdict: "MATCH",
      basis: { ...real.basis, reasonCode: "EQUAL_VALUE", reason: "meme valeur des deux cotes." },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(MethodMismatchNotFlaggedError);
  });

  it("REFUSE aussi un METHOD_MISMATCH annoncé sans divergence", () => {
    const same = compareFeature("exit.cluster_category", L(cluster(60)), R(cluster(60)));
    const mutant: ComparisonResult = {
      ...same,
      verdict: "NOT_COMPARABLE",
      basis: { ...same.basis, reasonCode: "METHOD_MISMATCH", reason: "methodes divergentes." },
    };
    expect(() => check(mutant, sources(cluster(60), cluster(60)))).toThrow(
      MethodMismatchNotFlaggedError,
    );
  });
});

describe("le contrôle n'est pas vacuous", () => {
  it("toute sortie RÉELLE du comparateur traverse les neuf invariants", () => {
    // `compareFeature` appelle déjà `assertComparisonInvariants`. On le rejoue
    // ici explicitement : si la garde était neutralisée, ce test resterait vert
    // — c'est pourquoi il ne suffit pas, et pourquoi les mutants existent.
    const cases: Array<[FeatureObservation | null, FeatureObservation | null, string]> = [
      [venue("RAYDIUM"), venue("RAYDIUM"), "exit.demonstrated_venue"],
      [venue("RAYDIUM"), venue("ORCA"), "exit.demonstrated_venue"],
      [venue("RAYDIUM"), venue("ORCA", CENSORED), "exit.demonstrated_venue"],
      [materiality(), materiality(), "exit.materiality"],
      [funders(["F1", "F2"]), funders(["F2", "F3"]), "funding.shared_funder_addresses"],
      [span(191), span(185), "temporal.exit_cluster_span_seconds"],
      [cluster(60), cluster(600), "exit.cluster_category"],
      [front(["W1"]), front(["W2"]), "preshill.front_run_wallets"],
      [venue("RAYDIUM"), null, "exit.demonstrated_venue"],
      [null, null, "exit.demonstrated_venue"],
    ];
    for (const [l, r, key] of cases) {
      const out = compareFeature(key, L(l), R(r));
      expect(() => check(out, sources(l, r))).not.toThrow();
    }
  });
});
