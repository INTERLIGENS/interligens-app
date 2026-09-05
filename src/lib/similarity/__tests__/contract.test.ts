// BUILD 7 / S1 — LE CONTRAT : ce que le registre et le constructeur REFUSENT.
import { describe, expect, it } from "vitest";
import { isKnownMethodRef } from "@/lib/methodology/registry";
import { DATA_NATURES } from "@/lib/data-nature/nature";
import {
  MalformedObservationError,
  EmptyObservationError,
  SIMILARITY_COMPARE_RULE_VERSION,
  SIMILARITY_FEATURE_KEYS,
  SIMILARITY_FEATURE_REGISTRY,
  UnknownFeatureError,
  buildFeatureObservation,
  completeCoverage,
  specFor,
} from "..";

const METHOD = { methodRef: null, ruleVersion: "test/rule@v1", parameters: {} };
const COV = completeCoverage({ test: true });
const EV = [{ kind: "tx_signature", refs: ["sig-1"] }];

describe("le registre", () => {
  it("déclare des sorties de moteurs qui existent, et rien d'autre", () => {
    for (const key of SIMILARITY_FEATURE_KEYS) {
      const spec = specFor(key);
      expect(spec.source).toMatch(/^src\/lib\/.+ › .+/);
      expect(DATA_NATURES).toContain(spec.nature);
      expect(spec.meaning.length).toBeGreaterThan(40);
      // ORDINAL porte son unité, les autres non : un nombre nu se relit faux.
      if (spec.kind === "ORDINAL") expect(spec.unit).toBeTruthy();
      else expect(spec.unit).toBeNull();
    }
  });

  it("est FERMÉ — une clé inconnue lève au lieu d'être devinée", () => {
    expect(() => specFor("funding.whatever")).toThrow(UnknownFeatureError);
  });

  it("n'admet PAS UNKNOWN dans les catégories de financement", () => {
    // « Le qualificateur n'a pas su trancher » n'est pas une propriété du
    // sujet. L'admettre ferait « MATCH sur {UNKNOWN} ».
    const spec = specFor("funding.relationship_categories");
    expect(spec.allowedValues).not.toContain("UNKNOWN");
  });

  it("marque PRE-SHILL expérimental et les handles nominatifs", () => {
    expect(specFor("preshill.front_run_wallets").experimental).toBe(true);
    expect(specFor("shill.kol_handles").nominative).toBe(true);
    // Et personne d'autre ne l'est par accident.
    const experimental = SIMILARITY_FEATURE_KEYS.filter((k) => specFor(k).experimental);
    expect(experimental).toEqual(["preshill.front_run_wallets"]);
  });
});

describe("TRIPWIRE — la méthodologie de similarité n'est PAS gelée", () => {
  // ██ CE TEST DOIT ROUGIR LE JOUR OÙ L'ARTEFACT EST GELÉ. ██ C'est son rôle :
  // il force alors le retrait de la réserve « METHODOLOGY ARTIFACT NOT FROZEN »
  // portée par chaque résultat. Une réserve qu'on oublie de retirer devient du
  // bruit, et un bruit ne protège personne.
  it("similarity/compare@v1 ne résout sur aucun artefact gelé", () => {
    expect(isKnownMethodRef(SIMILARITY_COMPARE_RULE_VERSION)).toBe(false);
  });
});

