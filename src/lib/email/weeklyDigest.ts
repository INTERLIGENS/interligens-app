/**
 * Weekly Intelligence Digest — retail-focused email (Tuesdays 09:00 UTC).
 *
 * Content (retail audience):
 *   - Top KOL cashouts ≥ $10K observed this week
 *   - New published KOL profiles flagged RED/CRITICAL
 *   - High-severity signals (rug, coordinated dump, hype with red flags)
 *   - Watch alerts (tier changes on tracked addresses)
 *   - Roll-up stats
 *
 * Resend transport. Degrades to console.log if RESEND_API_KEY is missing.
 * Matches betaWelcome.ts table-based HTML (Gmail/Outlook safe).
 */

import { prisma } from "@/lib/prisma";

type Cashout = {
  kolHandle: string;
  amountUsd: number;
  tokenSymbol: string | null;
  chain: string;
  eventDate: Date;
};

type NewKol = {
  handle: string;
  displayName: string | null;
  tier: string | null;
  totalDocumented: number | null;
};

type SignalRow = {
  type: string;
  severity: string | null;
  tokenAddress: string | null;
  influencerHandle: string | null;
  createdAt: Date;
};

type WatchAlertRow = {
  address: string;
  chain: string;
  previousTier: string | null;
  newTier: string;
  createdAt: Date;
};

