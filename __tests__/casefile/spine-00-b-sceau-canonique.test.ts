// ─── SPINE-00 · B — LE SCEAU CANONIQUE : UNE SEULE NORMALISATION ───────────
//
// Ruling du 2026-09-13 :
//
//   « A seal format has one canonical normalization. A renderer, writer or
//     audit tool may consume it; none may redefine it. »
//
// La mesure a tranché : les 16 sceaux persistés correspondent à la
// normalisation d'`integrityAudit.ts` (16/16) ; la forme « actors absent »
// que `renderSupersedeSql` pouvait produire correspond à 0/16. La
// normalisation est donc DÉPLACÉE dans `versioning.canonicalSealMaterial`,
// et tout le reste la consomme.
//
// ─── Ce que ce fichier prouve, et ce qu'il ne peut PAS prouver ────────────
//
// Il prouve la STRUCTURE : une seule écriture, aucune recomposition locale,
// `renderSupersedeSql` absent, la forme de la primitive identique à l'ancienne
// forme de l'audit sur une matrice de lignes brutes.
//
// Il ne peut pas prouver la BASELINE : les 16 sceaux réels ne sont pas dans ce
// dépôt, et leur contenu ne doit pas y être — un test qui embarquerait des
// claims ATTACHED les republierait. Le témoin positif sur la baseline est
// `scripts/casefile/audit-integrity.ts` (lecture seule), rejouable, mesuré le
// 2026-09-14 : 16/16, CONTENT_MUTATED = 0. Une garde qui ne mesure que du
// synthétique ne mesure rien ; c'est pourquoi les deux existent.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalSealMaterial,
  claimContentHash,
  auditClaims,
  SEALED_FIELDS,
  type CanonicalSealMaterial,
} from "@/lib/casefile/versioning";
import { isSealIntact, assertNoSilentRewrite } from "@/lib/casefile/sealGuard";
import * as sealGuard from "@/lib/casefile/sealGuard";
import { decideFoundation, type FoundationRequest } from "@/lib/casefile/governedWriter";
import { VINE_CASEFILE_REF, VINE_MINT } from "@/lib/casefile/publicProjection";
import { codeSeul, emisParLeCode } from "./codeSeul";

// ─── L'ORACLE : l'ancienne forme d'integrityAudit.ts, mot pour mot ─────────
//
// C'est la composition que l'audit appliquait AVANT le déplacement (lignes
// 50-53 et 89-104 de l'ancien integrityAudit.ts). Elle vit ici comme ORACLE
// d'un test, pas comme producteur : un test a le droit de contourner le type
// pour dire « voilà ce que la primitive doit rendre ».

const asStringsAncien = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const isoAncien = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

interface LigneBrute {
  claimId: string; title: string; titleFr: string | null; description: string | null;
  descriptionFr: string | null; category: string | null; severity: string | null;
  status: string | null; claimDate: Date | null; actors: unknown; threadUrl: string | null;
  evidenceRefs: unknown;
}

const formeAncienneDeLAudit = (r: LigneBrute): CanonicalSealMaterial =>
  ({
    claimId: r.claimId, title: r.title, titleFr: r.titleFr, description: r.description,
    descriptionFr: r.descriptionFr, category: r.category, severity: r.severity, status: r.status,
    claimDate: isoAncien(r.claimDate), actors: asStringsAncien(r.actors), threadUrl: r.threadUrl,
    evidenceRefs: asStringsAncien(r.evidenceRefs),
  }) as unknown as CanonicalSealMaterial;

/** Des lignes telles que Prisma les rend : `date` à minuit UTC, jsonb brut ou NULL. */
const LIGNES: ReadonlyArray<readonly [string, LigneBrute]> = [
  ["BOTIFY-like : tout NULL sauf titre et refs", {
    claimId: "C1", title: "Coordinated posting", titleFr: null, description: null, descriptionFr: null,
    category: null, severity: null, status: null, claimDate: null, actors: null,
    threadUrl: null, evidenceRefs: ["SRC-001"],
  }],
  ["VINE-like : date, acteurs, fil", {
    claimId: "C11", title: "Single-operator sybil network", titleFr: null,
    description: "Un financeur commun.", descriptionFr: null, category: "onchain",
    severity: "CRITICAL", status: "CONFIRMED", claimDate: new Date("2025-01-22T00:00:00.000Z"),
    actors: ["@a", "@b"], threadUrl: "https://x.com/exemple/status/1", evidenceRefs: ["SRC-002", "SRC-001"],
  }],
  ["jsonb non textuel : objets et nombres dans les listes", {
    claimId: "C2", title: "t", titleFr: "", description: null, descriptionFr: null,
    category: null, severity: null, status: null, claimDate: null,
    actors: [{ handle: "@x" }, 3, "@ok"], threadUrl: null, evidenceRefs: [1, "SRC-001", null],
  }],
  ["jsonb scalaire : pas un tableau du tout", {
    claimId: "C3", title: "t", titleFr: null, description: null, descriptionFr: null,
    category: null, severity: null, status: null, claimDate: null,
    actors: "@seul", threadUrl: null, evidenceRefs: { ref: "SRC-001" },
  }],
  ["chaîne vide partout où c'est possible", {
    claimId: "C4", title: "", titleFr: "", description: "", descriptionFr: "",
    category: "", severity: "", status: "", claimDate: null, actors: [], threadUrl: "", evidenceRefs: [],
  }],
];

