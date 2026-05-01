import { SolanaWalletInfo } from './types'

// Backpack wallet adapter — placeholder
// Backpack uses window.xnft.solana provider
interface BackpackProvider {
  isBackpack: boolean
  publicKey: { toString(): string } | null
  connect(): Promise<{ publicKey: { toString(): string } }>
  disconnect(): Promise<void>
}

function getBackpack(): BackpackProvider | null {
  if (typeof window === 'undefined') return null
  const xnft = (window as unknown as Record<string, unknown>).xnft as Record<string, unknown> | undefined
  const bp = xnft?.solana as BackpackProvider | undefined
  return bp?.isBackpack ? bp : null
}

export const backpackSolanaAdapter: SolanaWalletInfo = {
  name: 'Backpack',
  icon: '/icons/backpack.svg',
  get installed() { return getBackpack() !== null },
  async connect(): Promise<string> {
    const provider = getBackpack()
    if (!provider) throw new Error('Backpack not installed — LAB placeholder')
    const resp = await provider.connect()
    return resp.publicKey.toString()
  },
  async disconnect(): Promise<void> {
    const provider = getBackpack()
    if (!provider) return
    await provider.disconnect()
  },
}
