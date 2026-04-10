import type { Locale, ChipIntent, Verdict } from './types'

export const CHIP_LABELS: Record<ChipIntent, Record<Locale, string>> = {
  why_score:            { en: "Why this score?",      fr: "Pourquoi ce score ?" },
  top_red_flags:        { en: "Main red flags",       fr: "Signaux principaux" },
  what_to_do:           { en: "What should I do?",    fr: "Que faire ?" },
  deployer_risk:        { en: "Creator risk",          fr: "Risque créateur" },
  holder_concentration: { en: "Who holds this?",      fr: "Qui détient ?" },
  liquidity_risk:       { en: "Can I sell?",           fr: "Puis-je vendre ?" },
  recidivism:           { en: "Known repeat actor",   fr: "Acteur récidiviste" },
  linked_projects:      { en: "Linked to scams?",     fr: "Lié à des scams ?" },
  intel_vault:          { en: "Intel matches",         fr: "Dossiers Intel" },
}

export const ANSWER_TITLES: Record<ChipIntent, Record<Locale, string>> = {
  why_score:            { en: "Why this score",        fr: "Pourquoi ce score" },
  top_red_flags:        { en: "Main red flags",        fr: "Signaux principaux" },
  what_to_do:           { en: "What to do",            fr: "Que faire" },
  deployer_risk:        { en: "Deployer risk",         fr: "Risque déployeur" },
  holder_concentration: { en: "Holder concentration",  fr: "Concentration des wallets" },
  liquidity_risk:       { en: "Liquidity risk",        fr: "Risque de liquidité" },
  recidivism:           { en: "Known repeat actor",    fr: "Acteur récidiviste" },
  linked_projects:      { en: "Linked projects",       fr: "Projets liés" },
  intel_vault:          { en: "Intel Vault",           fr: "Intel Vault" },
}

export const INSUFFICIENT_DATA: Record<Locale, string> = {
  en: "Not enough scan data to answer this one.",
  fr: "Pas assez de données dans ce scan pour répondre.",
}

export const EXPLANATION_SECTION_LABEL: Record<Locale, string> = {
  en: "Ask INTERLIGENS",
  fr: "Demander à INTERLIGENS",
}

export const EXPLANATION_DISCLAIMER: Record<Locale, string> = {
  en: "Evidence-based. Not financial advice.",
  fr: "Basé sur les preuves. Pas un conseil financier.",
}

export const VERDICT_SUMMARY_INTRO: Record<Verdict, Record<Locale, string>> = {
  LOW:      { en: "Score {score}/100. Relatively clean.", fr: "Score {score}/100. Plutôt propre." },
  MODERATE: { en: "Score {score}/100. Some signals worth checking.", fr: "Score {score}/100. Quelques signaux à vérifier." },
  HIGH:     { en: "Score {score}/100. This looks rough.", fr: "Score {score}/100. Ça craint." },
  CRITICAL: { en: "Score {score}/100. This is bad.", fr: "Score {score}/100. C’est grave." },
}

export const ASK_MORE_LABEL: Record<Locale, string> = {
  en: "Ask more about this scan",
  fr: "Poser une question sur ce scan",
}

export const INPUT_PLACEHOLDER: Record<Locale, string> = {
  en: "Ask anything about this scan…",
  fr: "Pose une question sur ce scan…",
}

export const ASK_BUTTON: Record<Locale, string> = {
  en: "Ask",
  fr: "Demander",
}

export const SCOPE_NOTICE: Record<Locale, string> = {
  en: "Analysis of this scan only.",
  fr: "Analyse de ce scan uniquement.",
}

export const REFUSAL_RESPONSE: Record<Locale, string> = {
  en: "That is outside what this scan covers. INTERLIGENS does not give investment advice or market calls.",
  fr: "Ça dépasse ce que ce scan couvre. INTERLIGENS ne donne pas de conseils en investissement.",
}

export const FALLBACK_RESPONSE: Record<Locale, string> = {
  en: "In-depth analysis is temporarily unavailable. The scan result above has everything critical.",
  fr: "L’analyse approfondie est temporairement indisponible. Le résultat du scan ci-dessus contient l’essentiel.",
}

export const THINKING_LABEL: Record<Locale, string> = {
  en: "Analyzing scan evidence…",
  fr: "Analyse des données du scan…",
}