// ═══ 1 · DÉPLACEMENT, PAS RÉÉCRITURE ════════════════════════════════════════

describe("SPINE-00 · B — la primitive rend EXACTEMENT l'ancienne forme de l'audit", () => {
  for (const [nom, ligne] of LIGNES) {
    it(`${nom} : même matière, même empreinte`, () => {
      const canon = canonicalSealMaterial(ligne);
      expect(canon).toEqual(formeAncienneDeLAudit(ligne));
      expect(claimContentHash(canon)).toBe(claimContentHash(formeAncienneDeLAudit(ligne)));
    });
  }

  it("la primitive couvre exactement SEALED_FIELDS — ni plus, ni moins", () => {
    expect(Object.keys(canonicalSealMaterial(LIGNES[0][1])).sort()).toEqual([...SEALED_FIELDS].sort());
  });

  it("la primitive est idempotente : la matière canonique est son propre point fixe", () => {
    for (const [, ligne] of LIGNES) {
      const une = canonicalSealMaterial(ligne);
      expect(canonicalSealMaterial(une)).toEqual(une);
      expect(claimContentHash(canonicalSealMaterial(une))).toBe(claimContentHash(une));
    }
  });

  it("`YYYY-MM-DD` en chaîne et `Date` à minuit UTC rendent la même matière", () => {
    const parDate = canonicalSealMaterial({ ...LIGNES[1][1], claimDate: new Date("2025-01-22T00:00:00.000Z") });
    const parChaine = canonicalSealMaterial({ ...LIGNES[1][1], claimDate: "2025-01-22" });
    expect(parDate).toEqual(parChaine);
  });

  it("MUTANT — `null → []` est la forme mesurée : la forme « actors absent » diverge", () => {
    // Elle n'est plus exprimable par la primitive ; il faut contourner le type.
    const canon = canonicalSealMaterial(LIGNES[0][1]);
    const absent = { ...canon, actors: undefined } as unknown as CanonicalSealMaterial;
    expect(claimContentHash(absent)).not.toBe(claimContentHash(canon));
    const nul = { ...canon, actors: null } as unknown as CanonicalSealMaterial;
    expect(claimContentHash(nul)).not.toBe(claimContentHash(canon));
  });

  it("chaîne vide et absence restent DISTINCTES à travers la primitive", () => {
    const vide = canonicalSealMaterial({ ...LIGNES[0][1], titleFr: "" });
    const absent = canonicalSealMaterial({ ...LIGNES[0][1], titleFr: null });
    expect(claimContentHash(vide)).not.toBe(claimContentHash(absent));
  });
});

// ═══ 2 · LES VÉRIFICATEURS CONSOMMENT, ILS NE RECOMPOSENT PAS ═══════════════

describe("SPINE-00 · B — isSealIntact et assertNoSilentRewrite passent par la primitive", () => {
  const ligne = LIGNES[0][1];
  const sceau = claimContentHash(canonicalSealMaterial(ligne));

  it("une révision lue avec `actors` NULL et un sceau canonique TIENT", () => {
    // Avant B, le garde hachait la ligne brute : `actors: null` donnait la
    // forme absente, et un sceau parfaitement valide passait pour cassé.
    expect(isSealIntact({ ...ligne, version: 1, contentHash: sceau })).toBe(true);
  });

  it("une révision lue avec `actors` en tableau vide rend le MÊME verdict", () => {
    expect(isSealIntact({ ...ligne, actors: [], version: 1, contentHash: sceau })).toBe(true);
  });

  it("un contenu altéré est toujours détecté", () => {
    expect(isSealIntact({ ...ligne, title: "réécrit", version: 1, contentHash: sceau })).toBe(false);
  });

  it("assertNoSilentRewrite compare des matières canoniques : NULL et [] ne sont pas un changement", () => {
    expect(() =>
      assertNoSilentRewrite(
        { ...ligne, actors: null, version: 1, contentHash: sceau },
        { ...ligne, actors: [], version: 1 },
      ),
    ).not.toThrow();
  });

  it("l'audit pur ne crie pas CONTENT_MUTATED sur une ligne brute au sceau canonique", () => {
    const constats = auditClaims([{ ...ligne, version: 1, contentHash: sceau }], new Set(["SRC-001"]));
    expect(constats).toEqual([]);
  });
});

