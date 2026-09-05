// --- BUILD 7 / @v2 — LA PREUVE PAR MUTATION -------------------------------
//
// Quatre invariants nouveaux, cinq gardes, cinq mutants. Chaque mutant est une
// sortie PARFAITEMENT BIEN FORMÉE et fausse d'une seule façon, construite pour
// violer EXACTEMENT UN invariant et satisfaire tous les autres.
//
// `scripts/similarity/mutation-check-v2.mjs` le prouve mécaniquement : il
// neutralise chaque garde et vérifie qu'exactement son bloc devient rouge.

import { describe, expect, it } from "vitest";
import {
  FabricatedInstantError,
  InadmissibleDowngradedError,
  MajorityVoteError,
  SCOPE_RESERVATION,
  ScopeLaunderedError,
  UNATTRIBUTED,
  UNATTRIBUTED_RESERVATION,
  UnattributedIdentityError,
  aggregateCategorical,
  aggregateMagnitude,
  assertComparisonInvariantsV2,
  buildFeatureObservationV2,
  compareFeatureV2,
  declaredBySource,
  notAggregated,
  type ComparisonResultV2,
  type ComparisonSourcesV2,
  type FeatureObservationV2,
} from "..";
import { completeCoverage } from "../../observation";

const COV = completeCoverage({ source: "test" });
const EV = [{ kind: "tx_signature", refs: ["sig-1"] }];
const W = { windowSeconds: 60 };
const EXIT_METHOD = { methodRef: null, ruleVersion: "coordinated-exit@v1", parameters: W };
const SOCIAL_METHOD = { methodRef: null, ruleVersion: "shill-forward-bridge@v1", parameters: {} };

const L = (o: FeatureObservationV2 | null) => ({ subjectRef: "CASE-A", observation: o });
const R = (o: FeatureObservationV2 | null) => ({ subjectRef: "CASE-B", observation: o });
const sources = (
  left: FeatureObservationV2 | null,
  right: FeatureObservationV2 | null,
): ComparisonSourcesV2 => ({
  leftSubjectRef: "CASE-A", rightSubjectRef: "CASE-B", left, right,
});
const check = (m: ComparisonResultV2, s: ComparisonSourcesV2) =>
  assertComparisonInvariantsV2(m, s, "mutant");

/** Un venue démontré par `demonstrating` groupes sur `considered`. */
function venue(demonstrating: number, considered: number, value = "RAYDIUM"): FeatureObservationV2 {
  const facts = Array.from({ length: considered }, (_, i) => ({
    groupRef: `g${i}`,
    value: i < demonstrating ? value : null,
  }));
  const agg = aggregateCategorical("DEMONSTRATED_BY_ANY", facts);
  return agg.value !== null
    ? buildFeatureObservationV2({
        featureKey: "exit.demonstrated_venue", state: "OBSERVED",
        value: { kind: "CATEGORICAL", value: agg.value },
        method: EXIT_METHOD, coverage: COV, evidence: EV,
        aggregation: agg.detail, attribution: declaredBySource(agg.value),
      })
    : buildFeatureObservationV2({
        featureKey: "exit.demonstrated_venue", state: "NOT_OBSERVED", stateReason: agg.reason!,
        method: EXIT_METHOD, coverage: COV, aggregation: agg.detail, attribution: UNATTRIBUTED,
      });
}

function destination(value: string): FeatureObservationV2 {
  const agg = aggregateCategorical("DEMONSTRATED_BY_ANY", [{ groupRef: "g0", value }]);
  return buildFeatureObservationV2({
    featureKey: "exit.demonstrated_destination", state: "OBSERVED",
    value: { kind: "CATEGORICAL", value },
    method: EXIT_METHOD, coverage: COV, evidence: EV,
    aggregation: agg.detail, attribution: UNATTRIBUTED,
  });
}

function inadmissible(): FeatureObservationV2 {
  return buildFeatureObservationV2({
    featureKey: "identity.token_resolution_status",
    state: "INADMISSIBLE",
    stateReason: "5 lignes existent, aucune ne porte de nature",
    inadmissibility: {
      cause: "DATA_NATURE_MISSING",
      found: "5/5 ShillEvent avec rowNature NULL",
      required: "une nature classée (INFERENCE)",
      sourceRowCount: 5,
    },
    method: SOCIAL_METHOD, coverage: COV, aggregation: notAggregated(),
  });
}

