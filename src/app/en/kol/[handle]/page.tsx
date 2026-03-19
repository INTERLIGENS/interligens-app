'use client'
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface KOL {
  id: string
  handle: string
  platform: string
  displayName?: string
  followers?: number
  status: string
  totalScammed?: number
  rugCount: number
  notes?: string
  verified: boolean
  wallets: { id: string; address: string; chain: string; label?: string; status: string }[]
  caseLinks: { id: string; caseId: string; role: string; paidUsd?: number; evidence?: string }[]
}

export default function KOLPage() {
  const params = useParams()
  const handle = params?.handle as string
  const [kol, setKol] = useState<KOL | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!handle) return
    fetch('/api/kol/' + handle)
      .then(r => r.json())
      .then(d => { if (d.found) setKol(d.kol); else setNotFound(true) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [handle])

  const fmt = (n?: number) => n ? '$' + (n >= 1000000 ? (n/1000000).toFixed(1) + 'M' : (n/1000).toFixed(0) + 'K') : 'Unknown'

  if (loading) return <div style={{ minHeight: '100vh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>Loading...</div>
  if (notFound || !kol) return <div style={{ minHeight: '100vh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>Profile not found</div>

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f9fafb', fontFamily: 'Inter, sans-serif', padding: '0 0 60px' }}>

      {/* Header band */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1f2937', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/en/demo" style={{ color: '#4f46e5', fontSize: 12, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.1em' }}>← INTERLIGENS</a>
        <span style={{ color: '#374151' }}>·</span>
        <span style={{ color: '#6b7280', fontSize: 12 }}>SCAMMER PROFILE</span>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>

        {/* ID Card */}
        <div style={{ background: 'linear-gradient(135deg, #1a0505 0%, #0f0202 100%)', border: '1px solid #ef444433', borderRadius: 16, padding: '28px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #ef4444, transparent)' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 10, background: '#ef444422', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontFamily: 'monospace', fontWeight: 900, color: '#ef4444', flexShrink: 0 }}>
              {(kol.displayName ?? kol.handle)[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 4 }}>
                SERIAL SCAMMER · {kol.platform.toUpperCase()} · {kol.status.toUpperCase()}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>{kol.displayName ?? kol.handle}</div>
              <div style={{ fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>@{kol.handle}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}>{fmt(kol.totalScammed ?? undefined)}</div>
              <div style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Est. scammed</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 16px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}>{kol.rugCount}</div>
              <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Rugs confirmed</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 16px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b', fontFamily: 'monospace' }}>{kol.followers ? (kol.followers/1000).toFixed(0) + 'K' : '?'}</div>
              <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Followers reached</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 16px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#8b5cf6', fontFamily: 'monospace' }}>{kol.wallets.length}</div>
              <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Wallets identified</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 16px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#3b82f6', fontFamily: 'monospace' }}>{kol.caseLinks.length}</div>
              <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Cases linked</div>
            </div>
          </div>

          {kol.notes && (
            <div style={{ marginTop: 16, background: '#0f172a', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#a5b4fc', borderLeft: '3px solid #4f46e5' }}>
              {kol.notes}
            </div>
          )}
        </div>

        {/* Wallets */}
        {kol.wallets.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Identified Wallets</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {kol.wallets.map(w => (
                <div key={w.id} style={{ background: '#0f172a', border: '1px solid #1f2937', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ background: w.status === 'active' ? '#ef444422' : '#6b728022', color: w.status === 'active' ? '#ef4444' : '#6b7280', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{w.status.toUpperCase()}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', flex: 1 }}>{w.address}</span>
                  <span style={{ fontSize: 10, color: '#4b5563' }}>{w.chain}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cases */}
        {kol.caseLinks.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Linked Cases</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {kol.caseLinks.map(c => (
                <div key={c.id} style={{ background: '#0f172a', border: '1px solid #1f2937', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: '#f59e0b22', color: '#f59e0b', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{c.role.toUpperCase()}</span>
                    {c.paidUsd && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>Paid: {fmt(c.paidUsd)}</span>}
                  </div>
                  {c.evidence && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, fontFamily: 'monospace' }}>{c.evidence}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ fontSize: 11, color: '#374151', textAlign: 'center' as const, lineHeight: 1.6, borderTop: '1px solid #1f2937', paddingTop: 20 }}>
          INTERLIGENS · All data sourced from verified on-chain records and public documents · Not legal advice
        </div>
      </div>
    </div>
  )
}
