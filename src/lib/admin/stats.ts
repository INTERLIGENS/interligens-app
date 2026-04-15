// src/lib/admin/stats.ts
//
// Founder cockpit — aggregation layer for /admin/stats.
// All queries additive, read-only. Returns structured objects consumed by
// /api/admin/stats and the client page.

import { prisma } from "@/lib/prisma";

// ── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "warning" | "critical";

export type PlatformStatus = {
  scanToday: number;
  scanAvg7d: number;
  askToday: number;
  askAvg7d: number;
  watchToday: number;
  watchAvg7d: number;
  dbHealthy: boolean;
};

export type ChartPoint = { date: string; scans: number; ask: number };

export type FounderKpis = {
  scans24h: number;
  scans7d: number;
  scansPrev7d: number;
  ask24h: number;
  ask7d: number;
  askPrev7d: number;
  watchlistActive: number;
  watchlistNew7d: number;
  investigators: number;
  openCases: number;
  publishedKols: number;
  alerts24h: number;
  newAccesses7d: number;
  chartData: ChartPoint[];
};

export type FunnelStats = {
  scans7d: number;
  ask7d: number;
  watchlistActive: number;
  openCases: number;
  scanToAskRate: number;
};

export type ModuleHealth = {
  today: number;
  week: number;
  delta: number | null;
  status: HealthStatus;
};

export type ModuleHealthStats = {
  scanner: ModuleHealth;
  ask: ModuleHealth;
  watchlist: ModuleHealth;
  investigators: ModuleHealth;
  registry: ModuleHealth;
  watcher: ModuleHealth;
};

export type RecentWatched = {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  createdAt: string;
};

export type RecentAlert = {
  id: string;
  changeType: string;
  newTier: string;
  createdAt: string;
};

export type RecentKol = {
  handle: string;
  tier: string | null;
  updatedAt: string;
};

export type AlertsChartPoint = { date: string; count: number };

export type ThreatRadarStats = {
  recentAlerts: RecentAlert[];
  alertsChart: AlertsChartPoint[];
  recentWatched: RecentWatched[];
  recentKols: RecentKol[];
};

export type StatsAlertSeverity = "critical" | "warning" | "low";

export type StatsAlert = {
  severity: StatsAlertSeverity;
  title: string;
  context: string;
  action: string;
};

// ── Time helpers ─────────────────────────────────────────────────────────────

function getTimeWindows() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 86400000);
  const previous7Days = new Date(now.getTime() - 14 * 86400000);
  const last30Days = new Date(now.getTime() - 30 * 86400000);
  return { now, today, last24h, last7Days, previous7Days, last30Days };
}

export function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ── 1. Platform Status ───────────────────────────────────────────────────────

export async function getPlatformStatusStats(): Promise<PlatformStatus> {
  const { today, last7Days } = getTimeWindows();

  const [scanToday, scan7, askToday, ask7, watchToday, watch7] = await Promise.all([
    prisma.watchScan.count({ where: { createdAt: { gte: today } } }),
    prisma.watchScan.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.askLog.count({ where: { createdAt: { gte: today } } }),
    prisma.askLog.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.watchAlert.count({ where: { createdAt: { gte: today } } }),
    prisma.watchAlert.count({ where: { createdAt: { gte: last7Days } } }),
  ]);

  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  return {
    scanToday,
    scanAvg7d: scan7 / 7,
    askToday,
    askAvg7d: ask7 / 7,
    watchToday,
    watchAvg7d: watch7 / 7,
    dbHealthy,
  };
}

// ── 2. Founder KPIs ──────────────────────────────────────────────────────────

export async function getFounderKpis(): Promise<FounderKpis> {
  const { today, last24h, last7Days, previous7Days, last30Days } = getTimeWindows();

  const [
    scans24h,
    scans7d,
    scansPrev7d,
    ask24h,
    ask7d,
    askPrev7d,
    watchlistActive,
    watchlistNew7d,
    investigators,
    openCases,
    publishedKols,
    alerts24h,
    newAccesses7d,
    askRows,
    scanRows,
  ] = await Promise.all([
    prisma.watchScan.count({ where: { createdAt: { gte: last24h } } }),
    prisma.watchScan.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.watchScan.count({
      where: { createdAt: { gte: previous7Days, lt: last7Days } },
    }),
    prisma.askLog.count({ where: { createdAt: { gte: last24h } } }),
    prisma.askLog.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.askLog.count({
      where: { createdAt: { gte: previous7Days, lt: last7Days } },
    }),
    prisma.watchedAddress.count({ where: { active: true } }),
    prisma.watchedAddress.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.investigatorAccess.count({ where: { isActive: true } }),
    prisma.vaultCase.count(),
    prisma.kolProfile.count({ where: { publishStatus: "published" } }),
    prisma.watchAlert.count({ where: { createdAt: { gte: today } } }),
    prisma.investigatorAccess.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.askLog.findMany({
      where: { createdAt: { gte: last30Days } },
      select: { createdAt: true },
    }),
    prisma.watchScan.findMany({
      where: { createdAt: { gte: last30Days } },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map<string, { scans: number; ask: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(last30Days);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { scans: 0, ask: 0 });
  }
  for (const r of askRows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) b.ask += 1;
  }
  for (const r of scanRows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) b.scans += 1;
  }
  const chartData: ChartPoint[] = Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    scans: v.scans,
    ask: v.ask,
  }));

  return {
    scans24h,
    scans7d,
    scansPrev7d,
    ask24h,
    ask7d,
    askPrev7d,
    watchlistActive,
    watchlistNew7d,
    investigators,
    openCases,
    publishedKols,
    alerts24h,
    newAccesses7d,
    chartData,
  };
}

