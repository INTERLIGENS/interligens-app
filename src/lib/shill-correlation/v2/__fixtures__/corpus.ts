// --- Corpus de fixtures - constructeurs explicites -------------------------
//
// Aucune fixture ne construit un OccasionRecord a la main : les deux axes de
// collecte (observation / temoin) ont chacun leur constructeur, et un test qui
// veut « un temoin vide » doit choisir entre `baselineCollectedEmpty()` et
// `baselineNotCollected()`. C'est cette obligation de choisir qui empeche de
// rejouer la confusion de -42.

import type {
  BaselineBuy,
  BuyerObservation,
  OccasionRecord,
  ShillOccasionInput,
} from "../types";

export const T0 = new Date("2026-08-01T12:00:00.000Z");

export function occasion(
  occasionId: string,
  kolHandle: string,
  offsetMinutes = 0,
  tokenMint: string | null = "MintAAA",
): ShillOccasionInput {
  return {
    occasionId,
    kolHandle,
    eventIds: [`${occasionId}-e1`],
    tokenMint,
    observedAt: new Date(T0.getTime() + offsetMinutes * 60_000),
  };
}

export function buy(
  wallet: string,
  behaviorType: BuyerObservation["behaviorType"] = "pre_tweet",
  deltaSecondsFromTweet = -120,
  sig: string | null = null,
): BuyerObservation {
  return {
    wallet,
    chain: "solana",
    behaviorType,
    deltaSecondsFromTweet,
    firstBuyTxSignature: sig,
    entryAmountUsd: 100,
    exitDeltaSeconds: null,
  };
}

export function baselineBuy(
  wallet: string,
  deltaSecondsFromBaselineAnchor = -120,
  sig: string | null = null,
): BaselineBuy {
  return {
    wallet,
    chain: "solana",
    deltaSecondsFromBaselineAnchor,
    firstBuyTxSignature: sig,
    entryAmountUsd: 100,
  };
}

interface RecordOptions {
  observations?: BuyerObservation[];
  observedTruncatedBy?: string | null;
  /** Achats temoin. Impose de declarer AUSSI l'etat du temoin. */
  baseline?:
    | { state: "not_collected" }
    | { state: "collect_error"; detail: string }
    | { state: "collected_empty" }
    | { state: "collected_with_buys"; buys: BaselineBuy[]; truncatedBy?: string | null };
}

/** Occasion dont l'observation a ete collectee. Le temoin est declare a part. */
export function record(o: ShillOccasionInput, opts: RecordOptions = {}): OccasionRecord {
  const observations = opts.observations ?? [];
  const b = opts.baseline ?? { state: "not_collected" as const };

  return {
    occasion: o,
    resolved: null,
    observedState: observations.length > 0 ? "fetched_with_buyers" : "fetched_empty",
    observations,
    observedStateDetail:
      observations.length > 0 ? null : "collecte effectuee, aucun acheteur dans la fenetre d'observation",
    observedTruncatedBy: opts.observedTruncatedBy ?? null,

    baselineState: b.state,
    baselineBuys: b.state === "collected_with_buys" ? b.buys : [],
    baselineStateDetail:
      b.state === "collect_error"
        ? b.detail
        : b.state === "collected_empty"
          ? "collecte temoin effectuee, aucun achat dans la fenetre decalee"
          : null,
    baselineTruncatedBy: b.state === "collected_with_buys" ? (b.truncatedBy ?? null) : null,
  };
}

/** Temoin jamais tente. N'est PAS une mesure. */
export const baselineNotCollected = () => ({ state: "not_collected" as const });
/** Temoin tente, ZERO achat trouve. EST une mesure. */
export const baselineCollectedEmpty = () => ({ state: "collected_empty" as const });
/** Temoin tente, achats trouves. */
export const baselineCollected = (buys: BaselineBuy[], truncatedBy: string | null = null) => ({
  state: "collected_with_buys" as const,
  buys,
  truncatedBy,
});
