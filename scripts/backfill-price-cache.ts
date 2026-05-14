// ─────────────────────────────────────────────────────────────────────────
// Step 3 — Backfill TokenPriceTracker from the audit universe.
//
// Sources (in order):
//   1. DexScreener (primary, multi-chain, free, 1 req/sec to be polite)
//      https://api.dexscreener.com/latest/dex/tokens/{address}
//   2. Jupiter (SOL fallback when DexScreener has no pair)
//      https://lite-api.jup.ag/price/v3?ids={mint}
//
// Decision rationale (2026-05-13):
//   - DexScreener: best multi-chain coverage at zero cost; exposes
//     priceChange.h24 which lets us reconstruct a 24h watermark for tokens
//     that have already dumped.
//   - Jupiter: native SOL routing prices; covers tokens that DexScreener
//     lost (delisted pairs, ultra-low liquidity).
//   - ATH not available without paid API; we seed peakPrice with the
//     24h-ago derived value and let the cron grow it as a watermark.
//
// Defaults:
//   - DRY-RUN: no DB writes. Pass --commit to upsert into TokenPriceTracker.
//   - Limit: pass --limit N to process only the first N tokens.
//
// Usage:
//   pnpm tsx scripts/backfill-price-cache.ts                # dry-run, all
//   pnpm tsx scripts/backfill-price-cache.ts --limit 10     # dry-run, 10
//   pnpm tsx scripts/backfill-price-cache.ts --commit       # write to DB
//
// Prereq for --commit:
//   Run exports/migrations_pricecache_2026-05-13.sql in Neon SQL Editor.
// ─────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';

const envLocal = fs.readFileSync(
  path.join(process.cwd(), '.env.local'),
  'utf8',
);
const dbUrl = envLocal.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!dbUrl) {
  console.error('[fatal] DATABASE_URL not found in .env.local');
  process.exit(1);
}
process.env.DATABASE_URL = dbUrl;

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const limitArg = args.find((a) => a.startsWith('--limit'));
const LIMIT = limitArg
  ? Number(limitArg.split('=')[1] ?? args[args.indexOf(limitArg) + 1] ?? Infinity)
  : Infinity;

const DEXSCREENER_RATE_MS = 1000; // 1 req/sec
const JUPITER_RATE_MS = 200; // very lenient

interface InputToken {
  chain: string;
  contractAddress: string;
  symbols: string[];
  kolHandles: string[];
}

interface PriceResult {
  status: 'ok' | 'partial' | 'failed';
  currentPrice: number | null;
  peakPrice: number | null;
  peakDate: string | null; // ISO
  source: 'dexscreener' | 'jupiter' | null;
  reason?: string;
  meta?: Record<string, unknown>;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function fetchDexScreener(addr: string): Promise<PriceResult> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${addr}`,
      { headers: { accept: 'application/json' } },
    );
    if (r.status === 429) {
      return { status: 'failed', currentPrice: null, peakPrice: null, peakDate: null, source: null, reason: 'dexscreener_429' };
    }
    if (!r.ok) {
      return {
        status: 'failed',
        currentPrice: null,
        peakPrice: null,
        peakDate: null,
        source: null,
        reason: `dexscreener_http_${r.status}`,
      };
    }
    const j: any = await r.json();
    const pairs: any[] = j?.pairs ?? [];
    if (pairs.length === 0) {
      return { status: 'failed', currentPrice: null, peakPrice: null, peakDate: null, source: null, reason: 'dexscreener_no_pairs' };
    }
    // Pick the pair with the deepest liquidity for the most reliable price.
    const best = [...pairs].sort(
      (a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0),
    )[0];
    const current = parseFloat(best.priceUsd ?? '0');
    if (!isFinite(current) || current <= 0) {
      return { status: 'failed', currentPrice: null, peakPrice: null, peakDate: null, source: null, reason: 'dexscreener_zero_price' };
    }
    // Watermark seed: max(current, h24-ago, h6-ago, h1-ago).
    const changes = {
      h1: typeof best?.priceChange?.h1 === 'number' ? best.priceChange.h1 : null,
      h6: typeof best?.priceChange?.h6 === 'number' ? best.priceChange.h6 : null,
      h24: typeof best?.priceChange?.h24 === 'number' ? best.priceChange.h24 : null,
    };
    let peak = current;
    let peakOffsetHours = 0;
    for (const [k, ch] of Object.entries(changes)) {
      if (ch === null) continue;
      // price_then = price_now / (1 + ch/100)
      if (ch < 0) {
        const then = current / (1 + ch / 100);
        if (then > peak) {
          peak = then;
          peakOffsetHours = k === 'h1' ? 1 : k === 'h6' ? 6 : 24;
        }
      }
    }
    const peakDate =
      peakOffsetHours > 0
        ? new Date(Date.now() - peakOffsetHours * 3600 * 1000).toISOString()
        : new Date().toISOString();
    return {
      status: 'ok',
      currentPrice: current,
      peakPrice: peak,
      peakDate,
      source: 'dexscreener',
      meta: {
        pairChain: best.chainId,
        pairAddress: best.pairAddress,
        liquidityUsd: best?.liquidity?.usd,
        h24Change: changes.h24,
        pairCount: pairs.length,
      },
    };
  } catch (e: any) {
    return { status: 'failed', currentPrice: null, peakPrice: null, peakDate: null, source: null, reason: `dexscreener_throw_${e?.message?.slice(0, 80)}` };
  }
}

async function fetchJupiter(addr: string): Promise<PriceResult> {
  try {
    const r = await fetch(
      `https://lite-api.jup.ag/price/v3?ids=${addr}`,
      { headers: { accept: 'application/json' } },
    );
    if (r.status === 429) {
      return { status: 'failed', currentPrice: null, peakPrice: null, peakDate: null, source: null, reason: 'jupiter_429' };
    }
    if (!r.ok) {
      return { status: 'failed', currentPrice: null, peakPrice: null, peakDate: null, source: null, reason: `jupiter_http_${r.status}` };
    }
    const j: any = await r.json();
    const data = j?.[addr] ?? j?.data?.[addr];
    const price = data?.usdPrice ?? data?.price;
    if (typeof price !== 'number' || price <= 0) {
      return { status: 'failed', currentPrice: null, peakPrice: null, peakDate: null, source: null, reason: 'jupiter_no_price' };
    }
    return {
      status: 'partial', // no h24 change → no retroactive peak
      currentPrice: price,
      peakPrice: price,
      peakDate: new Date().toISOString(),
      source: 'jupiter',
    };
  } catch (e: any) {
    return { status: 'failed', currentPrice: null, peakPrice: null, peakDate: null, source: null, reason: `jupiter_throw_${e?.message?.slice(0, 80)}` };
  }
}

