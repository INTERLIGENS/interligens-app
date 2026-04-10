/**
 * ASK INTERLIGENS — Audit Trail (AskLog)
 *
 * Non-intrusive write path: every ASK interaction gets journaled to DB for
 * traceability, debugging, review and future UI of provenance/confidence/mode.
 *
 * Design rules:
 *  - writeAskLog is void-async + isolated try/catch. Never blocks the user response.
 *  - Classification (answerType / mode / confidenceTier) is derived with simple,
 *    explicit heuristics. No pseudo-AI fuzziness.
 *  - sourcesUsed captures which internal data blocks backed the answer.
 */

import type { AnalysisSummary } from "@/lib/explanation/types"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  deriveAskMode,
  isRefusalText,
  hasHardScanNumber,
  type IntelligenceMode,
} from "@/lib/intelligence/mode"

export type AskAnswerType = "deterministic" | "constrained_generation" | "refusal"
// AskLog.mode is the canonical IntelligenceMode. Keep the local alias so
// existing call sites compile; the value domain is now owned by intelligence/mode.ts.
export type AskMode = IntelligenceMode
export type AskConfidenceTier = "high" | "medium" | "low"

export interface AskLogSource {
  type:
    | "analysis_summary"
    | "signal_cards"
    | "evidence_items"
    | "timeline_events"
    | "linked_actors"
    | "intel_vault_hits"
    | "laundry_trail_signals"
    | "case_references"
    | "kol_reference"
    | "grounding_context"
  key: string
  present: boolean
  count?: number
}

export interface AskLogInput {
  sessionId?: string | null
  scanId?: string | null
  locale: string
  source?: "web" | "mobile"
  userQuestion: string
  assistantAnswer: string
  summary?: AnalysisSummary | null
  kolContext?: string | null
  groundingContext?: unknown
  modelName?: string | null
  latencyMs?: number | null
  metadata?: Record<string, unknown> | null
}

// ── Classification heuristics ────────────────────────────────────────────────

export function classifyAnswer(answer: string): AskAnswerType {
  const a = answer.trim()
  if (!a) return "refusal"
  if (isRefusalText(a)) return "refusal"
  if (hasHardScanNumber(a)) return "deterministic"
  return "constrained_generation"
}

// Mode is the canonical IntelligenceMode — delegated to intelligence/mode.ts
// so the badge, the classifier and the audit trail stay in lockstep.
export function deriveMode(answer: string, _answerType: AskAnswerType): AskMode {
  return deriveAskMode(answer)
}

export function deriveConfidenceTier(
  answerType: AskAnswerType,
  mode: AskMode,
  sourceCount: number,
): AskConfidenceTier {
  if (answerType === "refusal") return "low"
  if (answerType === "deterministic" && sourceCount >= 2) return "high"
  if (mode === "exploratory") return "low"
  if (sourceCount >= 2) return "medium"
  return sourceCount >= 1 ? "medium" : "low"
}

// ── Source capture ───────────────────────────────────────────────────────────

export function captureSources(input: {
  summary?: AnalysisSummary | null
  kolContext?: string | null
  groundingContext?: unknown
}): AskLogSource[] {
  const sources: AskLogSource[] = []

  const s = input.summary
  if (s) {
    sources.push({
      type: "analysis_summary",
      key: s.address ?? "unknown",
      present: true,
    })
    const topReasons = (s as unknown as { topReasons?: unknown[] }).topReasons
    if (Array.isArray(topReasons) && topReasons.length > 0) {
      sources.push({
        type: "signal_cards",
        key: "top_reasons",
        present: true,
        count: topReasons.length,
      })
    }
    const evidence = (s as unknown as { evidence?: unknown[] }).evidence
    if (Array.isArray(evidence) && evidence.length > 0) {
      sources.push({
        type: "evidence_items",
        key: "scan_evidence",
        present: true,
        count: evidence.length,
      })
    }
    const timeline = (s as unknown as { timeline?: unknown[] }).timeline
    if (Array.isArray(timeline) && timeline.length > 0) {
      sources.push({
        type: "timeline_events",
        key: "scan_timeline",
        present: true,
        count: timeline.length,
      })
    }
  }

  if (input.kolContext && input.kolContext.trim().length > 0) {
    sources.push({
      type: "kol_reference",
      key: "kol_grounding",
      present: true,
    })
    // Parse cheaply from known markers in kolContext string
    if (/Cluster:/i.test(input.kolContext)) {
      sources.push({ type: "linked_actors", key: "cluster", present: true })
    }
    if (/Laundry trail/i.test(input.kolContext)) {
      sources.push({
        type: "laundry_trail_signals",
        key: "laundry_trail",
        present: true,
      })
    }
    if (/Coordination signals/i.test(input.kolContext)) {
      sources.push({ type: "linked_actors", key: "coordination", present: true })
    }
    if (/Proceeds:/i.test(input.kolContext)) {
      sources.push({ type: "case_references", key: "proceeds", present: true })
    }
  }

  const g = input.groundingContext as
    | { relatedCases?: unknown[]; relatedLaunches?: unknown[] }
    | undefined
  if (g && Array.isArray(g.relatedCases) && g.relatedCases.length > 0) {
    sources.push({
      type: "case_references",
      key: "related_cases",
      present: true,
      count: g.relatedCases.length,
    })
  }
  if (g && Array.isArray(g.relatedLaunches) && g.relatedLaunches.length > 0) {
    sources.push({
      type: "intel_vault_hits",
      key: "related_launches",
      present: true,
      count: g.relatedLaunches.length,
    })
  }

  return sources
}

// ── Write path — fire-and-forget, never throws ──────────────────────────────

export function writeAskLog(input: AskLogInput): void {
  // Detach completely — do not await, do not block.
  void (async () => {
    try {
      const sources = captureSources({
        summary: input.summary,
        kolContext: input.kolContext,
        groundingContext: input.groundingContext,
      })
      const answerType = classifyAnswer(input.assistantAnswer)
      const mode = deriveMode(input.assistantAnswer, answerType)
      const confidenceTier = deriveConfidenceTier(answerType, mode, sources.length)

      await prisma.askLog.create({
        data: {
          sessionId: input.sessionId ?? null,
          scanId: input.scanId ?? null,
          locale: input.locale,
          source: input.source ?? "web",
          userQuestion: input.userQuestion.slice(0, 1000),
          assistantAnswer: input.assistantAnswer.slice(0, 4000),
          answerType,
          mode,
          confidenceTier,
          sourcesUsed: sources as unknown as object,
          sourceCount: sources.length,
          modelName: input.modelName ?? null,
          latencyMs: input.latencyMs ?? null,
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      })
    } catch (err) {
      // Never escalate — log-only. Audit write must never break ASK.
      console.error("[askLog] write failed:", err instanceof Error ? err.message : err)
    }
  })()
}
