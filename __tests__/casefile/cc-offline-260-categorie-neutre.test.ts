// ─── CC-OFFLINE-260 · SUPPRESSION D'UNE FAUSSE CATÉGORIE ───────────────────
//
// ██  PROVENANCE KIND ≠ CLAIM SEMANTICS.                                    ██
// ██  A MACHINE-MEASURED PIECE IS NOT A NEGATIVE FINDING.                   ██
//
// ⚠️ LE COUPLE DÉCISIF est D + E. Ensemble, et seulement ensemble, ils
// démontrent que la catégorie de présentation suit la CLASSIFICATION GOUVERNÉE
// (`rowNature`) et non l'ORIGINE DE LA PIÈCE (`provenanceKind`) :
//
//   D  muter la provenance          → la catégorie NE BOUGE PAS
//   E  muter la classification      → la catégorie BOUGE
//
// Pris isolément, chacun est compatible avec un renderer qui aurait simplement
// changé de mauvaise règle.

import { describe, it, expect } from "vitest";
import { renderGovernedCaseFileHtml } from "@/lib/casefile/governedCaseFileRenderer";
import type { AudienceScopedCaseFile, ProjectedClaim } from "@/lib/casefile/audienceProjection";
import type { AssembledSource } from "@/lib/casefile/authorityAssembly";
import { JOURNAL_PROVENANCE_KINDS } from "@/lib/casefile/journalProvenance";
import { codeSeul } from "./codeSeul";

const T = "2026-09-17T09:00:00.000Z";

const piece = (o: Partial<AssembledSource> = {}): AssembledSource => ({
  sourceId: "SRC-001", sourceType: "osint_x_search", caption: null,
  capturedAt: "2026-09-16", sourceUrl: "https://x.com/e/1", sha256: "a".repeat(64),
  snapshotLinked: true, provenanceKind: "OPERATOR_DECLARED", journalId: "7",
  sourceLocator: "https://x.com/e/1", declaredBy: "Un Opérateur", ...o,
});

const claim = (o: Partial<ProjectedClaim> = {}): ProjectedClaim => ({
  claimId: "C-OBS", version: 1, rowNature: "PRIMARY_OBSERVATION", title: "Observation",
  titleFr: null, description: "Ce qui a été observé.", descriptionFr: null,
  category: null, severity: null, status: null, claimDate: null, state: "ATTACHED",
  evidenceRefs: ["SRC-001"], contentHash: "b".repeat(64),
  admittedBy: "COUNSEL_INVESTOR", citedSources: [piece()], dependencies: [], ...o,
});

const projection = (claims: ProjectedClaim[]): AudienceScopedCaseFile => ({
  subject: { ref: "IL-SUJET-001", codename: "SUJET", ticker: "$SUJET", title: "Un dossier" },
  audience: "COUNSEL_INVESTOR",
  claims,
  state: claims.length === 0 ? "NO_GOVERNED_CLAIM" : "GOVERNED_CLAIMS",
});

/** La mesure INSTRUMENTÉE — la pièce qui déclenchait la fausse catégorie. */
const MESUREE = piece({
  sourceId: "SRC-MEASURE-01", provenanceKind: "MACHINE_MEASURED",
  sourceLocator: "r2://bucket/obj.json",
  declaredBy: "instrument:un-instrument@1.0.0",
});

/** BOTIFY — une mesure POSITIVE. C'est elle qui a révélé le défaut. */
const BOTIFY = claim({
  claimId: "BOTIFY-EVENTS-01", rowNature: "PRIMARY_OBSERVATION",
  title: "Bounded measurement: recorded event rows and distinct walletAddress values",
  description: "A bounded measurement of the governed corpus recorded 262 event rows…",
  citedSources: [MESUREE], evidenceRefs: ["SRC-MEASURE-01"],
});

/** VINE — une mesure NÉGATIVE, même provenance, même rowNature. */
const VINE_MESURE = claim({
  claimId: "VINE-MEASURE-01", rowNature: "PRIMARY_OBSERVATION",
  title: "Bounded measurement: no founded actor-wallet attribution found",
  description: "Aucune attribution fondée n'a été trouvée dans le périmètre mesuré. Causes : NO_FOUNDED_ACTOR_WALLET_ATTRIBUTION.",
  citedSources: [MESUREE], evidenceRefs: ["SRC-MEASURE-01"],
});

const VINE_CONCLUSION = claim({
  claimId: "VINE-CONCLUSION-01", rowNature: "INFERENCE",
  title: "Governed conclusion", description: "Le corpus gouverné ne permet pas de l'établir.",
  evidenceRefs: [], citedSources: [],
  dependencies: [{ dependentClaimId: "VINE-CONCLUSION-01", dependentVersion: 1, sourceClaimId: "VINE-MEASURE-01", sourceVersion: 1, kind: "DERIVED_FROM" }],
});

/** Sous quel titre de section une claim est-elle rendue ? */
const categorieDe = (c: ProjectedClaim): "OBSERVATIONS" | "CONCLUSIONS" | "AUCUNE" => {
  const html = renderGovernedCaseFileHtml(projection([c]), T);
  if (!html.includes(c.title)) return "AUCUNE";
  return html.includes("Governed conclusions") ? "CONCLUSIONS" : "OBSERVATIONS";
};

