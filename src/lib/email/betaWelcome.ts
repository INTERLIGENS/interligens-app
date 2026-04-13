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
  const greeting = safeName ? "Welcome, " + safeName + "." : "Welcome.";
  const maskedCode =
    accessCode.length > 4
      ? accessCode.slice(0, 2) + "&hellip;" + accessCode.slice(-2)
      : "****";

  // Pro white-background layout (LinkedIn/Stripe style). The rule still applies:
  // every structural <td> carries BOTH bgcolor="…" AND style="background-color:…"
  // so Gmail/Outlook cannot strip the fill. Outer is light grey, inner card is
  // pure white, and a full-width black header band carries the brand eyebrow.
  const PAGE_BG = "#F4F4F4";
  const CARD_BG = "#FFFFFF";
  const HEADER_BG = "#000000";
  const CODE_BG = "#F8F8F8";
  const ACCENT = "#FF6B00";
  const TITLE = "#111111";
  const BODY_TEXT = "#333333";
  const SUBTITLE = "#666666";
  const LABEL_DIM = "#999999";
  const FOOTER_DIM = "#CCCCCC";
  const SEP = "#EEEEEE";

  return [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<html xmlns="http://www.w3.org/1999/xhtml">',
    "<head>",
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    "<title>INTERLIGENS Beta Access Confirmed</title>",
    "</head>",
    '<body bgcolor="' +
      PAGE_BG +
      '" style="margin:0;padding:0;background-color:' +
      PAGE_BG +
      ';color:' +
      BODY_TEXT +
      ';font-family:Arial,Helvetica,sans-serif;">',

    // OUTER wrapper — full-width light grey page background
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' +
      PAGE_BG +
      '" style="background-color:' +
      PAGE_BG +
      ';margin:0;padding:0;width:100%;">',
    "<tr>",
    '<td bgcolor="' +
      PAGE_BG +
      '" align="center" style="background-color:' +
      PAGE_BG +
      ';padding:40px 20px;">',

    // INNER 560px white card
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="' +
      CARD_BG +
      '" style="background-color:' +
      CARD_BG +
      ';width:560px;max-width:560px;border:1px solid ' +
      SEP +
      ';">',

    // Header band — full-width black strip with orange eyebrow
    "<tr>",
    '<td bgcolor="' +
      HEADER_BG +
      '" align="center" style="background-color:' +
      HEADER_BG +
      ';padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;color:' +
      ACCENT +
      ';">INTERLIGENS &middot; INVESTIGATORS</td>',
    "</tr>",

    // Title — dark on white, 28px, centered
    "<tr>",
    '<td bgcolor="' +
      CARD_BG +
      '" align="center" style="background-color:' +
      CARD_BG +
      ';padding:40px 40px 12px 40px;font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;color:' +
      TITLE +
      ';line-height:1.25;">Beta access confirmed</td>',
    "</tr>",

    // Subtitle — #666666 14px centered
    "<tr>",
    '<td bgcolor="' +
      CARD_BG +
      '" align="center" style="background-color:' +
      CARD_BG +
      ';padding:0 40px 28px 40px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:' +
      SUBTITLE +
      ';line-height:1.6;">' +
      greeting +
      " Your beta access code has been verified and your NDA acceptance is on file.</td>",
    "</tr>",

    // Access code block — light grey bg with orange left border
    "<tr>",
    '<td bgcolor="' +
      CARD_BG +
      '" style="background-color:' +
      CARD_BG +
      ';padding:0 40px 28px 40px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' +
      CODE_BG +
      '" style="background-color:' +
      CODE_BG +
      ';border-left:3px solid ' +
      ACCENT +
      ';">',
    "<tr>",
    '<td bgcolor="' +
      CODE_BG +
      '" style="background-color:' +
      CODE_BG +
      ';padding:14px 16px 4px 16px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;color:' +
      LABEL_DIM +
      ';">YOUR ACCESS</td>',
    "</tr>",
    "<tr>",
    '<td bgcolor="' +
      CODE_BG +
      '" style="background-color:' +
      CODE_BG +
      ";padding:4px 16px 14px 16px;font-family:'Courier New',Courier,monospace;font-size:14px;color:" +
      TITLE +
      ';">Code: ' +
      maskedCode +
      "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",

    // CTA button — orange bg, black text, nested table for Outlook
    "<tr>",
    '<td bgcolor="' +
      CARD_BG +
      '" align="center" style="background-color:' +
      CARD_BG +
      ';padding:0 40px 36px 40px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">',
    "<tr>",
    '<td bgcolor="' +
      ACCENT +
      '" style="background-color:' +
      ACCENT +
      ';padding:14px 26px;">',
    '<a href="https://app.interligens.com" target="_blank" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#000000;text-decoration:none;">Open your workspace &rarr;</a>',
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",

    // NDA reminder — #999999 12px, separator above
    "<tr>",
    '<td bgcolor="' +
      CARD_BG +
      '" style="background-color:' +
      CARD_BG +
      ';padding:20px 40px 20px 40px;border-top:1px solid ' +
      SEP +
      ';font-family:Arial,Helvetica,sans-serif;font-size:12px;color:' +
      LABEL_DIM +
      ';line-height:1.7;"><strong style="color:' +
      SUBTITLE +
      '">NDA reminder.</strong> Everything you see in the platform &ndash; derived entities, hypotheses, timeline events, and any shared case &ndash; is covered by the INTERLIGENS beta NDA you accepted. Do not share screenshots, exports, or internal findings outside of the platform without explicit approval.</td>',
    "</tr>",

    // Footer — #CCCCCC with orange link
    "<tr>",
    '<td bgcolor="' +
      CARD_BG +
      '" style="background-color:' +
      CARD_BG +
      ';padding:0 40px 28px 40px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:' +
      FOOTER_DIM +
      ';line-height:1.6;">Questions or issues? Reach us at <a href="mailto:admin@interligens.com" style="color:' +
      ACCENT +
      ';text-decoration:none;">admin@interligens.com</a>.</td>',
    "</tr>",

    "</table>", // inner 560
    "</td>",
    "</tr>",
    "</table>", // outer 100%
    "</body>",
    "</html>",
  ].join("");
}

function buildText(name: string, accessCode: string): string {
  const greeting = name ? "Welcome, " + name + "." : "Welcome.";
  const maskedCode =
    accessCode.length > 4
      ? accessCode.slice(0, 2) + "..." + accessCode.slice(-2)
      : "****";
  return [
    "INTERLIGENS · INVESTIGATORS",
    "",
    "Beta access confirmed",
    "",
    greeting +
      " Your beta access code has been verified and your NDA acceptance is on file.",
    "",
    "Your access code: " + maskedCode,
    "",
    "Open your workspace: https://app.interligens.com",
    "",
    "---",
    "NDA reminder: Everything you see in the platform - derived entities, hypotheses, timeline events, and any shared case - is covered by the INTERLIGENS beta NDA you accepted. Do not share screenshots, exports, or internal findings outside of the platform without explicit approval.",
    "",
    "Questions or issues? Reach us at admin@interligens.com",
  ].join("\n");
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
  const text = buildText(name ?? "", accessCode);

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
        bcc: "admin@interligens.com",
        subject: "INTERLIGENS Beta Access Confirmed",
        html,
        text,
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
