// ─── CC-OFFLINE-284 · B + CC-OFFLINE-286 · C ───────────────────────────────
//
// ██  UN REMPLISSAGE DE PRÉSENTATION N'EST PAS UNE PREUVE.                 ██
// ██  LE LEGACY NE DOIT PAS PRIMER SUR L'AUTORITÉ GOUVERNÉE.               ██
//
// M3 · zéro motif réel ne peut plus fabriquer « No critical signals detected »
// M4 · les claims C1–C8 de `data/cases/botify.json` ne peuvent plus agir comme
//      autorité « Confirmed » COURANTE

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeScore } from "@/lib/scoring";
import { canonicalRefForMint } from "@/lib/casefile/publicProjection";
import { BOTIFY_MINT } from "@/lib/kol-memory/tokenIdentity";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const BANNIERE = "src/components/scan/RetailVerdictBanner.tsx";
const ROUTE_SCAN = "src/app/api/scan/solana/route.ts";
const PAGES = ["src/app/en/demo/page.tsx", "src/app/fr/demo/page.tsx"] as const;

// ═══ M3 · LE REMPLISSAGE ════════════════════════════════════════════════════

describe("B · M3 — aucun motif n'est fabriqué pour atteindre un quota visuel", () => {
  const code = sansCommentaires(lire(BANNIERE));

  it("⛔ la boucle de remplissage a DISPARU", () => {
    expect(code).not.toContain("while (reasons.length < 2)");
    expect(code).not.toMatch(/const generic\s*=/);
  });

  it("⛔ et les phrases qu'elle injectait ont disparu avec elle", () => {
    for (const m of [
      "No critical signals detected",
      "Risk score critically high",
      "Multiple red flags detected",
      "Risk score above safe threshold",
      "Aucun signal critique",
      "Plusieurs red flags détectés",
    ]) {
      expect(code, m).not.toContain(m);
    }
  });

  it("des motifs vides RESTENT vides — le rendu est déjà gardé", () => {
    // `reasons` ne vient que des preuves réelles, filtrées et tronquées.
    expect(code).toContain("const reasons = proofs");
    expect(code).toContain("{reasons.length > 0 && (");
  });
});

// ═══ B · « CLEAN » EXIGE UNE COUVERTURE ═════════════════════════════════════

describe("B · UNKNOWN ≠ SAFE — « CLEAN » n'est plus servi sur une ignorance", () => {
  const code = sansCommentaires(lire(BANNIERE));

  it("la couverture est DÉCLARÉE par l'appelant, jamais devinée", () => {
    expect(code).toContain("coverageSufficient?: boolean");
    expect(code).toContain("const couvertureInsuffisante = coverageSufficient === false");
    // ⛔ La bannière ne sonde rien et ne dérive aucune autorité localement.
    for (const m of ["fetch(", "loadCaseByMint", "computeScore", "publishStatus"]) {
      expect(code, m).not.toContain(m);
    }
  });

  it("l'état projeté est UNKNOWN — existant et ratifié, pas une classification neuve", () => {
    // `UNKNOWN` vit déjà dans `src/lib/risk/tier.ts`, en gris, depuis BUILD 10.
    const tier = lire("src/lib/risk/tier.ts");
    expect(tier).toContain('export type TierOrUnknown = Tier | "UNKNOWN"');
    expect(tier).toContain('if (t === "UNKNOWN") return "#6b7280"');
    // La bannière le PROJETTE, avec la même couleur grise.
    expect(code).toContain("UNKNOWN:");
    expect(code).toContain("#6b7280");
    expect(code).toContain("const nonVerifie = couvertureInsuffisante && tier === 'GREEN'");
  });

  it("⛔ UNE GRAVITÉ N'EST JAMAIS RELÂCHÉE — RED et ORANGE traversent intacts", () => {
    // La bascule ne vise QUE `GREEN` : la couverture restreint une permission,
    // elle ne réduit pas une gravité. Même règle qu'en CC-OFFLINE-282.
    expect(code).toContain("tier === 'GREEN'");
    expect(code).not.toMatch(/nonVerifie\s*&&\s*tier\s*!==/);
  });

  it("le sous-titre ne porte AUCUNE accusation", () => {
    // Une couverture insuffisante n'est pas une allégation contre le jeton.
    // On lit les DEUX entrées UNKNOWN, pas le fichier entier : ailleurs, le mot
    // « scam » est légitime — la CTA « See how this scam unfolded » ne s'affiche
    // que sur un dossier RED.
    const brut = lire(BANNIERE);
    const entrees = [...brut.matchAll(/UNKNOWN: \{[^}]*\}/g)].map((m) => m[0]);
    expect(entrees).toHaveLength(2);
    for (const e of entrees) {
      expect(e).toMatch(/not a safety assessment|pas une évaluation de sécurité/);
      for (const m of ["scam", "fraud", "dangerous", "arnaque", "danger", "safe'", "clean"]) {
        expect(e.toLowerCase(), m).not.toContain(m);
      }
    }
  });

  for (const p of PAGES) {
    it(`${p} — la couverture vient de l'autorité, pas d'une constante`, () => {
      const c = sansCommentaires(lire(p));
      expect(c).toContain("coverageSufficient={");
      expect(c).toContain("risk?.coverage?.sufficient");
      expect(c).not.toMatch(/coverageSufficient=\{(true|false)\}/);
    });
  }
});

// ═══ M4 · LE CONTOURNEMENT LEGACY ═══════════════════════════════════════════

