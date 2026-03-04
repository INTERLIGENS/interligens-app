import { resolveEntity } from "@/lib/entities/registry";

export type CabalTier = "LOW" | "MED" | "HIGH";

export interface CabalInput {
  chain?: string;
  address?: string;
  off_chain?: { case_id?: string | null };
  tiger_drivers?: Array<string | unknown>;
  market?: { volume_24h_usd?: number | null; liquidity_usd?: number | null };
  social?: { discord?: { spike?: boolean } };
  spenders?: string[];
  unlimitedCount?: number;
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
  let limitedData = false;
  const chain = (scan?.chain ?? "").toUpperCase();

  if (scan?.off_chain?.case_id) {
    score += 30;
    drivers.push("casefile_present");
  }

  if (scan?.social?.discord?.spike === true) {
    score += 10;
    drivers.push("discord_spike");
  }

  if (chain === "SOL") {
    const tigerDrivers = scan?.tiger_drivers ?? [];
    const addr = scan?.address ?? "";
    const isPump = tigerDrivers.some(d => String(d ?? "").toLowerCase().includes("pump"))
      || addr.endsWith("pump");
    if (isPump) {
      score += 25;
      drivers.push("pump_like");
    }
    const vol = scan?.market?.volume_24h_usd ?? 0;
    const liq = scan?.market?.liquidity_usd ?? 0;
    if (vol > 0 && liq > 0 && vol > 5 * liq) {
      score += 15;
      drivers.push("wash_hype");
    }
  }

  if (chain === "ETH" || chain === "BSC") {
    const spenders = scan?.spenders ?? null;
    if (spenders === null) {
      limitedData = true;
    } else {
      let unknownCount = 0;
      for (const addr of spenders) {
        try {
          const entity = resolveEntity(chain, addr);
          if (!entity || entity.category === "unknown" || !entity.isOfficial) unknownCount++;
        } catch { unknownCount++; }
      }
      if (unknownCount >= 2) {
        score += 20;
        drivers.push("unknown_spenders");
      }
    }
    const unlimited = scan?.unlimitedCount ?? 0;
    if (unlimited > 0) {
      score += 15;
      drivers.push("unlimited_approvals");
    }
  }

  score = Math.min(100, score);
  const tier: CabalTier = score >= 70 ? "HIGH" : score >= 45 ? "MED" : "LOW";
  const sx_en = limitedData ? " (limited data)" : "";
  const sx_fr = limitedData ? " (donnees limitees)" : "";

  const why_en = score >= 70
    ? "Coordinated influence risk detected" + sx_en
    : score >= 45
    ? "Influence signals require caution" + sx_en
    : "No strong influence signals" + sx_en;

  const why_fr = score >= 70
    ? "Risque d influence coordonnee detecte" + sx_fr
    : score >= 45
    ? "Signaux d influence : prudence" + sx_fr
    : "Pas de signaux d influence forts" + sx_fr;

  return {
    score, tier,
    label_en: tier === "HIGH" ? "HIGH" : tier === "MED" ? "MED" : "LOW",
    label_fr: tier === "HIGH" ? "ELEVE" : tier === "MED" ? "MOYEN" : "FAIBLE",
    why_en, why_fr,
    drivers: drivers.slice(0, 3),
  };
}
