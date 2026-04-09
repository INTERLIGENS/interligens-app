'use client'
import BetaNav from "@/components/beta/BetaNav";
import React, { useState, useEffect, useCallback } from 'react'

type Kind = '' | 'case' | 'launch'

interface Actor { handle: string; displayName: string | null; role: string; tier: string | null }
interface Dossier {
  id: string; kind: string; title: string; summary: string | null; primaryDate: string
  linkedActors: Actor[]; linkedActorsCount: number
  proceedsObservedTotal: number | null; proceedsCoverage: string
  evidenceDepth: string; strongestFlags: string[]; documentationStatus: string; href: string
  sharedActorGroup?: boolean; multiLaunchRecurrence?: boolean; multiLaunchCount?: number
  topCoordinationSignal?: { labelEn: string; labelFr: string; strength: string } | null
  snapshotCount?: number
}
interface Stats {
  publishedProfiles: number; minimumObservedProceeds: number
  documentedWallets: number; linkedLaunches: number; strongEvidenceCount: number
}

const KIND_BADGE: Record<string, { l: string; c: string }> = {
  case:   { l: 'CASE CLUSTER',  c: '#ef4444' },
  launch: { l: 'TOKEN LAUNCH',  c: '#8b5cf6' },
}
const DOC_BADGE: Record<string, { l: string; c: string }> = {
  documented: { l: 'DOCUMENTED', c: '#10b981' },
  partial:    { l: 'PARTIAL',    c: '#f59e0b' },
}
const DEPTH: Record<string, { l: string; c: string }> = {
  comprehensive: { l: 'COMPREHENSIVE', c: '#10b981' }, strong: { l: 'STRONG', c: '#3b82f6' },
  moderate: { l: 'MODERATE', c: '#f59e0b' }, weak: { l: 'WEAK', c: '#6b7280' },
}
const FLAG_L: Record<string, string> = {
  REPEATED_CASHOUT: 'Repeated cashout', MULTI_HOP_TRANSFER: 'Multi-hop transfer',
  CROSS_CASE_RECURRENCE: 'Cross-case recurrence', MULTI_LAUNCH_LINKED: 'Multi-launch linked',
  LAUNDERING_INDICATORS: 'Laundering indicators', KNOWN_LINKED_WALLETS: 'Known linked wallets',
  COORDINATED_PROMOTION: 'Coordinated promotion',
}
const KIND_TABS: { key: Kind; label: string }[] = [
  { key: '', label: 'ALL' }, { key: 'case', label: 'CASES' }, { key: 'launch', label: 'LAUNCHES' },
]

const fmtUsd = (n: number | null | undefined) => {
  if (n == null || n === 0) return '\u2014'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n.toLocaleString('en-US')
}
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) } catch { return '' }
}
const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{ background: color + '15', color, fontSize: 8, fontWeight: 900, padding: '3px 8px', borderRadius: 3, letterSpacing: '0.1em', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{label}</span>
)

