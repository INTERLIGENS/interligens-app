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
  actions?: string[]
  disclaimer?: string
  hasCasefile?: boolean
  /**
   * La couverture requise par la décision a-t-elle abouti ?
   *
   * ⛔ DÉCLARÉE PAR L'APPELANT, jamais devinée ici. `undefined` laisse le
   *    comportement historique intact pour les appelants qui ne se prononcent
   *    pas encore ; `false` interdit d'affirmer « CLEAN ».
   */
  coverageSufficient?: boolean
}

const VERDICTS = {
  en: {
    RED:    { icon: '✕', title: "DON'T BUY THIS", sub: 'Critical risk signals detected by INTERLIGENS', color: '#ef4444', border: '#ef4444' },
    ORANGE: { icon: '!', title: 'HIGH RISK', sub: 'Multiple warning signals identified', color: '#f59e0b', border: '#f59e0b' },
    GREEN:  { icon: '✓', title: 'CLEAN', sub: 'No major risk detected', color: '#10b981', border: '#10b981' },
    // `UNKNOWN` — le GRIS ratifié de BUILD 10 · P0. Ni vert, ni rouge : une
    // absence de connaissance, dite comme telle. Le sous-titre ne porte aucune
    // accusation — une couverture insuffisante n'est pas une allégation.
    UNKNOWN: { icon: '?', title: 'UNVERIFIED', sub: 'Required checks did not complete — not a safety assessment', color: '#6b7280', border: '#6b7280' },
  },
  fr: {
    RED:    { icon: '✕', title: "N'ACHÈTE PAS", sub: 'Signaux critiques détectés par INTERLIGENS', color: '#ef4444', border: '#ef4444' },
    ORANGE: { icon: '!', title: 'RISQUE ÉLEVÉ', sub: "Plusieurs signaux d'alerte identifiés", color: '#f59e0b', border: '#f59e0b' },
    GREEN:  { icon: '✓', title: 'FIABLE', sub: 'Aucun risque majeur détecté', color: '#10b981', border: '#10b981' },
    UNKNOWN: { icon: '?', title: 'NON VÉRIFIÉ', sub: "Les vérifications attendues n'ont pas toutes abouti — ce n'est pas une évaluation de sécurité", color: '#6b7280', border: '#6b7280' },
  }
}

