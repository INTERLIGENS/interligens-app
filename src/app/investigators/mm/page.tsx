// ─── /investigators/mm — MM Intelligence dashboard (admin-only) ──────────
// Surface for the founder / admin to watch:
//   • entity breakdown (total + by MmStatus)
//   • attributed wallet counts
//   • scan activity (24h / 7d / 30d buckets)
//   • latest MM alerts emitted by the Watcher hook
//   • top-10 tokens by MmScore.displayScore
//
// Access is gated by the admin_session cookie. Everyone else is 404ed —
// the page does not appear in investigator search results and there's no
// direct link from the public index.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getPendingAlerts } from "@/lib/mm/integration/alertManager";
import type { MmAlert } from "@/lib/mm/integration/alertManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "MM Intelligence — Dashboard",
  description: "Market-maker intelligence dashboard (admin-only).",
  robots: { index: false, follow: false },
};

// ─── Admin session check (inline — see lib/security/adminAuth.ts) ────────
// Mirrors verifyAdminSession() but uses next/headers for server components.

const ADMIN_SESSION_COOKIE_NAME = "admin_session";

function computeAdminSessionToken(): string | null {
  const pass = process.env.ADMIN_BASIC_PASS;
  const secret = process.env.ADMIN_TOKEN;
  if (!pass || !secret) return null;
  return createHmac("sha256", secret).update(pass).digest("hex");
}

function safeCompareHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) {
      timingSafeEqual(ba, Buffer.alloc(ba.length));
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

async function isAdminSession(): Promise<boolean> {
  const store = await cookies();
  const provided = store.get(ADMIN_SESSION_COOKIE_NAME)?.value ?? null;
  if (!provided) return false;
  const expected = computeAdminSessionToken();
  if (!expected) return false;
  return safeCompareHex(provided, expected);
}

// ─── Data ────────────────────────────────────────────────────────────────

interface MmStatusCount {
  status: string;
  count: number;
}

interface TopScore {
  subjectId: string;
  chain: string;
  displayScore: number;
  band: string;
  confidence: string;
  computedAt: Date;
}

async function loadDashboardData() {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);

  const [
    totalEntities,
    statusGroups,
    activeAttributions,
    scans24h,
    scans7d,
    scans30d,
    topScores,
    alerts,
  ] = await Promise.all([
    prisma.mmEntity.count(),
    prisma.mmEntity.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.mmAttribution.count({ where: { revokedAt: null } }),
    prisma.mmScanRun.count({ where: { createdAt: { gte: h24 } } }),
    prisma.mmScanRun.count({ where: { createdAt: { gte: d7 } } }),
    prisma.mmScanRun.count({ where: { createdAt: { gte: d30 } } }),
    prisma.mmScore.findMany({
      orderBy: { displayScore: "desc" },
      take: 10,
      select: {
        subjectId: true,
        chain: true,
        displayScore: true,
        band: true,
        confidence: true,
        computedAt: true,
      },
    }),
    getPendingAlerts({ limit: 20 }),
  ]);

  const statusCounts: MmStatusCount[] = statusGroups
    .map((g) => ({ status: g.status, count: g._count as unknown as number }))
    .sort((a, b) => b.count - a.count);

  return {
    totalEntities,
    statusCounts,
    activeAttributions,
    scanBuckets: { last24h: scans24h, last7d: scans7d, last30d: scans30d },
    topScores: topScores as unknown as TopScore[],
    alerts,
  };
}

// ─── Page ────────────────────────────────────────────────────────────────

export default async function InvestigatorMmDashboardPage() {
  if (!(await isAdminSession())) notFound();
  const data = await loadDashboardData();
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        padding: "40px 28px 80px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <Header />
        <OverviewCards
          totalEntities={data.totalEntities}
          statusCounts={data.statusCounts}
          activeAttributions={data.activeAttributions}
          scanBuckets={data.scanBuckets}
        />
        <AlertsBlock alerts={data.alerts} />
        <TopScoresBlock scores={data.topScores} />
        <Footer />
      </div>
    </main>
  );
}

// ─── UI ──────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header style={{ marginBottom: 28 }}>
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          fontSize: 10,
          letterSpacing: 3,
          fontWeight: 900,
          border: "1px solid #FF6B00",
          color: "#FF6B00",
          borderRadius: 2,
          marginBottom: 12,
        }}
      >
        MM · INTELLIGENCE · ADMIN
      </span>
      <h1
        style={{
          fontSize: 36,
          fontWeight: 900,
          letterSpacing: -0.6,
          lineHeight: 1.05,
          marginBottom: 8,
        }}
      >
        Market Maker Activity
      </h1>
      <p
        style={{
          color: "#999",
          fontSize: 14,
          lineHeight: 1.6,
          maxWidth: 720,
        }}
      >
        Registry counts, scan throughput, live Watcher alerts and top-scoring
        tokens. Accessible only with an active admin session — investigators
        never see this surface.
      </p>
    </header>
  );
}

function OverviewCards({
  totalEntities,
  statusCounts,
  activeAttributions,
  scanBuckets,
}: {
  totalEntities: number;
  statusCounts: MmStatusCount[];
  activeAttributions: number;
  scanBuckets: { last24h: number; last7d: number; last30d: number };
}) {
  return (
    <section
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        marginBottom: 32,
      }}
    >
      <StatCard
        label="Entités suivies"
        value={totalEntities}
        footer={
          statusCounts.length > 0
            ? statusCounts
                .slice(0, 4)
                .map((s) => `${s.status}:${s.count}`)
                .join(" · ")
            : undefined
        }
      />
      <StatCard
        label="Wallets attribués (actifs)"
        value={activeAttributions}
      />
      <StatCard
        label="Scans — 24 h"
        value={scanBuckets.last24h}
        footer={`7j: ${scanBuckets.last7d} · 30j: ${scanBuckets.last30d}`}
      />
      <StatCard
        label="Alertes récentes"
        value={0}
        footer="(bloc plus bas)"
      />
    </section>
  );
}

