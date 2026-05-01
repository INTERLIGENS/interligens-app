export interface EvmWalletInfo {
  name: string
  icon: string
  installed: boolean
  connect(): Promise<string>
  disconnect(): Promise<void>
  getChainId(): Promise<string>
}

export interface Eip6963ProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export interface Eip6963Provider {
  info: Eip6963ProviderInfo
  provider: EthProvider
}

export interface EthProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  isMetaMask?: boolean
  isRabby?: boolean
  isCoinbaseWallet?: boolean
  isBraveWallet?: boolean
  isTrust?: boolean
}
