const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
const INFINITE_THRESHOLD = MAX_UINT256 - BigInt(1000000)

export function parseTransactionTarget(tx: unknown, chain: string): string | null {
  if (!tx || typeof tx !== 'object') return null
  const t = tx as Record<string, unknown>
  if (chain.toUpperCase() === 'SOL') {
    const accounts = t.accounts
    if (Array.isArray(accounts) && accounts.length > 0) return String(accounts[0])
    return null
  }
  return typeof t.to === 'string' ? t.to : null
}

export function parseApprovalSpender(tx: unknown): string | null {
  if (!tx || typeof tx !== 'object') return null
  const t = tx as Record<string, unknown>
  if (typeof t.spender === 'string') return t.spender
  const data = t.data
  if (typeof data === 'string' && data.startsWith('0x095ea7b3')) {
    return '0x' + data.slice(34, 74)
  }
  return null
}

export function detectInfiniteApproval(tx: unknown): boolean {
  if (!tx || typeof tx !== 'object') return false
  const t = tx as Record<string, unknown>
  const amount = t.amount ?? t.value
  if (typeof amount === 'string') {
    try {
      return BigInt(amount) >= INFINITE_THRESHOLD
    } catch {
      return false
    }
  }
  return false
}
