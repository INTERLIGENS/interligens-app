// src/lib/kol/pricing.ts
// Historical SOL/ETH price lookup via Coingecko public API
// In-memory cache per compute session — no DB dependency

const priceCache = new Map<string, number>();

const STABLECOINS = new Set(["USDC", "USDT", "DAI", "BUSD", "USDE"]);

const COIN_IDS: Record<string, string> = {
  SOL: "solana",
  ETH: "ethereum",
  BNB: "binancecoin",
};

// Fallback prices if Coingecko is unavailable — better than nothing, labeled as fallback
const YEARLY_FALLBACK: Record<string, Record<number, number>> = {
  SOL: { 2024: 120, 2025: 145, 2026: 185 },
  ETH: { 2024: 2800, 2025: 2400, 2026: 2000 },
};

export async function getPriceAtDate(
  symbol: string,
  dateIso: string
): Promise<{ price: number; source: "coingecko" | "yearly_fallback" | "stablecoin" }> {
  const upper = symbol.toUpperCase();

  // Stablecoins — always $1
  if (STABLECOINS.has(upper)) {
    return { price: 1.0, source: "stablecoin" };
  }

  const dateOnly = dateIso.slice(0, 10); // "2025-01-27"
  const cacheKey = `${upper}:${dateOnly}`;

  if (priceCache.has(cacheKey)) {
    return { price: priceCache.get(cacheKey)!, source: "coingecko" };
  }

  const coinId = COIN_IDS[upper];
  if (coinId) {
    try {
      const [y, m, d] = dateOnly.split("-");
      const cgDate = `${d}-${m}-${y}`; // Coingecko format: DD-MM-YYYY
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${cgDate}&localization=false`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const price = data?.market_data?.current_price?.usd ?? null;
        if (price && price > 0) {
          priceCache.set(cacheKey, price);
          return { price, source: "coingecko" };
        }
      }
    } catch {
      // Coingecko unavailable — fall through to yearly fallback
    }
  }

  // Yearly fallback
  const year = parseInt(dateOnly.slice(0, 4), 10);
  const fallbackYear = Math.min(Math.max(year, 2024), 2026);
  const fallback = YEARLY_FALLBACK[upper]?.[fallbackYear] ?? null;

  if (fallback) {
    return { price: fallback, source: "yearly_fallback" };
  }

  // Unknown token — return 0 (will be flagged as null in proceeds)
  return { price: 0, source: "yearly_fallback" };
}

export function clearPriceCache(): void {
  priceCache.clear();
}
