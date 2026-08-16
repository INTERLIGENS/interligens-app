import { computeTigerScore, type TigerInput, type TigerResult } from "./engine";
import { buildOnChainEvidence, type EvidenceItem } from "../evidence/builder";

export type ScanNormalized = {
  chain: "ETH" | "SOL" | "BASE" | "ARBITRUM";
  is_contract?: boolean;
  rpc_fallback_used?: boolean;
  rpc_down?: boolean;
  rpc_error?: string | null;
  /**
   * La répartition des détenteurs n'a pas pu être lue (fournisseur mort,
   * timeout, réponse vide). Sans elle, les signaux de concentration ne peuvent
   * pas se déclencher : le token n'est pas « bien réparti », il est inconnu.
   */
  holders_unavailable?: boolean;
  /** La consultation du renseignement a échoué — à ne pas lire comme « propre ». */
  intelligence_lookup_failed?: boolean;
  data_source?: string;
  source_detail?: string | null;
  // ── Market context for SOL token boosters ──
  scan_type?: "token" | "wallet";
  no_casefile?: boolean;
  mint_address?: string;
  market_url?: string | null;
  pair_age_days?: number | null;
  liquidity_usd?: number | null;
  fdv_usd?: number | null;
  volume_24h_usd?: number | null;
  top10_holder_pct?: number | null;
  scam_lineage?: "CONFIRMED" | "REFERENCED" | "NONE";
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
    scam_lineage: input.scam_lineage,
    // Market boosters
    scan_type: input.scan_type,
    no_casefile: input.no_casefile,
    mint_address: input.mint_address,
    market_url: input.market_url,
    pair_age_days: input.pair_age_days,
    liquidity_usd: input.liquidity_usd,
    fdv_usd: input.fdv_usd,
    volume_24h_usd: input.volume_24h_usd,
    top10_holder_pct: input.top10_holder_pct,

    // ── Le correctif ────────────────────────────────────────────────────────
    //
    // Ces deux drapeaux arrivaient déjà ici (ScanNormalized les déclare depuis
    // toujours) et repartaient vers buildOnChainEvidence — c'est-à-dire vers
    // l'AFFICHAGE — sans jamais entrer dans TigerInput. Le moteur ignorait donc
    // que ses entrées étaient incomplètes, et la confiance rendue restait
    // « Medium » sur un scan où aucun RPC n'avait répondu.
    //
    // Ils gouvernent la CONFIANCE, jamais le score.
    rpc_down: input.rpc_down,
    rpc_fallback_used: input.rpc_fallback_used,
    holders_unavailable: input.holders_unavailable,
    intelligence_lookup_failed: input.intelligence_lookup_failed,
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