export default function ExplorerEN() {
  const [items, setItems] = useState<Dossier[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [kind, setKind] = useState<Kind>('')
  const [search, setSearch] = useState('')
  const [hasProceeds, setHasProceeds] = useState(false)
  const [hasFlags, setHasFlags] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (kind) params.set('kind', kind)
    if (search) params.set('search', search)
    if (hasProceeds) params.set('hasProceeds', 'true')
    if (hasFlags) params.set('hasFlags', 'true')
    fetch('/api/explorer?' + params)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setStats(d.stats ?? null) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [kind, search, hasProceeds, hasFlags])

  useEffect(() => { load() }, [kind, hasProceeds, hasFlags, load])

  const proceedsText = (d: Dossier) => {
    if (!d.proceedsObservedTotal || d.proceedsObservedTotal === 0) return null
    if (d.proceedsCoverage === 'partial' || d.proceedsCoverage === 'estimated')
      return 'Min. ' + fmtUsd(d.proceedsObservedTotal) + ' observed \u2014 partial coverage'
    return fmtUsd(d.proceedsObservedTotal) + ' documented'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ color: '#F85B05', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 8 }}>CASES &amp; LAUNCHES</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Explorer<span style={{ color: '#F85B05' }}>.</span></h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
            Documented scam cases, token launches, and connected patterns. Browse by case, not by person.
          </p>
        </div>

        {/* STATS */}
        {stats && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, padding: '14px 20px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 8, flexWrap: 'wrap' }}>
            {[
              { v: stats.publishedProfiles, l: 'PUBLISHED PROFILES', c: '#F85B05' },
              { v: fmtUsd(stats.minimumObservedProceeds), l: 'MIN. OBSERVED PROCEEDS', c: '#ef4444', r: true },
              { v: stats.documentedWallets, l: 'DOCUMENTED WALLETS', c: '#8b5cf6' },
              { v: stats.linkedLaunches, l: 'LINKED LAUNCHES', c: '#ec4899' },
              { v: stats.strongEvidenceCount, l: 'STRONG EVIDENCE', c: '#3b82f6' },
            ].map(s => (
              <div key={s.l} style={{ flex: 1, minWidth: 110 }}>
                <div style={{ color: s.c, fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>{s.r ? s.v : String(s.v)}</div>
                <div style={{ color: '#6b7280', fontSize: 9, letterSpacing: '0.12em', fontFamily: 'monospace' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* CONTROLS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {KIND_TABS.map(t => (
            <button key={t.key} onClick={() => setKind(t.key)} style={{
              fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', padding: '6px 14px', borderRadius: 4,
              cursor: 'pointer', border: 'none', background: kind === t.key ? '#F85B05' : '#111',
              color: kind === t.key ? '#fff' : '#4b5563', transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
          <div style={{ width: 1, height: 20, background: '#1e2330', margin: '0 4px' }} />
          <button onClick={() => setHasProceeds(!hasProceeds)} style={{
            fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', padding: '6px 12px', borderRadius: 4,
            cursor: 'pointer', border: hasProceeds ? '1px solid #10b98166' : '1px solid #1e2330',
            background: hasProceeds ? '#10b98115' : '#111', color: hasProceeds ? '#10b981' : '#4b5563',
          }}>HAS PROCEEDS</button>
          <button onClick={() => setHasFlags(!hasFlags)} style={{
            fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', padding: '6px 12px', borderRadius: 4,
            cursor: 'pointer', border: hasFlags ? '1px solid #f9731666' : '1px solid #1e2330',
            background: hasFlags ? '#f9731615' : '#111', color: hasFlags ? '#f97316' : '#4b5563',
          }}>HAS FLAGS</button>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              placeholder="Search case or actor..." style={{ background: '#111', border: '1px solid #1e2330', borderRadius: 4, padding: '6px 12px', color: '#f9fafb', fontSize: 12, fontFamily: 'monospace', outline: 'none', width: 180 }} />
            <button onClick={load} style={{ background: '#1e2330', border: 'none', borderRadius: 4, padding: '6px 12px', color: '#6b7280', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>SEARCH</button>
          </div>
        </div>

        {/* DOSSIER CARDS */}
        {loading ? (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.15em', padding: '60px 0', textAlign: 'center' }}>LOADING DOSSIERS...</div>
        ) : items.length === 0 ? (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', padding: '60px 0', textAlign: 'center' }}>NO DOSSIERS MATCH YOUR FILTERS</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map(d => {
              const kb = KIND_BADGE[d.kind] ?? KIND_BADGE.case
              const doc = DOC_BADGE[d.documentationStatus] ?? DOC_BADGE.partial
              const depth = d.evidenceDepth && d.evidenceDepth !== 'none' ? DEPTH[d.evidenceDepth] : null
              const proceeds = proceedsText(d)
              const visibleActors = d.linkedActors.slice(0, 4)
              const moreCount = d.linkedActorsCount - visibleActors.length

              return (
                <a key={d.id} href={d.href} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#0d1117', border: '1px solid #1e2330', borderRadius: 12, padding: '24px 28px', transition: 'border-color 0.15s', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = kb.c)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2330')}
                  >
                    {/* Top row: badges + date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      <Badge label={kb.l} color={kb.c} />
                      <Badge label={doc.l} color={doc.c} />
                      {depth && <Badge label={depth.l + ' EVIDENCE'} color={depth.c} />}
                      {(d.snapshotCount ?? 0) > 0 && <Badge label={`${d.snapshotCount} evidence on file`} color="#3b82f6" />}
                      <span style={{ marginLeft: 'auto', color: '#374151', fontSize: 10, fontFamily: 'monospace' }}>{fmtDate(d.primaryDate)}</span>
                    </div>

                    {/* Title */}
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#f9fafb', letterSpacing: '-0.01em', marginBottom: 6 }}>{d.title}</div>

                    {/* Linked actors count */}
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                      {d.linkedActorsCount} linked actor{d.linkedActorsCount !== 1 ? 's' : ''} documented
                    </div>

                    {/* Actor pills */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                      {visibleActors.map(a => (
                        <span key={a.handle} style={{ background: '#F85B0510', border: '1px solid #F85B0533', color: '#F85B05', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, fontFamily: 'monospace' }}>
                          @{a.handle}
                        </span>
                      ))}
                      {moreCount > 0 && (
                        <span style={{ background: '#1e2330', color: '#6b7280', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, fontFamily: 'monospace' }}>
                          +{moreCount} more
                        </span>
                      )}
                    </div>

                    {/* Summary */}
                    {d.summary && (
                      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: 14, borderLeft: '2px solid #1e2330', paddingLeft: 12 }}>
                        {d.summary}
                      </div>
                    )}

                    {/* Bottom row: proceeds + flags + CTA */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {proceeds && (
                        <span style={{ color: '#ef4444', fontFamily: 'monospace', fontWeight: 800, fontSize: 14 }}>{proceeds}</span>
                      )}
                      {d.strongestFlags.slice(0, 2).map(f => (
                        <Badge key={f} label={FLAG_L[f] ?? f} color="#f97316" />
                      ))}
                      {d.multiLaunchRecurrence && d.multiLaunchCount && (
                        <Badge label={`Same actor group across ${d.multiLaunchCount} dossiers`} color="#ef4444" />
                      )}
                      {d.topCoordinationSignal && d.topCoordinationSignal.strength === 'strong' && (
                        <Badge label={d.topCoordinationSignal.labelEn} color="#ef4444" />
                      )}
                      <span style={{ marginLeft: 'auto', color: '#F85B05', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}>VIEW DOSSIER {'\u2192'}</span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}

        {/* CROSS-NAV */}
        <div style={{ marginTop: 48, borderTop: '1px solid #1a1a1a', paddingTop: 20, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#27272a', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>Go deeper</span>
          <a href="/en/kol" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>See actor profiles &rarr;</a>
          <a href="/en/watchlist" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>Check surveillance status &rarr;</a>
          <a href="/en/methodology" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>Methodology &rarr;</a>
        </div>
        <div style={{ marginTop: 16, color: '#1c1c1c', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
          Not financial advice — INTERLIGENS Intelligence © 2026
        </div>
      </div>
    </div>
  )
}
