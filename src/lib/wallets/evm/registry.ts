import { EvmWalletInfo } from './types'
import { metamaskEvmAdapter } from './metamask-adapter'
import { rabbyEvmAdapter } from './rabby-adapter'
import { coinbaseEvmAdapter } from './coinbase-adapter'
import { braveEvmAdapter } from './brave-adapter'

export const EVM_WALLETS: EvmWalletInfo[] = [
  rabbyEvmAdapter,
  metamaskEvmAdapter,
  coinbaseEvmAdapter,
  braveEvmAdapter,
]

export function getInstalledEvmWallets(): EvmWalletInfo[] {
  return EVM_WALLETS.filter(w => w.installed)
}

export function getEvmWalletByName(name: string): EvmWalletInfo | null {
  return EVM_WALLETS.find(w => w.name === name) ?? null
}
