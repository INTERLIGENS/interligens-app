"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MetricCard } from "@/components/admin/stats/MetricCard";
import { StatusPill } from "@/components/admin/stats/StatusPill";
import { AlertRow } from "@/components/admin/stats/AlertRow";
import { ModuleHealthCard } from "@/components/admin/stats/ModuleHealthCard";

const ACCENT = "#FF6B00";
const BG = "#000000";

type HealthStatus = "healthy" | "warning" | "critical";

type StatsResponse = {
  status: {
    scanToday: number;
    scanAvg7d: number;
    askToday: number;
    askAvg7d: number;
    watchToday: number;
    watchAvg7d: number;
    dbHealthy: boolean;
  };
  kpis: {
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
    chartData: { date: string; scans: number; ask: number }[];
  };
  funnel: {
    scans7d: number;
    ask7d: number;
    watchlistActive: number;
    openCases: number;
    scanToAskRate: number;
  };
  modules: {
    scanner: { today: number; week: number; delta: number | null; status: HealthStatus };
    ask: { today: number; week: number; delta: number | null; status: HealthStatus };
    watchlist: { today: number; week: number; delta: number | null; status: HealthStatus };
    investigators: { today: number; week: number; delta: number | null; status: HealthStatus };
    registry: { today: number; week: number; delta: number | null; status: HealthStatus };
    watcher: { today: number; week: number; delta: number | null; status: HealthStatus };
  };
  radar: {
    recentAlerts: { id: string; changeType: string; newTier: string; createdAt: string }[];
    alertsChart: { date: string; count: number }[];
    recentWatched: { id: string; address: string; chain: string; label: string | null; createdAt: string }[];
    recentKols: { handle: string; tier: string | null; updatedAt: string }[];
  };
  alerts: {
    severity: "critical" | "warning" | "low";
    title: string;
    context: string;
    action: string;
  }[];
};

function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function shortAddr(a: string): string {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 1) return `${Math.round(diffMs / 60000)}m`;
  if (diffH < 24) return `${Math.round(diffH)}h`;
  return `${Math.round(diffH / 24)}d`;
}

function deriveGlobal(data: StatsResponse): HealthStatus {
  const modules = Object.values(data.modules);
  if (modules.some((m) => m.status === "critical") || !data.status.dbHealthy) return "critical";
  if (modules.some((m) => m.status === "warning")) return "warning";
  return "healthy";
}

function miniStatusFor(statusValue: "healthy" | "warning" | "critical") {
  return <StatusPill status={statusValue} />;
}

