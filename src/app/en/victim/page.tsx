'use client'
import BetaNav from "@/components/beta/BetaNav";
import React, { useState } from 'react'

interface TraceResult {
  found: boolean
  address?: string
  label?: string
  category?: string
  confidence?: string
  source?: string
  badgeColor?: string
  badgeText?: string
  notes?: string
}

export default function VictimPage() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TraceResult | null>(null)

  async function trace() {
    if (!address.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const r = await fetch('/api/scan/label?address=' + address.trim())
      const d = await r.json()
      setResult(d)
    } catch {
      setResult({ found: false })
    }
    setLoading(false)
  }

  const inp: React.CSSProperties = {
    background: '#0f172a', border: '1px solid #374151', borderRadius: 8,
    color: '#f9fafb', padding: '14px 18px', fontSize: 14, width: '100%',
    fontFamily: 'monospace', outline: 'none'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>
      <BetaNav />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700, letterSpacing: '0.2em', marginBottom: 12 }}>
            INTERLIGENS · VICTIM TRACKER
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: '-0.02em' }}>
            Was your wallet involved in a scam?
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
            Enter any wallet address or contract. We check if it appears in our database of flagged high-risk addresses, mixers, and complicit exchanges.
          </p>
        </div>

        {/* Input */}
        <div style={{ marginBottom: 16 }}>
          <input
            style={inp}
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && trace()}
            placeholder="0x... or Solana address"
          />
        </div>
        <button
          onClick={trace}
          disabled={loading || !address.trim()}
          style={{ background: '#4f46e5', border: 'none', borderRadius: 8, color: '#fff', padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%', marginBottom: 32, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Checking...' : 'Trace This Address →'}
        </button>

        {/* Result */}
        {result && (
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #1f2937' }}>
            {result.found ? (
              <div style={{ background: (result.badgeColor ?? '#ef4444') + '11', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 4, height: 48, background: result.badgeColor ?? '#ef4444', borderRadius: 2 }} />
                  <div>
                    <div style={{ fontSize: 10, color: result.badgeColor, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
                      {result.badgeText}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#f9fafb' }}>{result.label}</div>
                  </div>
                </div>

                <div style={{ background: '#0f172a', borderRadius: 8, padding: '14px 16px', marginBottom: 16, fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
                  {address}
                </div>

                {result.notes && (
                  <div style={{ background: '#1e1b4b', border: '1px solid #3730a3', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#a5b4fc' }}>
                    {result.notes}
                  </div>
                )}

                <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 20 }}>
                  Source: {result.source} · Confidence: {result.confidence}
                </div>

                {/* CTAs */}
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>WHAT TO DO NOW:</div>
                  <a href="https://www.binance.com/en/support/requests/new" target="_blank" rel="noreferrer"
                    style={{ background: '#1e293b', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb', padding: '12px 16px', fontSize: 13, textDecoration: 'none', display: 'block' }}>
                    Report to Binance — Submit evidence of scam funds received
                  </a>
                  <a href="https://www.ic3.gov" target="_blank" rel="noreferrer"
                    style={{ background: '#1e293b', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb', padding: '12px 16px', fontSize: 13, textDecoration: 'none', display: 'block' }}>
                    Report to IC3 (FBI Internet Crime Complaint Center)
                  </a>
                  <a href="https://www.finma.ch/en/reporting/reporting-misconduct/" target="_blank" rel="noreferrer"
                    style={{ background: '#1e293b', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb', padding: '12px 16px', fontSize: 13, textDecoration: 'none', display: 'block' }}>
                    Report to FINMA (Swiss Financial Authority)
                  </a>
                  <a href={'/en/scan/' + address.trim() + '/timeline'}
                    style={{ background: '#4f46e5', border: 'none', borderRadius: 8, color: '#fff', padding: '12px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'block', textAlign: 'center' as const }}>
                    See full investigation →
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ background: '#10b98111', padding: '24px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 4, height: 48, background: '#10b981', borderRadius: 2 }} />
                <div>
                  <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>NOT IN DATABASE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f9fafb' }}>This address has no known scam history</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Not found in our 68+ verified labels. Always DYOR.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ marginTop: 40, fontSize: 11, color: '#374151', textAlign: 'center' as const, lineHeight: 1.6 }}>
          INTERLIGENS Victim Tracker · Data from verified on-chain sources · Not legal advice · Always consult a professional
        </div>
      </div>
    </div>
  )
}
