import type { AnalysisSummary } from '@/lib/explanation/types'

export interface QATurn {
  user: string
  expectedTone?: string // hint for reviewer
}

export interface QAFixture {
  id: string
  label: string
  locale: 'en' | 'fr'
  summary: AnalysisSummary
  turns: QATurn[]
  toneExpected: string // what good looks like
  toneRed: string      // what to watch for
}

// ── Scan fixtures ─────────────────────────────────────────────────────────────

const CRITICAL_SUMMARY: AnalysisSummary = {
  address: 'BYZ9CcZGKAXmN2uDsKcQMM9UnZacja4vWcns9Th69xb',
  chain: 'solana',
  tigerScore: 100,
  verdict: 'CRITICAL',
  topReasons: [
    'Détective Référencé — dossier existant',
    'Résultat investigation hors-chaîne',
    'Identifiant du dossier',
  ],
  exitSecurityFlags: ['CaseDB', 'Statut'],
  recidivismFlag: true,
  intelVaultMatches: 1,
  whatToDoNow: 'N\u2019interagis pas. Ni swap, ni signature, ni approbation.',
}

const HIGH_SUMMARY: AnalysisSummary = {
  address: '0xfake1234HIGH',
  chain: 'ethereum',
  tigerScore: 78,
  verdict: 'HIGH',
  topReasons: [
    'Deployer wallet linked to 2 previous flagged projects',
    'Holder concentration: 91% in 4 wallets',
    'FDV/liquidity ratio extremely high',
  ],
  holderConcentration: 91,
  deployerRisk: 'HIGH',
  liquidityRisk: 'HIGH',
  whatToDoNow: 'Avoid interaction until signals are resolved.',
}

const MODERATE_SUMMARY: AnalysisSummary = {
  address: '0xfakeMODERATE5678',
  chain: 'base',
  tigerScore: 48,
  verdict: 'MODERATE',
  topReasons: [
    'Mutable metadata detected',
    'Volume/liquidity spike — possible manipulation',
  ],
  liquidityRisk: 'MEDIUM',
  deployerRisk: 'MEDIUM',
  whatToDoNow: 'Proceed with caution. Verify independently before any decision.',
}

