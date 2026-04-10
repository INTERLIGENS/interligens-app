/**
 * Intelligence Mode — product + editorial layer.
 *
 * INTERLIGENS mixes two output types and the distinction is a product rule,
 * not a visual decoration:
 *
 *  - deterministic : output grounded in traced data, scores, signals, evidence
 *                    items, on-chain events or rules. Reproducible. Auditable.
 *  - exploratory   : interpretive guidance, suggestion, hypothesis, assisted
 *                    reading. Directionally useful, not fact.
 *
 * This module is the single source of truth for:
 *  - the IntelligenceMode type (imported by AskLog, UI, helpers)
 *  - the surface → mode mapping
 *  - the EN/FR microcopy
 *  - the classifier for ASK responses (shared with askLog)
 *
 * Keep it boring. Keep it additive. No refactor parasite.
 */

// ── Canonical type ─────────────────────────────────────────────────────────

export type IntelligenceMode = "deterministic" | "exploratory"

export const INTELLIGENCE_MODES: readonly IntelligenceMode[] = [
  "deterministic",
  "exploratory",
] as const

// ── Microcopy ──────────────────────────────────────────────────────────────

export interface IntelligenceModeCopy {
  short: string        // compact pill label (≤ 3 words)
  long: string         // descriptive line
  explain: string      // 1-sentence tooltip / drawer copy
}

export const INTELLIGENCE_MODE_COPY: Record<
  IntelligenceMode,
  { en: IntelligenceModeCopy; fr: IntelligenceModeCopy }
> = {
  deterministic: {
    en: {
      short: "TRACED",
      long: "Based on traced signals",
      explain:
        "Grounded in scores, evidence items, on-chain events and rules that can be audited in the system.",
    },
    fr: {
      short: "TRACÉ",
      long: "Fondé sur des signaux tracés",
      explain:
        "Ancré dans les scores, les preuves, les événements on-chain et les règles auditables dans le système.",
    },
  },
  exploratory: {
    en: {
      short: "INTERPRETIVE",
      long: "Interpretive guidance",
      explain:
        "Assisted reading. Hypotheses and orientation — not established fact. Cross-check before acting.",
    },
    fr: {
      short: "INTERPRÉTATIF",
      long: "Lecture interprétative",
      explain:
        "Lecture assistée. Hypothèses et orientation — pas un fait établi. À recouper avant d'agir.",
    },
  },
}

export function getIntelligenceModeCopy(
  mode: IntelligenceMode,
  locale: "en" | "fr" = "en",
): IntelligenceModeCopy {
  return INTELLIGENCE_MODE_COPY[mode][locale]
}

// ── Surface mapping ────────────────────────────────────────────────────────

/**
 * Canonical surface identifiers. If you add a new output surface, add it here
 * AND decide its mode. Keeping this list explicit prevents silent drift.
 */
export type IntelligenceSurface =
  // Deterministic — anchored to concrete data
  | "tiger_score"
  | "risk_tier"
  | "evidence_tag"
  | "evidence_item"
  | "key_signal_card"
  | "timeline_event"
  | "onchain_event"
  | "laundry_trail_signal"
  | "case_snapshot"
  | "case_linked_actor"
  // Exploratory — assisted / interpretive
  | "ask_answer"
  | "ask_suggestion"
  | "pattern_hypothesis"
  | "investigation_hint"
  | "cross_case_suggestion"

const SURFACE_MODE: Record<IntelligenceSurface, IntelligenceMode> = {
  // Deterministic
  tiger_score: "deterministic",
  risk_tier: "deterministic",
  evidence_tag: "deterministic",
  evidence_item: "deterministic",
  key_signal_card: "deterministic",
  timeline_event: "deterministic",
  onchain_event: "deterministic",
  laundry_trail_signal: "deterministic",
  case_snapshot: "deterministic",
  case_linked_actor: "deterministic",
  // Exploratory
  ask_answer: "exploratory",
  ask_suggestion: "exploratory",
  pattern_hypothesis: "exploratory",
  investigation_hint: "exploratory",
  cross_case_suggestion: "exploratory",
}

export function getSurfaceMode(surface: IntelligenceSurface): IntelligenceMode {
  return SURFACE_MODE[surface]
}

// ── ASK answer classifier → IntelligenceMode ───────────────────────────────

/**
 * Derive the IntelligenceMode of an ASK INTERLIGENS response from its text.
 * Rules — simple, explicit, auditable. No pseudo-AI scoring.
 *
 *  - A "refusal" is deterministic by construction: the system is stating a
 *    fact about its own scope ("I don't have that here").
 *  - An answer containing a hard, scan-derived number (%, $, tx count,
 *    wallet count, age in days) is deterministic: the claim can be checked
 *    against the scan data.
 *  - Everything else from the LLM — no hard number, no refusal — is
 *    exploratory: the assistant is paraphrasing, orienting, or synthesizing.
 *
 * Shared with src/lib/ask/askLog.ts so that the value written to AskLog.mode
 * is always the same type as the UI badge reads from.
 */
export function deriveAskMode(answer: string): IntelligenceMode {
  const a = (answer ?? "").trim()
  if (!a) return "exploratory"

  if (isRefusalText(a)) return "deterministic"
  if (hasHardScanNumber(a)) return "deterministic"

  // Mild hedging language → exploratory (belt-and-braces).
  if (HEDGE_MARKERS.some((r) => r.test(a))) return "exploratory"

  // LLM paraphrase with no hard number → exploratory by default.
  return "exploratory"
}

const REFUSAL_PATTERNS: RegExp[] = [
  /pas de conseils? d['’]investissement/i,
  /not investment advice/i,
  /price prediction isn['’]t what we do/i,
  /les pr[ée]visions de prix/i,
  /je n['’]ai pas [çc]a ici/i,
  /i don['’]t have that here/i,
  /this scan doesn['’]t cover/i,
  /ce scan ne suffit pas/i,
]

const HEDGE_MARKERS: RegExp[] = [
  /probablement|possiblement|peut-[êe]tre|il se pourrait|on dirait|semble/i,
  /probably|possibly|maybe|it seems|appears to|likely|might/i,
]

export function isRefusalText(answer: string): boolean {
  return REFUSAL_PATTERNS.some((r) => r.test(answer))
}

export function hasHardScanNumber(answer: string): boolean {
  return /\b\d+([.,]\d+)?\s*(%|\$|K|M|jours?|days?|wallets?|txs?)\b/i.test(answer)
}

// ── Rendering hints ─────────────────────────────────────────────────────────

/**
 * Whether a given surface should visually expose its mode to the user.
 *
 * Rule of thumb (the brief):
 *   - ASK answers MUST expose exploratory framing — this is the #1 reason
 *     the layer exists.
 *   - Deterministic anchor surfaces (Case Snapshot, evidence blocks) CAN
 *     expose a discreet "TRACED" pill once, near the top/footer — never on
 *     every element.
 *   - Pure scoring / tagging surfaces (tiger_score, risk_tier, evidence_tag,
 *     key_signal_card) do NOT need a visible badge — their format already
 *     reads as deterministic.
 */
export function shouldRenderModeBadge(surface: IntelligenceSurface): boolean {
  switch (surface) {
    case "ask_answer":
    case "ask_suggestion":
    case "pattern_hypothesis":
    case "investigation_hint":
    case "cross_case_suggestion":
      return true
    case "case_snapshot":
      return true
    default:
      return false
  }
}
