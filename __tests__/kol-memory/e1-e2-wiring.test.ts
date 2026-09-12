// ─── BUILD 8 / E2 + E1 — le câblage des 4 fichiers gelés ───────────────────
//
// Ces quatre fichiers ne portent aucune logique propre : ils branchent ce que
// src/lib/kol-memory/ décide. Ces tests vérifient que la délégation est réelle
// et que le défaut d'origine ne peut pas revenir par la porte de derrière.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOTIFY_MINT,
  BOTIFY_SYNTHETIC_ROUTE_KEY,
} from "@/lib/kol-memory/tokenIdentity";

import { emisParLeCode } from "../casefile/codeSeul";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const CASEFILE = lire("src/app/api/casefile/route.ts");
const PUBLIC = lire("src/app/api/casefile/public/route.ts");
const PDF = lire("src/app/api/casefile/pdf/route.ts");
const CANONICAL = lire("src/lib/kol/canonical.ts");

describe("BUILD 8 / E2 — /api/casefile : le KO signalé par T1", () => {
  it("la constante 43 caractères déclarée en ligne a DISPARU", () => {
    // C'est elle qui faisait porter le verdict public à une clé qui n'existe
    // dans aucune ligne de la base.
    expect(emisParLeCode(CASEFILE, BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe(false);
    expect(emisParLeCode(CASEFILE, /^const BOTIFY_MINT = "/m)).toBe(false);
  });

  // ── BUILD 9 / ÉTAPE 7 — les propriétés survivent, la CASE_DB non ────────
  //
  // Ces trois tests épinglaient la carte `CASE_DB` déclarée dans la route :
  // sa clef (`[BOTIFY_MINT]: {`), sa lecture (`CASE_DB[lookupKey]`) et le
  // garde-fou de score qui la comparait. Elle n'existe plus — la route lit
  // l'autorité canonique.
  //
  // Ce qu'ils GARANTISSAIENT tient toujours, et c'est ce qui est vérifié ici :
  // la route ne porte aucune carte locale de dossiers, et tout ce qui décide
  // se fait sur l'identité RÉSOLUE, jamais sur l'entrée brute.

  it("la route ne porte plus aucune carte locale de dossiers", () => {
    expect(emisParLeCode(CASEFILE, "CASE_DB")).toBe(false);
    expect(CASEFILE).toContain("@/lib/kol-memory/tokenIdentity");
    expect(CASEFILE).toContain("loadCanonicalCaseFile");
  });

  it("MUTANT — la résolution du dossier part de la clé RÉSOLUE", () => {
    // Sans le contrat d'alias, ?mint=<canonique> ratait la carte → GREEN/0.
    // La cible a changé de nature ; la règle, non.
    expect(emisParLeCode(CASEFILE, "canonicalRefForMint(sanitizeMint)")).toBe(false);
    expect(CASEFILE).toContain("casefileLookupKey(sanitizeMint)");
    expect(CASEFILE).toContain("canonicalRefForMint(lookupKey)");
  });

  it("le garde-fou de scoring compare sur la clé résolue, pas sur l'entrée brute", () => {
    expect(CASEFILE).toContain("lookupKey === BOTIFY_MINT");
    expect(emisParLeCode(CASEFILE, "sanitizeMint === BOTIFY_MINT")).toBe(false);
  });
});

describe("BUILD 8 / E2 — les deux routes de dossier publiées", () => {
  // ── BUILD 9 / ÉTAPE 5 — le lockstep n'a plus à être surveillé ────────────
  //
  // E2 exigeait que les DEUX routes portent la même carte mint → preset, clé
  // sur le mint canonique et jamais sur l'alias synthétique. Deux cartes à
  // tenir d'accord, et un test pour vérifier qu'elles le restaient.
  //
  // Il n'y en a plus qu'UNE, partagée : `CANONICAL_REF_BY_MINT`. Le lockstep
  // n'est plus une propriété à surveiller, c'est une propriété qu'on ne peut
  // plus casser — la meilleure fin possible pour ce test.
  //
  // Ce qui reste vérifié, parce que ça reste cassable : aucune des deux routes
  // ne réintroduit l'alias en dur, et les deux résolvent le même sujet.
  it("aucune des deux routes ne porte l'alias synthétique en dur", () => {
    for (const [nom, src] of Object.entries({ PUBLIC, PDF })) {
      expect(emisParLeCode(src, BOTIFY_SYNTHETIC_ROUTE_KEY), nom).toBe(false);
      expect(src, nom).toContain("canonicalRefForMint");
    }
  });

  it("une seule carte — l'alias et le canonique ouvrent le même dossier", async () => {
    const { canonicalRefForMint } = await import("@/lib/casefile/publicProjection");
    const parCanonique = canonicalRefForMint(BOTIFY_MINT);
    expect(parCanonique).toBeTruthy();
    expect(canonicalRefForMint(BOTIFY_SYNTHETIC_ROUTE_KEY)).toBe(parCanonique);
  });
});

describe("BUILD 8 / E2 — invariants de régression du dossier BOTIFY", () => {
  it("le mint canonique ouvre le dossier attendu", async () => {
    const { loadCaseByMint } = await import("@/lib/caseDb");
    const dossier = loadCaseByMint(BOTIFY_MINT);
    expect(dossier).not.toBeNull();
    expect(dossier?.case_meta?.case_id).toBeTruthy();
    expect((dossier?.claims ?? []).length).toBeGreaterThan(0);
  });

  it("la clé synthétique résout vers LE MÊME dossier — jamais un second", async () => {
    const { loadCaseByMint } = await import("@/lib/caseDb");
    const parCanonique = loadCaseByMint(BOTIFY_MINT);
    const parAlias = loadCaseByMint(BOTIFY_SYNTHETIC_ROUTE_KEY);
    expect(parAlias).not.toBeNull();
    expect(parAlias?.case_meta?.case_id).toBe(parCanonique?.case_meta?.case_id);
    expect(parAlias?.claims?.length).toBe(parCanonique?.claims?.length);
  });

  it("JAMAIS deux vérités concurrentes — un mint inconnu n'ouvre rien", async () => {
    const { loadCaseByMint } = await import("@/lib/caseDb");
    expect(loadCaseByMint("So11111111111111111111111111111111111111112")).toBeNull();
    // Et un base58 de 44 caractères inconnu non plus : la longueur ne fait pas
    // l'identité.
    expect(loadCaseByMint("So1111111111111111111111111111111111111111ab")).toBeNull();
  });
});

describe("BUILD 8 / E1 — canonical.ts résout avant d'interroger", () => {
  it("le findUnique strict sur l'entrée brute a disparu", () => {
    expect(emisParLeCode(CANONICAL, "where: { handle },")).toBe(false);
    expect(CANONICAL).toContain("resolveCanonicalHandle");
    expect(CANONICAL).toContain("where: { handle: resolved.handle }");
  });

  it("les trois refus rendent null, sans repli", () => {
    expect(CANONICAL).toContain("if (!resolved.handle) return null;");
  });

  it("la résolution vient du module hors gel", () => {
    expect(CANONICAL).toContain("@/lib/kol-memory/handleResolution");
  });
});
