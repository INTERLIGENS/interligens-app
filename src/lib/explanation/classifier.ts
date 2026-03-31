import type { AnalysisSummary, ChipIntent } from './types'

export type QuestionClass = 'deterministic' | 'constrained_generation' | 'refusal'

export interface ClassifyResult {
  class: QuestionClass
  intent?: ChipIntent
}

// ── Refusal patterns ──────────────────────────────────────────────────────────
const REFUSAL_PATTERNS = [
  /buy|sell|invest|portfolio|position|trade|trading/i,
  /price|pump|dump|moon|ath|dip|recover|prediction|forecast/i,
  /founder|team|ceo|dev|developer|who (is|are|made|built|created)/i,
  /legal|illegal|regulated|regulation|sec|cftc|jurisdiction/i,
  /compare|vs\.?|versus|better than|worse than|other token/i,
  /solana|ethereum|bitcoin|btc|eth|sol|bnb|market/i,
  /ignore|forget|pretend|roleplay|jailbreak|system prompt|instruc/i,
]

// ── Deterministic intent map ──────────────────────────────────────────────────
const DETERMINISTIC_MAP: Array<{ patterns: RegExp[]; intent: ChipIntent }> = [
  {
    patterns: [/why.*score|score.*why|how.*score|what.*score|explain.*score/i],
    intent: 'why_score',
  },
  {
    patterns: [/red flag|flag|signal|risk signal|main risk|top risk|danger/i],
    intent: 'top_red_flags',
  },
  {
    patterns: [/what should i do|what to do|do now|next step|recommend/i],
    intent: 'what_to_do',
  },
  {
    patterns: [/deployer|deploy|contract creator|who deployed/i],
    intent: 'deployer_risk',
  },
  {
    patterns: [/holder|concentration|wallet.*hold|top wallet/i],
    intent: 'holder_concentration',
  },
  {
    patterns: [/liquid|exit|sell.*token|can i sell/i],
    intent: 'liquidity_risk',
  },
  {
    patterns: [/recidiv|repeat|before|previous project|past project/i],
    intent: 'recidivism',
  },
  {
    patterns: [/linked|related project|connected|same actor/i],
    intent: 'linked_projects',
  },
  {
    patterns: [/intel|vault|watchlist|known threat|investigator/i],
    intent: 'intel_vault',
  },
]

export function classifyQuestion(
  input: string,
  _summary: AnalysisSummary
): ClassifyResult {
  const trimmed = input.trim()
  if (!trimmed) return { class: 'refusal' }

  // 1. Refusal check first
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(trimmed)) return { class: 'refusal' }
  }

  // 2. Deterministic intent match
  for (const { patterns, intent } of DETERMINISTIC_MAP) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) return { class: 'deterministic', intent }
    }
  }

  // 3. Default to constrained generation
  return { class: 'constrained_generation' }
}
