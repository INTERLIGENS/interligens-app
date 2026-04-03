// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Public API
// ─────────────────────────────────────────────────────────────────────────────

export { matchEntity, lookupValue } from "./matcher";
export { ingestSource, ingestAll } from "./ingest";
export { SOURCES } from "./sources/registry";
export type { IngestResult } from "./ingest";
export type { SourceSlug } from "./sources/registry";
export type {
  IntelEntityType,
  IntelRiskClass,
  MatchBasis,
  IntelDisplaySafety,
  IntelSignal,
  MatchTarget,
  SourceObservationMinimal,
} from "./types";
