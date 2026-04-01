import { NextRequest, NextResponse } from "next/server";
import {
  loginWithAccessCode,
  auditLog,
  hashIP,
} from "@/lib/security/investigatorAuth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/security/rateLimit";

const LOGIN_RATE_LIMIT = {
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,                   // 5 attempts per IP
  keyPrefix: "rl:inv-login",
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";

  // Rate limiting
  const rl = await checkRateLimit(ip, LOGIN_RATE_LIMIT);
  if (!rl.allowed) {
    await auditLog({
      eventType: "login_rate_limited",
      ipHash: hashIP(ip),
      userAgent,
    });
    return rateLimitResponse(rl, "en");
  }

  // Parse body
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { code } = body;
  if (!code || typeof code !== "string" || code.length < 4) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Authenticate
  const res = NextResponse.json({ ok: true });
  const result = await loginWithAccessCode(code, res, { ip, userAgent });

  if (!result.success) {
    // Uniform delay — no timing oracle
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
    return NextResponse.json({ error: "Access denied" }, { status: 401 });
  }

  return res;
}
