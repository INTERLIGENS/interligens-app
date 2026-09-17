// ─── CC-OFFLINE-244 · CF-3 — L'ARTEFACT GOUVERNÉ ───────────────────────────
//
// ██  UN RENDERER PRÉSENTE DES AUTORITÉS.                                  ██
// ██  IL NE FABRIQUE PAS UNE AUTORITÉ PAR CALCUL LOCAL.                    ██

import { describe, it, expect } from "vitest";
import { renderGovernedCaseFileHtml } from "@/lib/casefile/governedCaseFileRenderer";
import type { AudienceScopedCaseFile, ProjectedClaim } from "@/lib/casefile/audienceProjection";
import type { AssembledSource } from "@/lib/casefile/authorityAssembly";
import { codeSeul } from "./codeSeul";

const T = "2026-09-16T12:00:00.000Z";

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

const MESURE = claim({
  claimId: "C-MESURE", title: "Bounded measurement",
  description: "Aucune attribution fondée n'a été trouvée dans le périmètre mesuré.",
  citedSources: [piece({ sourceId: "SRC-MES", provenanceKind: "MACHINE_MEASURED", declaredBy: "instrument:un-instrument@1.0.0", sourceLocator: "r2://bucket/obj.json" })],
  evidenceRefs: ["SRC-MES"],
});

const CONCLUSION = claim({
  claimId: "C-CONCLUSION", rowNature: "INFERENCE", title: "Governed conclusion",
  description: "Le corpus gouverné ne permet pas de l'établir.",
  evidenceRefs: [], citedSources: [],
  dependencies: [{ dependentClaimId: "C-CONCLUSION", dependentVersion: 1, sourceClaimId: "C-MESURE", sourceVersion: 1, kind: "DERIVED_FROM" }],
});

describe("CF-3 · le renderer PRÉSENTE, il ne fabrique pas", () => {
  it("le rendu est DÉTERMINISTE — même entrée, même octets", () => {
    const p = projection([claim()]);
    expect(renderGovernedCaseFileHtml(p, T)).toBe(renderGovernedCaseFileHtml(p, T));
  });

  it("l'horloge est un PARAMÈTRE — un renderer qui lirait l'heure ne serait pas reproductible", () => {
    const p = projection([claim()]);
    expect(renderGovernedCaseFileHtml(p, T)).not.toBe(renderGovernedCaseFileHtml(p, "2026-09-17T00:00:00.000Z"));
  });

  it("les sections sont adossées à `rowNature`, jamais à la provenance d'une pièce", () => {
    // CC-OFFLINE-260 — la troisième section, « What could not be established »,
    // a été SUPPRIMÉE : elle dérivait une catégorie ÉPISTÉMIQUE de
    // `MACHINE_MEASURED`, qui ne répond qu'à la question de l'ORIGINE.
    const html = renderGovernedCaseFileHtml(projection([claim(), MESURE, CONCLUSION]), T);
    expect(html).toContain("Governed observations");
    expect(html).toContain("Governed conclusions");
    expect(html).not.toContain("What could not be established");
    expect(html).not.toContain("What we established");
  });

  it("une section SANS autorité n'apparaît pas — ni vide, ni « non établie »", () => {
    const html = renderGovernedCaseFileHtml(projection([claim()]), T);
    expect(html).toContain("Governed observations");
    expect(html).not.toContain("Governed conclusions");
  });

  it("chaque assertion porte son LEVEL 2 — identité, version, sceau, pièces", () => {
    const html = renderGovernedCaseFileHtml(projection([claim()]), T);
    expect(html).toContain("Foundation trace");
    expect(html).toContain("C-OBS");
    expect(html).toContain("b".repeat(20));           // le sceau, tronqué
    expect(html).toContain("a".repeat(20));           // le digest de la pièce
    expect(html).toContain("OPERATOR_DECLARED");
  });

  it("une inférence rend la DÉPENDANCE qu'elle consomme, épinglée en version", () => {
    const html = renderGovernedCaseFileHtml(projection([CONCLUSION]), T);
    expect(html).toContain("Consumed governed assertions");
    expect(html).toContain("DERIVED_FROM");
    expect(html).toContain("C-MESURE");
  });

  it("une mesure rend l'IDENTITÉ DE SON INSTRUMENT et son localisateur", () => {
    const html = renderGovernedCaseFileHtml(projection([MESURE]), T);
    expect(html).toContain("instrument:un-instrument@1.0.0");
    expect(html).toContain("r2://bucket/obj.json");
    expect(html).toContain("MACHINE_MEASURED");
  });
});