// ═══ A · BOTIFY — LE SUJET QUI A RÉVÉLÉ LE DÉFAUT ═══════════════════════════

describe("A · MUTANT — BOTIFY · PRIMARY_OBSERVATION + MACHINE_MEASURED", () => {
  it("est rendu sous GOVERNED OBSERVATIONS, jamais sous « what could not be established »", () => {
    const html = renderGovernedCaseFileHtml(projection([BOTIFY]), T);
    expect(html).toContain("Governed observations");
    expect(html).not.toContain("What could not be established");
    expect(html).not.toContain("what was not found");
    expect(categorieDe(BOTIFY)).toBe("OBSERVATIONS");
  });

  it("aucune interprétation n'est ajoutée au-dessus de l'assertion", () => {
    const html = renderGovernedCaseFileHtml(projection([BOTIFY]), T);
    for (const mot of [
      "positive", "negative", "established", "not established",
      "proceeds", "sale", "sold", "seller", "cash-out",
    ]) {
      expect(html.toLowerCase(), mot).not.toContain(mot.toLowerCase());
    }
  });
});

// ═══ B · VINE-MEASURE-01 — MÊME CATÉGORIE, SENS PRÉSERVÉ ════════════════════

describe("B · MUTANT — VINE-MEASURE-01 tombe dans la MÊME catégorie neutre", () => {
  it("la mesure négative et la mesure positive partagent la catégorie", () => {
    expect(categorieDe(VINE_MESURE)).toBe("OBSERVATIONS");
    expect(categorieDe(VINE_MESURE)).toBe(categorieDe(BOTIFY));
  });

  it("le sens NÉGATIF de VINE survit — il vient de l'ASSERTION, pas de la provenance", () => {
    const html = renderGovernedCaseFileHtml(projection([VINE_MESURE]), T);
    expect(html).toContain("Aucune attribution fondée n&#39;a été trouvée");
    expect(html).toContain("NO_FOUNDED_ACTOR_WALLET_ATTRIBUTION");
  });
});

// ═══ C · L'INFÉRENCE RESTE UNE CONCLUSION ═══════════════════════════════════

describe("C · MUTANT — VINE-CONCLUSION-01 · INFERENCE ⇒ GOVERNED CONCLUSIONS", () => {
  it("rowNature INFERENCE est une classification gouvernée, et elle gouverne", () => {
    expect(categorieDe(VINE_CONCLUSION)).toBe("CONCLUSIONS");
  });

  it("les deux catégories coexistent sans se contaminer", () => {
    const html = renderGovernedCaseFileHtml(projection([BOTIFY, VINE_MESURE, VINE_CONCLUSION]), T);
    expect(html).toContain("Governed observations");
    expect(html).toContain("Governed conclusions");
    expect(html).toContain("Consumed governed assertions");
    expect(html).toContain("DERIVED_FROM");
  });
});

// ═══ D + E · LE COUPLE CAUSALEMENT DÉCISIF ══════════════════════════════════

describe("D · MUTANT — muter `provenanceKind` NE CHANGE PAS la catégorie", () => {
  it("les QUATRE qualifications du domaine rendent la MÊME catégorie", () => {
    for (const kind of JOURNAL_PROVENANCE_KINDS) {
      const mute = claim({ ...BOTIFY, citedSources: [piece({ ...MESUREE, provenanceKind: kind })] });
      expect(categorieDe(mute), kind).toBe("OBSERVATIONS");
    }
  });

  it("le rendu est IDENTIQUE hors la ligne de provenance — rien d'autre n'en dépend", () => {
    const rendu = (kind: string) =>
      renderGovernedCaseFileHtml(
        projection([claim({ ...BOTIFY, citedSources: [piece({ ...MESUREE, provenanceKind: kind })] })]),
        T,
      ).split("MACHINE_MEASURED").join("⟦k⟧").split(kind).join("⟦k⟧");
    expect(rendu("VERIFIED")).toBe(rendu("MACHINE_MEASURED"));
    expect(rendu("OPERATOR_DECLARED")).toBe(rendu("MACHINE_MEASURED"));
  });

  it("une claim SANS aucune pièce citée est rendue dans la même catégorie", () => {
    // L'inférence exceptée, l'absence de pièce ne fabrique aucune catégorie.
    expect(categorieDe(claim({ citedSources: [], evidenceRefs: [] }))).toBe("OBSERVATIONS");
  });
});

