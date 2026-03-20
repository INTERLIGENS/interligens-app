'use client'
import React, { useEffect, useState } from 'react'

export default function KolListPage() {
  const [kols, setKols] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/kol')
      .then(r => r.json())
      .then(d => setKols(d.kols ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fmtUsd = (n?: number) => !n ? '—' : n >= 1000000 ? '$' + (n/1000000).toFixed(1) + 'M' : '$' + (n/1000).toFixed(0) + 'K'

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/en/demo" style={{ color: '#F85B05', fontSize: 11, fontWeight: 900, textDecoration: 'none', letterSpacing: '0.15em', fontFamily: 'monospace' }}>← INTERLIGENS</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <span style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace' }}>HIGH-RISK ACTOR REGISTRY</span>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 900, letterSpacing: '0.25em', marginBottom: 12 }}>VERIFIED INTELLIGENCE PROFILES</div>
          <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, marginBottom: 10 }}>High-Risk Actor Registry</h1>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7, margin: 0 }}>
            Evidence-based profiles documented from public on-chain records, wallet-cluster analysis, and cited third-party sources. Not criminal verdicts — intelligence records.
          </p>
        </div>

        {loading && (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.15em' }}>LOADING REGISTRY...</div>
        )}

        {/* Table header */}
        {!loading && kols.length > 0 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 80px 80px 40px', gap: 12, padding: '8px 16px', marginBottom: 4 }}>
              {['ACTOR', 'EST. INVESTOR LOSSES', 'RUG-LINKED CASES', 'WALLETS', 'CASES', ''].map(h => (
                <div key={h} style={{ fontSize: 8, fontWeight: 900, color: '#374151', letterSpacing: '0.15em' }}>{h}</div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {kols.map((kol: any, i: number) => (
                <a key={kol.handle} href={'/en/kol/' + kol.handle} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 120px 100px 80px 80px 40px',
                    gap: 12, padding: '16px', background: '#0a0a0a',
                    border: '1px solid #111827', borderRadius: 10,
                    borderLeft: '3px solid #ef444444',
                    alignItems: 'center', cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderLeftColor = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.borderLeftColor = '#ef444444')}
                  >
                    {/* Actor */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ef444422', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#ef4444', flexShrink: 0, fontFamily: 'monospace' }}>
                        {(kol.displayName ?? kol.handle)[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f9fafb' }}>{kol.displayName ?? kol.handle}</div>
                        <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace' }}>@{kol.handle}</div>
                      </div>
                      {kol.verified && <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 900, background: '#ef444415', padding: '2px 6px', borderRadius: 3 }}>✓ VERIFIED</span>}
                    </div>

                    {/* Est losses */}
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}>
                      {fmtUsd(kol.totalScammed)}
                    </div>

                    {/* Rug-linked */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>
                      {kol.rugCount} cases
                    </div>

                    {/* Wallets */}
                    <div style={{ fontSize: 13, color: '#8b5cf6', fontFamily: 'monospace' }}>
                      {kol.walletCount ?? 0}
                    </div>

                    {/* Cases */}
                    <div style={{ fontSize: 13, color: '#3b82f6', fontFamily: 'monospace' }}>
                      {kol.caseCount ?? 0}
                    </div>

                    {/* Arrow */}
                    <div style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>→</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ marginTop: 48, borderTop: '1px solid #111827', paddingTop: 24, fontSize: 11, color: '#374151', lineHeight: 1.75 }}>
          Evidence-based intelligence registry. Profiles are derived from public blockchain records, cited sources, and documented methodology. Not criminal determinations.
          <span style={{ marginLeft: 12 }}><a href="/en/methodology" style={{ color: '#374151', fontWeight: 700 }}>Methodology →</a></span>
          <span style={{ marginLeft: 12 }}><a href="/en/correction" style={{ color: '#374151', fontWeight: 700 }}>Request correction →</a></span>
        </div>
      </div>
    </div>
  )
}
