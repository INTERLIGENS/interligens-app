/**
 * src/lib/security/investigatorAuth.ts
 *
 * Investigator dashboard auth — same cookie pattern as adminAuth.ts.
 * Token: INVESTIGATOR_TOKEN env var
 * Cookie: investigator_token httpOnly
 */

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "investigator_token";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8h

function safeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) {
      timingSafeEqual(ba, Buffer.alloc(ba.length));
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Read the investigator token from cookie. */
export function getInvestigatorTokenFromReq(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

/** Returns true if the request carries a valid investigator token. */
export function isInvestigatorAuth(req: NextRequest): boolean {
  const envToken = process.env.INVESTIGATOR_TOKEN;
  if (!envToken) return false;
  const provided = getInvestigatorTokenFromReq(req);
  if (!provided) return false;
  return safeCompare(provided, envToken);
}

/**
 * requireInvestigatorApi(req)
 * Returns a NextResponse (401/403/500) if auth fails, null if OK.
 */
export function requireInvestigatorApi(req: NextRequest): NextResponse | null {
  const envToken = process.env.INVESTIGATOR_TOKEN;
  if (!envToken) {
    return NextResponse.json(
      { error: "Server misconfiguration", detail: "INVESTIGATOR_TOKEN is not configured." },
      { status: 500 },
    );
  }

  const provided = getInvestigatorTokenFromReq(req);
  if (!provided) {
    return NextResponse.json(
      { error: "Unauthorized", detail: "Missing investigator_token cookie." },
      { status: 401 },
    );
  }

  if (!safeCompare(provided, envToken)) {
    return NextResponse.json(
      { error: "Forbidden", detail: "Invalid investigator token." },
      { status: 403 },
    );
  }

  return null;
}

/** Set investigator_token httpOnly cookie. */
export function setInvestigatorCookie(res: NextResponse): void {
  const token = process.env.INVESTIGATOR_TOKEN;
  if (!token) throw new Error("[investigatorAuth] INVESTIGATOR_TOKEN missing");
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

/** Clear investigator_token cookie. */
export function clearInvestigatorCookie(res: NextResponse): void {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
}
