// ─── Invariants Data Nature (I1–I5) ────────────────────────────────────────
// Un invariant qui n'est pas testé est une intention. Ces cinq-là tiennent la
// doctrine de la spec S0/S1/S2 ; aucun n'a besoin de réseau ni de base.

import { describe, it, expect } from "vitest";
import {
  DATA_NATURES, UNCLASSIFIED, canTransition, assertTransition, requireNature,
  isValidMethodRef, assertEstimateHasMethod, assertPublishable,
  assertSingleNatureForConfidence, leastAuthoritative,
} from "@/lib/data-nature/nature";
import { NATURE_REGISTRY, natureForRow, natureForField, registryStats } from "@/lib/data-nature/registry";
import { decorate, natureOfTransformation, sortWithinNature } from "@/lib/data-nature/dto";
import { VOCABULARY_MAPPINGS, mapVocabularyValue, needsJoin } from "@/lib/data-nature/mapping";
import snapshot from "@/lib/data-nature/__schema-snapshot.json";

describe("S0 — l'énumération est gelée et fail-closed", () => {
  it("porte exactement les 5 natures ratifiées, UNCLASSIFIED exclu du type canonique", () => {
    expect([...DATA_NATURES]).toEqual([
      "PRIMARY_OBSERVATION", "THIRD_PARTY_DATA", "INFERENCE", "ESTIMATE", "EDITORIAL_ASSERTION",
    ]);
    expect(DATA_NATURES).not.toContain(UNCLASSIFIED);
  });

  it("une nature inconnue fait ÉCHOUER l'écriture — aucun défaut silencieux", () => {
    for (const bad of [undefined, null, "", "OBSERVATION", "unclassified", 42, {}]) {
      expect(() => requireNature(bad, "test")).toThrow(/nature inconnue/);
    }
  });

  it("requireNature n'expose aucun paramètre de repli", () => {
    expect(requireNature.length).toBe(2); // (value, where) — pas de 3e argument
  });
});

describe("I1 — la nature ne remonte jamais l'échelle", () => {
  it("refuse toute promotion vers une nature plus autoritaire", () => {
    expect(canTransition("INFERENCE", "PRIMARY_OBSERVATION")).toBe(false);
    expect(canTransition("ESTIMATE", "INFERENCE")).toBe(false);
    expect(canTransition("EDITORIAL_ASSERTION", "THIRD_PARTY_DATA")).toBe(false);
    expect(() => assertTransition("ESTIMATE", "INFERENCE", "test")).toThrow(/ne remonte jamais/);
  });

  it("autorise la descente et l'identité", () => {
    expect(canTransition("PRIMARY_OBSERVATION", "INFERENCE")).toBe(true);
    expect(canTransition("INFERENCE", "INFERENCE")).toBe(true);
  });

  it("classer (UNCLASSIFIED → X) est permis ; déclasser vers l'ignorance ne l'est pas", () => {
    expect(canTransition(UNCLASSIFIED, "PRIMARY_OBSERVATION")).toBe(true);
    expect(canTransition("INFERENCE", UNCLASSIFIED)).toBe(false);
  });

  it("l'arbitrage §1.2 retient toujours la moins autoritaire", () => {
    expect(leastAuthoritative("PRIMARY_OBSERVATION", "EDITORIAL_ASSERTION")).toBe("EDITORIAL_ASSERTION");
    expect(leastAuthoritative("INFERENCE", "ESTIMATE")).toBe("ESTIMATE");
  });
});

