/**
 * Weekly Intelligence Digest — email sent every Monday 08:00 UTC.
 *
 * Pulls fresh numbers from the last 7 days:
 *   - new KOL profiles (KolProfile.createdAt)
 *   - new cashout events total USD (KolProceedsEvent.eventDate, raw SQL)
 *   - new social post candidates (SocialPostCandidate.discoveredAtUtc)
 *   - new watch alerts (WatchAlert.createdAt)
 *
 * Sends via Resend. Fails gracefully if RESEND_API_KEY is missing.
 * Matches the pro white-background visual style of betaWelcome.ts.
 */

import { prisma } from "@/lib/prisma";

type DigestStats = {
  newKolCount: number;
  newKolHandles: string[];
  proceedsUsd: number;
  proceedsEvents: number;
  newCandidates: number;
  newAlerts: number;
  windowStart: Date;
  windowEnd: Date;
};

type SendResult = {
  delivered: boolean;
  skipped?: "no_api_key";
  error?: string;
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[weeklyDigest] query failed", err);
    return fallback;
  }
}

export async function gatherStats(): Promise<DigestStats> {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [newKolsRaw, candidates, alerts] = await Promise.all([
    safe(
      () =>
        prisma.kolProfile.findMany({
          where: { createdAt: { gte: windowStart } },
          select: { handle: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      [] as Array<{ handle: string }>,
    ),
    safe(
      () =>
        prisma.socialPostCandidate.count({
          where: { discoveredAtUtc: { gte: windowStart } },
        }),
      0,
    ),
    safe(
      () =>
        prisma.watchAlert.count({
          where: { createdAt: { gte: windowStart } },
        }),
      0,
    ),
  ]);

  const proceedsRow = await safe(
    () =>
      prisma.$queryRaw<Array<{ total: number | null; events: bigint }>>`
        SELECT
          COALESCE(SUM("amountUsd"), 0)::float8 AS total,
          COUNT(*)::bigint AS events
        FROM "KolProceedsEvent"
        WHERE "eventDate" >= ${windowStart}
          AND "ambiguous" = false
      `,
    [] as Array<{ total: number | null; events: bigint }>,
  );

  const proceedsUsd = Number(proceedsRow[0]?.total ?? 0);
  const proceedsEvents = Number(proceedsRow[0]?.events ?? 0);

  return {
    newKolCount: newKolsRaw.length,
    newKolHandles: newKolsRaw.map((k) => k.handle),
    proceedsUsd,
    proceedsEvents,
    newCandidates: candidates,
    newAlerts: alerts,
    windowStart,
    windowEnd,
  };
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildHtml(stats: DigestStats): string {
  const PAGE_BG = "#F4F4F4";
  const CARD_BG = "#FFFFFF";
  const HEADER_BG = "#000000";
  const ACCENT = "#FF6B00";
  const TITLE = "#111111";
  const BODY_TEXT = "#333333";
  const SUBTITLE = "#666666";
  const LABEL_DIM = "#999999";
  const FOOTER_DIM = "#CCCCCC";
  const SEP = "#EEEEEE";

  const rangeLabel = `${formatDate(stats.windowStart)} → ${formatDate(stats.windowEnd)}`;
  const kolList =
    stats.newKolHandles.length > 0
      ? stats.newKolHandles.slice(0, 10).map((h) => `@${h}`).join(", ")
      : "—";

  const rows = [
    ["New KOL profiles", stats.newKolCount.toString()],
    ["Proceeds observed (USD)", formatUsd(stats.proceedsUsd)],
    ["Proceeds events", stats.proceedsEvents.toString()],
    ["Social post candidates", stats.newCandidates.toString()],
    ["Watch alerts", stats.newAlerts.toString()],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
    <tr>
      <td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:10px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${SUBTITLE};border-bottom:1px solid ${SEP};">${label}</td>
      <td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:10px 40px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${TITLE};text-align:right;border-bottom:1px solid ${SEP};">${value}</td>
    </tr>`,
    )
    .join("");

  return [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />',
    "<title>INTERLIGENS Weekly Digest</title></head>",
    `<body bgcolor="${PAGE_BG}" style="margin:0;padding:0;background-color:${PAGE_BG};color:${BODY_TEXT};font-family:Arial,Helvetica,sans-serif;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="background-color:${PAGE_BG};margin:0;padding:0;width:100%;">`,
    "<tr>",
    `<td bgcolor="${PAGE_BG}" align="center" style="background-color:${PAGE_BG};padding:40px 20px;">`,
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD_BG}" style="background-color:${CARD_BG};width:600px;max-width:600px;border:1px solid ${SEP};">`,

    // Header band
    "<tr>",
    `<td bgcolor="${HEADER_BG}" align="center" style="background-color:${HEADER_BG};padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;color:${ACCENT};">INTERLIGENS &middot; WEEKLY DIGEST</td>`,
    "</tr>",

    // Title
    "<tr>",
    `<td bgcolor="${CARD_BG}" align="center" style="background-color:${CARD_BG};padding:36px 40px 8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:${TITLE};line-height:1.25;">Intelligence digest</td>`,
    "</tr>",
    "<tr>",
    `<td bgcolor="${CARD_BG}" align="center" style="background-color:${CARD_BG};padding:0 40px 28px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${SUBTITLE};line-height:1.6;">${rangeLabel}</td>`,
    "</tr>",

    // Rows
    rowsHtml,

    // Recent KOL list
    "<tr>",
    `<td bgcolor="${CARD_BG}" colspan="2" style="background-color:${CARD_BG};padding:18px 40px 8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;color:${LABEL_DIM};text-transform:uppercase;">NEW HANDLES THIS WEEK</td>`,
    "</tr>",
    "<tr>",
    `<td bgcolor="${CARD_BG}" colspan="2" style="background-color:${CARD_BG};padding:0 40px 28px 40px;font-family:'Courier New',Courier,monospace;font-size:13px;color:${TITLE};line-height:1.7;word-break:break-word;">${kolList}</td>`,
    "</tr>",

    // Footer
    "<tr>",
    `<td bgcolor="${CARD_BG}" colspan="2" style="background-color:${CARD_BG};padding:20px 40px 28px 40px;border-top:1px solid ${SEP};font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${FOOTER_DIM};line-height:1.6;">Generated on ${stats.windowEnd.toISOString()} &middot; Questions? <a href="mailto:admin@interligens.com" style="color:${ACCENT};text-decoration:none;">admin@interligens.com</a></td>`,
    "</tr>",

    "</table></td></tr></table></body></html>",
  ].join("");
}

function buildText(stats: DigestStats): string {
  const range = `${formatDate(stats.windowStart)} → ${formatDate(stats.windowEnd)}`;
  return [
    "INTERLIGENS · WEEKLY DIGEST",
    "",
    `Intelligence digest — ${range}`,
    "",
    `New KOL profiles       : ${stats.newKolCount}`,
    `Proceeds observed      : ${formatUsd(stats.proceedsUsd)} (${stats.proceedsEvents} events)`,
    `Social post candidates : ${stats.newCandidates}`,
    `Watch alerts           : ${stats.newAlerts}`,
    "",
    "New handles:",
    stats.newKolHandles.slice(0, 10).map((h) => `  @${h}`).join("\n") || "  —",
    "",
    "admin@interligens.com",
  ].join("\n");
}

export async function sendWeeklyDigest(
  to: string = process.env.DIGEST_TO_EMAIL ?? "admin@interligens.com",
): Promise<SendResult & { stats?: DigestStats }> {
  const apiKey = process.env.RESEND_API_KEY;
  const stats = await gatherStats();

  if (!apiKey) {
    console.warn("[weeklyDigest] RESEND_API_KEY missing — would have sent:", {
      to,
      stats,
    });
    return { delivered: false, skipped: "no_api_key", stats };
  }

  const from = process.env.DIGEST_FROM_EMAIL ?? "digest@interligens.com";
  const html = buildHtml(stats);
  const text = buildText(stats);

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
        subject: `INTERLIGENS Weekly Digest — ${formatDate(stats.windowEnd)}`,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[weeklyDigest] resend error", res.status, body.slice(0, 200));
      return { delivered: false, error: `resend_${res.status}`, stats };
    }

    return { delivered: true, stats };
  } catch (err) {
    console.error("[weeklyDigest] fetch failed", err);
    return { delivered: false, error: "fetch_failed", stats };
  }
}
