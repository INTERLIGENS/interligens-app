'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isLabEnabled } from '@/lib/featureFlags'
import { EVM_WALLETS } from '@/lib/wallets/evm/registry'
import type { EvmWalletInfo } from '@/lib/wallets/evm/types'

function LabBadge() {
  return (
    <span style={{ background: '#FF6B00', color: '#000', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: 1 }}>
      LAB — Experimental
    </span>
  )
}

export default function EvmWalletsPage() {
  const router = useRouter()
  useEffect(() => {
    if (!isLabEnabled('walletLab')) router.replace('/')
  }, [router])
  if (!isLabEnabled('walletLab')) return null

  const [connected, setConnected] = useState<{ address: string; wallet: string; chainId: string } | null>(null)
  const [scan, setScan] = useState<{ score: number; tier: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect(wallet: EvmWalletInfo) {
    setError(null)
    try {
      const address = await wallet.connect()
      const chainId = await wallet.getChainId()
      setConnected({ address, wallet: wallet.name, chainId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  async function handleScan() {
    if (!connected) return
    setLoading(true)
    setError(null)
    try {
      const chain = connected.chainId === '0x1' || connected.chainId === '1' ? 'ETH' : 'ETH'
      const res = await fetch(`/api/v1/score?address=${encodeURIComponent(connected.address)}&chain=${chain}`)
      const data = await res.json() as { score?: number; tier?: string }
      setScan({ score: data.score ?? 0, tier: data.tier ?? 'UNKNOWN' })
    } catch {
      setError('Scan failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: 32, fontFamily: 'monospace' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>EVM Wallets v1</h1>
          <LabBadge />
        </div>

        {!connected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EVM_WALLETS.map(wallet => (
              <button
                key={wallet.name}
                onClick={() => handleConnect(wallet)}
                disabled={!wallet.installed}
                style={{
                  background: wallet.installed ? '#111' : '#0a0a0a',
                  color: wallet.installed ? '#fff' : '#444',
                  border: '1px solid #222',
                  padding: '10px 16px',
                  cursor: wallet.installed ? 'pointer' : 'not-allowed',
                  borderRadius: 4,
                  textAlign: 'left',
                  fontFamily: 'monospace',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{wallet.name}</span>
                <span style={{ fontSize: 11, color: wallet.installed ? '#4ade80' : '#444' }}>
                  {wallet.installed ? 'detected' : 'not installed'}
                </span>
              </button>
            ))}
          </div>
        )}

        {connected && (
          <div>
            <p style={{ color: '#aaa', fontSize: 12 }}>
              Connected via <span style={{ color: '#FF6B00' }}>{connected.wallet}</span>:{' '}
              <span style={{ color: '#FF6B00' }}>{connected.address}</span>
            </p>
            <p style={{ color: '#555', fontSize: 11 }}>Chain ID: {connected.chainId}</p>
            <div style={{ marginTop: 16 }}>
              <button
                onClick={handleScan}
                disabled={loading}
                style={{ background: '#FF6B00', color: '#000', border: 'none', padding: '8px 16px', fontWeight: 700, cursor: 'pointer', borderRadius: 4 }}
              >
                {loading ? 'Scanning...' : 'Scan Address'}
              </button>
            </div>
          </div>
        )}

        {scan && (
          <div style={{ marginTop: 20, padding: 16, border: '1px solid #333', borderRadius: 8 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>Score: {scan.score} — {scan.tier}</p>
          </div>
        )}

        {error && <p style={{ color: '#ef4444', marginTop: 16, fontSize: 13 }}>{error}</p>}
      </div>
    </main>
  )
}
