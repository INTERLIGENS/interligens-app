export type CabalTier = "LOW" | "MED" | "HIGH";

export interface CabalInput {
  off_chain?: { case_id?: string | null };
  tiger_drivers?: string[];
  market?: { volume_24h_usd?: number | null; liquidity_usd?: number | null };
}

export interface CabalResult {
  score: number;
  tier: CabalTier;
  label_en: string;
  label_fr: string;
  why_en: string;
  why_fr: string;
  drivers: string[];
}

export function computeCabalScore(scan: CabalInput | null | undefined): CabalResult {
  let score = 20;
  const drivers: string[] = [];

  if (scan?.off_chain?.case_id) {
    score += 30;
    drivers.push("Referenced investigation");
  }

  const tigerDrivers = scan?.tiger_drivers ?? [];
  if (tigerDrivers.some(d => d.toLowerCase().includes("pump"))) {
    score += 25;
    drivers.push("Pump.fun pattern detected");
  }

  const vol = scan?.market?.volume_24h_usd ?? 0;
  const liq = scan?.market?.liquidity_usd ?? 0;
  if (vol > 0 && liq > 0 && vol > 5 * liq) {
    score += 15;
    drivers.push("Volume/liquidity ratio abnormal");
  }

  score = Math.min(100, score);
  const tier: CabalTier = score >= 70 ? "HIGH" : score >= 45 ? "MED" : "LOW";

  return {
    score, tier,
    label_en: tier === "HIGH" ? "HIGH" : tier === "MED" ? "MED" : "LOW",
    label_fr: tier === "HIGH" ? "ÉLEVÉ" : tier === "MED" ? "MOYEN" : "FAIBLE",
    why_en: drivers[0] ?? "No coordinated signal detected",
    why_fr: drivers[0] === "Referenced investigation" ? "Dossier référencé"
          : drivers[0] === "Pump.fun pattern detected" ? "Schéma pump.fun détecté"
          : drivers[0] === "Volume/liquidity ratio abnormal" ? "Ratio volume/liquidité anormal"
          : "Aucun signal coordonné détecté",
    drivers: drivers.slice(0, 3),
  };
}
