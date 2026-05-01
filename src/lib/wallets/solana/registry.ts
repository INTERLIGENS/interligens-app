import { SolanaWalletInfo } from './types'
import { phantomSolanaAdapter } from './phantom-adapter'
import { solflareSolanaAdapter } from './solflare-adapter'
import { backpackSolanaAdapter } from './backpack-adapter'

export const SOLANA_WALLETS: SolanaWalletInfo[] = [
  phantomSolanaAdapter,
  solflareSolanaAdapter,
  backpackSolanaAdapter,
]

export function getInstalledWallets(): SolanaWalletInfo[] {
  return SOLANA_WALLETS.filter(w => w.installed)
}

export function getWalletByName(name: string): SolanaWalletInfo | null {
  return SOLANA_WALLETS.find(w => w.name === name) ?? null
}
