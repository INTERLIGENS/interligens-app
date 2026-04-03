// scripts/seed/types.ts

export interface SeedKolProfile {
  handle: string
  displayName?: string
  platform?: string
  bio?: string
  tier?: string
  verified?: boolean
  publishStatus?: string
  internalNote?: string
  walletAttributionStatus?: string
  evidenceStatus?: string
  proceedsStatus?: string
  editorialStatus?: string
  aliases?: { alias: string; type: string }[]
  wallets?: {
    address: string
    chain: string
    label?: string
    confidence?: string
    attributionSource?: string
    attributionNote?: string
  }[]
  evidences?: {
    sourceType: string
    title: string
    dedupKey: string
    excerpt?: string
    sourceUrl?: string
    observedAt?: string
  }[]
  tokenLinks?: {
    contractAddress: string
    chain: string
    tokenSymbol?: string
    role: string
    note?: string
  }[]
}
