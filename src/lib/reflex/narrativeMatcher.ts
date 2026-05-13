/**
 * REFLEX V1 — narrative matcher.
 *
 * Pure synchronous matching of free text against the active
 * NarrativeScript library. The matcher is rule-based (keywords + regex),
 * deterministic, no LLM involved.
 *
 * Confidence boost: starts at the script's defaultConfidence and adds
 * 0.05 for each ADDITIONAL keyword or regex hit beyond the first,
 * capped at defaultConfidence + 0.2 and at 1.0 overall.
 *
 * Compiled regex per call (cheap for ~15 scripts × ~2 patterns). If the
 * library grows, swap to a per-script cache.
 */
import { prisma } from "@/lib/prisma";

export interface NarrativeScriptForMatcher {
  code: string;
  label: string;
  category: string;
  keywords: string[];
  regexes: string[];
  defaultConfidence: number;
}

export interface NarrativeMatch {
  scriptCode: string;
  scriptLabel: string;
  category: string;
  /** Raw matched confidence (0..1). */
  confidence: number;
  matchedKeywords: string[];
  matchedRegexes: string[];
  /** Text excerpt around the first hit, ≤ 100 chars. */
  excerpt: string;
}

const CONFIDENCE_BOOST_PER_EXTRA_HIT = 0.05;
const MAX_CONFIDENCE_BOOST = 0.2;
const EXCERPT_RADIUS = 40;

function snippet(text: string, idx: number, hitLen: number): string {
  const start = Math.max(0, idx - EXCERPT_RADIUS);
  const end = Math.min(text.length, idx + hitLen + EXCERPT_RADIUS);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function matchNarrative(
  text: string,
  scripts: readonly NarrativeScriptForMatcher[],
): NarrativeMatch[] {
  if (!text || text.trim().length === 0 || scripts.length === 0) return [];
  const lower = text.toLowerCase();
  const matches: NarrativeMatch[] = [];

  for (const script of scripts) {
    const matchedKeywords: string[] = [];
    let firstHitIdx = -1;
    let firstHitLen = 0;

    for (const kw of script.keywords) {
      const idx = lower.indexOf(kw.toLowerCase());
      if (idx >= 0) {
        matchedKeywords.push(kw);
        if (firstHitIdx === -1 || idx < firstHitIdx) {
          firstHitIdx = idx;
          firstHitLen = kw.length;
        }
      }
    }

    const matchedRegexes: string[] = [];
    for (const reStr of script.regexes) {
      let compiled: RegExp;
      try {
        compiled = new RegExp(reStr, "i");
      } catch {
        // Skip invalid regex rather than throw; this lets calibration
        // ship a bad regex without breaking the whole matcher.
        continue;
      }
      const m = compiled.exec(text);
      if (m) {
        matchedRegexes.push(reStr);
        if (firstHitIdx === -1 || m.index < firstHitIdx) {
          firstHitIdx = m.index;
          firstHitLen = m[0].length;
        }
      }
    }

    if (matchedKeywords.length === 0 && matchedRegexes.length === 0) continue;

    const totalHits = matchedKeywords.length + matchedRegexes.length;
    const extraHits = Math.max(0, totalHits - 1);
    const boost = Math.min(
      MAX_CONFIDENCE_BOOST,
      extraHits * CONFIDENCE_BOOST_PER_EXTRA_HIT,
    );
    const confidence = Math.min(1.0, script.defaultConfidence + boost);

    matches.push({
      scriptCode: script.code,
      scriptLabel: script.label,
      category: script.category,
      confidence,
      matchedKeywords,
      matchedRegexes,
      excerpt:
        firstHitIdx >= 0
          ? snippet(text, firstHitIdx, firstHitLen)
          : text.slice(0, 100).trim(),
    });
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  return matches;
}

/**
 * Load all active NarrativeScript rows from the DB.
 * Falls back to [] if the table is missing (pre-migration window).
 */
export async function loadActiveScripts(): Promise<NarrativeScriptForMatcher[]> {
  const rows = await prisma.narrativeScript.findMany({
    where: { active: true },
    select: {
      code: true,
      label: true,
      category: true,
      keywords: true,
      regexes: true,
      defaultConfidence: true,
    },
  });
  return rows.map((r) => ({
    code: r.code,
    label: r.label,
    category: r.category,
    keywords: Array.isArray(r.keywords) ? (r.keywords as string[]) : [],
    regexes: Array.isArray(r.regexes) ? (r.regexes as string[]) : [],
    defaultConfidence: r.defaultConfidence,
  }));
}
