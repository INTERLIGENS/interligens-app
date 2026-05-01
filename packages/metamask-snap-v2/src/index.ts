// MetaMask Snap v2 — INTERLIGENS risk preflight
// No custody. No signing. Read-only transaction insight.

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
const INFINITE_THRESHOLD = MAX_UINT256 - BigInt(1_000_000)

interface SnapTransaction {
  to?: string
  from?: string
  data?: string
  value?: string
}

interface InsightPanel {
  type: 'panel'
  children: InsightComponent[]
}

type InsightComponent =
  | { type: 'heading'; value: string }
  | { type: 'text'; value: string }
  | { type: 'divider' }

function detectInfiniteApproval(data: string): boolean {
  if (!data.startsWith('0x095ea7b3')) return false
  const amountHex = data.slice(74)
  try {
    return BigInt('0x' + amountHex) >= INFINITE_THRESHOLD
  } catch {
    return false
  }
}

function parseApprovalSpender(data: string): string | null {
  if (!data.startsWith('0x095ea7b3')) return null
  return '0x' + data.slice(34, 74)
}

function buildWarningPanel(warnings: string[]): InsightPanel {
  const children: InsightComponent[] = [
    { type: 'heading', value: 'INTERLIGENS Risk Preflight' },
    { type: 'divider' },
  ]
  for (const w of warnings) {
    children.push({ type: 'text', value: w })
  }
  if (warnings.length === 0) {
    children.push({ type: 'text', value: 'No risk signals detected.' })
  }
  return { type: 'panel', children }
}

export async function onTransaction({ transaction }: { transaction: SnapTransaction }): Promise<{ content: InsightPanel }> {
  const warnings: string[] = []

  if (transaction.data && transaction.data.length > 2) {
    if (detectInfiniteApproval(transaction.data)) {
      warnings.push('WARNING: Infinite token approval detected. This grants unlimited spending to the spender contract.')
      const spender = parseApprovalSpender(transaction.data)
      if (spender) {
        warnings.push(`Spender: ${spender}`)
      }
    }
  }

  if (transaction.to) {
    warnings.push(`Target contract: ${transaction.to}`)
    warnings.push('INTERLIGENS score lookup: not available in Snap context. Review on interligens.com')
  }

  return { content: buildWarningPanel(warnings) }
}
