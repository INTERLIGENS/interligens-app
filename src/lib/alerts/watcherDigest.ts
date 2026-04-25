/**
 * Watcher batch digest email — one email per scan window.
 * Used by watcher-v2 cron when WATCHER_EMAIL_MODE=digest (default).
 */

export type BatchSignal = {
  handle: string;
  signalCount: number;
  tokens: string[];
  snippet: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDigestHtml(signals: BatchSignal[]): string {
  const totalSignals = signals.reduce((s, r) => s + r.signalCount, 0);
  const kolCount = signals.length;
  const adminUrl = "https://app.interligens.com/admin/social/candidates";

  const rows = signals
    .sort((a, b) => b.signalCount - a.signalCount)
    .map((s) => {
      const tokens = s.tokens.length
        ? s.tokens.map((t) => escapeHtml(t)).join(", ")
        : "—";
      const kolUrl = `https://app.interligens.com/en/kol/${encodeURIComponent(s.handle)}`;
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #1a1a1a;">
            <a href="${kolUrl}" style="color:#FF6B00;text-decoration:none;font-weight:600;font-size:13px;">@${escapeHtml(s.handle)}</a>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #1a1a1a;text-align:center;color:#FFFFFF;font-size:13px;">${s.signalCount}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #1a1a1a;color:rgba(255,255,255,0.6);font-size:12px;">${tokens}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#FFFFFF;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;">
    <tr><td align="center" style="padding:32px 20px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr><td style="padding-bottom:24px;border-bottom:2px solid #FF6B00;">
          <div style="text-transform:uppercase;font-size:10px;letter-spacing:0.18em;color:#FF6B00;font-weight:700;">INTERLIGENS · Watcher Digest</div>
          <div style="font-size:26px;font-weight:800;color:#FFFFFF;margin-top:10px;letter-spacing:-0.02em;">Campaign Intelligence Report</div>
        </td></tr>

        <!-- Summary -->
        <tr><td style="padding:24px 0 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="text-align:center;padding:16px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:8px;">
                <div style="font-size:32px;font-weight:800;color:#FF6B00;">${kolCount}</div>
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.5);margin-top:4px;">KOLs Triggered</div>
              </td>
              <td width="12"></td>
              <td style="text-align:center;padding:16px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:8px;">
                <div style="font-size:32px;font-weight:800;color:#FFFFFF;">${totalSignals}</div>
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.5);margin-top:4px;">Signals Detected</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- KOL Table -->
        <tr><td style="padding-bottom:8px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#FF6B00;font-weight:700;margin-bottom:12px;">Active KOLs</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">
            <tr style="background:#111111;">
              <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.4);font-weight:700;">Handle</th>
              <th style="padding:8px 12px;text-align:center;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.4);font-weight:700;">Signals</th>
              <th style="padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.4);font-weight:700;">Tokens Detected</th>
            </tr>
            ${rows}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:24px 0;">
          <a href="${adminUrl}" style="display:inline-block;background:#FF6B00;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:0.04em;">Review All Signals →</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:16px;border-top:1px solid #1a1a1a;color:rgba(255,255,255,0.3);font-size:10px;line-height:1.7;">
          INTERLIGENS Watcher · Automated campaign intelligence digest.<br>
          To change email frequency, set <code style="background:#111;padding:1px 4px;border-radius:3px;">WATCHER_EMAIL_MODE</code> in Vercel env vars.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWatcherDigest(signals: BatchSignal[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[watcherDigest] RESEND_API_KEY missing — skipped");
    return;
  }

  const totalSignals = signals.reduce((s, r) => s + r.signalCount, 0);
  const kolCount = signals.length;

  const to = process.env.ALERT_EMAIL ?? "admin@interligens.com";
  const from = process.env.ALERT_FROM_EMAIL ?? "alerts@interligens.com";
  const subject = `INTERLIGENS Watcher — ${kolCount} KOL${kolCount !== 1 ? "s" : ""} · ${totalSignals} signal${totalSignals !== 1 ? "s" : ""}`;

  const html = buildDigestHtml(signals);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[watcherDigest] resend error", res.status, body.slice(0, 200));
    } else {
      console.log(`[watcherDigest] sent digest: ${kolCount} KOLs, ${totalSignals} signals`);
    }
  } catch (err) {
    console.error("[watcherDigest] fetch failed", err);
  }
}
