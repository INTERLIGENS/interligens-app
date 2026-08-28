// ─── CRITÈRE DE FERMETURE BUILD 2 — les 7 refus, démontrés par mutation ────
//
// Chacun de ces tests échoue si le garde correspondant est retiré. C'est le
// point : jusqu'à S6, Data Nature tenait par omission — on pouvait supprimer
// n'importe quelle règle sans qu'un seul test rougisse.

import { describe, it, expect } from "vitest";
import { assertNatureWritable, MixedArtifactNatureError, UnauditableEstimateError } from "@/lib/data-nature/writeGuard";
import { NatureTransitionError, UNCLASSIFIED } from "@/lib/data-nature/nature";
import { isValidMethodRef, METHOD_REF_SQL_PATTERN, METHOD_REF_PATTERN_BODY } from "@/lib/data-nature/methodRef";
import { MIXED_ASSERTION_ARTIFACTS, isMixedAssertionArtifact } from "@/lib/data-nature/mixedArtifacts";
import { eligibleForEvidenceChain, isUnknownStatus } from "@/lib/evidence-chain/eligibility";
import { SqliteEvidenceStore } from "@/lib/evidence-chain/store/sqlite";
import { generateManifest } from "@/lib/evidence-chain/manifest";

const WHERE = "mutation-test";

describe("1 · une NOUVELLE affirmation sans nature est refusée", () => {
  it("refuse null, undefined, chaîne vide, valeur inconnue", () => {
    for (const bad of [null, undefined, "", "PROBABLY", 42]) {
      expect(() => assertNatureWritable({ id: "new-row" }, { nature: bad }, WHERE)).toThrow();
    }
  });

  it("accepte une nature valide sur une ligne neuve", () => {
    expect(assertNatureWritable({ id: "new-row" }, { nature: "PRIMARY_OBSERVATION" }, WHERE))
      .toBe("PRIMARY_OBSERVATION");
  });

  it("GARDE-FOU — l'historique non classé reste LISIBLE, jamais promu", () => {
    // Une ligne legacy qu'on relit ne traverse pas le garde : rien ici ne
    // s'exécute sur un chemin de lecture. Et si on tente de la PROMOUVOIR
    // sans nature, c'est refusé comme n'importe quelle écriture.
    expect(() => assertNatureWritable({ id: "legacy", currentNature: UNCLASSIFIED }, { nature: undefined }, WHERE)).toThrow();
    // UNCLASSIFIED → n'importe quoi reste permis : c'est le classement humain.
    expect(assertNatureWritable({ id: "legacy", currentNature: UNCLASSIFIED }, { nature: "INFERENCE" }, WHERE))
      .toBe("INFERENCE");
  });
});

describe("2 · une ESTIMATE sans méthode ni basis valide est refusée", () => {
  it("refuse une ESTIMATE nue", () => {
    expect(() => assertNatureWritable({ id: "x" }, { nature: "ESTIMATE" }, WHERE))
      .toThrow(UnauditableEstimateError);
  });

  it("accepte par methodRef canonique", () => {
    expect(assertNatureWritable({ id: "x" }, { nature: "ESTIMATE", methodRef: "financial-estimates/est-proceeds@v1" }, WHERE))
      .toBe("ESTIMATE");
  });

  it("accepte par natureBasis — le cas W2, qu'AUCUNE méthodologie ne couvre", () => {
    expect(assertNatureWritable({ id: "lab" }, {
      nature: "ESTIMATE",
      natureBasis: { formula: "tokenQuantity × referencePriceUsd", tokenQuantity: { value: 100_000_000 } },
    }, WHERE)).toBe("ESTIMATE");
  });

  it("refuse un basis vide — un objet sans entrées n'audite rien", () => {
    expect(() => assertNatureWritable({ id: "x" }, { nature: "ESTIMATE", natureBasis: {} }, WHERE))
      .toThrow(UnauditableEstimateError);
  });
});

describe("3 · un methodRef legacy est refusé", () => {
  it("/en/methodology et les formules d'évitement ne passent pas", () => {
    for (const bad of ["/en/methodology", "legacy", "internal", "manual@1", "tbd"]) {
      expect(isValidMethodRef(bad)).toBe(false);
      expect(() => assertNatureWritable({ id: "x" }, { nature: "ESTIMATE", methodRef: bad }, WHERE))
        .toThrow(UnauditableEstimateError);
    }
  });

  it("la grammaire DB reproduit la grammaire app, elle ne la redérive pas", () => {
    expect(METHOD_REF_SQL_PATTERN).toBe(`^${METHOD_REF_PATTERN_BODY}$`);
    // Le corps est bien celui que le RegExp applicatif applique.
    expect(new RegExp(METHOD_REF_SQL_PATTERN).test("financial-estimates/est-proceeds@v1")).toBe(true);
    expect(new RegExp(METHOD_REF_SQL_PATTERN).test("/en/methodology")).toBe(false);
  });
});

describe("4 · une INFERENCE ne devient jamais PRIMARY_OBSERVATION", () => {
  it("refuse la remontée d'autorité (I1)", () => {
    expect(() => assertNatureWritable({ id: "x", currentNature: "INFERENCE" }, { nature: "PRIMARY_OBSERVATION" }, WHERE))
      .toThrow(NatureTransitionError);
    expect(() => assertNatureWritable({ id: "x", currentNature: "ESTIMATE" }, { nature: "THIRD_PARTY_DATA" }, WHERE))
      .toThrow(NatureTransitionError);
  });

  it("la descente reste permise", () => {
    expect(assertNatureWritable({ id: "x", currentNature: "PRIMARY_OBSERVATION" }, { nature: "INFERENCE" }, WHERE))
      .toBe("INFERENCE");
  });
});