describe("I2 / Q5 — ESTIMATE exige une méthode versionnable et auditable", () => {
  it("refuse les formules d'évitement", () => {
    for (const bad of ["internal", "internal@1", "n/a@1", "manual@1", "tbd@1", "legacy@2"]) {
      expect(isValidMethodRef(bad)).toBe(false);
    }
  });

  it("exige la forme slug@version", () => {
    expect(isValidMethodRef("retail-harm@2")).toBe(true);
    expect(isValidMethodRef("retail-harm@1.2.0")).toBe(true);
    expect(isValidMethodRef("retail-harm")).toBe(false);   // pas de version
    expect(isValidMethodRef("retail harm@2")).toBe(false); // pas un slug
  });

  it("ne s'applique qu'à ESTIMATE", () => {
    expect(() => assertEstimateHasMethod("INFERENCE", undefined, "t")).not.toThrow();
    expect(() => assertEstimateHasMethod("ESTIMATE", undefined, "t")).toThrow(/INFALSIFIABLE/);
  });

  it("s'applique au CHAMP, pas seulement à la ligne", () => {
    // token_casefiles : la ligne est EDITORIAL_ASSERTION, le champ est l'ESTIMATE.
    expect(() =>
      decorate("token_casefiles", { estimatedRetailHarmUsd: 482_000_000 }, "t",
        { fields: ["estimatedRetailHarmUsd"] }),
    ).toThrow(/ESTIMATE sans methodRef/);
  });
});

describe("I3 — une sortie publique ne contient jamais UNCLASSIFIED", () => {
  it("refuse une table hors registre", () => {
    expect(() => decorate("TableInexistante", {}, "t")).toThrow(/UNCLASSIFIED/);
  });

  it("retire un champ non classé au lieu de le publier", () => {
    const dto = decorate(
      "KolTokenLink",
      { sourceType: "manual_seed", contractAddress: "PENDING:SWIF", canonicalMint: null },
      "t",
      { fields: ["contractAddress", "canonicalMint"] },
    );
    expect("contractAddress" in dto).toBe(false);
    expect(dto._nature.fields ?? {}).not.toHaveProperty("canonicalMint");
  });

  it("assertPublishable bloque le transitoire", () => {
    expect(() => assertPublishable(UNCLASSIFIED, "t")).toThrow(/non classée/);
  });
});

describe("Q2 — la confiance n'est comparable qu'à nature égale", () => {
  it("refuse une comparaison inter-nature", () => {
    expect(() =>
      assertSingleNatureForConfidence(
        [{ nature: "THIRD_PARTY_DATA" }, { nature: "EDITORIAL_ASSERTION" }], "t",
      ),
    ).toThrow(/inter-nature/);
  });

  it("sortWithinNature n'a pas d'ordre par défaut — l'appelant le déclare", () => {
    const items = [
      { nature: "THIRD_PARTY_DATA" as const, c: 1 },
      { nature: "EDITORIAL_ASSERTION" as const, c: 9 },
      { nature: "THIRD_PARTY_DATA" as const, c: 5 },
    ];
    const out = sortWithinNature(items, (a, b) => b.c - a.c, ["EDITORIAL_ASSERTION", "THIRD_PARTY_DATA"]);
    expect(out.map((i) => i.nature)).toEqual([
      "EDITORIAL_ASSERTION", "THIRD_PARTY_DATA", "THIRD_PARTY_DATA",
    ]);
    expect(out.slice(1).map((i) => i.c)).toEqual([5, 1]); // trié DANS le groupe
  });

  it("ne supprime jamais ce que l'ordre déclaré n'a pas nommé", () => {
    const items = [{ nature: "INFERENCE" as const, c: 1 }];
    expect(sortWithinNature(items, () => 0, ["THIRD_PARTY_DATA"])).toHaveLength(1);
  });
});

