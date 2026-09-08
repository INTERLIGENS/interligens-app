// ─── BUILD 10 / P0 PUBLIC — LES 5 OCCURRENCES MESURÉES ────────────────────
//
// Mesuré en GET NON AUTHENTIFIÉ sur la production du 2026-09-08 :
//
//   scan/timeline : pivotAddress (1) + chapters[2,3,4,6].evidence (4)
//   scan/solana   : off_chain.claims[2,3,4,6].thread_url (4, LES MÊMES URL)
//
// La règle de valeur, ruling GPT :
//   43 synthétique -> resolveToCanonicalMint -> 44 canonique
//   résolution en échec -> OMISSION
//   jamais l'identité synthétique brute, jamais une substitution inventée.

import { describe, it, expect } from "vitest";
import {
  projectPublicMint,
  safeEvidenceUrl,
} from "@/lib/kol-memory/publicIdentityProjection";
import { BOTIFY_MINT, BOTIFY_SYNTHETIC_ROUTE_KEY } from "@/lib/kol-memory/tokenIdentity";

/** Les 4 thread_url stockées dans botify.json, mesurées identiques sur les 2 routes. */
const LES_4_URL = [
  `https://dexscreener.com/solana/${BOTIFY_SYNTHETIC_ROUTE_KEY}`,
  `https://solscan.io/token/${BOTIFY_SYNTHETIC_ROUTE_KEY}`,
  `https://rugcheck.xyz/tokens/${BOTIFY_SYNTHETIC_ROUTE_KEY}`,
  `https://solscan.io/token/${BOTIFY_SYNTHETIC_ROUTE_KEY}#holders`,
];

describe("OCCURRENCE 1 — pivotAddress de scan/timeline", () => {
  it("le mint synthétique est projeté sur le CANONIQUE", () => {
    expect(projectPublicMint(BOTIFY_SYNTHETIC_ROUTE_KEY, "t")).toBe(BOTIFY_MINT);
  });

  it("interrogé avec le canonique, il rend le canonique — pas de réécriture inutile", () => {
    expect(projectPublicMint(BOTIFY_MINT, "t")).toBe(BOTIFY_MINT);
  });

  it("l'identité synthétique brute n'est JAMAIS rendue", () => {
    expect(projectPublicMint(BOTIFY_SYNTHETIC_ROUTE_KEY, "t")).not.toBe(
      BOTIFY_SYNTHETIC_ROUTE_KEY,
    );
  });

  it("MUTANT M5 — une résolution qui ÉCHOUE rend null, jamais le brut", () => {
    for (const mauvais of ["", "trop-court", "!!!", null, undefined, 42]) {
      expect(projectPublicMint(mauvais as unknown, "t")).toBeNull();
    }
  });

  it("MUTANT M6 — aucune constante inventée : la seule valeur émise est le canonique", () => {
    const out = projectPublicMint(BOTIFY_SYNTHETIC_ROUTE_KEY, "t");
    expect(out).toBe(BOTIFY_MINT);
    expect(out).not.toBe("UNKNOWN");
    expect(out).not.toBe("REDACTED");
  });
});

describe("OCCURRENCES 2 à 5 — les 4 evidence / thread_url", () => {
  it("les 4 URL stockées sont toutes réécrites sur le canonique", () => {
    for (const u of LES_4_URL) {
      const out = safeEvidenceUrl(u);
      expect(out).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
      expect(out).toContain(BOTIFY_MINT);
    }
  });

  it("le fragment et le chemin sont préservés — l'URL est corrigée, pas inventée", () => {
    expect(safeEvidenceUrl(`https://solscan.io/token/${BOTIFY_SYNTHETIC_ROUTE_KEY}#holders`)).toBe(
      `https://solscan.io/token/${BOTIFY_MINT}#holders`,
    );
    expect(safeEvidenceUrl(`https://rugcheck.xyz/tokens/${BOTIFY_SYNTHETIC_ROUTE_KEY}`)).toBe(
      `https://rugcheck.xyz/tokens/${BOTIFY_MINT}`,
    );
  });

  it("une URL sans identité fermée est rendue INCHANGÉE", () => {
    const u = "https://twitter.com/search?q=%24BOTIFY&src=typed_query";
    expect(safeEvidenceUrl(u)).toBe(u);
  });

  it("MUTANT M4 — une adresse de wallet valide n'est PAS omise ni réécrite", () => {
    const w = "5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj";
    expect(safeEvidenceUrl(`https://solscan.io/account/${w}`)).toBe(
      `https://solscan.io/account/${w}`,
    );
  });

  it("une URL absente rend la chaîne vide, sans lever", () => {
    expect(safeEvidenceUrl(null)).toBe("");
    expect(safeEvidenceUrl(undefined)).toBe("");
  });
});

describe("Post-condition — 0 mint synthétique OÙ QUE CE SOIT", () => {
  it("sur une projection complète simulant les deux routes", () => {
    const projection = JSON.stringify({
      pivotAddress: projectPublicMint(BOTIFY_SYNTHETIC_ROUTE_KEY, "t"),
      chapters: LES_4_URL.map((u) => ({ evidence: safeEvidenceUrl(u) })),
      claims: LES_4_URL.map((u) => ({ thread_url: safeEvidenceUrl(u) })),
    });
    expect(projection).not.toContain(BOTIFY_SYNTHETIC_ROUTE_KEY);
    expect(projection.split(BOTIFY_MINT).length - 1).toBe(9);
  });

  it("la gate canonique n'est pas dupliquée — elle est appelée", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/kol-memory/publicIdentityProjection.ts", "utf8"),
    );
    expect(src).toContain('from "./tokenIdentity"');
    // Aucune constante d'identité réécrite localement.
    expect(src).not.toContain("BYZ9CcZ");
  });
});
