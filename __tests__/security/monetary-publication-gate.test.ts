// __tests__/security/monetary-publication-gate.test.ts
//
// A14 — l'interrupteur des affirmations monétaires nominatives.
//
// Le test qui porte tout le chantier est le dernier bloc : **un seul retrait
// doit couvrir les trois porteurs des mêmes 210 000 $.** Sans lui, on
// reconstruirait le défaut qu'on corrige — un interrupteur par table, donc
// trois décisions à prendre pour retirer un chiffre, donc une oubliée.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  isMonetaryClaimPublished,
  isCompositeMonetaryClaimPublished,
  redactMonetary,
  redactEvidenceAmount,
  sumPublishedMonetary,
  evidenceFamily,
  MONETARY_PUBLICATION_SELECT,
  PUBLISHED_MONETARY_FILTER,
  MONETARY_PUBLICATION_STATES,
  MONETARY_CLAIM_FAMILIES,
} from "@/lib/publication/monetaryGate";

const OPEN = { proceedsPublication: "published", monetaryClaimsPublication: "published" };
const PROCEEDS_WITHDRAWN = { proceedsPublication: "withdrawn", monetaryClaimsPublication: "published" };
const SCAM_WITHDRAWN = { proceedsPublication: "published", monetaryClaimsPublication: "withdrawn" };

// Toutes les façons de ne pas être publiable.
const REFUSED: Array<[string, unknown]> = [
  ["profil null", null],
  ["profil undefined", undefined],
  ["aucun des deux états sélectionné", {}],
  ["proceeds absent", { monetaryClaimsPublication: "published" }],
  ["monetaryClaims absent", { proceedsPublication: "published" }],
  ["proceeds null", { proceedsPublication: null, monetaryClaimsPublication: "published" }],
  ["monetaryClaims null", { proceedsPublication: "published", monetaryClaimsPublication: null }],
  ["chaîne vide", { proceedsPublication: "", monetaryClaimsPublication: "published" }],
  ["espaces autour", { proceedsPublication: "  published  ", monetaryClaimsPublication: "published" }],
  ["casse différente", { proceedsPublication: "Published", monetaryClaimsPublication: "published" }],
  ["valeur inattendue", { proceedsPublication: "draft", monetaryClaimsPublication: "published" }],
  ["booléen", { proceedsPublication: true, monetaryClaimsPublication: "published" }],
  ["nombre", { proceedsPublication: 1, monetaryClaimsPublication: "published" }],
];

describe("isMonetaryClaimPublished — fail-closed", () => {
  it("publie quand les deux interrupteurs sont ouverts", () => {
    expect(isMonetaryClaimPublished(OPEN)).toBe(true);
    expect(isMonetaryClaimPublished(OPEN, "proceeds")).toBe(true);
    expect(isMonetaryClaimPublished(OPEN, "scam_scale")).toBe(true);
  });

  for (const [label, value] of REFUSED) {
    it(`refuse : ${label}`, () => {
      expect(isMonetaryClaimPublished(value as never)).toBe(false);
    });
  }

  it("un chiffre NON QUALIFIÉ exige les deux interrupteurs", () => {
    // Un appelant qui n'a pas classé son montant n'obtient pas le régime le
    // plus permissif — il obtient le plus strict.
    expect(isMonetaryClaimPublished(PROCEEDS_WITHDRAWN)).toBe(false);
    expect(isMonetaryClaimPublished(SCAM_WITHDRAWN)).toBe(false);
  });
});

describe("les deux familles ne se confondent pas", () => {
  it("un retrait d'ENCAISSEMENT ne tait pas l'ampleur du préjudice", () => {
    // « ce que la personne a encaissé » ≠ « ce que ses victimes ont perdu ».
    // Les fondre ferait disparaître l'une avec l'autre sans décision.
    expect(isMonetaryClaimPublished(PROCEEDS_WITHDRAWN, "proceeds")).toBe(false);
    expect(isMonetaryClaimPublished(PROCEEDS_WITHDRAWN, "scam_scale")).toBe(true);
  });

  it("l'interrupteur général tait TOUT, les deux familles comprises", () => {
    expect(isMonetaryClaimPublished(SCAM_WITHDRAWN, "proceeds")).toBe(false);
    expect(isMonetaryClaimPublished(SCAM_WITHDRAWN, "scam_scale")).toBe(false);
  });
});

describe("redactMonetary — rend null, jamais 0", () => {
  it("laisse passer la valeur quand c'est publiable", () => {
    expect(redactMonetary(OPEN, 4_500_000, "scam_scale")).toBe(4_500_000);
  });

  it("rend null — et surtout PAS 0, qui serait une affirmation fausse", () => {
    const out = redactMonetary(PROCEEDS_WITHDRAWN, 210_900, "proceeds");
    expect(out).toBeNull();
    expect(out).not.toBe(0);
  });

  it("rend null sur une valeur absente même quand c'est publiable", () => {
    expect(redactMonetary(OPEN, undefined)).toBeNull();
    expect(redactMonetary(OPEN, null)).toBeNull();
  });
});

