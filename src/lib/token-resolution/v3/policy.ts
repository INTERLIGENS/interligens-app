// ─── Politique de résolution V3 — SEUILS À EFFET PRODUIT ───────────────────
//
// ██  TOUT CE FICHIER EST « À RATIFIER ». RIEN N'EST RATIFIÉ ICI.  ██
//
// Chaque valeur décide, en production, qu'un token est servi comme certain ou
// renvoyé en désambiguïsation. Ce sont des arbitrages produit, regroupés,
// nommés et datés pour être ratifiés explicitement.
//
// ─── Ce que V3 RETIRE de la V2, et pourquoi ──────────────────────────────
//
// highConfidenceChains / moderateOnlyChains — SUPPRIMÉS.
//   La V2 plafonnait la confiance selon la chaîne : HIGH réservé à Solana,
//   MODERATE ailleurs. C'était une PRÉFÉRENCE SOLANA CACHÉE déguisée en
//   prudence : elle décidait, à la place des consommateurs, qu'un token ETH
//   documenté par un dossier publié valait moins qu'un token SOL trouvé sur un
//   marché. La chaîne ne mesure pas la qualité d'une preuve. En V3 la chaîne
//   n'est plus un plafond de confiance : c'est un PÉRIMÈTRE déclaré par
//   l'appelant (ResolutionRequest.allowedChains), et un asset hors périmètre
//   est résolu puis marqué UNSUPPORTED_BY_CALLER.
//
// crossChainDominanceRatio — NEUTRALISÉ pour l'identité.
//   La V2 tranchait une collision de symbole inter-chaînes quand un candidat
//   avait 2× la liquidité de l'autre. Sous E5, aucune quantité de liquidité ne
//   répond à une question d'identité : deux contrats au même symbole restent
//   deux tokens. Le seuil ne peut plus produire de RESOLVED ; il ne sert plus
//   qu'à qualifier la formulation d'un conflit.

import type { CanonicalChain } from "./chain";

export interface ResolutionPolicy {
  /**
   * À RATIFIER — plancher de liquidité pour auto-résoudre sur une source de
   * marché seule. Inchangé depuis la V2 (1000 $), MAIS il ne peut plus être
   * « satisfait » par une source sans marché : voir marketlessSourcesCanAutoResolve.
   */
  minLiquidityUsdForAutoResolve: number;

  /**
   * À RATIFIER — I3. Une source qui ne porte AUCUNE donnée de marché
   * (CoinGecko, index de dossiers, preset, RPC) peut-elle auto-résoudre à elle seule ?
   * Origine du problème : la V1 fabriquait pour CoinGecko `matchType:'exact'`
   * et `lowLiquidity:false` en dur ; `decideResolution` lisait « exact et pas
   * illiquide » et résolvait. L'absence de donnée était lue comme une donnée
   * favorable. Défaut V3 : false.
   */
  marketlessSourcesCanAutoResolve: boolean;

  /**
   * À RATIFIER — J3. Un ticker de la liste noire (BTC, SOL, PEPE, AI…) peut-il
   * être auto-résolu ? Défaut : jamais, sur TOUS les chemins. En V2 le contrôle
   * n'était appliqué que sur une branche du décideur : dès qu'une adresse était
   * présente dans la requête sans pouvoir être localisée, la vérification était
   * sautée et un ticker générique pouvait se résoudre.
   */
  genericTickerNeverAutoResolves: boolean;

  /**
   * À RATIFIER — un lien curé (revue humaine) tranche-t-il sur une
   * correspondance de PRÉFIXE ? Conservé de la V1, mais désormais soumis aux
   * deux conditions ci-dessous, et plafonné à MODERATE.
   */
  internalResolvesOnPrefix: boolean;

  /**
   * À RATIFIER — V3-3. Un lien curé doit-il appartenir au périmètre de chaînes
   * déclaré par l'appelant pour être retenu ? Défaut : oui. La curation
   * atteste un CONTRAT, pas une autorité universelle : un lien curé sur BSC ne
   * répond pas à un appelant qui ne sait traiter que Solana.
   */
  curatedRequiresChainBinding: boolean;

  /**
   * À RATIFIER — V3-3 + D2. Un lien curé temporellement impossible est-il
   * écarté comme les autres ? Défaut : oui. Une curation humaine peut être
   * postérieure à l'observation ; elle n'annule pas la flèche du temps.
   */
  curatedRequiresTemporalCompatibility: boolean;

  /**
   * À RATIFIER — un mint confirmé on-chain mais absent de tout marché
   * (pump.fun de quelques minutes) peut-il être servi comme RESOLVED ?
   * Conservé du bridge V1, plafonné à MODERATE faute de symbole vérifiable.
   */
  resolveOnChainOnlyMint: boolean;

  /**
   * À RATIFIER — D2, régime STRICT. Tolérance appliquée aux preuves qui
   * bornent réellement la naissance du contrat (launch metric, dossier).
   * Défaut 24 h : couvre les décalages d'horloge et les dates déclarées à la
   * journée, sans laisser passer un écart réel.
   */
  temporalToleranceMs: number;

  /**
   * À RATIFIER — D2, régime INDIRECT. Tolérance appliquée aux preuves qui ne
   * bornent PAS la naissance du contrat : pairCreatedAt borne la PAIRE, pas le
   * mint ; createdAt borne la LIGNE en base. Un token peut exister et être
   * poussé longtemps avant d'obtenir sa paire. Défaut 30 jours : au-delà,
   * l'écart cesse d'être explicable par ce décalage.
   */
  temporalWeakToleranceMs: number;

  /**
   * À RATIFIER — facteur de domination de liquidité. Ne produit plus de
   * RESOLVED (voir en-tête) ; ne sert qu'à qualifier un conflit inter-chaînes.
   */
  crossChainDominanceRatio: number;

  /** À RATIFIER — nombre de candidats renvoyés. Origine : 8 sur /api/scan/resolve. */
  maxCandidatesReturned: number;

  /**
   * À RATIFIER — plafond d'appels sortants par exécution, par provider.
   * Borne dure : au-delà, l'appel est REFUSÉ et compté (budgetRefusals), jamais
   * silencieusement omis. Protège contre une requête pathologique qui sonderait
   * des dizaines d'adresses.
   */
  maxProviderCallsPerRun: number;
}

export const DEFAULT_POLICY: ResolutionPolicy = {
  minLiquidityUsdForAutoResolve: 1000,
  marketlessSourcesCanAutoResolve: false,
  genericTickerNeverAutoResolves: true,
  internalResolvesOnPrefix: true,
  curatedRequiresChainBinding: true,
  curatedRequiresTemporalCompatibility: true,
  resolveOnChainOnlyMint: true,
  temporalToleranceMs: 24 * 60 * 60 * 1000,
  temporalWeakToleranceMs: 30 * 24 * 60 * 60 * 1000,
  crossChainDominanceRatio: 2,
  maxCandidatesReturned: 8,
  maxProviderCallsPerRun: 40,
};

/**
 * Périmètre de l'appelant. La chaîne ne plafonne plus la confiance : elle dit
 * seulement si l'appelant sait traiter l'asset. Un appelant qui ne déclare
 * aucune chaîne les accepte toutes — mais il doit le déclarer, pas l'omettre.
 */
export function isChainAllowed(
  allowed: readonly CanonicalChain[] | undefined,
  chain: CanonicalChain,
): boolean {
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(chain);
}
