/**
 * REFLEX V1 — admin calibration dashboard (Commit 13/15).
 *
 * Server-rendered. Auth is handled upstream by src/proxy.ts which gates
 * /admin/* via the admin_session cookie — if this page renders, the
 * request is already authenticated.
 *
 * Refresh manually (no polling). Filter window via ?window=24h|7d|30d.
 *
 * The Flag-as-FP button is a small client island (FlagFpButton.tsx)
 * because it needs onClick + fetch. Everything else is server-only.
 */
import { ADMIN_COPY } from "@/lib/reflex/admin-copy";
import {
  computeAlerts,
  computeStopRate,
  countAnalyses,
  dailyStopRate,
  inputTypeDistribution,
  lastN,
  latencyStats,
  modeBreakdown,
  parseWindow,
  topHandles,
  topNarrativeScripts,
  verdictDistribution,
  windowStartDate,
  type DailyStopRateRow,
  type LastAnalysisRow,
  type TopCount,
  type TopHandle,
  type WindowKey,
} from "@/lib/reflex/metrics";
import FlagFpButton from "./FlagFpButton";
import type { ReflexVerdict } from "@/lib/reflex/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLOR = {
  bg: "#000000",
  fg: "#FFFFFF",
  muted: "#888",
  border: "#1E2028",
  accent: "#FF6B00",
  danger: "#FF3B5C",
  warning: "#FFB800",
  surface: "#0a0a12",
};

interface PageProps {
  searchParams: Promise<{ window?: string }>;
}

function pct(num: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((num / total) * 100).toFixed(1) + "%";
}

function WindowFilter({ active }: { active: WindowKey }) {
  const opts: Array<{ key: WindowKey; label: string }> = [
    { key: "24h", label: ADMIN_COPY.windowFilter.h24 },
    { key: "7d", label: ADMIN_COPY.windowFilter.d7 },
    { key: "30d", label: ADMIN_COPY.windowFilter.d30 },
  ];
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ color: COLOR.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
        {ADMIN_COPY.windowFilter.label}
      </span>
      {opts.map((o) => (
        <a
          key={o.key}
          href={`?window=${o.key}`}
          style={{
            padding: "4px 10px",
            border: `1px solid ${o.key === active ? COLOR.accent : COLOR.border}`,
            color: o.key === active ? COLOR.accent : COLOR.fg,
            textDecoration: "none",
            fontSize: 13,
            fontFamily: "monospace",
          }}
        >
          {o.label}
        </a>
      ))}
    </div>
  );
}

function Banner({ level, message }: { level: "red" | "orange"; message: string }) {
  const bg = level === "red" ? COLOR.danger : COLOR.warning;
  return (
    <div
      style={{
        background: bg, color: COLOR.bg, padding: "12px 16px",
        marginBottom: 12, fontWeight: 700, fontFamily: "monospace",
      }}
    >
      {message}
    </div>
  );
}

