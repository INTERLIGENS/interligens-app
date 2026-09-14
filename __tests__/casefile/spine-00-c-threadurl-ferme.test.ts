// ─── SPINE-00 · C — threadUrl N'EST PLUS UN CRITÈRE D'ÉMISSION ─────────────
//
// Ruling du 2026-09-13 : la projection publique exige LE MÊME contrat que
// l'écrivain — nature classifiée, références non vides, chaque référence
// résolue vers une pièce publiable — et elle le CONSOMME depuis
// `governedWriter.decidePublicClaimContract`, elle ne le réécrit pas.
//
// « threadUrl peut être PRÉSENT, RENDU ET CITÉ, mais il ne peut JAMAIS être la
//   raison pour laquelle un claim devient projetable. »
//
// Les trois cas exigés, mot pour mot :
//   (a) claim + threadUrl + ZÉRO evidenceRefs   → NON PROJETÉ
//   (b) même claim + UNE ref admissible          → PROJETÉ
//   (c) retirer la ref après coup                → ProvenanceLostError ou refus équivalent

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { projectForPublication, VINE_CASEFILE_REF } from "@/lib/casefile/publicProjection";
import {
  ProvenanceLostError,
  resolveProvenance,
  type CanonicalCaseFile,
  type PublicClaim,
  type PublicSource,
} from "@/lib/casefile/canonicalReader";
import { EXCLUSION_REASONS } from "@/lib/casefile/publicationState";
import { SOURCE_PROVENANCE_FIELDS } from "@/lib/casefile/governedWriter";

// ─── Fixtures ──────────────────────────────────────────────────────────────

const SHA = "d".repeat(64);
const FIL = "https://x.com/exemple/status/9";

const piece = (o: Partial<PublicSource> = {}): PublicSource => ({
  sourceId: "SRC-001",
  sourceType: "screenshot",
  caption: "Fil 1/8",
  capturedAt: "2025-12-07",
  sourceUrl: "https://x.com/exemple/status/1",
  sha256: SHA,
  evidenceLinked: true,
  provenanceKind: "VERIFIED",
  ...o,
});

/** Un claim PUBLIC dont la provenance est RÉSOLUE contre le registre donné — comme le lecteur le ferait. */
const claimPublic = (
  evidenceRefs: readonly string[],
  registre: readonly PublicSource[],
  o: Partial<PublicClaim> = {},
): PublicClaim => ({
  claimId: "C1",
  title: "Coordinated posting",
  titleFr: null,
  description: null,
  descriptionFr: null,
  category: "social",
  severity: "HIGH",
  status: "CONFIRMED",
  claimDate: "2025-11-04",
  state: "PUBLIC",
  rowNature: "PRIMARY_OBSERVATION",
  evidenceRefs,
  provenance: resolveProvenance(
    o.provenance === undefined ? FIL : (o.provenance?.threadUrl ?? null),
    evidenceRefs,
    new Map(registre.map((s) => [s.sourceId, s])),
  ),
  ...o,
});

const dossier = (claims: readonly PublicClaim[], sources: readonly PublicSource[]): CanonicalCaseFile => ({
  ref: VINE_CASEFILE_REF,
  codename: "VINE",
  ticker: "$VINE",
  title: "t",
  tigerScore: null,
  verdict: "AVOID",
  publishStatus: "published",
  claims,
  sources,
  keyWallets: [],
});

