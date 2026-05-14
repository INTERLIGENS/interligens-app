/**
 * REFLEX V1 — narrative adapter.
 *
 * Loads active NarrativeScript rows, runs the matcher against the
 * caller-provided text corpus, and maps each match into a ReflexSignal.
 *
 * The verdict pipeline assembles the text corpus per input type:
 *  - URL    → fetched page content + meta tags
 *  - HANDLE → bio + recent posts
 *  - TOKEN  → project description / market metadata when available
 *
 * Matches at confidence ≥ NARRATIVE_MATCH_WAIT_THRESHOLD are STRONG;
 * weaker hits are MODERATE. stopTrigger is always false — narrative
 * alone never forces STOP in V1.
 */
import { NARRATIVE_MATCH_WAIT_THRESHOLD } from "../constants";
import {
  loadActiveScripts,
  matchNarrative,
  type NarrativeMatch,
} from "../narrativeMatcher";
import type {
  ReflexEngineOutput,
  ReflexResolvedInput,
  ReflexSignal,
  ReflexSignalSeverity,
} from "../types";

function severityForConfidence(c: number): ReflexSignalSeverity {
  if (c >= NARRATIVE_MATCH_WAIT_THRESHOLD) return "STRONG";
  return "MODERATE";
}

export type RunNarrativeOpts = {
  resolvedInput: ReflexResolvedInput;
  text: string;
};

export async function runNarrative(
  opts: RunNarrativeOpts,
): Promise<ReflexEngineOutput<NarrativeMatch[]>> {
  const start = Date.now();
  const ms = () => Date.now() - start;

  if (!opts.text || opts.text.trim().length === 0) {
    return { engine: "narrative", ran: false, ms: ms(), signals: [] };
  }

  try {
    const scripts = await loadActiveScripts();
    const matches = matchNarrative(opts.text, scripts);

    const signals: ReflexSignal[] = matches.map((m) => ({
      source: "narrative" as const,
      code: `narrative.${m.scriptCode}`,
      severity: severityForConfidence(m.confidence),
      confidence: m.confidence,
      stopTrigger: false,
      payload: {
        scriptCode: m.scriptCode,
        scriptLabel: m.scriptLabel,
        category: m.category,
        matchedKeywords: m.matchedKeywords,
        matchedRegexes: m.matchedRegexes,
        excerpt: m.excerpt,
      },
    }));

    return {
      engine: "narrative",
      ran: true,
      ms: ms(),
      signals,
      raw: matches,
    };
  } catch (e) {
    return {
      engine: "narrative",
      ran: false,
      ms: ms(),
      signals: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
