'use client'
import React, { useEffect, useRef, useState } from 'react'

const STAGES_EN = [
  'Checking on-chain data...',
  'Querying Intel Vault...',
  'Analyzing KOL network...',
  'Running TigerScore engine...',
  'Building evidence pack...',
] as const

const STAGES_FR = [
  'Vérification des données on-chain...',
  "Consultation de l'Intel Vault...",
  'Analyse du réseau KOL...',
  'Calcul du TigerScore...',
  'Construction des preuves...',
] as const

const ACCENT = '#FF6B00'
const DONE = '#00FF94'
const PENDING = '#333333'
const TEXT = '#FFFFFF'
const MUTED = '#9ca3af'
const BG = '#000000'
const BORDER = '#1A1A1A'
const CARD = '#111111'

interface Props {
  locale?: 'en' | 'fr'
  /** Tempo per stage in ms. Defaults to 900ms for ~4.5s total. */
  stageMs?: number
}

export default function ScanLoadingSteps({ locale = 'en', stageMs = 900 }: Props) {
  const stages = locale === 'fr' ? STAGES_FR : STAGES_EN
  const [active, setActive] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Self-advance through stages; stay on the last stage until unmount.
    if (active >= stages.length - 1) return
    timerRef.current = setTimeout(() => {
      setActive(a => Math.min(a + 1, stages.length - 1))
    }, stageMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [active, stageMs, stages.length])

  const label = locale === 'fr' ? 'ANALYSE EN COURS' : 'ANALYSING'

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: '28px 28px 24px',
        color: TEXT,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: ACCENT,
            boxShadow: `0 0 12px ${ACCENT}`,
            animation: 'scanloading-pulse 1200ms ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.22em',
            color: ACCENT,
            fontFamily: 'monospace',
          }}
        >
          {label}
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 2,
          background: BORDER,
          borderRadius: 2,
          overflow: 'hidden',
          marginBottom: 22,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${((active + 1) / stages.length) * 100}%`,
            background: ACCENT,
            transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      {/* Stages */}
      <ol
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {stages.map((s, i) => {
          const state = i < active ? 'done' : i === active ? 'active' : 'pending'
          const color = state === 'done' ? DONE : state === 'active' ? ACCENT : PENDING
          const textColor = state === 'done' ? MUTED : state === 'active' ? TEXT : '#4b5563'

          return (
            <li
              key={s}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'color 300ms ease',
              }}
            >
              {/* Icon / checkmark / dot */}
              <div
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: state === 'done' ? DONE + '20' : state === 'active' ? ACCENT + '20' : 'transparent',
                  border: `1.5px solid ${color}`,
                  transition: 'all 300ms ease',
                }}
              >
                {state === 'done' && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path
                      d="M2 5L4 7L8 3"
                      stroke={DONE}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {state === 'active' && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: ACCENT,
                      animation: 'scanloading-pulse 900ms ease-in-out infinite',
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: state === 'active' ? 700 : 500,
                  color: textColor,
                  letterSpacing: state === 'active' ? '-0.005em' : 0,
                  transition: 'all 300ms ease',
                }}
              >
                {s}
              </span>
            </li>
          )
        })}
      </ol>

      <style>{`
        @keyframes scanloading-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.85); }
        }
      `}</style>
    </div>
  )
}
