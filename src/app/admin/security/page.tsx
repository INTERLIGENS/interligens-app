import Link from "next/link";
import {
  getSecurityOverview,
  listIncidents,
  listOpenActionItems,
  listVendors,
  listThreats,
} from "@/lib/security/queries";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Security Center — INTERLIGENS admin",
};

const BG = "#000000";
const SURFACE = "#0a0a0a";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.55)";
const ACCENT = "#FF6B00";
const CRITICAL = "#ff4040";
const HIGH = "#FF6B00";
const MEDIUM = "#FFB800";

function severityColor(sev: string): string {
  if (sev === "critical") return CRITICAL;
  if (sev === "high") return HIGH;
  if (sev === "medium") return MEDIUM;
  return MUTED;
}

function exposureColor(lvl: string | null | undefined): string {
  if (lvl === "confirmed") return CRITICAL;
  if (lvl === "probable") return HIGH;
  if (lvl === "possible") return MEDIUM;
  return MUTED;
}

const MetricCard = ({
  kicker,
  value,
  sub,
  tint,
}: {
  kicker: string;
  value: string | number;
  sub?: string;
  tint?: string;
}) => (
  <div
    style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      padding: 16,
    }}
  >
    <div
      style={{
        textTransform: "uppercase",
        fontSize: 10,
        letterSpacing: "0.12em",
        color: MUTED,
      }}
    >
      {kicker}
    </div>
    <div
      style={{
        fontSize: 28,
        fontWeight: 700,
        color: tint ?? "#FFFFFF",
        marginTop: 6,
        lineHeight: 1,
      }}
    >
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>{sub}</div>
    )}
  </div>
);

