// ─── CC-OFFLINE-266 · F2 — LE TITRE ORPHELIN ───────────────────────────────
//
// ██  UN TITRE ET LE CONTENU QUI LE SUIT DOIVENT RESTER ENSEMBLE.           ██
//
// L'artefact VINE de régression portait `AUDIT INFORMATION` seul au bas de la
// page 2, son corps reporté page 3. Un lecteur y voyait une rubrique sans
// contenu, puis un contenu sans rubrique. Défaut de rendu humain, borné.
//
// ⛔ LA RÈGLE EST GÉNÉRIQUE. Elle ne nomme ni `Audit information`, ni VINE, ni
//    un numéro de page, ni un nombre de claims. Ces témoins tiennent cette
//    propriété — et tiennent surtout que RIEN D'AUTRE n'a bougé.

import { describe, it, expect } from "vitest";
import { renderGovernedCaseFileHtml } from "@/lib/casefile/governedCaseFileRenderer";
import type { AudienceScopedCaseFile, ProjectedClaim } from "@/lib/casefile/audienceProjection";
import type { AssembledSource } from "@/lib/casefile/authorityAssembly";
import { codeSeul } from "./codeSeul";

const T = "2026-09-17T10:00:00.000Z";

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

const CONCLUSION = claim({
  claimId: "C-CONCLUSION", rowNature: "INFERENCE", title: "Une conclusion",
  evidenceRefs: [], citedSources: [],
  dependencies: [{ dependentClaimId: "C-CONCLUSION", dependentVersion: 1, sourceClaimId: "C-OBS", sourceVersion: 1, kind: "DERIVED_FROM" }],
});

const projection = (claims: ProjectedClaim[]): AudienceScopedCaseFile => ({
  subject: { ref: "IL-SUJET-001", codename: "SUJET", ticker: "$SUJET", title: "Un dossier" },
  audience: "COUNSEL_INVESTOR",
  claims,
  state: claims.length === 0 ? "NO_GOVERNED_CLAIM" : "GOVERNED_CLAIMS",
});

const COMPLET = projection([claim(), CONCLUSION]);

/** Le corps du document, sans sa feuille de style. */
const corpsDe = (html: string) => html.slice(html.indexOf("</style>"));
/** La feuille de style seule. */
const styleDe = (html: string) =>
  html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>"));

describe("F2 · la règle existe, et elle est GÉNÉRIQUE", () => {
  const style = styleDe(renderGovernedCaseFileHtml(COMPLET, T));

  it("un titre ne peut pas être suivi d'une coupure de page", () => {
    expect(style).toMatch(/break-after\s*:\s*avoid/);
    // L'alias historique, pour les moteurs qui ne lisent pas encore le moderne.
    expect(style).toMatch(/page-break-after\s*:\s*avoid/);
  });

  it("la règle s'applique à TOUS les niveaux de titre, pas à un seul", () => {
    const regle = style.split("\n").find((l) => l.includes("break-after:avoid")) ?? "";
    for (const niveau of ["h1", "h2", "h3"]) expect(regle, niveau).toContain(niveau);
  });

  it("⛔ RIEN n'est codé en dur — ni section, ni sujet, ni page, ni cardinalité", () => {
    // Le titre « Audit information » est rendu, mais la règle de pagination ne
    // le nomme jamais : elle ne connaît que des balises.
    const regles = style.split("\n").filter((l) => l.includes("break-after"));
    expect(regles.length).toBeGreaterThan(0);
    for (const l of regles) {
      for (const m of ["Audit", "VINE", "BOTIFY", "nth-child", "first-of-type", "#"]) {
        expect(l, m).not.toContain(m);
      }
    }
    // Et le fichier n'a acquis AUCUN sélecteur nommant une section.
    const source = codeSeul("src/lib/casefile/governedCaseFileRenderer.ts");
    expect(source).not.toContain("nth-child");
  });
});

describe("F2 · RIEN D'AUTRE n'a bougé — le corps est intact", () => {
  const html = renderGovernedCaseFileHtml(COMPLET, T);
  const corps = corpsDe(html);

  it("le texte des claims est inchangé, mot pour mot", () => {
    expect(corps).toContain("Observation");
    expect(corps).toContain("Ce qui a été observé.");
    expect(corps).toContain("Une conclusion");
  });

  it("l'ORDRE et les CATÉGORIES sémantiques sont inchangés", () => {
    // Sur les TITRES de section, pas sur des chaînes libres : « Governed
    // evidence » apparaît aussi comme étiquette dans chaque trace de fondement.
    const titres = [...corps.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1]);
    expect(titres).toEqual([
      "Governed observations",
      "Governed conclusions",
      "Governed evidence",
      "Audit information",
    ]);
    expect(corps).not.toContain("What could not be established");
  });

  it("fondement, evidence, dépendance et publication sont intacts", () => {
    expect(corps).toContain("Foundation trace");
    expect(corps).toContain("C-OBS");
    expect(corps).toContain("PRIMARY_OBSERVATION");
    expect(corps).toContain("b".repeat(20));          // le sceau
    expect(corps).toContain("a".repeat(20));          // le digest de la pièce
    expect(corps).toContain("OPERATOR_DECLARED");
    expect(corps).toContain("Consumed governed assertions");
    expect(corps).toContain("DERIVED_FROM");
    expect(corps).toContain("COUNSEL_INVESTOR");
  });

  it("la correction vit ENTIÈREMENT dans la feuille de style", () => {
    // Le corps ne porte aucun attribut de pagination : aucun style en ligne,
    // aucune classe ajoutée, aucun élément d'habillage.
    expect(corps).not.toContain("break-after");
    expect(corps).not.toContain("page-break");
    expect(corps).not.toContain("style=");
  });

  it("aucun verdict global ni score n'est réapparu", () => {
    for (const mot of ["UNDETERMINED", "AVOID", "SAFE", "WARNING", "score", "/100"]) {
      expect(html, mot).not.toContain(mot);
    }
  });

  it("le rendu reste DÉTERMINISTE", () => {
    expect(renderGovernedCaseFileHtml(COMPLET, T)).toBe(renderGovernedCaseFileHtml(COMPLET, T));
  });
});
