// --- B2 — LE PRÉDICAT DE QUALIFICATION « PROMOTION EXPLOITABLE » ----------
//
// ██ MENTIONNER UN TOKEN N'EST PAS LE PROMOUVOIR. ██
//
// C'est la doctrine que ce fichier fait tenir. Sur 30 jours, 1 366 posts ont
// été capturés ; les traiter tous comme des promotions aurait rempli le moteur
// de commentaires de marché, de comparatifs et de retweets. Le cas qui a servi
// de test est réel et daté du 2026-09-03 :
//
//   « Some people are upset that $CETS didn't get the Alpha listing
//     and it went to $FLORK »
//
// Deux tickers, aucune adresse, aucune promotion. Ce n'est pas un bord : c'est
// la forme ordinaire du bruit.
//
// ─── PURE, ET VERSIONNÉE ──────────────────────────────────────────────────
//
// Aucune écriture, aucun réseau. Le module ne connaît ni prisma ni Helius : il
// lit une ligne déjà chargée et rend un verdict.
//
// La règle est NOMMÉE et VERSIONNÉE parce que B4 la citera dans le
// `natureBasis` d'une inférence. Une qualification dont on ne peut pas relire
// la règle six mois plus tard n'est pas auditable — et un basis qui référence
// « le prédicat » sans dire lequel ne référence rien.
//
// ─── CONSERVATRICE, ET RÉVISABLE — DIT ICI, PAS DÉCOUVERT PLUS TARD ──────
//
// V1 est délibérément stricte. Elle produira des FAUX NÉGATIFS : une promotion
// dont la CA n'est pas dans `detectedAddresses`, ou qui cite deux tokens, sera
// rejetée. C'est assumé pour le lancement — mieux vaut un corpus étroit et
// propre qu'un corpus large dont on doute.
//
// Les faux négatifs se travailleront sur les données SHADOW, quand il y en
// aura. Pas avant : élargir un prédicat sans mesure, c'est le régler sur
// l'intuition de celui qui l'écrit.

import { parseDetectedTokens } from "./parsing";
import { SOCIAL_PROMOTION_QUALIFY_V1 } from "@/lib/methodology/registry";

/**
 * ██ LA VERSION DE RÈGLE — UN SEUL IDENTIFIANT ██
 *
 * B4.1 : la valeur posée ici était `promotion-qualify@v1`, un slug NU. La
 * grammaire canonique (`data-nature/methodRef.ts`) exige
 * `<methodologie>/<composant>@v<N>` et le REFUSAIT — un identifiant qui ne
 * resout pas ne doit jamais entrer dans un natureBasis.
 *
 * La constante pointe desormais le ref canonique, qui resout sur un artefact
 * GELE (content/methodologies/social-promotion/v1.md). Une seule valeur, donc
 * aucun risque que la regle citee dans un basis diverge de la regle appliquee.
 *
 * Change des qu'un critere change : deux qualifications rendues sous deux
 * versions ne sont pas comparables, et sans ce champ rien ne le dirait.
 */
export const PROMOTION_QUALIFY_RULE_VERSION = SOCIAL_PROMOTION_QUALIFY_V1;

/**
 * V1 est conservatrice et sera révisée. Le drapeau existe pour que ce fait
 * voyage AVEC le verdict, et pas seulement dans ce commentaire.
 */
export const PROMOTION_QUALIFY_IS_CONSERVATIVE = true;

/** Le seuil de score, borne INCLUSIVE. 50 passe, 49 non. */
export const MIN_SIGNAL_SCORE = 50;

/** Le signal qui distingue un largage de contrat d'une simple mention. */
export const REQUIRED_SIGNAL_TYPE = "ca_drop";

/** Le seul mode d'ingestion retenu : le flux, pas le rattrapage. */
export const REQUIRED_INGESTION_MODE = "LIVE";

/** Ce que le prédicat lit d'un candidat. Rien d'autre. */
export interface PromotionCandidateInput {
  ingestionMode?: string | null;
  /** text contenant un tableau JSON — parsé par `parseDetectedTokens`. */
  signalTypes?: unknown;
  signalScore?: number | null;
  /** jsonb — les symboles détectés. */
  detectedTokens?: unknown;
  /** text contenant un tableau JSON — les contrats détectés. */
  detectedAddresses?: unknown;
}

/** Les critères, dans l'ordre où ils sont évalués. */
export const QUALIFY_CRITERIA = [
  "ingestion_mode_live",
  "signal_type_ca_drop",
  "detected_addresses_present",
  "signal_score_above_floor",
  "single_ticker",
] as const;

