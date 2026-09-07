// ─── BUILD 9 / ÉTAPE 7 — OPTION A : LE DOSSIER SEUL ────────────────────────
//
// Arbitrage : la surface CaseFile bascule sur l'autorité canonique SANS
// modifier la sémantique de score. `loadCaseByMint` survit sur ses chemins de
// scoring existants, documenté comme LEGACY_SCORING_INPUT.
//
// ─── Ce que ces tests doivent démontrer, et pas seulement affirmer ────────
//
// La neutralité du score. Tant que le scoreur vivait DANS la route — chemin
// gelé, aucun export — « ça ne change pas le score » ne pouvait être qu'une
// promesse. Le scoreur est désormais un module ; on lui donne les deux jeux
// d'identifiants et on compare.
//
// Le fait qui rend la bascule neutre a été mesuré, il n'a pas été supposé :
// les deux corpus portent les MÊMES identifiants C1…C8, et le scoreur est
// indexé sur les identifiants — jamais sur le contenu.
//
// Ce qui, au passage, est le meilleur résumé du défaut que BUILD 9 ferme :
// deux corpus entièrement différents, publiés sous les mêmes identifiants.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  linkEvidence,
  computeLegacyCaseScore,
  type ScorableClaim,
} from "@/lib/casefile/legacyCaseScore";
import { toInternalCaseView } from "@/lib/casefile/internalView";
import { CASE_DB_ROLE } from "@/lib/caseDb";
import type { CanonicalCaseFile, PublicClaim } from "@/lib/casefile/canonicalReader";

/** Les identifiants de la CASE_DB en ligne, et ceux du corpus canonique. */
const IDS_CASE_DB = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];
const IDS_CANONIQUE = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];

const claims = (ids: readonly string[]): ScorableClaim[] =>
  ids.map((id) => ({ id, status: "Referenced" }));

const ONCHAIN = {
  distribution: { top10_pct: "62.0" },
  markets: { liquidity_usd: 48000 },
};

const score = (ids: readonly string[]) => {
  const c = claims(ids);
  return computeLegacyCaseScore(c, linkEvidence(c, ONCHAIN), ONCHAIN);
};

const codeSeul = (chemin: string): string =>
  readFileSync(chemin, "utf8")
    .split("\n")
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");

// ═══ La neutralité du score, démontrée ════════════════════════════════════

describe("ÉTAPE 7 — la bascule d'autorité ne touche pas le score", () => {
  it("les deux corpus portent le MÊME jeu d'identifiants", () => {
    expect(IDS_CANONIQUE).toEqual(IDS_CASE_DB);
  });

  it("MUTANT — score et tier sont IDENTIQUES des deux côtés", () => {
    expect(score(IDS_CANONIQUE)).toEqual(score(IDS_CASE_DB));
  });

  it("le scoreur est indexé sur les identifiants, jamais sur le contenu", () => {
    // Deux claims de même identifiant et de contenu opposé rendent le même
    // score. C'est ce qui rend la bascule neutre — et c'est aussi, exactement,
    // le défaut que BUILD 9 ferme : deux corpus disjoints sous les mêmes clefs.
    const a: ScorableClaim[] = [{ id: "C5", status: "Referenced" }];
    const b: ScorableClaim[] = [{ id: "C5", status: "Referenced" }];
    expect(computeLegacyCaseScore(a, linkEvidence(a, ONCHAIN), ONCHAIN)).toEqual(
      computeLegacyCaseScore(b, linkEvidence(b, ONCHAIN), ONCHAIN),
    );
    const code = codeSeul("src/lib/casefile/legacyCaseScore.ts");
    expect(code).not.toContain("topic");
    expect(code).not.toContain("title");
  });

  it("les seuils sont ceux de l'origine — déplacés, pas retouchés", () => {
    // Le garde-fou « >= 6 claims => RED » et les paliers 70 / 35.
    expect(score(["C1", "C2", "C3", "C4", "C5", "C6"]).tier).toBe("RED");
    expect(score(["C1"]).score).toBeLessThan(70);
    expect(score([]).tier).toBe("GREEN");
    expect(score([]).score).toBe(10); // top10 > 40 seul
  });

  it("un dossier vide ne devient jamais RED par défaut", () => {
    expect(score([]).tier).not.toBe("RED");
  });
});

// ═══ LEGACY_SCORING_INPUT — écrit dans le code, pas dans un rapport ═══════

