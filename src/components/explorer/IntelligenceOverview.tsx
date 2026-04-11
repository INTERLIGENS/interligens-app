'use client'
import React, { useEffect, useState } from 'react'

interface LeaderProfile {
  handle: string
  displayName?: string
  tier?: string
  observedProceedsTotal: number | null
  proceedsCoverage?: string
  evidenceCount: number
  documentedWalletsCount: number
  linkedTokensCount: number
  verified: boolean
}

interface LeaderStats {
  publishedCount: number
  totalObservedProceeds: number
  totalDocumentedWallets: number
  totalLinkedTokens: number
  profilesWithProceeds: number
  profilesWithStrongEvidence: number
}

const STR = {
  en: {
    eyebrow: 'INTELLIGENCE OVERVIEW',
    documented: 'TOTAL DOCUMENTED',
    profiles: 'PUBLISHED ACTORS',
    wallets: 'WALLETS ON FILE',
    tokens: 'TOKENS LINKED',
    knownActors: 'KNOWN ACTORS',
    knownActorsHelp: 'Top documented actors by observed proceeds. Click any row for the full case file.',
    rank: '#',
    handle: 'HANDLE',
    proceeds: 'OBSERVED PROCEEDS',
    items: 'EVIDENCE',
    open: 'PROFILE',
    seeAll: 'See full leaderboard \u2192',
    noActors: 'No published actors yet.',
    victimsLine: '963 LOUD victims · BOTIFY · VINE · $TRUMP — $5,773,000+ documented in BOTIFY alone',
    coverPartial: 'PARTIAL',
    coverSubst: 'SUBSTANTIAL',
    coverVerified: 'VERIFIED',
    minLabel: 'Min.',
    observed: 'observed',
    loading: 'Loading intelligence overview...',
  },
  fr: {
    eyebrow: 'APERCU INTELLIGENCE',
    documented: 'TOTAL DOCUMENTE',
    profiles: 'ACTEURS PUBLIES',
    wallets: 'WALLETS EN BASE',
    tokens: 'TOKENS LIES',
    knownActors: 'ACTEURS CONNUS',
    knownActorsHelp: 'Top des acteurs documentes par produits observes. Cliquez une ligne pour le dossier complet.',
    rank: '#',
    handle: 'HANDLE',
    proceeds: 'PRODUITS OBSERVES',
    items: 'PREUVES',
    open: 'PROFIL',
    seeAll: 'Voir le classement complet \u2192',
    noActors: 'Aucun acteur publie pour le moment.',
    victimsLine: '963 victimes LOUD · BOTIFY · VINE · $TRUMP — $5,773,000+ documentes rien que sur BOTIFY',
    coverPartial: 'PARTIELLE',
    coverSubst: 'SUBSTANTIELLE',
    coverVerified: 'VERIFIEE',
    minLabel: 'Min.',
    observed: 'observes',
    loading: 'Chargement de l\u0027apercu...',
  },
} as const

const fmtUsd = (n: number | null | undefined) => {
  if (n == null || n === 0) return '\u2014'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'
  return '$' + n.toLocaleString('en-US')
}

const ACCENT = '#FF6B00'
const RED = '#ef4444'
const TEXT = '#FFFFFF'
const MUTED = '#6b7280'
const DIM = '#374151'
const BORDER = '#1A1A1A'
const CARD = '#111111'

