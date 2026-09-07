// ─── BUILD 9 — LE GATE DES DEUX FIXTURES ───────────────────────────────────
//
//   BOTIFY canonical CaseFile → PDF BOTIFY correct
//   VINE   canonical CaseFile → PDF VINE correct
//   aucun CaseFile            → fail closed
//
// Même autorité, même renderer, même pipeline. Identité correcte, claims et
// provenance corrects, aucune donnée legacy injectée, aucune section fabriquée.
//
// ─── Ce que ces tests surveillent en particulier ──────────────────────────
//
// La FUITE D'UN DOSSIER VERS L'AUTRE. C'est le risque réel d'un renderer
// rendu agnostique : le jour où une section garde une valeur par défaut, elle
// attribue à VINE la concentration de BOTIFY, et le document a l'air complet.
// Un PDF incomplet se voit ; un PDF faussement complet, non.

import { describe, it, expect, vi } from "vitest";

// Le fail-closed se prouve par FIXTURE : on fait dire à l'autorité « je ne
// porte pas ce dossier », et on vérifie que la projection LÈVE au lieu de
// rendre un document vide. Exercer la vraie base ici testerait la base.
vi.mock("@/lib/casefile/canonicalReader", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/lib/casefile/canonicalReader")>();
  return { ...reel, loadCanonicalCaseFile: vi.fn(async () => null) };
});
import {
  buildPublicReportHtml,
  type PublicReportLang,
} from "@/lib/casefile/pdfGeneratorPublic";
import {
  projectForPublication,
  loadPublicProjection,
  CanonicalCaseFileMissingError,
  BOTIFY_CASEFILE_REF,
  VINE_CASEFILE_REF,
} from "@/lib/casefile/publicProjection";
import type { CanonicalCaseFile, PublicClaim } from "@/lib/casefile/canonicalReader";

const dossier = (o: Partial<CanonicalCaseFile>): CanonicalCaseFile => ({
  ref: BOTIFY_CASEFILE_REF,
  codename: "BOTIFY",
  ticker: "$BOTIFY",
  title: "Réseau de KOL coordonnés",
  tigerScore: null,
  verdict: "AVOID",
  claims: [],
  sources: [],
  keyWallets: [],
  ...o,
});

const BOTIFY = dossier({});
const VINE = dossier({
  ref: VINE_CASEFILE_REF,
  codename: "VINE",
  ticker: "$VINE",
  title: "Réseau sybil à opérateur unique",
});

const rendu = (d: CanonicalCaseFile, lang: PublicReportLang = "en"): string =>
  buildPublicReportHtml(lang, projectForPublication(d, "test"));

// ═══ Les deux fixtures rendent, par le même chemin ════════════════════════

describe("GATE — BOTIFY et VINE rendent tous les deux", () => {
  it("BOTIFY rend, avec son identité", () => {
    const html = rendu(BOTIFY);
    expect(html).toContain(BOTIFY_CASEFILE_REF);
    expect(html).toContain("$BOTIFY");
  });

  it("VINE rend — il était REFUSÉ avant", () => {
    // Le refus était le bon réflexe et la mauvaise mécanique : il rendait le
    // renderer inutilisable pour l'une des deux fixtures obligatoires.
    const html = rendu(VINE);
    expect(html).toContain(VINE_CASEFILE_REF);
    expect(html).toContain("$VINE");
    expect(html).toContain("Réseau sybil à opérateur unique");
  });

  it("les deux passent par le MÊME renderer", () => {
    // Aucun chemin parallèle : même fonction, même nombre de pages.
    const pages = (h: string) => h.split('<section class="page">').length - 1;
    expect(pages(rendu(VINE))).toBe(pages(rendu(BOTIFY)));
  });

  it("aucun CaseFile → fail closed, et bruyamment", async () => {
    await expect(
      loadPublicProjection("IL-INEXISTANT-000", "test"),
    ).rejects.toBeInstanceOf(CanonicalCaseFileMissingError);
  });
});

// ═══ Aucune fuite d'un dossier vers l'autre ══════════════════════════════

