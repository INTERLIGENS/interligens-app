'use client'
import BetaNav from "@/components/beta/BetaNav"
import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface SignalDetail {
  id: string; handle: string; platform: string; postUrl: string; postId: string
  discoveredAt: string; postedAt: string | null; sourceProvider: string; status: string
  signalScore: number; signalTypes: string[]; detectedTokens: string[]
  detectedAddresses: string[]; hasCA: boolean
  profile: { followers?: number; bio?: string; fetchedAt?: string } | null
}

interface KolContext {
  handle: string; displayName: string | null; tier: string | null; riskFlag: string | null
  totalProceeds: number | null; evidenceDepth: string | null; completenessLevel: string | null
  evidenceCount: number; walletsCount: number; casesCount: number; isPublished: boolean
}

interface RelatedSignal {
  id: string; postUrl: string; discoveredAt: string; postedAt: string | null
  signalTypes: string[]; signalScore: number
}

const SIGNAL_TYPE_LABEL: Record<string, { label: string; color: string; desc: string }> = {
  ca_drop:             { label: 'CA DROP',       color: '#ef4444', desc: 'Contract address posted directly' },
  ca_redirect:         { label: 'CA REDIRECT',   color: '#ef4444', desc: 'Redirect to CA via pinned, bio, or DM' },
  nice_pump:           { label: 'PUMP BRAG',     color: '#f97316', desc: 'Bragging about pump performance' },
  coded_bullish:       { label: 'CODED BULLISH', color: '#f59e0b', desc: 'Subtle bullish language ("has legs", "positioned")' },
  coordination_signal: { label: 'COORDINATION',  color: '#ec4899', desc: 'Language suggesting coordinated promotion' },
  discovery_narrative: { label: 'DISCOVERY',     color: '#8b5cf6', desc: 'Fake discovery narrative ("digging into", "noticed")' },
  launch_language:     { label: 'LAUNCH',        color: '#f97316', desc: 'Launch-related language (presale, whitelist, fair launch)' },
  promo_language:      { label: 'PROMO',         color: '#f59e0b', desc: 'Generic promotional language' },
  emoji_signal:        { label: 'EMOJI SIGNAL',  color: '#6b7280', desc: 'High-value emoji patterns detected' },
}

const DEPTH: Record<string, { l: string; c: string }> = {
  comprehensive: { l: 'COMPREHENSIVE', c: '#10b981' }, strong: { l: 'STRONG', c: '#3b82f6' },
  moderate: { l: 'MODERATE', c: '#f59e0b' }, weak: { l: 'WEAK', c: '#6b7280' },
}

const fmtUsd = (n: number | null) => {
  if (n == null || n === 0) return '\u2014'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

function scoreSeverity(score: number) {
  if (score >= 60) return { label: 'CRITICAL', color: '#ef4444' }
  if (score >= 40) return { label: 'HIGH', color: '#f97316' }
  if (score >= 25) return { label: 'MEDIUM', color: '#f59e0b' }
  return { label: 'LOW', color: '#6b7280' }
}

const timeAgo = (d: string | null) => {
  if (!d) return null; const diff = Date.now() - new Date(d).getTime(); const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24); if (days < 30) return `${days}d ago`; return `${Math.floor(days / 30)}mo ago`
}

