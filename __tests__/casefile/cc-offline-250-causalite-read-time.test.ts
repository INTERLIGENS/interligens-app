// ─── CC-OFFLINE-250 · CRITÈRE 14 — LA CAUSALITÉ EST VÉRIFIÉE À LA LECTURE ───
//
// ██  UNE DÉPENDANCE VÉRIFIÉE À L'INSERTION NE GOUVERNE PAS À ELLE SEULE    ██
// ██  UNE PROJECTION FUTURE.                                                ██
//
// L'exécuteur gouverné (CC-OFFLINE-232) vérifie la chaîne causale — mais À
// L'ÉCRITURE. Le critère 14 porte sur le RETRAIT du finding, qui est à la
// LECTURE : une garantie write-time ne retire jamais rien.
//
// ⚠️ LE TÉMOIN DÉCISIF de ce fichier est le bloc « MUTANT CAUSAL » : on dégrade
// l'autorité nécessaire de la claim source SANS TOUCHER à la ligne de
// dépendance, on relit la projection, et l'inférence doit avoir DISPARU.
//
//   FK EXISTENCE ≠ FOUNDATION AUTHORITY.

import { describe, it, expect } from "vitest";
import { projectAssembly, projectConclusions, type DependencyIndex } from "@/lib/casefile/audienceProjection";
import type {
  AssembledClaim,
  AssembledDependency,
  AssembledSource,
  CanonicalAuthorityAssembly,
} from "@/lib/casefile/authorityAssembly";
import type { CanonicalCaseFile, PublicClaim, PublicSource } from "@/lib/casefile/canonicalReader";

const SHA = "a".repeat(64);

// ═══ LA DONNÉE NOMINALE — CELLE DU VINE RÉEL ════════════════════════════════
//
//   VINE-CONCLUSION-01 v1  INFERENCE, 0 pièce
//     → DERIVED_FROM → VINE-MEASURE-01 v1
//   VINE-MEASURE-01 v1     PRIMARY_OBSERVATION, cite SRC-MEASURE-01
//   SRC-MEASURE-01         MACHINE_MEASURED

const piece = (o: Partial<AssembledSource> = {}): AssembledSource => ({
  sourceId: "SRC-MEASURE-01", sourceType: "instrument_output", caption: null,
  capturedAt: "2026-09-16", sourceUrl: "r2://bucket/mesure.json", sha256: SHA,
  snapshotLinked: true, provenanceKind: "MACHINE_MEASURED", journalId: "12",
  sourceLocator: "r2://bucket/mesure.json",
  declaredBy: "instrument:il-measure-vine-wallet-attribution@1.0.0", ...o,
});

const MESURE = (o: Partial<AssembledClaim> = {}): AssembledClaim => ({
  claimId: "VINE-MEASURE-01", version: 1, rowNature: "PRIMARY_OBSERVATION",
  title: "Bounded measurement", titleFr: null, description: null, descriptionFr: null,
  category: null, severity: null, status: null, claimDate: null, state: "ATTACHED",
  evidenceRefs: ["SRC-MEASURE-01"], contentHash: "d".repeat(64), ...o,
});

const CONCLUSION = (o: Partial<AssembledClaim> = {}): AssembledClaim => ({
  claimId: "VINE-CONCLUSION-01", version: 1, rowNature: "INFERENCE",
  title: "Governed conclusion", titleFr: null, description: null, descriptionFr: null,
  category: null, severity: null, status: null, claimDate: null, state: "ATTACHED",
  evidenceRefs: [], contentHash: "b".repeat(64), ...o,
});

/** LA LIGNE DE DÉPENDANCE. Elle n'est JAMAIS retirée dans les mutants. */
const DEP: AssembledDependency = {
  dependentClaimId: "VINE-CONCLUSION-01", dependentVersion: 1,
  sourceClaimId: "VINE-MEASURE-01", sourceVersion: 1, kind: "DERIVED_FROM",
};

const assemblage = (o: Partial<CanonicalAuthorityAssembly> = {}): CanonicalAuthorityAssembly => ({
  subject: { ref: "IL-SHILL-VINE-001", codename: "VINE", ticker: "$VINE", title: "t" },
  sources: [piece()],
  claims: [MESURE(), CONCLUSION()],
  dependencies: [DEP],
  ...o,
});