describe("le constructeur d'observation", () => {
  it("prend la nature du REGISTRE, jamais de l'appelant", () => {
    const o = buildFeatureObservation({
      featureKey: "funding.shared_funder_addresses",
      state: "OBSERVED",
      value: { kind: "SET", values: ["B", "A", "A"] },
      method: METHOD,
      coverage: COV,
      evidence: EV,
    });
    expect(o.nature).toBe("PRIMARY_OBSERVATION");
    // Déterministe : dédupliqué et trié. L'ordre de collecte ne doit pas
    // produire deux observations différentes.
    expect(o.value).toEqual({ kind: "SET", values: ["A", "B"] });
  });

  it("REFUSE un ensemble vide — « rien de démontré » est un état, pas une valeur", () => {
    expect(() =>
      buildFeatureObservation({
        featureKey: "funding.shared_funder_addresses",
        state: "OBSERVED",
        value: { kind: "SET", values: [] },
        method: METHOD,
        coverage: COV,
        evidence: EV,
      }),
    ).toThrow(EmptyObservationError);
  });

  it("REFUSE une valeur sur un état non observé, et un état non observé sans motif", () => {
    expect(() =>
      buildFeatureObservation({
        featureKey: "exit.demonstrated_venue",
        state: "NOT_OBSERVED",
        value: { kind: "CATEGORICAL", value: "RAYDIUM" },
        stateReason: "x",
        method: { ...METHOD, parameters: { windowSeconds: 60 } },
        coverage: COV,
      }),
    ).toThrow(MalformedObservationError);

    expect(() =>
      buildFeatureObservation({
        featureKey: "exit.demonstrated_venue",
        state: "NOT_OBSERVED",
        method: { ...METHOD, parameters: { windowSeconds: 60 } },
        coverage: COV,
      }),
    ).toThrow(MalformedObservationError);
  });

  it("REFUSE CENSORED avec une couverture qui se dit complète", () => {
    expect(() =>
      buildFeatureObservation({
        featureKey: "shill.kol_handles",
        state: "CENSORED",
        stateReason: "budget épuisé",
        method: METHOD,
        coverage: COV,
      }),
    ).toThrow(MalformedObservationError);
  });

  it("REFUSE une couverture incomplète qui ne dit pas ce qui a coupé", () => {
    expect(() =>
      buildFeatureObservation({
        featureKey: "shill.kol_handles",
        state: "NOT_OBSERVED",
        stateReason: "rien vu",
        method: METHOD,
        coverage: { complete: false, censoredBy: null, upstream: {} },
      }),
    ).toThrow(MalformedObservationError);
  });

  it("REFUSE un paramètre de méthode exigé qui manque", () => {
    // `windowSeconds` est exigé : sans lui, la fenêtre deviendrait un choix
    // méthodologique invisible.
    expect(() =>
      buildFeatureObservation({
        featureKey: "exit.cluster_category",
        state: "OBSERVED",
        value: { kind: "CATEGORICAL", value: "NARROW_WINDOW_CLUSTER" },
        method: METHOD,
        coverage: COV,
        evidence: EV,
      }),
    ).toThrow(MalformedObservationError);
  });

  it("REFUSE une valeur hors du vocabulaire fermé", () => {
    expect(() =>
      buildFeatureObservation({
        featureKey: "funding.relationship_categories",
        state: "OBSERVED",
        value: { kind: "SET", values: ["UNKNOWN"] },
        method: METHOD,
        coverage: COV,
        evidence: EV,
      }),
    ).toThrow(MalformedObservationError);
  });

  it("REFUSE une sorte ou une unité qui contredit le registre", () => {
    expect(() =>
      buildFeatureObservation({
        featureKey: "exit.distinct_subjects",
        state: "OBSERVED",
        value: { kind: "ORDINAL", value: 4, unit: "wallets" },
        method: { ...METHOD, parameters: { windowSeconds: 60 } },
        coverage: COV,
        evidence: EV,
      }),
    ).toThrow(MalformedObservationError);

    expect(() =>
      buildFeatureObservation({
        featureKey: "exit.distinct_subjects",
        state: "OBSERVED",
        value: { kind: "CATEGORICAL", value: "4" },
        method: { ...METHOD, parameters: { windowSeconds: 60 } },
        coverage: COV,
        evidence: EV,
      }),
    ).toThrow(MalformedObservationError);
  });

  it("REFUSE OBSERVED sans preuve opposable", () => {
    expect(() =>
      buildFeatureObservation({
        featureKey: "exit.demonstrated_venue",
        state: "OBSERVED",
        value: { kind: "CATEGORICAL", value: "RAYDIUM" },
        method: { ...METHOD, parameters: { windowSeconds: 60 } },
        coverage: COV,
        evidence: [],
      }),
    ).toThrow(MalformedObservationError);
  });

  it("le registre est le seul propriétaire des drapeaux", () => {
    const o = buildFeatureObservation({
      featureKey: "preshill.front_run_wallets",
      state: "OBSERVED",
      value: { kind: "SET", values: ["W1"] },
      method: {
        methodRef: null,
        ruleVersion: "pre-shill/front-run@v1",
        parameters: { minOccasions: 3, minDistinctKols: 2, preWindowSeconds: 600 },
      },
      coverage: COV,
      evidence: [{ kind: "occasion_id", refs: ["occ-1"] }],
    });
    expect(o.experimental).toBe(true);
    expect(Object.keys(SIMILARITY_FEATURE_REGISTRY)).toContain(o.featureKey);
  });
});
