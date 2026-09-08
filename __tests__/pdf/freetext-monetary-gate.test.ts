// ─── P0 — LE MONTANT RETIRÉ DU CHAMP ÉTAIT REPUBLIÉ DANS LA PHRASE ────────
//
// BUILD 10 a fermé les champs structurés. Mesuré le 2026-09-08, en transaction
// lecture seule, ce qui restait ouvert :
//
//   16  descriptions de KolEvidence portant un montant, sur profil WITHDRAWN
//       (11 famille « proceeds », 5 de type non classé → fail-closed)
//    1  LaundryTrail publié appartenant à un profil WITHDRAWN — GordonGekko
//   13  descriptions avec montant sur profils PUBLIÉS — à ne PAS toucher
//
// Sur bkokoski, les nombres du texte sont ceux que `redactEvidenceAmount`
// venait d'annuler dans la ligne d'à côté.
//
// Aucun montant n'est cherché dans le texte : la décision porte sur le PORTEUR.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  redactEvidenceNarrative,
  redactObjectNarrative,
  NARRATIVE_WITHHELD_NOTICE,
} from "@/lib/publication/monetaryGate";

/** Les six montants mesurés dans les descriptions de bkokoski. */
const MONTANTS = ["150,500", "190,600", "73,045", "90,000", "80,000", "20,000", "256,969"];

const RETIRE = { proceedsPublication: "withdrawn", monetaryClaimsPublication: "published" };
const PUBLIE = { proceedsPublication: "published", monetaryClaimsPublication: "published" };

const TEXTE = "Vanity wallet 1234Co consolide $256,969 USDC. D5Yq = CEX deposit.";

// ─────────────────── LA GATE, EN ISOLATION ────────────────────

