// --- A - LA SEPARATION, TENUE PAR LES SIGNATURES --------------------------
//
// ██  LE DEFAUT QUE CE FICHIER REND IMPOSSIBLE  ██
//
// feat/cc-offline-42-shill-engine-v2, features.ts :
//
//     const liftMeasurable =
//       baselineRate != null && baselineTotal >= 1 &&
//       a.baselineCounted.size + a.counted.size >= policy.minBaselineBuys;
//                              ^^^^^^^^^^^^^^^^
//
// `minBaselineBuys` est le plancher du TEMOIN. Il etait compare a la somme des
// achats temoin ET des achats observes. Un wallet avec ZERO achat temoin et
// cinq achats observes franchissait donc le plancher du temoin - puis, le
// temoin etant vide, recevait le lift maximal du bareme par la porte
// `liftCapWhenBaselineZero`. Le dispositif de taux de base etait annule par sa
// propre garde, et le cas le PLUS depourvu de temoin ressortait le mieux note.
//
// LE CORRECTIF N'EST PAS UNE CORRECTION DE LIGNE. La ligne serait rearrivee.
// Les deux populations sont comptees par DEUX fonctions dont les signatures ne
// recoivent chacune QU'UN cote. `assessBaselineFloor` ne peut pas lire un
// compteur d'observation : il ne lui en est passe aucun. La faute exige de
// changer une signature - donc de la voir.
//
// SHILL-C1 traverse ce fichier de bout en bout : un comptage borne par un
// budget de collecte est un PLANCHER, pas une quantite. Il entre donc comme
// `censoredMeasurement`, et `compareToThreshold` rend `indeterminate` - jamais
// un booleen.

import {
  censoredMeasurement,
  compareToThreshold,
  exactMeasurement,
  type Measurement,
  type ThresholdVerdict,
} from "../measurement";
import { observationDedupKey } from "../occasions";
import {
  BASELINE_MEASURED_STATES,
  OBSERVED_ANALYZABLE_STATES,
  type BaselineBuy,
  type BuyerObservation,
  type OccasionRecord,
  type SideTally,
} from "./types";
import type { EnginePolicy } from "./policy";

// ─── Ce que chaque cote a le droit de voir ────────────────────────────────
//
// Deux types d'entree DISJOINTS. Aucun n'a de champ de l'autre : une fonction
// qui recoit `BaselineSide` n'a acces a aucun compteur d'observation, et
// reciproquement. C'est la separation, ecrite dans les types.

export interface ObservedSide {
  readonly kind: "observed";
  /** Occasions dont la fenetre d'observation est analysable. */
  readonly analyzableOccasionIds: ReadonlySet<string>;
  /** Cles de deduplication des achats observes (occasion|tx ou occasion|wallet). */
  readonly buyKeys: ReadonlySet<string>;
  readonly truncatedBy: readonly string[];
}

export interface BaselineSide {
  readonly kind: "baseline";
  /** Occasions dont le temoin est une MESURE (fut-elle nulle). */
  readonly measuredOccasionIds: ReadonlySet<string>;
  /** Cles de deduplication des achats temoin. */
  readonly buyKeys: ReadonlySet<string>;
  readonly truncatedBy: readonly string[];
}

const buyKey = (occasionId: string, o: { wallet: string; chain: string; firstBuyTxSignature: string | null }) =>
  `${occasionId}|${observationDedupKey(o)}`;

// ─── Construction, un cote a la fois ──────────────────────────────────────

/** Cote OBSERVATION d'un KOL. Ne lit AUCUN champ temoin de l'enregistrement. */
export function buildObservedSide(records: readonly OccasionRecord[]): ObservedSide {
  const analyzableOccasionIds = new Set<string>();
  const buyKeys = new Set<string>();
  const truncatedBy = new Set<string>();

  for (const r of records) {
    if (!OBSERVED_ANALYZABLE_STATES.includes(r.observedState)) continue;
    analyzableOccasionIds.add(r.occasion.occasionId);
    if (r.observedTruncatedBy) truncatedBy.add(r.observedTruncatedBy);
    for (const o of r.observations) buyKeys.add(buyKey(r.occasion.occasionId, o));
  }

  return { kind: "observed", analyzableOccasionIds, buyKeys, truncatedBy: [...truncatedBy] };
}

