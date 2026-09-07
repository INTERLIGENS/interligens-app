// ─── BUILD 9 / ÉTAPE 5 — UN SEUL RÉGIME DE PUBLICATION ─────────────────────
//
// Les huit gates ratifiés, un par un, sur les surfaces réelles.
//
// Les tests de RENDU passent par le HTML effectivement produit, pas par les
// fonctions de calcul : le défaut corrigé ici — un index de preuves qui
// horodatait chaque pièce au jour de l'export — était invisible depuis les
// données. Il ne vivait que dans le gabarit.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  projectForPublication,
  canonicalRefForMint,
  isPubliableSource,
  renderedScore,
  BOTIFY_CASEFILE_REF,
  VINE_CASEFILE_REF,
  VINE_MINT,
  type PublicProjection,
} from "@/lib/casefile/publicProjection";
import {
  buildPublicReportHtml,
  StaticSectionsMismatchError,
  STATIC_SECTIONS_DOCUMENT_REF,
} from "@/lib/casefile/pdfGeneratorPublic";
import { ProvenanceLostError } from "@/lib/casefile/canonicalReader";
import type {
  CanonicalCaseFile,
  PublicClaim,
  PublicSource,
} from "@/lib/casefile/canonicalReader";
import { BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY } from "@/lib/kol-memory/tokenIdentity";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const CAPTURE_REELLE = "2025-12-07";
const SHA = "b".repeat(64);

const source = (o: Partial<PublicSource> = {}): PublicSource => ({
  sourceId: "SRC-001",
  sourceType: "screenshot",
  caption: "Fil 1/8",
  capturedAt: CAPTURE_REELLE,
  sourceUrl: "https://x.com/exemple/status/1",
  sha256: SHA,
  ...o,
});

const claim = (o: Partial<PublicClaim> = {}): PublicClaim => ({
  claimId: "C1",
  title: "Coordinated posting",
  titleFr: "Publication coordonnée",
  description: null,
  descriptionFr: null,
  category: "social",
  severity: "HIGH",
  status: "CONFIRMED",
  claimDate: "2025-11-04",
  state: "ATTACHED",
  provenance: null,
  ...o,
});

const dossier = (o: Partial<CanonicalCaseFile> = {}): CanonicalCaseFile => ({
  ref: BOTIFY_CASEFILE_REF,
  codename: "BOTIFY",
  ticker: "$BOTIFY",
  title: "Réseau de KOL coordonnés",
  tigerScore: null,
  verdict: "AVOID",
  claims: [],
  sources: [],
  ...o,
});

/** Un claim publié, avec une pièce qui satisfait les trois exigences. */
const claimPublieComplet = (): PublicClaim =>
  claim({
    state: "PUBLIC",
    provenance: {
      threadUrl: "https://x.com/exemple/status/9",
      sources: [source()],
      unresolvedRefs: [],
    },
  });

