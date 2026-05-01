export interface SolanaWalletInfo {
  name: string
  icon: string
  installed: boolean
  connect(): Promise<string>
  disconnect(): Promise<void>
}

export interface SolanaAddress {
  address: string
  wallet: string
}
