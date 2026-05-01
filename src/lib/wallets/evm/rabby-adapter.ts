import { EvmWalletInfo, EthProvider } from './types'

// EIP-6963 compatible — Rabby injects window.ethereum with isRabby flag
function getRabby(): EthProvider | null {
  if (typeof window === 'undefined') return null
  const eth = (window as unknown as Record<string, unknown>).ethereum as EthProvider | undefined
  if (!eth?.isRabby) return null
  return eth
}

export const rabbyEvmAdapter: EvmWalletInfo = {
  name: 'Rabby',
  icon: '/icons/rabby.svg',
  get installed() { return getRabby() !== null },
  async connect(): Promise<string> {
    const provider = getRabby()
    if (!provider) throw new Error('Rabby not installed')
    const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
    if (!accounts[0]) throw new Error('No accounts returned')
    return accounts[0]
  },
  async disconnect(): Promise<void> {},
  async getChainId(): Promise<string> {
    const provider = getRabby()
    if (!provider) throw new Error('Rabby not installed')
    return provider.request({ method: 'eth_chainId' }) as Promise<string>
  },
}
