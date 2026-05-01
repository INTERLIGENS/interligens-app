import { InterligensWalletAdapter, ConnectedWallet } from '../types'

export const rabbyAdapter: InterligensWalletAdapter = {
  name: 'Rabby',
  icon: '/icons/rabby.svg',
  supportedChains: ['ETH', 'BASE', 'ARB', 'BSC'],
  isInstalled() {
    if (typeof window === 'undefined') return false
    const eth = (window as unknown as Record<string, unknown>).ethereum as Record<string, unknown> | undefined
    return !!(eth?.isRabby)
  },
  async connect(): Promise<ConnectedWallet> { throw new Error('Not implemented — LAB') },
  async disconnect(): Promise<void> { throw new Error('Not implemented — LAB') },
}
