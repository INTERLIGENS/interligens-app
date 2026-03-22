'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'

interface KolSummary {
  handle: string
  displayName?: string
  platform: string
  riskFlag: string
  rugCount: number
  totalScammed?: number
  totalDocumented?: number
  verified: boolean
  confidence: string
  exitDate?: string
}

const RISK_COLOR: Record<string, string> = {
  confirmed_scammer: '#ef4444',
  suspected:         '#f97316',
  under_review:      '#f59e0b',
  cleared:           '#10b981',
}

const fmtUsd = (n?: number) => {
  if (!n) return '—'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

export default function KolListPage() {
  const [kols, setKols] = useState<KolSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'totalScammed'|'rugCount'|'totalDocumented'>('totalScammed')

  useEffect(() => {
    fetch('/api/kol')
      .then(r => r.json())
      .then(d => setKols(d.kols || []))
      .finally(() => setLoading(false))
  }, [])

  const sorted = [...kols].sort((a, b) => (b[sort] || 0) - (a[sort] || 0))

  return (
    <div style={{ minHeight: '100vh', background: '#050505', padding: '48px 24px', fontFamily: 'monospace' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: '#F85B05', letterSpacing: '0.3em', marginBottom: 8 }}>
            INTERLIGENS — INTELLIGENCE DATABASE
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
            KOL THREAT REGISTRY
          </h1>
          <p style={{ fontSize: 12, color: '#4b5563', marginTop: 8 }}>
            Verified on-chain investigations. All claims source-attributed or blockchain-verified.
          </p>
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['totalScammed', 'rugCount', 'totalDocumented'] as const).map(s => (
            <button key={s} onClick={() => setSort(s)} style={{
              fontSize: 9, fontWeight: 900, letterSpacing: '0.15em',
              padding: '6px 12px', borderRadius: 4, cursor: 'pointer', border: 'none',
              background: sort === s ? '#F85B05' : '#111',
              color: sort === s ? '#fff' : '#4b5563',
            }}>
              {s === 'totalScammed' ? 'TOTAL SCAMMED' : s === 'rugCount' ? 'RUG COUNT' : 'DOCUMENTED'}
            </button>
          ))}
        </div>

        {/* Stats bar */}
        {!loading && (
          <div style={{ display: 'flex', gap: 24, marginBottom: 32, padding: '16px 20px', background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#374151', letterSpacing: '0.2em' }}>PROFILES</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9' }}>{kols.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#374151', letterSpacing: '0.2em' }}>TOTAL SCAMMED</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444' }}>
                {fmtUsd(kols.reduce((a, k) => a + (k.totalScammed || 0), 0))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#374151', letterSpacing: '0.2em' }}>DOCUMENTED ON-CHAIN</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#F85B05' }}>
                {fmtUsd(kols.reduce((a, k) => a + (k.totalDocumented || 0), 0))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#374151', letterSpacing: '0.2em' }}>TOTAL RUGS</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b' }}>
                {kols.reduce((a, k) => a + (k.rugCount || 0), 0)}
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ color: '#374151', fontSize: 12 }}>Chargement...</div>
        ) : sorted.length === 0 ? (
          <div style={{ color: '#374151', fontSize: 12 }}>No profiles yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sorted.map((kol, i) => (
              <Link key={kol.handle} href={`/fr/kol/${kol.handle}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 10,
                  padding: '20px 24px', cursor: 'pointer', transition: 'border-color 0.2s',
                  display: 'flex', alignItems: 'center', gap: 24,
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#F85B05')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1f2937')}
                >
                  {/* Rank */}
                  <div style={{ fontSize: 24, fontWeight: 900, color: i === 0 ? '#ef4444' : '#1f2937', minWidth: 32 }}>
                    #{i + 1}
                  </div>

                  {/* Identity */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9' }}>
                        {kol.displayName || kol.handle}
                      </span>
                      <span style={{ fontSize: 10, color: '#4b5563' }}>@{kol.handle}</span>
                      {kol.verified && (
                        <span style={{ fontSize: 8, fontWeight: 900, color: '#10b981', letterSpacing: '0.15em',
                          background: '#10b98115', padding: '2px 6px', borderRadius: 3 }}>
                          VERIFIED
                        </span>
                      )}
                      {kol.exitDate && (
                        <span style={{ fontSize: 8, fontWeight: 900, color: '#ef4444', letterSpacing: '0.15em',
                          background: '#ef444415', padding: '2px 6px', borderRadius: 3 }}>
                          EXIT {new Date(kol.exitDate).toLocaleDateString('en-US', {month:'short',year:'numeric'})}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.15em',
                        color: RISK_COLOR[kol.riskFlag] || '#6b7280',
                        background: (RISK_COLOR[kol.riskFlag] || '#6b7280') + '15',
                        padding: '2px 8px', borderRadius: 3 }}>
                        {kol.riskFlag?.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 32 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: '#374151', letterSpacing: '0.15em' }}>RUGS</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b' }}>{kol.rugCount}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: '#374151', letterSpacing: '0.15em' }}>SCAMMED</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#ef4444' }}>
                        {fmtUsd(kol.totalScammed)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: '#374151', letterSpacing: '0.15em' }}>DOCUMENTED</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#F85B05' }}>
                        {fmtUsd(kol.totalDocumented)}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: '#374151' }}>→</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, fontSize: 10, color: '#1f2937', textAlign: 'center' }}>
          All data is derived from publicly accessible blockchain records and cited sources.{' '}
          <Link href="/en/methodology" style={{ color: '#374151' }}>Methodology</Link>
          {' · '}
          <Link href="/en/correction" style={{ color: '#374151' }}>Request correction</Link>
        </div>
      </div>
    </div>
  )
}
