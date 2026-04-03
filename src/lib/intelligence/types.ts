// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Shared Types
// Independent of Prisma. All enums are string unions.
// ─────────────────────────────────────────────────────────────────────────────

export type IntelEntityType =
  | "ADDRESS"
  | "CONTRACT"
  | "TOKEN_CA"
  | "DOMAIN"
  | "PROJECT"
  | "PERSON";

export type IntelRiskClass =
  | "SANCTION"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "UNKNOWN";

export type MatchBasis =
  | "EXACT_ADDRESS"
  | "EXACT_CONTRACT"
  | "EXACT_DOMAIN"
  | "EXACT_TOKEN_CA"
  | "INFERRED_LINKAGE"
  | "FUZZY_ALIAS";

export type IntelDisplaySafety =
  | "INTERNAL_ONLY"
  | "ANALYST_REVIEWED"
  | "RETAIL_SAFE";

export interface SourceObservationMinimal {
  id: string;
  sourceSlug: string;
  sourceTier: number;
  riskClass: IntelRiskClass;
  matchBasis: MatchBasis;
  listIsActive: boolean;
  externalUrl: string | null;
  observedAt: Date | null;
  ingestedAt: Date;
}

export interface MatchTarget {
  type: IntelEntityType;
  value: string;
  chain?: string;
}

export interface IntelSignal {
  ims: number;
  ics: number;
  matchCount: number;
  hasSanction: boolean;
  topRiskClass: IntelRiskClass | null;
  matchBasis: MatchBasis | null;
  sourceSlug: string | null;
  externalUrl: string | null;
  winner: SourceObservationMinimal | null;
}
