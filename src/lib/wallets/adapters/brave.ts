import { InterligensWalletAdapter, ConnectedWallet } from '../types'

export const braveAdapter: InterligensWalletAdapter = {
  name: 'Brave',
  icon: '/icons/brave.svg',
  supportedChains: ['ETH', 'SOL'],
  isInstalled() {
    if (typeof window === 'undefined') return false
    const eth = (window as unknown as Record<string, unknown>).ethereum as Record<string, unknown> | undefined
    return !!(eth?.isBraveWallet)
  },
  async connect(): Promise<ConnectedWallet> { throw new Error('Not implemented — LAB') },
  async disconnect(): Promise<void> { throw new Error('Not implemented — LAB') },
}
