/**
 * src/lib/osint/contracts/status.ts
 *
 * SPRINT A0 — Statuts figés du pipeline retail OSINT (vision ingest).
 *
 * Toutes les enums sont des string-literal unions ADOSSÉES à un const object
 * (pattern `as const` + `(typeof X)[keyof typeof X]`) : une seule source de
 * vérité, utilisable en valeur (runtime, switch exhaustif) ET en type. AUCUNE
 * logique ici — juste la taxonomie qui empêche les statuts bricolés en string
 * libre. Le mapping vers les colonnes existantes (EvidenceSnapshot.reviewStatus,
 * KolTokenLink.visibility/reviewStatus) vit dans ./mapping.ts.
 */

/**
 * SubmissionStatus — cycle de vie d'UNE soumission (un screenshot ingéré).
 * S'applique à la ligne OsintSubmission (table additive non encore appliquée,
 * voir MIGRATION_osint_submission_v1.sql).
 *
 *  SUBMITTED            reçu, pas encore pré-vérifié
 *  PRECHECK_REJECTED    rejeté avant vision (format/taille/blur/no-text) — voir RejectReason
 *  DUPLICATE            sha256 (ou pHash) déjà ingéré — pas de re-traitement
 *  QUEUED               pré-checks OK, en file pour l'appel vision
 *  QUEUED_BUDGET_CAPPED en file mais bloqué par le cap budget vision (repris plus tard)
 *  PROCESSING           appel vision en cours
 *  AUTO_COMMITTED_SHADOW  claims auto-commités en shadow (jamais public) — voir ExtractionDecision
 *  PENDING_REVIEW       au moins un claim en attente de revue humaine — voir PendingReason
 *  RESOLVED_BY_REVIEW   un humain a tranché (accepté/corrigé)
 *  REJECTED_BY_REVIEW   un humain a rejeté la soumission
 *  ERROR_RETRYABLE      erreur transitoire (timeout, 429) — re-tentable
 *  ERROR_FINAL          erreur définitive (corruption, panne modèle) — non re-tentable
 */
