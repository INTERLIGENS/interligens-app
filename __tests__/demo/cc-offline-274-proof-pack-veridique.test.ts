// ─── CC-OFFLINE-274 · P0-E — VÉRACITÉ DU PROOF PACK PUBLIC ─────────────────
//
// ██  UN CONTRÔLE ACTIF EST UNE PROMESSE DE LIVRAISON.                      ██
// ██  PUBLIC ≠ COUNSEL_INVESTOR.                                            ██
//
// L'autorité PUBLIC courante ne délivre PAS : les dossiers sont
// COUNSEL_INVESTOR / FOUNDATION et `PUBLIC = 0`. `no_public_casefile` est un
// REFUS ATTENDU — et ces témoins tiennent que l'UI le DIT au lieu de promettre.
//
// ⛔ CE LOT N'OUVRE NI B1 NI B2. Aucun `publishStatus` touché, aucune claim
//    promue, aucun anonyme routé vers `COUNSEL_INVESTOR`, aucun repli legacy.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * Le CODE seul. Ces témoins parlent de ce que le produit FAIT, pas de la prose
 * qui explique ce qu'il faisait — sans quoi l'explication du défaut deviendrait
 * elle-même une régression. (JSX compris : `{/* … *\/}`.)
 */
const sansCommentaires = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
const PAGES = ["src/app/en/demo/page.tsx", "src/app/fr/demo/page.tsx"] as const;

// ═══ LE CONTRÔLE CASEFILE ═══════════════════════════════════════════════════
//
// CC-OFFLINE-274 avait RETIRÉ le contrôle, faute de lease sur le composant.
// CC-OFFLINE-280, sous lease accordée, livre le comportement PRÉFÉRÉ : il est
// VISIBLE, DÉSACTIVÉ, et il porte sa raison.

describe("P0-E · OPEN CASEFILE / DOWNLOAD — visible, désactivé, et vrai", () => {
  const CTA = lire("src/components/CaseFileCTA.tsx");

  it("le composant EXIGE `available` — aucun défaut permissif", () => {
    expect(CTA).toContain("available: boolean;");
    expect(CTA).not.toMatch(/available\s*=\s*true/);
    expect(CTA).not.toMatch(/available\s*\?\?\s*true/);
  });

  it("les DEUX actions refusent d'agir quand l'artefact n'est pas délivrable", () => {
    expect(CTA).toContain("const handleOpen = () => {\n    if (!id || !available) return;");
    expect(CTA).toContain("const handleDownload = async () => {\n    if (!id || !available) return;");
    expect(CTA).toContain("const disabled = !id || loading || !available;");
  });

  it("⛔ M6 — aucun FAUX SUCCÈS, et aucun faux diagnostic de panne", () => {
    // « PDF generation failed » reste pour un ÉCHEC RÉEL de génération. Il ne
    // décrit plus un refus d'autorité : le visiteur n'a jamais été autorisé,
    // rien n'a échoué à se générer.
    expect(CTA).toContain("No public case file is available for this address.");
    expect(CTA).toContain("Aucun dossier public n'est disponible pour cette adresse.");
    expect(CTA).toContain("{!available && (");
  });

  it("le libellé statique inconditionnel « Detective Referenced » a DISPARU", () => {
    // Il s'affichait sous TOUS les dossiers, quelle que soit l'autorité.
    expect(CTA).not.toContain("Detective Referenced");
    expect(CTA).not.toContain("Référencé détective");
    expect(CTA).not.toContain("detective:");
  });

  it("⛔ le renderer n'INVENTE aucune raison — il n'en connaît qu'une, et elle lui est DONNÉE", () => {
    const code = sansCommentaires(CTA);
    // Aucune sonde, aucune heuristique, aucune dérivation locale d'autorité.
    for (const m of ["publishStatus", "COUNSEL", "template=governed"]) {
      expect(code, m).not.toContain(m);
    }
  });

  for (const p of PAGES) {
    it(`${p} — le contrôle est MONTÉ et déclaré indisponible`, () => {
      const code = sansCommentaires(lire(p));
      expect(code).toMatch(/<CaseFileCTA[^>]*available=\{false\}/);
      expect(code).toContain('import CaseFileCTA from "@/components/CaseFileCTA";');
    });
  }
});

