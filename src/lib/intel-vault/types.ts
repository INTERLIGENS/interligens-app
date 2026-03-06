// src/lib/intel-vault/types.ts
export type Chain = "ethereum"|"solana"|"bsc"|"polygon"|"arbitrum"|"base"|"other";
export type LabelType =
  | "scam"|"phishing"|"drainer"|"exploiter"|"insider"
  | "kol"|"whale"|"airdrop_target"|"cluster_member"|"incident_related"|"other";
export type Confidence = "low"|"medium"|"high";
export type Visibility = "internal_only"|"sources_on_request";
export type TosRisk = "low"|"medium"|"high";

export interface NormalizedRow {
  chain: Chain;
  address: string;
  labelType: LabelType;
  label: string;
  confidence: Confidence;
  entityName?: string;
  sourceName: string;
  sourceUrl?: string;
  evidence?: string;
  visibility: Visibility;
  license?: string;
  tosRisk: TosRisk;
}

export interface ParseOptions {
  defaultChain?: Chain;
  defaultLabelType?: LabelType;
  label?: string;
  sourceName?: string;
  sourceUrl?: string;
  visibility?: Visibility;
  confidence?: Confidence;
}

export interface ParseResult {
  rows: NormalizedRow[];
  totalScanned: number;
  warnings: string[];
}
