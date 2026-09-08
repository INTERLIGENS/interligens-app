// Single source of truth for score→tier mapping
export type Tier = "GREEN" | "ORANGE" | "RED";

/** 0–34 GREEN · 35–69 ORANGE · 70–100 RED */
export function getTier(score: number): Tier {
  if (score >= 70) return "RED";
  if (score >= 35) return "ORANGE";
  return "GREEN";
}

// ─── BUILD 10 · P0 — UN SCORE ABSENT N'EST PAS UN SCORE DE ZÉRO ────────────
//
// ██  `getTier` reste INTACTE. Aucun seuil, aucun barème n'est touché.      ██
//
// Le défaut mesuré en S0 : les pages coerçaient un score absent en `0`, et
// `getTier(0)` rend GREEN. Sur un produit de protection du retail, une donnée
// manquante produisait donc le verdict le plus rassurant que le produit sache
// écrire — en vert.
//
// La correction n'est PAS dans le barème. Elle est en amont : un appelant qui
// n'a pas de score ne doit pas appeler `getTier`. Il appelle celle-ci, qui
// rend un quatrième état, et qui n'a aucune couleur favorable à offrir.
//
// `UNKNOWN` n'est pas un risque non plus. La tentation symétrique — « si on ne
// sait pas, mettons rouge » — est aussi fausse que la coercition qu'on ferme.
export type TierOrUnknown = Tier | "UNKNOWN";

/**
 * Le palier, ou `UNKNOWN` quand aucun score n'a été mesuré.
 *
 * `null` et `undefined` rendent `UNKNOWN`. `0` rend `GREEN` — parce qu'un
 * zéro MESURÉ est un vrai zéro, et c'est exactement la distinction que P0
 * rétablit.
 */
export function getTierOrUnknown(score: number | null | undefined): TierOrUnknown {
  if (score === null || score === undefined || Number.isNaN(score)) return "UNKNOWN";
  return getTier(score);
}

export function getTierColor(t: Tier): string {
  if (t === "RED")    return "#ef4444";
  if (t === "ORANGE") return "#f97316";
  return "#22c55e";
}

/**
 * La couleur d'un palier éventuellement inconnu.
 *
 * `UNKNOWN` est GRIS. Ni vert — ce serait la coercition qu'on ferme — ni
 * rouge — ce serait inventer un risque.
 */
export function getTierOrUnknownColor(t: TierOrUnknown): string {
  if (t === "UNKNOWN") return "#6b7280";
  return getTierColor(t);
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