describe("C · M4 — les claims legacy ne font plus autorité COURANTE", () => {
  // ⚠️ Lecture BRUTE, volontairement. Le dépouilleur de commentaires est un
  // utilitaire de témoin, pas un analyseur : sur ce fichier-ci il avale trop.
  // Les chaînes assertées ci-dessous sont des DÉCLARATIONS exécutables — une
  // ligne commentée ne les ferait pas passer, elle ne compilerait plus ailleurs.
  const code = lire(ROUTE_SCAN);

  it("un dossier À AUTORITÉ GOUVERNÉE ne consomme plus son fichier plat", () => {
    expect(code).toContain("const refGouvernee = canonicalRefForMint(mint_clean)");
    expect(code).toContain("const autoriteLegacyRetiree = refGouvernee !== null");
    expect(code).toContain("const rawClaims = autoriteLegacyRetiree ? [] : (caseFile?.claims ?? [])");
  });

  it("BOTIFY a bien une autorité gouvernée — résolue, jamais supposée", () => {
    // Le mint canonique vient de son autorité ; la ref gouvernée aussi.
    expect(canonicalRefForMint(BOTIFY_MINT)).toBe("IL-SHILL-BOTIFY-001");
  });

  it("un mint SANS autorité gouvernée n'est pas concerné", () => {
    // La frontière est la plus étroite qui ferme le défaut.
    expect(canonicalRefForMint("So11111111111111111111111111111111111111112")).toBeNull();
  });

  it("⛔ le fichier historique est PRÉSERVÉ, et « Confirmed » n'est pas adouci", () => {
    // Ni migration, ni publication, ni suppression, ni renommage : c'est la
    // CONSOMMATION qui cesse, pas le vocabulaire qui change.
    const json = lire("data/cases/botify.json");
    expect(json).toContain('"CONFIRMED"');
    expect(JSON.parse(json).claims.length).toBeGreaterThanOrEqual(8);
    expect(code).not.toContain("REFERENCED\" as");
  });

  it("⛔ M4 · « CONFIRMED » n'est plus AFFICHÉ non plus — retirer le score ne suffisait pas", () => {
    // Le témoin réel avait montré le premier passage INCOMPLET : BOTIFY rendait
    // encore `off_chain.status = "Confirmed"` et ses 8 claims marquées
    // CONFIRMED. Une claim affichée « Confirmed » FAIT AUTORITÉ À L'ÉCRAN.
    expect(code).toContain("if (caseFile && !autoriteLegacyRetiree) {");
    expect(code).toContain("off_chain.status = caseFile.case_meta.status;");
    expect(code).toContain("off_chain.claims = caseFile.claims.map");
    // La frontière est RESSERRÉE, pas élargie : l'IDENTIFIANT et sa PROVENANCE
    // traversent — ce ne sont pas des assertions, et d'autres témoins les
    // observent. Ce qui ne traverse plus est le STATUT, les CLAIMS, la PROSE.
    const bloc = code.slice(code.indexOf("if (caseFile) {"), code.indexOf("if (caseFile && !autoriteLegacyRetiree)"));
    expect(bloc).toContain("off_chain.case_id = caseFile.case_meta.case_id;");
    expect(bloc).toContain('off_chain.source = "case_db";');
    expect(bloc).not.toContain("off_chain.status");
    expect(bloc).not.toContain("off_chain.claims");
    expect(bloc).not.toContain("off_chain.summary");
  });

  it("l'ÉTAT DE COUVERTURE voyage à côté du résultat, sans le maquiller", () => {
    expect(code).toContain("const offChainClaimsMesuree = rawClaims.length > 0");
    expect(code).toContain("offChainClaimsMeasured: offChainClaimsMesuree");
    expect(code).toContain("legacyAuthorityWithdrawn: autoriteLegacyRetiree");
  });
});

// ═══ LE COMPORTEMENT, PAS SEULEMENT LE TEXTE ════════════════════════════════

describe("B + C · ce que `computeScore` rend quand plus rien n'est consommé", () => {
  it("zéro claim ⇒ repli 20 / GREEN, SOUS le drapeau — c'est pourquoi la couverture doit être dite", () => {
    // ⚠️ Le repli n'est PAS supprimé : le corriger appartient à `lib/scoring`,
    // hors périmètre. Ce qui change est que le produit ne présente plus ce
    // repli comme une confiance — la couverture voyage avec lui.
    const r = computeScore([]);
    expect(r.score).toBe(20);
    expect(r.tier).toBe("GREEN");
    expect(r.flags).toContain("NO_CLAIMS_FALLBACK");
  });

  it("⛔ ET LE PRODUIT NE PRÉSERVE AUCUN SCORE POUR L'OPTIQUE", () => {
    // Le RED 100 de BOTIFY venait ENTIÈREMENT des claims legacy. Il disparaît
    // avec elles, et rien ne le remplace artificiellement.
    const json = JSON.parse(lire("data/cases/botify.json")) as { claims: unknown[] };
    const avecLegacy = computeScore(json.claims as never);
    const sansLegacy = computeScore([]);
    expect(avecLegacy.score).toBeGreaterThan(sansLegacy.score);
    // Aucune reconstruction du score legacy dans la route.
    const brut = sansCommentaires(lire(ROUTE_SCAN));
    expect(brut).not.toContain("CLAIM_FLOOR");
    expect(brut).not.toMatch(/score:\s*100/);
  });
});