describe("E · MUTANT — muter `rowNature` CHANGE la catégorie", () => {
  it("PRIMARY_OBSERVATION → INFERENCE fait basculer la MÊME claim", () => {
    const observation = claim({ ...BOTIFY, rowNature: "PRIMARY_OBSERVATION" });
    const inference = claim({ ...BOTIFY, rowNature: "INFERENCE" });
    expect(categorieDe(observation)).toBe("OBSERVATIONS");
    expect(categorieDe(inference)).toBe("CONCLUSIONS");
  });

  it("INFERENCE → PRIMARY_OBSERVATION fait basculer en sens inverse", () => {
    expect(categorieDe(claim({ ...VINE_CONCLUSION, rowNature: "PRIMARY_OBSERVATION" }))).toBe("OBSERVATIONS");
  });

  it("toute rowNature non-INFERENCE est une OBSERVATION — aucune n'a de sort particulier", () => {
    for (const nature of ["PRIMARY_OBSERVATION", "DERIVED_METRIC", "ESTIMATE", "OPERATOR_DECLARED"]) {
      expect(categorieDe(claim({ ...BOTIFY, rowNature: nature })), nature).toBe("OBSERVATIONS");
    }
  });
});

// ═══ AUCUNE HEURISTIQUE DE REMPLACEMENT ═════════════════════════════════════

describe("CC-OFFLINE-260 · la fausse règle n'est pas remplacée par une autre", () => {
  const source = codeSeul("src/lib/casefile/governedCaseFileRenderer.ts");

  it("le renderer ne consulte AUCUN provenanceKind pour catégoriser", () => {
    // `provenanceKind` est encore RENDU — c'est une donnée de la pièce — mais il
    // n'est plus comparé à quoi que ce soit.
    expect(source).not.toContain('=== "MACHINE_MEASURED"');
    expect(source).not.toContain('=== "VERIFIED"');
    expect(source).not.toContain("estMesure");
  });

  it("aucun classifieur de texte, aucune sémantique par regex, aucune branche par sujet", () => {
    for (const interdit of [
      "causes.length", "result ===", "NOT_ESTABLISHED", "ESTABLISHED",
      ".includes(", ".match(", ".test(", "toLowerCase()",
      "VINE", "BOTIFY",
    ]) {
      expect(source, interdit).not.toContain(interdit);
    }
  });

  it("la catégorie ne dépend ni du NOMBRE de pièces ni de leur TYPE", () => {
    const une = claim({ ...BOTIFY, citedSources: [MESUREE] });
    const quatre = claim({
      ...BOTIFY,
      citedSources: [MESUREE, piece({ sourceId: "S2" }), piece({ sourceId: "S3" }), piece({ sourceId: "S4" })],
      evidenceRefs: ["SRC-MEASURE-01", "S2", "S3", "S4"],
    });
    expect(categorieDe(quatre)).toBe(categorieDe(une));
    const autreType = claim({ ...BOTIFY, citedSources: [piece({ ...MESUREE, sourceType: "screenshot" })] });
    expect(categorieDe(autreType)).toBe(categorieDe(une));
  });

  it("la catégorie ne dépend PAS du texte de la claim", () => {
    const a = claim({ ...BOTIFY, title: "Nothing was found anywhere", description: "not established" });
    const b = claim({ ...BOTIFY, title: "Everything was found", description: "established" });
    expect(categorieDe(a)).toBe(categorieDe(b));
  });
});

// ═══ CE QUI N'A PAS BOUGÉ ═══════════════════════════════════════════════════

describe("CC-OFFLINE-260 · l'autorité de fondement est INTACTE", () => {
  it("la trace de fondement reste entière sous chaque assertion", () => {
    const html = renderGovernedCaseFileHtml(projection([BOTIFY, VINE_CONCLUSION]), T);
    expect(html).toContain("Foundation trace");
    expect(html).toContain("BOTIFY-EVENTS-01");
    expect(html).toContain("PRIMARY_OBSERVATION");
    expect(html).toContain("b".repeat(20));                     // le sceau
    expect(html).toContain("a".repeat(20));                     // le digest de la pièce
    expect(html).toContain("MACHINE_MEASURED");                 // la provenance est RENDUE
    expect(html).toContain("instrument:un-instrument@1.0.0");
    expect(html).toContain("r2://bucket/obj.json");
    expect(html).toContain("Governed evidence");
    expect(html).toContain("Audit information");
  });

  it("AUCUNE cardinalité n'est fabriquée — BOTIFY n'a pas à s'excuser d'être minimal", () => {
    // ABSENCE OF PROJECTED CLAIMS ≠ ASSERTION OF ABSENCE.
    const html = renderGovernedCaseFileHtml(projection([BOTIFY]), T);
    for (const mot of [
      "only one", "single governed", "no other", "nothing else",
      "one assertion", "limited to", "sole",
    ]) {
      expect(html.toLowerCase(), mot).not.toContain(mot);
    }
  });

  it("zéro claim reste une CARDINALITÉ, et le vocabulaire de verdict reste absent", () => {
    const html = renderGovernedCaseFileHtml(projection([]), T);
    expect(html).toContain("No governed claim");
    for (const mot of ["UNDETERMINED", "AVOID", "SAFE", "WARNING", "score", "/100"]) {
      expect(html, mot).not.toContain(mot);
    }
  });

  it("aucun `<details>` — la trace reste visible à l'impression", () => {
    const html = renderGovernedCaseFileHtml(projection([BOTIFY]), T);
    expect(html).not.toContain("<details");
    expect(html).not.toContain("<summary");
  });
});
