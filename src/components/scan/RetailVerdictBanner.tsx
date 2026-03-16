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
    RED:    { icon: '✕', title: 'DO NOT BUY', sub: 'Critical risk signals detected by INTERLIGENS', color: '#ef4444', border: '#ef4444' },
    ORANGE: { icon: '!', title: 'HIGH RISK', sub: 'Multiple warning signals identified', color: '#f59e0b', border: '#f59e0b' },
    GREEN:  { icon: '✓', title: 'CLEAN', sub: 'No major risk detected', color: '#10b981', border: '#10b981' },
  },
  fr: {
    RED:    { icon: '✕', title: 'NE PAS ACHETER', sub: 'Signaux critiques détectés par INTERLIGENS', color: '#ef4444', border: '#ef4444' },
    ORANGE: { icon: '!', title: 'RISQUE ÉLEVÉ', sub: "Plusieurs signaux d'alerte identifiés", color: '#f59e0b', border: '#f59e0b' },
    GREEN:  { icon: '✓', title: 'FIABLE', sub: 'Aucun risque majeur détecté', color: '#10b981', border: '#10b981' },
  }
}

const BG = {
  RED:    'linear-gradient(135deg, #1a0505 0%, #0f0202 100%)',
  ORANGE: 'linear-gradient(135deg, #1a1005 0%, #0f0a02 100%)',
  GREEN:  'linear-gradient(135deg, #051a10 0%, #020f08 100%)',
}

function toPlainLanguage(proof: Proof, lang: 'en' | 'fr'): string | null {
  if (proof.level === 'low') return null
  const desc = (proof.riskDescription ?? '').toLowerCase()
  const map: Record<string, Record<string, string>> = {
    en: {
      'drain vector':       'Unlimited token approvals — drain risk',
      'unverified program': 'Unverified programs detected',
      'burner behavior':    'New burner wallet behavior',
      'unlimited':          'Unlimited spend approvals',
      'unknown':            'Unknown smart contracts',
      'attack surface':     'High number of contract interactions',
      'detective':          'Detective Referenced — case on file',
      'off-chain':          'Off-chain investigation result',
      'case':               'Case identifier found',
    },
    fr: {
      'drain vector':       'Approbations illimitées — risque de drain',
      'unverified program': 'Programmes non vérifiés',
      'burner behavior':    'Comportement wallet jetable',
      'unlimited':          'Approbations illimitées détectées',
      'unknown':            'Contrats inconnus',
      'attack surface':     'Nombreuses interactions contrats',
      'detective':          'Référencé par un détective',
      'off-chain':          'Investigation off-chain',
      'case':               'Identifiant de dossier trouvé',
    }
  }
  for (const [key, val] of Object.entries(map[lang])) {
    if (desc.includes(key)) return val
  }
  if (proof.level === 'high') return `⚠️ ${proof.riskDescription}`
  return null
}

export default function RetailVerdictBanner({ tier, score, proofs, address, chain, lang = 'en' }: Props) {
  const v = VERDICTS[lang][tier]
  const isSolana = chain === 'SOL' || chain === 'solana'

  const reasons = proofs
    .filter(p => p.level !== 'low')
    .map(p => toPlainLanguage(p, lang))
    .filter(Boolean)
    .slice(0, 3) as string[]

  const generic = {
    en: { RED: ['Risk score critically high', 'Multiple red flags detected'], ORANGE: ['Risk score above safe threshold'], GREEN: ['No critical signals detected'] },
    fr: { RED: ["🚨 Score de risque critique", "🔍 Plusieurs red flags détectés"], ORANGE: ["⚠️ Score au-dessus du seuil"], GREEN: ["✅ Aucun signal critique"] }
  }
  while (reasons.length < 2) {
    const next = generic[lang][tier][reasons.length]
    if (next) reasons.push(next)
    else break
  }

  const ctaLabel = lang === 'fr' ? "Voir comment le scam s'est déroulé →" : 'See how this scam unfolded →'
  const poweredBy = lang === 'fr' ? 'Analysé par' : 'Analyzed by'
  const scoreLabel = lang === 'fr' ? 'SCORE RISQUE' : 'RISK SCORE'

  return (
    <div style={{ background: BG[tier], border: `1px solid ${v.border}`, borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${v.color}, transparent)` }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ width: 6, height: 52, borderRadius: 3, background: v.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: v.color, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: "'Inter', 'Helvetica Neue', sans-serif", textTransform: 'uppercase' as const }}>
            {v.title}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, letterSpacing: '0.02em' }}>{v.sub}</div>
        </div>
        <div style={{ background: '#0f172a', border: `1px solid ${v.color}44`, borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 72, flexShrink: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: v.color, fontFamily: 'monospace' }}>{score}</div>
          <div style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.08em' }}>{scoreLabel}</div>
        </div>
      </div>

      {reasons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {reasons.map((r, i) => (
            <div key={i} style={{ fontSize: 13, color: '#e2e8f0', background: '#0f172a88', borderRadius: 8, padding: '8px 14px', borderLeft: `3px solid ${v.color}` }}>
              {r}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
        {isSolana && address && (
          <a href={'/en/scan/' + address + '/timeline'} style={{ background: v.color, color: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
            {ctaLabel}
          </a>
        )}
        <div style={{ fontSize: 10, color: '#4b5563', marginLeft: 'auto' }}>
          {poweredBy} <span style={{ color: '#818cf8', fontWeight: 700, letterSpacing: '0.05em' }}>INTERLIGENS AI</span>
        </div>
      </div>
    </div>
  )
}
