export interface SellImpactResult {
  bucket: "GOOD" | "OK" | "BAD";
  est_slippage_pct: number | null;
  est_received_usd: number | null;
  why_en: string;
  why_fr: string;
}

export function estimateSellImpactUSD(
  sell_usd: number,
  market?: { liquidity_usd?: number | null; data_unavailable?: boolean } | null
): SellImpactResult {
  if (!market || market.data_unavailable || market.liquidity_usd == null) {
    return { bucket: "BAD", est_slippage_pct: null, est_received_usd: null,
      why_en: "No liquidity data — sell impact unknown.", why_fr: "Liquidité inconnue — impact de vente indéterminé." };
  }
  const liq = Math.max(Number(market.liquidity_usd), 1);
  const slippage = Math.min((sell_usd / liq) * 120, 99);
  const received = sell_usd * (1 - slippage / 100);
  const bucket = slippage < 3 ? "GOOD" : slippage <= 10 ? "OK" : "BAD";
  const sp = slippage.toFixed(1);
  const rec = Math.round(received);
  return {
    bucket, est_slippage_pct: Math.round(slippage * 10) / 10, est_received_usd: rec,
    why_en: `Sell $${sell_usd.toLocaleString()} → ~$${rec.toLocaleString()} (≈${sp}% slippage)`,
    why_fr: `Vente ${sell_usd.toLocaleString()}$ → ~${rec.toLocaleString()}$ (≈${sp}% slippage)`,
  };
}
