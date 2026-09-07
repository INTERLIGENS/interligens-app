// ─── BUILD 9 / ÉTAPE 5 — la provenance survit au rendu ─────────────────────
//
// Gate ratifié : « aucun claim public démontré ne perd SILENCIEUSEMENT son
// fondement probatoire entre le stockage canonique et le rendu public ».

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  resolveProvenance,
  assertProvenanceSurvives,
  ProvenanceLostError,
  INTERNAL_ONLY_FIELDS,
  type PublicSource,
  type PublicClaim,
} from "@/lib/casefile/canonicalReader";

const SRC: PublicSource = {
  sourceId: "SRC-001",
  sourceType: "screenshot",
  caption: "Thread 1/8",
  capturedAt: "2025-12-07",
  sourceUrl: "https://x.com/…",
  sha256: "a".repeat(64),
};
const REGISTRE = new Map([[SRC.sourceId, SRC]]);

const claim = (o: Partial<PublicClaim>): PublicClaim => ({
  claimId: "C1", title: "t", titleFr: null, description: null, descriptionFr: null,
  category: null, severity: null, status: null, claimDate: null,
  state: "ATTACHED", provenance: null, ...o,
});

describe("ÉTAPE 5 — la résolution ne masque rien", () => {
  it("une référence qui résout devient une source complète", () => {
    const p = resolveProvenance(null, ["SRC-001"], REGISTRE);
    expect(p?.sources).toHaveLength(1);
    expect(p?.sources[0].capturedAt).toBe("2025-12-07");
    expect(p?.unresolvedRefs).toEqual([]);
  });

  it("une référence qui NE résout PAS est rendue visible, pas écartée", () => {
    // Un fondement manquant qu'on ne voit pas est indiscernable d'un fondement
    // absent. C'est le cas de VINE : 33 références sur 39 sont de la prose.
    const p = resolveProvenance(null, ["SRC-001", "screenshots TBC"], REGISTRE);
    expect(p?.sources).toHaveLength(1);
    expect(p?.unresolvedRefs).toEqual(["screenshots TBC"]);
  });

  it("aucun fondement du tout → `null` EXPLICITE, pas un champ absent", () => {
    // Un champ absent laisserait le renderer décider. `null` l'oblige à le dire.
    expect(resolveProvenance(null, [], REGISTRE)).toBeNull();
  });

  it("un thread_url seul suffit à constituer un fondement", () => {
    const p = resolveProvenance("https://x.com/…", [], REGISTRE);
    expect(p?.threadUrl).toBe("https://x.com/…");
    expect(p?.sources).toEqual([]);
  });
});

describe("ÉTAPE 5 — le gate refuse bruyamment", () => {
  it("un claim PUBLIC sans fondement fait LEVER", () => {
    expect(() => assertProvenanceSurvives([claim({ state: "PUBLIC" })], "test"))
      .toThrow(ProvenanceLostError);
  });

  it("un claim PUBLIC avec un thread_url passe", () => {
    const p = resolveProvenance("https://x.com/…", [], REGISTRE);
    expect(() => assertProvenanceSurvives([claim({ state: "PUBLIC", provenance: p })], "test"))
      .not.toThrow();
  });

  it("un claim PUBLIC dont TOUTES les refs sont non résolues est REFUSÉ", () => {
    // Une provenance non nulle ne suffit pas : il faut un fondement RÉEL.
    const p = resolveProvenance(null, ["screenshots TBC"], REGISTRE);
    expect(p).not.toBeNull();
    expect(() => assertProvenanceSurvives([claim({ state: "PUBLIC", provenance: p })], "test"))
      .toThrow(ProvenanceLostError);
  });

  it("un claim ATTACHED sans fondement ne lève PAS — il n'est pas publié", () => {
    // Les trois états sont distincts : le gate porte sur la PUBLICATION.
    expect(() => assertProvenanceSurvives([claim({ state: "ATTACHED" })], "test")).not.toThrow();
  });
});

/**
 * Le CODE seul — commentaires retirés.
 *
 * Trois de ces tests ont d'abord rougi sur mes propres commentaires : un
 * en-tête qui EXPLIQUE pourquoi `TODAY_ISO` a été retiré contient forcément
 * « TODAY_ISO ». C'est la troisième fois que je fais cette erreur dans ce
 * chantier ; l'utilitaire la ferme pour de bon.
 */
const codeSeul = (chemin: string): string =>
  readFileSync(chemin, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

describe("ÉTAPE 5 — aucune donnée interne ne franchit la frontière", () => {
  it("les colonnes SÉLECTIONNÉES ne contiennent aucun champ interne", () => {
    const code = codeSeul("src/lib/casefile/canonicalReader.ts");
    // On inspecte les listes de colonnes des SELECT, pas les WHERE :
    // `casefileRef` y est légitimement le filtre, il n'est jamais restitué.
    const listes = [...code.matchAll(/SELECT\s+([\s\S]*?)\s+FROM/gi)].map((m) => m[1]);
    expect(listes.length).toBeGreaterThan(0);
    for (const liste of listes) {
      for (const f of ["localFilePath", "sessionId", "notes", "snapshotId"]) {
        expect(liste, f).not.toContain(f);
      }
    }
    expect(INTERNAL_ONLY_FIELDS).toContain("localFilePath");
  });

  it("aucun SELECT * — ce qui n'est pas lu ne peut pas fuir", () => {
    expect(codeSeul("src/lib/casefile/canonicalReader.ts")).not.toMatch(/SELECT\s+\*/i);
  });

  it("le type public ne porte aucun champ interne", () => {
    const p = resolveProvenance(null, ["SRC-001"], REGISTRE);
    const cles = Object.keys(p!.sources[0]);
    for (const f of INTERNAL_ONLY_FIELDS) expect(cles, f).not.toContain(f);
  });
});

describe("ÉTAPE 5 — l'index de preuves ne fabrique plus son horodatage", () => {
  const code = codeSeul("src/lib/casefile/pdfGeneratorPublic.ts");
  const index = code.slice(
    code.indexOf("function buildEvidenceIndexInner"),
    code.indexOf("function buildTimelineInner"),
  );

  it("MUTANT — TODAY_ISO a disparu de la colonne Horodatage", () => {
    // Chaque pièce paraissait captée le jour de l'export, alors que le registre
    // porte de vrais captured_at. Un index qui invente ses dates rassure au
    // lieu de documenter.
    expect(index).not.toContain("TODAY_ISO");
  });

  it("la colonne rend le `captured_at` de la source résolue", () => {
    expect(index).toContain("src?.captured_at");
  });

  it("chaque colonne rend son champ, et « — » quand il manque", () => {
    expect(index).toContain('src?.type ?? "—"');
    expect(index).toContain("registre.get");
  });
});
