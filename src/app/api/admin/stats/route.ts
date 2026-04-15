import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    sources,
    labels,
    batches,
    scansToday,
    scansWeek,
    askToday,
    askWeek,
    watchlist,
    investigators,
    cases,
    kolPublished,
  ] = await Promise.all([
    prisma.sourceRegistry.count({ where: { status: "active" } }),
    prisma.addressLabel.count(),
    prisma.ingestionBatch.count(),
    prisma.askLog.count({ where: { createdAt: { gte: today } } }),
    prisma.askLog.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.askLog.count({ where: { createdAt: { gte: today } } }),
    prisma.askLog.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.watchedAddress.count({ where: { active: true } }),
    prisma.investigatorAccess.count({ where: { isActive: true } }),
    prisma.vaultCase.count(),
    prisma.kolProfile.count({ where: { publishStatus: "published" } }),
  ]);

  const base = {
    sources,
    labels,
    batches,
    scansToday,
    scansWeek,
    askToday,
    askWeek,
    watchlist,
    investigators,
    cases,
    kolPublished,
  };

  const url = new URL(req.url);
  if (url.searchParams.get("chart") !== "true") {
    return NextResponse.json(base);
  }

  const rows = await prisma.askLog.findMany({
    where: { createdAt: { gte: monthAgo } },
    select: { createdAt: true },
  });

  const buckets = new Map<string, { scans: number; ask: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(monthAgo);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { scans: 0, ask: 0 });
  }
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) {
      b.scans += 1;
      b.ask += 1;
    }
  }
  const chartData = Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    scans: v.scans,
    ask: v.ask,
  }));

  return NextResponse.json({ ...base, chartData });
}
