// ─── CC-OFFLINE-234 — LA PROJECTION EST PORTÉE PAR UNE AUDIENCE ─────────────
//
// ██  UNE COLONNE HISTORIQUE CESSE D'ÊTRE UNE AUTORITÉ                      ██
// ██  LORSQUE LE PRODUIT CESSE DE LA CONSOMMER COMME TEL.                   ██
//
// ⚠️ LE TÉMOIN ESSENTIEL de ce fichier est le dernier bloc : une même claim,
// FONDÉE et NON PUBLIABLE, doit être PRÉSENTE côté counsel et ABSENTE côté
// public — simultanément, sur la même donnée. C'est la séparation d'autorité,
// et c'est ce qui interdit qu'une claim devienne publique par le seul fait de
// figurer dans un dossier de travail.

import { describe, it, expect } from "vitest";
import { projectConclusions, AUDIENCES, type DependencyIndex } from "@/lib/casefile/audienceProjection";
import { toInternalCaseView } from "@/lib/casefile/internalView";
import { projectForPublication } from "@/lib/casefile/publicProjection";
import { VINE_CASEFILE_REF } from "@/lib/casefile/publicProjection";
import type { CanonicalCaseFile, PublicClaim, PublicSource } from "@/lib/casefile/canonicalReader";

const SHA = "a".repeat(64);

const piece = (o: Partial<PublicSource> = {}): PublicSource => ({
  sourceId: "SRC-001", sourceType: "screenshot", caption: null, capturedAt: "2026-09-16",
  sourceUrl: "https://x.com/e/1", sha256: SHA, evidenceLinked: true,
  provenanceKind: "VERIFIED", ...o,
});

const claim = (o: Partial<PublicClaim> = {}): PublicClaim => ({
  claimId: "VINE-CONCLUSION-01", version: 1, title: "t", titleFr: null,
  description: null, descriptionFr: null, category: null, severity: null,
  status: null, claimDate: null, state: "ATTACHED",
  rowNature: "INFERENCE", evidenceRefs: [], provenance: null, ...o,
});

const dossier = (claims: PublicClaim[], sources: PublicSource[] = [piece()]): CanonicalCaseFile =>
  ({
    ref: VINE_CASEFILE_REF, codename: "VINE", ticker: "$VINE", title: "t",
    tigerScore: null, publishStatus: "draft", claims, sources, keyWallets: [],
  }) as unknown as CanonicalCaseFile;

/** La dépendance réelle : VINE-CONCLUSION-01 v1 → VINE-MEASURE-01 v1. */
const deps: DependencyIndex = new Map([
  ["VINE-CONCLUSION-01@1", [{ claimId: "VINE-MEASURE-01", version: 1, kind: "DERIVED_FROM" }]],
]);

describe("CC-OFFLINE-234 · aucun mot synthétique n'est produit", () => {
  it("l'audience est un vocabulaire EXPLICITE, pas un booléen", () => {
    expect([...AUDIENCES]).toEqual(["COUNSEL_INVESTOR", "PUBLIC"]);
  });

  it("0 conclusion admissible → aucune conclusion, et une CARDINALITÉ, jamais une appréciation", () => {
    const p = projectConclusions(dossier([]), "COUNSEL_INVESTOR", deps);
    expect(p.conclusions).toEqual([]);
    expect(p.state).toBe("NO_GOVERNED_CONCLUSION");
    // ⛔ Surtout pas UNDETERMINED : ce serait refabriquer le verdict supprimé.
    expect(JSON.stringify(p)).not.toContain("UNDETERMINED");
  });

  it("le cas BOTIFY — des claims non fondables ne produisent AUCUNE conclusion", () => {
    const p = projectConclusions(
      dossier([claim({ claimId: "C9", rowNature: null, evidenceRefs: [] })]),
      "COUNSEL_INVESTOR",
      deps,
    );
    expect(p.conclusions).toEqual([]);
    expect(p.state).toBe("NO_GOVERNED_CONCLUSION");
  });

  it("les OBSERVATIONS ne sont pas des conclusions — elles ne sont jamais projetées", () => {
    const p = projectConclusions(
      dossier([claim({ claimId: "VINE-MULTI-01", rowNature: "PRIMARY_OBSERVATION", evidenceRefs: ["SRC-001"] })]),
      "COUNSEL_INVESTOR",
      deps,
    );
    expect(p.conclusions).toEqual([]);
  });

  it("N conclusions → LES N, déterministement, et AUCUN mot global", () => {
    const p = projectConclusions(
      dossier([
        claim({ claimId: "VINE-CONCLUSION-02" }),
        claim({ claimId: "VINE-CONCLUSION-01" }),
      ]),
      "COUNSEL_INVESTOR",
      new Map([
        ["VINE-CONCLUSION-01@1", [{ claimId: "VINE-MEASURE-01", version: 1, kind: "DERIVED_FROM" }]],
        ["VINE-CONCLUSION-02@1", [{ claimId: "VINE-MEASURE-01", version: 1, kind: "DERIVED_FROM" }]],
      ]),
    );
    expect(p.conclusions.map((c) => c.claimId)).toEqual(["VINE-CONCLUSION-01", "VINE-CONCLUSION-02"]);
    // Rien qui ressemble à un verdict agrégé : la sortie est un ENSEMBLE.
    expect(Object.keys(p).sort()).toEqual(["audience", "conclusions", "ref", "state"]);
  });
});