const BG = {
  RED:    'linear-gradient(135deg, #1a0505 0%, #0f0202 100%)',
  ORANGE: 'linear-gradient(135deg, #1a1005 0%, #0f0a02 100%)',
  GREEN:  'linear-gradient(135deg, #051a10 0%, #020f08 100%)',
  // Le fond gris de l'état non vérifié — ni vert, ni rouge.
  UNKNOWN: 'linear-gradient(135deg, #0d0f12 0%, #060708 100%)',
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

export default function RetailVerdictBanner({ tier, score, proofs, address, chain, lang = 'en', actions, disclaimer, hasCasefile, coverageSufficient }: Props) {
  // ── CC-OFFLINE-284 · B — « CLEAN » EXIGE UNE COUVERTURE ─────────────────
  //
  // ██  UNKNOWN ≠ SAFE.                                                    ██
  //
  // GREEN affiche « CLEAN » / « No major risk detected ». Servi sur une
  // couverture requise INSUFFISANTE, cet énoncé dérive une confiance d'une
  // ignorance — c'est le défaut machine, à l'identique, sur la surface humaine.
  //
  // ⛔ AUCUNE CLASSIFICATION NOUVELLE. `UNKNOWN` existe déjà, ratifié dans
  //    `src/lib/risk/tier.ts` (« BUILD 10 · P0 — UNKNOWN est GRIS. Ni vert, ce
  //    serait la coercition qu'on ferme, ni rouge, ce serait inventer un
  //    risque »). La bannière PROJETTE cet état existant au lieu d'affirmer.
  //
  // ⛔ LA COUVERTURE EST DÉCLARÉE PAR L'APPELANT, JAMAIS DEVINÉE ICI. La
  //    bannière ne sonde rien et n'invente aucune raison : la phrase affichée
  //    est le `disclaimer` que l'autorité a produit.
  //
  // Une gravité, elle, n'est jamais relâchée : RED et ORANGE traversent
  // intacts. La couverture restreint une permission ; elle ne réduit pas une
  // gravité — la même règle qu'en CC-OFFLINE-282, sur l'autre surface.
  const couvertureInsuffisante = coverageSufficient === false
  const nonVerifie = couvertureInsuffisante && tier === 'GREEN'
  const v = nonVerifie ? VERDICTS[lang].UNKNOWN : VERDICTS[lang][tier]
  const isSolana = chain === 'SOL' || chain === 'solana'
  const showCasefileCta = tier === 'RED' || !!hasCasefile

  const reasons = proofs
    .filter(p => p.level !== 'low')
    .map(p => toPlainLanguage(p, lang))
    .filter(Boolean)
    .slice(0, 3) as string[]

  // ── CC-OFFLINE-284 · B — AUCUN MOTIF DE REMPLISSAGE ─────────────────────
  //
  // ██  UN REMPLISSAGE DE PRÉSENTATION N'EST PAS UNE PREUVE.              ██
  //
  // Une boucle `while (reasons.length < 2)` injectait des motifs génériques
  // jusqu'à un quota VISUEL. Sur GREEN, elle écrivait « No critical signals
  // detected » — une ASSERTION SÉMANTIQUE fabriquée par du code de
  // présentation, servie exactement quand il n'y avait rien à dire.
  //
  // ⛔ DES MOTIFS VIDES RESTENT VIDES. Le rendu est déjà gardé par
  //    `reasons.length > 0` : une liste vide ne produit aucun bloc, et aucune
  //    phrase n'est inventée pour remplir la place.

  const ctaLabel = lang === 'fr' ? "Voir comment le scam s'est déroulé →" : 'See how this scam unfolded →'
  const poweredBy = lang === 'fr' ? 'Analysé par' : 'Analyzed by'
  const scoreLabel = lang === 'fr' ? 'SCORE RISQUE' : 'RISK SCORE'
  const actionLabel = lang === 'fr' ? 'À FAIRE MAINTENANT' : 'WHAT TO DO NOW'
  const timelineBase = lang === 'fr' ? '/fr/scan/' : '/en/scan/'

  return (
    <div style={{ background: nonVerifie ? BG.UNKNOWN : BG[tier], border: `1px solid ${v.border}`, borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${v.color}, transparent)` }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: v.color, letterSpacing: '-0.02em', lineHeight: 1, fontFamily: "'Inter', 'Helvetica Neue', sans-serif", textTransform: 'uppercase' as const }}>
            {v.title}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, letterSpacing: '0.02em' }}>{v.sub}</div>
        </div>
        {/* ── CC-OFFLINE-294 · « RISK SCORE » EXIGE UNE MESURE ──────────────
            ██  UN REPLI INTERNE N'EST PAS UNE MESURE HUMAINE.             ██

            Le nombre servi ici sous le libellé « RISK SCORE » peut être le
            repli legacy de `computeScore([])`. Ce repli ne peut plus rendre
            ALLOW, SAFE ni CLEAN — mais l'AFFICHER à un humain sous ce libellé
            lui rend l'autorité VISUELLE que la mesure ne lui donne pas.

            ⛔ AUCUNE SUBSTITUTION. Ni zéro, ni tiret, ni autre score : la
               présentation est RETENUE, pas remplacée. Inventer un nombre
               serait le défaut symétrique.
            ⛔ UN SCORE RÉELLEMENT MESURÉ N'EST PAS MASQUÉ. `nonVerifie` est
               faux dès que la couverture est suffisante — et il l'est aussi
               sur RED et ORANGE, où une gravité établie garde son nombre. */}
        {!nonVerifie && (
          <div style={{ background: '#0f172a', border: `1px solid ${v.color}44`, borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 72, flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: v.color, fontFamily: 'monospace' }}>{score}</div>
            <div style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.08em' }}>{scoreLabel}</div>
          </div>
        )}
      </div>

      {reasons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {reasons.map((r, i) => (
            <div key={i} style={{ fontSize: 13, color: '#e2e8f0', background: '#0f172a88', borderRadius: 8, padding: '8px 14px' }}>
              {r}
            </div>
          ))}
        </div>
      )}

      {/* What to do now — integrated */}
      {actions && actions.length > 0 && (
        <div style={{ borderTop: `1px solid ${v.color}22`, paddingTop: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 8 }}>{actionLabel}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {actions.map((a, i) => (
              <div key={i} style={{ fontSize: 12, color: '#d1d5db', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: v.color, fontWeight: 900, fontSize: 11, marginTop: 1, flexShrink: 0 }}>{i + 1}.</span>
                <span>{a}</span>
              </div>
            ))}
          </div>
          {disclaimer && <div style={{ fontSize: 10, color: '#4b5563', marginTop: 8, fontStyle: 'italic' }}>{disclaimer}</div>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
        {isSolana && address && showCasefileCta && (
          <a href={timelineBase + address + '/timeline'} style={{ background: v.color, color: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
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
