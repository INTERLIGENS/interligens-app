export interface ConnectedWallet {
  address: string
  chain: string
  provider: unknown
  name: string
}

export interface WalletAccount {
  address: string
  chain: string
  label?: string
}

export interface PreflightInput {
  targetAddress: string
  chain: string
  action: string
}

export interface PreflightResult {
  score: number
  tier: string
  allow: boolean
  warning?: string
  signals: string[]
}

export interface InterligensWalletAdapter {
  name: string
  icon: string
  supportedChains: string[]
  isInstalled(): boolean
  connect(): Promise<ConnectedWallet>
  disconnect(): Promise<void>
  deeplink?(address: string): string | null
}
