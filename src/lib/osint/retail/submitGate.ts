/**
 * src/lib/osint/retail/submitGate.ts
 *
 * SPRINT C1 — Le CERVEAU de la porte (PUR, zéro IO). Décide :
 *   1. au niveau ENVOI : si la requête est même recevable (kill switch, Turnstile,
 *      rate-limit IP, quota images) → accept / rejet propre avec code HTTP.
 *   2. au niveau IMAGE : le statut figé d'UNE image après dédup / précheck /
 *      budget → QUEUED | QUEUED_BUDGET_CAPPED | DUPLICATE | PRECHECK_REJECTED.
 *
 * Toute IO (compter les soumissions, hasher, vérifier Turnstile, lire le budget)
 * est faite EN AMONT par la route ; ici on ne fait que classer des booléens. C'est
 * ce qui rend la porte testable exhaustivement sur mock.
 *
 * Les statuts sont importés d'A0 — AUCUN statut bricolé.
 */

import { SubmissionStatus, RejectReason } from "../contracts";
import type { SubmissionStatus as SubmissionStatusT, RejectReason as RejectReasonT } from "../contracts";
import { MAX_SUBMITS_PER_IP_PER_DAY, MAX_IMAGES_PER_SUBMIT } from "./retailConfig";

// ── 1. Gate au niveau ENVOI ────────────────────────────────────────────────────

export interface SubmitGateInput {
  /** OSINT_RETAIL_SUBMIT_ENABLED. */
  submitEnabled: boolean;
  /** Turnstile : configuré ? token validé ? */
  turnstileConfigured: boolean;
  turnstileOk: boolean;
  /** Nb de soumissions de cette IP-hash sur les dernières 24 h (avant celle-ci). */
  ipSubmitCountLast24h: number;
  /** Nb d'images dans cet envoi (après parsing). */
  imageCount: number;
  /** true si AU MOINS une image dépasse la taille brute max. */
  anyImageOversize: boolean;
}

export interface SubmitGateDecision {
  accept: boolean;
  httpStatus: number;
  errorCode: string | null;
  reason: string;
}

const ACCEPTED: SubmitGateDecision = { accept: true, httpStatus: 202, errorCode: null, reason: "accepted" };

/**
 * Verrous d'envoi, dans l'ordre (échec = rejet propre). Turnstile : on ne bloque
 * QUE s'il est configuré (sinon verdict non bloquant — la route loggue
 * turnstileVerified=null ; la porte globale reste fermée par défaut de toute façon).
 */
export function evaluateSubmitGate(input: SubmitGateInput): SubmitGateDecision {
  // a. Kill switch
  if (!input.submitEnabled) {
    return { accept: false, httpStatus: 403, errorCode: "submissions_closed", reason: "OSINT_RETAIL_SUBMIT_ENABLED is false" };
  }
  // b. Turnstile (bloquant uniquement si configuré)
  if (input.turnstileConfigured && !input.turnstileOk) {
    return { accept: false, httpStatus: 403, errorCode: "turnstile_failed", reason: "Turnstile token invalid or missing" };
  }
  // c. Rate-limit IP
  if (input.ipSubmitCountLast24h >= MAX_SUBMITS_PER_IP_PER_DAY) {
    return {
      accept: false,
      httpStatus: 429,
      errorCode: "rate_limited",
      reason: `IP exceeded ${MAX_SUBMITS_PER_IP_PER_DAY} submits / 24h`,
    };
  }
  // d. Quota images
  if (input.imageCount < 1) {
    return { accept: false, httpStatus: 400, errorCode: "no_image", reason: "at least one image required" };
  }
  if (input.imageCount > MAX_IMAGES_PER_SUBMIT) {
    return {
      accept: false,
      httpStatus: 400,
      errorCode: "too_many_images",
      reason: `max ${MAX_IMAGES_PER_SUBMIT} images per submit`,
    };
  }
  if (input.anyImageOversize) {
    return { accept: false, httpStatus: 413, errorCode: "image_too_large", reason: "an image exceeds the raw size limit" };
  }
  return ACCEPTED;
}

// ── 2. Classement d'UNE image ──────────────────────────────────────────────────

export interface ImageOutcomeInput {
  /** sha256 de l'original déjà ingéré auparavant ? */
  isDuplicate: boolean;
  /** résultat du précheck (sharp). */
  precheckOk: boolean;
  precheckRejectReason: RejectReasonT | null;
  /** budget vision journalier déjà dépassé au moment d'accepter cette image ? */
  budgetExceeded: boolean;
}

export interface ImageOutcome {
  status: SubmissionStatusT;
  rejectReason: RejectReasonT | null;
  /** true si cette image consommera de la vision plus tard (QUEUED réel). */
  willConsumeVision: boolean;
}

/**
 * Précédence (toutes "zéro appel vision" sauf QUEUED) :
 *   DUPLICATE  >  PRECHECK_REJECTED  >  QUEUED_BUDGET_CAPPED  >  QUEUED
 * - dédup d'abord : un doublon connu ne mérite ni précheck ni budget.
 * - précheck ensuite : inexploitable manifeste, écarté avant tout coût.
 * - budget : recevable mais la vision est plafonnée → en file, repris plus tard.
 * - sinon QUEUED : pré-checks OK, en attente du traitement vision async.
 */
export function classifyImageOutcome(input: ImageOutcomeInput): ImageOutcome {
  if (input.isDuplicate) {
    return { status: SubmissionStatus.DUPLICATE, rejectReason: RejectReason.DUPLICATE, willConsumeVision: false };
  }
  if (!input.precheckOk) {
    return {
      status: SubmissionStatus.PRECHECK_REJECTED,
      rejectReason: input.precheckRejectReason ?? RejectReason.NO_SIGNAL,
      willConsumeVision: false,
    };
  }
  if (input.budgetExceeded) {
    return { status: SubmissionStatus.QUEUED_BUDGET_CAPPED, rejectReason: null, willConsumeVision: false };
  }
  return { status: SubmissionStatus.QUEUED, rejectReason: null, willConsumeVision: true };
}

/**
 * Statut agrégé d'un batch (1-3 images) pour le status endpoint public et la
 * réponse 202. Règle : on remonte l'état le plus "avancé/positif" du lot afin que
 * le soumetteur voie que quelque chose est pris en charge ; sinon l'état d'attente
 * dominant. Ordre de priorité d'affichage du batch :
 *   processing/review/committed (rendu par le processeur) > QUEUED > QUEUED_BUDGET_CAPPED
 *   > DUPLICATE > PRECHECK_REJECTED.
 */
const BATCH_PRIORITY: SubmissionStatusT[] = [
  SubmissionStatus.AUTO_COMMITTED_SHADOW,
  SubmissionStatus.PENDING_REVIEW,
  SubmissionStatus.PROCESSING,
  SubmissionStatus.RESOLVED_BY_REVIEW,
  SubmissionStatus.QUEUED,
  SubmissionStatus.QUEUED_BUDGET_CAPPED,
  SubmissionStatus.ERROR_RETRYABLE,
  SubmissionStatus.DUPLICATE,
  SubmissionStatus.REJECTED_BY_REVIEW,
  SubmissionStatus.PRECHECK_REJECTED,
  SubmissionStatus.ERROR_FINAL,
  SubmissionStatus.SUBMITTED,
];

export function aggregateBatchStatus(statuses: SubmissionStatusT[]): SubmissionStatusT {
  for (const s of BATCH_PRIORITY) {
    if (statuses.includes(s)) return s;
  }
  return SubmissionStatus.SUBMITTED;
}