// ═══ 3 · LE MUTANT EXIGÉ — l'écrivain ne recompose pas `actors` ═════════════

describe("SPINE-00 · B — le sceau de l'écrivain est celui que l'audit recalcule", () => {
  const SHA = "a".repeat(64);
  const request: FoundationRequest = {
    dossier: { ref: VINE_CASEFILE_REF, canonicalMint: VINE_MINT },
    snapshots: [{ id: "snap-1", canonicalMint: VINE_MINT, sha256: SHA, sourceUrl: "https://x.com/e/1", observedAt: "2025-12-07T10:00:00.000Z" }],
    sources: [{ kind: "FROM_SNAPSHOT", sourceId: "SRC-001", snapshotId: "snap-1", sourceType: "screenshot", caption: null }],
    existingClaims: [],
    claim: { casefileRef: VINE_CASEFILE_REF, claimId: "C1", rowNature: "PRIMARY_OBSERVATION", title: "Coordinated posting", claimDate: "2025-11-04", evidenceRefs: ["SRC-001"] },
  };

  it("TÉMOIN — le fondement, relu comme la base le rendrait, passe l'audit sans CONTENT_MUTATED", () => {
    const d = decideFoundation(request);
    expect(d.decision).toBe("FOUNDED");
    if (d.decision !== "FOUNDED") throw new Error("inatteignable");
    const row = d.foundation.claimToInsert;
    // Telle que la base la rendrait : `actors` en jsonb (tableau) ou NULL.
    for (const actors of [row.actors, null]) {
      const constats = auditClaims([{ ...row, actors, contentHash: row.contentHash }], new Set(["SRC-001"]));
      expect(constats.map((c) => c.kind)).toEqual([]);
    }
    expect(row.contentHash).toBe(claimContentHash(canonicalSealMaterial(row)));
  });

  it("MUTANT — `actors` réintroduit à la main dans la matière scellée casserait la compatibilité", () => {
    // Ce que ferait un writer qui recompose : prendre la charge brute où
    // `actors` est absent. La primitive rend `[]` ; la recomposition rend
    // l'absence. Les deux empreintes diffèrent — et c'est la seconde qui
    // crierait CONTENT_MUTATED au premier audit (0/16 sceaux réels).
    const d = decideFoundation(request);
    if (d.decision !== "FOUNDED") throw new Error("inatteignable");
    const row = d.foundation.claimToInsert;
    const recompose = { ...canonicalSealMaterial(row), actors: request.claim.actors } as unknown as CanonicalSealMaterial;
    expect(claimContentHash(recompose)).not.toBe(row.contentHash);
    const constats = auditClaims([{ ...row, contentHash: claimContentHash(recompose) }], new Set(["SRC-001"]));
    expect(constats.map((c) => c.kind)).toEqual(["CONTENT_MUTATED"]);
  });
});

// ═══ 4 · UNE SEULE ÉCRITURE — la structure tient la règle ═══════════════════