// ═══ LE CONTRÔLE PDF REPORT ═════════════════════════════════════════════════

describe("P0-E · PDF REPORT — le no-op muet est fermé", () => {
  for (const p of PAGES) {
    const s = lire(p);

    it(`${p} — le bouton n'appelle plus une route qui rend 401`, () => {
      // Mesuré en anonyme sur le runtime servi : /api/report/v2 → 401.
      expect(s).not.toContain("/api/report/v2?mint=");
    });

    it(`${p} — ⛔ plus aucun \`if (!res.ok) return;\` dans le Proof Pack`, () => {
      // Le motif exact du clic sans effet : indiscernable d'une panne.
      const code = sansCommentaires(s);
      const i = code.indexOf("Proof Pack");
      expect(i).toBeGreaterThan(-1);
      const bloc = code.slice(i, i + 4000);
      expect(bloc).not.toContain("if (!res.ok) return;");
    });

    it(`${p} — le contrôle est DÉSACTIVÉ et il DIT pourquoi`, () => {
      const i = s.indexOf("Proof Pack");
      const bloc = s.slice(i, i + 4000);
      expect(bloc).toContain("disabled");
      expect(bloc).toMatch(/title="[^"]*(unavailable|indisponible)[^"]*"/);
      expect(bloc).toContain("cursor-not-allowed");
    });
  }
});

// ═══ LE CONTRÔLE EVIDENCE ═══════════════════════════════════════════════════

describe("P0-E · EVIDENCE — ce n'est pas l'evidence d'un CaseFile gouverné", () => {
  for (const [p, attendu, ancien] of [
    ["src/app/en/demo/page.tsx", "Scan Telemetry", "Evidence"],
    ["src/app/fr/demo/page.tsx", "Télémétrie du scan", "Preuves"],
  ] as const) {
    it(`${p} — le libellé nomme ce qui est réellement montré`, () => {
      const s = lire(p);
      const i = s.indexOf("Proof Pack");
      const bloc = s.slice(i, i + 4000);
      // RPC, spenders, contreparties, autorités mint/freeze, cache_hit : de la
      // TÉLÉMÉTRIE DE SCAN. Aucune provenance, aucun digest n'y est ajouté.
      expect(bloc).toContain(attendu);
      expect(bloc.split(">\n                    " + ancien + "\n")).toHaveLength(1);
    });
  }
});

// ═══ M7 · L'AUTORITÉ N'A PAS ÉTÉ AFFAIBLIE ══════════════════════════════════

describe("P0-E · M7 — aucun CaseFile COUNSEL_INVESTOR exposé publiquement", () => {
  const tout = sansCommentaires(PAGES.map(lire).join("\n"));

  it("aucun contournement vers la surface counsel n'a été introduit", () => {
    for (const interdit of [
      "template=governed",
      "COUNSEL_INVESTOR",
      "x-admin-token",
      "ADMIN_TOKEN",
      "/api/casefile/pdf",
    ]) {
      expect(tout, interdit).not.toContain(interdit);
    }
  });

  it("aucune autorité de publication n'est touchée", () => {
    for (const interdit of ["publishStatus", "decidePublication", "PUBLIC_GRANT", "state = 'PUBLIC'"]) {
      expect(tout, interdit).not.toContain(interdit);
    }
  });

  it("le constructeur d'URL publique est INCHANGÉ", () => {
    const url = lire("src/lib/report/casefileUrl.ts");
    expect(url).toContain("/api/casefile/public?mint=");
    expect(url).not.toContain("governed");
  });
});