describe("Q3 — la nature de sortie est celle de la transformation", () => {
  it("un calcul sur du tiers produit une INFERENCE, pas du tiers", () => {
    expect(natureOfTransformation("compute", ["THIRD_PARTY_DATA"])).toEqual({
      nature: "INFERENCE", natureBasis: ["THIRD_PARTY_DATA"],
    });
  });

  it("un relais hérite, et retient la moins autoritaire quand les entrées diffèrent", () => {
    expect(
      natureOfTransformation("relay", ["PRIMARY_OBSERVATION", "EDITORIAL_ASSERTION"]).nature,
    ).toBe("EDITORIAL_ASSERTION");
  });

  it("riskClass : INFERENCE avec THIRD_PARTY_DATA en base, jamais THIRD_PARTY_DATA seul", () => {
    const decl = NATURE_REGISTRY.intel_canonical_entities;
    expect(decl.nature).toBe("INFERENCE");
    expect(decl.basis).toEqual(["THIRD_PARTY_DATA"]);
  });
});

describe("I5 — toute table est classée, ou elle ne publie rien", () => {
  it("le registre ne référence que des tables réellement présentes", () => {
    const known = new Set(snapshot.tables as string[]);
    const ghosts = Object.keys(NATURE_REGISTRY).filter((t) => !known.has(t));
    expect(ghosts).toEqual([]);
  });

  it("une table absente du registre est UNCLASSIFIED, donc non publiable", () => {
    const unregistered = (snapshot.tables as string[]).filter((t) => !NATURE_REGISTRY[t]);
    expect(unregistered.length).toBeGreaterThan(0); // état de fait à S1, assumé
    for (const t of unregistered.slice(0, 5)) {
      expect(natureForRow(t, {})).toBe(UNCLASSIFIED);
    }
  });

  it("le décompte du plan est recalculé, jamais recopié", () => {
    const s = registryStats();
    expect(s.rowsNoWrite).toBeGreaterThan(1_500_000);
    expect(s.rowsToWrite).toBeLessThan(3_000);
    expect(s.rowsNoWrite + s.rowsToWrite).toBe(s.rowsTotal);
  });
});

describe("S1 — le mapping refuse ce qui n'est pas mappable seul", () => {
  it("MmClaimType.FACT exige une jointure sur MmSource", () => {
    expect(mapVocabularyValue("MmClaimType", "FACT")).toBeNull();
    expect(needsJoin("MmClaimType", "FACT")).toBe(true);
  });

  it("MIGRATED_BACKFILL n'est pas une nature mais un mode d'ingestion", () => {
    const voc = VOCABULARY_MAPPINGS.find((v) => v.source === "EvidenceItem.provenanceType")!;
    expect(voc.values.MIGRATED_BACKFILL.kind).toBe("OTHER_AXIS");
  });

  it("les 8 vocabulaires sont recensés et aucun n'est promu tel quel", () => {
    expect(VOCABULARY_MAPPINGS).toHaveLength(8);
    expect(VOCABULARY_MAPPINGS.every((v) => v.supersedable !== "yes" || v.supersedeNote.length > 0)).toBe(true);
  });
});

describe("Régimes — la règle est mécanique, pas au cas par cas", () => {
  it("les 2 plus grosses tables sont couvertes sans écriture", () => {
    for (const t of ["DomainLabel", "AddressLabel"]) {
      expect(NATURE_REGISTRY[t].regime).toBe("DECLARED_PREDICATE");
      expect(natureForRow(t, { sourceName: "OFAC SDN" })).toBe("THIRD_PARTY_DATA");
      expect(natureForRow(t, { sourceName: "INTERLIGENS" })).toBe("EDITORIAL_ASSERTION");
    }
  });

  it("KolTokenLink porte 4 natures — régime CHAMP", () => {
    const row = { sourceType: "watcher", contractAddress: "So1111", canonicalMint: "So1111", note: "x" };
    expect(NATURE_REGISTRY.KolTokenLink.regime).toBe("FIELD");
    expect(natureForRow("KolTokenLink", row)).toBe("PRIMARY_OBSERVATION");
    expect(natureForField("KolTokenLink", "canonicalMint", row)).toBe("INFERENCE");
    expect(natureForField("KolTokenLink", "note", row)).toBe("EDITORIAL_ASSERTION");
  });
});
