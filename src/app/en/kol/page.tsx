'use client'
import BetaNav from "@/components/beta/BetaNav";
import React, { useState, useEffect, useCallback } from 'react'

type Sort = 'proceeds' | 'evidence' | 'completeness' | 'flags' | 'recent'

interface Profile {
  handle: string
  displayName?: string
  tier?: string
  summary?: string
  observedProceedsTotal: number | null
  proceedsCoverage?: string
  evidenceDepth?: string
  completenessLevel?: string
  walletAttributionStrength?: string
  behaviorFlags: string[]
  behaviorFlagsCount: number
  evidenceCount: number
  linkedTokensCount: number
  documentedWalletsCount: number
  hasLaundryTrail: boolean
  verified: boolean
}

interface Stats {
  publishedCount: number
  totalObservedProceeds: number
  totalDocumentedWallets: number
  totalLinkedTokens: number
  profilesWithProceeds: number
  profilesWithStrongEvidence: number
}

const DEPTH: Record<string, { l: string; c: string }> = {
  comprehensive: { l: 'COMPREHENSIVE', c: '#10b981' },
  strong:        { l: 'STRONG',        c: '#3b82f6' },
  moderate:      { l: 'MODERATE',      c: '#f59e0b' },
  weak:          { l: 'WEAK',          c: '#6b7280' },
  none:          { l: '\u2014',        c: '#374151' },
}
const COMP: Record<string, { l: string; c: string }> = {
  complete:    { l: 'COMPLETE',    c: '#10b981' },
  substantial: { l: 'SUBSTANTIAL', c: '#3b82f6' },
  partial:     { l: 'PARTIAL',     c: '#f59e0b' },
  incomplete:  { l: 'INCOMPLETE',  c: '#6b7280' },
}
const COVERAGE: Record<string, string> = {
  verified: 'VERIFIED', partial: 'PARTIAL', estimated: 'ESTIMATED', none: '\u2014',
}
const FLAG_LABEL: Record<string, string> = {
  REPEATED_CASHOUT:       'Repeated cashout',
  MULTI_HOP_TRANSFER:     'Multi-hop transfer',
  CROSS_CASE_RECURRENCE:  'Cross-case recurrence',
  MULTI_LAUNCH_LINKED:    'Multi-launch linked',
  LAUNDERING_INDICATORS:  'Laundering indicators',
  KNOWN_LINKED_WALLETS:   'Known linked wallets',
  COORDINATED_PROMOTION:  'Coordinated promotion',
}
const SORT_TABS: { key: Sort; label: string }[] = [
  { key: 'proceeds',     label: 'BY PROCEEDS' },
  { key: 'evidence',     label: 'BY EVIDENCE' },
  { key: 'completeness', label: 'BY COMPLETENESS' },
  { key: 'flags',        label: 'BY FLAGS' },
  { key: 'recent',       label: 'RECENT' },
]

