/**
 * Weekly Security digest composer.
 *
 * Pure function that takes the week's data + produces the subject / HTML /
 * text bodies. The `sendDigest` helper below wraps it with Resend delivery
 * using the same pattern as `src/lib/alerts/kolAlert.ts` and
 * `src/lib/email/weeklyDigest.ts` (never throws; returns `{delivered,
 * skipped?}`).
 *
 * Called by:
 *  - /api/cron/security-weekly-digest (weekly, gated by CRON_SECRET)
 *  - /api/admin/security/digests/generate (manual preview)
 *  - /api/admin/security/digests/send     (manual resend)
 */

export interface DigestIncidentRow {
  id: string;
  title: string;
  summaryShort: string;
  incidentType: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  status: string;
  detectedAt: Date;
  vendorName?: string | null;
  exposureLevel?:
    | "none"
    | "unlikely"
    | "possible"
    | "probable"
    | "confirmed"
    | null;
}

export interface DigestInput {
  periodStart: Date;
  periodEnd: Date;
  newIncidents: DigestIncidentRow[];
  criticalIncidents: DigestIncidentRow[];
  openActionItems: Array<{
    title: string;
    priority: string;
    incidentTitle?: string | null;
  }>;
  exposureHighlights: Array<{
    incidentTitle: string;
    level: string;
    summary: string;
  }>;
}

export interface DigestOutput {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  includedIncidentCount: number;
  includedCriticalCount: number;
}

const formatDate = (d: Date) => d.toISOString().slice(0, 10);

// ── HTML helpers ─────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PALETTE = {
  bg: "#000000",
  surface: "#0a0a0a",
  border: "rgba(255,255,255,0.1)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.55)",
  accent: "#FF6B00",
  critical: "#ff4040",
  high: "#FF6B00",
  medium: "#FFB800",
  low: "rgba(255,255,255,0.5)",
  info: "rgba(255,255,255,0.4)",
} as const;

function severityColor(sev: DigestIncidentRow["severity"]): string {
  return PALETTE[sev];
}

function sectionHeader(label: string): string {
  return `<div style="text-transform:uppercase;font-size:11px;letter-spacing:0.14em;color:${PALETTE.accent};margin:24px 0 10px;">${escapeHtml(label)}</div>`;
}

function incidentRow(row: DigestIncidentRow): string {
  const sev = severityColor(row.severity);
  const exposure = row.exposureLevel
    ? ` · exposure: ${escapeHtml(row.exposureLevel)}`
    : "";
  const vendor = row.vendorName ? ` · ${escapeHtml(row.vendorName)}` : "";
  return `<tr><td style="padding:10px 14px;border-top:1px solid ${PALETTE.border};vertical-align:top;">
    <div style="font-size:13px;font-weight:600;color:${PALETTE.text};">${escapeHtml(row.title)}</div>
    <div style="font-size:11px;color:${PALETTE.muted};margin-top:4px;">
      <span style="color:${sev};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">${row.severity}</span>
      · ${escapeHtml(row.incidentType)} · ${formatDate(row.detectedAt)}${vendor}${exposure}
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.78);margin-top:6px;line-height:1.5;">${escapeHtml(row.summaryShort)}</div>
  </td></tr>`;
}

// ── Main compose ─────────────────────────────────────────────────────

