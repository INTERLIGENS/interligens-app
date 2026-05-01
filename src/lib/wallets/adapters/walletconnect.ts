import { InterligensWalletAdapter, ConnectedWallet } from '../types'

export const walletconnectAdapter: InterligensWalletAdapter = {
  name: 'WalletConnect',
  icon: '/icons/walletconnect.svg',
  supportedChains: ['ETH', 'BASE', 'ARB', 'BSC', 'SOL'],
  isInstalled() { return true },
  async connect(): Promise<ConnectedWallet> { throw new Error('Not implemented — LAB') },
  async disconnect(): Promise<void> { throw new Error('Not implemented — LAB') },
}