async function priceFor(token: InputToken): Promise<PriceResult> {
  // 1. DexScreener (primary, all chains)
  const ds = await fetchDexScreener(token.contractAddress);
  if (ds.status !== 'failed') return ds;

  // 2. Jupiter (SOL fallback only)
  if (token.chain.toUpperCase() === 'SOL') {
    await sleep(JUPITER_RATE_MS);
    const jp = await fetchJupiter(token.contractAddress);
    if (jp.status !== 'failed') return { ...jp, reason: `dexscreener_failed_then_jupiter (${ds.reason})` };
    return { ...jp, reason: `both_failed (ds:${ds.reason}, jp:${jp.reason})` };
  }
  return { ...ds, reason: `dexscreener_only_chain_${token.chain}: ${ds.reason}` };
}

interface ReportRow {
  chain: string;
  contractAddress: string;
  ticker: string;
  status: 'ok' | 'partial' | 'failed';
  source: string | null;
  currentPrice: number | null;
  peakPrice: number | null;
  peakDate: string | null;
  dumpPct: number | null;
  reason?: string;
  durationMs: number;
}

async function main() {
  const auditPath = path.join(process.cwd(), 'exports', 'tokens_to_track_2026-05-13.json');
  if (!fs.existsSync(auditPath)) {
    console.error(`[fatal] missing audit file: ${auditPath} — run audit-tokens-to-track.ts first`);
    process.exit(1);
  }
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const tokens: InputToken[] = audit.tokens.slice(0, LIMIT);

  console.error(
    `[backfill] mode=${COMMIT ? 'COMMIT' : 'DRY-RUN'} · tokens=${tokens.length}/${audit.tokens.length} · est duration=${Math.round((tokens.length * DEXSCREENER_RATE_MS) / 1000)}s`,
  );
  if (COMMIT) {
    // Verify table exists.
    try {
      await prisma.$queryRaw`SELECT 1 FROM "TokenPriceTracker" LIMIT 1`;
      console.error('[backfill] TokenPriceTracker table found.');
    } catch (e: any) {
      console.error(
        `[fatal] TokenPriceTracker table not found in prod. Run exports/migrations_pricecache_2026-05-13.sql in Neon SQL Editor first.`,
      );
      console.error(`        (${e?.message?.split('\n')[0]})`);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  const report: ReportRow[] = [];
  let okCount = 0;
  let partialCount = 0;
  let failedCount = 0;
  let writtenCount = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const tic = t.symbols[0] ?? '?';
    const t0 = Date.now();
    const result = await priceFor(t);
    const dumpPct =
      result.peakPrice && result.currentPrice && result.peakPrice > 0
        ? Math.round(((result.peakPrice - result.currentPrice) / result.peakPrice) * 10000) / 100
        : null;
    const row: ReportRow = {
      chain: t.chain,
      contractAddress: t.contractAddress,
      ticker: tic,
      status: result.status,
      source: result.source,
      currentPrice: result.currentPrice,
      peakPrice: result.peakPrice,
      peakDate: result.peakDate,
      dumpPct,
      reason: result.reason,
      durationMs: Date.now() - t0,
    };
    report.push(row);

    if (result.status === 'ok') okCount++;
    else if (result.status === 'partial') partialCount++;
    else failedCount++;

    // Live progress every 10 tokens.
    if ((i + 1) % 10 === 0 || i === tokens.length - 1) {
      console.error(
        `[${i + 1}/${tokens.length}] ${row.chain.padEnd(5)} ${row.contractAddress.slice(0, 12)} ${tic.padEnd(14)} ${row.status.padEnd(8)} ${row.source ?? '-'} price=${row.currentPrice ?? '-'} dump%=${row.dumpPct ?? '-'}`,
      );
    }

    if (COMMIT && result.status !== 'failed' && result.currentPrice !== null) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "TokenPriceTracker"
             (id, ticker, chain, "contractAddress", "currentPrice", "currentDate",
              "peakPrice", "peakDate", "dumpPct", source, "lastRefreshAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), $5, $6::timestamptz, $7, $8, NOW(), NOW())
           ON CONFLICT ("chain", "contractAddress") DO UPDATE SET
             ticker = COALESCE("TokenPriceTracker".ticker, EXCLUDED.ticker),
             "currentPrice" = EXCLUDED."currentPrice",
             "currentDate" = EXCLUDED."currentDate",
             "peakPrice" = GREATEST("TokenPriceTracker"."peakPrice", EXCLUDED."peakPrice"),
             "peakDate" = CASE
               WHEN EXCLUDED."peakPrice" > COALESCE("TokenPriceTracker"."peakPrice", 0)
               THEN EXCLUDED."peakDate"
               ELSE "TokenPriceTracker"."peakDate"
             END,
             "dumpPct" = EXCLUDED."dumpPct",
             source = EXCLUDED.source,
             "lastRefreshAt" = NOW(),
             "updatedAt" = NOW()`,
          tic,
          t.chain,
          t.contractAddress,
          result.currentPrice,
          result.peakPrice,
          result.peakDate,
          dumpPct,
          result.source,
        );
        writtenCount++;
      } catch (e: any) {
        console.error(`[write-fail] ${tic} ${t.contractAddress}: ${e?.message?.split('\n')[0]}`);
        row.status = 'failed';
        row.reason = `write_error: ${e?.message?.slice(0, 100)}`;
      }
    }

    // Rate limit between requests (skip for last).
    if (i < tokens.length - 1) await sleep(DEXSCREENER_RATE_MS);
  }

  // ── Report ────────────────────────────────────────────────────────────
  const reportPath = path.join(process.cwd(), 'exports', 'backfill_report_2026-05-13.json');
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: COMMIT ? 'COMMIT' : 'DRY-RUN',
    totals: {
      attempted: tokens.length,
      ok: okCount,
      partial: partialCount,
      failed: failedCount,
      written: writtenCount,
    },
    sources: {
      dexscreener: report.filter((r) => r.source === 'dexscreener').length,
      jupiter: report.filter((r) => r.source === 'jupiter').length,
      none: report.filter((r) => r.source === null).length,
    },
    byChain: Object.fromEntries(
      [...new Set(report.map((r) => r.chain))].map((c) => [
        c,
        {
          attempted: report.filter((r) => r.chain === c).length,
          ok: report.filter((r) => r.chain === c && r.status !== 'failed').length,
        },
      ]),
    ),
    topDumps: report
      .filter((r) => r.dumpPct !== null && r.dumpPct > 50)
      .sort((a, b) => (b.dumpPct ?? 0) - (a.dumpPct ?? 0))
      .slice(0, 20),
    failureReasons: report
      .filter((r) => r.status === 'failed')
      .reduce<Record<string, number>>((acc, r) => {
        const reason = r.reason ?? 'unknown';
        const k = reason.split(':')[0].split(',')[0].split('(')[0].trim();
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    rows: report,
  };
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.error(
    `\n[done] ${COMMIT ? 'COMMITTED' : 'DRY-RUN'}: ok=${okCount}, partial=${partialCount}, failed=${failedCount}, written=${writtenCount}`,
  );
  console.error(`[done] sources: dexscreener=${summary.sources.dexscreener}, jupiter=${summary.sources.jupiter}, none=${summary.sources.none}`);
  console.error(`[done] top dumps (>50%): ${summary.topDumps.length}`);
  console.error(`[done] report: ${reportPath}`);
}

main()
  .catch((e) => {
    console.error('[fatal]', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