export function buildDigest(input: DigestInput): DigestOutput {
  const periodLabel = `${formatDate(input.periodStart)} → ${formatDate(input.periodEnd)}`;
  const subject = `INTERLIGENS — Security Digest hebdo — ${formatDate(input.periodEnd)}`;

  const execLine = (() => {
    const total = input.newIncidents.length;
    const crit = input.criticalIncidents.length;
    if (total === 0) {
      return "No new vendor incidents recorded this week. Existing open action items carried over.";
    }
    if (crit === 0) {
      return `${total} new incident${total === 1 ? "" : "s"} recorded. None rated critical.`;
    }
    return `${total} new incident${total === 1 ? "" : "s"} recorded — ${crit} rated critical.`;
  })();

  // ── HTML body ───────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${PALETTE.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${PALETTE.text};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PALETTE.bg};">
<tr><td align="center" style="padding:32px 20px;">
<table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;">

<tr><td style="padding-bottom:16px;">
  <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.14em;color:${PALETTE.accent};">INTERLIGENS · Security Center</div>
  <div style="font-size:22px;font-weight:700;color:${PALETTE.text};margin-top:6px;">Weekly digest — ${formatDate(input.periodEnd)}</div>
  <div style="font-size:12px;color:${PALETTE.muted};margin-top:4px;">Period: ${periodLabel}</div>
</td></tr>

<tr><td style="padding:14px 16px;background:${PALETTE.surface};border:1px solid ${PALETTE.border};border-radius:6px;">
  <div style="text-transform:uppercase;font-size:10px;letter-spacing:0.1em;color:${PALETTE.muted};margin-bottom:6px;">Executive summary</div>
  <div style="font-size:13px;color:${PALETTE.text};line-height:1.6;">${escapeHtml(execLine)}</div>
</td></tr>

${input.newIncidents.length > 0 ? `
<tr><td>${sectionHeader("New incidents this week")}</td></tr>
<tr><td><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${PALETTE.border};border-radius:6px;background:${PALETTE.surface};">
  ${input.newIncidents.map(incidentRow).join("")}
</table></td></tr>` : ""}

${input.criticalIncidents.length > 0 ? `
<tr><td>${sectionHeader("Critical / high severity")}</td></tr>
<tr><td><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid rgba(255,64,64,0.3);border-radius:6px;background:${PALETTE.surface};">
  ${input.criticalIncidents.map(incidentRow).join("")}
</table></td></tr>` : ""}

${input.exposureHighlights.length > 0 ? `
<tr><td>${sectionHeader("INTERLIGENS exposure highlights")}</td></tr>
<tr><td><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${PALETTE.border};border-radius:6px;background:${PALETTE.surface};">
  ${input.exposureHighlights
    .map(
      (e) => `<tr><td style="padding:10px 14px;border-top:1px solid ${PALETTE.border};">
    <div style="font-size:12px;font-weight:600;color:${PALETTE.text};">${escapeHtml(e.incidentTitle)}</div>
    <div style="font-size:11px;color:${PALETTE.muted};margin-top:3px;">Exposure: ${escapeHtml(e.level)}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:6px;line-height:1.5;">${escapeHtml(e.summary)}</div>
  </td></tr>`,
    )
    .join("")}
</table></td></tr>` : ""}

${input.openActionItems.length > 0 ? `
<tr><td>${sectionHeader("Open action items")}</td></tr>
<tr><td><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${PALETTE.border};border-radius:6px;background:${PALETTE.surface};">
  ${input.openActionItems
    .map(
      (a) => `<tr><td style="padding:9px 14px;border-top:1px solid ${PALETTE.border};">
    <div style="font-size:12px;color:${PALETTE.text};">
      <span style="color:${PALETTE.accent};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:10px;margin-right:8px;">${escapeHtml(a.priority)}</span>
      ${escapeHtml(a.title)}
      ${a.incidentTitle ? `<span style="color:${PALETTE.muted};font-size:11px;"> · ${escapeHtml(a.incidentTitle)}</span>` : ""}
    </div>
  </td></tr>`,
    )
    .join("")}
</table></td></tr>` : ""}

<tr><td style="padding-top:24px;">
  <a href="https://app.interligens.com/admin/security" style="display:inline-block;background:${PALETTE.accent};color:${PALETTE.text};text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;">Open Security Center &rarr;</a>
</td></tr>

<tr><td style="padding-top:20px;color:${PALETTE.muted};font-size:10px;line-height:1.6;">
  Sent by the INTERLIGENS Security Center — automated weekly digest. Period:
  ${periodLabel}. This email is admin-only and is never exposed to retail.
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  // ── Plaintext body ──────────────────────────────────────────────
  const textParts: string[] = [];
  textParts.push(`INTERLIGENS — Security Digest hebdo — ${formatDate(input.periodEnd)}`);
  textParts.push(`Period: ${periodLabel}`);
  textParts.push("");
  textParts.push(`SUMMARY: ${execLine}`);
  textParts.push("");

  if (input.newIncidents.length > 0) {
    textParts.push("NEW INCIDENTS THIS WEEK");
    for (const r of input.newIncidents) {
      textParts.push(
        `· [${r.severity.toUpperCase()}] ${r.title}${r.vendorName ? ` (${r.vendorName})` : ""} — ${formatDate(r.detectedAt)}`,
      );
      textParts.push(`  ${r.summaryShort}`);
    }
    textParts.push("");
  }

  if (input.criticalIncidents.length > 0) {
    textParts.push("CRITICAL / HIGH SEVERITY");
    for (const r of input.criticalIncidents) {
      textParts.push(`· ${r.title}${r.vendorName ? ` (${r.vendorName})` : ""}`);
      textParts.push(`  ${r.summaryShort}`);
    }
    textParts.push("");
  }

  if (input.exposureHighlights.length > 0) {
    textParts.push("INTERLIGENS EXPOSURE");
    for (const e of input.exposureHighlights) {
      textParts.push(`· ${e.incidentTitle} — exposure: ${e.level}`);
      textParts.push(`  ${e.summary}`);
    }
    textParts.push("");
  }

  if (input.openActionItems.length > 0) {
    textParts.push("OPEN ACTION ITEMS");
    for (const a of input.openActionItems) {
      textParts.push(
        `· [${a.priority.toUpperCase()}] ${a.title}${a.incidentTitle ? ` (${a.incidentTitle})` : ""}`,
      );
    }
    textParts.push("");
  }

  textParts.push("Open Security Center: https://app.interligens.com/admin/security");

  return {
    subject,
    bodyHtml: html,
    bodyText: textParts.join("\n"),
    includedIncidentCount: input.newIncidents.length,
    includedCriticalCount: input.criticalIncidents.length,
  };
}

// ── Delivery helper (Resend) ─────────────────────────────────────────

export interface SendResult {
  delivered: boolean;
  skipped?: "no_api_key";
  error?: string;
  resendId?: string;
}

export async function sendDigest(
  digest: DigestOutput,
  opts: { to?: string; from?: string } = {},
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[security-digest] RESEND_API_KEY missing — skipped (subject: ${digest.subject})`,
    );
    return { delivered: false, skipped: "no_api_key" };
  }

  const to =
    opts.to ??
    process.env.DIGEST_TO_EMAIL ??
    process.env.ALERT_EMAIL ??
    "admin@interligens.com";
  const from =
    opts.from ??
    process.env.DIGEST_FROM_EMAIL ??
    process.env.ALERT_FROM_EMAIL ??
    "alerts@interligens.com";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: digest.subject,
        html: digest.bodyHtml,
        text: digest.bodyText,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        "[security-digest] resend error",
        res.status,
        body.slice(0, 200),
      );
      return { delivered: false, error: `resend_${res.status}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { delivered: true, resendId: json.id };
  } catch (err) {
    console.error("[security-digest] fetch failed", err);
    return { delivered: false, error: "fetch_failed" };
  }
}
