// ─── W2 — les deux invariants nés des 482 M$ ───────────────────────────────
//
// Le casefile $LAB publiait « Estimated retail harm — $482M ». Le montant était
// JUSTE : 100 000 000 LAB × ~4,82 $. L'arithmétique se reproduit, le prix est
// dans la fourchette documentée, et l'observation de départ est tracée et datée
// par ZachXBT.
//
// Ce qui était faux, c'est ce que le chiffre AFFIRMAIT. Il mesure ce que des
// insiders ont sorti ; il était publié comme ce que des particuliers ont perdu.
// Personne n'a jamais calculé la seconde grandeur. Le glissement a tenu des
// mois parce que rien, dans le code, ne distinguait « le calcul est bon » de
// « l'affirmation est bonne ».
//
// Ces deux constantes existent pour que la leçon survive à la correction.

/**
 * DN-C1 — Correct calculation ≠ correct claim.
 *
 * Vérifier une arithmétique ne valide pas l'affirmation qu'elle porte. Un
 * produit exact peut être publié sous un label qui décrit une autre grandeur ;
 * la justesse du calcul rend alors l'erreur PLUS crédible, pas moins.
 *
 * Conséquence pratique : la relecture d'un montant ne s'arrête jamais au
 * calcul. Elle demande « de quoi ce nombre est-il la mesure ? », puis « est-ce
 * ce que le champ prétend ? ».
 */
export const DN_C1_CALCULATION_IS_NOT_CLAIM =
  "Correct calculation is not a correct claim: verifying the arithmetic of a monetary figure says nothing about whether the quantity it measures is the quantity being asserted." as const;

/**
 * DN-C2 — Monetary quantities require semantic identity.
 *
 * « 482 M$ » ne suffit JAMAIS. Un montant sans identité sémantique est
 * ininterprétable, et se laisse ranger sous n'importe quel label. Tout champ
 * monétaire doit déclarer LAQUELLE de ces grandeurs il porte — elles ne sont
 * pas interchangeables, et aucune n'implique l'autre.
 */
export const MONETARY_SEMANTIC_KINDS = [
  "MARKET_CAP",           // prix × supply en circulation
  "FDV",                  // prix × supply totale — jamais un dénominateur d'échelle
  "NOTIONAL_VALUE",       // quantité × prix de référence, sans réalisation
  "REALIZED_PROCEEDS",    // produit effectivement encaissé, flux de valeur en regard
  "DOCUMENTED_TRANSFERS", // volume transféré, sans valorisation
  "INVESTOR_LOSSES",      // perte des porteurs, mesurée
  "RETAIL_HARM",          // préjudice des particuliers, mesuré
  "ESTIMATE",             // grandeur dérivée par une méthode déclarée
] as const;

export type MonetarySemanticKind = (typeof MONETARY_SEMANTIC_KINDS)[number];

export const DN_C2_MONETARY_SEMANTIC_IDENTITY =
  "Monetary quantities require semantic identity: an amount alone is never sufficient. Every monetary field must declare which quantity it carries — market cap, FDV, notional value, realized proceeds, documented transfers, investor losses, retail harm, or estimate." as const;

/**
 * Le cas fondateur, gardé en dur : il documente à quoi ressemble la faute, et
 * sert de fixture aux tests. Ce n'est pas de la décoration — c'est le seul
 * exemple mesuré qu'on ait d'un montant exact publié sous la mauvaise identité.
 */
export const W2_LAB_CASE = {
  casefileRef: "IL-PND-LAB-001",
  amountUsd: 482_000_000,
  /** Ce que le nombre mesure réellement. */
  actualKind: "NOTIONAL_VALUE" satisfies MonetarySemanticKind,
  /** Ce sous quoi il était publié. */
  publishedAsKind: "RETAIL_HARM" satisfies MonetarySemanticKind,
  formula: "100_000_000 LAB × ~4.82 USD/LAB",
  /** La quantité d'entrée n'est pas une observation primaire d'INTERLIGENS. */
  quantityNature: "THIRD_PARTY_DATA",
  quantityAttributedTo: "ZachXBT",
  /** La valorisation, elle, est notre opération. */
  valuationNature: "ESTIMATE",
  /** Aucune méthodologie gelée ne couvre cette grandeur. */
  applicableMethodRef: null,
  floatCaveatPct: 131,
  scaleReference: "peak circulating market capitalization",
} as const;
