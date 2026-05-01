import { SolanaWalletInfo } from './types'

interface SolflareProvider {
  isSolflare: boolean
  publicKey: { toString(): string } | null
  connect(): Promise<void>
  disconnect(): Promise<void>
}

function getSolflare(): SolflareProvider | null {
  if (typeof window === 'undefined') return null
  const sf = (window as unknown as Record<string, unknown>).solflare as SolflareProvider | undefined
  return sf?.isSolflare ? sf : null
}

export const solflareSolanaAdapter: SolanaWalletInfo = {
  name: 'Solflare',
  icon: '/icons/solflare.svg',
  get installed() { return getSolflare() !== null },
  async connect(): Promise<string> {
    const provider = getSolflare()
    if (!provider) throw new Error('Solflare not installed')
    await provider.connect()
    if (!provider.publicKey) throw new Error('Solflare connection failed')
    return provider.publicKey.toString()
  },
  async disconnect(): Promise<void> {
    const provider = getSolflare()
    if (!provider) return
    await provider.disconnect()
  },
}
