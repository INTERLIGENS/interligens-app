// src/app/api/cron/digest/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function sendViaResend(to: string[], subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.BETA_FROM_EMAIL ?? "investigators@interligens.com";
  if (!apiKey) {
    console.warn("[digest] RESEND_API_KEY not set — logging digest only");
    console.log("[digest] subject:", subject, "to:", to.join(", "));
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[digest] Resend error", res.status, body.slice(0, 200));
    return false;
  }
  return true;
}

function getRecipients(): string[] {
  const env = process.env.DIGEST_RECIPIENTS ?? process.env.ALERT_EMAIL ?? "";
  return env.split(",").map((e) => e.trim()).filter((e) => e.includes("@"));
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { generateDigest }       = await import("@/lib/digest/generator");
    const { generateDigestHtml }   = await import("@/lib/digest/emailTemplate");

    const data     = await generateDigest();
    const htmlEn   = generateDigestHtml(data, "en");
    const htmlFr   = generateDigestHtml(data, "fr");
    const recipients = getRecipients();

    if (recipients.length === 0) {
      console.warn("[digest] No recipients configured. Set DIGEST_RECIPIENTS or ALERT_EMAIL env var.");
      return NextResponse.json({ ok: true, sent: false, reason: "no_recipients", data });
    }

    const weekStr  = data.week_start.toISOString().slice(0, 10);
    const sent     = await sendViaResend(
      recipients,
      `INTERLIGENS Intelligence Digest — ${weekStr}`,
      htmlEn,   // default EN; FR can be added as second call if needed
    );

    console.log("[digest]", { sent, recipients: recipients.length, top_stat: data.top_stat });
    return NextResponse.json({ ok: true, sent, recipients: recipients.length, top_stat: data.top_stat, htmlFr: !!htmlFr });
  } catch (err) {
    console.error("[digest] cron error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
