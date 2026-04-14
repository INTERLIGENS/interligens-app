/**
 * POST /api/telegram/webhook
 *
 * Telegram Bot webhook endpoint. Validates `X-Telegram-Bot-Api-Secret-Token`
 * against TELEGRAM_WEBHOOK_SECRET, then routes the update to the bot lib.
 *
 * Fallback: ALWAYS return 200 OK. Telegram retries on non-200, which would
 * amplify any transient error. Logging is the only way we learn about failures.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { route, sendReply, type TelegramUpdate } from "@/lib/telegram/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function verifySecret(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // 1. Defensive config check — if TELEGRAM_BOT_TOKEN is missing, the bot is
  // a no-op stub. Still return 200 so Telegram doesn't retry.
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.warn("[telegram-webhook] Telegram not configured — returning stub 200");
    return NextResponse.json({ ok: true, stub: true });
  }

  // 2. Secret validation
  if (!verifySecret(req)) {
    console.warn("[telegram-webhook] invalid secret from", req.headers.get("x-forwarded-for"));
    // Still 200 to avoid Telegram retry storms on probing traffic.
    return NextResponse.json({ ok: true, rejected: true });
  }

  // 3. Parse update
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true, error: "parse_failed" });
  }

  // 4. Route + reply
  try {
    const routed = await route(update);
    if (routed) {
      await sendReply(routed.chatId, routed.reply);
    }
  } catch (err) {
    console.error("[telegram-webhook] handler failed", err);
  }

  // 5. ALWAYS return 200 — Telegram requires it.
  return NextResponse.json({ ok: true });
}

// Telegram occasionally probes with GET. Return a tiny health payload.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "telegram-webhook",
    configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET,
    ),
  });
}
