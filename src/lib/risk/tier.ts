// Single source of truth for score→tier mapping
export type Tier = "GREEN" | "ORANGE" | "RED";

/** 0–34 GREEN · 35–69 ORANGE · 70–100 RED */
export function getTier(score: number): Tier {
  if (score >= 70) return "RED";
  if (score >= 35) return "ORANGE";
  return "GREEN";
}

export function getTierColor(t: Tier): string {
  if (t === "RED")    return "#ef4444";
  if (t === "ORANGE") return "#f97316";
  return "#22c55e";
}

export type Confidence = "HIGH" | "MED" | "LOW";

export interface FinalVerdict {
  tier: Tier;
  score: number;
  label: { en: string; fr: string };
  sub:   { en: string; fr: string };
}

export function computeFinalVerdict(
  baseScore: number,
  baseTier: Tier,
  recidivismDetected: boolean,
  confidence: Confidence,
): FinalVerdict {
  let tier = baseTier;
  let score = baseScore;

  if (recidivismDetected) {
    if (confidence === "HIGH") {
      tier  = "RED";
      score = Math.max(baseScore, 85);
    } else if (confidence === "MED") {
      if (tier === "GREEN") tier = "ORANGE";
      score = Math.max(baseScore, 70);
    }
  }

  const labels: Record<Tier, { en: string; fr: string }> = {
    RED:    { en: "Avoid",   fr: "Éviter" },
    ORANGE: { en: "Caution", fr: "Attention" },
    GREEN:  { en: "Proceed", fr: "OK" },
  };
  const subs: Record<Tier, { en: string; fr: string }> = {
    RED:    { en: "High-risk patterns detected. Avoid interaction.",       fr: "Schémas à haut risque détectés. Évitez toute interaction." },
    ORANGE: { en: "Suspicious signals detected. Proceed with caution.",    fr: "Signaux suspects détectés. Procédez avec prudence." },
    GREEN:  { en: "Wallet health looks clean. Still verify URLs.",         fr: "Wallet sain. Vérifiez quand même les URLs." },
  };

  return { tier, score, label: labels[tier], sub: subs[tier] };
}