const LOW_SUMMARY: AnalysisSummary = {
  address: '0xfakeLOW9999',
  chain: 'ethereum',
  tigerScore: 18,
  verdict: 'LOW',
  topReasons: [],
  whatToDoNow: 'No urgent action. Monitor if situation changes.',
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const QA_FIXTURES: QAFixture[] = [
  // ── FR CRITICAL ────────────────────────────────────────────────────────────
  {
    id: 'fr-critical-buy',
    label: 'FR · CRITICAL · "je peux acheter ça"',
    locale: 'fr',
    summary: CRITICAL_SUMMARY,
    toneExpected: 'Court, direct, protecteur. Max 3 lignes. Parle comme un humain.',
    toneRed: 'Trop long, jargon, "verdict CRITICAL signifie", rapport-style',
    turns: [
      { user: 'je peux acheter ça', expectedTone: 'Impact direct, pas de sermon' },
      { user: 'oui vas-y', expectedTone: 'Continue exactement ce qui était proposé, pas de reset' },
      { user: 'qui est derrière', expectedTone: 'Dit ce qu\u2019on n\u2019a pas + ce qu\u2019on a' },
    ],
  },
  {
    id: 'fr-critical-slang',
    label: 'FR · CRITICAL · slang rough',
    locale: 'fr',
    summary: CRITICAL_SUMMARY,
    toneExpected: 'Comprend le langage, répond propre et direct',
    toneRed: 'Refuse, moralise, ou ignore le sens de la question',
    turns: [
      { user: 'c un rug ?', expectedTone: 'Confirme depuis les signaux, pas de refusal' },
      { user: 'c ki le dev ?', expectedTone: 'Unsupported + pivot utile' },
      { user: 'je suis bagholder je fais quoi', expectedTone: 'Steps pratiques, ton humain' },
    ],
  },
  {
    id: 'fr-critical-already-bought',
    label: 'FR · CRITICAL · déjà acheté',
    locale: 'fr',
    summary: CRITICAL_SUMMARY,
    toneExpected: 'Urgence calibrée, steps clairs, pas de panique',
    toneRed: '"Je ne peux pas donner de conseils financiers", trop mou',
    turns: [
      { user: 'j\u2019ai déjà acheté c\u2019est quoi le risque', expectedTone: 'Répond depuis verdict + steps' },
      { user: 'j\u2019ai signé quand j\u2019ai connecté mon wallet', expectedTone: 'Revoke maintenant, ton direct' },
    ],
  },
  {
    id: 'fr-critical-influencer',
    label: 'FR · CRITICAL · influenceur',
    locale: 'fr',
    summary: CRITICAL_SUMMARY,
    toneExpected: 'Lie scan + contexte influ, protecteur sans moraliser',
    toneRed: 'Ignore le contexte influ, ou lecture de cours',
    turns: [
      { user: 'un influenceur l\u2019a shillé sur X', expectedTone: 'Scan + contexte influ lié' },
      { user: 'il a pas déclaré de position', expectedTone: 'Court, informatif, pas de sermon' },
    ],
  },
  {
    id: 'fr-critical-explain-simple',
    label: 'FR · CRITICAL · explique simplement',
    locale: 'fr',
    summary: CRITICAL_SUMMARY,
    toneExpected: 'Retail clair, pas de jargon, accessible à un débutant',
    toneRed: '"Le verdict CRITICAL signifie", termes techniques non expliqués',
    turns: [
      { user: 'explique simplement c\u2019est quoi le problème', expectedTone: 'Humain, sans jargon' },
      { user: 'et le truc du wallet', expectedTone: 'Court, continue sur le topic' },
    ],
  },
  {
    id: 'fr-critical-continuation',
    label: 'FR · CRITICAL · continuation oui/vas-y/ok',
    locale: 'fr',
    summary: CRITICAL_SUMMARY,
    toneExpected: 'Branch continue exactement, pas de reset ni recap',
    toneRed: 'Repart de zéro, répète le score, ignore ce qui était proposé',
    turns: [
      { user: 'c\u2019est quoi le vrai risque', expectedTone: 'Répond + offre un branch' },
      { user: 'oui', expectedTone: 'Livre exactement le branch proposé' },
      { user: 'ok merci', expectedTone: 'Court, naturel, ferme le topic proprement' },
    ],
  },

  // ── EN HIGH ────────────────────────────────────────────────────────────────
  {
    id: 'en-high-buy',
    label: 'EN · HIGH · "can I buy this"',
    locale: 'en',
    summary: HIGH_SUMMARY,
    toneExpected: 'Sharp, direct, retail. Not a financial advisor tone.',
    toneRed: 'Too soft, "I cannot provide financial advice", too long',
    turns: [
      { user: 'can I buy this', expectedTone: 'Warning + main reason' },
      { user: 'what is the deployer issue exactly', expectedTone: 'Plain language, no jargon' },
    ],
  },
  {
    id: 'en-high-slang',
    label: 'EN · HIGH · slang crypto',
    locale: 'en',
    summary: HIGH_SUMMARY,
    toneExpected: 'Understands slang, answers clean and sharp',
    toneRed: 'Refuses slang, sounds confused, generic fallback',
    turns: [
      { user: 'is this a rug', expectedTone: 'Responds from signals, not generic' },
      { user: 'can dev dump', expectedTone: 'Routes to holder/deployer context' },
      { user: "am I cooked if I already aped in", expectedTone: "Practical steps, not preachy" },
    ],
  },

  // ── EN MODERATE ────────────────────────────────────────────────────────────
  {
    id: 'en-moderate-unsupported',
    label: 'EN · MODERATE · unsupported questions',
    locale: 'en',
    summary: MODERATE_SUMMARY,
    toneExpected: 'Alive redirect — says what we don\u2019t have + offers what we do',
    toneRed: 'Dead stop, "not available", "start a new scan"',
    turns: [
      { user: 'who is the team', expectedTone: 'Unsupported + pivot to available' },
      { user: 'is this legal in France', expectedTone: 'Hard refusal but alive' },
      { user: 'explain the liquidity thing', expectedTone: 'Plain explanation from scan' },
    ],
  },

  // ── FR LOW ────────────────────────────────────────────────────────────────
  {
    id: 'fr-low-safe',
    label: 'FR · LOW · "c\u2019est safe ?"',
    locale: 'fr',
    summary: LOW_SUMMARY,
    toneExpected: 'Calme, pas défensif, pas de garantie',
    toneRed: '"Je ne peux pas confirmer si c\u2019est safe", trop défensif, trop long',
    turns: [
      { user: 'c\u2019est safe ?', expectedTone: 'Plutôt propre, direct, sans garantie' },
      { user: 'ok j\u2019y vais', expectedTone: 'Court, neutre, pas de morale' },
    ],
  },

  // ── TONE STRESS ────────────────────────────────────────────────────────────
  {
    id: 'fr-tone-stress',
    label: 'FR · STRESS · vocabulaire rough émotionnel',
    locale: 'fr',
    summary: CRITICAL_SUMMARY,
    toneExpected: 'Comprend, répond propre, ne mirrorise pas la vulgarité',
    toneRed: 'Mirrorise la vulgarité, refuse, ou devient trop formel en réaction',
    turns: [
      { user: 'ca a l\u2019air d\u2019etre une arnaque de merde', expectedTone: 'Confirme depuis scan, ton propre' },
      { user: 'ils vont nous rincer ces bâtards', expectedTone: 'Répond calmement, protecteur' },
      { user: 'ok merci', expectedTone: 'Short close, human' },
    ],
  },
]
