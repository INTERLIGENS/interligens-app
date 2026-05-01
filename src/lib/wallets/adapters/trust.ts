import { InterligensWalletAdapter, ConnectedWallet } from '../types'

export const trustAdapter: InterligensWalletAdapter = {
  name: 'Trust',
  icon: '/icons/trust.svg',
  supportedChains: ['ETH', 'BSC', 'SOL'],
  isInstalled() {
    if (typeof window === 'undefined') return false
    const eth = (window as unknown as Record<string, unknown>).ethereum as Record<string, unknown> | undefined
    return !!(eth?.isTrust)
  },
  async connect(): Promise<ConnectedWallet> { throw new Error('Not implemented — LAB') },
  async disconnect(): Promise<void> { throw new Error('Not implemented — LAB') },
}
