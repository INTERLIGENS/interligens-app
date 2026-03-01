import { computeTigerScore, type TigerInput, type TigerResult } from "./engine";
import { buildOnChainEvidence, type EvidenceItem } from "../evidence/builder";

export type ScanNormalized = {
  chain: "ETH" | "SOL";
  is_contract?: boolean;
  rpc_fallback_used?: boolean;
  rpc_down?: boolean;
  rpc_error?: string | null;
  data_source?: string;
  source_detail?: string | null;
  signals?: {
    unlimitedApprovals?: number;
    approvalsTotal?: number;
    unknownPrograms?: number;
    txCount?: number;
    freezeAuthority?: boolean;
    mintAuthorityActive?: boolean;
    mutableMetadata?: boolean;
    confirmedCriticalClaims?: number;
    knownBadAddresses?: number;
    spenders?: string[];
    counterparties?: string[];
  };
  deep?: boolean;
};

export type TigerScanResult = TigerResult & {
  evidence: EvidenceItem[];
  meta: { version: "p1"; chain: string };
};

export function computeTigerScoreFromScan(input: ScanNormalized): TigerScanResult {
  const s = input.signals ?? {};

  // Map ScanNormalized signals -> TigerInput
  const tigerInput: TigerInput = {
    chain: input.chain,
    deep: input.deep,
    unlimitedApprovals: s.unlimitedApprovals,
    approvalsTotal: s.approvalsTotal,
    unknownPrograms: s.unknownPrograms,
    txCount: s.txCount,
    freezeAuthority: s.freezeAuthority,
    mintAuthorityActive: s.mintAuthorityActive,
    mutableMetadata: s.mutableMetadata,
    confirmedCriticalClaims: (s.confirmedCriticalClaims ?? 0) + (s.knownBadAddresses ?? 0),
  };

  const tigerResult = computeTigerScore(tigerInput);

  // Build evidence from same signals
  const evidence = buildOnChainEvidence({
    chain: input.chain,
    data_source: input.data_source as any,
    source_detail: input.source_detail ?? undefined,
    rpc_fallback_used: input.rpc_fallback_used,
    rpc_down: input.rpc_down,
    rpc_error: input.rpc_error ?? undefined,
    spenders: s.spenders,
    counterparties: s.counterparties,
    freezeAuthority: s.freezeAuthority,
    mintAuthority: s.mintAuthorityActive,
    unlimitedCount: s.unlimitedApprovals,
  });

  return {
    ...tigerResult,
    evidence,
    meta: { version: "p1", chain: input.chain },
  };
}