const codeSeul = (chemin: string): string =>
  readFileSync(chemin, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

// ═══ LES TROIS CAS ══════════════════════════════════════════════════════════

describe("SPINE-00 · C — les trois cas du ruling", () => {
  it("(a) claim + threadUrl + ZÉRO evidenceRefs → NON PROJETÉ, retenu sur `evidenceRefs`", () => {
    const p = projectForPublication(dossier([claimPublic([], [piece()])], [piece()]), "test");
    expect(p.claims).toEqual([]);
    expect(p.sources).toEqual([]);
    expect(p.withheld).toEqual([
      { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "evidenceRefs", count: 1 },
    ]);
  });

  it("(b) même claim + UNE ref admissible → PROJETÉ, et le fil est rendu comme provenance complémentaire", () => {
    const p = projectForPublication(dossier([claimPublic(["SRC-001"], [piece()])], [piece()]), "test");
    expect(p.claims.map((c) => c.claimId)).toEqual(["C1"]);
    expect(p.claims[0].provenance.threadUrl).toBe(FIL);
    expect(p.claims[0].provenance.sources.map((s) => s.sourceId)).toEqual(["SRC-001"]);
    expect(p.sources.map((s) => s.sourceId)).toEqual(["SRC-001"]);
    expect(p.withheld).toEqual([]);
  });

  it("(c) retirer la ref après coup, fil présent → refus équivalent : retenu, même avis qu'en (a)", () => {
    const avant = projectForPublication(dossier([claimPublic(["SRC-001"], [piece()])], [piece()]), "test");
    expect(avant.claims).toHaveLength(1);
    const apres = projectForPublication(dossier([claimPublic([], [piece()])], [piece()]), "test");
    expect(apres.claims).toEqual([]);
    expect(apres.withheld).toEqual([
      { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "evidenceRefs", count: 1 },
    ]);
  });

  it("(c') retirer la ref après coup, SANS fil → ProvenanceLostError : aucune provenance du tout", () => {
    const sansRien = claimPublic([], [piece()], { provenance: null });
    expect(() => projectForPublication(dossier([sansRien], [piece()]), "test")).toThrow(ProvenanceLostError);
  });

  it("(c'') retirer la PIÈCE du registre après coup, ref toujours citée → retenu sur `evidenceRefs`", () => {
    const p = projectForPublication(dossier([claimPublic(["SRC-001"], [])], []), "test");
    expect(p.claims).toEqual([]);
    expect(p.withheld).toEqual([
      { excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: "evidenceRefs", count: 1 },
    ]);
  });
});

// ═══ threadUrl NE COMPENSE AUCUN MANQUE ═════════════════════════════════════

describe("SPINE-00 · C — le fil ne compense aucun des quatre manques du contrat", () => {
  const CAS: ReadonlyArray<readonly [string, () => CanonicalCaseFile, string]> = [
    ["nature non classifiée", () => dossier([claimPublic(["SRC-001"], [piece()], { rowNature: "UNCLASSIFIED" })], [piece()]), "rowNature"],
    ["nature absente", () => dossier([claimPublic(["SRC-001"], [piece()], { rowNature: undefined })], [piece()]), "rowNature"],
    ["zéro référence", () => dossier([claimPublic([], [piece()])], [piece()]), "evidenceRefs"],
    ["référence non résolue", () => dossier([claimPublic(["SRC-404"], [piece()])], [piece()]), "evidenceRefs"],
    ["pièce sans sha256", () => dossier([claimPublic(["SRC-001"], [piece({ sha256: null })])], [piece({ sha256: null })]), "sha256"],
    ["pièce sans sourceUrl", () => dossier([claimPublic(["SRC-001"], [piece({ sourceUrl: null })])], [piece({ sourceUrl: null })]), "sourceUrl"],
    ["pièce sans capturedAt", () => dossier([claimPublic(["SRC-001"], [piece({ capturedAt: null })])], [piece({ capturedAt: null })]), "capturedAt"],
  ];

  for (const [nom, d, champ] of CAS) {
    it(`${nom}, fil présent → retenu, champ \`${champ}\``, () => {
      const entree = d();
      expect(entree.claims[0].provenance?.threadUrl, "le fil est bien présent en entrée").toBe(FIL);
      const p = projectForPublication(entree, "test");
      expect(p.claims).toEqual([]);
      expect(p.withheld).toEqual([{ excluded: true, reason: "INSUFFICIENT_PROVENANCE", field: champ, count: 1 }]);
    });
  }
});

// ═══ AUCUN ORACLE NOUVEAU DANS withheld[] ═══════════════════════════════════

describe("SPINE-00 · C — withheld[] ne porte aucune distinction nouvelle", () => {
  const CHAMPS_ADMIS = new Set<string>(["state", "rowNature", "evidenceRefs", ...SOURCE_PROVENANCE_FIELDS]);

  it("un claim non fondé et un claim absent rendent le MÊME ensemble de claims et de sources", () => {
    const nonFonde = projectForPublication(dossier([claimPublic([], [piece()])], [piece()]), "test");
    const absent = projectForPublication(dossier([], [piece()]), "test");
    expect(nonFonde.claims).toEqual(absent.claims);
    expect(nonFonde.sources).toEqual(absent.sources);
  });

  it("l'avis d'un claim non fondé n'emploie que les motifs fermés et des noms de champ connus — jamais une clef de pièce, un titre ou un identifiant de claim", () => {
    const d = dossier(
      [
        claimPublic([], [piece()], { claimId: "C-SECRET", title: "Titre retenu" }),
        claimPublic(["SRC-404"], [piece()], { claimId: "C2" }),
        claimPublic(["SRC-NUE"], [piece({ sourceId: "SRC-NUE", sha256: null })], { claimId: "C3" }),
        claimPublic(["SRC-001"], [piece()], { claimId: "C4", rowNature: null }),
      ],
      [piece(), piece({ sourceId: "SRC-NUE", sha256: null })],
    );
    const p = projectForPublication(d, "test");
    expect(p.claims).toEqual([]);
    for (const n of p.withheld) {
      expect(Object.keys(n).sort()).toEqual(["count", "excluded", "field", "reason"]);
      expect(EXCLUSION_REASONS).toContain(n.reason);
      expect(CHAMPS_ADMIS.has(n.field), n.field).toBe(true);
    }
    const json = JSON.stringify(p.withheld);
    for (const interdit of ["SRC-404", "SRC-NUE", "SRC-001", "C-SECRET", "Titre retenu", "C2", "C3", "C4"]) {
      expect(json, interdit).not.toContain(interdit);
    }
  });

  it("le motif d'un claim non fondé est celui qui existait déjà : INSUFFICIENT_PROVENANCE, pas un motif nouveau", () => {
    const p = projectForPublication(dossier([claimPublic([], [piece()])], [piece()]), "test");
    expect(p.withheld.map((n) => n.reason)).toEqual(["INSUFFICIENT_PROVENANCE"]);
    expect(EXCLUSION_REASONS).toEqual(["EXCLUDED_FROM_PUBLICATION", "INSUFFICIENT_PROVENANCE"]);
  });
});

// ═══ LA PROJECTION CONSOMME, ELLE NE RÉÉCRIT PAS ════════════════════════════

describe("SPINE-00 · C — une seule écriture de la règle", () => {
  const projection = codeSeul("src/lib/casefile/publicProjection.ts");
  const writer = codeSeul("src/lib/casefile/governedWriter.ts");

  it("la projection appelle decidePublicationContract, importé de governedWriter — jamais le contrat du fondement", () => {
    expect(projection).toMatch(/import \{[\s\S]*?decidePublicationContract[\s\S]*?\} from "\.\/governedWriter"/);
    expect(projection.match(/decidePublicationContract\(/g)?.length).toBe(1);
    expect(projection).not.toMatch(/decideFoundationContract|isFoundationEligibleSource/);
  });

  it("MUTANT — la projection ne réimplémente aucun terme du contrat", () => {
    // Aucun test de provenance, aucun décompte de références, aucun jugement
    // de nature, aucun appel direct au prédicat de pièce : tout ça vit dans
    // la primitive, une fois.
    expect(projection).not.toMatch(/isPubliableSource\(/);
    expect(projection).not.toMatch(/\.sha256\s*&&/);
    expect(projection).not.toMatch(/\.sourceUrl\s*&&/);
    expect(projection).not.toMatch(/evidenceRefs\??\.length/);
    // (`"CLAIM_UNCLASSIFIED"` est un libellé de CAUSE consommé, pas un jugement de nature.)
    expect(projection).not.toMatch(/\bisDataNature\b|\bDATA_NATURES\b|"UNCLASSIFIED"/);
    expect(projection).not.toMatch(/\.filter\(isPubliableSource\)/);
  });

  it("MUTANT — threadUrl n'apparaît dans AUCUNE condition d'émission de la projection", () => {
    // Il est LU (rendu dans la provenance) mais jamais testé : aucune forme
    // `threadUrl` dans un `if`, un `&&`, un `||` ou un ternaire. La lecture
    // `c.provenance?.threadUrl ?? null` n'est pas une condition : le chaînage
    // optionnel `?.` n'est pas un `?` de ternaire.
    const conditions = projection.match(/(if\s*\(|&&|\|\||\?\s)[^;{]*threadUrl/g) ?? [];
    expect(conditions, conditions.join("\n")).toEqual([]);
  });

  it("les prédicats de pièce vivent dans governedWriter, une fois chacun ; isPubliableSource n'existe plus", () => {
    expect(writer.match(/export function isFoundationEligibleSource\(/g)?.length).toBe(1);
    expect(writer.match(/export function isPublicationEligibleSource\(/g)?.length).toBe(1);
    expect(writer).not.toContain("isPubliableSource");
    expect(projection).not.toContain("isPubliableSource");
    expect(writer).not.toContain('from "./publicProjection"');
  });

  it("le lecteur canonique lit rowNature et evidenceRefs — les entrées du contrat", () => {
    const reader = codeSeul("src/lib/casefile/canonicalReader.ts");
    expect(reader).toContain('"rowNature"::text AS "rowNature"');
    expect(reader).toContain("rowNature: c.rowNature");
    expect(reader).toContain("evidenceRefs: asRefs(c.evidenceRefs)");
  });
});