describe("CC-OFFLINE-234 · une inférence porte son ensemble de dépendances VERSIONNÉ", () => {
  it("la dépendance est récupérable, par identité ET version", () => {
    const p = projectConclusions(dossier([claim()]), "COUNSEL_INVESTOR", deps);
    expect(p.conclusions).toHaveLength(1);
    expect(p.conclusions[0].version).toBe(1);
    expect(p.conclusions[0].dependencies).toEqual([
      { claimId: "VINE-MEASURE-01", version: 1, kind: "DERIVED_FROM" },
    ]);
  });

  it("sans dépendance remontée, une inférence SANS pièce n'est PAS admise côté counsel", () => {
    // Le contrat de fondement décide, pas la surface : zéro dépendance et zéro
    // pièce, c'est EVIDENCE_REFS_EMPTY.
    const p = projectConclusions(dossier([claim()]), "COUNSEL_INVESTOR", new Map());
    expect(p.conclusions).toEqual([]);
  });
});

describe("CC-OFFLINE-234 · le verdict hérité ne traverse plus aucune autorité", () => {
  it("MUTANT — modifier token_casefiles.verdict ne change RIEN à la projection counsel", () => {
    const base = toInternalCaseView(dossier([claim()]), deps);
    for (const mot of ["AVOID", "SAFE", "CONCENTRATION_RISK", "NOT_A_FINDING", "n'importe quoi"]) {
      const mute = { ...dossier([claim()]), verdict: mot } as unknown as CanonicalCaseFile;
      expect(toInternalCaseView(mute, deps)).toEqual(base);
    }
  });

  it("le verdict a QUITTÉ les deux surfaces autoritatives", () => {
    const counsel = toInternalCaseView(dossier([claim()]), deps);
    expect(Object.keys(counsel)).not.toContain("verdict");
    const publique = projectForPublication(dossier([claim()]), "temoin-234");
    expect(Object.keys(publique)).not.toContain("verdict");
  });
});

// ═══ LE TÉMOIN ESSENTIEL — LA SÉPARATION D'AUTORITÉ ═════════════════════════

describe("CC-OFFLINE-234 · TÉMOIN ESSENTIEL — fondée côté counsel, absente côté public", () => {
  it("VINE-CONCLUSION-01 · FOUNDATION MET · PUBLICATION REFUSED — simultanément", () => {
    const d = dossier([claim()]);

    const counsel = projectConclusions(d, "COUNSEL_INVESTOR", deps);
    const publique = projectConclusions(d, "PUBLIC", deps);

    // COUNSEL → PRÉSENTE. L'autorité est le FONDEMENT.
    expect(counsel.conclusions.map((c) => c.claimId)).toEqual(["VINE-CONCLUSION-01"]);
    expect(counsel.conclusions[0].admittedBy).toBe("COUNSEL_INVESTOR");

    // PUBLIC → ABSENTE. L'autorité de PUBLICATION n'a pas bougé : une inférence
    // sans pièce y tombe sur EVIDENCE_REFS_EMPTY, et la claim n'est pas PUBLIC.
    expect(publique.conclusions).toEqual([]);
    expect(publique.state).toBe("NO_GOVERNED_CONCLUSION");
  });

  it("le relâchement de CC-OFFLINE-232 ne franchit PAS la frontière de publication", () => {
    // Même claim, même dépendance valide : côté public, la dépendance n'est même
    // pas présentée au contrat. Aucune voie de contournement.
    const d = dossier([claim({ state: "PUBLIC" })]);
    expect(projectConclusions(d, "PUBLIC", deps).conclusions).toEqual([]);
  });

  it("une conclusion PUBLIQUE et citante reste projetée côté public — l'existant est intact", () => {
    const d = dossier([claim({ state: "PUBLIC", evidenceRefs: ["SRC-001"] })]);
    const p = projectConclusions(d, "PUBLIC", deps);
    expect(p.conclusions.map((c) => c.claimId)).toEqual(["VINE-CONCLUSION-01"]);
    expect(p.conclusions[0].admittedBy).toBe("PUBLIC");
  });

  it("une pièce non VERIFIED ferme la porte publique, jamais la porte counsel", () => {
    const d = dossier(
      [claim({ state: "PUBLIC", evidenceRefs: ["SRC-001"] })],
      [piece({ provenanceKind: "OPERATOR_DECLARED" })],
    );
    expect(projectConclusions(d, "PUBLIC", deps).conclusions).toEqual([]);
    expect(projectConclusions(d, "COUNSEL_INVESTOR", deps).conclusions).toHaveLength(1);
  });
});
