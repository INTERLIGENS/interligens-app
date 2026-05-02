/**
 * GET /api/admin/stats
 * Admin-only dashboard metrics. Aggregates counts from AskLog, VaultCase,
 * WatchedAddress, InvestigatorAccess, KolProfile.
 *
 * Query param ?chart=true also returns a 30-day chartData array with per-day
 * scan + ASK counts for the LineChart on the stats page.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/security/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DayRow = { day: Date; scans: bigint; ask: bigint };

function startOfDayUtc(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const url = new URL(req.url);
  const wantsChart = url.searchParams.get("chart") === "true";

  const today = startOfDayUtc(new Date());
  const weekAgo = new Date(today);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setUTCDate(monthAgo.getUTCDate() - 30);

  try {
    const [
      scansToday,
      scansWeek,
      askToday,
      askWeek,
      watchlist,
      investigators,
      cases,
      kolPublished,
    ] = await Promise.all([
      // Scans == AskLog rows from the `/scan` path (source: web). The
      // AskLog table covers both scan traffic and ASK questions; until we
      // split them, use the full table for scans and exclude refusals for
      // ASK-specific counts.
      prisma.askLog.count({ where: { createdAt: { gte: today } } }),
      prisma.askLog.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.askLog.count({
        where: { createdAt: { gte: today }, answerType: { not: "refusal" } },
      }),
      prisma.askLog.count({
        where: { createdAt: { gte: weekAgo }, answerType: { not: "refusal" } },
      }),
      prisma.watchedAddress.count({ where: { active: true } }),
      prisma.investigatorAccess.count({ where: { isActive: true } }),
      prisma.vaultCase.count(),
      prisma.kolProfile.count({ where: { publishStatus: "published" } }),
    ]);

    let chartData:
      | Array<{ date: string; scans: number; ask: number }>
      | undefined;

    if (wantsChart) {
      // Pull one row per day from AskLog for the last 30 days.
      // Raw SQL is cleaner than pulling rows then grouping in JS.
      const rows = await prisma.$queryRaw<DayRow[]>`
        SELECT
          date_trunc('day', "createdAt")::date AS day,
          COUNT(*) AS scans,
          COUNT(*) FILTER (WHERE "answerType" <> 'refusal') AS ask
        FROM "ask_logs"
        WHERE "createdAt" >= ${monthAgo}
        GROUP BY day
        ORDER BY day ASC
      `;

      // Fill missing days with zeros so the chart x-axis stays continuous.
      const byDay = new Map<string, { scans: number; ask: number }>();
      for (const r of rows) {
        const d = new Date(r.day);
        const key = d.toISOString().slice(0, 10);
        byDay.set(key, { scans: Number(r.scans), ask: Number(r.ask) });
      }
      chartData = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().slice(0, 10);
        const cur = byDay.get(key) ?? { scans: 0, ask: 0 };
        chartData.push({
          date: key.slice(5), // MM-DD
          scans: cur.scans,
          ask: cur.ask,
        });
      }
    }

    return NextResponse.json({
      scansToday,
      scansWeek,
      askToday,
      askWeek,
      watchlist,
      investigators,
      cases,
      kolPublished,
      ...(chartData ? { chartData } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/stats] failed", err);
    return NextResponse.json(
      { error: "stats_failed", message: message.slice(0, 200) },
      { status: 500 },
    );
  }
}
