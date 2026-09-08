// ─── AC — CONTAINMENT DUST_FLOOR ──────────────────────────────────────────
//
// ██  Un montant faible NE DÉMONTRE PAS l'absence d'une relation.          ██
//
// Le plancher mesurait une EXIGENCE DE RENT et servait de proxy à une
// propriété RELATIONNELLE. Il était évalué EN PREMIER — donc avant
// SELF_OR_KNOWN_ACTOR, KNOWN_EXCHANGE et PRIVATE_SHARED_FUNDER : une somme
// écrasait une provenance.
//
// L'invariant, avec sa nuance : un seuil monétaire PEUT représenter la
// quantité qu'il mesure réellement. Il NE DOIT PAS, à lui seul, servir de
// proxy à une propriété relationnelle ou comportementale. Le nombre reste donc
// à sa valeur exacte — le corriger l'aurait rendu exactement faux plus
// longtemps — mais il sort de la décision.
//
// Mesuré sur le corpus borné : 7 arêtes DUST avant, 0 après, 5 relations
// révélées — dont un acteur DÉJÀ IDENTIFIÉ dans l'affaire, et un exchange
// étiqueté.

import { describe, it, expect } from "vitest";
import {
  DUST_FLOOR_LAMPORTS,
  RENT_EXEMPT_MINIMUM_LAMPORTS,
  LAMPORTS_PER_SIGNATURE,
  qualifyFundingRelationship,
} from "../qualify";
import type { FundingEdge } from "../types";

const F = "Fnd11111111111111111111111111111111111111";
const S1 = "Su111111111111111111111111111111111111111";
const S2 = "Su222222222222222222222222222222222222222";
const EX = "Ex111111111111111111111111111111111111111";

const edge = (to: string, lamports: number, sig: string): FundingEdge => ({
  fromWallet: F,
  toWallet: to,
  asset: "SOL",
  amountLamports: lamports,
  txSignature: sig,
  blockTimeSeconds: 1_700_000_000,
  rowNature: "PRIMARY_OBSERVATION",
});

const COMPLETE = { complete: true };
const exchange = {
  address: EX,
  label: "Binance hot",
  isExchange: true,
  auditable: true,
  provenance: "solscan",
};

/**
 * L'ANCIENNE RÈGLE, réécrite ici de mémoire de la spec.
 *
 * Règle ratifiée n°1 : un témoin doit être INDÉPENDANT du code qu'il juge. Ce
 * témoin n'importe rien de `qualify.ts` sauf la constante — sinon il ne
 * pourrait pas décrire un comportement que le module ne porte plus.
 */
function categorieAvantContainment(i: {
  funder: string;
  subjectsReached: readonly string[];
  edges: readonly FundingEdge[];
  addressLabel?: typeof exchange | null;
  knownActors?: readonly string[];
}): string {
  const subjects = [...new Set(i.subjectsReached)];
  const total = i.edges.reduce((s, e) => s + e.amountLamports, 0);
  const label = i.addressLabel ?? null;
  const usable = label && label.auditable && label.provenance ? label : null;
  if (i.edges.length === 0) return "UNKNOWN";
  if (total < DUST_FLOOR_LAMPORTS) return "DUST";
  if (subjects.includes(i.funder) || new Set(i.knownActors ?? []).has(i.funder))
    return "SELF_OR_KNOWN_ACTOR";
  if (usable?.isExchange) return "KNOWN_EXCHANGE";
  if (subjects.length >= 2) return "PRIVATE_SHARED_FUNDER";
  return "UNKNOWN";
}

// ═══ 1 — UN MONTANT SEUL N'EXCLUT PLUS UNE RELATION ══════════════════════

