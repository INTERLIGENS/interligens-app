/**
 * src/lib/osint/contracts/mapping.ts
 *
 * SPRINT A0 — Pont entre la NOUVELLE taxonomie OSINT (./status.ts) et les
 * colonnes DÉJÀ EN PROD sur ep-square-band. But : garantir que les nouveaux
 * statuts se projettent proprement sur l'existant SANS rien casser ni renommer.
 *
 * Existant (constaté en base / dans le code) :
 *  - EvidenceSnapshot.reviewStatus : default 'pending' ; valeurs vues
 *      'pending' | 'approved' | 'published' | 'rejected' | 'internal' | 'auto_draft'
 *    + EvidenceSnapshot.isPublic (bool, default false)
 *    + EvidenceSnapshot.extractionMethod / extractionConfidence (Json) — DÉJÀ migrées
 *      (MIGRATION_osint_vision_ingest_v1), portent la méthode + le blob de confiance.
 *  - KolTokenLink.visibility : default 'public' ; bridge écrit 'draft'
 *  - KolTokenLink.reviewStatus : default 'approved_public' ; bridge écrit
 *      'pending_review' | 'approved_public' | 'rejected'
 *
 * Ces tables de mapping sont de la DONNÉE (pas de la logique). Étant typées
 * `Record<EnumComplète, …>`, tout ajout d'un membre d'enum non mappé casse tsc :
 * c'est le garde-fou anti-statut-bricolé.
 */

import {
  ClaimStatus,
  ExtractionDecision,
  SubmissionStatus,
} from "./status";

/** Cible de persistance d'un EvidenceSnapshot pour un statut donné. */
export interface EvidenceTarget {
  /** Valeur écrite dans EvidenceSnapshot.reviewStatus (vocabulaire existant). */
  reviewStatus: "pending" | "approved" | "published" | "rejected" | "internal";
  /** EvidenceSnapshot.isPublic — false partout sauf palier humain validé. */
  isPublic: boolean;
}

/** Cible de persistance d'un KolTokenLink pour un statut donné. */
export interface LinkTarget {
  /** KolTokenLink.visibility (vocabulaire existant : 'public' | 'draft' | 'internal'). */
  visibility: "public" | "draft" | "internal";
  /** KolTokenLink.reviewStatus (vocabulaire existant). */
  reviewStatus: "approved_public" | "pending_review" | "rejected";
  /** false ⇒ aucun KolTokenLink n'est matérialisé à ce palier (preuve seule). */
  materializeLink: boolean;
}

/**
 * ClaimStatus → (EvidenceSnapshot, KolTokenLink) existants.
 *
 * Règle d'or shadow-mode : RIEN n'est public tant que le claim n'est pas
 * `human_approved`. Tous les paliers automatiques retombent sur draft/pending,
 * isPublic=false — cohérent avec le filtre visibility='public' du Sprint 8.
 */
export const CLAIM_STATUS_TO_EVIDENCE: Record<ClaimStatus, EvidenceTarget> = {
  [ClaimStatus.UNVERIFIED_SUBMISSION]: { reviewStatus: "pending", isPublic: false },
  [ClaimStatus.ONCHAIN_VERIFIED_ONLY]: { reviewStatus: "pending", isPublic: false },
  [ClaimStatus.SOURCE_VERIFIED]:       { reviewStatus: "pending", isPublic: false },
  [ClaimStatus.ATTRIBUTION_VERIFIED]:  { reviewStatus: "pending", isPublic: false },
  [ClaimStatus.HUMAN_APPROVED]:        { reviewStatus: "approved", isPublic: true },
};

export const CLAIM_STATUS_TO_LINK: Record<ClaimStatus, LinkTarget> = {
  [ClaimStatus.UNVERIFIED_SUBMISSION]: { visibility: "draft",  reviewStatus: "pending_review",  materializeLink: false },
  [ClaimStatus.ONCHAIN_VERIFIED_ONLY]: { visibility: "draft",  reviewStatus: "pending_review",  materializeLink: true },
  [ClaimStatus.SOURCE_VERIFIED]:       { visibility: "draft",  reviewStatus: "pending_review",  materializeLink: true },
  [ClaimStatus.ATTRIBUTION_VERIFIED]:  { visibility: "draft",  reviewStatus: "pending_review",  materializeLink: true },
  [ClaimStatus.HUMAN_APPROVED]:        { visibility: "public", reviewStatus: "approved_public", materializeLink: true },
};

/**
 * ExtractionDecision → ce qu'on matérialise.
 *  AUTO_COMMIT_EVIDENCE  : EvidenceSnapshot seul (preuve datée), pas de lien.
 *  AUTO_COMMIT_ASSERTION : EvidenceSnapshot + KolTokenLink shadow (draft).
 *  PENDING / REJECT      : rien de matérialisé.
 */
export interface DecisionEffect {
  writeEvidence: boolean;
  writeLink: boolean;
  /** Statut de soumission résultant (cf. ./status SubmissionStatus). */
  submissionStatus: SubmissionStatus;
}

export const DECISION_TO_EFFECT: Record<ExtractionDecision, DecisionEffect> = {
  [ExtractionDecision.AUTO_COMMIT_EVIDENCE]:  { writeEvidence: true,  writeLink: false, submissionStatus: SubmissionStatus.AUTO_COMMITTED_SHADOW },
  [ExtractionDecision.AUTO_COMMIT_ASSERTION]: { writeEvidence: true,  writeLink: true,  submissionStatus: SubmissionStatus.AUTO_COMMITTED_SHADOW },
  [ExtractionDecision.PENDING]:               { writeEvidence: false, writeLink: false, submissionStatus: SubmissionStatus.PENDING_REVIEW },
  [ExtractionDecision.REJECT]:                { writeEvidence: false, writeLink: false, submissionStatus: SubmissionStatus.PRECHECK_REJECTED },
};

/**
 * Valeur écrite dans EvidenceSnapshot.extractionMethod (colonne déjà migrée).
 * Aligne la taxonomie sur la valeur que buildPlan émet déjà ("vision_auto").
 */
export const EXTRACTION_METHOD_VISION_AUTO = "vision_auto" as const;
