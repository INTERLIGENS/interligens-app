/**
 * Partner API key authentication — parallel to checkAuth/requireAdmin.
 * Reads PARTNER_API_KEY from env. Never modifies existing auth.
 * Header: X-Partner-Key
 */

import { NextRequest, NextResponse } from "next/server";

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  const aPad = new Uint8Array(len);
  const bPad = new Uint8Array(len);
  aPad.set(aBytes);
  bPad.set(bBytes);
  let diff = 0;
  for (let i = 0; i < len; i++) diff |= aPad[i] ^ bPad[i];
  diff |= aBytes.length ^ bBytes.length;
  return diff === 0;
}

export async function validatePartnerKey(req: NextRequest): Promise<boolean> {
  const expected = process.env.PARTNER_API_KEY_V2 || process.env.PARTNER_API_KEY || "";
  if (expected.length === 0) {
    console.error("[partnerAuth] PARTNER_API_KEY_V2 / PARTNER_API_KEY not set — blocking request");
    return false;
  }
  const provided = req.headers.get("x-partner-key")?.trim() ?? "";
  if (provided.length === 0) return false;
  const valid = await timingSafeEqual(provided, expected);
  if (valid) {
    console.info("[partnerAuth] Partner key accepted — ip=%s path=%s",
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      req.nextUrl.pathname,
    );
  }
  return valid;
}

export function unauthorizedPartnerResponse(): NextResponse {
  return NextResponse.json(
    { error: "unauthorized", code: "INVALID_PARTNER_KEY" },
    { status: 401 }
  );
}