describe("MUTANT — un montant faible SEUL ne peut pas exclure une relation", () => {
  it("aucune entrée sous le plancher ne produit plus DUST", () => {
    const cas = [
      { funder: F, subjectsReached: [S1, S2], edges: [edge(S1, 10_000, "a"), edge(S2, 10_000, "b")], coverage: COMPLETE },
      { funder: F, subjectsReached: [S1, S2], edges: [edge(S1, DUST_FLOOR_LAMPORTS - 1, "a")], coverage: COMPLETE },
      { funder: F, subjectsReached: [S1], edges: [edge(S1, 1, "a")], coverage: COMPLETE },
      { funder: F, subjectsReached: [S1], edges: [edge(S1, 0, "a")], coverage: COMPLETE },
    ];
    for (const c of cas) {
      expect(categorieAvantContainment(c)).toBe("DUST"); // le témoin confirme le AVANT
      expect(qualifyFundingRelationship(c).category).not.toBe("DUST");
    }
  });

  it("la catégorie DUST n'est plus JAMAIS produite, quel que soit le montant", () => {
    for (const lam of [0, 1, 5_000, 890_879, DUST_FLOOR_LAMPORTS - 1, DUST_FLOOR_LAMPORTS, 10 ** 9]) {
      const q = qualifyFundingRelationship({
        funder: F,
        subjectsReached: [S1, S2],
        edges: [edge(S1, lam, "a")],
        coverage: COMPLETE,
      });
      expect(q.category).not.toBe("DUST");
    }
  });
});

// ═══ 2 — LA PROVENANCE N'EST PLUS ÉCRASÉE PAR UN MONTANT ═════════════════

describe("MUTANT — une provenance identifiée ne peut pas être écrasée par un montant faible", () => {
  it("un bailleur qui EST un sujet reste SELF_OR_KNOWN_ACTOR à 1 000 lamports", () => {
    const input = {
      funder: S1,
      subjectsReached: [S1, S2],
      edges: [{ ...edge(S2, 1_000, "a"), fromWallet: S1 }],
      addressLabel: { ...exchange, address: S1 },
      coverage: COMPLETE,
    };
    // L'aggravant mesuré : avant, la poussière l'emportait sur l'identité.
    expect(categorieAvantContainment(input)).toBe("DUST");
    expect(qualifyFundingRelationship(input).category).toBe("SELF_OR_KNOWN_ACTOR");
  });

  it("un acteur DÉJÀ IDENTIFIÉ dans l'affaire reste identifié à 500 lamports", () => {
    const input = {
      funder: F,
      subjectsReached: [S1],
      edges: [edge(S1, 500, "a")],
      knownActors: [F],
      coverage: COMPLETE,
    };
    expect(categorieAvantContainment(input)).toBe("DUST");
    expect(qualifyFundingRelationship(input).category).toBe("SELF_OR_KNOWN_ACTOR");
  });

  it("un exchange à étiquette auditable reste un exchange à 700 lamports", () => {
    const input = {
      funder: EX,
      subjectsReached: [S1],
      edges: [{ ...edge(S1, 700, "a"), fromWallet: EX }],
      addressLabel: exchange,
      coverage: COMPLETE,
    };
    expect(categorieAvantContainment(input)).toBe("DUST");
    expect(qualifyFundingRelationship(input).category).toBe("KNOWN_EXCHANGE");
  });
});

// ═══ 3 — LE MONTANT DU RENT N'A AUCUNE SIGNIFICATION FORENSIC ════════════

