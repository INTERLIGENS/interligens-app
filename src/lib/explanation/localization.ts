import type { Locale, ChipIntent, Verdict } from './types'

export const CHIP_LABELS: Record<ChipIntent, Record<Locale, string>> = {
  why_score:            { en: 'Why this score?',        fr: 'Pourquoi ce score ?' },
  top_red_flags:        { en: 'Main red flags',         fr: 'Signaux principaux' },
  what_to_do:           { en: 'What should I do?',      fr: 'Que faire ?' },
  deployer_risk:        { en: 'Deployer risk',           fr: 'Risque déployeur' },
  holder_concentration: { en: 'Holder concentration',   fr: 'Concentration wallets' },
  liquidity_risk:       { en: 'Liquidity risk',          fr: 'Risque liquidité' },
  recidivism:           { en: 'Known repeat actor',      fr: 'Acteur récidiviste' },
  linked_projects:      { en: 'Linked projects',         fr: 'Projets liés' },
  intel_vault:          { en: 'Intel Vault matches',     fr: 'Intel Vault' },
}

export const ANSWER_TITLES: Record<ChipIntent, Record<Locale, string>> = {
  why_score:            { en: 'Why this score',          fr: 'Pourquoi ce score' },
  top_red_flags:        { en: 'Main red flags',          fr: 'Signaux principaux' },
  what_to_do:           { en: 'What to do now',          fr: 'Que faire maintenant' },
  deployer_risk:        { en: 'Deployer risk',           fr: 'Risque déployeur' },
  holder_concentration: { en: 'Holder concentration',   fr: 'Concentration des holders' },
  liquidity_risk:       { en: 'Liquidity risk',          fr: 'Risque de liquidité' },
  recidivism:           { en: 'Known repeat actor',      fr: 'Acteur récidiviste connu' },
  linked_projects:      { en: 'Linked projects',         fr: 'Projets liés' },
  intel_vault:          { en: 'Intel Vault',             fr: 'Intel Vault' },
}

export const INSUFFICIENT_DATA: Record<Locale, string> = {
  en: 'Insufficient scan data available for this signal.',
  fr: 'Données de scan insuffisantes pour ce signal.',
}

export const EXPLANATION_SECTION_LABEL: Record<Locale, string> = {
  en: 'Ask INTERLIGENS',
  fr: 'Demander à INTERLIGENS',
}

export const EXPLANATION_DISCLAIMER: Record<Locale, string> = {
  en: 'Explanations are generated deterministically from scan data. Not financial advice.',
  fr: 'Les explications sont générées de façon déterministe à partir des données de scan. Pas un conseil financier.',
}

export const VERDICT_SUMMARY_INTRO: Record<Verdict, Record<Locale, string>> = {
  LOW: {
    en: 'The scan returned a low risk score of {score}/100.',
    fr: 'Le scan a retourné un score de risque faible de {score}/100.',
  },
  MODERATE: {
    en: 'The scan flagged a moderate risk level, scoring {score}/100.',
    fr: 'Le scan a relevé un niveau de risque modéré, avec un score de {score}/100.',
  },
  HIGH: {
    en: 'The scan identified significant risk signals, scoring {score}/100.',
    fr: 'Le scan a identifié des signaux de risque significatifs, avec un score de {score}/100.',
  },
  CRITICAL: {
    en: 'The scan flagged critical risk indicators, scoring {score}/100.',
    fr: 'Le scan a relevé des indicateurs de risque critiques, avec un score de {score}/100.',
  },
}