/**
 * Cote TEMOIN d'un KOL. Ne lit AUCUN champ d'observation.
 *
 * L'appartenance au temoin est DECLAREE par `baselineState`, jamais deduite de
 * `baselineBuys.length > 0` : un temoin collecte et vide (`collected_empty`)
 * est une MESURE - la plus informative qui soit - et le confondre avec un
 * temoin jamais collecte serait le trou T1 reintroduit.
 */
export function buildBaselineSide(records: readonly OccasionRecord[]): BaselineSide {
  const measuredOccasionIds = new Set<string>();
  const buyKeys = new Set<string>();
  const truncatedBy = new Set<string>();

  for (const r of records) {
    if (!BASELINE_MEASURED_STATES.includes(r.baselineState)) continue;
    measuredOccasionIds.add(r.occasion.occasionId);
    if (r.baselineTruncatedBy) truncatedBy.add(r.baselineTruncatedBy);
    for (const b of r.baselineBuys) buyKeys.add(buyKey(r.occasion.occasionId, b));
  }

  return { kind: "baseline", measuredOccasionIds, buyKeys, truncatedBy: [...truncatedBy] };
}

// ─── Mesure du volume de chaque cote ──────────────────────────────────────

function tallyOf(
  occasions: number,
  buyKeys: ReadonlySet<string>,
  truncatedBy: readonly string[],
): SideTally {
  const buys: Measurement =
    truncatedBy.length > 0
      ? // SHILL-C1 : la collecte s'est arretee. Le comptage est un plancher.
        censoredMeasurement(buyKeys.size, truncatedBy.join(", "))
      : exactMeasurement(buyKeys.size);
  return { occasions, buys, truncatedBy: [...truncatedBy] };
}

export function observedTally(side: ObservedSide): SideTally {
  return tallyOf(side.analyzableOccasionIds.size, side.buyKeys, side.truncatedBy);
}

export function baselineTally(side: BaselineSide): SideTally {
  return tallyOf(side.measuredOccasionIds.size, side.buyKeys, side.truncatedBy);
}

// ─── Les deux planchers : deux fonctions, deux entrees, deux noms ─────────

/**
 * Plancher du TEMOIN SEUL (`minBaselineBuys`).
 *
 * Signature volontairement etroite : `BaselineSide` n'expose aucun compteur
 * d'observation. Aucune addition inter-cotes n'est ecrivable ici sans elargir
 * la signature - et l'elargir est un acte visible en revue.
 */
export function assessBaselineFloor(
  side: BaselineSide,
  policy: EnginePolicy,
): { tally: SideTally; verdict: ThresholdVerdict } {
  const tally = baselineTally(side);
  return { tally, verdict: compareToThreshold(tally.buys, policy.minBaselineBuys) };
}

/**
 * Plancher de l'OBSERVATION (`minObservedBuys`) - AUTRE variable, AUTRE nom,
 * AUTRE fonction. Il ne qualifie pas le temoin et n'entre jamais dans son
 * verdict : il dit seulement qu'un numerateur trop maigre ne merite pas d'etre
 * rapporte a un taux de base.
 */
export function assessObservedFloor(
  side: ObservedSide,
  policy: EnginePolicy,
): { tally: SideTally; verdict: ThresholdVerdict } {
  const tally = observedTally(side);
  return { tally, verdict: compareToThreshold(tally.buys, policy.minObservedBuys) };
}

// ─── Comptages par wallet, toujours d'un seul cote ────────────────────────

/** Occasions ou CE wallet apparait dans la fenetre d'OBSERVATION. */
export function observedOccasionsForWallet(
  records: readonly OccasionRecord[],
  wallet: string,
  chain: string,
): Set<string> {
  const out = new Set<string>();
  for (const r of records) {
    if (!OBSERVED_ANALYZABLE_STATES.includes(r.observedState)) continue;
    if (r.observations.some((o: BuyerObservation) => o.wallet === wallet && o.chain === chain)) {
      out.add(r.occasion.occasionId);
    }
  }
  return out;
}

/** Occasions ou CE wallet apparait dans la fenetre TEMOIN. */
export function baselineOccasionsForWallet(
  records: readonly OccasionRecord[],
  wallet: string,
  chain: string,
): Set<string> {
  const out = new Set<string>();
  for (const r of records) {
    if (!BASELINE_MEASURED_STATES.includes(r.baselineState)) continue;
    if (r.baselineBuys.some((b: BaselineBuy) => b.wallet === wallet && b.chain === chain)) {
      out.add(r.occasion.occasionId);
    }
  }
  return out;
}