// ── 3. Funnel ────────────────────────────────────────────────────────────────

export async function getFunnelStats(): Promise<FunnelStats> {
  const { last7Days } = getTimeWindows();
  const [scans7d, ask7d, watchlistActive, openCases] = await Promise.all([
    prisma.watchScan.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.askLog.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.watchedAddress.count({ where: { active: true } }),
    prisma.vaultCase.count(),
  ]);

  const scanToAskRate = scans7d > 0 ? Math.round((ask7d / scans7d) * 100) : 0;
  return { scans7d, ask7d, watchlistActive, openCases, scanToAskRate };
}

// ── 4. Module Health ─────────────────────────────────────────────────────────

function deriveStatus(today: number, avg7d: number): HealthStatus {
  if (today === 0 && avg7d > 0) return "critical";
  if (today < avg7d * 0.5) return "warning";
  return "healthy";
}

function buildModuleHealth(todayCount: number, weekCount: number): ModuleHealth {
  const avg7d = weekCount / 7;
  return {
    today: todayCount,
    week: weekCount,
    delta: calcDelta(todayCount, avg7d),
    status: deriveStatus(todayCount, avg7d),
  };
}

export async function getModuleHealthStats(): Promise<ModuleHealthStats> {
  const { today, last7Days } = getTimeWindows();

  const [
    scanToday,
    scanWeek,
    askToday,
    askWeek,
    watchTodayActive,
    watchWeekNew,
    invActive,
    invWeekNew,
    casesTotal,
    kolPubTotal,
    kolPubWeek,
    watcherToday,
    watcherWeek,
  ] = await Promise.all([
    prisma.watchScan.count({ where: { createdAt: { gte: today } } }),
    prisma.watchScan.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.askLog.count({ where: { createdAt: { gte: today } } }),
    prisma.askLog.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.watchedAddress.count({ where: { active: true } }),
    prisma.watchedAddress.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.investigatorAccess.count({ where: { isActive: true } }),
    prisma.investigatorAccess.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.vaultCase.count(),
    prisma.kolProfile.count({ where: { publishStatus: "published" } }),
    prisma.kolProfile.count({
      where: { publishStatus: "published", updatedAt: { gte: last7Days } },
    }),
    prisma.watchAlert.count({ where: { createdAt: { gte: today } } }),
    prisma.watchAlert.count({ where: { createdAt: { gte: last7Days } } }),
  ]);

  return {
    scanner: buildModuleHealth(scanToday, scanWeek),
    ask: buildModuleHealth(askToday, askWeek),
    // Watchlist: cumulative stock — "today" = active count, "week" = new this week
    watchlist: {
      today: watchTodayActive,
      week: watchWeekNew,
      delta: null,
      status: watchTodayActive > 0 ? "healthy" : "warning",
    },
    // Investigators: active accesses + open cases
    investigators: {
      today: invActive + casesTotal,
      week: invWeekNew,
      delta: null,
      status: invActive > 0 && casesTotal > 0 ? "healthy" : invActive > 0 ? "warning" : "critical",
    },
    // Registry: published KOLs stock + newly edited this week
    registry: {
      today: kolPubTotal,
      week: kolPubWeek,
      delta: null,
      status: kolPubTotal > 0 ? "healthy" : "warning",
    },
    watcher: buildModuleHealth(watcherToday, watcherWeek),
  };
}

// ── 5. Threat Radar ──────────────────────────────────────────────────────────

