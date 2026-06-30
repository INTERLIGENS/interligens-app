/**
 * src/lib/osint/review/reviewContracts.ts
 *
 * SPRINT B — Contrats de la couche REVIEW (résolution humaine du backlog OSINT).
 *
 * La review NE PUBLIE RIEN. Résoudre un PENDING = le faire passer de pending à
 * un état TRAITÉ (shadow). La publication publique reste derrière le triple-gate
 * existant (lien approuvé + profil publié + substance) — hors de portée d'ici.
 *
 * Aucun statut réinventé : on réutilise STRICTEMENT
 *   - SubmissionStatus (A0) pour OsintSubmission,
 *   - le vocabulaire pré-existant 'resolved'/'rejected' pour SignalIntake,
 *   - 'rejected' / 'pending_review' / 'draft' pour KolTokenLink.
 * ESCALATE n'introduit AUCUN statut : il pose une ligne d'audit action=ESCALATE
 * et le loader exclut tout item escaladé de la file standard.
 */

import {
  SubmissionStatus,
  ClaimStatus,
  CLAIM_STATUS_TO_EVIDENCE,
  CLAIM_STATUS_TO_LINK,
} from "../contracts";

/** Les trois sources de la file de revue (cf. PARTIE 1 du sprint). */
export const ReviewItemType = {
  /** Ligne OsintSubmission status=PENDING_REVIEW (pipeline vision). */
  SUBMISSION: "submission",
  /** KolTokenLink reviewStatus=pending_review (assertion en attente). */
  LINK: "link",
  /** SignalIntake status=needs_resolution (signal bridge non résolu). */
  SIGNAL: "signal",
} as const;
export type ReviewItemType = (typeof ReviewItemType)[keyof typeof ReviewItemType];

/** Référence stable vers un item de la file. */
export interface ReviewItemRef {
  type: ReviewItemType;
  id: string;
}

/** Les trois actions 1-clic. Aucune ne publie. */
export const ReviewAction = {
  /** Saisir/corriger la CA → RE-VÉRIFIE on-chain avant d'accepter (shadow). */
  RESOLVE: "RESOLVE",
  /** Rejette ; evidence CONSERVÉE (jamais supprimée). */
  REJECT: "REJECT",
  /** Marque pour traitement approfondi ; sort de la file standard. */
  ESCALATE: "ESCALATE",
} as const;
export type ReviewAction = (typeof ReviewAction)[keyof typeof ReviewAction];

/**
 * État courant d'un item, lu AVANT mutation (sert de `before` à l'audit).
 * `status` est la valeur brute de la colonne d'état propre au type
 * (OsintSubmission.status | SignalIntake.status | KolTokenLink.reviewStatus).
 */
export interface ReviewItemState {
  ref: ReviewItemRef;
  status: string;
  visibility: string | null;   // KolTokenLink only ; null sinon
  isPublic: boolean | null;    // evidence liée ; null si inconnu
  kolHandle: string | null;
  tokenSymbol: string | null;
  contractAddress: string | null;
  chain: string | null;
}

/** Ligne d'audit non-répudiable écrite à CHAQUE action. */
export interface ReviewAuditRecord {
  itemType: ReviewItemType;
  itemId: string;
  action: ReviewAction;
  actor: string;
  reason: string;
  /** Snapshot avant (JSON sérialisable). */
  before: unknown;
  /** Snapshot après (JSON sérialisable). */
  after: unknown;
  createdAt: string; // ISO 8601 UTC
}

/** IO injecté (mock en test ; prisma+SQL brut côté route). */
export interface ReviewStore {
  getItem(ref: ReviewItemRef): Promise<ReviewItemState | null>;
  /** OsintSubmission.status (SubmissionStatus). */
  setSubmissionStatus(id: string, status: SubmissionStatus, review: ReviewStamp): Promise<void>;
  /** SignalIntake.status ('resolved' | 'rejected'), vocabulaire bridge existant. */
  setSignalStatus(id: string, status: "resolved" | "rejected", review: ReviewStamp): Promise<void>;
  /** KolTokenLink.reviewStatus — JAMAIS 'approved_public' ici (resterait shadow). */
  setLinkReviewStatus(id: string, reviewStatus: "pending_review" | "rejected", review: ReviewStamp): Promise<void>;
  /** Écrit la ligne d'audit (OsintReviewAudit). */
  writeAudit(audit: ReviewAuditRecord): Promise<void>;
  /** true si l'item porte déjà une escalade (pour idempotence / file standard). */
  isEscalated?(ref: ReviewItemRef): Promise<boolean>;
}

/** Empreinte de revue posée sur les colonnes reviewedBy/reviewedAt/reviewNote. */
export interface ReviewStamp {
  reviewedBy: string;
  reviewedAt: string;
  reviewNote: string;
}

export interface ReviewDeps {
  store: ReviewStore;
  /** Re-vérification on-chain OBLIGATOIRE à tout RESOLVE manuel. */
  verifyMint: import("../vision/verifyMintOnChain").VerifyMintFn;
  actor: string;
  now?: () => string; // ISO ; injecté pour rester déterministe en test
}

/**
 * Palier de vérification atteint après une résolution humaine.
 * SOURCE_VERIFIED : le réviseur a re-vérifié la CA on-chain ET la capture sert
 * de source datée. C'est un palier SHADOW (isPublic=false, visibility 'draft').
 * Le seul palier public (HUMAN_APPROVED) n'est JAMAIS atteint par la review —
 * il reste derrière le triple-gate de publication.
 */
export const RESOLVED_CLAIM_STATUS: ClaimStatus = ClaimStatus.SOURCE_VERIFIED;

/**
 * Garde-fou exécuté EN CODE (pas seulement par convention) : vérifie qu'un
 * palier de claim ne matérialise jamais de public. Lève si la table de mapping
 * A0 dit l'inverse — empêche une régression de mapping de fuiter en public via
 * la review.
 */
export function assertShadowClaimStatus(cs: ClaimStatus): void {
  const ev = CLAIM_STATUS_TO_EVIDENCE[cs];
  const lk = CLAIM_STATUS_TO_LINK[cs];
  if (ev.isPublic || ev.reviewStatus === "published") {
    throw new Error(`review invariant violated: claimStatus '${cs}' maps to public evidence`);
  }
  if (lk.visibility === "public" || lk.reviewStatus === "approved_public") {
    throw new Error(`review invariant violated: claimStatus '${cs}' maps to public link`);
  }
}
