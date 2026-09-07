// ─── BUILD 8 / P3 — La nature d'un montant de proceeds ─────────────────────
//
// 5 602 lignes, 17,5 M$, deux natures dans la même colonne. Ces tests fixent
// le classement, et surtout la chose la plus fragile du patch : que le SQL de
// backfill dise EXACTEMENT ce que dit le TypeScript.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyAmountUsd,
  amountUsdNature,
  proceedsRowNature,
  PRICING_SOURCES,
} from "@/lib/kol-memory/proceedsNature";
import { natureForField, natureForRow, NATURE_REGISTRY } from "@/lib/data-nature/registry";
import { UNCLASSIFIED } from "@/lib/data-nature/nature";

const DDL = readFileSync(
  join(process.cwd(), "docs/prep/patches/BUILD8/01_kolproceedsevent_nature.sql"),
  "utf8",
);

/** Le corpus mesuré sur ep-square-band le 2026-09-07, avec ses effectifs. */
const CORPUS = [
  { pricingSource: "binance_historical", n: 5407, chiffrees: 5407, ambigues: 0 },
  { pricingSource: "helius_sol_estimate_200usd", n: 133, chiffrees: 59, ambigues: 0 },
  { pricingSource: "yearly_fallback", n: 53, chiffrees: 53, ambigues: 0 },
  { pricingSource: "ARKHAM_CSV", n: 6, chiffrees: 6, ambigues: 0 },
  { pricingSource: "CEX_DETECTED", n: 2, chiffrees: 2, ambigues: 2 },
  { pricingSource: "arkham_aggregate", n: 1, chiffrees: 1, ambigues: 0 },
];

const avecMontant = (pricingSource: string, ambiguous = false) => ({
  pricingSource,
  amountUsd: 1234.56,
  ambiguous,
});

