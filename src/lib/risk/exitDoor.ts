export type ExitDoorLevel = "OPEN" | "TIGHT" | "BLOCKED";

export interface ExitDoorResult {
  level: ExitDoorLevel;
  label_en: string;
  label_fr: string;
  why_en: string;
  why_fr: string;
}

export interface MarketInput {
  data_unavailable?: boolean;
  liquidity_usd?: number | null;
  pair_age_days?: number | null;
}

export function computeExitDoor(market: MarketInput | null | undefined): ExitDoorResult {
  if (!market || market.data_unavailable || market.liquidity_usd == null) {
    return {
      level: "BLOCKED",
      label_en: "BLOCKED", label_fr: "BLOQUÉE",
      why_en: "No active liquidity found",
      why_fr: "Aucune liquidité active trouvée",
    };
  }

  const liq = market.liquidity_usd;
  const youngPool = (market.pair_age_days ?? 999) <= 2;

  if (liq < 20_000) {
    return {
      level: "BLOCKED",
      label_en: "BLOCKED", label_fr: "BLOQUÉE",
      why_en: "Liquidity too low to exit safely",
      why_fr: "Liquidité trop faible pour sortir",
    };
  }

  if (liq < 100_000 || youngPool) {
    return {
      level: "TIGHT",
      label_en: "TIGHT", label_fr: "ÉTROITE",
      why_en: youngPool ? "Pool under 2 days old — slippage risk" : "Limited liquidity — partial exit only",
      why_fr: youngPool ? "Pool de moins de 2 jours — risque slippage" : "Liquidité limitée — sortie partielle seulement",
    };
  }

  return {
    level: "OPEN",
    label_en: "OPEN", label_fr: "OUVERTE",
    why_en: "Sufficient liquidity to exit",
    why_fr: "Liquidité suffisante pour sortir",
  };
}