describe("5 · une pièce EXCLUDED sort de la chaîne, sans sortir de l'audit", () => {
  const mkStore = () => new SqliteEvidenceStore(":memory:");

  it("eligibleForEvidenceChain est FAIL-CLOSED", () => {
    expect(eligibleForEvidenceChain({ evidentiaryStatus: null })).toBe(true);
    expect(eligibleForEvidenceChain({ evidentiaryStatus: "EXCLUDED" })).toBe(false);
    // Un statut inconnu n'est pas éligible par défaut — c'est le point.
    expect(eligibleForEvidenceChain({ evidentiaryStatus: "QUARANTINED" })).toBe(false);
    expect(isUnknownStatus({ evidentiaryStatus: "QUARANTINED" })).toBe(true);
  });

  it("le store normal l'exclut, la voie d'audit la rend, le manifeste la COMPTE", async () => {
    const store = mkStore();
    const keep = await store.insertItem({ sha256: "a".repeat(64), sourceType: "OTHER", casefileId: "c1" });
    const drop = await store.insertItem({ sha256: "b".repeat(64), sourceType: "OTHER", casefileId: "c1", filePath: "/x/.DS_Store" });
    await store.setEvidentiaryStatus(drop.id, "EXCLUDED", "metadonnee de dossier macOS");

    const active = await store.getCasefileItems("c1");
    expect(active.map((i) => i.id)).toEqual([keep.id]);

    const audit = await store.getCasefileItemsForAuditIncludingExcluded("c1");
    expect(audit.map((i) => i.id).sort()).toEqual([keep.id, drop.id].sort());

    const m = await generateManifest("c1", store, { generatedAt: new Date(0) });
    // 2 → 1 ne doit JAMAIS être silencieux.
    expect(m.custodyScope.totalInCasefile).toBe(2);
    expect(m.custodyScope.included).toBe(1);
    expect(m.custodyScope.excluded).toBe(1);
    expect(m.custodyScope.exclusions[0].reason).toBe("metadonnee de dossier macOS");
    expect(m.custodyScope.exclusions[0].ref).toBe("/x/.DS_Store");
    expect(m.itemCount).toBe(1);
    store.close();
  });
});

describe("6 · un artefact mixte ne se classe pas globalement en silence", () => {
  it("le corpus est NOMMÉ, pas seulement compté", () => {
    // Un test sur le seul cardinal resterait vert si on classait les 34 et
    // qu'on en ingérait 34 autres. Les pièces sont donc identifiées une à une.
    expect(MIXED_ASSERTION_ARTIFACTS).toHaveLength(34);
    for (const a of MIXED_ASSERTION_ARTIFACTS) {
      expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(a.id.length).toBeGreaterThan(0);
      expect(a.ref.length).toBeGreaterThan(0);
    }
    expect(new Set(MIXED_ASSERTION_ARTIFACTS.map((a) => a.sha256)).size).toBe(34);
  });

  it("refuse toute nature de LIGNE sur une pièce du corpus", () => {
    const a = MIXED_ASSERTION_ARTIFACTS[0];
    for (const n of ["INFERENCE", "ESTIMATE", "EDITORIAL_ASSERTION", "PRIMARY_OBSERVATION", UNCLASSIFIED]) {
      expect(() => assertNatureWritable({ id: a.id, sha256: a.sha256, ref: a.ref }, { nature: n, natureBasis: { x: 1 } }, WHERE))
        .toThrow(MixedArtifactNatureError);
    }
  });

  it("reconnaît la pièce par son sha256 même déplacée", () => {
    const a = MIXED_ASSERTION_ARTIFACTS[0];
    expect(isMixedAssertionArtifact({ sha256: a.sha256 })).toBe(true);
    expect(isMixedAssertionArtifact({ id: "ailleurs", sha256: a.sha256 })).toBe(true);
    expect(isMixedAssertionArtifact({ id: "inconnu", sha256: "f".repeat(64) })).toBe(false);
  });

  it("une nature de CHAMP reste possible — c'est la globale qui est refusée", () => {
    const a = MIXED_ASSERTION_ARTIFACTS[0];
    expect(assertNatureWritable(
      { id: a.id, sha256: a.sha256 },
      { nature: "ESTIMATE", scope: "field", natureBasis: { formula: "x" } },
      WHERE,
    )).toBe("ESTIMATE");
  });
});

describe("7 · les UNCLASSIFIED historiques sont identifiables et jamais promus", () => {
  it("UNCLASSIFIED est une valeur lisible, pas une absence", () => {
    expect(assertNatureWritable({ id: "neuve" }, { nature: UNCLASSIFIED }, WHERE)).toBe(UNCLASSIFIED);
  });

  it("on ne redescend jamais une nature établie vers UNCLASSIFIED", () => {
    // Déclasser vers l'ignorance effacerait une décision : interdit (I1).
    expect(() => assertNatureWritable({ id: "x", currentNature: "INFERENCE" }, { nature: UNCLASSIFIED }, WHERE))
      .toThrow(NatureTransitionError);
  });

  it("le corpus mixte reste UNCLASSIFIED — et ne peut pas en sortir en silence", () => {
    const a = MIXED_ASSERTION_ARTIFACTS[0];
    expect(() => assertNatureWritable({ id: a.id, sha256: a.sha256 }, { nature: "INFERENCE" }, WHERE))
      .toThrow(MixedArtifactNatureError);
  });
});
