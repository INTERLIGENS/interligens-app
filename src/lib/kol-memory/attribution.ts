// ─── BUILD 8 / P0 — L'ATTRIBUTION D'UN WALLET À UNE PERSONNE ───────────────
//
// ██  Ce module décide à QUI appartient une adresse. C'est la plus            ██
// ██  nominative des décisions du produit. Elle est DÉRIVÉE, jamais posée.    ██
//
// ─── Ce qu'il corrige, et pourquoi c'est I1 ────────────────────────────────
//
// `src/lib/kol/identity.ts` porte DEUX comportements contradictoires dans le
// même fichier :
//
//   resolveHandleToWallets  → traduit fidèlement la confiance de la base via
//                             mapDbConfidence().
//   resolveWalletToKol      → rend `confidence: "exact"` et `source: "manual"`
//                             EN DUR dès qu'une ligne existe, quels que soient
//                             sa confidence et son attributionSource réels.
//
// Mesuré sur ep-square-band le 2026-09-07 : 482 KolWallet, dont 194 en
// `attributionStatus='review'` et non publiables. Les 194 ressortaient
// « exact / manual » — c'est-à-dire au rang d'autorité MAXIMAL de l'échelle,
// depuis une ligne que le produit lui-même déclare non revue.
//
// C'est exactement I1 pris à l'envers : la nature ne remonte jamais l'échelle.
// Une attribution `candidate` ne devient pas `exact` parce qu'une ligne existe.
// L'existence d'une ligne n'est pas une preuve d'identité — c'est une trace de
// travail en cours.
//
// ─── Pourquoi la correction est FAIL-CLOSED, sans exception ────────────────
//
// Le mode de défaillance ici n'est pas symétrique. Sous-attribuer coûte une
// revue humaine ; sur-attribuer publie le nom d'une personne à côté d'une
// adresse qui n'est peut-être pas la sienne. Toute valeur inconnue,
// inattendue, absente ou vide descend donc au rang le PLUS BAS — jamais au
// plus haut, jamais à un défaut « raisonnable ».
//
//     UNKNOWN ≠ SAFE · UNE LIGNE ≠ UNE PREUVE
//
// ─── Ce que ce module ne fait PAS ──────────────────────────────────────────
//
// Il ne rend aucun verdict. `exact` n'affirme pas que la personne est
// coupable de quoi que ce soit : il affirme qu'un humain a confirmé que
// l'adresse est la sienne. Les deux énoncés n'ont rien à voir et ne doivent
// jamais être confondus par un consommateur.

import { prisma } from "@/lib/prisma";

// ─── L'échelle, du plus autoritaire au moins ───────────────────────────────
//
// Identique à celle de src/lib/kol/identity.ts : ce module la REPREND, il ne
// la redéfinit pas. Un consommateur qui migre ne change pas de vocabulaire.

export type WalletMatchConfidence =
  | "exact"
  | "strong"
  | "probable"
  | "candidate"
  | "unresolved";

export type WalletMatchSource =
  | "manual"
  | "on_chain_footprint"
  | "airdrop"
  | "promotion_tx"
  | "inferred";

/** Rang d'autorité décroissant. Sert UNIQUEMENT à interdire la remontée. */
const CONFIDENCE_RANK: Record<WalletMatchConfidence, number> = {
  exact: 4,
  strong: 3,
  probable: 2,
  candidate: 1,
  unresolved: 0,
};

// ─── Le vocabulaire legacy était une FICTION ───────────────────────────────
//
// Mesuré sur ep-square-band le 2026-09-07 :
//
//     SELECT count(*) FROM "KolWallet"
//      WHERE "attributionSource" IN ('manual','on_chain_footprint',
//                                    'airdrop','promotion_tx','inferred');
//     → 0   (sur 482 lignes)
//
// Les cinq valeurs que `mapDbSource` traduisait n'existent DANS AUCUNE LIGNE.
// La colonne porte 18 étiquettes de provenance — `botify_leaked_doc`, `sns`,
// `ens`, `arkham_intel`, `dune_4838225`… — c'est-à-dire D'OÙ vient la preuve,
// pas COMMENT l'attribution a été faite. Deux questions différentes logées
// dans une colonne.
//
// Conséquence directe, et c'est le même défaut que celui qu'on corrige :
// `attributionSource === 'manual'` ne peut JAMAIS être vrai. Toute règle qui
// l'exige est une branche morte. `computeIdentityConfidence` dans
// src/lib/kol/canonical.ts porte exactement cette condition — son niveau
// `exact` est donc inatteignable, pour les 412 profils.
//
// La dérivation se fait donc sur `claimType`, le vocabulaire Publishing
// Standard v1 déclaré dans src/lib/kol/types.ts, qui LUI est peuplé :
//
//     source_attributed    422   un tiers l'affirme
//     verified_onchain      19   le produit l'a constaté on-chain
//     analytical_estimate   29   le produit l'a déduit
//     attributed / onchain_confirmed / self_posted   12   hors standard
//
// Les trois dernières sont des synonymes ou des valeurs hors norme. On ne les
// rapproche PAS : la fusion des synonymes de KolWallet est une tâche déjà
// identifiée et planifiée (registre Data Nature, étape S4). Les rapprocher ici
// serait décider à sa place. Elles tombent donc au rang le plus bas.

