// Ledger via WalletConnect — stub adapter

export interface LedgerWcConfig {
  projectId: string
  chains: number[]
}

export function buildLedgerWcUri(config: LedgerWcConfig): string {
  const params = new URLSearchParams({
    projectId: config.projectId,
    chains: config.chains.join(','),
    app: 'INTERLIGENS',
  })
  return `ledgerlive://wc?${params.toString()}`
}

export function isLedgerLiveInstalled(): boolean {
  return false
}
