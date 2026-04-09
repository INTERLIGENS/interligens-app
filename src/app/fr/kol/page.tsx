'use client'
import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

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
  comprehensive: { l: 'EXHAUSTIF',  c: '#10b981' },
  strong:        { l: 'SOLIDE',     c: '#3b82f6' },
  moderate:      { l: 'MODERE',     c: '#f59e0b' },
  weak:          { l: 'FAIBLE',     c: '#6b7280' },
  none:          { l: '\u2014',     c: '#374151' },
}
const COMP: Record<string, { l: string; c: string }> = {
  complete:    { l: 'COMPLET',      c: '#10b981' },
  substantial: { l: 'SUBSTANTIEL',  c: '#3b82f6' },
  partial:     { l: 'PARTIEL',      c: '#f59e0b' },
  incomplete:  { l: 'INCOMPLET',    c: '#6b7280' },
}
const COVERAGE: Record<string, string> = {
  verified: 'VERIFIE', partial: 'PARTIEL', estimated: 'ESTIME', none: '\u2014',
}
const FLAG_LABEL: Record<string, string> = {
  REPEATED_CASHOUT:       'Cashout repete',
  MULTI_HOP_TRANSFER:     'Multi-sauts',
  CROSS_CASE_RECURRENCE:  'Recurrence multi-cas',
  MULTI_LAUNCH_LINKED:    'Multi-lancements',
  LAUNDERING_INDICATORS:  'Indicateurs blanchiment',
  KNOWN_LINKED_WALLETS:   'Wallets lies',
  COORDINATED_PROMOTION:  'Promotion coordonnee',
}
const SORT_TABS: { key: Sort; label: string }[] = [
  { key: 'proceeds',     label: 'PAR PRODUITS' },
  { key: 'evidence',     label: 'PAR PREUVES' },
  { key: 'completeness', label: 'PAR COMPLETUDE' },
  { key: 'flags',        label: 'PAR ALERTES' },
  { key: 'recent',       label: 'RECENTS' },
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

export default function KolLeaderboardFR() {
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
      return 'Min. ' + fmtUsd(p.observedProceedsTotal) + ' observe'
    if (p.proceedsCoverage === 'verified')
      return fmtUsd(p.observedProceedsTotal) + ' verifie'
    return fmtUsd(p.observedProceedsTotal)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      {/* HEADER */}
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/fr" style={{ color: '#F85B05', fontSize: 11, fontWeight: 900, textDecoration: 'none', letterSpacing: '0.15em', fontFamily: 'monospace' }}>\u2190 INTERLIGENS</a>
        <span style={{ color: '#1f2937' }}>\u00b7</span>
        <span style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace' }}>CLASSEMENT INTELLIGENCE KOL</span>
        <span style={{ color: '#1f2937' }}>{'\u00b7'}</span>
        <a href="/fr/explorer" style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace', textDecoration: 'none' }}>EXPLORATEUR</a>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        {/* TITLE */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ color: '#F85B05', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 8 }}>REGISTRE PUBLIC</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Classement Intelligence KOL</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>
            Influenceurs documentes classes par produits observes, profondeur de preuves et completude d'investigation.
          </p>
        </div>

        {/* STATS BAR */}
        {stats && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, padding: '14px 20px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 8, flexWrap: 'wrap' }}>
            {[
              { v: stats.publishedCount, l: 'PROFILS PUBLIES', c: '#F85B05' },
              { v: fmtUsd(stats.totalObservedProceeds), l: 'MIN. PRODUITS OBSERVES', c: '#ef4444', raw: true },
              { v: stats.totalDocumentedWallets, l: 'WALLETS DOCUMENTES', c: '#8b5cf6' },
              { v: stats.totalLinkedTokens, l: 'LANCEMENTS LIES', c: '#ec4899' },
              { v: stats.profilesWithStrongEvidence, l: 'PREUVES SOLIDES', c: '#3b82f6' },
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
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Rechercher un handle..."
              style={{ background: '#111', border: '1px solid #1e2330', borderRadius: 4, padding: '6px 12px', color: '#f9fafb', fontSize: 12, fontFamily: 'monospace', outline: 'none', width: 180 }}
            />
            <button onClick={doSearch} style={{ background: '#1e2330', border: 'none', borderRadius: 4, padding: '6px 12px', color: '#6b7280', fontSize: 9, fontWeight: 900, cursor: 'pointer', letterSpacing: '0.1em' }}>CHERCHER</button>
          </div>
        </div>

        {/* TABLE — desktop */}
        {loading ? (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.15em', padding: '60px 0', textAlign: 'center' }}>CHARGEMENT...</div>
        ) : profiles.length === 0 ? (
          <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', padding: '60px 0', textAlign: 'center' }}>AUCUN PROFIL PUBLIE</div>
        ) : (
          <>
            {/* Desktop grid */}
            <div className="leaderboard-desktop" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 100px 160px 80px 90px 60px 60px 70px', gap: 8, padding: '8px 16px', color: '#4b5563', fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.1em', alignItems: 'center' }}>
                <div>#</div>
                <div>HANDLE</div>
                <div>TIER</div>
                <div>PRODUITS</div>
                <div>PREUVES</div>
                <div>COMPLETUDE</div>
                <div>ALERTES</div>
                <div>ITEMS</div>
                <div style={{ textAlign: 'right' }}>PROFIL</div>
              </div>

              {profiles.map((p, i) => {
                const d = DEPTH[p.evidenceDepth ?? 'none'] ?? DEPTH.none
                const co = COMP[p.completenessLevel ?? 'incomplete'] ?? COMP.incomplete
                const topFlag = p.behaviorFlags[0] ? FLAG_LABEL[p.behaviorFlags[0]] ?? p.behaviorFlags[0] : null
                return (
                  <Link key={p.handle} href={`/fr/kol/${p.handle}`} style={{
                    textDecoration: 'none', display: 'grid',
                    gridTemplateColumns: '36px 1fr 100px 160px 80px 90px 60px 60px 70px',
                    gap: 8, padding: '14px 16px', background: '#0d1117', border: '1px solid #1e2330',
                    borderRadius: 6, alignItems: 'center', transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#F85B05')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2330')}
                  >
                    <div style={{ color: i < 3 ? '#F85B05' : '#374151', fontWeight: 900, fontFamily: 'monospace', fontSize: 14 }}>
                      {i + 1}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e2330', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F85B05', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                        {(p.displayName ?? p.handle).slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#f9fafb', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          @{p.handle}
                          {p.verified && <span style={{ marginLeft: 6, background: '#ef444422', color: '#ef4444', fontSize: 7, fontWeight: 900, padding: '1px 5px', borderRadius: 2, letterSpacing: '0.1em', verticalAlign: 'middle' }}>VERIFIE</span>}
                        </div>
                        {p.displayName && p.displayName !== p.handle && (
                          <div style={{ color: '#6b7280', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</div>
                        )}
                      </div>
                    </div>

                    <div style={{ color: p.tier === 'HIGH' ? '#ef4444' : p.tier === 'MEDIUM' ? '#f59e0b' : '#6b7280', fontFamily: 'monospace', fontWeight: 800, fontSize: 12 }}>
                      {p.tier ?? '\u2014'}
                    </div>

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

                    <div><Badge label={d.l} color={d.c} /></div>
                    <div><Badge label={co.l} color={co.c} /></div>

                    <div title={topFlag ?? undefined} style={{ color: p.behaviorFlagsCount > 0 ? '#f97316' : '#374151', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
                      {p.behaviorFlagsCount > 0 ? p.behaviorFlagsCount : '\u2014'}
                    </div>

                    <div style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>{p.evidenceCount}</div>

                    <div style={{ textAlign: 'right', color: '#F85B05', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}>
                      VOIR \u2192
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Mobile cards */}
            <div className="leaderboard-mobile" style={{ display: 'none', flexDirection: 'column', gap: 12 }}>
              {profiles.map((p, i) => {
                const d = DEPTH[p.evidenceDepth ?? 'none'] ?? DEPTH.none
                const co = COMP[p.completenessLevel ?? 'incomplete'] ?? COMP.incomplete
                return (
                  <Link key={p.handle} href={`/fr/kol/${p.handle}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{ color: i < 3 ? '#F85B05' : '#374151', fontWeight: 900, fontFamily: 'monospace', fontSize: 18 }}>#{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#f9fafb', fontSize: 15, fontWeight: 700 }}>@{p.handle}</div>
                          {p.displayName && <div style={{ color: '#6b7280', fontSize: 11 }}>{p.displayName}</div>}
                        </div>
                        <div style={{ color: '#F85B05', fontSize: 10, fontWeight: 900, fontFamily: 'monospace' }}>VOIR \u2192</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {p.tier && <Badge label={p.tier} color={p.tier === 'HIGH' ? '#ef4444' : '#f59e0b'} />}
                        <Badge label={d.l} color={d.c} />
                        <Badge label={co.l} color={co.c} />
                        {p.behaviorFlagsCount > 0 && <Badge label={p.behaviorFlagsCount + ' ALERTES'} color="#f97316" />}
                      </div>
                      {p.observedProceedsTotal != null && p.observedProceedsTotal > 0 && (
                        <div style={{ color: '#ef4444', fontFamily: 'monospace', fontWeight: 800, fontSize: 14 }}>{proceedsLabel(p)}</div>
                      )}
                      {p.summary && <div style={{ color: '#4b5563', fontSize: 11, lineHeight: 1.5, marginTop: 8 }}>{p.summary}</div>}
                    </div>
                  </Link>
                )
              })}
            </div>

            <style>{`
              @media (max-width: 768px) {
                .leaderboard-desktop { display: none !important; }
                .leaderboard-mobile { display: flex !important; }
              }
            `}</style>
          </>
        )}

        {/* FOOTER */}
        <div style={{ marginTop: 48, borderTop: '1px solid #1e2330', paddingTop: 20, color: '#374151', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>Ne constitue pas un conseil financier \u2014 INTERLIGENS Intelligence \u00a9 2026</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/fr/methodology" style={{ color: '#4b5563', textDecoration: 'none' }}>METHODOLOGIE \u2192</Link>
            <Link href="/fr/correction" style={{ color: '#4b5563', textDecoration: 'none' }}>CORRECTION \u2192</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
