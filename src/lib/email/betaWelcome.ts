/**
 * Beta welcome email — sent when an investigator first enters a valid
 * access code and accepts the NDA.
 *
 * Uses Resend (same infra as feedback + alert pipelines). Fails silently
 * if RESEND_API_KEY is missing — never crashes the caller.
 */

type SendResult = {
  delivered: boolean;
  skipped?: "no_api_key" | "no_email";
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

function buildHtml(name: string, accessCode: string): string {
  const safeName = escapeHtml(name);
  const maskedCode =
    accessCode.length > 4
      ? `${accessCode.slice(0, 2)}…${accessCode.slice(-2)}`
      : "****";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>INTERLIGENS Beta Access Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#FFFFFF;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr><td style="padding-bottom:32px;">
          <div style="text-transform:uppercase;font-size:11px;letter-spacing:0.14em;color:#FF6B00;">INTERLIGENS · Investigators</div>
          <div style="font-size:24px;font-weight:700;color:#FFFFFF;margin-top:8px;">Beta access confirmed</div>
        </td></tr>
        <tr><td style="padding-bottom:24px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
          Welcome${safeName ? ", " + safeName : ""}. Your beta access code has been verified and your NDA acceptance is on file.
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;border:1px solid rgba(255,107,0,0.2);border-radius:6px;">
            <tr><td style="padding:16px;">
              <div style="text-transform:uppercase;font-size:10px;letter-spacing:0.08em;color:rgba(255,255,255,0.4);margin-bottom:6px;">Your access</div>
              <div style="font-family:ui-monospace,monospace;font-size:13px;color:#FFFFFF;">Code: ${maskedCode}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <a href="https://app.interligens.com" style="display:inline-block;background:#FF6B00;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:14px;font-weight:600;">Open your workspace →</a>
        </td></tr>
        <tr><td style="padding-bottom:24px;border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;color:rgba(255,255,255,0.5);font-size:12px;line-height:1.7;">
          <strong style="color:rgba(255,255,255,0.8);">NDA reminder.</strong> Everything you see in the platform — derived entities, hypotheses, timeline events, and any shared case — is covered by the INTERLIGENS beta NDA you accepted. Do not share screenshots, exports, or internal findings outside of the platform without explicit approval.
        </td></tr>
        <tr><td style="color:rgba(255,255,255,0.3);font-size:11px;line-height:1.6;">
          Questions or issues? Reach us at <a href="mailto:admin@interligens.com" style="color:#FF6B00;text-decoration:none;">admin@interligens.com</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendBetaWelcomeEmail(
  email: string | null | undefined,
  accessCode: string,
  name?: string | null
): Promise<SendResult> {
  if (!email || typeof email !== "string") {
    console.warn("[betaWelcome] no recipient email — skipped");
    return { delivered: false, skipped: "no_email" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[betaWelcome] RESEND_API_KEY missing — email skipped");
    return { delivered: false, skipped: "no_api_key" };
  }

  const from = process.env.BETA_FROM_EMAIL ?? "investigators@interligens.com";
  const html = buildHtml(name ?? "", accessCode);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "INTERLIGENS Beta Access Confirmed",
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        "[betaWelcome] resend error",
        res.status,
        body.slice(0, 200)
      );
      return { delivered: false, error: `resend_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    console.error("[betaWelcome] fetch failed", err);
    return { delivered: false, error: "fetch_failed" };
  }
}
