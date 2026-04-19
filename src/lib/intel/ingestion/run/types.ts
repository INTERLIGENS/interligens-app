/** Shared result contract for every P0 ingestor. */
export type IngestSummary = {
  source: string;
  fetched: number;
  normalised: number;
  upserted: number;
  updated: number;
  skipped: number;
  errors: number;
  durationMs: number;
  /** Optional per-source note — e.g. branch probed, limitations. */
  note?: string;
};

export function emptySummary(source: string): IngestSummary {
  return {
    source,
    fetched: 0,
    normalised: 0,
    upserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
  };
}
