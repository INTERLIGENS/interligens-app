// @vitest-environment jsdom
// ─── CC-OFFLINE-300 · L'IDENTITÉ N'EST PAS UNE INFO DE MARCHÉ ──────────────
//
// ██  LA LIQUIDITÉ EST DE L'INFO MARCHÉ, PAS DE L'INFO D'IDENTITÉ.         ██
// ██  MIEUX VAUT AMBIGUOUS QUE SCANNER LE MAUVAIS TOKEN.                   ██
//
// MESURÉ SUR LE SERVI par le fondateur : « $VINE » → ANALYZE → aucune liste,
// et le produit sélectionne SILENCIEUSEMENT `AB8QTQZpuQZ…` (« Vine Coin »,
// 47,8 M de liquidité) au lieu de `6AJcP7wu…pump`, le mint du dossier
// gouverné IL-SHILL-VINE-001. L'utilisateur ignore qu'un choix a été fait
// à sa place.
//
// Les candidats ci-dessous ne sont pas inventés : ce sont les CINQ que
// `/api/scan/resolve?ticker=VINE` a RÉELLEMENT servis le 2026-09-17, avec
// leurs liquidités mesurées. Donnée réelle, décision réelle.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decideResolution, type ResolvedTokenCandidate } from "@/lib/marketProviders";
import AdvancedSignals from "@/components/scan/AdvancedSignals";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/**
 * Un candidat au format EXACT de `ResolvedTokenCandidate`.
 * ⚠️ `address` et `symbol` n'appartiennent PAS à ce type : la route les ajoute
 *    en aval, pour le front. `decideResolution` ne lit que `mint`, `chain`,
 *    `matchType`, `source`, `liquidityUsd` et `lowLiquidity`.
 */
const c = (o: Partial<ResolvedTokenCandidate>): ResolvedTokenCandidate => ({
  ticker: "VINE", name: null, mint: "", chain: "SOL", liquidityUsd: null,
  volume24hUsd: null, pairCreatedAt: null, source: "dexscreener",
  matchType: "exact", lowLiquidity: false, kolCount: 0, ...o,
});