describe("classement des types de KolEvidence", () => {
  it("classe les types connus", () => {
    expect(evidenceFamily("coordinated_exit")).toBe("proceeds");
    expect(evidenceFamily("paid_promotion")).toBe("proceeds");
    expect(evidenceFamily("victim_impact")).toBe("scam_scale");
    expect(evidenceFamily("cex_manipulation")).toBe("scam_scale");
  });

  it("un type INCONNU n'est pas classé — donc soumis aux DEUX interrupteurs", () => {
    // Fail-closed : un type d'évidence ajouté demain sans être classé ici sera
    // plus protégé, pas moins.
    expect(evidenceFamily("type_invente_demain")).toBeUndefined();
    expect(redactEvidenceAmount(PROCEEDS_WITHDRAWN, { type: "type_invente_demain", amountUsd: 1 })).toBeNull();
    expect(redactEvidenceAmount(SCAM_WITHDRAWN, { type: "type_invente_demain", amountUsd: 1 })).toBeNull();
  });

  it("un type null ou absent est traité comme inconnu", () => {
    expect(evidenceFamily(null)).toBeUndefined();
    expect(evidenceFamily(undefined)).toBeUndefined();
    expect(redactEvidenceAmount(PROCEEDS_WITHDRAWN, { amountUsd: 1 })).toBeNull();
  });

  it("rend null sur une preuve absente", () => {
    expect(redactEvidenceAmount(OPEN, null)).toBeNull();
    expect(redactEvidenceAmount(OPEN, undefined)).toBeNull();
  });
});

describe("sumPublishedMonetary — les sommes calculées à la volée", () => {
  // `totalPaidUsd` (/api/v1/kol/{h}:39) et `totalLoss` (class-action:52) sont
  // invisibles à toute requête : elles n'existent qu'entre la lecture et la
  // réponse. Un filtre Prisma ne les atteint pas.
  it("somme ce qui est publiable", () => {
    expect(sumPublishedMonetary(OPEN, [3_200_000, 850_000, 320_000], "proceeds")).toBe(4_370_000);
  });

  it("rend null — et non 0 — quand le retrait s'applique", () => {
    const out = sumPublishedMonetary(PROCEEDS_WITHDRAWN, [3_200_000, 850_000], "proceeds");
    expect(out).toBeNull();
    expect(out).not.toBe(0);
  });

  it("ignore les valeurs non numériques sans faire échouer la somme", () => {
    expect(sumPublishedMonetary(OPEN, [100, null, undefined, 50], "proceeds")).toBe(150);
  });
});

