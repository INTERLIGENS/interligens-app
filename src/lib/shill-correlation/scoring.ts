// src/lib/shill-correlation/scoring.ts
// PHASE 4 — Candidate Scoring Engine (pure, unit-tested, no I/O).
//
// Turns per-(kolHandle, wallet, chain) aggregates into the 5 component scores,
// a composite correlationScore, threshold flags, confidence and classification.
// All scores are 0..100 (NUMERIC(6,2) in the DB); ratioObserved is 0..1.
//
// Design notes:
//  - genericSniperPenalty is DESTRUCTIVE (per brief): it is subtracted from the
//    positive base, so a wallet that snipes many unrelated KOLs collapses to ~0
//    regardless of how strong its per-KOL recurrence looks.
//  - timingScore weights pre_tweet > near_tweet > post_tweet — front-running a
//    tweet is the strongest correlation signal.

export interface CandidateScoringInput {
  observedShillCount: number; // distinct analyzable events this wallet appears in, for THIS kol
  analyzableShillCount: number; // distinct analyzable events for THIS kol (denominator)
  preTweetCount: number; // this wallet x this kol
  nearTweetCount: number;
  postTweetCount: number;
  exitCount: number; // observations with a recorded post-tweet exit
  distinctKolCount: number; // distinct KOLs this wallet appears across (global)
}

export type Confidence = "low" | "medium" | "high";
export type Classification = "watch" | "candidate" | "high_interest";

export interface CandidateScores {
  ratioObserved: number; // 0..1
  recurrenceScore: number;
  specificityScore: number;
  timingScore: number;
  exitScore: number;
  genericSniperPenalty: number;
  correlationScore: number;
  shortlistEligible: boolean;
  seriousCandidate: boolean;
  confidence: Confidence;
  classification: Classification;
}

export const SCORING = {
  recurrenceCountCap: 5, // observedShillCount saturates the count component here
  timingWeights: { pre: 1.0, near: 0.5, post: 0.15 },
  composite: { recurrence: 0.45, timing: 0.35, specificity: 0.15, exit: 0.05 },
  sniperPerExtraKol: 8, // penalty = min(100, (distinctKols-1)^2 * this)
  shortlist: { minShills: 3, minPreTweet: 2, minRatio: 0.25 },
  serious: { minShills: 5, minSpecificity: 50 }, // specificity>=50 => <=2 distinct KOLs
  confidence: { highScore: 70, mediumScore: 45 },
} as const;

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
const round2 = (n: number) => Math.round(n * 100) / 100; // NUMERIC(6,2)
const round4 = (n: number) => Math.round(n * 10000) / 10000; // NUMERIC(5,4)

export function computeCandidateScores(
  input: CandidateScoringInput,
): CandidateScores {
  const {
    observedShillCount: observed,
    analyzableShillCount: analyzable,
    preTweetCount: pre,
    nearTweetCount: near,
    postTweetCount: post,
    exitCount,
    distinctKolCount,
  } = input;

  const ratioObserved = analyzable > 0 ? observed / analyzable : 0;

  // recurrence: half ratio-driven, half count-driven (saturating at the cap).
  const countComponent = Math.min(1, observed / SCORING.recurrenceCountCap);
  const recurrenceScore = clamp100(
    100 * (0.5 * ratioObserved + 0.5 * countComponent),
  );

  // specificity: inverse of how many KOLs this wallet touches (1 KOL => 100).
  const specificityScore = clamp100(100 / Math.max(1, distinctKolCount));

  // timing: weighted by zone, normalized by the wallet's observation count.
  const zoned = pre + near + post;
  const w = SCORING.timingWeights;
  const timingScore =
    zoned > 0
      ? clamp100(
          (100 * (pre * w.pre + near * w.near + post * w.post)) / zoned,
        )
      : 0;

  // exit: fraction of this wallet's observations with a recorded post-tweet exit.
  const exitScore = zoned > 0 ? clamp100((100 * exitCount) / zoned) : 0;

  // generic-sniper penalty: convex in cross-KOL spread, destructive.
  const genericSniperPenalty = clamp100(
    (distinctKolCount - 1) ** 2 * SCORING.sniperPerExtraKol,
  );

  const c = SCORING.composite;
  const base =
    c.recurrence * recurrenceScore +
    c.timing * timingScore +
    c.specificity * specificityScore +
    c.exit * exitScore;
  const correlationScore = clamp100(base - genericSniperPenalty);

  const shortlistEligible =
    observed >= SCORING.shortlist.minShills &&
    pre >= SCORING.shortlist.minPreTweet &&
    ratioObserved >= SCORING.shortlist.minRatio;

  const seriousCandidate =
    observed >= SCORING.serious.minShills &&
    specificityScore >= SCORING.serious.minSpecificity;

  let confidence: Confidence = "low";
  let classification: Classification = "watch";
  if (seriousCandidate && correlationScore >= SCORING.confidence.highScore) {
    confidence = "high";
    classification = "high_interest";
  } else if (
    shortlistEligible &&
    correlationScore >= SCORING.confidence.mediumScore
  ) {
    confidence = "medium";
    classification = "candidate";
  }

  return {
    ratioObserved: round4(ratioObserved),
    recurrenceScore: round2(recurrenceScore),
    specificityScore: round2(specificityScore),
    timingScore: round2(timingScore),
    exitScore: round2(exitScore),
    genericSniperPenalty: round2(genericSniperPenalty),
    correlationScore: round2(correlationScore),
    shortlistEligible,
    seriousCandidate,
    confidence,
    classification,
  };
}
