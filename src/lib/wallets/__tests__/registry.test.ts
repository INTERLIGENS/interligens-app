import { describe, it, expect, beforeEach } from 'vitest'
import { registerAdapter, getAdapter, listAdapters } from '../registry'
import { InterligensWalletAdapter, ConnectedWallet } from '../types'

const makeAdapter = (name: string): InterligensWalletAdapter => ({
  name,
  icon: `/icons/${name}.svg`,
  supportedChains: ['ETH'],
  isInstalled: () => false,
  connect: async (): Promise<ConnectedWallet> => { throw new Error('Not implemented — LAB') },
  disconnect: async () => { throw new Error('Not implemented — LAB') },
})

describe('registry', () => {
  beforeEach(() => {
    // clear by re-importing won't work; use fresh instances per test
  })

  it('registers and retrieves an adapter', () => {
    const a = makeAdapter('TestWallet')
    registerAdapter(a)
    expect(getAdapter('TestWallet')).toBe(a)
  })

  it('returns null for unknown adapter', () => {
    expect(getAdapter('NonExistent_XYZ')).toBeNull()
  })

  it('listAdapters returns registered adapters', () => {
    const a = makeAdapter('ListTest')
    registerAdapter(a)
    const list = listAdapters()
    expect(list.some(x => x.name === 'ListTest')).toBe(true)
  })

  it('overwrites adapter with same name', () => {
    const a1 = makeAdapter('DupWallet')
    const a2 = makeAdapter('DupWallet')
    registerAdapter(a1)
    registerAdapter(a2)
    expect(getAdapter('DupWallet')).toBe(a2)
  })
})
