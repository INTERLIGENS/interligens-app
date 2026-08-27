// ─── Politique de résolution V3 — SEUILS À EFFET PRODUIT ───────────────────
//
// ██  VALEURS RATIFIÉES — checkpoint doctrine du 2026-08-27.  ██
//
// Ce fichier n'est plus une proposition. Chaque valeur ci-dessous a été
// arbitrée. Les commentaires disent désormais CE QUI A ÉTÉ DÉCIDÉ et pourquoi,
// avec le cas de backtest qui mesure l'effet — pas ce qu'il faudrait décider.
// Référence : docs/prep/BUILD1_CHECKPOINT_DOCTRINE_2026-08-27.md
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
   * RATIFIÉ — 1 000 $. Plancher pour auto-résoudre une requête AMBIGUË sur une
   * source de marché seule.
   *
   * ─── Ce que ce seuil ne gouverne PAS ────────────────────────────────────
   * Il ne gouverne **pas** l'identité contractuelle EXPLICITE. Quand l'appelant
   * fournit un CA ou un mint, l'identité est déjà tranchée par la requête
   * elle-même : le token DOIT se résoudre, même mort, même illiquide, même à
   * zéro de liquidité. C'est précisément la population que le produit existe
   * pour documenter — refuser d'identifier un token rugué parce qu'il est rugué
   * serait absurde.
   *
   * Le plancher n'intervient que sur le chemin « ticker → marché », là où il
   * s'agit de choisir entre des candidats, pas de confirmer une adresse donnée.
   * Vérifié par test dédié (UR-13).
   */
  minLiquidityUsdForAutoResolve: number;

  /**
   * RATIFIÉ — I3, `true`, avec plafond dur MODERATE.
   *
   * Une source sans donnée de marché (catalogue CoinGecko, index de dossiers,
   * preset, RPC) PEUT résoudre — mais seulement quand les trois conditions sont
   * réunies, et jamais au-delà de MODERATE :
   *   • contrat UNIQUE — aucun contrat rival ne répond au même ticker ;
   *   • dans le périmètre de chaînes déclaré par l'appelant ;
   *   • aucun concurrent plausible subsistant (règle d'or).
   *
   * Le plafond MODERATE n'est PAS un curseur : c'est un invariant. Sans donnée
   * de marché, on ne peut pas dire HIGH — l'absence de donnée n'est toujours pas
   * une donnée favorable. Ce que la V1 faisait de faux, ce n'était pas de
   * résoudre : c'était de fabriquer `matchType:'exact'` + `lowLiquidity:false`
   * en dur et d'annoncer une certitude.
   *
   * DexScreener ENRICHIT un tel candidat quand il le connaît ; il n'est pas
   * obligatoire pour l'identifier.
   *
   * À `false` : régime strict d'avant ratification — aucune résolution sans
   * marché. Conservé pour le backtest.
   */
  marketlessSourcesCanAutoResolve: boolean;

  /**
   * RATIFIÉ — J3, `true`. Un ticker de la liste noire (BTC, SOL, PEPE, AI…) peut-il
   * être auto-résolu ? Défaut : jamais, sur TOUS les chemins. En V2 le contrôle
   * n'était appliqué que sur une branche du décideur : dès qu'une adresse était
   * présente dans la requête sans pouvoir être localisée, la vérification était
   * sautée et un ticker générique pouvait se résoudre.
   */
  genericTickerNeverAutoResolves: boolean;

  /**
   * RATIFIÉ — `true`. Un lien curé (revue humaine) tranche sur une
   * correspondance de PRÉFIXE. Conservé de la V1, mais désormais soumis aux
   * deux conditions ci-dessous, et plafonné à MODERATE.
   */
  internalResolvesOnPrefix: boolean;

  /**
   * RATIFIÉ — S04, option D, `true`. La curation fait autorité DANS SON
   * PÉRIMÈTRE DE CHAÎNE, et seulement là.
   *
   * Deux conséquences, tenues à deux endroits différents :
   *   1. un lien curé hors du périmètre déclaré est écarté (ici) ;
   *   2. quand le périmètre de l'appelant couvre PLUSIEURS chaînes, un lien curé
   *      ne suffit plus à court-circuiter le marché : il faut regarder si un
   *      contrat rival vit sur une autre chaîne avant de trancher l'identité
   *      (resolve.ts, déclencheur du tier marché).
   *
   * Sans (2), la curation décidait l'identité sur des chaînes qu'elle n'avait
   * jamais regardées — c'est le défaut mesuré par S04.
   */
  curatedRequiresChainBinding: boolean;

  /**
   * RATIFIÉ — `true`. Un lien curé temporellement impossible est écarté comme
   * les autres. Une curation humaine peut être
   * postérieure à l'observation ; elle n'annule pas la flèche du temps.
   */
  curatedRequiresTemporalCompatibility: boolean;

  /**
   * RATIFIÉ — `true`, plafonné MODERATE. Un mint confirmé on-chain mais absent
   * de tout marché (pump.fun de quelques minutes) est servi comme RESOLVED, à
   * MODERATE faute de symbole vérifiable. C'est la population que l'anti-arnaque
   * doit attraper le plus tôt ; l'éteindre pour gagner en prudence serait
   * renoncer au cas nominal du guichet pre-buy.
   */
  resolveOnChainOnlyMint: boolean;

  /**
   * RATIFIÉ — 24 h. D2, régime STRICT. Tolérance appliquée aux preuves qui
   * bornent réellement la naissance du contrat (launch metric, dossier).
   * Défaut 24 h : couvre les décalages d'horloge et les dates déclarées à la
   * journée, sans laisser passer un écart réel.
   */
  temporalToleranceMs: number;

  /**
   * RATIFIÉ — 30 jours. D2, régime ACTIVITÉ.
   * Le plus prudent d'une bande [30 j, 90 j] mesurée sûre : zéro fausse
   * résolution et zéro faux rejet sur tout [0 j, 365 j], premier danger réel à
   * 730 j — un facteur 24. À ne rebouger que sur mesure du décalage
   * mint→paire réel en production, donnée qui n'existe pas encore. Tolérance appliquée aux preuves qui ne
   * bornent PAS la naissance du contrat : pairCreatedAt borne la PAIRE, pas le
   * mint ; createdAt borne la LIGNE en base. Un token peut exister et être
   * poussé longtemps avant d'obtenir sa paire. Défaut 30 jours : au-delà,
   * l'écart cesse d'être explicable par ce décalage.
   */
  temporalWeakToleranceMs: number;

  /**
   * RATIFIÉ — B3 / C5 : NEUTRALISÉ pour l'identité.
   * La liquidité ne décide JAMAIS une question d'identité. Deux contrats au même
   * symbole sur deux chaînes restent deux tokens, quel que soit l'écart de
   * liquidité — et le backtest le confirme : 0 bascule à 2→1 comme à 2→1000.
   * Ce champ ne sert plus qu'à formuler le conflit inter-chaînes.
   */
  crossChainDominanceRatio: number;

  /** RATIFIÉ — 8. Nombre de candidats renvoyés. Origine : /api/scan/resolve. */
  maxCandidatesReturned: number;

  /**
   * RATIFIÉ — 40 appels sortants par exécution et par provider.
   * Devenu un INDICATEUR DE SÉCURITÉ autant qu'un plafond de coût : le baisser
   * rouvre précisément les cas sans source interne (frontière A). Le laisser à
   * 40 garde le fournisseur de rivaux disponible, donc la contradiction visible.
   * Borne dure : au-delà, l'appel est REFUSÉ et compté (budgetRefusals), jamais
   * silencieusement omis. Protège contre une requête pathologique qui sonderait
   * des dizaines d'adresses.
   */
  maxProviderCallsPerRun: number;
}

export const DEFAULT_POLICY: ResolutionPolicy = {
  minLiquidityUsdForAutoResolve: 1000,
  marketlessSourcesCanAutoResolve: true,
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
