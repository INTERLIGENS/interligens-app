// ─── CC-OFFLINE-276 · P1 — L'ALIAS BOTIFY SYNTHÉTIQUE ──────────────────────
//
// ██  LA DÉCOUVERTE NORMALE NE DOIT PAS SÉLECTIONNER UNE ADRESSE             ██
// ██  QUI N'EXISTE NULLE PART.                                               ██
//
// LA QUESTION POSÉE, et elle seule : la découverte produit normale par un
// humain peut-elle sélectionner ou recevoir l'adresse synthétique ?
//
// MESURÉ : OUI. Les puces de preset des deux pages de démo portaient la clé de
// route synthétique à 43 caractères — celle qui n'existe dans AUCUNE ligne de
// la base et n'a aucune existence on-chain. Un clic sur « BOTIFY » ou sur la
// puce « Scam » la sélectionnait.
//
// ⛔ CE TÉMOIN NE ROUVRE PAS la sémantique forensique BOTIFY.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY } from "@/lib/kol-memory/tokenIdentity";

const PAGES = ["src/app/en/demo/page.tsx", "src/app/fr/demo/page.tsx"] as const;
const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

describe("P1 · les deux identités, et ce qui les sépare", () => {
  it("la synthétique fait 43 caractères, le mint canonique 44", () => {
    expect(BOTIFY_SYNTHETIC_ROUTE_KEY).toHaveLength(43);
    expect(BOTIFY_MINT).toHaveLength(44);
    expect(BOTIFY_SYNTHETIC_ROUTE_KEY).not.toBe(BOTIFY_MINT);
  });
});

describe("P1 · le chemin de découverte normal", () => {
  for (const p of PAGES) {
    const code = sansCommentaires(lire(p));

    it(`${p} — AUCUNE puce ne porte la clé synthétique`, () => {
      expect(code).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
    });

    it(`${p} — le mint canonique vient de son AUTORITÉ, jamais d'un littéral`, () => {
      // S19 : recopier le littéral fabriquerait une autorité de plus sur le
      // même fait. La page CONSOMME la constante.
      expect(code).toContain('import { BOTIFY_MINT } from "@/lib/kol-memory/tokenIdentity";');
      expect(code).toContain("addr: BOTIFY_MINT");
      expect(code).not.toContain(`"${BOTIFY_MINT}"`);
    });

    it(`${p} — les deux points d'entrée BOTIFY sont corrigés, pas un seul`, () => {
      // La puce nommée ET la puce de scénario « Scam / Arnaque ».
      const occurrences = [...code.matchAll(/addr: BOTIFY_MINT/g)];
      expect(occurrences.length).toBe(2);
    });
  }
});

describe("P1 · MUTANT — réintroduire la synthétique fait rougir", () => {
  it("la clé synthétique reste RECONNAISSABLE, donc refusable", () => {
    // Elle n'est pas supprimée du dépôt : des URL, des snapshots
    // d'anti-régression et des artefacts la portent déjà. Elle est conservée
    // pour être RECONNUE et REFUSÉE, pas pour être utilisée.
    expect(BOTIFY_SYNTHETIC_ROUTE_KEY.startsWith("BYZ9")).toBe(true);
    expect(BOTIFY_MINT.startsWith("BYZ9")).toBe(true);
    // Un caractère les sépare : c'est précisément pourquoi un littéral recopié
    // à la main est un piège, et pourquoi la page consomme l'autorité.
    expect(BOTIFY_MINT.replace("ija4", "ja4")).toBe(BOTIFY_SYNTHETIC_ROUTE_KEY);
  });
});