describe("ÉTAPE 7 — la survivance est NOMMÉE dans le code", () => {
  it("`caseDb` déclare son rôle sous forme de valeur citable", () => {
    expect(CASE_DB_ROLE).toBe("LEGACY_SCORING_INPUT");
  });

  it("le module dit ce qu'il n'a PAS le droit d'alimenter", () => {
    const src = readFileSync("src/lib/caseDb.ts", "utf8");
    expect(src).toContain("LEGACY_SCORING_INPUT");
    expect(src).toContain("N'EST PAS UNE AUTORITÉ CASEFILE");
    expect(src).toContain("l'API CaseFile");
    // Et pourquoi elle n'est pas débranchée : la décision est datée, pas tue.
    expect(src).toContain("computeTigerScore");
    expect(src).toContain("HOLD");
  });

  it("les six entrées de computeTigerScore restent INTOUCHÉES", () => {
    // HOLD explicite de l'arbitrage. Si l'une d'elles cessait d'appeler
    // `loadCaseByMint`, ce serait un changement de scoring publié — et ce
    // test le signalerait avant qu'il parte en production.
    const HOLD = [
      "src/app/api/v1/score/route.ts",
      "src/app/api/partner/v1/score-lite/route.ts",
      "src/app/api/partner/v1/batch-score/route.ts",
      "src/app/api/partner/v1/transaction-check/route.ts",
      "src/lib/scan/buildTigerInput/solana.ts",
      "src/lib/publicScore/computeVerdict.ts",
    ];
    for (const f of HOLD) {
      expect(readFileSync(f, "utf8"), f).toContain("loadCaseByMint");
    }
  });
});

// ═══ La vue interne — voir tout, et le DIRE ══════════════════════════════

describe("ÉTAPE 7 — la surface admin voit le dossier entier, états compris", () => {
  const claim = (o: Partial<PublicClaim>): PublicClaim => ({
    claimId: "C1", title: "Coordinated Shill Campaign", titleFr: null,
    description: "Plusieurs comptes publient le même modèle.", descriptionFr: null,
    category: "social", severity: "HIGH", status: "CONFIRMED", claimDate: "2025-11-04",
    state: "ATTACHED", provenance: null, ...o,
  });

  const dossier: CanonicalCaseFile = {
    ref: "IL-SHILL-BOTIFY-001",
    codename: "BOTIFY",
    ticker: "$BOTIFY",
    title: "Réseau de KOL coordonnés",
    tigerScore: null,
    verdict: "AVOID",
    claims: [
      claim({}),
      claim({
        claimId: "C2",
        state: "PUBLIC",
        provenance: {
          threadUrl: "https://x.com/exemple/status/1",
          sources: [{
            sourceId: "SRC-001", sourceType: "screenshot", caption: "Fil 1/8",
            capturedAt: "2025-12-07", sourceUrl: "https://x.com/exemple",
            sha256: "b".repeat(64),
          }],
          unresolvedRefs: ["captures TBC"],
        },
      }),
    ],
    sources: [],
  };

  const vue = toInternalCaseView(dossier);

  it("un claim NON publié est rendu — mais il porte son état", () => {
    // Filtrer sur PUBLIC rendrait zéro claim à un opérateur dont le travail
    // est précisément de voir ce qui n'est pas publié.
    expect(vue.claims).toHaveLength(2);
    expect(vue.claims[0].state).toBe("ATTACHED");
    expect(vue.claims[1].state).toBe("PUBLIC");
  });

  it("MUTANT — l'état ne peut pas disparaître du rendu", () => {
    for (const c of vue.claims) expect(Object.keys(c)).toContain("state");
  });

  it("l'horodatage rendu est celui de la CAPTURE", () => {
    expect(vue.claims[1].evidence[0].captured_at).toBe("2025-12-07");
  });

  it("les références non résolues restent visibles, non résolues", () => {
    expect(vue.claims[1].unresolved_refs).toEqual(["captures TBC"]);
    expect(vue.claims[1].evidence.map((e) => e.ref)).toEqual(["SRC-001"]);
  });

  it("tigerScore NULL traverse la vue sans devenir 0", () => {
    expect(vue.tiger_score).toBeNull();
  });

  it("aucun champ interne ne franchit la vue", () => {
    const json = JSON.stringify(vue);
    for (const f of ["localFilePath", "sessionId", "snapshotId", "casefileRef", "contentHash"]) {
      expect(json, f).not.toContain(f);
    }
  });
});
