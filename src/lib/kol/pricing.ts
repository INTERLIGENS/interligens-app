// src/lib/kol/pricing.ts
// Historical price lookup — Coingecko with durable DB cache
// Cache priority: DB → Coingecko → yearly fallback

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const memCache = new Map<string, { price: number; source: string }>();

const STABLECOINS = new Set(["USDC", "USDT", "DAI", "BUSD", "USDE"]);

const COIN_IDS: Record<string, string> = {
  SOL: "solana",
  ETH: "ethereum",
  BNB: "binancecoin",
};

const YEARLY_FALLBACK: Record<string, Record<number, number>> = {
  SOL: { 2024: 120, 2025: 145, 2026: 185 },
  ETH: { 2024: 2800, 2025: 2400, 2026: 2000 },
};

export type PricingSource =
  | "stablecoin"
  | "coingecko_historical"
  | "yearly_fallback"
  | "inferred_swap_value"
  | "unavailable"
  | "yearly_fallback_legacy";

export async function getPriceAtDate(
  symbol: string,
  dateIso: string
): Promise<{ price: number; source: PricingSource }> {
  const upper = symbol.toUpperCase();

  if (STABLECOINS.has(upper)) {
    return { price: 1.0, source: "stablecoin" };
  }

  const dateOnly = dateIso.slice(0, 10);
  const memKey = `${upper}:${dateOnly}`;

  // 1. In-memory cache (session)
  if (memCache.has(memKey)) {
    const cached = memCache.get(memKey)!;
    return { price: cached.price, source: cached.source as PricingSource };
  }

  // 2. DB cache
  try {
    const rows = await prisma.$queryRaw`
      SELECT "priceUsd", source FROM "PriceCache"
      WHERE symbol = ${upper} AND "dateOnly" = ${dateOnly}
      LIMIT 1
    ` as any[];

    if (rows.length && rows[0].priceUsd > 0) {
      const result = { price: rows[0].priceUsd, source: rows[0].source as PricingSource };
      memCache.set(memKey, result);
      return result;
    }
  } catch {
    // DB unavailable — continue
  }

  // 3. Binance historical klines — free, no key, full history
  const BINANCE_SYMBOLS: Record<string, string> = {
    SOL: "SOLUSDT",
    ETH: "ETHUSDT",
    BNB: "BNBUSDT",
  };
  const binanceSymbol = BINANCE_SYMBOLS[upper];
  if (binanceSymbol) {
    try {
      const startMs = new Date(dateOnly + "T12:00:00Z").getTime();
      const endMs = startMs + 86400000;
      const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1d&startTime=${startMs}&endTime=${endMs}&limit=1`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        // Binance kline: [openTime, open, high, low, close, ...]
        const close = data?.[0]?.[4] ? parseFloat(data[0][4]) : null;
        if (close && close > 0) {
          try {
            await prisma.$executeRawUnsafe(`
              INSERT INTO "PriceCache" (symbol, "dateOnly", "priceUsd", source)
              VALUES ($1, $2, $3, 'coingecko_historical')
              ON CONFLICT (symbol, "dateOnly") DO NOTHING
            `, upper, dateOnly, close);
          } catch { /* non-blocking */ }
          const result = { price: close, source: "coingecko_historical" as PricingSource };
          memCache.set(memKey, result);
          return result;
        }
      }
    } catch {
      // Binance unavailable
    }
  }

  // 4. Yearly fallback
  const year = parseInt(dateOnly.slice(0, 4), 10);
  const fallbackYear = Math.min(Math.max(year, 2024), 2026);
  const fallback = YEARLY_FALLBACK[upper]?.[fallbackYear] ?? null;

  if (fallback) {
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "PriceCache" (symbol, "dateOnly", "priceUsd", source)
        VALUES ($1, $2, $3, 'yearly_fallback')
        ON CONFLICT (symbol, "dateOnly") DO NOTHING
      `, upper, dateOnly, fallback);
    } catch { /* non-blocking */ }
    const result = { price: fallback, source: "yearly_fallback" as PricingSource };
    memCache.set(memKey, result);
    return result;
  }

  return { price: 0, source: "unavailable" };
}

export function clearPriceCache(): void {
  memCache.clear();
}

export async function disconnectPricing(): Promise<void> {
  await prisma.$disconnect();
}
