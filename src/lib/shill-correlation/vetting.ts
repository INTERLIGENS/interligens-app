// --- PHASE 4.6bis - vetting comportemental --------------------------------
//
// CE QUI A CHANGE, ET POURQUOI (doctrine ratifiee le 2026-08-28)
//
// L'ancienne regle `high_frequency` (txCount30d >= 750) est INVALIDE et retiree.
// Elle comparait un seuil a une valeur plafonnee par le sampler : les 20 wallets
// qu'elle excluait portaient TOUS exactement 1000, le plafond. Elle ne mesurait
// pas une frequence, elle detectait une saturation de collecte.
//
// INVARIANT SHILL-C1 - une valeur censuree ne franchit jamais seule un seuil.
//   Impose par le type `Measurement` (measurement.ts) : la comparaison rend
//   `indeterminate`, pas un booleen.
//
// INVARIANT SHILL-C2 - l'etat de la COLLECTE n'est jamais une affirmation sur le
//   COMPORTEMENT. `sampleSaturated` ne signifie ni high_frequency, ni bot, ni
//   indiscrimine. Il signifie : « on a arrete de regarder ». Rien d'autre.
//
// LA NOUVELLE REGLE - `indiscriminate_activity`
// Une exclusion comportementale doit etre demontree par PLUSIEURS DIMENSIONS
// INDEPENDANTES. Une seule ne suffit jamais : c'est ce qui a produit
// l'accident precedent.
//
//   D1 dispersion des AVOIRS   distinctTokenAccounts    - separateur primaire
//   D2 densite d'ACTIVITE      sampleSize / sampleSpanDays - signal secondaire
//   D3 dispersion inter-KOL    distinctKolCount         - contexte de correlation
//
// zone_a (achats avant publication) est EXCLU de cette regle a dessein : c'est
// le signal que le moteur cherche. S'en servir pour exclure fermerait la boucle
// sur elle-meme - on ecarterait les wallets precisement parce qu'ils presentent
// le phenomene etudie. zone_a sert a l'ANALYSE, jamais a l'exclusion.
//
// AUCUN SEUIL N'EST RATIFIE ICI. Les valeurs par defaut sont un point de depart
// de backtest, pas une decision produit.

import type { WalletProfile } from "./wallet-profile";
import {
  activityDensityPerDay, compareToThreshold, exactMeasurement,
  UNMEASURED, type Measurement,
} from "./measurement";

export type ExclusionReason =
  /** Comportement indiscrimine demontre sur >= 2 dimensions independantes. */
  | "indiscriminate_activity"
  /** Adresse d'infrastructure connue, touchee recemment. Preuve directe. */
  | "bot_infra";

/** Dimensions independantes. Aucune ne peut exclure seule. */
export type Dimension = "holdings" | "density" | "cross_kol";

export interface VettingRule {
  name: string;
  /** D1 - au-dela de ce nombre de comptes de tokens detenus. */
  holdingsThreshold: number;
  /** D2 - au-dela de cette densite (tx/jour) sur la fenetre echantillonnee. */
  densityPerDayThreshold: number;
  /** D3 - a partir de ce nombre de KOL distincts touches. */
  crossKolThreshold: number;
  /** Nombre de dimensions devant etre satisfaites. JAMAIS 1. */
  requiredDimensions: number;
}

/**
 * Regle par defaut - NON RATIFIEE, point de depart de backtest.
 * Le trou observe sur la population reelle (0-24 vs 193-567 495 comptes de
 * tokens) est net, mais un trou observe sur 20 wallets n'est pas un seuil :
 * il est mesure sur la population meme qu'il doit trancher.
 */
export const DEFAULT_RULE: VettingRule = {
  name: "two-of-three-conservative",
  holdingsThreshold: 100,
  densityPerDayThreshold: 200,
  crossKolThreshold: 3,
  requiredDimensions: 2,
};

export interface DimensionEvidence {
  dimension: Dimension;
  verdict: "above" | "below" | "indeterminate";
  measurement: Measurement;
  threshold: number;
}

