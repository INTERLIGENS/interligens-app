import { RwaChainFamily } from '@prisma/client'

// ─── CHAIN KEY VALIDATION ─────────────────────────────────────
// Format canonique : "eip155:1", "eip155:137", "solana:mainnet"

const SUPPORTED_CHAIN_KEYS: Record<string, RwaChainFamily> = {
  'eip155:1':       'EVM',   // Ethereum mainnet
  'eip155:137':     'EVM',   // Polygon
  'eip155:42161':   'EVM',   // Arbitrum One
  'eip155:8453':    'EVM',   // Base
  'eip155:56':      'EVM',   // BSC
  'eip155:10':      'EVM',   // Optimism
  'solana:mainnet': 'SOLANA',
  'solana:devnet':  'SOLANA',
}

export function validateChainKey(chainKey: string): string {
  const normalized = chainKey.toLowerCase().trim()
  if (!SUPPORTED_CHAIN_KEYS[normalized]) {
    throw new Error(`Unsupported chainKey: ${chainKey}`)
  }
  return normalized
}

export function detectChainFamily(chainKey: string): RwaChainFamily {
  const normalized = chainKey.toLowerCase().trim()
  const family = SUPPORTED_CHAIN_KEYS[normalized]
  if (!family) throw new Error(`Unknown chainKey: ${chainKey}`)
  return family
}

// ─── ADDRESS NORMALIZATION ────────────────────────────────────

export function normalizeAddress(address: string, chainFamily: RwaChainFamily): string {
  const trimmed = address.trim()

  if (chainFamily === 'EVM') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      throw new Error(`Invalid EVM address: ${address}`)
    }
    return trimmed.toLowerCase()
  }

  if (chainFamily === 'SOLANA') {
    // Base58, case-sensitive, 32-44 chars
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
      throw new Error(`Invalid Solana address: ${address}`)
    }
    return trimmed
  }

  throw new Error(`Unsupported chain family: ${chainFamily}`)
}

// ─── QUICK DETECT (sans chainKey, pour fallback) ──────────────

export function guessChainFamilyFromAddress(address: string): RwaChainFamily | null {
  const trimmed = address.trim()
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return 'EVM'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return 'SOLANA'
  return null
}
