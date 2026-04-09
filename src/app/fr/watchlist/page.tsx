'use client'
import BetaNav from "@/components/beta/BetaNav"
import React, { useState, useEffect } from 'react'

/* ── types ─────────────────────────────────────────────── */

interface WatchEntry {
  handle: string; displayName: string; priority: 'high' | 'medium' | 'low'
  category: string; source: string; chainFocus: string; followerCount: number
  notes: string | null; hasProfile: boolean; tier: string | null; riskFlag: string | null
  totalProceeds: number | null; proceedsCoverage: string | null; evidenceDepth: string | null
  completenessLevel: string | null; behaviorFlags: string[]; behaviorFlagsCount: number
  rugCount: number | null; verified: boolean; evidenceCount: number; walletsCount: number
  casesCount: number; linkedTokensCount: number; isPublished: boolean
  lastUpdated: string | null; recentSignals: number; lastSignalAt: string | null
}

interface WatchStats {
  totalTracked: number; highPriority: number; withProfiles: number; withProceeds: number
  totalProceeds: number; totalEvidence: number; withRecentSignals: number
  totalRecentSignals: number; sources: number
}

interface SignalEntry {
  id: string; handle: string; postUrl: string; discoveredAt: string
  postedAt: string | null; signalScore: number; signalTypes: string[]
  detectedTokens: string[]; detectedAddresses: string[]; hasCA: boolean
}

interface CoordinationCluster {
  handles: string[]; window: string; signalCount: number; timestamp: string
}

type Filter = 'all' | 'high' | 'medium' | 'low'

/* ── constants ─────────────────────────────────────────── */

const PC: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' }
const PL: Record<string, string> = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }
const CAT_L: Record<string, string> = {
  paid_undisclosed: 'Paid Undisclosed', pump_fun_caller: 'Pump.fun Caller',
  legendary_meme_caller: 'Meme Caller', high_risk_memes: 'High Risk Memes',
  historic_calls: 'Historic Calls', package_deal_caller: 'Package Deal',
  tier2_caller: 'Tier 2 Caller', paid_multi_post: 'Paid Multi-Post',
  interligens_case: 'INTERLIGENS Case', community_callout: 'Community Callout',
  memescope_monday: 'Memescope', video_promo_undisclosed: 'Video Promo',
  zachxbt_leak: 'ZachXBT Leak', zachxbt_context: 'ZachXBT Context',
  kolscan_caller: 'KOLscan Caller', pump_fun_cofounder: 'Pump.fun Cofounder',
}
const CAT_C: Record<string, string> = {
  paid_undisclosed: '#ef4444', pump_fun_caller: '#f97316', legendary_meme_caller: '#f59e0b',
  high_risk_memes: '#ef4444', historic_calls: '#8b5cf6', package_deal_caller: '#ef4444',
  tier2_caller: '#f97316', paid_multi_post: '#ef4444', interligens_case: '#F85B05',
  community_callout: '#3b82f6', memescope_monday: '#ec4899', video_promo_undisclosed: '#ef4444',
  zachxbt_leak: '#ef4444', zachxbt_context: '#f59e0b', kolscan_caller: '#3b82f6',
  pump_fun_cofounder: '#f97316',
}
const SRC_L: Record<string, string> = {
  zachxbt_leak: 'ZachXBT', community_callout: 'Community', interligens_db: 'INTERLIGENS',
  memescope_monday: 'Memescope', zachxbt_context: 'ZachXBT', kolscan_caller: 'KOLscan',
  pump_fun_cofounder: 'Public record',
}
const SIG_L: Record<string, { label: string; color: string }> = {
  ca_drop: { label: 'CA DROP', color: '#ef4444' }, ca_redirect: { label: 'CA REDIRECT', color: '#ef4444' },
  nice_pump: { label: 'PUMP BRAG', color: '#f97316' }, coded_bullish: { label: 'CODED BULLISH', color: '#f59e0b' },
  coordination_signal: { label: 'COORDINATION', color: '#ec4899' }, discovery_narrative: { label: 'DISCOVERY', color: '#8b5cf6' },
  launch_language: { label: 'LAUNCH', color: '#f97316' }, promo_language: { label: 'PROMO', color: '#f59e0b' },
  emoji_signal: { label: 'EMOJI', color: '#6b7280' },
}