export const SubmissionStatus = {
  SUBMITTED: "SUBMITTED",
  PRECHECK_REJECTED: "PRECHECK_REJECTED",
  DUPLICATE: "DUPLICATE",
  QUEUED: "QUEUED",
  QUEUED_BUDGET_CAPPED: "QUEUED_BUDGET_CAPPED",
  PROCESSING: "PROCESSING",
  AUTO_COMMITTED_SHADOW: "AUTO_COMMITTED_SHADOW",
  PENDING_REVIEW: "PENDING_REVIEW",
  RESOLVED_BY_REVIEW: "RESOLVED_BY_REVIEW",
  REJECTED_BY_REVIEW: "REJECTED_BY_REVIEW",
  ERROR_RETRYABLE: "ERROR_RETRYABLE",
  ERROR_FINAL: "ERROR_FINAL",
} as const;
export type SubmissionStatus =
  (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

/**
 * ExtractionDecision — verdict figé pour UN claim atomique à l'issue de
 * l'extraction + des locks. Adossé à ExtractionDecisionRecord (./types.ts) qui
 * y ajoute `reason` + le PendingReason/RejectReason éventuel.
 *
 *  AUTO_COMMIT_EVIDENCE   commit la capture comme preuve (EvidenceSnapshot) SANS
 *                         lien public — source datée, rien d'attribué.
 *  AUTO_COMMIT_ASSERTION  commit preuve + KolTokenLink shadow (visibility 'draft',
 *                         jamais public) — assertion KOL↔token.
 *  PENDING                rien commité, part en revue humaine (cf. PendingReason).
 *  REJECT                 rien commité, soumission écartée (cf. RejectReason).
 */
export const ExtractionDecision = {
  AUTO_COMMIT_EVIDENCE: "AUTO_COMMIT_EVIDENCE",
  AUTO_COMMIT_ASSERTION: "AUTO_COMMIT_ASSERTION",
  PENDING: "PENDING",
  REJECT: "REJECT",
} as const;
export type ExtractionDecision =
  (typeof ExtractionDecision)[keyof typeof ExtractionDecision];

/**
 * ClaimStatus — niveau de vérification atteint par UN claim atomique
 * (ExtractedClaim). Échelle croissante de confiance ; chaque palier débloque
 * une visibilité différente côté KolTokenLink (voir ./mapping.ts).
 *
 *  unverified_submission  brut, juste extrait — rien vérifié
 *  onchain_verified_only  le mint existe on-chain (ticker/symbol confirmé) mais source non liée
 *  source_verified        la capture (sha256) est liée et horodatée comme source
 *  attribution_verified   l'attribution KOL↔token est confirmée (handle ↔ CA)
 *  human_approved         un humain a validé pour publication — seul palier public
 */
export const ClaimStatus = {
  UNVERIFIED_SUBMISSION: "unverified_submission",
  ONCHAIN_VERIFIED_ONLY: "onchain_verified_only",
  SOURCE_VERIFIED: "source_verified",
  ATTRIBUTION_VERIFIED: "attribution_verified",
  HUMAN_APPROVED: "human_approved",
} as const;
export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

/**
 * PendingReason — pourquoi un claim part en PENDING_REVIEW plutôt qu'auto-commit.
 * Renseigné sur ExtractionDecisionRecord quand decision === 'PENDING'.
 *
 *  LOW_CONFIDENCE    confiance vision globale trop basse
 *  NEEDS_SOURCE      assertion sans source liable (perf-card sans CA, cf. reference_osint_perfcard_no_ca)
 *  CA_ABSENT         aucun contract address lisible dans la capture
 *  CA_PARTIAL        CA tronqué / clippé par le bord (cf. reference_osint_ca_zoom_technique)
 *  TICKER_MISMATCH   le ticker lu ne correspond pas au symbol on-chain du mint
 *  MINT_NOT_FOUND    CA lu mais introuvable on-chain
 *  CHAIN_AMBIGUOUS   chain indéterminable (ni explicite, ni déductible d'un CA sûr)
 *  ATTRIBUTION       lien KOL↔token douteux (handle depuis hint, multi-ticker, etc.)
 *  SUSPECT_IMAGE     capture suspecte (montage probable, incohérence interne)
 */
export const PendingReason = {
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  NEEDS_SOURCE: "NEEDS_SOURCE",
  CA_ABSENT: "CA_ABSENT",
  CA_PARTIAL: "CA_PARTIAL",
  TICKER_MISMATCH: "TICKER_MISMATCH",
  MINT_NOT_FOUND: "MINT_NOT_FOUND",
  CHAIN_AMBIGUOUS: "CHAIN_AMBIGUOUS",
  ATTRIBUTION: "ATTRIBUTION",
  SUSPECT_IMAGE: "SUSPECT_IMAGE",
} as const;
export type PendingReason = (typeof PendingReason)[keyof typeof PendingReason];

/**
 * RejectReason — pourquoi une soumission est rejetée AVANT (ou pendant) vision.
 * Renseigné sur ExtractionDecisionRecord quand decision === 'REJECT', ou porté
 * par SubmissionStatus.PRECHECK_REJECTED.
 *
 *  BAD_FORMAT        type de fichier non supporté
 *  TOO_SMALL         résolution sous le seuil exploitable
 *  BLUR_CATASTROPHIC flou rendant toute lecture impossible
 *  NO_TEXT           aucun texte détecté (image décorative / non OSINT)
 *  NO_SIGNAL         texte présent mais zéro ticker / CA / handle exploitable
 *  DUPLICATE         sha256 / pHash déjà ingéré
 */
export const RejectReason = {
  BAD_FORMAT: "BAD_FORMAT",
  TOO_SMALL: "TOO_SMALL",
  BLUR_CATASTROPHIC: "BLUR_CATASTROPHIC",
  NO_TEXT: "NO_TEXT",
  NO_SIGNAL: "NO_SIGNAL",
  DUPLICATE: "DUPLICATE",
} as const;
export type RejectReason = (typeof RejectReason)[keyof typeof RejectReason];

/**
 * SourceTrustTier — niveau de confiance accordé à la PROVENANCE d'une
 * soumission (qui l'a envoyée). Module l'éligibilité à l'auto-commit et le
 * routage en revue. Porté par ProvenanceRecord.trustTier.
 *
 *  anonymous_retail  soumission anonyme (clé = IP-hash) — confiance minimale
 *  verified_user     utilisateur authentifié non privilégié
 *  investigator      enquêteur interne reconnu
 *  internal_watcher  pipeline automatisé maison (watcher) — fiable mais machine
 *  admin             opérateur humain admin — confiance maximale
 *
 * ORDRE DE POIDS (croissant, voir SOURCE_TRUST_WEIGHT) :
 *   anonymous_retail(0) < verified_user(1) < investigator(2)
 *   < internal_watcher(3) < admin(4)
 * Rationale : un humain admin tranche au-dessus de tout ; le watcher est
 * fiable mais reste une machine sans jugement ; l'anonyme est plancher.
 */
export const SourceTrustTier = {
  ANONYMOUS_RETAIL: "anonymous_retail",
  VERIFIED_USER: "verified_user",
  INVESTIGATOR: "investigator",
  INTERNAL_WATCHER: "internal_watcher",
  ADMIN: "admin",
} as const;
export type SourceTrustTier =
  (typeof SourceTrustTier)[keyof typeof SourceTrustTier];

/**
 * Poids ordinal des tiers de confiance (croissant = plus de confiance).
 * Source de vérité unique pour tout comparateur de provenance.
 */
export const SOURCE_TRUST_WEIGHT: Record<SourceTrustTier, number> = {
  [SourceTrustTier.ANONYMOUS_RETAIL]: 0,
  [SourceTrustTier.VERIFIED_USER]: 1,
  [SourceTrustTier.INVESTIGATOR]: 2,
  [SourceTrustTier.INTERNAL_WATCHER]: 3,
  [SourceTrustTier.ADMIN]: 4,
};
