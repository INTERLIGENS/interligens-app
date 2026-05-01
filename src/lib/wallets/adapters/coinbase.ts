import { InterligensWalletAdapter, ConnectedWallet } from '../types'

export const coinbaseAdapter: InterligensWalletAdapter = {
  name: 'Coinbase',
  icon: '/icons/coinbase.svg',
  supportedChains: ['ETH', 'BASE'],
  isInstalled() {
    if (typeof window === 'undefined') return false
    const eth = (window as unknown as Record<string, unknown>).ethereum as Record<string, unknown> | undefined
    return !!(eth?.isCoinbaseWallet)
  },
  async connect(): Promise<ConnectedWallet> { throw new Error('Not implemented — LAB') },
  async disconnect(): Promise<void> { throw new Error('Not implemented — LAB') },
}
