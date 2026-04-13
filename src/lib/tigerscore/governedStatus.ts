/**
 * Governed Status — editorial classification layer.
 *
 * Completely separate from the numeric TigerScore. The engine ceiling (72 for
 * corroborated intel, 100 only when explicitly lifted) is never bypassed here:
 * confirmed_known_bad and authority_flagged are *display-only* classifications
 * set by humans or authoritative sources and are attached alongside the score,
 * never merged into it.
 *
 * The engine can suggest up to `corroborated_high_risk` based on signals; the
 * two strongest tiers require manual/external provenance.
 */

export type GovernedStatus =
  | "none"
  | "watchlisted"
  | "suspected"
  | "corroborated_high_risk"
  | "confirmed_known_bad"
  | "authority_flagged";

export type GovernedStatusBasis =
  | "manual_internal_confirmation"
  | "external_authority_source"
  | "multi_source_corroboration"
  | "legacy_case_linkage";

export type GovernedStatusReviewState = "draft" | "reviewed" | "approved";

export interface GovernedStatusPayload {
  governedStatus: GovernedStatus;
  governedStatusBasis: GovernedStatusBasis | null;
  governedStatusReason: string | null;
  governedStatusSetBy: string | null;
  governedStatusSetAt: string | null;
  governedStatusReviewState: GovernedStatusReviewState | null;
  governedStatusEvidenceRefs: string[];
}

export const EMPTY_GOVERNED_STATUS: GovernedStatusPayload = {
  governedStatus: "none",
  governedStatusBasis: null,
  governedStatusReason: null,
  governedStatusSetBy: null,
  governedStatusSetAt: null,
  governedStatusReviewState: null,
  governedStatusEvidenceRefs: [],
};

// The engine can suggest up to corroborated_high_risk.
// confirmed_known_bad and authority_flagged are reserved for humans / authority sources.
export type SuggestedGovernedStatus =
  | "none"
  | "watchlisted"
  | "suspected"
  | "corroborated_high_risk";

export function deriveMotorSuggestedStatus(
  tigerScore: number,
  isKnownBad: boolean,
  _signalCount: number
): SuggestedGovernedStatus {
  if (isKnownBad) return "corroborated_high_risk";
  if (tigerScore >= 75) return "corroborated_high_risk";
  if (tigerScore >= 50) return "suspected";
  if (tigerScore >= 25) return "watchlisted";
  return "none";
}

/**
 * Pick the final displayed status.
 * A non-"none" manual status always wins over the engine's suggestion.
 */
export function resolveGovernedStatus(
  manualStatus: GovernedStatusPayload | null,
  suggestedStatus: SuggestedGovernedStatus
): GovernedStatusPayload {
  if (manualStatus && manualStatus.governedStatus !== "none") {
    return manualStatus;
  }
  return {
    ...EMPTY_GOVERNED_STATUS,
    governedStatus: suggestedStatus,
  };
}

export type GovernedStatusSeverity =
  | "maximum"
  | "high"
  | "medium"
  | "low"
  | "none";

export const GOVERNED_STATUS_LABELS: Record<
  GovernedStatus,
  { en: string; fr: string; severity: GovernedStatusSeverity }
> = {
  none: { en: "", fr: "", severity: "none" },
  watchlisted: {
    en: "Watchlisted",
    fr: "Sous surveillance",
    severity: "low",
  },
  suspected: { en: "Suspected", fr: "Suspecté", severity: "medium" },
  corroborated_high_risk: {
    en: "Corroborated High Risk",
    fr: "Risque élevé corroboré",
    severity: "high",
  },
  confirmed_known_bad: {
    en: "Confirmed Known Bad",
    fr: "Acteur malveillant confirmé",
    severity: "maximum",
  },
  authority_flagged: {
    en: "Authority-Flagged",
    fr: "Signalé par source d'autorité",
    severity: "maximum",
  },
};

export const GOVERNED_STATUS_BASIS_LABELS: Record<
  GovernedStatusBasis,
  { en: string; fr: string }
> = {
  manual_internal_confirmation: {
    en: "manual internal confirmation",
    fr: "confirmation interne manuelle",
  },
  external_authority_source: {
    en: "an external authority source",
    fr: "une source d'autorité externe",
  },
  multi_source_corroboration: {
    en: "multi-source corroboration",
    fr: "corroboration multi-sources",
  },
  legacy_case_linkage: {
    en: "a linked legacy case",
    fr: "un dossier lié historique",
  },
};

export const GOVERNED_STATUS_DISCLAIMER = {
  en: "This status is governed separately from the numeric TigerScore.",
  fr: "Ce statut est gouverné séparément du score numérique TigerScore.",
};
