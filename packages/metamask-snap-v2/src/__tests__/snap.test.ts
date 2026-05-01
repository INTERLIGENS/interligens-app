import { describe, it, expect } from 'vitest'
import { onTransaction } from '../index'

describe('onTransaction', () => {
  it('returns panel with no warnings for plain transfer', async () => {
    const result = await onTransaction({
      transaction: { to: '0xabc', from: '0xdef', data: '0x', value: '0x1' },
    })
    expect(result.content.type).toBe('panel')
    expect(result.content.children.some(c => c.type === 'text' && 'value' in c && (c.value as string).includes('No risk'))).toBe(true)
  })

  it('detects infinite approval', async () => {
    const maxHex = 'f'.repeat(64)
    const fakeApprovalData = '0x095ea7b3' + '0'.repeat(24) + 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' + maxHex
    const result = await onTransaction({
      transaction: { to: '0xtoken', from: '0xuser', data: fakeApprovalData },
    })
    const texts = result.content.children.filter(c => c.type === 'text').map(c => (c as { type: 'text'; value: string }).value)
    expect(texts.some(t => t.includes('Infinite'))).toBe(true)
  })

  it('extracts spender from approval data', async () => {
    const maxHex = 'f'.repeat(64)
    const spenderPadded = '000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    const fakeApprovalData = '0x095ea7b3' + spenderPadded + maxHex
    const result = await onTransaction({
      transaction: { to: '0xtoken', from: '0xuser', data: fakeApprovalData },
    })
    const texts = result.content.children.filter(c => c.type === 'text').map(c => (c as { type: 'text'; value: string }).value)
    expect(texts.some(t => t.includes('0xdeadbeef'))).toBe(true)
  })

  it('includes target contract in output', async () => {
    const result = await onTransaction({
      transaction: { to: '0xcontract123', from: '0xuser' },
    })
    const texts = result.content.children.filter(c => c.type === 'text').map(c => (c as { type: 'text'; value: string }).value)
    expect(texts.some(t => t.includes('0xcontract123'))).toBe(true)
  })

  it('handles missing data field gracefully', async () => {
    const result = await onTransaction({
      transaction: { to: '0xabc', from: '0xdef' },
    })
    expect(result.content.type).toBe('panel')
  })
})
