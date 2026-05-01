'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isLabEnabled } from '@/lib/featureFlags'
import { isTrustInstalled, trustMobileDeeplink } from '@/lib/wallets/walletconnect/trust-deeplink'
import { isOkxInstalled, isBitgetInstalled, okxWalletConnectDeeplink, bitgetWalletConnectDeeplink } from '@/lib/wallets/walletconnect/okx-bitget'
import { buildLedgerWcUri, isLedgerLiveInstalled } from '@/lib/wallets/walletconnect/ledger-wc'

function LabBadge() {
  return (
    <span style={{ background: '#FF6B00', color: '#000', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: 1 }}>
      LAB — Experimental
    </span>
  )
}

interface WalletEntry {
  name: string
  installed: boolean
  note: string
  action?: () => void
}

export default function WalletConnectPage() {
  const router = useRouter()
  useEffect(() => {
    if (!isLabEnabled('walletConnectLab')) router.replace('/')
  }, [router])
  if (!isLabEnabled('walletConnectLab')) return null

  const [wcUri] = useState('wc:placeholder-uri-requires-walletconnect-modal')
  const [error, setError] = useState<string | null>(null)

  const wallets: WalletEntry[] = [
    {
      name: 'Trust Wallet',
      installed: isTrustInstalled(),
      note: 'via WalletConnect or deeplink',
      action: () => { window.open(trustMobileDeeplink(''), '_blank', 'noopener') },
    },
    {
      name: 'Ledger',
      installed: isLedgerLiveInstalled(),
      note: 'via WalletConnect',
      action: () => {
        const uri = buildLedgerWcUri({ projectId: 'interligens-lab', chains: [1] })
        window.open(uri, '_blank', 'noopener')
      },
    },
    {
      name: 'OKX Wallet',
      installed: isOkxInstalled(),
      note: 'via WalletConnect only',
      action: () => { window.open(okxWalletConnectDeeplink(wcUri), '_blank', 'noopener') },
    },
    {
      name: 'Bitget Wallet',
      installed: isBitgetInstalled(),
      note: 'via WalletConnect only',
      action: () => { window.open(bitgetWalletConnectDeeplink(wcUri), '_blank', 'noopener') },
    },
  ]

  function handleConnect(wallet: WalletEntry) {
    setError(null)
    if (wallet.action) {
      wallet.action()
    } else {
      setError('WalletConnect modal not yet integrated — requires @walletconnect/modal or AppKit')
    }
  }

  return (
    <main style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: 32, fontFamily: 'monospace' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>WalletConnect AppKit v1</h1>
          <LabBadge />
        </div>
        <p style={{ color: '#555', fontSize: 12, marginBottom: 24 }}>
          WalletConnect integration — requires @walletconnect/modal or AppKit for full functionality.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {wallets.map(wallet => (
            <button
              key={wallet.name}
              onClick={() => handleConnect(wallet)}
              style={{
                background: '#111',
                color: '#fff',
                border: '1px solid #222',
                padding: '12px 16px',
                cursor: 'pointer',
                borderRadius: 4,
                textAlign: 'left',
                fontFamily: 'monospace',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>{wallet.name}</span>
                <span style={{ fontSize: 11, color: wallet.installed ? '#4ade80' : '#555' }}>
                  {wallet.installed ? 'detected' : 'not installed'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{wallet.note}</div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24, padding: 12, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4 }}>
          <p style={{ margin: 0, color: '#444', fontSize: 11 }}>
            Full WalletConnect integration requires installing @walletconnect/modal or AppKit. This page is a LAB placeholder.
          </p>
        </div>

        {error && <p style={{ color: '#ef4444', marginTop: 16, fontSize: 13 }}>{error}</p>}
      </div>
    </main>
  )
}
