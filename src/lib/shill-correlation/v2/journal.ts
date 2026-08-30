// --- Observabilite : journal d'etat HONNETE ------------------------------
//
// LE DEFAUT MESURE (prep 2026-08-28)
// En v1, 88 evenements portaient processingStatus='buyers_fetched' mais 11
// seulement avaient des observations : 77 collectes avaient rendu ZERO
// acheteur, sans que le statut ne les distingue d'un evenement non traite. Et
// AUCUN evenement n'etait 'scored' alors que 1 532 candidats existaient - le
// scoreur ecrivait ses sorties sans jamais faire avancer l'etat de la source.
//
// B - CE QUE CE MODULE AJOUTE : la non-mesurabilite est COMPTEE. Un lift
// absent n'est pas seulement signale au candidat qui le subit ; il est agrege
// par motif, de sorte qu'« aucun temoin nulle part » se lise d'un coup d'oeil
// au lieu de se deviner candidat par candidat.

import { isMeasured } from "../measurement";
import {
  BASELINE_MEASURED_STATES,
  LIFT_UNMEASURABLE_REASONS,
  OBSERVED_ANALYZABLE_STATES,
  type BaselineState,
  type CandidateInference,
  type EngineTelemetry,
  type LiftUnmeasurableReason,
  type ObservedState,
  type OccasionRecord,
} from "./types";

const ALL_OBSERVED_STATES: ObservedState[] = [
  "not_fetched", "fetched_empty", "fetched_with_buyers", "scored", "fetch_error",
];
const ALL_BASELINE_STATES: BaselineState[] = [
  "not_collected", "collected_empty", "collected_with_buys", "collect_error",
];

export function buildTelemetry(
  records: readonly OccasionRecord[],
  candidates: readonly CandidateInference[],
): EngineTelemetry {
  const byObservedState = Object.fromEntries(
    ALL_OBSERVED_STATES.map((s) => [s, 0]),
  ) as Record<ObservedState, number>;
  const byBaselineState = Object.fromEntries(
    ALL_BASELINE_STATES.map((s) => [s, 0]),
  ) as Record<BaselineState, number>;
  for (const r of records) {
    byObservedState[r.observedState]++;
    byBaselineState[r.baselineState]++;
  }

  const liftUnmeasurable = Object.fromEntries(
    LIFT_UNMEASURABLE_REASONS.map((r) => [r, 0]),
  ) as Record<LiftUnmeasurableReason, number>;
  let liftMeasured = 0;
  let absentFromMeasuredBaseline = 0;
  for (const c of candidates) {
    if (isMeasured(c.features.lift) && !c.features.lift.censored) liftMeasured++;
    else if (c.features.liftUnmeasurableReason) liftUnmeasurable[c.features.liftUnmeasurableReason]++;
    if (c.features.absentFromMeasuredBaseline) absentFromMeasuredBaseline++;
  }

  return {
    occasionsTotal: records.length,
    byObservedState,
    byBaselineState,
    observationsScanned: records.reduce((s, r) => s + r.observations.length, 0),
    baselineBuysScanned: records.reduce((s, r) => s + r.baselineBuys.length, 0),
    candidatesEmitted: candidates.length,
    liftUnmeasurable,
    liftMeasured,
    absentFromMeasuredBaseline,
    inconsistencies: findInconsistencies(records, candidates),
  };
}

/**
 * Les incoherences que v1 laissait passer. Elles sont RAPPORTEES, pas levees :
 * un moteur qui s'arrete sur une incoherence de journal ne produit plus rien,
 * alors qu'un moteur qui la nomme reste utilisable et devient auditable.
 */