describe("BUILD 8 / P3 — le classement suit la méthode réelle", () => {
  it("binance_historical → INFERENCE, pas THIRD_PARTY_DATA", () => {
    // Le prix vient de Binance, mais le MONTANT est le produit d'une quantité
    // et d'un prix — calculé ici. L'étiqueter du nom du fournisseur serait M4.
    const c = classifyAmountUsd(avecMontant(PRICING_SOURCES.BINANCE_HISTORICAL));
    expect(c.nature).toBe("INFERENCE");
    expect(c.basis?.inputs).toEqual(["PRIMARY_OBSERVATION", "THIRD_PARTY_DATA"]);
    expect(c.basis?.priceResolution).toBe("DAY");
  });

  it("les deux sources à constante → ESTIMATE, avec la constante nommée", () => {
    for (const src of [PRICING_SOURCES.YEARLY_FALLBACK, PRICING_SOURCES.HELIUS_SOL_ESTIMATE_200]) {
      const c = classifyAmountUsd(avecMontant(src));
      expect(c.nature, src).toBe("ESTIMATE");
      // Auditabilité par le BASIS — writeGuard l'accepte à défaut d'un
      // methodRef, et aucune méthodologie gelée ne décrit ces valorisations.
      expect(c.basis?.constant, src).toBeDefined();
      expect(c.basis?.constant?.origin, src).toMatch(/src\//);
      expect(c.basis?.priceResolution, src).toBe("PERIOD");
    }
  });

  it("aucune ESTIMATE n'est laissée sans de quoi l'auditer", () => {
    for (const { pricingSource } of CORPUS) {
      const c = classifyAmountUsd(avecMontant(pricingSource));
      if (c.nature === "ESTIMATE") {
        const auditable =
          c.basis != null && Object.keys(c.basis).length > 0 && c.basis.constant != null;
        expect(auditable, pricingSource).toBe(true);
      }
    }
  });

  it("les imports Arkham → THIRD_PARTY_DATA : un relais, pas un calcul", () => {
    for (const src of [PRICING_SOURCES.ARKHAM_CSV, PRICING_SOURCES.ARKHAM_AGGREGATE]) {
      const c = classifyAmountUsd(avecMontant(src));
      expect(c.nature, src).toBe("THIRD_PARTY_DATA");
      expect(c.basis?.priceResolution, src).toBe("NONE");
    }
  });

  // ── Fail-closed ──────────────────────────────────────────────────────────
  it("un montant absent n'est PAS classé — il n'affirme rien", () => {
    for (const v of [null, undefined, NaN, Infinity, "1234", {}]) {
      expect(
        classifyAmountUsd({ pricingSource: "binance_historical", amountUsd: v }).nature,
        JSON.stringify(v),
      ).toBe(UNCLASSIFIED);
    }
  });

  it("une ligne `ambiguous` n'est PAS classée — on ne tranche pas à la place du produit", () => {
    const c = classifyAmountUsd(avecMontant(PRICING_SOURCES.BINANCE_HISTORICAL, true));
    expect(c.nature).toBe(UNCLASSIFIED);
    expect(c.why).toMatch(/ambiguous/);
  });

  it("`CEX_DETECTED` et toute source inconnue → UNCLASSIFIED, jamais un défaut", () => {
    for (const src of ["CEX_DETECTED", "coingecko", "", "GARBAGE"]) {
      expect(amountUsdNature(avecMontant(src)), src).toBe(UNCLASSIFIED);
    }
  });

  it("MUTANT — un défaut implicite au lieu d'UNCLASSIFIED devient rouge", () => {
    const inconnu = classifyAmountUsd(avecMontant("source_inventee_2027"));
    expect(inconnu.nature).toBe(UNCLASSIFIED);
    expect(inconnu.basis).toBeNull();
    expect(inconnu.why).toMatch(/hors vocabulaire connu/);
  });
});

describe("BUILD 8 / P3 — ligne et champ ne portent PAS la même nature", () => {
  it("la transaction reste CONSTATÉE même quand son montant est dérivé", () => {
    // Déclarer la ligne INFERENCE effacerait le fait que la transaction a eu lieu.
    const row = avecMontant(PRICING_SOURCES.BINANCE_HISTORICAL);
    expect(proceedsRowNature(row)).toBe("PRIMARY_OBSERVATION");
    expect(amountUsdNature(row)).toBe("INFERENCE");
  });

  it("une ligne importée d'Arkham n'est pas une observation — c'est un CSV", () => {
    expect(proceedsRowNature({ pricingSource: PRICING_SOURCES.ARKHAM_CSV })).toBe(
      "THIRD_PARTY_DATA",
    );
  });

  it("sans pricingSource, la ligne n'est pas classable", () => {
    expect(proceedsRowNature({})).toBe(UNCLASSIFIED);
    expect(proceedsRowNature({ pricingSource: PRICING_SOURCES.CEX_DETECTED })).toBe(UNCLASSIFIED);
  });
});

describe("BUILD 8 / P3 — la table est entrée dans le registre", () => {
  it("KolProceedsEvent est déclarée, en régime CHAMP", () => {
    expect(NATURE_REGISTRY.KolProceedsEvent?.regime).toBe("FIELD");
    expect(NATURE_REGISTRY.KolProceedsEvent?.rows).toBe(5_602);
  });

  it("le prédicat de champ l'emporte sur toute nature fixe", () => {
    // C'est l'extension que ce cas rend nécessaire : `amountUsd` n'a pas UNE
    // nature sur toute la table, il en a trois selon `pricingSource`.
    expect(
      natureForField("KolProceedsEvent", "amountUsd", avecMontant("binance_historical")),
    ).toBe("INFERENCE");
    expect(
      natureForField("KolProceedsEvent", "amountUsd", avecMontant("yearly_fallback")),
    ).toBe("ESTIMATE");
    expect(natureForField("KolProceedsEvent", "amountUsd", avecMontant("ARKHAM_CSV"))).toBe(
      "THIRD_PARTY_DATA",
    );
  });

  it("les tables déjà déclarées ne changent PAS de comportement", () => {
    // `fieldPredicates` est consulté avant `fields`, mais aucune table de S3
    // n'en déclare : leur résolution doit être identique à avant.
    expect(
      natureForField("KolTokenLink", "contractAddress", { contractAddress: "So1111" }),
    ).toBe("PRIMARY_OBSERVATION");
    expect(natureForField("KolTokenLink", "canonicalMint", { canonicalMint: "So1111" })).toBe(
      "INFERENCE",
    );
    expect(natureForRow("KolWallet", { rowNature: "THIRD_PARTY_DATA" })).toBe("THIRD_PARTY_DATA");
  });
});

// ─── Le test qui compte : SQL et TypeScript disent la MÊME chose ───────────
describe("BUILD 8 / P3 — le backfill SQL est la transcription du TypeScript", () => {
  it("chaque branche du TS a son UPDATE, avec la même nature", () => {
    const attendu: Array<[string, string]> = [
      ["binance_historical", "INFERENCE"],
      ["yearly_fallback", "ESTIMATE"],
      ["helius_sol_estimate_200usd", "ESTIMATE"],
      ["ARKHAM_CSV", "THIRD_PARTY_DATA"],
    ];
    for (const [src, nature] of attendu) {
      // Le TS dit bien ça…
      expect(amountUsdNature(avecMontant(src)), `TS/${src}`).toBe(nature);
      // …et le SQL porte un UPDATE qui pose cette nature pour cette source.
      const bloc = DDL.split("UPDATE \"KolProceedsEvent\" SET").find((b) => b.includes(`'${src}'`));
      expect(bloc, `SQL/${src}`).toBeDefined();
      expect(bloc, `SQL/${src}`).toContain(`"amountUsdNature" = '${nature}'`);
    }
  });

  it("le SQL exclut les mêmes lignes que le TS — montant absent et ambiguës", () => {
    const updates = DDL.split('UPDATE "KolProceedsEvent" SET').slice(1);
    expect(updates.length).toBeGreaterThanOrEqual(4);
    for (const u of updates) {
      expect(u).toContain('"amountUsd" IS NOT NULL');
      expect(u).toContain('"ambiguous" = false');
      // Idempotence : ne jamais réécrire une ligne déjà classée.
      expect(u).toContain('"amountUsdNature" IS NULL');
    }
  });

  it("aucune source non classée par le TS ne reçoit de nature en SQL", () => {
    for (const src of ["CEX_DETECTED", "coingecko"]) {
      expect(amountUsdNature(avecMontant(src)), src).toBe(UNCLASSIFIED);
      const updates = DDL.split('UPDATE "KolProceedsEvent" SET').slice(1);
      for (const u of updates) expect(u, `${src} ne doit apparaître dans aucun UPDATE`).not.toContain(`'${src}'`);
    }
  });

  it("la DDL est ADDITIVE — aucun DROP de colonne ni de table hors rollback commenté", () => {
    const actif = DDL.split("-- ── ROLLBACK")[0];
    expect(actif).not.toMatch(/^\s*DROP TABLE/im);
    expect(actif).not.toMatch(/DROP COLUMN/i);
    expect(actif).not.toMatch(/TRUNCATE/i);
    // Les seuls DROP admis portent sur des contraintes qu'on vient de (re)poser.
    for (const m of actif.match(/DROP CONSTRAINT[^;]*/gi) ?? []) {
      expect(m).toContain("IF EXISTS");
    }
  });

  it("les colonnes sont NULLABLE et SANS DEFAULT — pas de nature implicite", () => {
    // On n'inspecte QUE la déclaration des colonnes : les CHECK plus bas
    // contiennent légitimement des `IS NOT NULL`, et un regex trop large les
    // attraperait — ce qui ferait rougir le test pour la mauvaise raison.
    const addColumn = /ALTER TABLE "KolProceedsEvent"\s*\n\s*ADD COLUMN[\s\S]*?;/.exec(DDL)?.[0];
    expect(addColumn).toBeDefined();
    for (const col of ["amountUsdNature", "amountUsdBasis", "amountUsdMethodRef"]) {
      expect(addColumn, col).toContain(`ADD COLUMN IF NOT EXISTS "${col}"`);
    }
    expect(addColumn).not.toMatch(/DEFAULT/i);
    expect(addColumn).not.toMatch(/NOT NULL/i);
  });

  it("la contrainte d'auditabilité des ESTIMATE est posée en base", () => {
    expect(DDL).toContain("KolProceedsEvent_estimate_auditable");
    expect(DDL).toContain("\"amountUsdNature\" IS DISTINCT FROM 'ESTIMATE'");
  });

  it("le CHECK de grammaire reproduit METHOD_REF_SQL_PATTERN à l'identique", async () => {
    const { METHOD_REF_SQL_PATTERN } = await import("@/lib/data-nature/methodRef");
    expect(DDL).toContain(METHOD_REF_SQL_PATTERN);
  });
});

describe("BUILD 8 / P3 — la répartition attendue sur le corpus réel", () => {
  it("5 602 lignes se répartissent en 5 407 / 112 / 7 / 76", () => {
    let inference = 0, estimate = 0, tiers = 0, nonClasse = 0;
    for (const c of CORPUS) {
      const nature = amountUsdNature(avecMontant(c.pricingSource, c.ambigues > 0));
      const chiffrees = c.ambigues > 0 ? 0 : c.chiffrees;
      if (nature === "INFERENCE") inference += chiffrees;
      else if (nature === "ESTIMATE") estimate += chiffrees;
      else if (nature === "THIRD_PARTY_DATA") tiers += chiffrees;
      nonClasse += c.n - chiffrees;
    }
    expect({ inference, estimate, tiers, nonClasse }).toEqual({
      inference: 5407,
      estimate: 112, // 59 helius chiffrées + 53 yearly
      tiers: 7, //      6 ARKHAM_CSV + 1 arkham_aggregate
      nonClasse: 76, // 74 helius sans montant + 2 CEX_DETECTED ambiguës
    });
    expect(inference + estimate + tiers + nonClasse).toBe(5602);
  });
});