describe("MUTANT — le montant exact du rent n'a aucune signification forensic", () => {
  it("franchir le plancher ne change AUCUNE catégorie", () => {
    // Le seul fait qui bougeait à ce nombre était la catégorie. Il ne bouge
    // plus : la valeur exacte n'a plus d'effet décisionnel.
    const base = (lam: number) => ({
      funder: F,
      subjectsReached: [S1, S2],
      edges: [edge(S1, lam, "a")],
      coverage: COMPLETE,
    });
    const dessous = qualifyFundingRelationship(base(DUST_FLOOR_LAMPORTS - 1));
    const pile = qualifyFundingRelationship(base(DUST_FLOOR_LAMPORTS));
    const dessus = qualifyFundingRelationship(base(DUST_FLOOR_LAMPORTS + 1));
    expect(dessous.category).toBe(pile.category);
    expect(pile.category).toBe(dessus.category);
  });

  it("le nombre n'a PAS été remplacé par un autre — il est resté exact", () => {
    // Le corriger en nombre l'aurait rendu exactement faux plus longtemps.
    expect(DUST_FLOOR_LAMPORTS).toBe(895_880);
    expect(DUST_FLOOR_LAMPORTS).toBe(RENT_EXEMPT_MINIMUM_LAMPORTS + LAMPORTS_PER_SIGNATURE);
    expect(DUST_FLOOR_LAMPORTS).not.toBe(810_624);
    expect(DUST_FLOOR_LAMPORTS).not.toBe(815_624);
  });

  it("le fait monétaire SURVIT, à côté de la catégorie et jamais dedans", () => {
    const q = qualifyFundingRelationship({
      funder: F,
      subjectsReached: [S1, S2],
      edges: [edge(S1, 20_000, "a")],
      coverage: COMPLETE,
    });
    expect(q.evidence.belowOperationalFloorLamports).toBe(true);
    expect(q.evidence.totalLamports).toBe(20_000);
    // Et la réserve dit ce que le montant n'établit PAS.
    const reserves = (q.natureBasis.basis as { reservations?: readonly string[] }).reservations ?? [];
    const r = reserves.find((x) => x.includes("OPERATIONAL FLOOR"));
    expect(r).toBeDefined();
    expect(r).toContain("MONETARY FACT ONLY");
    expect(r).toContain("does not establish the absence");
  });

  it("au-dessus du plancher, aucune réserve monétaire n'est fabriquée", () => {
    const q = qualifyFundingRelationship({
      funder: F,
      subjectsReached: [S1, S2],
      edges: [edge(S1, DUST_FLOOR_LAMPORTS, "a")],
      coverage: COMPLETE,
    });
    expect(q.evidence.belowOperationalFloorLamports).toBe(false);
    const reserves = (q.natureBasis.basis as { reservations?: readonly string[] }).reservations ?? [];
    expect(reserves.some((x) => x.includes("OPERATIONAL FLOOR"))).toBe(false);
  });
});

// ═══ 4 — PAS DE SUR-CORRECTION EN RELATION POSITIVE ══════════════════════

describe("MUTANT DE SUR-CORRECTION — le retrait ne fabrique aucune relation", () => {
  it("un seul sujet, aucune étiquette : UNKNOWN, la sortie neutre existante", () => {
    const input = { funder: F, subjectsReached: [S1], edges: [edge(S1, 100, "a")], coverage: COMPLETE };
    expect(categorieAvantContainment(input)).toBe("DUST");
    // Pas PRIVATE_SHARED_FUNDER, pas KNOWN_EXCHANGE : rien ne le prouve.
    expect(qualifyFundingRelationship(input).category).toBe("UNKNOWN");
  });

  it("sous couverture censurée, un montant faible ne devient pas une relation", () => {
    const q = qualifyFundingRelationship({
      funder: F,
      subjectsReached: [S1],
      edges: [edge(S1, 100, "a")],
      coverage: { complete: false, censoredBy: "page cap" },
    });
    expect(q.category).toBe("UNKNOWN");
    expect(q.coverage.resultIsFloor).toBe(true);
  });

  it("une étiquette NON auditable ne devient pas un exchange en franchissant le vide", () => {
    const q = qualifyFundingRelationship({
      funder: EX,
      subjectsReached: [S1],
      edges: [{ ...edge(S1, 700, "a"), fromWallet: EX }],
      addressLabel: { ...exchange, auditable: false },
      coverage: COMPLETE,
    });
    expect(q.category).toBe("UNKNOWN");
  });

  it("les classes affirmatives reposent chacune sur une preuve INDÉPENDANTE du montant", () => {
    // Aucune ne se déclenche sur le seul fait que le montant est faible.
    const sansPreuve = { funder: F, subjectsReached: [S1], edges: [edge(S1, 1, "a")], coverage: COMPLETE };
    const q = qualifyFundingRelationship(sansPreuve);
    expect(["SELF_OR_KNOWN_ACTOR", "KNOWN_EXCHANGE", "PRIVATE_SHARED_FUNDER"]).not.toContain(q.category);
  });

  it("aucune arête n'est EXCLUE — la preuve reste attachée dans tous les cas", () => {
    const q = qualifyFundingRelationship({
      funder: F,
      subjectsReached: [S1],
      edges: [edge(S1, 1, "a"), edge(S1, 2, "b")],
      coverage: COMPLETE,
    });
    expect(q.evidence.edgeCount).toBe(2);
    expect(q.evidence.txSignatures).toEqual(["a", "b"]);
  });
});