export function findInconsistencies(
  records: readonly OccasionRecord[],
  candidates: readonly CandidateInference[],
): string[] {
  const out: string[] = [];

  // T1-a : une collecte vide DOIT etre marquee comme telle.
  const emptyButFetched = records.filter(
    (r) => r.observedState === "fetched_with_buyers" && r.observations.length === 0,
  );
  if (emptyButFetched.length > 0) {
    out.push(
      `${emptyButFetched.length} occasion(s) marquees 'fetched_with_buyers' sans aucune ` +
        "observation - elles doivent porter 'fetched_empty' : une collecte vide n'est pas " +
        "une collecte reussie",
    );
  }

  const fetchedEmptyWithBuyers = records.filter(
    (r) => r.observedState === "fetched_empty" && r.observations.length > 0,
  );
  if (fetchedEmptyWithBuyers.length > 0) {
    out.push(
      `${fetchedEmptyWithBuyers.length} occasion(s) 'fetched_empty' portent pourtant des observations`,
    );
  }

  // T1-a bis : un etat d'erreur sans motif est un silence deguise.
  const errorNoDetail = records.filter((r) => r.observedState === "fetch_error" && !r.observedStateDetail);
  if (errorNoDetail.length > 0) {
    out.push(
      `${errorNoDetail.length} occasion(s) en 'fetch_error' sans motif - une erreur sans motif est un silence`,
    );
  }

  // A - le meme controle, cote TEMOIN. L'axe est separe, donc son honnetete
  // doit etre verifiee separement : un temoin declare collecte mais porteur
  // d'achats sous 'collected_empty' fausserait le denominateur du lift.
  const baselineEmptyWithBuys = records.filter(
    (r) => r.baselineState === "collected_empty" && r.baselineBuys.length > 0,
  );
  if (baselineEmptyWithBuys.length > 0) {
    out.push(
      `${baselineEmptyWithBuys.length} occasion(s) temoin 'collected_empty' portent pourtant des achats`,
    );
  }

  const baselineWithBuysButEmpty = records.filter(
    (r) => r.baselineState === "collected_with_buys" && r.baselineBuys.length === 0,
  );
  if (baselineWithBuysButEmpty.length > 0) {
    out.push(
      `${baselineWithBuysButEmpty.length} occasion(s) temoin 'collected_with_buys' sans aucun achat ` +
        "- un temoin vide se declare 'collected_empty', ce qui reste une MESURE",
    );
  }

  const baselineBuysWithoutState = records.filter(
    (r) => !BASELINE_MEASURED_STATES.includes(r.baselineState) && r.baselineBuys.length > 0,
  );
  if (baselineBuysWithoutState.length > 0) {
    out.push(
      `${baselineBuysWithoutState.length} occasion(s) portent des achats temoin alors que le temoin ` +
        "n'est pas declare collecte - ces achats ne comptent nulle part",
    );
  }

  const baselineErrorNoDetail = records.filter(
    (r) => r.baselineState === "collect_error" && !r.baselineStateDetail,
  );
  if (baselineErrorNoDetail.length > 0) {
    out.push(
      `${baselineErrorNoDetail.length} occasion(s) en 'collect_error' temoin sans motif`,
    );
  }

  // SHILL-C1 : une troncature declaree sans etat de collecte coherent.
  const truncatedNotCollected = records.filter(
    (r) => r.baselineTruncatedBy && !BASELINE_MEASURED_STATES.includes(r.baselineState),
  );
  if (truncatedNotCollected.length > 0) {
    out.push(
      `${truncatedNotCollected.length} occasion(s) declarent une troncature temoin sans temoin collecte`,
    );
  }

  // T1-b : des candidats emis imposent des occasions 'scored'.
  if (candidates.length > 0) {
    const scored = records.filter((r) => r.observedState === "scored").length;
    if (scored === 0) {
      out.push(
        `${candidates.length} candidat(s) emis alors qu'AUCUNE occasion n'est marquee 'scored' ` +
          "- c'est exactement le trou T1 de la v1 : des sorties sans trace de traitement",
      );
    }
    const contributing = new Set<string>();
    for (const c of candidates) for (const id of c._nature.basisRefs.occasionIds) contributing.add(id);
    const notScored = records.filter(
      (r) => contributing.has(r.occasion.occasionId) && r.observedState !== "scored",
    );
    if (notScored.length > 0) {
      out.push(`${notScored.length} occasion(s) ont contribue a un candidat sans etre marquees 'scored'`);
    }
  }

  return out;
}

/** Marque une occasion comme scoree, en preservant l'information de collecte. */
export function markScored(r: OccasionRecord): OccasionRecord {
  return { ...r, observedState: "scored" };
}

/** Derive l'etat d'une collecte d'OBSERVATION - jamais a la main. */
export function observedStateAfterFetch(
  observations: readonly unknown[],
  error?: string | null,
): { observedState: ObservedState; observedStateDetail: string | null } {
  if (error) return { observedState: "fetch_error", observedStateDetail: error };
  if (observations.length === 0) {
    return {
      observedState: "fetched_empty",
      observedStateDetail: "collecte effectuee, aucun acheteur dans la fenetre d'observation",
    };
  }
  return { observedState: "fetched_with_buyers", observedStateDetail: null };
}

/**
 * Derive l'etat d'une collecte TEMOIN - jamais a la main, et jamais deduit de
 * la longueur du tableau seule : un temoin vide COLLECTE est une mesure, un
 * temoin vide NON COLLECTE n'en est pas une, et les deux ont zero achat.
 */
export function baselineStateAfterFetch(
  buys: readonly unknown[],
  error?: string | null,
): { baselineState: BaselineState; baselineStateDetail: string | null } {
  if (error) return { baselineState: "collect_error", baselineStateDetail: error };
  if (buys.length === 0) {
    return {
      baselineState: "collected_empty",
      baselineStateDetail: "collecte temoin effectuee, aucun achat dans la fenetre decalee",
    };
  }
  return { baselineState: "collected_with_buys", baselineStateDetail: null };
}

/** Une occasion vierge de toute collecte. Les deux axes partent a zero. */
export function notCollected(): Pick<
  OccasionRecord,
  "observedState" | "observedStateDetail" | "observedTruncatedBy" |
  "baselineState" | "baselineStateDetail" | "baselineTruncatedBy" |
  "observations" | "baselineBuys"
> {
  return {
    observedState: "not_fetched",
    observedStateDetail: null,
    observedTruncatedBy: null,
    observations: [],
    baselineState: "not_collected",
    baselineStateDetail: null,
    baselineTruncatedBy: null,
    baselineBuys: [],
  };
}

/** Utilitaire de lecture partage - un seul endroit connait la regle. */
export function isObservedAnalyzable(r: OccasionRecord): boolean {
  return OBSERVED_ANALYZABLE_STATES.includes(r.observedState);
}
