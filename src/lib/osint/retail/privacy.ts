/**
 * src/lib/osint/retail/privacy.ts
 *
 * SPRINT C1 — PRIVACY (exigence GPT avant retail).
 *
 * RÈGLE DURE : l'image originale retail n'est JAMAIS publique, même après
 * validation humaine. Le défaut d'une soumission retail est never_public_raw.
 * Cet enum suit le pattern A0 (`as const` + union dérivée) mais vit dans le
 * module retail : c'est un statut NOUVEAU (Sprint C1), il n'appartient pas à la
 * taxonomie figée A0 et ne la modifie pas.
 *
 *  raw_private            original conservé en privé, non encore scanné PII
 *  pii_scan_pending       en attente d'un scan PII (reporté C2)
 *  pii_redacted           PII détectée et caviardée (reporté C2)
 *  safe_for_admin_review  jugé sûr pour revue admin interne (jamais public)
 *  never_public_raw       l'original ne sera JAMAIS publié, quelle que soit l'issue
 */
export const PrivacyStatus = {
  RAW_PRIVATE: "raw_private",
  PII_SCAN_PENDING: "pii_scan_pending",
  PII_REDACTED: "pii_redacted",
  SAFE_FOR_ADMIN_REVIEW: "safe_for_admin_review",
  NEVER_PUBLIC_RAW: "never_public_raw",
} as const;
export type PrivacyStatus = (typeof PrivacyStatus)[keyof typeof PrivacyStatus];

/**
 * Statut privacy par défaut de toute soumission retail. C'est la garantie dure :
 * l'original ne devient jamais public. Un sprint ultérieur (scan PII) pourra
 * faire transiter raw_private → safe_for_admin_review, mais JAMAIS vers un état
 * public — il n'en existe pas.
 */
export const DEFAULT_RETAIL_PRIVACY_STATUS: PrivacyStatus = PrivacyStatus.NEVER_PUBLIC_RAW;
