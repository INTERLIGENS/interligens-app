// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Scorer
// Applies intelligence signal overlay to a base TigerScore.
//
// Rules (locked):
//   1. Dedup goplus + scamsniffer + forta → winner max IMS only
//   2. AMF / FCA / OFAC → stack (all counted)
//   3. Sum IMS × source weights → intelligence delta · hard-cap 0.20
//   4. OFAC / AMF / FCA match → floor TigerScore 15
//   5. IMS > 20 AND ICS > 0.40 → ceiling TigerScore 72
//   6. Intelligence weight on final score: hard-cap 0.20
// ─────────────────────────────────────────────────────────────────────────────

import type { IntelSignal } from "./types";

// ── Source weights for intelligence delta ───────────────────────────────────

const SOURCE_WEIGHT: Record<string, number> = {
  ofac: 0.20,
  amf: 0.18,
  fca: 0.18,
  goplus: 0.15,
  scamsniffer: 0.12,
  forta: 0.10,
};

// Technical sources that get deduped (only winner counts)
const DEDUP_GROUP = new Set(["goplus", "scamsniffer", "forta"]);

// Regulatory sources that stack
const REGULATORY_SOURCES = new Set(["ofac", "amf", "fca"]);

// ── Types ───────────────────────────────────────────────────────────────────

export interface ObservationInput {
  sourceSlug: string;
  ims: number;
  ics: number;
  riskClass: string;
  listIsActive: boolean;
}

export interface IntelligenceResult {
  /** Final adjusted TigerScore (0–100) */
  adjustedScore: number;
  /** Raw intelligence delta before cap */
  rawDelta: number;
  /** Capped intelligence delta (max 0.20 of base) */
  cappedDelta: number;
  /** Whether a regulatory sanction was matched */
  hasSanction: boolean;
  /** Whether floor 15 was applied */
  floorApplied: boolean;
  /** Whether ceiling 72 was applied */
  ceilingApplied: boolean;
  /** Sources that contributed to the score */
  contributingSources: string[];
  /** Dedup winner from technical group */
  techWinner: string | null;
  /** Per-source breakdown */
  breakdown: { slug: string; weight: number; ims: number; contribution: number }[];
}

// ── Scorer ──────────────────────────────────────────────────────────────────

export function computeIntelligenceScore(
  observations: ObservationInput[],
  baseTigerScore: number
): IntelligenceResult {
  const active = observations.filter((o) => o.listIsActive);

  // ── 1. Dedup technical sources: goplus + scamsniffer + forta → winner max IMS
  const techObs = active.filter((o) => DEDUP_GROUP.has(o.sourceSlug));
  const regObs = active.filter((o) => REGULATORY_SOURCES.has(o.sourceSlug));
  const otherObs = active.filter(
    (o) => !DEDUP_GROUP.has(o.sourceSlug) && !REGULATORY_SOURCES.has(o.sourceSlug)
  );

  let techWinner: ObservationInput | null = null;
  if (techObs.length > 0) {
    techWinner = techObs.reduce((best, o) => (o.ims > best.ims ? o : best), techObs[0]);
  }

  // ── 2. Build effective observation list (deduped tech + stacked regulatory)
  const effective: ObservationInput[] = [];
  if (techWinner) effective.push(techWinner);
  for (const r of regObs) effective.push(r); // AMF + FCA + OFAC all stack
  for (const o of otherObs) effective.push(o);

  // ── 3. Compute raw intelligence delta
  const breakdown: IntelligenceResult["breakdown"] = [];
  let rawDelta = 0;

  for (const obs of effective) {
    const weight = SOURCE_WEIGHT[obs.sourceSlug] ?? 0.05;
    const contribution = obs.ims * weight;
    rawDelta += contribution;
    breakdown.push({
      slug: obs.sourceSlug,
      weight,
      ims: obs.ims,
      contribution,
    });
  }

  // ── Hard-cap intelligence weight at 0.20 of base score
  const maxDelta = baseTigerScore * 0.20;
  const cappedDelta = Math.min(rawDelta, maxDelta);

  let adjustedScore = baseTigerScore + cappedDelta;

  // ── 4. Sanction match → floor 15
  const hasSanction = regObs.some(
    (o) => o.riskClass === "SANCTION" && o.listIsActive
  );
  let floorApplied = false;
  if (hasSanction && adjustedScore < 15) {
    adjustedScore = 15;
    floorApplied = true;
  }

  // ── 5. IMS > 20 AND ICS > 0.40 → ceiling 72
  const totalIms = effective.reduce((sum, o) => sum + o.ims, 0);
  const maxIcs = effective.length > 0
    ? Math.max(...effective.map((o) => o.ics))
    : 0;
  let ceilingApplied = false;
  if (totalIms > 20 && maxIcs > 0.40 && adjustedScore > 72) {
    adjustedScore = 72;
    ceilingApplied = true;
  }

  // Clamp to [0, 100]
  adjustedScore = Math.min(100, Math.max(0, Math.round(adjustedScore)));

  return {
    adjustedScore,
    rawDelta,
    cappedDelta,
    hasSanction,
    floorApplied,
    ceilingApplied,
    contributingSources: effective.map((o) => o.sourceSlug),
    techWinner: techWinner?.sourceSlug ?? null,
    breakdown,
  };
}

// ── Convenience: from IntelSignal (matcher output) ─────────────────────────

export function computeFromSignal(
  signal: IntelSignal,
  baseTigerScore: number,
  observations?: ObservationInput[]
): IntelligenceResult {
  if (signal.matchCount === 0 && (!observations || observations.length === 0)) {
    return {
      adjustedScore: baseTigerScore,
      rawDelta: 0,
      cappedDelta: 0,
      hasSanction: false,
      floorApplied: false,
      ceilingApplied: false,
      contributingSources: [],
      techWinner: null,
      breakdown: [],
    };
  }

  // If we have individual observations, use them directly
  if (observations && observations.length > 0) {
    return computeIntelligenceScore(observations, baseTigerScore);
  }

  // Fallback: single observation from signal winner
  const obs: ObservationInput[] = [];
  if (signal.winner) {
    obs.push({
      sourceSlug: signal.sourceSlug ?? "unknown",
      ims: signal.ims,
      ics: signal.ics,
      riskClass: signal.topRiskClass ?? "UNKNOWN",
      listIsActive: true,
    });
  }

  return computeIntelligenceScore(obs, baseTigerScore);
}
