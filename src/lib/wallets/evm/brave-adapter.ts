import { EvmWalletInfo, EthProvider } from './types'

function getBrave(): EthProvider | null {
  if (typeof window === 'undefined') return null
  const eth = (window as unknown as Record<string, unknown>).ethereum as EthProvider | undefined
  if (!eth?.isBraveWallet) return null
  return eth
}

export const braveEvmAdapter: EvmWalletInfo = {
  name: 'Brave Wallet',
  icon: '/icons/brave.svg',
  get installed() { return getBrave() !== null },
  async connect(): Promise<string> {
    const provider = getBrave()
    if (!provider) throw new Error('Brave Wallet not available')
    const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
    if (!accounts[0]) throw new Error('No accounts returned')
    return accounts[0]
  },
  async disconnect(): Promise<void> {},
  async getChainId(): Promise<string> {
    const provider = getBrave()
    if (!provider) throw new Error('Brave Wallet not available')
    return provider.request({ method: 'eth_chainId' }) as Promise<string>
  },
}
