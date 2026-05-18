// src/lib/ingestion/types.ts
// Universal ingestion pipeline — single entry point for all data sources.

import type { WalletMatchResult } from "@/lib/kol/identity";

export type IngestionSource =
  | "wallet_address"
  | "twitter_handle"
  | "csv_arkham"
  | "json_casefile"
  | "manual";

export type IngestionStatus =
  | "pending"
  | "normalized"
  | "matched"
  | "computed"
  | "published"
  | "failed";

export type NormalizedEntity = {
  type: "wallet" | "handle" | "proceeds_event" | "casefile";
  chain: string | null;
  address: string | null;
  handle: string | null;
  amountUsd: number | null;
  eventDate: Date | null;
  rawData: Record<string, unknown>;
};

export type IngestionJob = {
  id: string;
  source: IngestionSource;
  rawInput: string;
  normalizedEntity: NormalizedEntity | null;
  resolveResult: WalletMatchResult | null;
  status: IngestionStatus;
  sourceChecksum: string;
  dryRun: boolean;
  errorReport: string | null;
  manualReviewRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
};
