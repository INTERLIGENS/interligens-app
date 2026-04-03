// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Source Ingestor Raw Output
// Every source adapter returns SourceRaw[]. The ingestor normalizes
// and upserts these into CanonicalEntity + SourceObservation rows.
// ─────────────────────────────────────────────────────────────────────────────

import type { IntelEntityType, IntelRiskClass, MatchBasis } from "../types";

export interface SourceRaw {
  sourceSlug: string;
  sourceTier: 1 | 2 | 3;
  entityType: IntelEntityType;
  value: string; // already normalized
  chain?: string;
  riskClass: IntelRiskClass;
  matchBasis: MatchBasis;
  label?: string;
  externalId?: string;
  externalUrl?: string;
  jurisdiction?: string;
  listType?: string;
  observedAt?: Date;
  meta?: Record<string, unknown>;
}
