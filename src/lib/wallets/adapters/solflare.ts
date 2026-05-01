import { InterligensWalletAdapter, ConnectedWallet } from '../types'

export const solflareAdapter: InterligensWalletAdapter = {
  name: 'Solflare',
  icon: '/icons/solflare.svg',
  supportedChains: ['SOL'],
  isInstalled() {
    return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).solflare
  },
  async connect(): Promise<ConnectedWallet> { throw new Error('Not implemented — LAB') },
  async disconnect(): Promise<void> { throw new Error('Not implemented — LAB') },
}
