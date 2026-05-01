import { describe, it, expect } from 'vitest'
import { EVM_WALLETS, getEvmWalletByName, getInstalledEvmWallets } from '../registry'

describe('EVM_WALLETS registry', () => {
  it('contains MetaMask, Rabby, Coinbase, Brave', () => {
    const names = EVM_WALLETS.map(w => w.name)
    expect(names).toContain('MetaMask')
    expect(names).toContain('Rabby')
    expect(names).toContain('Coinbase Wallet')
    expect(names).toContain('Brave Wallet')
  })

  it('getEvmWalletByName returns correct adapter', () => {
    const w = getEvmWalletByName('MetaMask')
    expect(w).not.toBeNull()
    expect(w?.name).toBe('MetaMask')
  })

  it('getEvmWalletByName returns null for unknown', () => {
    expect(getEvmWalletByName('NonExistentWallet_XYZ')).toBeNull()
  })

  it('all wallets have name and icon', () => {
    for (const w of EVM_WALLETS) {
      expect(typeof w.name).toBe('string')
      expect(w.name.length).toBeGreaterThan(0)
      expect(typeof w.icon).toBe('string')
    }
  })

  it('no wallets installed in test env (no window.ethereum)', () => {
    const installed = getInstalledEvmWallets()
    expect(installed).toHaveLength(0)
  })
})
