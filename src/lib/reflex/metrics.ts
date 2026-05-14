/**
 * REFLEX V1 — admin metrics queries (Commit 13/15).
 *
 * Aggregation helpers for the calibration dashboard. Pure Prisma reads;
 * no side effects. Each function takes a `since` Date (the lower bound
 * of the time window) and returns plain data the page renders directly.
 *
 * Tested in metrics.test.ts with prisma mocked at the module boundary.
 */
import { prisma } from "@/lib/prisma";
import type { ReflexVerdict } from "./types";

export type WindowKey = "24h" | "7d" | "30d";

export function parseWindow(s: string | undefined): WindowKey {
  if (s === "24h" || s === "7d" || s === "30d") return s;
  return "30d";
}

export function windowStartDate(key: WindowKey): Date {
  const now = Date.now();
  const ms = key === "24h" ? 86_400_000 : key === "7d" ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(now - ms);
}

export async function countAnalyses(since: Date): Promise<number> {
  return prisma.reflexAnalysis.count({ where: { createdAt: { gte: since } } });
}

export async function verdictDistribution(
  since: Date,
): Promise<Record<ReflexVerdict, number>> {
  const rows = await prisma.reflexAnalysis.groupBy({
    by: ["verdict"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const base: Record<ReflexVerdict, number> = {
    STOP: 0, WAIT: 0, VERIFY: 0, NO_CRITICAL_SIGNAL: 0,
  };
  for (const r of rows) {
    const v = r.verdict as ReflexVerdict;
    if (v in base) base[v] = r._count._all;
  }
  return base;
}

export async function inputTypeDistribution(
  since: Date,
): Promise<Record<string, number>> {
  const rows = await prisma.reflexAnalysis.groupBy({
    by: ["inputType"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.inputType] = r._count._all;
  return out;
}

export async function modeBreakdown(
  since: Date,
): Promise<Record<string, number>> {
  const rows = await prisma.reflexAnalysis.groupBy({
    by: ["mode"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.mode] = r._count._all;
  return out;
}

export interface LatencyStats {
  count: number;
  p50: number;
  p95: number;
  p99: number;
}

export async function latencyStats(since: Date): Promise<LatencyStats> {
  const rows = await prisma.reflexAnalysis.findMany({
    where: { createdAt: { gte: since } },
    select: { latencyMs: true },
  });
  if (rows.length === 0) return { count: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
  const pct = (p: number): number => {
    const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
    return sorted[idx];
  };
  return { count: sorted.length, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99) };
}

export interface DailyStopRateRow {
  day: string; // YYYY-MM-DD
  total: number;
  stops: number;
  rate: number;
}

export async function dailyStopRate(since: Date): Promise<DailyStopRateRow[]> {
  const raw = await prisma.$queryRaw<
    Array<{ day: Date; total: bigint; stops: bigint }>
  >`
    SELECT
      date_trunc('day', "createdAt")::date AS day,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "verdict" = 'STOP')::bigint AS stops
    FROM "ReflexAnalysis"
    WHERE "createdAt" >= ${since}
    GROUP BY day
    ORDER BY day ASC
  `;
  return raw.map((r) => {
    const total = Number(r.total);
    const stops = Number(r.stops);
    return {
      day: new Date(r.day).toISOString().slice(0, 10),
      total,
      stops,
      rate: total > 0 ? stops / total : 0,
    };
  });
}

export interface TopCount {
  code: string;
  count: number;
}

/**
 * Counts narrative-script signal codes that appear in signalsManifest
 * for analyses in the window. Returns the top `limit` by count desc.
 * V1: parses manifests in JS — not heavy at calibration volumes; if it
 * becomes hot, swap to a Postgres jsonb path query.
 */
export async function topNarrativeScripts(
  since: Date,
  limit: number,
): Promise<TopCount[]> {
  const rows = await prisma.reflexAnalysis.findMany({
    where: { createdAt: { gte: since } },
    select: { signalsManifest: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const manifest = row.signalsManifest as
      | { engines?: Array<{ engine?: string; signals?: Array<{ code?: string }> }> }
      | null;
    const engines = manifest?.engines ?? [];
    for (const e of engines) {
      if (e.engine !== "narrative") continue;
      for (const s of e.signals ?? []) {
        const code = s.code;
        if (typeof code === "string" && code.startsWith("narrative.")) {
          counts.set(code, (counts.get(code) ?? 0) + 1);
        }
      }
    }
  }
  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface TopHandle {
  handle: string;
  count: number;
}

export async function topHandles(
  since: Date,
  limit: number,
): Promise<TopHandle[]> {
  const rows = await prisma.reflexAnalysis.groupBy({
    by: ["inputResolvedHandle"],
    where: {
      createdAt: { gte: since },
      inputResolvedHandle: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { inputResolvedHandle: "desc" } },
    take: limit,
  });
  return rows
    .filter((r): r is typeof r & { inputResolvedHandle: string } =>
      typeof r.inputResolvedHandle === "string",
    )
    .map((r) => ({ handle: r.inputResolvedHandle, count: r._count._all }));
}

export interface LastAnalysisRow {
  id: string;
  createdAt: Date;
  inputType: string;
  inputResolvedAddress: string | null;
  inputResolvedHandle: string | null;
  verdict: string;
  confidence: string;
  latencyMs: number;
  mode: string;
  falsePositiveFlag: boolean;
}

export async function lastN(n: number): Promise<LastAnalysisRow[]> {
  return prisma.reflexAnalysis.findMany({
    orderBy: { createdAt: "desc" },
    take: n,
    select: {
      id: true,
      createdAt: true,
      inputType: true,
      inputResolvedAddress: true,
      inputResolvedHandle: true,
      verdict: true,
      confidence: true,
      latencyMs: true,
      mode: true,
      falsePositiveFlag: true,
    },
  });
}

export function computeStopRate(
  verdictDist: Record<ReflexVerdict, number>,
): number {
  const total = Object.values(verdictDist).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return verdictDist.STOP / total;
}

export interface DashboardAlert {
  level: "red" | "orange";
  message: string;
}

export function computeAlerts(
  stopRate: number,
  totalCount: number,
  p95: number,
  copy: {
    overfiring: string;
    underfiring: string;
    slow: string;
  },
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  // Only emit STOP-rate alerts when we have enough data to be meaningful.
  if (totalCount >= 20) {
    if (stopRate > 0.3) {
      alerts.push({ level: "red", message: copy.overfiring });
    } else if (stopRate < 0.05) {
      alerts.push({ level: "orange", message: copy.underfiring });
    }
  }
  if (p95 > 5000) {
    alerts.push({ level: "orange", message: copy.slow });
  }
  return alerts;
}
