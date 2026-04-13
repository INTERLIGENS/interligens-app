/**
 * KOL alert — fires when the watcher detects new shill candidates for a
 * given handle. Sends an email to the admin via Resend, falls back to
 * a console warning if RESEND_API_KEY is not configured. Never crashes.
 */

type SendResult = {
  delivered: boolean;
  skipped?: "no_api_key";
  error?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendKolAlert(
  handle: string,
  alertCount: number,
  signal: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[kolAlert] RESEND_API_KEY missing — skipped (${handle}, ${alertCount} alerts)`
    );
    return { delivered: false, skipped: "no_api_key" };
  }

  const to = process.env.ALERT_EMAIL ?? "admin@interligens.com";
  const from = process.env.ALERT_FROM_EMAIL ?? "alerts@interligens.com";

  const safeHandle = escapeHtml(handle);
  const safeSignal = escapeHtml(signal);
  const kolUrl = `https://app.interligens.com/en/kol/${encodeURIComponent(handle)}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#FFFFFF;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;">
    <tr><td align="center" style="padding:32px 20px;">
      <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr><td style="padding-bottom:20px;">
          <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.14em;color:#FF6B00;">INTERLIGENS · Watcher alert</div>
          <div style="font-size:22px;font-weight:700;color:#FFFFFF;margin-top:8px;">@${safeHandle}</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:4px;">${alertCount} new shill ${alertCount === 1 ? "signal" : "signals"} detected</div>
        </td></tr>
        <tr><td style="padding:14px 16px;background:#0a0a0a;border:1px solid rgba(255,107,0,0.25);border-radius:6px;margin-bottom:20px;">
          <div style="text-transform:uppercase;font-size:10px;letter-spacing:0.08em;color:rgba(255,255,255,0.4);margin-bottom:6px;">Signal</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.6;">${safeSignal}</div>
        </td></tr>
        <tr><td style="padding-top:20px;">
          <a href="${kolUrl}" style="display:inline-block;background:#FF6B00;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600;">Open KOL profile →</a>
        </td></tr>
        <tr><td style="padding-top:20px;color:rgba(255,255,255,0.3);font-size:10px;line-height:1.6;">
          Sent automatically by the INTERLIGENS watcher. Review in-platform.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

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
        subject: `INTERLIGENS Alert — @${handle} shill detected`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[kolAlert] resend error", res.status, body.slice(0, 200));
      return { delivered: false, error: `resend_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    console.error("[kolAlert] fetch failed", err);
    return { delivered: false, error: "fetch_failed" };
  }
}