export default function AdminStatsPage() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<StatsResponse>;
      })
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const global: HealthStatus = data ? deriveGlobal(data) : "healthy";

  // Per-service mini-statuses
  const scanStatus: HealthStatus = data
    ? data.modules.scanner.status
    : "healthy";
  const askStatus: HealthStatus = data ? data.modules.ask.status : "healthy";
  const watchStatus: HealthStatus = data ? data.modules.watcher.status : "healthy";
  const dbStatus: HealthStatus = data ? (data.status.dbHealthy ? "healthy" : "critical") : "healthy";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: "#FFFFFF",
        padding: "0 0 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* HEADER */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 40px 0" }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: ACCENT,
            fontWeight: 700,
          }}
        >
          STATS PLATEFORME
        </div>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.4)",
            marginTop: 6,
          }}
        >
          Tour de contrôle fondateur
        </div>
      </div>

      {/* BLOC 1 — PLATFORM STATUS BAND */}
      <div
        style={{
          marginTop: 24,
          background: "rgba(255,255,255,0.02)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 0",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.5)",
                fontWeight: 700,
              }}
            >
              Platform Status
            </div>
            <StatusPill status={global} />
          </div>
          <div
            style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <MiniStat label="Traffic" status="healthy" />
            <MiniStat label="Scan Engine" status={scanStatus} />
            <MiniStat label="Ask Engine" status={askStatus} />
            <MiniStat label="Watch Engine" status={watchStatus} />
            <MiniStat label="Database" status={dbStatus} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 40px 0" }}>
        {error && (
          <div
            style={{
              padding: 16,
              background: "rgba(255,107,0,0.08)",
              border: "1px solid rgba(255,107,0,0.3)",
              borderRadius: 8,
              color: ACCENT,
              fontSize: 12,
              marginBottom: 24,
            }}
          >
            Failed to load stats: {error}
          </div>
        )}

        {/* BLOC 2 — FOUNDER KPIS */}
        <SectionTitle>Founder KPIs</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
            marginTop: 16,
          }}
        >
          <MetricCard
            label="Scans 24h"
            value={data?.kpis.scans24h ?? null}
            delta={data ? calcDelta(data.kpis.scans24h, data.status.scanAvg7d) : undefined}
          />
          <MetricCard
            label="Ask 24h"
            value={data?.kpis.ask24h ?? null}
            delta={data ? calcDelta(data.kpis.ask24h, data.status.askAvg7d) : undefined}
          />
          <MetricCard label="Alerts 24h" value={data?.kpis.alerts24h ?? null} />
          <MetricCard label="Watchlist actives" value={data?.kpis.watchlistActive ?? null} />
          <MetricCard label="Investigators" value={data?.kpis.investigators ?? null} />
          <MetricCard
            label="Scans 7j"
            value={data?.kpis.scans7d ?? null}
            delta={data ? calcDelta(data.kpis.scans7d, data.kpis.scansPrev7d) : undefined}
          />
          <MetricCard
            label="Ask 7j"
            value={data?.kpis.ask7d ?? null}
            delta={data ? calcDelta(data.kpis.ask7d, data.kpis.askPrev7d) : undefined}
          />
          <MetricCard label="Cases ouverts" value={data?.kpis.openCases ?? null} />
          <MetricCard label="KOL publiés" value={data?.kpis.publishedKols ?? null} />
          <MetricCard label="Nouveaux accès 7j" value={data?.kpis.newAccesses7d ?? null} />
        </div>

        {/* BLOC 3 — FUNNEL */}
        <SectionTitle subtitle="Proxy funnel — données proxy basées sur les événements disponibles">
          Funnel
        </SectionTitle>
        <div
          style={{
            marginTop: 16,
            background: "#0D0D0D",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: 24,
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <FunnelStep
            label="Visits"
            value="—"
            note="Données Vercel Analytics sous 24h"
          />
          <FunnelArrow rate="—" />
          <FunnelStep label="Scans 7j" value={data?.funnel.scans7d ?? "—"} />
          <FunnelArrow rate={data ? `${data.funnel.scanToAskRate}%` : "—"} />
          <FunnelStep label="Ask 7j" value={data?.funnel.ask7d ?? "—"} />
          <FunnelArrow rate="—" />
          <FunnelStep label="Watchlists" value={data?.funnel.watchlistActive ?? "—"} />
          <FunnelArrow rate="—" />
          <FunnelStep label="Cases" value={data?.funnel.openCases ?? "—"} />
        </div>

        {/* BLOC 4 — MODULE HEALTH */}
        <SectionTitle>Module Health</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginTop: 16,
          }}
        >
          <ModuleHealthCard
            name="Scanner"
            status={data?.modules.scanner.status ?? "healthy"}
            primary={{ label: "Today", value: data?.modules.scanner.today ?? "—" }}
            secondary={{ label: "7d total", value: data?.modules.scanner.week ?? "—" }}
            delta={data?.modules.scanner.delta}
          />
          <ModuleHealthCard
            name="Ask"
            status={data?.modules.ask.status ?? "healthy"}
            primary={{ label: "Today", value: data?.modules.ask.today ?? "—" }}
            secondary={{ label: "7d total", value: data?.modules.ask.week ?? "—" }}
            delta={data?.modules.ask.delta}
          />
          <ModuleHealthCard
            name="Watchlist"
            status={data?.modules.watchlist.status ?? "healthy"}
            primary={{ label: "Active", value: data?.modules.watchlist.today ?? "—" }}
            secondary={{ label: "New 7d", value: data?.modules.watchlist.week ?? "—" }}
          />
          <ModuleHealthCard
            name="Investigators"
            status={data?.modules.investigators.status ?? "healthy"}
            primary={{
              label: "Accesses + Cases",
              value: data?.modules.investigators.today ?? "—",
            }}
            secondary={{
              label: "New accesses 7d",
              value: data?.modules.investigators.week ?? "—",
            }}
          />
          <ModuleHealthCard
            name="KOL Registry"
            status={data?.modules.registry.status ?? "healthy"}
            primary={{ label: "Published", value: data?.modules.registry.today ?? "—" }}
            secondary={{ label: "Updated 7d", value: data?.modules.registry.week ?? "—" }}
          />
          <ModuleHealthCard
            name="Watcher"
            status={data?.modules.watcher.status ?? "healthy"}
            primary={{ label: "Alerts today", value: data?.modules.watcher.today ?? "—" }}
            secondary={{ label: "7d total", value: data?.modules.watcher.week ?? "—" }}
            delta={data?.modules.watcher.delta}
          />
        </div>

        {/* CHART 30 days */}
        <SectionTitle>Activity — 30 Days</SectionTitle>
        <div
          style={{
            marginTop: 16,
            background: "#0D0D0D",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: 20,
          }}
        >
          <div style={{ width: "100%", height: 280 }}>
            {data && data.kpis.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.kpis.chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#111",
                      border: `1px solid ${ACCENT}`,
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="scans"
                    stroke={ACCENT}
                    strokeWidth={2}
                    dot={false}
                    name="Scans"
                  />
                  <Line
                    type="monotone"
                    dataKey="ask"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={2}
                    dot={false}
                    name="Ask"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <CenteredEmpty label={data ? "No data on last 30 days" : "Loading…"} />
            )}
          </div>
        </div>

        {/* BLOC 5 — THREAT RADAR */}
        <SectionTitle subtitle="Active risk signals and watch concentration">Threat Radar</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
            marginTop: 16,
          }}
        >
          {/* Most Watched */}
          <Card title="Most Watched">
            {data && data.radar.recentWatched.length > 0 ? (
              data.radar.recentWatched.map((w) => (
                <ListRow key={w.id}>
                  <span style={{ fontFamily: "Menlo, monospace", fontSize: 11 }}>
                    {shortAddr(w.address)}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                    {w.chain} · {relativeDate(w.createdAt)}
                  </span>
                </ListRow>
              ))
            ) : (
              <Empty>{data ? "No watched addresses yet" : "—"}</Empty>
            )}
          </Card>

          {/* Alert Activity chart */}
          <Card title="Alert Activity">
            <div style={{ width: "100%", height: 180 }}>
              {data && data.radar.alertsChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.radar.alertsChart}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={9} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#111",
                        border: `1px solid ${ACCENT}`,
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Bar dataKey="count" fill={ACCENT} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <CenteredEmpty label={data ? "No alerts on last 30 days" : "Loading…"} />
              )}
            </div>
          </Card>

          {/* Recent Alerts */}
          <Card title="Recent Alerts">
            {data && data.radar.recentAlerts.length > 0 ? (
              data.radar.recentAlerts.map((a) => (
                <ListRow key={a.id}>
                  <span style={{ fontSize: 11, color: "#FFFFFF" }}>
                    {a.changeType.replace(/_/g, " ")}{" "}
                    <span style={{ color: ACCENT, fontWeight: 600 }}>→ {a.newTier}</span>
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                    {relativeDate(a.createdAt)}
                  </span>
                </ListRow>
              ))
            ) : (
              <Empty>{data ? "No alerts yet" : "—"}</Empty>
            )}
          </Card>

          {/* KOL Registry */}
          <Card title="KOL Registry">
            {data && data.radar.recentKols.length > 0 ? (
              data.radar.recentKols.map((k) => (
                <ListRow key={k.handle}>
                  <span style={{ fontSize: 11, color: "#FFFFFF" }}>
                    @{k.handle}
                    {k.tier && (
                      <span style={{ color: ACCENT, marginLeft: 6, fontSize: 10 }}>
                        {k.tier}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                    {relativeDate(k.updatedAt)}
                  </span>
                </ListRow>
              ))
            ) : (
              <Empty>{data ? "No published KOL yet" : "—"}</Empty>
            )}
          </Card>
        </div>

        {/* BLOC 6 — ALERTS QUEUE */}
        <SectionTitle subtitle="Problèmes prioritaires nécessitant attention">
          Alerts Queue
        </SectionTitle>
        <div
          style={{
            marginTop: 16,
            background: "#0D0D0D",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {!data ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "rgba(255,255,255,0.35)",
                fontSize: 12,
              }}
            >
              Loading…
            </div>
          ) : data.alerts.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  marginBottom: 6,
                }}
              >
                No active alerts
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                Platform activity and core signals are within expected ranges.
              </div>
            </div>
          ) : (
            data.alerts.map((a, i) => (
              <AlertRow
                key={`${a.severity}-${i}`}
                severity={a.severity}
                title={a.title}
                context={a.context}
                action={a.action}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Local helpers ───────────────────────────────────────────────────────────

function SectionTitle({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div style={{ marginTop: 36 }}>
      <div
        style={{
          fontSize: 13,
          color: "#FFFFFF",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {children}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            marginTop: 3,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  status,
}: {
  label: string;
  status: "healthy" | "warning" | "critical";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      {miniStatusFor(status)}
    </div>
  );
}

function FunnelStep({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
        minWidth: 100,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {note && (
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.3)",
            marginTop: 4,
            textAlign: "center",
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

function FunnelArrow({ rate }: { rate: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: "rgba(255,255,255,0.3)",
      }}
    >
      <div style={{ fontSize: 18 }}>→</div>
      <div style={{ fontSize: 9, marginTop: 2 }}>{rate}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#0D0D0D",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#FFFFFF",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ListRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "rgba(255,255,255,0.3)",
        padding: "10px 0",
      }}
    >
      {children}
    </div>
  );
}

function CenteredEmpty({ label }: { label: string }) {
  return (
    <div
      style={{
        color: "rgba(255,255,255,0.3)",
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      {label}
    </div>
  );
}