describe("CF-3 · MUTANTS — ce que le renderer refuse de produire", () => {
  it("MUTANT · aucune claim → une CARDINALITÉ, jamais un verdict", () => {
    const html = renderGovernedCaseFileHtml(projection([]), T);
    expect(html).toContain("No governed claim");
    for (const mot of ["UNDETERMINED", "AVOID", "SAFE", "WARNING", "SCAM", "CONCENTRATION_RISK"]) {
      expect(html, mot).not.toContain(mot);
    }
  });

  it("MUTANT · AUCUN score n'apparaît, sous aucune forme", () => {
    const html = renderGovernedCaseFileHtml(projection([claim(), MESURE, CONCLUSION]), T);
    for (const mot of ["/100", "TigerScore", "tigerScore", "riskScore", "score"]) {
      expect(html, mot).not.toContain(mot);
    }
  });

  it("MUTANT · le contenu rendu vient EXCLUSIVEMENT de la projection", () => {
    // Rien n'est ajouté : tout titre présent dans le rendu vient d'une claim.
    const html = renderGovernedCaseFileHtml(projection([claim({ title: "TITRE-UNIQUE-XYZ" })]), T);
    expect(html).toContain("TITRE-UNIQUE-XYZ");
    const sansClaim = renderGovernedCaseFileHtml(projection([]), T);
    expect(sansClaim).not.toContain("TITRE-UNIQUE-XYZ");
  });

  it("MUTANT · le HTML est ÉCHAPPÉ — une claim ne peut pas injecter de balise", () => {
    const html = renderGovernedCaseFileHtml(
      projection([claim({ title: "<script>alert(1)</script>" })]),
      T,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("MUTANT · l'audience rendue est celle de la projection, jamais devinée", () => {
    const p = { ...projection([claim()]), audience: "PUBLIC" as const };
    expect(renderGovernedCaseFileHtml(p, T)).toContain("PUBLIC");
  });
});

describe("CF-3 · ce que le renderer n'a AUCUN moyen de faire", () => {
  const source = codeSeul("src/lib/casefile/governedCaseFileRenderer.ts");

  it("aucune relecture de base, aucun preset, aucune prose de secours", () => {
    for (const interdit of [
      "prisma", "loadCaseByMint", "loadCanonicalCaseFile", "MINT_TO_CASE",
      "computeScore", "PRESET_SECTIONS", "buildBotifyInput", "buildVineInput",
      "bodyMarkdown", "keyWallets", "SmokingGun", "off_chain",
    ]) {
      expect(source, interdit).not.toContain(interdit);
    }
  });

  it("aucun `any` — le vecteur par lequel la prose revenait (CF-0)", () => {
    expect(source).not.toMatch(/\bas any\b/);
    expect(source).not.toMatch(/:\s*any\b/);
  });

  it("le vocabulaire RC est respecté — aucune sur-affirmation juridique", () => {
    for (const interdit of [
      "eIDAS", "qualified timestamp", "qualified electronic",
      "court admissible", "judicially admissible", "legally guaranteed",
      "recevabilité judiciaire",
    ]) {
      expect(source, interdit).not.toContain(interdit);
    }
  });

  it("SUBJECT-AGNOSTIC — aucun sujet en dur", () => {
    for (const litteral of ["IL-SHILL-VINE", "VINE-MULTI", "VINE-MEASURE", "VINE-CONCLUSION", "SRC-MEASURE", "BOTIFY"]) {
      expect(source, litteral).not.toContain(litteral);
    }
  });
});

describe("CF-3 · la trace est VISIBLE dans l'artefact imprimé", () => {
  it("aucun `<details>` — un moteur d'impression le rendrait REPLIÉ", () => {
    // La trace de fondement aurait disparu du PDF tout en restant dans la
    // source : présente pour un grep, invisible pour un lecteur.
    const html = renderGovernedCaseFileHtml(projection([claim()]), T);
    expect(html).not.toContain("<details");
    expect(html).not.toContain("<summary");
    expect(html).toContain("Foundation trace");
  });
});