export default function IntelligenceOverview({ locale }: { locale: 'en' | 'fr' }) {
  const t = STR[locale]
  const [profiles, setProfiles] = useState<LeaderProfile[]>([])
  const [stats, setStats] = useState<LeaderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const kolHref = `/${locale}/kol`

  useEffect(() => {
    let cancelled = false
    fetch('/api/kol/leaderboard?sort=proceeds')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        setProfiles(Array.isArray(d?.profiles) ? d.profiles : [])
        setStats(d?.stats ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const top = profiles.slice(0, 10)

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Eyebrow */}
      <div
        style={{
          color: ACCENT,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.2em',
          fontFamily: 'monospace',
          marginBottom: 10,
        }}
      >
        {t.eyebrow}
      </div>

      {/* Big counter card */}
      <div
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
          <div
            style={{
              fontSize: 38,
              fontWeight: 900,
              color: RED,
              fontFamily: 'monospace',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {loading ? '...' : stats ? fmtUsd(stats.totalObservedProceeds) : '\u2014'}
          </div>
          <div
            style={{
              color: MUTED,
              fontSize: 11,
              fontFamily: 'monospace',
              letterSpacing: '0.12em',
            }}
          >
            {t.documented}
          </div>
        </div>

        {/* Sub stats row */}
        <div
          style={{
            display: 'flex',
            gap: 28,
            marginTop: 18,
            flexWrap: 'wrap',
          }}
        >
          {[
            { v: stats?.publishedCount ?? 0, l: t.profiles, c: ACCENT },
            { v: stats?.totalDocumentedWallets ?? 0, l: t.wallets, c: '#8b5cf6' },
            { v: stats?.totalLinkedTokens ?? 0, l: t.tokens, c: '#ec4899' },
          ].map(s => (
            <div key={s.l}>
              <div
                style={{
                  color: s.c,
                  fontSize: 18,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                }}
              >
                {loading ? '...' : s.v}
              </div>
              <div
                style={{
                  color: MUTED,
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  fontFamily: 'monospace',
                }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>

        {/* Victims line */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${BORDER}`,
            color: '#a1a1aa',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {t.victimsLine}
        </div>
      </div>

      {/* Known actors mini-leaderboard */}
      <div
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '20px 24px',
          marginBottom: 32,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                color: TEXT,
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '0.05em',
                fontFamily: 'monospace',
              }}
            >
              {t.knownActors}
            </div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>
              {t.knownActorsHelp}
            </div>
          </div>
          <a
            href={kolHref}
            style={{
              color: ACCENT,
              fontSize: 11,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textDecoration: 'none',
            }}
          >
            {t.seeAll}
          </a>
        </div>

        {loading ? (
          <div
            style={{
              color: DIM,
              fontSize: 11,
              fontFamily: 'monospace',
              padding: '24px 0',
              textAlign: 'center',
              letterSpacing: '0.1em',
            }}
          >
            {t.loading}
          </div>
        ) : top.length === 0 ? (
          <div
            style={{
              color: DIM,
              fontSize: 11,
              fontFamily: 'monospace',
              padding: '24px 0',
              textAlign: 'center',
              letterSpacing: '0.1em',
            }}
          >
            {t.noActors}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 160px 70px 70px',
                gap: 8,
                padding: '6px 12px',
                color: '#52525b',
                fontSize: 9,
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
              }}
            >
              <div>{t.rank}</div>
              <div>{t.handle}</div>
              <div>{t.proceeds}</div>
              <div>{t.items}</div>
              <div style={{ textAlign: 'right' }}>{t.open}</div>
            </div>
            {top.map((p, i) => {
              const tierColor =
                p.tier === 'HIGH'
                  ? RED
                  : p.tier === 'MEDIUM'
                  ? '#f59e0b'
                  : '#52525b'
              return (
                <a
                  key={p.handle}
                  href={`/${locale}/kol/${p.handle}`}
                  style={{
                    textDecoration: 'none',
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr 160px 70px 70px',
                    gap: 8,
                    padding: '12px',
                    background: '#0a0a0a',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 6,
                    alignItems: 'center',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = ACCENT)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
                >
                  <div
                    style={{
                      color: i < 3 ? ACCENT : DIM,
                      fontWeight: 900,
                      fontFamily: 'monospace',
                      fontSize: 13,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        color: TEXT,
                        fontSize: 12,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: 'monospace',
                      }}
                    >
                      @{p.handle}
                    </div>
                    {p.tier && (
                      <span
                        style={{
                          color: tierColor,
                          fontSize: 8,
                          fontWeight: 900,
                          background: tierColor + '18',
                          padding: '2px 6px',
                          borderRadius: 3,
                          fontFamily: 'monospace',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {p.tier}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: p.observedProceedsTotal && p.observedProceedsTotal > 0 ? RED : DIM,
                    }}
                  >
                    {p.observedProceedsTotal && p.observedProceedsTotal > 0
                      ? (p.proceedsCoverage === 'partial' || p.proceedsCoverage === 'estimated'
                          ? `${t.minLabel} ${fmtUsd(p.observedProceedsTotal)} ${t.observed}`
                          : fmtUsd(p.observedProceedsTotal))
                      : '\u2014'}
                  </div>
                  <div
                    style={{
                      color: MUTED,
                      fontFamily: 'monospace',
                      fontSize: 11,
                    }}
                  >
                    {p.evidenceCount}
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      color: ACCENT,
                      fontSize: 9,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                    }}
                  >
                    {'VIEW \u2192'}
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
