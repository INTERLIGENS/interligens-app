type SupportedChain = 'SOL' | 'ETH' | 'BASE' | 'ARB' | 'TRON' | 'BSC'

const chainMap: Record<string, SupportedChain> = {
  solana: 'SOL', sol: 'SOL',
  ethereum: 'ETH', eth: 'ETH', '0x1': 'ETH', '1': 'ETH',
  base: 'BASE', '0x2105': 'BASE', '8453': 'BASE',
  arbitrum: 'ARB', arb: 'ARB', '0xa4b1': 'ARB', '42161': 'ARB',
  tron: 'TRON', trx: 'TRON',
  bsc: 'BSC', bnb: 'BSC', '0x38': 'BSC', '56': 'BSC',
}

export function normalizeChain(input: string): SupportedChain {
  const normalized = chainMap[input.toLowerCase()]
  if (!normalized) throw new Error(`Unknown chain: ${input}`)
  return normalized
}

export function isValidAddress(address: string, chain: string): boolean {
  const c = chain.toUpperCase()
  if (c === 'SOL') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)
  if (c === 'TRON') return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}
