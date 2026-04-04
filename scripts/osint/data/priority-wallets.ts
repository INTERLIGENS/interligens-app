import type { WalletAttributionInput } from '../walletAttribution'

export const priorityWallets: WalletAttributionInput[] = [
  // ═══════════════════════════════════════════════════════════════
  // bkokoski — 3 SOL family wallets from BOTIFY leaked doc
  // Direct personal wallet unknown, these are F&F cluster
  // ═══════════════════════════════════════════════════════════════
  {
    kolHandle: 'bkokoski',
    chain: 'SOL',
    address: '5ed7HUrYWS8h7EwM6wBpCvUHP4jc5McWYcL2yX4QimQj',
    label: 'Mom wallet — received GHOST + BOTIFY insider supply, sold',
    confidence: 'high',
    attributionSource: 'leaked_doc',
    attributionNote: 'BOTIFY internal doc confirms F&F wallet assignment. Family cluster member.',
    isPubliclyUsable: true,
    attributionStatus: 'confirmed',
  },
  {
    kolHandle: 'bkokoski',
    chain: 'SOL',
    address: 'HSueXrabQVABdHezbQ5Q4UbgLTx4Nc6VqyX5R88zzxmz',
    label: 'Dad wallet — received insider supply, dumped',
    confidence: 'high',
    attributionSource: 'leaked_doc',
    attributionNote: 'BOTIFY internal doc confirms F&F wallet assignment. Family cluster member.',
    isPubliclyUsable: true,
    attributionStatus: 'confirmed',
  },
  {
    kolHandle: 'bkokoski',
    chain: 'SOL',
    address: 'FzDXp1AqPhmwqkXjeFeTohbVcDEbJM9bjDcH9DPN4nEc',
    label: 'Carter family — received GHOST + BOTIFY, sold',
    confidence: 'high',
    attributionSource: 'leaked_doc',
    attributionNote: 'BOTIFY internal doc confirms F&F wallet assignment. Family cluster member.',
    isPubliclyUsable: true,
    attributionStatus: 'confirmed',
  },

  // ═══════════════════════════════════════════════════════════════
  // GordonGekko — EVM wallet confirmed, SOL wallets in DB
  // Cashout routes documented: 245 SOL→Binance + 420 SOL→KuCoin2
  // ═══════════════════════════════════════════════════════════════
  {
    kolHandle: 'GordonGekko',
    chain: 'ETH',
    address: '0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41',
    label: 'Hyperliquid — confirmed',
    confidence: 'confirmed',
    attributionSource: 'on-chain analysis',
    attributionNote: 'Same-actor proof: 55 SOL transfer wallet1→wallet2. Cashout routes: 245 SOL→Binance + 420 SOL→KuCoin2.',
    isPubliclyUsable: true,
    attributionStatus: 'confirmed',
  },
  {
    kolHandle: 'GordonGekko',
    chain: 'SOL',
    address: 'Eu8i6rpMPXyg5NaEY23qEbFeMhrs953FdqxYxweXm24J',
    label: 'Gordon 1 — SOL',
    confidence: 'high',
    attributionSource: 'on-chain analysis',
    attributionNote: 'Linked via same-actor proof to confirmed EVM wallet.',
    isPubliclyUsable: true,
    attributionStatus: 'confirmed',
  },
  {
    kolHandle: 'GordonGekko',
    chain: 'SOL',
    address: '4yscBpfbcB1wmviW4854CYqVz1KgjKoKRpg4uf5XSLe3',
    label: 'Gordon 2 — SOL',
    confidence: 'high',
    attributionSource: 'on-chain analysis',
    attributionNote: 'Linked via same-actor proof to confirmed EVM wallet.',
    isPubliclyUsable: true,
    attributionStatus: 'confirmed',
  },
  {
    kolHandle: 'GordonGekko',
    chain: 'SOL',
    address: '3X9RErem7uNhqdYbJrM5bTvtcsqbbZB15tkXxqcnaqA6',
    label: 'Gordon 3 — SOL',
    confidence: 'high',
    attributionSource: 'on-chain analysis',
    attributionNote: 'Linked via same-actor proof to confirmed EVM wallet.',
    isPubliclyUsable: true,
    attributionStatus: 'confirmed',
  },

  // ═══════════════════════════════════════════════════════════════
  // DonWedge — No wallet confirmed, BOTIFY cluster member
  // Placeholder for OSINT tracking
  // ═══════════════════════════════════════════════════════════════
  {
    kolHandle: 'DonWedge',
    chain: 'SOL',
    address: 'PENDING_OSINT_DonWedge',
    label: 'Wallet OSINT pending',
    confidence: 'suspected',
    attributionSource: 'cluster_analysis',
    attributionNote: 'Wallet OSINT pending — BOTIFY cluster member. No confirmed address yet.',
    isPubliclyUsable: false,
    attributionStatus: 'review',
  },

  // ═══════════════════════════════════════════════════════════════
  // planted (Djordje Stupar) — No wallet confirmed
  // Placeholder for OSINT tracking
  // ═══════════════════════════════════════════════════════════════
  {
    kolHandle: 'planted',
    chain: 'SOL',
    address: 'PENDING_OSINT_planted',
    label: 'Wallet OSINT pending',
    confidence: 'suspected',
    attributionSource: 'cluster_analysis',
    attributionNote: 'Wallet OSINT pending — BOTIFY voice admission documented. No confirmed address yet.',
    isPubliclyUsable: false,
    attributionStatus: 'review',
  },
]

// Profiles that need walletAttributionStrength sync after merge
export const affectedProfiles = [
  'bkokoski',
  'GordonGekko',
  'DonWedge',
  'planted',
  'sxyz500',
]