const Section = ({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section style={{ marginTop: 32 }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: "0.14em",
          color: ACCENT,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      {right}
    </div>
    {children}
  </section>
);

export default async function SecurityCenterPage() {
  // Fail-soft if the migration hasn't been applied yet: render a bootstrap
  // state instead of crashing on the first Prisma query.
  let overview: Awaited<ReturnType<typeof getSecurityOverview>> | null = null;
  let incidents: Awaited<ReturnType<typeof listIncidents>> = [];
  let vendors: Awaited<ReturnType<typeof listVendors>> = [];
  let actions: Awaited<ReturnType<typeof listOpenActionItems>> = [];
  let threats: Awaited<ReturnType<typeof listThreats>> = [];
  let migrationPending = false;

  try {
    [overview, incidents, vendors, actions, threats] = await Promise.all([
      getSecurityOverview(),
      listIncidents({ limit: 10 }),
      listVendors(),
      listOpenActionItems(10),
      listThreats(),
    ]);
  } catch (err) {
    console.warn("[admin/security] data load failed — migration pending?", err);
    migrationPending = true;
  }

  if (migrationPending || !overview) {
    return (
      <main style={{ minHeight: "100vh", background: BG, color: "#FFF" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px" }}>
          <div
            style={{
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: "0.14em",
              color: MUTED,
            }}
          >
            INTERLIGENS · ADMIN · SECURITY CENTER
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>
            Migration pending
          </h1>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>
            The Security Center data layer is shipped but the Neon migration
            hasn&rsquo;t been applied yet. Paste the contents of{" "}
            <code style={{ color: ACCENT }}>
              prisma/migrations/manual_security_center/migration.sql
            </code>{" "}
            in the Neon SQL Editor (after taking a branch snapshot), then run{" "}
            <code style={{ color: ACCENT }}>pnpm security:center:seed</code> to
            populate vendors, threats, and the Vercel-breach reference incident.
            See <code style={{ color: ACCENT }}>docs/security-center-runbook.md</code>{" "}
            §0 for the full checklist.
          </p>
        </div>
      </main>
    );
  }

  const heroTint =
    overview.criticalOpenIncidentCount > 0
      ? CRITICAL
      : overview.exposedIncidentCount > 0
        ? HIGH
        : overview.openIncidentCount > 0
          ? MEDIUM
          : "#00c46c";

  const heroLabel =
    overview.criticalOpenIncidentCount > 0
      ? "ACTIVE · CRITICAL"
      : overview.exposedIncidentCount > 0
        ? "ACTIVE · EXPOSED"
        : overview.openIncidentCount > 0
          ? "MONITORING"
          : "CALM";

  return (
    <main style={{ minHeight: "100vh", background: BG, color: "#FFF" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* ── HERO ─────────────────────────────────────────── */}
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.14em",
            color: MUTED,
          }}
        >
          INTERLIGENS · ADMIN · SECURITY CENTER
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            marginTop: 8,
            letterSpacing: "-0.01em",
          }}
        >
          Security Center
        </h1>
        <p
          style={{
            color: MUTED,
            fontSize: 14,
            lineHeight: 1.55,
            marginTop: 8,
            maxWidth: 720,
          }}
        >
          Vendor watchlist + incident registry + exposure qualification +
          weekly digest + comms drafts. Admin-only. No retail exposure.
        </p>

        <div
          style={{
            marginTop: 20,
            padding: "12px 16px",
            background: SURFACE,
            border: `1px solid ${heroTint}55`,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: heroTint,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontSize: 11,
            }}
          >
            {heroLabel}
          </span>
          <span style={{ color: MUTED, fontSize: 12 }}>
            {overview.openIncidentCount} open incident
            {overview.openIncidentCount === 1 ? "" : "s"} ·{" "}
            {overview.criticalOpenIncidentCount} critical/high ·{" "}
            {overview.exposedIncidentCount} with exposure (probable+) ·{" "}
            {overview.vendorCount} vendors tracked ·{" "}
            {overview.activeSourceCount} sources active
          </span>
        </div>

        {/* ── METRICS ─────────────────────────────────────── */}
        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          <MetricCard
            kicker="Open incidents"
            value={overview.openIncidentCount}
            sub={`${overview.criticalOpenIncidentCount} critical/high`}
            tint={overview.criticalOpenIncidentCount > 0 ? CRITICAL : undefined}
          />
          <MetricCard
            kicker="Exposed (probable+)"
            value={overview.exposedIncidentCount}
            tint={overview.exposedIncidentCount > 0 ? HIGH : undefined}
          />
          <MetricCard
            kicker="Vendors tracked"
            value={overview.vendorCount}
            sub={`${overview.activeSourceCount} active sources`}
          />
          <MetricCard
            kicker="Open P1 actions"
            value={overview.openP1ActionItemCount}
            sub={`${overview.openActionItemCount} total open`}
            tint={overview.openP1ActionItemCount > 0 ? HIGH : undefined}
          />
          <MetricCard
            kicker="Last digest"
            value={
              overview.lastDigest
                ? overview.lastDigest.deliveryStatus === "sent"
                  ? "Sent"
                  : overview.lastDigest.deliveryStatus
                : "—"
            }
            sub={
              overview.lastDigest
                ? new Date(overview.lastDigest.generatedAt)
                    .toISOString()
                    .slice(0, 10)
                : "never generated"
            }
          />
        </div>

        {/* ── ACTIVE INCIDENTS ─────────────────────────────── */}
        <Section
          title="Active incidents"
          right={
            <Link
              href="/admin/security/incidents"
              style={{ fontSize: 11, color: ACCENT, textDecoration: "none" }}
            >
              See all &rarr;
            </Link>
          }
        >
          {incidents.length === 0 ? (
            <EmptyRow>No incidents recorded yet.</EmptyRow>
          ) : (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              {incidents.map((inc) => {
                const exposure = inc.assessments[0]?.exposureLevel ?? null;
                return (
                  <div
                    key={inc.id}
                    style={{
                      padding: "14px 16px",
                      borderTop: `1px solid ${BORDER}`,
                      background: SURFACE,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Link
                          href={`/admin/security/incidents/${inc.id}`}
                          style={{ color: "#FFF", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
                        >
                          {inc.title}
                        </Link>
                        <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                          <span
                            style={{
                              color: severityColor(inc.severity),
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                            }}
                          >
                            {inc.severity}
                          </span>{" "}
                          · {inc.incidentType} · {inc.status} ·{" "}
                          {new Date(inc.detectedAt).toISOString().slice(0, 10)}
                          {inc.vendor ? ` · ${inc.vendor.name}` : ""}
                        </div>
                        <p
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.75)",
                            lineHeight: 1.5,
                            marginTop: 6,
                          }}
                        >
                          {inc.summaryShort}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 8px",
                            background: `${exposureColor(exposure)}22`,
                            color: exposureColor(exposure),
                            border: `1px solid ${exposureColor(exposure)}55`,
                            borderRadius: 4,
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            fontWeight: 600,
                          }}
                        >
                          {exposure ? `exposure · ${exposure}` : "no assessment"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ── VENDOR WATCHLIST ─────────────────────────────── */}
        <Section title="Vendor watchlist">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {vendors.map((v) => {
              const latest = v.incidents[0];
              return (
                <div
                  key={v.id}
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#FFF" }}>{v.name}</div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginTop: 4 }}>
                    {v.category}
                    {v._count.sources > 0 ? ` · ${v._count.sources} source${v._count.sources === 1 ? "" : "s"}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>
                    {latest ? (
                      <>
                        <span style={{ color: severityColor(latest.severity), fontWeight: 600 }}>
                          {latest.severity.toUpperCase()}
                        </span>{" "}
                        · last incident{" "}
                        {new Date(latest.detectedAt).toISOString().slice(0, 10)}
                      </>
                    ) : (
                      <span style={{ color: "rgba(255,255,255,0.3)" }}>no incident recorded</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── OPEN ACTIONS ─────────────────────────────────── */}
        <Section title="Open action items">
          {actions.length === 0 ? (
            <EmptyRow>Nothing outstanding.</EmptyRow>
          ) : (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8 }}>
              {actions.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: "10px 14px",
                    borderTop: `1px solid ${BORDER}`,
                    background: SURFACE,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "#FFF" }}>
                      <span
                        style={{
                          color: ACCENT,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          fontSize: 10,
                          marginRight: 8,
                        }}
                      >
                        {a.priority}
                      </span>
                      {a.title}
                    </div>
                    {a.incident && (
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                        incident: {a.incident.title}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, alignSelf: "center" }}>{a.status}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── DIGEST STATUS ─────────────────────────────────── */}
        <Section title="Weekly digest">
          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: 16,
              fontSize: 13,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {overview.lastDigest ? (
              <>
                Last generated:{" "}
                <span style={{ color: "#FFF" }}>
                  {new Date(overview.lastDigest.generatedAt).toISOString().slice(0, 16).replace("T", " ")}
                </span>{" "}
                — status:{" "}
                <span
                  style={{
                    color:
                      overview.lastDigest.deliveryStatus === "sent"
                        ? "#00c46c"
                        : overview.lastDigest.deliveryStatus === "failed"
                          ? CRITICAL
                          : MUTED,
                    fontWeight: 600,
                  }}
                >
                  {overview.lastDigest.deliveryStatus}
                </span>
                <div style={{ marginTop: 6, color: MUTED, fontSize: 12 }}>{overview.lastDigest.subject}</div>
              </>
            ) : (
              <span style={{ color: MUTED }}>
                No digest generated yet. The cron{" "}
                <code style={{ color: ACCENT }}>/api/cron/security-weekly-digest</code> runs every
                Monday 08:00 UTC (≈ 10:00 Europe/Paris, −1h in winter).
              </span>
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
              Manual trigger: POST{" "}
              <code style={{ color: ACCENT }}>/api/admin/security/digests/generate</code> → then
              <code style={{ color: ACCENT, marginLeft: 4 }}>/send</code>.
            </div>
          </div>
        </Section>

        {/* ── THREAT CATALOG ───────────────────────────────── */}
        <Section title={`Threat catalog (${threats.length})`}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 10,
            }}
          >
            {threats.map((t) => (
              <div
                key={t.id}
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    textTransform: "uppercase",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    color: MUTED,
                  }}
                >
                  {t.category}
                </div>
                <div style={{ fontSize: 13, color: "#FFF", fontWeight: 600, marginTop: 4 }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{t.targetSurface}</div>
                <p
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.7)",
                    lineHeight: 1.5,
                    marginTop: 8,
                  }}
                >
                  {t.description}
                </p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        color: MUTED,
        fontSize: 13,
        textAlign: "center",
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
      }}
    >
      {children}
    </div>
  );
}