describe("aucune sortie par l'environnement", () => {
  it("le module ne lit aucune variable d'environnement", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/publication/monetaryGate.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/process\.env/);
    expect(code).not.toMatch(/SKIP_|FORCE_|ALLOW_|BYPASS_|DISABLE_|NODE_ENV/);
  });

  it("expose de quoi filtrer en base ET en mémoire", () => {
    expect(MONETARY_PUBLICATION_SELECT).toMatchObject({ proceedsPublication: true, monetaryClaimsPublication: true });
    expect(PUBLISHED_MONETARY_FILTER).toMatchObject({ proceedsPublication: "published", monetaryClaimsPublication: "published" });
    expect([...MONETARY_PUBLICATION_STATES]).toEqual(["published", "withdrawn"]);
    expect([...MONETARY_CLAIM_FAMILIES]).toEqual(["proceeds", "scam_scale"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LE TEST QUI PORTE LE CHANTIER
// ═══════════════════════════════════════════════════════════════════════════

describe("UN RETRAIT, TROIS PORTEURS — les 210 000 $ de bkokoski", () => {
  // Mesuré le 2026-08-18 (A13) : le même chiffre existe trois fois.
  //
  //   1. KolProceedsEvent  eventType='SUMMARY_ARKHAM'    amountUsd = 210 000
  //   2. KolEvidence       type='coordinated_exit'       amountUsd = 210 000
  //   3. LaundryTrail      narrativeText — « moved $210K USDC across 4 wallets »
  //
  // Le retrait du 16 août n'a couvert que le premier.
  const AMOUNT = 210_000;

  const porteur1 = { eventType: "SUMMARY_ARKHAM", amountUsd: AMOUNT };
  const porteur2 = { type: "coordinated_exit", amountUsd: AMOUNT };
  const porteur3 = { publication: "published", narrativeText: "…moved $210K USDC across 4 wallets…" };

  it("tant que rien n'est retiré, les trois sont servis", () => {
    expect(redactMonetary(OPEN, porteur1.amountUsd, "proceeds")).toBe(AMOUNT);
    expect(redactEvidenceAmount(OPEN, porteur2)).toBe(AMOUNT);
    expect(isCompositeMonetaryClaimPublished(OPEN, porteur3.publication, "proceeds")).toBe(true);
  });

  it("UN SEUL retrait d'encaissement les couvre TOUS LES TROIS", () => {
    // C'est la propriété qui empêche de reconstruire le défaut : une décision,
    // pas trois. `proceedsPublication = 'withdrawn'` est exactement l'état
    // écrit le 2026-08-16 pour ce handle.
    const p = PROCEEDS_WITHDRAWN;

    expect(redactMonetary(p, porteur1.amountUsd, "proceeds")).toBeNull();
    expect(redactEvidenceAmount(p, porteur2)).toBeNull();
    expect(isCompositeMonetaryClaimPublished(p, porteur3.publication, "proceeds")).toBe(false);
  });

  it("l'interrupteur général les couvre aussi tous les trois", () => {
    const p = SCAM_WITHDRAWN;
    expect(redactMonetary(p, porteur1.amountUsd, "proceeds")).toBeNull();
    expect(redactEvidenceAmount(p, porteur2)).toBeNull();
    expect(isCompositeMonetaryClaimPublished(p, porteur3.publication, "proceeds")).toBe(false);
  });

  it("et l'interrupteur PROPRE au narratif suffit à le taire seul", () => {
    // A12 : LaundryTrail porte son propre état. Retirer le narratif sans
    // retirer l'encaissement doit rester possible — la composition est un ET,
    // donc n'importe lequel des trois suffit.
    expect(isCompositeMonetaryClaimPublished(OPEN, "withdrawn", "proceeds")).toBe(false);
    // …sans pour autant taire les deux autres porteurs.
    expect(redactMonetary(OPEN, porteur1.amountUsd, "proceeds")).toBe(AMOUNT);
    expect(redactEvidenceAmount(OPEN, porteur2)).toBe(AMOUNT);
  });

  it("un état d'objet DEMANDÉ mais absent ne publie pas", () => {
    // `undefined` = « cet objet n'a pas d'état propre » → n'ajoute rien.
    // `null` = « j'ai demandé l'état et je ne l'ai pas eu » → refus.
    expect(isCompositeMonetaryClaimPublished(OPEN, undefined, "proceeds")).toBe(true);
    expect(isCompositeMonetaryClaimPublished(OPEN, null, "proceeds")).toBe(false);
  });

  it("le facteur 21 : retirer l'encaissement ne tait PAS totalScammed", () => {
    // Constat A13 : bkokoski, 210 900 $ retirés, 4 500 000 $ servis.
    // Après ce chantier, le second reste servi — c'est VOULU : c'est une autre
    // affirmation, et la taire demande sa propre décision. Ce qui change, c'est
    // qu'un interrupteur existe désormais pour la prendre.
    expect(redactMonetary(PROCEEDS_WITHDRAWN, 4_500_000, "scam_scale")).toBe(4_500_000);
    expect(redactMonetary(SCAM_WITHDRAWN, 4_500_000, "scam_scale")).toBeNull();
  });
});

describe("la migration qui pose l'interrupteur", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "docs/prep/patches/A14-MIGRATION_monetary_claims_v1.sql"),
    "utf8",
  );
  const statements = sql.replace(/^\s*--.*$/gm, "");

  it("existe, et n'est pas appliquée", () => {
    expect(sql).toContain("STATUS: NON APPLIQUÉE");
  });

  it("pose la colonne avec un défaut qui ne change rien", () => {
    expect(statements).toContain('ADD COLUMN IF NOT EXISTS "monetaryClaimsPublication"');
    expect(statements).toContain("DEFAULT 'published'");
  });

  it("élargit la liste de portées sans en retirer une seule", () => {
    for (const scope of ["profile_total", "summary", "event", "involvement"]) {
      expect(statements, `portée d'origine perdue : ${scope}`).toContain(`'${scope}'`);
    }
    for (const scope of ["scammed_total", "case_paid", "evidence_amount", "monetary_all"]) {
      expect(statements).toContain(`'${scope}'`);
    }
  });

  it("ne détruit aucune donnée et ne décide rien", () => {
    expect(statements).not.toMatch(/\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i);
    expect(statements).not.toMatch(/UPDATE\s+"KolProfile"/i);
    expect(statements).not.toMatch(/INSERT\s+INTO\s+"KolProceedsPublicationLog"/i);
  });

  it("le seul DROP est celui d'une contrainte, encadré par un contrôle préalable", () => {
    expect(statements).toMatch(/DROP CONSTRAINT IF EXISTS "KolProceedsPublicationLog_scope_allowed"/);
    expect(statements).toContain("RAISE EXCEPTION");
    expect(statements).toContain("BEGIN;");
    expect(statements).toContain("COMMIT;");
  });
});
