// --- Shill Correlation Engine v2 - contrats -------------------------------
//
// Invariant de vocabulaire, herite de v1 et non negociable : on parle de
// CANDIDATS, jamais du « wallet du KOL ». Le moteur observe une co-occurrence
// temporelle ; il n'atteste aucune propriete.
//
// ═══ A - LES DEUX FENETRES SONT DEUX OBJETS, PAS DEUX CHAMPS D'UN MEME ═════
//
// Le moteur manipule DEUX populations d'achats qui ne se melangent jamais :
//
//   OBSERVATION  fenetre autour de la publication      -> numerateur
//   TEMOIN       fenetre de meme largeur, decalee,     -> denominateur
//                la ou AUCUNE publication n'a eu lieu
//   (« temoin » = baseline = groupe de controle : un seul mot dans le code,
//    `baseline`, pour qu'il n'existe pas deux vocabulaires.)
//
// Elles portent chacune leur propre etat de collecte, leur propre compteur,
// leur propre plancher, et leur propre cause de troncature. Aucune structure
// de ce fichier n'offre de champ ou les deux pourraient etre additionnees.
// C'est le point : le defaut que ce build corrige etait une ADDITION.

import type { Measurement } from "../measurement";
import type { DataNature } from "@/lib/data-nature/nature";

/** Zone temporelle relative a l'observation. */
export type BehaviorZone = "zone_a" | "zone_b" | "zone_c";
export type BehaviorType = "pre_tweet" | "near_tweet" | "post_tweet";

/**
 * Etat de collecte de la FENETRE D'OBSERVATION. Corrige le trou T1 de v1 :
 * 88 evenements 'buyers_fetched' dont 77 sans aucune observation.
 */
export type ObservedState =
  /** jamais soumise a la collecte d'acheteurs */
  | "not_fetched"
  /** collecte faite, ZERO acheteur trouve - distinct d'un non-traite */
  | "fetched_empty"
  /** collecte faite, acheteurs trouves */
  | "fetched_with_buyers"
  /** features calculees et candidats emis */
  | "scored"
  /** collecte tentee, echouee - jamais confondue avec un vide */
  | "fetch_error";

/**
 * Etat de collecte de la FENETRE TEMOIN. AXE SEPARE de `ObservedState`.
 *
 * En -42, l'existence d'un temoin etait DEDUITE (`baselineObservations.length
 * > 0 || state === 'baseline_fetched'`). Cette deduction confond « temoin
 * collecte et vide » avec « temoin jamais collecte » - exactement le defaut T1
 * que le meme build pretendait corriger, reintroduit d'un cran plus bas.
 * L'etat du temoin est donc DECLARE, jamais infere.
 */
export type BaselineState =
  /** aucune fenetre temoin n'a ete demandee pour cette occasion */
  | "not_collected"
  /** temoin collecte, ZERO achat dans la fenetre - c'est une MESURE */
  | "collected_empty"
  /** temoin collecte, achats trouves */
  | "collected_with_buys"
  /** collecte temoin tentee, echouee - jamais lue comme un vide */
  | "collect_error";

/** Etats sous lesquels la fenetre d'observation compte au denominateur. */
export const OBSERVED_ANALYZABLE_STATES: readonly ObservedState[] = [
  "fetched_empty",
  "fetched_with_buyers",
  "scored",
];

/** Etats sous lesquels le temoin est une MESURE (fut-elle nulle). */
export const BASELINE_MEASURED_STATES: readonly BaselineState[] = [
  "collected_empty",
  "collected_with_buys",
];

export interface ResolvedToken {
  /** Identite (chain, contract) - jamais le symbole seul. */
  chain: string;
  address: string;
  resolutionStatus: string;
  resolutionConfidence: string;
  resolutionMethod: string;
}

export interface ShillOccasionInput {
  occasionId: string;
  kolHandle: string;
  /** Evenements replies dans cette occasion (correctif #1, occasions.ts). */
  eventIds: string[];
  tokenMint: string | null;
  /** Instant de reference : le PREMIER tweet de l'occasion. */
  observedAt: Date;
}

export interface BuyerObservation {
  wallet: string;
  chain: string;
  behaviorType: BehaviorType;
  deltaSecondsFromTweet: number;
  firstBuyTxSignature: string | null;
  entryAmountUsd: number | null;
  exitDeltaSeconds: number | null;
}

