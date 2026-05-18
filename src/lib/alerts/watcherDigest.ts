/**
 * Watcher Campaign Intelligence Digest
 * Full HTML email + WatcherDigest DB record.
 *
 * Used by watcher-v2 cron when WATCHER_EMAIL_MODE=digest (default).
 */

import { prisma } from "@/lib/prisma";

// ── Input types ───────────────────────────────────────────────────────────────

export type BatchSignal = {
  handle: string;
  signalCount: number;
  tokens: string[];
  snippet: string;
};

export type CampaignSummary = {
  id: string;
  primaryTokenSymbol: string | null;
  primaryContractAddress: string | null;
  priority: string;
  kolHandles: string[];
  signalCount: number;
  claimPatterns: string[];
};

export type DigestInput = {
  windowStart: Date;
  windowEnd: Date;
  batchSignals: BatchSignal[];
  campaigns: CampaignSummary[];
};

// ── HTML builder ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function priorityColor(p: string): string {
  if (p === "CRITICAL") return "#FF3B5C";
  if (p === "HIGH")     return "#FF6B00";
  if (p === "MEDIUM")   return "#FFB800";
  return "#4a4a4a";
}

function priorityLabel(p: string): string {
  if (p === "CRITICAL") return "CRITICAL";
  if (p === "HIGH")     return "HIGH";
  if (p === "MEDIUM")   return "MEDIUM";
  return "LOW";
}

