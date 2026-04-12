'use client'
import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// IntelligenceBadge — Case Intelligence signal overlay for scan results.
//
// Shows: OFAC MATCH (red) · AMF/FCA (amber) · Scam DB (orange)
//        "Listed in [N] intelligence sources"
//
// NEVER rendered if:
//   - displaySafety === "SUPPRESSED" / "INTERNAL_ONLY"
//   - entity type === "PERSON"
// These gates are enforced BOTH here (UI) and at Prisma query level (API).
// ─────────────────────────────────────────────────────────────────────────────

export interface IntelligenceSignal {
  match: boolean
  ims: number
  ics: number
  matchCount: number
  hasSanction: boolean
  topRiskClass: string | null
  sourceSlug: string | null
  externalUrl: string | null
  matchBasis: string | null
  displaySafety?: string
  entityType?: string
}

interface Props {
  signal: IntelligenceSignal | null
  locale: 'en' | 'fr'
  loading?: boolean
}

const CARD_BG = '#111111'

const ShieldIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M8 1L2 4V7.5C2 11.09 4.56 14.41 8 15.5C11.44 14.41 14 11.09 14 7.5V4L8 1Z"
      stroke={color}
      strokeWidth="1.2"
      strokeLinejoin="round"
      fill="none"
    />
    <path d="M6 8L7.5 9.5L10 6.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const BADGE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  ofac: { bg: '#DC262620', border: '#DC2626', text: '#FCA5A5' },
  amf: { bg: '#F59E0B20', border: '#F59E0B', text: '#FDE68A' },
  fca: { bg: '#F59E0B20', border: '#F59E0B', text: '#FDE68A' },
  scamsniffer: { bg: '#FF6B0020', border: '#FF6B00', text: '#FDBA74' },
  forta: { bg: '#FF6B0020', border: '#FF6B00', text: '#FDBA74' },
  goplus: { bg: '#FF6B0020', border: '#FF6B00', text: '#FDBA74' },
}

function SourceBadge({ slug, locale }: { slug: string; locale: 'en' | 'fr' }) {
  const style = BADGE_STYLES[slug] ?? BADGE_STYLES.goplus
  const labels: Record<string, Record<string, string>> = {
    ofac: { en: 'OFAC MATCH', fr: 'OFAC' },
    amf: { en: 'AMF BLACKLIST', fr: 'LISTE NOIRE AMF' },
    fca: { en: 'FCA WARNING', fr: 'ALERTE FCA' },
    scamsniffer: { en: 'SCAM DB', fr: 'BASE SCAM' },
    forta: { en: 'FORTA ALERT', fr: 'ALERTE FORTA' },
    goplus: { en: 'GOPLUS', fr: 'GOPLUS' },
  }
  const label = labels[slug]?.[locale] ?? slug.toUpperCase()

  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 9,
        fontWeight: 900,
        fontFamily: 'monospace',
        letterSpacing: '0.12em',
        color: style.text,
        background: style.bg,
        border: `1px solid ${style.border}66`,
        borderRadius: 4,
        padding: '2px 8px',
      }}
    >
      {label}
    </span>
  )
}

export default function IntelligenceBadge({ signal, locale, loading }: Props) {
  // Gate: never render while loading
  if (loading) return null

  // Gate: no signal or no match
  if (!signal || !signal.match) return null

  // Gate: PERSON-type entities — NEVER retail-visible
  if (signal.entityType === 'PERSON') return null

  // Gate: displaySafety — only show RETAIL_SAFE
  if (signal.displaySafety && signal.displaySafety !== 'RETAIL_SAFE') return null

  const isFr = locale === 'fr'
  const isSanction = signal.hasSanction
  const slug = signal.sourceSlug ?? 'unknown'

  // Determine border color based on severity
  const borderColor = isSanction ? '#DC2626' : signal.topRiskClass === 'HIGH' ? '#FF6B00' : '#F59E0B'

  const countText = signal.matchCount === 1
    ? isFr
      ? 'Répertorié dans 1 source intelligence'
      : 'Listed in 1 intelligence source'
    : isFr
      ? `Répertorié dans ${signal.matchCount} sources intelligence`
      : `Listed in ${signal.matchCount} intelligence sources`

  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${borderColor}44`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginTop: 8,
      }}
    >
      <div style={{ marginTop: 2, flexShrink: 0 }}>
        <ShieldIcon color={borderColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: '0.15em',
            color: borderColor,
            fontFamily: 'monospace',
            marginBottom: 4,
          }}
        >
          {isSanction
            ? isFr ? 'CORRESPONDANCE SANCTIONS' : 'SANCTIONS MATCH'
            : isFr ? 'SIGNAL INTELLIGENCE' : 'INTELLIGENCE SIGNAL'}
        </div>

        {/* Source badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          <SourceBadge slug={slug} locale={locale} />
        </div>

        {/* Count line */}
        <div
          style={{
            fontSize: 12,
            color: '#9CA3AF',
            fontFamily: 'monospace',
          }}
        >
          {countText}
        </div>

        {/* External link */}
        {signal.externalUrl && (
          <a
            href={signal.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 4,
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: '#FF6B00',
              textDecoration: 'none',
              letterSpacing: '0.05em',
            }}
          >
            {isFr ? 'Voir la source' : 'View source'} {'\u2192'}
          </a>
        )}
      </div>
    </div>
  )
}