export type QualifyCriterion = (typeof QUALIFY_CRITERIA)[number];

export interface PromotionQualification {
  qualified: boolean;
  /**
   * Le motif EXACT — quel critère a disqualifié, ou la confirmation que tous
   * ont été franchis. Lu par l'observabilité et cité par le basis de B4.
   */
  reason: string;
  /** Le critère qui a fait échouer. `null` quand le candidat est qualifié. */
  failedCriterion: QualifyCriterion | null;
  ruleVersion: string;
  conservative: boolean;
  /** Résultat par critère — pour compter les refus par cause. */
  criteria: Record<QualifyCriterion, boolean>;
}

/**
 * QUALIFIE — ou refuse, en nommant la cause.
 *
 * TOUS les critères sont requis. L'ordre d'évaluation va du plus AMONT au plus
 * aval, de sorte que le motif rendu soit celui qu'il faut lever en premier :
 * un candidat en BACKFILL n'a pas à être rapporté « score insuffisant », il
 * n'aurait jamais dû être examiné.
 */
export function qualifyPromotion(
  candidate: PromotionCandidateInput,
): PromotionQualification {
  const signalTypes = parseDetectedTokens(candidate.signalTypes);
  const addresses = parseDetectedTokens(candidate.detectedAddresses);
  const tickers = parseDetectedTokens(candidate.detectedTokens);
  const score = candidate.signalScore ?? 0;

  const criteria: Record<QualifyCriterion, boolean> = {
    ingestion_mode_live: candidate.ingestionMode === REQUIRED_INGESTION_MODE,
    signal_type_ca_drop: signalTypes.includes(REQUIRED_SIGNAL_TYPE),
    detected_addresses_present: addresses.length > 0,
    signal_score_above_floor: score >= MIN_SIGNAL_SCORE,
    // ██ LA GARDE DE LANCEMENT ██
    // Exactement UN ticker. Deux tickers, c'est soit un comparatif, soit une
    // liste — et dans les deux cas, apparier un contrat à l'un d'eux serait
    // choisir sans preuve. B1 refuse déjà l'appariement ; ce critère évite
    // qu'on lui pose seulement la question.
    single_ticker: tickers.length === 1,
  };

  const failed = QUALIFY_CRITERIA.find((c) => !criteria[c]) ?? null;

  if (failed) {
    return {
      qualified: false,
      failedCriterion: failed,
      reason: explain(failed, { signalTypes, addresses, tickers, score, candidate }),
      ruleVersion: PROMOTION_QUALIFY_RULE_VERSION,
      conservative: PROMOTION_QUALIFY_IS_CONSERVATIVE,
      criteria,
    };
  }

  return {
    qualified: true,
    failedCriterion: null,
    reason:
      `qualifiée : LIVE, ${REQUIRED_SIGNAL_TYPE}, ${addresses.length} adresse(s), ` +
      `score ${score} >= ${MIN_SIGNAL_SCORE}, ticker unique (${tickers[0]})`,
    ruleVersion: PROMOTION_QUALIFY_RULE_VERSION,
    conservative: PROMOTION_QUALIFY_IS_CONSERVATIVE,
    criteria,
  };
}

function explain(
  failed: QualifyCriterion,
  ctx: {
    signalTypes: string[];
    addresses: string[];
    tickers: string[];
    score: number;
    candidate: PromotionCandidateInput;
  },
): string {
  switch (failed) {
    case "ingestion_mode_live":
      return `mode d'ingestion « ${ctx.candidate.ingestionMode ?? "absent"} » ≠ ${REQUIRED_INGESTION_MODE}`;
    case "signal_type_ca_drop":
      return `aucun signal ${REQUIRED_SIGNAL_TYPE} (vus : ${ctx.signalTypes.join(", ") || "aucun"}) — une mention n'est pas un largage de contrat`;
    case "detected_addresses_present":
      return "aucune adresse détectée — sans contrat, rien à corréler on-chain";
    case "signal_score_above_floor":
      return `score ${ctx.score} < ${MIN_SIGNAL_SCORE}`;
    case "single_ticker":
      return ctx.tickers.length === 0
        ? "aucun ticker détecté"
        : `${ctx.tickers.length} tickers (${ctx.tickers.join(", ")}) — comparatif ou liste, l'appariement serait sans preuve`;
  }
}
