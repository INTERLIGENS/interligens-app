import type { AnalysisSummary, ChipIntent } from './types'

export type QuestionClass = 'deterministic' | 'constrained_generation' | 'refusal'

export interface ClassifyResult {
  class: QuestionClass
  intent?: ChipIntent
}

// ── HARD REFUSAL ONLY — jailbreak, legal opinion, price targets, portfolio ────
// Everything else goes to deterministic or LLM. Keep this list minimal.
const HARD_REFUSAL = [
  // Jailbreak / prompt injection
  /ignore.*instruct|forget.*instruct|pretend you are|act as|roleplay as|jailbreak|system prompt/i,
  // Legal / regulatory opinion
  /is.*illegal.*under|regulated by law|sec action|cftc ruling|tax.*conclusion|is.*legal.*country/i,
  // Guaranteed price targets / forecasts
  /will.*10x|will.*100x|price target|guaranteed.*return|exact.*forecast|which.*moon first|pick.*best token|portfolio allocation/i,
  // Multi-token comparison
  /compare.*to (another|other)|vs\.?\s+\w+\s+token|better than.*token|which token.*better|pick between/i,
]

// ── DETERMINISTIC — routes to template handlers, no LLM ──────────────────────
const DETERMINISTIC_MAP: Array<{ patterns: RegExp[]; intent: ChipIntent }> = [
  {
    patterns: [/why.*score|score.*why|how.*score|what.*score|explain.*score|pourquoi.*score|c.est quoi le score|c.koi le score|why (red|orange|high)|pourquoi (rouge|orange|haut)/i],
    intent: 'why_score',
  },
  {
    patterns: [/red flag|main risk|top risk|gros.*probl|biggest.*issue|signaux principaux|what.*flagged/i],
    intent: 'top_red_flags',
  },
  {
    patterns: [/what should i do|what to do|do now|next step|que faire|quoi faire|je fais quoi|j.y vais comment|help.*now|aide.*maintenant/i],
    intent: 'what_to_do',
  },
  {
    patterns: [/deployer|deploy|contract creator|who deployed|d.ployeur|wallet.*cr.ateur|dev wallet|wallet du dev/i],
    intent: 'deployer_risk',
  },
  {
    patterns: [/holder|concentration|wallet.*hold|top wallet|qui.*tient|combien.*wallet|whale|baleen|top holders|supply.*control/i],
    intent: 'holder_concentration',
  },
  {
    patterns: [/liquid|liq|exit liq|can i sell|je peux vendre|sortir.*token|bloqué.*vendre|pourquoi.*vendre|locked lp|lp lock/i],
    intent: 'liquidity_risk',
  },
  {
    patterns: [/recidiv|repeat|before|previous project|past project|d.j. vu|l.a fait avant|same.*actor|m.me.*acteur/i],
    intent: 'recidivism',
  },
  {
    patterns: [/linked|related project|connected|li.s|reli.s|associ/i],
    intent: 'linked_projects',
  },
  {
    patterns: [/intel|vault|watchlist|known threat|investigator|dossier.*existant/i],
    intent: 'intel_vault',
  },
]

// ── CLASSIFIER ────────────────────────────────────────────────────────────────

export function classifyQuestion(
  input: string,
  _summary: AnalysisSummary
): ClassifyResult {
  const trimmed = input.trim()
  if (!trimmed) return { class: 'refusal' }

  // 1. Hard refusal — jailbreak, legal, price targets, portfolio
  for (const pattern of HARD_REFUSAL) {
    if (pattern.test(trimmed)) return { class: 'refusal' }
  }

  // 2. Deterministic intent match
  for (const { patterns, intent } of DETERMINISTIC_MAP) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) return { class: 'deterministic', intent }
    }
  }

  // 3. Everything else — LLM with scan context
  // This includes: dev/team/founder, scam/rug/safe/legit, buy/sell,
  // influencer/KOL/shill, emotional states, slang (degen/jeet/NGMI/WAGMI),
  // French rough (ça pue/ça craint/c'est chaud), chain names, technical
  // context words — all pass to constrained generation.
  return { class: 'constrained_generation' }
}
