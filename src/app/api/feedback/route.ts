// src/app/api/feedback/route.ts
// Public retail feedback endpoint — no auth, IP-rate-limited (3 req/min/IP).
// Stores in FeedbackReport table.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";

const RL_FEEDBACK = {
  windowMs: 60 * 1000,
  max: 3,
  keyPrefix: "rl:feedback",
};

const ALLOWED_TYPES = new Set(["false_positive", "missing_info", "scam_report"]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip, RL_FEEDBACK);
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: corsHeaders() });
  }

  const type = typeof body.type === "string" && ALLOWED_TYPES.has(body.type) ? body.type : "feedback";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 3000) : "";
  const address = typeof body.address === "string" ? body.address.trim().slice(0, 100) : null;
  const handle = typeof body.handle === "string" ? body.handle.trim().slice(0, 80) : null;
  const page = typeof body.page === "string" ? body.page.slice(0, 200) : null;

  if (!message) {
    return NextResponse.json({ error: "message_required" }, { status: 400, headers: corsHeaders() });
  }

  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 300);

  try {
    await prisma.feedbackReport.create({
      data: {
        type,
        message,
        address: address || null,
        handle: handle || null,
        ip: ip.slice(0, 64),
        userAgent,
        page,
      },
    });
  } catch (err) {
    console.error("[api/feedback] db store failed", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500, headers: corsHeaders() }
    );
  }

  return NextResponse.json({ success: true }, { headers: corsHeaders() });
}