/**
 * Achat lu dans la fenetre TEMOIN. Type DISTINCT de `BuyerObservation`, et
 * non un `BuyerObservation` porteur d'un drapeau `isBaseline`.
 *
 * Un drapeau se perd dans un `.filter()` oublie ; un type ne se perd pas. Les
 * deux populations ne peuvent pas se retrouver dans le meme tableau sans que
 * TypeScript le refuse, donc elles ne peuvent pas etre comptees ensemble.
 */
export interface BaselineBuy {
  wallet: string;
  chain: string;
  /** Ecart signe a l'ANCRE DECALEE du temoin, pas au tweet reel. */
  deltaSecondsFromBaselineAnchor: number;
  firstBuyTxSignature: string | null;
  entryAmountUsd: number | null;
}

export interface OccasionRecord {
  occasion: ShillOccasionInput;
  resolved: ResolvedToken | null;

  // ── Cote OBSERVATION ───────────────────────────────────────────────────
  observedState: ObservedState;
  observations: BuyerObservation[];
  /** Motif, quand observedState vaut fetch_error ou fetched_empty. */
  observedStateDetail: string | null;
  /**
   * SHILL-C1. Renseigne ssi la collecte d'observation a ete BORNEE (budget de
   * pages, plafond de signatures, quota de fournisseur). Le comptage devient
   * alors un PLANCHER, jamais une quantite.
   */
  observedTruncatedBy: string | null;

  // ── Cote TEMOIN ────────────────────────────────────────────────────────
  baselineState: BaselineState;
  baselineBuys: BaselineBuy[];
  baselineStateDetail: string | null;
  /** SHILL-C1, cote temoin. Voir `observedTruncatedBy`. */
  baselineTruncatedBy: string | null;
}

// ─── Motifs de non-mesurabilite du lift ────────────────────────────────────
//
// B - un lift non calculable n'est pas « zero », n'est pas « null », et n'est
// pas lisse par un epsilon : il est NON MESURE, et il DIT pourquoi.
// La grammaire est celle de measurement.ts (UNMEASURED / indeterminate) ;
// ces codes ne sont qu'un motif attache, jamais une seconde grammaire.

export const LIFT_UNMEASURABLE_REASONS = [
  /** Le decalage du temoin ne depasse pas la largeur de fenetre : il se
   *  recouvre avec l'observation, donc se comparerait a lui-meme. */
  "BASELINE_WINDOW_OVERLAPS_OBSERVED",
  /** Aucune fenetre temoin collectee pour ce KOL. Denominateur inexistant. */
  "BASELINE_NOT_COLLECTED",
  /** Collecte temoin BORNEE par un budget : le total est un plancher (SHILL-C1). */
  "BASELINE_CENSORED",
  /** Temoin collecte mais sous `minBaselineBuys` - plancher du TEMOIN SEUL. */
  "BASELINE_BELOW_FLOOR",
  /** Collecte d'observation BORNEE par un budget (SHILL-C1). */
  "OBSERVED_CENSORED",
  /** Observation sous `minObservedBuys` - variable DISTINCTE, plancher distinct. */
  "OBSERVED_BELOW_FLOOR",
  /** Temoin suffisant, mais CE wallet y a ZERO occurrence : le denominateur du
   *  ratio est nul. Zero epsilon, zero plafond de substitution. */
  "BASELINE_ZERO_OCCURRENCES",
  /** Le taux observe lui-meme n'est pas mesure (aucune occasion analysable). */
  "OBSERVED_RATE_UNMEASURED",
] as const;

export type LiftUnmeasurableReason = (typeof LIFT_UNMEASURABLE_REASONS)[number];

/** Tally d'un cote, jamais des deux. Voir tally.ts. */
export interface SideTally {
  /** Occasions dont la fenetre de CE cote est une mesure exploitable. */
  occasions: number;
  /** Achats dedupliques comptes de CE cote. Censure si la collecte fut bornee. */
  buys: Measurement;
  /** Ce qui a borne la collecte de CE cote, s'il y a lieu. */
  truncatedBy: string[];
}

/** Features calculees par (kol, wallet, chain). Aucune decision ici. */
export interface CorrelationFeatures {
  kolHandle: string;
  wallet: string;
  chain: string;

