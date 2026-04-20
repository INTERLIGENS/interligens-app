'use client'
import React, { useState } from 'react'

interface LaundrySignal {
  id: string
  family: string
  confirmed: boolean
  severity: string
  detail: string
  rawData?: Record<string, unknown>
}

interface LaundryTrailData {
  id: string
  trailType: string
  laundryRisk: string
  recoveryDifficulty: string
  trailBreakHop?: number | null
  fundsUnresolved?: number | null
  narrativeText?: string | null
  narrativeTextFr?: string | null
  evidenceNote: string
  evidenceNoteFr?: string | null
  signals: LaundrySignal[]
}

const SIGNAL_COLORS: Record<string, string> = {
  FRAG: '#FFB800',
  BRIDGE: '#FFFFFF',
  MIXER: '#FF3B5C',
  PRIV: '#FF3B5C',
  DEG: '#FFB800',
  CASH: '#FFB800',
}

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#FF3B5C',
  HIGH: '#FF3B5C',
  MODERATE: '#FFB800',
  LOW: '#00FF94',
}

const RECOVERY_COLORS: Record<string, string> = {
  SEVERE: '#FF3B5C',
  PARTIAL: '#FFB800',
  LOW: '#00FF94',
}

const LABELS = {
  en: {
    signals: 'SIGNALS',
    trailType: 'TRAIL TYPE',
    laundryRisk: 'LAUNDRY RISK',
    recoveryDifficulty: 'RECOVERY DIFFICULTY',
    recovery: 'RECOVERY',
    trailBreak: (hop: number) => `— trail breaks at hop ${hop}`,
  },
  fr: {
    signals: 'SIGNAUX',
    trailType: 'TYPE DE TRACE',
    laundryRisk: 'RISQUE DE BLANCHIMENT',
    recoveryDifficulty: 'DIFFICULTÉ DE RÉCUPÉRATION',
    recovery: 'RÉCUPÉRATION',
    trailBreak: (hop: number) => `— la trace se perd au hop ${hop}`,
  },
}

function getRetailText(signals: LaundrySignal[], trailBreakHop: number | null | undefined, lang: string): string {
  const families = signals.map(s => s.family)
  const hasFrag = families.includes('FRAG')
  const hasBridge = families.includes('BRIDGE')
  const hasMixer = families.includes('MIXER')
  const hasDeg = families.includes('DEG')

  if (lang === 'fr') {
    if (hasFrag && hasBridge)
      return 'Les fonds ont été rapidement dispersés vers plusieurs portefeuilles et routés via une infrastructure cross-chain.'
    if (hasFrag && hasMixer)
      return 'Les fonds ont été fragmentés et routés via un service d\'obfuscation connu.'
    if (hasDeg && trailBreakHop)
      return `Au-delà du hop ${trailBreakHop}, la trace devient nettement plus difficile à suivre et la récupération plus complexe.`
    return 'Des schémas de routage compatibles avec une obfuscation ont été détectés sur ce portefeuille.'
  }

  if (hasFrag && hasBridge)
    return 'Funds were rapidly dispersed across multiple wallets and routed through cross-chain infrastructure.'
  if (hasFrag && hasMixer)
    return 'Funds were fragmented and routed through a known obfuscation service.'
  if (hasDeg && trailBreakHop)
    return `After hop ${trailBreakHop}, the trail becomes significantly harder to follow and recovery becomes more difficult.`
  return 'Routing patterns consistent with obfuscation were detected on this wallet.'
}