function fichiersSource(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "__tests__" || e === "node_modules" || e === ".next") continue;
      fichiersSource(p, out);
    } else if (/\.(ts|tsx|mts|mjs)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const PRIMITIVE = "src/lib/casefile/versioning.ts";

/** Les formes d'une matière scellée RECOMPOSÉE hors de la primitive. */
const RECOMPOSITIONS: ReadonlyArray<readonly [string, RegExp]> = [
  ["tableau d'acteurs normalisé à la main", /actors:\s*asStrings\(/],
  ["références normalisées à la main", /evidenceRefs:\s*asStrings\(/],
  ["jour de la date coupé à la main", /claimDate:[^,\n]*toISOString\(\)\.slice\(0,\s*10\)/],
  ["marque canonique posée par cast", /as\s+(?:unknown\s+as\s+)?CanonicalSealMaterial\b/],
  ["l'ancienne forme locale de l'écrivain", /\bformeScellable\b/],
];

describe("SPINE-00 · B — une seule écriture de la normalisation", () => {
  const sources = [...fichiersSource("src"), ...fichiersSource("scripts")];
  const code = new Map(sources.map((f) => [f, codeSeul(readFileSync(f, "utf8"))]));

  it("la primitive est définie UNE fois, dans versioning.ts, et y pose la marque UNE fois", () => {
    const v = code.get(PRIMITIVE)!;
    expect(v.match(/export function canonicalSealMaterial\(/g)?.length).toBe(1);
    expect(v.match(/as unknown as CanonicalSealMaterial/g)?.length).toBe(1);
    expect(v.match(/createHash\(/g)?.length).toBe(1);
    for (const [f, c] of code) {
      if (f === PRIMITIVE) continue;
      expect(c, f).not.toMatch(/function canonicalSealMaterial\(/);
    }
  });

  for (const [nom, re] of RECOMPOSITIONS) {
    it(`${nom} : 0 occurrence hors de la primitive`, () => {
      for (const [f, c] of code) {
        if (f === PRIMITIVE) continue;
        expect(c, f).not.toMatch(re);
      }
    });
  }

  it("chaque fichier qui hache un sceau consomme la primitive — et la liste est fermée", () => {
    const hachent = sources.filter((f) => f !== PRIMITIVE && /claimContentHash\(/.test(code.get(f)!)).sort();
    expect(hachent).toEqual([
      "scripts/casefile/seal-claims.ts",
      "src/lib/casefile/governedWriter.ts",
      "src/lib/casefile/sealGuard.ts",
    ]);
    for (const f of hachent) {
      expect(code.get(f), f).toMatch(/canonicalSealMaterial\(/);
      expect(code.get(f), f).toMatch(/import \{[^}]*\bcanonicalSealMaterial\b[^}]*\} from "(?:\.\/|@\/lib\/casefile\/)versioning"/);
    }
  });

  it("l'audit consomme la primitive et ne compose plus rien : ni asStrings, ni iso, ni composition champ à champ", () => {
    const audit = code.get("src/lib/casefile/integrityAudit.ts")!;
    expect(audit).toMatch(/\.\.\.canonicalSealMaterial\(r\)/);
    expect(audit).not.toMatch(/\basStrings\b|\biso\(/);
    expect(audit).not.toMatch(/actors:\s*[^,\n]+,/);
  });

  it("l'écrivain n'a plus de forme locale : son sceau vient de canonicalSealMaterial", () => {
    const writer = code.get("src/lib/casefile/governedWriter.ts")!;
    expect(writer.match(/canonicalSealMaterial\(/g)?.length).toBe(2); // la charge, et la dernière version existante
    expect(writer).not.toMatch(/\basStrings\b/);
  });
});

// ═══ 5 · CONTRÔLE D'ABSENCE — renderSupersedeSql est SORTI ══════════════════

describe("SPINE-00 · B — renderSupersedeSql n'existe plus dans le chemin capable de produire un sceau", () => {
  it("le module sealGuard ne l'exporte plus", () => {
    expect((sealGuard as Record<string, unknown>).renderSupersedeSql).toBeUndefined();
    expect(Object.keys(sealGuard).sort()).toEqual(["BrokenSealError", "SilentRewriteError", "assertNoSilentRewrite", "isSealIntact"]);
  });

  it("aucun code de src/ ni de scripts/ ne l'émet — mention en prose tolérée, émission refusée", () => {
    for (const f of [...fichiersSource("src"), ...fichiersSource("scripts")]) {
      expect(emisParLeCode(readFileSync(f, "utf8"), /\brenderSupersedeSql\b/), f).toBe(false);
    }
  });

  it("aucun test ne l'importe plus", () => {
    for (const f of readdirSync("__tests__/casefile").filter((e) => /\.test\.tsx?$/.test(e))) {
      const c = codeSeul(readFileSync(join("__tests__/casefile", f), "utf8"));
      expect(c, f).not.toMatch(/import[^;]*\brenderSupersedeSql\b/);
    }
  });

  it("la supplantation a UN chemin : l'écrivain gouverné, avec `supersedesVersion`", () => {
    const writer = codeSeul(readFileSync("src/lib/casefile/governedWriter.ts", "utf8"));
    expect(writer).toContain("supersedesVersion");
    expect(writer).toMatch(/version = derniere\.version \+ 1/);
  });
});
