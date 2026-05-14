/**
 * src/app/api/cron/price-cache-refresh/route.ts
 *
 * Refreshes TokenPriceTracker rows every 6h.
 * - Updates currentPrice + currentDate on every run.
 * - Grows peakPrice as a watermark (only if new high observed).
 * - Re-derives dumpPct = (peak - current) / peak * 100.
 *
 * Strategy:
 *   - Pulls rows ORDER BY "lastRefreshAt" ASC NULLS FIRST so stale rows
 *     are refreshed first.
 *   - 1 req/sec pacing on DexScreener; SOL fallback via Jupiter.
 *   - Hard time budget (270s out of 300s maxDuration): if we run long
 *     we exit gracefully — the next cron picks up where we left off.
 *   - Quota guard: 3 consecutive 429s → exit early.
 *
 * Schedule: every 6h (see vercel.json).
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://interligens.com/api/cron/price-cache-refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const prisma = new PrismaClient();

const DEXSCREENER_RATE_MS = 1000;
const JUPITER_RATE_MS = 200;
const TIME_BUDGET_MS = 270_000; // leave 30s slack before the 300s hard cap
const MAX_CONSECUTIVE_429 = 3;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

interface PricePoint {
  currentPrice: number;
  peakCandidate: number;
  peakOffsetHours: number;
  source: 'dexscreener' | 'jupiter';
}

interface FetchResult {
  ok: boolean;
  rateLimited: boolean;
  reason?: string;
  data?: PricePoint;
}

async function fromDexScreener(address: string): Promise<FetchResult> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { headers: { accept: 'application/json' } },
    );
    if (r.status === 429) return { ok: false, rateLimited: true, reason: 'dexscreener_429' };
    if (!r.ok) return { ok: false, rateLimited: false, reason: `dexscreener_http_${r.status}` };
    const j: any = await r.json();
    const pairs: any[] = j?.pairs ?? [];
    if (pairs.length === 0) return { ok: false, rateLimited: false, reason: 'dexscreener_no_pairs' };
    const best = [...pairs].sort(
      (a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0),
    )[0];
    const current = parseFloat(best.priceUsd ?? '0');
    if (!isFinite(current) || current <= 0) {
      return { ok: false, rateLimited: false, reason: 'dexscreener_zero_price' };
    }
    let peakCandidate = current;
    let peakOffsetHours = 0;
    for (const [k, ch] of Object.entries({
      h1: best?.priceChange?.h1,
      h6: best?.priceChange?.h6,
      h24: best?.priceChange?.h24,
    })) {
      if (typeof ch !== 'number' || ch >= 0) continue;
      const then = current / (1 + ch / 100);
      if (then > peakCandidate) {
        peakCandidate = then;
        peakOffsetHours = k === 'h1' ? 1 : k === 'h6' ? 6 : 24;
      }
    }
    return {
      ok: true,
      rateLimited: false,
      data: { currentPrice: current, peakCandidate, peakOffsetHours, source: 'dexscreener' },
    };
  } catch (e: any) {
    return { ok: false, rateLimited: false, reason: `dexscreener_throw_${e?.message?.slice(0, 60)}` };
  }
}

async function fromJupiter(address: string): Promise<FetchResult> {
  try {
    const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${address}`, {
      headers: { accept: 'application/json' },
    });
    if (r.status === 429) return { ok: false, rateLimited: true, reason: 'jupiter_429' };
    if (!r.ok) return { ok: false, rateLimited: false, reason: `jupiter_http_${r.status}` };
    const j: any = await r.json();
    const data = j?.[address] ?? j?.data?.[address];
    const price = data?.usdPrice ?? data?.price;
    if (typeof price !== 'number' || price <= 0) {
      return { ok: false, rateLimited: false, reason: 'jupiter_no_price' };
    }
    return {
      ok: true,
      rateLimited: false,
      data: { currentPrice: price, peakCandidate: price, peakOffsetHours: 0, source: 'jupiter' },
    };
  } catch (e: any) {
    return { ok: false, rateLimited: false, reason: `jupiter_throw_${e?.message?.slice(0, 60)}` };
  }
}

async function refresh() {
  const started = Date.now();
  const rows = await prisma.$queryRaw<{
    id: string;
    chain: string;
    contractAddress: string;
    peakPrice: string | null; // Decimal comes back as string in raw query
  }[]>`
    SELECT id, chain, "contractAddress", "peakPrice"
    FROM "TokenPriceTracker"
    ORDER BY "lastRefreshAt" ASC NULLS FIRST`;

  const stats = {
    total: rows.length,
    refreshed: 0,
    peakUpdated: 0,
    failed: 0,
    skippedBudget: 0,
    quotaExceeded: false,
    startedAt: new Date(started).toISOString(),
  };

  let consecutive429 = 0;
  for (let i = 0; i < rows.length; i++) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      stats.skippedBudget = rows.length - i;
      break;
    }
    if (consecutive429 >= MAX_CONSECUTIVE_429) {
      stats.quotaExceeded = true;
      stats.skippedBudget = rows.length - i;
      break;
    }

    const row = rows[i];
    let result = await fromDexScreener(row.contractAddress);
    if (!result.ok && row.chain.toUpperCase() === 'SOL') {
      await sleep(JUPITER_RATE_MS);
      result = await fromJupiter(row.contractAddress);
    }
    if (result.rateLimited) {
      consecutive429++;
    } else {
      consecutive429 = 0;
    }

    if (!result.ok || !result.data) {
      stats.failed++;
      // Touch lastRefreshAt so we don't keep retrying the same dead token
      // every cycle — defer next attempt until the rest of the cohort cycles.
      await prisma.$executeRaw`
        UPDATE "TokenPriceTracker"
        SET "lastRefreshAt" = NOW(), "updatedAt" = NOW()
        WHERE id = ${row.id}`;
    } else {
      const { currentPrice, peakCandidate, source } = result.data;
      const storedPeak = row.peakPrice !== null ? parseFloat(row.peakPrice) : 0;
      const newPeak = Math.max(storedPeak, peakCandidate);
      const peakChanged = newPeak > storedPeak;
      if (peakChanged) stats.peakUpdated++;
      const dumpPct = newPeak > 0 ? ((newPeak - currentPrice) / newPeak) * 100 : 0;
      await prisma.$executeRawUnsafe(
        `UPDATE "TokenPriceTracker"
         SET "currentPrice" = $1,
             "currentDate"  = NOW(),
             "peakPrice"    = $2,
             "peakDate"     = CASE WHEN $3::boolean THEN NOW() ELSE "peakDate" END,
             "dumpPct"      = $4,
             source         = $5,
             "lastRefreshAt"= NOW(),
             "updatedAt"    = NOW()
         WHERE id = $6`,
        currentPrice,
        newPeak,
        peakChanged,
        Math.round(dumpPct * 10000) / 10000,
        source,
        row.id,
      );
      stats.refreshed++;
    }
    // Pace primary requests (skip pacing on the last row).
    if (i < rows.length - 1) await sleep(DEXSCREENER_RATE_MS);
  }

  return {
    ...stats,
    durationMs: Date.now() - started,
    finishedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET not set' },
      { status: 500 },
    );
  }
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await refresh();
    console.log('[price-cache-refresh]', JSON.stringify(result));
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[price-cache-refresh] cron error:', err);
    return NextResponse.json(
      { error: 'Internal error', message: err?.message?.slice(0, 200) },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
