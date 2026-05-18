// src/lib/ops/alerting.ts
// Ops alerting engine — Telegram + Resend + console fallback. Never throws.

export type AlertLevel = "critical" | "warning" | "info";

const LEVEL_EMOJI: Record<AlertLevel, string> = {
  critical: "[CRITICAL]",
  warning:  "[WARNING]",
  info:     "[INFO]",
};

async function sendViaTelegram(level: AlertLevel, title: string, body: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OPS_CHAT_ID;
  if (!token || !chatId) return false;

  const text = `${LEVEL_EMOJI[level]} *${title}*\n\n${body}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[ops-alert] Telegram sendMessage failed", res.status, err.slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ops-alert] Telegram fetch error", e);
    return false;
  }
}

async function sendViaResend(level: AlertLevel, title: string, body: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const to = process.env.ALERT_EMAIL ?? process.env.DIGEST_TO_EMAIL ?? "admin@interligens.com";
  const from = process.env.ALERT_FROM_EMAIL ?? process.env.DIGEST_FROM_EMAIL ?? "alerts@interligens.com";
  const subject = `${LEVEL_EMOJI[level]} INTERLIGENS OPS — ${title}`;
  const html = `<pre style="font-family:monospace">${body.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[ops-alert] Resend failed", res.status, err.slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ops-alert] Resend fetch error", e);
    return false;
  }
}

export async function sendOpsAlert(level: AlertLevel, title: string, body: string): Promise<void> {
  const tag = `[ops-alert:${level}] ${title}`;
  console.log(tag, body);

  const [tg, email] = await Promise.all([
    sendViaTelegram(level, title, body),
    sendViaResend(level, title, body),
  ]);

  if (!tg && !email) {
    console.warn("[ops-alert] No channels configured (TELEGRAM_OPS_CHAT_ID + TELEGRAM_BOT_TOKEN or RESEND_API_KEY). Logged only.");
  }
}

// ── Typed trigger helpers ────────────────────────────────────────────────────

export async function alertDeadLetter(eventId: string, eventType: string, error: string): Promise<void> {
  await sendOpsAlert(
    "critical",
    "Dead letter created",
    `Event ID : ${eventId}\nType     : ${eventType}\nError    : ${error}`,
  );
}

export async function alertEventBacklog(pendingCount: number): Promise<void> {
  await sendOpsAlert(
    "warning",
    "Event backlog",
    `${pendingCount} pending events in DomainEvent queue (threshold: 50).`,
  );
}

export async function alertIdentityBacklog(pendingCount: number): Promise<void> {
  await sendOpsAlert(
    "warning",
    "Identity queue backlog",
    `${pendingCount} identity.review_required events pending (threshold: 20).`,
  );
}

export async function alertRecomputeFailed(handle: string, error: string): Promise<void> {
  await sendOpsAlert(
    "critical",
    "Recompute failed",
    `Handle : ${handle}\nError  : ${error}`,
  );
}

export async function alertIngestionFailureSpike(failedCount: number, windowH: number): Promise<void> {
  await sendOpsAlert(
    "warning",
    "Ingestion failure spike",
    `${failedCount} ingestion jobs failed in the last ${windowH}h (threshold: 5).`,
  );
}
