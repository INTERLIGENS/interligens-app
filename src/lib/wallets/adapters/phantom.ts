import { InterligensWalletAdapter, ConnectedWallet } from '../types'

export const phantomAdapter: InterligensWalletAdapter = {
  name: 'Phantom',
  icon: '/icons/phantom.svg',
  supportedChains: ['SOL', 'ETH'],
  isInstalled() {
    return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).solana
  },
  async connect(): Promise<ConnectedWallet> { throw new Error('Not implemented — LAB') },
  async disconnect(): Promise<void> { throw new Error('Not implemented — LAB') },
  deeplink(address: string) { return `https://phantom.app/ul/browse/${address}` },
}
