// BUILD 7 / S1 — LE CONTRAT : ce que le registre et le constructeur REFUSENT.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isKnownMethodRef, resolveMethodRef } from "@/lib/methodology/registry";
import {
  SIMILARITY_V1,
  SIMILARITY_V1_SHA256,
  serializeArtifactBody,
} from "@/lib/methodology/artifact";
import { DATA_NATURES } from "@/lib/data-nature/nature";
import {
  MalformedObservationError,
  EmptyObservationError,
  SIMILARITY_COMPARE_RULE_VERSION,
  SIMILARITY_FEATURE_KEYS,
  SIMILARITY_FEATURE_REGISTRY,
  ALLOWED_VERDICT_REASONS,
  SIMILARITY_RESERVATIONS,
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

describe("GEL — la méthodologie de similarité EST gelée (bascule du tripwire)", () => {
  // ██ CE BLOC AFFIRMAIT L'INVERSE JUSQU'AU 2026-09-05. ██ Le tripwire disait
  // « le ref NE résout PAS » et portait sa propre condition de retrait : il a
  // rougi au gel de content/methodologies/similarity/v1.md, ce qui a forcé, en
  // un seul geste, le retrait de la réserve « METHODOLOGY ARTIFACT NOT FROZEN »
  // et la réécriture de ce test. Une réserve devenue fausse serait du bruit.
  const MD = join(process.cwd(), "content/methodologies/similarity/v1.md");
  const HEADER = `## ${SIMILARITY_V1.components[0].id} — ${SIMILARITY_V1.components[0].title}`;
  const frozenBody = (md: string) => md.slice(md.indexOf(HEADER)).replace(/\n+$/, "");
  const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

  it("similarity/compare@v1 résout sur un artefact gelé", () => {
    expect(isKnownMethodRef(SIMILARITY_COMPARE_RULE_VERSION)).toBe(true);
    const r = resolveMethodRef(SIMILARITY_COMPARE_RULE_VERSION);
    expect(r).not.toBeNull();
    expect(r!.componentId).toBe("compare");
    expect(r!.artifact.version).toBe("v1");
    expect(r!.artifact.id).toBe("similarity");
  });

  it("le .md est déclaré FROZEN et son sha déclaré est celui de son corps", () => {
    const md = readFileSync(MD, "utf8");
    expect(md).toContain("status: FROZEN");
    const declared = /contentSha256: ([0-9a-f]{64})/.exec(md)?.[1];
    expect(declared).toBeDefined();
    expect(sha(frozenBody(md))).toBe(declared);
    expect(SIMILARITY_V1_SHA256).toBe(declared);
  });

  it("le miroir TypeScript reproduit le .md OCTET POUR OCTET", () => {
    // Sans ce test, le miroir et l'artefact dériveraient en silence, et le
    // methodRef citerait un texte que personne ne pourrait relire.
    expect(serializeArtifactBody(SIMILARITY_V1)).toBe(frozenBody(readFileSync(MD, "utf8")));
  });

  it("le gel fige EXACTEMENT le contrat S2 — les 16 clés y sont nommées", () => {
    // Le corps gelé n'est pas un résumé : chaque feature déclarée doit y être
    // citée, faute de quoi @v1 documenterait un contrat qu'il ne contient pas.
    const body = SIMILARITY_V1.components[0].body;
    for (const key of SIMILARITY_FEATURE_KEYS) expect(body).toContain(key);
    expect(SIMILARITY_FEATURE_KEYS).toHaveLength(17);
  });

  it("le gel fige EXACTEMENT la sémantique S2 — verdicts et motifs", () => {
    const body = SIMILARITY_V1.components[0].body;
    for (const [verdict, reasons] of Object.entries(ALLOWED_VERDICT_REASONS)) {
      expect(body).toContain(verdict);
      for (const r of reasons) expect(body).toContain(r);
    }
  });

  it("chaque comparaison cite désormais la méthode gelée", () => {
    expect(
      SIMILARITY_RESERVATIONS.some((r) => r.startsWith("METHOD IS FROZEN AND CITABLE")),
    ).toBe(true);
    expect(SIMILARITY_RESERVATIONS.some((r) => r.includes("NOT FROZEN"))).toBe(false);
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
