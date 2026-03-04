export type WhaleLevel = "LOW" | "MED" | "HIGH";

export interface WhaleInput {
  top10_pct?: number | null;
}

export interface WhaleResult {
  level: WhaleLevel;
  top10_pct: number | null;
  display: string;
  label_en: string;
  label_fr: string;
  why_en: string;
  why_fr: string;
}

export function computeWhaleLevel(input: WhaleInput | null | undefined): WhaleResult {
  const pct = input?.top10_pct ?? null;

  if (pct == null) {
    return {
      level: "MED", top10_pct: null,
      label_en: "MED", label_fr: "MOYEN",
      why_en: "Holder data unavailable",
      why_fr: "Données holders indisponibles",
      display: "Top10: n/a",
    };
  }

  if (pct >= 60) {
    return {
      level: "HIGH", top10_pct: pct,
      display: `Top10: ${Math.round(pct)}%`,
      label_en: "HIGH", label_fr: "ÉLEVÉ",
      why_en: `Top 10 hold ${pct}% — high dump risk`,
      why_fr: `Top 10 détient ${pct}% — risque dump élevé`,
    };
  }

  if (pct >= 35) {
    return {
      level: "MED", top10_pct: pct,
      display: `Top10: ${Math.round(pct)}%`,
      label_en: "MED", label_fr: "MOYEN",
      why_en: `Top 10 hold ${pct}% — moderate concentration`,
      why_fr: `Top 10 détient ${pct}% — concentration modérée`,
    };
  }

  return {
    level: "LOW", top10_pct: pct,
    label_en: "LOW", label_fr: "FAIBLE",
    why_en: `Top 10 hold ${pct}% — distributed supply`,
    why_fr: `Top 10 détient ${pct}% — offre distribuée`,
  };
}
