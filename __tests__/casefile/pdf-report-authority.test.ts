// ─── BUILD 10 · P3 — LE PDF CASEFILE CESSE DE PUBLIER LE CORPUS LEGACY ─────
//
// Doctrine ratifiée :
//
//   « LEGACY_SCORING_INPUT ne doit alimenter ni claims, ni evidence, ni API,
//     ni UI, ni PDF, ni export CaseFile. »
//
//   « Un artefact admin ou d'export n'est pas exempt des gates de publication
//     lorsqu'il est conçu pour devenir un artefact externe. Admin-only
//     contrôle QUI PEUT PRODUIRE l'artefact. Cela ne gouverne pas CE QUE
//     L'ARTEFACT PEUT PUBLIER. »
//
// ─── Ce que ces tests prouvent ────────────────────────────────────────────
//
// 1. le PDF ne lit plus l'autorité legacy — ni directement, ni via le scan
// 2. il ne PRÉSENTE plus le score legacy, parce qu'il ne peut pas le faire
//    honnêtement à côté de claims canoniques
// 3. le scoring n'a pas bougé : `/api/scan/solana` n'est pas touché

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ROUTE = "src/app/api/report/casefile/route.ts";
const RENDER = "src/components/pdf/pdfRenderer.ts";
const SCAN = "src/app/api/scan/solana/route.ts";

const codeSeul = (chemin: string): string =>
  readFileSync(chemin, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return (
        !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("<!--")
      );
    })
    .join("\n");

const route = codeSeul(ROUTE);
const render = codeSeul(RENDER);

// ═══ 1 · L'autorité legacy ne nourrit plus le PDF ════════════════════════

describe("P3 — le PDF CaseFile lit l'autorité canonique", () => {
  it("MUTANT — le `require` du JSON legacy a disparu", () => {
    expect(route).not.toContain("botify.json");
    expect(route).not.toContain("_raw_claims");
  });

  it("les claims viennent de la projection canonique", () => {
    expect(route).toContain("loadPublicProjection(ref,");
    expect(route).toContain("casefile.off_chain.claims = dossier.claims.map");
  });

  it("`off_chain.source` déclare l'autorité servie", () => {
    expect(route).toContain('casefile.off_chain.source = "canonical"');
  });

  it("MUTANT — aucun repli vers le corpus du scan si le dossier est absent", () => {
    // Se rabattre sur `off_chain.claims` tel que le scan l'a rempli
    // republierait le corpus legacy par la porte de derrière.
    expect(route).toContain('casefile.off_chain.source = "none"');
    expect(route).toContain("casefile.off_chain.claims = []");
  });

  it("seules les pièces PUBLIABLES sont listées", () => {
    // La projection ne rend que celles qui portent empreinte, origine et
    // capture — la route ne les re-filtre pas, elle n'en fabrique pas non plus.
    expect(route).toContain("c.provenance.sources.map((s) => s.sourceId)");
  });

  it("les variantes FR viennent du canonique, pas d'un enrichissement", () => {
    expect(route).toContain("c.titleFr");
    expect(route).toContain("c.descriptionFr");
    expect(render).not.toContain("title_fr");
    expect(render).not.toContain("description_fr");
  });
});

// ═══ 2 · Le score n'est plus PRÉSENTÉ ════════════════════════════════════

describe("P3 — le score legacy est retiré du document, pas recalculé", () => {
  it("MUTANT — le renderer ne rend plus `risk.score` ni `risk.tier`", () => {
    expect(render).not.toContain("risk.score");
    expect(render).not.toContain("risk.tier");
  });

  it("MUTANT — la phrase qui affirmait la dérivation a disparu", () => {
    // Elle rendait « score : pénalité × multiplicateur = score » juste sous le
    // nombre de claims. Avec des claims canoniques, c'était une relation fausse.
    expect(render).not.toContain("claim_penalty");
    expect(render).not.toContain("severity_multiplier");
    expect(render).toContain("t.claimsSubtitle(off_chain.claims.length)");
  });

  it("MUTANT — le dénominateur `/ 8` en dur a disparu", () => {
    // 8 était la taille du corpus legacy, figée dans le gabarit.
    expect(render).not.toContain("claims.length} / 8");
  });

  it("le retrait est SIGNALÉ, et il nomme le champ", () => {
    expect(render).toContain("t.withheldLabel");
    expect(render).toContain("t.withheldScore");
    for (const p of ["src/lib/i18n/en.ts", "src/lib/i18n/fr.ts"]) {
      expect(readFileSync(p, "utf8"), p).toContain("off_chain.source");
    }
  });

  it("MUTANT DE SUR-CORRECTION — rien n'est remplacé par 0 ni par null", () => {
    // Retirer n'est pas fabriquer. Un score affiché à 0 serait la coercition
    // « absence → rassurance » que P0 a fermée, réintroduite par la porte du
    // rendu.
    const bloc = render.slice(render.indexOf("t.riskScore"), render.indexOf("t.status"));
    expect(bloc).not.toMatch(/>\s*0\s*</);
    expect(bloc).not.toContain("null");
    expect(bloc).not.toContain("N/A");
  });

  it("aucune méthodologie n'est inventée pour remplacer le score", () => {
    expect(render).not.toContain("computeTigerScore");
    expect(render).not.toContain("computeScore");
  });
});

// ═══ 3 · Le scoring n'a pas bougé ════════════════════════════════════════

describe("P3 — `/api/scan/solana` n'est pas touché", () => {
  const scan = codeSeul(SCAN);

  it("les deux scoreurs lisent toujours `rawClaims`, jamais `off_chain.claims`", () => {
    expect(scan).toContain("const rawClaims = caseFile?.claims ?? [];");
    expect(scan).toContain("const scoring = computeScore(rawClaims);");
    expect(scan).toContain("no_casefile: !caseFile,");
    expect(scan).toContain("confirmedCriticalClaims: rawClaims.filter(");
  });

  it("MUTANT — aucun scoreur ne prend `off_chain.claims` en entrée", () => {
    // C'est ce qui rend la substitution mécanique : le champ substitué n'est
    // lu par aucun calcul.
    const appels = [
      scan.slice(scan.indexOf("computeScore("), scan.indexOf("computeScore(") + 60),
      scan.slice(scan.indexOf("computeTigerScoreFromScan("), scan.indexOf("emitScanCompleted")),
    ];
    for (const a of appels) expect(a).not.toContain("off_chain.claims");
  });

  it("le fichier de scan est INCHANGÉ par ce lot", () => {
    // Périmètre ratifié : deux fichiers gelés, pas trois.
    expect(scan).toContain("computeTigerScoreFromScan({");
    expect(scan).not.toContain("loadPublicProjection");
  });
});
