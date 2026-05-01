import { describe, it, expect } from 'vitest'
import { parseTransactionTarget, parseApprovalSpender, detectInfiniteApproval } from '../signature-parser'

describe('parseTransactionTarget', () => {
  it('returns to field for EVM tx', () => {
    expect(parseTransactionTarget({ to: '0xabc' }, 'ETH')).toBe('0xabc')
  })
  it('returns first account for SOL tx', () => {
    expect(parseTransactionTarget({ accounts: ['SolAddr1', 'SolAddr2'] }, 'SOL')).toBe('SolAddr1')
  })
  it('returns null for empty tx', () => {
    expect(parseTransactionTarget(null, 'ETH')).toBeNull()
    expect(parseTransactionTarget({}, 'ETH')).toBeNull()
  })
})

describe('parseApprovalSpender', () => {
  it('returns spender field directly', () => {
    expect(parseApprovalSpender({ spender: '0xspender' })).toBe('0xspender')
  })
  it('returns null for non-approval tx', () => {
    expect(parseApprovalSpender({ data: '0xdeadbeef' })).toBeNull()
  })
  it('returns null for null input', () => {
    expect(parseApprovalSpender(null)).toBeNull()
  })
})

describe('detectInfiniteApproval', () => {
  it('detects max uint256 as infinite', () => {
    const MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
    expect(detectInfiniteApproval({ amount: MAX })).toBe(true)
  })
  it('returns false for small amount', () => {
    expect(detectInfiniteApproval({ amount: '1000000' })).toBe(false)
  })
  it('returns false for null', () => {
    expect(detectInfiniteApproval(null)).toBe(false)
  })
})
