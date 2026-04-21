// ─── Cron: mm-batch-scan — Phase 8 activated ─────────────────────────────
// Iterates over attributed wallets with confidence ≥ 0.70 and refreshes
// their MmScore when the cache is older than 6h. Scans at most 2 wallets
// in parallel, respects a 120s Vercel timeout and yields a proper summary.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { scanWallet } from "@/lib/mm/data/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PARALLEL_LIMIT = 2;
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const SOFT_TIMEOUT_MS = 110 * 1_000; // leave ~10s margin under Vercel cap

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

type ChainValue = "SOLANA" | "ETHEREUM" | "BASE" | "ARBITRUM" | "OPTIMISM" | "BNB" | "POLYGON";

interface BatchSummary {
  eligibleTotal: number;
  scanned: number;
  skippedFresh: number;
  errors: Array<{ wallet: string; chain: string; message: string }>;
  durationMs: number;
  softTimeout: boolean;
  remaining: Array<{ wallet: string; chain: string }>;
}

async function runBatch(startedAt: number): Promise<BatchSummary> {
  const summary: BatchSummary = {
    eligibleTotal: 0,
    scanned: 0,
    skippedFresh: 0,
    errors: [],
    durationMs: 0,
    softTimeout: false,
    remaining: [],
  };

  const attributions = await prisma.mmAttribution.findMany({
    where: {
      revokedAt: null,
      confidence: { gte: 0.7 },
    },
    select: { walletAddress: true, chain: true },
    orderBy: { confidence: "desc" },
  });

  // Deduplicate by (wallet, chain) — the same wallet might be attributed to
  // multiple entities and we only need to scan once.
  const uniq = new Map<string, { wallet: string; chain: ChainValue }>();
  for (const a of attributions) {
    uniq.set(`${a.walletAddress}:${a.chain}`, {
      wallet: a.walletAddress,
      chain: a.chain as ChainValue,
    });
  }
  summary.eligibleTotal = uniq.size;

  // Filter out those with a fresh cache.
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  const pending: Array<{ wallet: string; chain: ChainValue }> = [];
  for (const entry of uniq.values()) {
    const cache = await prisma.mmScore.findUnique({
      where: {
        subjectType_subjectId_chain: {
          subjectType: "WALLET",
          subjectId: entry.wallet,
          chain: entry.chain,
        },
      },
      select: { computedAt: true },
    });
    if (cache && cache.computedAt > cutoff) {
      summary.skippedFresh += 1;
      continue;
    }
    pending.push(entry);
  }

  const queue = [...pending];
  const workers: Array<Promise<void>> = [];

  async function worker() {
    while (queue.length > 0) {
      if (Date.now() - startedAt > SOFT_TIMEOUT_MS) {
        summary.softTimeout = true;
        return;
      }
      const next = queue.shift();
      if (!next) return;
      try {
        await scanWallet(next.wallet, next.chain, {
          triggeredBy: "BATCH_SCAN",
          triggeredByRef: "cron:mm-batch-scan",
        });
        summary.scanned += 1;
      } catch (err) {
        summary.errors.push({
          wallet: next.wallet,
          chain: next.chain,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  for (let i = 0; i < PARALLEL_LIMIT; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  // Whatever's still in the queue at soft-timeout is reported back.
  summary.remaining = queue;
  summary.durationMs = Date.now() - startedAt;
  return summary;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    const summary = await runBatch(startedAt);
    console.info(
      JSON.stringify({
        source: "mm_batch_scan",
        ok: true,
        ...summary,
      }),
    );
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[mm-batch-scan] fatal", err);
    return NextResponse.json(
      {
        error: "batch_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