/* ── helpers ───────────────────────────────────────────── */

const fmtUsd = (n: number | null | undefined) => {
  if (n == null || n === 0) return '\u2014'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}
const fmtF = (n: number) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(0) + 'K' : n > 0 ? String(n) : '\u2014'
const timeAgo = (d: string | null) => {
  if (!d) return null; const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  const days = Math.floor(h / 24); if (days < 30) return `${days}j`; return `${Math.floor(days / 30)}mo`
}
const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{ background: color + '15', color, fontSize: 8, fontWeight: 900, padding: '3px 8px', borderRadius: 3, letterSpacing: '0.1em', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{label}</span>
)
function severity(score: number) {
  if (score >= 60) return { label: 'CRITIQUE', color: '#ef4444' }
  if (score >= 40) return { label: 'HAUT', color: '#f97316' }
  if (score >= 25) return { label: 'MOYEN', color: '#f59e0b' }
  return { label: 'BAS', color: '#6b7280' }
}
function depthScore(e: WatchEntry): number {
  let s = 0; if (e.hasProfile) s++; if (e.evidenceCount > 0) s++; if ((e.totalProceeds ?? 0) > 0) s++; if (e.walletsCount > 0) s++; return s
}
function depthLabel(s: number): { label: string; color: string } {
  if (s >= 4) return { label: 'PROFONDE', color: '#10b981' }
  if (s >= 3) return { label: 'FORTE', color: '#3b82f6' }
  if (s >= 2) return { label: 'PARTIELLE', color: '#f59e0b' }
  if (s >= 1) return { label: 'MINCE', color: '#6b7280' }
  return { label: 'SUIVI', color: '#374151' }
}

