/**
 * Sends an investigator's access code to their email address.
 * Used by admins to deliver or re-send access credentials.
 * Unlike betaWelcome.ts, this sends the FULL code (not masked).
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

function buildHtml(name: string, accessCode: string, label: string): string {
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(accessCode);
  const safeLabel = escapeHtml(label);
  const greeting = safeName ? "Hi " + safeName + "," : "Hi,";

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
    "<title>INTERLIGENS — Your Access Code</title>",
    "</head>",
    `<body bgcolor="${PAGE_BG}" style="margin:0;padding:0;background-color:${PAGE_BG};color:${BODY_TEXT};font-family:Arial,Helvetica,sans-serif;">`,

    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="background-color:${PAGE_BG};margin:0;padding:0;width:100%;">`,
    "<tr>",
    `<td bgcolor="${PAGE_BG}" align="center" style="background-color:${PAGE_BG};padding:40px 20px;">`,

    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD_BG}" style="background-color:${CARD_BG};width:560px;max-width:560px;border:1px solid ${SEP};">`,

    "<tr>",
    `<td bgcolor="${HEADER_BG}" align="center" style="background-color:${HEADER_BG};padding:20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;color:${ACCENT};">INTERLIGENS &middot; INVESTIGATORS</td>`,
    "</tr>",

    "<tr>",
    `<td bgcolor="${CARD_BG}" align="center" style="background-color:${CARD_BG};padding:40px 40px 12px 40px;font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;color:${TITLE};line-height:1.25;">Your access code</td>`,
    "</tr>",

    "<tr>",
    `<td bgcolor="${CARD_BG}" align="center" style="background-color:${CARD_BG};padding:0 40px 28px 40px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${SUBTITLE};line-height:1.6;">${greeting} Here is your INTERLIGENS investigator access code for slot <strong>${safeLabel}</strong>. Keep it confidential.</td>`,
    "</tr>",

    "<tr>",
    `<td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:0 40px 28px 40px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CODE_BG}" style="background-color:${CODE_BG};border-left:3px solid ${ACCENT};">`,
    "<tr>",
    `<td bgcolor="${CODE_BG}" style="background-color:${CODE_BG};padding:14px 16px 4px 16px;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;color:${LABEL_DIM};">ACCESS CODE</td>`,
    "</tr>",
    "<tr>",
    `<td bgcolor="${CODE_BG}" style="background-color:${CODE_BG};padding:4px 16px 14px 16px;font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:700;color:${TITLE};letter-spacing:2px;">${safeCode}</td>`,
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",

    "<tr>",
    `<td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:0 40px 16px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BODY_TEXT};line-height:1.6;">To access the platform:</td>`,
    "</tr>",
    "<tr>",
    `<td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:0 40px 28px 40px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BODY_TEXT};line-height:1.8;">1. Go to <a href="https://app.interligens.com/access" style="color:${ACCENT};text-decoration:none;">app.interligens.com/access</a><br>2. Accept the NDA<br>3. Enter the access code above<br>4. You will be taken to your workspace</td>`,
    "</tr>",

    "<tr>",
    `<td bgcolor="${CARD_BG}" align="center" style="background-color:${CARD_BG};padding:0 40px 36px 40px;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">`,
    "<tr>",
    `<td bgcolor="${ACCENT}" style="background-color:${ACCENT};padding:14px 26px;">`,
    `<a href="https://app.interligens.com/access" target="_blank" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#000000;text-decoration:none;">Go to access page &rarr;</a>`,
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",

    "<tr>",
    `<td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:20px 40px 20px 40px;border-top:1px solid ${SEP};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${LABEL_DIM};line-height:1.7;"><strong style="color:${SUBTITLE}">NDA reminder.</strong> Your access code is personal and confidential. Do not share it. All platform content is covered by the INTERLIGENS beta NDA.</td>`,
    "</tr>",

    "<tr>",
    `<td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};padding:0 40px 28px 40px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${FOOTER_DIM};line-height:1.6;">Questions? <a href="mailto:admin@interligens.com" style="color:${ACCENT};text-decoration:none;">admin@interligens.com</a></td>`,
    "</tr>",

    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
}

function buildText(name: string, accessCode: string, label: string): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return [
    "INTERLIGENS · INVESTIGATORS",
    "",
    "Your access code",
    "",
    `${greeting} Here is your INTERLIGENS investigator access code for slot ${label}. Keep it confidential.`,
    "",
    `ACCESS CODE: ${accessCode}`,
    "",
    "To access the platform:",
    "1. Go to https://app.interligens.com/access",
    "2. Accept the NDA",
    "3. Enter the access code above",
    "4. You will be taken to your workspace",
    "",
    "---",
    "NDA reminder: Your access code is personal and confidential. Do not share it. All platform content is covered by the INTERLIGENS beta NDA.",
    "",
    "Questions? admin@interligens.com",
  ].join("\n");
}

export async function sendAccessCodeEmail(params: {
  email: string;
  accessCode: string;
  label: string;
  name?: string | null;
}): Promise<SendResult> {
  const { email, accessCode, label, name } = params;

  if (!email || typeof email !== "string") {
    console.warn("[accessCodeDelivery] no recipient email — skipped");
    return { delivered: false, skipped: "no_email" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[accessCodeDelivery] RESEND_API_KEY missing — email skipped");
    return { delivered: false, skipped: "no_api_key" };
  }

  const from = process.env.BETA_FROM_EMAIL ?? "investigators@interligens.com";
  const html = buildHtml(name ?? "", accessCode, label);
  const text = buildText(name ?? "", accessCode, label);

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
        subject: "INTERLIGENS — Your Investigator Access Code",
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[accessCodeDelivery] resend error", res.status, body.slice(0, 200));
      return { delivered: false, error: `resend_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    console.error("[accessCodeDelivery] fetch failed", err);
    return { delivered: false, error: "fetch_failed" };
  }
}
