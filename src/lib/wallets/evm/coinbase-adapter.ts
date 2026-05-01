import { EvmWalletInfo, EthProvider } from './types'

function getCoinbase(): EthProvider | null {
  if (typeof window === 'undefined') return null
  const eth = (window as unknown as Record<string, unknown>).ethereum as EthProvider | undefined
  if (!eth?.isCoinbaseWallet) return null
  return eth
}

export const coinbaseEvmAdapter: EvmWalletInfo = {
  name: 'Coinbase Wallet',
  icon: '/icons/coinbase.svg',
  get installed() { return getCoinbase() !== null },
  async connect(): Promise<string> {
    const provider = getCoinbase()
    if (!provider) throw new Error('Coinbase Wallet not installed')
    const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
    if (!accounts[0]) throw new Error('No accounts returned')
    return accounts[0]
  },
  async disconnect(): Promise<void> {},
  async getChainId(): Promise<string> {
    const provider = getCoinbase()
    if (!provider) throw new Error('Coinbase Wallet not installed')
    return provider.request({ method: 'eth_chainId' }) as Promise<string>
  },
}
