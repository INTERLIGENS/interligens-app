// src/lib/kol/identity.ts
//
// ─── BUILD 8 / P0 — CE MODULE EST DEVENU UNE DÉLÉGATION ────────────────────
//
// ██  L'autorité vit désormais dans src/lib/kol-memory/attribution.ts.       ██
// ██  Ce fichier n'est conservé que pour ses appelants historiques.          ██
//
// Ce qu'il faisait, et pourquoi c'était faux :
//
//   `resolveWalletToKol` rendait `confidence: "exact"` et `source: "manual"`
//   EN DUR dès qu'une ligne existait, quels que soient la confiance et
//   l'origine réelles de cette ligne. Mesuré sur ep-square-band le 2026-09-07 :
//   482 KolWallet actifs, donc 482 attributions servies au rang d'autorité
//   MAXIMAL — dont 232 que le produit lui-même n'avait jamais confirmées.
//
//   C'est I1 pris à l'envers, dans le module qui décide à qui appartient une
//   adresse : une attribution ne gagne pas en certitude parce qu'on la relit.
//
// Et pourquoi `mapDbSource` était une fiction :
//
//   Les cinq valeurs qu'il traduisait — manual, on_chain_footprint, airdrop,
//   promotion_tx, inferred — n'existent DANS AUCUNE LIGNE (0 sur 482). La
//   colonne `attributionSource` porte 18 étiquettes de provenance
//   (botify_leaked_doc, sns, arkham_intel, dune_4838225…), c'est-à-dire D'OÙ
//   vient la preuve, pas COMMENT l'attribution a été faite.
//
//   La dérivation se fait donc sur `claimType`, seul vocabulaire réellement
//   peuplé. Voir l'en-tête de kol-memory/attribution.ts pour le détail.
//
// ─── Pourquoi une délégation et pas une suppression ────────────────────────
//
// Deux implémentations d'une même décision, c'est le défaut D11 du rapport S0.
// Une délégation n'en laisse qu'UNE : ce fichier ne décide plus rien, il
// réexporte. Le supprimer casserait ses appelants sans rien corriger de plus.

export type {
  WalletMatchConfidence,
  WalletMatchSource,
  WalletMatchResult,
} from "@/lib/kol-memory/attribution";

import {
  resolveWalletAttribution,
  deriveAttributionConfidence,
  deriveAttributionSource,
  declaredSourceLabel,
  type WalletMatchConfidence,
  type WalletMatchResult,
} from "@/lib/kol-memory/attribution";

import { prisma } from "@/lib/prisma";

export type WalletAttributionRow = {
  address: string;
  chain: string;
  label: string | null;
  confidence: WalletMatchConfidence;
  source: string;
  attributionStatus: string;
  discoveredAt: Date | null;
};

/**
 * Adresse → personne.
 *
 * @deprecated Utiliser `resolveWalletAttribution` de `@/lib/kol-memory/attribution`.
 * Conservé comme alias pour les appelants historiques ; le comportement est
 * désormais celui du module d'autorité, pas celui d'origine.
 */
export function resolveWalletToKol(
  address: string,
  chain: string,
): Promise<WalletMatchResult> {
  return resolveWalletAttribution(address, chain);
}

/**
 * Handle → ses adresses.
 *
 * `source` rend désormais l'étiquette de provenance DÉCLARÉE (verbatim) quand
 * elle existe, et retombe sur la catégorie dérivée sinon. Réduire 18
 * provenances réelles à 5 catégories fictives était le blanchiment que P0
 * corrige — le lecteur doit voir `botify_leaked_doc`, pas `inferred`.
 */
export async function resolveHandleToWallets(
  handle: string,
): Promise<WalletAttributionRow[]> {
  const wallets = await prisma.kolWallet.findMany({
    where: {
      kolHandle: { equals: handle, mode: "insensitive" },
      status: "active",
    },
    select: {
      address: true,
      chain: true,
      label: true,
      confidence: true,
      attributionSource: true,
      attributionStatus: true,
      claimType: true,
      discoveredAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return wallets.map((w) => ({
    address: w.address,
    chain: w.chain,
    label: w.label,
    confidence: deriveAttributionConfidence(w),
    source: declaredSourceLabel(w) ?? deriveAttributionSource(w),
    attributionStatus: w.attributionStatus,
    discoveredAt: w.discoveredAt,
  }));
}
