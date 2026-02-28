import type { CaseClaim } from "./caseDb";

export type RiskTier = "GREEN" | "AMBER" | "RED";

export type ScoringResult = {
  score: number;
  tier: RiskTier;
  breakdown: {
    base_score: number;
    claim_penalty: number;
    severity_multiplier: number;
  };
  flags: string[];
};

const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 15,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
};

export function computeScore(
  claims: CaseClaim[],
  fallbackBaseScore = 20
): ScoringResult {
  const flags: string[] = [];

  if (claims.length === 0) {
    console.error("[scoring] claims.length==0 — using fallback base score:", fallbackBaseScore);
    flags.push("NO_CLAIMS_FALLBACK");
    const score = Math.min(100, Math.max(1, fallbackBaseScore));
    return {
      score,
      tier: scoreTier(score),
      breakdown: { base_score: fallbackBaseScore, claim_penalty: 0, severity_multiplier: 1 },
      flags,
    };
  }

  const confirmed = claims.filter((c) => c.status === "CONFIRMED");
  const claimPenalty = confirmed.reduce((acc, c) => {
    return acc + (SEVERITY_WEIGHT[c.severity] ?? 5);
  }, 0);

  const severityMultiplier =
    confirmed.some((c) => c.severity === "CRITICAL") ? 1.2 : 1.0;

  let raw = Math.round(claimPenalty * severityMultiplier);

  if (claims.length >= 6 && raw < 70) {
    console.log(`[scoring] claims.length=${claims.length} >= 6 — enforcing floor score=70`);
    flags.push("CLAIM_FLOOR_ENFORCED");
    raw = 70;
  }

  const score = Math.min(100, raw);
  const tier = scoreTier(score);

  flags.push(`confirmed_claims=${confirmed.length}`);
  if (confirmed.some((c) => c.severity === "CRITICAL")) flags.push("CRITICAL_CLAIM_PRESENT");

  console.log(
    `[scoring] score=${score} tier=${tier} claims=${claims.length} ` +
      `penalty=${claimPenalty} multiplier=${severityMultiplier}`
  );

  return {
    score,
    tier,
    breakdown: {
      base_score: 0,
      claim_penalty: claimPenalty,
      severity_multiplier: severityMultiplier,
    },
    flags,
  };
}

function scoreTier(score: number): RiskTier {
  if (score >= 70) return "RED";
  if (score >= 40) return "AMBER";
  return "GREEN";
}
