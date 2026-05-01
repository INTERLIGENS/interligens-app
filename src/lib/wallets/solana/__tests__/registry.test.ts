import { describe, it, expect } from 'vitest'
import { SOLANA_WALLETS, getWalletByName } from '../registry'

describe('SOLANA_WALLETS registry', () => {
  it('contains Phantom, Solflare, Backpack', () => {
    const names = SOLANA_WALLETS.map(w => w.name)
    expect(names).toContain('Phantom')
    expect(names).toContain('Solflare')
    expect(names).toContain('Backpack')
  })

  it('getWalletByName returns correct adapter', () => {
    const w = getWalletByName('Phantom')
    expect(w).not.toBeNull()
    expect(w?.name).toBe('Phantom')
  })

  it('getWalletByName returns null for unknown wallet', () => {
    expect(getWalletByName('NonExistentWallet_XYZ')).toBeNull()
  })

  it('all wallets have name and icon', () => {
    for (const w of SOLANA_WALLETS) {
      expect(typeof w.name).toBe('string')
      expect(w.name.length).toBeGreaterThan(0)
      expect(typeof w.icon).toBe('string')
    }
  })

  it('all wallets are not installed in test env (no window)', () => {
    for (const w of SOLANA_WALLETS) {
      expect(w.installed).toBe(false)
    }
  })
})
