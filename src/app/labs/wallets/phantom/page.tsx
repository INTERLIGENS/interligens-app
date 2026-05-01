'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isLabEnabled } from '@/lib/featureFlags'
import { detectPhantom, connectPhantom, disconnectPhantom } from '@/lib/wallets/phantom-guard/connect'
import { scanAddress, ScanResult } from '@/lib/wallets/phantom-guard/scan'
import { phantomDeeplink } from '@/lib/wallets/phantom-guard/deeplink'

function LabBadge() {
  return (
    <span style={{ background: '#FF6B00', color: '#000', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: 1 }}>
      LAB — Experimental
    </span>
  )
}

export default function PhantomGuardV2Page() {
  const router = useRouter()
  const [address, setAddress] = useState<string | null>(null)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLabEnabled('phantomGuardV2')) router.replace('/')
  }, [router])

  if (!isLabEnabled('phantomGuardV2')) return null

  async function handleConnect() {
    setError(null)
    try {
      const addr = await connectPhantom()
      setAddress(addr)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  async function handleScan() {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const result = await scanAddress(address)
      setScan(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    await disconnectPhantom()
    setAddress(null)
    setScan(null)
  }

  const isInstalled = typeof window !== 'undefined' && detectPhantom() !== null

  return (
    <main style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: 32, fontFamily: 'monospace' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Phantom Guard v2</h1>
          <LabBadge />
        </div>

        {!isInstalled && (
          <p style={{ color: '#FF6B00' }}>Phantom not detected. Install the Phantom extension to use this lab.</p>
        )}

        {isInstalled && !address && (
          <button
            onClick={handleConnect}
            style={{ background: '#FF6B00', color: '#000', border: 'none', padding: '10px 20px', fontWeight: 700, cursor: 'pointer', borderRadius: 4 }}
          >
            Connect Phantom
          </button>
        )}

        {address && (
          <div style={{ marginTop: 16 }}>
            <p style={{ color: '#aaa', fontSize: 12 }}>Connected: <span style={{ color: '#FF6B00' }}>{address}</span></p>
            <a href={phantomDeeplink(address)} target="_blank" rel="noreferrer" style={{ color: '#666', fontSize: 11 }}>View on Phantom</a>

            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
              <button
                onClick={handleScan}
                disabled={loading}
                style={{ background: '#FF6B00', color: '#000', border: 'none', padding: '8px 16px', fontWeight: 700, cursor: 'pointer', borderRadius: 4 }}
              >
                {loading ? 'Scanning...' : 'Scan Address'}
              </button>
              <button
                onClick={handleDisconnect}
                style={{ background: 'transparent', color: '#666', border: '1px solid #333', padding: '8px 16px', cursor: 'pointer', borderRadius: 4 }}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {scan && (
          <div style={{ marginTop: 24, padding: 16, border: `1px solid ${scan.allow ? '#333' : '#FF6B00'}`, borderRadius: 8 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>Score: {scan.score} — {scan.tier}</p>
            {scan.warning && <p style={{ color: '#FF6B00', margin: '8px 0 0' }}>{scan.warning}</p>}
            {scan.signals.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 16, color: '#aaa', fontSize: 12 }}>
                {scan.signals.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
            <p style={{ margin: '8px 0 0', color: scan.allow ? '#4ade80' : '#ef4444', fontWeight: 700 }}>
              {scan.allow ? 'ALLOW' : 'BLOCKED'}
            </p>
          </div>
        )}

        {error && <p style={{ color: '#ef4444', marginTop: 16 }}>{error}</p>}
      </div>
    </main>
  )
}