// ═══ 5 — LA MESURE AVANT / APRÈS, ÉPINGLÉE ═══════════════════════════════

describe("la mesure avant/après du corpus borné est verrouillée", () => {
  const CORPUS = [
    { nom: "2 sujets, 20 000 lamports", in: { funder: F, subjectsReached: [S1, S2], edges: [edge(S1, 10_000, "a"), edge(S2, 10_000, "b")], coverage: COMPLETE }, apres: "PRIVATE_SHARED_FUNDER" },
    { nom: "2 sujets, plancher − 1", in: { funder: F, subjectsReached: [S1, S2], edges: [edge(S1, DUST_FLOOR_LAMPORTS - 1, "a")], coverage: COMPLETE }, apres: "PRIVATE_SHARED_FUNDER" },
    { nom: "bailleur EST un sujet", in: { funder: S1, subjectsReached: [S1, S2], edges: [{ ...edge(S2, 1_000, "a"), fromWallet: S1 }], addressLabel: { ...exchange, address: S1 }, coverage: COMPLETE }, apres: "SELF_OR_KNOWN_ACTOR" },
    { nom: "acteur déjà identifié", in: { funder: F, subjectsReached: [S1], edges: [edge(S1, 500, "a")], knownActors: [F], coverage: COMPLETE }, apres: "SELF_OR_KNOWN_ACTOR" },
    { nom: "exchange auditable", in: { funder: EX, subjectsReached: [S1], edges: [{ ...edge(S1, 700, "a"), fromWallet: EX }], addressLabel: exchange, coverage: COMPLETE }, apres: "KNOWN_EXCHANGE" },
    { nom: "1 sujet, sans étiquette", in: { funder: F, subjectsReached: [S1], edges: [edge(S1, 100, "a")], coverage: COMPLETE }, apres: "UNKNOWN" },
    { nom: "couverture censurée", in: { funder: F, subjectsReached: [S1], edges: [edge(S1, 100, "a")], coverage: { complete: false, censoredBy: "page cap" } }, apres: "UNKNOWN" },
  ];

  it("7 arêtes DUST avant, 0 après", () => {
    expect(CORPUS.filter((c) => categorieAvantContainment(c.in) === "DUST")).toHaveLength(7);
    expect(CORPUS.filter((c) => qualifyFundingRelationship(c.in as never).category === "DUST")).toHaveLength(0);
  });

  it("chaque arête modifiée atterrit à la destination EXACTE mesurée", () => {
    for (const c of CORPUS) {
      expect(qualifyFundingRelationship(c.in as never).category, c.nom).toBe(c.apres);
    }
  });

  it("5 relations étaient MASQUÉES par DUST — le défaut coûtait de la preuve", () => {
    const affirmatives = ["SELF_OR_KNOWN_ACTOR", "KNOWN_EXCHANGE", "PRIVATE_SHARED_FUNDER"];
    const revelees = CORPUS.filter(
      (c) =>
        categorieAvantContainment(c.in) === "DUST" &&
        affirmatives.includes(qualifyFundingRelationship(c.in as never).category),
    );
    expect(revelees).toHaveLength(5);
    // Dont un acteur déjà identifié dans l'affaire : c'est l'aggravant.
    expect(revelees.map((r) => r.nom)).toContain("acteur déjà identifié");
    expect(revelees.map((r) => r.nom)).toContain("exchange auditable");
  });
});