const codeSeul = (chemin: string): string =>
  readFileSync(chemin, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

/** La page N du rapport, isolée — le pied de page porte la date de génération
 *  sur TOUTES les pages, donc un test d'horodatage doit viser une page. */
const page = (html: string, n: number): string =>
  html.split('<section class="page">')[n];

// ═══ GATE 1 · les trois surfaces lisent l'autorité canonique ═══════════════

describe("GATE 1 — l'autorité canonique est la seule lue", () => {
  it("le générateur public ne lit plus aucun JSON de dossier", () => {
    const code = codeSeul("src/lib/casefile/pdfGeneratorPublic.ts");
    expect(code).not.toContain("data/cases/");
    expect(code).not.toContain("botifyCase");
  });

  it("la route retail charge la projection, et ne résout plus de preset", () => {
    const code = codeSeul("src/app/api/casefile/public/route.ts");
    expect(code).toContain("loadPublicProjection");
    expect(code).not.toContain("kolHandleToCasefilePreset");
    expect(code).not.toContain("MINT_TO_PRESET");
  });

  it("la route PDF tire ses claims de l'autorité pour les DEUX gabarits", () => {
    const code = codeSeul("src/app/api/casefile/pdf/route.ts");
    expect(code).toContain("loadPublicProjection");
    expect(code).toContain("loadCanonicalCaseFile");
    expect(code).toContain("canonical: { ref: dossier.ref, claims: dossier.claims }");
  });

  it("la fiche UI porte le dossier canonique dans son contrat", () => {
    const code = codeSeul("src/components/cases/TokenCasefileView.tsx");
    expect(code).toContain("projection?: PublicProjection");
    expect(code).toContain("CanonicalClaims");
  });
});

// ═══ GATE 2 · aucun repli silencieux ══════════════════════════════════════

describe("GATE 2 — aucun repli silencieux vers une autorité concurrente", () => {
  it("MUTANT — le dossier est un paramètre REQUIS du générateur public", () => {
    // Optionnel, il aurait laissé les deux routes appeler comme avant : le
    // repli serait resté à une ligne de distance.
    const code = codeSeul("src/lib/casefile/pdfGeneratorPublic.ts");
    expect(code).toContain("dossier: PublicProjection");
    expect(code).not.toContain("dossier?: PublicProjection");
  });

  it("les deux routes traitent l'absence de dossier canonique EXPLICITEMENT", () => {
    for (const f of [
      "src/app/api/casefile/public/route.ts",
      "src/app/api/casefile/pdf/route.ts",
    ]) {
      const code = codeSeul(f);
      expect(code, f).toContain("CanonicalCaseFileMissingError");
      expect(code, f).toContain("canonical_casefile_missing");
    }
  });

  it("le rapport interne annonce quand ses claims sortent d'un preset", () => {
    const code = codeSeul("src/lib/casefile/pdfGenerator.ts");
    expect(code).toContain("HORS autorité canonique");
    // Et le preset n'est lu QUE faute de bloc canonique.
    expect(code).toContain("if (!input.canonical && input.new_claims?.length)");
  });
});

// ═══ GATE 3 · un claim PUBLIC exige une provenance RÉSOLUE ════════════════

describe("GATE 3 — publier exige un fondement, résolu", () => {
  it("un claim PUBLIC dont toutes les refs sont non résolues fait LEVER", () => {
    const d = dossier({
      claims: [
        claim({
          state: "PUBLIC",
          provenance: { threadUrl: null, sources: [], unresolvedRefs: ["captures TBC"] },
        }),
      ],
    });
    expect(() => projectForPublication(d, "test")).toThrow(ProvenanceLostError);
  });

  it("une pièce sans empreinte ne publie pas — elle est RETENUE, pas rendue", () => {
    // Les données sont cohérentes ; c'est la publication qui ne l'est pas.
    // C'est exactement la pathologie des 20 captures publiées sans hash.
    const d = dossier({
      claims: [
        claim({
          state: "PUBLIC",
          provenance: {
            threadUrl: null,
            sources: [source({ sha256: null })],
            unresolvedRefs: [],
          },
        }),
      ],
    });
    const p = projectForPublication(d, "test");
    expect(p.claims).toHaveLength(0);
    expect(p.withheld).toEqual([
      { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "sha256", count: 1 },
    ]);
  });

  it("une pièce sans origine est retenue en nommant `sourceUrl`", () => {
    const d = dossier({
      claims: [
        claim({
          state: "PUBLIC",
          provenance: { threadUrl: null, sources: [source({ sourceUrl: null })], unresolvedRefs: [] },
        }),
      ],
    });
    expect(projectForPublication(d, "test").withheld[0].field).toBe("sourceUrl");
  });

  it("un claim non promu est retenu sur `state`, sans jugement de fond", () => {
    const d = dossier({ claims: [claim({ state: "ATTACHED" }), claim({ claimId: "C2", state: "ADMISSIBLE" })] });
    const p = projectForPublication(d, "test");
    expect(p.claims).toHaveLength(0);
    expect(p.withheld).toEqual([
      { excluded: true, reason: "EXCLUDED_FROM_PUBLICATION", field: "state", count: 2 },
    ]);
  });

  it("les trois exigences d'une pièce publiable sont cumulatives", () => {
    expect(isPubliableSource(source())).toBe(true);
    expect(isPubliableSource(source({ sha256: null }))).toBe(false);
    expect(isPubliableSource(source({ sourceUrl: null }))).toBe(false);
    expect(isPubliableSource(source({ capturedAt: null }))).toBe(false);
  });
});

// ═══ GATE 4 · les références non résolues restent visibles ════════════════

describe("GATE 4 — une absence ne devient jamais un fondement", () => {
  const projete = (): PublicProjection =>
    projectForPublication(
      dossier({
        claims: [
          claim({
            state: "PUBLIC",
            provenance: {
              threadUrl: "https://x.com/exemple/status/9",
              sources: [source(), source({ sourceId: "SRC-002", sha256: null })],
              unresolvedRefs: ["captures TBC", "voir fil"],
            },
          }),
        ],
      }),
      "test",
    );

  it("les non résolues survivent au rendu, telles quelles", () => {
    expect(projete().claims[0].provenance.unresolvedRefs).toEqual(["captures TBC", "voir fil"]);
  });

  it("MUTANT — elles ne sont PAS reversées dans les sources", () => {
    const p = projete().claims[0].provenance;
    expect(p.sources.map((s) => s.sourceId)).toEqual(["SRC-001"]);
    expect(p.sources).toHaveLength(1);
  });

  it("une pièce retenue n'est pas déguisée en référence non résolue", () => {
    // Deux absences différentes : le registre ignore l'une, l'autre existe
    // mais n'est pas publiable. Les fondre effacerait l'information.
    const p = projete().claims[0].provenance;
    expect(p.withheldRefs).toEqual(["SRC-002"]);
    expect(p.unresolvedRefs).not.toContain("SRC-002");
  });
});

// ═══ GATE 5 · les données rendues sont les données RÉELLES ═══════════════

describe("GATE 5 — l'index rend ce qu'il a, jamais la date du jour", () => {
  const AUJOURDHUI = new Date().toISOString().slice(0, 10);
  const html = (): string =>
    buildPublicReportHtml(
      "fr",
      projectForPublication(dossier({ claims: [claimPublieComplet()] }), "test"),
    );

  it("l'horodatage rendu est celui de la CAPTURE", () => {
    expect(page(html(), 2)).toContain(CAPTURE_REELLE);
  });

  it("MUTANT — la date de génération n'apparaît pas dans l'index de preuves", () => {
    // Chaque pièce paraissait captée le jour de l'export. Le pied de page
    // porte la date de génération, mais LIBELLÉE — le corps de l'index, non.
    const corps = page(html(), 2).split('<footer class="page-footer">')[0];
    expect(corps).not.toContain(AUJOURDHUI);
  });

  it("le type, la légende et l'origine viennent de la pièce", () => {
    const p = page(html(), 2);
    expect(p).toContain("screenshot");
    expect(p).toContain("Fil 1/8");
  });

  it("le catalogue OSINT rend empreinte et origine, plus un nom de fichier", () => {
    const osint = page(html(), 8);
    expect(osint).toContain(SHA.slice(0, 16));
    expect(osint).toContain("x.com/exemple");
    expect(osint).not.toContain("IMG_2239");
  });

  it("MUTANT — le catalogue OSINT n'est plus une constante codée en dur", () => {
    const code = codeSeul("src/lib/casefile/pdfGeneratorPublic.ts");
    expect(code).not.toContain("OSINT_ENTRIES");
    expect(code).not.toContain("IMG_22");
  });

  it("le décompte de claims du résumé n'est plus une constante", () => {
    const vide = buildPublicReportHtml("en", projectForPublication(dossier(), "test"));
    expect(page(vide, 1)).toContain("No referenced claim");
    expect(page(html(), 1)).toContain("1 allégation");
  });

  it("un dossier sans claim publiable le DIT, sans conclure au faux", () => {
    const vide = buildPublicReportHtml(
      "fr",
      projectForPublication(dossier({ claims: [claim({ state: "ATTACHED" })] }), "test"),
    );
    const idx = page(vide, 2);
    expect(idx).toContain("n'est pas une preuve de fausseté");
    // Le retrait est SIGNALÉ, et il nomme le champ.
    expect(idx).toContain("Retenu hors publication");
    expect(idx).toContain("state");
  });
});

// ═══ GATE 6 · aucune donnée interne ne franchit la frontière ═════════════

describe("GATE 6 — la frontière des données internes tient au rendu", () => {
  it("le HTML public ne porte aucun champ interne", () => {
    const html = buildPublicReportHtml(
      "en",
      projectForPublication(dossier({ claims: [claimPublieComplet()] }), "test"),
    );
    for (const f of ["localFilePath", "sessionId", "snapshotId", "casefileRef"]) {
      expect(html, f).not.toContain(f);
    }
  });

  it("la fiche UI ne rend aucun champ interne", () => {
    const code = codeSeul("src/components/cases/TokenCasefileView.tsx");
    for (const f of ["localFilePath", "sessionId", "snapshotId"]) {
      expect(code, f).not.toContain(f);
    }
  });
});

// ═══ GATE 7 · tigerScore NULL n'est pas un score ═════════════════════════

describe("GATE 7 — un score non établi n'a pas l'apparence d'un score", () => {
  it("MUTANT — NULL ne rend jamais « / 100 » sur la couverture", () => {
    // L'anneau affichait « 100 / 100 » codé en dur, sous le libellé
    // TigerScore, pour un dossier dont l'autorité porte NULL.
    const couverture = page(
      buildPublicReportHtml("en", projectForPublication(dossier({ tigerScore: null }), "test")),
      1,
    );
    expect(couverture).not.toContain("/ 100");
    expect(couverture).toContain("Not established");
  });

  it("un score établi est rendu tel quel", () => {
    const couverture = page(
      buildPublicReportHtml("en", projectForPublication(dossier({ tigerScore: 91 }), "test")),
      1,
    );
    expect(couverture).toContain("91 / 100");
  });

  it("0 reste 0 — il n'est jamais confondu avec l'absence", () => {
    expect(renderedScore(0)).toEqual({ value: 0, outOf: 100 });
    expect(renderedScore(null)).toBeNull();
  });

  it("la fiche UI garde son « — » pour un score absent", () => {
    const code = codeSeul("src/components/cases/TokenCasefileView.tsx");
    expect(code).toContain("data.tigerScore != null ?");
  });
});

// ═══ GATE 8 · BOTIFY et VINE passent le même chemin ══════════════════════

describe("GATE 8 — les deux dossiers, un seul chemin", () => {
  it("les deux mints canoniques résolvent vers leur dossier", () => {
    expect(canonicalRefForMint(BOTIFY_MINT)).toBe(BOTIFY_CASEFILE_REF);
    expect(canonicalRefForMint(VINE_MINT)).toBe(VINE_CASEFILE_REF);
  });

  it("l'alias BOTIFY synthétique résout vers le dossier canonique", () => {
    expect(canonicalRefForMint(BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe(BOTIFY_CASEFILE_REF);
  });

  it("un mint inconnu rend null — la carte sait dire qu'elle ne connaît pas", () => {
    expect(canonicalRefForMint("inconnu")).toBeNull();
    expect(canonicalRefForMint(null)).toBeNull();
  });

  it("les deux dossiers se projettent avec le MÊME code", () => {
    for (const ref of [BOTIFY_CASEFILE_REF, VINE_CASEFILE_REF]) {
      const p = projectForPublication(
        dossier({ ref, claims: [claim({ state: "ATTACHED" })] }),
        "test",
      );
      expect(p.ref, ref).toBe(ref);
      expect(p.claims, ref).toHaveLength(0);
      expect(p.withheld[0].field, ref).toBe("state");
    }
  });

  it("VINE est refusé sur le GABARIT, pas par une liste de presets", () => {
    // Les pages 3 à 7 documentent BOTIFY. Les rendre sous l'en-tête VINE
    // attribuerait à VINE la chronologie et les métriques de BOTIFY.
    expect(STATIC_SECTIONS_DOCUMENT_REF).toBe(BOTIFY_CASEFILE_REF);
    expect(() =>
      buildPublicReportHtml("fr", projectForPublication(dossier({ ref: VINE_CASEFILE_REF }), "test")),
    ).toThrow(StaticSectionsMismatchError);
  });
});

// ═══ Doctrine de publication · le retrait ne republie rien ═══════════════

describe("DOCTRINE — un retrait nomme le champ, jamais sa valeur", () => {
  it("chaque avis ne porte qu'un motif fermé, un nom de champ, un décompte", () => {
    const p = projectForPublication(
      dossier({
        claims: [
          claim({ state: "ATTACHED" }),
          claim({
            claimId: "C2",
            state: "PUBLIC",
            provenance: { threadUrl: null, sources: [source({ sha256: null })], unresolvedRefs: [] },
          }),
        ],
      }),
      "test",
    );
    for (const n of p.withheld) {
      expect(Object.keys(n).sort()).toEqual(["count", "excluded", "field", "reason"]);
      // Un identifiant : ni espace, ni symbole monétaire, ni ponctuation.
      expect(n.field).toMatch(/^[A-Za-z_][A-Za-z0-9_.]*$/);
    }
    expect(p.withheld.map((n) => n.reason).sort()).toEqual([
      "EXCLUDED_FROM_PUBLICATION",
      "INSUFFICIENT_PROVENANCE",
    ]);
  });

  it("les avis sont AGRÉGÉS par champ — aucun titre de claim retenu ne sort", () => {
    const p = projectForPublication(
      dossier({
        claims: [
          claim({ claimId: "C1", title: "Titre retenu A", state: "ATTACHED" }),
          claim({ claimId: "C2", title: "Titre retenu B", state: "ATTACHED" }),
        ],
      }),
      "test",
    );
    expect(p.withheld).toHaveLength(1);
    expect(p.withheld[0].count).toBe(2);
    expect(JSON.stringify(p.withheld)).not.toContain("Titre retenu");
  });

  it("rien à retenir ⇒ aucun avis. On ne signale pas un retrait imaginaire", () => {
    const p = projectForPublication(dossier({ claims: [claimPublieComplet()] }), "test");
    expect(p.withheld).toEqual([]);
    expect(p.claims).toHaveLength(1);
  });

  it("le registre publié se limite aux pièces CITÉES par un claim publié", () => {
    const p = projectForPublication(
      dossier({
        claims: [claimPublieComplet()],
        sources: [source(), source({ sourceId: "SRC-999" })],
      }),
      "test",
    );
    expect(p.sources.map((s) => s.sourceId)).toEqual(["SRC-001"]);
  });
});
