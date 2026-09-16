// ─── CC-OFFLINE-240 · CF-1 — L'ASSEMBLAGE D'AUTORITÉ ───────────────────────
//
// ██  LA DONNÉE ÉTAIT CORRECTE. LE PRODUIT NE LA LISAIT PAS.               ██
//
// CF-0 avait mesuré que le producteur PDF alimentait ses claims depuis un JSON
// disque, pendant que le corpus gouverné existait et était lisible. Ces témoins
// tiennent la propriété inverse : l'assemblage lit le corpus gouverné, et RIEN
// d'autre.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { composerAssemblage } from "@/lib/casefile/authorityAssembly";
import type { CanonicalCaseFile, PublicClaim, PublicSource } from "@/lib/casefile/canonicalReader";
import { codeSeul } from "./codeSeul";

const SHA = "a".repeat(64);

const piece = (o: Partial<PublicSource> = {}): PublicSource => ({
  sourceId: "SRC-001", sourceType: "osint_x_search", caption: null, capturedAt: "2026-09-16",
  sourceUrl: "https://x.com/e/1", sha256: SHA, evidenceLinked: true,
  provenanceKind: "OPERATOR_DECLARED", ...o,
});

const claim = (o: Partial<PublicClaim> = {}): PublicClaim => ({
  claimId: "C-OBS", version: 1, title: "t", titleFr: null, description: null,
  descriptionFr: null, category: null, severity: null, status: null, claimDate: null,
  state: "ATTACHED", rowNature: "PRIMARY_OBSERVATION", evidenceRefs: ["SRC-001"],
  provenance: null, ...o,
});

const dossier = (o: Partial<CanonicalCaseFile> = {}): CanonicalCaseFile =>
  ({
    ref: "IL-SUJET-001", codename: "SUJET", ticker: "$SUJET", title: "t",
    tigerScore: null, verdict: "AVOID", publishStatus: "draft",
    claims: [claim()], sources: [piece()], keyWallets: [],
    ...o,
  }) as unknown as CanonicalCaseFile;

const DEPS = new Map([["C-INF@1", [{ claimId: "C-OBS", version: 1, kind: "DERIVED_FROM" }]]]);
const SCEAUX = new Map<string, string | null>([["C-OBS@1", "b".repeat(64)], ["C-INF@1", "c".repeat(64)]]);
const LIGNAGES = new Map([
  ["SRC-001", { snapshotId: "snap-1", journalId: "7", sourceLocator: "https://x.com/e/1", declaredBy: "Un Opérateur" }],
  ["SRC-MES", { snapshotId: "snap-2", journalId: "8", sourceLocator: "r2://bucket/obj.json", declaredBy: "instrument:un-instrument@1.0.0" }],
]);

const assembler = (
  d: CanonicalCaseFile = dossier(),
  deps: ReadonlyMap<string, ReadonlyArray<{ claimId: string; version: number; kind: string }>> = DEPS,
  sceaux: ReadonlyMap<string, string | null> = SCEAUX,
  lig: ReadonlyMap<string, { snapshotId: string | null; journalId: string | null; sourceLocator: string | null; declaredBy: string | null }> = LIGNAGES,
) => composerAssemblage(d, deps, sceaux, lig);