describe("redactEvidenceNarrative — la prose suit le montant", () => {
  it("MUTANT · gate retirée → la prose d'une preuve d'encaissement ressortirait", () => {
    for (const type of ["coordinated_exit", "fund_movement", "paid_promotion", "cashout", "evm_wallet", "deployer_extraction"]) {
      expect(redactEvidenceNarrative(RETIRE, { type, description: TEXTE })).toBe(
        NARRATIVE_WITHHELD_NOTICE,
      );
    }
  });

  it("un type NON classé est couvert sans être énuméré — fail-closed", () => {
    // `insider_trading` n'est dans aucune famille : il relève des deux.
    expect(redactEvidenceNarrative(RETIRE, { type: "insider_trading", description: TEXTE })).toBe(
      NARRATIVE_WITHHELD_NOTICE,
    );
    expect(redactEvidenceNarrative(RETIRE, { type: null, description: TEXTE })).toBe(
      NARRATIVE_WITHHELD_NOTICE,
    );
  });

  it("MUTANT DE SUR-CORRECTION · un profil PUBLIÉ garde sa prose intacte", () => {
    expect(redactEvidenceNarrative(PUBLIE, { type: "coordinated_exit", description: TEXTE })).toBe(
      TEXTE,
    );
  });

  it("MUTANT DE SUR-CORRECTION · une preuve de PRÉJUDICE n'est pas éteinte par le retrait d'encaissement", () => {
    // Les deux interrupteurs sont distincts. `victim_impact` est scam_scale.
    expect(redactEvidenceNarrative(RETIRE, { type: "victim_impact", description: TEXTE })).toBe(
      TEXTE,
    );
  });

  it("l'interrupteur général éteint AUSSI le préjudice", () => {
    const tout = { proceedsPublication: "published", monetaryClaimsPublication: "withdrawn" };
    expect(redactEvidenceNarrative(tout, { type: "victim_impact", description: TEXTE })).toBe(
      NARRATIVE_WITHHELD_NOTICE,
    );
  });

  it("une preuve SANS prose ne devient pas un retrait", () => {
    expect(redactEvidenceNarrative(RETIRE, { type: "cashout", description: null })).toBeNull();
    expect(redactEvidenceNarrative(RETIRE, { type: "cashout", description: "" })).toBe("");
  });

  it("MUTANT DE SUR-CORRECTION · le motif n'est ni vide, ni null, ni « 0 »", () => {
    expect(NARRATIVE_WITHHELD_NOTICE).toContain("WITHHELD");
    expect(NARRATIVE_WITHHELD_NOTICE.trim().length).toBeGreaterThan(0);
    expect(NARRATIVE_WITHHELD_NOTICE).not.toBe("0");
  });

  it("le motif NOMME le champ, et ne cite AUCUN contenu retenu", () => {
    expect(NARRATIVE_WITHHELD_NOTICE).toContain("proceedsPublication");
    for (const m of MONTANTS) expect(NARRATIVE_WITHHELD_NOTICE).not.toContain(m);
    expect(/\d{3,}/.test(NARRATIVE_WITHHELD_NOTICE)).toBe(false);
  });

  it("aucun montant n'est cherché dans le texte — pas de regex monétaire", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/publication/monetaryGate.ts", "utf8"),
    );
    const code = src
      .split("\n")
      .filter((l) => {
        const t = l.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(code).not.toContain("\\$");
    expect(code).not.toMatch(/new RegExp|\/\\d|\.match\(/);
  });
});

describe("redactObjectNarrative — les interrupteurs se composent en ET", () => {
  it("MUTANT · composition retirée → le trail publié d'un profil RETIRÉ ressortirait", () => {
    // Le cas GordonGekko, mesuré.
    expect(redactObjectNarrative(RETIRE, "published", TEXTE)).toBe(NARRATIVE_WITHHELD_NOTICE);
  });

  it("trail retiré, profil publié → retiré aussi", () => {
    expect(redactObjectNarrative(PUBLIE, "withdrawn", TEXTE)).toBe(NARRATIVE_WITHHELD_NOTICE);
  });

  it("MUTANT DE SUR-CORRECTION · les deux ouverts → texte intact", () => {
    expect(redactObjectNarrative(PUBLIE, "published", TEXTE)).toBe(TEXTE);
  });

  it("un objet sans état propre n'ajoute aucune contrainte", () => {
    expect(redactObjectNarrative(PUBLIE, undefined, TEXTE)).toBe(TEXTE);
    expect(redactObjectNarrative(RETIRE, undefined, TEXTE)).toBe(NARRATIVE_WITHHELD_NOTICE);
  });

  it("un narratif absent reste absent", () => {
    expect(redactObjectNarrative(RETIRE, "published", null)).toBeNull();
  });
});

// ─────────────────── LE DOCUMENT SERVI ────────────────────

const kolProfile = { findUnique: vi.fn() };
const laundryTrail = { findFirst: vi.fn() };
const queryRawUnsafe = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { kolProfile, laundryTrail, $queryRawUnsafe: queryRawUnsafe },
}));
vi.mock("@/lib/security/auth", () => ({ checkAuth: vi.fn(async () => ({ authorized: true })) }));

const { GET } = await import("@/app/api/pdf/kol/route");

const PREUVES = [
  { id: "e1", type: "coordinated_exit", label: "exit", amountUsd: 210000, description: "Vanity wallet 1234Co consolide $256,969 USDC" },
  { id: "e2", type: "paid_promotion", label: "promo", amountUsd: 150500, description: "Paiement de $150,500 pour la promotion" },
  { id: "e3", type: "insider_trading", label: "insider", amountUsd: 20000, description: "Achat insider de $20,000 avant annonce" },
  { id: "e4", type: "fund_movement", label: "move", amountUsd: 190600, description: "Mouvement de $190,600 vers CEX" },
];

const profil = (o: Record<string, unknown> = {}) => ({
  handle: "bkokoski", displayName: "bk", platform: "x", riskFlag: "confirmed_scammer",
  confidence: "high", rugCount: 12, tier: "CRITICAL",
  totalDocumented: null, totalScammed: null,
  evidences: PREUVES, kolWallets: [], kolCases: [], ...o,
});

beforeEach(() => {
  kolProfile.findUnique.mockReset();
  laundryTrail.findFirst.mockReset();
  laundryTrail.findFirst.mockResolvedValue(null);
  queryRawUnsafe.mockReset();
  queryRawUnsafe.mockResolvedValue([]);
});

