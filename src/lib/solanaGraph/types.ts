// src/lib/solanaGraph/types.ts
export type HopsDepth = 1 | 2;
export type DaysWindow = 14 | 30 | 90;
export type Priority = "HIGH" | "NORMAL";
export type ClusterStrength = "HIGH" | "MED" | "LOW";
export type EvidenceStatus = "CORROBORATED" | "REFERENCED" | "PARTIAL";
export type JobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";
export type InvestigationEntryType = "wallet" | "mint";

export interface HeliusTx {
  signature: string; timestamp: number; type: string; source: string;
  fee: number; feePayer: string;
  accountData: Array<{ account: string; nativeBalanceChange: number; tokenBalanceChanges: TokenBalanceChange[] }>;
  tokenTransfers: TokenTransfer[]; nativeTransfers: NativeTransfer[];
  events?: { swap?: SwapEvent };
}
export interface TokenBalanceChange { userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number }; }
export interface TokenTransfer { fromUserAccount: string; toUserAccount: string; mint: string; tokenAmount: number; }
export interface NativeTransfer { fromUserAccount: string; toUserAccount: string; amount: number; }
export interface SwapEvent { nativeInput?: { account: string; amount: string }; nativeOutput?: { account: string; amount: string }; tokenInputs?: Array<{ userAccount: string; mint: string; rawTokenAmount: { tokenAmount: string } }>; tokenOutputs?: Array<{ userAccount: string; mint: string; rawTokenAmount: { tokenAmount: string } }>; }
export interface HeliusTokenAccount { address: string; mint: string; owner: string; amount: number; delegated_amount: number; frozen: boolean; }
export interface SeedWallet { address: string; source: "top_holder" | "lp_provider" | "deployer" | "initial_buyer"; token_balance?: number; first_seen_ts?: number; }
export interface ClusterProof { type: "shared_funder" | "co_trading" | "lp_overlap"; tx_signature: string; timestamp: number; detail: string; }
export interface Cluster { id: string; label: string; strength: ClusterStrength; heuristic: "shared_funder" | "co_trading" | "lp_overlap"; wallets: string[]; proofs: ClusterProof[]; status: EvidenceStatus; }
export interface RelatedProject { mint: string; symbol?: string; name?: string; link_score: number; shared_wallets: number; shared_wallet_addresses: string[]; signals: string[]; status: EvidenceStatus; }
export interface GraphLimits { max_seeds: 50; tx_per_wallet: 300; max_expanded_hop1: 50; max_expanded_hop2: 25; seeds_used: number; wallets_expanded_hop1: number; wallets_expanded_hop2: number; tx_fetched: number; }
export interface GraphReport { version: "1.0"; generated_at: string; computed_at?: string; query: { mint?: string; wallet?: string; hops: HopsDepth; days: DaysWindow }; provider: { name: "Helius"; tier: "developer"; note: string }; limits: GraphLimits; seed_wallets: SeedWallet[]; clusters: Cluster[]; related_projects: RelatedProject[]; overall_status: EvidenceStatus; cache_hit: boolean; }
export interface GraphJob { id: string; created_at: string; started_at?: string; completed_at?: string; status: JobStatus; priority: Priority; query: { mint?: string; wallet?: string; hops: HopsDepth; days: DaysWindow }; result?: GraphReport; error?: string; progress?: number; }
export interface InvestigationEntry { id: string; type: InvestigationEntryType; value: string; priority: Priority; note?: string; added_at: string; }
export interface PriorityList { entries: InvestigationEntry[]; updated_at: string; }
