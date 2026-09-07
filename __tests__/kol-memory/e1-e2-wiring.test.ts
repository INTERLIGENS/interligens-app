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

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** Le code seul — les en-têtes CITENT l'alias pour l'expliquer. */
const codeSeul = (src: string) =>
  src
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

const CASEFILE = lire("src/app/api/casefile/route.ts");
const PUBLIC = lire("src/app/api/casefile/public/route.ts");
const PDF = lire("src/app/api/casefile/pdf/route.ts");
const CANONICAL = lire("src/lib/kol/canonical.ts");

describe("BUILD 8 / E2 — /api/casefile : le KO signalé par T1", () => {
  it("la constante 43 caractères déclarée en ligne a DISPARU", () => {
    // C'est elle qui faisait porter le verdict public à une clé qui n'existe
    // dans aucune ligne de la base.
    expect(codeSeul(CASEFILE)).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
    expect(CASEFILE).not.toMatch(/^const BOTIFY_MINT = "/m);
  });

  it("le mint canonique vient du module d'autorité", () => {
    expect(CASEFILE).toContain("@/lib/kol-memory/tokenIdentity");
    expect(CASEFILE).toContain("[BOTIFY_MINT]: {");
  });

  it("MUTANT — la lecture directe `CASE_DB[sanitizeMint]` a disparu", () => {
    // Sans le contrat d'alias, ?mint=<canonique> ratait la carte → GREEN/0.
    expect(codeSeul(CASEFILE)).not.toContain("CASE_DB[sanitizeMint]");
    expect(CASEFILE).toContain("casefileLookupKey(sanitizeMint)");
    expect(CASEFILE).toContain("CASE_DB[lookupKey]");
  });

  it("le garde-fou de scoring compare sur la clé résolue, pas sur l'entrée brute", () => {
    expect(CASEFILE).toContain("casefileLookupKey(mint) === BOTIFY_MINT");
  });
});

describe("BUILD 8 / E2 — les deux routes de dossier publiées", () => {
  it("public et pdf sont clé sur le canonique, plus sur l'alias", () => {
    for (const [nom, src] of Object.entries({ PUBLIC, PDF })) {
      expect(codeSeul(src), nom).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
      expect(src, nom).toContain("[BOTIFY_MINT]: \"botify\"");
      expect(src, nom).toContain("casefileLookupKey(mint)");
    }
  });

  it("les deux cartes restent en lockstep — même clé, même préset", () => {
    const cle = (s: string) => /\[BOTIFY_MINT\]: "botify"/.test(s);
    expect(cle(PUBLIC)).toBe(true);
    expect(cle(PDF)).toBe(true);
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
    expect(codeSeul(CANONICAL)).not.toContain("where: { handle },");
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