export default function LaundryTrailCard({ laundryTrail, lang = 'en' }: { laundryTrail: LaundryTrailData; lang?: string }) {
  const [expanded, setExpanded] = useState(false)
  const isFr = lang === 'fr'
  const l = isFr ? LABELS.fr : LABELS.en

  const riskColor = RISK_COLORS[laundryTrail.laundryRisk] ?? '#7A8599'
  const recoveryColor = RECOVERY_COLORS[laundryTrail.recoveryDifficulty] ?? '#7A8599'

  const narrative = isFr
    ? (laundryTrail.narrativeTextFr ?? laundryTrail.narrativeText ?? getRetailText(laundryTrail.signals, laundryTrail.trailBreakHop, 'fr'))
    : (laundryTrail.narrativeText ?? getRetailText(laundryTrail.signals, laundryTrail.trailBreakHop, 'en'))

  const evidenceNote = isFr
    ? (laundryTrail.evidenceNoteFr ?? laundryTrail.evidenceNote)
    : laundryTrail.evidenceNote

  return (
    <div style={{
      background: '#111318',
      border: '1px solid #1E2330',
      borderRadius: 12,
      marginBottom: 28,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '16px 20px',
          borderLeft: '4px solid #FFB800',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 9,
            fontWeight: 900,
            color: '#7A8599',
            letterSpacing: '0.2em',
            fontFamily: 'monospace',
          }}>
            LAUNDRY TRAIL
          </span>
          <span style={{
            background: riskColor + '20',
            border: `1px solid ${riskColor}55`,
            color: riskColor,
            fontSize: 9,
            fontWeight: 900,
            padding: '3px 10px',
            borderRadius: 4,
            letterSpacing: '0.1em',
          }}>
            {laundryTrail.laundryRisk}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 9, color: '#7A8599', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
            {l.recovery}: <span style={{ color: recoveryColor, fontWeight: 900 }}>{laundryTrail.recoveryDifficulty}</span>
          </span>
          <span style={{ color: '#7A8599', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 20px 20px 24px', background: '#161A22' }}>

          {/* Signal pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, marginBottom: 16 }}>
            <span style={{ fontSize: 8, color: '#7A8599', letterSpacing: '0.15em', fontWeight: 900, alignSelf: 'center', marginRight: 4 }}>
              {l.signals}
            </span>
            {laundryTrail.signals.map((s) => {
              const color = SIGNAL_COLORS[s.family] ?? '#7A8599'
              const label = s.confirmed ? s.family : `~${s.family}`
              return (
                <span
                  key={s.id}
                  style={{
                    background: color + '20',
                    border: `1px solid ${color}55`,
                    color,
                    fontSize: 9,
                    fontWeight: 900,
                    padding: '3px 10px',
                    borderRadius: 4,
                    letterSpacing: '0.1em',
                    fontFamily: 'monospace',
                    opacity: s.confirmed ? 1 : 0.6,
                  }}
                >
                  {label}
                </span>
              )
            })}
          </div>

          {/* Trail type */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 8, color: '#7A8599', letterSpacing: '0.15em', fontWeight: 900, marginBottom: 4 }}>{l.trailType}</div>
            <div style={{ fontSize: 12, color: '#F0F4FF', fontFamily: 'monospace' }}>{laundryTrail.trailType}</div>
          </div>

          {/* Risk + Recovery row */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 8, color: '#7A8599', letterSpacing: '0.15em', fontWeight: 900, marginBottom: 4 }}>{l.laundryRisk}</div>
              <span style={{
                background: riskColor + '20',
                border: `1px solid ${riskColor}55`,
                color: riskColor,
                fontSize: 13,
                fontWeight: 900,
                padding: '4px 14px',
                borderRadius: 4,
                letterSpacing: '0.05em',
                fontFamily: 'monospace',
              }}>
                {laundryTrail.laundryRisk}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#7A8599', letterSpacing: '0.15em', fontWeight: 900, marginBottom: 4 }}>{l.recoveryDifficulty}</div>
              <span style={{
                color: recoveryColor,
                fontSize: 13,
                fontWeight: 900,
                fontFamily: 'monospace',
              }}>
                {laundryTrail.recoveryDifficulty}
                {laundryTrail.trailBreakHop ? ` ${l.trailBreak(laundryTrail.trailBreakHop)}` : ''}
              </span>
            </div>
          </div>

          {/* Narrative text */}
          <div style={{
            fontSize: 12,
            color: '#F0F4FF',
            lineHeight: 1.7,
            marginBottom: 16,
            padding: '12px 14px',
            background: '#111318',
            borderRadius: 8,
            borderLeft: '3px solid #1E2330',
          }}>
            {narrative}
          </div>

          {/* Evidence note */}
          <div style={{ fontSize: 10, color: '#7A8599', fontStyle: 'italic', lineHeight: 1.5 }}>
            {evidenceNote}
          </div>
        </div>
      )}
    </div>
  )
}