const fmtDateFull = (d: string | null) => {
  if (!d) return ''; const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' at ' +
    dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{ background: color + '15', color, fontSize: 8, fontWeight: 900, padding: '3px 8px', borderRadius: 3, letterSpacing: '0.1em', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{label}</span>
)

export default function SignalDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [signal, setSignal] = useState<SignalDetail | null>(null)
  const [kol, setKol] = useState<KolContext | null>(null)
  const [related, setRelated] = useState<RelatedSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/watchlist/signals/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setSignal(d.signal); setKol(d.kol); setRelated(d.relatedSignals ?? []) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>
      <BetaNav />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', letterSpacing: '0.15em' }}>LOADING SIGNAL...</div>
      </div>
    </div>
  )

  if (error || !signal) return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#f9fafb', fontFamily: 'Inter, sans-serif' }}>
      <BetaNav />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ color: '#ef4444', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Signal not found</div>
        <a href="/en/watchlist" style={{ color: '#F85B05', fontSize: 12, fontFamily: 'monospace' }}>Back to Watchlist</a>
      </div>
    </div>
  )

  const sev = scoreSeverity(signal.signalScore)

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>

        {/* BREADCRUMB */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/en/watchlist" style={{ color: '#4b5563', fontSize: 11, fontFamily: 'monospace', textDecoration: 'none' }}>WATCHLIST</a>
          <span style={{ color: '#27272a' }}>/</span>
          <span style={{ color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>SIGNAL</span>
          <span style={{ color: '#27272a' }}>/</span>
          <span style={{ color: '#F85B05', fontSize: 11, fontFamily: 'monospace' }}>@{signal.handle}</span>
        </div>

        {/* HEADER */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e2330', display: 'flex', alignItems: 'center', justifyContent: 'center', color: sev.color, fontSize: 16, fontWeight: 900, flexShrink: 0 }}>
            {signal.handle.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>@{signal.handle}</h1>
              <Badge label={sev.label} color={sev.color} />
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#4b5563' }}>Score {signal.signalScore}</span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {timeAgo(signal.postedAt ?? signal.discoveredAt)} &middot; {fmtDateFull(signal.postedAt ?? signal.discoveredAt)}
            </div>
          </div>
        </div>

        {/* SIGNAL TYPES */}
        <div style={{ marginBottom: 24, padding: '16px 20px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10, borderLeft: `3px solid ${sev.color}` }}>
          <div style={{ color: '#F85B05', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 10 }}>DETECTED SIGNAL TYPES</div>
          {signal.signalTypes.length === 0 ? (
            <div style={{ color: '#374151', fontSize: 11, fontFamily: 'monospace' }}>No specific signal types classified</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {signal.signalTypes.map(t => {
                const st = SIGNAL_TYPE_LABEL[t]
                if (!st) return <Badge key={t} label={t} color="#6b7280" />
                return (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge label={st.label} color={st.color} />
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{st.desc}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* DETECTED ADDRESSES & TOKENS */}
        {(signal.detectedAddresses.length > 0 || signal.detectedTokens.length > 0) && (
          <div style={{ marginBottom: 24, padding: '16px 20px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10 }}>
            {signal.detectedAddresses.length > 0 && (
              <div style={{ marginBottom: signal.detectedTokens.length > 0 ? 12 : 0 }}>
                <div style={{ color: '#ef4444', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 6 }}>CONTRACT ADDRESSES DETECTED</div>
                {signal.detectedAddresses.map(addr => (
                  <div key={addr} style={{ fontSize: 11, fontFamily: 'monospace', color: '#f9fafb', padding: '4px 8px', background: '#111318', borderRadius: 4, marginBottom: 2, wordBreak: 'break-all' }}>
                    {addr}
                  </div>
                ))}
              </div>
            )}
            {signal.detectedTokens.length > 0 && (
              <div>
                <div style={{ color: '#f59e0b', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 6 }}>TOKENS MENTIONED</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {signal.detectedTokens.map(tok => <Badge key={tok} label={tok} color="#f59e0b" />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SOURCE */}
        <div style={{ marginBottom: 24, padding: '16px 20px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10 }}>
          <div style={{ color: '#4b5563', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 10 }}>SOURCE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            <div>
              <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'monospace' }}>POST</div>
              <a href={signal.postUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#F85B05', textDecoration: 'none', fontWeight: 600 }}>
                View on X &#x2197;
              </a>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'monospace' }}>PROVIDER</div>
              <div style={{ fontSize: 12, color: '#f9fafb' }}>{signal.sourceProvider}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'monospace' }}>DISCOVERED</div>
              <div style={{ fontSize: 12, color: '#f9fafb' }}>{fmtDateFull(signal.discoveredAt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'monospace' }}>POSTED</div>
              <div style={{ fontSize: 12, color: '#f9fafb' }}>{signal.postedAt ? fmtDateFull(signal.postedAt) : 'Unknown'}</div>
            </div>
            {signal.profile?.followers && (
              <div>
                <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'monospace' }}>FOLLOWERS AT TIME</div>
                <div style={{ fontSize: 12, color: '#f9fafb' }}>{signal.profile.followers.toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>

        {/* KOL CONTEXT */}
        {kol && (
          <div style={{ marginBottom: 24, padding: '16px 20px', background: '#0d1117', border: '1px solid #1e2330', borderRadius: 10, borderLeft: '3px solid #F85B05' }}>
            <div style={{ color: '#F85B05', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 10 }}>KOL DOSSIER — @{kol.handle}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 16px', marginBottom: 10 }}>
              {[
                { l: 'Tier', v: kol.tier ?? '\u2014', c: kol.tier === 'HIGH' ? '#ef4444' : '#f59e0b' },
                { l: 'Proceeds', v: fmtUsd(kol.totalProceeds), c: '#ef4444' },
                { l: 'Evidence', v: String(kol.evidenceCount), c: '#3b82f6' },
                { l: 'Wallets', v: String(kol.walletsCount), c: '#f59e0b' },
                { l: 'Cases', v: String(kol.casesCount), c: '#8b5cf6' },
                { l: 'Depth', v: DEPTH[kol.evidenceDepth ?? '']?.l ?? '\u2014', c: DEPTH[kol.evidenceDepth ?? '']?.c ?? '#374151' },
              ].map(x => (
                <div key={x.l} style={{ fontSize: 10, fontFamily: 'monospace' }}>
                  <span style={{ color: '#4b5563' }}>{x.l} </span>
                  <span style={{ color: x.c, fontWeight: 700 }}>{x.v}</span>
                </div>
              ))}
            </div>
            {kol.isPublished && (
              <a href={`/en/kol/${kol.handle}`} style={{ color: '#F85B05', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, textDecoration: 'none' }}>
                VIEW FULL DOSSIER {'\u2192'}
              </a>
            )}
          </div>
        )}

        {/* RELATED SIGNALS */}
        {related.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: '#6b7280', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 10 }}>OTHER RECENT SIGNALS FROM @{signal.handle.toUpperCase()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {related.map(r => {
                const rs = scoreSeverity(r.signalScore)
                return (
                  <a key={r.id} href={`/en/watchlist/signals/${r.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                    background: '#0d1117', border: '1px solid #1e2330', borderRadius: 4,
                    textDecoration: 'none', transition: 'border-color 0.15s', borderLeft: `2px solid ${rs.color}`,
                  }}
                    onMouseEnter={ev => (ev.currentTarget.style.borderColor = '#F85B05')}
                    onMouseLeave={ev => (ev.currentTarget.style.borderColor = '#1e2330')}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: rs.color, flexShrink: 0 }} />
                    <Badge label={rs.label} color={rs.color} />
                    {r.signalTypes.map(t => {
                      const st = SIGNAL_TYPE_LABEL[t]
                      return st ? <Badge key={t} label={st.label} color={st.color} /> : null
                    })}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace' }}>{timeAgo(r.postedAt ?? r.discoveredAt)}</span>
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* BACK */}
        <div style={{ marginTop: 32, borderTop: '1px solid #1a1a1a', paddingTop: 20 }}>
          <a href="/en/watchlist" style={{ color: '#F85B05', fontSize: 12, fontFamily: 'monospace', fontWeight: 700, textDecoration: 'none' }}>&larr; Back to Watchlist</a>
        </div>
      </div>
    </div>
  )
}