const servir = async (mode = "retail") => {
  const res = await GET(
    new Request(`http://x/api/pdf/kol?handle=bkokoski&format=html&mode=${mode}`) as never,
  );
  return res.text();
};

describe("le PDF servi ne republie plus le montant par la phrase", () => {
  it("MUTANT · gate description retirée → les montants du texte ressortiraient", async () => {
    kolProfile.findUnique.mockResolvedValue(profil(RETIRE));
    const html = await servir("retail");
    for (const m of MONTANTS) expect(html).not.toContain(m);
  });

  it("le document légal ferme le même chemin — la prose issue de la BASE", async () => {
    kolProfile.findUnique.mockResolvedValue(
      profil({ ...RETIRE, evidences: [{ id: "e9", type: "coordinated_exit", label: "x", amountUsd: 1, description: "somme de $987,654 constatée" }] }),
    );
    expect(await servir("lawyer")).not.toContain("987,654");
  });

  it("le gabarit légal ne porte PLUS aucun littéral monétaire — voir la suite dédiée", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/pdf/kol/templateKolLegal.ts", "utf8");
    expect(src.match(/\$[0-9][0-9,.]*[KMB]?/g)?.filter((v) => !v.includes("${")) ?? []).toEqual([]);
  });

  it("MUTANT DE SUR-CORRECTION · profil PUBLIÉ → les descriptions restent", async () => {
    kolProfile.findUnique.mockResolvedValue(profil(PUBLIE));
    const html = await servir();
    expect(html).toContain("256,969");
    expect(html).not.toContain(NARRATIVE_WITHHELD_NOTICE);
  });

  it("MUTANT · composition du trail retirée → le narratif publié ressortirait", async () => {
    kolProfile.findUnique.mockResolvedValue(profil(RETIRE));
    laundryTrail.findFirst.mockResolvedValue({
      publication: "published",
      trailType: "MIXER",
      laundryRisk: "HIGH",
      recoveryDifficulty: "SEVERE",
      narrativeText: "moved $210K USDC across 4 wallets",
      narrativeTextFr: "a déplacé $210K USDC",
      evidenceNote: "note portant $73,045",
      signals: [],
    });
    const html = await servir();
    expect(html).not.toContain("210K");
    expect(html).not.toContain("73,045");
    expect(html).toContain("WITHHELD");
  });

  it("MUTANT DE SUR-CORRECTION · trail publié + profil publié → narratif intact", async () => {
    kolProfile.findUnique.mockResolvedValue(profil(PUBLIE));
    laundryTrail.findFirst.mockResolvedValue({
      publication: "published", trailType: "MIXER", laundryRisk: "HIGH",
      recoveryDifficulty: "SEVERE", narrativeText: "moved $210K USDC across 4 wallets",
      evidenceNote: "note", signals: [],
    });
    const html = await servir();
    expect(html).toContain("210K");
  });

  it("la donnée n'est pas touchée — aucune Evidence supprimée du document", async () => {
    // Le document d'un profil retiré porte AUTANT de lignes de preuve que celui
    // d'un profil publié : seul le contenu monétaire change, jamais le nombre.
    const compte = (h: string) => (h.match(/<tr>/g) ?? []).length;
    kolProfile.findUnique.mockResolvedValue(profil(PUBLIE));
    const avant = compte(await servir());
    kolProfile.findUnique.mockResolvedValue(profil(RETIRE));
    const apres = compte(await servir());
    expect(apres).toBe(avant);
    expect(apres).toBeGreaterThan(0);
  });

  it("le motif de retrait est visible dans le document", async () => {
    kolProfile.findUnique.mockResolvedValue(profil(RETIRE));
    expect(await servir()).toContain("WITHHELD");
  });

  it("MUTANT DE SUR-CORRECTION · aucun `$0` ni cellule vide substitués", async () => {
    kolProfile.findUnique.mockResolvedValue(profil(RETIRE));
    const html = await servir();
    expect(html).not.toMatch(/>\s*\$0\s*</);
  });
});
