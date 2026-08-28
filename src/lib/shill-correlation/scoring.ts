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

  /**
   * CORRECTNESS #2 - PLANCHER DE n. RATIFIE A 3 (2026-08-28).
   *
   * Le defaut mesure : sept candidats `deepnets_agent` obtiennent 77,00 avec
   * observed=1, analyzable=1, ratio=1,00. Un ratio de 1 sur UNE observation
   * n'est pas une recurrence - c'est un evenement isole dont le denominateur
   * vaut aussi 1. Le score le lisait comme une regularite parfaite.
   *
   * SEMANTIQUE RATIFIEE (2026-08-28) : le plancher compte 3 OCCASIONS
   * INDEPENDANTES, pas 3 evenements. Deux tweets du meme KOL sur le meme mint
   * a une minute d'intervalle forment UNE occasion (correctif #1, occasions.ts)
   * et ne valent donc qu'une unite ici. Sans cette regle, trois tweets d'un
   * meme episode auraient suffi a franchir le plancher - ce qui aurait rendu le
   * correctif #2 contournable par le defaut que le correctif #1 corrige.
   *
   * En dessous de ce plancher, le ratio ne compte PLUS comme recurrence : la
   * composante recurrence retombe sur son seul terme de comptage. Le candidat
   * n'est pas supprime ni exclu - il cesse simplement d'etre credite d'une
   * regularite qu'une seule observation ne peut pas etablir.
   *
   * RAISON DU 3 : `shortlist.minShills` vaut deja 3, donc 3 aligne
   * le plancher du ratio sur le seuil de mise en liste courte deja ratifie, et
   * n'introduit pas un second seuil concurrent. 2 serait defendable (deux
   * occasions font deja une repetition) ; 5 alignerait sur `serious.minShills`
   * mais viderait la classe `candidate` sur le corpus actuel.
   */
  minObservationsForRatio: 3,
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

  // CORRECTNESS #2 - sous le plancher, le ratio ne vaut pas recurrence.
  // `ratioObserved` reste renvoye tel quel (il decrit un fait : ce wallet a ete
  // vu sur n occasions sur m), mais il cesse d'alimenter le score.
  const ratioCounts = observed >= SCORING.minObservationsForRatio;

  // recurrence: half ratio-driven, half count-driven (saturating at the cap).
  const countComponent = Math.min(1, observed / SCORING.recurrenceCountCap);
  const recurrenceScore = clamp100(
    ratioCounts
      ? 100 * (0.5 * ratioObserved + 0.5 * countComponent)
      : 100 * (0.5 * countComponent),
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
    ratioCounts &&
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
