// ─────────────────────────────────────────────────────────────────────────────
// Monitoring Heartbeat
// Public, unauthenticated health endpoint for external uptime monitors
// (Better Stack / UptimeRobot). Never throws — every check degrades to false.
//
//   status: "ok"        → all sub-checks pass
//   status: "degraded"  → at least one sub-check failed
//
// External monitor config: expect HTTP 200 + body containing "ok".
// A degraded body reads "degraded" (no "ok" substring) → monitor alerts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Canonical dogwifhat (WIF) mint. The public score endpoint validates the
// mint format, so the bare ticker "WIF" would 400 — using the real mint
// keeps the 200 check meaningful as a true scoring-pipeline probe.
const WIF_MINT = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm";

// Watcher cron runs every 3 days; flag stale after 5 days of no new posts.
const WATCHER_STALE_DAYS = 5;

async function checkDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkScoring(origin: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/api/v1/score?mint=${WIF_MINT}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "interligens-heartbeat/1.0" },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function checkWatcherLastRun(): Promise<boolean> {
  try {
    const latest = await prisma.socialPostCandidate.findFirst({
      orderBy: { discoveredAtUtc: "desc" },
      select: { discoveredAtUtc: true },
    });
    if (!latest) return false;
    const ageMs = Date.now() - new Date(latest.discoveredAtUtc).getTime();
    return ageMs < WATCHER_STALE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const [db, scoring, watcher] = await Promise.all([
    checkDb(),
    checkScoring(req.nextUrl.origin),
    checkWatcherLastRun(),
  ]);

  const allOk = db && scoring && watcher;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
      checks: { db, scoring, watcher },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
