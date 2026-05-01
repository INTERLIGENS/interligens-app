import { InterligensWalletAdapter, ConnectedWallet } from '../types'

export const metamaskAdapter: InterligensWalletAdapter = {
  name: 'MetaMask',
  icon: '/icons/metamask.svg',
  supportedChains: ['ETH', 'BASE', 'ARB', 'BSC'],
  isInstalled() {
    return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).ethereum
  },
  async connect(): Promise<ConnectedWallet> { throw new Error('Not implemented — LAB') },
  async disconnect(): Promise<void> { throw new Error('Not implemented — LAB') },
}