function Card({
  title, children,
}: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: COLOR.surface, border: `1px solid ${COLOR.border}`,
        padding: 16, marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 12, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px 0" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatGrid({ items }: { items: Array<{ label: string; value: string; muted?: boolean }> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ fontSize: 11, color: COLOR.muted, textTransform: "uppercase", letterSpacing: 1 }}>{it.label}</div>
          <div style={{
            fontSize: 24, fontFamily: "monospace", fontWeight: 700,
            color: it.muted ? COLOR.muted : COLOR.fg, marginTop: 4,
          }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function VerdictDistributionBlock({
  data, total,
}: { data: Record<ReflexVerdict, number>; total: number }) {
  const entries: Array<[ReflexVerdict, string]> = [
    ["STOP", ADMIN_COPY.labels.verdictStop],
    ["WAIT", ADMIN_COPY.labels.verdictWait],
    ["VERIFY", ADMIN_COPY.labels.verdictVerify],
    ["NO_CRITICAL_SIGNAL", ADMIN_COPY.labels.verdictNoSignal],
  ];
  const colorMap: Record<ReflexVerdict, string> = {
    STOP: COLOR.danger, WAIT: COLOR.warning,
    VERIFY: COLOR.accent, NO_CRITICAL_SIGNAL: COLOR.muted,
  };
  return (
    <div>
      {entries.map(([key, label]) => {
        const count = data[key];
        const ratio = total > 0 ? count / total : 0;
        return (
          <div key={key} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: "monospace", marginBottom: 2 }}>
              <span>{label}</span>
              <span>{count}  ({pct(count, total)})</span>
            </div>
            <div style={{ height: 6, background: COLOR.border }}>
              <div style={{ height: 6, width: `${ratio * 100}%`, background: colorMap[key] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailyStopRateChart({ data }: { data: DailyStopRateRow[] }) {
  if (data.length === 0) {
    return <div style={{ color: COLOR.muted, fontSize: 13 }}>{ADMIN_COPY.empty.noAnalyses}</div>;
  }
  const W = 600, H = 100;
  const barW = (W - 20) / data.length;
  return (
    <svg width={W} height={H} role="img" aria-label="Daily STOP rate">
      <rect x={0} y={0} width={W} height={H} fill={COLOR.surface} />
      {/* gridline at 30% (alert threshold) */}
      <line x1={0} x2={W} y1={H * 0.7} y2={H * 0.7} stroke={COLOR.danger} strokeDasharray="2,2" opacity={0.4} />
      {data.map((d, i) => {
        const barH = d.rate * H;
        const color = d.rate > 0.30 ? COLOR.danger : d.rate < 0.05 ? COLOR.warning : COLOR.accent;
        return (
          <g key={d.day}>
            <rect x={10 + i * barW} y={H - barH} width={barW - 2} height={barH} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

function DistributionTable({ data, total }: { data: Record<string, number>; total: number }) {
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return <div style={{ color: COLOR.muted, fontSize: 13 }}>{ADMIN_COPY.empty.noAnalyses}</div>;
  }
  return (
    <table style={{ width: "100%", fontSize: 13, fontFamily: "monospace", borderCollapse: "collapse" }}>
      <tbody>
        {sorted.map(([k, n]) => (
          <tr key={k} style={{ borderBottom: `1px solid ${COLOR.border}` }}>
            <td style={{ padding: "4px 0", color: COLOR.fg }}>{k}</td>
            <td style={{ padding: "4px 0", textAlign: "right", color: COLOR.fg }}>{n}</td>
            <td style={{ padding: "4px 0 4px 16px", textAlign: "right", color: COLOR.muted, width: 80 }}>{pct(n, total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TopList({
  items, emptyMessage,
}: { items: Array<{ key: string; count: number }>; emptyMessage: string }) {
  if (items.length === 0) {
    return <div style={{ color: COLOR.muted, fontSize: 13 }}>{emptyMessage}</div>;
  }
  return (
    <ol style={{ margin: 0, paddingLeft: 24, color: COLOR.fg, fontSize: 13, fontFamily: "monospace" }}>
      {items.map((it) => (
        <li key={it.key} style={{ marginBottom: 4 }}>
          {it.key} <span style={{ color: COLOR.muted }}>({it.count})</span>
        </li>
      ))}
    </ol>
  );
}

function LastTable({ rows }: { rows: LastAnalysisRow[] }) {
  if (rows.length === 0) {
    return <div style={{ color: COLOR.muted, fontSize: 13 }}>{ADMIN_COPY.empty.noAnalyses}</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: 12, fontFamily: "monospace", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${COLOR.border}`, color: COLOR.muted, textAlign: "left" }}>
            <th style={{ padding: "6px 8px" }}>{ADMIN_COPY.labels.id}</th>
            <th style={{ padding: "6px 8px" }}>{ADMIN_COPY.labels.createdAt}</th>
            <th style={{ padding: "6px 8px" }}>{ADMIN_COPY.labels.inputType}</th>
            <th style={{ padding: "6px 8px" }}>{ADMIN_COPY.labels.verdict}</th>
            <th style={{ padding: "6px 8px" }}>{ADMIN_COPY.labels.confidence}</th>
            <th style={{ padding: "6px 8px", textAlign: "right" }}>{ADMIN_COPY.labels.latencyMs}</th>
            <th style={{ padding: "6px 8px" }}>Mode</th>
            <th style={{ padding: "6px 8px" }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const verdictColor: Record<string, string> = {
              STOP: COLOR.danger, WAIT: COLOR.warning,
              VERIFY: COLOR.accent, NO_CRITICAL_SIGNAL: COLOR.muted,
            };
            return (
              <tr key={r.id} style={{ borderBottom: `1px solid ${COLOR.border}`, opacity: r.falsePositiveFlag ? 0.5 : 1 }}>
                <td style={{ padding: "6px 8px", color: COLOR.muted }}>{r.id.slice(0, 8)}</td>
                <td style={{ padding: "6px 8px" }}>{r.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                <td style={{ padding: "6px 8px" }}>{r.inputType}</td>
                <td style={{ padding: "6px 8px", color: verdictColor[r.verdict] ?? COLOR.fg, fontWeight: 700 }}>{r.verdict}</td>
                <td style={{ padding: "6px 8px" }}>{r.confidence}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.latencyMs}</td>
                <td style={{ padding: "6px 8px", color: r.mode === "PUBLIC" ? COLOR.accent : COLOR.muted }}>{r.mode}</td>
                <td style={{ padding: "6px 8px" }}>
                  <FlagFpButton id={r.id} initialFlag={r.falsePositiveFlag} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function CalibrationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const window = parseWindow(params.window);
  const since = windowStartDate(window);

  const [
    total, vdist, idist, mdist, lat, daily, narr, handles, last,
  ] = await Promise.all([
    countAnalyses(since),
    verdictDistribution(since),
    inputTypeDistribution(since),
    modeBreakdown(since),
    latencyStats(since),
    dailyStopRate(since),
    topNarrativeScripts(since, 10),
    topHandles(since, 10),
    lastN(50),
  ]);

  const stopRate = computeStopRate(vdist);
  const alerts = computeAlerts(stopRate, total, lat.p95, ADMIN_COPY.alerts);

  return (
    <div style={{ padding: 24, background: COLOR.bg, color: COLOR.fg, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, textTransform: "uppercase", letterSpacing: 1 }}>{ADMIN_COPY.pageTitle}</h1>
        <p style={{ color: COLOR.muted, fontSize: 13, marginTop: 4 }}>{ADMIN_COPY.pageSubtitle}</p>
      </header>

      <div style={{ marginBottom: 16 }}>
        <WindowFilter active={window} />
      </div>

      {alerts.map((a, i) => <Banner key={i} level={a.level} message={a.message} />)}

      <Card title={ADMIN_COPY.sections.overview}>
        <StatGrid
          items={[
            { label: ADMIN_COPY.labels.total, value: String(total) },
            { label: ADMIN_COPY.labels.stopRate, value: pct(vdist.STOP, total) },
            { label: ADMIN_COPY.labels.p50, value: `${lat.p50} ms` },
            { label: ADMIN_COPY.labels.p95, value: `${lat.p95} ms` },
            { label: ADMIN_COPY.labels.p99, value: `${lat.p99} ms` },
          ]}
        />
      </Card>

      <Card title={ADMIN_COPY.sections.verdictDistribution}>
        <VerdictDistributionBlock data={vdist} total={total} />
      </Card>

      <Card title={ADMIN_COPY.sections.dailyStopRate}>
        <DailyStopRateChart data={daily} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title={ADMIN_COPY.sections.inputType}>
          <DistributionTable data={idist} total={total} />
        </Card>
        <Card title={ADMIN_COPY.sections.modeBreakdown}>
          <DistributionTable data={mdist} total={total} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title={ADMIN_COPY.sections.topNarratives}>
          <TopList
            items={narr.map((n: TopCount) => ({ key: n.code, count: n.count }))}
            emptyMessage={ADMIN_COPY.empty.noNarratives}
          />
        </Card>
        <Card title={ADMIN_COPY.sections.topHandles}>
          <TopList
            items={handles.map((h: TopHandle) => ({ key: `@${h.handle}`, count: h.count }))}
            emptyMessage={ADMIN_COPY.empty.noHandles}
          />
        </Card>
      </div>

      <Card title={ADMIN_COPY.sections.last50}>
        <LastTable rows={last} />
        <p style={{ color: COLOR.muted, fontSize: 11, marginTop: 12 }}>
          {ADMIN_COPY.detailPlaceholder}
        </p>
      </Card>
    </div>
  );
}