/** Les valeurs `claimType` du Publishing Standard v1. Rien d'autre n'est connu. */
const CLAIM_VERIFIED_ONCHAIN = "verified_onchain";
const CLAIM_SOURCE_ATTRIBUTED = "source_attributed";
const CLAIM_ANALYTICAL_ESTIMATE = "analytical_estimate";

export class AttributionUpgradeError extends Error {
  constructor(from: WalletMatchConfidence, to: WalletMatchConfidence, where: string) {
    super(
      `[kol-memory] attribution refusée (${where}) : ${from} → ${to} remonte ` +
        "l'échelle d'autorité. Une attribution ne gagne pas en certitude parce " +
        "qu'on la relit (I1).",
    );
    this.name = "AttributionUpgradeError";
  }
}

/** La forme minimale qu'une ligne KolWallet doit présenter pour être dérivée. */
export interface AttributionRow {
  readonly confidence?: unknown;
  readonly attributionStatus?: unknown;
  readonly attributionSource?: unknown;
  readonly claimType?: unknown;
}

export interface WalletMatchResult {
  handle: string | null;
  confidence: WalletMatchConfidence;
  source: WalletMatchSource;
  /**
   * L'étiquette de provenance DÉCLARÉE, verbatim — `botify_leaked_doc`,
   * `arkham_intel`, `sns`…
   *
   * Elle existe parce que `source` ne peut pas la porter sans mentir : réduire
   * 18 provenances réelles à 5 catégories fictives est exactement le
   * blanchiment qu'on corrige. La catégorie dit ce que le produit a FAIT ;
   * cette étiquette dit d'où il le tient. Les deux, ou aucune.
   */
  sourceLabel?: string | null;
  evidence: string[];
  requiresHumanReview: boolean;
}

// ─── Dérivation ────────────────────────────────────────────────────────────

/**
 * `exact` exige DEUX conditions simultanées : le produit a CONFIRMÉ
 * l'attribution (`attributionStatus = 'confirmed'`) ET il déclare l'avoir
 * CONSTATÉE on-chain (`claimType = 'verified_onchain'`).
 *
 * Confirmer sans avoir constaté, c'est croire une source. Constater sans avoir
 * confirmé, c'est un travail en cours. Le rang maximal exige les deux, et il
 * est atteint par 15 lignes sur 482 — un palier réel, pas une branche morte.
 */
export function deriveAttributionConfidence(row: AttributionRow): WalletMatchConfidence {
  const status = typeof row.attributionStatus === "string" ? row.attributionStatus : "";
  const conf = typeof row.confidence === "string" ? row.confidence : "";
  const claim = typeof row.claimType === "string" ? row.claimType : "";

  if (status === "confirmed" && claim === CLAIM_VERIFIED_ONCHAIN) return "exact";
  if (status === "confirmed" || conf === "high") return "strong";
  if (conf === "medium") return "probable";
  // Tout le reste — 'low', 'suspected', 'review', 'unverified', '', une valeur
  // inconnue, un null, un nombre : candidate. Le rang le plus bas au-dessus de
  // l'absence.
  return "candidate";
}

/**
 * La CATÉGORIE de méthode, dérivée de `claimType` — pas de la colonne
 * `attributionSource`, dont on a mesuré qu'elle ne porte pas ce vocabulaire.
 *
 * `manual`, `airdrop` et `promotion_tx` sont INATTEIGNABLES sur les données du
 * 2026-09-07, et c'est le résultat correct : aucune ligne n'enregistre qu'un
 * humain a posé l'attribution à la main, ni qu'elle vient d'un airdrop ou
 * d'une transaction de promotion. Le type reste plus large que la donnée ; un
 * test consigne exactement cet écart plutôt que de le masquer.
 */
export function deriveAttributionSource(row: AttributionRow): WalletMatchSource {
  const claim = typeof row.claimType === "string" ? row.claimType : "";
  if (claim === CLAIM_VERIFIED_ONCHAIN) return "on_chain_footprint";
  // `source_attributed` (un tiers l'affirme) et `analytical_estimate` (le
  // produit l'a déduit) sont deux façons de NE PAS avoir constaté soi-même.
  // Les deux tombent en `inferred` : la catégorie dit ce que le produit a
  // fait, et dans les deux cas il n'a rien constaté.
  if (claim === CLAIM_SOURCE_ATTRIBUTED || claim === CLAIM_ANALYTICAL_ESTIMATE) return "inferred";
  return "inferred";
}