export function buildWatcherDigestHtml(input: DigestInput): string {
  const { windowStart, windowEnd, batchSignals, campaigns } = input;

  const kolCount    = batchSignals.length;
  const signalCount = batchSignals.reduce((s, r) => s + r.signalCount, 0);
  const highPriCampaigns = campaigns.filter((c) => c.priority === "HIGH" || c.priority === "CRITICAL");
  const campaignCount   = campaigns.length;
  const highPrioCount   = highPriCampaigns.length;

  const adminBase = "https://app.interligens.com/admin";
  const fmtTime = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";

  // ── Campaign rows ────────────────────────────────────────────────────────
  const campaignRows = highPriCampaigns.slice(0, 8).map((c) => {
    const token    = c.primaryTokenSymbol ? `$${esc(c.primaryTokenSymbol)}` : "—";
    const contract = c.primaryContractAddress
      ? `<span style="font-family:monospace;font-size:10px;color:rgba(255,255,255,0.4);">${esc(c.primaryContractAddress.slice(0, 12))}…</span>`
      : "—";
    const kols = c.kolHandles.slice(0, 4).map((h) =>
      `<a href="https://app.interligens.com/en/kol/${encodeURIComponent(h)}" style="color:#FF6B00;text-decoration:none;">@${esc(h)}</a>`
    ).join(" ");
    const claims = c.claimPatterns.length
      ? `<span style="color:#FFB800;font-size:10px;">${esc(c.claimPatterns.join(", "))}</span>`
      : "";
    const pc = priorityColor(c.priority);
    const pl = priorityLabel(c.priority);
    return `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid #181818;vertical-align:top;">
          <span style="display:inline-block;background:${pc}20;color:${pc};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;padding:2px 7px;border-radius:3px;border:1px solid ${pc}40;">${pl}</span>
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #181818;vertical-align:top;">
          <div style="font-size:14px;font-weight:700;color:#FFFFFF;">${token}</div>
          <div style="margin-top:3px;">${contract}</div>
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #181818;vertical-align:top;font-size:12px;">${kols}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #181818;vertical-align:top;text-align:center;color:#FFFFFF;font-size:13px;font-weight:700;">${c.signalCount}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #181818;vertical-align:top;">${claims}</td>
      </tr>`;
  }).join("");

  // ── KOL rows ─────────────────────────────────────────────────────────────
  const kolRows = batchSignals
    .sort((a, b) => b.signalCount - a.signalCount)
    .slice(0, 10)
    .map((s) => {
      const tokens = s.tokens.length ? s.tokens.map(esc).join(", ") : "—";
      const kolUrl = `https://app.interligens.com/en/kol/${encodeURIComponent(s.handle)}`;
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #181818;">
            <a href="${kolUrl}" style="color:#FF6B00;text-decoration:none;font-weight:600;font-size:13px;">@${esc(s.handle)}</a>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #181818;text-align:center;color:#FFFFFF;font-size:13px;font-weight:700;">${s.signalCount}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #181818;color:rgba(255,255,255,0.5);font-size:11px;">${tokens}</td>
        </tr>`;
    }).join("");

  // ── Token aggregation ─────────────────────────────────────────────────────
  const tokenMap = new Map<string, { count: number; kols: Set<string> }>();
  for (const s of batchSignals) {
    for (const t of s.tokens) {
      const key = t.replace(/^\$/, "").toUpperCase();
      if (!tokenMap.has(key)) tokenMap.set(key, { count: 0, kols: new Set() });
      const entry = tokenMap.get(key)!;
      entry.count += s.signalCount;
      entry.kols.add(s.handle);
    }
  }
  const topTokens = [...tokenMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const tokenRows = topTokens.map(([sym, data]) => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #181818;color:#FFFFFF;font-size:13px;font-weight:700;">$${esc(sym)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #181818;text-align:center;color:#FF6B00;font-size:13px;font-weight:700;">${data.count}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #181818;color:rgba(255,255,255,0.4);font-size:11px;">${[...data.kols].slice(0, 4).map((h) => `@${esc(h)}`).join(", ")}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#FFFFFF;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="padding-bottom:28px;border-bottom:2px solid #FF6B00;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#FF6B00;font-weight:700;">INTERLIGENS · WATCHER DIGEST</div>
    <div style="font-size:28px;font-weight:800;color:#FFFFFF;margin-top:10px;letter-spacing:-0.02em;">Campaign Intelligence Report</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:6px;">Scan window: ${esc(fmtTime(windowStart))} — ${esc(fmtTime(windowEnd))}</div>
  </td></tr>

  <!-- Summary stats -->
  <tr><td style="padding:24px 0 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="text-align:center;padding:16px 6px;background:#0d0d0d;border:1px solid #1c1c1c;border-radius:8px;">
          <div style="font-size:34px;font-weight:800;color:#FF6B00;">${kolCount}</div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.35);margin-top:5px;">KOLs</div>
        </td>
        <td width="8"></td>
        <td style="text-align:center;padding:16px 6px;background:#0d0d0d;border:1px solid #1c1c1c;border-radius:8px;">
          <div style="font-size:34px;font-weight:800;color:#FFFFFF;">${signalCount}</div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.35);margin-top:5px;">Signals</div>
        </td>
        <td width="8"></td>
        <td style="text-align:center;padding:16px 6px;background:#0d0d0d;border:1px solid #1c1c1c;border-radius:8px;">
          <div style="font-size:34px;font-weight:800;color:#FFFFFF;">${campaignCount}</div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.35);margin-top:5px;">Campaigns</div>
        </td>
        <td width="8"></td>
        <td style="text-align:center;padding:16px 6px;background:#0d0d0d;border:1px solid ${highPrioCount > 0 ? "#FF6B00" : "#1c1c1c"};border-radius:8px;">
          <div style="font-size:34px;font-weight:800;color:${highPrioCount > 0 ? "#FF6B00" : "#FFFFFF"};">${highPrioCount}</div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.35);margin-top:5px;">High Priority</div>
        </td>
      </tr>
    </table>
  </td></tr>

  ${highPriCampaigns.length > 0 ? `
  <!-- High Priority Campaigns -->
  <tr><td style="padding-top:8px;padding-bottom:8px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:#FF6B00;font-weight:700;margin-bottom:12px;">High Priority Campaigns</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080808;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">
      <tr style="background:#101010;">
        <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;white-space:nowrap;">Priority</th>
        <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;">Token</th>
        <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;">KOLs</th>
        <th style="padding:8px 14px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;">Signals</th>
        <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;">Claims</th>
      </tr>
      ${campaignRows}
    </table>
  </td></tr>` : ""}

  <!-- Top Active KOLs -->
  <tr><td style="padding-top:20px;padding-bottom:8px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:#FF6B00;font-weight:700;margin-bottom:12px;">Top Active KOLs</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080808;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">
      <tr style="background:#101010;">
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;">Handle</th>
        <th style="padding:8px 12px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;">Signals</th>
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;">Tokens</th>
      </tr>
      ${kolRows}
    </table>
  </td></tr>

  ${topTokens.length > 0 ? `
  <!-- Top Tokens -->
  <tr><td style="padding-top:20px;padding-bottom:8px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:#FF6B00;font-weight:700;margin-bottom:12px;">Top Tokens Mentioned</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#080808;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">
      <tr style="background:#101010;">
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;">Token</th>
        <th style="padding:8px 12px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;">Mentions</th>
        <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);font-weight:700;">KOLs</th>
      </tr>
      ${tokenRows}
    </table>
  </td></tr>` : ""}

  <!-- Actions -->
  <tr><td style="padding:28px 0 20px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:rgba(255,255,255,0.3);font-weight:700;margin-bottom:14px;">Actions</div>
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:10px;padding-bottom:8px;">
          <a href="${adminBase}/watcher" style="display:inline-block;background:#FF6B00;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.04em;">Watcher Dashboard →</a>
        </td>
        <td style="padding-right:10px;padding-bottom:8px;">
          <a href="${adminBase}/social/candidates" style="display:inline-block;background:#111;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:12px;font-weight:700;border:1px solid #2a2a2a;">Review Signals →</a>
        </td>
        <td style="padding-bottom:8px;">
          <a href="${adminBase}/kol" style="display:inline-block;background:#111;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:12px;font-weight:700;border:1px solid #2a2a2a;">KOL Registry →</a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding-top:16px;border-top:1px solid #1a1a1a;color:rgba(255,255,255,0.2);font-size:10px;line-height:1.7;">
    INTERLIGENS Watcher · Automated campaign intelligence digest.<br>
    Adjust frequency: set <code style="background:#111;padding:1px 5px;border-radius:3px;color:rgba(255,255,255,0.4);">WATCHER_EMAIL_MODE</code> in Vercel env (off / immediate / digest).
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Send + persist ────────────────────────────────────────────────────────────

export async function sendWatcherDigest(
  batchSignals: BatchSignal[],
  campaigns: CampaignSummary[] = [],
  windowStart?: Date,
  windowEnd?: Date,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const start  = windowStart ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end    = windowEnd   ?? new Date();

  const kolCount      = batchSignals.length;
  const signalCount   = batchSignals.reduce((s, r) => s + r.signalCount, 0);
  const highPrioCount = campaigns.filter((c) => c.priority === "HIGH" || c.priority === "CRITICAL").length;

  const html    = buildWatcherDigestHtml({ windowStart: start, windowEnd: end, batchSignals, campaigns });
  const subject = `INTERLIGENS Watcher Digest — ${kolCount} KOL${kolCount !== 1 ? "s" : ""} · ${signalCount} signal${signalCount !== 1 ? "s" : ""} · ${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""}`;

  let emailSentAt: Date | undefined;
  let emailStatus = "pending";

  if (!apiKey) {
    console.warn("[watcherDigest] RESEND_API_KEY missing — skipped");
    emailStatus = "skipped_no_key";
  } else {
    const to   = process.env.ALERT_EMAIL      ?? "admin@interligens.com";
    const from = process.env.ALERT_FROM_EMAIL ?? "alerts@interligens.com";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[watcherDigest] resend error", res.status, body.slice(0, 200));
        emailStatus = `error_${res.status}`;
      } else {
        emailSentAt = new Date();
        emailStatus = "sent";
        console.log(`[watcherDigest] sent: ${kolCount} KOLs, ${signalCount} signals, ${campaigns.length} campaigns`);
      }
    } catch (err) {
      console.error("[watcherDigest] fetch failed", err);
      emailStatus = "error_fetch";
    }
  }

  // Persist WatcherDigest record regardless of email outcome
  try {
    await prisma.watcherDigest.create({
      data: {
        windowStart:       start,
        windowEnd:         end,
        signalCount,
        kolCount,
        campaignCount:     campaigns.length,
        highPriorityCount: highPrioCount,
        emailSentAt:       emailSentAt ?? null,
        emailStatus,
        htmlSnapshot:      html.slice(0, 65000),
      },
    });
  } catch (err) {
    console.error("[watcherDigest] failed to persist WatcherDigest", err);
  }
}