/* ── page ──────────────────────────────────────────────── */

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchEntry[]>([])
  const [stats, setStats] = useState<WatchStats | null>(null)
  const [signals, setSignals] = useState<SignalEntry[]>([])
  const [coordination, setCoordination] = useState<CoordinationCluster[]>([])
  const [signalsMeta, setSignalsMeta] = useState<{ total: number; coordinationClusters: number } | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [signalsLoading, setSignalsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/watchlist').then(r => r.json()).then(d => { setEntries(d.entries ?? []); setStats(d.stats ?? null) }).catch(() => {}).finally(() => setLoading(false))
    fetch('/api/watchlist/signals').then(r => r.json()).then(d => { setSignals(d.signals ?? []); setCoordination(d.coordination ?? []); setSignalsMeta(d.meta ?? null) }).catch(() => {}).finally(() => setSignalsLoading(false))
  }, [])

  const filtered = entries.filter(e => {
    if (filter !== 'all' && e.priority !== filter) return false
    if (search) { const q = search.toLowerCase(); return e.handle.toLowerCase().includes(q) || e.displayName.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) }
    return true
  })

  const criticalSignals = signals.filter(s => s.signalScore >= 40).slice(0, 5)
  const recentSignals = signals.slice(0, 8)
  const needsReview = entries.filter(e => e.hasProfile && !e.isPublished && e.priority === 'high').slice(0, 4)

  const highConcern = entries
    .filter(e => e.priority === 'high')
    .sort((a, b) => {
      const sa = (a.totalProceeds ?? 0) / 1000 + a.evidenceCount * 10 + a.recentSignals * 5 + a.behaviorFlagsCount * 8
      const sb = (b.totalProceeds ?? 0) / 1000 + b.evidenceCount * 10 + b.recentSignals * 5 + b.behaviorFlagsCount * 8
      return sb - sa
    })
    .slice(0, 6)

  const mostActive = entries.filter(e => e.recentSignals > 0).sort((a, b) => b.recentSignals - a.recentSignals).slice(0, 5)

  // Depth counts
  const dc = { deep: 0, strong: 0, partial: 0, thin: 0, tracked: 0 }
  for (const e of entries) { const d = depthScore(e); if (d >= 4) dc.deep++; else if (d >= 3) dc.strong++; else if (d >= 2) dc.partial++; else if (d >= 1) dc.thin++; else dc.tracked++ }

  const showLiveActivity = !loading && !signalsLoading && (criticalSignals.length > 0 || recentSignals.length > 0 || needsReview.length > 0 || coordination.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>

        {/* ═══ HERO ═══ */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ color: '#F85B05', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace' }}>SURVEILLANCE ACTIVE</div>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s ease-in-out infinite' }} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Watchlist<span style={{ color: '#F85B05' }}>.</span></h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4, maxWidth: 580 }}>
            Suivi actif des comptes a fort impact. Analyse des calls, lancements, wallets, profits et coordination.
          </p>
        </div>

        {/* ═══ STATS ═══ */}
        {stats && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, padding: '12px 20px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 8, flexWrap: 'wrap' }}>
            {[
              { v: stats.totalTracked, l: 'SUIVIS', c: '#F85B05' },
              { v: stats.highPriority, l: 'HAUTE PRIORITE', c: '#ef4444' },
              { v: stats.withProfiles, l: 'DOSSIERS', c: '#8b5cf6' },
              { v: fmtUsd(stats.totalProceeds), l: 'PROFITS MIN.', c: '#ef4444', raw: true },
              { v: stats.totalEvidence, l: 'PREUVES', c: '#3b82f6' },
              { v: stats.totalRecentSignals, l: 'SIGNAUX 30J', c: '#10b981' },
            ].map(s => (
              <div key={s.l} style={{ flex: 1, minWidth: 80 }}>
                <div style={{ color: s.c, fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>{s.raw ? s.v : String(s.v)}</div>
                <div style={{ color: '#6b7280', fontSize: 8, letterSpacing: '0.12em', fontFamily: 'monospace' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ 1. LIVE ACTIVITY — compact strip ═══ */}
        {showLiveActivity && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', animation: 'pulse 2s ease-in-out infinite' }} />
              <div style={{ color: '#10b981', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace' }}>ACTIVITE EN COURS</div>
              {signalsMeta && signalsMeta.total > 0 && <span style={{ fontSize: 9, color: '#374151', fontFamily: 'monospace' }}>{signalsMeta.total} signaux sur 30j</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Critical / recent signals — compact inline rows */}
              {(criticalSignals.length > 0 ? criticalSignals : recentSignals.slice(0, 5)).map(s => {
                const sv = severity(s.signalScore)
                return (
                  <a key={s.id} href={`/en/watchlist/signals/${s.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                    background: '#0d1117', border: '1px solid #1e2330', borderRadius: 4,
                    borderLeft: `2px solid ${sv.color}`, textDecoration: 'none', transition: 'background 0.12s',
                  }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = '#111318')}
                    onMouseLeave={ev => (ev.currentTarget.style.background = '#0d1117')}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: sv.color, flexShrink: 0, boxShadow: s.signalScore >= 40 ? `0 0 5px ${sv.color}` : 'none' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f9fafb', minWidth: 80 }}>@{s.handle}</span>
                    <Badge label={sv.label} color={sv.color} />
                    {s.signalTypes.slice(0, 2).map(t => { const st = SIG_L[t]; return st ? <Badge key={t} label={st.label} color={st.color} /> : null })}
                    {s.hasCA && <Badge label="CA" color="#ef4444" />}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 9, color: '#4b5563', fontFamily: 'monospace' }}>{timeAgo(s.postedAt ?? s.discoveredAt)}</span>
                  </a>
                )
              })}

              {/* Coordination + review — inline row below signals */}
              {(coordination.length > 0 || needsReview.length > 0) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {/* Coordination clusters inline */}
                  {coordination.slice(0, 2).map((c, i) => (
                    <div key={`coord-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 4, borderLeft: '2px solid #ec4899' }}>
                      <Badge label="COORDINATION" color="#ec4899" />
                      <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#f9fafb' }}>{c.handles.slice(0, 3).map(h => '@' + h).join(' ')}{c.handles.length > 3 ? ` +${c.handles.length - 3}` : ''}</span>
                      <Badge label={`${c.signalCount} SIG`} color="#f59e0b" />
                    </div>
                  ))}
                  {/* Review needed inline */}
                  {needsReview.map(e => (
                    <div key={e.handle} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 4, borderLeft: '2px solid #f59e0b' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#f9fafb' }}>@{e.handle}</span>
                      <Badge label="A EXAMINER" color="#f59e0b" />
                      {e.evidenceCount > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#3b82f6' }}>{e.evidenceCount} ev.</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ 2. HIGHEST CONCERN ═══ */}
        {!loading && highConcern.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: '#ef4444', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 10 }}>PLUS HAUTE VIGILANCE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
              {highConcern.map(e => {
                const lastAct = timeAgo(e.lastSignalAt)
                const dl = depthLabel(depthScore(e))
                return (
                  <div key={e.handle} style={{
                    background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10, padding: '14px 18px',
                    borderLeft: `3px solid ${PC[e.priority]}`, transition: 'border-color 0.15s',
                    cursor: e.isPublished ? 'pointer' : 'default',
                  }}
                    onClick={() => { if (e.isPublished) window.location.href = `/fr/kol/${e.handle}` }}
                    onMouseEnter={ev => (ev.currentTarget.style.borderColor = '#F85B05')}
                    onMouseLeave={ev => { ev.currentTarget.style.borderColor = '#1e2330'; ev.currentTarget.style.borderLeftColor = PC[e.priority] }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1e2330', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F85B05', fontSize: 10, fontWeight: 800 }}>
                        {e.displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>@{e.handle}</div>
                        <div style={{ fontSize: 9, color: '#6b7280' }}>
                          {e.followerCount > 0 ? fmtF(e.followerCount) + ' followers' : ''}
                          {lastAct && <> &middot; <span style={{ color: '#10b981' }}>signal {lastAct}</span></>}
                        </div>
                      </div>
                      <Badge label={dl.label} color={dl.color} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                      {(e.totalProceeds ?? 0) > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace' }}><span style={{ color: '#4b5563' }}>$ </span><span style={{ color: '#ef4444', fontWeight: 700 }}>{fmtUsd(e.totalProceeds)}</span></span>}
                      {e.evidenceCount > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace' }}><span style={{ color: '#4b5563' }}>ev </span><span style={{ color: '#3b82f6', fontWeight: 700 }}>{e.evidenceCount}</span></span>}
                      {e.casesCount > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace' }}><span style={{ color: '#4b5563' }}>cases </span><span style={{ color: '#8b5cf6', fontWeight: 700 }}>{e.casesCount}</span></span>}
                      {e.walletsCount > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace' }}><span style={{ color: '#4b5563' }}>wallets </span><span style={{ color: '#f59e0b', fontWeight: 700 }}>{e.walletsCount}</span></span>}
                      {e.recentSignals > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace' }}><span style={{ color: '#4b5563' }}>sig </span><span style={{ color: '#10b981', fontWeight: 700 }}>{e.recentSignals}</span></span>}
                      {e.behaviorFlagsCount > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace' }}><span style={{ color: '#4b5563' }}>flags </span><span style={{ color: '#f97316', fontWeight: 700 }}>{e.behaviorFlagsCount}</span></span>}
                    </div>
                    {e.behaviorFlagsCount > 0 && (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
                        {e.behaviorFlags.slice(0, 2).map(f => <Badge key={f} label={f.replace(/_/g, ' ')} color="#f97316" />)}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Badge label={CAT_L[e.category] ?? e.category} color={CAT_C[e.category] ?? '#6b7280'} />
                      {e.isPublished ? <span style={{ color: '#F85B05', fontSize: 9, fontFamily: 'monospace', fontWeight: 700 }}>DOSSIER {'\u2192'}</span>
                        : <span style={{ color: '#374151', fontSize: 9, fontFamily: 'monospace', fontWeight: 700 }}>EN COURS D&apos;ANALYSE</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ 3. FULL TABLE ═══ */}
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ color: '#F85B05', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace' }}>TOUS LES COMPTES SUIVIS</div>
            <div style={{ flex: 1 }} />
            {(['all', 'high', 'medium', 'low'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                fontSize: 8, fontWeight: 900, letterSpacing: '0.15em', padding: '4px 10px', borderRadius: 3,
                cursor: 'pointer', border: 'none', transition: 'all 0.12s', textTransform: 'uppercase',
                background: filter === f ? '#F85B05' : '#111', color: filter === f ? '#fff' : '#4b5563',
              }}>{f === 'all' ? 'TOUS' : f.toUpperCase()}</button>
            ))}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              style={{ background: '#111', border: '1px solid #1e2330', borderRadius: 3, padding: '4px 8px', color: '#f9fafb', fontSize: 11, fontFamily: 'monospace', outline: 'none', width: 140 }} />
          </div>

          {loading ? (
            <div style={{ color: '#374151', fontSize: 11, fontFamily: 'monospace', padding: '40px 0', textAlign: 'center' }}>CHARGEMENT...</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: '#374151', fontSize: 11, fontFamily: 'monospace', padding: '40px 0', textAlign: 'center' }}>AUCUN RESULTAT</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 70px 80px 70px 50px 50px 60px 60px', gap: 6, padding: '6px 14px', color: '#4b5563', fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.1em', alignItems: 'center' }}>
                <div>#</div><div>COMPTE</div><div>PRIORITE</div><div>CATEGORIE</div><div>PROFITS</div><div>EV.</div><div>FLAGS</div><div>DEPTH</div><div style={{ textAlign: 'right' }}>STATUT</div>
              </div>
              {filtered.map((e, i) => {
                const dl = depthLabel(depthScore(e))
                return (
                  <div key={e.handle} style={{
                    display: 'grid', gridTemplateColumns: '28px 1fr 70px 80px 70px 50px 50px 60px 60px',
                    gap: 6, padding: '10px 14px', background: '#0d1117', border: '1px solid #1e2330',
                    borderRadius: 4, alignItems: 'center', transition: 'border-color 0.15s',
                    cursor: e.isPublished ? 'pointer' : 'default',
                  }}
                    onClick={() => { if (e.isPublished) window.location.href = `/fr/kol/${e.handle}` }}
                    onMouseEnter={ev => (ev.currentTarget.style.borderColor = '#F85B05')}
                    onMouseLeave={ev => (ev.currentTarget.style.borderColor = '#1e2330')}
                  >
                    <div style={{ color: e.priority === 'high' ? '#ef4444' : '#374151', fontWeight: 900, fontFamily: 'monospace', fontSize: 11 }}>{i + 1}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1e2330', display: 'flex', alignItems: 'center', justifyContent: 'center', color: PC[e.priority], fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{e.displayName.slice(0, 1).toUpperCase()}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: '#f9fafb', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{e.handle}</span>
                          {e.hasProfile && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#F85B05', display: 'inline-block' }} />}
                        </div>
                        <div style={{ color: '#4b5563', fontSize: 9 }}>{e.followerCount > 0 ? fmtF(e.followerCount) : ''}{e.followerCount > 0 && e.source ? ' \u00B7 ' : ''}{SRC_L[e.source] ?? ''}</div>
                      </div>
                    </div>
                    <div><Badge label={PL[e.priority]} color={PC[e.priority]} /></div>
                    <div style={{ fontSize: 9, color: CAT_C[e.category] ?? '#6b7280', fontWeight: 600 }}>{CAT_L[e.category] ?? e.category}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>
                      {(e.totalProceeds ?? 0) > 0 ? <span style={{ color: '#ef4444' }}>{fmtUsd(e.totalProceeds)}</span> : <span style={{ color: '#272727' }}>{'\u2014'}</span>}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: e.evidenceCount > 0 ? '#3b82f6' : '#272727' }}>{e.evidenceCount || '\u2014'}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: e.behaviorFlagsCount > 0 ? '#f97316' : '#272727' }}>{e.behaviorFlagsCount || '\u2014'}</div>
                    <div><Badge label={dl.label} color={dl.color} /></div>
                    <div style={{ textAlign: 'right' }}>
                      {e.isPublished ? <span style={{ color: '#F85B05', fontSize: 9, fontFamily: 'monospace', fontWeight: 700 }}>VOIR {'\u2192'}</span>
                        : e.hasProfile ? <Badge label="A EXAMINER" color="#f59e0b" />
                        : <span style={{ color: '#272727', fontSize: 9, fontFamily: 'monospace' }}>{'\u2014'}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ═══ 4. INTELLIGENCE STATUS — secondary footer ═══ */}
        {!loading && entries.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 28, flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 280, background: '#0d1117', border: '1px solid #1e2330', borderRadius: 8, padding: '10px 16px' }}>
              <div style={{ color: '#F85B05', fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', fontFamily: 'monospace', marginBottom: 6 }}>PROFONDEUR D&apos;INTELLIGENCE</div>
              <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                {[{ v: dc.deep, c: '#10b981' }, { v: dc.strong, c: '#3b82f6' }, { v: dc.partial, c: '#f59e0b' }, { v: dc.thin, c: '#6b7280' }, { v: dc.tracked, c: '#1e2330' }].map((d, i) => (
                  <div key={i} style={{ width: `${(d.v / (entries.length || 1)) * 100}%`, background: d.c }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[{ l: 'Profonde', v: dc.deep, c: '#10b981' }, { l: 'Forte', v: dc.strong, c: '#3b82f6' }, { l: 'Partielle', v: dc.partial, c: '#f59e0b' }, { l: 'Mince', v: dc.thin, c: '#6b7280' }, { l: 'Suivi', v: dc.tracked, c: '#374151' }].map(d => (
                  <span key={d.l} style={{ fontSize: 9, fontFamily: 'monospace' }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: d.c, marginRight: 3, verticalAlign: 'middle' }} />
                    <span style={{ color: '#4b5563' }}>{d.l} </span><span style={{ color: d.c, fontWeight: 700 }}>{d.v}</span>
                  </span>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200, background: '#0d1117', border: '1px solid #1e2330', borderRadius: 8, padding: '10px 16px' }}>
              <div style={{ color: '#10b981', fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', fontFamily: 'monospace', marginBottom: 6 }}>PLUS ACTIFS 30J</div>
              {mostActive.length === 0 ? (
                <div style={{ fontSize: 9, color: '#272727', fontFamily: 'monospace' }}>Pas d&apos;activite recente</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {mostActive.slice(0, 3).map((e, i) => (
                    <div key={e.handle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 800, color: '#10b981', width: 12 }}>{i + 1}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#f9fafb', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{e.handle}</span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#10b981' }}>{e.recentSignals}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 180, background: '#0d1117', border: '1px solid #1e2330', borderRadius: 8, padding: '10px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 4px #10b981' }} />
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'monospace', color: '#10b981' }}>WATCHER V2</span>
              </div>
              <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.5 }}>CA drops &middot; coded bullish &middot; pump brags &middot; coordination &middot; cashout patterns</div>
            </div>
          </div>
        )}

        {/* CROSS-NAV */}
        <div style={{ marginTop: 28, borderTop: '1px solid #1a1a1a', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#27272a', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Voir aussi</span>
          <a href="/fr/kol" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>Registre KOL &rarr;</a>
          <a href="/fr/explorer" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>Explorateur de cas &rarr;</a>
          <a href="/fr/methodology" style={{ fontSize: 12, fontWeight: 600, color: '#52525b', textDecoration: 'none' }}>Methodologie &rarr;</a>
        </div>
        <div style={{ marginTop: 12, color: '#1c1c1c', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em' }}>Observations uniquement &middot; INTERLIGENS Intelligence &copy; 2026</div>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