export interface VetVerdict {
  excludedReason: ExclusionReason | null;
  flags: ExclusionReason[];
  /** Dimensions satisfaites - la preuve, pas le verdict. */
  dimensionsMet: Dimension[];
  evidence: DimensionEvidence[];
  txCount30d: number;
  distinctTokenAccounts: number;
  infraHits: string[];
  /**
   * SHILL-C2 - etat de collecte, jamais une affirmation comportementale.
   * Rapporte pour l'audit ; ne participe a AUCUNE decision d'exclusion.
   */
  collectionSaturated: boolean;
  ruleName: string;
}

export interface VettingContext {
  /** Nombre de KOL distincts que ce wallet touche dans le corpus. */
  distinctKolCount?: number;
}

export function classifyWalletProfile(
  profile: WalletProfile,
  context: VettingContext = {},
  rule: VettingRule = DEFAULT_RULE,
): VetVerdict {
  if (rule.requiredDimensions < 2) {
    throw new Error(
      "[shill] SHILL-C1/C2 : une exclusion comportementale exige au moins deux " +
        "dimensions independantes. requiredDimensions < 2 est interdit.",
    );
  }

  const evidence: DimensionEvidence[] = [];

  // D1 - avoirs. Mesure exacte : un comptage de comptes detenus n'est pas
  // plafonne par le sampler de signatures.
  const holdings =
    profile.distinctTokenAccounts >= 0 ? exactMeasurement(profile.distinctTokenAccounts) : UNMEASURED;
  evidence.push({
    dimension: "holdings",
    verdict: compareToThreshold(holdings, rule.holdingsThreshold),
    measurement: holdings,
    threshold: rule.holdingsThreshold,
  });

  // D2 - densite. Survit a la saturation : la fenetre echantillonnee est connue.
  const density = activityDensityPerDay(profile.sampleSize, profile.sampleSpanDays);
  evidence.push({
    dimension: "density",
    verdict: compareToThreshold(density, rule.densityPerDayThreshold),
    measurement: density,
    threshold: rule.densityPerDayThreshold,
  });

  // D3 - dispersion inter-KOL. Absente du contexte => indeterminee, jamais zero.
  const crossKol =
    context.distinctKolCount != null ? exactMeasurement(context.distinctKolCount) : UNMEASURED;
  evidence.push({
    dimension: "cross_kol",
    verdict: compareToThreshold(crossKol, rule.crossKolThreshold),
    measurement: crossKol,
    threshold: rule.crossKolThreshold,
  });

  // Une dimension indeterminee ne contribue PAS a l'exclusion. On n'exclut
  // jamais sur une donnee qu'on n'a pas - c'est la lecon de SHILL-C1.
  const dimensionsMet = evidence.filter((e) => e.verdict === "above").map((e) => e.dimension);

  const flags: ExclusionReason[] = [];
  if (dimensionsMet.length >= rule.requiredDimensions) flags.push("indiscriminate_activity");
  // Preuve directe et independante : une interaction avec une infra connue se
  // suffit a elle-meme, elle n'est pas une inference de seuil.
  if (profile.infraHits.length > 0) flags.push("bot_infra");

  return {
    excludedReason: flags[0] ?? null,
    flags,
    dimensionsMet,
    evidence,
    txCount30d: profile.txCount30d,
    distinctTokenAccounts: profile.distinctTokenAccounts,
    infraHits: profile.infraHits,
    // SHILL-C2 : rapporte, jamais consulte ci-dessus.
    collectionSaturated: profile.sampleSaturated,
    ruleName: rule.name,
  };
}

/** Variantes soumises au backtest. Aucune n'est ratifiee. */
export const CANDIDATE_RULES: VettingRule[] = [
  { name: "R1-holdings-legacy", holdingsThreshold: 50, densityPerDayThreshold: Infinity, crossKolThreshold: Infinity, requiredDimensions: 2 },
  { name: "R2-two-of-three-conservative", holdingsThreshold: 100, densityPerDayThreshold: 200, crossKolThreshold: 3 , requiredDimensions: 2 },
  { name: "R3-two-of-three-permissive", holdingsThreshold: 50, densityPerDayThreshold: 100, crossKolThreshold: 2, requiredDimensions: 2 },
];
