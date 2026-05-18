'use client'

import { RwaMatchVerdict } from '@prisma/client'

interface Layer0BadgeProps {
  verdict: RwaMatchVerdict | 'IMPLEMENTATION'
  label:   string
  size?:   'sm' | 'md' | 'lg'
}

const VERDICT_CONFIG = {
  EXACT_VERIFIED: {
    color:  '#00C851',
    bg:     '#0D2D1A',
    border: '#00C851',
    icon:   '✓',
    pulse:  false,
  },
  EXACT_ALIAS_VERIFIED: {
    color:  '#00C851',
    bg:     '#0D2D1A',
    border: '#00C851',
    icon:   '✓',
    pulse:  false,
  },
  LEGACY_VERIFIED: {
    color:  '#FF6B00',
    bg:     '#1A1200',
    border: '#FF6B00',
    icon:   '↻',
    pulse:  false,
  },
  PROBABLE_FAMILY_MISMATCH: {
    color:  '#FF3B30',
    bg:     '#2D0D0D',
    border: '#FF3B30',
    icon:   '⚠',
    pulse:  true,
  },
  UNKNOWN: {
    color:  '#FF9500',
    bg:     '#1A1A00',
    border: '#FF9500',
    icon:   '?',
    pulse:  false,
  },
  IMPLEMENTATION: {
    color:  '#888888',
    bg:     '#1A1A1A',
    border: '#444444',
    icon:   'i',
    pulse:  false,
  },
}

const SIZE_CONFIG = {
  sm: { fontSize: '11px', padding: '3px 8px', iconSize: '12px', gap: '4px' },
  md: { fontSize: '13px', padding: '5px 12px', iconSize: '14px', gap: '6px' },
  lg: { fontSize: '15px', padding: '8px 16px', iconSize: '18px', gap: '8px' },
}

export function Layer0Badge({ verdict, label, size = 'md' }: Layer0BadgeProps) {
  const config = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.UNKNOWN
  const sizing = SIZE_CONFIG[size]

  return (
    <span
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           sizing.gap,
        padding:       sizing.padding,
        fontSize:      sizing.fontSize,
        fontFamily:    '"JetBrains Mono", "Fira Code", monospace',
        fontWeight:    700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color:         config.color,
        background:    config.bg,
        border:        `1px solid ${config.border}`,
        borderRadius:  '4px',
        whiteSpace:    'nowrap',
      }}
    >
      <span
        style={{
          fontSize:   sizing.iconSize,
          lineHeight: 1,
          animation:  config.pulse ? 'rwa-pulse 1.5s ease-in-out infinite' : 'none',
        }}
      >
        {config.icon}
      </span>
      {label}

      <style>{`
        @keyframes rwa-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </span>
  )
}
