'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isLabEnabled } from '@/lib/featureFlags'

type Verdict = 'GREEN' | 'ORANGE' | 'RED' | 'BLACK' | null

interface ScanResult {
  score: number
  tier: string
  signals: string[]
  verdict: Verdict
  allow: boolean
  requireConfirm: boolean
  blockRoute: boolean
}

function verdictColor(v: Verdict): string {
  if (v === 'GREEN') return '#4ade80'
  if (v === 'ORANGE') return '#FF6B00'
  if (v === 'RED') return '#ef4444'
  if (v === 'BLACK') return '#666'
  return '#fff'
}

function scoreToVerdict(score: number, tier: string): Verdict {
  if (tier === 'OFAC' || score >= 90) return 'BLACK'
  if (score >= 70) return 'RED'
  if (score >= 40) return 'ORANGE'
  return 'GREEN'
}

function LabBadge() {
  return (
    <span style={{ background: '#FF6B00', color: '#000', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: 1 }}>
      LAB — Experimental
    </span>
  )
}

function JupiterSafeSwapContent() {
  const router = useRouter()
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [tokenAddress, setTokenAddress] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [override, setOverride] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  useEffect(() => {
    if (!isLabEnabled('jupiterSafeSwapV2')) router.replace('/')
  }, [router])

  const appendLog = useCallback((msg: string) => {
    setLog(prev => [...prev, `[${new Date().toISOString()}] ${msg}`])
  }, [])

  async function handleConnectWallet() {
    if (typeof window === 'undefined') return
    const solana = (window as unknown as Record<string, unknown>).solana as { isPhantom?: boolean; connect?: () => Promise<{ publicKey: { toString(): string } }> } | undefined
    if (!solana?.isPhantom || !solana.connect) {
      setError('Phantom not installed')
      return
    }
    try {
      const resp = await solana.connect()
      const addr = resp.publicKey.toString()
      setWalletAddress(addr)
      appendLog(`Wallet connected: ${addr}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  async function handleScan() {
    if (!tokenAddress.trim()) { setError('Enter a token address'); return }
    setScanning(true)
    setError(null)
    setScan(null)
    setOverride(false)
    setConfirmed(false)

    try {
      const res = await fetch(`/api/v1/score?address=${encodeURIComponent(tokenAddress.trim())}&chain=SOL`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data = await res.json() as { score?: number; tier?: string; signals?: string[] }
      const score = data.score ?? 0
      const tier = data.tier ?? 'UNKNOWN'
      const signals = data.signals ?? []
      const verdict = scoreToVerdict(score, tier)
      const result: ScanResult = {
        score,
        tier,
        signals,
        verdict,
        allow: verdict === 'GREEN',
        requireConfirm: verdict === 'ORANGE',
        blockRoute: verdict === 'RED' || verdict === 'BLACK',
      }
      setScan(result)
      appendLog(`Preflight: address=${tokenAddress.trim()} score=${score} tier=${tier} verdict=${verdict}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
      appendLog(`Scan error: ${err}`)
    } finally {
      setScanning(false)
    }
  }

  function handleOpenJupiter() {
    if (!tokenAddress.trim()) return
    appendLog(`Opening Jupiter route for: ${tokenAddress.trim()}`)
    // Jupiter route URL (no secret, public endpoint)
    const url = `https://jup.ag/swap/SOL-${encodeURIComponent(tokenAddress.trim())}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const canProceed = scan && (
    scan.verdict === 'GREEN' ||
    (scan.verdict === 'ORANGE' && confirmed) ||
    (scan.verdict === 'RED' && override)
  )

  return (
    <main style={{ background: '#000', color: '#fff', minHeight: '100vh', padding: 32, fontFamily: 'monospace' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Jupiter Safe Swap v2</h1>
          <LabBadge />
        </div>
        <p style={{ color: '#666', fontSize: 12, marginBottom: 24 }}>
          Swap route by Jupiter. Risk preflight by INTERLIGENS.
        </p>

        {!walletAddress ? (
          <button
            onClick={handleConnectWallet}
            style={{ background: '#FF6B00', color: '#000', border: 'none', padding: '10px 20px', fontWeight: 700, cursor: 'pointer', borderRadius: 4 }}
          >
            Connect Wallet
          </button>
        ) : (
          <p style={{ color: '#aaa', fontSize: 12 }}>Wallet: <span style={{ color: '#FF6B00' }}>{walletAddress}</span></p>
        )}

        {walletAddress && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Token address (Solana)"
                value={tokenAddress}
                onChange={e => setTokenAddress(e.target.value)}
                style={{ flex: 1, background: '#111', border: '1px solid #333', color: '#fff', padding: '8px 12px', borderRadius: 4, fontFamily: 'monospace' }}
              />
              <button
                onClick={handleScan}
                disabled={scanning}
                style={{ background: '#FF6B00', color: '#000', border: 'none', padding: '8px 16px', fontWeight: 700, cursor: 'pointer', borderRadius: 4 }}
              >
                {scanning ? 'Scanning...' : 'Scan'}
              </button>
            </div>
          </div>
        )}

        {scan && (
          <div style={{ marginTop: 20, padding: 16, border: `1px solid ${verdictColor(scan.verdict)}`, borderRadius: 8 }}>
            <p style={{ margin: 0, fontWeight: 700, color: verdictColor(scan.verdict) }}>
              {scan.verdict} — Score {scan.score} ({scan.tier})
            </p>
            {scan.signals.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 16, color: '#aaa', fontSize: 12 }}>
                {scan.signals.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}

            {scan.verdict === 'GREEN' && (
              <p style={{ color: '#4ade80', marginTop: 8, fontSize: 12 }}>Safe to proceed. Route available.</p>
            )}

            {scan.verdict === 'ORANGE' && !confirmed && (
              <div style={{ marginTop: 12 }}>
                <p style={{ color: '#FF6B00', fontSize: 13 }}>Risk detected. Confirm to proceed.</p>
                <button
                  onClick={() => setConfirmed(true)}
                  style={{ background: '#FF6B00', color: '#000', border: 'none', padding: '6px 14px', fontWeight: 700, cursor: 'pointer', borderRadius: 4, marginTop: 8 }}
                >
                  I understand — proceed
                </button>
              </div>
            )}

            {scan.verdict === 'RED' && !override && (
              <div style={{ marginTop: 12 }}>
                <p style={{ color: '#ef4444', fontSize: 13 }}>HIGH RISK. Route blocked by INTERLIGENS.</p>
                <button
                  onClick={() => setOverride(true)}
                  style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 14px', cursor: 'pointer', borderRadius: 4, marginTop: 8, fontSize: 12 }}
                >
                  Override (advanced users only)
                </button>
              </div>
            )}

            {scan.verdict === 'BLACK' && (
              <p style={{ color: '#666', marginTop: 8, fontSize: 13 }}>OFAC match or extreme risk. No route available.</p>
            )}

            {canProceed && scan.verdict !== 'BLACK' && (
              <button
                onClick={handleOpenJupiter}
                style={{ marginTop: 16, background: '#1a1a1a', color: '#4ade80', border: '1px solid #4ade80', padding: '10px 20px', fontWeight: 700, cursor: 'pointer', borderRadius: 4 }}
              >
                Open Jupiter Route →
              </button>
            )}
          </div>
        )}

        {error && <p style={{ color: '#ef4444', marginTop: 16, fontSize: 13 }}>{error}</p>}

        {log.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <p style={{ color: '#444', fontSize: 11, marginBottom: 4 }}>PREFLIGHT LOG</p>
            <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: 12, borderRadius: 4, fontSize: 11, color: '#666', maxHeight: 120, overflowY: 'auto' }}>
              {log.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function JupiterSafeSwapPage() {
  if (!isLabEnabled('jupiterSafeSwapV2')) return null
  return <JupiterSafeSwapContent />
}