const fmtUsd = (n: number | null | undefined) => {
  if (n == null || n === 0) return '\u2014'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{ background: color + '15', color, fontSize: 8, fontWeight: 900, padding: '3px 8px', borderRadius: 3, letterSpacing: '0.1em', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{label}</span>
)

export default function KolLeaderboardEN() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [sort, setSort] = useState<Sort>('proceeds')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback((s: Sort, q: string) => {
    setLoading(true)
    const params = new URLSearchParams({ sort: s })
    if (q) params.set('search', q)
    fetch('/api/kol/leaderboard?' + params)
      .then(r => r.json())
      .then(d => { setProfiles(d.profiles ?? []); setStats(d.stats ?? null) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(sort, search) }, [sort, load])

  const doSearch = () => load(sort, search)

  const proceedsLabel = (p: Profile) => {
    if (p.observedProceedsTotal == null || p.observedProceedsTotal === 0) return '\u2014'
    if (p.proceedsCoverage === 'partial' || p.proceedsCoverage === 'estimated')
      return 'Min. ' + fmtUsd(p.observedProceedsTotal) + ' observed'
    if (p.proceedsCoverage === 'verified')
      return fmtUsd(p.observedProceedsTotal) + ' verified'
    return fmtUsd(p.observedProceedsTotal)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(24px, 4vw, 48px) clamp(24px, 5vw, 64px)' }}>
        {/* TITLE */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ color: '#F85B05', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 8 }}>DOCUMENTED PROFILES</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>KOL Registry<span style={{ color: '#F85B05' }}>.</span></h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
            Investigated actors ranked by proceeds, evidence, and risk. Each profile is a documented dossier.
          </p>
        </div>

        {/* STATS BAR */}
        {stats && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, padding: '14px 20px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 8, flexWrap: 'wrap' }}>
            {[
              { v: stats.publishedCount, l: 'PUBLISHED PROFILES', c: '#F85B05' },
              { v: fmtUsd(stats.totalObservedProceeds), l: 'MIN. OBSERVED PROCEEDS', c: '#ef4444', raw: true },
              { v: stats.totalDocumentedWallets, l: 'DOCUMENTED WALLETS', c: '#8b5cf6' },
              { v: stats.totalLinkedTokens, l: 'LINKED LAUNCHES', c: '#ec4899' },
              { v: stats.profilesWithStrongEvidence, l: 'STRONG EVIDENCE', c: '#3b82f6' },
            ].map(s => (
              <div key={s.l} style={{ flex: 1, minWidth: 120 }}>
                <div style={{ color: s.c, fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>{s.raw ? s.v : String(s.v)}</div>
                <div style={{ color: '#6b7280', fontSize: 9, letterSpacing: '0.12em', fontFamily: 'monospace' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* CONTROLS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {SORT_TABS.map(t => (
            <button key={t.key} onClick={() => setSort(t.key)} style={{
              fontSize: 9, fontWeight: 900, letterSpacing: '0.15em', padding: '6px 14px', borderRadius: 4,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: sort === t.key ? '#F85B05' : '#111', color: sort === t.key ? '#fff' : '#4b5563',
            }}>{t.label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div className="kol-search-row" style={{ display: 'flex', gap: 6 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search handle..."
              className="kol-search-input"
              style={{ background: '#111', border: '1px solid #1e2330', borderRadius: 4, padding: '6px 12px', color: '#f9fafb', fontSize: 12, fontFamily: 'monospace', outline: 'none', width: 180, minWidth: 0 }}
            />
            <button onClick={doSearch} style={{ background: '#1e2330', border: 'none', borderRadius: 4, padding: '6px 12px', color: '#6b7280', fontSize: 9, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.1em', flexShrink: 0 }}>SEARCH</button>
          </div>
        </div>
        <style>{`
          @media (max-width: 640px) {
            .kol-search-row { width: 100%; }
            .kol-search-input { flex: 1; width: auto !important; }
          }
        `}</style>

        {/* TABLE */}
        {loading ? (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.15em', padding: '60px 0', textAlign: 'center' }}>LOADING LEADERBOARD...</div>
        ) : profiles.length === 0 ? (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', padding: '60px 0', textAlign: 'center' }}>NO PUBLISHED PROFILES</div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -16px', padding: '0 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 760 }}>
            {/* HEADER ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 100px 160px 80px 90px 60px 60px 70px', gap: 8, padding: '8px 16px', color: '#4b5563', fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em', alignItems: 'center' }}>
              <div>#</div>
              <div>HANDLE</div>
              <div>TIER</div>
              <div>OBSERVED PROCEEDS</div>
              <div>EVIDENCE</div>
              <div>COMPLETE</div>
              <div>FLAGS</div>
              <div>ITEMS</div>
              <div style={{ textAlign: 'right' }}>PROFILE</div>
            </div>

            {profiles.map((p, i) => {
              const d = DEPTH[p.evidenceDepth ?? 'none'] ?? DEPTH.none
              const co = COMP[p.completenessLevel ?? 'incomplete'] ?? COMP.incomplete
              const topFlag = p.behaviorFlags[0] ? FLAG_LABEL[p.behaviorFlags[0]] ?? p.behaviorFlags[0] : null
              return (
                <a key={p.handle} href={`/en/kol/${p.handle}`} style={{
                  textDecoration: 'none', display: 'grid',
                  gridTemplateColumns: '36px 1fr 100px 160px 80px 90px 60px 60px 70px',
                  gap: 8, padding: '14px 16px', background: '#0d1117', border: '1px solid #1e2330',
                  borderRadius: 6, alignItems: 'center', transition: 'border-color 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#F85B05')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2330')}
                >
                  {/* RANK */}
                  <div style={{ color: i < 3 ? '#F85B05' : '#374151', fontWeight: 900, fontFamily: 'monospace', fontSize: 14 }}>
                    {i + 1}
                  </div>

                  {/* HANDLE */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e2330', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F85B05', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                      {(p.displayName ?? p.handle).slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: '#f9fafb', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        @{p.handle}
                        {p.verified && <span style={{ marginLeft: 6, background: '#ef444422', color: '#ef4444', fontSize: 7, fontWeight: 900, padding: '1px 5px', borderRadius: 2, letterSpacing: '0.1em', verticalAlign: 'middle' }}>VERIFIED</span>}
                      </div>
                      {p.displayName && p.displayName !== p.handle && (
                        <div style={{ color: '#6b7280', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</div>
                      )}
                    </div>
                  </div>

                  {/* TIER */}
                  <div style={{ color: p.tier === 'HIGH' ? '#ef4444' : p.tier === 'MEDIUM' ? '#f59e0b' : '#6b7280', fontFamily: 'monospace', fontWeight: 800, fontSize: 12 }}>
                    {p.tier ?? '\u2014'}
                  </div>

                  {/* PROCEEDS */}
                  <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>
                    {p.observedProceedsTotal != null && p.observedProceedsTotal > 0 ? (
                      <span>
                        <span style={{ color: '#ef4444' }}>{proceedsLabel(p)}</span>
                        {p.proceedsCoverage && p.proceedsCoverage !== 'none' && (
                          <span style={{ marginLeft: 6 }}><Badge label={COVERAGE[p.proceedsCoverage] ?? ''} color={p.proceedsCoverage === 'verified' ? '#10b981' : '#f59e0b'} /></span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: '#374151' }}>\u2014</span>
                    )}
                  </div>

                  {/* EVIDENCE DEPTH */}
                  <div><Badge label={d.l} color={d.c} /></div>

                  {/* COMPLETENESS */}
                  <div><Badge label={co.l} color={co.c} /></div>

                  {/* FLAGS */}
                  <div title={topFlag ?? undefined} style={{ color: p.behaviorFlagsCount > 0 ? '#f97316' : '#374151', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
                    {p.behaviorFlagsCount > 0 ? p.behaviorFlagsCount : '\u2014'}
                  </div>

                  {/* EVIDENCE ITEMS */}
                  <div style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>
                    {p.evidenceCount}
                  </div>

                  {/* CTA */}
                  <div style={{ textAlign: 'right', color: '#F85B05', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}>
                    VIEW \u2192
                  </div>
                </a>
              )
            })}
          </div>
          </div>
        )}

        {/* MOBILE CARDS — shown below md */}
        <style>{`
          @media (max-width: 768px) {
            [data-grid-row] { display: none !important; }
          }
        `}</style>

        {/* CROSS-NAV */}
        <div style={{ marginTop: 48, borderTop: '1px solid #1a1a1a', paddingTop: 20, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#27272a', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>Go deeper</span>
          <a href="/en/watchlist" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>Check recent signals &rarr;</a>
          <a href="/en/explorer" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>See related cases &rarr;</a>
          <a href="/en/methodology" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>Methodology &rarr;</a>
        </div>
        <div style={{ marginTop: 16, color: '#1c1c1c', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
          Not financial advice — INTERLIGENS Intelligence © 2026
        </div>
      </div>
    </div>
  )
}