/** Les cinq candidats SERVIS pour « VINE », dans l'ordre servi. */
const VINE_SERVI: ResolvedTokenCandidate[] = [
  c({ mint: "AB8QTQZpuQZVTEJ6pqgsVki5PD4h4NreAdWz3aQ3bjSn", chain: "SOL", liquidityUsd: 47857163.17, name: "Vine Coin" }),
  c({ mint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHndpRpump", chain: "SOL", liquidityUsd: 1501795.5, name: "Vine Coin" }),
  c({ mint: "FunEaVysxMdrCvyspzZx9onqUG1o9ghj65mpzybAD4AU", chain: "SOL", liquidityUsd: 10066.33, name: "VINE" }),
  c({ mint: "HLJzUzWU7eFKDCvuoJ6cQCYxkinE1cXCZjxWJWwWpump", chain: "SOL", liquidityUsd: 7772.71, name: "Do it for the Vine" }),
  c({ mint: "0xbA614B596B7783a736D40B3EEAEa433D19d617BD", chain: "OTHER" as never, liquidityUsd: 6812628.67, name: "Vine Coin" }),
];

// ═══ 1 · L'IDENTITÉ ═════════════════════════════════════════════════════════

describe("CC-OFFLINE-300 · 1 — un ticker ambigu ne sélectionne plus en silence", () => {
  it("⛔ LES CINQ CANDIDATS RÉELLEMENT SERVIS ⇒ AMBIGUOUS", () => {
    // Quatre exactes sur SOL : quatre tokens réellement distincts. Aucun
    // ratio de liquidité ne peut plus les collapser en un seul.
    expect(decideResolution(VINE_SERVI)).toBe("ambiguous");
  });

  it("⛔ ET LE COURS NE CHANGE PLUS RIEN — c'est le défaut exact qui a été servi", () => {
    // Avant, la décision reposait sur `top.liquidityUsd / second.liquidityUsd`.
    // 47,8 M / 1,5 M = 31,9 ⇒ « resolved ». Deux heures plus tôt, les mêmes
    // entrées rendaient « ambiguous ». L'IDENTITÉ DÉPENDAIT D'UN COURS.
    for (const liq of [1, 1e3, 1e6, 1e9, 1e12]) {
      const variante = VINE_SERVI.map((x, i) => (i === 0 ? { ...x, liquidityUsd: liq } : x));
      expect(decideResolution(variante), `liq=${liq}`).toBe("ambiguous");
    }
  });

  it("▎ LA RÈGLE DE DOMINANCE CROSS-CHAIN EST INTACTE — une seule exacte par chaîne", () => {
    // Le cas pour lequel elle a été écrite, et le seul qu'elle voit désormais.
    const croise = [
      c({ mint: "A", chain: "SOL", liquidityUsd: 1_000_000 }),
      c({ mint: "0xB", chain: "ETH", liquidityUsd: 100_000 }),
    ];
    expect(decideResolution(croise), "ratio 10 ⇒ dominance").toBe("resolved");
    const serre = [
      c({ mint: "A", chain: "SOL", liquidityUsd: 120_000 }),
      c({ mint: "0xB", chain: "ETH", liquidityUsd: 100_000 }),
    ];
    expect(decideResolution(serre), "ratio 1,2 ⇒ ambigu").toBe("ambiguous");
  });

  it("⛔ NON-RÉGRESSION BOTIFY — 1 seul candidat curated ⇒ RESTE resolved", () => {
    // Mesuré sur le servi : `status=resolved · source=curated · 1 candidat`.
    // `exacts.length === 1` ⇒ aucune branche d'ambiguïté n'est même atteinte.
    const botify = [
      c({
        mint: "BYZ9CcZGKAXmN2uDsKcQMM9UnZacija4vWcns9Th69xb",
        chain: "SOL", source: "curated", liquidityUsd: null, ticker: "BOTIFY",
      }),
    ];
    expect(decideResolution(botify)).toBe("resolved");
  });

  it("le reste du contrat est INCHANGÉ", () => {
    expect(decideResolution([])).toBe("not_found");
    // Un préfixe en tête n'est jamais auto-choisi. (Le vocabulaire exact du
    // dépôt est `symbol_starts_with_query`, pas « prefix ».)
    expect(decideResolution([
      c({ mint: "A", matchType: "symbol_starts_with_query" }),
      c({ mint: "B" }),
    ])).toBe("ambiguous");
    // Une exacte seule et illiquide reste refusée.
    expect(decideResolution([c({ mint: "A", lowLiquidity: true })])).toBe("ambiguous");
  });

  it("⛔ AUCUN TICKER EN DUR, AUCUNE PRÉFÉRENCE POUR NOS DOSSIERS", () => {
    const code = lire("src/lib/marketProviders.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const interdit of ["VINE", "BOTIFY", "casefile", "canonicalRef", "IL-SHILL"]) {
      expect(code, interdit).not.toContain(interdit);
    }
    // Le seuil de dominance est celui qui existait : 2. Rien n'a été ajouté.
    expect(code).toContain("if (!(ratio >= 2)) return \"ambiguous\";");
    expect(code).toContain("const ratio = b > 0 ? a / b : a > 0 ? Infinity : 0;");
  });
});

// ═══ 2 · LE CADRAGE ═════════════════════════════════════════════════════════
//
// ▎ ⚠️ MÊME LIMITE QU'EN CC-OFFLINE-298 : jsdom n'a AUCUN moteur de mise en
// ▎ page. Il ne calcule ni largeur, ni débordement. Ces témoins vérifient que
// ▎ LES PROPRIÉTÉS QUI CAUSAIENT LA COUPURE SONT POSÉES — pas que le pixel
// ▎ est juste. L'ACCEPTATION VISUELLE RESTE LE NAVIGATEUR DU FONDATEUR.

describe("CC-OFFLINE-300 · 2 — le badge n'est plus coupé", () => {
  const base = { lang: "en" as const, rawSummary: { markets: { data_unavailable: true } } };

  it("le badge le plus long est RENDU, entier", () => {
    render(<AdvancedSignals {...base} tier="GREEN" manipulationLevel={null} coverageSufficient={false} />);
    const badges = screen.getAllByText("NOT ESTABLISHED");
    expect(badges.length).toBeGreaterThan(0);
    // Il ne se comprime pas : c'est `bVal` qui cède.
    expect((badges[0] as HTMLElement).style.flexShrink).toBe("0");
    expect((badges[0] as HTMLElement).style.whiteSpace).toBe("nowrap");
  });

  it("la carte peut RÉTRÉCIR — sans quoi l'ellipsis ne s'active jamais", () => {
    render(<AdvancedSignals {...base} tier="GREEN" manipulationLevel={null} coverageSufficient={false} />);
    const valeur = screen.getByText("Coordination: not measured") as HTMLElement;
    const carte = valeur.closest("div")?.parentElement as HTMLElement;
    expect(carte.style.minWidth).toBe("0px");
    expect(valeur.style.textOverflow).toBe("ellipsis");
  });

  it("⛔ LE MUTANT — les propriétés de cadrage sont posées, et sans media query", () => {
    const code = lire("src/components/scan/AdvancedSignals.tsx");
    expect(code).toContain("minWidth: 0,");
    expect(code).toContain("flexShrink: 0,");
    expect(code).not.toContain('gridTemplateColumns: "repeat(2, 1fr)"');
    const grilles = [...code.matchAll(/repeat\(auto-fit, minmax\(190px, 1fr\)\)/g)];
    expect(grilles.length).toBe(2);
    expect(code).not.toContain("@media");
  });

  it("⛔ PRÉSENTATION SEULE — aucune donnée, aucun score, aucune autorité touchés", () => {
    const code = lire("src/components/scan/AdvancedSignals.tsx");
    // La garde de coordination de CC-OFFLINE-298 est intacte…
    expect(code).toContain("const coordinationNonEtablie = coverageSufficient === false && cabal.drivers.length === 0;");
    // …celle d'influence de CC-OFFLINE-296 aussi.
    expect(code).toContain("const influenceNonEtablie =");
    // …et `cabal.ts` n'a pas été touché.
    const cabal = lire("src/lib/risk/cabal.ts");
    expect(cabal).toContain("let score = 20;");
    expect(cabal).not.toContain("coverageSufficient");
  });
});