const idsCounsel = (a: CanonicalAuthorityAssembly): string[] =>
  projectAssembly(a, "COUNSEL_INVESTOR").claims.map((c) => c.claimId);

// ═══ LE WITNESS NOMINAL ═════════════════════════════════════════════════════

describe("CC-OFFLINE-250 · WITNESS NOMINAL — la source est fondée, la conclusion est là", () => {
  it("VINE-CONCLUSION-01 v1 → DERIVED_FROM → VINE-MEASURE-01 v1 · COUNSEL PRESENT", () => {
    const p = projectAssembly(assemblage(), "COUNSEL_INVESTOR");
    const conclusion = p.claims.find((c) => c.claimId === "VINE-CONCLUSION-01");
    expect(conclusion, "la conclusion doit être projetée quand sa source est fondée").toBeDefined();
    expect(conclusion?.dependencies).toEqual([DEP]);
    // Et sa source est là, elle aussi, fondée par sa pièce.
    expect(p.claims.map((c) => c.claimId)).toEqual(["VINE-CONCLUSION-01", "VINE-MEASURE-01"]);
  });

  it("PUBLIC reste ABSENT — la chaîne de fondement ne donne aucune autorité de publication", () => {
    // Le témoin de CC-OFFLINE-234 doit rester vert : COUNSEL ≠ PUBLIC.
    const p = projectAssembly(assemblage(), "PUBLIC");
    expect(p.claims.map((c) => c.claimId)).toEqual([]);
    expect(p.state).toBe("NO_GOVERNED_CLAIM");
  });
});

// ═══ LE MUTANT CAUSAL — LE TÉMOIN DÉCISIF ═══════════════════════════════════
//
// Dans CHACUN de ces cas, la ligne `casefile_claim_dependencies` EST TOUJOURS
// LÀ, intacte, épinglée sur la bonne version. Seule l'autorité de la source a
// été dégradée. Avant CC-OFFLINE-250, les quatre rendaient la conclusion
// PRÉSENTE — `deps.length` valait 1 dans les quatre.

describe("CC-OFFLINE-250 · MUTANT CAUSAL — l'autorité de la source est dégradée", () => {
  it("la PIÈCE de la source est DÉQUALIFIÉE ⇒ la conclusion DISPARAÎT", () => {
    const a = assemblage({ sources: [piece({ provenanceKind: "UNKNOWN" })] });
    expect(a.dependencies).toEqual([DEP]); // la ligne est intacte
    expect(idsCounsel(a)).toEqual([]);     // et la conclusion n'est plus là
  });

  it("la PIÈCE de la source est RETIRÉE du dossier ⇒ la conclusion DISPARAÎT", () => {
    const a = assemblage({ sources: [] });
    expect(a.dependencies).toEqual([DEP]);
    expect(idsCounsel(a)).toEqual([]);
  });

  it("la source est DÉCLASSIFIÉE — rowNature nulle ⇒ la conclusion DISPARAÎT", () => {
    const a = assemblage({ claims: [MESURE({ rowNature: null }), CONCLUSION()] });
    expect(a.dependencies).toEqual([DEP]);
    expect(idsCounsel(a)).toEqual([]);
  });

  it("la source est SUPERSÉDÉE — seule la v2 subsiste ⇒ la conclusion DISPARAÎT", () => {
    // ⛔ AUCUN REPLI DE VERSION, AUCUNE RÉSURRECTION PAR `supersedes`. La
    //    dépendance épingle la v1 : une v2, même parfaitement fondée, n'est
    //    PAS la claim que l'inférence a déclaré consommer.
    const a = assemblage({ claims: [MESURE({ version: 2 }), CONCLUSION()] });
    expect(a.dependencies).toEqual([DEP]);
    expect(idsCounsel(a)).toEqual(["VINE-MEASURE-01"]); // la v2 reste, la conclusion non
  });

  it("la source a DISPARU du dossier ⇒ la conclusion DISPARAÎT", () => {
    const a = assemblage({ claims: [CONCLUSION()] });
    expect(a.dependencies).toEqual([DEP]);
    expect(idsCounsel(a)).toEqual([]);
  });
});

// ═══ LE MUTANT COMPLÉMENTAIRE ═══════════════════════════════════════════════

