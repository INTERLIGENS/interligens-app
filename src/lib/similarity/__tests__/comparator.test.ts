// BUILD 7 / S2 — LE COMPARATEUR : les quatre verdicts, et ce qu'ils refusent.
import { describe, expect, it } from "vitest";
import {
  SIMILARITY_FEATURE_KEYS,
  buildFeatureObservation,
  compareFeature,
  compareSubjects,
  completeCoverage,
  type FeatureCoverage,
  type FeatureObservation,
} from "..";

const COMPLETE = completeCoverage({ source: "test" });
const CENSORED: FeatureCoverage = {
  complete: false,
  censoredBy: "plafond de pages atteint",
  upstream: { pages: 10 },
};
const EV = [{ kind: "tx_signature", refs: ["sig-1"] }];
const W = { windowSeconds: 60 };

function venue(value: string | null, coverage: FeatureCoverage = COMPLETE): FeatureObservation {
  return value === null
    ? buildFeatureObservation({
        featureKey: "exit.demonstrated_venue",
        state: "NOT_OBSERVED",
        stateReason: "aucun venue unanime",
        method: { methodRef: null, ruleVersion: "coordinated-exit@v1", parameters: W },
        coverage,
      })
    : buildFeatureObservation({
        featureKey: "exit.demonstrated_venue",
        state: "OBSERVED",
        value: { kind: "CATEGORICAL", value },
        method: { methodRef: null, ruleVersion: "coordinated-exit@v1", parameters: W },
        coverage,
        evidence: EV,
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

const L = (o: FeatureObservation | null) => ({ subjectRef: "CASE-A", observation: o });
const R = (o: FeatureObservation | null) => ({ subjectRef: "CASE-B", observation: o });

describe("les quatre verdicts", () => {
  it("MATCH — même valeur catégorielle démontrée des deux côtés", () => {
    const r = compareFeature("exit.demonstrated_venue", L(venue("RAYDIUM")), R(venue("RAYDIUM")));
    expect(r.verdict).toBe("MATCH");
    expect(r.basis.reasonCode).toBe("EQUAL_VALUE");
    expect(r.basis.resultIsFloor).toBe(false);
    expect(r.resultNature).toBe("PRIMARY_OBSERVATION");
    // La base est lisible sans relire le code : les deux valeurs, les preuves.
    expect(r.basis.left.value).toEqual({ kind: "CATEGORICAL", value: "RAYDIUM" });
    expect(r.basis.left.evidence[0].refs).toEqual(["sig-1"]);
  });

  it("DIFFERENT — valeurs distinctes, couverture complète des deux côtés", () => {
    const r = compareFeature("exit.demonstrated_venue", L(venue("RAYDIUM")), R(venue("ORCA")));
    expect(r.verdict).toBe("DIFFERENT");
    expect(r.basis.reasonCode).toBe("VALUE_DIFFERS");
  });

  it("PARTIAL_MATCH — recouvrement d'ensembles, sans aucun ratio", () => {
    const r = compareFeature(
      "funding.shared_funder_addresses",
      L(funders(["F1", "F2"])),
      R(funders(["F2", "F3"])),
    );
    expect(r.verdict).toBe("PARTIAL_MATCH");
    expect(r.basis.overlap).toEqual({ shared: ["F2"], onlyLeft: ["F1"], onlyRight: ["F3"] });
    // Trois listes, jamais un nombre : un ratio serait un score déguisé.
    expect(JSON.stringify(r)).not.toMatch(/0\.5|50%/);
  });

  it("MATCH sur ensembles identiques ; DIFFERENT sur ensembles disjoints", () => {
    expect(
      compareFeature("funding.shared_funder_addresses", L(funders(["F1"])), R(funders(["F1"])))
        .verdict,
    ).toBe("MATCH");
    expect(
      compareFeature("funding.shared_funder_addresses", L(funders(["F1"])), R(funders(["F9"])))
        .verdict,
    ).toBe("DIFFERENT");
  });
});

describe("INV-2 — l'absence ne devient jamais un constat", () => {
  it("deux NOT_OBSERVED ne se RESSEMBLENT pas", () => {
    // Le piège central : « les deux n'ont rien » se lirait « les deux se
    // ressemblent ». Le comparateur n'offre aucune valeur signifiant cela.
    const r = compareFeature("exit.demonstrated_venue", L(venue(null)), R(venue(null)));
    expect(r.verdict).toBe("NOT_COMPARABLE");
    expect(r.basis.reasonCode).toBe("SIDE_NOT_OBSERVABLE");
    expect(r.basis.reason).toContain("NOT_OBSERVED");
  });

  it("OBSERVED contre NOT_OBSERVED ne devient pas une DIFFÉRENCE", () => {
    const r = compareFeature("exit.demonstrated_venue", L(venue("RAYDIUM")), R(venue(null)));
    expect(r.verdict).toBe("NOT_COMPARABLE");
    // Les deux états sont NOMMÉS : le lecteur ne peut pas attribuer l'absence
    // à la mauvaise cause.
    expect(r.basis.reason).toContain("OBSERVED");
    expect(r.basis.reason).toContain("NOT_OBSERVED");
  });

  it("les quatre états non observés ne fusionnent pas", () => {
    const base = {
      featureKey: "exit.materiality" as const,
      method: { methodRef: null, ruleVersion: "coordinated-exit@v1", parameters: W },
    };
    const notMeasurable = buildFeatureObservation({
      ...base,
      state: "NOT_MEASURABLE",
      stateReason: "solde antérieur non démontrable",
      coverage: COMPLETE,
    });
    const censoredSide = buildFeatureObservation({
      ...base,
      state: "CENSORED",
      stateReason: "collecte interrompue",
      coverage: CENSORED,
    });

    const r1 = compareFeature("exit.materiality", L(notMeasurable), R(notMeasurable));
    expect(r1.verdict).toBe("NOT_COMPARABLE");
    expect(r1.basis.reason).toContain("NOT_MEASURABLE");

    const r2 = compareFeature("exit.materiality", L(notMeasurable), R(censoredSide));
    expect(r2.basis.reason).toContain("NOT_MEASURABLE");
    expect(r2.basis.reason).toContain("CENSORED");

    // MISSING est un cinquième état, et il se distingue des quatre autres.
    const r3 = compareFeature("exit.materiality", L(notMeasurable), R(null));
    expect(r3.basis.right.state).toBe("MISSING");
    expect(r3.basis.reason).toContain("MISSING");
    // On ne classe pas une absence : pas de nature de résultat.
    expect(r3.resultNature).toBeNull();
    expect(r3.basis.right.nature).toBeNull();
  });
});

describe("INV-4 — la censure ne peut qu'affaiblir un négatif", () => {
  it("un écart candidat est RETIRÉ quand un côté est censuré", () => {
    const r = compareFeature(
      "exit.demonstrated_venue",
      L(venue("RAYDIUM")),
      R(venue("ORCA", CENSORED)),
    );
    expect(r.verdict).toBe("NOT_COMPARABLE");
    expect(r.basis.reasonCode).toBe("COVERAGE_CENSORED_NEGATIVE_WITHHELD");
    expect(r.basis.resultIsFloor).toBe(true);
    expect(r.reservations.some((x) => x.startsWith("COVERAGE CENSORED"))).toBe(true);
  });

  it("mais un POSITIF survit à la censure — en restant un plancher", () => {
    // Ce qui est démontré des deux côtés l'est encore : seul le négatif dépend
    // de ce qu'on n'a pas vu. L'asymétrie est réelle et elle est tenue.
    const r = compareFeature(
      "funding.shared_funder_addresses",
      L(funders(["F1", "F2"], CENSORED)),
      R(funders(["F2"])),
    );
    expect(r.verdict).toBe("PARTIAL_MATCH");
    expect(r.basis.resultIsFloor).toBe(true);
  });
});

describe("INV-8 — pas de seuil, pas de score", () => {
  it("une grandeur est TRANSPORTÉE, jamais jugée", () => {
    const ord = (v: number) =>
      buildFeatureObservation({
        featureKey: "temporal.exit_cluster_span_seconds",
        state: "OBSERVED",
        value: { kind: "ORDINAL", value: v, unit: "seconds" },
        method: { methodRef: null, ruleVersion: "coordinated-exit@v1", parameters: W },
        coverage: COMPLETE,
        evidence: EV,
      });
    // 191 s contre 185 s : tentant, et refusé. Dire « proche » demanderait une
    // coupure qu'aucune règle ratifiée ne pose.
    const r = compareFeature("temporal.exit_cluster_span_seconds", L(ord(191)), R(ord(185)));
    expect(r.verdict).toBe("NOT_COMPARABLE");
    expect(r.basis.reasonCode).toBe("ORDINAL_REQUIRES_UNDECLARED_THRESHOLD");
    // Les deux valeurs restent lisibles — c'est le lecteur qui juge, à découvert.
    expect(r.basis.left.value).toEqual({ kind: "ORDINAL", value: 191, unit: "seconds" });
    expect(r.basis.right.value).toEqual({ kind: "ORDINAL", value: 185, unit: "seconds" });

    // Même égales, elles ne produisent pas un MATCH : l'égalité de deux durées
    // est une coïncidence, pas une ressemblance.
    expect(
      compareFeature("temporal.exit_cluster_span_seconds", L(ord(191)), R(ord(191))).verdict,
    ).toBe("NOT_COMPARABLE");
  });

  it("aucune clé d'agrégat nulle part dans la sortie", () => {
    const out = compareSubjects(
      { subjectRef: "CASE-A", observations: [venue("RAYDIUM")] },
      { subjectRef: "CASE-B", observations: [venue("RAYDIUM")] },
    );
    expect(JSON.stringify(out)).not.toMatch(/"(score|similarity|confidence|weight)"/i);
  });
});

describe("INV-9 — deux méthodes différentes ne se comparent pas", () => {
  it("des fenêtres divergentes bloquent la comparaison", () => {
    const a = buildFeatureObservation({
      featureKey: "exit.cluster_category",
      state: "OBSERVED",
      value: { kind: "CATEGORICAL", value: "NARROW_WINDOW_CLUSTER" },
      method: { methodRef: null, ruleVersion: "coordinated-exit@v1", parameters: { windowSeconds: 60 } },
      coverage: COMPLETE,
      evidence: EV,
    });
    const b = buildFeatureObservation({
      featureKey: "exit.cluster_category",
      state: "OBSERVED",
      value: { kind: "CATEGORICAL", value: "NARROW_WINDOW_CLUSTER" },
      method: { methodRef: null, ruleVersion: "coordinated-exit@v1", parameters: { windowSeconds: 600 } },
      coverage: COMPLETE,
      evidence: EV,
    });
    // Les VALEURS sont identiques. Rien en elles ne signalerait la divergence.
    const r = compareFeature("exit.cluster_category", L(a), R(b));
    expect(r.verdict).toBe("NOT_COMPARABLE");
    expect(r.basis.reasonCode).toBe("METHOD_MISMATCH");
  });
});

describe("INV-5 — l'expérimental et le nominatif se propagent", () => {
  const front = (values: string[]) =>
    buildFeatureObservation({
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

  it("une sortie PRE-SHILL ne devient pas canonique en traversant le comparateur", () => {
    const r = compareFeature("preshill.front_run_wallets", L(front(["W1"])), R(front(["W1"])));
    expect(r.verdict).toBe("MATCH");
    expect(r.basis.experimental).toBe(true);
    expect(r.reservations.some((x) => x.startsWith("EXPERIMENTAL INPUT"))).toBe(true);
  });

  it("un recouvrement de handles reste une CO-OCCURRENCE nominative", () => {
    const handles = (values: string[]) =>
      buildFeatureObservation({
        featureKey: "shill.kol_handles",
        state: "OBSERVED",
        value: { kind: "SET", values },
        method: { methodRef: null, ruleVersion: "shill-forward-bridge@v1", parameters: {} },
        coverage: COMPLETE,
        evidence: [{ kind: "occasion_id", refs: ["occ-1"] }],
      });
    const r = compareFeature("shill.kol_handles", L(handles(["a"])), R(handles(["a", "b"])));
    expect(r.basis.nominative).toBe(true);
    expect(r.reservations.some((x) => x.startsWith("NOMINATIVE CO-OCCURRENCE"))).toBe(true);
  });
});

describe("compareSubjects", () => {
  it("rend UNE entrée par feature du registre, y compris celles qui manquent", () => {
    // Ne rendre que les features présentes ferait varier la longueur de la
    // sortie avec l'ignorance : deux sujets mal couverts sembleraient avoir
    // « peu de différences ».
    const out = compareSubjects(
      { subjectRef: "CASE-A", observations: [venue("RAYDIUM")] },
      { subjectRef: "CASE-B", observations: [] },
    );
    expect(out.results).toHaveLength(SIMILARITY_FEATURE_KEYS.length);
    const missing = out.results.filter((r) => r.basis.right.state === "MISSING");
    expect(missing.length).toBe(SIMILARITY_FEATURE_KEYS.length);
    expect(out.results.every((r) => r.verdict === "NOT_COMPARABLE")).toBe(true);
  });

  it("refuse deux observations pour la même feature — l'ordre déciderait", () => {
    expect(() =>
      compareSubjects(
        { subjectRef: "A", observations: [venue("RAYDIUM"), venue("ORCA")] },
        { subjectRef: "B", observations: [] },
      ),
    ).toThrow(/deux observations/);
  });

  it("chaque résultat porte les réserves, dont le démenti de méthodologie", () => {
    const out = compareSubjects(
      { subjectRef: "A", observations: [venue("RAYDIUM")] },
      { subjectRef: "B", observations: [venue("RAYDIUM")] },
    );
    for (const r of out.results) {
      expect(r.reservations.some((x) => x.startsWith("SIMILARITY IS NOT A VERDICT"))).toBe(true);
      expect(r.reservations.some((x) => x.startsWith("METHODOLOGY ARTIFACT NOT FROZEN"))).toBe(
        true,
      );
      // Le sens gelé — démentis compris — voyage avec le résultat.
      expect(r.basis.meaning.length).toBeGreaterThan(40);
    }
  });
});
