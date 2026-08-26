// ─── Politique de résolution — SEUILS À EFFET PRODUIT ──────────────────────
//
// ██  TOUT CE FICHIER EST « À RATIFIER ».  ██
//
// Chaque valeur ci-dessous décide, en production, qu'un token est servi comme
// certain ou renvoyé en désambiguïsation. Ce ne sont pas des détails
// d'implémentation : ce sont des arbitrages produit. Ils sont regroupés ici,
// nommés, datés et documentés pour qu'ils soient RATIFIÉS explicitement — pas
// découverts un jour dans une condition au milieu d'une fonction.
//
// Origine de chaque valeur : les deux résolveurs V1 recensés le 2026-08-26.
// Là où les deux DIVERGENT, la V2 retient par défaut la position la PLUS
// PRUDENTE des deux, et le note. Choisir silencieusement l'une des deux serait
// trancher une doctrine sans mandat.

import type { CanonicalChain } from "./chain";

export interface ResolutionPolicy {
  /**
   * À RATIFIER — plancher de liquidité pour auto-résoudre sur une source
   * externe seule. Origine : marketProviders marque lowLiquidity sous 1000 $ et
   * decideCashtag refuse d'auto-résoudre en dessous. La recherche DexScreener
   * amont, elle, inclut déjà les paires à partir de 250 $ : un candidat entre
   * 250 et 1000 $ existe donc dans la liste sans pouvoir gagner. C'est voulu.
   */
  minLiquidityUsdForAutoResolve: number;

  /**
   * À RATIFIER — chaînes sur lesquelles une source EXTERNE seule peut porter
   * une résolution à HIGH.
   *
   * DIVERGENCE V1 : le bridge n'auto-résout que SOL
   * (KNOWN_AUTORESOLVE_CHAINS = ["SOL"]) ; le scan public en accepte cinq
   * (KNOWN_ROUTABLE_CHAINS = SOL, ETH, BSC, BASE, ARBITRUM). La V2 retient la
   * position prudente : HIGH réservé à SOL, les autres chaînes routables
   * plafonnent à MODERATE (voir moderateOnlyChains). Se tromper de chaîne est
   * critique sur un produit anti-arnaque — l'utilisateur scannerait un homonyme.
   */
  highConfidenceChains: ReadonlySet<CanonicalChain>;

  /** À RATIFIER — chaînes résolvables, mais jamais au-delà de MODERATE. */
  moderateOnlyChains: ReadonlySet<CanonicalChain>;

  /**
   * À RATIFIER — facteur de domination exigé pour trancher une collision de
   * symbole exact ENTRE CHAÎNES. Origine : decideResolution exige un rapport de
   * liquidité ≥ 2 avant de désigner un gagnant inter-chaînes.
   */
  crossChainDominanceRatio: number;

  /**
   * À RATIFIER — une source interne (dossier publié, lien curé, CA_MAP,
   * mention) suffit-elle à résoudre sur une correspondance de PRÉFIXE ?
   * Origine : oui côté scan V1 (« internal hits are trusted »). Conservé, parce
   * qu'un lien curé est le fruit d'une revue humaine — mais la confiance
   * plafonne alors à MODERATE, ce que la V1 ne faisait pas.
   */
  internalResolvesOnPrefix: boolean;

  /**
   * À RATIFIER — un mint confirmé on-chain mais absent de tout marché
   * (pump.fun de quelques minutes) peut-il être servi comme RESOLVED ?
   * Origine : oui côté bridge, en HIGH, avec la limitation notée. C'est la
   * population que l'anti-arnaque doit précisément attraper tôt. Conservé,
   * mais la confiance plafonne à MODERATE faute de symbole vérifiable.
   */
  resolveOnChainOnlyMint: boolean;

  /**
   * À RATIFIER — nombre de candidats renvoyés à l'appelant. Au-delà, la liste
   * n'aide plus à désambiguïser. Origine : 8 sur /api/scan/resolve.
   */
  maxCandidatesReturned: number;
}

export const DEFAULT_POLICY: ResolutionPolicy = {
  minLiquidityUsdForAutoResolve: 1000,
  highConfidenceChains: new Set<CanonicalChain>(["SOL"]),
  moderateOnlyChains: new Set<CanonicalChain>(["ETH", "BSC", "BASE", "ARBITRUM"]),
  crossChainDominanceRatio: 2,
  internalResolvesOnPrefix: true,
  resolveOnChainOnlyMint: true,
  maxCandidatesReturned: 8,
};

/** Chaîne résolvable du tout (HIGH ou MODERATE) selon la politique donnée. */
export function isResolvableChain(policy: ResolutionPolicy, chain: CanonicalChain): boolean {
  return policy.highConfidenceChains.has(chain) || policy.moderateOnlyChains.has(chain);
}