type DigestStats = {
  windowStart: Date;
  windowEnd: Date;

  // Headline lists
  topCashouts: Cashout[];
  topNewKols: NewKol[];
  topSignals: SignalRow[];
  topWatchAlerts: WatchAlertRow[];

  // Roll-up
  newKolCount: number;
  proceedsUsd: number;
  proceedsEvents: number;
  newCandidates: number;
  newAlerts: number;
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

  const [
    newKolsRaw,
    candidates,
    alertsCount,
    topCashouts,
    topNewKols,
    topSignals,
    topWatchAlerts,
    proceedsRow,
  ] = await Promise.all([
    safe(
      () =>
        prisma.kolProfile.count({
          where: {
            createdAt: { gte: windowStart },
            publishStatus: "published",
          },
        }),
      0,
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
        prisma.watchAlert.count({ where: { createdAt: { gte: windowStart } } }),
      0,
    ),
    safe(
      () =>
        prisma.$queryRaw<Cashout[]>`
          SELECT
            "kolHandle",
            "amountUsd"::float8 AS "amountUsd",
            "tokenSymbol",
            "chain",
            "eventDate"
          FROM "KolProceedsEvent"
          WHERE "eventDate" >= ${windowStart}
            AND "ambiguous" = false
            AND "amountUsd" >= 10000
          ORDER BY "amountUsd" DESC
          LIMIT 5
        `,
      [] as Cashout[],
    ),
    safe(
      () =>
        prisma.kolProfile.findMany({
          where: {
            createdAt: { gte: windowStart },
            publishStatus: "published",
            tier: { in: ["CRITICAL", "HIGH"] },
          },
          select: {
            handle: true,
            displayName: true,
            tier: true,
            totalDocumented: true,
          },
          orderBy: [{ tier: "asc" }, { totalDocumented: "desc" }],
          take: 5,
        }),
      [] as NewKol[],
    ),
    safe(
      () =>
        prisma.signal.findMany({
          where: {
            createdAt: { gte: windowStart },
            severity: { in: ["critical", "high"] },
          },
          select: {
            type: true,
            severity: true,
            tokenAddress: true,
            createdAt: true,
            influencer: { select: { handle: true } },
          },
          orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
          take: 5,
        }).then((rows) =>
          rows.map((r) => ({
            type: r.type,
            severity: r.severity,
            tokenAddress: r.tokenAddress,
            influencerHandle: r.influencer?.handle ?? null,
            createdAt: r.createdAt,
          })),
        ),
      [] as SignalRow[],
    ),
    safe(
      () =>
        prisma.watchAlert.findMany({
          where: { createdAt: { gte: windowStart } },
          select: {
            newTier: true,
            previousTier: true,
            createdAt: true,
            watchedAddress: { select: { address: true, chain: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }).then((rows) =>
          rows.map((r) => ({
            address: r.watchedAddress.address,
            chain: r.watchedAddress.chain,
            previousTier: r.previousTier,
            newTier: r.newTier,
            createdAt: r.createdAt,
          })),
        ),
      [] as WatchAlertRow[],
    ),
    safe(
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
    ),
  ]);

  return {
    windowStart,
    windowEnd,
    topCashouts,
    topNewKols,
    topSignals,
    topWatchAlerts,
    newKolCount: newKolsRaw,
    proceedsUsd: Number(proceedsRow[0]?.total ?? 0),
    proceedsEvents: Number(proceedsRow[0]?.events ?? 0),
    newCandidates: candidates,
    newAlerts: alertsCount,
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

function shortAddr(a: string): string {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
const RED = "#C1121F";

function sectionHeader(label: string): string {
  return `
    <tr>
      <td bgcolor="${CARD_BG}" colspan="2" style="background-color:${CARD_BG};padding:22px 40px 10px 40px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;color:${LABEL_DIM};text-transform:uppercase;border-top:1px solid ${SEP};">${label}</td>
    </tr>`;
}

function emptyRow(text: string): string {
  return `
    <tr>
      <td bgcolor="${CARD_BG}" colspan="2" style="background-color:${CARD_BG};padding:4px 40px 18px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${SUBTITLE};">${text}</td>
    </tr>`;
}

function cashoutRows(rows: Cashout[]): string {
  if (rows.length === 0) return emptyRow("No cashouts above $10K tracked this week.");
  return rows
    .map(
      (r) => `
    <tr>
      <td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BODY_TEXT};border-bottom:1px solid ${SEP};">@${escapeHtml(r.kolHandle)} <span style="color:${LABEL_DIM};">· ${escapeHtml(r.tokenSymbol ?? "?")} · ${escapeHtml(r.chain)}</span></td>
      <td bgcolor="${CARD_BG}" align="right" style="background-color:${CARD_BG};padding:8px 40px;font-family:'Courier New',Courier,monospace;font-size:13px;font-weight:700;color:${RED};border-bottom:1px solid ${SEP};">${formatUsd(r.amountUsd)}</td>
    </tr>`,
    )
    .join("");
}

function kolRows(rows: NewKol[]): string {
  if (rows.length === 0) return emptyRow("No new RED/CRITICAL profiles published this week.");
  return rows
    .map(
      (k) => `
    <tr>
      <td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BODY_TEXT};border-bottom:1px solid ${SEP};">@${escapeHtml(k.handle)}${k.displayName ? ` <span style="color:${LABEL_DIM};">· ${escapeHtml(k.displayName)}</span>` : ""}</td>
      <td bgcolor="${CARD_BG}" align="right" style="background-color:${CARD_BG};padding:8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${k.tier === "CRITICAL" ? RED : ACCENT};border-bottom:1px solid ${SEP};">${escapeHtml(k.tier ?? "—")}${k.totalDocumented && k.totalDocumented > 0 ? ` · ${formatUsd(k.totalDocumented)}` : ""}</td>
    </tr>`,
    )
    .join("");
}

function signalRows(rows: SignalRow[]): string {
  if (rows.length === 0) return emptyRow("No critical or high-severity signals this week.");
  return rows
    .map(
      (s) => {
        const who = s.influencerHandle ? `@${escapeHtml(s.influencerHandle)}` : "—";
        const token = s.tokenAddress ? shortAddr(s.tokenAddress) : "";
        return `
    <tr>
      <td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BODY_TEXT};border-bottom:1px solid ${SEP};">${escapeHtml(s.type)} <span style="color:${LABEL_DIM};">· ${who}${token ? ` · ${escapeHtml(token)}` : ""}</span></td>
      <td bgcolor="${CARD_BG}" align="right" style="background-color:${CARD_BG};padding:8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;color:${s.severity === "critical" ? RED : ACCENT};border-bottom:1px solid ${SEP};text-transform:uppercase;">${escapeHtml(s.severity ?? "—")}</td>
    </tr>`;
      },
    )
    .join("");
}

function watchAlertRows(rows: WatchAlertRow[]): string {
  if (rows.length === 0) return emptyRow("No tier changes on watched addresses this week.");
  return rows
    .map(
      (a) => `
    <tr>
      <td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:8px 40px;font-family:'Courier New',Courier,monospace;font-size:12px;color:${BODY_TEXT};border-bottom:1px solid ${SEP};">${escapeHtml(shortAddr(a.address))} <span style="color:${LABEL_DIM};">· ${escapeHtml(a.chain)}</span></td>
      <td bgcolor="${CARD_BG}" align="right" style="background-color:${CARD_BG};padding:8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${a.newTier === "RED" || a.newTier === "CRITICAL" ? RED : ACCENT};border-bottom:1px solid ${SEP};">${escapeHtml(a.previousTier ?? "—")} → ${escapeHtml(a.newTier)}</td>
    </tr>`,
    )
    .join("");
}

function statsRows(stats: DigestStats): string {
  const rows: Array<[string, string]> = [
    ["New RED/CRITICAL profiles", String(stats.newKolCount)],
    ["Proceeds tracked this week", `${formatUsd(stats.proceedsUsd)} · ${stats.proceedsEvents} events`],
    ["Social posts flagged", String(stats.newCandidates)],
    ["Watch alerts fired", String(stats.newAlerts)],
  ];
  return rows
    .map(
      ([label, value]) => `
    <tr>
      <td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${SUBTITLE};border-bottom:1px solid ${SEP};">${label}</td>
      <td bgcolor="${CARD_BG}" align="right" style="background-color:${CARD_BG};padding:8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${TITLE};border-bottom:1px solid ${SEP};">${value}</td>
    </tr>`,
    )
    .join("");
}

export function buildHtml(stats: DigestStats): string {
  const rangeLabel = `${formatDate(stats.windowStart)} → ${formatDate(stats.windowEnd)}`;

  return [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head>',
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    "<title>INTERLIGENS Intelligence Digest</title></head>",
    `<body bgcolor="${PAGE_BG}" style="margin:0;padding:0;background-color:${PAGE_BG};color:${BODY_TEXT};font-family:Arial,Helvetica,sans-serif;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="background-color:${PAGE_BG};margin:0;padding:0;width:100%;">`,
    "<tr>",
    `<td bgcolor="${PAGE_BG}" align="center" style="background-color:${PAGE_BG};padding:40px 20px;">`,
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD_BG}" style="background-color:${CARD_BG};width:600px;max-width:600px;border:1px solid ${SEP};">`,

    // Header band
    "<tr>",
    `<td bgcolor="${HEADER_BG}" align="center" style="background-color:${HEADER_BG};padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;color:${ACCENT};">INTERLIGENS &middot; INTELLIGENCE DIGEST</td>`,
    "</tr>",

    // Title
    "<tr>",
    `<td bgcolor="${CARD_BG}" align="center" style="background-color:${CARD_BG};padding:36px 40px 6px 40px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:${TITLE};line-height:1.25;">What moved on crypto scams this week</td>`,
    "</tr>",
    "<tr>",
    `<td bgcolor="${CARD_BG}" align="center" style="background-color:${CARD_BG};padding:0 40px 20px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${SUBTITLE};line-height:1.6;">${rangeLabel}</td>`,
    "</tr>",

    // Sections
    sectionHeader("Biggest KOL cashouts — avoid these wallets"),
    cashoutRows(stats.topCashouts),

    sectionHeader("New RED/CRITICAL profiles — watch these handles"),
    kolRows(stats.topNewKols),

    sectionHeader("Red-flag signals — rug / coordinated dump / hype"),
    signalRows(stats.topSignals),

    sectionHeader("Watched addresses that got worse"),
    watchAlertRows(stats.topWatchAlerts),

    sectionHeader("Week in numbers"),
    statsRows(stats),

    // CTA
    "<tr>",
    `<td bgcolor="${CARD_BG}" colspan="2" align="center" style="background-color:${CARD_BG};padding:24px 40px 8px 40px;">`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">',
    "<tr>",
    `<td bgcolor="${ACCENT}" style="background-color:${ACCENT};padding:12px 24px;">`,
    `<a href="https://app.interligens.com/en/explorer" target="_blank" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#000000;text-decoration:none;">Open the Explorer &rarr;</a>`,
    "</td></tr></table></td></tr>",

    // Footer
    "<tr>",
    `<td bgcolor="${CARD_BG}" colspan="2" style="background-color:${CARD_BG};padding:22px 40px 28px 40px;border-top:1px solid ${SEP};font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${FOOTER_DIM};line-height:1.6;">Intelligence based on observed on-chain and social signals. Not financial advice. Reach us at <a href="mailto:admin@interligens.com" style="color:${ACCENT};text-decoration:none;">admin@interligens.com</a>.</td>`,
    "</tr>",

    "</table></td></tr></table></body></html>",
  ].join("");
}

function buildText(stats: DigestStats): string {
  const range = `${formatDate(stats.windowStart)} → ${formatDate(stats.windowEnd)}`;
  const lines: string[] = [];
  lines.push("INTERLIGENS · INTELLIGENCE DIGEST");
  lines.push(`Week ${range}`);
  lines.push("");

  lines.push("— Biggest KOL cashouts (≥ $10K) —");
  if (stats.topCashouts.length === 0) lines.push("  (none)");
  else
    for (const c of stats.topCashouts)
      lines.push(`  @${c.kolHandle} · ${c.tokenSymbol ?? "?"} · ${c.chain} · ${formatUsd(c.amountUsd)}`);
  lines.push("");

  lines.push("— New RED/CRITICAL profiles —");
  if (stats.topNewKols.length === 0) lines.push("  (none)");
  else
    for (const k of stats.topNewKols)
      lines.push(`  @${k.handle} · ${k.tier ?? "—"}${k.totalDocumented && k.totalDocumented > 0 ? ` · ${formatUsd(k.totalDocumented)}` : ""}`);
  lines.push("");

  lines.push("— Red-flag signals —");
  if (stats.topSignals.length === 0) lines.push("  (none)");
  else
    for (const s of stats.topSignals)
      lines.push(`  ${s.type} · ${s.influencerHandle ? "@" + s.influencerHandle : "—"} · ${s.severity ?? "—"}`);
  lines.push("");

  lines.push("— Watch alerts —");
  if (stats.topWatchAlerts.length === 0) lines.push("  (none)");
  else
    for (const a of stats.topWatchAlerts)
      lines.push(`  ${shortAddr(a.address)} · ${a.chain} · ${a.previousTier ?? "—"} → ${a.newTier}`);
  lines.push("");

  lines.push("— Week in numbers —");
  lines.push(`  New RED/CRITICAL profiles : ${stats.newKolCount}`);
  lines.push(`  Proceeds tracked          : ${formatUsd(stats.proceedsUsd)} (${stats.proceedsEvents} events)`);
  lines.push(`  Social posts flagged      : ${stats.newCandidates}`);
  lines.push(`  Watch alerts fired        : ${stats.newAlerts}`);
  lines.push("");
  lines.push("Open the Explorer: https://app.interligens.com/en/explorer");
  lines.push("admin@interligens.com");
  return lines.join("\n");
}

export async function generateWeeklyDigest(): Promise<{
  stats: DigestStats;
  html: string;
  text: string;
  subject: string;
}> {
  const stats = await gatherStats();
  return {
    stats,
    html: buildHtml(stats),
    text: buildText(stats),
    subject: `INTERLIGENS Intelligence Digest — Week ${formatDate(stats.windowEnd)}`,
  };
}

export async function sendWeeklyDigest(
  to: string = process.env.DIGEST_TO_EMAIL ?? "admin@interligens.com",
): Promise<SendResult & { stats?: DigestStats }> {
  const apiKey = process.env.RESEND_API_KEY;
  const { stats, html, text, subject } = await generateWeeklyDigest();

  if (!apiKey) {
    console.warn("[weeklyDigest] RESEND_API_KEY missing — would have sent:", {
      to,
      subject,
      counts: {
        cashouts: stats.topCashouts.length,
        newKols: stats.topNewKols.length,
        signals: stats.topSignals.length,
        watchAlerts: stats.topWatchAlerts.length,
      },
    });
    return { delivered: false, skipped: "no_api_key", stats };
  }

  const from = process.env.DIGEST_FROM_EMAIL ?? "digest@interligens.com";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
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
