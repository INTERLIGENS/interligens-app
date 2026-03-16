'use client'
import React from 'react'

type Tier = 'GREEN' | 'ORANGE' | 'RED'

interface Proof {
  label: string
  value: string
  level: 'low' | 'medium' | 'high'
  riskDescription: string
}

interface Props {
  tier: Tier
  score: number
  proofs: Proof[]
  address?: string
  chain?: string
  lang?: 'en' | 'fr'
}

const VERDICTS = {
  en: {
    RED:    { emoji: '🚨', title: 'DANGER — Do not buy', sub: 'This token shows critical risk signals', color: '#ef4444', bg: '#1a0505', border: '#ef4444' },
    ORANGE: { emoji: '⚠️', title: 'CAUTION — High risk detected', sub: 'Several warning signals identified', color: '#f59e0b', bg: '#1a1005', border: '#f59e0b' },
    GREEN:  { emoji: '✅', title: 'CLEAN — No major risk detected', sub: 'This token appears relatively safe', color: '#10b981', bg: '#051a10', border: '#10b981' },
  },
  fr: {
    RED:    { emoji: '🚨', title: 'DANGER — Ne pas acheter', sub: 'Ce token présente des signaux critiques', color: '#ef4444', bg: '#ef444411', border: '#ef444433' },
    ORANGE: { emoji: '⚠️', title: 'PRUDENCE — Risques détectés', sub: 'Plusieurs signaux d\'alerte identifiés', color: '#f59e0b', bg: '#f59e0b11', border: '#f59e0b33' },
    GREEN:  { emoji: '✅', title: 'FIABLE — Aucun risque majeur', sub: 'Ce token semble relativement sûr', color: '#10b981', bg: '#10b98111', border: '#10b98133' },
  }
}

// Translate technical proof to plain language
function toPlainLanguage(proof: Proof, lang: 'en' | 'fr'): string | null {
  const desc = proof.riskDescription?.toLowerCase() ?? ''
  const label = proof.label?.toLowerCase() ?? ''
  const value = proof.value?.toLowerCase() ?? ''

  if (proof.level === 'low') return null // Skip safe signals

  const map: Record<string, Record<string, string>> = {
    en: {
      'drain vector':       '💸 Unlimited token approvals detected — drain risk',
      'unverified program': '⚠️ Unverified programs in this wallet',
      'burner behavior':    '🔥 Very low transaction history — looks like a new burner',
      'unlimited':          '💸 Unlimited spend approvals detected',
      'unknown':            '❓ Unknown or unverified smart contracts',
      'low history':        '🕐 Very recent or inactive wallet',
      'attack surface':     '🎯 High number of contract interactions',
    },
    fr: {
      'drain vector':       '💸 Approbations illimitées détectées — risque de drain',
      'unverified program': '⚠️ Programmes non vérifiés dans ce wallet',
      'burner behavior':    '🔥 Historique très faible — wallet jetable probable',
      'unlimited':          '💸 Approbations de dépenses illimitées détectées',
      'unknown':            '❓ Contrats intelligents inconnus ou non vérifiés',
      'low history':        '🕐 Wallet très récent ou inactif',
      'attack surface':     '🎯 Nombreuses interactions de contrats',
    }
  }

  for (const [key, translation] of Object.entries(map[lang])) {
    if (desc.includes(key) || label.includes(key) || value.includes(key)) {
      return translation
    }
  }

  // Fallback — use riskDescription directly if high risk
  if (proof.level === 'high') {
    return `⚠️ ${proof.riskDescription}`
  }
  return null
}

export default function RetailVerdictBanner({ tier, score, proofs, address, chain, lang = 'en' }: Props) {
  const v = VERDICTS[lang][tier]
  const isSolana = chain === 'SOL' || chain === 'solana'

  // Get plain language reasons (max 4, only medium/high)
  const reasons = proofs
    .filter(p => p.level !== 'low')
    .map(p => toPlainLanguage(p, lang))
    .filter(Boolean)
    .slice(0, 4) as string[]

  // Add generic reasons based on tier if not enough
  const genericReasons = {
    en: {
      RED:    ['🚨 Risk score critically high', '🔍 Multiple red flags detected by INTERLIGENS AI'],
      ORANGE: ['⚠️ Risk score above safe threshold', '🔍 Review full analysis before investing'],
      GREEN:  ['✅ No critical signals detected', '🔍 Always do your own research'],
    },
    fr: {
      RED:    ['🚨 Score de risque critique', '🔍 Plusieurs red flags détectés par l\'IA INTERLIGENS'],
      ORANGE: ['⚠️ Score de risque au-dessus du seuil', '🔍 Vérifiez l\'analyse complète avant d\'investir'],
      GREEN:  ['✅ Aucun signal critique détecté', '🔍 Faites toujours vos propres recherches'],
    }
  }

  while (reasons.length < 2) {
    const next = genericReasons[lang][tier][reasons.length]
    if (next) reasons.push(next)
    else break
  }

  const timelineLabel = lang === 'fr' ? 'Voir comment le scam s\'est déroulé →' : 'See how this scam unfolded →'
  const scoreLabel = lang === 'fr' ? 'Score de risque' : 'Risk score'
  const poweredBy = lang === 'fr' ? 'Analysé par' : 'Analyzed by'

  return (
    <div style={{
      background: v.bg,
      border: `1px solid ${v.border}`,
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 8,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow effect */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${v.color}, transparent)`
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 32 }}>{v.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: v.color, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {v.title}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{v.sub}</div>
        </div>
        {/* TigerScore — secondary */}
        <div style={{
          background: '#0f172a',
          border: `1px solid ${v.color}44`,
          borderRadius: 10,
          padding: '8px 14px',
          textAlign: 'center',
          minWidth: 70
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: v.color }}>{score}</div>
          <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{scoreLabel}</div>
        </div>
      </div>

      {/* Reasons */}
      {reasons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {reasons.map((r, i) => (
            <div key={i} style={{
              fontSize: 13,
              color: '#e2e8f0',
              background: '#0f172a88',
              borderRadius: 8,
              padding: '7px 12px',
              borderLeft: `3px solid ${v.color}`,
            }}>
              {r}
            </div>
          ))}
        </div>
      )}

      {/* CTA — Timeline if available */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {isSolana && address && (
          
          <a
            style={{
              background: v.color,
              color: '#fff',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            {timelineLabel}
          </a>
        )}
        <div style={{ fontSize: 10, color: '#4b5563', marginLeft: 'auto' }}>
          {poweredBy} <span style={{ color: '#818cf8', fontWeight: 700 }}>INTERLIGENS AI 🐯</span>
        </div>
      </div>
    </div>
  )
}
