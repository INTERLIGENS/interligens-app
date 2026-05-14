import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isBillingEnabled, getCap } from "@/lib/billing/env";

export const dynamic = "force-dynamic";

interface CountsByStatus {
  paid: number;
  pendingValid: number;
  pendingExpired: number;
  failed: number;
  refunded: number;
  disputed: number;
  expired: number;
}

export default async function AdminBillingPage() {
  if (!isBillingEnabled()) notFound();

  const now = new Date();
  const cap = getCap();

  const [paidGrossRows, statusBuckets, taxRows, latestEvents, alerts, waitlistCount, latestRefunds] =
    await Promise.all([
      // Total gross (cents)
      prisma.betaFounderAccess.aggregate({
        _sum: { amountCents: true, taxAmountCents: true },
        where: { status: "paid" },
      }),
      // Status counts
      prisma.betaFounderAccess.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      // Count of paid rows with tax recorded (for tax visibility)
      prisma.betaFounderAccess.count({
        where: { status: "paid", taxAmountCents: { not: null } },
      }),
      // Last 50 webhook events
      prisma.billingEvent.findMany({
        orderBy: { processedAt: "desc" },
        take: 50,
      }),
      // Recent fraud / rate-limit audit events
      prisma.investigatorAuditLog.findMany({
        where: {
          eventType: {
            in: [
              "billing.checkout.rate_limited",
              "billing.checkout.turnstile_failed",
              "billing.fraud.suspect_pattern",
              "billing.webhook.signature_invalid",
            ],
          },
        },
        orderBy: { timestamp: "desc" },
        take: 20,
      }),
      prisma.waitlistEntry.count(),
      prisma.betaFounderAccess.findMany({
        where: { status: { in: ["refunded", "disputed"] } },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          email: true,
          status: true,
          revokedAt: true,
          revokeReason: true,
          updatedAt: true,
        },
      }),
    ]);

  // Split "pending" into still-valid vs expired-but-not-swept.
  const pendingRows = await prisma.betaFounderAccess.findMany({
    where: { status: "pending" },
    select: { reservationExpiresAt: true },
  });
  const pendingValid = pendingRows.filter(
    (r) => r.reservationExpiresAt && r.reservationExpiresAt > now,
  ).length;
  const pendingExpired = pendingRows.length - pendingValid;

  const counts: CountsByStatus = {
    paid: pickStatus(statusBuckets, "paid"),
    pendingValid,
    pendingExpired,
    failed: pickStatus(statusBuckets, "failed"),
    refunded: pickStatus(statusBuckets, "refunded"),
    disputed: pickStatus(statusBuckets, "disputed"),
    expired: pickStatus(statusBuckets, "expired"),
  };

  const grossEur = ((paidGrossRows._sum.amountCents ?? 0) / 100).toFixed(2);
  const taxEur =
    paidGrossRows._sum.taxAmountCents != null
      ? (paidGrossRows._sum.taxAmountCents / 100).toFixed(2)
      : null;

  return (
    <div style={{ padding: 32, color: "#FFFFFF" }}>
      <h1
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          fontWeight: 900,
          fontSize: 18,
          marginBottom: 4,
        }}
      >
        Billing — Beta Founder
      </h1>
      <p style={{ color: "#888", fontSize: 12, marginBottom: 24 }}>
        Cap {counts.paid + counts.pendingValid} / {cap} ·{" "}
        <Link href="/admin" style={{ color: "#FF6B00" }}>
          ← admin
        </Link>
      </p>

      <Grid>
        <Card label="Paid" value={String(counts.paid)} accent />
        <Card label="Pending (valid)" value={String(counts.pendingValid)} />
        <Card label="Pending (expired, unswept)" value={String(counts.pendingExpired)} />
        <Card label="Failed" value={String(counts.failed)} />
        <Card label="Refunded" value={String(counts.refunded)} muted />
        <Card label="Disputed" value={String(counts.disputed)} muted />
        <Card label="Gross EUR" value={`€ ${grossEur}`} />
        <Card
          label="Tax EUR"
          value={taxEur != null ? `€ ${taxEur}` : "—"}
          subtitle={`${taxRows} paid rows w/ tax`}
        />
        <Card label="Waitlist" value={String(waitlistCount)} />
      </Grid>

      <Section title="Latest webhook events (50)">
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>at</Th>
              <Th>type</Th>
              <Th>stripeEventId</Th>
            </tr>
          </thead>
          <tbody>
            {latestEvents.map((e) => (
              <tr key={e.id}>
                <Td>{e.processedAt.toISOString().slice(0, 19).replace("T", " ")}</Td>
                <Td>{e.eventType}</Td>
                <Td>
                  <code style={{ color: "#888" }}>{e.stripeEventId}</code>
                </Td>
              </tr>
            ))}
            {latestEvents.length === 0 && (
              <tr>
                <Td colSpan={3} muted>
                  no events yet
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Fraud / rate-limit alerts (last 20)">
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>at</Th>
              <Th>type</Th>
              <Th>metadata</Th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <Td>{a.timestamp.toISOString().slice(0, 19).replace("T", " ")}</Td>
                <Td>{a.eventType}</Td>
                <Td>
                  <code style={{ color: "#888", fontSize: 11 }}>
                    {a.metadata ? JSON.stringify(a.metadata).slice(0, 140) : "—"}
                  </code>
                </Td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <Td colSpan={3} muted>
                  no alerts
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Recent refunds / disputes">
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>updated</Th>
              <Th>status</Th>
              <Th>email</Th>
              <Th>reason</Th>
            </tr>
          </thead>
          <tbody>
            {latestRefunds.map((r) => (
              <tr key={r.id}>
                <Td>{r.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</Td>
                <Td>{r.status}</Td>
                <Td>{r.email}</Td>
                <Td>{r.revokeReason ?? "—"}</Td>
              </tr>
            ))}
            {latestRefunds.length === 0 && (
              <tr>
                <Td colSpan={4} muted>
                  none
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      <p style={{ color: "#444", fontSize: 11, marginTop: 32 }}>
        No card details are stored. Only Stripe identifiers, amounts and dates appear here.
      </p>
    </div>
  );
}

function pickStatus(
  rows: Array<{ status: string; _count: { _all: number } }>,
  status: string,
): number {
  return rows.find((r) => r.status === status)?._count._all ?? 0;
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 32,
      }}
    >
      {children}
    </div>
  );
}

function Card({
  label,
  value,
  subtitle,
  accent,
  muted,
}: {
  label: string;
  value: string;
  subtitle?: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: "#0A0A0A",
        border: "1px solid #1F1F1F",
        padding: 16,
        opacity: muted ? 0.7 : 1,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          fontWeight: 900,
          textTransform: "uppercase",
          color: "#888",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: accent ? "#FF6B00" : "#FFFFFF",
          marginTop: 4,
        }}
      >
        {value}
      </div>
      {subtitle ? (
        <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 24 }}>
      <h2
        style={{
          fontSize: 11,
          letterSpacing: "0.2em",
          fontWeight: 900,
          textTransform: "uppercase",
          color: "#888",
          marginBottom: 8,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: 8,
        fontWeight: 900,
        color: "#888",
        fontSize: 10,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        borderBottom: "1px solid #1F1F1F",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  colSpan,
  muted,
}: {
  children: React.ReactNode;
  colSpan?: number;
  muted?: boolean;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: 8,
        borderBottom: "1px solid #111",
        color: muted ? "#555" : "#FFF",
      }}
    >
      {children}
    </td>
  );
}
