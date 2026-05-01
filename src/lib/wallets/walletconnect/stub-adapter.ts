import { WcAdapter, WcSession } from './types'

// Stub WalletConnect adapter — requires @walletconnect/modal or AppKit in production
// This is a LAB placeholder to define the interface before the full integration

export const walletConnectStubAdapter: WcAdapter = {
  name: 'WalletConnect',
  icon: '/icons/walletconnect.svg',
  supportedChains: ['ETH', 'BASE', 'ARB', 'BSC', 'SOL'],
  async connect(): Promise<WcSession> {
    throw new Error('Not implemented — requires @walletconnect/modal or AppKit. LAB placeholder.')
  },
  async disconnect(_topic: string): Promise<void> {
    throw new Error('Not implemented — LAB placeholder.')
  },
  async sendRequest(_topic: string, _method: string, _params: unknown[]): Promise<unknown> {
    throw new Error('Not implemented — LAB placeholder.')
  },
}