  // ── Cote OBSERVATION ───────────────────────────────────────────────────
  observedOccasions: number;
  analyzableOccasions: number;
  /** Fait rapporte tel quel, meme sous le plancher de recurrence. */
  ratioObserved: number;
  observedRate: Measurement;
  preTweetCount: number;
  nearTweetCount: number;
  postTweetCount: number;
  exitCount: number;
  distinctKolCount: number;

  // ── Cote TEMOIN ────────────────────────────────────────────────────────
  /** Occasions ou CE wallet apparait dans la fenetre temoin. */
  baselineOccurrences: number;
  /** Occasions dont le temoin est une MESURE (denominateur du taux temoin). */
  baselineMeasuredOccasions: number;
  baselineRate: Measurement;

  // ── Les deux tallies, cote a cote, jamais fusionnes ────────────────────
  observedTally: SideTally;
  baselineTally: SideTally;

  // ── Derive ─────────────────────────────────────────────────────────────
  /** M2 - lift = tauxObserve / tauxTemoin. UNMEASURED quand il ne se calcule pas. */
  lift: Measurement;
  /** Renseigne SSI le lift n'est pas mesure. Jamais null en meme temps que
   *  `lift` non mesure : un refus sans motif est un silence. */
  liftUnmeasurableReason: LiftUnmeasurableReason | null;
  /**
   * FAIT rapporte, JAMAIS un score : le temoin est mesure et suffisant, et ce
   * wallet n'y apparait pas. -42 en faisait un lift plafonne a 10 - c'etait
   * l'epsilon. C'est ici une piste pour l'analyste, sans effet sur le score.
   */
  absentFromMeasuredBaseline: boolean;
}

export type Classification = "watch" | "candidate" | "high_interest";
export type Confidence = "low" | "medium" | "high";

export interface CandidateScores {
  recurrenceScore: number;
  specificityScore: number;
  timingScore: number;
  /** 0 quand le lift n'est pas mesure - et alors `liftCounted` vaut false. */
  liftScore: number;
  /** Le lift a-t-il reellement pese ? Distingue « lift nul » de « pas de lift ». */
  liftCounted: boolean;
  /** Les poids ont-ils ete renormalises faute de lift ? Jamais silencieux. */
  compositeRenormalized: boolean;
  genericSniperPenalty: number;
  correlationScore: number;
  shortlistEligible: boolean;
  seriousCandidate: boolean;
  confidence: Confidence;
  classification: Classification;
  /** Vrai quand le ratio a compte comme recurrence (correctif #2). */
  ratioCredited: boolean;
  /** Ce que le score N'A PAS pu etablir. Jamais silencieux. */
  limitations: string[];
}

/**
 * Enveloppe de nature - DOCTRINE (BUILD2_DATA_NATURE_SPEC, Q3).
 * La sortie du moteur est toujours une INFERENCE : derivee par calcul
 * d'observations on-chain et d'une chronologie de publication.
 */
export interface InferenceEnvelope {
  nature: Extract<DataNature, "INFERENCE">;
  /** Natures des ENTREES qui fondent l'inference. */
  natureBasis: DataNature[];
  basisRefs: {
    occasionIds: string[];
    observationCount: number;
    baselineBuyCount: number;
  };
  policyVersion: string;
}

/** Sortie du moteur. reviewStatus toujours 'draft' : jamais une conclusion. */
export interface CandidateInference {
  kolHandle: string;
  wallet: string;
  chain: string;
  features: CorrelationFeatures;
  scores: CandidateScores;
  reviewStatus: "draft";
  _nature: InferenceEnvelope;
}

export interface EngineTelemetry {
  occasionsTotal: number;
  byObservedState: Record<ObservedState, number>;
  byBaselineState: Record<BaselineState, number>;
  observationsScanned: number;
  baselineBuysScanned: number;
  candidatesEmitted: number;
  /** B - combien de candidats, et pourquoi, n'ont AUCUN lift mesure. */
  liftUnmeasurable: Record<LiftUnmeasurableReason, number>;
  liftMeasured: number;
  /** Candidats absents d'un temoin mesure - piste, jamais verdict. */
  absentFromMeasuredBaseline: number;
  /** Incoherences detectees et rapportees, jamais tues. */
  inconsistencies: string[];
}