/** L'étiquette de provenance déclarée, verbatim. Jamais normalisée. */
export function declaredSourceLabel(row: AttributionRow): string | null {
  return typeof row.attributionSource === "string" && row.attributionSource.length > 0
    ? row.attributionSource
    : null;
}

/**
 * Une ligne que le produit n'a pas confirmée exige une revue humaine. Le
 * critère est la donnée elle-même (`attributionStatus`), pas un jugement porté
 * ici : c'est le produit qui déclare ce qu'il a validé.
 */
export function requiresHumanReview(row: AttributionRow): boolean {
  return (typeof row.attributionStatus === "string" ? row.attributionStatus : "") !== "confirmed";
}

/**
 * I1 appliqué à l'attribution — le garde-fou mécanique.
 *
 * Toute dérivation passe par ici. Si un correctif futur réintroduit un
 * `"exact"` en dur, ou si une table de correspondance dérape, l'écart entre ce
 * que la ligne porte et ce qu'on en tire devient une exception, pas un silence.
 */
export function assertNoUpgrade(
  row: AttributionRow,
  derived: WalletMatchConfidence,
  where: string,
): WalletMatchConfidence {
  const ceiling = deriveAttributionConfidence(row);
  if (CONFIDENCE_RANK[derived] > CONFIDENCE_RANK[ceiling]) {
    throw new AttributionUpgradeError(ceiling, derived, where);
  }
  return derived;
}

// ─── Résolutions ───────────────────────────────────────────────────────────

/**
 * Adresse → personne. Le remplaçant de `resolveWalletToKol`.
 *
 * Différence de comportement assumée et mesurée : là où l'ancienne fonction
 * rendait `exact/manual` pour les 482 lignes actives, celle-ci ne le rend que
 * pour les lignes `confirmed` + `manual`. Les consommateurs qui gatent sur
 * `confidence === "exact"` verront donc leur déclenchement se resserrer. C'est
 * le sens du correctif, pas un effet de bord : recalculer des proceeds
 * nominatifs depuis une attribution non revue est exactement ce qu'I1 refuse.
 */
export async function resolveWalletAttribution(
  address: string,
  chain: string,
): Promise<WalletMatchResult> {
  const wallet = await prisma.kolWallet.findFirst({
    where: {
      address: { equals: address, mode: "insensitive" },
      chain: { equals: chain, mode: "insensitive" },
      status: "active",
    },
    select: {
      kolHandle: true,
      confidence: true,
      attributionSource: true,
      attributionStatus: true,
      claimType: true,
      label: true,
      sourceUrl: true,
    },
  });

  // Aucune ligne : `unresolved`, et une revue humaine. Surtout pas un handle
  // deviné, surtout pas un rang par défaut.
  if (!wallet) {
    return {
      handle: null,
      confidence: "unresolved",
      source: "inferred",
      evidence: [],
      requiresHumanReview: true,
    };
  }

  const evidence: string[] = [];
  if (wallet.label) evidence.push(`label: ${wallet.label}`);
  if (wallet.sourceUrl) evidence.push(`source: ${wallet.sourceUrl}`);
  // La preuve porte désormais CE QUI A ÉTÉ LU, pas seulement ce qui est joli à
  // afficher : un consommateur doit pouvoir refaire la dérivation lui-même.
  evidence.push(`attributionStatus: ${wallet.attributionStatus}`);
  evidence.push(`confidence: ${wallet.confidence}`);
  evidence.push(`claimType: ${wallet.claimType ?? "(absent)"}`);
  evidence.push(`attributionSource: ${wallet.attributionSource ?? "(absent)"}`);

  const confidence = assertNoUpgrade(
    wallet,
    deriveAttributionConfidence(wallet),
    "resolveWalletAttribution",
  );

  return {
    handle: wallet.kolHandle,
    confidence,
    source: deriveAttributionSource(wallet),
    sourceLabel: declaredSourceLabel(wallet),
    evidence,
    requiresHumanReview: requiresHumanReview(wallet),
  };
}

// ─── Hors périmètre, délibérément ──────────────────────────────────────────
//
// `src/lib/ingestion/pipeline.ts` porte le MÊME `exact/manual` en dur sur ses
// branches `handle` et `casefile` (résolution handle → KolProfile, en ligne).
// Ce n'est pas la même affirmation : « cette adresse est à cette personne »
// et « ce handle existe dans notre base » se trompent différemment et se
// corrigent différemment.
//
// L'arbitrage nomme `resolveWalletToKol`. On s'y tient : la branche handle
// part au backlog, nommée, plutôt que d'élargir le build à un audit KOL
// général. Voir docs/reports/build8-p0-p2.md § BACKLOG.