describe("CF-1 · la chaîne d'autorité est TRANSPORTÉE", () => {
  it("le sujet ne porte AUCUN champ de prose", () => {
    expect(Object.keys(assembler().subject).sort()).toEqual(["codename", "ref", "ticker", "title"]);
  });

  it("une claim transporte identité, version, nature, sceau et références", () => {
    const c = assembler().claims[0];
    expect(c.claimId).toBe("C-OBS");
    expect(c.version).toBe(1);
    expect(c.rowNature).toBe("PRIMARY_OBSERVATION");
    expect(c.contentHash).toBe("b".repeat(64));
    expect(c.evidenceRefs).toEqual(["SRC-001"]);
  });

  it("une pièce transporte digest, localisateur, qualification ET déclarant", () => {
    const s = assembler().sources[0];
    expect(s.sha256).toBe(SHA);
    expect(s.provenanceKind).toBe("OPERATOR_DECLARED");
    expect(s.journalId).toBe("7");
    expect(s.sourceLocator).toBe("https://x.com/e/1");
    expect(s.declaredBy).toBe("Un Opérateur");
  });

  it("le LIGNAGE DE MESURE porte l'identité de l'instrument", () => {
    const a = assembler(dossier({
      sources: [piece({ sourceId: "SRC-MES", provenanceKind: "MACHINE_MEASURED", sourceUrl: "r2://bucket/obj.json" })],
      claims: [claim({ evidenceRefs: ["SRC-MES"] })],
    }));
    const s = a.sources[0];
    expect(s.provenanceKind).toBe("MACHINE_MEASURED");
    expect(s.declaredBy).toBe("instrument:un-instrument@1.0.0");
    expect(s.sourceLocator).toMatch(/^r2:\/\//);
  });

  it("une dépendance est épinglée en version DES DEUX CÔTÉS", () => {
    const a = assembler(dossier({ claims: [claim({ claimId: "C-INF", rowNature: "INFERENCE", evidenceRefs: [] })] }));
    expect(a.dependencies).toEqual([
      { dependentClaimId: "C-INF", dependentVersion: 1, sourceClaimId: "C-OBS", sourceVersion: 1, kind: "DERIVED_FROM" },
    ]);
  });

  it("l'assemblage est SÉRIALISABLE — pas de cycle, pas de Map, pas de Date", () => {
    const s = JSON.stringify(assembler());
    expect(JSON.parse(s)).toEqual(JSON.parse(JSON.stringify(assembler())));
  });
});

describe("CF-1 · MUTANTS — ce que l'assemblage refuse de fabriquer", () => {
  it("MUTANT · pièce nécessaire ABSENTE → la référence reste NON RÉSOLUE, rien n'est inventé", () => {
    const a = assembler(dossier({ sources: [] }));
    expect(a.sources).toEqual([]);
    // La claim garde sa référence : l'assemblage ne la retire pas, ne la
    // remplace pas, et ne fabrique aucune pièce. C'est au contrat de fondement
    // de refuser — l'assemblage DIT ce qui manque.
    expect(a.claims[0].evidenceRefs).toEqual(["SRC-001"]);
  });

  it("MUTANT · dépendance ABSENTE → l'inférence n'en porte AUCUNE", () => {
    const a = assembler(
      dossier({ claims: [claim({ claimId: "C-INF", rowNature: "INFERENCE", evidenceRefs: [] })] }),
      new Map(),
    );
    expect(a.dependencies).toEqual([]);
  });

  it("MUTANT · sceau ABSENT → `null`, JAMAIS une valeur fabriquée", () => {
    expect(assembler(dossier(), DEPS, new Map()).claims[0].contentHash).toBeNull();
    const sceauNul = new Map<string, string | null>([["C-OBS@1", null]]);
    expect(assembler(dossier(), DEPS, sceauNul).claims[0].contentHash).toBeNull();
  });

  it("MUTANT · lignage ABSENT → localisateur et déclarant `null`, qualification conservée", () => {
    const s = assembler(dossier(), DEPS, SCEAUX, new Map()).sources[0];
    expect(s.journalId).toBeNull();
    expect(s.sourceLocator).toBeNull();
    expect(s.declaredBy).toBeNull();
    // La qualification vient du LECTEUR : une seule autorité sur ce fait.
    expect(s.provenanceKind).toBe("OPERATOR_DECLARED");
  });

  it("MUTANT · le verdict légataire modifié → assemblage IDENTIQUE, octet pour octet", () => {
    const base = JSON.stringify(assembler());
    for (const mot of ["AVOID", "SAFE", "UNDETERMINED", "CONCENTRATION_RISK", "n'importe quoi"]) {
      expect(JSON.stringify(assembler(dossier({ verdict: mot } as Partial<CanonicalCaseFile>)))).toBe(base);
    }
  });

  it("MUTANT · summary / bodyMarkdown / keyWallets modifiés → assemblage IDENTIQUE", () => {
    const base = JSON.stringify(assembler());
    const pollue = {
      summary: "Une prose historique",
      summaryFr: "De la prose",
      bodyMarkdown: "# titre",
      keyWallets: [{ label: "x", address: "y", note: null, chain: null }],
    } as unknown as Partial<CanonicalCaseFile>;
    expect(JSON.stringify(assembler(dossier(pollue)))).toBe(base);
  });

  it("MUTANT · aucune contamination entre dossiers — l'assemblage ne porte que ce qu'on lui donne", () => {
    const a = assembler(dossier({ ref: "IL-AUTRE-999" }));
    expect(a.subject.ref).toBe("IL-AUTRE-999");
    // Les sceaux et lignages d'un autre dossier n'apparaissent pas : ils sont
    // indexés par claim et par pièce, et seules celles du dossier sont mappées.
    expect(a.claims.every((c) => c.claimId === "C-OBS")).toBe(true);
    expect(a.sources.every((s) => s.sourceId === "SRC-001")).toBe(true);
  });
});

describe("CF-1 · l'assemblage NE LIT PAS la prose historique", () => {
  const source = codeSeul("src/lib/casefile/authorityAssembly.ts");

  it("aucune lecture d'un champ non autoritatif", () => {
    // ⚠️ Une recherche par nom ne suffit pas — CF-0 a trouvé un
    // `(scan as any).off_chain_fr?.summary`. On interdit donc AUSSI `any`.
    for (const interdit of [
      "loadCaseByMint", "MINT_TO_CASE", "computeScore",
      "bodyMarkdown", "keyWallets", "SmokingGun", "smokingGun",
      "summary", "summaryFr", "summary_fr", "off_chain",
    ]) {
      expect(source, interdit).not.toContain(interdit);
    }
  });

  it("aucun `any` — le vecteur exact par lequel la prose revenait", () => {
    expect(source).not.toMatch(/\bas any\b/);
    expect(source).not.toMatch(/:\s*any\b/);
  });

  it("le `verdict` légataire n'est pas lu, même s'il est présent sur l'objet source", () => {
    expect(source).not.toContain("dossier.verdict");
  });

  it("SUBJECT-AGNOSTIC — aucun sujet en dur sur le chemin de production", () => {
    const brut = readFileSync("src/lib/casefile/authorityAssembly.ts", "utf8");
    for (const litteral of ["IL-SHILL-VINE", "VINE-MULTI", "VINE-MEASURE", "VINE-CONCLUSION", "SRC-MEASURE"]) {
      expect(brut, litteral).not.toContain(litteral);
    }
  });
});

describe("CF-1 · l'assemblage RELAIE la qualification, il ne la RÉSOUT pas", () => {
  it("aucun second résolveur : le journal n'est pas réinterprété ici", () => {
    const source = codeSeul("src/lib/casefile/authorityAssembly.ts");
    // C'est la condition de sa déclaration comme « poseur » légitime dans
    // `t1-lecteur-journal` : il transporte une qualification déjà résolue.
    // S'il se mettait à la résoudre, il deviendrait une seconde autorité sur le
    // même fait — et ce témoin rougirait.
    expect(source).not.toContain("resolveJournalProvenance");
    expect(source).not.toContain("readLatestJournalRows");
    expect(source).not.toContain("provenanceDecoration");
  });

  it("la qualification rendue est EXACTEMENT celle reçue, jamais recalculée", () => {
    for (const kind of ["UNKNOWN", "OPERATOR_DECLARED", "EXTRACTED", "VERIFIED", "MACHINE_MEASURED"]) {
      const a = assembler(dossier({ sources: [piece({ provenanceKind: kind as PublicSource["provenanceKind"] })] }));
      expect(a.sources[0].provenanceKind, kind).toBe(kind);
    }
  });
});