function anchorDay(dateValue: string): FeatureObservationV2 {
  return buildFeatureObservationV2({
    featureKey: "temporal.anchor_provenance", state: "OBSERVED",
    value: { kind: "CATEGORICAL", value: "date_only" },
    method: SOCIAL_METHOD, coverage: COV,
    evidence: [{ kind: "shill_event_id", refs: ["cmq6dx11m002057rj9p8mq7df"] }],
    aggregation: notAggregated(),
    temporal: { resolution: "DAY", value: dateValue, provenance: "date_only" },
  });
}

// ══════════════════════════════════════════════════════════════════════════

describe("MUTANT 10 · INV-10 — INADMISSIBLE ne se dégrade jamais en absence", () => {
  const left = inadmissible();
  const right = inadmissible();
  const real = compareFeatureV2("identity.token_resolution_status", L(left), R(right));

  it("le comparateur réel rend son PROPRE motif, et porte la cause", () => {
    expect(real.verdict).toBe("NOT_COMPARABLE");
    expect(real.basis.reasonCode).toBe("SIDE_INADMISSIBLE");
    expect(real.basis.left.inadmissibility?.cause).toBe("DATA_NATURE_MISSING");
    expect(real.basis.reason).toContain("DATA_NATURE_MISSING");
    expect(real.basis.reason).toContain("collecter davantage de la même chose");
  });

  it("REFUSE le repli sur le motif générique d'absence", () => {
    // Sous SIDE_NOT_OBSERVABLE un lecteur conclut « il faut collecter plus ».
    // C'est faux : c'est la QUALIFICATION qui bloque.
    const mutant: ComparisonResultV2 = {
      ...real,
      basis: { ...real.basis, reasonCode: "SIDE_NOT_OBSERVABLE" },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(InadmissibleDowngradedError);
  });

  it("REFUSE une inadmissibilité sans cause, et une cause sous un autre état", () => {
    const noCause: ComparisonResultV2 = {
      ...real,
      basis: { ...real.basis, left: { ...real.basis.left, inadmissibility: null } },
    };
    expect(() => check(noCause, sources(left, right))).toThrow(InadmissibleDowngradedError);

    const observed = venue(1, 1);
    const ok = compareFeatureV2("exit.demonstrated_venue", L(observed), R(observed));
    const smuggled: ComparisonResultV2 = {
      ...ok,
      basis: {
        ...ok.basis,
        left: { ...ok.basis.left, inadmissibility: left.inadmissibility },
      },
    };
    expect(() => check(smuggled, sources(observed, observed))).toThrow(InadmissibleDowngradedError);
  });
});

describe("MUTANT 11a · INV-11 — aucune agrégation par vote majoritaire", () => {
  // 5 groupes disent SELL_ONLY, 1 dit MIXED. C'est LE cas mesuré sur VINE.
  const facts = [
    ...Array.from({ length: 5 }, (_, i) => ({ groupRef: `g${i}`, value: "SELL_ONLY" })),
    { groupRef: "g5", value: "MIXED" },
  ];
  const agg = aggregateCategorical("ALL_OR_NOTHING", facts);
  const conflicting = buildFeatureObservationV2({
    featureKey: "exit.composition_profile", state: "NOT_OBSERVED",
    stateReason: agg.reason!, method: EXIT_METHOD, coverage: COV, aggregation: agg.detail,
  });
  const real = compareFeatureV2("exit.composition_profile", L(conflicting), R(conflicting));

  it("le comparateur réel ne tranche pas, et dit pourquoi", () => {
    expect(agg.detail.scope).toBe("CONFLICTING_GROUPS");
    expect(agg.detail.distinctValues).toEqual(["MIXED", "SELL_ONLY"]);
    expect(real.verdict).toBe("NOT_COMPARABLE");
    expect(real.basis.left.stateReason).toContain("vote majoritaire");
    // ██ Les faits de groupe sont PRÉSERVÉS, tous les six. ██
    expect(real.basis.left.aggregation!.perGroup).toHaveLength(6);
  });

  it("REFUSE « 5 sur 6 disent SELL_ONLY, donc le sujet est SELL_ONLY »", () => {
    const mutant: ComparisonResultV2 = {
      ...real,
      verdict: "MATCH",
      basis: {
        ...real.basis,
        reasonCode: "EQUAL_VALUE",
        reason: "meme valeur des deux cotes : SELL_ONLY.",
        left: {
          ...real.basis.left, state: "OBSERVED", stateReason: null,
          value: { kind: "CATEGORICAL", value: "SELL_ONLY" },
        },
        right: {
          ...real.basis.right, state: "OBSERVED", stateReason: null,
          value: { kind: "CATEGORICAL", value: "SELL_ONLY" },
        },
      },
    };
    const voted: FeatureObservationV2 = {
      ...conflicting, state: "OBSERVED", stateReason: null,
      value: { kind: "CATEGORICAL", value: "SELL_ONLY" },
    };
    expect(() => check(mutant, sources(voted, voted))).toThrow(MajorityVoteError);
  });

  it("le constructeur REFUSE déjà ce vote, avant même la comparaison", () => {
    expect(() =>
      buildFeatureObservationV2({
        featureKey: "exit.composition_profile", state: "OBSERVED",
        value: { kind: "CATEGORICAL", value: "SELL_ONLY" },
        method: EXIT_METHOD, coverage: COV, evidence: EV, aggregation: agg.detail,
      }),
    ).toThrow(MajorityVoteError);
  });
});

describe("MUTANT 11b · INV-11 — une portée partielle n'est pas une vérité sujet", () => {
  const partial = venue(3, 6);
  const full = venue(1, 1);
  const real = compareFeatureV2("exit.demonstrated_venue", L(partial), R(full));

  it("le comparateur réel garde le fait ET sa portée", () => {
    expect(real.verdict).toBe("MATCH");
    expect(real.basis.left.aggregation!.scope).toBe("SOME_GROUPS");
    expect(real.basis.scopeRestricted).toBe(true);
    expect(real.reservations).toContain(SCOPE_RESERVATION);
    expect(real.basis.reason).toContain("3 groupe(s) sur 6");
  });

  it("REFUSE une portée partielle blanchie en vérité sujet-entier", () => {
    const mutant: ComparisonResultV2 = {
      ...real,
      basis: { ...real.basis, scopeRestricted: false },
      reservations: real.reservations.filter((r) => r !== SCOPE_RESERVATION),
    };
    expect(() => check(mutant, sources(partial, full))).toThrow(ScopeLaunderedError);
  });

  it("REFUSE ALL_GROUPS déclaré sur une démonstration partielle", () => {
    const mutant: ComparisonResultV2 = {
      ...real,
      basis: {
        ...real.basis,
        scopeRestricted: false,
        left: {
          ...real.basis.left,
          aggregation: { ...real.basis.left.aggregation!, scope: "ALL_GROUPS" },
        },
      },
      reservations: real.reservations.filter((r) => r !== SCOPE_RESERVATION),
    };
    expect(() => check(mutant, sources(partial, full))).toThrow(ScopeLaunderedError);
  });

  it("REFUSE une grandeur PAR GROUPE promue en valeur sujet quand il y a plusieurs groupes", () => {
    const many = aggregateMagnitude([
      { groupRef: "g0", value: 191 },
      { groupRef: "g1", value: 49 },
    ]);
    expect(many.scope).toBe("PER_GROUP_ONLY");
    expect(() =>
      buildFeatureObservationV2({
        featureKey: "temporal.exit_cluster_span_seconds", state: "OBSERVED",
        value: { kind: "ORDINAL", value: 240, unit: "seconds" },
        method: EXIT_METHOD, coverage: COV, evidence: EV, aggregation: many,
      }),
    ).toThrow(ScopeLaunderedError);
  });
});

describe("MUTANT 12 · INV-12 — aucune heure fabriquée", () => {
  const left = anchorDay("2025-01-11");
  const right = anchorDay("2025-01-16");
  const real = compareFeatureV2("temporal.anchor_provenance", L(left), R(right));

  it("le comparateur réel transporte la DATE et compare la provenance", () => {
    expect(real.verdict).toBe("MATCH");
    expect(real.basis.left.temporal).toEqual({
      resolution: "DAY", value: "2025-01-11", provenance: "date_only",
    });
    // ██ `date_only` est une valeur ADMISE en @v2 — @v1 la refusait. ██
    expect(real.basis.left.value).toEqual({ kind: "CATEGORICAL", value: "date_only" });
  });

  it("REFUSE minuit présenté comme une résolution JOUR", () => {
    // C'est la valeur EXACTE que la colonne porte sur les 5 lignes BOTIFY.
    const mutant: ComparisonResultV2 = {
      ...real,
      basis: {
        ...real.basis,
        left: {
          ...real.basis.left,
          temporal: { resolution: "DAY", value: "2025-01-11T00:00:00.000Z", provenance: "date_only" },
        },
      },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(FabricatedInstantError);
  });

  it("le constructeur REFUSE déjà l'instant fabriqué", () => {
    expect(() => anchorDay("2025-01-11T00:00:00.000Z")).toThrow(FabricatedInstantError);
  });
});

describe("MUTANT 13 · INV-13 — aucune identité sur une adresse non étiquetée", () => {
  const addr = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
  const left = destination(addr);
  const right = destination(addr);
  const real = compareFeatureV2("exit.demonstrated_destination", L(left), R(right));

  it("le comparateur réel rend MATCH sur l'ADRESSE, et dit qu'il n'en sait pas plus", () => {
    expect(real.verdict).toBe("MATCH");
    expect(real.basis.left.attribution).toEqual({
      status: "UNATTRIBUTED", label: null, provenance: null,
    });
    expect(real.basis.unattributedIdentifier).toBe(true);
    expect(real.reservations).toContain(UNATTRIBUTED_RESERVATION);
  });

  it("REFUSE une étiquette collée sur une adresse déclarée non attribuée", () => {
    const mutant: ComparisonResultV2 = {
      ...real,
      basis: {
        ...real.basis,
        left: {
          ...real.basis.left,
          attribution: { status: "UNATTRIBUTED", label: "Raydium Authority V4", provenance: null },
        },
      },
    };
    expect(() => check(mutant, sources(left, right))).toThrow(UnattributedIdentityError);
  });

  it("REFUSE un MATCH d'adresses non étiquetées sans sa réserve", () => {
    const mutant: ComparisonResultV2 = {
      ...real,
      reservations: real.reservations.filter((r) => r !== UNATTRIBUTED_RESERVATION),
    };
    expect(() => check(mutant, sources(left, right))).toThrow(UnattributedIdentityError);
  });

  it("REFUSE une ATTRIBUTED sans provenance auditable", () => {
    expect(() =>
      buildFeatureObservationV2({
        featureKey: "exit.demonstrated_destination", state: "OBSERVED",
        value: { kind: "CATEGORICAL", value: addr },
        method: EXIT_METHOD, coverage: COV, evidence: EV,
        aggregation: aggregateCategorical("DEMONSTRATED_BY_ANY", [{ groupRef: "g0", value: addr }]).detail,
        attribution: { status: "ATTRIBUTED", label: "Raydium Authority V4", provenance: null },
      }),
    ).toThrow(UnattributedIdentityError);
  });

  it("un nom DÉCLARÉ par la source n'est pas une vérification", () => {
    const v = venue(1, 1);
    expect(v.attribution).toEqual({
      status: "DECLARED_BY_SOURCE", label: "RAYDIUM", provenance: null,
    });
    // Lui donner une provenance ferait passer une déclaration d'indexeur pour
    // une identification vérifiée.
    expect(() =>
      buildFeatureObservationV2({
        featureKey: "exit.demonstrated_venue", state: "OBSERVED",
        value: { kind: "CATEGORICAL", value: "RAYDIUM" },
        method: EXIT_METHOD, coverage: COV, evidence: EV,
        aggregation: aggregateCategorical("DEMONSTRATED_BY_ANY", [{ groupRef: "g0", value: "RAYDIUM" }]).detail,
        attribution: { status: "DECLARED_BY_SOURCE", label: "RAYDIUM", provenance: "solscan" },
      }),
    ).toThrow(UnattributedIdentityError);
  });
});

describe("les neuf invariants de @v1 tiennent toujours dans @v2", () => {
  // Ce sont LES MÊMES fonctions, importées depuis `../invariants` : leur preuve
  // de mutation mécanique est celle de @v1 (scripts/similarity/mutation-check.mjs).
  // Ces deux cas vérifient qu'elles sont bien câblées dans le chemin @v2.
  const obs = venue(1, 1);
  const real = compareFeatureV2("exit.demonstrated_venue", L(obs), R(obs));

  it("INV-8 — un motif qui conclut est toujours refusé", () => {
    const mutant: ComparisonResultV2 = {
      ...real,
      basis: { ...real.basis, reason: "meme lieu : signe de coordination entre les affaires." },
    };
    expect(() => check(mutant, sources(obs, obs))).toThrow(/INV-8/);
  });

  it("INV-6 — une INFERENCE promue PRIMARY_OBSERVATION est toujours refusée", () => {
    const cat = buildFeatureObservationV2({
      featureKey: "exit.cluster_category", state: "OBSERVED",
      value: { kind: "CATEGORICAL", value: "NARROW_WINDOW_CLUSTER" },
      method: EXIT_METHOD, coverage: COV, evidence: EV,
      aggregation: aggregateCategorical("ALL_OR_NOTHING", [{ groupRef: "g0", value: "NARROW_WINDOW_CLUSTER" }]).detail,
    });
    const r = compareFeatureV2("exit.cluster_category", L(cat), R(cat));
    expect(r.resultNature).toBe("INFERENCE");
    expect(() =>
      check({ ...r, resultNature: "PRIMARY_OBSERVATION" }, sources(cat, cat)),
    ).toThrow(/INV-6/);
  });
});
