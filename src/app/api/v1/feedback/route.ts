// src/app/api/v1/feedback/route.ts
// Public beta feedback endpoint — any user with a valid investigator_session cookie.
// Sends email via Resend (best-effort) and stores in FeedbackEntry.

import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromReq,
  validateSession,
} from "@/lib/security/investigatorAuth";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";

async function sendEmail(label: string, body: string, type: string, page: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_EMAIL ?? "feedback@interligens.com";
  if (!apiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "beta@interligens.com",
        to,
        subject: `Beta Feedback [${type}] — ${label}`,
        text: [`User: ${label}`, `Page: ${page}`, `Type: ${type}`, "", body].join("\n"),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), RATE_LIMIT_PRESETS.scan);
  if (!rl.allowed) return rateLimitResponse(rl);

  const token = getSessionTokenFromReq(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const session = await validateSession(token);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.slice(0, 3000).trim() : "";
  const type = typeof body.type === "string" ? body.type : "feedback";
  const page = typeof body.page === "string" ? body.page.slice(0, 200) : "demo";

  if (!message) return NextResponse.json({ error: "message_required" }, { status: 400 });

  const emailed = await sendEmail(session.label, message, type, page);

  if (!emailed) {
    try {
      await prisma.feedbackEntry.create({
        data: {
          accessId: session.accessId,
          investigatorName: session.label,
          type,
          body: `[${page}] ${message}`,
        },
      });
    } catch {
      // FeedbackEntry table may not exist — non-blocking
    }
  }

  return NextResponse.json({ success: true });
}
