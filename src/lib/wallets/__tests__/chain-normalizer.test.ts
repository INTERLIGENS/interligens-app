import { describe, it, expect } from 'vitest'
import { normalizeChain, isValidAddress } from '../chain-normalizer'

describe('normalizeChain', () => {
  it('normalizes solana variants', () => {
    expect(normalizeChain('solana')).toBe('SOL')
    expect(normalizeChain('SOL')).toBe('SOL')
    expect(normalizeChain('sol')).toBe('SOL')
  })
  it('normalizes ethereum variants', () => {
    expect(normalizeChain('ethereum')).toBe('ETH')
    expect(normalizeChain('eth')).toBe('ETH')
    expect(normalizeChain('0x1')).toBe('ETH')
    expect(normalizeChain('1')).toBe('ETH')
  })
  it('normalizes base', () => {
    expect(normalizeChain('base')).toBe('BASE')
    expect(normalizeChain('8453')).toBe('BASE')
  })
  it('normalizes bsc', () => {
    expect(normalizeChain('bsc')).toBe('BSC')
    expect(normalizeChain('bnb')).toBe('BSC')
  })
  it('throws for unknown chain', () => {
    expect(() => normalizeChain('unknown_chain_xyz')).toThrow()
  })
})

describe('isValidAddress', () => {
  it('validates SOL address', () => {
    expect(isValidAddress('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'SOL')).toBe(true)
    expect(isValidAddress('0xinvalid', 'SOL')).toBe(false)
  })
  it('validates ETH address', () => {
    expect(isValidAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', 'ETH')).toBe(true)
    expect(isValidAddress('notanaddress', 'ETH')).toBe(false)
  })
  it('validates TRON address', () => {
    expect(isValidAddress('TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9', 'TRON')).toBe(true)
    expect(isValidAddress('0xinvalid', 'TRON')).toBe(false)
  })
})
