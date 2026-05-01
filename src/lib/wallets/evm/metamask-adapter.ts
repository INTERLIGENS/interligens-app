import { EvmWalletInfo, EthProvider } from './types'

function getMetaMask(): EthProvider | null {
  if (typeof window === 'undefined') return null
  const eth = (window as unknown as Record<string, unknown>).ethereum as EthProvider | undefined
  if (!eth?.isMetaMask) return null
  return eth
}

export const metamaskEvmAdapter: EvmWalletInfo = {
  name: 'MetaMask',
  icon: '/icons/metamask.svg',
  get installed() { return getMetaMask() !== null },
  async connect(): Promise<string> {
    const provider = getMetaMask()
    if (!provider) throw new Error('MetaMask not installed')
    const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
    if (!accounts[0]) throw new Error('No accounts returned')
    return accounts[0]
  },
  async disconnect(): Promise<void> {},
  async getChainId(): Promise<string> {
    const provider = getMetaMask()
    if (!provider) throw new Error('MetaMask not installed')
    return provider.request({ method: 'eth_chainId' }) as Promise<string>
  },
}