describe("GATE — le matériel d'un dossier ne migre jamais vers l'autre", () => {
  it("MUTANT — le PDF VINE ne porte AUCUN fait de BOTIFY", () => {
    const html = rendu(VINE);
    for (const fuite of ["BOTIFY", "rugcheck.xyz", "62 %", "78 %", "Solscan holder queries"]) {
      expect(html, fuite).not.toContain(fuite);
    }
  });

  it("le PDF VINE ne porte pas non plus le nom de BOTIFY en français", () => {
    const html = rendu(VINE, "fr");
    for (const fuite of ["BOTIFY", "rugcheck.xyz", "requêtes holders Solscan"]) {
      expect(html, fuite).not.toContain(fuite);
    }
  });

  it("BOTIFY garde ses faits — le retrait n'est pas devenu la règle", () => {
    const html = rendu(BOTIFY);
    expect(html).toContain("rugcheck.xyz");
    expect(html).toContain("Mint authority");
    expect(html).toContain("62 %");
  });
});

// ═══ Ce que VINE rend à la place : un retrait, pas une invention ═════════

describe("GATE — un dossier sans faits statiques les RETIRE, il ne les invente pas", () => {
  it("les sections gardent leur place et nomment le champ manquant", () => {
    const html = rendu(VINE);
    expect(html).toContain("Token Control");
    expect(html).toContain("Launch Metrics");
    expect(html).toContain("Insufficient provenance");
    // Le champ manquant est la SOURCE : sans source nommée, pas de publication.
    expect(html).toContain("source");
  });

  it("le résumé exécutif de VINE n'hérite d'aucune affirmation", () => {
    const html = rendu(VINE);
    expect(html).not.toContain("exhibits multiple high-risk indicators");
    expect(html).not.toContain("Mint and freeze authority remain active");
    // Il garde ce qui est vrai de tout dossier : le décompte et la réserve.
    expect(html).toContain("No referenced claim");
    expect(html).toContain("not a legal determination");
  });

  it("aucune section n'est fabriquée pour combler", () => {
    // Neuf pages des deux côtés, dont les manquantes sont DÉCLARÉES manquantes.
    const html = rendu(VINE);
    expect(html.split("Withheld from publication").length - 1).toBeGreaterThanOrEqual(5);
  });
});

// ═══ La provenance survit, sur les deux dossiers ═════════════════════════

describe("GATE — claims et provenance corrects sur les deux fixtures", () => {
  const claimPublie = (id: string): PublicClaim => ({
    claimId: id, title: "Assertion démontrée", titleFr: null,
    description: null, descriptionFr: null, category: "onchain",
    severity: "HIGH", status: "CONFIRMED", claimDate: "2025-11-04",
    state: "PUBLIC",
    provenance: {
      threadUrl: "https://x.com/exemple/status/1",
      sources: [{
        sourceId: "SRC-001", sourceType: "screenshot", caption: "Fil 1/8",
        capturedAt: "2025-12-07", sourceUrl: "https://x.com/exemple",
        sha256: "c".repeat(64),
      }],
      unresolvedRefs: ["captures TBC"],
    },
  });

  for (const [nom, base] of [["BOTIFY", BOTIFY], ["VINE", VINE]] as const) {
    it(`${nom} — la pièce, sa capture et son empreinte sont rendues`, () => {
      const html = rendu(dossier({ ...base, claims: [claimPublie("C1")] }));
      expect(html, nom).toContain("2025-12-07");
      expect(html, nom).toContain("c".repeat(16));
      expect(html, nom).toContain("SRC-001");
    });

    it(`${nom} — FIXTURE : une référence non résolue est rendue NON RÉSOLUE`, () => {
      // Preuve déterministe du comportement `unresolvedRefs` sur le rendu réel,
      // par une fixture — jamais en rendant un dossier public incomplet.
      const html = rendu(dossier({ ...base, claims: [claimPublie("C1")] }));
      expect(html, nom).toContain("Unresolved reference");
      expect(html, nom).toContain("captures TBC");
      // Et elle n'est PAS comptée comme une pièce.
      expect(html, nom).not.toMatch(/captures TBC[^<]*<\/td>\s*<td class="mono">2025/);
    });
  }
});
