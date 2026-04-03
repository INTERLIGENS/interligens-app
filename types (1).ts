// scripts/seed/types.ts

export type PublishStatus    = 'draft' | 'reviewed' | 'published' | 'restricted'
export type WalletChain      = 'SOL' | 'ETH' | 'BSC' | 'TRON' | 'UNKNOWN'
export type WalletConfidence = 'confirmed' | 'high' | 'medium' | 'low' | 'suspected'
export type AliasType        = 'old' | 'secondary' | 'alt' | 'real_name'
export type EvidenceSourceType =
  | 'on_chain_tx'
  | 'social_post'
  | 'leaked_doc'
  | 'public_record'
  | 'investigator_note'
  | 'platform_data'
  | 'archive'

export interface SeedWallet {
  chain:             WalletChain
  address:           string
  label?:            string
  confidence:        WalletConfidence
  attributionSource?: string
  attributionNote?:  string
}

export interface SeedAlias {
  alias: string
  type:  AliasType
}

export interface SeedEvidence {
  sourceType:  EvidenceSourceType
  sourceUrl?:  string
  title:       string
  excerpt?:    string
  observedAt?: string   // ISO date string ex: '2025-03-19'
  dedupKey:    string   // clé stable unique — ne jamais changer après seed
}

export interface SeedTokenLink {
  contractAddress: string
  chain:           WalletChain
  tokenSymbol?:    string
  role:            'promoter' | 'deployer' | 'holder' | 'suspected'
  note?:           string
}

export interface SeedKolProfile {
  handle:       string          // sans @, canonical
  displayName?: string
  platform?:    string          // défaut: 'x'
  bio?:         string
  tier?:        string          // HIGH | MODERATE | RED
  verified?:    boolean
  internalNote?: string         // jamais affiché publiquement
  publishStatus?: PublishStatus  // défaut: 'draft'

  walletAttributionStatus?: string  // none | partial | confirmed
  evidenceStatus?:          string  // none | weak | moderate | strong
  proceedsStatus?:          string  // none | estimated | verified
  editorialStatus?:         string  // pending | reviewed | approved

  aliases?:    SeedAlias[]
  wallets?:    SeedWallet[]
  evidences?:  SeedEvidence[]
  tokenLinks?: SeedTokenLink[]
}
