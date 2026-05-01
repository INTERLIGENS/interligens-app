import { SolanaWalletInfo } from './types'

interface PhantomProvider {
  isPhantom: boolean
  publicKey: { toString(): string } | null
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>
  disconnect(): Promise<void>
}

function getPhantom(): PhantomProvider | null {
  if (typeof window === 'undefined') return null
  const sol = (window as unknown as Record<string, unknown>).solana as PhantomProvider | undefined
  return sol?.isPhantom ? sol : null
}

export const phantomSolanaAdapter: SolanaWalletInfo = {
  name: 'Phantom',
  icon: '/icons/phantom.svg',
  get installed() { return getPhantom() !== null },
  async connect(): Promise<string> {
    const provider = getPhantom()
    if (!provider) throw new Error('Phantom not installed')
    const resp = await provider.connect()
    return resp.publicKey.toString()
  },
  async disconnect(): Promise<void> {
    const provider = getPhantom()
    if (!provider) return
    await provider.disconnect()
  },
}
