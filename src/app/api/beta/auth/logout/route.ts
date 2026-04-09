import { NextRequest, NextResponse } from "next/server";
import {
  getSessionTokenFromReq,
  revokeSession,
  clearSessionCookie,
} from "@/lib/security/investigatorAuth";
import { getClientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const sessionToken = getSessionTokenFromReq(req);
  const res = NextResponse.json({ ok: true });

  if (sessionToken) {
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") ?? "";
    await revokeSession(sessionToken, { ip, userAgent });
  }

  clearSessionCookie(res);
  return res;
}
