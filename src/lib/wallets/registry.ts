import { InterligensWalletAdapter } from './types'

const adapters = new Map<string, InterligensWalletAdapter>()

export function registerAdapter(adapter: InterligensWalletAdapter): void {
  adapters.set(adapter.name, adapter)
}

export function getAdapter(name: string): InterligensWalletAdapter | null {
  return adapters.get(name) ?? null
}

export function listAdapters(): InterligensWalletAdapter[] {
  return Array.from(adapters.values())
}