describe("CC-OFFLINE-250 · FK EXISTENCE ≠ FOUNDATION AUTHORITY", () => {
  it("ligne présente + claim source présente + version EXACTE, mais fondement UNMET ⇒ ABSENT", () => {
    // Tout ce qu'une clef étrangère peut vérifier est VRAI ici : la ligne
    // existe, la claim source existe, et la version épinglée est la bonne.
    // Ce qui manque est la seule chose qu'une FK ne sait pas dire — l'autorité
    // ACTUELLE de cette claim. Sa pièce citée ne résout vers rien.
    const a = assemblage({ claims: [MESURE({ evidenceRefs: ["SRC-INEXISTANTE"] }), CONCLUSION()] });

    expect(a.dependencies[0]).toEqual(DEP);
    expect(a.claims.some((c) => c.claimId === "VINE-MEASURE-01" && c.version === 1)).toBe(true);
    expect(idsCounsel(a)).toEqual([]);
  });

  it("une source fondée par SES PROPRES dépendances, elle aussi rompues, ne fonde rien", () => {
    // La chaîne a deux étages : CONCLUSION → RELAIS → MESURE. Casser le
    // dernier étage doit remonter jusqu'au premier.
    const RELAIS = CONCLUSION({ claimId: "VINE-RELAIS-01", contentHash: "e".repeat(64) });
    const a = assemblage({
      claims: [MESURE({ rowNature: null }), RELAIS, CONCLUSION()],
      dependencies: [
        { dependentClaimId: "VINE-RELAIS-01", dependentVersion: 1, sourceClaimId: "VINE-MEASURE-01", sourceVersion: 1, kind: "DERIVED_FROM" },
        { dependentClaimId: "VINE-CONCLUSION-01", dependentVersion: 1, sourceClaimId: "VINE-RELAIS-01", sourceVersion: 1, kind: "DERIVED_FROM" },
      ],
    });
    expect(idsCounsel(a)).toEqual([]);
  });

  it("un fondement CIRCULAIRE n'est pas un fondement", () => {
    const A = CONCLUSION({ claimId: "C-A" });
    const B = CONCLUSION({ claimId: "C-B", contentHash: "f".repeat(64) });
    const a = assemblage({
      claims: [A, B],
      dependencies: [
        { dependentClaimId: "C-A", dependentVersion: 1, sourceClaimId: "C-B", sourceVersion: 1, kind: "DERIVED_FROM" },
        { dependentClaimId: "C-B", dependentVersion: 1, sourceClaimId: "C-A", sourceVersion: 1, kind: "DERIVED_FROM" },
      ],
    });
    expect(idsCounsel(a)).toEqual([]);
  });
});

// ═══ ALL, PAS ANY ═══════════════════════════════════════════════════════════

describe("CC-OFFLINE-250 · TOUTES les dépendances déclarées, pas une sur deux", () => {
  const AUTRE = MESURE({ claimId: "VINE-MESURE-BIS", version: 1, contentHash: "c".repeat(64) });
  const DEP_BIS: AssembledDependency = {
    dependentClaimId: "VINE-CONCLUSION-01", dependentVersion: 1,
    sourceClaimId: "VINE-MESURE-BIS", sourceVersion: 1, kind: "DERIVED_FROM",
  };

  it("DEUX dépendances fondées ⇒ la conclusion est projetée, avec les deux", () => {
    const a = assemblage({
      claims: [MESURE(), AUTRE, CONCLUSION()],
      dependencies: [DEP, DEP_BIS],
    });
    const c = projectAssembly(a, "COUNSEL_INVESTOR").claims.find((x) => x.claimId === "VINE-CONCLUSION-01");
    expect(c?.dependencies).toHaveLength(2);
  });

  it("UNE SEULE des deux rompue ⇒ la conclusion DISPARAÎT — jamais « une sur deux suffit »", () => {
    const a = assemblage({
      claims: [MESURE(), MESURE({ claimId: "VINE-MESURE-BIS", rowNature: null }), CONCLUSION()],
      dependencies: [DEP, DEP_BIS],
    });
    expect(idsCounsel(a)).toEqual(["VINE-MEASURE-01"]);
  });
});

// ═══ LES QUATRE INTERDITS ═══════════════════════════════════════════════════

