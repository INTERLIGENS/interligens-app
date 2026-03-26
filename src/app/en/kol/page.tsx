'use client'
import React, { useState, useEffect } from 'react'

interface KolRow {
  handle: string
  displayName?: string
  tier?: string
  totalScammed?: number
  rugCount: number
  followerCount?: number
  riskFlag?: string
  verified: boolean
  _count: { evidences: number; kolCases: number }
}

export default function KolListingPage() {
  const [kols, setKols] = useState<KolRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/kol?limit=100')
      .then(r => r.json())
      .then(d => {
        const sorted = (d.profiles ?? []).sort((a: KolRow, b: KolRow) => {
          const diff = (b.totalScammed ?? 0) - (a.totalScammed ?? 0)
          if (diff !== 0) return diff
          return b.rugCount - a.rugCount
        })
        setKols(sorted)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fmtUsd = (n?: number) => {
    if (!n) return '—'
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
    if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
    return '$' + n
  }

  const tierColor: Record<string, string> = {
    S: '#ef4444', A: '#f97316', B: '#f59e0b', C: '#6b7280',
  }

  const riskColor: Record<string, string> = {
    confirmed_scammer: '#ef4444',
    high_risk: '#f97316',
    medium_risk: '#f59e0b',
    unverified: '#6b7280',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>

      {/* HEADER */}
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/en/demo" style={{ color: '#F85B05', fontSize: 11, fontWeight: 900, textDecoration: 'none', letterSpacing: '0.15em', fontFamily: 'monospace' }}>← INTERLIGENS</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <span style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace' }}>KOL INTELLIGENCE REGISTRY</span>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* TITLE */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ color: '#F85B05', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 8 }}>
            PUBLIC REGISTRY
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            KOL Risk Intelligence
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
            Documented influencers linked to scam promotions, rug pulls, and retail investor harm on Solana and EVM chains.
          </p>
        </div>

        {/* STATS BAR */}
        {!loading && (
          <div style={{ display: 'flex', gap: 24, marginBottom: 28, padding: '14px 20px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 8 }}>
            <div>
              <div style={{ color: '#F85B05', fontSize: 18, fontWeight: 800 }}>{kols.length}</div>
              <div style={{ color: '#6b7280', fontSize: 10, letterSpacing: '0.12em', fontFamily: 'monospace' }}>PROFILES</div>
            </div>
            <div style={{ width: 1, background: '#1e2330' }} />
            <div>
              <div style={{ color: '#ef4444', fontSize: 18, fontWeight: 800 }}>
                {fmtUsd(kols.reduce((s, k) => s + (k.totalScammed ?? 0), 0))}
              </div>
              <div style={{ color: '#6b7280', fontSize: 10, letterSpacing: '0.12em', fontFamily: 'monospace' }}>TOTAL DOCUMENTED HARM</div>
            </div>
            <div style={{ width: 1, background: '#1e2330' }} />
            <div>
              <div style={{ color: '#f59e0b', fontSize: 18, fontWeight: 800 }}>
                {kols.reduce((s, k) => s + k.rugCount, 0)}
              </div>
              <div style={{ color: '#6b7280', fontSize: 10, letterSpacing: '0.12em', fontFamily: 'monospace' }}>RUG EVENTS</div>
            </div>
          </div>
        )}

        {/* TABLE */}
        {loading ? (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.15em', padding: '60px 0', textAlign: 'center' }}>
            LOADING REGISTRY...
          </div>
        ) : kols.length === 0 ? (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', padding: '60px 0', textAlign: 'center' }}>
            NO PUBLISHED PROFILES YET
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* TABLE HEADER */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 80px 80px 100px', gap: 12, padding: '8px 16px', color: '#4b5563', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.12em' }}>
              <div>HANDLE</div>
              <div>TIER</div>
              <div>HARM (USD)</div>
              <div>RUGS</div>
              <div>EVIDENCE</div>
              <div style={{ textAlign: 'right' }}>PROFILE</div>
            </div>

            {kols.map(kol => (
              <a key={kol.handle} href={`/en/kol/${kol.handle}`} style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '1fr 80px 120px 80px 80px 100px', gap: 12, padding: '14px 16px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 6, alignItems: 'center', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#F85B05')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2330')}
              >
                {/* HANDLE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e2330', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F85B05', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {(kol.displayName ?? kol.handle).slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: '#f9fafb', fontSize: 13, fontWeight: 600 }}>@{kol.handle}</div>
                    {kol.displayName && kol.displayName !== kol.handle && (
                      <div style={{ color: '#6b7280', fontSize: 11 }}>{kol.displayName}</div>
                    )}
                  </div>
                  {kol.verified && (
                    <span style={{ background: '#ef444422', border: '1px solid #ef444444', color: '#ef4444', fontSize: 8, fontWeight: 900, padding: '2px 6px', borderRadius: 3, letterSpacing: '0.12em', fontFamily: 'monospace' }}>VERIFIED</span>
                  )}
                </div>

                {/* TIER */}
                <div style={{ color: tierColor[kol.tier ?? ''] ?? '#6b7280', fontFamily: 'monospace', fontWeight: 800, fontSize: 13 }}>
                  {kol.tier ? `TIER ${kol.tier}` : '—'}
                </div>

                {/* HARM */}
                <div style={{ color: kol.totalScammed ? '#ef4444' : '#6b7280', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>
                  {fmtUsd(kol.totalScammed)}
                </div>

                {/* RUGS */}
                <div style={{ color: kol.rugCount > 0 ? '#f97316' : '#6b7280', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>
                  {kol.rugCount > 0 ? kol.rugCount : '—'}
                </div>

                {/* EVIDENCE */}
                <div style={{ color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>
                  {kol._count.evidences} items
                </div>

                {/* LINK */}
                <div style={{ textAlign: 'right', color: '#F85B05', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}>
                  VIEW →
                </div>
              </a>
            ))}
          </div>
        )}

        {/* FOOTER */}
        <div style={{ marginTop: 48, borderTop: '1px solid #1e2330', paddingTop: 20, color: '#374151', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between' }}>
          <span>Not financial advice — INTERLIGENS Intelligence © 2026</span>
          <a href="/en/methodology" style={{ color: '#4b5563', textDecoration: 'none' }}>METHODOLOGY →</a>
        </div>
      </div>
    </div>
  )
}
