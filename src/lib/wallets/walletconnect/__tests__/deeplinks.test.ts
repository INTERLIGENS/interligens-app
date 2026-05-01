import { describe, it, expect } from 'vitest'
import { trustWalletConnectDeeplink, trustMobileDeeplink } from '../trust-deeplink'
import { okxWalletConnectDeeplink, bitgetWalletConnectDeeplink } from '../okx-bitget'
import { buildLedgerWcUri } from '../ledger-wc'

describe('Trust deeplinks', () => {
  it('generates WC deeplink for Trust', () => {
    const url = trustWalletConnectDeeplink('wc:abc123')
    expect(url).toContain('trust://wc')
    expect(url).toContain(encodeURIComponent('wc:abc123'))
  })

  it('generates mobile deeplink for Trust', () => {
    const url = trustMobileDeeplink('0xabc')
    expect(url).toContain('link.trustwallet.com')
    expect(url).toContain('0xabc')
  })
})

describe('OKX + Bitget deeplinks', () => {
  it('generates OKX WC deeplink', () => {
    const url = okxWalletConnectDeeplink('wc:xyz')
    expect(url).toContain('okex://main/wc')
    expect(url).toContain(encodeURIComponent('wc:xyz'))
  })

  it('generates Bitget WC deeplink', () => {
    const url = bitgetWalletConnectDeeplink('wc:xyz')
    expect(url).toContain('bitkeep://wc')
    expect(url).toContain(encodeURIComponent('wc:xyz'))
  })
})

describe('Ledger WC', () => {
  it('builds Ledger WC URI', () => {
    const uri = buildLedgerWcUri({ projectId: 'test-project', chains: [1, 8453] })
    expect(uri).toContain('ledgerlive://wc')
    expect(uri).toContain('test-project')
    expect(uri).toContain('1,8453')
  })
})