export async function getThreatRadarStats(): Promise<ThreatRadarStats> {
  const { last30Days } = getTimeWindows();

  const [alerts, watched, kols, alertRows] = await Promise.all([
    prisma.watchAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, changeType: true, newTier: true, createdAt: true },
    }),
    prisma.watchedAddress.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, address: true, chain: true, label: true, createdAt: true },
    }),
    prisma.kolProfile.findMany({
      where: { publishStatus: "published" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { handle: true, tier: true, updatedAt: true },
    }),
    prisma.watchAlert.findMany({
      where: { createdAt: { gte: last30Days } },
      select: { createdAt: true },
    }),
  ]);

  const chartBuckets = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(last30Days);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    chartBuckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of alertRows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const prev = chartBuckets.get(key) ?? 0;
    if (chartBuckets.has(key)) chartBuckets.set(key, prev + 1);
  }
  const alertsChart: AlertsChartPoint[] = Array.from(chartBuckets.entries()).map(
    ([date, count]) => ({ date, count })
  );

  return {
    recentAlerts: alerts.map((a) => ({
      id: a.id,
      changeType: a.changeType,
      newTier: a.newTier,
      createdAt: a.createdAt.toISOString(),
    })),
    alertsChart,
    recentWatched: watched.map((w) => ({
      id: w.id,
      address: w.address,
      chain: w.chain,
      label: w.label,
      createdAt: w.createdAt.toISOString(),
    })),
    recentKols: kols.map((k) => ({
      handle: k.handle,
      tier: k.tier,
      updatedAt: k.updatedAt.toISOString(),
    })),
  };
}

// ── 6. Alerts Queue Builder ──────────────────────────────────────────────────

export async function buildStatsAlerts(): Promise<StatsAlert[]> {
  const status = await getPlatformStatusStats();
  const kpis = await getFounderKpis();

  const alerts: StatsAlert[] = [];

  // Critical
  if (status.scanToday === 0 && status.scanAvg7d > 0) {
    alerts.push({
      severity: "critical",
      title: "No scans recorded today",
      context: `7d avg = ${status.scanAvg7d.toFixed(1)} scans/day, today = 0.`,
      action: "Check Watcher pipeline (Host-005 krypt@MacBook-Pro-4).",
    });
  }
  if (!status.dbHealthy) {
    alerts.push({
      severity: "critical",
      title: "Database health check failed",
      context: "SELECT 1 query returned error — Prisma may be disconnected.",
      action: "Check Neon connection (ep-square-band) and DATABASE_URL.",
    });
  }
  if (status.watchToday === 0 && status.watchAvg7d > 0) {
    alerts.push({
      severity: "critical",
      title: "Watch Engine inactive",
      context: `7d avg = ${status.watchAvg7d.toFixed(1)} alerts/day, today = 0.`,
      action: "Check Watcher V1 on Host-005 (launchctl handles).",
    });
  }

  // Warning
  if (kpis.scansPrev7d > 0 && kpis.scans7d < kpis.scansPrev7d * 0.5) {
    alerts.push({
      severity: "warning",
      title: "Scans down 50%+ vs last week",
      context: `This week = ${kpis.scans7d}, previous week = ${kpis.scansPrev7d}.`,
      action: "Review traffic sources and Watcher cron health.",
    });
  }
  if (kpis.ask24h === 0 && status.askAvg7d > 0) {
    alerts.push({
      severity: "warning",
      title: "No Ask requests today",
      context: `7d avg = ${status.askAvg7d.toFixed(1)} ask/day, today = 0.`,
      action: "Inspect Ask logs (/admin/ask-logs) and API health.",
    });
  }
  if (kpis.watchlistNew7d === 0) {
    alerts.push({
      severity: "warning",
      title: "No new watchlist activity in 7 days",
      context: `${kpis.watchlistActive} active watchlists, 0 new in the last week.`,
      action: "Review conversion funnel and investigator onboarding.",
    });
  }
  if (status.watchAvg7d > 0 && kpis.alerts24h > status.watchAvg7d * 2) {
    alerts.push({
      severity: "warning",
      title: "Alert activity spiking",
      context: `Today = ${kpis.alerts24h} alerts, 7d avg = ${status.watchAvg7d.toFixed(1)}.`,
      action: "Check Threat Radar and recent WatchAlert entries.",
    });
  }
  if (kpis.openCases === 0) {
    alerts.push({
      severity: "warning",
      title: "No open investigator cases",
      context: "VaultCase count = 0 across all workspaces.",
      action: "Review investigator workspace activity.",
    });
  }

  // Low
  if (kpis.newAccesses7d === 0) {
    alerts.push({
      severity: "low",
      title: "No new beta accesses this week",
      context: "InvestigatorAccess creations = 0 in the last 7 days.",
      action: "Review beta outreach and invitation flow.",
    });
  }

  const order: Record<StatsAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    low: 2,
  };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return alerts;
}
