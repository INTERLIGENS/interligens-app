'use client'
import React from 'react'

export interface ClusterRiskResult {
  deployerAddress: string | null
  deployerKnown: boolean
  kolHandle: string | null
  relatedTokens: number
  redTokens: number
  clusterRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
  signal: string
  signalFr: string
  fallback: boolean
}

interface Props {
  result: ClusterRiskResult | null
  locale: 'en' | 'fr'
}

const COLORS = {
  HIGH: '#FF3B5C',
  MEDIUM: '#FFB800',
  LOW: '#6B7280',
  UNKNOWN: '#6B7280',
} as const

const CARD = '#111111'
const BORDER = '#1A1A1A'

const NetworkIcon = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <circle cx="8" cy="4" r="1.5" stroke={color} strokeWidth="1.2" />
    <circle cx="4" cy="12" r="1.5" stroke={color} strokeWidth="1.2" />
    <circle cx="12" cy="12" r="1.5" stroke={color} strokeWidth="1.2" />
    <path d="M8 5.5V8M8 8L5 10.5M8 8L11 10.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
  </svg>
)

export default function ClusterRiskBadge({ result, locale }: Props) {
  // Cluster badge must be INVISIBLE when it has nothing meaningful to
  // surface. UNKNOWN / fallback / LOW all suppressed — no muted "No
  // cluster signal" line. Only MEDIUM and HIGH render.
  if (!result) return null
  if (result.fallback) return null
  const risk = result.clusterRisk
  if (risk === 'UNKNOWN' || risk === 'LOW') return null

  const color = COLORS[risk]
  const isFr = locale === 'fr'
  const signalText = isFr ? result.signalFr : result.signal

  // HIGH / MEDIUM → card with colored border
  const eyebrow =
    risk === 'HIGH'
      ? isFr
        ? 'RISQUE CLUSTER DETECTE'
        : 'CLUSTER RISK DETECTED'
      : isFr
        ? 'PATTERN DE DEPLOIEMENT'
        : 'DEPLOYER PATTERN'

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${color}44`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div style={{ marginTop: 2, flexShrink: 0 }}>
        <NetworkIcon color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: '0.15em',
            color,
            fontFamily: 'monospace',
            marginBottom: 4,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#FFFFFF',
            lineHeight: 1.5,
          }}
        >
          {signalText}
        </div>
        {result.deployerKnown && result.kolHandle && (
          <a
            href={`/${locale}/kol/${result.kolHandle}`}
            style={{
              display: 'inline-block',
              marginTop: 6,
              fontSize: 11,
              fontFamily: 'monospace',
              fontWeight: 700,
              color: '#FF6B00',
              textDecoration: 'none',
              letterSpacing: '0.05em',
            }}
          >
            @{result.kolHandle} {'\u2192'}
          </a>
        )}
      </div>
    </div>
  )
}
