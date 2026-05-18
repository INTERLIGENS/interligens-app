// src/lib/intelligence/contradictionDetector.ts
// Detects when a KOL tweets positively about a token WHILE their wallet sells it.
// Severity: CRITICAL < 30min, HIGH < 6h, MEDIUM < 24h (after tweet).
// Sell BEFORE tweet is NOT a contradiction.

import { prisma } from "@/lib/prisma";

// ── Public types ─────────────────────────────────────────────────────────────

export interface ContradictionAlertData {
  kolHandle: string;
  tokenMint: string;
  tokenSymbol: string;
  tweetAt: Date;
  tweetText: string | null;
  tweetUrl: string | null;
  sellAt: Date;
  sellAmountUsd: number;
  delayMinutes: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  confidenceScore: number;
}

// ── Internal types for DB rows ────────────────────────────────────────────────

type TweetRow = {
  postedAtUtc: Date;
  postUrl: string;
  detectedTokens: string;
};

type SellRow = {
  eventDate: Date;
  amountUsd: number | null;
  tokenAddress: string | null;
  tokenSymbol: string | null;
};

type DetectedToken = {
  address: string;
  symbol: string | null;
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

function parseDetectedTokens(raw: string): DetectedToken[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const result: DetectedToken[] = [];
  for (const item of parsed) {
    if (typeof item === "string" && item.length > 0) {
      result.push({ address: item, symbol: null });
    } else if (item && typeof item === "object") {
      const obj = item as { address?: string; ca?: string; symbol?: string };
      const addr = obj.address ?? obj.ca ?? "";
      if (addr || obj.symbol) {
        result.push({ address: addr, symbol: obj.symbol ?? null });
      }
    }
  }
  return result;
}

function severityFromMinutes(delayMinutes: number): "CRITICAL" | "HIGH" | "MEDIUM" | null {
  if (delayMinutes < 0) return null;
  if (delayMinutes < 30) return "CRITICAL";
  if (delayMinutes < 360) return "HIGH";
  if (delayMinutes < 1440) return "MEDIUM";
  return null;
}

function baseConfidence(severity: "CRITICAL" | "HIGH" | "MEDIUM"): number {
  if (severity === "CRITICAL") return 100;
  if (severity === "HIGH") return 80;
  return 60;
}

/**
 * Pure computation — no DB calls. Exported for testing.
 *
 * @param tweets  SocialPostCandidate rows for the handle
 * @param sells   KolProceedsEvent sell rows for the handle
 * @param kolTier KolProfile.tier (e.g. "RED", "ORANGE", "GREEN")
 */
export function computeContradictions(
  handle: string,
  tweets: TweetRow[],
  sells: SellRow[],
  kolTier: string | null,
): ContradictionAlertData[] {
  if (tweets.length === 0 || sells.length === 0) return [];

  // Group sells by normalised token address for fast lookup
  const sellsByToken = new Map<string, SellRow[]>();
  for (const s of sells) {
    const key = (s.tokenAddress ?? "").toLowerCase();
    if (!key) continue;
    const arr = sellsByToken.get(key) ?? [];
    arr.push(s);
    sellsByToken.set(key, arr);
  }

  // Track how many times each token is sold across all contradiction windows
  // (for the multi-sell bonus)
  const sellCountPerToken = new Map<string, Set<string>>();

  const alerts: ContradictionAlertData[] = [];
  const seen = new Set<string>(); // dedup key: tokenMint:tweetAt.iso:sellAt.iso

  for (const tweet of tweets) {
    const tokens = parseDetectedTokens(tweet.detectedTokens);
    for (const token of tokens) {
      if (!token.address) continue;
      const tokenKey = token.address.toLowerCase();
      const candidates = sellsByToken.get(tokenKey);
      if (!candidates) continue;

      const windowEnd = new Date(tweet.postedAtUtc.getTime() + 24 * 60 * 60 * 1000);

      for (const sell of candidates) {
        const delayMs = sell.eventDate.getTime() - tweet.postedAtUtc.getTime();
        const delayMinutes = Math.round(delayMs / 60_000);
        const severity = severityFromMinutes(delayMinutes);
        if (!severity) continue;

        // Only flag if sell is at or after the tweet
        if (delayMs < 0) continue;
        if (sell.eventDate > windowEnd) continue;

        const dedupKey = `${tokenKey}:${tweet.postedAtUtc.toISOString()}:${sell.eventDate.toISOString()}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        // Track sell count for multi-sell bonus
        const sellSet = sellCountPerToken.get(tokenKey) ?? new Set();
        sellSet.add(sell.eventDate.toISOString());
        sellCountPerToken.set(tokenKey, sellSet);

        alerts.push({
          kolHandle: handle,
          tokenMint: token.address,
          tokenSymbol: token.symbol ?? sell.tokenSymbol ?? "UNKNOWN",
          tweetAt: tweet.postedAtUtc,
          tweetText: null,
          tweetUrl: tweet.postUrl,
          sellAt: sell.eventDate,
          sellAmountUsd: Number(sell.amountUsd ?? 0),
          delayMinutes,
          severity,
          confidenceScore: baseConfidence(severity),
        });
      }
    }
  }

  // Apply bonuses now that we have the full picture
  const tierBonus = kolTier === "RED" ? 10 : 0;

  return alerts.map((a) => {
    const multiSellBonus = (sellCountPerToken.get(a.tokenMint.toLowerCase())?.size ?? 0) > 1 ? 10 : 0;
    return {
      ...a,
      confidenceScore: Math.min(100, a.confidenceScore + tierBonus + multiSellBonus),
    };
  });
}

// ── DB loaders ────────────────────────────────────────────────────────────────

async function loadTweets(handle: string): Promise<TweetRow[]> {
  try {
    return await prisma.socialPostCandidate.findMany({
      where: {
        influencer: { handle },
        postedAtUtc: { not: null },
        detectedTokens: { not: "[]" },
      },
      select: { postedAtUtc: true, postUrl: true, detectedTokens: true },
      orderBy: { postedAtUtc: "desc" },
      take: 500,
    }) as unknown as TweetRow[];
  } catch {
    return [];
  }
}

async function loadSells(handle: string): Promise<SellRow[]> {
  try {
    return await prisma.$queryRaw<SellRow[]>`
      SELECT "eventDate", "amountUsd", "tokenAddress", "tokenSymbol"
      FROM "KolProceedsEvent"
      WHERE "kolHandle" = ${handle}
        AND "eventType" IN ('sell', 'cex_deposit')
        AND "amountUsd" > 0
        AND "ambiguous" = false
        AND "tokenAddress" IS NOT NULL
      ORDER BY "eventDate" DESC
      LIMIT 1000
    `;
  } catch {
    return [];
  }
}

async function loadKolTier(handle: string): Promise<string | null> {
  try {
    const row = await prisma.kolProfile.findUnique({
      where: { handle },
      select: { tier: true },
    });
    return row?.tier ?? null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect contradiction alerts for a KOL handle.
 * Always resolves; never throws.
 */
export async function detectContradictions(handle: string): Promise<ContradictionAlertData[]> {
  const normalized = handle.replace(/^@+/, "").trim();
  if (!normalized) return [];

  try {
    const [tweets, sells, kolTier] = await Promise.all([
      loadTweets(normalized),
      loadSells(normalized),
      loadKolTier(normalized),
    ]);
    return computeContradictions(normalized, tweets, sells, kolTier);
  } catch (err) {
    console.error("[contradictionDetector] detectContradictions failed", err);
    return [];
  }
}

/**
 * Persist contradiction alerts into ContradictionAlert table (raw SQL).
 * Idempotent via ON CONFLICT DO NOTHING on (kolHandle, tokenMint, tweetAt, sellAt).
 */
export async function persistContradictions(alerts: ContradictionAlertData[]): Promise<void> {
  if (alerts.length === 0) return;

  for (const a of alerts) {
    try {
      await prisma.$executeRaw`
        INSERT INTO "ContradictionAlert"
          ("id", "kolHandle", "tokenMint", "tokenSymbol",
           "tweetAt", "tweetText", "tweetUrl",
           "sellAt", "sellAmountUsd", "delayMinutes",
           "severity", "confidenceScore", "status", "createdAt")
        VALUES
          (gen_random_uuid()::text, ${a.kolHandle}, ${a.tokenMint}, ${a.tokenSymbol},
           ${a.tweetAt}, ${a.tweetText}, ${a.tweetUrl},
           ${a.sellAt}, ${a.sellAmountUsd}, ${a.delayMinutes},
           ${a.severity}, ${a.confidenceScore}, 'new', now())
        ON CONFLICT ("kolHandle", "tokenMint", "tweetAt", "sellAt") DO NOTHING
      `;
    } catch (err) {
      console.error("[contradictionDetector] persistContradictions row failed", err);
    }
  }
}

/**
 * Detect + persist in one call. Non-fatal — errors are logged, not thrown.
 */
export async function detectAndPersistContradictions(handle: string): Promise<void> {
  try {
    const alerts = await detectContradictions(handle);
    if (alerts.length > 0) {
      await persistContradictions(alerts);
      console.log(`[contradictionDetector] ${alerts.length} alert(s) persisted for @${handle}`);
    }
  } catch (err) {
    console.error("[contradictionDetector] detectAndPersistContradictions failed", err);
  }
}
