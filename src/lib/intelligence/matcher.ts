// ─────────────────────────────────────────────────────────────────────────────
// Case Intelligence — Entity Matcher
// Looks up a value (address, domain, token CA) in CanonicalEntity
// and returns a scored IntelSignal for the scanner badge.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { normalizeValue, buildDedupKey } from "./normalize";
import type {
  IntelEntityType,
  IntelRiskClass,
  IntelSignal,
  MatchTarget,
  SourceObservationMinimal,
} from "./types";

// ── Risk weights for IMS (Interligens Match Score) ──────────────────────────
const RISK_WEIGHT: Record<IntelRiskClass, number> = {
  SANCTION: 100,
  HIGH: 80,
  MEDIUM: 50,
  LOW: 20,
  UNKNOWN: 5,
};

const TIER_MULTIPLIER: Record<number, number> = {
  1: 1.5, // Regulatory
  2: 1.0, // Technical
  3: 0.6, // Community (post-beta)
};

function computeIMS(
  observations: SourceObservationMinimal[]
): { ims: number; ics: number } {
  if (observations.length === 0) return { ims: 0, ics: 0 };

  // IMS: weighted score from strongest observation
  let maxWeighted = 0;
  for (const obs of observations) {
    const w = RISK_WEIGHT[obs.riskClass] ?? 5;
    const m = TIER_MULTIPLIER[obs.sourceTier] ?? 1;
    const weighted = w * m;
    if (weighted > maxWeighted) maxWeighted = weighted;
  }
  const ims = Math.min(100, Math.round(maxWeighted));

  // ICS: corroboration — how many distinct active sources confirm
  const activeSources = new Set(
    observations.filter((o) => o.listIsActive).map((o) => o.sourceSlug)
  );
  const ics = Math.min(100, activeSources.size * 25);

  return { ims, ics };
}

// ── Detect entity types to check for a given value ──────────────────────────

function guessEntityTypes(value: string): IntelEntityType[] {
  const v = value.trim();
  if (/^0x[a-fA-F0-9]{40}$/i.test(v))
    return ["ADDRESS", "CONTRACT", "TOKEN_CA"];
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v))
    return ["ADDRESS", "CONTRACT", "TOKEN_CA"];
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.[a-z]{2,}$/i.test(v))
    return ["DOMAIN"];
  return ["ADDRESS", "CONTRACT", "TOKEN_CA", "DOMAIN", "PROJECT"];
}

// ── Public lookup ───────────────────────────────────────────────────────────

export async function matchEntity(
  target: MatchTarget
): Promise<IntelSignal> {
  const normalized = normalizeValue(target.type, target.value);
  const dedupKey = buildDedupKey(target.type, normalized);

  const entity = await prisma.canonicalEntity.findUnique({
    where: { dedupKey },
    include: {
      observations: {
        where: { listIsActive: true },
        orderBy: { ingestedAt: "desc" },
      },
    },
  });

  if (!entity || entity.observations.length === 0) {
    return {
      ims: 0,
      ics: 0,
      matchCount: 0,
      hasSanction: false,
      topRiskClass: null,
      matchBasis: null,
      sourceSlug: null,
      externalUrl: null,
      winner: null,
    };
  }

  const obs: SourceObservationMinimal[] = entity.observations.map((o) => ({
    id: o.id,
    sourceSlug: o.sourceSlug,
    sourceTier: o.sourceTier,
    riskClass: o.riskClass as IntelRiskClass,
    matchBasis: o.matchBasis as any,
    listIsActive: o.listIsActive,
    externalUrl: o.externalUrl,
    observedAt: o.observedAt,
    ingestedAt: o.ingestedAt,
  }));

  const { ims, ics } = computeIMS(obs);
  const hasSanction = obs.some((o) => o.riskClass === "SANCTION");
  const topRiskClass = entity.riskClass as IntelRiskClass;

  // Winner = highest weighted observation
  const winner = obs.reduce((best, o) => {
    const wBest =
      (RISK_WEIGHT[best.riskClass] ?? 0) *
      (TIER_MULTIPLIER[best.sourceTier] ?? 1);
    const wCur =
      (RISK_WEIGHT[o.riskClass] ?? 0) *
      (TIER_MULTIPLIER[o.sourceTier] ?? 1);
    return wCur > wBest ? o : best;
  }, obs[0]);

  return {
    ims,
    ics,
    matchCount: obs.length,
    hasSanction,
    topRiskClass,
    matchBasis: winner.matchBasis,
    sourceSlug: winner.sourceSlug,
    externalUrl: winner.externalUrl,
    winner,
  };
}

// ── Multi-type lookup (scanner convenience) ─────────────────────────────────

export async function lookupValue(
  value: string,
  chain?: string
): Promise<IntelSignal> {
  const types = guessEntityTypes(value);

  // Try each type, return first match with signal
  for (const type of types) {
    const signal = await matchEntity({ type, value, chain });
    if (signal.matchCount > 0) return signal;
  }

  return {
    ims: 0,
    ics: 0,
    matchCount: 0,
    hasSanction: false,
    topRiskClass: null,
    matchBasis: null,
    sourceSlug: null,
    externalUrl: null,
    winner: null,
  };
}