describe("CC-OFFLINE-250 · aucune voie de repli n'existe", () => {
  it("⛔ pas de repli vers une version ANTÉRIEURE", () => {
    // La dépendance épingle la v2 ; seule la v1, fondée, est présente.
    const a = assemblage({
      claims: [MESURE({ version: 1 }), CONCLUSION()],
      dependencies: [{ ...DEP, sourceVersion: 2 }],
    });
    expect(idsCounsel(a)).toEqual(["VINE-MEASURE-01"]);
  });

  it("⛔ pas de claim « équivalente » — l'identité est exacte", () => {
    const a = assemblage({
      claims: [MESURE({ claimId: "VINE-MEASURE-01-BIS" }), CONCLUSION()],
      dependencies: [DEP],
    });
    expect(idsCounsel(a)).toEqual(["VINE-MEASURE-01-BIS"]);
  });

  it("⛔ la projection ne RE-RAISONNE pas : elle ne consulte que le contrat existant", () => {
    // Une source dont la pièce est MACHINE_MEASURED est fondable — la
    // projection n'a aucune opinion propre là-dessus, elle relaie le contrat.
    const a = assemblage({ sources: [piece({ provenanceKind: "OPERATOR_DECLARED" })] });
    expect(idsCounsel(a)).toEqual(["VINE-CONCLUSION-01", "VINE-MEASURE-01"]);
  });
});

// ═══ LA MÊME RÈGLE SUR L'AUTRE SURFACE ══════════════════════════════════════
//
// `projectConclusions` (CC-OFFLINE-234) est consommée par `internalView`. Elle
// portait le même défaut, et elle porte la même correction.

describe("CC-OFFLINE-250 · projectConclusions porte la MÊME règle", () => {
  const src = (o: Partial<PublicSource> = {}): PublicSource => ({
    sourceId: "SRC-MEASURE-01", sourceType: "instrument_output", caption: null,
    capturedAt: "2026-09-16", sourceUrl: "r2://b/m.json", sha256: SHA,
    evidenceLinked: true, provenanceKind: "MACHINE_MEASURED", ...o,
  });
  const pc = (o: Partial<PublicClaim>): PublicClaim => ({
    claimId: "X", version: 1, title: "t", titleFr: null, description: null,
    descriptionFr: null, category: null, severity: null, status: null,
    claimDate: null, state: "ATTACHED", rowNature: "INFERENCE", evidenceRefs: [],
    provenance: null, ...o,
  } as PublicClaim);

  const doss = (claims: PublicClaim[], sources: PublicSource[] = [src()]): CanonicalCaseFile =>
    ({
      ref: "IL-SHILL-VINE-001", codename: "VINE", ticker: "$VINE", title: "t",
      tigerScore: null, publishStatus: "draft", claims, sources, keyWallets: [],
    }) as unknown as CanonicalCaseFile;

  const index: DependencyIndex = new Map([
    ["VINE-CONCLUSION-01@1", [{ claimId: "VINE-MEASURE-01", version: 1, kind: "DERIVED_FROM" }]],
  ]);

  const mesure = pc({ claimId: "VINE-MEASURE-01", rowNature: "PRIMARY_OBSERVATION", evidenceRefs: ["SRC-MEASURE-01"] });
  const conclusion = pc({ claimId: "VINE-CONCLUSION-01" });

  it("NOMINAL — source fondée ⇒ conclusion PRÉSENTE côté counsel", () => {
    const p = projectConclusions(doss([mesure, conclusion]), "COUNSEL_INVESTOR", index);
    expect(p.conclusions.map((c) => c.claimId)).toEqual(["VINE-CONCLUSION-01"]);
  });

  it("MUTANT CAUSAL — pièce déqualifiée, ligne intacte ⇒ conclusion ABSENTE", () => {
    const p = projectConclusions(
      doss([mesure, conclusion], [src({ provenanceKind: "UNKNOWN" })]),
      "COUNSEL_INVESTOR",
      index,
    );
    expect(p.conclusions).toEqual([]);
    expect(p.state).toBe("NO_GOVERNED_CONCLUSION");
  });

  it("MUTANT CAUSAL — claim source absente, ligne intacte ⇒ conclusion ABSENTE", () => {
    const p = projectConclusions(doss([conclusion]), "COUNSEL_INVESTOR", index);
    expect(p.conclusions).toEqual([]);
  });
});