function StatCard({
  label,
  value,
  footer,
}: {
  label: string;
  value: number;
  footer?: string;
}) {
  return (
    <div
      style={{
        padding: 18,
        background: "#0A0A0A",
        border: "1px solid #1A1A1A",
        borderRadius: 2,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          fontWeight: 700,
          color: "#999",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 900,
          letterSpacing: 0.5,
          color: "#FFFFFF",
        }}
      >
        {value}
      </div>
      {footer ? (
        <div
          style={{
            fontSize: 10,
            color: "#666",
            marginTop: 8,
            letterSpacing: 0.5,
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function AlertsBlock({ alerts }: { alerts: MmAlert[] }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={SECTION_H2}>Dernières alertes MM</h2>
      {alerts.length === 0 ? (
        <EmptyState>
          Aucune alerte MM récente. Le hook Watcher émet une alerte quand un
          KOL shille un token avec un MM displayScore ≥ ORANGE.
        </EmptyState>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 10,
          }}
        >
          {alerts.map((a) => (
            <li
              key={a.id}
              style={{
                padding: 14,
                background: "#0A0A0A",
                border: `1px solid ${a.band === "RED" ? "#7F1D1D" : "#7C2D12"}`,
                borderRadius: 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: 2.5,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    color: a.band === "RED" ? "#FCA5A5" : "#FED7AA",
                  }}
                >
                  {a.band ?? "?"} · score {a.displayScore ?? "?"}
                </span>
                <span style={{ fontSize: 11, color: "#666" }}>
                  {new Date(a.createdAt).toISOString().slice(0, 19).replace("T", " ")}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#E5E5E5", marginBottom: 4 }}>
                <strong>{a.kolHandle ?? "unknown"}</strong> shilled{" "}
                <code
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12,
                    color: "#FF6B00",
                  }}
                >
                  {a.tokenAddress ?? ""}
                </code>{" "}
                <span style={{ color: "#888" }}>({a.chain ?? "?"})</span>
              </div>
              {a.tweetUrl ? (
                <a
                  href={a.tweetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "#FF6B00" }}
                >
                  → tweet
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TopScoresBlock({ scores }: { scores: TopScore[] }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={SECTION_H2}>Top 10 tokens par displayScore</h2>
      {scores.length === 0 ? (
        <EmptyState>
          Aucun MmScore persisté à ce jour. Lance un scan via{" "}
          <code style={{ color: "#FF6B00" }}>POST /api/v1/mm/scan</code> ou le
          cron <code style={{ color: "#FF6B00" }}>mm-batch-scan</code>.
        </EmptyState>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            background: "#0A0A0A",
            border: "1px solid #1A1A1A",
            borderRadius: 2,
          }}
        >
          <thead>
            <tr>
              <TH>Token</TH>
              <TH>Chain</TH>
              <TH>Score</TH>
              <TH>Band</TH>
              <TH>Confiance</TH>
              <TH>Calculé</TH>
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={`${s.subjectId}:${s.chain}`}>
                <TD monospaced>{s.subjectId.slice(0, 24)}…</TD>
                <TD>{s.chain}</TD>
                <TD>
                  <strong>{s.displayScore}</strong>
                </TD>
                <TD>{s.band}</TD>
                <TD>{s.confidence}</TD>
                <TD>
                  {s.computedAt
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Footer() {
  return (
    <footer
      style={{
        marginTop: 32,
        paddingTop: 20,
        borderTop: "1px solid #1A1A1A",
        color: "#666",
        fontSize: 12,
        lineHeight: 1.7,
      }}
    >
      Liens utiles :{" "}
      <a href="/mm" style={{ color: "#FF6B00" }}>
        registre public
      </a>{" "}
      ·{" "}
      <a href="/mm/methodology" style={{ color: "#FF6B00" }}>
        méthodologie
      </a>{" "}
      ·{" "}
      <a href="/mm/legal" style={{ color: "#FF6B00" }}>
        mentions légales
      </a>
    </footer>
  );
}

// ─── Primitives ──────────────────────────────────────────────────────────

const SECTION_H2: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 3,
  textTransform: "uppercase",
  color: "#FF6B00",
  fontWeight: 900,
  marginBottom: 14,
};

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 24,
        border: "1px dashed #333",
        color: "#888",
        fontSize: 13,
        lineHeight: 1.6,
        borderRadius: 2,
      }}
    >
      {children}
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 14px",
        borderBottom: "1px solid #1A1A1A",
        fontSize: 10,
        letterSpacing: 2,
        textTransform: "uppercase",
        fontWeight: 700,
        color: "#888",
      }}
    >
      {children}
    </th>
  );
}

function TD({
  children,
  monospaced,
}: {
  children: React.ReactNode;
  monospaced?: boolean;
}) {
  return (
    <td
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid #111",
        color: "#DDD",
        fontFamily: monospaced
          ? "ui-monospace, SFMono-Regular, Menlo, monospace"
          : "inherit",
      }}
    >
      {children}
    </td>
  );
}
