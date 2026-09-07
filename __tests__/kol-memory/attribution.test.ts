// ─── BUILD 8 / P0 — L'attribution ne remonte jamais l'échelle ──────────────
//
// Le défaut corrigé : `resolveWalletToKol` rendait `exact` / `manual` EN DUR
// dès qu'une ligne existait. Mesuré sur ep-square-band le 2026-09-07, 482
// KolWallet actifs — les 482 ressortaient au rang d'autorité MAXIMAL.
//
// Second défaut, découvert en mesurant : le vocabulaire que l'ancien
// `mapDbSource` traduisait n'existe DANS AUCUNE LIGNE (0/482). La dérivation
// se fait donc sur `claimType`, seul vocabulaire réellement peuplé.

import { describe, it, expect } from "vitest";
import {
  deriveAttributionConfidence,
  deriveAttributionSource,
  declaredSourceLabel,
  requiresHumanReview,
  assertNoUpgrade,
  AttributionUpgradeError,
  type WalletMatchConfidence,
} from "@/lib/kol-memory/attribution";

// Les combinaisons réellement présentes en base, avec leur effectif mesuré.
const CORPUS_REEL = [
  { claimType: "source_attributed", attributionStatus: "confirmed", confidence: "high", n: 231 },
  { claimType: "source_attributed", attributionStatus: "review", confidence: "medium", n: 180 },
  { claimType: "analytical_estimate", attributionStatus: "review", confidence: "medium", n: 28 },
  { claimType: "verified_onchain", attributionStatus: "confirmed", confidence: "high", n: 15 },
  { claimType: "source_attributed", attributionStatus: "review", confidence: "high", n: 6 },
  { claimType: "attributed", attributionStatus: "review", confidence: "medium", n: 5 },
  { claimType: "source_attributed", attributionStatus: "review", confidence: "low", n: 3 },
  { claimType: "source_attributed", attributionStatus: "unverified", confidence: "medium", n: 2 },
  { claimType: "source_attributed", attributionStatus: "review", confidence: "suspected", n: 2 },
  { claimType: "verified_onchain", attributionStatus: "review", confidence: "high", n: 2 },
  { claimType: "verified_onchain", attributionStatus: "approved", confidence: "high", n: 2 },
  { claimType: "onchain_confirmed", attributionStatus: "confirmed", confidence: "high", n: 2 },
  { claimType: "source_attributed", attributionStatus: "confirmed", confidence: "confirmed", n: 1 },
  { claimType: "analytical_estimate", attributionStatus: "review", confidence: "low", n: 1 },
  { claimType: "onchain_confirmed", attributionStatus: "confirmed", confidence: "low", n: 1 },
  { claimType: "self_posted", attributionStatus: "review", confidence: "high", n: 1 },
];

describe("BUILD 8 / P0 — dérivation de la confiance d'attribution", () => {
  it("`exact` exige confirmed ET verified_onchain, les deux ensemble", () => {
    expect(
      deriveAttributionConfidence({
        attributionStatus: "confirmed",
        claimType: "verified_onchain",
      }),
    ).toBe("exact");
  });

  it("le palier `exact` est ATTEINT — 15 lignes, pas une branche morte", () => {
    const exactes = CORPUS_REEL.filter(
      (r) => deriveAttributionConfidence(r) === "exact",
    ).reduce((n, r) => n + r.n, 0);
    expect(exactes).toBe(15);
  });

  it("confirmed SANS verified_onchain ne donne pas `exact` — il donne `strong`", () => {
    // Le cas dominant : 231 lignes confirmed/source_attributed. Le produit a
    // confirmé, mais il CROIT une source, il n'a rien constaté lui-même.
    expect(
      deriveAttributionConfidence({
        attributionStatus: "confirmed",
        claimType: "source_attributed",
        confidence: "high",
      }),
    ).toBe("strong");
  });

  it("verified_onchain SANS confirmed ne donne pas `exact` non plus", () => {
    for (const s of ["review", "approved", "unverified"]) {
      expect(
        deriveAttributionConfidence({ attributionStatus: s, claimType: "verified_onchain" }),
        s,
      ).not.toBe("exact");
    }
  });

  it("les synonymes NE SONT PAS rapprochés — `onchain_confirmed` n'est pas `verified_onchain`", () => {
    // La fusion des synonymes de KolWallet est une tâche identifiée à part
    // (registre Data Nature, étape S4). La décider ici serait décider à sa place.
    expect(
      deriveAttributionConfidence({
        attributionStatus: "confirmed",
        claimType: "onchain_confirmed",
        confidence: "high",
      }),
    ).toBe("strong");
  });

  it("le cas mesuré : les 180 lignes `review` ne sortent PAS en `exact`", () => {
    const review = {
      attributionStatus: "review",
      confidence: "medium",
      claimType: "source_attributed",
    };
    expect(deriveAttributionConfidence(review)).toBe("probable");
    expect(deriveAttributionConfidence(review)).not.toBe("exact");
  });

  it("AUCUNE combinaison réelle ne rend `exact` sans les deux conditions", () => {
    for (const row of CORPUS_REEL) {
      if (deriveAttributionConfidence(row) === "exact") {
        expect(row.attributionStatus, JSON.stringify(row)).toBe("confirmed");
        expect(row.claimType, JSON.stringify(row)).toBe("verified_onchain");
      }
    }
  });

  // ── Fail-closed : toute forme inattendue descend, jamais ne monte ────────
  it("une valeur absente, nulle, vide ou d'un autre type → candidate", () => {
    for (const v of [undefined, null, "", "GARBAGE", 1, true, {}, []]) {
      expect(
        deriveAttributionConfidence({ attributionStatus: v, confidence: v, claimType: v }),
        JSON.stringify(v),
      ).toBe("candidate");
    }
  });

  it("une ligne entièrement vide → candidate, jamais exact", () => {
    expect(deriveAttributionConfidence({})).toBe("candidate");
  });
});

