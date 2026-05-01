import { InterligensWalletAdapter, ConnectedWallet } from '../types'

export const ledgerAdapter: InterligensWalletAdapter = {
  name: 'Ledger',
  icon: '/icons/ledger.svg',
  supportedChains: ['ETH', 'SOL', 'BASE', 'ARB'],
  isInstalled() { return true },
  async connect(): Promise<ConnectedWallet> { throw new Error('Not implemented — LAB') },
  async disconnect(): Promise<void> { throw new Error('Not implemented — LAB') },
}