describe("BUILD 8 / P0 — le vocabulaire legacy était une fiction", () => {
  it("les 5 valeurs de l'ancien enum n'apparaissent dans aucune ligne réelle", () => {
    // Mesuré : SELECT count(*) ... WHERE attributionSource IN (...) → 0/482.
    const LEGACY = ["manual", "on_chain_footprint", "airdrop", "promotion_tx", "inferred"];
    const provenancesReelles = [
      "botify_leaked_doc", "botify_leak_doc_confirmed", "sns", "ens", "gmgn_apify_2026",
      "friendtech_2023", "arkham_intel", "bhw_2025", "botify_investigation", "dune_4838225",
      "interligens_ghost_investigation", "casefile_bubblemaps_zachxbt", "leaked_doc",
      "on-chain analysis", "cluster_analysis", "dethective_swif_thread",
    ];
    for (const p of provenancesReelles) expect(LEGACY, p).not.toContain(p);
  });

  it("`manual` est INATTEIGNABLE sur les données réelles — et c'est le bon résultat", () => {
    // Aucune ligne n'enregistre qu'un humain a posé l'attribution à la main.
    // Le type reste plus large que la donnée ; ce test consigne l'écart.
    for (const row of CORPUS_REEL) {
      expect(deriveAttributionSource(row), JSON.stringify(row)).not.toBe("manual");
    }
  });

  it("`verified_onchain` est la seule voie vers `on_chain_footprint`", () => {
    expect(deriveAttributionSource({ claimType: "verified_onchain" })).toBe("on_chain_footprint");
    for (const c of ["source_attributed", "analytical_estimate", "attributed", "", null]) {
      expect(deriveAttributionSource({ claimType: c }), String(c)).toBe("inferred");
    }
  });

  it("la provenance déclarée est rendue VERBATIM, jamais normalisée", () => {
    expect(declaredSourceLabel({ attributionSource: "botify_leaked_doc" })).toBe(
      "botify_leaked_doc",
    );
    expect(declaredSourceLabel({ attributionSource: "on-chain analysis" })).toBe(
      "on-chain analysis",
    );
    for (const v of [null, undefined, "", 42]) {
      expect(declaredSourceLabel({ attributionSource: v }), String(v)).toBeNull();
    }
  });
});

describe("BUILD 8 / P0 — la revue humaine se lit dans la donnée", () => {
  it("tout ce qui n'est pas `confirmed` exige une revue", () => {
    for (const s of ["review", "unverified", "approved", "", undefined, null]) {
      expect(requiresHumanReview({ attributionStatus: s }), String(s)).toBe(true);
    }
  });

  it("`confirmed` n'en exige pas", () => {
    expect(requiresHumanReview({ attributionStatus: "confirmed" })).toBe(false);
  });

  it("`approved` n'est PAS `confirmed` — les 2 lignes mesurées restent en revue", () => {
    expect(requiresHumanReview({ attributionStatus: "approved" })).toBe(true);
  });
});

describe("BUILD 8 / P0 — I1 : le garde mécanique contre la remontée", () => {
  it("laisse passer une dérivation conforme", () => {
    const row = { attributionStatus: "confirmed", claimType: "verified_onchain" };
    expect(assertNoUpgrade(row, "exact", "test")).toBe("exact");
  });

  it("laisse passer une dérivation PLUS PRUDENTE que le plafond", () => {
    const row = { attributionStatus: "confirmed", claimType: "verified_onchain" };
    expect(assertNoUpgrade(row, "candidate", "test")).toBe("candidate");
  });

  it("REFUSE toute dérivation au-dessus de ce que la ligne porte", () => {
    const review = { attributionStatus: "review", confidence: "low" };
    for (const trop of ["exact", "strong", "probable"] as WalletMatchConfidence[]) {
      expect(() => assertNoUpgrade(review, trop, "test"), trop).toThrow(AttributionUpgradeError);
    }
  });

  it("MUTANT — réintroduire `exact` en dur devient rouge sur le corpus réel", () => {
    // C'est littéralement l'ancien comportement : rendre `exact` parce qu'une
    // ligne existe. 467 des 482 lignes le refusent désormais.
    const refusees = CORPUS_REEL.filter((row) => {
      try {
        assertNoUpgrade(row, "exact", "MUTANT");
        return false;
      } catch {
        return true;
      }
    }).reduce((n, r) => n + r.n, 0);
    expect(refusees).toBe(482 - 15);
  });
});
